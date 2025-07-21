import React, { useEffect } from 'react';
import { StripeProvider as StripeProviderNative } from '@stripe/stripe-react-native';
import { STRIPE_PUBLISHABLE_KEY } from '@env';


const StripeProvider = ({ children }) => {
  // Using environment variable instead of hardcoded key
  return (
    <StripeProviderNative
      publishableKey={STRIPE_PUBLISHABLE_KEY}
      merchantIdentifier="merchant.com.matrixai" // Replace with your merchant identifier
    >
      {children}
    </StripeProviderNative>
  );
};

export default StripeProvider;