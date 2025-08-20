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
  debug: false, // Disable debug mode to prevent Error.stack getter issues
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
}, null, 2));

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: authConfig,
  global: {
    headers: {
      'X-Client-Info': 'matrixai-mobile',
    },
  },
});

// Add error handler to prevent stack trace issues
if (typeof global !== 'undefined' && global.ErrorUtils) {
  const originalHandler = global.ErrorUtils.getGlobalHandler();
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    // Filter out Error.stack getter issues
    if (error && error.message && error.message.includes('Error.stack getter called with an invalid receiver')) {
      console.warn('Suppressed Error.stack getter issue:', error.message);
      return;
    }
    // Filter out Hermes stopTracking issues
    if (error && error.message && error.message.includes('stopTracking')) {
      console.warn('Suppressed Hermes stopTracking issue:', error.message);
      return;
    }
    // Filter out undefined property access on tracking objects
    if (error && error.message && (error.message.includes('Cannot read property') || error.message.includes('Cannot read properties')) && error.message.includes('undefined')) {
      console.warn('Suppressed undefined property access:', error.message);
      return;
    }
    if (originalHandler) {
      originalHandler(error, isFatal);
    }
  });
}

// Export helper function to get the appropriate callback URL
export const getAuthCallbackUrl = getCallbackUrl;