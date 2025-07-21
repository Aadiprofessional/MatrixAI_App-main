import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  Animated,
  Easing,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import moment from 'moment';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { LinearGradient } from 'react-native-linear-gradient';
import { useAuthUser } from '../hooks/useAuthUser';
import { useTheme } from '../context/ThemeContext';
import { useProfileUpdate } from '../context/ProfileUpdateContext';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useLanguage } from '../context/LanguageContext';
const OrderHistoryScreen = ({ navigation }) => {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'active', 'expired'
  const [activePlanFilter, setActivePlanFilter] = useState('all'); // 'all', 'monthly', 'yearly', 'addon'
  const { uid } = useAuthUser();
  const { lastUpdate } = useProfileUpdate();
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();
  const { t } = useLanguage();
  
  // Animated values for skeleton loading
  const shimmerValue = useRef(new Animated.Value(0)).current;
  
  // Shimmer animation
  useEffect(() => {
    if (loading) {
      // Start shimmer animation
      Animated.loop(
        Animated.timing(shimmerValue, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
          easing: Easing.linear,
        })
      ).start();
    } else {
      shimmerValue.setValue(0);
    }
    return () => {
      shimmerValue.setValue(0);
    };
  }, [loading]);
  
  // Calculate shimmer translation
  const shimmerTranslate = shimmerValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-100, 220],
  });
  const fetchOrders = async () => {
    if (!uid) return;
    try {
      setLoading(true);
      const response = await fetch('https://main-matrixai-server-lujmidrakh.cn-hangzhou.fcapp.run/api/user/getUserOrder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uid }),
      });
      const data = await response.json();
      console.log('Order API response:', data);
      if (data.success) {
        // Check if data.orders exists, otherwise try data.data
        const orderData = data.orders || data.data || [];
        
        // Sort orders by date (latest first)
        const sortedOrders = [...orderData].sort((a, b) => {
          return new Date(b.created_at) - new Date(a.created_at);
        });
        
        setOrders(sortedOrders);
        applyFilter(sortedOrders, activeFilter);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  // Apply filters to orders
  const applyFilters = (ordersList) => {
    let filtered = [...ordersList];
    
    // Apply status filter
    if (activeFilter !== 'all') {
      filtered = filtered.filter(order => {
        return order.status.toLowerCase() === activeFilter.toLowerCase();
      });
    }
    
    // Apply plan type filter
    if (activePlanFilter !== 'all') {
      filtered = filtered.filter(order => {
        // Extract plan type from plan_name or plan_type field
        const planType = order.plan_type || getPlanTypeFromName(order.plan_name);
        return planType.toLowerCase() === activePlanFilter.toLowerCase();
      });
    }
    
    setFilteredOrders(filtered);
  };
  
  // Helper function to extract plan type from plan name
  const getPlanTypeFromName = (planName) => {
    if (!planName) return '';
    const planNameLower = planName.toLowerCase();
    
    if (planNameLower.includes('monthly')) return 'monthly';
    if (planNameLower.includes('yearly')) return 'yearly';
    if (planNameLower.includes('addon')) return 'addon';
    
    return '';
  };
  
  // Handle status filter change
  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
    // Will trigger useEffect to apply both filters
  };
  
  // Handle plan type filter change
  const handlePlanFilterChange = (filter) => {
    setActivePlanFilter(filter);
    // Will trigger useEffect to apply both filters
  };

  useEffect(() => {
    fetchOrders();
  }, [lastUpdate]); // Refresh when profile is updated
  
  // Apply filters when orders, activeFilter, or activePlanFilter change
  useEffect(() => {
    applyFilters(orders);
  }, [orders, activeFilter, activePlanFilter]);
  
  // Render skeleton loading UI
  const renderSkeletonItem = () => {
    return (
      <View style={[styles.orderCard, {backgroundColor: colors.background2, borderColor: colors.border}]}>
        <View style={[styles.skeletonContainer, {backgroundColor: 'rgba(200, 200, 200, 0.2)'}]}>
          <Animated.View
            style={[
              styles.shimmer,
              {
                transform: [{ translateX: shimmerTranslate }],
              },
            ]}
          >
            <LinearGradient
              colors={[
                'rgba(255, 255, 255, 0.1)',
                'rgba(255, 255, 255, 0.3)',
                'rgba(255, 255, 255, 0.1)',
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.shimmerGradient}
            />
          </Animated.View>
        </View>
      </View>
    );
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchOrders();
  }, []);

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'active':
        return '#4CAF50';
      case 'expired':
        return '#F44336';
      default:
        return '#FFA000';
    }
  };

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: colors.background}] }>
      <View style={[styles.header, {backgroundColor: colors.background , borderBottomWidth: 0.8, borderColor: colors.border}]  }>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back-ios-new" size={24} color="white" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, {color: colors.text}]}>{t('orderHistory')}</Text>
      </View>
      
      {/* Status Filter buttons */}
      <View style={styles.filterContainer}>
        <Text style={[styles.filterLabel, {color: colors.text}]}>{t('status')}:</Text>
        <TouchableOpacity 
          style={[styles.filterButton, activeFilter === 'all' && styles.activeFilterButton]}
          onPress={() => handleFilterChange('all')}
        >
          <Text style={[styles.filterText, activeFilter === 'all' && styles.activeFilterText]}>{t('all')}</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.filterButton, activeFilter === 'active' && styles.activeFilterButton]}
          onPress={() => handleFilterChange('active')}
        >
          <Text style={[styles.filterText, activeFilter === 'active' && styles.activeFilterText]}>{t('active')}</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.filterButton, activeFilter === 'expired' && styles.activeFilterButton]}
          onPress={() => handleFilterChange('expired')}
        >
          <Text style={[styles.filterText, activeFilter === 'expired' && styles.activeFilterText]}>{t('expired')}</Text>
        </TouchableOpacity>
      </View>
      
      {/* Plan Type Filter buttons */}
      <View style={styles.filterContainer}>
        <Text style={[styles.filterLabel, {color: colors.text}]}>{t('planType')}:</Text>
        <TouchableOpacity 
          style={[styles.filterButton, activePlanFilter === 'all' && styles.activeFilterButton]}
          onPress={() => handlePlanFilterChange('all')}
        >
          <Text style={[styles.filterText, activePlanFilter === 'all' && styles.activeFilterText]}>{t('all')}</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.filterButton, activePlanFilter === 'monthly' && styles.activeFilterButton]}
          onPress={() => handlePlanFilterChange('monthly')}
        >
          <Text style={[styles.filterText, activePlanFilter === 'monthly' && styles.activeFilterText]}>{t('monthly')}</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.filterButton, activePlanFilter === 'yearly' && styles.activeFilterButton]}
          onPress={() => handlePlanFilterChange('yearly')}
        >
          <Text style={[styles.filterText, activePlanFilter === 'yearly' && styles.activeFilterText]}>{t('yearly')}</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.filterButton, activePlanFilter === 'addon' && styles.activeFilterButton]}
          onPress={() => handlePlanFilterChange('addon')}
        >
          <Text style={[styles.filterText, activePlanFilter === 'addon' && styles.activeFilterText]}>{t('addon')}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={[styles.loadingContainer, {backgroundColor: colors.background}]}>
          {/* Render skeleton loading UI */}
          {[1, 2, 3].map((item) => renderSkeletonItem())}
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => item.id.toString()}
          style={[styles.scrollView, {backgroundColor: colors.background}]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, {color: colors.text}]}>{t('noOrdersFound')}</Text>
            </View>
          }
          renderItem={({item: order}) => (
            <View key={order.id} style={[styles.orderCard, {backgroundColor: colors.background2 , borderColor: colors.border}]}>
              <View style={[styles.cardHeader, {backgroundColor: colors.background2}]}>
                <View style={[styles.planInfo, {backgroundColor: colors.background2}]}>
                  <Text style={[styles.planName, {color: colors.text}]}>{order.plan_name} Plan</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
                    <Text style={[styles.statusText, {color: '#fff'}]}>{order.status}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.helpButton, {backgroundColor: colors.background2}]}
                  onPress={() => navigation.navigate('HelpScreen', { orderId: order.id })}
                >
                  <Ionicons name="help-circle-outline" size={24} color={colors.primary} />
                </TouchableOpacity>
              </View>

              <View style={[styles.orderDetails, {backgroundColor: colors.background2}]}>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, {color: colors.text}]}>{t('orderId')}:</Text>
                  <Text style={[styles.detailValue, {color: colors.text}]}>#{order.id}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, {color: colors.text}]}>{t('amountPaid')}:</Text>
                  <Text style={[styles.detailValue, {color: colors.text}]}>${order.total_price} HKD</Text>
                </View>
               
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, {color: colors.text}]}>{t('validTill')}:</Text>
                  <Text style={[styles.detailValue, {color: colors.text}]}>
                    {moment(order.plan_valid_till).format('MMM DD, YYYY')}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, {color: colors.text}]}>{t('purchaseDate')}:</Text>
                  <Text style={[styles.detailValue, {color: colors.text}]} >
                    {moment(order.created_at).format('MMM DD, YYYY')}
                  </Text>
                </View>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#007bff',
    marginRight: 10,
  },
  headerIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 16,
    color: '#333',
  },
  // Filter styles
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 10,
    color: '#333',
  },
  filterButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
    marginBottom: 4,
  },
  activeFilterButton: {
    backgroundColor: '#007bff',
  },
  filterText: {
    fontSize: 12,
    color: '#666',
  },
  activeFilterText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  // Loading and empty state
  loadingContainer: {
    flex: 1,
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    height: 200,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  // Skeleton styles
  skeletonContainer: {
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  shimmer: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  shimmerGradient: {
    width: '100%',
    height: '100%',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  orderCard: {
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    padding: 10,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  planInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  planName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  helpButton: {
    padding: 8,
  },
  orderDetails: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    color: '#666',
    fontSize: 14,
  },
  detailValue: {
    color: '#333',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default OrderHistoryScreen;