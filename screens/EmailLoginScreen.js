import React, { useState, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Dimensions, ActivityIndicator, Modal, Pressable, Platform, Linking, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabaseClient';
import Icon from 'react-native-vector-icons/Ionicons';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import Toast from 'react-native-toast-message';
import { CheckBox } from '@react-native-community/checkbox';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { setupAuthLinking, handleGoogleSignIn } from '../utils/linkingConfig';
import { debugGoogleAuth, testRedirectMethods } from '../utils/googleAuthDebug';
const { width } = Dimensions.get('window');
import { useTheme } from '../context/ThemeContext';

// Generate a nonce for security purposes
const generateNonce = (length = 32) => {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return result;
};

    const EmailLoginScreen = ({ navigation }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [isChecked, setChecked] = useState(false);
    const { getThemeColors } = useTheme();
    const colors = getThemeColors();

    useEffect(() => {
        // Configure Google Sign-In only for iOS
        if (Platform.OS === 'ios') {
            GoogleSignin.configure({
                iosClientId: '1046714115920-vk3nng2cli9ggeo7cdg9jd87g1620bbk.apps.googleusercontent.com',
                webClientId: '1046714115920-vk3nng2cli9ggeo7cdg9jd87g1620bbk.apps.googleusercontent.com',
                scopes: ['profile', 'email'],
                offlineAccess: true,
            });
        }
        
        // Set up deep link handler for auth callbacks
        const unsubscribe = setupAuthLinking(navigation);
        
        return unsubscribe;
    }, [navigation]);

    // Handle Google login - direct implementation without the utility
    const handleDirectGoogleLogin = async () => {
        if (Platform.OS !== 'ios') {
            Toast.show({
                type: 'info',
                text1: 'Info',
                text2: 'Google login is only available on iOS',
                position: 'bottom'
            });
            return;
        }

        try {
            setGoogleLoading(true);
            
            // Use direct Supabase OAuth flow with the supabase callback
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: 'https://ddtgdhehxhgarkonvpfq.supabase.co/auth/v1/callback'
                }
            });
            
            if (error) throw error;
            
            console.log('Google auth URL:', data?.url);
            
            // Open the URL to start the OAuth flow
            if (data?.url) {
                await Linking.openURL(data.url);
            }
            
        } catch (error) {
            console.error('Error during Google login:', error);
            Toast.show({
                type: 'error',
                text1: 'Login Failed',
                text2: error.message || 'Failed to login with Google',
                position: 'bottom'
            });
        } finally {
            setGoogleLoading(false);
        }
    };
    
    // Debug Google auth flow
    const debugAuth = async () => {
        try {
            const result = await debugGoogleAuth();
            console.log('Debug result:', result);
            
            // Show the results in an alert
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
            console.error('Error in debugAuth:', error);
            Alert.alert('Debug Error', error.message || 'Unknown error');
        }
    };

    const handleLogin = async () => {
        // Validate email and password
        if (email.trim() === '' || !email.includes('@')) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Please enter a valid email address!',
                position: 'bottom'
            });
            return;
        }

        if (password.trim() === '' || password.length < 6) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Please enter a valid password (minimum 6 characters)!',
                position: 'bottom'
            });
            return;
        }
    
        setLoading(true);
    
        try {
            // First, try online authentication with Supabase
            try {
                // Implement retry logic for network issues
                const loginWithRetry = async (retries = 3, delay = 1000) => {
                    for (let attempt = 0; attempt < retries; attempt++) {
                        try {
                            // Use a promise with timeout to handle network issues
                            const loginPromise = supabase.auth.signInWithPassword({
                                email: email.trim(),
                                password: password.trim()
                            });
                            
                            // Create a timeout promise
                            const timeoutPromise = new Promise((_, reject) => 
                                setTimeout(() => reject(new Error('Login request timed out')), 10000)
                            );
                            
                            // Race the promises - whichever resolves/rejects first wins
                            const result = await Promise.race([loginPromise, timeoutPromise]);
                            return result;
                        } catch (error) {
                            console.log(`Login attempt ${attempt + 1} failed:`, error.message);
                            
                            // If this was the last attempt, throw the error
                            if (attempt === retries - 1) throw error;
                            
                            // Otherwise wait before retrying
                            await new Promise(resolve => setTimeout(resolve, delay));
                            // Increase delay for next attempt
                            delay *= 1.5;
                        }
                    }
                };
                
                // Attempt login with retry
                const { data, error } = await loginWithRetry();

                if (error) {
                    // Check if the error is about user not registered
                    if (error.message.includes('Invalid login credentials') || 
                        error.message.includes('Email not confirmed')) {
                        
                        // Check if the user exists but is not registered
                        const { data: userData, error: userError } = await supabase.auth.admin.getUserByEmail(email.trim());
                        
                        if (userError || !userData) {
                            // User doesn't exist, navigate to signup
                            Toast.show({
                                type: 'info',
                                text1: 'User not found',
                                text2: 'Please sign up to create an account.',
                                position: 'bottom'
                            });
                            
                            navigation.navigate('SignUpDetails', {
                                email: email.trim(),
                                disableEmailInput: false,
                            });
                            return;
                        }
                        
                        // User exists but email not confirmed
                        if (error.message.includes('Email not confirmed')) {
                            Toast.show({
                                type: 'info',
                                text1: 'Email not verified',
                                text2: 'Please verify your email to continue.',
                                position: 'bottom'
                            });
                            
                            navigation.navigate('EmailVerification', { 
                                email: email.trim(),
                                message: 'Please verify your email to continue.'
                            });
                            return;
                        }
                    }
                    
                    throw error;
                }
                
                // Check if email is verified
                if (data.user && !data.user.email_confirmed_at) {
                    Toast.show({
                        type: 'info',
                        text1: 'Email not verified',
                        text2: 'Please verify your email to continue.',
                        position: 'bottom'
                    });
                    
                    navigation.navigate('EmailVerification', { 
                        email: email.trim(),
                        message: 'Please verify your email to continue.'
                    });
                    return;
                }
        
                // If we have user data in the response
                if (data.user?.id) {
                    // Store session data
                    await AsyncStorage.setItem('supabase-session', JSON.stringify(data.session));
                    
                    // Store user credentials for possible offline authentication
                    await AsyncStorage.setItem('auth_credentials', JSON.stringify({
                        email: email.trim(),
                        // Store the password hash or a token instead of plain password in a real app
                        passwordHash: btoa(password.trim())
                    }));
                    
                    // Store user data
                    await AsyncStorage.setItem('uid', data.user.id);
                    await AsyncStorage.setItem('userLoggedIn', 'true');
                    
                    // Manual refresh of auth state since the listener may not trigger
                    // This will update the AuthContext state
                    const { error: refreshError } = await supabase.auth.refreshSession();
                    if (refreshError) {
                        console.log('Warning: Failed to refresh session after login:', refreshError.message);
                    }
                    
                    Toast.show({
                        type: 'success',
                        text1: 'Success',
                        text2: 'Login successful!',
                        position: 'bottom'
                    });
                    
                    // Add a small delay to ensure AsyncStorage is updated
                    await new Promise(resolve => setTimeout(resolve, 300));
                    
                    // Navigate to main screen
                    navigation.replace('Home');
                    return;
                } else {
                    throw new Error('No user data in response');
                }
            } catch (onlineError) {
                // If online authentication fails, try offline fallback
                console.log('Online authentication failed, trying offline fallback:', onlineError);
                
                if (
                    onlineError.message.includes('Network request failed') || 
                    onlineError.message.includes('timed out') ||
                    onlineError.message.includes('network')
                ) {
                    // Try to authenticate with stored credentials
                    const storedCredentialsString = await AsyncStorage.getItem('auth_credentials');
                    const storedUid = await AsyncStorage.getItem('uid');
                    
                    if (storedCredentialsString && storedUid) {
                        try {
                            const storedCredentials = JSON.parse(storedCredentialsString);
                            
                            // Simple credential check - in a real app, use a more secure method
                            if (
                                storedCredentials.email === email.trim() && 
                                storedCredentials.passwordHash === btoa(password.trim())
                            ) {
                                console.log('Offline authentication successful');
                                
                                // Set user as logged in
                                await AsyncStorage.setItem('userLoggedIn', 'true');
                                
                                Toast.show({
                                    type: 'success',
                                    text1: 'Success',
                                    text2: 'Logged in (offline mode)',
                                    position: 'bottom'
                                });
                                
                                // Navigate to main screen
                                navigation.replace('Home');
                                return;
                            } else {
                                throw new Error('Invalid credentials for offline login');
                            }
                        } catch (offlineError) {
                            console.error('Offline authentication failed:', offlineError);
                            throw new Error('Failed to authenticate in offline mode: ' + offlineError.message);
                        }
                    } else {
                        throw new Error('No stored credentials for offline login');
                    }
                } else {
                    // Not a network error, rethrow
                    throw onlineError;
                }
            }
        } catch (error) {
            console.error('Error during login:', error);
            
            // Handle specific network errors
            let errorMessage = error.message || 'Login failed. Please try again.';
            if (
                error.message.includes('Network request failed') || 
                error.message.includes('timed out') ||
                error.message.includes('network')
            ) {
                errorMessage = 'Network error. Please check your internet connection and try again. If you\'ve logged in before, we\'ll try to authenticate you offline.';
            }
            
            Toast.show({
                type: 'error',
                text1: 'Login Failed',
                text2: errorMessage,
                position: 'bottom'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSignUp = () => {
        navigation.navigate('SignUpDetails', {
            email: email.trim() || '', // Pass the entered email if available
            disableEmailInput: false, // Allow email input on SignUpDetails screen
        });
    };

    const handleForgotPassword = () => {
        navigation.navigate('ForgotPassword');
    };

    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword);
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Back Button */}
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <View style={styles.backButtonCircle}>
                    <Icon name="arrow-back" size={20} color="#fff" />
                </View>
            </TouchableOpacity>

            {/* Heading */}
            <Text style={[styles.heading, { color: colors.text }]}>Log in and unlock{'\n'}the digital universe</Text>

            {/* Email Input */}
            <View style={styles.inputContainer}>
                <Icon name="mail-outline" size={20} color="#aaa" style={styles.inputIcon} />
                <TextInput
                    style={[styles.input, { color: colors.text }]}
                    placeholder="Email"
                    placeholderTextColor="#aaa"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                />
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
                <Icon name="lock-closed-outline" size={20} color="#aaa" style={styles.inputIcon} />
                <TextInput
                    style={[styles.input, { color: colors.text }]}
                    placeholder="Password"
                    placeholderTextColor="#aaa"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                />
                <TouchableOpacity onPress={togglePasswordVisibility} style={styles.eyeIcon}>
                    <Icon 
                        name={showPassword ? "eye-off-outline" : "eye-outline"} 
                        size={20} 
                        color="#aaa" 
                    />
                </TouchableOpacity>
            </View>
            {/* <View style={styles.TermsContainer}>
                <CheckBox
                    value={isChecked}
                    onValueChange={setChecked}
                />
                <Text style={styles.TermsText}>By logging in, you agree to our</Text>
                <TouchableOpacity style={styles.TermsLink} onPress={() => navigation.navigate('TermsOfService')}>
                    <Text style={styles.TermsLinkText}>Terms of Service</Text>
                </TouchableOpacity>
            </View> */}
            {/* Forgot Password Link */}
            <TouchableOpacity style={styles.forgotPasswordContainer} onPress={handleForgotPassword}>
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* Login Button */}
            <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
                {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                ) : (
                    <Text style={styles.loginButtonText}>Login</Text>
                )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerContainer}>
                <View style={styles.divider} />
                <Text style={styles.orText}>or continue with</Text>
                <View style={styles.divider} />
            </View>

            {/* Social Buttons */}
            <View style={styles.socialButtonsContainer}>
                <TouchableOpacity 
                    style={[styles.socialButton, googleLoading && styles.disabledButton]}
                    onPress={handleDirectGoogleLogin}
                    disabled={googleLoading}
                >
                    {googleLoading ? (
                        <ActivityIndicator size="small" color="#DB4437" />
                    ) : (
                        <FontAwesome name="google" size={24} color="#DB4437" />
                    )}
                </TouchableOpacity>
               
                <TouchableOpacity style={styles.socialButton}>
                    <FontAwesome name="apple" size={24} color="#000" />
                </TouchableOpacity>
                
                {/* Debug button - hidden in production */}
                {__DEV__ && (
                    <TouchableOpacity 
                        style={styles.socialButton}
                        onPress={debugAuth}
                    >
                        <FontAwesome name="bug" size={24} color="#333" />
                    </TouchableOpacity>
                )}
            </View>

            {/* Sign Up Link */}
            <Text style={[styles.signupText, { color: colors.text }]}>
                Don't have an account?
                <Text style={styles.signupLink} onPress={handleSignUp}> Sign up</Text>
            </Text>

            {/* Privacy Policy and Terms */}
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
        backgroundColor: '#fff',
        padding: 20,
        alignItems: 'center',
    },
    backButton: {
        position: 'absolute',
        top: 50,
        left: 20,
    },
    backButtonCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#2274F0',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#aaa',
    },
    heading: {
        fontSize: 26,
        fontWeight: 'bold',
        textAlign: 'center',
        marginTop: 80,
        marginBottom: 40,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 10,
        width: '100%',
        marginBottom: 20,
        paddingHorizontal: 15,
        paddingVertical: 12,
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: '#000',
    },
    eyeIcon: {
        padding: 5,
    },
    forgotPasswordContainer: {
        alignSelf: 'flex-end',
        marginBottom: 20,
    },
    forgotPasswordText: {
        color: '#2274F0',
        fontSize: 14,
    },
    loginButton: {
        backgroundColor: '#2274F0',
        paddingVertical: 12,
        borderRadius: 30,
        width: '90%',
        alignItems: 'center',
        marginBottom: 20,
    },
    loginButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'medium',
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 10,
        width: '100%',
    },
    divider: {
        flex: 1,
        height: 1,
        backgroundColor: '#ddd',
    },
    orText: {
        marginHorizontal: 10,
        color: '#aaa',
        fontSize: 14,
    },
    socialButtonsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '80%',
        marginVertical: 10,
    },
    socialButton: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 50,
        padding: 10,
        width: 50,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
    },
    disabledButton: {
        opacity: 0.7,
    },
    signupText: {
        fontSize: 14,
        color: '#000',
        marginTop: 10,
    },
    signupLink: {
        color: '#2274F0',
        fontWeight: 'bold',
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

export default EmailLoginScreen;
