import fetch from 'node-fetch';

interface AppleReceiptValidationResponse {
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
  }>;
}

export class AppleReceiptService {
  private static readonly SANDBOX_URL = 'https://sandbox.itunes.apple.com/verifyReceipt';
  private static readonly PRODUCTION_URL = 'https://buy.itunes.apple.com/verifyReceipt';

  static async validateReceipt(receiptData: string): Promise<{
    isValid: boolean;
    subscriptionStatus: 'active' | 'expired' | 'none';
    productId?: string;
    expiresDate?: Date;
  }> {
    try {
      // Try production first
      let response = await this.sendToApple(this.PRODUCTION_URL, receiptData);
      
      // If sandbox receipt, try sandbox endpoint
      if (response.status === 21007) {
        response = await this.sendToApple(this.SANDBOX_URL, receiptData);
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
        .sort((a, b) => new Date(b.expires_date || b.purchase_date).getTime() - 
                       new Date(a.expires_date || a.purchase_date).getTime())[0];

      if (!activeSubscription) {
        return {
          isValid: true,
          subscriptionStatus: 'none',
        };
      }

      const expiresDate = new Date(activeSubscription.expires_date || activeSubscription.purchase_date);
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

  private static async sendToApple(url: string, receiptData: string): Promise<AppleReceiptValidationResponse> {
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

    return await response.json() as AppleReceiptValidationResponse;
  }
}
