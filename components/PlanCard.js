import React from 'react';
import { View, Text, StyleSheet, Image, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

const PlanCard = ({ planDetails }) => {
  const isExpired = planDetails.isExpired; // boolean to control expiry styling
  const statusLabel = isExpired ? 'Expired' : 'Expire';

  return (
    <View style={styles.planCard}>
      {/* Status Label */}
      <View style={styles.statusLabel}>
        <Text style={styles.statusText}>
          {statusLabel}
        </Text>
      </View>

      {/* Background Watermark Image */}
      <Image
        source={require('../assets/logo.png')} // Update path accordingly
        style={styles.watermark}
        resizeMode="contain"
      />

      {/* Title */}
      <Text style={styles.titleText}>{planDetails.title}</Text>

      {/* Remaining Time */}
      <View style={styles.coinsContainer}>
        <Text style={styles.labelText}>Coins:</Text>
        <Text style={styles.timeText}>{planDetails.coins}</Text>
      </View>

      {/* Total Time */}
      <View style={styles.priceContainer}>
        <Text style={styles.labelText}>Price:</Text>
        <Text style={styles.totalTimeText}>{planDetails.price}</Text>
      </View>

      {/* Expiry Date */}
      <Text style={styles.expiryDate}>Valid until {planDetails.expiry}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  planCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    width: width * 0.9,
    alignSelf: 'center',
    marginVertical: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D7D7D7FF',
  },
  statusLabel: {
    position: 'absolute',
    top: -10,
    right: -10,
    borderRadius: 8,
    backgroundColor: '#F5F5F5FF',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
 
  statusText: {
    fontSize: 16,
    marginRight: 10,
    marginTop: 10,
    color: '#888',
    fontWeight: '500',
  },
 
  watermark: {
    position: 'absolute',
    bottom: -50,
    right: -50,
    width: 200,
    height: 200,
    zIndex: -1,
    resizeMode: 'contain',
    opacity: 0.05,
    tintColor: '#999',
  },
  priceContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: 30,
    marginLeft: 20,
  },
  coinsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
   
    marginLeft: 20,
  },
  titleText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#999',
    marginBottom: 10,
  },
  labelText: {
    fontSize: 16,
    color: '#999',
   
  },
  timeText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#999',
   
  },
  totalTimeText: {
    fontSize: 24,
    color: '#ccc',
 
  },
  expiryDate: {
    fontSize: 14,
    color: '#ccc',
    position: 'absolute',
    bottom: 10,
    right: 10,
  },
});

export default PlanCard;
