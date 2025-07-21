import React, { useState, createContext, useContext } from 'react';
import { authenticate } from '../utils/airwallexApi';

// Create a context to expose authentication methods
export const AirwallexContext = createContext({
  initialized: false,
  initializing: false,
  error: null,
  initializeAirwallex: async () => {},
});

/**
 * AirwallexProvider component that provides lazy authentication
 * Authentication will only happen when explicitly called, not on app mount
 */
const AirwallexProvider = ({ children }) => {
  const [initialized, setInitialized] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 2;

  // Function to initialize Airwallex auth only when explicitly called
  const initializeAirwallex = async () => {
    // If already initialized, return success
    if (initialized) return { success: true, error: null };
    
    // If already initializing, wait a bit and try again
    if (initializing) {
      console.log('Already initializing, waiting...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Check again after waiting
      if (initialized) return { success: true, error: null };
      if (initializing) return { success: false, error: "Initialization in progress" };
    }
    
    setInitializing(true);
    setError(null);
    
    try {
      console.log('Initializing Airwallex...');
      // Authenticate with Airwallex
      const token = await authenticate();
      console.log('Airwallex initialized successfully');
      
      // Only set initialized if we actually got a token
      if (token) {
        setInitialized(true);
        setError(null);
        setRetryCount(0); // Reset retry count on success
        return { success: true, error: null };
      } else {
        throw new Error('Authentication failed - no token received');
      }
    } catch (err) {
      console.error('Failed to initialize Airwallex:', err);
      const errorMessage = err.message || 'Failed to initialize payment provider';
      setError(errorMessage);
      
      // Only retry a limited number of times
      if (retryCount < MAX_RETRIES) {
        console.log(`Retry attempt ${retryCount + 1} of ${MAX_RETRIES}`);
        setRetryCount(prev => prev + 1);
        setInitializing(false); // Reset initializing state before retry
        // Try again in 2 seconds
        setTimeout(() => initializeAirwallex(), 2000);
        return { success: false, error: `Retrying... (${retryCount + 1}/${MAX_RETRIES})` };
      }
      
      return { success: false, error: errorMessage };
    } finally {
      // Always set initializing to false when done (success or final failure)
      if (initialized || retryCount >= MAX_RETRIES) {
        setInitializing(false);
      }
    }
  };

  // Provide context values to children
  return (
    <AirwallexContext.Provider 
      value={{
        initialized,
        initializing,
        error,
        initializeAirwallex,
      }}
    >
      {children}
    </AirwallexContext.Provider>
  );
};

// Custom hook to use the Airwallex context
export const useAirwallex = () => useContext(AirwallexContext);

export default AirwallexProvider; 