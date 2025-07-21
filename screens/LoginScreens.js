import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert, ActivityIndicator, Linking } from 'react-native';
import { supabase } from '../supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { SafeAreaView } from 'react-native-safe-area-context';
import { setupAuthLinking, handleGoogleSignIn } from '../utils/linkingConfig';
import { debugGoogleAuth } from '../utils/googleAuthDebug';
import { useTheme } from '../context/ThemeContext';

// Generate a nonce at app startup
const generateNonce = (length = 32) => {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return result;
};

const LoginScreen = ({ navigation }) => {
  const [isLoading, setIsLoading] = useState(false);
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();

  useEffect(() => {
    // Configure Google Sign-In only once when component mounts
    GoogleSignin.configure({
      webClientId: '1046714115920-vk3nng2cli9ggeo7cdg9jd87g1620bbk.apps.googleusercontent.com',
      iosClientId: '1046714115920-vk3nng2cli9ggeo7cdg9jd87g1620bbk.apps.googleusercontent.com',
      offlineAccess: true,
      scopes: ['profile', 'email']
    });

    // Set up deep link handler for auth callbacks
    const unsubscribe = setupAuthLinking(navigation);
    
    return unsubscribe;
  }, [navigation]);

  // Helper function to decode JWT token
  const decodeJWT = (token) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => 
        '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      ).join(''));
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error decoding JWT:', error);
      return null;
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      console.log('Starting Google Sign-In process...');
      
      // Use direct OAuth flow with Supabase callback
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'https://ddtgdhehxhgarkonvpfq.supabase.co/auth/v1/callback',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      });
      
      if (error) throw error;
      
      console.log('Google auth URL:', data?.url);
      
      // Open the URL to start the OAuth flow
      if (data?.url) {
        await Linking.openURL(data.url);
      }
      
    } catch (error) {
      console.error('Detailed error:', error);
      Alert.alert('Error', `Failed to login with Google: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Debug helper for Google OAuth
  const debugGoogleSignIn = async () => {
    try {
      const result = await debugGoogleAuth();
      console.log('Debug result:', result);
      
      if (result.success) {
        // Create a message with validation information
        let message = `Redirect URI:\n${result.redirectUri}\n\n`;
        message += `Client ID:\n${result.clientId}\n\n`;
        
        if (result.validation) {
          message += 'VALIDATION:\n';
          message += `• ${result.validation.issues.join('\n• ')}\n\n`;
          
          if (result.validation.suggestions && result.validation.suggestions.length) {
            message += 'SUGGESTED URIS TO TRY:\n';
            message += `• ${result.validation.suggestions.join('\n• ')}`;
          }
        }
        
        Alert.alert(
          'Debug Info (Copy to fix in Google Cloud)',
          message,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Debug Error', result.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error in debugGoogleSignIn:', error);
      Alert.alert('Debug Error', error.message);
    }
  };

  // Social Login
  const handleSocialLogin = async (provider) => {
    Alert.alert('Coming Soon', 'This login method will be available soon!');
  };

  // Phone OTP Login
  const handlePhoneLogin = () => {
    navigation.navigate('EmailLogin');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Logo Image */}
      <Image
        source={require('../assets/logo.png')} // Replace with your logo path
        style={styles.logo}
      />

      {/* Welcome Text */}
      <Text style={[styles.title, { color: colors.text }] }>Let's Get Started!</Text>

      {/* Social Login Buttons */}
    

      <TouchableOpacity
        style={[styles.socialButton, isLoading && styles.disabledButton]}
        onPress={handleGoogleLogin}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#2274F0" />
        ) : (
          <>
            <Image source={require('../assets/google.png')} style={styles.icon} />
            <Text style={styles.buttonText}>Continue with Google</Text>
          </>
        )}
      </TouchableOpacity>
      
      {/* Debug button - only shown in development */}
      {__DEV__ && (
        <TouchableOpacity
          style={[styles.socialButton, { marginTop: 5, backgroundColor: '#f0f0f0' }]}
          onPress={debugGoogleSignIn}
        >
          <Text style={[styles.buttonText, { color: '#333' }]}>Debug Google Sign-In</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={styles.socialButton}
        onPress={() => handleSocialLogin('apple')}
      >
        <Image source={require('../assets/apple.png')} style={styles.icon} />
        <Text style={styles.buttonText}>Continue with Apple</Text>
      </TouchableOpacity>

      {/* Or Separator */}
      <Text style={styles.orText}>or</Text>

      {/* Phone Login Button */}
      <TouchableOpacity style={styles.phoneButton} onPress={handlePhoneLogin}>
        <Text style={styles.phoneButtonText}>Sign in</Text>
      </TouchableOpacity>

      {/* Footer */}
      <Text style={styles.footerText}>
        Don't have an account?{' '}
        <Text style={styles.signUpText} onPress={() => navigation.navigate('SignUpDetails')}>
          Register
        </Text>
      </Text>

      <View style={styles.footer}>
                <TouchableOpacity onPress={() => navigation.navigate('PrivacyPolicy')}>
                    <Text style={styles.footerLink}>Privacy Policy</Text>
                </TouchableOpacity>
                <Text style={styles.separator}> | </Text>
                <TouchableOpacity onPress={() => navigation.navigate('TermsOfService')}>
                    <Text style={styles.footerLink}>Terms of Service</Text>
                </TouchableOpacity>
            </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
  },
  logo: {
    width: 200,
    height: 200,
    marginBottom: 10,
    resizeMode: 'contain',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 10,
    width: '90%',
    marginVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CCCCCCE8',
  },
  icon: {
    width: 24,
    height: 24,
    marginRight: 10,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  orText: {
    marginVertical: 10,
    fontSize: 16,
    color: '#888',
  },
  phoneButton: {
    backgroundColor: '#2274F0',
    width: '90%',
    padding: 15,
    borderRadius: 30,
    alignItems: 'center',
  },
  phoneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  signUpText: {
    color: '#2274F0',
    fontWeight: 'bold',
  },

  disabledButton: {
    opacity: 0.7,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
    width: '100%',
},
footerText: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 10,
},
footerLink: {
    color: '#aaa',
    fontSize: 12,
},
separator: {
    color: '#aaa',
    fontSize: 12,
    marginHorizontal: 5,
},
TermsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
    width: '100%',
},
TermsText: {
    fontSize: 12,
    color: '#aaa',
},
TermsLink: {
    fontSize: 12,
    color: '#2274F0',
},
TermsLinkText: {
    fontSize: 12,
    color: '#2274F0',
},
});

export default LoginScreen;
