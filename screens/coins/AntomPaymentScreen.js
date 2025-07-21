import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  Platform,
  Image
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useAntom } from '../../components/AntomProvider';
import { 
  createPayment, 
  processCardPayment, 
  processWalletPayment,
  getPaymentStatus,
  confirmSubscriptionPurchase,
  confirmAddonPurchase,
  testConnection
} from '../../utils/antomApi';

const { width } = Dimensions.get('window');

const AntomPaymentScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { t } = useTranslation();
  const { 
    uid, 
    plan, 
    planDetails, 
    finalPrice, 
    discount, 
    appliedCoupon, 
    startDate: serializedStartDate, 
    endDate: serializedEndDate,
    addonId
  } = route.params || {};

  // Parse the serialized dates back to Date objects if they exist
  const startDate = serializedStartDate ? new Date(serializedStartDate) : null;
  const endDate = serializedEndDate ? new Date(serializedEndDate) : null;

  // Antom context for initialization
  const { initialized, initializing, error: antomError, initializeAntom } = useAntom();

  // Payment state
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('card');
  const [processing, setProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentRequestId, setPaymentRequestId] = useState(null);
  const [paymentUrl, setPaymentUrl] = useState(null);
  
  // Card details state
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCVC, setCardCVC] = useState('');
  const [cardHolderName, setCardHolderName] = useState('');
  const [cardValid, setCardValid] = useState(false);

  // Initialize Antom on component mount
  useEffect(() => {
    const initPaymentSystem = async () => {
      try {
        if (!initialized) {
          console.log('Initializing Antom payment system...');
          const result = await initializeAntom();
          
          if (!result.success) {
            console.error('Failed to initialize Antom:', result.error || 'Unknown error');
            setPaymentError(result.error || 'Failed to initialize payment system');
          } else {
            console.log('Antom initialized successfully');
          }
        }
      } catch (err) {
        console.error('Error initializing Antom:', err);
        setPaymentError(t('failedToProcessPayment'));
      }
    };

    initPaymentSystem();
  }, [initialized, initializeAntom]);

  // Payment methods
  const paymentMethods = [
    { id: 'card', name: 'Visa/Mastercard', icon: 'credit-card', iconType: 'FontAwesome' },
    { id: 'ALIPAY_HK', name: 'Alipay HK', icon: 'credit-card', iconType: 'custom' },
    { id: 'ALIPAY_CN', name: 'Alipay China', icon: 'credit-card', iconType: 'custom' },
  ];

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
    if (expiryYear < currentYear) return false;
    if (expiryYear === currentYear && expiryMonth < currentMonth) return false;
    
    return true;
  };

  const validateCVC = (cvc) => {
    // CVC should be 3 or 4 digits
    return /^[0-9]{3,4}$/.test(cvc);
  };

  const handleSelectPaymentMethod = (methodId) => {
    setSelectedPaymentMethod(methodId);
  };

  // Format card number with spaces (e.g., 4242 4242 4242 4242)
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

  // Format expiry date (MM/YY)
  const formatExpiry = (text) => {
    const cleanedText = text.replace(/\D/g, '');
    
    if (cleanedText.length <= 2) {
      return cleanedText;
    } else {
      return `${cleanedText.slice(0, 2)}/${cleanedText.slice(2, 4)}`;
    }
  };

  const handleCardNumberChange = (text) => {
    const formatted = formatCardNumber(text);
    setCardNumber(formatted.slice(0, 19)); // Limit to 19 chars including spaces
  };

  const handleExpiryChange = (text) => {
    const formatted = formatExpiry(text);
    setCardExpiry(formatted.slice(0, 5)); // MM/YY format (5 chars)
  };

  const handleCVCChange = (text) => {
    setCardCVC(text.replace(/\D/g, '').slice(0, 4)); // Limit to 4 digits
  };

  const validateAllCardFields = () => {
    const isCardNumberValid = validateCardNumber(cardNumber);
    const isExpiryValid = validateCardExpiry(cardExpiry);
    const isCVCValid = validateCVC(cardCVC);
    const isNameValid = cardHolderName.trim().length > 0;
    
    const isValid = isCardNumberValid && isExpiryValid && isCVCValid && isNameValid;
    setCardValid(isValid);
    return isValid;
  };

  // Handle card payment
  const handleCardPayment = async () => {
    try {
      setProcessing(true);
      setPaymentError(null);
      console.log('Starting Antom card payment process');

      // Validate card details first
      if (!validateAllCardFields()) {
        throw new Error('Please check your card details and try again');
      }

      // Ensure finalPrice is a valid number
      const cleanPrice = String(finalPrice || "0").replace(/[^0-9.]/g, '');
      const numericPrice = parseFloat(cleanPrice);
      
      if (isNaN(numericPrice) || numericPrice <= 0) {
        throw new Error('Invalid price amount');
      }

      // Step 1: Create payment request
      const paymentData = {
        planId: plan,
        addonId: addonId,
        amount: numericPrice,
        currency: 'HKD', // Using HKD currency
        paymentMethodType: 'CARD',
        orderDescription: addonId ? 'Addon Purchase' : 'Subscription Plan',
        redirectUrl: Platform.OS === 'web' ? window.location.origin + '/payment/success' : null
      };

      console.log('Creating payment with data:', paymentData);
      const paymentResponse = await createPayment(paymentData);
      console.log('Payment creation response:', paymentResponse);

      if (!paymentResponse || !paymentResponse.paymentRequestId) {
        throw new Error('Failed to create payment request');
      }

      // Save payment request ID
      setPaymentRequestId(paymentResponse.paymentRequestId);

      // Step 2: Process card payment
      const cardDetails = {
        cardNumber: cardNumber.replace(/\s/g, ''),
        cardExpiry,
        cardCVC,
        cardHolderName
      };

      console.log('Processing card payment for request:', paymentResponse.paymentRequestId);
      const processResponse = await processCardPayment(paymentResponse.paymentRequestId, cardDetails);
      console.log('Card payment process response:', processResponse);

      // Step 3: Check payment status
      const statusResponse = await getPaymentStatus(paymentResponse.paymentRequestId);
      console.log('Payment status response:', statusResponse);

      if (statusResponse.data.status === 'completed') {
        // Step 4: Confirm subscription or addon purchase
        if (plan) {
          await confirmSubscriptionPurchase(uid, plan, numericPrice, paymentResponse.paymentRequestId);
        } else if (addonId) {
          await confirmAddonPurchase(uid, addonId, numericPrice, paymentResponse.paymentRequestId);
        }

        setPaymentSuccess(true);
        Alert.alert(
          'Payment Successful', 
          'Your payment has been processed successfully.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else if (statusResponse.data.status === 'pending') {
        Alert.alert(
          'Payment Processing', 
          'Your payment is being processed. We will notify you once it is complete.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        throw new Error(`Payment failed: ${statusResponse.data.resultCode || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Card payment error:', err);
      setPaymentError(err.message || 'Payment processing failed. Please try again.');
      Alert.alert(t('paymentFailed'), err.message || t('paymentProcessingFailed'));
    } finally {
      setProcessing(false);
    }
  };

  // Handle wallet payments (GCASH, MAYA, etc.)
  const handleWalletPayment = async (methodId, methodName) => {
    try {
      setProcessing(true);
      setPaymentError(null);
      console.log(`Starting ${methodName} payment with Antom`);
      
      // Ensure finalPrice is a valid number
      const cleanPrice = String(finalPrice || "0").replace(/[^0-9.]/g, '');
      const numericPrice = parseFloat(cleanPrice);
      
      if (isNaN(numericPrice) || numericPrice <= 0) {
        throw new Error('Invalid price amount');
      }

      // Step 1: Create payment request
      const paymentData = {
        planId: plan,
        addonId: addonId,
        amount: numericPrice,
        currency: 'HKD', // Using HKD currency
        paymentMethodType: methodId,
        orderDescription: addonId ? 'Addon Purchase' : 'Subscription Plan',
        redirectUrl: Platform.OS === 'web' ? window.location.origin + '/payment/success' : null
      };

      console.log('Creating payment with data:', paymentData);
      const paymentResponse = await createPayment(paymentData);
      console.log('Payment creation response:', paymentResponse);

      if (!paymentResponse || !paymentResponse.paymentRequestId) {
        throw new Error('Failed to create payment request');
      }

      // Save payment request ID and payment URL
      setPaymentRequestId(paymentResponse.paymentRequestId);
      setPaymentUrl(paymentResponse.paymentUrl);

      // For mobile, we need to open the payment URL in a browser
      if (Platform.OS !== 'web' && paymentResponse.paymentUrl) {
        // Use Linking to open the URL in a browser
        const Linking = require('react-native').Linking;
        await Linking.openURL(paymentResponse.paymentUrl);
        
        // Show instructions to the user
        Alert.alert(
          t('completePayment', { method: methodName }), 
          t('completePaymentInBrowser'),
          [{ text: t('ok') }]
        );
      } else if (Platform.OS === 'web' && paymentResponse.redirectUrl) {
        // For web, redirect to the payment URL
        window.location.href = paymentResponse.redirectUrl;
      } else {
        throw new Error('No payment URL provided');
      }
    } catch (err) {
      console.error(`${methodId} payment error:`, err);
      setPaymentError(err.message || 'Payment processing failed. Please try again.');
      Alert.alert('Payment Failed', err.message || 'Payment processing failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handlePayNow = () => {
    if (!selectedPaymentMethod) {
      Alert.alert(t('paymentMethodRequired'), t('pleaseSelectPaymentMethod'));
      return;
    }

    // Process payment based on selected method
    if (selectedPaymentMethod === 'card') {
      if (!validateAllCardFields()) {
        Alert.alert(t('invalidCardDetails'), t('pleaseCheckCardInfo'));
        return;
      }
      
      handleCardPayment();
      return;
    }

    // Handle wallet payments
    const method = paymentMethods.find(m => m.id === selectedPaymentMethod);
    if (method) {
      handleWalletPayment(selectedPaymentMethod, method.name);
    } else {
      Alert.alert(t('invalidPaymentMethod'), t('paymentMethodNotSupported'));
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
        case 'ALIPAY_HK':
          return <FontAwesome name="credit-card" size={30} color="#2274F0" />;
        case 'ALIPAY_CN':
          return <FontAwesome name="credit-card" size={30} color="#2274F0" />;
        default:
          return <FontAwesome name="credit-card" size={30} color="#2274F0" />;
      }
    } else {
      return <FontAwesome name="credit-card" size={30} color="#2274F0" />;
    }
  };

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
            value={cardHolderName}
            onChangeText={setCardHolderName}
            autoCapitalize="words"
          />
        </View>
        
        <View style={styles.cardInputField}>
          <Text style={styles.cardInputFieldLabel}>{t('cardNumber')}</Text>
          <TextInput
            style={styles.cardNumberInput}
            placeholder="4242 4242 4242 4242"
            value={cardNumber}
            onChangeText={handleCardNumberChange}
            keyboardType="number-pad"
            maxLength={19} // 16 digits + 3 spaces
          />
        </View>
        
        <View style={styles.cardDetailsRow}>
          <View style={[styles.cardInputField, { flex: 1, marginRight: 10 }]}>
            <Text style={styles.cardInputFieldLabel}>{t('expiryDate')}</Text>
            <TextInput
              style={styles.cardExpiryInput}
              placeholder={t('mmYY')}
              value={cardExpiry}
              onChangeText={handleExpiryChange}
              keyboardType="number-pad"
              maxLength={5} // MM/YY format
            />
          </View>
          
          <View style={[styles.cardInputField, { flex: 1 }]}>
            <Text style={styles.cardInputFieldLabel}>{t('cvc')}</Text>
            <TextInput
              style={styles.cardCVCInput}
              placeholder="123"
              value={cardCVC}
              onChangeText={handleCVCChange}
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
            />
          </View>
        </View>
      </View>
    );
  };

  // Test connection to Antom API (for debugging)
  const testAntomConnection = async () => {
    try {
      console.log('Testing Antom connection...');
      setProcessing(true);
      
      const result = await testConnection();
      
      if (result.success) {
        Alert.alert(
          'Connection Test Successful ✅', 
          `${result.message}\n\nEnvironment: ${result.environment}`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Connection Test Failed ❌', 
          `${result.message}\n\nPlease check your API configuration.`,
          [{ text: 'OK' }]
        );
      }
    } catch (err) {
      Alert.alert(
        'Connection Test Error', 
        `Failed to test connection: ${err.message}`,
        [{ text: 'OK' }]
      );
    } finally {
      setProcessing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <FontAwesome name="arrow-left" size={20} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Payment</Text>
          <View style={{ width: 40 }} />
        </View>
        
        {/* Order Summary */}
        <View style={styles.orderSummary}>
          <Text style={styles.orderSummaryTitle}>Order Summary</Text>
          
          <View style={styles.orderDetail}>
            <Text style={styles.orderDetailLabel}>
              {addonId ? 'Addon' : 'Plan'}:
            </Text>
            <Text style={styles.orderDetailValue}>
              {planDetails?.name || 'Selected Plan'}
            </Text>
          </View>
          
          {discount > 0 && (
            <View style={styles.orderDetail}>
              <Text style={styles.orderDetailLabel}>Discount:</Text>
              <Text style={styles.orderDetailValue}>-${discount.toFixed(2)}</Text>
            </View>
          )}
          
          <View style={styles.orderDetail}>
            <Text style={styles.orderDetailLabel}>Total:</Text>
            <Text style={styles.orderDetailValue}>${parseFloat(finalPrice).toFixed(2)}</Text>
          </View>
          
          {startDate && endDate && (
            <View style={styles.orderDetail}>
              <Text style={styles.orderDetailLabel}>Period:</Text>
              <Text style={styles.orderDetailValue}>
                {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
              </Text>
            </View>
          )}
        </View>
        
        {/* Payment Methods */}
        <View style={styles.paymentMethodsContainer}>
          <Text style={styles.paymentMethodsTitle}>Select Payment Method</Text>
          
          <View style={styles.paymentMethods}>
            {paymentMethods.map((method) => (
              <TouchableOpacity
                key={method.id}
                style={[
                  styles.paymentMethodItem,
                  selectedPaymentMethod === method.id && styles.selectedPaymentMethod
                ]}
                onPress={() => handleSelectPaymentMethod(method.id)}
              >
                <View style={styles.paymentMethodIcon}>
                  {renderPaymentMethodIcon(method)}
                </View>
                <Text style={styles.paymentMethodName}>{method.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        
        {/* Card Input Form */}
        {renderCardInputForm()}
        
        {/* Error Message */}
        {(paymentError || antomError) && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{paymentError || antomError}</Text>
          </View>
        )}
        
        {/* Pay Button */}
        <TouchableOpacity
          style={[styles.payButton, (processing || initializing) && styles.payButtonDisabled]}
          onPress={handlePayNow}
          disabled={processing || initializing}
        >
          {processing || initializing ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.payButtonText}>{t('payNow')}</Text>
          )}
        </TouchableOpacity>
        
        {/* Debug Button - Only in development */}
        {__DEV__ && (
          <TouchableOpacity
            style={styles.debugButton}
            onPress={testAntomConnection}
            disabled={processing}
          >
            <Text style={styles.debugButtonText}>Test Connection</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backButton: {
    padding: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  orderSummary: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  orderSummaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  orderDetail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  orderDetailLabel: {
    fontSize: 16,
    color: '#666',
  },
  orderDetailValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  paymentMethodsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  paymentMethodsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  paymentMethods: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  paymentMethodItem: {
    width: (width - 60) / 2,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  selectedPaymentMethod: {
    borderColor: '#2274F0',
    backgroundColor: '#F0F7FF',
  },
  paymentMethodIcon: {
    marginBottom: 10,
  },
  paymentMethodName: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
  },
  cardInputContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardInputLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  cardInputField: {
    marginBottom: 15,
  },
  cardInputFieldLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  cardHolderInput: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  cardNumberInput: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  cardDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardExpiryInput: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  cardCVCInput: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 14,
  },
  payButton: {
    backgroundColor: '#2274F0',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginBottom: 20,
  },
  payButtonDisabled: {
    backgroundColor: '#A0C0E8',
  },
  payButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  debugButton: {
    backgroundColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  debugButtonText: {
    color: '#333',
    fontSize: 14,
  },
});

export default AntomPaymentScreen;