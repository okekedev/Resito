// ===== services/smart-router-ai.ts =====
import fetch from 'node-fetch';
import { getGeminiModel } from '../config/gemini.js';

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
   * Let AI analyze the router and suggest the best credentials to try
   */
  static async analyzeAndSuggestCredentials(ipAddress: string): Promise<SmartRouterResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🤖 AI analyzing router at ${ipAddress}...`);

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

      // Let AI analyze everything and suggest credentials
      const model = getGeminiModel('complex');
      
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

      const result = await model.generateContent(prompt);
      const aiResponse = result.response.text();
      
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

      console.log(`🎯 AI detected: ${analysis.brand} (${analysis.confidence}% confidence)`);
      
      return {
        success: true,
        message: `AI identified ${analysis.brand} router with ${analysis.credentials.length} suggested credentials`,
        data: {
          ipAddress,
          brand: analysis.brand,
          suggestedCredentials: analysis.credentials,
        },
        duration: Date.now() - startTime,
        aiCost: 0.02, // Rough estimate
      };

    } catch (error) {
      console.error('🤖 AI analysis failed:', error);
      
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

    } catch (error) {
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
      // Step 1: Get AI suggestions
      const analysis = await this.analyzeAndSuggestCredentials(ipAddress);
      
      if (!analysis.success || !analysis.data?.suggestedCredentials) {
        return analysis;
      }

      console.log(`🔐 Testing ${analysis.data.suggestedCredentials.length} AI-suggested credentials...`);

      // Step 2: Try each suggested credential
      for (const cred of analysis.data.suggestedCredentials) {
        console.log(`🧪 Trying: ${cred.username}:${cred.password || '(blank)'} - ${cred.reason}`);
        
        const testResult = await this.testCredentials(ipAddress, cred.username, cred.password);
        
        if (testResult.success) {
          console.log(`✅ Success! Working credentials found`);
          
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
            aiCost: 0.02,
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
        aiCost: 0.02,
      };

    } catch (error) {
      return {
        success: false,
        message: `Smart login failed: ${error.message}`,
        duration: Date.now() - startTime,
      };
    }
  }
}