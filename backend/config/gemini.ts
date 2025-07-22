// ===== config/gemini-rest.ts - Direct REST API Wrapper =====
import fetch from 'node-fetch';

export interface GeminiResponse {
  text: string;
  modelVersion?: string;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
    thoughtsTokenCount?: number;
  };
}

export interface GeminiConfig {
  thinkingConfig?: {
    thinkingBudget: number;
  };
  temperature?: number;
  maxOutputTokens?: number;
}

class GeminiRestClient {
  private apiKey: string;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateContent(
    model: string,
    prompt: string,
    config?: GeminiConfig
  ): Promise<GeminiResponse> {
    try {
      const body: any = {
        contents: [{
          parts: [{ text: prompt }]
        }]
      };

      // Add generation config if provided
      if (config) {
        body.generationConfig = {};
        
        if (config.thinkingConfig) {
          body.generationConfig.thinkingConfig = config.thinkingConfig;
        }
        
        if (config.temperature !== undefined) {
          body.generationConfig.temperature = config.temperature;
        }
        
        if (config.maxOutputTokens) {
          body.generationConfig.maxOutputTokens = config.maxOutputTokens;
        }
      }

      const response = await fetch(`${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${errorData}`);
      }

      const data = await response.json() as any;

      if (!data.candidates || data.candidates.length === 0) {
        throw new Error('No response from Gemini API');
      }

      return {
        text: data.candidates[0].content.parts[0].text,
        modelVersion: data.modelVersion,
        usageMetadata: data.usageMetadata
      };

    } catch (error) {
      throw new Error(`Gemini request failed: ${error.message}`);
    }
  }

  async generateContentStream(
    model: string,
    prompt: string,
    config?: GeminiConfig
  ): Promise<AsyncIterableIterator<GeminiResponse>> {
    // For now, just return the full response as a single chunk
    // True streaming would require Server-Sent Events
    const response = await this.generateContent(model, prompt, config);
    
    return {
      async *[Symbol.asyncIterator]() {
        yield response;
      }
    }[Symbol.asyncIterator]();
  }
}

// Initialize the client
export const geminiClient = new GeminiRestClient(process.env.GOOGLE_API_KEY!);

// Helper functions for backward compatibility
export const generateContent = async (
  prompt: string, 
  model: string = 'gemini-2.5-flash',
  thinkingBudget?: number
): Promise<GeminiResponse> => {
  const config: GeminiConfig = {};
  
  if (thinkingBudget !== undefined) {
    config.thinkingConfig = { thinkingBudget };
  }

  return await geminiClient.generateContent(model, prompt, config);
};

export const generateContentStream = async (
  prompt: string, 
  model: string = 'gemini-2.5-flash'
) => {
  return await geminiClient.generateContentStream(model, prompt);
};

// For router analysis tasks
export const analyzeRouterWithAI = async (
  html: string, 
  headers: any, 
  task: 'brand_detection' | 'credential_suggestion' | 'navigation_help'
): Promise<GeminiResponse> => {
  const thinkingBudget = task === 'brand_detection' ? 512 : 1024;
  
  const prompt = `Analyze this router interface for ${task}:

HTML:
${html.substring(0, 2000)}

Headers:
${JSON.stringify(headers, null, 2)}

Provide a detailed analysis and suggestions.`;

  return await generateContent(prompt, 'gemini-2.5-flash', thinkingBudget);
};

// Compatibility layer - provides same interface as GoogleGenAI
export const genAI = {
  models: {
    generateContent: async (options: {
      model: string;
      contents: string;
      config?: GeminiConfig;
    }) => {
      const response = await geminiClient.generateContent(
        options.model,
        options.contents,
        options.config
      );
      return response;
    },
    
    generateContentStream: async (options: {
      model: string;
      contents: string;
      config?: GeminiConfig;
    }) => {
      return await geminiClient.generateContentStream(
        options.model,
        options.contents,
        options.config
      );
    }
  }
};

export const getGeminiModel = () => genAI.models;