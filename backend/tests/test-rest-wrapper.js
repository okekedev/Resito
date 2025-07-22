import { generateContent } from './config/gemini-rest.js';
import dotenv from 'dotenv';

dotenv.config();

async function test() {
  try {
    const response = await generateContent(
      'Hello Gemini 2.5 Flash! Respond with "REST WRAPPER WORKS!"',
      'gemini-2.5-flash',
      512
    );
    
    console.log('✅ Success:', response.text);
    console.log('Model:', response.modelVersion);
    console.log('Tokens used:', response.usageMetadata?.totalTokenCount);
    console.log('Thinking tokens:', response.usageMetadata?.thoughtsTokenCount);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

test();
