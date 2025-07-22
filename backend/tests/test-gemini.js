import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

async function testBasicConnection() {
  try {
    console.log('🧪 Testing Gemini 2.5 Flash connection...');
    
    const genAI = new GoogleGenAI({
      apiKey: process.env.GOOGLE_API_KEY
    });

    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'Hello! Are you working with Gemini 2.5 Flash?'
    });

    console.log('✅ Success! Gemini 2.5 Flash Response:');
    console.log(response.text);
    
    return true;
  } catch (error) {
    console.error('❌ Gemini test failed:', error.message);
    return false;
  }
}

testBasicConnection();