import AsyncStorage from '@react-native-async-storage/async-storage';

// Key for storing pro status in AsyncStorage
const PRO_STATUS_KEY = 'pro_status';
const COINS_COUNT_KEY = 'coins_count';

/**
 * Save pro status to AsyncStorage
 * @param {boolean} isProStatus - Whether the user has pro status
 */
export const saveProStatus = async (isProStatus) => {
  try {
    await AsyncStorage.setItem(PRO_STATUS_KEY, JSON.stringify(isProStatus));
    console.log('Pro status saved:', isProStatus);
  } catch (error) {
    console.error('Error saving pro status:', error);
  }
};

/**
 * Get pro status from AsyncStorage
 * @returns {Promise<boolean>} - Whether the user has pro status
 */
export const getProStatus = async () => {
  try {
    const status = await AsyncStorage.getItem(PRO_STATUS_KEY);
    return status ? JSON.parse(status) : false;
  } catch (error) {
    console.error('Error getting pro status:', error);
    return false;
  }
};

/**
 * Save coins count to AsyncStorage
 * @param {number} count - The number of coins
 */
export const saveCoinsCount = async (count) => {
  try {
    await AsyncStorage.setItem(COINS_COUNT_KEY, JSON.stringify(count));
    console.log('Coins count saved:', count);
  } catch (error) {
    console.error('Error saving coins count:', error);
  }
};

/**
 * Get coins count from AsyncStorage
 * @returns {Promise<number>} - The number of coins
 */
export const getCoinsCount = async () => {
  try {
    const count = await AsyncStorage.getItem(COINS_COUNT_KEY);
    return count ? JSON.parse(count) : 0;
  } catch (error) {
    console.error('Error getting coins count:', error);
    return 0;
  }
};

/**
 * Clear pro status from AsyncStorage (used during logout)
 */
export const clearProStatus = async () => {
  try {
    await AsyncStorage.multiRemove([PRO_STATUS_KEY, COINS_COUNT_KEY]);
    console.log('Pro status and coins count cleared');
  } catch (error) {
    console.error('Error clearing pro status:', error);
  }
}; 