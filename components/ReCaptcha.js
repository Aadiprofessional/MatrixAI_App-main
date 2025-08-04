import React, { useState, useRef } from 'react';
import { View, Modal, StyleSheet, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import Icon from 'react-native-vector-icons/Ionicons';

const ReCaptcha = ({ 
  siteKey = '6LeyxJQrAAAAAFq5BOxxjRcrc6sK04cDbbQBQNWb', // Production site key
  onVerify,
  onExpire,
  onError,
  visible,
  onClose,
  theme = 'light',
  size = 'normal'
}) => {
  const [loading, setLoading] = useState(true);
  const webViewRef = useRef(null);

  const generateHTML = () => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>reCAPTCHA</title>
          <script src="https://www.google.com/recaptcha/api.js" async defer></script>
          <style>
            body {
              margin: 0;
              padding: 20px;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              background-color: #f5f5f5;
            }
          </style>
        </head>
        <body>
          <div class="g-recaptcha" 
               data-sitekey="${siteKey}"
               data-callback="onRecaptchaSuccess"
               data-expired-callback="onRecaptchaExpired"
               data-error-callback="onRecaptchaError">
          </div>
          
          <script>
            function onRecaptchaSuccess(token) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'success',
                token: token
              }));
            }
            
            function onRecaptchaExpired() {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'expired'
              }));
            }
            
            function onRecaptchaError() {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'error'
              }));
            }
          </script>
        </body>
      </html>
    `;
  };

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      switch (data.type) {
        case 'success':
          onVerify && onVerify(data.token);
          break;
        case 'expired':
          onExpire && onExpire();
          break;
        case 'error':
          onError && onError();
          break;
      }
    } catch (error) {
      console.error('Error parsing reCAPTCHA message:', error);
      onError && onError();
    }
  };



  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Security Verification</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          {/* Loading indicator */}
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2274F0" />
              <Text style={styles.loadingText}>Loading verification...</Text>
            </View>
          )}
          
          {/* WebView */}
          <WebView
            ref={webViewRef}
            source={{ html: generateHTML() }}
            style={[styles.webView, { opacity: loading ? 0 : 1 }]}
            onMessage={handleMessage}
            onLoadEnd={() => setLoading(false)}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            originWhitelist={['*']}
            mixedContentMode="compatibility"
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#f8f9fa',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  webView: {
    height: 300,
    backgroundColor: 'transparent',
  },
});

export default ReCaptcha;