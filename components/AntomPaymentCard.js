import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, TextInput, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useAntom } from './AntomProvider';

const AntomPaymentCard = ({ onPaymentSuccess, onPaymentError }) => {
  const { t } = useTranslation();
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCVC, setCardCVC] = useState('');
  const [cardHolderName, setCardHolderName] = useState('');
  const [cardValid, setCardValid] = useState(false);
  const [loading, setLoading] = useState(false);

  // Get Antom context
  const { initialized, initializing, error: antomError, initializeAntom } = useAntom();

  // Initialize Antom on component mount
  useEffect(() => {
    const initPaymentSystem = async () => {
      if (!initialized && !initializing) {
        try {
          const result = await initializeAntom();
          if (!result.success) {
            onPaymentError(result.error || 'Failed to initialize payment system');
          }
        } catch (err) {
          onPaymentError(t('failedToProcessPayment'));
        }
      }
    };

    initPaymentSystem();
  }, [initialized, initializing, initializeAntom, onPaymentError]);

  // Card validation functions
  const validateCardNumber = (cardNumber) => {
    // Remove spaces and special characters
    const cleanedCardNumber = cardNumber.replace(/\D/g, '');
    return cleanedCardNumber.length >= 13 && cleanedCardNumber.length <= 19;
  };

  const validateCardExpiry = (expiry) => {
    // Check MM/YY format
    const regex = /^(0[1-9]|1[0-2])\/([0-9]{2})$/;
    if (!regex.test(expiry)) return false;

    // Extract month and year
    const [month, year] = expiry.split('/');
    const currentYear = new Date().getFullYear() % 100; // Get last 2 digits
    const currentMonth = new Date().getMonth() + 1; // January is 0
    
    const expiryYear = parseInt(year, 10);
    const expiryMonth = parseInt(month, 10);

    // Check if card is expired
    if (expiryYear < currentYear) return false;
    if (expiryYear === currentYear && expiryMonth < currentMonth) return false;
    
    return true;
  };

  const validateCVC = (cvc) => {
    // CVC should be 3 or 4 digits
    return /^[0-9]{3,4}$/.test(cvc);
  };

  // Format card number with spaces (e.g., 4242 4242 4242 4242)
  const formatCardNumber = (text) => {
    const cleanedText = text.replace(/\D/g, '');
    let formatted = '';
    
    for (let i = 0; i < cleanedText.length; i++) {
      if (i > 0 && i % 4 === 0) {
        formatted += ' ';
      }
      formatted += cleanedText[i];
    }
    
    return formatted;
  };

  // Format expiry date (MM/YY)
  const formatExpiry = (text) => {
    const cleanedText = text.replace(/\D/g, '');
    
    if (cleanedText.length <= 2) {
      return cleanedText;
    } else {
      return `${cleanedText.slice(0, 2)}/${cleanedText.slice(2, 4)}`;
    }
  };

  const handleCardNumberChange = (text) => {
    const formatted = formatCardNumber(text);
    setCardNumber(formatted.slice(0, 19)); // Limit to 19 chars including spaces
    validateForm();
  };

  const handleExpiryChange = (text) => {
    const formatted = formatExpiry(text);
    setCardExpiry(formatted.slice(0, 5)); // MM/YY format (5 chars)
    validateForm();
  };

  const handleCVCChange = (text) => {
    setCardCVC(text.replace(/\D/g, '').slice(0, 4)); // Limit to 4 digits
    validateForm();
  };

  const handleCardHolderNameChange = (text) => {
    setCardHolderName(text);
    validateForm();
  };

  const validateForm = () => {
    const isCardNumberValid = validateCardNumber(cardNumber);
    const isExpiryValid = validateCardExpiry(cardExpiry);
    const isCVCValid = validateCVC(cardCVC);
    const isNameValid = cardHolderName.trim().length > 0;
    
    const isValid = isCardNumberValid && isExpiryValid && isCVCValid && isNameValid;
    setCardValid(isValid);
    return isValid;
  };

  const handlePayPress = () => {
    if (!validateForm()) {
      Alert.alert(t('error'), t('pleaseCompleteCardDetails'));
      return;
    }

    try {
      setLoading(true);
      
      // Format card details for processing
      const cardDetails = {
        cardNumber: cardNumber.replace(/\s/g, ''),
        cardExpiry,
        cardCVC,
        cardHolderName
      };

      // Pass card details to parent component
      onPaymentSuccess(cardDetails);
    } catch (error) {
      console.error('Payment error:', error);
      onPaymentError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {antomError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{antomError}</Text>
        </View>
      )}

      <View style={styles.cardInputField}>
        <Text style={styles.cardInputFieldLabel}>{t('cardHolderName')}</Text>
        <TextInput
          style={styles.cardHolderInput}
          placeholder={t('enterNameOnCard')}
          value={cardHolderName}
          onChangeText={handleCardHolderNameChange}
          autoCapitalize="words"
        />
      </View>
      
      <View style={styles.cardInputField}>
        <Text style={styles.cardInputFieldLabel}>{t('cardNumber')}</Text>
        <TextInput
          style={styles.cardNumberInput}
          placeholder="4242 4242 4242 4242"
          value={cardNumber}
          onChangeText={handleCardNumberChange}
          keyboardType="number-pad"
          maxLength={19} // 16 digits + 3 spaces
        />
      </View>
      
      <View style={styles.cardDetailsRow}>
        <View style={[styles.cardInputField, { flex: 1, marginRight: 10 }]}>
          <Text style={styles.cardInputFieldLabel}>{t('expiryDate')}</Text>
          <TextInput
            style={styles.cardExpiryInput}
            placeholder={t('mmYY')}
            value={cardExpiry}
            onChangeText={handleExpiryChange}
            keyboardType="number-pad"
            maxLength={5} // MM/YY format
          />
        </View>
        
        <View style={[styles.cardInputField, { flex: 1 }]}>
          <Text style={styles.cardInputFieldLabel}>{t('cvc')}</Text>
          <TextInput
            style={styles.cardCVCInput}
            placeholder="123"
            value={cardCVC}
            onChangeText={handleCVCChange}
            keyboardType="number-pad"
            maxLength={4}
            secureTextEntry
          />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.payButton, (!cardValid || loading || initializing) && styles.payButtonDisabled]}
        onPress={handlePayPress}
        disabled={!cardValid || loading || initializing}
      >
        {loading || initializing ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.payButtonText}>{t('payNow')}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 15,
    marginVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 14,
  },
  cardInputField: {
    marginBottom: 15,
  },
  cardInputFieldLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  cardHolderInput: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  cardNumberInput: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  cardDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardExpiryInput: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  cardCVCInput: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  payButton: {
    backgroundColor: '#2274F0',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  payButtonDisabled: {
    backgroundColor: '#A0C0E8',
  },
  payButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default AntomPaymentCard;