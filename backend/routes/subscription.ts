// ===== routes/subscription.ts =====
import express from 'express';
import { AppleServices } from './auth.js';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

const router = express.Router();

// iTunes Receipt Validation
router.post('/validate', async (req, res) => {
  try {
    const { receiptData } = req.body;

    if (!receiptData) {
      return res.status(400).json({
        success: false,
        error: 'Receipt data is required',
      });
    }

    const validation = await AppleServices.validateReceipt(receiptData);

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

// Get Subscription Status
router.get('/status', async (req, res) => {
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

export default router;