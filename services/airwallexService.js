class AirwallexService {
  constructor() {
    this.baseURL = 'https://main-matrixai-server-lujmidrakh.cn-hangzhou.fcapp.run';
    this.airwallexBaseURL = 'https://api-demo.airwallex.com';
    this.clientId = 'HlF-odCfT-OIf1s3nLgV8A';
    this.apiKey = '8e7c2b82271d5d9715b9ed2fbd70cec8e2e41b11171a1fca45690df0074299aebd4a07e79e7b3f2c399ba579d5d20ae1';
    this.environment = 'demo';
  }

  /**
   * Get access token from backend
   */
  async getAccessToken() {
    try {
      const response = await fetch(`${this.baseURL}/api/airwallex/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': this.clientId,
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify({
          grant_type: 'client_credentials'
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to get access token');
      }

      return {
        success: true,
        data: {
          access_token: data.access_token,
          expires_in: data.expires_in || 3600
        }
      };
    } catch (error) {
      console.error('Access token fetch error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create payment intent
   */
  async createPaymentIntent(amount, merchantOrderId = null) {
    try {
      // First get access token
      const tokenResponse = await this.getAccessToken();
      if (!tokenResponse.success) {
        throw new Error(tokenResponse.error);
      }

      const response = await fetch(`${this.baseURL}/api/airwallex/payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenResponse.data.access_token}`
        },
        body: JSON.stringify({
          amount: amount, // Direct HKD amount (50 for 50 HKD)
          currency: 'HKD',
          merchant_order_id: merchantOrderId || this.generateUniqueId(),
          return_url: 'app://payment-success'
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to create payment intent');
      }

      return {
        success: true,
        data: {
          id: data.id,
          client_secret: data.client_secret,
          amount: data.amount,
          currency: data.currency,
          status: data.status
        }
      };
    } catch (error) {
      console.error('Payment intent creation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create subscription payment intent
   */
  async createSubscriptionPayment(planId, amount) {
    const merchantOrderId = `subscription_${planId}_${Date.now()}`;
    return this.createPaymentIntent(amount, merchantOrderId);
  }

  /**
   * Create addon payment intent
   */
  async createAddonPayment(addonId, amount) {
    const merchantOrderId = `addon_${addonId}_${Date.now()}`;
    return this.createPaymentIntent(amount, merchantOrderId);
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(paymentIntentId) {
    try {
      // Get access token
      const tokenResponse = await this.getAccessToken();
      if (!tokenResponse.success) {
        throw new Error(tokenResponse.error);
      }

      const response = await fetch(`${this.airwallexBaseURL}/api/v1/pa/payment_intents/${paymentIntentId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenResponse.data.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to get payment status');
      }

      return {
        success: true,
        data: {
          id: data.id,
          status: data.status,
          amount: data.amount,
          currency: data.currency
        }
      };
    } catch (error) {
      console.error('Payment status fetch error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate unique merchant order ID
   */
  generateUniqueId() {
    return `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get hosted payment URL
   */
  getHostedPaymentUrl(clientSecret) {
    const params = new URLSearchParams({
      client_secret: clientSecret,
      env: this.environment,
      currency: 'HKD',
      return_url: 'app://payment-success',
      cancel_url: 'app://payment-cancelled'
    });
    
    return `https://checkout.airwallex.com/drop-in?${params.toString()}`;
  }

  /**
   * Poll payment status until completion
   */
  async pollPaymentStatus(paymentIntentId, maxAttempts = 30, interval = 2000) {
    let attempts = 0;
    
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          attempts++;
          
          const result = await this.getPaymentStatus(paymentIntentId);
          
          if (!result.success) {
            reject(new Error(result.error));
            return;
          }

          const status = result.data.status;
          
          // If payment is completed or failed, resolve
          if (status === 'SUCCEEDED' || status === 'FAILED' || status === 'CANCELLED') {
            resolve(result);
            return;
          }

          // If max attempts reached, reject
          if (attempts >= maxAttempts) {
            reject(new Error('Payment status polling timeout'));
            return;
          }

          // Continue polling
          setTimeout(poll, interval);
        } catch (error) {
          reject(error);
        }
      };

      poll();
    });
  }
}

export default new AirwallexService();