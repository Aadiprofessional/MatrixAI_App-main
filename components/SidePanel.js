import React, { useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  TouchableOpacity, 
  ScrollView, 
  Animated, 
  Dimensions,
  TouchableWithoutFeedback
} from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../supabaseClient';
import { clearProStatus } from '../utils/proStatusUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');
const PANEL_WIDTH = width * 0.8;

const SidePanel = ({ isVisible, onClose, navigation }) => {
  const { uid } = useAuth();
  const [userName, setUserName] = React.useState('');
  const [dpUrl, setDpUrl] = React.useState(null);
  const slideAnim = useRef(new Animated.Value(-PANEL_WIDTH)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (uid) {
      fetchUserData();
    }
  }, [uid]);

  useEffect(() => {
    if (isVisible) {
      // Animate panel in
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.5,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start();
    } else {
      // Animate panel out
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -PANEL_WIDTH,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [isVisible, slideAnim, opacityAnim]);

  const fetchUserData = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('name, dp_url')
        .eq('uid', uid)
        .single();

      if (error) {
        console.error('Error fetching user data:', error);
        return;
      }

      if (data) {
        setUserName(data.name || '');
        if (data.dp_url) {
          setDpUrl(data.dp_url);
        }
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const menuItems = [
    { 
      title: 'Home', 
      icon: require('../assets/home.png'),
      onPress: () => {
        navigation.navigate('Home');
        onClose();
      }
    },
    { 
      title: 'AI Shop', 
      icon: require('../assets/shop.png'),
      onPress: () => {
        navigation.navigate('AI Shop');
        onClose();
      }
    },
    { 
      title: 'Profile', 
      icon: require('../assets/profile.png'),
      onPress: () => {
        navigation.navigate('Profile');
        onClose();
      }
    },
    { 
      title: 'Transactions', 
      icon: require('../assets/coin.png'),
      onPress: () => {
        navigation.navigate('TransactionScreen');
        onClose();
      }
    },
    { 
      title: 'Settings', 
      icon: require('../assets/speaker.png'),
      onPress: () => {
        navigation.navigate('SettingsScreen');
        onClose();
      }
    },
  ];

  if (!isVisible && slideAnim._value === -PANEL_WIDTH) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Semi-transparent overlay */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View 
          style={[
            styles.overlay, 
            { opacity: opacityAnim }
          ]} 
        />
      </TouchableWithoutFeedback>

      {/* Side panel */}
      <Animated.View 
        style={[
          styles.panel,
          { transform: [{ translateX: slideAnim }] }
        ]}
      >
        {/* User Profile Section */}
        <View style={styles.profileSection}>
          <Image 
            source={dpUrl ? { uri: dpUrl } : require('../assets/Avatar/Cat.png')} 
            style={styles.profileImage} 
          />
          <Text style={styles.userName}>{userName || 'User'}</Text>
        </View>

        {/* Menu Items */}
        <ScrollView style={styles.menuItems}>
          {menuItems.map((item, index) => (
            <TouchableOpacity 
              key={index} 
              style={styles.menuItem}
              onPress={item.onPress}
            >
              <Image source={item.icon} style={styles.menuIcon} />
              <Text style={styles.menuText}>{item.title}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Logout Button */}
        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={async () => {
            try {
              // Clear pro status
              await clearProStatus();
              
              // Remove all authentication related data from AsyncStorage
              const keysToRemove = [
                'userLoggedIn',
                'uid',
                'referralCode',
                'supabase-session',
                'coins_count',
                'pro_status'
              ];
              
              // Get all keys from AsyncStorage to find any additional auth-related ones
              const allKeys = await AsyncStorage.getAllKeys();
              const authRelatedKeys = allKeys.filter(key => 
                key.includes('supabase') || 
                key.includes('auth') || 
                key.includes('user') ||
                key.includes('token') ||
                key.includes('session')
              );
              
              // Combine all keys to be removed
              const allKeysToRemove = [...new Set([...keysToRemove, ...authRelatedKeys])];
              
              // Clear all relevant keys
              await AsyncStorage.multiRemove(allKeysToRemove);
              
              // Sign out from Supabase
              await supabase.auth.signOut();
              
              // Add a small delay to ensure all operations complete
              await new Promise(resolve => setTimeout(resolve, 500));
              
              // Navigate to login screen
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });
            } catch (error) {
              console.error('Error during logout:', error);
              
              // If there's an error, try a more aggressive approach
              try {
                // Clear all AsyncStorage as a last resort
                await AsyncStorage.clear();
                console.log('AsyncStorage cleared completely');
                
                // Navigate to login screen
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Login' }],
                });
              } catch (finalError) {
                console.error('Critical error during logout:', finalError);
              }
            }
          }}
        >
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  panel: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: PANEL_WIDTH,
    height: '100%',
    backgroundColor: '#FFFFFF',
    paddingTop: 50,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 10,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#2A76F1',
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  menuItems: {
    flex: 1,
    marginTop: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  menuIcon: {
    width: 24,
    height: 24,
    marginRight: 15,
  },
  menuText: {
    fontSize: 16,
    color: '#333333',
  },
  logoutButton: {
    margin: 20,
    padding: 15,
    backgroundColor: '#FF6600',
    borderRadius: 10,
    alignItems: 'center',
  },
  logoutText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default SidePanel; 