import { NativeModules } from 'react-native';
import { initialize, presentEntirePaymentFlow } from 'airwallex-payment-react-native';

const { AirwallexManager } = NativeModules;

class AirwallexNative {
  static async initialize(environment = 'demo', enableLogging = true) {
    try {
      // Initialize the new Airwallex SDK
      await initialize({
        environment: environment, // 'staging', 'demo', or 'production'
        enableLogging: enableLogging,
      });
      console.log('Airwallex SDK initialized successfully');
      return { success: true };
    } catch (error) {
      console.error('Failed to initialize Airwallex SDK:', error);
      throw error;
    }
  }

  static async presentEntirePaymentFlow(clientSecret, paymentIntentId, amount = 1, currency = 'USD') {
    try {
      console.log('=== Airwallex Payment Flow Started ===');
      console.log('Input parameters:', { 
        clientSecret: clientSecret ? `${clientSecret.substring(0, 10)}...` : 'null', 
        paymentIntentId, 
        amount, 
        currency 
      });
      
      // Check if presentEntirePaymentFlow function is available
      if (!presentEntirePaymentFlow || typeof presentEntirePaymentFlow !== 'function') {
        throw new Error('presentEntirePaymentFlow method not available');
      }
      
      // Comprehensive parameter validation
      if (!clientSecret) {
        throw new Error('clientSecret is required and cannot be null or empty');
      }
      if (!paymentIntentId) {
        throw new Error('paymentIntentId is required and cannot be null or empty');
      }
      if (typeof amount !== 'number' || amount <= 0) {
        throw new Error('amount must be a positive number');
      }
      if (!currency || typeof currency !== 'string') {
        throw new Error('currency must be a valid string (e.g., USD, EUR)');
      }
      
      // Create PaymentSession object according to official documentation
      const session = {
        type: 'OneOff',
        paymentIntentId: paymentIntentId,
        currency: currency,
        countryCode: 'HK',
        amount: amount,
        isBillingRequired: false,
        isEmailRequired: false,
        paymentMethods: ['card', 'alipay', 'alipayhk', 'wechatpay', 'googlepay', 'applepay'],
        clientSecret: clientSecret,
        // Add additional required fields for SDK authentication
        returnUrl: 'matrixai://payment/result',
        logoUrl: null,
        theme: {
          primaryColor: '#2274F0'
        }
      };
      
      console.log('PaymentSession object created:', {
        ...session,
        clientSecret: `${session.clientSecret.substring(0, 10)}...` // Hide sensitive data in logs
      });
      
      console.log('Calling Airwallex presentEntirePaymentFlow...');
      
      // Use the official SDK pattern
      const result = await presentEntirePaymentFlow(session);
      
      console.log('Payment flow completed with result:', result);
      console.log('=== Airwallex Payment Flow Ended ===');
      
      return result;
    } catch (error) {
      console.error('=== Airwallex Payment Flow Error ===');
      console.error('Error type:', error.constructor.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      console.error('=== End Error Details ===');
      
      // Re-throw with enhanced error information
      const enhancedError = new Error(`Airwallex Payment Error: ${error.message}`);
      enhancedError.originalError = error;
      enhancedError.timestamp = new Date().toISOString();
      throw enhancedError;
    }
  }

  // Legacy methods for backward compatibility
  static async createPaymentSession(paymentIntentId) {
    if (!AirwallexManager) {
      throw new Error('AirwallexManager native module not found');
    }
    return await AirwallexManager.createPaymentSession(paymentIntentId);
  }

  static async presentPaymentFlow() {
    if (!AirwallexManager) {
      throw new Error('AirwallexManager native module not found');
    }
    return await AirwallexManager.presentPaymentFlow();
  }

  static isAvailable() {
    return !!(initialize && presentEntirePaymentFlow);
  }
}

export default AirwallexNative;