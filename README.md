
# InCite: Analyze, Summarize, and Cite YouTube Content

## Introduction

InCite is a powerful web application aimed at enhancing the way we consume YouTube videos. At its core lies "ReCite," a sophisticated system that not only fetches and analyzes YouTube transcripts but also summarizes them into arguments, key points, and quotations. Subsequently, it fetches academic citations from MongoDB to provide academic backing for the key points made in the video.

## How It Works

InCite serves as an educational bridge between YouTube content and academic sources. Users input a YouTube URL, and the system performs the following:

1. Fetches the transcript of the YouTube video.
2. Utilizes the GPT API to summarize the transcript into arguments, key points, and quotations.
3. Calls upon a MongoDB database to provide academic citations that substantiate the key points.

This tool is ideal for those who wish to critically evaluate YouTube content and explore related academic material.

## Technical Features

### Frontend

#### User Interface (index.html)
- Designed using HTML5 and styled with CSS.
- Features a simple form for YouTube URL submission and a display area for processed information.

#### JavaScript Logic (script.js)
- `preprocessTranscript`: Cleans up fetched YouTube transcripts.
- `fetchCitations`: Gathers relevant academic citations asynchronously.
- `incrementProgress`: Manages a progress bar for better user experience.

### Backend (Node.js, Express)

#### Server Configuration (server.js)
- Initializes an Express server on port 3000.
- Configures OpenAI's GPT API for text summarization and analysis.

#### Data Fetching and Processing (doajFetcher.js)
- `fetchDOAJArticles`: Asynchronously fetches academic articles from the Directory of Open Access Journals (DOAJ).
- Pagination and error-handling mechanisms are in place for robustness.

### Utilities

#### Logging Mechanism (loggerUtils.js)
- Custom-built logging utility based on the Winston library.
- Categorized logs (`info`, `error`, `warn`) are maintained for debugging and monitoring.

#### MongoDB Utility (mongoUtils.js)
- Manages MongoDB connections, including connection establishment and termination.
- Features methods like `insertMany` for bulk document insertion.

## API Endpoints

- `POST /transcript`: Accepts a YouTube URL and returns a processed and summarized transcript along with academic citations.

## Installation and Usage

1. Clone the repository.
2. Run `npm install` to install the required dependencies.
3. Populate the `.env` file with necessary API keys and MongoDB URI.
4. Run `npm start` to start the application.

## Contribution Guidelines

Contributions are welcome. Please fork the repository, create your branch, make changes, and submit a pull request.

## License

This project is licensed under the MIT License.
