const config = require('./config.json');
const mongoUtils = require('./mongoUtils');
const loggerUtils = require('./loggerUtils');

const CATEGORIES = config.categories;
const DOAJ_API_URL = config.DOAJ_API_URL;
const REPUTED_PUBLISHERS = config.REPUTED_PUBLISHERS;
const REPUTED_JOURNALS = config.REPUTED_JOURNALS;
const MAX_CONSECUTIVE_ERRORS = 5;

// Function to fetch articles from DOAJ
async function fetchDOAJArticles(category = 'science', page = 1, pageSize = 100) {
    const fetch = (await import('node-fetch')).default;
    const url = `${DOAJ_API_URL}${category}?page=${page}&pageSize=${pageSize}`;
    loggerUtils.logInfo(`Fetching from URL: ${url}`);
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            loggerUtils.logError(`Failed to fetch from DOAJ for page ${page} in category ${category}. Status: ${response.status}: ${response.statusText}`);
            return { articles: null, total: 0 };
        }

        const data = await response.json();
        if (!Array.isArray(data.results) || data.results.length === 0) {
            loggerUtils.logInfo(`No articles found on page ${page} in category ${category}.`);
            return { articles: [], total: data.total };
        }

        return { articles: data.results, total: data.total };
    } catch (error) {
        loggerUtils.logError(`An error occurred while fetching from DOAJ: ${error}`);
        return { articles: null, total: 0 };
    }
}


async function insertIntoMongoDB(articles) {
    if (!Array.isArray(articles) || articles.length === 0) {
        loggerUtils.logError("No articles to insert into MongoDB.");
        return 0;
    }
    
    const transformedArticles = articles.map(article => ({
        title: article.bibjson?.title || '',
        author: article.bibjson?.author?.map(a => a.name) || [],
        affiliations: article.bibjson?.author?.map(a => a.affiliation) || [],
        publicationDate: article.admin?.created_date || '',
        source: 'DOAJ',
        uniqueID: article.bibjson?.identifier?.find(i => i.type === "doi")?.id || '',
        publisher: article.bibjson?.publisher || '',
        journal: article.bibjson?.journal?.title || article.bibjson?.title || '',
        URLs: article.bibjson?.link?.map(link => link.url) || [],
        fullTextURLs: article.bibjson?.link?.filter(link => link.type === "fulltext").map(link => link.url) || [],
        volume: article.bibjson?.journal?.volume || '',
        issueNumber: article.bibjson?.journal?.number || '',
        keywords: article.bibjson?.keywords || [],
        abstract: article.bibjson?.abstract || '',
        country: article.bibjson?.journal?.country || '',
        issns: article.bibjson?.issns || [],
        subject: article.bibjson?.subject?.map(sub => sub.term) || [],
        language: article.bibjson?.language || [],
        startPage: article.bibjson?.start_page || '',
        endPage: article.bibjson?.end_page || '',
        lastUpdated: article.last_updated || '',
        month: article.bibjson?.month || '',
        year: article.bibjson?.year || '',
        id: article.id || '',
        createdDate: article.created_date || ''
    }));

    loggerUtils.logInfo("Transformed Articles: ", JSON.stringify(transformedArticles, null, 2));

    try {
        await mongoUtils.insertMany(transformedArticles, 'articles_collection');
        loggerUtils.logInfo(`Attempted to insert ${transformedArticles.length} articles.`);

        for (let article of transformedArticles) {
            if (REPUTED_PUBLISHERS.includes(article.publisher) || REPUTED_JOURNALS.includes(article.journal)) {
                loggerUtils.logInfo(`Inserted reputed article: ${article.title} from publisher: ${article.publisher}`);
            }
        }

        return transformedArticles.length;

    } catch (error) {
        if (error.code === 11000) {
            const duplicateIDs = error.writeErrors.map(err => err.op ? err.op.uniqueID : 'undefined');
            loggerUtils.logWarn('Some articles were duplicates and were not inserted. Duplicate IDs:', duplicateIDs);
            const duplicateTitles = transformedArticles.filter(article => duplicateIDs.includes(article.uniqueID)).map(article => article.title);
            loggerUtils.logWarn('Titles of duplicate articles:', duplicateTitles);
        } else {
            loggerUtils.logError("Error inserting data:", error);
        }
        return 0;
    }
}


const DELAY_MS = 500;
const TOTAL_PAGES = 50;
const ITERATION_DELAY_MS = 3600000;

const fs = require('fs');

async function fetchAllArticles(categories) {
    let lastFetchedPage = require('./lastFetchedPage.json');  // Load the last fetched page numbers

    while (true) {
        for (const category of categories) {
            let consecutiveErrors = 0;
            let totalArticles = Infinity;  // Start with a large number
            let startPage = lastFetchedPage[category] + 1;  // Start from the next page
            
            for (let page = startPage; page <= Math.ceil(totalArticles / 100); page++) {  // Dynamic loop limit based on total articles
                let response = await fetchDOAJArticles(category, page);
                let articles = response.articles;
                totalArticles = response.total;  // Update total articles count based on API response
                
                if (articles === null) {  // Indicates a fetch error
                    consecutiveErrors++;
                    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                        loggerUtils.logInfo(`Skipping further pages in category ${category} due to consecutive fetch errors.`);
                        break;
                    }
                    continue;
                }

                if (articles.length === 0) {
                    loggerUtils.logInfo(`No more articles in category ${category}. Moving to the next category.`);
                    break;  // Exit the loop for the current category
                }

                loggerUtils.logInfo(`Total articles for category ${category}: ${totalArticles}`);

                // Prioritize articles from reputed publishers and journals
                articles.sort((a, b) => {
                    const aReputedPublisher = REPUTED_PUBLISHERS.includes(a.publisher);
                    const bReputedPublisher = REPUTED_PUBLISHERS.includes(b.publisher);
                    const aReputedJournal = REPUTED_JOURNALS.includes(a.journal);
                    const bReputedJournal = REPUTED_JOURNALS.includes(b.journal);

                    if (aReputedPublisher && !bReputedPublisher) return -1;
                    if (!aReputedPublisher && bReputedPublisher) return 1;
                    if (aReputedJournal && !bReputedJournal) return -1;
                    if (!aReputedJournal && bReputedJournal) return 1;

                    return 0;
                });

                const newArticleCount = await insertIntoMongoDB(articles);
                loggerUtils.logInfo(`Processed articles from page ${page} in category ${category}`);

                // Update the last fetched page number in the JSON file
                lastFetchedPage[category] = page;
                fs.writeFileSync('./lastFetchedPage.json', JSON.stringify(lastFetchedPage));

                await new Promise(resolve => setTimeout(resolve, DELAY_MS));
            }
        }

        loggerUtils.logInfo(`Completed one iteration of fetching. Waiting for ${ITERATION_DELAY_MS / 60000} minutes before the next iteration.`);
        await new Promise(resolve => setTimeout(resolve, ITERATION_DELAY_MS));
    }
}


// Open the MongoDB connection, then start fetching articles
mongoUtils.connect().then(() => {
    fetchAllArticles(CATEGORIES).catch(error => {
        loggerUtils.logError("Error in one of the iterations:", error);
    });
}).catch(err => {
    loggerUtils.logError("Error connecting to MongoDB:", err);
});
