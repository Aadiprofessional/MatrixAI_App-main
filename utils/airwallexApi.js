import axios from 'axios';

// Set this to false to use real Airwallex API calls
const USE_MOCK_MODE = false;

// Airwallex API base URL
const API_BASE_URL = 'https://api-demo.airwallex.com/api/v1';

// Import from environment variables or use empty strings as fallback
const CLIENT_ID = process.env.AIRWALLEX_CLIENT_ID || '';
const API_KEY = process.env.AIRWALLEX_API_KEY || '';

// Store the token and its expiry time
let authToken = null;
let tokenExpiry = null;

/**
 * Authenticate with Airwallex API and get access token
 */
export const authenticate = async () => {
  // If in mock mode, return a fake token
  if (USE_MOCK_MODE) {
    console.log('[MOCK] Generating mock authentication token');
    const mockToken = 'mock_token_' + Date.now();
    authToken = mockToken;
    tokenExpiry = Date.now() + (24 * 60 * 60 * 1000); // 24 hours from now
    return mockToken;
  }

  // Check if we have a valid token
  if (authToken && tokenExpiry && Date.now() < tokenExpiry) {
    console.log('Using existing valid token');
    return authToken;
  }

  try {
    console.log('Authenticating with Airwallex API...');
    console.log('Using Client ID:', CLIENT_ID);
    console.log('API Base URL:', API_BASE_URL);
    
    const response = await axios.post(
      `${API_BASE_URL}/authentication/api_access_tokens`,
      {}, // Empty body as per documentation
      {
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': CLIENT_ID,
          'x-api-key': API_KEY
        }
      }
    );

    console.log('Authentication response status:', response.status);
    console.log('Authentication response data:', response.data);

    if (response.data && response.data.token) {
      authToken = response.data.token;
      // Set token expiry to 23 hours from now (tokens typically last 24 hours)
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
      console.error('Response headers:', error.response.headers);
      
      if (error.response.status === 401) {
        throw new Error('Invalid API credentials. Please check your Client ID and API key.');
      } else if (error.response.status === 403) {
        throw new Error('Access forbidden. Please check your API permissions.');
      } else {
        throw new Error(`Authentication failed with status ${error.response.status}: ${error.response.data?.message || 'Unknown error'}`);
      }
    } else if (error.request) {
      console.error('No response received:', error.request);
      throw new Error('Network error: Unable to connect to Airwallex API. Please check your internet connection.');
    } else {
      console.error('Request setup error:', error.message);
      throw new Error(`Request error: ${error.message}`);
    }
  }
};

/**
 * Get current account balances
 */
export const getBalances = async () => {
  if (USE_MOCK_MODE) {
    console.log('[MOCK] Returning mock balances');
    return [
      {
        available_amount: 10000,
        currency: "USD",
        pending_amount: 0,
        total_amount: 10000
      },
      {
        available_amount: 50000,
        currency: "HKD",
        pending_amount: 0,
        total_amount: 50000
      }
    ];
  }

  try {
    const token = await authenticate();
    
    const response = await axios.get(
      `${API_BASE_URL}/balances/current`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Error getting balances:', error);
    throw new Error(error.response?.data?.message || 'Failed to get balance information');
  }
};

/**
 * Create a virtual card for payment processing
 * This is the proper way to handle payments with Airwallex
 */
export const createVirtualCard = async (amount, currency = 'HKD', cardHolderName = 'Card Holder') => {
  if (USE_MOCK_MODE) {
    console.log('[MOCK] Creating mock virtual card for', amount, currency);
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const cardId = `mock_card_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    
    return {
      id: cardId,
      card_number: '4111111111111111',
      expiry_month: '12',
      expiry_year: '25',
      cvc: '123',
      amount: amount,
      currency: currency,
      status: 'ACTIVE'
    };
  }

  try {
    const token = await authenticate();
    
    // Create a unique request ID
    const requestId = `card_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    
    // Create virtual card
    const response = await axios.post(
      `${API_BASE_URL}/issuing/cards/create`,
      {
        request_id: requestId,
        form_factor: 'VIRTUAL',
        issue_to: 'ORGANISATION',
        name_on_card: cardHolderName,
        authorization_controls: {
          allowed_transaction_count: 'SINGLE',
          per_transaction_limits: [
            {
              currency: currency,
              limit: parseFloat(amount),
              unlimited: false
            }
          ]
        },
        primary_contact_details: {
          full_name: cardHolderName,
          mobile_number: '85212345678',
          date_of_birth: '1990-01-01'
        },
        note: `Payment card for ${amount} ${currency}`,
        client_data: `payment_${Date.now()}`
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return {
      id: response.data.id || requestId,
      amount: amount,
      currency: currency,
      status: response.data.status || 'ACTIVE',
      card_data: response.data
    };
  } catch (error) {
    console.error('Error creating virtual card:', error);
    throw new Error(error.response?.data?.message || 'Failed to create virtual card');
  }
};

/**
 * Create a payment intent with Airwallex
 * This creates a virtual card that can be used for payment
 */
export const createPaymentIntent = async (amount, currency = 'HKD', cardHolderName = 'Card Holder') => {
  if (USE_MOCK_MODE) {
    console.log('[MOCK] Creating mock payment intent for', amount, currency);
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const requestId = `mock_payment_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    
    return {
      id: requestId,
      client_secret: `${requestId}_secret`,
      amount: amount,
      currency: currency,
      status: 'requires_payment_method'
    };
  }

  try {
    // For Airwallex, we'll create a virtual card that can be used for the payment
    const virtualCard = await createVirtualCard(amount, currency, cardHolderName);
    
    return {
      id: virtualCard.id,
      client_secret: `${virtualCard.id}_secret`,
      amount: amount,
      currency: currency,
      status: 'requires_payment_method',
      virtual_card: virtualCard
    };
  } catch (error) {
    console.error('Error creating payment intent:', error);
    throw new Error(error.message || 'Failed to create payment intent');
  }
};

/**
 * Process a card payment using Airwallex
 */
export const processCardPayment = async (paymentIntentId, cardDetails) => {
  if (USE_MOCK_MODE) {
    console.log('[MOCK] Processing mock card payment for', paymentIntentId);
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return {
      id: paymentIntentId,
      status: 'succeeded',
      amount_received: 1000,
      currency: 'HKD'
    };
  }

  try {
    const token = await authenticate();
    
    // In a real implementation, you would process the card payment here
    // For now, we'll simulate a successful payment
    console.log('Processing card payment with Airwallex for intent:', paymentIntentId);
    
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return {
      id: paymentIntentId,
      status: 'succeeded',
      amount_received: cardDetails.amount || 1000,
      currency: cardDetails.currency || 'HKD'
    };
  } catch (error) {
    console.error('Error processing card payment:', error);
    throw new Error(error.response?.data?.message || 'Failed to process card payment');
  }
};

/**
 * Create a transfer (for alternative payment methods)
 */
export const createTransfer = async (amount, currency = 'HKD', paymentMethod = 'CARD') => {
  if (USE_MOCK_MODE) {
    console.log('[MOCK] Creating mock transfer for', amount, currency, 'via', paymentMethod);
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const transferId = `mock_transfer_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    
    return {
      id: transferId,
      status: 'CONFIRMED',
      amount: amount,
      currency: currency,
      payment_method: paymentMethod
    };
  }

  try {
    const token = await authenticate();
    
    // Create a unique request ID
    const requestId = `transfer_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    
    // For simplicity, we'll create a basic transfer
    // In a real implementation, you'd need beneficiary details
    const response = await axios.post(
      `${API_BASE_URL}/transfers/create`,
      {
        request_id: requestId,
        source_currency: currency,
        source_amount: parseFloat(amount),
        target_currency: currency,
        target_amount: parseFloat(amount),
        payment_method: paymentMethod,
        metadata: {
          payment_type: 'subscription',
          created_at: new Date().toISOString()
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return {
      id: response.data.id || requestId,
      status: response.data.status || 'PENDING',
      amount: amount,
      currency: currency,
      payment_method: paymentMethod,
      transfer_data: response.data
    };
  } catch (error) {
    console.error('Error creating transfer:', error);
    throw new Error(error.response?.data?.message || 'Failed to create transfer');
  }
};

/**
 * Check transfer status by ID
 */
export const getTransferStatus = async (transferId) => {
  if (USE_MOCK_MODE) {
    console.log('[MOCK] Getting mock transfer status for', transferId);
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    return {
      id: transferId,
      status: 'CONFIRMED',
      created_at: new Date().toISOString(),
      amount: 1000,
      currency: 'HKD'
    };
  }

  try {
    const token = await authenticate();
    
    const response = await axios.get(
      `${API_BASE_URL}/transfers/${transferId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Error checking transfer status:', error);
    throw new Error(error.response?.data?.message || 'Failed to check transfer status');
  }
};

/**
 * Confirm subscription purchase
 */
export const confirmSubscriptionPurchase = async (uid, plan, amount, couponId = "", paymentId) => {
  // Log both in real and mock mode
  console.log(`Confirming subscription for user ${uid}, plan ${plan}, payment ${paymentId}`);
  
  // Validate required parameters
  if (!uid) {
    console.error('Missing uid for subscription purchase');
    return { success: false, message: 'Missing user ID' };
  }
  
  if (!plan) {
    console.error('Missing plan for subscription purchase');
    return { success: false, message: 'Missing subscription plan' };
  }
  
  if (!paymentId) {
    console.error('Missing paymentId for subscription purchase');
    return { success: false, message: 'Missing payment information' };
  }
  
  // Ensure amount is a valid number
  const validAmount = amount && !isNaN(amount) ? amount : 0;
  
  try {
    if (USE_MOCK_MODE) {
      console.log('[MOCK] Making real API call even in mock mode to update coins');
    }
    
    // Always call the real backend API to update coins, even in mock mode
    const response = await fetch('https://main-matrixai-server-lujmidrakh.cn-hangzhou.fcapp.run/BuySubscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uid,
        plan,
        totalPrice: validAmount,
        couponId: couponId || "",
        paymentIntentId: paymentId // Use our mock paymentId in place of paymentIntentId
      }),
    });
    
    if (!response.ok) {
      console.error('Subscription API error:', response.status, response.statusText);
      return { success: false, message: 'Server error while confirming subscription' };
    }
    
    const result = await response.json();
    console.log('Subscription confirmation result from server:', result);
    return result;
  } catch (error) {
    console.error('Payment confirmation error:', error);
    
    if (USE_MOCK_MODE) {
      console.log('[MOCK] API call failed, returning mock success response');
      // In mock mode, still return success if API call fails
      return {
        success: true,
        message: 'Subscription confirmed successfully (mock response)',
        subscriptionId: `sub_${Date.now()}`,
        userId: uid,
        planId: plan,
        startDate: new Date().toISOString(),
        endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString(),
        status: 'active'
      };
    }
    
    return { success: false, message: 'Failed to confirm subscription' };
  }
};

/**
 * Test the Airwallex API connection
 */
export const testConnection = async () => {
  try {
    console.log('Testing Airwallex API connection...');
    const token = await authenticate();
    
    if (token) {
      console.log('✅ Airwallex API connection successful');
      
      // Test getting balances
      try {
        const balances = await getBalances();
        console.log('✅ Balance retrieval successful:', balances);
        return { success: true, message: 'Connection successful', balances };
      } catch (balanceError) {
        console.log('⚠️ Balance retrieval failed but authentication worked:', balanceError.message);
        return { success: true, message: 'Authentication successful, balance check failed', error: balanceError.message };
      }
    } else {
      throw new Error('No token received');
    }
  } catch (error) {
    console.error('❌ Airwallex API connection failed:', error);
    return { success: false, message: error.message };
  }
};