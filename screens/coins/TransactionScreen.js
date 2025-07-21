import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import axios from 'axios';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthUser } from '../../hooks/useAuthUser';
import { useCoinsSubscription } from '../../hooks/useCoinsSubscription';
import { useProfileUpdate } from '../../context/ProfileUpdateContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';  
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const TransactionScreen = ({ route, navigation }) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();
  const { uid } = useAuthUser();
  const { lastUpdate } = useProfileUpdate();
  const coinCount = useCoinsSubscription(uid);

  useEffect(() => {
    fetchTransactions();
  }, [lastUpdate]); // Refresh when profile is updated

  const fetchTransactions = async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const response = await axios.post('https://main-matrixai-server-lujmidrakh.cn-hangzhou.fcapp.run/api/user/AllTransactions', {
        uid: uid
      });
      
      console.log('Transaction API response:', response.data);
      
      if (response.data.success) {
        // Get the data from the appropriate field (data or transactions)
        const transactionData = response.data.data || response.data.transactions || [];
        const sortedTransactions = transactionData.sort((a, b) => new Date(b.time) - new Date(a.time));
        setTransactions(sortedTransactions);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchTransactions();
  };

  const getTransactionIcon = (transactionName) => {
    switch (transactionName.toLowerCase()) {
      case 'audio transcription':
        return 'audio-file';
      case 'image generation':
        return 'image';
      case 'matrix bot':
        return 'chat';
      case 'image to text':
        return 'image';
      case 'text to image':
        return 'image';
      default:
        return 'video-file';
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderItem = ({ item }) => (
    <View style={[styles.transactionItem, {backgroundColor: colors.card}]}>
      <View style={styles.iconContainer}>
      <Icon name={getTransactionIcon(item.transaction_name)} size={30} color="#4169E1" style={styles.image} />
      </View>
      <View style={styles.transactionDetails}>
        <Text style={[styles.transactionType, {color: colors.text}]}>{item.transaction_name}</Text>
        <Text style={[styles.transactionSubText, {color: colors.text}]}>{formatDate(item.time)}</Text>
      </View>
      <View style={styles.coinsContainer}>
        <Text style={[styles.coinsText, {color: colors.text}, item.status === 'success' ? styles.successText : styles.pendingText]}>
          {item.coin_amount} Coins
        </Text>
        <Text style={[styles.statusText, {color: colors.text}]}>{item.status}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: colors.background}] }>
      {/* Back button */}
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back-ios-new" size={24} color="white" />
                               </TouchableOpacity>

      {/* Header with full background */}
      <TouchableOpacity style={styles.header} onPress={() => navigation.navigate('AddonScreen')}>
        <Image source={require('../../assets/Header.png')} style={styles.headerImage} />
        <Text style={styles.coinCount}>{coinCount} Coins</Text>
      </TouchableOpacity>

      {/* Action buttons */}
      <View style={styles.actionsRow}>
        <View>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('TransactionScreen2')}>
            <Image source={require('../../assets/convert_copy.png')} style={styles.actionIcon} />
          </TouchableOpacity>
          <Text style={styles.actionText}>Transaction</Text>
        </View>
       
        <View>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('AddonScreen')}>
            <Image source={require('../../assets/money-send.png')} style={styles.actionIcon} />
          </TouchableOpacity>
          <Text style={styles.actionText}>Buy Coins</Text>
        </View>
        <View>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('ReferralScreen')}>
            <Image source={require('../../assets/add-circle.png')} style={styles.actionIcon} />
          </TouchableOpacity>
          <Text style={styles.actionText}>Invite</Text>
        </View>
      </View>

      {/* Transaction List */}
      <View style={styles.transactionsHeader}>
        <Text style={[styles.subtitle, {color: colors.text}]}>Last Transaction</Text>
        <TouchableOpacity onPress={() => navigation.navigate('TransactionScreen2')}>
          <Text style={styles.viewAllText}>View All</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#4169E1" style={styles.loader} />
      ) : (
        <FlatList
          data={transactions.slice(0, 5)}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          style={styles.transactionList}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fc',
    padding: 20,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007bff',
   
    marginRight:10,
    zIndex: 1,
  
  },
  headerIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  header: {
    position: 'relative',
    height: 200,
    marginBottom: 40,
    marginTop: -40,
  },
  headerImage: {
    width: '105%',
    height: '130%',
    resizeMode: 'contain',
  },
  coinCount: {
    position: 'absolute',
    top: 110,
    left: 20,
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 15,
    width: 80,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  actionIcon: {
    width: 40,
    height: 40,
    marginBottom: 5,
  },
  actionText: {
    fontSize: 14,
    color: '#4169E1',
    textAlign: 'center',
    marginTop: 5,
  },
  transactionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  viewAllText: {
    color: '#FF4500',
    fontSize: 14,
    fontWeight: '600',
  },
  transactionList: {
    marginTop: 10,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },

  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
    resizeMode: 'contain',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4169E1',
  },
  transactionDetails: {
    flex: 1,
  },
  transactionType: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  transactionSubText: {
    fontSize: 12,
    color: '#666',
  },
  coinsContainer: {
    alignItems: 'flex-end',
  },
  coinsText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  successText: {
    color: '#4CAF50',
  },
  pendingText: {
    color: '#FFA500',
  },
  statusText: {
    fontSize: 12,
    color: '#666',
    textTransform: 'capitalize',
  },
});

export default TransactionScreen;
