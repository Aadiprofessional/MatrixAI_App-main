import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet, TextInput, ScrollView } from 'react-native';
import AirwallexNative from './services/airwallexNative';

const TestPaymentScreen = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingIntent, setIsCreatingIntent] = useState(false);
  const [clientSecret, setClientSecret] = useState('');
  const [paymentIntentId, setPaymentIntentId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [amount, setAmount] = useState('100');
  
  // Step 1: Get Access Token
  const getAccessToken = async () => {
    try {
      setIsCreatingIntent(true);
      
      // Note: In production, this should be done on your backend server
      Alert.alert(
        'Setup Required',
        'To test payments, you need to:\n\n1. Create an Airwallex sandbox account\n2. Get your Client ID and API Key\n3. Create a payment intent via API\n\nSee AIRWALLEX_SANDBOX_SETUP.md for detailed instructions.',
        [
          {
            text: 'Use Demo Values',
            onPress: () => {
              // Set demo values for testing the UI flow
              setClientSecret('int_demo_client_secret_for_testing');
              setPaymentIntentId('int_demo_payment_intent_id');
              Alert.alert('Demo Values Set', 'You can now test the payment flow UI. Note: This will fail at the Airwallex SDK level without real credentials.');
            }
          },
          { text: 'OK', style: 'default' }
        ]
      );
    } catch (error) {
      console.error('Error getting access token:', error);
      Alert.alert('Error', error.message);
    } finally {
      setIsCreatingIntent(false);
    }
  };

  // Step 2: Test Payment Flow
  const testPayment = async () => {
    if (!clientSecret || !paymentIntentId) {
      Alert.alert('Missing Credentials', 'Please set up payment intent first or enter credentials manually.');
      return;
    }
    
    setIsLoading(true);
    try {
      console.log('=== Starting Airwallex Payment Test ===');
      console.log('Client Secret:', clientSecret.substring(0, 20) + '...');
      console.log('Payment Intent ID:', paymentIntentId);
      console.log('Amount:', amount);
      
      const result = await AirwallexNative.presentEntirePaymentFlow(
        clientSecret,
        paymentIntentId,
        parseInt(amount),
        'USD'
      );
      
      console.log('=== Payment Test Completed ===');
      console.log('Result:', result);
      
      Alert.alert(
        'Payment Result', 
        `Status: ${result?.status || 'Unknown'}\n\nFull Result:\n${JSON.stringify(result, null, 2)}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('=== Payment Test Failed ===');
      console.error('Error:', error);
      
      Alert.alert(
        'Payment Error', 
        `Error: ${error.message}\n\nThis is expected if using demo credentials. Check the console for detailed logs.`,
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>Airwallex Payment Test</Text>
      <Text style={styles.subtitle}>Sandbox Environment Testing</Text>
      
      {/* Setup Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Step 1: Setup Credentials</Text>
        <TouchableOpacity 
          style={[styles.button, styles.setupButton, isCreatingIntent && styles.buttonDisabled]} 
          onPress={getAccessToken}
          disabled={isCreatingIntent}
        >
          <Text style={styles.buttonText}>
            {isCreatingIntent ? 'Setting up...' : 'Setup Payment Intent'}
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Manual Input Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Or Enter Manually:</Text>
        
        <Text style={styles.label}>Client Secret:</Text>
        <TextInput
          style={styles.input}
          value={clientSecret}
          onChangeText={setClientSecret}
          placeholder="int_xxx_secret_xxx"
          multiline
        />
        
        <Text style={styles.label}>Payment Intent ID:</Text>
        <TextInput
          style={styles.input}
          value={paymentIntentId}
          onChangeText={setPaymentIntentId}
          placeholder="int_xxx"
        />
        
        <Text style={styles.label}>Amount (cents):</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="100"
          keyboardType="numeric"
        />
      </View>
      
      {/* Test Payment Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Step 2: Test Payment</Text>
        <TouchableOpacity 
          style={[styles.button, styles.paymentButton, isLoading && styles.buttonDisabled]} 
          onPress={testPayment}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? 'Processing Payment...' : `Test Payment ($${(parseInt(amount) / 100).toFixed(2)})`}
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Instructions */}
      <View style={styles.section}>
        <Text style={styles.instructionsTitle}>Test Card Numbers:</Text>
        <Text style={styles.instructions}>
          • Visa: 4012000033330026{"\n"}
          • Mastercard: 5555555555554444{"\n"}
          • Amex: 378282246310005{"\n"}
          • CVV: Any 3-4 digits{"\n"}
          • Expiry: Any future date
        </Text>
        
        <Text style={styles.note}>
          📖 See AIRWALLEX_SANDBOX_SETUP.md for complete setup instructions
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  contentContainer: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1a1a1a',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6c757d',
    marginBottom: 30,
    textAlign: 'center',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    color: '#343a40',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 5,
    marginTop: 10,
    color: '#495057',
  },
  input: {
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#fff',
    minHeight: 44,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupButton: {
    backgroundColor: '#6c757d',
  },
  paymentButton: {
    backgroundColor: '#007bff',
  },
  buttonDisabled: {
    backgroundColor: '#adb5bd',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#343a40',
  },
  instructions: {
    fontSize: 14,
    color: '#495057',
    lineHeight: 20,
    fontFamily: 'Courier New',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 6,
    marginBottom: 15,
  },
  note: {
    fontSize: 12,
    color: '#6c757d',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default TestPaymentScreen;