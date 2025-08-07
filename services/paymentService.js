import { API_BASE_URL, getDefaultHeaders } from '../config/api';

class PaymentService {
  constructor() {
    this.baseURL = `${API_BASE_URL}/api/payment`;
  }

  /**
   * Get available payment methods
   */
  async getPaymentMethods(session) {
    try {
      const response = await fetch(`${this.baseURL}/methods`, {
        method: 'GET',
        headers: this.getAuthHeaders(session)
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch payment methods');
      }

      return {
        success: true,
        data: data.data || []
      };
    } catch (error) {
      console.error('Payment methods fetch error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get authorization headers with JWT token
   */
  getAuthHeaders(session) {
    return getDefaultHeaders(true, session);
  }

  /**
   * Create a new payment
   */
  async createPayment(paymentData, session) {
    try {
      const response = await fetch(`${this.baseURL}/create`, {
        method: 'POST',
        headers: this.getAuthHeaders(session),
        body: JSON.stringify(paymentData)
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to create payment');
      }

      return {
        success: true,
        data: data.data
      };
    } catch (error) {
      console.error('Payment creation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Subtract coins from user account
   */
  async subtractCoins(uid, coinAmount, transactionName) {
    try {
      const response = await fetch('https://main-matrixai-server-lujmidrakh.cn-hangzhou.fcapp.run/api/user/subtractCoins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uid,
          coinAmount,
          transaction_name: transactionName
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || 'Failed to subtract coins');
      }

      return response.json();
    } catch (error) {
      console.error('Subtract coins error:', error);
      throw error;
    }
  }

  /**
   * Query payment status
   */
  async queryPaymentStatus(paymentRequestId, session) {
    try {
      const response = await fetch(`${this.baseURL}/status/${paymentRequestId}`, {
        method: 'GET',
        headers: this.getAuthHeaders(session)
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to query payment status');
      }

      return {
        success: true,
        data: data.data
      };
    } catch (error) {
      console.error('Payment query error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Cancel payment
   */
  async cancelPayment(paymentRequestId, session) {
    try {
      const response = await fetch(`${this.baseURL}/cancel/${paymentRequestId}`, {
        method: 'POST',
        headers: this.getAuthHeaders(session)
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to cancel payment');
      }

      return {
        success: true,
        data: data.data
      };
    } catch (error) {
      console.error('Payment cancellation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get payment history
   */
  async getPaymentHistory(params = {}, session) {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.page) queryParams.append('page', params.page);
      if (params.limit) queryParams.append('limit', params.limit);
      if (params.status) queryParams.append('status', params.status);

      const url = `${this.baseURL}/history${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders(session)
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch payment history');
      }

      return {
        success: true,
        data: data.data
      };
    } catch (error) {
      console.error('Payment history error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create subscription payment
   */
  async createSubscriptionPayment(planId, amount, currency = 'USD', paymentMethodType = 'GCASH', session) {
    return this.createPayment({
      planId,
      amount,
      currency,
      paymentMethodType,
      orderDescription: `EduSmart Subscription Payment`
    }, session);
  }

  /**
   * Create addon payment
   */
  async createAddonPayment(addonId, amount, currency = 'USD', paymentMethodType = 'GCASH', session) {
    return this.createPayment({
      addonId,
      amount,
      currency,
      paymentMethodType,
      orderDescription: `EduSmart Addon Payment`
    }, session);
  }

  /**
   * Poll payment status until completion
   */
  async pollPaymentStatus(paymentRequestId, session, maxAttempts = 30, interval = 2000) {
    let attempts = 0;
    
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          attempts++;
          
          const result = await this.queryPaymentStatus(paymentRequestId, session);
          
          if (!result.success) {
            reject(new Error(result.error));
            return;
          }

          const status = result.data.status;
          
          // If payment is completed or failed, resolve
          if (status === 'completed' || status === 'failed' || status === 'cancelled') {
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

export default new PaymentService();