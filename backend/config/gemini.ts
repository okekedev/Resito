import { GoogleGenerativeAI } from '@google/generative-ai';

// Google Gemini setup
export const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

// Get the right model based on task complexity
export const getGeminiModel = (task: 'simple' | 'complex' | 'vision') => {
  switch (task) {
    case 'simple':
      return genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }); // Cheapest/fastest
    case 'complex':
      return genAI.getGenerativeModel({ model: 'gemini-1.5-pro' }); // Better reasoning
    case 'vision':
      return genAI.getGenerativeModel({ model: 'gemini-1.5-pro-vision' }); // Vision tasks
    default:
      return genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }
};
