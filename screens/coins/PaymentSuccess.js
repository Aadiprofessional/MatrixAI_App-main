import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, SafeAreaView, StatusBar, Dimensions, Platform } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import FontAwesome from 'react-native-vector-icons/FontAwesome';

const { width, height } = Dimensions.get('window');

const PaymentSuccess = ({ navigation, route }) => {
  // Extract parameters passed from previous screen
  const { 
    message, 
    planDetails, 
    finalPrice, 
    discount, 
    startDate, 
    endDate 
  } = route.params || {};

  // Navigation handlers
  const navigateToHome = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }]
    });
  };

  const goBack = () => {
    // If we can't go back, go to home
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigateToHome();
    }
  };

  const navigateToTransactions = () => {
    navigation.navigate('TransactionScreen');
  };

  return (
    <LinearGradient
      colors={['#2274F0', '#FF6600']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      locations={[0, 1]}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" backgroundColor="#2274F0" translucent={true} />
      <SafeAreaView style={styles.safeArea}>
        {/* Header with back button */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={goBack}
          >
            <Icon name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Payment Complete</Text>
          <View style={styles.emptySpace} />
        </View>
      
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Success Icon and Message */}
          <View style={styles.successHeader}>
            <View style={styles.successIconContainer}>
              <Icon name="checkmark-circle" size={80} color="#4CD964" />
            </View>
            <Text style={styles.successTitle}>Payment Successful!</Text>
            <Text style={styles.successMessage}>{message || 'Your subscription has been activated'}</Text>
          </View>

          {/* Order Details Card */}
          <View style={styles.detailsCard}>
            <Text style={styles.detailsTitle}>Order Summary</Text>
            
            {planDetails && (
              <>
                <View style={styles.detailsRow}>
                  <Text style={styles.detailsLabel}>Plan:</Text>
                  <Text style={styles.detailsValue}>{planDetails.title}</Text>
                </View>
                
                <View style={styles.detailsRow}>
                  <Text style={styles.detailsLabel}>Duration:</Text>
                  <Text style={styles.detailsValue}>{planDetails.duration}</Text>
                </View>
                
                <View style={styles.detailsRow}>
                  <Text style={styles.detailsLabel}>Coins:</Text>
                  <Text style={styles.detailsValue}>{planDetails.coins}</Text>
                </View>
              </>
            )}
            
            {discount && (
              <View style={styles.detailsRow}>
                <Text style={styles.detailsLabel}>Discount:</Text>
                <Text style={styles.discountValue}>{discount}</Text>
              </View>
            )}
            
            <View style={[styles.detailsRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total Paid:</Text>
              <Text style={styles.totalValue}>{finalPrice || '0'} HKD</Text>
            </View>
          </View>

          {/* Subscription Period Card */}
          <View style={styles.detailsCard}>
            <Text style={styles.detailsTitle}>Subscription Period</Text>
            
            <View style={styles.dateContainer}>
              <View style={styles.dateItem}>
                <Text style={styles.dateLabel}>Start Date:</Text>
                <Text style={styles.dateValue}>{startDate || 'Today'}</Text>
              </View>
              
              <View style={styles.dateItem}>
                <Text style={styles.dateLabel}>End Date:</Text>
                <Text style={styles.dateValue}>{endDate || 'N/A'}</Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.primaryButton} onPress={navigateToHome}>
              <Text style={styles.primaryButtonText}>Go to Home</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.secondaryButton} onPress={navigateToTransactions}>
              <Text style={styles.secondaryButtonText}>View Transactions</Text>
            </TouchableOpacity>
          </View>
          
          {/* Security Notice */}
          <View style={styles.securityNotice}>
            <Icon name="shield-checkmark" size={20} color="#FFF" />
            <Text style={styles.securityText}>
              Your payment is secure and your subscription is now active
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 20,
    marginTop: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  successHeader: {
    alignItems: 'center',
    marginBottom: 30,
  },
  successIconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  successMessage: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    opacity: 0.9,
    paddingHorizontal: 20,
  },
  detailsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2274F0',
    marginBottom: 15,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailsLabel: {
    fontSize: 16,
    color: '#666',
  },
  detailsValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  discountValue: {
    fontSize: 16,
    color: '#28a745',
    fontWeight: '500',
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF6600',
  },
  dateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dateItem: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 5,
  },
  dateValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  actions: {
    marginBottom: 20,
    marginTop: 10,
  },
  primaryButton: {
    backgroundColor: '#FF6600',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  securityText: {
    fontSize: 14,
    color: '#FFF',
    marginLeft: 8,
    textAlign: 'center',
    opacity: 0.8,
  },
  emptySpace: {
    width: 40,
    height: 40,
  },
});

export default PaymentSuccess; 