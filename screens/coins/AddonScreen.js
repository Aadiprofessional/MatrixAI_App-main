import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import { useCoinsSubscription } from '../../hooks/useCoinsSubscription';
import { useAuthUser } from '../../hooks/useAuthUser';
import airwallexService from '../../services/airwallexService';

const AddonScreen = ({ navigation }) => {
  const { uid } = useAuthUser();
  const coinCount = useCoinsSubscription(uid);
  
  // State for addon plans
  const [addonPlans, setAddonPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState(null);

  // Fetch addon plans from API
  const fetchAddonPlans = async () => {
    try {
      setPlansLoading(true);
      const response = await airwallexService.getSubscriptionPlans(uid);
      
      console.log('📦 Addon plans API response:', response);
      
      // Check if we have plans in the response (either directly or nested in data)
      const plansArray = response?.plans || response?.data?.plans;
      
      if (response && response.success && plansArray && plansArray.length > 0) {
        // Use all returned plans as addon options
        const plans = plansArray.map(plan => ({
          ...plan,
          // Ensure all required fields are present
          currency: plan.currency || 'HKD',
          plan_name: plan.plan_name || `${plan.coins} Coins Pack`,
          // Mark as addon type for payment processing
          type: 'addon'
        }));
        
        console.log('✅ Processed addon plans:', plans);
        setAddonPlans(plans);
        
        // Set first plan as selected by default
        if (plans.length > 0) {
          setSelectedPlan(plans[0]);
        }
      } else {
        console.log('⚠️ No plans in API response or user excluded from addons, using fallback');
        // Fallback to hardcoded addon - simple 880 coins for $88 HKD
        const fallbackAddon = {
          id: 'addon_880_coins',
          plan_name: 'Addon Pack',
          coins: 880,
          price: 88,
          currency: 'HKD',
          plan_period: 'one-time',
          type: 'addon'
        };
        setAddonPlans([fallbackAddon]);
        setSelectedPlan(fallbackAddon);
      }
    } catch (error) {
      console.error('❌ Error fetching addon plans:', error);
      
      // Show error alert with retry option
      Alert.alert(
        'Error Loading Addon Plans',
        'Failed to load addon plans. Would you like to retry?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry', onPress: fetchAddonPlans }
        ]
      );
      
      // Fallback to hardcoded addon
      const fallbackAddon = {
        id: 'addon_880_coins',
        plan_name: 'Addon Pack - 880 Coins',
        coins: 880,
        price: 88,
        currency: 'HKD',
        plan_period: 'one-time',
        type: 'addon'
      };
      setAddonPlans([fallbackAddon]);
      setSelectedPlan(fallbackAddon);
    } finally {
      setPlansLoading(false);
    }
  };

  // Fetch plans on component mount
  useEffect(() => {
    if (uid) {
      fetchAddonPlans();
    }
  }, [uid]);

  const handleBuyNow = () => {
    if (!selectedPlan) {
      Alert.alert('Error', 'Please select an addon plan first.');
      return;
    }

    // Prepare order data for payment screen with all required fields
    const orderData = {
      type: 'addon',
      addonId: selectedPlan.id,
      name: selectedPlan.plan_name,
      amount: selectedPlan.price,
      currency: selectedPlan.currency || 'HKD', // Ensure currency is always present
      quantity: 1,
      coins: selectedPlan.coins,
      description: `${selectedPlan.plan_name} - ${selectedPlan.coins} coins`,
      uid: uid // Include uid for backend processing
    };
    
    // Navigate directly to payment screen
    navigation.navigate('AirwallexPaymentScreen', {
      orderData: orderData
    });
  };

  const handleTermsAndConditions = () => {
    navigation.navigate('TermsAndConditions');
  };

  return (
    <LinearGradient
      colors={['#2274F0', '#FF6600']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      locations={[0, 1]}
      style={styles.container}
    >
      {/* Back Button */}
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <View style={styles.backButtonCircle}>
          <Icon name="arrow-back" size={20} color="#fff" />
        </View>
      </TouchableOpacity>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={styles.title}>Addon Coins</Text>

        {/* Coin Section */}
        <View style={styles.coinSection}>
          <Image source={require('../../assets/coin2.png')} style={styles.coinIcon} />
          <Text style={styles.coinText}>
            {coinCount} COINS
          </Text>
          <Text style={styles.subtitle}>
            Get additional coins to use more MatrixAI features
          </Text>
        </View>

        {/* Description */}
        <View style={styles.descriptionContainer}>
          <Text style={styles.descriptionTitle}>Get More Coins for MatrixAI Tools</Text>
          <Text style={styles.descriptionText}>Purchase additional coins to extend your MatrixAI experience</Text>
        </View>

        {/* Dynamic Plans */}
        <View style={styles.plansContainer}>
          {plansLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.loadingText}>Loading addon plans...</Text>
            </View>
          ) : (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.plansScrollView}
              contentContainerStyle={styles.plansScrollContainer}
            >
              {addonPlans.map((plan, index) => (
                <TouchableOpacity
                  key={plan.id || index}
                  style={[
                    styles.planCard,
                    selectedPlan?.id === plan.id && styles.selectedPlanCard
                  ]}
                  onPress={() => setSelectedPlan(plan)}
                >
                  <View style={styles.planCardHeader}>
                    <Text style={styles.planCardTitle}>
                      {plan.plan_name}
                    </Text>
                    <Text style={styles.planCardPrice}>
                      ${plan.price} {plan.currency || 'HKD'}
                    </Text>
                  </View>
                  <View style={styles.planCardBody}>
                    <View style={styles.coinContainer}>
                      <Image source={require('../../assets/coin.png')} style={styles.planCoinIcon} />
                      <Text style={styles.planCoinText}>{plan.coins} Coins</Text>
                    </View>
                    <Text style={styles.planPeriod}>One-time purchase</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.planTextContainer}>
          <Text style={styles.planText}>
            *These coins will be added to your existing balance. and expire end of this month.
          </Text>
          <TouchableOpacity style={styles.tcButton} onPress={handleTermsAndConditions}>
            <Text style={styles.tcButtonText}>T&C Applied</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Buy Now Button - Fixed at bottom */}
      <TouchableOpacity 
        style={[styles.buyButton, (!selectedPlan || plansLoading) && styles.disabledButton]} 
        onPress={handleBuyNow}
        disabled={!selectedPlan || plansLoading}
      >
        <Text style={styles.buyButtonText}>
          Buy Now{' '}
          <Text style={{fontSize:18}}>
            {selectedPlan ? `$${selectedPlan.price} ${selectedPlan.currency || 'HKD'}` : '$88 HKD'}
          </Text>
        </Text>
      </TouchableOpacity>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100, // Space for fixed buy button
  },
  planPriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignContent: 'center',
    textAlignVertical: 'center',
  },
  planIcon: {
    width: 20,
    height: 20,
    marginTop: 10,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    tintColor: '#fff',
    zIndex: 1,
  },
  title: {
    fontSize: 28,
    marginTop: 60,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
  },
  coinSection: {
    alignItems: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  coinIcon: {
    width: 120,
    height: 120,
    resizeMode: 'contain',
  },
  coinText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 15,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginHorizontal: 20,
    opacity: 0.9,
  },
  descriptionContainer: {
    alignItems: 'center',
    marginVertical: 25,
    paddingHorizontal: 20,
  },
  descriptionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    opacity: 0.9,
  },
  plansContainer: {
    alignItems: 'center',
    marginVertical: 20,
    paddingHorizontal: 10,
  },
  plansScrollView: {
    marginVertical: 10,
  },
  plansScrollContainer: {
    paddingHorizontal: 15,
  },
  planCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginRight: 15,
    width: 160,
    minHeight: 180,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    justifyContent: 'space-between',
  },
  selectedPlanCard: {
    borderColor: '#FF6600',
    backgroundColor: '#fff5f0',
    shadowColor: '#FF6600',
    shadowOpacity: 0.3,
  },
  planCardHeader: {
    alignItems: 'center',
    marginBottom: 15,
  },
  planCardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 18,
  },
  planCardPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF6600',
  },
  planCardBody: {
    alignItems: 'center',
  },
  coinContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    justifyContent: 'center',
  },
  planCoinIcon: {
    width: 20,
    height: 20,
    marginRight: 6,
    resizeMode: 'contain',
  },
  planCoinText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  planPeriod: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 5,
  },
  buyButton: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 25,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buyButtonText: {
    color: '#FF6600',
    fontSize: 18,
    fontWeight: 'bold',
  },
  planTextContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  planText: {
    fontSize: 12,
    color: '#fff',
    textAlign: 'left',
    marginLeft: 10,
    flex: 1,
    opacity: 0.8,
  },
  tcButton: {
    backgroundColor: 'transparent',
    paddingHorizontal: 10,
  },
  tcButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  backButtonCircle: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 10,
  },
  disabledButton: {
    opacity: 0.6,
  },
});

export default AddonScreen;