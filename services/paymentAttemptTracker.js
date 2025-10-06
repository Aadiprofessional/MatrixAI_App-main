import AsyncStorage from '@react-native-async-storage/async-storage';

class PaymentAttemptTracker {
  constructor() {
    this.STORAGE_KEY = 'payment_attempts';
    this.MAX_ATTEMPTS = 3;
    this.BLOCK_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds
  }

  /**
   * Get the storage key for a specific user
   * @param {string} userId - User ID
   * @returns {string} Storage key
   */
  getUserStorageKey(userId) {
    return `${this.STORAGE_KEY}_${userId || 'anonymous'}`;
  }

  /**
   * Get payment attempt data for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Attempt data
   */
  async getAttemptData(userId) {
    try {
      const key = this.getUserStorageKey(userId);
      const data = await AsyncStorage.getItem(key);
      
      if (!data) {
        return {
          failedAttempts: 0,
          navigationAttempts: 0,
          lastFailedAttempt: null,
          lastNavigationAttempt: null,
          blockedUntil: null,
          hasSuccessfulPayment: false,
          lastSuccessfulPayment: null
        };
      }
      
      return JSON.parse(data);
    } catch (error) {
      console.error('Error getting attempt data:', error);
      return {
        failedAttempts: 0,
        navigationAttempts: 0,
        lastFailedAttempt: null,
        lastNavigationAttempt: null,
        blockedUntil: null,
        hasSuccessfulPayment: false,
        lastSuccessfulPayment: null
      };
    }
  }

  /**
   * Save payment attempt data for a user
   * @param {string} userId - User ID
   * @param {Object} data - Attempt data
   */
  async saveAttemptData(userId, data) {
    try {
      const key = this.getUserStorageKey(userId);
      await AsyncStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving attempt data:', error);
    }
  }

  /**
   * Check if user is currently blocked from making payments
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Block status and remaining time
   */
  async isUserBlocked(userId) {
    try {
      const data = await this.getAttemptData(userId);
      const now = Date.now();
      
      // Check if user is currently blocked
      if (data.blockedUntil && now < data.blockedUntil) {
        const remainingTime = data.blockedUntil - now;
        return {
          isBlocked: true,
          remainingMinutes: Math.ceil(remainingTime / (60 * 1000)),
          remainingTime: remainingTime,
          reason: data.failedAttempts >= this.MAX_ATTEMPTS ? 'failed_attempts' : 'navigation_attempts'
        };
      }
      
      // Check if user should be blocked due to failed attempts
      if (data.failedAttempts >= this.MAX_ATTEMPTS) {
        data.blockedUntil = now + this.BLOCK_DURATION;
        await this.saveAttemptData(userId, data);
        return {
          isBlocked: true,
          remainingMinutes: Math.ceil(this.BLOCK_DURATION / (60 * 1000)),
          remainingTime: this.BLOCK_DURATION,
          reason: 'failed_attempts'
        };
      }
      
      // Check if user should be blocked due to too many navigation attempts without payment
      if (data.navigationAttempts >= this.MAX_ATTEMPTS && !data.hasSuccessfulPayment) {
        data.blockedUntil = now + this.BLOCK_DURATION;
        await this.saveAttemptData(userId, data);
        return {
          isBlocked: true,
          remainingMinutes: Math.ceil(this.BLOCK_DURATION / (60 * 1000)),
          remainingTime: this.BLOCK_DURATION,
          reason: 'navigation_attempts'
        };
      }
      
      return { isBlocked: false };
    } catch (error) {
      console.error('Error checking if user is blocked:', error);
      return { isBlocked: false };
    }
  }

  /**
   * Record a navigation attempt (opening payment screen)
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Updated attempt data
   */
  async recordNavigationAttempt(userId) {
    try {
      const data = await this.getAttemptData(userId);
      data.navigationAttempts = (data.navigationAttempts || 0) + 1;
      data.lastNavigationAttempt = Date.now();
      
      // Check if user should be blocked for too many navigation attempts without payment
      if (data.navigationAttempts >= this.MAX_ATTEMPTS && !data.hasSuccessfulPayment) {
        data.blockedUntil = Date.now() + this.BLOCK_DURATION;
      }
      
      await this.saveAttemptData(userId, data);
      return data;
    } catch (error) {
      console.error('Error recording navigation attempt:', error);
      throw error;
    }
  }

  /**
   * Record a failed payment attempt
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Updated attempt status
   */
  async recordFailedAttempt(userId) {
    const data = await this.getAttemptData(userId);
    const now = Date.now();
    
    data.attempts += 1;
    data.lastAttempt = now;
    
    // If user has reached max attempts, block them
    if (data.attempts >= this.MAX_ATTEMPTS) {
      data.blockedUntil = now + this.BLOCK_DURATION;
    }
    
    await this.saveAttemptData(userId, data);
    
    return {
      attempts: data.attempts,
      maxAttempts: this.MAX_ATTEMPTS,
      isBlocked: data.attempts >= this.MAX_ATTEMPTS,
      blockedUntil: data.blockedUntil,
      remainingAttempts: Math.max(0, this.MAX_ATTEMPTS - data.attempts)
    };
  }

  /**
   * Record a successful payment (resets attempts)
   * @param {string} userId - User ID
   */
  async recordSuccessfulPayment(userId) {
    try {
      const data = await this.getAttemptData(userId);
      data.failedAttempts = 0;
      data.navigationAttempts = 0; // Reset navigation attempts on successful payment
      data.blockedUntil = null;
      data.hasSuccessfulPayment = true;
      data.lastSuccessfulPayment = Date.now();
      
      await this.saveAttemptData(userId, data);
      return data;
    } catch (error) {
      console.error('Error recording successful payment:', error);
      throw error;
    }
  }

  /**
   * Reset payment attempts for a user
   * @param {string} userId - User ID
   */
  async resetAttempts(userId) {
    const data = {
      failedAttempts: 0,
      navigationAttempts: 0,
      lastFailedAttempt: null,
      lastNavigationAttempt: null,
      blockedUntil: null,
      hasSuccessfulPayment: false,
      lastSuccessfulPayment: null
    };
    
    await this.saveAttemptData(userId, data);
  }

  /**
   * Get current attempt status for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Current status
   */
  async getAttemptStatus(userId) {
    const data = await this.getAttemptData(userId);
    const blockStatus = await this.isUserBlocked(userId);
    
    return {
      failedAttempts: data.failedAttempts,
      navigationAttempts: data.navigationAttempts,
      maxAttempts: this.MAX_ATTEMPTS,
      remainingFailedAttempts: Math.max(0, this.MAX_ATTEMPTS - data.failedAttempts),
      remainingNavigationAttempts: Math.max(0, this.MAX_ATTEMPTS - data.navigationAttempts),
      lastFailedAttempt: data.lastFailedAttempt,
      lastNavigationAttempt: data.lastNavigationAttempt,
      hasSuccessfulPayment: data.hasSuccessfulPayment,
      isBlocked: blockStatus.isBlocked,
      remainingMinutes: blockStatus.remainingMinutes,
      blockedUntil: data.blockedUntil,
      blockReason: blockStatus.reason
    };
  }

  /**
   * Clear all payment attempt data (for testing/admin purposes)
   * @param {string} userId - User ID
   */
  async clearAttemptData(userId) {
    try {
      const key = this.getUserStorageKey(userId);
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Error clearing attempt data:', error);
    }
  }

  /**
   * Format remaining time for display
   * @param {number} remainingTime - Time in milliseconds
   * @returns {string} Formatted time string
   */
  formatRemainingTime(remainingTime) {
    const minutes = Math.floor(remainingTime / (60 * 1000));
    const seconds = Math.floor((remainingTime % (60 * 1000)) / 1000);
    
    if (minutes > 0) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''} and ${seconds} second${seconds !== 1 ? 's' : ''}`;
    } else {
      return `${seconds} second${seconds !== 1 ? 's' : ''}`;
    }
  }
}

export default new PaymentAttemptTracker();