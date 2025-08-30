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
import airwallexService from '../../services/airwallexService';

const AirwallexPaymentScreen = ({ route, navigation }) => {
  const { orderData } = route.params;
  const [loading, setLoading] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const { session } = useAuthUser();

  const handleProceedToPayment = async () => {
    try {
      setProcessingPayment(true);
      
      // Create payment intent with correct HKD amount
      let paymentResponse;
      
      if (orderData.type === 'subscription') {
        paymentResponse = await airwallexService.createSubscriptionPayment(
          orderData.planId,
          orderData.amount
        );
      } else if (orderData.type === 'addon') {
        paymentResponse = await airwallexService.createAddonPayment(
          orderData.addonId,
          orderData.amount
        );
      } else {
        // Regular payment
        paymentResponse = await airwallexService.createPaymentIntent(
          orderData.amount
        );
      }

      if (!paymentResponse.success) {
        throw new Error(paymentResponse.error);
      }

      // Navigate to WebView with hosted payment URL
      const hostedPaymentUrl = airwallexService.getHostedPaymentUrl(
        paymentResponse.data.client_secret
      );

      navigation.navigate('AirwallexWebView', {
        paymentUrl: hostedPaymentUrl,
        paymentIntentId: paymentResponse.data.id,
        orderData: orderData,
        onPaymentComplete: handlePaymentComplete
      });

    } catch (error) {
      console.error('Payment creation error:', error);
      Alert.alert(
        'Payment Error',
        error.message || 'Failed to create payment. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setProcessingPayment(false);
    }
  };

  const handlePaymentComplete = (status) => {
    if (status === 'SUCCEEDED') {
      navigation.navigate('PaymentSuccessScreen', { orderData });
    } else {
      Alert.alert(
        'Payment Failed',
        'Your payment could not be processed. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const formatAmount = (amount) => {
    return `${amount}.00 HKD`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#2274F0', '#FF6600']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment</Text>
        <View style={{ width: 24 }} />
      </LinearGradient>

      <ScrollView style={styles.content}>
        {/* Order Summary */}
        <View style={styles.orderSummaryContainer}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          
          <View style={styles.orderItem}>
            <Text style={styles.orderItemName}>{orderData.name}</Text>
            <Text style={styles.orderItemPrice}>{formatAmount(orderData.amount)}</Text>
          </View>
          
          {orderData.discount && (
            <View style={styles.orderItem}>
              <Text style={styles.discountText}>Discount</Text>
              <Text style={styles.discountAmount}>-{formatAmount(orderData.discount)}</Text>
            </View>
          )}
          
          <View style={styles.divider} />
          
          <View style={styles.orderTotal}>
            <Text style={styles.orderTotalText}>Total</Text>
            <Text style={styles.orderTotalAmount}>
              {formatAmount(orderData.amount - (orderData.discount || 0))}
            </Text>
          </View>
        </View>

        {/* Payment Method Info */}
        <View style={styles.paymentMethodsContainer}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          
          <View style={styles.paymentMethodItem}>
            <View style={styles.paymentMethodContent}>
              <Image 
                source={{ uri: 'https://checkout.airwallex.com/assets/airwallex-logo.png' }}
                style={styles.paymentMethodLogo}
                defaultSource={require('../../assets/logo.png')}
              />
              <View style={styles.paymentMethodDetails}>
                <Text style={styles.paymentMethodName}>Airwallex Secure Payment</Text>
                <Text style={styles.paymentMethodDescription}>
                  Secure global payments • Multiple payment methods
                </Text>
              </View>
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
          style={[styles.payButton, processingPayment && styles.disabledButton]}
          onPress={handleProceedToPayment}
          disabled={processingPayment}
        >
          {processingPayment ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.payButtonText}>
              Pay {formatAmount(orderData.amount - (orderData.discount || 0))}
            </Text>
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
    borderColor: '#2274F0',
    backgroundColor: 'rgba(34, 116, 240, 0.05)',
    borderRadius: 8,
    marginBottom: 12,
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
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  securityText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  currencyContainer: {
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
  currencyTitle: {
    fontSize: 16,
    fontWeight: '500',
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

export default AirwallexPaymentScreen;