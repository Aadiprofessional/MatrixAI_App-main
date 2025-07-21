import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Image, 
  ActivityIndicator, 
  Alert,
  SafeAreaView,
  Dimensions,
  TextInput,
  ToastAndroid,
  Platform,
  DeviceEventEmitter,
  BackHandler
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useStripe, CardField, CardFieldInput } from '@stripe/stripe-react-native';
import { createPaymentIntent, confirmSubscriptionPurchase } from '../../utils/stripeApi';

const { width } = Dimensions.get('window');

const PaymentScreen = ({ navigation, route }) => {
  const { t } = useTranslation();
  const { 
    uid, 
    plan, 
    planDetails, 
    finalPrice, 
    discount, 
    appliedCoupon, 
    startDate: serializedStartDate, 
    endDate: serializedEndDate
  } = route.params;

  // Parse the serialized dates back to Date objects
  const startDate = new Date(serializedStartDate);
  const endDate = new Date(serializedEndDate);

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('card');
  const [processing, setProcessing] = useState(false);
  const [cardDetails, setCardDetails] = useState(null);
  const [cardValid, setCardValid] = useState(false);
  const [cardHolderName, setCardHolderName] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [countdown, setCountdown] = useState(0);
  
  const { confirmPayment } = useStripe();

  // Add useEffect to handle back button and cleanup 
  useEffect(() => {
    // Block back button during processing
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (processing) {
        Alert.alert(
          t('processingPayment'),
          t('pleaseWaitPaymentProcessing'),
          [{ text: t('ok') }]
        );
        return true; // Prevent default behavior
      }
      return false; // Let default behavior happen
    });
    
    // Clean up
    return () => {
      backHandler.remove();
    };
  }, [processing]);

  // Effect to handle payment success state
  useEffect(() => {
    if (paymentSuccess && successData) {
      // Set a countdown timer display
      setCountdown(10);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      // Clean up timer
      return () => clearInterval(timer);
    }
  }, [paymentSuccess, successData]);

  // Effect to navigate when countdown reaches 0
  useEffect(() => {
    if (paymentSuccess && countdown === 0 && successData) {
      try {
        // Try native navigation
        handleActualNavigation();
      } catch (e) {
        console.error("Navigation error:", e);
        // As a last resort, emit an event that can be caught by the app
        DeviceEventEmitter.emit('PAYMENT_SUCCESS', successData);
        
        // Force return to previous screen
        setTimeout(() => {
          try {
            navigation.goBack();
          } catch (navError) {
            console.error("Even goBack failed:", navError);
            Alert.alert(
              "Payment Successful",
              "Your payment was processed successfully but we couldn't navigate to the confirmation screen. Please check your purchase history."
            );
          }
        }, 1000);
      }
    }
  }, [countdown, paymentSuccess, successData]);

  // Function to handle actual navigation - separated to isolate errors
  const handleActualNavigation = () => {
    if (!successData) return;
    
    // Try to go to HomeScreen first
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }]
    });
    
    // After a delay try to navigate to success screen
    setTimeout(() => {
      navigation.navigate('PaymentSuccess', successData);
    }, 500);
  };

  // Payment methods data
  const paymentMethods = [
    {
      id: 'card',
      name: 'Credit/Debit Card',
      icon: 'credit-card',
      iconType: 'FontAwesome',
      description: 'Pay using Visa, Mastercard, or American Express'
    },
    {
      id: 'apple',
      name: 'Apple Pay',
      icon: 'apple',
      iconType: 'FontAwesome',
      description: 'Quick and secure payment with Apple Pay'
    },
    {
      id: 'octopus',
      name: 'Octopus',
      icon: 'credit-card-alt',
      iconType: 'FontAwesome',
      description: 'Pay with your Octopus card or O! ePay'
    },
    {
      id: 'alipay',
      name: 'Alipay HK',
      icon: 'credit-card',
      iconType: 'custom',
      description: 'Pay with your Alipay Hong Kong account'
    },
    {
      id: 'wechat',
      name: 'WeChat Pay HK',
      icon: 'wechat',
      iconType: 'custom',
      description: 'Pay with your WeChat Pay Hong Kong'
    },
    {
      id: 'fps',
      name: 'FPS / PayMe',
      icon: 'money',
      iconType: 'FontAwesome',
      description: 'Pay via Faster Payment System or PayMe'
    }
  ];

  const handleSelectPaymentMethod = (methodId) => {
    setSelectedPaymentMethod(methodId);
  };

  const handleCardChange = (cardDetails) => {
    setCardDetails(cardDetails);
    setCardValid(cardDetails.complete);
  };

  // Common function for handling successful payment navigation to prevent code duplication
  const navigateToSuccessScreen = (methodName) => {
    console.log(`${methodName} payment successful - Preparing to navigate`);
    
    // Safety check to ensure we have valid plan details
    if (!planDetails) {
      console.error('Missing plan details for navigation');
      Alert.alert('Payment Successful', 'Your payment was processed successfully.');
      setProcessing(false);
      return;
    }
    
    // Show toast message for successful payment
    if (Platform.OS === 'android') {
      ToastAndroid.show('Payment successful! Processing your subscription...', ToastAndroid.LONG);
    }
    
    // Prepare safe navigation parameters
    const safePlanDetails = { 
      ...planDetails,
      title: planDetails?.title || 'Subscription'
    };
    
    const safeFinalPrice = `${finalPrice || '0'}`;
    const safeDiscount = discount > 0 ? `${discount}%` : null;
    const safeStartDate = startDate ? startDate.toLocaleDateString() : 'No date';
    const safeEndDate = endDate ? endDate.toLocaleDateString() : 'No date';
    
    // Set success data for later use
    const navigationData = {
      message: `Successfully purchased ${safePlanDetails.title}!`,
      planDetails: safePlanDetails,
      finalPrice: safeFinalPrice,
      discount: safeDiscount,
      startDate: safeStartDate,
      endDate: safeEndDate,
    };
    
    // Update state to trigger the useEffect
    setSuccessData(navigationData);
    setPaymentSuccess(true);
  };

  const handleCardPayment = async () => {
    try {
      setProcessing(true);
      console.log('Starting card payment process');

      // Debug price values first
      console.log('Original finalPrice:', finalPrice);
      
      // Ensure finalPrice is a valid number by removing any non-numeric chars except decimal
      const cleanPrice = String(finalPrice || "0").replace(/[^0-9.]/g, '');
      const numericPrice = parseFloat(cleanPrice);
      
      console.log('Cleaned price:', cleanPrice);
      console.log('Numeric price:', numericPrice);
      
      if (isNaN(numericPrice) || numericPrice <= 0) {
        throw new Error('Invalid price amount');
      }

      // Create a payment intent on the server
      console.log('Creating payment intent');
      const paymentIntent = await createPaymentIntent(numericPrice).catch(error => {
        console.error('Error creating payment intent:', error);
        throw new Error('Failed to create payment. Please try again.');
      });
      
      if (!paymentIntent) {
        throw new Error('Payment service unavailable');
      }
      
      if (paymentIntent.error) {
        console.error('Payment intent error:', paymentIntent.error);
        throw new Error(paymentIntent.error.message || 'Error creating payment');
      }

      console.log('Payment intent created:', paymentIntent.id);

      // Confirm the payment with the selected method
      console.log('Confirming card payment');
      const { error, paymentIntent: updatedPaymentIntent } = await confirmPayment(
        paymentIntent.client_secret,
        { 
          paymentMethodType: 'Card',
          paymentMethodData: {
            billingDetails: { name: cardHolderName || 'Customer' }
          }
        }
      ).catch(error => {
        console.error('Error confirming payment:', error);
        return { error: { message: 'Failed to process payment' } };
      });

      if (error) {
        console.error('Payment confirmation error:', error);
        throw new Error(error.message || 'Payment confirmation failed');
      }

      if (!updatedPaymentIntent) {
        throw new Error('Payment failed with no response');
      }

      console.log('Payment status:', updatedPaymentIntent.status);

      // If payment was successful, confirm subscription purchase
      if (updatedPaymentIntent.status === 'Succeeded') {
        console.log('Card payment succeeded, confirming subscription purchase');
        
        // Prepare safe values for API call
        const safeUid = uid || 'unknown';
        const safePlan = plan || 'unknown';
        const safeCouponId = appliedCoupon && appliedCoupon.id ? appliedCoupon.id : "";
        const safePaymentId = updatedPaymentIntent.id || 'unknown';
        
        console.log('Confirming subscription with:', { 
          uid: safeUid, 
          plan: safePlan, 
          price: numericPrice,
          couponId: safeCouponId,
          paymentId: safePaymentId
        });

        const result = await confirmSubscriptionPurchase(
          safeUid,
          safePlan,
          numericPrice,
          safeCouponId,
          safePaymentId
        ).catch(error => {
          console.error('Subscription confirmation error:', error);
          return { success: false, message: 'Failed to confirm subscription' };
        });

        console.log('Subscription confirmation result:', result);

        if (result && result.success) {
          // Don't set processing to false yet - will do it in navigateToSuccessScreen after delay
          console.log('Payment successful, preparing to navigate...');
          // Navigate with success
          navigateToSuccessScreen('Card');
        } else {
          console.warn('Subscription confirmation failed:', result?.message);
          Alert.alert(t('error'), result?.message || t('failedToProcessPayment'));
          setProcessing(false);
        }
      } else {
        console.warn('Payment was not successful:', updatedPaymentIntent?.status);
        throw new Error('Payment was not successful');
      }
    } catch (error) {
      console.error('Payment error:', error);
      Alert.alert(t('paymentError'), error.message || t('somethingWentWrongPayment'));
      setProcessing(false);
    }
  };

  // Implement Apple Pay payment
  const handleApplePayment = async () => {
    try {
      setProcessing(true);
      console.log('Starting Apple Pay payment');
      
      // Create a payment intent first (same as card payment)
      const cleanPrice = String(finalPrice || "0").replace(/[^0-9.]/g, '');
      const numericPrice = parseFloat(cleanPrice);
      
      if (isNaN(numericPrice) || numericPrice <= 0) {
        throw new Error('Invalid price amount');
      }

      // Create payment intent
      const paymentIntent = await createPaymentIntent(numericPrice);
      
      if (!paymentIntent || paymentIntent.error) {
        throw new Error(paymentIntent?.error?.message || 'Failed to initialize payment');
      }
      
      // Now we would typically implement Apple Pay specific handling here
      // For now, simulate successful payment to complete the flow
      console.log('Processing Apple Pay payment with intent:', paymentIntent.id);
      
      // Simulate payment confirmation delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Process subscription confirmation
      const safeUid = uid || 'unknown';
      const safePlan = plan || 'unknown';
      const safeCouponId = appliedCoupon && appliedCoupon.id ? appliedCoupon.id : "";
      const safePaymentId = paymentIntent.id || 'unknown';
      
      const result = await confirmSubscriptionPurchase(
        safeUid,
        safePlan,
        numericPrice,
        safeCouponId,
        safePaymentId
      );
      
      if (result && result.success) {
        console.log('Apple Pay payment successful, preparing to navigate...');
        // Don't set processing to false yet
        navigateToSuccessScreen('Apple Pay');
      } else {
        Alert.alert(t('paymentError'), result?.message || t('failedToProcessMethodPayment').replace('{method}', 'Apple Pay'));
        setProcessing(false);
      }
    } catch (error) {
      console.error('Apple Pay error:', error);
      Alert.alert('Payment Error', error.message || 'Something went wrong with Apple Pay');
      setProcessing(false);
    }
  };

  // Generic payment handler that processes payments for all other methods
  const handleGenericPayment = async (methodId, methodName) => {
    try {
      setProcessing(true);
      console.log(`Starting ${methodName} payment`);
      
      // Create a payment intent first (same across all payment methods)
      const cleanPrice = String(finalPrice || "0").replace(/[^0-9.]/g, '');
      const numericPrice = parseFloat(cleanPrice);
      
      if (isNaN(numericPrice) || numericPrice <= 0) {
        throw new Error('Invalid price amount');
      }

      // Create payment intent - in production you would customize this per payment method
      const paymentIntent = await createPaymentIntent(numericPrice);
      
      if (!paymentIntent || paymentIntent.error) {
        throw new Error(paymentIntent?.error?.message || `Failed to initialize ${methodName} payment`);
      }
      
      console.log(`Processing ${methodName} payment with intent:`, paymentIntent.id);
      
      // Simulate payment processing time 
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Process subscription confirmation
      const safeUid = uid || 'unknown';
      const safePlan = plan || 'unknown';
      const safeCouponId = appliedCoupon && appliedCoupon.id ? appliedCoupon.id : "";
      const safePaymentId = paymentIntent.id || 'unknown';
      
      const result = await confirmSubscriptionPurchase(
        safeUid,
        safePlan,
        numericPrice,
        safeCouponId,
        safePaymentId
      );
      
      if (result && result.success) {
        console.log(`${methodName} payment successful, preparing to navigate...`);
        // Don't set processing to false yet
        navigateToSuccessScreen(methodName);
      } else {
        Alert.alert(t('paymentError'), result?.message || t('failedToProcessMethodPayment').replace('{method}', methodName));
        setProcessing(false);
      }
    } catch (error) {
      console.error(`${methodName} error:`, error);
      Alert.alert(t('paymentError'), error.message || t('somethingWentWrongPayment'));
      setProcessing(false);
    }
  };

  const handlePayNow = () => {
    if (!selectedPaymentMethod) {
      Alert.alert(t('paymentMethodRequired'), t('pleaseSelectPaymentMethod'));
      return;
    }

    // For card payment, validate card details
    if (selectedPaymentMethod === 'card') {
      if (!cardDetails || !cardValid) {
        Alert.alert(t('invalidCard'), t('pleaseCheckCardInfo'));
        return;
      }
      
      if (!cardHolderName.trim()) {
        Alert.alert(t('cardHolderNameRequired'), t('pleaseEnterCardHolderName'));
        return;
      }
      
      handleCardPayment();
      return;
    }

    // Handle different payment methods
    switch (selectedPaymentMethod) {
      case 'apple':
        handleApplePayment();
        break;
      case 'octopus':
        handleGenericPayment('octopus', 'Octopus');
        break;
      case 'alipay':
        handleGenericPayment('alipay', 'Alipay HK');
        break;
      case 'wechat':
        handleGenericPayment('wechat', 'WeChat Pay HK');
        break;
      case 'fps':
        handleGenericPayment('fps', 'FPS / PayMe');
        break;
      default:
        Alert.alert(t('paymentMethodRequired'), t('pleaseSelectPaymentMethod'));
    }
  };

  const renderPaymentMethodIcon = (method) => {
    if (method.iconType === 'FontAwesome') {
      return <FontAwesome name={method.icon} size={30} color="#2274F0" />;
    } else if (method.iconType === 'MaterialIcons') {
      return <MaterialIcons name={method.icon} size={30} color="#2274F0" />;
    } else if (method.iconType === 'custom') {
      // For custom icons, use FontAwesome as fallback
      switch (method.id) {
        case 'alipay':
          // Use FontAwesome icon as fallback
          return <FontAwesome name="credit-card" size={30} color="#2274F0" />;
        case 'wechat':
          // Use FontAwesome icon as fallback
          return <FontAwesome name="wechat" size={30} color="#2274F0" />;
        default:
          return <FontAwesome name="credit-card" size={30} color="#2274F0" />;
      }
    } else {
      return <Icon name={method.icon} size={30} color="#2274F0" />;
    }
  };

  // Render card input form when card payment method is selected
  const renderCardInputForm = () => {
    if (selectedPaymentMethod !== 'card') return null;
    
    return (
      <View style={styles.cardInputContainer}>
        <Text style={styles.cardInputLabel}>{t('enterCardDetails')}</Text>
        
        <View style={styles.cardInputField}>
          <Text style={styles.cardInputFieldLabel}>{t('cardHolderName')}</Text>
          <TextInput
            style={styles.cardHolderInput}
            placeholder={t('enterNameOnCard')}
            placeholderTextColor="#999"
            value={cardHolderName}
            onChangeText={setCardHolderName}
          />
        </View>
        
        <View style={styles.cardInputField}>
          <Text style={styles.cardInputFieldLabel}>{t('cardNumber')}</Text>
          <CardField
            postalCodeEnabled={false}
            placeholder={{
              number: '4242 4242 4242 4242',
              expiration: t('mmYY'),
              cvc: t('cvc'),
            }}
            cardStyle={styles.cardStyle}
            style={styles.cardFieldContainer}
            onCardChange={handleCardChange}
          />
          <Text style={styles.cardFieldHint}>
            {cardValid ? 
              t('cardDetailsComplete') : 
              t('enterCardNumberExpiryAndCVC')}
          </Text>
        </View>
        
        <View style={styles.secureCardNotice}>
          <Icon name="shield-checkmark" size={16} color="#2274F0" />
          <Text style={styles.secureCardText}>{t('secureCardInfo')}</Text>
        </View>
      </View>
    );
  };

  // Render a payment method item with card form embedded beneath when selected
  const renderPaymentMethod = (method) => (
    <View key={method.id}>
      <TouchableOpacity
        style={[
          styles.paymentMethodCard,
          selectedPaymentMethod === method.id && styles.selectedPaymentMethod
        ]}
        onPress={() => handleSelectPaymentMethod(method.id)}
      >
        <View style={styles.paymentMethodIcon}>
          {renderPaymentMethodIcon(method)}
        </View>
        <View style={styles.paymentMethodDetails}>
          <Text style={styles.paymentMethodName}>{method.name}</Text>
          <Text style={styles.paymentMethodDescription}>{method.description}</Text>
        </View>
        <View style={styles.radioButton}>
          {selectedPaymentMethod === method.id && (
            <View style={styles.radioButtonInner} />
          )}
        </View>
      </TouchableOpacity>
      
      {/* Show card form immediately below the card payment method when selected */}
      {method.id === 'card' && selectedPaymentMethod === 'card' && renderCardInputForm()}
    </View>
  );

  return (
    <LinearGradient
      colors={['#2274F0', '#FF6600']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      locations={[0, 1]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header with Back Button */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Payment Method</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollViewContent}>
          {/* Order Summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Order Summary</Text>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Plan:</Text>
              <Text style={styles.summaryValue}>{planDetails.title}</Text>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Duration:</Text>
              <Text style={styles.summaryValue}>{planDetails.duration}</Text>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Coins:</Text>
              <Text style={styles.summaryValue}>{planDetails.coins}</Text>
            </View>
            
            {discount > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Discount:</Text>
                <Text style={styles.discountValue}>{discount}%</Text>
              </View>
            )}
            
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total:</Text>
              <Text style={styles.totalValue}>{finalPrice} HKD</Text>
            </View>
          </View>

          {/* Payment Methods Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Payment Method</Text>
            
            {paymentMethods.map(method => renderPaymentMethod(method))}
          </View>

          {/* Payment Button */}
          <TouchableOpacity
            style={[styles.payButton, processing && styles.disabledButton]}
            onPress={handlePayNow}
            disabled={processing}
          >
            {processing ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.payButtonText}>Pay Now</Text>
            )}
          </TouchableOpacity>
          
          {/* Security Notice */}
          <View style={styles.securityNotice}>
            <Icon name="lock-closed" size={20} color="#FFF" />
            <Text style={styles.securityText}>
              All payments are secure and encrypted
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Processing overlay with improved message */}
      {processing && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color="#FFF" />
          <Text style={styles.processingText}>
            {paymentSuccess 
              ? "Payment Successful!" 
              : "Processing your payment..."}
          </Text>
          {paymentSuccess ? (
            <>
              <Text style={styles.processingSubText}>
                Your subscription has been confirmed.
              </Text>
              <Text style={styles.countdownText}>
                Redirecting in {countdown} seconds...
              </Text>
            </>
          ) : (
            <Text style={styles.processingSubText}>
              Please wait while we confirm your transaction.
              This may take a few moments.
            </Text>
          )}
        </View>
      )}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  scrollViewContent: {
    flexGrow: 1,
    paddingBottom: 30,
  },
  summaryCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2274F0',
    marginBottom: 15,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 16,
    color: '#666',
  },
  summaryValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  discountValue: {
    fontSize: 16,
    color: '#28a745',
    fontWeight: '500',
  },
  totalRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF6600',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 15,
  },
  paymentMethodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  selectedPaymentMethod: {
    borderWidth: 2,
    borderColor: '#2274F0',
  },
  paymentMethodIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(34, 116, 240, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  customIcon: {
    width: 30,
    height: 30,
    resizeMode: 'contain',
  },
  paymentMethodDetails: {
    flex: 1,
  },
  paymentMethodName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  paymentMethodDescription: {
    fontSize: 14,
    color: '#777',
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#2274F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#2274F0',
  },
  // Card input styles
  cardInputContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    zIndex: 10,
  },
  cardInputLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2274F0',
    marginBottom: 15,
  },
  cardInputField: {
    marginBottom: 15,
  },
  cardInputFieldLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  cardHolderInput: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fff',
  },
  cardFieldContainer: {
    height: 50,
    marginVertical: 10,
    width: '100%',
  },
  cardStyle: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    fontSize: 16,
    color: '#333',
    textColor: '#000',
  },
  cardFieldHint: {
    fontSize: 12,
    color: '#777',
    marginTop: 5,
  },
  secureCardNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  secureCardText: {
    fontSize: 12,
    color: '#777',
    marginLeft: 5,
  },
  payButton: {
    backgroundColor: '#FF6600',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  payButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  securityText: {
    fontSize: 14,
    color: '#FFF',
    marginLeft: 8,
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  processingText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 20,
    marginBottom: 10,
  },
  processingSubText: {
    fontSize: 14,
    color: '#FFF',
    textAlign: 'center',
    paddingHorizontal: 30,
    opacity: 0.8,
  },
  countdownText: {
    fontSize: 16,
    color: '#FFF',
    textAlign: 'center',
    marginTop: 15,
    fontWeight: 'bold',
  },
});

export default PaymentScreen;