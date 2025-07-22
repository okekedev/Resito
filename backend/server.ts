// ===== server.ts - Clean orchestrator =====
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Import route modules
import authRoutes, { AppleServices } from './routes/auth.js';
import routerRoutes from './routes/router.js';
import subscriptionRoutes from './routes/subscription.js';

// Import models (for auth middleware)
import { UserModel } from './models/user.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ===== UTILITY FUNCTIONS =====
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

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
  // Skip auth in development if SKIP_AUTH=true
  if (process.env.NODE_ENV === 'development' && process.env.SKIP_AUTH === 'true') {
    console.log('⚠️  DEVELOPMENT: Skipping authentication');
    
    // Create a mock user for development
    (req as any).userId = 'dev-user-123';
    (req as any).appleId = 'dev-apple-id';
    return next();
  }

  try {
    const appleToken = req.headers.authorization?.replace('Bearer ', '');

    if (!appleToken) {
      return res.status(401).json({
        success: false,
        error: 'Apple token required',
      });
    }

    // Validate Apple token (simple but effective)
    const payload = AppleServices.validateToken(appleToken);

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
    // In development, continue even if auth fails (optional)
    if (process.env.NODE_ENV === 'development' && process.env.DEV_CONTINUE_ON_AUTH_FAIL === 'true') {
      console.log('⚠️  DEVELOPMENT: Auth failed, continuing anyway:', getErrorMessage(error));
      (req as any).userId = 'dev-user-fallback';
      (req as any).appleId = 'dev-apple-fallback';
      return next();
    }

    return res.status(401).json({
      success: false,
      error: 'Authentication failed',
      details: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined,
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

// Mount public auth routes
app.use('/api/auth', authRoutes);

// Mount public subscription routes (for receipt validation)
app.use('/api/subscription', subscriptionRoutes);

// ===== PROTECTED ROUTES =====
app.use('/api', requireAuth);

// Mount protected router routes
app.use('/api/router', routerRoutes);

// ===== ERROR HANDLING =====

// Global error handler
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : 'Something went wrong',
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