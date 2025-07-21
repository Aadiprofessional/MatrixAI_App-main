import axios from 'axios';

// Environment variables (would normally be loaded from .env)
const ANTOM_PRODUCTION = process.env.ANTOM_PRODUCTION === 'true' || false;
const CLIENT_ID = ANTOM_PRODUCTION 
  ? process.env.ANTOM_PRODUCTION_CLIENT_ID 
  : 'antom_test_client_id'; // Replace with your test client ID
const PRIVATE_KEY = ANTOM_PRODUCTION 
  ? process.env.ANTOM_PRODUCTION_PRIVATE_KEY 
  : 'antom_test_private_key'; // Replace with your test private key
const MERCHANT_ID = ANTOM_PRODUCTION 
  ? process.env.ANTOM_PRODUCTION_MERCHANT_ID 
  : 'antom_test_merchant_id'; // Replace with your test merchant ID

// API base URL (different for production and test)
const API_BASE_URL = ANTOM_PRODUCTION 
  ? 'https://api.antom.com/api/v1' 
  : 'https://api-sandbox.antom.com/api/v1';

// Store the token and its expiry time
let authToken = null;
let tokenExpiry = null;

/**
 * Authenticate with Antom API and get access token
 */
export const authenticate = async () => {
  // Check if we have a valid token
  if (authToken && tokenExpiry && Date.now() < tokenExpiry) {
    console.log('Using existing valid Antom token');
    return authToken;
  }

  try {
    console.log('Authenticating with Antom Payment Service...');
    console.log('Using Client ID:', CLIENT_ID);
    console.log('API Base URL:', API_BASE_URL);
    
    const response = await axios.post(
      `${API_BASE_URL}/auth/token`,
      {
        client_id: CLIENT_ID,
        private_key: PRIVATE_KEY
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Authentication response status:', response.status);

    if (response.data && response.data.token) {
      authToken = response.data.token;
      // Set token expiry to 23 hours from now (assuming tokens last 24 hours)
      tokenExpiry = Date.now() + (23 * 60 * 60 * 1000);
      console.log('✅ Authentication successful, token received');
      return authToken;
    } else {
      throw new Error('No token received in response');
    }
  } catch (error) {
    console.error('❌ Authentication failed:', error);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
      
      if (error.response.status === 401) {
        throw new Error('Invalid API credentials. Please check your Client ID and Private Key.');
      } else if (error.response.status === 403) {
        throw new Error('Access forbidden. Please check your API permissions.');
      } else {
        throw new Error(`Authentication failed with status ${error.response.status}: ${error.response.data?.message || 'Unknown error'}`);
      }
    } else if (error.request) {
      console.error('No response received:', error.request);
      throw new Error('Network error: Unable to connect to Antom API. Please check your internet connection.');
    } else {
      console.error('Request setup error:', error.message);
      throw new Error(`Request error: ${error.message}`);
    }
  }
};

/**
 * Get available payment methods
 */
export const getPaymentMethods = async () => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/payment/methods`,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data && response.data.success) {
      return response.data.data;
    } else {
      throw new Error('Failed to retrieve payment methods');
    }
  } catch (error) {
    console.error('Failed to get payment methods:', error);
    throw error;
  }
};

/**
 * Create a payment transaction
 */
export const createPayment = async (paymentData) => {
  try {
    // Ensure we have a valid token
    const token = await authenticate();

    const {
      planId,
      addonId,
      amount,
      currency = 'HKD',
      paymentMethodType = 'CARD',
      orderDescription = '',
      redirectUrl,
      notifyUrl
    } = paymentData;

    // Validate required fields
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      throw new Error('Invalid payment amount');
    }

    if (!planId && !addonId) {
      throw new Error('Either planId or addonId must be provided');
    }

    const requestBody = {
      merchant_id: MERCHANT_ID,
      amount: parseFloat(amount),
      currency,
      payment_method_type: paymentMethodType,
      order_description: orderDescription,
      metadata: {
        planId,
        addonId
      }
    };

    if (redirectUrl) {
      requestBody.redirect_url = redirectUrl;
    }

    if (notifyUrl) {
      requestBody.notify_url = notifyUrl;
    }

    const response = await axios.post(
      `${API_BASE_URL}/payment/create`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (response.data && response.data.success) {
      return response.data.data;
    } else {
      throw new Error(response.data?.message || 'Failed to create payment');
    }
  } catch (error) {
    console.error('Failed to create payment:', error);
    throw error;
  }
};

/**
 * Query payment status
 */
export const getPaymentStatus = async (paymentRequestId) => {
  try {
    // Ensure we have a valid token
    const token = await authenticate();

    const response = await axios.get(
      `${API_BASE_URL}/payment/status/${paymentRequestId}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (response.data) {
      return response.data;
    } else {
      throw new Error('Failed to retrieve payment status');
    }
  } catch (error) {
    console.error(`Failed to get status for payment ${paymentRequestId}:`, error);
    throw error;
  }
};

/**
 * Cancel a payment
 */
export const cancelPayment = async (paymentRequestId) => {
  try {
    // Ensure we have a valid token
    const token = await authenticate();

    const response = await axios.post(
      `${API_BASE_URL}/payment/cancel/${paymentRequestId}`,
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (response.data && response.data.success) {
      return response.data;
    } else {
      throw new Error(response.data?.message || 'Failed to cancel payment');
    }
  } catch (error) {
    console.error(`Failed to cancel payment ${paymentRequestId}:`, error);
    throw error;
  }
};

/**
 * Get payment history
 */
export const getPaymentHistory = async (page = 1, limit = 20, status = null) => {
  try {
    // Ensure we have a valid token
    const token = await authenticate();

    let url = `${API_BASE_URL}/payment/history?page=${page}&limit=${limit}`;
    if (status) {
      url += `&status=${status}`;
    }

    const response = await axios.get(
      url,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (response.data && response.data.success) {
      return response.data.data;
    } else {
      throw new Error('Failed to retrieve payment history');
    }
  } catch (error) {
    console.error('Failed to get payment history:', error);
    throw error;
  }
};

/**
 * Process card payment
 */
export const processCardPayment = async (paymentRequestId, cardDetails) => {
  try {
    // Ensure we have a valid token
    const token = await authenticate();

    const {
      cardNumber,
      cardExpiry,
      cardCVC,
      cardHolderName
    } = cardDetails;

    // Validate card details
    if (!cardNumber || !cardExpiry || !cardCVC || !cardHolderName) {
      throw new Error('Incomplete card details');
    }

    // Format expiry date (MM/YY to MMYY)
    const expiryFormatted = cardExpiry.replace('/', '');

    const requestBody = {
      payment_request_id: paymentRequestId,
      card: {
        number: cardNumber.replace(/\s/g, ''),
        expiry: expiryFormatted,
        cvc: cardCVC,
        holder_name: cardHolderName
      }
    };

    const response = await axios.post(
      `${API_BASE_URL}/payment/process/card`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (response.data && response.data.success) {
      return response.data.data;
    } else {
      throw new Error(response.data?.message || 'Card payment processing failed');
    }
  } catch (error) {
    console.error('Failed to process card payment:', error);
    throw error;
  }
};

/**
 * Process wallet payment (e.g., GCASH, MAYA)
 */
export const processWalletPayment = async (paymentRequestId, walletType) => {
  try {
    // Ensure we have a valid token
    const token = await authenticate();

    const requestBody = {
      payment_request_id: paymentRequestId,
      wallet_type: walletType
    };

    const response = await axios.post(
      `${API_BASE_URL}/payment/process/wallet`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (response.data && response.data.success) {
      return response.data.data;
    } else {
      throw new Error(response.data?.message || 'Wallet payment processing failed');
    }
  } catch (error) {
    console.error(`Failed to process ${walletType} payment:`, error);
    throw error;
  }
};

/**
 * Confirm subscription purchase after successful payment
 */
export const confirmSubscriptionPurchase = async (userId, planId, amount, paymentRequestId) => {
  try {
    // Ensure we have a valid token
    const token = await authenticate();

    // Validate required parameters
    if (!userId) {
      console.error('Missing userId for subscription purchase');
      throw new Error('User ID is required');
    }

    if (!planId) {
      console.error('Missing planId for subscription purchase');
      throw new Error('Plan ID is required');
    }

    if (!paymentRequestId) {
      console.error('Missing paymentRequestId for subscription purchase');
      throw new Error('Payment Request ID is required');
    }

    const requestBody = {
      user_id: userId,
      plan_id: planId,
      amount: parseFloat(amount),
      payment_request_id: paymentRequestId
    };

    const response = await axios.post(
      `${API_BASE_URL}/subscription/confirm`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (response.data && response.data.success) {
      return response.data.data;
    } else {
      throw new Error(response.data?.message || 'Failed to confirm subscription purchase');
    }
  } catch (error) {
    console.error('Failed to confirm subscription purchase:', error);
    throw error;
  }
};

/**
 * Confirm addon purchase after successful payment
 */
export const confirmAddonPurchase = async (userId, addonId, amount, paymentRequestId) => {
  try {
    // Ensure we have a valid token
    const token = await authenticate();

    // Validate required parameters
    if (!userId) {
      console.error('Missing userId for addon purchase');
      throw new Error('User ID is required');
    }

    if (!addonId) {
      console.error('Missing addonId for addon purchase');
      throw new Error('Addon ID is required');
    }

    if (!paymentRequestId) {
      console.error('Missing paymentRequestId for addon purchase');
      throw new Error('Payment Request ID is required');
    }

    const requestBody = {
      user_id: userId,
      addon_id: addonId,
      amount: parseFloat(amount),
      payment_request_id: paymentRequestId
    };

    const response = await axios.post(
      `${API_BASE_URL}/addon/confirm`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (response.data && response.data.success) {
      return response.data.data;
    } else {
      throw new Error(response.data?.message || 'Failed to confirm addon purchase');
    }
  } catch (error) {
    console.error('Failed to confirm addon purchase:', error);
    throw error;
  }
};

/**
 * Test connection to Antom API
 */
export const testConnection = async () => {
  try {
    // Try to authenticate
    const token = await authenticate();
    
    return {
      success: true,
      message: 'Successfully connected to Antom Payment Service',
      environment: ANTOM_PRODUCTION ? 'Production' : 'Sandbox'
    };
  } catch (error) {
    console.error('Connection test failed:', error);
    return {
      success: false,
      message: `Connection failed: ${error.message}`,
      error: error.message
    };
  }
};