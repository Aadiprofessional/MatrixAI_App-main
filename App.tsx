import React, { useState, useEffect } from 'react';
import Toast from 'react-native-toast-message';
import { NavigationContainer, getStateFromPath } from '@react-navigation/native';
import { enableScreens } from 'react-native-screens';
import NetInfo from '@react-native-community/netinfo';
import { Linking, Platform } from 'react-native';
import { supabase } from './supabaseClient';


// Import i18n configuration
import './utils/i18n';

enableScreens();
import 'react-native-url-polyfill/auto';
import { createStackNavigator } from '@react-navigation/stack';
import OnboardingScreen from './screens/OnboardingScreen';
import HomeScreen from './screens/HomeScreen.js'; // Import HomeScreen with .js extension
import AIShopScreen from './screens/AiShopScreen';
import ProfileScreen from './screens/ProfileScreen';
import LoginScreen from './screens/LoginScreens';
import OTPCodeScreen from './screens/OTPCodeScreen';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage'; // Import AsyncStorage


import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import EmailVerificationScreen from './screens/EmailVerificationScreen';
import OTPCodeScreen2 from './screens/OTPCodeScreen copy';
import BotScreen from './screens/BotScreen';
import SignUpDetailsScreen from './screens/SignUpDetailsScreen';
import AudioVideoUploadScreen from './screens/AudioVideoUploadScreen';
import TranslateScreen from './screens/TranslateScreen';
import BotScreen2 from './screens/BotScreen copy';

import ImageGenerateScreen from './screens/ImageGenerateScreen';

import CreateImagesScreen from './screens/createImageScreen';
import CreateImagesScreen2 from './screens/createImageScreen copy';
import VideoUploadScreen from './screens/VideoGenerate.js';
import ImageSelectScreen from './screens/ImageSelectScreen.js';
import CreateVideoScreen from './screens/createVideoScreen.js';
import PPTGenerateScreen from './screens/PPTGenerateScreen.js';
import CreatePPTScreen from './screens/createPPTScreen.js';

import ProductDetailScreen from './screens/ProductDetailScreen';
import FillInformationScreen from './screens/FillInformationScreen';
import SuccessScreen from './screens/successScreen';

import ReferralScreen from './screens/coins/ReferralScreen.js';
import SubscriptionScreen from './screens/coins/SubscriptionScreen.js';
import TransactionScreen from './screens/coins/TransactionScreen.js';

import TransactionScreen2 from './screens/coins/TransactionScreen copy.js';
import TimeScreen from './screens/coins/TimeScreen.js';
import { AuthProvider, AuthContext } from './context/AuthContext';

import RemoveBackground from './screens/RemoveBackGround.js';
import { ModalProvider } from './components/ModalContext.js';
import SignUpDetailsScreen2 from './screens/SignUpDetailsScreen copy.js';

import EditProfile from './screens/EditProfile.js';
import SettingsScreen from './screens/SettingsScreen.js';
import CallScreen from './screens/CallScreen.js';



import EmailLoginScreen from './screens/EmailLoginScreen.js';
import TermsOfServiceScreen from './screens/TermsOfServiceScreen.js';
import PrivacyPolicyScreen from './screens/PrivacyPolicyScreen.js';
import BUYSubscription from './screens/coins/BUYSubscription.js';
import { ProStatusProvider } from './hooks/useProStatus.js';
import CustomerSupportScreen from './screens/CustomerSupportScreen.js';
import OrderHistoryScreen from './screens/OrderHistoryScreen.js';
import HelpScreen from './screens/HelpScreen.js';
import AddonScreen from './screens/coins/AddonScreen.js';
import FeedbackScreen from './screens/FeedbackScreen.js';


import PaymentSuccessScreen from './screens/coins/PaymentSuccess.js';
import AntomPaymentScreen from './screens/coins/AntomPaymentScreen';
import PaymentWebView from './screens/coins/PaymentWebView';


// Import the LanguageProvider
import { LanguageProvider } from './context/LanguageContext';
import { getPreferredLanguage } from './utils/languageUtils';
// Import the ThemeProvider
import { ThemeProvider } from './context/ThemeContext';
import { ProfileUpdateProvider } from './context/ProfileUpdateContext.js';

// Import our new screens
import HumaniseTextScreen from './screens/HumaniseTextScreen';
import DetectAIScreen from './screens/DetectAIScreen';
import ContentWriterScreen from './screens/ContentWriterScreen';
import StoriesScreen from './screens/StoriesScreen.js';

const Stack = createStackNavigator();

interface AuthContextType {
    uid: string | null;
    loading: boolean;
    updateUid: (newUid: string) => Promise<void>;
}

const App = () => {
    const [onboardingCompleted, setOnboardingCompleted] = useState(false);
    const [isLoading, setIsLoading] = useState(true); // Show loading state while checking AsyncStorage
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    
    // Register the deep link handler for URL scheme
    useEffect(() => {
        // Set up deep link handling for auth
        const setupDeepLinks = async () => {
            // Register the custom URL scheme with Supabase
            if (Platform.OS === 'ios' || Platform.OS === 'android') {
                // Register the URL scheme
                await supabase.auth.initialize();
                
                // Get the initial URL if the app was opened with a URL
                const initialUrl = await Linking.getInitialURL();
                if (initialUrl) {
                    console.log('App opened with URL:', initialUrl);
                }
            }
        };
        
        setupDeepLinks();
    }, []);
    
    // Check if the user is logged in on initial app load
    useEffect(() => {
        const initializeApp = async () => {
            try {
                // Check network connectivity first
                const netInfo = await NetInfo.fetch();
                const isConnected = netInfo.isConnected;
                
                // Check login status
                const userStatus = await AsyncStorage.getItem('userLoggedIn');
                
                if (!isConnected) {
                    // In offline mode, rely solely on AsyncStorage
                    console.log('Offline mode: Using stored login status');
                    setIsLoggedIn(userStatus === 'true');
                    setIsLoading(false);
                    return;
                }
                
                // If online, check if we have a valid Supabase session
                const { data: { session } } = await supabase.auth.getSession();
                const hasValidSession = !!session?.user?.id;
                
                // Update login status based on both local storage and session
                const shouldBeLoggedIn = userStatus === 'true' && hasValidSession;
                setIsLoggedIn(shouldBeLoggedIn);
                
                // If sessions don't match, update localStorage
                if (userStatus === 'true' && !hasValidSession) {
                    console.log('Session expired or invalid, updating login status');
                    
                    // Try to refresh the session first
                    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
                    
                    if (refreshData?.session) {
                        console.log('Successfully refreshed expired session');
                        await AsyncStorage.setItem('uid', refreshData.session.user.id);
                        setIsLoggedIn(true);
                    } else {
                        console.log('Could not refresh session:', refreshError?.message);
                        await AsyncStorage.setItem('userLoggedIn', 'false');
                    }
                } else if (userStatus !== 'true' && hasValidSession) {
                    console.log('Found valid session, updating login status');
                    await AsyncStorage.setItem('userLoggedIn', 'true');
                    await AsyncStorage.setItem('uid', session.user.id);
                    setIsLoggedIn(true);
                }
                
                // Pre-load language preference (LanguageContext will handle this)
                console.log('App initialized, logged in:', shouldBeLoggedIn);
            } catch (error) {
                console.error('Error initializing app:', error);
                // On error, check if we have valid offline credentials
                try {
                    const userStatus = await AsyncStorage.getItem('userLoggedIn');
                    const storedUid = await AsyncStorage.getItem('uid');
                    
                    if (userStatus === 'true' && storedUid) {
                        console.log('Using offline authentication due to initialization error');
                        setIsLoggedIn(true);
                    } else {
                        // Assume not logged in if no valid offline credentials
                        setIsLoggedIn(false);
                    }
                } catch (finalError) {
                    console.error('Critical error during initialization:', finalError);
                    setIsLoggedIn(false);
                }
            } finally {
                setIsLoading(false);
            }
        };

        initializeApp();
    }, []);

    // If still loading, show a spinner
    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    return (
        <AuthProvider>
                <ProfileUpdateProvider>
            <AuthContext.Consumer>
                {({ uid }: AuthContextType) => (
                    <>
                        <ThemeProvider>
                        <LanguageProvider>
                        <ModalProvider>
                            <ProStatusProvider>
                          
                            <NavigationContainer
                                linking={{
                                    prefixes: ['matrixai://', 'https://ddtgdhehxhgarkonvpfq.supabase.co'],
                                    config: {
                                        screens: {
                                            Login: 'login',
                                            Home: 'home',
                                            SignUpDetails: 'signup',
                                            // Add explicit mapping for auth callback
                                            AuthCallback: 'auth/callback'
                                        }
                                    },
                                    // Custom handler for auth callback URLs
                                    getStateFromPath: (path, config) => {
                                        console.log('NavigationContainer processing path:', path);
                                        
                                        // If this is an auth callback, handle it specially
                                        if (path.includes('auth/callback') || path.includes('access_token') || path.includes('code=')) {
                                            console.log('Auth callback detected in NavigationContainer');
                                            // Return the user to the Login screen where the deep link handler will process the auth
                                            return {
                                                routes: [{ name: 'Login' }]
                                            };
                                        }
                                        
                                        // For other paths, use the default behavior
                                        return getStateFromPath(path, config);
                                    },
                                    // Subscribe to URL changes
                                    subscribe: (listener) => {
                                        console.log('=== NAVIGATION CONTAINER: SETTING UP DEEP LINK LISTENERS ===');
                                        // Listen to incoming links from deep linking
                                        const linkingSubscription = Linking.addEventListener('url', ({ url }) => {
                                            console.log('=== DEEP LINK RECEIVED IN NAVIGATION CONTAINER ===');
                                            console.log('Deep link URL:', url);
                                            console.log('URL contains auth/callback:', url.includes('auth/callback'));
                                            console.log('URL contains access_token:', url.includes('access_token'));
                                            console.log('URL contains code=:', url.includes('code='));
                                            
                                            // Pass the URL to the navigation listener
                                            listener(url);
                                            console.log('URL passed to navigation listener');
                                        });
                                        
                                        // Check for initial URL on app start
                                        console.log('Checking for initial URL on app start...');
                                        Linking.getInitialURL().then((url) => {
                                            if (url) {
                                                console.log('=== INITIAL URL DETECTED ===');
                                                console.log('Initial URL:', url);
                                                console.log('URL contains auth/callback:', url.includes('auth/callback'));
                                                console.log('URL contains access_token:', url.includes('access_token'));
                                                console.log('URL contains code=:', url.includes('code='));
                                                
                                                // Pass the URL to the navigation listener
                                                listener(url);
                                                console.log('Initial URL passed to navigation listener');
                                            } else {
                                                console.log('No initial URL detected');
                                            }
                                        }).catch(error => {
                                            console.error('Error getting initial URL:', error);
                                        });
                                        
                                        console.log('Deep link listeners set up successfully');
                                        return () => {
                                            // Clean up the event listener when the component is unmounted
                                            console.log('Cleaning up deep link listeners');
                                            linkingSubscription.remove();
                                        };
                                    },
                                }}
                                onStateChange={(state) => {
                                    console.log('=== NAVIGATION STATE CHANGED ===');
                                    console.log('Navigation state changed:', JSON.stringify(state));
                                    // Log the current route name
                                    if (state && state.routes && state.routes.length > 0) {
                                        const currentRoute = state.routes[state.index];
                                        console.log('Current route:', currentRoute.name, 'with params:', JSON.stringify(currentRoute.params));
                                        
                                        // Log navigation state details
                                        console.log('Navigation state index:', state?.index);
                                        console.log('Number of routes:', state?.routes?.length);
                                        
                                        // Log route history (last 3 routes)
                                        const routeHistory = state.routes
                                            .slice(Math.max(0, state.routes.length - 3))
                                            .map(route => route.name);
                                        console.log('Recent route history (last 3):', routeHistory);
                                        
                                        // Check if we're on a protected route that requires authentication
                                        const isProtectedRoute = !['Login', 'EmailLogin', 'ForgotPassword', 
                                            'EmailVerification', 'OTPCode', 'OTPCode2', 'SignUpDetails', 
                                            'SignUpDetails2', 'TermsOfService', 'PrivacyPolicy'].includes(currentRoute.name);
                                        console.log('Is protected route requiring auth:', isProtectedRoute);
                                        console.log('Current auth state - isLoggedIn:', isLoggedIn);
                                    }
                                    console.log('=== NAVIGATION STATE CHANGE END ===');
                                }}
                            >
                                <Stack.Navigator>
                                    {/* Onboarding Screen */}
                                    {!onboardingCompleted && !isLoggedIn && (
                                        <Stack.Screen 
                                            name="Onboarding" 
                                            options={{ headerShown: false }}
                                        >
                                            {(props) => (
                                                <OnboardingScreen
                                                    {...props}
                                                    onFinish={() => setOnboardingCompleted(true)}
                                                />
                                            )}
                                        </Stack.Screen>
                                    )}

                                    {/* Login Screens */}
                                    {!isLoggedIn && (
                                        <>
                                            <Stack.Screen 
                                                name="Login" 
                                                component={LoginScreen} 
                                                options={{ headerShown: false }} 
                                            />
                                         
                                            <Stack.Screen 
                                                name="EmailLogin" 
                                                component={EmailLoginScreen} 
                                                options={{ headerShown: false }} 
                                            />
                                            <Stack.Screen 
                                                name="ForgotPassword" 
                                                component={ForgotPasswordScreen} 
                                                options={{ headerShown: false }} 
                                            />
                                            <Stack.Screen 
                                                name="EmailVerification" 
                                                component={EmailVerificationScreen} 
                                                options={{ headerShown: false }} 
                                            />
                                            <Stack.Screen 
                                                name="OTPCode2" 
                                                component={OTPCodeScreen2} 
                                                options={{ headerShown: false }} 
                                            />
                                            <Stack.Screen 
                                                name="OTPCode" 
                                                component={OTPCodeScreen} 
                                                options={{ headerShown: false }} 
                                            />
                                            <Stack.Screen 
                                                name="SignUpDetails" 
                                                component={SignUpDetailsScreen} 
                                                options={{ headerShown: false }} 
                                            />
                                            <Stack.Screen 
                                                name="SignUpDetails2" 
                                                component={SignUpDetailsScreen2} 
                                                options={{ headerShown: false }} 
                                            />
                                          <Stack.Screen
  name="TermsOfService"
  component={TermsOfServiceScreen}
   options={{ headerShown: false }} 
  
/>
<Stack.Screen
  name="PrivacyPolicy"
  component={PrivacyPolicyScreen}
  options={{ headerShown: false }} 
/>
                                        </>
                                    )}

                                    {/* Main App Screens - Use HomeScreen as initial screen */}
                                    <Stack.Screen 
                                        name="Home" 
                                        component={HomeScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="AIShop" 
                                        component={AIShopScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="Profile" 
                                        component={ProfileScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="BotScreen" 
                                        component={BotScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="BotScreen2" 
                                        component={BotScreen2} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="SpeechToTextScreen" 
                                        component={AudioVideoUploadScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                  
                                    <Stack.Screen 
                                        name="TranslateScreen2" 
                                        component={TranslateScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                 
                                    <Stack.Screen 
                                        name="ImageTextScreen" 
                                        component={ImageGenerateScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                  
                                    <Stack.Screen 
                                        name="CreateImageScreen" 
                                        component={CreateImagesScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="CreateImageScreen2" 
                                        component={CreateImagesScreen2} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="VideoUpload" 
                                        component={VideoUploadScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="ImageSelectScreen" 
                                        component={ImageSelectScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="CreateVideoScreen" 
                                        component={CreateVideoScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="PPTGenerateScreen" 
                                        component={PPTGenerateScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="CreatePPTScreen" 
                                        component={CreatePPTScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="ProductDetail" 
                                        component={ProductDetailScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="FillInformationScreen" 
                                        component={FillInformationScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="PaymentSuccess" 
                                        component={SuccessScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                 
                                   
                                    <Stack.Screen 
                                        name="ReferralScreen" 
                                        component={ReferralScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="SubscriptionScreen" 
                                        component={SubscriptionScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="TransactionScreen" 
                                        component={TransactionScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                     <Stack.Screen 
                                        name="SettingsScreen" 
                                        component={SettingsScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="TransactionScreen2" 
                                        component={TransactionScreen2} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="TimeScreen" 
                                        component={TimeScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                 
                                   
                                    <Stack.Screen 
                                        name="RemoveBackground" 
                                        component={RemoveBackground} 
                                        options={{ headerShown: false }} 
                                    />
                                 
                                   
                                      <Stack.Screen 
                                        name="EditProfile" 
                                        component={EditProfile} 
                                        options={{ headerShown: false }} 
                                    />
                                  
                                    <Stack.Screen 
                                        name="CallScreen" 
                                        component={CallScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                 
                                   
                                 
                                  
                                    <Stack.Screen 
                                        name="BUYSubscription" 
                                        component={BUYSubscription} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="AntomPaymentScreen" 
                                        component={AntomPaymentScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="PaymentWebView" 
                                        component={PaymentWebView} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="PaymentSuccessScreen" 
                                        component={PaymentSuccessScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                  
                                 
                                    <Stack.Screen 
                                        name="CustomerSupportScreen" 
                                        component={CustomerSupportScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                   <Stack.Screen 
                                   name="OrderHistoryScreen" 
                                   component={OrderHistoryScreen} 
                                   options={{ headerShown: false }} 
                                   />
                                   <Stack.Screen 
                                   name="HelpScreen" 
                                   component={HelpScreen} 
                                   options={{ headerShown: false }} 
                                   />
                                   <Stack.Screen 
                                   name="AddonScreen" 
                                   component={AddonScreen} 
                                   options={{ headerShown: false }} 
                                   />
                                    <Stack.Screen 
                                        name="FeedbackScreen" 
                                        component={FeedbackScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                   
                                    {/* Add our new screens */}
                                    <Stack.Screen 
                                        name="HumaniseText" 
                                        component={HumaniseTextScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="DetectAIScreen" 
                                        component={DetectAIScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="ContentWriterScreen" 
                                        component={ContentWriterScreen} 
                                        options={{ headerShown: false }} 
                                    />

                                     <Stack.Screen 
                                        name="Stories" 
                                        component={StoriesScreen}
                                        options={{ headerShown: false }} 
                                    />
                                   
                                </Stack.Navigator>
                            </NavigationContainer>
                           
                            </ProStatusProvider>
                        </ModalProvider>
                        </LanguageProvider>
                        </ThemeProvider>
                    </>
                )}
            </AuthContext.Consumer>
                </ProfileUpdateProvider>    
        </AuthProvider>
    );
};

// Add Toast outside of the main component
export default () => {
  return (
    <>
      <App />
      <Toast />
    </>
  );
};
