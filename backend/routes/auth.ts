// ===== routes/auth.ts =====
import express from 'express';
import fetch from 'node-fetch';
import { UserModel } from '../models/user.js';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

// ===== APPLE AUTH UTILITIES =====
interface AppleTokenPayload {
  sub: string; // Apple user ID
  email?: string;
  aud?: string; // Your app's bundle ID
  iss?: string; // https://appleid.apple.com
  exp?: number;
  iat?: number;
}

interface AppleReceiptResponse {
  status: number;
  environment: string;
  receipt: {
    in_app: Array<{
      product_id: string;
      transaction_id: string;
      original_transaction_id: string;
      purchase_date: string;
      expires_date?: string;
    }>;
  };
  latest_receipt_info?: Array<{
    product_id: string;
    expires_date: string;
    purchase_date?: string; // Optional since not all receipts have this
  }>;
}

class AppleServices {
  // Simple Apple token validation
  static validateToken(identityToken: string): AppleTokenPayload {
    try {
      // Decode the JWT payload
      const base64Payload = identityToken.split('.')[1];
      const payload = JSON.parse(
        Buffer.from(base64Payload, 'base64').toString('utf-8')
      );
      
      // Basic validation
      if (!payload?.sub) {
        throw new Error('Invalid Apple token: missing user ID');
      }

      // Check if token is expired
      if (payload.exp && payload.exp < Date.now() / 1000) {
        throw new Error('Apple token has expired');
      }

      // Verify it's from Apple
      if (payload.iss && payload.iss !== 'https://appleid.apple.com') {
        throw new Error('Token not issued by Apple');
      }

      return {
        sub: payload.sub,
        email: payload.email,
        aud: payload.aud,
        iss: payload.iss,
        exp: payload.exp,
        iat: payload.iat,
      };
    } catch (error) {
      throw new Error(`Apple token validation failed: ${getErrorMessage(error)}`);
    }
  }

  // iTunes receipt validation
  static async validateReceipt(receiptData: string): Promise<{
    isValid: boolean;
    subscriptionStatus: 'active' | 'expired' | 'none';
    productId?: string;
    expiresDate?: Date;
  }> {
    try {
      const SANDBOX_URL = 'https://sandbox.itunes.apple.com/verifyReceipt';
      const PRODUCTION_URL = 'https://buy.itunes.apple.com/verifyReceipt';

      // Try production first
      let response = await this.sendReceiptToApple(PRODUCTION_URL, receiptData);
      
      // If sandbox receipt, try sandbox endpoint
      if (response.status === 21007) {
        response = await this.sendReceiptToApple(SANDBOX_URL, receiptData);
      }

      if (response.status !== 0) {
        return {
          isValid: false,
          subscriptionStatus: 'none',
        };
      }

      // Check for active subscription
      const latestReceipts = response.latest_receipt_info || response.receipt.in_app;
      const subscriptionProducts = ['premium_monthly', 'premium_yearly'];
      
      const activeSubscription = latestReceipts
        .filter(item => subscriptionProducts.includes(item.product_id))
        .sort((a, b) => {
          const getDate = (item: any) => {
            return item.expires_date || item.purchase_date || '1970-01-01';
          };
          return new Date(getDate(b)).getTime() - new Date(getDate(a)).getTime();
        })[0];

      if (!activeSubscription) {
        return {
          isValid: true,
          subscriptionStatus: 'none',
        };
      }

      const getExpirationDate = (subscription: any): Date => {
        if (subscription.expires_date) {
          return new Date(subscription.expires_date);
        }
        if (subscription.purchase_date) {
          const purchaseDate = new Date(subscription.purchase_date);
          return new Date(purchaseDate.getTime() + (30 * 24 * 60 * 60 * 1000));
        }
        return new Date();
      };

      const expiresDate = getExpirationDate(activeSubscription);
      const isActive = expiresDate > new Date();

      return {
        isValid: true,
        subscriptionStatus: isActive ? 'active' : 'expired',
        productId: activeSubscription.product_id,
        expiresDate,
      };

    } catch (error) {
      console.error('Receipt validation error:', error);
      return {
        isValid: false,
        subscriptionStatus: 'none',
      };
    }
  }

  private static async sendReceiptToApple(url: string, receiptData: string): Promise<AppleReceiptResponse> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        'receipt-data': receiptData,
        'password': process.env.APPLE_SHARED_SECRET,
        'exclude-old-transactions': true,
      }),
    });

    return await response.json() as AppleReceiptResponse;
  }
}

const router = express.Router();

// Apple Sign-In
router.post('/apple', async (req, res) => {
  try {
    const { identityToken, user } = req.body;

    if (!identityToken) {
      return res.status(400).json({
        success: false,
        error: 'Identity token is required',
      });
    }

    // Validate Apple token
    const payload = AppleServices.validateToken(identityToken);
    
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
      details: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined,
    });
  }
});

export { AppleServices };
export default router;