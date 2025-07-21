// Note: In a production environment, these calls should be made from your backend
// Here we're creating a simplified version for demonstration
import { STRIPE_SECRET_KEY } from '@env';

// Fallback to empty string if environment variable is not available
const secretKey = STRIPE_SECRET_KEY || '';

// Create a payment intent
export const createPaymentIntent = async (amount, currency = 'hkd') => {
  try {
    console.log('Creating payment intent with amount:', amount, 'currency:', currency);
    
    // Validate amount
    if (!amount || isNaN(amount) || amount <= 0) {
      console.error('Invalid amount for payment intent:', amount);
      return { error: { message: 'Invalid payment amount' } };
    }
    
    // Ensure amount is a number and convert to cents
    const amountInCents = Math.round(parseFloat(amount) * 100);
    console.log('Amount in cents:', amountInCents);
    
    const response = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `amount=${amountInCents}&currency=${currency}&payment_method_types[]=card`,
    });

    if (!response.ok) {
      console.error('Stripe API error:', response.status, response.statusText);
      const errorData = await response.json();
      console.error('Stripe error details:', errorData);
      return { error: { message: errorData?.error?.message || 'Payment service error' } };
    }

    const paymentIntent = await response.json();
    console.log('Payment intent created:', paymentIntent.id);
    return paymentIntent;
  } catch (error) {
    console.error('Error creating payment intent:', error);
    return { error: { message: 'Failed to connect to payment service' } };
  }
};

// Update your backend API call
export const confirmSubscriptionPurchase = async (uid, plan, totalPrice, couponId, paymentIntentId) => {
  try {
    console.log('Confirming subscription purchase:', { uid, plan, totalPrice, couponId, paymentIntentId });
    
    // Validate required parameters
    if (!uid) {
      console.error('Missing uid for subscription purchase');
      return { success: false, message: 'Missing user ID' };
    }
    
    if (!plan) {
      console.error('Missing plan for subscription purchase');
      return { success: false, message: 'Missing subscription plan' };
    }
    
    if (!paymentIntentId) {
      console.error('Missing paymentIntentId for subscription purchase');
      return { success: false, message: 'Missing payment information' };
    }
    
    // Ensure totalPrice is a valid number
    const validTotalPrice = totalPrice && !isNaN(totalPrice) ? totalPrice : 0;
    
    const response = await fetch('https://main-matrixai-server-lujmidrakh.cn-hangzhou.fcapp.run/BuySubscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uid,
        plan,
        totalPrice: validTotalPrice,
        couponId: couponId || "",
        paymentIntentId
      }),
    });
    
    if (!response.ok) {
      console.error('Subscription API error:', response.status, response.statusText);
      return { success: false, message: 'Server error while confirming subscription' };
    }
    
    const result = await response.json();
    console.log('Subscription confirmation result:', result);
    return result;
  } catch (error) {
    console.error('Payment confirmation error:', error);
    return { success: false, message: 'Failed to confirm subscription' };
  }
};