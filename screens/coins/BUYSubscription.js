import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, TextInput, FlatList, Alert, ActivityIndicator } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import PlanCard from '../../components/PlanCard';
import { createPaymentIntent, confirmSubscriptionPurchase } from '../../utils/stripeApi';

const BUYSubscription = ({ navigation, route }) => {
  const { uid, plan, price } = route.params;
  const [couponCode, setCouponCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [suggestedCoupons, setSuggestedCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [finalPrice, setFinalPrice] = useState(price);
  const [originalPrice, setOriginalPrice] = useState(price);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [paymentMethodId, setPaymentMethodId] = useState(null);
  const [forceRefresh, setForceRefresh] = useState(0);

  useEffect(() => {
    // Set end date based on plan
    const start = new Date();
    setStartDate(start);
    
    const end = new Date(start);
    if (plan === 'Tester') {
      end.setDate(end.getDate() + 15); // 15 days
    } else if (plan === 'Monthly') {
      end.setMonth(end.getMonth() + 1); // 1 month
    } else if (plan === 'Yearly') {
      end.setFullYear(end.getFullYear() + 1); // 1 year
    }
    setEndDate(end);

    // Clean and set price values
    // Remove HKD from price string to get number
    const cleanPrice = price.replace(/[^0-9.]/g, '');
    console.log('Original price:', price);
    console.log('Cleaned price:', cleanPrice);
    setOriginalPrice(cleanPrice);
    setFinalPrice(cleanPrice);

    // Fetch suggested coupons
    fetchCoupons();
  }, []);

  const getPlanDetails = () => {
    if (plan === 'Tester') {
      return {
        title: 'Tester Plan',
        coins: '450 coins',
        duration: '15 Days',
        expiry: 'Coins will expire after 15 days',
        price: price
      };
    } else if (plan === 'Monthly') {
      return {
        title: 'Monthly Plan',
        coins: '1380 coins',
        duration: '1 Month',
        expiry: 'Coins will expire after 1 month',
        price: price
      };
    } else if (plan === 'Yearly') {
      return {
        title: 'Yearly Plan',
        coins: '1380 coins/month',
        duration: '12 Months',
        expiry: 'You will receive 1380 coins each month. These coins will expire at the end of each month.',
        price: price
      };
    }
    else if (plan === 'Addon') {
      return {
        title: 'Addon Plan',
        coins: '550 coins',
        duration: 'Until subscription',
        expiry: 'Coins will expire at end of this month',
        price: price
      };
    }
  };

  const planDetails = getPlanDetails();

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      console.log('=== FETCHING COUPONS ===');
      console.log('User ID:', uid);
      console.log('API URL: https://main-matrixai-server-lujmidrakh.cn-hangzhou.fcapp.run/api/user/getCoupon');
      
      const requestBody = { uid: uid };
      console.log('Request body:', JSON.stringify(requestBody));
      
      const response = await fetch('https://main-matrixai-server-lujmidrakh.cn-hangzhou.fcapp.run/api/user/getCoupon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      const result = await response.json();
      console.log('=== COUPON FETCH RESULT ===');
      console.log('Full result:', JSON.stringify(result, null, 2));
      
      if (result.success && result.data) {
        console.log('✅ Coupons found:', result.data.length);
        console.log('Coupon data:', result.data);
        setSuggestedCoupons(result.data);
        
        // Force a re-render by updating state
        setForceRefresh(prev => prev + 1);
        setTimeout(() => {
          console.log('Current suggestedCoupons state:', suggestedCoupons);
        }, 100);
      } else {
        console.log('❌ No coupons found or fetch failed');
        console.log('Result success:', result.success);
        console.log('Result message:', result.message);
        setSuggestedCoupons([]); // Ensure empty array instead of undefined
        
        // Only show alert if there's an actual error, not just no coupons
        if (!result.success && result.message) {
          Alert.alert('Info', result.message);
        }
      }
    } catch (error) {
      console.error('=== COUPON FETCH ERROR ===');
      console.error('Error details:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      setSuggestedCoupons([]); // Ensure empty array on error
      Alert.alert('Error', 'Something went wrong while fetching coupons');
    } finally {
      setLoading(false);
      console.log('=== COUPON FETCH COMPLETE ===');
    }
  };

  const applyCoupon = (coupon = null) => {
    const codeToApply = coupon ? coupon.coupon_name : couponCode;
    
    // Find the coupon in the suggested coupons
    const selectedCoupon = coupon || suggestedCoupons.find(c => c.coupon_name === codeToApply);
    
    if (!selectedCoupon) {
      Alert.alert('Invalid Coupon', 'Please enter a valid coupon code');
      return;
    }

    // Check if coupon is already applied
    if (appliedCoupon && appliedCoupon.coupon_name === selectedCoupon.coupon_name) {
      Alert.alert('Already Applied', 'This coupon is already applied');
      return;
    }

    // Apply discount
    const discountAmount = selectedCoupon.coupon_amount;
    setDiscount(discountAmount);
    
    // Calculate final price - ensure we're working with numbers
    const originalPriceNum = parseFloat(originalPrice);
    const discountedPrice = originalPriceNum * (1 - discountAmount / 100);
    const finalPriceValue = discountedPrice.toFixed(0);
    console.log('Discounted price calculation:', originalPriceNum, discountAmount, finalPriceValue);
    setFinalPrice(finalPriceValue);
    
    // Set applied coupon
    setAppliedCoupon(selectedCoupon);
    
    // If coupon was manually entered, clear the input
    if (!coupon) setCouponCode('');
  };

  const removeCoupon = () => {
    setDiscount(0);
    setFinalPrice(originalPrice);
    setAppliedCoupon(null);
  };

  const handleConfirm = () => {
    // Format dates as strings to avoid serialization issues
    const formattedStartDate = startDate.toISOString();
    const formattedEndDate = endDate.toISOString();
    
    // Navigate to Antom payment screen with necessary details
    navigation.navigate('AntomPaymentScreen', {
      uid: uid,
      plan: plan,
      planDetails: planDetails,
      finalPrice: finalPrice,
      discount: discount,
      appliedCoupon: appliedCoupon,
      startDate: formattedStartDate,
      endDate: formattedEndDate,
    });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric', 
      month: 'short', 
      day: 'numeric'
    });
  };

  return (
    <LinearGradient
      colors={['#2274F0', '#FF6600']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      locations={[0, 1]}
      style={styles.container}
    >
      <View style={styles.container2}>
      {/* Back Button */}
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <View style={styles.backButtonCircle}>
          <Icon name="arrow-back" size={20} color="#fff" />
        </View>
      </TouchableOpacity>

      {/* Header */}
      <Text style={styles.title}>Complete Purchase</Text>

      {/* Plan Details Card */}
      <PlanCard planDetails={planDetails} />

      {/* Coupon Section */}
      <View style={styles.couponSection}>
        <Text style={styles.sectionTitle}>Apply Coupon</Text>
        
        <View style={styles.couponInputContainer}>
          <TextInput
            style={styles.couponInput}
            placeholder="Enter coupon code"
            placeholderTextColor="#999"
            value={couponCode}
            onChangeText={setCouponCode}
          />
          <TouchableOpacity 
            style={styles.applyCouponButton} 
            onPress={() => applyCoupon()}
            disabled={!couponCode}
          >
            <Text style={styles.applyCouponButtonText}>Apply</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.suggestedCouponsSection}>
          <Text style={styles.suggestedCouponsTitle}>Suggested Coupons</Text>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.loadingText}>Loading coupons...</Text>
            </View>
          ) : (
            <View style={styles.couponsContainer}>
              {suggestedCoupons && suggestedCoupons.length > 0 ? (
                <View style={styles.couponsWrapper}>
                  <Text style={styles.couponsCountText}>
                    {suggestedCoupons.length} coupon{suggestedCoupons.length > 1 ? 's' : ''} available
                  </Text>
                  {suggestedCoupons.map((item, index) => (
                    <View key={item.id ? item.id.toString() : index.toString()} style={styles.couponItem}>
                      <View style={styles.couponInfo}>
                        <Text style={styles.couponName}>{item.coupon_name}</Text>
                        <Text style={styles.couponDescription}>{item.description}</Text>
                      </View>
                      <TouchableOpacity 
                        style={[
                          styles.applyButton, 
                          appliedCoupon && appliedCoupon.coupon_name === item.coupon_name ? styles.appliedButton : {}
                        ]}
                        onPress={() => appliedCoupon && appliedCoupon.coupon_name === item.coupon_name ? removeCoupon() : applyCoupon(item)}
                      >
                        <Text style={styles.applyButtonText}>
                          {appliedCoupon && appliedCoupon.coupon_name === item.coupon_name ? 'Applied' : 'Apply'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.noCouponsContainer}>
                  <Text style={styles.noCouponsText}>No coupons available at the moment</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>

      {/* Price Summary */}
      <View style={styles.priceSummary}>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Original Price:</Text>
          <Text style={styles.priceValue}>{originalPrice}HKD</Text>
        </View>
        
        {discount > 0 && (
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Discount ({discount}%):</Text>
            <Text style={styles.discountValue}>-{(originalPrice - finalPrice).toFixed(0)}HKD</Text>
          </View>
        )}
        
        <View style={styles.priceRow}>
          <Text style={styles.finalPriceLabel}>Final Price:</Text>
          <Text style={styles.finalPriceValue}>{finalPrice}HKD</Text>
        </View>
      </View>

      {/* Confirm Button */}
      <TouchableOpacity 
        style={styles.confirmButton} 
        onPress={handleConfirm}
      >
        <Text style={styles.confirmButtonText}>
          Proceed to Payment
        </Text>
      </TouchableOpacity>
      </View>

      {/* Processing overlay */}
      {processing && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.processingText}>Processing your payment...</Text>
        </View>
      )}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,

  },
  container2: {
    flex: 1,
    padding:20,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 1,
  },
  backButtonCircle: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginTop: 60,
    marginBottom: 20,
  },
  planCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  planCardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2274F0',
    textAlign: 'center',
    marginBottom: 10,
  },
  planDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  planDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coinIcon: {
    width: 20,
    height: 20,
    marginRight: 5,
  },
  planDetailText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  dateContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  dateLabel: {
    fontSize: 14,
    color: '#666',
    width: '30%',
  },
  dateValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    width: '20%',
  },
  planExpiryNote: {
    fontSize: 12,
    color: '#FF6600',
    fontStyle: 'italic',
    marginTop: 5,
  },
  paymentSection: {
    marginBottom: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 15,
  },
  couponSection: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  couponInputContainer: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  couponInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    paddingHorizontal: 15,
    height: 45,
    color: '#333',
  },
  applyCouponButton: {
    backgroundColor: '#2274F0',
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    justifyContent: 'center',
    paddingHorizontal: 15,
  },
  applyCouponButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  suggestedCouponsTitle: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 10,
  },
  couponsListContainer: {
    maxHeight: 150,
  },
  couponItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  couponInfo: {
    flex: 1,
  },
  couponName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2274F0',
  },
  couponDescription: {
    fontSize: 12,
    color: '#666',
  },
  applyButton: {
    backgroundColor: '#FF6600',
    paddingVertical: 6,
    paddingHorizontal: 15,
    borderRadius: 5,
  },
  appliedButton: {
    backgroundColor: '#28a745',
  },
  applyButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  noCouponsContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  noCouponsText: {
    color: '#fff',
    textAlign: 'center',
    marginTop: 10,
  },
  priceSummary: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  priceLabel: {
    fontSize: 14,
    color: '#666',
  },
  priceValue: {
    fontSize: 14,
    color: '#333',
  },
  discountValue: {
    fontSize: 14,
    color: '#28a745',
    fontWeight: 'bold',
  },
  finalPriceLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: 'bold',
  },
  finalPriceValue: {
    fontSize: 16,
    color: '#FF6600',
    fontWeight: 'bold',
  },
  confirmButton: {
    backgroundColor: '#FF8000',
    alignItems: 'center',
    paddingVertical: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 20,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  couponsContainer: {
    flex: 1,
  },
  couponsCountText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  couponsWrapper: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 10,
  },
  suggestedCouponsSection: {
    marginBottom: 15,
  },
});

export default BUYSubscription;