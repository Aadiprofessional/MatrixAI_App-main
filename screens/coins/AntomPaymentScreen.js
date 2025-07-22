import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useAuthUser } from '../../hooks/useAuthUser';
import paymentService from '../../services/paymentService';

const AntomPaymentScreen = ({ route, navigation }) => {
  const { orderData } = route.params;
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processingPayment, setProcessingPayment] = useState(false);
  const { session } = useAuthUser();

  useEffect(() => {
    fetchPaymentMethods();
  }, []);

  const fetchPaymentMethods = async () => {
    try {
      setLoading(true);
      const response = await paymentService.getPaymentMethods(session);
      
      if (response.success) {
        // Filter for enabled payment methods
        const enabledMethods = response.data.filter(method => method.enabled);
        setPaymentMethods(enabledMethods);
        
        // Auto-select the first payment method if available
        if (enabledMethods.length > 0) {
          setSelectedMethod(enabledMethods[0]);
        }
      } else {
        Alert.alert('Error', 'Failed to load payment methods');
      }
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      Alert.alert('Error', 'Failed to load payment methods');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentMethodSelect = (method) => {
    setSelectedMethod(method);
  };

  const handlePaymentComplete = (status) => {
    if (status === 'completed') {
      navigation.navigate('PaymentSuccessScreen', { orderData });
    } else {
      Alert.alert(
        'Payment Failed',
        'Your payment could not be processed. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleProceedToPayment = async () => {
    if (!selectedMethod) {
      Alert.alert('Error', 'Please select a payment method');
      return;
    }

    try {
      setProcessingPayment(true);
      
      // Determine if this is a subscription or addon payment
      let paymentResponse;
      
      if (orderData.type === 'subscription') {
        paymentResponse = await paymentService.createSubscriptionPayment(
          orderData.planId,
          selectedMethod.paymentMethodType,
          orderData.couponCode,
          session
        );
      } else if (orderData.type === 'addon') {
        paymentResponse = await paymentService.createAddonPayment(
          orderData.addonId,
          orderData.quantity,
          selectedMethod.paymentMethodType,
          session
        );
      } else {
        // Regular payment
        paymentResponse = await paymentService.createPayment(
          orderData.amount,
          orderData.currency,
          selectedMethod.paymentMethodType,
          orderData.productId,
          session
        );
      }

      if (paymentResponse.success) {
        const { paymentUrl, paymentRequestId } = paymentResponse.data;
        
        // Navigate to the payment webview
        navigation.navigate('PaymentWebView', {
          paymentUrl,
          paymentRequestId,
          onPaymentComplete: handlePaymentComplete,
        });
      } else {
        Alert.alert('Error', paymentResponse.message || 'Failed to initiate payment');
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      Alert.alert('Error', 'Failed to process payment. Please try again.');
    } finally {
      setProcessingPayment(false);
    }
  };

  const renderPaymentMethod = (method) => {
    const isSelected = selectedMethod && selectedMethod.paymentMethodType === method.paymentMethodType;
    
    return (
      <TouchableOpacity
        key={method.paymentMethodType}
        style={[styles.paymentMethodItem, isSelected && styles.selectedPaymentMethod]}
        onPress={() => handlePaymentMethodSelect(method)}
      >
        <View style={styles.paymentMethodContent}>
          <Image 
            source={{ uri: method.logoUrl || 'https://via.placeholder.com/40' }} 
            style={styles.paymentMethodLogo} 
            defaultSource={require('../../assets/images/payment-placeholder.png')}
          />
          <View style={styles.paymentMethodDetails}>
            <Text style={styles.paymentMethodName}>{method.name}</Text>
            <Text style={styles.paymentMethodDescription}>{method.description || 'Pay with ' + method.name}</Text>
          </View>
        </View>
        <View style={styles.radioButton}>
          {isSelected && <View style={styles.radioButtonInner} />}
        </View>
      </TouchableOpacity>
    );
  };

  const renderOrderSummary = () => {
    return (
      <View style={styles.orderSummaryContainer}>
        <Text style={styles.sectionTitle}>Order Summary</Text>
        <View style={styles.orderItem}>
          <Text style={styles.orderItemName}>{orderData.name || 'Product'}</Text>
          <Text style={styles.orderItemPrice}>
            {orderData.currency} {orderData.amount.toFixed(2)}
          </Text>
        </View>
        
        {orderData.couponDiscount > 0 && (
          <View style={styles.orderItem}>
            <Text style={styles.discountText}>Coupon Discount</Text>
            <Text style={styles.discountAmount}>-{orderData.currency} {orderData.couponDiscount.toFixed(2)}</Text>
          </View>
        )}
        
        <View style={styles.divider} />
        
        <View style={styles.orderTotal}>
          <Text style={styles.orderTotalText}>Total</Text>
          <Text style={styles.orderTotalAmount}>
            {orderData.currency} {(orderData.amount - (orderData.couponDiscount || 0)).toFixed(2)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#2274F0', '#7C88FF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment</Text>
        <View style={{ width: 24 }} />
      </LinearGradient>

      <ScrollView style={styles.content}>
        {renderOrderSummary()}
        
        <View style={styles.paymentMethodsContainer}>
          <Text style={styles.sectionTitle}>Select Payment Method</Text>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2274F0" />
              <Text style={styles.loadingText}>Loading payment methods...</Text>
            </View>
          ) : paymentMethods.length > 0 ? (
            paymentMethods.map(method => renderPaymentMethod(method))
          ) : (
            <View style={styles.noMethodsContainer}>
              <Icon name="alert-circle-outline" size={48} color="#999" />
              <Text style={styles.noMethodsText}>No payment methods available</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.payButton, (!selectedMethod || processingPayment) && styles.disabledButton]}
          onPress={handleProceedToPayment}
          disabled={!selectedMethod || processingPayment}
        >
          {processingPayment ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.payButtonText}>Proceed to Payment</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  orderSummaryContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  orderItemName: {
    fontSize: 16,
    color: '#333',
  },
  orderItemPrice: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  discountText: {
    fontSize: 16,
    color: '#4CAF50',
  },
  discountAmount: {
    fontSize: 16,
    fontWeight: '500',
    color: '#4CAF50',
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 12,
  },
  orderTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  orderTotalText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  orderTotalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2274F0',
  },
  paymentMethodsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  paymentMethodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    marginBottom: 12,
  },
  selectedPaymentMethod: {
    borderColor: '#2274F0',
    backgroundColor: 'rgba(34, 116, 240, 0.05)',
  },
  paymentMethodContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  paymentMethodLogo: {
    width: 40,
    height: 40,
    borderRadius: 4,
    marginRight: 12,
  },
  paymentMethodDetails: {
    flex: 1,
  },
  paymentMethodName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  paymentMethodDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#2274F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2274F0',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  noMethodsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  noMethodsText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  footer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  payButton: {
    backgroundColor: '#2274F0',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    backgroundColor: '#A0A0A0',
  },
  payButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default AntomPaymentScreen;