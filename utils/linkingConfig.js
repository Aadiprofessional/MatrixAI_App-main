import { Linking } from 'react-native';
import { supabase } from '../supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';

/**
 * Sets up deep link handling for auth callbacks
 * @param {Object} navigation - React Navigation object
 * @returns {function} cleanup function to remove event listeners
 */
export const setupAuthLinking = (navigation) => {
  // Define the handler function
  const handleDeepLink = async ({ url }) => {
    console.log('Received deep link:', url);
    
    if (!url || !url.includes('auth/callback')) return;
    
    try {
      // Either extract tokens directly or let Supabase handle it
      const params = new URL(url).searchParams;
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      
      let session;
      
      if (access_token) {
        // Manual approach - extract tokens and set the session
        const { data, error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
        
        if (error) throw error;
        session = data.session;
      } else {
        // Let supabase client handle extracting the session from URL
        // This happens automatically if detectSessionInUrl is true
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        session = data.session;
      }
      
      if (session?.user) {
        console.log('Session established:', session.user.id);
        const userId = session.user.id;
        
        // Store session and user data
        await AsyncStorage.setItem('supabase-session', JSON.stringify(session));
        await AsyncStorage.setItem('uid', userId);
        await AsyncStorage.setItem('userLoggedIn', 'true');
        
        // Check if user exists in users table
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('user_id', userId)
          .single();
        
        if (userError || !userData) {
          // User doesn't exist, proceed to signup
          const userInfo = {
            user_id: userId,
            email: session.user.email,
            name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || '',
            avatar_url: session.user.user_metadata?.picture || '',
            phone: session.user.phone || ''
          };
          
          navigation.navigate('SignUpDetails', { userInfo });
          return;
        }
        
        // User exists, go to main screen
        navigation.replace('Home');
      }
    } catch (error) {
      console.error('Error handling auth callback:', error);
      Toast.show({
        type: 'error',
        text1: 'Authentication Error',
        text2: error.message || 'Failed to complete authentication',
        position: 'bottom'
      });
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
    setLoading(true);
    
    // Use Supabase OAuth flow with pkce for more security
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
    
    // Open the URL to start the OAuth flow
    if (data?.url) {
      await Linking.openURL(data.url);
    }
  } catch (error) {
    console.error('Error during Google sign-in:', error);
    if (showError) {
      showError(error.message || 'Failed to sign in with Google');
    }
  } finally {
    setLoading(false);
  }
};
