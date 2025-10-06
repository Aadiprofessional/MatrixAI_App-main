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
  Dimensions,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import airwallexService from '../../services/airwallexService';
import AirwallexNative from '../../services/airwallexNative';
import paymentAttemptTracker from '../../services/paymentAttemptTracker';
import { useAuth } from '../../context/AuthContext';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const AirwallexPaymentScreen = ({ route, navigation }) => {
  const { orderData } = route.params;
  const { uid } = useAuth();
  const [loading, setLoading] = useState(true);
  const [paymentIntent, setPaymentIntent] = useState(null);
  const [error, setError] = useState(null);
  const [sdkInitialized, setSdkInitialized] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockInfo, setBlockInfo] = useState(null);
  const [attemptStatus, setAttemptStatus] = useState(null);

  useEffect(() => {
    checkPaymentBlockStatus();
  }, []);

  const checkPaymentBlockStatus = async () => {
    try {
      // Record navigation attempt (opening the payment screen)
      await paymentAttemptTracker.recordNavigationAttempt(uid);
      
      const blockStatus = await paymentAttemptTracker.isUserBlocked(uid);
      const attemptStatus = await paymentAttemptTracker.getAttemptStatus(uid);
      
      setIsBlocked(blockStatus.isBlocked);
      setBlockInfo(blockStatus);
      setAttemptStatus(attemptStatus);
      
      if (blockStatus.isBlocked) {
        setLoading(false);
        Alert.alert(
          'Payment Temporarily Blocked',
          `You have exceeded the maximum number of payment attempts. Please try again in ${blockStatus.remainingMinutes} minutes.`,
          [
            { text: 'OK', onPress: () => navigation.goBack() }
          ]
        );
      } else {
        initializeSDKAndCreatePayment();
      }
    } catch (error) {
      console.error('Error checking payment block status:', error);
      initializeSDKAndCreatePayment();
    }
  };

  const initializeSDKAndCreatePayment = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔄 Initializing Airwallex SDK...');
      
      // Initialize Airwallex SDK
      await AirwallexNative.initialize('demo', true);
      setSdkInitialized(true);
      console.log('✅ Airwallex SDK initialized successfully');
      
      console.log('🔄 Creating payment intent for order:', orderData);
      
      // Extract numeric value from amount
      const numericAmount = typeof orderData.amount === 'string' 
        ? parseFloat(orderData.amount.replace(/[^0-9.]/g, ''))
        : orderData.amount;
      
      const paymentResponse = await airwallexService.createPaymentIntent({
        amount: Math.round(numericAmount),
        currency: orderData.currency || 'HKD',
        merchantOrderId: airwallexService.generateMerchantOrderId(`${orderData.type}_${orderData.planId || orderData.addonId || 'unknown'}`),
        returnUrl: 'matrixai://payment/result',
        uid: uid || 'anonymous_user',
        plan: orderData.name,
      });
      
      if (!paymentResponse.success) {
        throw new Error(paymentResponse.error || 'Failed to create payment intent');
      }
      
      console.log('✅ Payment intent created successfully:', paymentResponse);
      console.log('🔍 Payment intent data structure:', JSON.stringify(paymentResponse.data, null, 2));
      setPaymentIntent(paymentResponse);
      
    } catch (error) {
      console.error('❌ Error initializing SDK or creating payment intent:', error);
      setError(error.message || 'Failed to initialize payment system');
      Alert.alert(
        'Payment Error', 
        error.message || 'Failed to initialize payment system. Please try again.',
        [
          { text: 'Retry', onPress: initializeSDKAndCreatePayment },
          { text: 'Cancel', onPress: () => navigation.goBack() }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!paymentIntent || !paymentIntent.data) {
      Alert.alert('Error', 'Payment intent not created');
      return;
    }

    if (!sdkInitialized) {
      Alert.alert('Error', 'Payment system not initialized. Please try again.');
      return;
    }

    try {
      setLoading(true);
      
      const paymentIntentId = paymentIntent.data?.id || paymentIntent.data?.payment_intent_id;
      const clientSecret = paymentIntent.data?.client_secret;
      const numericAmount = typeof orderData.amount === 'string' 
        ? parseFloat(orderData.amount.replace(/[^0-9.]/g, ''))
        : orderData.amount;
      
      console.log('🚀 Starting Airwallex SDK payment flow...');
      console.log('Payment Intent ID:', paymentIntentId);
      console.log('Amount:', numericAmount);
      console.log('Currency:', orderData.currency || 'HKD');
      
      // Use Airwallex SDK to present payment flow
      const result = await AirwallexNative.presentEntirePaymentFlow(
        clientSecret,
        paymentIntentId,
        numericAmount,
        orderData.currency || 'HKD'
      );
      
      console.log('✅ Payment flow completed:', result);
      
      // Handle payment result
      if (result && result.status === 'success') {
        // Record successful payment and reset attempts
        await paymentAttemptTracker.recordSuccessfulPayment(uid);
        
        Alert.alert(
          'Payment Successful',
          'Your payment has been processed successfully!',
          [
            {
              text: 'OK',
              onPress: () => {
                // Navigate to success screen or back to previous screen
                navigation.navigate('PaymentSuccessScreen', {
                  paymentResult: result,
                  orderData: orderData
                });
              }
            }
          ]
        );
      } else {
        // Record failed payment attempt
        const newAttemptStatus = await paymentAttemptTracker.recordFailedAttempt(uid);
        
        // Handle payment failure or cancellation
        let errorMessage = result?.error || 'Payment was cancelled or failed';
        
        if (newAttemptStatus.failedAttempts >= 3) {
          errorMessage += `\n\nYou have reached the maximum number of payment attempts (${newAttemptStatus.failedAttempts}/3). You will be blocked from making payments for 30 minutes.`;
        } else {
          errorMessage += `\n\nAttempts: ${newAttemptStatus.failedAttempts}/3`;
        }
        
        Alert.alert(
          'Payment Failed',
          errorMessage,
          [
            { 
              text: 'Try Again', 
              onPress: newAttemptStatus.failedAttempts < 3 ? handlePayment : undefined,
              style: newAttemptStatus.failedAttempts >= 3 ? 'cancel' : 'default'
            },
            { 
              text: 'Cancel', 
              onPress: () => {
                if (newAttemptStatus.failedAttempts >= 3) {
                  navigation.goBack();
                } else {
                  navigation.goBack();
                }
              }
            }
          ]
        );
      }
      
    } catch (error) {
      console.error('❌ Payment error:', error);
      
      // Record failed payment attempt for errors too
      const newAttemptStatus = await paymentAttemptTracker.recordFailedAttempt(uid);
      
      let alertMessage = error.message || 'Payment failed. Please try again.';
      
      if (newAttemptStatus.failedAttempts >= 3) {
        alertMessage += `\n\nYou have reached the maximum number of payment attempts (${newAttemptStatus.failedAttempts}/3). You will be blocked from making payments for 30 minutes.`;
      } else {
        alertMessage += `\n\nAttempts: ${newAttemptStatus.failedAttempts}/3`;
      }
      
      Alert.alert(
        'Payment Error',
        alertMessage,
        [
          { 
            text: 'Try Again', 
            onPress: newAttemptStatus.failedAttempts < 3 ? handlePayment : undefined,
            style: newAttemptStatus.failedAttempts >= 3 ? 'cancel' : 'default'
          },
          { 
            text: 'Cancel', 
            onPress: () => {
              if (newAttemptStatus.failedAttempts >= 3) {
                navigation.goBack();
              } else {
                navigation.goBack();
              }
            }
          }
        ]
      );
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
        {/* Blocked Status Warning */}
        {isBlocked && blockInfo && (
          <View style={styles.blockedContainer}>
            <Icon name="warning" size={24} color="#FF6B6B" />
            <View style={styles.blockedTextContainer}>
              <Text style={styles.blockedTitle}>Payment Temporarily Blocked</Text>
              <Text style={styles.blockedMessage}>
                You have exceeded the maximum number of payment attempts. 
                Please try again in {blockInfo.remainingMinutes} minutes.
              </Text>
            </View>
          </View>
        )}

        {/* Attempt Status Info */}
        {!isBlocked && attemptStatus && (attemptStatus.failedAttempts > 0 || attemptStatus.navigationAttempts > 0) && (
          <View style={styles.attemptWarningContainer}>
            <Icon name="information-circle" size={20} color="#FF9500" />
            <View style={styles.attemptWarningTextContainer}>
              {attemptStatus.failedAttempts > 0 && (
                <Text style={styles.attemptWarningText}>
                  Failed payment attempts: {attemptStatus.failedAttempts}/3
                  {attemptStatus.failedAttempts >= 2 && " - Be careful!"}
                </Text>
              )}
              {attemptStatus.navigationAttempts > 0 && !attemptStatus.hasSuccessfulPayment && (
                <Text style={styles.attemptWarningText}>
                  Screen visits without payment: {attemptStatus.navigationAttempts}/3
                  {attemptStatus.navigationAttempts >= 2 && " - Complete a payment to reset!"}
                </Text>
              )}
            </View>
          </View>
        )}

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

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={initializeSDKAndCreatePayment}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {paymentIntent && (
          <View style={styles.paymentInfo}>
            <Text style={styles.sectionTitle}>Payment Details</Text>
            <Text style={styles.paymentId}>Payment ID: {paymentIntent.data.id}</Text>
            <Text style={styles.paymentStatus}>Status: {paymentIntent.data.status}</Text>
            
            <View style={styles.securityInfo}>
              <Icon name="shield-checkmark" size={20} color="#4CAF50" />
              <Text style={styles.securityText}>Secured by Airwallex</Text>
            </View>
          </View>
        )}

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
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 4,
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
  errorContainer: {
    backgroundColor: '#ffebee',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
    marginBottom: 8,
  },
  retryButton: {
    backgroundColor: '#f44336',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  paymentInfo: {
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
  paymentId: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  paymentStatus: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
    marginBottom: 12,
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
  blockedContainer: {
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B6B',
  },
  blockedTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  blockedTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#D32F2F',
    marginBottom: 4,
  },
  blockedMessage: {
    fontSize: 14,
    color: '#D32F2F',
    lineHeight: 20,
  },
  attemptWarningContainer: {
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#FF9500',
  },
  attemptWarningTextContainer: {
    flex: 1,
    marginLeft: 8,
  },
  attemptWarningText: {
    fontSize: 14,
    color: '#E65100',
    lineHeight: 18,
    marginBottom: 2,
  },
});

export default AirwallexPaymentScreen;