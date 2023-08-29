function preprocessTranscript(rawTranscript) {
  // Remove any unwanted characters or artifacts (customize as needed)
  const cleanedTranscript = rawTranscript.replace(/\[Music\]|\[Applause\]/g, '');

  // Break down the transcript into sentences or paragraphs
  // Here, we'll split by full stops. You can modify this to suit your needs.
  const segments = cleanedTranscript.split('. ').map(segment => segment.trim() + '.');

  return segments;
}

let currentProgress = 0;

function incrementProgress(byPercent, message = "Processing...") {
    currentProgress += byPercent;
    if (currentProgress > 100) {
        currentProgress = 100;
    }
    updateLoadingProgress(currentProgress, message);
}



async function fetchCitations(aggregatedResults) {
    let totalKeyPoints = 0;
    let citationFetchPromises = [];

    // Calculate the total number of key points
    aggregatedResults.forEach(argument => totalKeyPoints += argument.keyPoints.length);

    // Calculate the progress increment for each key point, based on the 60% reserved for fetching citations
    const progressIncrementPerKeyPoint = 60 / totalKeyPoints;

    // Create promises for all the key points' citations
    aggregatedResults.forEach(argument => {
        argument.keyPoints.forEach(keyPoint => {
            citationFetchPromises.push(
                (async () => {
                    try {
                        console.log("Fetching citation for:", keyPoint.text);

                        const response = await fetch('/fetchCitation', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ keyPoint: keyPoint.text }),
                        });

                        // Update the loading bar based on the progress increment
                        incrementProgress(progressIncrementPerKeyPoint, "Fetching citations...");
                        
                        console.log('Raw response:', await response.clone().text());

                        if (response.ok) {
                            const { citation } = await response.json();
                            console.log("Received citation:", citation);

                            const citationsList = document.querySelector(`.citations-list[data-keyPoint="${keyPoint.text}"]`);
                            if (citationsList) {
                                citationsList.innerHTML = '';
                                citation.split('\n').filter(cit => cit.trim()).forEach(cit => {
                                    const listItem = document.createElement('li');
                                    listItem.className = 'citation';
                                    listItem.textContent = cit;
                                    citationsList.appendChild(listItem);
                                });
                                console.log("Updated DOM with citation for:", keyPoint.text);
                            } else {
                                console.error("Couldn't find the citation element for key point:", keyPoint.text);
                            }
                        } else {
                            console.error('Server responded with status:', response.status);
                        }

                    } catch (error) {
                        console.error('Error fetching citation for key point:', keyPoint.text, error);
                        // Update the loading bar's message on error
                        updateLoadingProgress(100, "An error occurred while fetching citations.");
                        setTimeout(hideLoadingBar, 3000); // Optionally, hide the loading bar after a short delay
                    }
                })()
            );
        });
    });

    // Execute all the promises concurrently
    await Promise.all(citationFetchPromises);

    // Hide the loading bar once all citations are fetched
    hideLoadingBar();
}


async function fetchTranscript() {
    const youtubeUrl = document.getElementById('youtubeUrl').value;

    // Only proceed if there's a valid URL provided
    if (!youtubeUrl) {
        alert('Please provide a valid YouTube URL.');
        return;
    }

    // Start by showing the loading bar with an initial message
    showLoadingBar("Fetching transcript...");

    try {
        const response = await fetch('/transcript', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ youtubeUrl }),
        });

        const { transcript } = await response.json();

        // Convert the transcript array into a string
        const transcriptStr = transcript.join(' ');

        // Segment the transcript string
        const sections = breakIntoSections(transcriptStr);

        // Update the loading bar message for analysis
        incrementProgress(20, "Analyzing transcript...");

        // Analyze the transcript sections
        const allResults = await analyzeTranscript(sections);

        // Aggregate the results
        const aggregatedResults = allResults.flatMap(result => result.processedTranscript);

        // Display the results
        displayArguments(aggregatedResults);

        // Introduce a delay to make sure the message is noticeable
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Update the loading bar message for fetching citations
        incrementProgress(20, "Fetching citations...");

        // Fetch citations for the key points
        await fetchCitations(aggregatedResults);

        // Hide the loading bar once everything is done
        hideLoadingBar();

    } catch (error) {
        console.error(error);
        // Update the loading bar's message on error
        updateLoadingProgress(100, "An error occurred. Please try again.");
        setTimeout(hideLoadingBar, 3000); // Optionally, hide the loading bar after a short delay
    }
}



function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}



async function analyzeTranscript(transcriptSections) {
    const allPromises = transcriptSections.map(async section => {
        try {
            const response = await fetch('/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ transcript: section }),
            });

            return await response.json();
        } catch (error) {
            console.error(error);
            // Update the loading bar's message on error
            updateLoadingProgress(100, "An error occurred while analyzing a transcript section.");
            setTimeout(hideLoadingBar, 3000); // Optionally, hide the loading bar after a short delay
            return null;
        }
    });

    // Wait for all the promises to resolve
    const results = await Promise.all(allPromises);

    // Increment the loading bar progress only after all analysis is done
    incrementProgress(33, "Fetching citations...");

    return results;
}




function displayArguments(argumentsData) {
    const container = document.getElementById('argumentsContainer');
    container.innerHTML = ''; // Clear previous content
  
    argumentsData.forEach(argument => {
        // Create a section for each argument
        const section = document.createElement('div');
        section.className = 'argument-section';
  
        // Argument Header
        const header = document.createElement('div');
        header.className = 'argument-header';
  
        // Add the arrow span
        const arrowSpan = document.createElement('span');
        arrowSpan.className = 'arrow-icon';
        arrowSpan.textContent = '⌃';  // Using the Unicode character U+2303
        header.appendChild(arrowSpan);
  
        // Add the text for the argument header inside its own span
        const textSpan = document.createElement('span');
        textSpan.className = 'header-text';
        textSpan.textContent = argument.argumentHeader;
        header.appendChild(textSpan);
  
        // Attach the click event to toggle content
        header.onclick = () => toggleContent(content);
        section.appendChild(header);
  
        // Content (Key Points, Quotations, and Citations)
        const content = document.createElement('div');
        content.style.display = 'none'; // Hidden by default
        argument.keyPoints.forEach(keyPoint => {
            // Key Point
            const kpDiv = document.createElement('div');
            kpDiv.className = 'key-point';
            kpDiv.textContent = keyPoint.text;
            content.appendChild(kpDiv);
  
            // Quotation (if applicable)
            if (keyPoint.quotation) {
                const quoteDiv = document.createElement('div');
                quoteDiv.className = 'quotation';
                quoteDiv.textContent = keyPoint.quotation;
                content.appendChild(quoteDiv);
            }
  
            // Placeholder for Citations (Now, it will be a bulleted list)
            const citationsList = document.createElement('ul');
            citationsList.className = 'citations-list';
            citationsList.setAttribute('data-keyPoint', keyPoint.text);
            const listItem = document.createElement('li');
            listItem.className = 'citation';
            listItem.textContent = 'Fetching citation...';  // Placeholder text
            citationsList.appendChild(listItem);  // Append the placeholder to the list
            content.appendChild(citationsList);
        });
        section.appendChild(content);
  
        // Append the section to the container
        container.appendChild(section);
    });
}



// Function to break the transcript into sections (customize as needed)
function breakIntoSections(transcript, maxTokens = 7500) {
  // Ensure the transcript is a string
  if (typeof transcript !== 'string') {
      console.error('Transcript is not a string:', transcript);
      return [];
  }

  // Split the transcript into sentences based on full stops and paragraph breaks
  const sentences = transcript.split(/(?<=[.!?])\s+/);

  const sections = [];
  let currentSection = [];
  let currentTokens = 0;

  sentences.forEach(sentence => {
      // Estimate tokens (rough estimate as 1 token ~ 4 characters)
      const estimatedTokens = Math.ceil(sentence.length / 4);

      // If adding the current sentence doesn't exceed the token limit, add it to the current section
      if (currentTokens + estimatedTokens <= maxTokens) {
          currentSection.push(sentence);
          currentTokens += estimatedTokens;
      } else {
          // Check for the last occurrence of conjunctions within the token limit
          const lastConjunction = currentSection.join(' ').lastIndexOf(/but|however|although/);
          if (lastConjunction !== -1) {
              sections.push(currentSection.join(' ').substring(0, lastConjunction).trim());
              currentSection = [currentSection.join(' ').substring(lastConjunction).trim() + ' ' + sentence];
          } else {
              // If no conjunction is found, finalize the current section and start a new one
              sections.push(currentSection.join(' '));
              currentSection = [sentence];
          }
          currentTokens = estimatedTokens;
      }
  });

  // Add the last section if it's not empty
  if (currentSection.length > 0) {
      sections.push(currentSection.join(' '));
  }

  return sections;
}


function toggleContent(content) {
    const isHidden = content.style.display === 'none';
    content.style.display = isHidden ? 'block' : 'none';
    content.previousElementSibling.classList.toggle('expanded', isHidden);
}

function showLoadingBar(message = "Loading...") {
    document.getElementById("loadingText").innerText = message;
    document.getElementById("loadingFill").style.width = '0%';
    document.getElementById("loadingContainer").style.display = 'block';
}

function updateLoadingProgress(percentage, message) {
    if (message) {
        document.getElementById("loadingText").innerText = message;
    }
    document.getElementById("loadingFill").style.width = `${percentage}%`;
}

function hideLoadingBar() {
    document.getElementById("loadingContainer").style.display = 'none';
}
