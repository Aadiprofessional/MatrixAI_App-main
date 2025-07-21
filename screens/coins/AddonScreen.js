import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import { useCoinsSubscription } from '../../hooks/useCoinsSubscription';
import { useAuthUser } from '../../hooks/useAuthUser';

const AddonScreen = ({ navigation }) => {
  const { uid } = useAuthUser();
  const coinCount = useCoinsSubscription(uid);

  const handleBuyNow = () => {
    navigation.navigate('BUYSubscription', {
      uid: uid,
      plan: 'Addon',
      price: '$50 HKD'
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
        <Text style={styles.descriptionText}>Top up your coins to continue using premium AI tools & bots</Text>
      </View>

      {/* Single Plan */}
      <View style={styles.plansContainer}>
        <View style={[styles.plan, styles.activePlan]}>
          <Text style={styles.planTitle}>Addon Pack</Text>
          <Text style={styles.planPrice2}>
            $50 HKD
          </Text>
          <View style={styles.planPriceContainer}>
            <Text style={styles.planPrice}>
              550
            </Text>
            <Image source={require('../../assets/coin.png')} style={styles.planIcon} />
          </View>
        </View>
      </View>

      <View style={styles.planTextContainer}>
        <Text style={styles.planText}>
          *These coins will be added to your existing balance. and expire end of this month.
        </Text>
        <TouchableOpacity style={styles.tcButton} onPress={handleTermsAndConditions}>
          <Text style={styles.tcButtonText}>T&C Applied</Text>
        </TouchableOpacity>
      </View>

      {/* Buy Now Button */}
      <TouchableOpacity style={styles.buyButton} onPress={handleBuyNow}>
        <Text style={styles.buyButtonText}>Buy Now <Text style={{fontSize:18}}>$50 HKD</Text></Text>
      </TouchableOpacity>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    top: 80,
    left: 20,
    tintColor: '#fff',
    zIndex: 1,
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
    marginBottom: 20,
  },
  coinIcon: {
    width: 400,
    height: 200,
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
    alignItems: 'center',
    marginVertical: 20,
    paddingHorizontal: 20,
  },
  plan: {
    width: '100%',
    backgroundColor: '#fff',
    paddingVertical: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
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
  buyButton: {
    backgroundColor: '#FF8000FF',
    alignItems: 'center',
    paddingVertical: 15,
    margin: 10,
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
    marginLeft: 10,
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

export default AddonScreen; 