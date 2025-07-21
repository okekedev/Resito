// ===== src/server.ts =====
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Import models
import { UserModel } from './models/user.js';
import { RouterModel } from './models/router.js';

// Import services
import { NetworkScanService } from './services/network-scan.js';
import { RouterAIService } from './services/router-ai/index.js';
import { AppleReceiptService } from './services/apple-receipts.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ===== MIDDLEWARE =====
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] 
    : ['http://localhost:3000', 'http://localhost:8081'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ===== AUTH MIDDLEWARE =====
const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const appleToken = req.headers.authorization?.replace('Bearer ', '');

    if (!appleToken) {
      return res.status(401).json({
        success: false,
        error: 'Apple token required',
      });
    }

    // Decode Apple token (simplified - in production, verify signature)
    const payload = JSON.parse(Buffer.from(appleToken.split('.')[1], 'base64').toString());
    
    if (!payload?.sub) {
      return res.status(401).json({
        success: false,
        error: 'Invalid Apple token',
      });
    }

    // Find user by Apple ID
    const user = await UserModel.findByAppleId(payload.sub);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found',
      });
    }

    (req as any).userId = user.id;
    (req as any).appleId = user.appleId;
    next();

  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Authentication failed',
    });
  }
};

// ===== PUBLIC ROUTES =====

// Health check
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Router Management API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Apple Sign-In
app.post('/api/auth/apple', async (req, res) => {
  try {
    const { identityToken, user } = req.body;

    if (!identityToken) {
      return res.status(400).json({
        success: false,
        error: 'Identity token is required',
      });
    }

    // Simple JWT decode (in production, verify signature with Apple's public keys)
    const payload = JSON.parse(Buffer.from(identityToken.split('.')[1], 'base64').toString());
    
    if (!payload || !payload.sub) {
      return res.status(400).json({
        success: false,
        error: 'Invalid identity token',
      });
    }

    const appleId = payload.sub;
    const email = payload.email || user?.email;
    const name = user?.name ? 
      `${user.name.firstName || ''} ${user.name.lastName || ''}`.trim() : 
      undefined;

    // Find or create user in database
    const dbUser = await UserModel.findOrCreate({
      appleId,
      email,
      name,
    });

    res.json({
      success: true,
      data: {
        user: {
          id: dbUser.id,
          appleId: dbUser.appleId,
          email: dbUser.email,
          name: dbUser.name,
        },
      },
      message: 'Successfully signed in with Apple',
    });

  } catch (error) {
    console.error('Apple sign-in error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed',
    });
  }
});

// iTunes Receipt Validation
app.post('/api/subscription/validate', async (req, res) => {
  try {
    const { receiptData } = req.body;

    if (!receiptData) {
      return res.status(400).json({
        success: false,
        error: 'Receipt data is required',
      });
    }

    const validation = await AppleReceiptService.validateReceipt(receiptData);

    res.json({
      success: true,
      data: {
        isValid: validation.isValid,
        subscriptionStatus: validation.subscriptionStatus,
        productId: validation.productId,
        expiresDate: validation.expiresDate,
        isPremium: validation.subscriptionStatus === 'active',
      },
    });

  } catch (error) {
    console.error('Receipt validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Receipt validation failed',
    });
  }
});

// ===== PROTECTED ROUTES =====
app.use('/api', requireAuth);

// Discover Router on Network
app.get('/api/router/discover', async (req, res) => {
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
app.post('/api/router/connect', async (req, res) => {
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

// Get Saved Router
app.get('/api/router/saved', async (req, res) => {
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

// Reboot Router (AI-powered)
app.post('/api/router/reboot', async (req, res) => {
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
app.post('/api/router/speed-test', async (req, res) => {
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

// Get Connected Devices (AI-powered)
app.get('/api/router/devices', async (req, res) => {
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

// Get Subscription Status
app.get('/api/subscription/status', async (req, res) => {
  try {
    const userId = (req as any).userId;

    // In production, you'd check subscription status from database
    // For now, return mock data based on user tier
    res.json({
      success: true,
      data: {
        isPremium: false,
        subscriptionStatus: 'none',
        tier: 'free',
        featuresAvailable: {
          routerReboot: false,
          speedTest: false,
          deviceManagement: false,
          multipleRouters: false,
        },
        limits: {
          monthlyActions: 0,
          usedActions: 0,
        },
      },
    });

  } catch (error) {
    console.error('Get subscription status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get subscription status',
    });
  }
});

// Test Router Connection (AI-powered)
app.post('/api/router/test', async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { ipAddress, username = 'admin', password = 'admin' } = req.body;

    if (!ipAddress) {
      return res.status(400).json({
        success: false,
        error: 'Router IP address is required',
      });
    }

    console.log(`🔧 Testing connection to router ${ipAddress}`);

    // Use AI service to test login
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
    });
  }
});

// ===== ERROR HANDLING =====

// Global error handler
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log(`🚀 Router Management API running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/`);
  console.log(`🤖 AI Router Control: Ready`);
});

export default app;