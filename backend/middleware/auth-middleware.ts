// ===== middleware/auth-middleware.ts =====
import express from 'express';
import { AuthService } from '../services/auth-service.js';
import { UserModel } from '../models/user.js';

export const requireAuth = async (
  req: express.Request, 
  res: express.Response, 
  next: express.NextFunction
) => {
  try {
    const authResult = await AuthService.authenticateRequest(req.headers.authorization);

    if (!authResult.success) {
      return res.status(401).json({
        success: false,
        error: authResult.error || 'Authentication failed',
      });
    }

    // Add user info to request object
    (req as any).userId = authResult.userId;
    (req as any).appleId = authResult.appleId;

    // In production, you might want to fetch full user data:
    // const user = await UserModel.findByAppleId(authResult.appleId!);
    // (req as any).user = user;

    next();

  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication service unavailable',
    });
  }
};

// Optional middleware for premium features
export const requirePremium = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  try {
    const userId = (req as any).userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    // Check premium status (you'd implement this based on your subscription model)
    // const subscriptionService = new SubscriptionService();
    // const hasPremium = await subscriptionService.checkPremiumAccess(userId);
    
    // For now, allow all authenticated users
    // In production, you'd check actual subscription status
    next();

  } catch (error) {
    console.error('Premium middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Subscription check failed',
    });
  }
};