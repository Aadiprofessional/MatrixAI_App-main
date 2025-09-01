import Config from 'react-native-config';

class AirwallexService {
  constructor() {
    // Airwallex API configuration
    this.baseURL = 'https://your-backend-api.com/api'; // Replace with your actual backend URL
    this.airwallexApiUrl = 'https://api-demo.airwallex.com/api/v1'; // Sandbox
    this.airwallexProdApiUrl = 'https://api.airwallex.com/api/v1'; // Production
    this.sandboxApiHost = 'https://api-demo.airwallex.com/api/v1';
    this.productionApiHost = 'https://api.airwallex.com/api/v1';
    this.environment = Config.AIRWALLEX_ENVIRONMENT || 'sandbox'; // 'sandbox' or 'production'
    
    // Load credentials from environment using react-native-config
     this.clientId = Config.AIRWALLEX_CLIENT_ID || null;
     this.apiKey = Config.AIRWALLEX_API_KEY || null;
    
    // Cache for access token
    this.accessToken = null;
    this.tokenExpiry = null;
    
    // Fallback to backend API if direct integration is not configured
    this.backendUrl = 'https://main-matrixai-server-lujmidrakh.cn-hangzhou.fcapp.run';
    this.useBackendFallback = true; // Set to false when direct integration is configured
    this.airwallexBaseURL = this.environment === 'production' ? this.airwallexProdApiUrl : this.airwallexApiUrl;
  }
  
  /**
   * Check if valid Airwallex credentials are configured
   * @returns {boolean} True if credentials are available
   */
  hasValidCredentials() {
    return !!(this.clientId && this.apiKey && 
              this.clientId.trim() !== '' && 
              this.apiKey.trim() !== '');
  }
  
  /**
   * Get the appropriate API host based on environment
   */
  getApiHost() {
    return this.environment === 'production' ? this.productionApiHost : this.sandboxApiHost;
  }
  
  /**
   * Get access token from Airwallex API
   */
  async getAccessToken() {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }
    
    if (!this.hasValidCredentials()) {
      throw new Error('Airwallex credentials not configured. Please set AIRWALLEX_CLIENT_ID and AIRWALLEX_API_KEY.');
    }
    
    try {
      const response = await fetch(`${this.getApiHost()}/authentication/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': this.clientId,
          'x-api-key': this.apiKey,
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Authentication failed: ${errorData.message || response.statusText}`);
      }
      
      const result = await response.json();
      this.accessToken = result.token;
      // Set expiry to 1 hour from now (tokens typically last longer, but this is safe)
      this.tokenExpiry = Date.now() + (60 * 60 * 1000);
      
      return this.accessToken;
    } catch (error) {
      console.error('Failed to get Airwallex access token:', error);
      throw error;
    }
  }
  
  /**
   * Get authentication headers for Airwallex API
   */
  async getAuthHeaders() {
    if (this.useBackendFallback || !this.hasValidCredentials()) {
      return {
        'Content-Type': 'application/json',
      };
    }
    
    const token = await this.getAccessToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }

  /**
   * Generate a unique merchant order ID
   */
  generateMerchantOrderId(prefix = 'ORDER') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `${prefix}_${timestamp}_${random}`;
  }
  
  /**
   * Parse error response to get meaningful error message
   * @param {Object} response - The error response
   * @returns {string} Formatted error message
   */
  parseErrorResponse(response) {
    if (!response) return 'Unknown error';
    
    // Log the full error response for debugging
    console.log('Airwallex API Error Response:', JSON.stringify(response, null, 2));
    
    if (response.message) return response.message;
    if (response.error && response.error.message) return response.error.message;
    if (response.code) return `Error code: ${response.code}`;
    
    return 'An unexpected error occurred';
  }
  
  /**
   * Log detailed error information for debugging
   * @param {string} method - The method where the error occurred
   * @param {Error} error - The error object
   * @param {Object} additionalInfo - Additional information to log
   */
  logError(method, error, additionalInfo = {}) {
    console.error(`Airwallex ${method} error:`, {
      message: error.message,
      stack: error.stack,
      ...additionalInfo
    });
  }

  /**
   * Create payment intent using direct Airwallex API or backend fallback
   */
  async createPaymentIntent(params) {
    try {
      // Use direct Airwallex API if credentials are configured
      if (!this.useBackendFallback && this.hasValidCredentials()) {
        return await this.createPaymentIntentDirect(params);
      }
      
      // Fallback to backend API
      return await this.createPaymentIntentViaBackend(params);
    } catch (error) {
      console.error('Create payment intent error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Create payment intent directly via Airwallex API
   */
  async createPaymentIntentDirect(params) {
    try {
      const token = await this.getAccessToken();
      const apiHost = this.getApiHost();
      
      const requestData = {
        request_id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        amount: params.amount,
        currency: params.currency,
        merchant_order_id: params.merchantOrderId,
        return_url: params.returnUrl,
        order: {
          products: [{
            name: params.plan || 'MatrixAI Subscription',
            desc: `${params.plan} - User: ${params.uid}`,
            quantity: 1,
            unit_price: params.amount,
            type: 'digital_service'
          }]
        },
        // Add required fields for SDK compatibility
        capture_method: 'automatic',
        confirmation_method: 'automatic'
      };
      
      console.log('🔄 Creating payment intent with Airwallex API:', {
        apiHost,
        amount: params.amount,
        currency: params.currency,
        merchantOrderId: params.merchantOrderId
      });
      
      const response = await fetch(`${apiHost}/pa/payment_intents/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Airwallex API error response:', errorData);
        throw new Error(`Airwallex API error: ${errorData.message || response.statusText}`);
      }
      
      const result = await response.json();
      console.log('✅ Payment intent created via Airwallex API:', result);
      
      return {
        success: true,
        data: {
          id: result.id,
          client_secret: result.client_secret,
          amount: result.amount,
          currency: result.currency,
          status: result.status,
          merchant_order_id: result.merchant_order_id
        }
      };
    } catch (error) {
      console.error('❌ Direct payment intent creation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Create payment intent via backend API (fallback)
   */
  async createPaymentIntentViaBackend(params) {
    try {
      const headers = await this.getAuthHeaders();
      
      const requestData = {
        request_id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        amount: params.amount || params,
        currency: params.currency || 'HKD',
        merchant_order_id: params.merchantOrderId || this.generateMerchantOrderId(),
        return_url: params.returnUrl || 'app://payment-success',
        uid: params.uid || 'mobile_user',
        plan: params.plan || 'Matrix AI Coins'
      };

      // Add order information
      requestData.order = {
        products: [{
          name: 'Matrix AI Coins',
          quantity: 1,
          unit_price: requestData.amount,
          type: 'digital'
        }]
      };

      const response = await fetch(`${this.backendUrl}/api/payment/airwallex/create-intent`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Payment intent creation failed: ${errorData.message || response.statusText}`);
      }

      const result = await response.json();
      return {
        success: true,
        data: result.data
      };
    } catch (error) {
      console.error('Backend payment intent creation error:', error);
      throw error;
    }
  }

  /**
   * Create subscription payment intent
   */
  async createSubscriptionPayment(planId, amount) {
    return this.createPaymentIntent({
      amount: amount,
      merchantOrderId: `subscription_${planId}_${Date.now()}`,
      plan: 'Subscription Plan'
    });
  }

  /**
   * Create addon payment intent
   */
  async createAddonPayment(addonId, amount) {
    return this.createPaymentIntent({
      amount: amount,
      merchantOrderId: `addon_${addonId}_${Date.now()}`,
      plan: 'Addon Purchase'
    });
  }

  /**
   * Get payment intent status via backend API
   */
  async getPaymentIntentStatus(paymentIntentId) {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${this.backendUrl}/api/payment/airwallex/status/${paymentIntentId}`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to retrieve payment intent: ${errorData.message || response.statusText}`);
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Get payment intent status error:', error);
      throw new Error(`Failed to get payment intent status: ${error.message}`);
    }
  }

  /**
   * Get payment status with enhanced error handling
   */
  async getPaymentStatus(paymentIntentId) {
    try {
      return await this.getPaymentIntentStatus(paymentIntentId);
    } catch (error) {
      console.error('Payment status fetch error:', error);
      return 'FAILED';
    }
  }

  /**
   * Generate unique ID (legacy method)
   */
  generateUniqueId() {
    return this.generateMerchantOrderId('order');
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

  /**
   * Confirm a payment with a payment method
   * @param {string} paymentIntentId - The ID of the payment intent to confirm
   * @param {string} paymentMethod - The payment method to use
   * @param {Object} additionalParams - Additional parameters for the payment method
   * @returns {Promise<Object>} Confirmation result
   */
  async confirmPayment(paymentIntentId, paymentMethod, additionalParams = {}) {
    try {
      // First get access token
      const tokenResponse = await this.getAccessToken();
      if (!tokenResponse.success) {
        throw new Error(tokenResponse.error);
      }

      // Prepare request payload
      const payload = {
        payment_method: paymentMethod,
        ...additionalParams
      };

      const response = await fetch(`${this.airwallexBaseURL}/api/v1/pa/payment_intents/${paymentIntentId}/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenResponse.data.access_token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to confirm payment');
      }

      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error('Payment confirmation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default new AirwallexService();