import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaCreditCard, FaPaypal, FaApplePay, FaGooglePay, FaLock, 
  FaCheck, FaTimes, FaSpinner, FaArrowLeft, FaShieldAlt,
  FaCalendarAlt, FaUser, FaEnvelope, FaMapMarkerAlt,
  FaStar, FaCrown, FaRocket, FaInfoCircle, FaEye, FaEyeSlash,
  FaAlipay, FaWeixin, FaMobileAlt, FaWallet
} from 'react-icons/fa';

import { AiOutlineClose } from 'react-icons/ai';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import IconComponent from '../components/ui/IconComponent';
import { useAuth } from '../utils/AuthContext';
import { useSubscription } from '../utils/SubscriptionContext';
import { subscriptionAPI, SubscriptionPlan, AddonPlan } from '../utils/subscriptionAPI';
import paymentService from '../services/paymentService';

interface PaymentMethod {
  name: string;
  currency: string;
  type: 'wallet' | 'card';
  country: string;
}

interface PaymentState {
  selectedPlan?: SubscriptionPlan;
  selectedAddon?: AddonPlan;
}

interface CreditCardForm {
  cardNumber: string;
  expiryDate: string;
  cvv: string;
  cardholderName: string;
  email: string;
  address: string;
  city: string;
  zipCode: string;
  country: string;
}

interface PayPalForm {
  email: string;
}

interface ApplePayForm {
  touchId: boolean;
}

interface GooglePayForm {
  email: string;
}

const Payment: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, session } = useAuth();
  const { refreshStatus } = useSubscription();
  
  const state = location.state as PaymentState;
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(state?.selectedPlan || null);
  const [selectedAddon, setSelectedAddon] = useState<AddonPlan | null>(state?.selectedAddon || null);
  
  const [paymentMethods, setPaymentMethods] = useState<Record<string, PaymentMethod>>({});
  const [paymentMethod, setPaymentMethod] = useState<string>('GCASH');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCvv, setShowCvv] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [paymentRequestId, setPaymentRequestId] = useState<string>('');
  const [loadingMethods, setLoadingMethods] = useState(true);

  // Form states
  const [creditCardForm, setCreditCardForm] = useState<CreditCardForm>({
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    cardholderName: '',
    email: user?.email || '',
    address: '',
    city: '',
    zipCode: '',
    country: 'US'
  });

  const [paypalForm, setPaypalForm] = useState<PayPalForm>({
    email: user?.email || ''
  });

  const [applePayForm, setApplePayForm] = useState<ApplePayForm>({
    touchId: false
  });

  const [googlePayForm, setGooglePayForm] = useState<GooglePayForm>({
    email: user?.email || ''
  });

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (!selectedPlan && !selectedAddon) {
      navigate('/subscription');
      return;
    }
  }, [user, selectedPlan, selectedAddon, navigate]);

  // Fetch available payment methods
  useEffect(() => {
    const fetchPaymentMethods = async () => {
      try {
        setLoadingMethods(true);
        const response = await paymentService.getPaymentMethods();
        if (response.success && response.data) {
          setPaymentMethods(response.data || {});
          // Set default payment method to first available one
          const firstMethod = Object.keys(response.data || {})[0];
          if (firstMethod) {
            setPaymentMethod(firstMethod);
          }
        } else {
          // Set default payment methods if API fails
          setPaymentMethods({
            GCASH: { name: 'GCash', currency: 'PHP', type: 'wallet', country: 'PH' },
            MAYA: { name: 'Maya', currency: 'PHP', type: 'wallet', country: 'PH' },
            VISA: { name: 'Visa', currency: 'PHP', type: 'card', country: 'PH' },
            MASTERCARD: { name: 'Mastercard', currency: 'PHP', type: 'card', country: 'PH' }
          });
        }
      } catch (error) {
        console.error('Error fetching payment methods:', error);
        setError('Failed to load payment methods');
        // Set default payment methods as fallback
        setPaymentMethods({
          GCASH: { name: 'GCash', currency: 'PHP', type: 'wallet', country: 'PH' },
          MAYA: { name: 'Maya', currency: 'PHP', type: 'wallet', country: 'PH' },
          VISA: { name: 'Visa', currency: 'PHP', type: 'card', country: 'PH' },
          MASTERCARD: { name: 'Mastercard', currency: 'PHP', type: 'card', country: 'PH' }
        });
      } finally {
        setLoadingMethods(false);
      }
    };

    fetchPaymentMethods();
  }, []);

  // Format card number with spaces
  const formatCardNumber = (value: string): string => {
    const cleanValue = value.replace(/\D/g, '');
    const formatted = cleanValue.replace(/(\d{4})(?=\d)/g, '$1 ');
    return formatted.substring(0, 19); // Max 16 digits + 3 spaces
  };

  // Format expiry date as MM/YY
  const formatExpiryDate = (value: string): string => {
    const cleanValue = value.replace(/\D/g, '');
    if (cleanValue.length >= 2) {
      return cleanValue.substring(0, 2) + '/' + cleanValue.substring(2, 4);
    }
    return cleanValue;
  };

  // Format CVV (numbers only)
  const formatCVV = (value: string): string => {
    return value.replace(/\D/g, '').substring(0, 4);
  };

  const handleCreditCardChange = (field: keyof CreditCardForm, value: string) => {
    let formattedValue = value;
    
    // Apply formatting based on field
    switch (field) {
      case 'cardNumber':
        formattedValue = formatCardNumber(value);
        break;
      case 'expiryDate':
        formattedValue = formatExpiryDate(value);
        break;
      case 'cvv':
        formattedValue = formatCVV(value);
        break;
    }
    
    setCreditCardForm(prev => ({
      ...prev,
      [field]: formattedValue
    }));
  };

  // Luhn algorithm for card number validation
  const validateCardNumber = (cardNumber: string): boolean => {
    const cleanNumber = cardNumber.replace(/\D/g, '');
    if (cleanNumber.length < 13 || cleanNumber.length > 19) return false;
    
    let sum = 0;
    let isEven = false;
    
    for (let i = cleanNumber.length - 1; i >= 0; i--) {
      let digit = parseInt(cleanNumber[i]);
      
      if (isEven) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      
      sum += digit;
      isEven = !isEven;
    }
    
    return sum % 10 === 0;
  };

  // Validate expiry date
  const validateExpiryDate = (expiryDate: string): boolean => {
    const cleanDate = expiryDate.replace(/\D/g, '');
    if (cleanDate.length !== 4) return false;
    
    const month = parseInt(cleanDate.substring(0, 2));
    const year = parseInt('20' + cleanDate.substring(2, 4));
    
    if (month < 1 || month > 12) return false;
    
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    
    if (year < currentYear || (year === currentYear && month < currentMonth)) {
      return false;
    }
    
    return true;
  };

  const validateCreditCardForm = (): boolean => {
    const { cardNumber, expiryDate, cvv, cardholderName, email } = creditCardForm;
    
    // Validate card number using Luhn algorithm
    if (!cardNumber || !validateCardNumber(cardNumber)) {
      setError('Please enter a valid card number');
      return false;
    }
    
    // Validate expiry date
    if (!expiryDate || !validateExpiryDate(expiryDate)) {
      setError('Please enter a valid expiry date (MM/YY)');
      return false;
    }
    
    // Validate CVV
    const cleanCvv = cvv.replace(/\D/g, '');
    if (!cleanCvv || cleanCvv.length < 3 || cleanCvv.length > 4) {
      setError('Please enter a valid CVV (3-4 digits)');
      return false;
    }
    
    // Validate cardholder name
    if (!cardholderName.trim() || cardholderName.trim().length < 2) {
      setError('Please enter the cardholder name');
      return false;
    }
    
    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return false;
    }
    
    return true;
  };

  const generateTransactionId = () => {
    return 'txn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  };

  const getPaymentMethodType = () => {
    // Payment method is already in the correct format from the API
    return paymentMethod;
  };

  const handlePayment = async () => {
    if (!session || (!selectedPlan && !selectedAddon)) return;

    // Validate forms based on payment method type
    const selectedPaymentMethod = paymentMethods[paymentMethod];
    if (selectedPaymentMethod?.type === 'card' && !validateCreditCardForm()) {
      return;
    }

    // For wallet payments, no additional validation needed as they redirect to external services

    setIsProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      const currentItem = selectedPlan || selectedAddon;
      const paymentMethodType = getPaymentMethodType();
      
      console.log('🚀 Starting payment process:', {
        item: currentItem?.name,
        amount: currentItem?.price,
        paymentMethodType,
        isSubscription: !!selectedPlan
      });

      let paymentResult;

      // Create payment using the new API
      if (selectedPlan) {
        paymentResult = await paymentService.createSubscriptionPayment(
          selectedPlan.id,
          selectedPlan.price,
          'PHP', // Using PHP as per your working code
          paymentMethodType,
          session
        );
      } else if (selectedAddon) {
        paymentResult = await paymentService.createAddonPayment(
          selectedAddon.id,
          selectedAddon.price,
          'PHP', // Using PHP as per your working code
          paymentMethodType,
          session
        );
      }

      if (!paymentResult?.success) {
        setError(paymentResult?.error || 'Failed to create payment');
        return;
      }

      const { paymentRequestId, paymentUrl, redirectUrl } = paymentResult.data;
      setPaymentRequestId(paymentRequestId);

      console.log('✅ Payment created successfully:', {
        paymentRequestId,
        paymentUrl,
        redirectUrl
      });

      // For mobile payment methods (GCash, PayMaya), redirect to payment URL
      if (paymentMethodType === 'GCASH' || paymentMethodType === 'PAYMAYA') {
        setSuccess('Redirecting to payment page...');
        
        // Open payment URL in new window/tab
        const paymentWindow = window.open(paymentUrl || redirectUrl, '_blank', 'width=600,height=700');
        
        if (!paymentWindow) {
          // If popup blocked, redirect in same window
          window.location.href = paymentUrl || redirectUrl;
          return;
        }

        // Poll for payment completion
        const pollInterval = setInterval(async () => {
          try {
            const statusResult = await paymentService.queryPaymentStatus(paymentRequestId, session);
            
            if (statusResult.success) {
              const status = statusResult.data.status;
              
              if (status === 'completed') {
                clearInterval(pollInterval);
                paymentWindow.close();
                
                await refreshStatus();
                
                navigate('/thank-you', {
                  state: {
                    planName: selectedPlan?.name || selectedAddon?.name,
                    planPrice: selectedPlan?.price || selectedAddon?.price,
                    isAddon: !!selectedAddon,
                    transactionId: paymentRequestId,
                    paymentMethod: paymentMethodType
                  },
                  replace: true
                });
              } else if (status === 'failed' || status === 'cancelled') {
                clearInterval(pollInterval);
                paymentWindow.close();
                setError('Payment was cancelled or failed. Please try again.');
              }
            }
          } catch (error) {
            console.error('Payment polling error:', error);
          }
        }, 3000); // Poll every 3 seconds

        // Stop polling after 10 minutes
        setTimeout(() => {
          clearInterval(pollInterval);
          setError('Payment timeout. Please try again.');
        }, 600000);

      } else {
        // For other payment methods, handle differently
        setSuccess('Payment processed successfully!');
        
        setTimeout(async () => {
          await refreshStatus();
          
          navigate('/thank-you', {
            state: {
              planName: selectedPlan?.name || selectedAddon?.name,
              planPrice: selectedPlan?.price || selectedAddon?.price,
              isAddon: !!selectedAddon,
              transactionId: paymentRequestId,
              paymentMethod: paymentMethodType
            },
            replace: true
          });
        }, 2000);
      }

    } catch (error: any) {
      console.error('Payment error:', error);
      setError(error.message || 'Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Helper function to render payment method icon
  const renderPaymentMethodIcon = (methodType: string, className: string) => {
    const iconProps = { className };
    
    switch (methodType) {
      case 'GCASH':
        return (FaAlipay as any)(iconProps);
      case 'MAYA':
      case 'PAYMAYA':
        return (FaWeixin as any)(iconProps);
      case 'SHOPEEPAY':
        return (FaMobileAlt as any)(iconProps);
      case 'GRABPAY':
        return (FaWallet as any)(iconProps);
      case 'VISA':
      case 'MASTERCARD':
      case 'AMERICAN_EXPRESS':
        return (FaCreditCard as any)(iconProps);
      default:
        return (FaWallet as any)(iconProps);
    }
  };

  // Helper function to get payment method description
  const getPaymentMethodDescription = (methodType: string, method: PaymentMethod) => {
    switch (method.type) {
      case 'wallet':
        return `Pay with ${method.name} wallet`;
      case 'card':
        return `Pay with ${method.name} card`;
      default:
        return `Pay with ${method.name}`;
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.6,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 }
    }
  };

  if (!user || (!selectedPlan && !selectedAddon)) {
    return null;
  }

  const currentItem = selectedPlan || selectedAddon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <Header />
      
      <div className="pt-20 pb-16">
        <motion.div
          className="container mx-auto px-4 max-w-6xl"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Header */}
          <motion.div 
            className="flex items-center justify-between mb-8"
            variants={itemVariants}
          >
            <button
              onClick={() => navigate('/subscription')}
              className="flex items-center text-gray-400 hover:text-white transition-colors duration-200"
            >
              <IconComponent icon={FaArrowLeft} className="w-5 h-5 mr-2" />
              Back to Plans
            </button>
            
            <div className="flex items-center">
              <IconComponent icon={FaLock} className="w-5 h-5 text-green-400 mr-2" />
              <span className="text-green-400 text-sm font-medium">Secure Checkout</span>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Order Summary */}
            <motion.div variants={itemVariants}>
              <div className="bg-black/30 backdrop-blur-xl rounded-2xl border border-white/10 p-8">
                <h2 className="text-2xl font-bold text-white mb-6">Order Summary</h2>
                
                <div className="space-y-6">
                  {/* Plan Details */}
                  <div className="bg-black/20 rounded-xl p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center">
                        <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-3 rounded-lg mr-4">
                          <IconComponent 
                            icon={selectedAddon ? FaRocket : FaCrown} 
                            className="w-6 h-6 text-white" 
                          />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-white">{currentItem?.name}</h3>
                          <p className="text-gray-400 text-sm mt-1">{currentItem?.description}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-white">₱{currentItem?.price}</p>
                        <p className="text-gray-400 text-sm">
                          {selectedAddon ? 'One-time' : 'Monthly'}
                        </p>
                      </div>
                    </div>
                    
                    {/* Features */}
                    <div className="space-y-2">
                      <div className="flex items-center text-gray-300">
                        <IconComponent icon={FaCheck} className="w-4 h-4 text-green-400 mr-2" />
                        <span className="text-sm">
                          {selectedPlan ? `${selectedPlan.response_limit} AI responses` : `${selectedAddon?.additional_responses} additional responses`}
                        </span>
                      </div>
                      {selectedPlan && (
                        <>
                          <div className="flex items-center text-gray-300">
                            <IconComponent icon={FaCheck} className="w-4 h-4 text-green-400 mr-2" />
                            <span className="text-sm">Priority support</span>
                          </div>
                          <div className="flex items-center text-gray-300">
                            <IconComponent icon={FaCheck} className="w-4 h-4 text-green-400 mr-2" />
                            <span className="text-sm">Advanced features</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Payment Summary */}
                  <div className="border-t border-white/10 pt-6">
                    <div className="flex justify-between items-center text-lg">
                      <span className="text-gray-300">Subtotal</span>
                      <span className="text-white">₱{currentItem?.price}</span>
                    </div>
                    <div className="flex justify-between items-center text-lg mt-2">
                      <span className="text-gray-300">Tax</span>
                      <span className="text-white">₱0.00</span>
                    </div>
                    <div className="flex justify-between items-center text-xl font-bold mt-4 pt-4 border-t border-white/10">
                      <span className="text-white">Total</span>
                      <span className="text-white">₱{currentItem?.price}</span>
                    </div>
                  </div>

                  {/* Security Badge */}
                  <div className="bg-green-900/20 rounded-lg p-4 border border-green-500/20">
                    <div className="flex items-center">
                      <IconComponent icon={FaShieldAlt} className="w-5 h-5 text-green-400 mr-3" />
                      <div>
                        <p className="text-green-400 font-medium text-sm">Secure Payment</p>
                        <p className="text-green-300 text-xs mt-1">
                          Your payment information is encrypted and secure
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Payment Form */}
            <motion.div variants={itemVariants}>
              <div className="bg-black/30 backdrop-blur-xl rounded-2xl border border-white/10 p-8">
                <h2 className="text-2xl font-bold text-white mb-6">Payment Method</h2>

                {/* Payment Method Selection */}
                <div className="space-y-4 mb-8">
                  {loadingMethods ? (
                    <div className="flex items-center justify-center p-8">
                      {(FaSpinner as any)({ className: "animate-spin text-purple-500 text-2xl mr-3" })}
                      <span className="text-white">Loading payment methods...</span>
                    </div>
                  ) : (
                    Object.entries(paymentMethods || {}).map(([methodType, method]) => {
                      return (
                        <motion.div
                          key={methodType}
                          className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                            paymentMethod === methodType
                              ? 'border-purple-500 bg-purple-900/20'
                          : 'border-white/10 bg-black/20 hover:border-white/20'
                        }`}
                          onClick={() => setPaymentMethod(methodType)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <div className="flex items-center">
                            <div className={`w-5 h-5 rounded-full border-2 mr-4 flex items-center justify-center ${
                              paymentMethod === methodType
                                ? 'border-purple-500 bg-purple-500'
                                : 'border-gray-400'
                            }`}>
                              {paymentMethod === methodType && (
                                <div className="w-2 h-2 rounded-full bg-white"></div>
                              )}
                            </div>
                            {renderPaymentMethodIcon(methodType, "w-6 h-6 text-white mr-4")}
                            <div className="flex-1">
                              <h3 className="text-white font-medium">{method.name}</h3>
                              <p className="text-gray-400 text-sm">{getPaymentMethodDescription(methodType, method)}</p>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </div>

                {/* Payment Form Fields */}
                <AnimatePresence mode="wait">
                  {paymentMethods[paymentMethod]?.type === 'card' && (
                    <motion.div
                      key={`card-form-${paymentMethod}`}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-4 mb-8"
                    >
                      {/* Test Card Information */}
                      <div className="mb-4 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                        <h4 className="text-blue-300 font-medium mb-2">🧪 Test Card Information (Sandbox Mode)</h4>
                        <div className="text-sm text-blue-200 space-y-1">
                          <p><strong>Visa:</strong> 4111 1111 1111 1111</p>
                          <p><strong>Mastercard:</strong> 5555 5555 5555 4444</p>
                          <p><strong>American Express:</strong> 3782 8224 6310 005</p>
                          <p><strong>Expiry:</strong> Any future date (e.g., 12/25)</p>
                          <p><strong>CVV:</strong> Any 3-4 digits (e.g., 123)</p>
                          <p className="text-yellow-300 mt-2">⚠️ Only test cards work in sandbox mode. Real cards will be declined.</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Card Number
                          </label>
                          <input
                            type="text"
                            placeholder="1234 5678 9012 3456"
                            value={creditCardForm.cardNumber}
                            onChange={(e) => handleCreditCardChange('cardNumber', e.target.value)}
                            className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Cardholder Name
                          </label>
                          <input
                            type="text"
                            placeholder="John Doe"
                            value={creditCardForm.cardholderName}
                            onChange={(e) => handleCreditCardChange('cardholderName', e.target.value)}
                            className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Expiry Date
                          </label>
                          <input
                            type="text"
                            placeholder="MM/YY"
                            value={creditCardForm.expiryDate}
                            onChange={(e) => handleCreditCardChange('expiryDate', e.target.value)}
                            className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            CVV
                          </label>
                          <div className="relative">
                            <input
                              type={showCvv ? 'text' : 'password'}
                              placeholder="123"
                              value={creditCardForm.cvv}
                              onChange={(e) => handleCreditCardChange('cvv', e.target.value)}
                              className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                            />
                            <button
                              type="button"
                              onClick={() => setShowCvv(!showCvv)}
                              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                            >
                              <IconComponent icon={showCvv ? FaEyeSlash : FaEye} className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {paymentMethod === 'paypal' && (
                    <motion.div
                      key="paypal"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-4 mb-8"
                    >
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          PayPal Email
                        </label>
                        <input
                          type="email"
                          placeholder="your@email.com"
                          value={paypalForm.email}
                          onChange={(e) => setPaypalForm({ ...paypalForm, email: e.target.value })}
                          className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Error/Success Messages */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      key="error-message"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="bg-red-900/20 border border-red-500/20 rounded-lg p-4 mb-6"
                    >
                      <div className="flex items-center">
                        <IconComponent icon={FaTimes} className="w-5 h-5 text-red-400 mr-3" />
                        <p className="text-red-400 text-sm">{error}</p>
                      </div>
                    </motion.div>
                  )}

                  {success && (
                    <motion.div
                      key="success-message"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="bg-green-900/20 border border-green-500/20 rounded-lg p-4 mb-6"
                    >
                      <div className="flex items-center">
                        <IconComponent icon={FaCheck} className="w-5 h-5 text-green-400 mr-3" />
                        <p className="text-green-400 text-sm">{success}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Payment Button */}
                <motion.button
                  onClick={handlePayment}
                  disabled={isProcessing}
                  className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all duration-200 ${
                    isProcessing
                      ? 'bg-gray-600 cursor-not-allowed'
                      : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 transform hover:scale-105'
                  } text-white shadow-lg`}
                  whileHover={!isProcessing ? { scale: 1.05 } : {}}
                  whileTap={!isProcessing ? { scale: 0.95 } : {}}
                >
                  {isProcessing ? (
                    <div className="flex items-center justify-center">
                      <IconComponent icon={FaSpinner} className="w-5 h-5 mr-2 animate-spin" />
                      Processing...
                    </div>
                  ) : (
                    `Pay ₱${currentItem?.price}`
                  )}
                </motion.button>

                {/* Security Info */}
                <div className="mt-6 text-center">
                  <p className="text-gray-400 text-xs">
                    <IconComponent icon={FaLock} className="w-3 h-3 inline mr-1" />
                    Your payment information is secure and encrypted
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
      
      <Footer />
    </div>
  );
};

export default Payment; 