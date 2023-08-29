require('dotenv').config();

const express = require('express');
const path = require('path');
const { YoutubeTranscript } = require('youtube-transcript');
const { OpenAIApi, Configuration } = require('openai');
const app = express();
const port = 3000;

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
});

const openai = new OpenAIApi(configuration);
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY); // Verify the API key

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public')));

// Endpoint to handle YouTube URL and fetch the transcript
app.post('/transcript', express.json(), async (req, res) => {
  const youtubeUrl = req.body.youtubeUrl;
  try {
    const videoId = new URL(youtubeUrl).searchParams.get('v');

    const transcriptResponse = await YoutubeTranscript.fetchTranscript(videoId);

    // Return the transcript as an array of text segments
    const transcript = transcriptResponse.map(entry => entry.text);
    res.json({ transcript });
  } catch (error) {
    console.error('Error fetching transcript:', error);
    res.status(500).send('Error fetching transcript');
  }
});

// Endpoint to analyze transcript
app.post('/analyze', express.json(), async (req, res) => {
  const transcript = req.body.transcript;

  // Define the conversation messages
  const messages = [
    {
      role: "system",
      content: "You are an assistant that analyzes transcripts into structured insights. Your task is to provide a clear and comprehensive breakdown of the transcript. Identify all distinct arguments presented in the transcript. For each argument, extract concise and relevant key points. For every key point, if there's a direct quotation from the transcript that adds context or clarity, link it immediately after the key point. Structure your analysis in the following format:\n\nArgument Header: Description of the argument.\n- Key Point 1: Concise supporting point for the argument.\n  - Quotation: Direct quote supporting Key Point 1 (if applicable).\n- Key Point 2: Another concise supporting point.\n  - Quotation: Direct quote for Key Point 2 (if applicable).\n\nEnsure each analysis is consistent and thorough. Repeat this structure for each argument identified. The key is conciseness and clarity."
    },
    {
      role: "user",
      content: `Analyze the following transcript:\n\n${transcript}`
    }
];
  
  try {
    // Call the Chat Completions API
    const completion = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: messages
    });

    // Process the response into a structured format
    const processedTranscript = processStructuredGPT4Response(completion.data.choices[0].message.content);

    // Send the structured response
    res.json({ processedTranscript });
  } catch (error) {
    console.error('Error analyzing transcript:', error.response ? error.response.data : error);
    res.status(500).send('Error analyzing transcript');
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});

function processStructuredGPT4Response(response) {
  // Split the response by arguments
  const arguments = response.split(/Argument Header:/).filter(Boolean);

  const structuredData = arguments.map(argument => {
    const lines = argument.trim().split('\n');
    const argumentHeader = lines[0].trim();

    const keyPointsArray = [];
    let currentKeyPoint = null;

    lines.slice(1).forEach(line => {
      if (line.startsWith('- Key Point')) {
        if (currentKeyPoint) {
          keyPointsArray.push(currentKeyPoint);
        }
        currentKeyPoint = {
          text: line.replace(/- Key Point \d+:/, '').trim(),
          quotation: null
        };
      } else if (line.startsWith('  - Quotation')) {
        if (currentKeyPoint) {
          currentKeyPoint.quotation = line.replace('  - Quotation:', '').trim();
        }
      }
    });

    if (currentKeyPoint) {
      keyPointsArray.push(currentKeyPoint);
    }

    return {
      argumentHeader,
      keyPoints: keyPointsArray
    };
  });

  return structuredData;
}

app.post('/fetchCitation', express.json(), async (req, res) => {
  const keyPoint = req.body.keyPoint;

  console.log("Received request for key point:", keyPoint);  // Log 1: After receiving the request

  // Define the conversation messages for GPT-4
  const messages = [
      {
          role: "system",
          content: "You are a skilled research assistant with expertise in academic research and a deep familiarity with APA citation format. Your task is to identify a maximum of two highly relevant and genuine academic sources from widely recognized journals or repositories that corroborate the following key point. The sources you provide must be genuine, originating from widely-acknowledged academic publications. Ensure each citation adheres strictly to APA format and is presented in alphabetical order by the last name of the lead author. If there are more than two authors for a source, only include the first two followed by et al. Present each citation as a separate bullet point using (-) and nothing else. Authenticity and relevance are paramount; avoid making up any sources or using lesser-known references."
          
      },
      {
          role: "user",
          content: keyPoint
      }
  ];

  console.log("Formed messages for OpenAI API:", messages);  // Log 2: Before making the OpenAI API call

  try {
      // Call the Chat Completions API
      const completion = await openai.createChatCompletion({
          model: 'gpt-4-0613',
          messages: messages
      });
      const citation = completion.data.choices[0]?.message?.content || "No citation found in APA format.";

      console.log("Received citation from OpenAI:", citation);  // Log 3: After getting the response from OpenAI

      res.json({ citation });
  } catch (error) {
      console.error('Error fetching citation:', error.response ? error.response.data : error);  // Enhanced error logging
      res.status(500).send('Error fetching citation');
  }
});

