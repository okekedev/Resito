// ===== routes/simple-router.ts - No Database Routes =====
import express from 'express';
import { NetworkScanService } from '../services/network-scan.js';
import { SmartRouterAI } from '../services/smart-router-ai.js';
import { SimpleRouterService } from '../services/router-service.js';

const router = express.Router();

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
  } catch (error: any) {
    console.error('Router discovery error:', error);
    res.status(500).json({
      success: false,
      error: 'Router discovery failed',
    });
  }
});

// Test Router Connection
router.post('/test', async (req, res) => {
  try {
    const { ipAddress, username = 'admin', password = 'admin' } = req.body;

    if (!ipAddress) {
      return res.status(400).json({
        success: false,
        error: 'Router IP address is required',
      });
    }

    console.log(`🔧 Testing connection to router ${ipAddress} with username: ${username}`);

    const result = await SimpleRouterService.testConnection({
      ipAddress,
      username,
      password
    });

    res.json({
      success: result.success,
      data: result.data,
      message: result.message,
      meta: {
        duration: result.duration
      }
    });

  } catch (error: any) {
    console.error('Test router error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test router connection',
      details: error.message,
    });
  }
});

// AI Router Analysis
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

  } catch (error: any) {
    console.error('Router analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Router analysis failed',
      details: error.message,
    });
  }
});

// Smart Connect with Credentials
router.post('/smart-connect', async (req, res) => {
  try {
    const { ipAddress } = req.body;

    if (!ipAddress) {
      return res.status(400).json({
        success: false,
        error: 'Router IP address is required',
      });
    }

    console.log(`🧠 Starting smart AI analysis for router at ${ipAddress}`);

    const result = await SmartRouterAI.smartLogin(ipAddress);

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

  } catch (error: any) {
    console.error('Smart connect error:', error);
    res.status(500).json({
      success: false,
      error: 'Smart connection failed',
      details: error.message,
    });
  }
});

// AI-Powered Router Reboot
router.post('/reboot', async (req, res) => {
  try {
    const { ipAddress, username = 'admin', password } = req.body;

    if (!ipAddress || !password) {
      return res.status(400).json({
        success: false,
        error: 'Router IP address and password are required',
        message: 'Please provide: ipAddress, username (optional), password'
      });
    }

    console.log(`🔄 AI Reboot: Starting reboot for router ${ipAddress}`);

    const result = await SimpleRouterService.rebootRouter({
      ipAddress,
      username,
      password
    });

    res.json({
      success: result.success,
      data: result.data,
      message: result.message,
      meta: {
        aiCost: result.aiCost,
        duration: result.duration,
      },
    });

  } catch (error: any) {
    console.error('Reboot router error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reboot router',
    });
  }
});

// AI-Powered Speed Test
router.post('/speed-test', async (req, res) => {
  try {
    const { ipAddress, username = 'admin', password } = req.body;

    if (!ipAddress || !password) {
      return res.status(400).json({
        success: false,
        error: 'Router IP address and password are required'
      });
    }

    console.log(`🚀 AI Speed Test: Running speed test via router ${ipAddress}`);

    const result = await SimpleRouterService.getSpeedTest({
      ipAddress,
      username,
      password
    });

    res.json({
      success: result.success,
      data: result.data,
      message: result.message,
      meta: {
        aiCost: result.aiCost,
        duration: result.duration,
      },
    });

  } catch (error: any) {
    console.error('Speed test error:', error);
    res.status(500).json({
      success: false,
      error: 'Speed test failed',
    });
  }
});

// AI-Powered Device Listing
router.post('/devices', async (req, res) => {
  try {
    const { ipAddress, username = 'admin', password } = req.body;

    if (!ipAddress || !password) {
      return res.status(400).json({
        success: false,
        error: 'Router IP address and password are required'
      });
    }

    console.log(`📱 AI Devices: Getting connected devices from router ${ipAddress}`);

    const result = await SimpleRouterService.getConnectedDevices({
      ipAddress,
      username,
      password
    });

    res.json({
      success: result.success,
      data: result.data,
      message: result.message,
      meta: {
        aiCost: result.aiCost,
        duration: result.duration,
      },
    });

  } catch (error: any) {
    console.error('Get devices error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get connected devices',
    });
  }
});

export default router;