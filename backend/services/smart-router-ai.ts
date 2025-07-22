// ===== services/smart-router-ai.ts - FIXED for API Key Issues =====
import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Ensure environment variables are loaded
dotenv.config();

export interface SmartRouterResult {
  success: boolean;
  message: string;
  data?: {
    ipAddress: string;
    brand?: string;
    workingCredentials?: {
      username: string;
      password: string;
    };
    suggestedCredentials?: Array<{
      username: string;
      password: string;
      reason: string;
    }>;
  };
  duration?: number;
  aiCost?: number;
}

export class SmartRouterAI {
  /**
   * Direct Gemini API call with proper error handling
   */
  private static async callGeminiDirectly(prompt: string): Promise<any> {
    const apiKey = process.env.GOOGLE_API_KEY;
    
    console.log('🔑 API Key Debug in SmartRouterAI:');
    console.log('- API Key present:', !!apiKey);
    console.log('- API Key length:', apiKey?.length);
    console.log('- API Key starts with:', apiKey?.substring(0, 10));
    
    if (!apiKey) {
      throw new Error('GOOGLE_API_KEY environment variable not found');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const body = {
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        thinkingConfig: {
          thinkingBudget: 1024  // Balanced thinking for router analysis
        }
      }
    };

    console.log('🤖 Calling Gemini API directly...');
    console.log('🔗 URL:', url.replace(apiKey, 'API_KEY_HIDDEN'));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ Gemini API Error Response:', errorText);
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Gemini API Success!');
    return data;
  }

  /**
   * Let AI analyze the router and suggest the best credentials to try
   */
  static async analyzeAndSuggestCredentials(ipAddress: string): Promise<SmartRouterResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🤖 AI analyzing router at ${ipAddress} with Gemini 2.5 Flash...`);

      // Fetch the router's login page
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(`http://${ipAddress}`, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      clearTimeout(timeoutId);

      const html = await response.text();
      const headers = Object.fromEntries(response.headers.entries());

      // Use Gemini 2.5 Flash with optimized prompt
      const prompt = `You are a router security expert. Analyze this router's login page and identify the brand, then suggest the 3-5 most likely default credential combinations to try.

ROUTER LOGIN PAGE:
${html.substring(0, 2000)}

HTTP HEADERS:
${JSON.stringify(headers, null, 2)}

Based on this information:
1. Identify the router brand (Linksys, Netgear, D-Link, TP-Link, ASUS, Belkin, Apple, Cisco, Huawei, etc.)
2. Suggest 3-5 most likely username/password combinations for this specific router brand
3. Order them by likelihood of success
4. Explain your reasoning for each suggestion

Respond in this JSON format:
{
  "brand": "detected_brand",
  "confidence": 85,
  "credentials": [
    {
      "username": "admin",
      "password": "admin", 
      "reason": "Default for most Linksys routers"
    },
    {
      "username": "admin",
      "password": "",
      "reason": "Common blank password for this brand"
    }
  ]
}`;

      // Call Gemini directly with proper error handling
      const geminiResponse = await this.callGeminiDirectly(prompt);
      
      const aiResponse = geminiResponse.candidates[0].content.parts[0].text;
      
      // Parse AI response
      let analysis;
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in AI response');
        }
      } catch (parseError) {
        console.log('🤖 AI parsing failed, using fallback');
        console.log('AI Response was:', aiResponse);
        analysis = {
          brand: "Unknown",
          confidence: 50,
          credentials: [
            { username: "admin", password: "admin", reason: "Most common default" },
            { username: "admin", password: "password", reason: "Common alternative" },
            { username: "admin", password: "", reason: "Blank password" }
          ]
        };
      }

      console.log(`🎯 Gemini 2.5 Flash detected: ${analysis.brand} (${analysis.confidence}% confidence)`);
      
      return {
        success: true,
        message: `AI identified ${analysis.brand} router with ${analysis.credentials.length} suggested credentials`,
        data: {
          ipAddress,
          brand: analysis.brand,
          suggestedCredentials: analysis.credentials,
        },
        duration: Date.now() - startTime,
        aiCost: 0.01, // Gemini 2.5 Flash is very cost-effective
      };

    } catch (error: any) {
      console.error('🤖 Gemini 2.5 Flash analysis failed:', error);
      
      return {
        success: false,
        message: `AI analysis failed: ${error.message}`,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Test a specific credential combination
   */
  static async testCredentials(
    ipAddress: string, 
    username: string, 
    password: string
  ): Promise<{ success: boolean; details: string }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const auth = Buffer.from(`${username}:${password}`).toString('base64');
      
      const response = await fetch(`http://${ipAddress}`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Authorization': `Basic ${auth}`,
          'User-Agent': 'RouterApp/1.0',
        },
      });

      clearTimeout(timeoutId);

      if (response.status === 200) {
        const text = await response.text();
        // Look for admin panel indicators
        if (text.toLowerCase().includes('admin') || 
            text.toLowerCase().includes('settings') || 
            text.toLowerCase().includes('configuration') ||
            text.toLowerCase().includes('wireless')) {
          return { 
            success: true, 
            details: `Login successful - found admin interface` 
          };
        }
      }

      return { 
        success: false, 
        details: `HTTP ${response.status} - credentials rejected` 
      };

    } catch (error: any) {
      return { 
        success: false, 
        details: `Connection failed: ${error.message}` 
      };
    }
  }

  /**
   * Complete smart login flow - analyze router and try suggested credentials
   */
  static async smartLogin(ipAddress: string): Promise<SmartRouterResult> {
    const startTime = Date.now();
    
    try {
      // Step 1: Get AI suggestions from Gemini 2.5 Flash
      const analysis = await this.analyzeAndSuggestCredentials(ipAddress);
      
      if (!analysis.success || !analysis.data?.suggestedCredentials) {
        return analysis;
      }

      console.log(`🔐 Testing ${analysis.data.suggestedCredentials.length} Gemini 2.5 Flash suggested credentials...`);

      // Step 2: Try each suggested credential
      for (const cred of analysis.data.suggestedCredentials) {
        console.log(`🧪 Trying: ${cred.username}:${cred.password || '(blank)'} - ${cred.reason}`);
        
        const testResult = await this.testCredentials(ipAddress, cred.username, cred.password);
        
        if (testResult.success) {
          console.log(`✅ Success! Working credentials found via Gemini 2.5 Flash`);
          
          return {
            success: true,
            message: `Successfully logged in to ${analysis.data.brand} router`,
            data: {
              ipAddress,
              brand: analysis.data.brand,
              workingCredentials: {
                username: cred.username,
                password: cred.password,
              },
              suggestedCredentials: analysis.data.suggestedCredentials,
            },
            duration: Date.now() - startTime,
            aiCost: 0.01,
          };
        }
        
        console.log(`❌ Failed: ${testResult.details}`);
      }

      // No credentials worked
      return {
        success: false,
        message: `Could not find working credentials for ${analysis.data.brand} router`,
        data: {
          ipAddress,
          brand: analysis.data.brand,
          suggestedCredentials: analysis.data.suggestedCredentials,
        },
        duration: Date.now() - startTime,
        aiCost: 0.01,
      };

    } catch (error: any) {
      return {
        success: false,
        message: `Smart login failed: ${error.message}`,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Test API key functionality
   */
  static async testApiKey(): Promise<void> {
    console.log('🧪 Testing API key functionality...');
    
    try {
      const result = await this.callGeminiDirectly('Say "API key test successful" if you can read this.');
      console.log('✅ API Key Test Result:', result.candidates[0].content.parts[0].text);
    } catch (error: any) {
      console.log('❌ API Key Test Failed:', error.message);
    }
  }
}