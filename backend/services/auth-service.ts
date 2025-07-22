// ===== services/auth-service.ts =====
import fetch from 'node-fetch';

export interface AppleTokenPayload {
  sub: string; // Apple user ID
  email?: string;
  aud?: string; // Your app's bundle ID
  iss?: string; // https://appleid.apple.com
  exp?: number;
  iat?: number;
}

export interface AppleReceiptResponse {
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
    purchase_date?: string;
  }>;
}

export interface SubscriptionValidationResult {
  isValid: boolean;
  subscriptionStatus: 'active' | 'expired' | 'none';
  productId?: string;
  expiresDate?: Date;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export class AuthService {
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
  static async validateReceipt(receiptData: string): Promise<SubscriptionValidationResult> {
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

  // Auth middleware helper
  static async authenticateRequest(authHeader?: string): Promise<{
    success: boolean;
    userId?: string;
    appleId?: string;
    error?: string;
  }> {
    // Skip auth in development if SKIP_AUTH=true
    if (process.env.NODE_ENV === 'development' && process.env.SKIP_AUTH === 'true') {
      console.log('⚠️  DEVELOPMENT: Skipping authentication');
      return {
        success: true,
        userId: 'dev-user-123',
        appleId: 'dev-apple-id',
      };
    }

    try {
      const appleToken = authHeader?.replace('Bearer ', '');

      if (!appleToken) {
        return {
          success: false,
          error: 'Apple token required',
        };
      }

      // Validate Apple token
      const payload = this.validateToken(appleToken);

      // In a real implementation, you'd query the database for the user
      // For now, return the payload data
      return {
        success: true,
        userId: `user-${payload.sub}`,
        appleId: payload.sub,
      };

    } catch (error) {
      // In development, continue even if auth fails (optional)
      if (process.env.NODE_ENV === 'development' && process.env.DEV_CONTINUE_ON_AUTH_FAIL === 'true') {
        console.log('⚠️  DEVELOPMENT: Auth failed, continuing anyway:', getErrorMessage(error));
        return {
          success: true,
          userId: 'dev-user-fallback',
          appleId: 'dev-apple-fallback',
        };
      }

      return {
        success: false,
        error: 'Authentication failed',
      };
    }
  }
}