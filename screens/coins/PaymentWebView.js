import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  TouchableOpacity,
  Text,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useAuthUser } from '../../hooks/useAuthUser';
import paymentService from '../../services/paymentService';

const PaymentWebView = ({ route, navigation }) => {
  const { paymentUrl, paymentRequestId, onPaymentComplete } = route.params;
  const [loading, setLoading] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState('pending');
  const webViewRef = useRef(null);
  const { session } = useAuthUser();
  
  // Set up polling for payment status
  useEffect(() => {
    let statusCheckInterval;
    
    const checkPaymentStatus = async () => {
      try {
        const result = await paymentService.queryPaymentStatus(paymentRequestId, session);
        
        if (result.success) {
          const status = result.data.status;
          setPaymentStatus(status);
          
          if (status === 'completed') {
            clearInterval(statusCheckInterval);
            handlePaymentSuccess();
          } else if (status === 'failed' || status === 'cancelled') {
            clearInterval(statusCheckInterval);
            handlePaymentFailure(status);
          }
        }
      } catch (error) {
        console.error('Error checking payment status:', error);
      }
    };
    
    // Start polling every 3 seconds
    statusCheckInterval = setInterval(checkPaymentStatus, 3000);
    
    // Clean up interval on unmount
    return () => {
      if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
      }
    };
  }, [paymentRequestId, session]);

  const handlePaymentSuccess = () => {
    if (onPaymentComplete) {
      onPaymentComplete('completed');
    } else {
      navigation.goBack();
      Alert.alert('Success', 'Payment completed successfully');
    }
  };

  const handlePaymentFailure = (status) => {
    if (onPaymentComplete) {
      onPaymentComplete(status);
    } else {
      navigation.goBack();
      Alert.alert('Payment Failed', 'Your payment could not be processed. Please try again.');
    }
  };

  const handleNavigationStateChange = (navState) => {
    // Check if the URL contains success or failure indicators
    const { url } = navState;
    
    if (url.includes('payment_success') || url.includes('payment=success')) {
      handlePaymentSuccess();
    } else if (url.includes('payment_failed') || url.includes('payment=failed')) {
      handlePaymentFailure('failed');
    } else if (url.includes('payment_cancelled') || url.includes('payment=cancelled')) {
      handlePaymentFailure('cancelled');
    }
  };

  const handleCancel = async () => {
    try {
      // Attempt to cancel the payment
      await paymentService.cancelPayment(paymentRequestId, session);
      navigation.goBack();
    } catch (error) {
      console.error('Error cancelling payment:', error);
      navigation.goBack();
    }
  };

  const handleClose = () => {
    Alert.alert(
      'Cancel Payment',
      'Are you sure you want to cancel this payment?',
      [
        { text: 'No', style: 'cancel' },
        { text: 'Yes', onPress: handleCancel }
      ]
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
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <Icon name="close" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Complete Payment</Text>
        <View style={{ width: 24 }} />
      </LinearGradient>

      <View style={styles.webViewContainer}>
        <WebView
          ref={webViewRef}
          source={{ uri: paymentUrl }}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onNavigationStateChange={handleNavigationStateChange}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          scalesPageToFit={true}
          style={styles.webView}
        />
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2274F0" />
            <Text style={styles.loadingText}>Loading payment page...</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  webViewContainer: {
    flex: 1,
    position: 'relative',
  },
  webView: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#333',
  },
});

export default PaymentWebView;