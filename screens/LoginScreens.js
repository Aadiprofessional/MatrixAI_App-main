import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert, ActivityIndicator, Linking, Platform } from 'react-native';
import { supabase } from '../supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { SafeAreaView } from 'react-native-safe-area-context';
import { setupAuthLinking, handleGoogleSignIn } from '../utils/linkingConfig';
import { debugGoogleAuth } from '../utils/googleAuthDebug';
import { useTheme } from '../context/ThemeContext';
import Toast from 'react-native-toast-message';

// Generate a nonce for security purposes
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

  // Set up deep linking for auth callbacks and configure Google Sign-In when component mounts
  useEffect(() => {
    // Configure Google Sign-In only for iOS
    if (Platform.OS === 'ios') {
      GoogleSignin.configure({
        iosClientId: '1046714115920-65tdshvb39klvm651lr25sb4r1620gm3.apps.googleusercontent.com',
        webClientId: '1046714115920-65tdshvb39klvm651lr25sb4r1620gm3.apps.googleusercontent.com',
        scopes: ['profile', 'email'],
        offlineAccess: true,
      });
    }
    
    const unsubscribe = setupAuthLinking(navigation);
    return () => {
      unsubscribe();
    };
  }, [navigation]);

  // Handle Google login
  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      console.log('=== GOOGLE LOGIN FLOW START ===');
      console.log('Starting Google login process...');
      console.log('Platform:', Platform.OS);
      // Check if Google Sign-In is configured
      try {
        const isSignedIn = await GoogleSignin.isSignedIn();
        console.log('Is user already signed in with Google?', isSignedIn);
      } catch (configError) {
        console.log('Error checking Google Sign-In configuration:', configError);
      }
      
      // For iOS, use the native GoogleSignin SDK
      if (Platform.OS === 'ios') {
        try {
          // Check if user is already signed in with Google
          await GoogleSignin.hasPlayServices();
          console.log('Google Play Services available');
          
          const userInfo = await GoogleSignin.signIn();
          console.log('Google Sign-In successful, user info received:', JSON.stringify(userInfo, null, 2));
          
          // Extract the ID token from the userInfo object
          console.log('Extracting ID token from userInfo structure...');
          
          // Log the structure of userInfo to understand where the token is located
          console.log('userInfo structure keys:', Object.keys(userInfo));
          
          // Try different paths to extract the token
          let idToken = null;
          
          if (userInfo?.idToken) {
            idToken = userInfo.idToken;
            console.log('ID token found directly in userInfo.idToken');
          } else if (userInfo?.data?.idToken) {
            idToken = userInfo.data.idToken;
            console.log('ID token found in userInfo.data.idToken');
          } else {
            // Try to find the token in the response structure
            console.log('Searching for ID token in response structure...');
            
            // Check if we have a token in the response
            if (typeof userInfo === 'object' && userInfo !== null) {
              // Recursively search for a property that looks like an ID token
              const findIdToken = (obj, path = '') => {
                if (!obj || typeof obj !== 'object') return null;
                
                for (const key in obj) {
                  const currentPath = path ? `${path}.${key}` : key;
                  
                  // Check if this property looks like a JWT token
                  if (
                    typeof obj[key] === 'string' && 
                    obj[key].length > 100 && 
                    obj[key].split('.').length === 3 && 
                    (key.toLowerCase().includes('token') || key.toLowerCase().includes('id'))
                  ) {
                    console.log(`Found potential ID token at path: ${currentPath}`);
                    return obj[key];
                  }
                  
                  // Recursively search nested objects
                  if (typeof obj[key] === 'object' && obj[key] !== null) {
                    const result = findIdToken(obj[key], currentPath);
                    if (result) return result;
                  }
                }
                
                return null;
              };
              
              idToken = findIdToken(userInfo);
            }
          }
          
          if (idToken) {
            console.log('Got Google ID token, authenticating with Supabase...');
            console.log('ID token type:', typeof idToken);
            console.log('ID token length:', idToken.length);
            console.log('ID token first 10 chars:', idToken.substring(0, 10) + '...');
            const nonce = generateNonce();
            console.log('Generated nonce for security');
            
            const { data, error } = await supabase.auth.signInWithIdToken({
              provider: 'google',
              token: idToken,
              nonce: nonce,
            });
            
            console.log('Supabase signInWithIdToken called with token:', idToken.substring(0, 10) + '...');
            
            if (error) {
              console.error('Supabase ID token auth error:', error);
              console.error('Full error object:', JSON.stringify(error, null, 2));
              throw error;
            }
            
            // Handle successful sign-in
            if (data?.user) {
              console.log('Successfully signed in with Google ID token');
              console.log('User ID:', data.user.id);
              console.log('User email:', data.user.email);
              console.log('User metadata:', JSON.stringify(data.user.user_metadata, null, 2));
              console.log('Session:', data.session ? 'Valid session' : 'No session');
              
              // Store session and user data
              try {
                await AsyncStorage.setItem('supabase-session', JSON.stringify(data.session));
                await AsyncStorage.setItem('uid', data.user.id);
                await AsyncStorage.setItem('userLoggedIn', 'true');
                await AsyncStorage.setItem('user', JSON.stringify(data.user));
                console.log('User data stored in AsyncStorage successfully');
              } catch (storageError) {
                console.error('Error storing session data:', storageError);
              }
              
              // Check if user exists in users table
              console.log('Checking if user exists in database...');
              try {
                // Use maybeSingle instead of single to avoid the error when no rows are returned
                const { data: userData, error: userError } = await supabase
                  .from('users')
                  .select('*')
                  .eq('uid', data.user.id)
                  .maybeSingle();
                
                if (userError) {
                  console.error('Error checking user existence:', userError.message);
                  console.error('Full user error object:', JSON.stringify(userError, null, 2));
                }
                
                if (!userData) {
                  console.log('User does not exist in database, checking if email exists');
                  // User doesn't exist by UID, but might exist by email
                  const userInfo = {
                    uid: data.user.id,
                    id: data.user.id,
                    email: data.user.email,
                    name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || '',
                    dp_url: data.user.user_metadata?.picture || '',
                    phone: data.user.phone || ''
                  };
                  
                  // First check if a user with this email already exists
                  const { data: existingUserByEmail, error: emailCheckError } = await supabase
                    .from('users')
                    .select('*')
                    .eq('email', data.user.email)
                    .maybeSingle();
                  
                  if (emailCheckError) {
                    console.error('Error checking email existence:', emailCheckError);
                  }
                  
                  if (existingUserByEmail) {
                    console.log('User with this email already exists, skipping UID update due to foreign key constraints');
                    console.log('Existing user data:', JSON.stringify(existingUserByEmail, null, 2));
                    
                    // Don't try to update UID as it causes foreign key constraint issues
                    // Just navigate to Home since the user exists
                    
                    // Store the session data in AsyncStorage
                    try {
                      await AsyncStorage.setItem('uid', data.user.id);
                      await AsyncStorage.setItem('userLoggedIn', 'true');
                      
                      // Store the session token if available
                      const { data: sessionData } = await supabase.auth.getSession();
                      if (sessionData?.session?.access_token) {
                        await AsyncStorage.setItem('token', sessionData.session.access_token);
                        console.log('Session token stored in AsyncStorage');
                      }
                      
                      // Verify data was stored correctly
                      const storedUid = await AsyncStorage.getItem('uid');
                      const userLoggedIn = await AsyncStorage.getItem('userLoggedIn');
                      console.log('Verified login data stored:', {
                        uidStored: !!storedUid,
                        loggedInFlagSet: userLoggedIn === 'true'
                      });
                      
                      console.log('Session data stored in AsyncStorage');
                    } catch (storageError) {
                      console.error('Error storing session data:', storageError);
                    }
                    
                    // Navigate to Home screen
                    setTimeout(() => {
                      navigation.reset({
                        index: 0,
                        routes: [{ name: 'Home' }],
                      });
                    }, 500);
                    return;
                  }
                  
                  // Generate a random referral code
                  const generateReferralCode = () => {
                    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                    let result = '';
                    for (let i = 0; i < 6; i++) {
                      result += chars.charAt(Math.floor(Math.random() * chars.length));
                    }
                    return result;
                  };
                  
                  // Create user in the database directly
                  const newReferralCode = generateReferralCode();
                  const newUserData = {
                    uid: data.user.id,
                    name: userInfo.name,
                    email: userInfo.email,
                    age: 0, // Default value
                    gender: 'Not specified', // Default value
                    preferred_language: 'English', // Default value
                    referral_code: newReferralCode,
                    user_coins: 0,
                    invited_members: [],
                    referred_by: null,
                    dp_url: userInfo.avatar_url
                  };
                  
                  console.log('Creating new user in database:', JSON.stringify(newUserData, null, 2));
                  
                  // Try to insert the user
                  const { error: insertError } = await supabase
                    .from('users')
                    .insert([newUserData]);
                  
                  if (insertError) {
                    console.error('Error creating user in database:', insertError);
                    // If insert fails, try upsert as fallback
                    const { error: upsertError } = await supabase
                      .from('users')
                      .upsert([newUserData], { onConflict: 'uid' });
                      
                    if (upsertError) {
                      console.error('Error upserting user in database:', upsertError);
                      // If both fail, navigate to SignUpDetails as fallback
                      console.log('Navigating to SignUpDetails with user info as fallback');
                      navigation.navigate('SignUpDetails', { userInfo });
                      return;
                    }
                  }
                  
                  // User created successfully, navigate to Home
                  console.log('New user created successfully, navigating to Home');
                  setTimeout(() => {
                    navigation.reset({
                      index: 0,
                      routes: [{ name: 'Home' }],
                    });
                  }, 500);
                  return;
                }
                
                // User exists, go to main screen
                console.log('User exists in database, navigating to Home screen');
                console.log('User data from database:', JSON.stringify(userData, null, 2));
                
                // Add a slight delay before navigation to ensure all async operations complete
                console.log('Setting timeout for navigation...');
                setTimeout(() => {
                  console.log('Executing navigation.reset to Home...');
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'Home' }],
                  });
                  console.log('Navigation.reset executed');
                }, 500);
              } catch (dbError) {
                console.error('Database operation error:', dbError);
                showError('Failed to check user in database');
              }
            } else {
              console.log('No user data returned from Supabase');
              console.log('Full Supabase response:', JSON.stringify(data, null, 2));
            }
          } else {
            console.log('No ID token found in Google Sign-In response');
            console.log('Full userInfo object:', JSON.stringify(userInfo, null, 2));
            
            // Try to extract user info for debugging
            const user = userInfo?.user || userInfo?.data?.user;
            if (user) {
              console.log('User info extracted from response:', JSON.stringify(user, null, 2));
              console.log('User email:', user.email);
              console.log('User ID:', user.id);
              console.log('User name:', user.name);
            }
            
            // Check if we have enough user information to proceed with OAuth flow
            if (user && user.email) {
              console.log('We have user email but no ID token, falling back to OAuth flow');
              throw new Error('No ID token found in Google Sign-In response, but user info is available');
            } else {
              console.log('No user information available, cannot proceed');
              throw new Error('Google Sign-In failed: No ID token or user information available');
            }
          }
        } catch (googleError) {
          console.error('Native Google Sign-In error:', googleError);
          console.error('Error details:', JSON.stringify(googleError, null, 2));
          
          // Determine if this is a recoverable error that should trigger OAuth fallback
          const errorMessage = googleError.message || '';
          const isRecoverableError = (
            errorMessage.includes('No ID token') || 
            errorMessage.includes('cancelled') || 
            errorMessage.includes('network') ||
            errorMessage.includes('failed')
          );
          
          if (isRecoverableError) {
            // Fall back to OAuth flow if native sign-in fails with a recoverable error
            console.log('Falling back to OAuth flow due to recoverable error:', errorMessage);
            await handleGoogleSignIn(setIsLoading, showError);
          } else {
            // For non-recoverable errors, just show the error
            console.error('Non-recoverable Google Sign-In error:', errorMessage);
            throw new Error(`Google Sign-In failed: ${errorMessage}`);
          }
        }
      } else {
        // For other platforms, use the OAuth flow
        console.log('Using OAuth flow for non-iOS platform');
        await handleGoogleSignIn(setIsLoading, showError);
      }
    } catch (error) {
      console.error('Google login error:', error);
      console.error('Full error details:', JSON.stringify(error, null, 2));
      showError(error.message);
    } finally {
      console.log('=== GOOGLE LOGIN FLOW END ===');
      setIsLoading(false);
    }
  };

  // Handle Apple login
  const handleSocialLogin = async (provider) => {
    try {
      setIsLoading(true);
      
      if (provider === 'apple') {
        // Import appleAuth dynamically to avoid issues on Android
        const { appleAuth } = require('@invertase/react-native-apple-authentication');
        
        // Check if Apple Authentication is available on this device
        if (!appleAuth.isSupported) {
          Toast.show({
            type: 'info',
            text1: 'Info',
            text2: 'Apple login is not available on this device',
            position: 'bottom'
          });
          return;
        }
        
        console.log('Starting Apple authentication...');
        
        // Perform the Apple authentication request
        const appleAuthRequestResponse = await appleAuth.performRequest({
          requestedOperation: appleAuth.Operation.LOGIN,
          requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
        });
        
        // Get the identity token from the response
        const { identityToken } = appleAuthRequestResponse;
        
        if (!identityToken) {
          throw new Error('No identity token returned from Apple');
        }
        
        console.log('Got Apple identity token, authenticating with Supabase...');
        
        // Sign in with Supabase using the identity token
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: identityToken,
        });
        
        if (error) throw error;
        
        // Handle successful sign-in
        if (data?.user) {
          console.log('Successfully signed in with Apple');
          
          // Store session and user data
          await AsyncStorage.setItem('supabase-session', JSON.stringify(data.session));
          await AsyncStorage.setItem('uid', data.user.id);
          await AsyncStorage.setItem('userLoggedIn', 'true');
          await AsyncStorage.setItem('user', JSON.stringify(data.user));
          
          Toast.show({
            type: 'success',
            text1: 'Success',
            text2: 'Login successful!',
            position: 'bottom'
          });
          
          // Check if user exists in users table
          console.log('Checking if user exists in database...');
          try {
            // Use maybeSingle instead of single to avoid the error when no rows are returned
            const { data: userData, error: userError } = await supabase
              .from('users')
              .select('*')
              .eq('uid', data.user.id)
              .maybeSingle();
            
            if (userError) {
              console.error('Error checking user existence:', userError.message);
            }
            
            if (!userData) {
              console.log('User does not exist in database, checking if email exists');
              // User doesn't exist by UID, but might exist by email
              const userInfo = {
                uid: data.user.id,
                id: data.user.id,
                email: data.user.email,
                name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || '',
                dp_url: data.user.user_metadata?.picture || '',
                phone: data.user.phone || ''
              };
              
              // First check if a user with this email already exists
              const { data: existingUserByEmail, error: emailCheckError } = await supabase
                .from('users')
                .select('*')
                .eq('email', data.user.email)
                .maybeSingle();
              
              if (emailCheckError) {
                console.error('Error checking email existence:', emailCheckError);
              }
              
              if (existingUserByEmail) {
                console.log('User exists by email, skipping UID update');
                // User exists by email, navigate to Home
                setTimeout(() => {
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'Home' }],
                  });
                }, 500);
              } else {
                console.log('Creating new user data...');
                // Generate a referral code
                const referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
                
                // Create new user data
                const { data: newUser, error: insertError } = await supabase
                  .from('users')
                  .insert({
                    ...userInfo,
                    referral_code: referralCode,
                    created_at: new Date().toISOString(),
                  })
                  .select()
                  .single();
                
                if (insertError) {
                  console.error('Error inserting new user:', insertError);
                  // Try upsert as a fallback
                  const { data: upsertUser, error: upsertError } = await supabase
                    .from('users')
                    .upsert({
                      ...userInfo,
                      referral_code: referralCode,
                      created_at: new Date().toISOString(),
                    })
                    .select()
                    .single();
                  
                  if (upsertError) {
                    console.error('Error upserting user:', upsertError);
                    throw upsertError;
                  }
                  
                  console.log('User upserted successfully:', upsertUser);
                } else {
                  console.log('User inserted successfully:', newUser);
                }
                
                // Navigate to Home screen
                setTimeout(() => {
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'Home' }],
                  });
                }, 500);
              }
            } else {
              console.log('User exists in database, navigating to Home');
              // User exists, navigate to Home
              setTimeout(() => {
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Home' }],
                });
              }, 500);
            }
          } catch (dbError) {
            console.error('Database operation error:', dbError);
            showError('Failed to check user in database');
          }
        }
      }
    } catch (error) {
      console.error('Social login error:', error);
      
      // Handle specific Apple authentication errors
      if (error.message && error.message.includes('AuthenticationServices.AuthorizationError error 1000')) {
        showError('Apple Sign-In configuration error. Please try again or contact support if the issue persists.');
      } else if (error.message && error.message.includes('AuthenticationServices.AuthorizationError error 1001')) {
        showError('Apple Sign-In was cancelled. Please try again.');
      } else {
        showError(error.message || 'Failed to login with social provider');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to show errors
  const showError = (message) => {
    console.error('Authentication error:', message);
    Toast.show({
      type: 'error',
      text1: 'Authentication Error',
      text2: message || 'An error occurred during authentication',
      position: 'bottom'
    });
  };
  
  // Debug Google Sign-In (kept for reference but not used in UI)
  const debugGoogleSignIn = async () => {
    if (Platform.OS === 'ios') {
      try {
        // Check if Google Sign-In is configured properly
        const isSignedIn = await GoogleSignin.isSignedIn();
        console.log('Is user signed in with Google?', isSignedIn);
        
        if (isSignedIn) {
          // Sign out first to test fresh sign-in
          await GoogleSignin.signOut();
          console.log('Signed out from Google');
        }
        
        // Test the native Google Sign-In
        await GoogleSignin.hasPlayServices();
        const userInfo = await GoogleSignin.signIn();
        console.log('Google Sign-In successful:', userInfo);
        
        Alert.alert(
          'Native Google Sign-In Success',
          JSON.stringify(userInfo, null, 2),
          [{ text: 'OK' }]
        );
      } catch (error) {
        console.error('Native Google Sign-In debug error:', error);
        Alert.alert(
          'Native Google Sign-In Error',
          error.toString(),
          [{ text: 'OK' }]
        );
      }
    } else {
      // Fall back to OAuth debug for non-iOS platforms
      const result = await debugGoogleAuth();
      Alert.alert(
        'Google Auth Debug',
        JSON.stringify(result, null, 2),
        [{ text: 'OK' }]
      );
    }
  };

  // Phone OTP Login
  const handlePhoneLogin = () => {
    navigation.navigate('EmailLogin');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Logo Image */}
      <Image
        source={require('../assets/logo7.png')} // Replace with your logo path
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
      
      {/* Debug button removed */}

      <TouchableOpacity
        style={[styles.socialButton, isLoading && styles.disabledButton]}
        onPress={() => handleSocialLogin('apple')}
        disabled={isLoading}
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
