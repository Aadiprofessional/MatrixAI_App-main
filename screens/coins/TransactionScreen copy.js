import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import axios from 'axios';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAuthUser } from '../../hooks/useAuthUser';
import { useTheme } from '../../context/ThemeContext';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
const TransactionScreen2 = ({ navigation }) => {

  const { uid } = useAuthUser();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    setRefreshing(true);
    try {
      const response = await axios.post('https://main-matrixai-server-lujmidrakh.cn-hangzhou.fcapp.run/api/user/AllTransactions', {
        uid: uid
      });
      
      if (response.data.success) {
        // Sort transactions by date in descending order
        const sortedTransactions = response.data.data.sort((a, b) => new Date(b.time) - new Date(a.time));
        setTransactions(sortedTransactions);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
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
        <Text style={[styles.balanceText, {color: colors.text}]}>Balance: {item.remaining_coins} coins</Text>
      </View>
      <View style={styles.coinsContainer}>
        <Text style={[styles.coinsText, {color: colors.text}, item.status === 'success' ? styles.successText : styles.pendingText]}>
          -{item.coin_amount} Coins
        </Text>
        <Text style={[styles.statusText, {color: colors.text}, item.status === 'success' ? styles.successText : styles.pendingText]}>
          {item.status}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
      <View style={styles.header}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back-ios-new" size={24} color="white" />
                               </TouchableOpacity>
        <Text style={[styles.headerTitle, {color: colors.text}]}>Transaction History</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#4169E1" style={styles.loader} />
      ) : (
        <FlatList
          data={transactions}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          style={styles.transactionList}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={fetchTransactions}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingTop: 10,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#007bff',
   
    marginRight:10,
  },
  backIcon: {
    width: 24,
    height: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginLeft: 15,
    color: '#333',
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
  listContent: {
    paddingBottom: 20,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  image: {

 
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
    marginBottom: 4,
  },
  balanceText: {
    fontSize: 12,
    color: '#4169E1',
    fontWeight: '500',
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
    textTransform: 'capitalize',
    fontWeight: '500',
  },
});

export default TransactionScreen2;
