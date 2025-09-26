import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import airwallexService from '../../services/airwallexService';
import { initialize, presentEntirePaymentFlow } from 'airwallex-payment-react-native';
import { useAuth } from '../../context/AuthContext';

const AirwallexPaymentScreen = ({ route, navigation }) => {
  const { orderData } = route.params;
  const { uid } = useAuth();
  const [loading, setLoading] = useState(false);
  const [paymentIntent, setPaymentIntent] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    createPaymentIntent();
  }, []);

  const createPaymentIntent = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Creating payment intent for order:', orderData);
      
      // Check if Airwallex service has valid credentials configured
      const hasCredentials = airwallexService.hasValidCredentials();
      
      if (!hasCredentials) {
        console.log('⚠️ Airwallex credentials not configured, using backend fallback');
        
        // Show setup instructions if backend also fails
        const showSetupInstructions = () => {
          Alert.alert(
            '🔧 Airwallex Setup Required',
            'To enable payments, you need to configure Airwallex credentials:\n\n1. Create sandbox account at airwallex.com\n2. Generate Client ID and API key\n3. Set environment variables:\n   - AIRWALLEX_CLIENT_ID\n   - AIRWALLEX_API_KEY\n\n📋 Alternative: Configure backend API with proper credentials',
            [
              { text: 'Continue with Backend', style: 'default' },
              { text: 'Setup Guide', style: 'default', onPress: () => {
                // Could navigate to setup instructions or open documentation
                console.log('Opening setup guide...');
              }}
            ]
          );
        };
        
        // Try backend fallback first, show instructions only if that fails too
        try {
          const backendResult = await airwallexService.createPaymentIntent({
            amount: orderData.amount,
            currency: orderData.currency || 'HKD',
            merchantOrderId: airwallexService.generateMerchantOrderId(`${orderData.type}_${orderData.addonId || orderData.subscriptionId}`),
            returnUrl: 'matrixai://payment/result',
            uid: uid || 'anonymous_user',
            plan: orderData.name,
          });
          
          if (!backendResult.success) {
            showSetupInstructions();
            return;
          }
          
          console.log('✅ Payment intent created via backend:', backendResult);
          setPaymentIntent(backendResult);
          return;
        } catch (backendError) {
          console.error('Backend fallback failed:', backendError);
          showSetupInstructions();
          return;
        }
      }
      
      // Use direct Airwallex API integration when credentials are configured
      console.log('✅ Using direct Airwallex API integration');
      
      // Extract numeric value from amount (similar to web implementation)
      const numericAmount = typeof orderData.amount === 'string' 
        ? parseFloat(orderData.amount.replace(/[^0-9.]/g, ''))
        : orderData.amount;
      
      const paymentResponse = await airwallexService.createPaymentIntent({
        amount: Math.round(numericAmount), // HKD amount as-is (no cents conversion)
        currency: orderData.currency || 'HKD',
        merchantOrderId: airwallexService.generateMerchantOrderId(`${orderData.type}_${orderData.addonId || orderData.subscriptionId}`),
        returnUrl: 'matrixai://payment/result',
        uid: uid || 'anonymous_user',
        plan: orderData.name,
      });
      
      if (!paymentResponse.success) {
        throw new Error(paymentResponse.error || 'Failed to create payment intent');
      }
      
      console.log('✅ Payment intent created successfully:', paymentResponse);
      setPaymentIntent(paymentResponse);
    } catch (error) {
      console.error('Error creating payment intent:', error);
      setError(error.message || 'Failed to create payment intent');
      Alert.alert('Error', error.message || 'Failed to create payment intent');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!paymentIntent) {
      Alert.alert('Error', 'Payment intent not created');
      return;
    }

    try {
      setLoading(true);
      
      console.log('Starting payment process with intent:', paymentIntent.id);
      console.log('Airwallex SDK initialize function:', { initialize });
      console.log('Airwallex SDK initialize function:', initialize);
      console.log('presentEntirePaymentFlow function:', typeof presentEntirePaymentFlow);
      
      // Check if Airwallex SDK functions are available
      if (!initialize || typeof initialize !== 'function' || !presentEntirePaymentFlow || typeof presentEntirePaymentFlow !== 'function') {
        console.error('Airwallex SDK functions not properly loaded');
        Alert.alert(
          'Payment Error', 
          'Payment system is not available. Please try again later or contact support.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
        return;
      }
      
      // Step 1: Initialize Airwallex SDK only
      console.log('Payment intent created successfully:', paymentIntent);
      console.log('Payment intent ID:', paymentIntent.data?.id);
      console.log('Client secret exists:', !!paymentIntent.data?.client_secret);
      
      console.log('Step 1: Initializing Airwallex SDK...');
      try {
        await initialize({
          enableLogging: true
        });
        console.log('✅ Step 1 SUCCESS: Airwallex SDK initialized successfully');
         
         // Step 2: Present the entire payment flow
         console.log('Step 2: Presenting payment flow...');
         
         if (!paymentIntent.data || !paymentIntent.data.id || !paymentIntent.data.client_secret) {
           throw new Error('Invalid payment intent data');
         }
         
         // Create PaymentSession object according to Airwallex documentation
         const session = {
           type: 'OneOff',
           paymentIntentId: paymentIntent.data.id,
           currency: orderData.currency.toUpperCase(),
           countryCode: 'HK',
           amount: orderData.amount,
           isBillingRequired: false,
           isEmailRequired: false,
           paymentMethods: ['card', 'alipay', 'alipayhk', 'wechatpay', 'googlepay', 'applepay'],
           clientSecret: paymentIntent.data.client_secret
         };
         
         console.log('Payment session created:', session);
         
         const result = await presentEntirePaymentFlow(session);
         
         console.log('✅ Step 2 SUCCESS: Payment flow completed:', result);
         
         // Handle payment result
         if (result.status === 'success') {
           console.log('Payment successful, navigating to success screen');
           navigation.navigate('PaymentSuccess', {
             paymentIntentId: paymentIntent.data.id,
             amount: orderData.amount,
             currency: orderData.currency,
             orderData: orderData
           });
         } else {
           console.log('Payment failed or cancelled:', result);
           Alert.alert(
             'Payment Status',
             `Payment ${result.status}: ${result.message || 'Please try again'}`,
             [{ text: 'OK', onPress: () => navigation.goBack() }]
           );
         }
      } catch (initError) {
        console.error('❌ Step 1 FAILED: SDK initialization error:', initError);
        
        // Check if it's an authentication error
        const isAuthError = initError.message && initError.message.includes('Access denied, authentication failed');
        
        Alert.alert(
          isAuthError ? '🔐 Authentication Required' : 'Payment System Error',
          isAuthError 
            ? 'Airwallex sandbox credentials are required for payments.\n\n📋 Setup Steps:\n1. Create account at airwallex.com\n2. Generate sandbox API keys\n3. Configure backend credentials\n4. Set useTestMode = false\n\n💡 Current: Test mode with mock data'
            : `SDK initialization failed: ${initError.message || initError}`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
        return;
      }
    } catch (error) {
      console.error('Payment error:', error);
      Alert.alert('Error', 'Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };



  const formatAmount = (amount) => {
    return `${amount}.00 HKD`;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Payment</Text>
          <View style={styles.placeholder} />
        </View>
      </SafeAreaView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Order Summary */}
        <View style={styles.orderSummaryContainer}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          
          <View style={styles.orderItem}>
            <Text style={styles.orderItemName}>{orderData.name}</Text>
            <Text style={styles.orderItemPrice}>
              {formatAmount(orderData.amount)} HKD
            </Text>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.totalContainer}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>
              {formatAmount(orderData.amount - (orderData.discount || 0))} HKD
            </Text>
          </View>
        </View>

        {/* Payment Methods Available */}
        <View style={styles.paymentMethodsContainer}>
          <Text style={styles.sectionTitle}>Payment Methods Available</Text>
          
          <View style={styles.paymentMethodsList}>
            <View style={styles.paymentMethodRow}>
              <View style={styles.paymentMethodIcon}>
                <Icon name="card" size={20} color="#2274F0" />
              </View>
              <Text style={styles.paymentMethodText}>Credit/Debit Cards</Text>
            </View>
            
            <View style={styles.paymentMethodRow}>
              <View style={styles.paymentMethodIcon}>
                <Text style={styles.paymentMethodEmoji}>💳</Text>
              </View>
              <Text style={styles.paymentMethodText}>Alipay</Text>
            </View>
            
            <View style={styles.paymentMethodRow}>
              <View style={styles.paymentMethodIcon}>
                <Text style={styles.paymentMethodEmoji}>🏦</Text>
              </View>
              <Text style={styles.paymentMethodText}>Alipay HK</Text>
            </View>
            
            <View style={styles.paymentMethodRow}>
              <View style={styles.paymentMethodIcon}>
                <Text style={styles.paymentMethodEmoji}>💬</Text>
              </View>
              <Text style={styles.paymentMethodText}>WeChat Pay</Text>
            </View>
            
            <View style={styles.paymentMethodRow}>
              <View style={styles.paymentMethodIcon}>
                <Text style={styles.paymentMethodEmoji}>📱</Text>
              </View>
              <Text style={styles.paymentMethodText}>Google Pay & Apple Pay</Text>
            </View>
          </View>
          
          <View style={styles.securityInfo}>
            <Icon name="shield-checkmark" size={16} color="#4CAF50" />
            <Text style={styles.securityText}>
              Your payment information is encrypted and secure
            </Text>
          </View>
        </View>

        {/* Currency Info */}
        <View style={styles.currencyContainer}>
          <Text style={styles.currencyTitle}>Currency: Hong Kong Dollar (HKD)</Text>
          <Text style={styles.currencyDescription}>
            All amounts are processed in HKD using Airwallex secure payment gateway
          </Text>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.payButton, (loading || !paymentIntent) && styles.disabledButton]}
          onPress={handlePayment}
          disabled={loading || !paymentIntent}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.payButtonText}>
              Pay {formatAmount(orderData.amount)}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  safeArea: {
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  orderSummaryContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  orderItemName: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  orderItemPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 16,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2274F0',
  },
  paymentMethodsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  paymentMethodsList: {
    marginBottom: 16,
  },
  paymentMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    marginBottom: 8,
  },
  paymentMethodIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  paymentMethodEmoji: {
    fontSize: 16,
  },
  paymentMethodText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: 8,
  },
  securityText: {
    fontSize: 14,
    color: '#4CAF50',
    marginLeft: 8,
    fontWeight: '500',
  },
  currencyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  currencyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  currencyDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  footer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  payButton: {
    backgroundColor: '#2274F0',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2274F0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledButton: {
    backgroundColor: '#A0A0A0',
    shadowOpacity: 0,
    elevation: 0,
  },
  payButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default AirwallexPaymentScreen;