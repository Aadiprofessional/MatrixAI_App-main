import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../context/LanguageContext';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator, 
  Alert,
  SafeAreaView,
  Dimensions,
  TextInput,
  ToastAndroid,
  Platform,
  DeviceEventEmitter,
  BackHandler,
  Image
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { authenticate, createPaymentIntent, confirmSubscriptionPurchase, processCardPayment, createTransfer, testConnection } from '../../utils/airwallexApi';
import { useAirwallex } from '../../components/AirwallexProvider';

const { width } = Dimensions.get('window');

// Check if we're in mock mode - import this from airwallexApi
const USE_MOCK_MODE = false; // Should match the value in airwallexApi.js

const AirwallexPaymentScreen = ({ navigation, route }) => {
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
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCVC, setCardCVC] = useState('');
  const [cardHolderName, setCardHolderName] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [cardValid, setCardValid] = useState(false);
  const [initializingAirwallex, setInitializingAirwallex] = useState(true);
  const [airwallexError, setAirwallexError] = useState(null);
  const { initialized, initializing, error, initializeAirwallex } = useAirwallex();
  
  // Add useEffect to handle back button and cleanup 
  useEffect(() => {
    // Block back button during processing
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (processing) {
        Alert.alert(
          "Processing Payment",
          "Please wait while your payment is being processed.",
          [{ text: "OK" }]
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
    if (paymentSuccess && successData) {
      // Navigate immediately instead of waiting for countdown
      try {
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
  }, [paymentSuccess, successData]);

  // Function to handle actual navigation - separated to isolate errors
  const handleActualNavigation = () => {
    if (!successData) return;
    
    console.log('Navigating to success screen with data:', successData);
    
    // Use navigation.navigate instead of replace to ensure proper stack management
    // and to prevent the user from getting stuck in a screen with no back button
    navigation.navigate('PaymentSuccessScreen', successData);
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
      id: 'alipay',
      name: 'Alipay HK',
      icon: 'alipay',
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
    },
    {
      id: 'octopus',
      name: 'Octopus',
      icon: 'credit-card-alt',
      iconType: 'FontAwesome',
      description: 'Pay with your Octopus card or O! ePay'
    },
    {
      id: 'virtual_card',
      name: 'Virtual Card',
      icon: 'credit-card',
      iconType: 'FontAwesome',
      description: 'Create a virtual card for this transaction'
    }
  ];

  const handleSelectPaymentMethod = (methodId) => {
    setSelectedPaymentMethod(methodId);
  };

  // Card validation functions
  const validateCardNumber = (cardNumber) => {
    // Remove spaces and special characters
    const cleanedCardNumber = cardNumber.replace(/\D/g, '');
    return cleanedCardNumber.length >= 13 && cleanedCardNumber.length <= 19;
  };

  const validateCardExpiry = (expiry) => {
    // Check MM/YY format
    const regex = /^(0[1-9]|1[0-2])\/([0-9]{2})$/;
    if (!regex.test(expiry)) return false;

    // Extract month and year
    const [month, year] = expiry.split('/');
    const currentYear = new Date().getFullYear() % 100; // Get last 2 digits
    const currentMonth = new Date().getMonth() + 1; // January is 0
    
    const expiryYear = parseInt(year, 10);
    const expiryMonth = parseInt(month, 10);

    // Check if card is expired
    if (expiryYear < currentYear || (expiryYear === currentYear && expiryMonth < currentMonth)) {
      return false;
    }

    return true;
  };

  const validateCVC = (cvc) => {
    // CVC is typically 3-4 digits
    return /^[0-9]{3,4}$/.test(cvc);
  };

  // Format card number as user types (add spaces every 4 digits)
  const formatCardNumber = (text) => {
    const cleanedText = text.replace(/\D/g, '');
    let formatted = '';
    
    for (let i = 0; i < cleanedText.length; i++) {
      if (i > 0 && i % 4 === 0) {
        formatted += ' ';
      }
      formatted += cleanedText[i];
    }
    
    return formatted;
  };

  // Format expiry as user types (add slash after 2 digits)
  const formatExpiry = (text) => {
    const cleanedText = text.replace(/\D/g, '');
    
    if (cleanedText.length >= 3) {
      return `${cleanedText.slice(0, 2)}/${cleanedText.slice(2, 4)}`;
    } else if (cleanedText.length === 2) {
      return `${cleanedText}/`;
    }
    
    return cleanedText;
  };

  // Handle card input changes
  const handleCardNumberChange = (text) => {
    const formatted = formatCardNumber(text);
    setCardNumber(formatted.slice(0, 19)); // Limit to 19 chars including spaces
  };

  const handleExpiryChange = (text) => {
    const formatted = formatExpiry(text);
    setCardExpiry(formatted.slice(0, 5)); // MM/YY format (5 chars)
  };

  const handleCVCChange = (text) => {
    const cleanedText = text.replace(/\D/g, '');
    setCardCVC(cleanedText.slice(0, 4)); // Limit to 4 digits
  };

  // Validate all card fields and update cardValid state
  const validateAllCardFields = () => {
    const isCardNumberValid = validateCardNumber(cardNumber);
    const isExpiryValid = validateCardExpiry(cardExpiry);
    const isCVCValid = validateCVC(cardCVC);
    const isNameValid = cardHolderName.trim().length > 0;
    
    const isValid = isCardNumberValid && isExpiryValid && isCVCValid && isNameValid;
    setCardValid(isValid);
    return isValid;
  };

  // Update card validity whenever any card field changes
  useEffect(() => {
    validateAllCardFields();
  }, [cardNumber, cardExpiry, cardCVC, cardHolderName]);

  // Common function for handling successful payment navigation to prevent code duplication
  const navigateToSuccessScreen = (methodName) => {
    console.log(`${methodName} payment successful - Preparing to navigate`);
    
    // Safety check to ensure we have valid plan details
    if (!planDetails) {
      console.error('Missing plan details for navigation');
      Alert.alert(t('paymentSuccessful'), t('paymentProcessedSuccessfully'));
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
    
    console.log('Setting payment success with data:', navigationData);
    
    // Update state to trigger the useEffect
    setSuccessData(navigationData);
    setPaymentSuccess(true);
    
    // Set a shorter countdown for better user experience
    setCountdown(5);
  };

  const handleCardPayment = async () => {
    try {
      setProcessing(true);
      console.log('Starting Airwallex card payment process');

      // Validate card details first
      if (!validateAllCardFields()) {
        throw new Error('Please check your card details and try again');
      }

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

      // First authenticate with Airwallex
      console.log('Authenticating with Airwallex');
      try {
        await authenticate();
      } catch (authError) {
        console.error('Authentication error:', authError);
        throw new Error('Failed to authenticate with payment provider');
      }

      // Create a payment intent with card holder name
      console.log('Creating payment intent with Airwallex');
      const paymentIntent = await createPaymentIntent(numericPrice, 'HKD', cardHolderName).catch(error => {
        console.error('Error creating payment intent:', error);
        if (error.message && error.message.includes('Network Error')) {
          throw new Error('Network connection issue. Please check your internet connection and try again.');
        }
        throw new Error('Failed to create payment. Please try again.');
      });
      
      if (!paymentIntent) {
        throw new Error('Payment service unavailable');
      }
      
      console.log('Payment intent created:', paymentIntent.id);
      
      // Process the card payment
      console.log('Processing card payment...');
      const cardDetails = {
        number: cardNumber.replace(/\s/g, ''), // Remove spaces
        expiry: cardExpiry,
        cvc: cardCVC,
        name: cardHolderName,
        amount: numericPrice,
        currency: 'HKD'
      };
      
      const paymentResult = await processCardPayment(paymentIntent.id, cardDetails).catch(error => {
        console.error('Error processing card payment:', error);
        throw new Error('Failed to process card payment. Please try again.');
      });
      
      if (!paymentResult || paymentResult.status !== 'succeeded') {
        throw new Error('Payment was not successful');
      }
      
      console.log('Card payment succeeded, confirming subscription purchase');
      
      // Prepare safe values for API call
      const safeUid = uid || 'unknown';
      const safePlan = plan || 'unknown';
      const safeCouponId = appliedCoupon && appliedCoupon.id ? appliedCoupon.id : "";
      const safePaymentId = paymentResult.id || 'unknown';
      
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
        console.log('Payment successful, preparing to navigate...');
        // Navigate with success
        navigateToSuccessScreen('Card');
      } else {
        console.warn('Subscription confirmation failed:', result?.message);
        Alert.alert(t('error'), result?.message || t('failedToProcessPayment'));
        setProcessing(false);
      }
    } catch (error) {
      console.error('Payment error:', error);
      let errorMessage = error.message || 'Something went wrong while processing your payment';
      
      // Handle specific error cases
      if (errorMessage.includes('UNAUTHORIZED')) {
        errorMessage = 'Payment service connection issue. Please try again later.';
      } else if (errorMessage.includes('Network Error') || errorMessage.includes('network')) {
        errorMessage = 'Network connection issue. Please check your internet connection and try again.';
      }
      
      Alert.alert(t('paymentError'), errorMessage);
      setProcessing(false);
    }
  };

  // Generic payment handler that processes payments for all other methods
  const handleGenericPayment = async (methodId, methodName) => {
    try {
      setProcessing(true);
      console.log(`Starting ${methodName} payment with Airwallex`);
      
      // Ensure finalPrice is a valid number
      const cleanPrice = String(finalPrice || "0").replace(/[^0-9.]/g, '');
      const numericPrice = parseFloat(cleanPrice);
      
      if (isNaN(numericPrice) || numericPrice <= 0) {
        throw new Error('Invalid price amount');
      }

      // Authenticate with Airwallex
      try {
        await authenticate();
      } catch (authError) {
        console.error('Authentication error:', authError);
        throw new Error('Failed to authenticate with payment provider');
      }

      // Create transfer for alternative payment methods
      console.log(`Creating ${methodName} transfer with Airwallex`);
      const transfer = await createTransfer(numericPrice, 'HKD', methodId.toUpperCase()).catch(error => {
        console.error(`Error creating ${methodName} transfer:`, error);
        if (error.message && error.message.includes('Network Error')) {
          throw new Error('Network connection issue. Please check your internet connection and try again.');
        }
        throw new Error(`Failed to initialize ${methodName} payment. Please try again.`);
      });
      
      if (!transfer) {
        throw new Error(`Failed to initialize ${methodName} payment`);
      }
      
      console.log(`${methodName} transfer created:`, transfer.id);
      
      // Simulate payment processing time for alternative methods
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check if transfer was successful
      if (transfer.status !== 'CONFIRMED' && transfer.status !== 'PENDING') {
        throw new Error(`${methodName} payment failed`);
      }
      
      console.log(`${methodName} payment processed successfully`);
      
      // Process subscription confirmation
      const safeUid = uid || 'unknown';
      const safePlan = plan || 'unknown';
      const safeCouponId = appliedCoupon && appliedCoupon.id ? appliedCoupon.id : "";
      const safePaymentId = transfer.id || 'unknown';
      
      const result = await confirmSubscriptionPurchase(
        safeUid,
        safePlan,
        numericPrice,
        safeCouponId,
        safePaymentId
      ).catch(error => {
        console.error('Subscription confirmation error:', error);
        return { success: false, message: `Failed to confirm ${methodName} subscription` };
      });
      
      if (result && result.success) {
        console.log(`${methodName} payment successful, preparing to navigate...`);
        navigateToSuccessScreen(methodName);
      } else {
        Alert.alert(t('paymentError'), result?.message || t('failedToProcessMethodPayment').replace('{method}', methodName));
        setProcessing(false);
      }
    } catch (error) {
      console.error(`${methodName} error:`, error);
      let errorMessage = error.message || `Something went wrong with ${methodName} payment`;
      
      // Handle specific error cases
      if (errorMessage.includes('UNAUTHORIZED')) {
        errorMessage = 'Payment service connection issue. Please try again later.';
      } else if (errorMessage.includes('Network Error') || errorMessage.includes('network')) {
        errorMessage = 'Network connection issue. Please check your internet connection and try again.';
      }
      
      Alert.alert('Payment Error', errorMessage);
      setProcessing(false);
    }
  };

  const handlePayNow = () => {
    if (!selectedPaymentMethod) {
      Alert.alert(t('paymentMethodRequired'), t('pleaseSelectPaymentMethod'));
      return;
    }

    console.log('Processing payment with method:', selectedPaymentMethod);
    
    // Ensure the system is ready
    if (!initialized) {
      console.log('Payment system not initialized, attempting to initialize...');
      initializeAirwallex().then(result => {
        if (result.success) {
          console.log('Initialization successful, proceeding with payment');
          processPaymentWithSelectedMethod();
        } else {
          Alert.alert(
            t('paymentError'), 
            t('somethingWentWrongPayment'),
            [{ text: t('ok') }]
          );
        }
      });
    } else {
      processPaymentWithSelectedMethod();
    }
  };
  
  // Helper function to process payment based on selected method
  const processPaymentWithSelectedMethod = () => {
    // For card payment, validate card details
    if (selectedPaymentMethod === 'card') {
      if (!validateAllCardFields()) {
        Alert.alert(t('invalidCardDetails'), t('pleaseCheckCardInfo'));
        return;
      }
      
      handleCardPayment();
      return;
    }

    // Handle different payment methods
    switch (selectedPaymentMethod) {
      case 'alipay':
        handleGenericPayment('alipay', 'Alipay HK');
        break;
      case 'wechat':
        handleGenericPayment('wechat', 'WeChat Pay HK');
        break;
      case 'fps':
        handleGenericPayment('fps', 'FPS / PayMe');
        break;
      case 'octopus':
        handleGenericPayment('octopus', 'Octopus');
        break;
      case 'virtual_card':
        handleGenericPayment('virtual_card', 'Virtual Card');
        break;
      default:
        // Fallback to any payment method as mock
        console.log('No specific payment handler for', selectedPaymentMethod, 'using generic payment');
        handleGenericPayment(selectedPaymentMethod, 'Payment');
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
          <TextInput
            style={styles.cardHolderInput}
            placeholder="1234 5678 9012 3456"
            placeholderTextColor="#999"
            value={cardNumber}
            onChangeText={handleCardNumberChange}
            keyboardType="numeric"
            maxLength={19} // 16 digits + 3 spaces
          />
        </View>
        
        <View style={styles.cardDetailRow}>
          <View style={[styles.cardInputField, { flex: 1, marginRight: 10 }]}>
            <Text style={styles.cardInputFieldLabel}>{t('expiryDate')}</Text>
            <TextInput
              style={styles.cardHolderInput}
              placeholder={t('mmYY')}
              placeholderTextColor="#999"
              value={cardExpiry}
              onChangeText={handleExpiryChange}
              keyboardType="numeric"
              maxLength={5} // MM/YY
            />
          </View>
          
          <View style={[styles.cardInputField, { flex: 1 }]}>
            <Text style={styles.cardInputFieldLabel}>{t('cvc')}</Text>
            <TextInput
              style={styles.cardHolderInput}
              placeholder="123"
              placeholderTextColor="#999"
              value={cardCVC}
              onChangeText={handleCVCChange}
              keyboardType="numeric"
              maxLength={4}
              secureTextEntry={true}
            />
          </View>
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

  // Initialize Airwallex when the component mounts
  useEffect(() => {
    const initPaymentSystem = async () => {
      setInitializingAirwallex(true);
      try {
        if (!initialized) {
          console.log('Initializing Airwallex payment system...');
          const result = await initializeAirwallex();
          
          if (!result.success) {
            console.error('Failed to initialize Airwallex:', result.error || 'Unknown error');
            setAirwallexError(result.error || 'Failed to initialize payment system');
          } else {
            console.log('Airwallex initialized successfully');
          }
        }
      } catch (err) {
        console.error('Error initializing Airwallex:', err);
        setAirwallexError('Failed to initialize payment system. Please try again.');
      } finally {
        setInitializingAirwallex(false);
      }
    };

    initPaymentSystem();
  }, [initialized, initializeAirwallex]);

  // Show loading state while initializing Airwallex
  if (initializingAirwallex) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2274F0" />
        <Text style={{ marginTop: 10, color: '#666', textAlign: 'center' }}>
          Initializing payment system...
        </Text>
      </View>
    );
  }

  // Show error if Airwallex initialization failed
  if (airwallexError || error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Icon name="alert-circle" size={50} color="#e74c3c" />
        <Text style={{ marginTop: 10, fontSize: 18, fontWeight: 'bold', textAlign: 'center' }}>
          Payment System Error
        </Text>
        <Text style={{ marginTop: 10, color: '#666', textAlign: 'center' }}>
          {airwallexError || error}
        </Text>
        <TouchableOpacity 
          style={{ 
            marginTop: 20, 
            backgroundColor: '#2274F0', 
            paddingVertical: 12, 
            paddingHorizontal: 20, 
            borderRadius: 8 
          }}
          onPress={() => navigation.goBack()}
        >
          <Text style={{ color: 'white', fontWeight: 'bold' }}>Go Back</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={{ 
            marginTop: 10, 
            paddingVertical: 12, 
            paddingHorizontal: 20, 
            borderRadius: 8 
          }}
          onPress={() => {
            setAirwallexError(null);
            const initPaymentSystem = async () => {
              setInitializingAirwallex(true);
              try {
                const result = await initializeAirwallex();
                if (!result.success) {
                  setAirwallexError(result.error || 'Failed to initialize payment system');
                }
              } catch (err) {
                setAirwallexError('Failed to initialize payment system. Please try again.');
              } finally {
                setInitializingAirwallex(false);
              }
            };
            initPaymentSystem();
          }}
        >
          <Text style={{ color: '#2274F0', fontWeight: 'bold' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Function to test Airwallex connection
  const testAirwallexConnection = async () => {
    try {
      console.log('Testing Airwallex connection...');
      setProcessing(true);
      
      const result = await testConnection();
      
      if (result.success) {
        Alert.alert(
          t('success'), 
          `${result.message}\n\n${USE_MOCK_MODE ? '🔧 Currently in DEMO MODE' : '🔴 Live API Mode'}\n\nBalances: ${result.balances ? JSON.stringify(result.balances, null, 2) : 'N/A'}`,
          [{ text: t('ok') }]
        );
      } else {
        Alert.alert(
          t('error'), 
          `${result.message}\n\n${USE_MOCK_MODE ? '🔧 Currently in DEMO MODE' : '🔴 Live API Mode'}`,
          [{ text: t('ok') }]
        );
      }
    } catch (error) {
      Alert.alert(
        t('error'), 
        `Error: ${error.message}\n\n${USE_MOCK_MODE ? '🔧 Currently in DEMO MODE' : '🔴 Live API Mode'}`,
        [{ text: t('ok') }]
      );
    } finally {
      setProcessing(false);
    }
  };

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
          <TouchableOpacity
            style={styles.testButton}
            onPress={testAirwallexConnection}
          >
            <Icon name="checkmark-circle" size={24} color="#FFF" />
          </TouchableOpacity>
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
                <Text style={styles.summaryLabel}>{t('discount')}:</Text>
                <Text style={styles.discountValue}>{discount}%</Text>
              </View>
            )}
            
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>{t('totalCoins')}:</Text>
              <Text style={styles.totalValue}>{finalPrice} HKD</Text>
            </View>
          </View>

          {/* Airwallex Badge */}
          <View style={styles.airwallexBadge}>
            <Text style={styles.poweredByText}>{t('poweredBy')}</Text>
            <Text style={styles.airwallexText}>AIRWALLEX</Text>
            {USE_MOCK_MODE && (
              <View style={styles.mockModeIndicator}>
                <Text style={styles.mockModeText}>DEMO MODE</Text>
              </View>
            )}
            <Text style={styles.securePaymentText}>{t('secureGlobalPayments')}</Text>
          </View>

          {/* Payment Methods Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('selectPaymentMethod')}</Text>
            
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
              <Text style={styles.payButtonText}>{t('payNow')}</Text>
            )}
          </TouchableOpacity>
          
          {/* Security Notice */}
          <View style={styles.securityNotice}>
            <Icon name="lock-closed" size={20} color="#FFF" />
            <Text style={styles.securityText}>
              {t('allPaymentsSecureEncrypted')}
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
    textAlign: 'center',
    alignSelf: 'center',
  },
  testButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
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
  airwallexBadge: {
    alignItems: 'center',
    marginBottom: 20,
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 10,
  },
  poweredByText: {
    fontSize: 12,
    color: '#666',
  },
  airwallexText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0066cc',
    letterSpacing: 1,
  },
  mockModeIndicator: {
    backgroundColor: '#FF6600',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginTop: 5,
    marginBottom: 3,
  },
  mockModeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFF',
  },
  securePaymentText: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
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
  cardDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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

export default AirwallexPaymentScreen;