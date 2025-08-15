import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabaseClient';

/**
 * Global authentication error handler
 * Handles common auth errors like invalid refresh tokens
 */
export const handleAuthError = async (error, setUid = null) => {
    console.log('Auth error detected:', error?.message);
    
    // Check if we're using the new API authentication system
    const token = await AsyncStorage.getItem('token');
    if (token) {
        console.log('Using new API authentication system, ignoring Supabase auth errors');
        return false; // Don't clear auth data when using new API auth
    }
    
    // Check if it's a refresh token error
    if (error?.message?.includes('Invalid Refresh Token') ||
        error?.message?.includes('Refresh Token Not Found') ||
        error?.message?.includes('session not found') ||
        error?.message?.includes('JWT expired')) {
        
        console.log('Clearing authentication due to invalid session');
        
        try {
            // Clear all authentication data
            await AsyncStorage.removeItem('uid');
            await AsyncStorage.removeItem('userLoggedIn');
            await AsyncStorage.removeItem('supabase.auth.token');
            await AsyncStorage.removeItem('supabase-session');
            await AsyncStorage.removeItem('user');
            
            // Clear any other auth-related storage
            const keys = await AsyncStorage.getAllKeys();
            const authKeys = keys.filter(key => 
                key.includes('auth') || 
                key.includes('session') ||
                key.includes('supabase')
            );
            
            if (authKeys.length > 0) {
                await AsyncStorage.multiRemove(authKeys);
            }
            
            // Sign out from Supabase
            await supabase.auth.signOut();
            
            // Update UID state if setter is provided
            if (setUid) {
                setUid(null);
            }
            
            console.log('Authentication cleared successfully');
            return true; // Indicates that auth was cleared
            
        } catch (clearError) {
            console.error('Error clearing authentication:', clearError);
            return false;
        }
    }
    
    return false; // Not an auth error that requires clearing
};

/**
 * Wrapper for Supabase operations that automatically handles auth errors
 */
export const withAuthErrorHandling = async (operation, setUid = null) => {
    try {
        const result = await operation();
        
        // Check if the result contains an error
        if (result?.error) {
            const wasCleared = await handleAuthError(result.error, setUid);
            if (wasCleared) {
                return { ...result, authCleared: true };
            }
        }
        
        return result;
    } catch (error) {
        const wasCleared = await handleAuthError(error, setUid);
        if (wasCleared) {
            throw { ...error, authCleared: true };
        }
        throw error;
    }
};

/**
 * Check if an error is an authentication error
 */
export const isAuthError = (error) => {
    return error?.message?.includes('Invalid Refresh Token') ||
           error?.message?.includes('Refresh Token Not Found') ||
           error?.message?.includes('session not found') ||
           error?.message?.includes('JWT expired') ||
           error?.message?.includes('Invalid JWT');
};