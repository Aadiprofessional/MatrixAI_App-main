import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';
import { WebView } from 'react-native-webview';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import airwallexService from '../../services/airwallexService';

const AirwallexWebView = ({ route, navigation }) => {
  const { paymentUrl, paymentIntentId, orderData, onPaymentComplete } = route.params;
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const webViewRef = useRef(null);
  const pollIntervalRef = useRef(null);

  useEffect(() => {
    // Start polling for payment status
    startPolling();

    return () => {
      // Cleanup polling on unmount
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const startPolling = () => {
    setPolling(true);
    pollIntervalRef.current = setInterval(async () => {
      try {
        const status = await airwallexService.getPaymentStatus(paymentIntentId);
        
        if (status === 'SUCCEEDED') {
          clearInterval(pollIntervalRef.current);
          setPolling(false);
          navigation.navigate('PaymentSuccessScreen', { orderData });
        } else if (status === 'FAILED' || status === 'CANCELLED') {
          clearInterval(pollIntervalRef.current);
          setPolling(false);
          Alert.alert(
            'Payment Failed',
            'Your payment could not be processed. Please try again.',
            [
              {
                text: 'OK',
                onPress: () => navigation.goBack()
              }
            ]
          );
        }
      } catch (error) {
        console.error('Error polling payment status:', error);
      }
    }, 3000); // Poll every 3 seconds
  };

  const handleNavigationStateChange = (navState) => {
    const { url } = navState;
    
    // Check for success/failure URLs
    if (url.includes('payment-success') || url.includes('success')) {
      clearInterval(pollIntervalRef.current);
      setPolling(false);
      navigation.navigate('PaymentSuccessScreen', { orderData });
    } else if (url.includes('payment-failed') || url.includes('failed') || url.includes('cancel')) {
      clearInterval(pollIntervalRef.current);
      setPolling(false);
      Alert.alert(
        'Payment Failed',
        'Your payment could not be processed. Please try again.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack()
          }
        ]
      );
    }
  };

  const handleCancelPayment = () => {
    Alert.alert(
      'Cancel Payment',
      'Are you sure you want to cancel this payment?',
      [
        {
          text: 'No',
          style: 'cancel',
        },
        {
          text: 'Yes',
          onPress: async () => {
            try {
              // Stop polling
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
              }
              setPolling(false);
              
              // Optionally cancel the payment intent
              // await airwallexService.cancelPayment(paymentIntentId);
              
              navigation.goBack();
            } catch (error) {
              console.error('Error canceling payment:', error);
              navigation.goBack();
            }
          },
        },
      ]
    );
  };

  const handleWebViewError = (syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    console.error('WebView error:', nativeEvent);
    
    Alert.alert(
      'Loading Error',
      'Failed to load payment page. Please check your internet connection and try again.',
      [
        {
          text: 'Retry',
          onPress: () => {
            if (webViewRef.current) {
              webViewRef.current.reload();
            }
          }
        },
        {
          text: 'Cancel',
          onPress: () => navigation.goBack()
        }
      ]
    );
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
          onPress={handleCancelPayment}
        >
          <Icon name="close" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Secure Payment</Text>
        <View style={styles.headerRight}>
          {polling && (
            <ActivityIndicator size="small" color="#FFF" />
          )}
        </View>
      </LinearGradient>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2274F0" />
          <Text style={styles.loadingText}>Loading secure payment...</Text>
        </View>
      )}

      <WebView
        ref={webViewRef}
        source={{ uri: paymentUrl }}
        style={styles.webView}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onError={handleWebViewError}
        onNavigationStateChange={handleNavigationStateChange}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        mixedContentMode="compatibility"
        thirdPartyCookiesEnabled={true}
        sharedCookiesEnabled={true}
        userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1"
      />

      {/* Payment Status Indicator */}
      {polling && (
        <View style={styles.statusIndicator}>
          <View style={styles.statusContent}>
            <ActivityIndicator size="small" color="#2274F0" />
            <Text style={styles.statusText}>Processing payment...</Text>
          </View>
        </View>
      )}
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
  headerRight: {
    width: 40,
    alignItems: 'center',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    zIndex: 1000,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  webView: {
    flex: 1,
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  statusContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
});

export default AirwallexWebView;