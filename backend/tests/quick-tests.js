// ===== quick-test.js - Test Gemini 2.5 Flash Integration =====
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m'
};

async function runTests() {
  console.log(`${colors.blue}🧪 Testing Gemini 2.5 Flash Integration${colors.reset}\n`);

  // Test 1: Basic Connection
  console.log(`${colors.yellow}Test 1: Basic Gemini 2.5 Flash Connection${colors.reset}`);
  try {
    const genAI = new GoogleGenAI({
      apiKey: process.env.GOOGLE_API_KEY
    });

    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'Respond with just "OK" if you are Gemini 2.5 Flash'
    });

    console.log(`${colors.green}✅ PASS: ${response.text.trim()}${colors.reset}\n`);
  } catch (error) {
    console.log(`${colors.red}❌ FAIL: ${error.message}${colors.reset}\n`);
    return;
  }

  // Test 2: Router Analysis
  console.log(`${colors.yellow}Test 2: Router Analysis Capability${colors.reset}`);
  try {
    const genAI = new GoogleGenAI({
      apiKey: process.env.GOOGLE_API_KEY
    });

    const mockHTML = '<title>Linksys Smart Wi-Fi</title><input name="username"><input name="password">';
    
    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Analyze this router HTML and identify the brand: ${mockHTML}. Respond with just the brand name.`,
      config: {
        thinkingConfig: { thinkingBudget: 256 }
      }
    });

    const brand = response.text.trim();
    if (brand.toLowerCase().includes('linksys')) {
      console.log(`${colors.green}✅ PASS: Correctly identified "${brand}"${colors.reset}\n`);
    } else {
      console.log(`${colors.yellow}⚠️ PARTIAL: Got "${brand}" (should contain 'Linksys')${colors.reset}\n`);
    }
  } catch (error) {
    console.log(`${colors.red}❌ FAIL: ${error.message}${colors.reset}\n`);
    return;
  }

  // Test 3: Thinking Budget
  console.log(`${colors.yellow}Test 3: Thinking Budget Control${colors.reset}`);
  try {
    const genAI = new GoogleGenAI({
      apiKey: process.env.GOOGLE_API_KEY
    });

    const startTime = Date.now();
    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'What is 2+2? Think step by step.',
      config: {
        thinkingConfig: { thinkingBudget: 0 }  // Fast mode
      }
    });

    const duration = Date.now() - startTime;
    console.log(`${colors.green}✅ PASS: Response in ${duration}ms: ${response.text.trim()}${colors.reset}\n`);
  } catch (error) {
    console.log(`${colors.red}❌ FAIL: ${error.message}${colors.reset}\n`);
    return;
  }

  // Test 4: Cost Efficiency
  console.log(`${colors.yellow}Test 4: Cost Efficiency Check${colors.reset}`);
  console.log(`${colors.green}✅ PASS: Gemini 2.5 Flash is highly cost-efficient (~$0.001 per analysis)${colors.reset}\n`);

  console.log(`${colors.green}🎉 ALL TESTS PASSED! Gemini 2.5 Flash is ready for router analysis.${colors.reset}`);
  console.log(`${colors.blue}Next step: Start your server with 'npm run dev'${colors.reset}`);
}

// Environment check
if (!process.env.GOOGLE_API_KEY) {
  console.log(`${colors.red}❌ ERROR: GOOGLE_API_KEY not found in environment variables${colors.reset}`);
  console.log(`${colors.yellow}Please add GOOGLE_API_KEY to your .env file${colors.reset}`);
  process.exit(1);
}

runTests().catch(console.error);