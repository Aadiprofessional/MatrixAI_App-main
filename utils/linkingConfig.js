import { Linking, Platform } from 'react-native';
import { supabase, getAuthCallbackUrl } from '../supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import NetInfo from '@react-native-community/netinfo';

// Helper function to get network state
export const getNetworkStateAsync = async () => {
  try {
    const netInfo = await NetInfo.fetch();
    return {
      isConnected: netInfo.isConnected,
      type: netInfo.type,
      details: netInfo.details
    };
  } catch (error) {
    console.error('Error getting network state:', error);
    return { isConnected: false, type: 'unknown', details: null };
  }
};

/**
 * Sets up deep link handling for auth callbacks
 * @param {Object} navigation - React Navigation object
 * @returns {function} cleanup function to remove event listeners
 */
export const setupAuthLinking = (navigation) => {
  // Define the handler function
  const handleDeepLink = async ({ url }) => {
    if (!url) return;
    
    console.log('=== DEEP LINK PROCESSING START ===');
    console.log('Received deep link:', url);
    
    // Check if this is an auth callback URL (either from custom scheme or web)
    if (!url.includes('auth/callback') && !url.includes('access_token') && !url.includes('code=')) {
      console.log('Not an auth callback URL, ignoring');
      return;
    }
    
    console.log('Processing authentication callback URL:', url);
    console.log('URL contains auth/callback:', url.includes('auth/callback'));
    console.log('URL contains access_token:', url.includes('access_token'));
    console.log('URL contains code=:', url.includes('code='));
    
    try {
      // Handle both custom URL scheme and web URL formats
      let session;
      
      // Extract the code parameter if present (works for both custom scheme and web URLs)
      const extractCode = (inputUrl) => {
        try {
          // Handle both custom scheme and web URLs
          const urlObj = inputUrl.startsWith('matrixai://') 
            ? new URL(inputUrl.replace('matrixai://', 'https://matrixai.app/')) 
            : new URL(inputUrl);
          return urlObj.searchParams.get('code');
        } catch (e) {
          console.error('Error extracting code from URL:', e);
          return null;
        }
      };
      
      // Extract tokens if present (for backward compatibility)
      const extractTokens = (inputUrl) => {
        try {
          const urlObj = inputUrl.startsWith('matrixai://') 
            ? new URL(inputUrl.replace('matrixai://', 'https://matrixai.app/')) 
            : new URL(inputUrl);
          return {
            access_token: urlObj.searchParams.get('access_token'),
            refresh_token: urlObj.searchParams.get('refresh_token')
          };
        } catch (e) {
          console.error('Error extracting tokens from URL:', e);
          return { access_token: null, refresh_token: null };
        }
      };
      
      // First try to extract and exchange the code (preferred method)
      const code = extractCode(url);
      if (code) {
        console.log('Found authorization code, exchanging for session');
        try {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error('Error exchanging code for session:', error);
            throw error;
          }
          session = data.session;
          console.log('Successfully exchanged code for session');
        } catch (exchangeError) {
          console.error('Failed to exchange code for session:', exchangeError);
          // If code exchange fails, try getting the current session as fallback
          const { data, error } = await supabase.auth.getSession();
          if (error) throw error;
          session = data.session;
        }
      } else {
        // Try token-based authentication as fallback
        const { access_token, refresh_token } = extractTokens(url);
        
        if (access_token) {
          console.log('Found access token, setting session');
          const { data, error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          
          if (error) throw error;
          session = data.session;
          console.log('Successfully set session with tokens');
        } else {
          // Last resort: try to get the current session
          console.log('No code or tokens found, getting current session');
          const { data, error } = await supabase.auth.getSession();
          if (error) throw error;
          session = data.session;
        }
      }
      
      if (session?.user) {
        console.log('Session established:', session.user.id);
        console.log('Full session object:', JSON.stringify(session));
        const userId = session.user.id;
        
        // Store session and user data
        console.log('Storing session and user data in AsyncStorage');
        await AsyncStorage.setItem('supabase-session', JSON.stringify(session));
        await AsyncStorage.setItem('uid', userId);
        await AsyncStorage.setItem('userLoggedIn', 'true');
        await AsyncStorage.setItem('user', JSON.stringify(session.user));
        console.log('Session and user data stored successfully');
        
        // Check if user exists in users table
        console.log('Checking if user exists in database');
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('uid', userId)
          .single();
        
        if (userError) {
          console.log('Error checking user existence:', userError.message);
        }
        
        if (userError || !userData) {
          console.log('User does not exist in database, navigating to SignUpDetails');
          // User doesn't exist, proceed to signup
          const userInfo = {
            user_id: userId,
            id: userId,
            email: session.user.email,
            name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || '',
            dp_url: session.user.user_metadata?.picture || '',
            phone: session.user.phone || ''
          };
          
          console.log('Navigating to SignUpDetails with user info');
          navigation.navigate('SignUpDetails', { userInfo });
          return;
        }
        
        // User exists, go to main screen
        console.log('User exists in database, navigating to Home screen');
        
        // Add a slight delay before navigation to ensure all async operations complete
        setTimeout(() => {
          navigation.reset({
            index: 0,
            routes: [{ name: 'Home' }],
          });
        }, 500);
      }
    } catch (error) {
      console.error('Error processing auth callback:', error);
      console.error('Full error details:', JSON.stringify(error));
      console.log('=== DEEP LINK PROCESSING END WITH ERROR ===');
      Toast.show({
        type: 'error',
        text1: 'Authentication Error',
        text2: error.message || 'Failed to complete authentication',
        position: 'bottom'
      });
    } finally {
      console.log('=== DEEP LINK PROCESSING END ===');
    }
  };
  
  // Add event listener for deep linking
  const subscription = Linking.addEventListener('url', handleDeepLink);
  
  // Check for initial URL (app opened via URL)
  Linking.getInitialURL().then(url => {
    if (url) {
      handleDeepLink({ url });
    }
  }).catch(err => {
    console.error('Error getting initial URL:', err);
  });
  
  // Return cleanup function
  return () => {
    subscription.remove();
  };
};

/**
 * Common function for handling Google Sign-In using Supabase OAuth
 * @param {Function} setLoading - Function to update loading state
 * @param {Function} showError - Function to display error message
 */
export const handleGoogleSignIn = async (setLoading, showError) => {
  try {
    setLoading && setLoading(true);
    console.log('=== OAUTH FLOW START ===');
    console.log('Starting Google OAuth flow...');
    console.log('Platform:', Platform.OS);
    console.log('Network state:', await getNetworkStateAsync());
    
    // Get the appropriate callback URL based on platform
    const callbackUrl = getAuthCallbackUrl();
    console.log('Auth callback URL:', callbackUrl);
    console.log(`Using callback URL for Google Sign-In: ${callbackUrl}`);
    console.log(`Platform: ${Platform.OS}`);
    
    // Use Supabase OAuth flow with pkce for more security
    console.log('Initiating Supabase OAuth flow with PKCE...');
    console.log('OAuth options:', {
      provider: 'google',
      redirectTo: callbackUrl,
      skipBrowserRedirect: Platform.OS === 'ios',
      flowType: 'pkce'
    });
    
    // Log Supabase auth state before OAuth call
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      console.log('Current session before OAuth:', sessionData ? 'Exists' : 'None');
      if (sessionData?.session) {
        console.log('Session user ID:', sessionData.session.user.id);
        console.log('Session expires at:', new Date(sessionData.session.expires_at * 1000).toISOString());
      }
    } catch (sessionError) {
      console.error('Error checking session before OAuth:', sessionError);
    }
    
    // For iOS, we'll use the native Google Sign-In in LoginScreens.js instead of OAuth
    // This function is only used as a fallback for non-iOS platforms
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
        // Only skip browser redirect on iOS where we use native Google Sign-In
        skipBrowserRedirect: Platform.OS === 'ios',
        preferredAuth: 'pkce',
        // Explicitly set the flow type to ensure consistency
        flowType: 'pkce'
      }
    });
    
    console.log('Supabase OAuth call completed');
    console.log('OAuth response data exists:', !!data);
    console.log('OAuth response error exists:', !!error);
    
    if (error) {
      console.error('OAuth flow error:', error.message);
      console.error('Full OAuth error:', JSON.stringify(error));
      throw error;
    }
    
    console.log('OAuth flow initiated successfully');
    console.log('Data received:', JSON.stringify(data));
    
    // Open the URL to start the OAuth flow
    if (data?.url) {
      console.log('Opening Google OAuth URL:', data.url);
      // Parse the URL to extract and log important parameters
      try {
        const url = new URL(data.url);
        console.log('OAuth URL host:', url.host);
        console.log('OAuth URL pathname:', url.pathname);
        console.log('OAuth URL has redirect_uri param:', url.searchParams.has('redirect_uri'));
        
        // Log all URL parameters for debugging
        console.log('OAuth URL parameters:');
        url.searchParams.forEach((value, key) => {
          // Don't log the full value of sensitive parameters
          if (key === 'client_id' || key === 'state') {
            console.log(`- ${key}: ${value.substring(0, 10)}...`);
          } else {
            console.log(`- ${key}: ${value}`);
          }
        });
        
        if (url.searchParams.has('redirect_uri')) {
          console.log('OAuth redirect_uri:', url.searchParams.get('redirect_uri'));
          // Verify the redirect URI matches our expected callback URL
          const expectedCallback = getAuthCallbackUrl();
          const actualRedirect = url.searchParams.get('redirect_uri');
          console.log('Redirect URI matches expected callback:', actualRedirect === expectedCallback);
        }
      } catch (parseError) {
        console.error('Error parsing OAuth URL:', parseError);
        console.error('Parse error details:', JSON.stringify(parseError, null, 2));
      }
      
      try {
        await Linking.openURL(data.url);
        console.log('OAuth URL opened successfully');
      } catch (linkingError) {
        console.error('Error opening OAuth URL:', linkingError);
        console.error('Linking error details:', JSON.stringify(linkingError, null, 2));
        throw new Error(`Failed to open Google Sign-In URL: ${linkingError.message}`);
      }
    } else {
      console.error('No URL returned from Supabase OAuth flow');
      showError && showError('Failed to start Google Sign-In');
    }
  } catch (error) {
    console.error('Error during Google sign-in:', error);
    console.error('Full error details:', JSON.stringify(error, null, 2));
    
    // Provide more specific error messages based on error type
    let errorMessage = 'Failed to sign in with Google';
    if (error.message) {
      if (error.message.includes('network')) {
        errorMessage = 'Network error during Google sign-in. Please check your internet connection.';
      } else if (error.message.includes('cancelled')) {
        errorMessage = 'Google sign-in was cancelled.';
      } else {
        errorMessage = error.message;
      }
    }
    
    console.error('Error message to display:', errorMessage);
    showError && showError(errorMessage);
    console.log('=== OAUTH FLOW END WITH ERROR ===');
  } finally {
    console.log('=== OAUTH FLOW END ===');
    setLoading && setLoading(false);
  }
};
