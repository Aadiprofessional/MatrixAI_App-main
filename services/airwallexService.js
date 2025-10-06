import Config from 'react-native-config';
import { API_BASE_URL } from '../config/api';

class AirwallexService {
  constructor() {
    // Use the centralized API configuration
    this.backendUrl = API_BASE_URL;
    
    // Airwallex API configuration
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
    
    // Always use backend API for production reliability
    this.useBackendFallback = true;
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
   * Create a payment intent using backend API
   * @param {Object} paymentData - Payment data including amount, currency, etc.
   * @returns {Promise<Object>} Payment intent result
   */
  async createPaymentIntent(paymentData) {
    console.log('🔄 Creating payment intent with data:', paymentData);
    
    try {
      const requestData = {
        amount: paymentData.amount,
        currency: paymentData.currency || 'HKD',
        uid: paymentData.uid || 'anonymous',
        plan: paymentData.plan || 'Unknown Plan',
        merchant_order_id: paymentData.merchantOrderId || this.generateMerchantOrderId(),
        return_url: paymentData.returnUrl || 'matrixai://payment/result',
        metadata: {
          ...paymentData.metadata
        }
      };

      console.log('📡 Sending request to backend API:', `${this.backendUrl}/api/payment/airwallex/create-intent`);
      
      const response = await fetch(`${this.backendUrl}/api/payment/airwallex/create-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestData),
        timeout: 30000 // 30 second timeout
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Backend API error response:', errorText);
        throw new Error(`Backend API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Payment intent created successfully:', result);

      return {
        success: true,
        data: {
          id: result.data?.id || result.data?.payment_intent_id || result.id || result.payment_intent_id,
          client_secret: result.data?.client_secret || result.client_secret,
          amount: result.data?.amount || result.amount,
          currency: result.data?.currency || result.currency,
          status: result.data?.status || result.status,
          merchant_order_id: result.data?.merchant_order_id || result.merchant_order_id
        }
      };
    } catch (error) {
      console.error('❌ Payment intent creation failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to create payment intent'
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
   * Get subscription plans
   * @param {string} uid - User ID
   * @returns {Promise<Object>} Subscription plans result
   */
  async getSubscriptionPlans(uid) {
    try {
      console.log('📋 Getting subscription plans for user:', uid);
      
      const response = await fetch(`${this.backendUrl}/api/user/getSubscriptionPlans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          uid: uid
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Subscription plans error response:', errorText);
        throw new Error(`Failed to get subscription plans: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Subscription plans retrieved:', result);
      
      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('❌ Get subscription plans error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create subscription payment intent
   */
  async createSubscriptionPayment(planId, amount, uid) {
    return this.createPaymentIntent({
      amount: amount,
      merchantOrderId: `subscription_${planId}_${Date.now()}`,
      plan: 'Subscription Plan',
      uid: uid,
      subscriptionId: planId
    });
  }

  /**
   * Create addon payment intent
   */
  async createAddonPayment(addonId, amount, uid, currency = 'HKD') {
    return this.createPaymentIntent({
      amount: amount,
      currency: currency,
      merchantOrderId: `addon_${addonId}_${Date.now()}`,
      plan: 'Addon Purchase',
      uid: uid,
      addonId: addonId
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
   * Get payment status from Airwallex
   * @param {string} paymentIntentId - The payment intent ID
   * @returns {Promise<Object>} Payment status result
   */
  async getPaymentStatus(paymentIntentId) {
    try {
      console.log('📊 Getting payment status for:', paymentIntentId);
      
      const response = await fetch(`${this.backendUrl}/api/payment/airwallex/status/${paymentIntentId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Payment status error response:', errorText);
        throw new Error(`Failed to get payment status: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Payment status retrieved:', result);
      
      return {
        success: true,
        data: {
          id: result.id,
          status: result.status,
          amount: result.amount,
          currency: result.currency,
          created_at: result.created_at,
          updated_at: result.updated_at
        }
      };
    } catch (error) {
      console.error('❌ Get payment status error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Confirm a payment intent
   * @param {string} paymentIntentId - The payment intent ID
   * @param {Object} paymentMethod - Payment method details
   * @returns {Promise<Object>} Confirmation result
   */
  async confirmPaymentIntent(paymentIntentId, paymentMethod = { type: 'card' }) {
    try {
      console.log('✅ Confirming payment intent:', paymentIntentId);
      
      const response = await fetch(`${this.backendUrl}/api/payment/airwallex/confirm/${paymentIntentId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          payment_method: paymentMethod
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Payment confirmation error response:', errorText);
        throw new Error(`Failed to confirm payment: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Payment confirmed successfully:', result);
      
      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('❌ Payment confirmation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Cancel a payment intent
   * @param {string} paymentIntentId - The payment intent ID
   * @param {string} cancellationReason - Reason for cancellation
   * @returns {Promise<Object>} Cancellation result
   */
  async cancelPaymentIntent(paymentIntentId, cancellationReason = 'requested_by_customer') {
    try {
      console.log('❌ Cancelling payment intent:', paymentIntentId);
      
      const response = await fetch(`${this.backendUrl}/api/payment/airwallex/cancel/${paymentIntentId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          cancellation_reason: cancellationReason
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Payment cancellation error response:', errorText);
        throw new Error(`Failed to cancel payment: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Payment cancelled successfully:', result);
      
      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('❌ Payment cancellation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get available payment methods
   * @returns {Promise<Object>} Available payment methods
   */
  async getAvailablePaymentMethods() {
    try {
      console.log('💳 Getting available payment methods');
      
      const response = await fetch(`${this.backendUrl}/api/payment/airwallex/payment-methods`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Payment methods error response:', errorText);
        throw new Error(`Failed to get payment methods: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Payment methods retrieved:', result);
      
      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('❌ Get payment methods error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check payment service health
   * @returns {Promise<Object>} Health check result
   */
  async checkPaymentHealth() {
    try {
      console.log('🏥 Checking payment service health');
      
      const response = await fetch(`${this.backendUrl}/api/payment/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Health check error response:', errorText);
        throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Payment service health:', result);
      
      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('❌ Health check error:', error);
      return {
        success: false,
        error: error.message
      };
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