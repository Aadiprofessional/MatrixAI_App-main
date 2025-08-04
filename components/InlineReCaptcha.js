import React, { useState, useRef } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { WebView } from 'react-native-webview';

const InlineReCaptcha = ({ 
  siteKey = '6LeyxJQrAAAAAFq5BOxxjRcrc6sK04cDbbQBQNWb',
  onVerify,
  onExpire,
  onError,
  theme = 'light',
  style
}) => {
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
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
              padding: 0;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100px;
              background-color: transparent;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            .recaptcha-container {
              display: flex;
              justify-content: center;
              align-items: center;
              width: 100%;
              padding: 10px;
            }
            .g-recaptcha {
              transform: scale(0.85);
              transform-origin: center;
            }
          </style>
        </head>
        <body>
          <div class="recaptcha-container">
            <div class="g-recaptcha" 
                 data-sitekey="${siteKey}"
                 data-theme="${theme}"
                 data-callback="onRecaptchaSuccess"
                 data-expired-callback="onRecaptchaExpired"
                 data-error-callback="onRecaptchaError">
            </div>
          </div>
          
          <script>
            function onRecaptchaSuccess(token) {
              console.log('reCAPTCHA Success:', token);
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'success',
                token: token
              }));
            }
            
            function onRecaptchaExpired() {
              console.log('reCAPTCHA Expired');
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'expired'
              }));
            }
            
            function onRecaptchaError(error) {
              console.log('reCAPTCHA Error:', error);
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'error',
                error: error
              }));
            }
            
            // Check if reCAPTCHA loaded successfully
            window.addEventListener('load', function() {
              setTimeout(function() {
                if (typeof grecaptcha === 'undefined') {
                  console.error('reCAPTCHA failed to load');
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'error',
                    error: 'Failed to load reCAPTCHA'
                  }));
                }
              }, 3000);
            });
          </script>
        </body>
      </html>
    `;
  };

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('reCAPTCHA message received:', data);
      
      switch (data.type) {
        case 'success':
          setVerified(true);
          onVerify && onVerify(data.token);
          break;
        case 'expired':
          setVerified(false);
          onExpire && onExpire();
          break;
        case 'error':
          setVerified(false);
          onError && onError(data.error || 'reCAPTCHA error');
          break;
      }
    } catch (error) {
      console.error('Error parsing reCAPTCHA message:', error);
      onError && onError('Message parsing error');
    }
  };

  const resetCaptcha = () => {
    setVerified(false);
    if (webViewRef.current) {
      webViewRef.current.reload();
    }
  };

  return (
    <View style={[styles.container, style]}>
      {loading && (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading verification...</Text>
        </View>
      )}
      <WebView
        ref={webViewRef}
        source={{ html: generateHTML() }}
        style={[styles.webView, { opacity: loading ? 0 : 1 }]}
        onMessage={handleMessage}
        onLoadEnd={() => setLoading(false)}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('WebView error:', nativeEvent);
          onError && onError('WebView loading error');
        }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
        mixedContentMode="compatibility"
        scrollEnabled={false}
        bounces={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 80,
    width: '100%',
    marginVertical: 10,
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
    zIndex: 1,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
  },
  webView: {
    height: 80,
    backgroundColor: 'transparent',
  },
});

// Expose resetCaptcha method
InlineReCaptcha.resetCaptcha = (ref) => {
  if (ref && ref.current) {
    ref.current.resetCaptcha();
  }
};

export default InlineReCaptcha;