// ===== routes/router.ts =====
import express from 'express';
import { NetworkScanService } from '../services/network-scan.js';
import { RouterAIService } from '../services/index.js';
import { RouterModel } from '../models/router.js';
import { SmartRouterAI } from '../services/smart-router-ai.js';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

const router = express.Router();

// Test specific router IP (debugging endpoint)
router.get('/test-ip/:ip', async (req, res) => {
  try {
    const { ip } = req.params;
    
    console.log(`🔧 Manually testing router at ${ip}...`);
    
    // Test the specific IP with detailed logging
    const isConnected = await NetworkScanService.testConnection(ip);
    
    res.json({
      success: true,
      data: {
        ip,
        isAccessible: isConnected,
        tested: true,
      },
      message: isConnected 
        ? `Router at ${ip} is accessible` 
        : `Router at ${ip} is not accessible`,
    });

  } catch (error) {
    console.error('Test specific IP error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test router IP',
      details: getErrorMessage(error),
    });
  }
});

// Discover Router on Network
router.get('/discover', async (req, res) => {
  try {
    console.log('🔍 Starting router discovery...');
    
    const router = await NetworkScanService.discoverRouter();

    if (!router) {
      return res.status(404).json({
        success: false,
        error: 'No router found on network',
        message: 'Make sure you are connected to your home WiFi network',
      });
    }

    res.json({
      success: true,
      data: {
        router: {
          ipAddress: router.ipAddress,
          isAccessible: router.isAccessible,
        },
      },
      message: `Router found at ${router.ipAddress}`,
    });

  } catch (error) {
    console.error('Router discovery error:', error);
    res.status(500).json({
      success: false,
      error: 'Router discovery failed',
    });
  }
});

// Connect and Save Router
router.post('/connect', async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { ipAddress, username = 'admin', password = 'admin' } = req.body;

    if (!ipAddress) {
      return res.status(400).json({
        success: false,
        error: 'Router IP address is required',
      });
    }

    // Test basic connectivity first  
    const isConnected = await NetworkScanService.testConnection(ipAddress);

    if (!isConnected) {
      return res.status(400).json({
        success: false,
        error: 'Cannot reach router at this IP address',
        message: 'Please check the IP address and try again',
      });
    }

    // Save router to database
    const router = await RouterModel.upsert({
      userId,
      ipAddress,
      username,
      password,
    });

    res.json({
      success: true,
      data: {
        router: {
          id: router.id,
          ipAddress: router.ipAddress,
        },
      },
      message: 'Router connected and saved successfully',
    });

  } catch (error) {
    console.error('Connect router error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to connect router',
    });
  }
});

// Auto-Discover and Login to Router (AI-powered)
router.post('/auto-connect', async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { ipAddress, username, password } = req.body;

    if (!ipAddress) {
      return res.status(400).json({
        success: false,
        error: 'Router IP address is required',
      });
    }

    console.log(`🔍 Auto-connecting to router at ${ipAddress}...`);

    // Use AI service to auto-detect router type and try credentials
    const aiService = new RouterAIService();
    const result = await aiService.testConnection(ipAddress, username, password);

    if (result.success) {
      // If login successful, save router details (when database is available)
      try {
        // TODO: Save router to database when DB is set up
        console.log('✅ Would save router to database:', { ipAddress, username: result.data?.credentialsUsed?.username });
      } catch (dbError) {
        console.log('⚠️ Database not available, skipping save');
      }
    }

    res.json({
      success: result.success,
      data: result.data,
      message: result.message,
      meta: {
        aiCost: result.aiCost,
        duration: result.duration,
      },
    });

  } catch (error) {
    console.error('Auto-connect router error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to auto-connect to router',
      details: getErrorMessage(error),
    });
  }
});

// Get Saved Router
router.get('/saved', async (req, res) => {
  try {
    const userId = (req as any).userId;
    const router = await RouterModel.findByUserId(userId);

    res.json({
      success: true,
      data: {
        router: router ? {
          id: router.id,
          ipAddress: router.ipAddress,
          updatedAt: router.updatedAt,
        } : null,
      },
    });

  } catch (error) {
    console.error('Get saved router error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get saved router',
    });
  }
});

// Test Router Connection (AI-powered)
router.post('/test', async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { ipAddress, username = 'admin', password = 'admin' } = req.body;

    if (!ipAddress) {
      return res.status(400).json({
        success: false,
        error: 'Router IP address is required',
      });
    }

    console.log(`🔧 Testing AI connection to router ${ipAddress} with username: ${username}`);

    // Use AI service to test login with real credentials
    const aiService = new RouterAIService();
    const result = await aiService.testConnection(ipAddress, username, password);

    res.json({
      success: result.success,
      data: result.data,
      message: result.message,
      meta: {
        aiCost: result.aiCost,
        duration: result.duration,
      },
    });

  } catch (error) {
    console.error('Test router error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test router connection',
      details: getErrorMessage(error),
    });
  }
});

// Reboot Router (AI-powered)
router.post('/reboot', async (req, res) => {
  try {
    const userId = (req as any).userId;

    // Get saved router for user
    const router = await RouterModel.findByUserId(userId);

    if (!router) {
      return res.status(404).json({
        success: false,
        error: 'No router found',
        message: 'Please connect a router first',
      });
    }

    console.log(`🔄 Rebooting router ${router.ipAddress} for user ${userId}`);

    // Use AI service to reboot router
    const aiService = new RouterAIService();
    const result = await aiService.rebootRouter(
      router.ipAddress,
      router.username,
      router.password
    );

    res.json({
      success: result.success,
      data: result.data,
      message: result.message,
      meta: {
        aiCost: result.aiCost,
        duration: result.duration,
      },
    });

  } catch (error) {
    console.error('Reboot router error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reboot router',
    });
  }
});

// Speed Test (AI-powered)
router.post('/speed-test', async (req, res) => {
  try {
    const userId = (req as any).userId;
    const router = await RouterModel.findByUserId(userId);

    if (!router) {
      return res.status(404).json({
        success: false,
        error: 'No router found',
        message: 'Please connect a router first',
      });
    }

    console.log(`🚀 Running speed test via router ${router.ipAddress}`);

    // Use AI service to get speed information
    const aiService = new RouterAIService();
    const result = await aiService.getSpeedTest(
      router.ipAddress,
      router.username,
      router.password
    );

    res.json({
      success: result.success,
      data: result.data,
      message: result.message,
      meta: {
        aiCost: result.aiCost,
        duration: result.duration,
      },
    });

  } catch (error) {
    console.error('Speed test error:', error);
    res.status(500).json({
      success: false,
      error: 'Speed test failed',
    });
  }
});

// Smart Router Analysis & Auto-Login (AI-powered)
router.post('/smart-connect', async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { ipAddress } = req.body;

    if (!ipAddress) {
      return res.status(400).json({
        success: false,
        error: 'Router IP address is required',
      });
    }

    console.log(`🧠 Starting smart AI analysis for router at ${ipAddress}`);

    // Use AI to analyze router and find working credentials
    const result = await SmartRouterAI.smartLogin(ipAddress);

    if (result.success && result.data?.workingCredentials) {
      // Save the working credentials to database
      try {
        const router = await RouterModel.upsert({
          userId,
          ipAddress,
          username: result.data.workingCredentials.username,
          password: result.data.workingCredentials.password,
        });

        console.log(`✅ Saved working credentials for ${result.data.brand} router`);
      } catch (dbError) {
        console.log('⚠️ Could not save to database, but login was successful');
      }
    }

    res.json({
      success: result.success,
      data: result.data,
      message: result.message,
      meta: {
        aiCost: result.aiCost,
        duration: result.duration,
        analysisType: 'smart_ai_detection',
      },
    });

  } catch (error) {
    console.error('Smart connect error:', error);
    res.status(500).json({
      success: false,
      error: 'Smart connection failed',
      details: getErrorMessage(error),
    });
  }
});

// Router Brand Analysis Only (for testing)
router.post('/analyze', async (req, res) => {
  try {
    const { ipAddress } = req.body;

    if (!ipAddress) {
      return res.status(400).json({
        success: false,
        error: 'Router IP address is required',
      });
    }

    console.log(`🤖 Analyzing router interface at ${ipAddress}`);

    // Just analyze, don't test credentials
    const result = await SmartRouterAI.analyzeAndSuggestCredentials(ipAddress);

    res.json({
      success: result.success,
      data: result.data,
      message: result.message,
      meta: {
        aiCost: result.aiCost,
        duration: result.duration,
        analysisType: 'interface_analysis_only',
      },
    });

  } catch (error) {
    console.error('Router analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Router analysis failed',
      details: getErrorMessage(error),
    });
  }
});

// Get Connected Devices (AI-powered)
router.get('/devices', async (req, res) => {
  try {
    const userId = (req as any).userId;
    const router = await RouterModel.findByUserId(userId);

    if (!router) {
      return res.status(404).json({
        success: false,
        error: 'No router found',
        message: 'Please connect a router first',
      });
    }

    console.log(`📱 Getting connected devices from router ${router.ipAddress}`);

    // Use AI service to get connected devices
    const aiService = new RouterAIService();
    const result = await aiService.getConnectedDevices(
      router.ipAddress,
      router.username,
      router.password
    );

    res.json({
      success: result.success,
      data: result.data,
      message: result.message,
      meta: {
        aiCost: result.aiCost,
        duration: result.duration,
      },
    });

  } catch (error) {
    console.error('Get devices error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get connected devices',
    });
  }
});

export default router;