import React, { useState, useEffect } from 'react';

import supabase from '../../supabaseClient';
import { View, Text, StyleSheet, TouchableOpacity, Image, ImageBackground } from 'react-native';
import LinearGradient from 'react-native-linear-gradient'; // Install react-native-linear-gradient for gradient backgrounds

import { useCoinsSubscription } from '../../hooks/useCoinsSubscription';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuthUser } from '../../hooks/useAuthUser';


const SubscriptionScreen = ({ navigation }) => {
  const { uid } = useAuthUser();
  const coinCount = useCoinsSubscription(uid);
  const [selectedPlan, setSelectedPlan] = useState('Basic'); // Default selected plan as Basic
  const [coins, setCoins] = useState(null);
  const [loading, setLoading] = useState(true);
console.log(uid);


  const handlePlanSelect = (plan) => {
    setSelectedPlan(plan);
  };

  const getButtonPrice = () => {
    if (selectedPlan === 'Basic') {
      return '50 HKD';
    } else if (selectedPlan === 'Premium') {
      return '150 HKD';
    } else if (selectedPlan === 'Enterprise') {
      return '500 HKD';
    }
  };

  const getPlanAmount = () => {
    if (selectedPlan === 'Basic') {
      return 50;
    } else if (selectedPlan === 'Premium') {
      return 150;
    } else if (selectedPlan === 'Enterprise') {
      return 500;
    }
  };

  const getPlanText = () => {
    if (selectedPlan === 'Basic') {
      return '*Basic plan includes 450 coins valid for 1 month.';
    } else if (selectedPlan === 'Premium') {
      return '*Premium plan includes 1500 coins valid for 1 month.';
    } else if (selectedPlan === 'Enterprise') {
      return '*Enterprise plan includes 5000 coins valid for 1 month.';
    }
  };

  const handleBuyNow = () => {
    // Prepare order data for Airwallex payment
    const orderData = {
      type: 'subscription',
      planId: selectedPlan.toLowerCase(),
      name: `${selectedPlan} Plan`,
      amount: getPlanAmount(),
      currency: 'HKD',
      quantity: 1
    };
    
    // Navigate to Airwallex payment screen
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
      locations={[0, 1]} // Adjust the gradient angle
      style={styles.container}
    >
      {/* Back Button */}
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <View style={styles.backButtonCircle}>
                    <Icon name="arrow-back" size={20} color="#fff" />
                </View>
            </TouchableOpacity>

      {/* Header */}
      <Text style={styles.title}>Subscription</Text>

      {/* Coin Section */}
      <View style={styles.coinSection}>
     
        <Image source={require('../../assets/coin2.png')} style={styles.coinIcon} />
        <Text style={styles.coinText}>
         {coinCount} COINS
        </Text>
        <Text style={styles.subtitle}>
          You will get <Text style={{ fontWeight: 'bold' }}>10% EXTRA</Text> discount here to buy a yearly subscription
        </Text>
      </View>

    
      {/* Description */}
      <View style={styles.descriptionContainer}>
        <Text style={styles.descriptionTitle}>Unlimited Access to All MatrixAI Tools</Text>
        <Text style={styles.descriptionText}>Get access to premium AI tools & bots</Text>
      </View>

      {/* Plans */}
      <View style={styles.plansContainer}>
        <TouchableOpacity
          style={[styles.plan, selectedPlan === 'Basic' && styles.activePlan]}
          onPress={() => handlePlanSelect('Basic')}
        >
          <Text style={styles.planTitle}>Basic</Text>
          <Text style={styles.planPrice2}>
            50 HKD
          </Text>
          <View style={styles.planDiscountContainer}>
            <Text style={styles.planDiscountPlaceholder}> </Text>
          </View>
          <View style={styles.planPriceContainer}>
            <Text style={styles.planPrice}>
             450
            </Text>
           <Image source={require('../../assets/coin.png')} style={styles.planIcon} />
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.plan, selectedPlan === 'Premium' && styles.activePlan]}
          onPress={() => handlePlanSelect('Premium')}
        >
          <Text style={styles.planTitle}>Premium</Text>
          <Text style={styles.planPrice2}>
            150 HKD
          </Text>
          <View style={styles.planDiscountContainer}>
            <Text style={styles.planDiscountPlaceholder}> </Text>
          </View>
          <View style={styles.planPriceContainer}>
            <Text style={styles.planPrice}>
             1500
            </Text>
           <Image source={require('../../assets/coin.png')} style={styles.planIcon} />
          </View>
        </TouchableOpacity>
      
        <TouchableOpacity
          style={[styles.plan, selectedPlan === 'Enterprise' && styles.activePlan]}
          onPress={() => handlePlanSelect('Enterprise')}
        >
          <Text style={styles.planTitle}>Enterprise</Text>
          <Text style={styles.planPrice2}>
            500 HKD
          </Text>
          <View style={styles.planDiscountContainer}>
            <Text style={styles.planPrice4}>
              Best Value
            </Text>
          </View>
          <View style={styles.planPriceContainer}>
            <Text style={styles.planPrice}>
             5000
            </Text>
           <Image source={require('../../assets/coin.png')} style={styles.planIcon} />
          </View>
        </TouchableOpacity>
      </View>
      
      <View style={styles.planTextContainer}>
        <Text style={styles.planText}>
          {getPlanText()}
        </Text>
    
          <TouchableOpacity style={styles.tcButton} onPress={handleTermsAndConditions}>
            <Text style={styles.tcButtonText}>T&C Applied</Text>
          </TouchableOpacity>
          
        </View>

      {/* Buy Now Button */}
      <TouchableOpacity style={styles.buyButton} onPress={handleBuyNow}>
        <Text style={styles.buyButtonText}>Buy Now <Text style={{fontSize:18}}>{getButtonPrice()}</Text></Text>
      </TouchableOpacity>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
      // Margin top of 50
  },
  planPriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignContent:'center',
    textAlignVertical:'center',
    minHeight: 30,
    marginTop: 5,
  },
  planDiscountContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    alignContent:'center',
    textAlignVertical:'center',
    minHeight: 25,
    marginTop: 5,
  },
  planDiscountPlaceholder: {
    fontSize: 10,
    color: 'transparent',
  },
  planIcon: {
    width: 20,
    height: 20,
    

    marginTop: 10,
  },
  backButton: {
    position: 'absolute',
    top: 80,
    left: 20,
    tintColor:'#fff',
    zIndex: 1,
  },
  backIcon: {
    width: 24,
    height: 24,
  },
  planPrice4: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#EC6B0EFF',
    marginTop: 2,
  },
  title: {
    fontSize: 24,
    marginTop: 80,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginVertical: 20,
  },
  coinSection: {
    alignItems: 'center',
   marginBottom:20,
  },
  coinIcon: {
    width: 400,
    height: 200,
  },
  coinIcon2: {
    width: 400,
    height: 80,
    zIndex:-1,
  },
  coinText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginVertical: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
    marginHorizontal: 20,
  },
  earnButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 15,
    margin:10,
    borderRadius: 5,
    marginTop: 20,
  },
  earnButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#004E92',
    marginRight: 8,
  },
  playIcon: {
    width: 20,
    height: 20,
  },
  descriptionContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  descriptionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  descriptionText: {
    fontSize: 14,
    color: '#fff',
  },
  plansContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 20,
  },
  plan: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: 20,
    paddingHorizontal: 8,
    marginHorizontal: 5,
    borderRadius: 10,
    justifyContent: 'space-between',
    alignContent: 'center',
    alignItems: 'center',
    textAlignVertical:'center',
    minHeight: 140,
  },
  activePlan: {
    borderWidth: 2,
    borderColor: '#FFC107',
  },
  planTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#004E92',
  },
    planPrice: {
      fontSize: 14,
      fontWeight: 'bold',
      color: '#004E92',
      marginTop: 10,
    },
    planPrice2: {
      fontSize: 14,
      fontWeight: 'bold',
      color: '#EC6B0EFF',
      marginTop: 10,
    },
    planPrice3: {
      fontSize: 10,
      fontWeight: 'bold',
      textDecorationLine: 'line-through',
      color: '#5A5A5AFF',
      marginTop: 5,
      marginBottom: 2,
    },
  planCoinIcon: {
    width: 16,
    height: 16,
  },
  buyButton: {
    backgroundColor: '#FF8000FF',
    alignItems: 'center',
    paddingVertical: 15,
    margin:10,
    borderRadius: 5,
    marginTop: 20,
  },
  buyButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  planTextContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  planText: {
    fontSize: 12,
    color: '#fff',
    textAlign: 'left',
 marginLeft:10,
    flex: 1,
  },
  tcButton: {
    backgroundColor: '#2274F000',
   
 
  },
  tcButtonText: {
    color: '#2274F0',
    fontSize: 12,
    fontWeight: 'bold',
  },
  backButtonCircle: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default SubscriptionScreen;
