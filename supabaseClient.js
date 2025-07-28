import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';

// Import environment variables
const supabaseUrl = process.env.SUPABASE_URL || 'https://ddtgdhehxhgarkonvpfq.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkdGdkaGVoeGhnYXJrb252cGZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ2Njg4MTIsImV4cCI6MjA1MDI0NDgxMn0.mY8nx-lKrNXjJxHU7eEja3-fTSELQotOP4aZbxvmNPY';

// Define callback URLs based on platform
const getCallbackUrl = () => {
  // For iOS, we'll use the native Google Sign-In
  // For other platforms, use the Supabase callback URL to handle the redirect properly
  const callbackUrl = Platform.OS === 'ios' 
    ? 'matrixai://auth/callback'
    : 'https://ddtgdhehxhgarkonvpfq.supabase.co/auth/v1/callback';
  
  console.log(`Auth callback URL for ${Platform.OS}: ${callbackUrl}`);
  return callbackUrl;
};

// Initialize the Supabase client
console.log('Initializing Supabase client with URL:', supabaseUrl);
console.log('Platform:', Platform.OS);

// Configure auth options
const authConfig = {
  storage: AsyncStorage,
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: true,
  flowType: 'pkce',
  debug: __DEV__, // Enable debug mode in development
  // Define the URL scheme for deep linking
  url: {
    resetPassword: 'matrixai://auth/reset-password',
    verifyOtp: 'matrixai://auth/verify',
    emailVerification: 'matrixai://auth/verify',
    callback: getCallbackUrl(),
    // Add site URL as an alternative callback for web-based flows
    site: 'https://ddtgdhehxhgarkonvpfq.supabase.co/auth/v1/callback',
  },
};

console.log('Supabase auth configuration:', JSON.stringify({
  autoRefreshToken: authConfig.autoRefreshToken,
  persistSession: authConfig.persistSession,
  detectSessionInUrl: authConfig.detectSessionInUrl,
  flowType: authConfig.flowType,
  debug: authConfig.debug,
  urls: authConfig.url
}));

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: authConfig,
});

// Export helper function to get the appropriate callback URL
export const getAuthCallbackUrl = getCallbackUrl;