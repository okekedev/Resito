// ===== services/simple-router-service.ts - No Database Required =====
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

export interface RouterActionResult {
  success: boolean;
  message: string;
  data?: any;
  duration?: number;
  aiCost?: number;
}

export interface RouterCredentials {
  ipAddress: string;
  username: string;
  password: string;
}

export class SimpleRouterService {
  /**
   * Direct Gemini API call for router actions
   */
  private static async callGemini(prompt: string): Promise<any> {
    const apiKey = process.env.GOOGLE_API_KEY;
    
    if (!apiKey) {
      throw new Error('GOOGLE_API_KEY environment variable not found');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          thinkingConfig: { thinkingBudget: 1024 }
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }

  /**
   * Test router authentication
   */
  static async testConnection(credentials: RouterCredentials): Promise<RouterActionResult> {
    const startTime = Date.now();
    
    try {
      const auth = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');
      
      const response = await fetch(`http://${credentials.ipAddress}`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'User-Agent': 'RouterApp/1.0',
        },
        timeout: 5000
      });

      const success = response.status === 200;
      
      return {
        success,
        message: success ? 'Authentication successful' : `Authentication failed: HTTP ${response.status}`,
        data: {
          ipAddress: credentials.ipAddress,
          username: credentials.username,
          authenticated: success,
          status: response.status
        },
        duration: Date.now() - startTime
      };

    } catch (error: any) {
      return {
        success: false,
        message: `Connection failed: ${error.message}`,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * AI-powered router reboot
   */
  static async rebootRouter(credentials: RouterCredentials): Promise<RouterActionResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🔄 AI Reboot: Analyzing router at ${credentials.ipAddress}...`);

      // Get router's admin interface
      const auth = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');
      const response = await fetch(`http://${credentials.ipAddress}`, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`Cannot access router admin interface: HTTP ${response.status}`);
      }

      const html = await response.text();

      // Ask Gemini to analyze the interface and find reboot method
      const prompt = `You are a router management expert. Analyze this router admin interface HTML and tell me how to reboot this router.

ROUTER HTML INTERFACE:
${html.substring(0, 3000)}

Please provide:
1. What type/brand of router this appears to be
2. The most likely URL path for the reboot function (e.g., /reboot.htm, /system.htm, /admin/reboot)
3. Whether it uses a GET request, POST request, or form submission
4. Any specific parameters or form fields needed
5. Step-by-step instructions for rebooting this router

Format your response as JSON:
{
  "brand": "detected_brand",
  "rebootMethod": "GET|POST|FORM",
  "rebootUrl": "/path/to/reboot",
  "parameters": {"param": "value"},
  "instructions": "step by step instructions"
}`;

      const aiResponse = await this.callGemini(prompt);
      console.log('🤖 Gemini Analysis:', aiResponse);

      // Try to parse AI response
      let rebootInfo;
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          rebootInfo = JSON.parse(jsonMatch[0]);
        }
      } catch (parseError) {
        // Fallback: try common reboot paths
        rebootInfo = {
          brand: "Unknown",
          rebootMethod: "GET",
          rebootUrl: "/reboot.htm",
          instructions: "Trying common reboot paths"
        };
      }

      // Attempt to reboot using AI analysis
      const rebootUrl = `http://${credentials.ipAddress}${rebootInfo.rebootUrl}`;
      console.log(`🎯 Attempting reboot via: ${rebootUrl}`);

      const rebootResponse = await fetch(rebootUrl, {
        method: rebootInfo.rebootMethod || 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'User-Agent': 'RouterApp/1.0',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: rebootInfo.rebootMethod === 'POST' ? 
          new URLSearchParams(rebootInfo.parameters || {}).toString() : undefined
      });

      const success = rebootResponse.status === 200 || rebootResponse.status === 302;

      return {
        success,
        message: success ? 
          `Router reboot initiated successfully via ${rebootInfo.rebootUrl}` :
          `Reboot attempt failed: HTTP ${rebootResponse.status}`,
        data: {
          brand: rebootInfo.brand,
          method: rebootInfo.rebootMethod,
          url: rebootInfo.rebootUrl,
          aiAnalysis: aiResponse.substring(0, 500),
          status: rebootResponse.status
        },
        duration: Date.now() - startTime,
        aiCost: 0.02
      };

    } catch (error: any) {
      return {
        success: false,
        message: `AI reboot failed: ${error.message}`,
        duration: Date.now() - startTime,
        aiCost: 0.02
      };
    }
  }

  /**
   * AI-powered speed test
   */
  static async getSpeedTest(credentials: RouterCredentials): Promise<RouterActionResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🚀 AI Speed Test: Analyzing router at ${credentials.ipAddress}...`);

      // Get router's admin interface
      const auth = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');
      const response = await fetch(`http://${credentials.ipAddress}`, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const html = await response.text();

      // Ask Gemini to find speed test functionality
      const prompt = `Analyze this router interface and help me find speed test functionality.

ROUTER HTML:
${html.substring(0, 3000)}

Look for:
1. Built-in speed test features
2. Bandwidth monitoring pages
3. WAN status pages with speed information
4. Traffic monitoring sections

Provide the most likely URLs and methods to access speed/bandwidth information from this router.

Format as JSON:
{
  "hasSpeedTest": true/false,
  "speedTestUrl": "/path/to/speed/test",
  "alternativeUrls": ["/status.htm", "/wan.htm"],
  "method": "GET|POST",
  "instructions": "how to access speed information"
}`;

      const aiResponse = await this.callGemini(prompt);
      
      return {
        success: true,
        message: 'AI analyzed router for speed test capabilities',
        data: {
          aiAnalysis: aiResponse,
          note: 'Speed test analysis complete - implementation pending'
        },
        duration: Date.now() - startTime,
        aiCost: 0.02
      };

    } catch (error: any) {
      return {
        success: false,
        message: `Speed test analysis failed: ${error.message}`,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * AI-powered device listing
   */
  static async getConnectedDevices(credentials: RouterCredentials): Promise<RouterActionResult> {
    const startTime = Date.now();
    
    try {
      console.log(`📱 AI Device Scan: Analyzing router at ${credentials.ipAddress}...`);

      // Get router's admin interface
      const auth = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');
      const response = await fetch(`http://${credentials.ipAddress}`, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const html = await response.text();

      // Ask Gemini to find device listing
      const prompt = `Analyze this router interface to find connected devices/DHCP clients.

ROUTER HTML:
${html.substring(0, 3000)}

Look for:
1. DHCP client lists
2. Connected devices pages
3. Network map or device tables
4. Wireless client lists

Extract any visible device information and provide URLs to access device lists.

Format as JSON:
{
  "devicesFound": ["device1", "device2"],
  "deviceListUrl": "/path/to/devices",
  "dhcpUrl": "/dhcp_clients.htm",
  "wirelessUrl": "/wireless_clients.htm",
  "instructions": "how to access device information"
}`;

      const aiResponse = await this.callGemini(prompt);

      return {
        success: true,
        message: 'AI analyzed router for connected devices',
        data: {
          aiAnalysis: aiResponse,
          note: 'Device scanning analysis complete'
        },
        duration: Date.now() - startTime,
        aiCost: 0.02
      };

    } catch (error: any) {
      return {
        success: false,
        message: `Device scan failed: ${error.message}`,
        duration: Date.now() - startTime
      };
    }
  }
}