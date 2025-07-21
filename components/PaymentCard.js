import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { CardField, useStripe } from '@stripe/stripe-react-native';

const PaymentCard = ({ onPaymentSuccess, onPaymentError }) => {
  const { t } = useTranslation();
  const [cardComplete, setCardComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const { createPaymentMethod } = useStripe();

  const handlePayPress = async () => {
    if (!cardComplete) {
      Alert.alert(t('error'), t('pleaseCompleteCardDetailsSimple'));
      return;
    }

    try {
      setLoading(true);
      
      // Create a payment method from the card details
      const { paymentMethod, error } = await createPaymentMethod({
        type: 'Card',
      });

      if (error) {
        throw new Error(error.message);
      }

      if (paymentMethod) {
        onPaymentSuccess(paymentMethod.id);
      } else {
        throw new Error('Payment method creation failed');
      }
    } catch (error) {
      console.error('Payment error:', error);
      onPaymentError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <CardField
        postalCodeEnabled={false}
        placeholder={{
          number: '4242 4242 4242 4242',
        }}
        cardStyle={styles.cardStyle}
        style={styles.cardField}
        onCardChange={(cardDetails) => {
          setCardComplete(cardDetails.complete);
        }}
      />
      {loading && <ActivityIndicator size="small" color="#2274F0" style={styles.loader} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  
  },
  cardField: {
    width: '100%',
    height: 50,
    marginVertical: 10,
 
  },
  cardStyle: {
    backgroundColor: '#FFFFFF',
    textColor: '#000000',
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 8,
  },
  loader: {
    position: 'absolute',
    right: 10,
    top: 2005,
  },
});

export default PaymentCard;