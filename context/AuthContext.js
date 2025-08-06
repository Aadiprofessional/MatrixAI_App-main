import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabaseClient';
import NetInfo from '@react-native-community/netinfo';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [uid, setUid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // Check network state
    NetInfo.fetch().then(state => {
      setIsOffline(!state.isConnected);
    });

    // Load UID from AsyncStorage on startup
    loadUid();

    // Set up auth state change listener
    console.log('AuthContext: Setting up auth state change listener');
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("=== AUTH STATE CHANGE EVENT ===");
        console.log("AuthContext: Auth state changed event:", event);
        console.log("AuthContext: Session exists:", !!session);
        console.log("AuthContext: User ID in session:", session?.user?.id);
        console.log("AuthContext: User email in session:", session?.user?.email);
        console.log("AuthContext: Current UID in state:", uid);
        
        if (session) {
          console.log("AuthContext: Session access token exists:", !!session.access_token);
          console.log("AuthContext: Session refresh token exists:", !!session.refresh_token);
          console.log("AuthContext: User metadata:", JSON.stringify(session?.user?.user_metadata));
        }
        
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
          console.log("AuthContext: Processing sign-in/update/refresh event");
          if (session?.user) {
            console.log("AuthContext: Updating UID for user:", session.user.id);
            try {
              await updateUid(session.user.id);
              setIsOffline(false);
              console.log("AuthContext: UID updated successfully to", session.user.id);
            } catch (error) {
              console.error("AuthContext: Error updating UID:", error);
            }
          } else {
            console.log("AuthContext: Session exists but no user object found");
          }
        } else if (event === 'SIGNED_OUT') {
          // Clear the UID
          console.log("AuthContext: User signed out, clearing UID");
          try {
            setUid(null);
            setIsOffline(false);
            await AsyncStorage.removeItem('uid');
            await AsyncStorage.removeItem('userLoggedIn');
            await AsyncStorage.removeItem('supabase-session');
            await AsyncStorage.removeItem('user');
            await AsyncStorage.removeItem('supabase.auth.token');
            // Clear any other auth-related storage
            const keys = await AsyncStorage.getAllKeys();
            const authKeys = keys.filter(key => key.includes('auth') || key.includes('session'));
            if (authKeys.length > 0) {
              await AsyncStorage.multiRemove(authKeys);
            }
            console.log("AuthContext: UID and session data cleared successfully");
          } catch (error) {
            console.error("AuthContext: Error clearing auth data:", error);
          }
        }
        console.log("=== AUTH STATE CHANGE EVENT END ===");
      }
    );

    // Monitor network status changes
    const unsubscribeNetInfo = NetInfo.addEventListener(state => {
      const offline = !state.isConnected;
      setIsOffline(offline);
      
      // If we go from offline to online and have a uid, try to refresh session
      if (!offline && uid) {
        supabase.auth.refreshSession().then(({ data, error }) => {
          if (error) {
            console.log('AuthContext: Failed to refresh session on reconnect:', error.message);
          } else if (data?.session) {
            updateUid(data.session.user.id);
            console.log('AuthContext: Successfully refreshed session on reconnect');
          }
        });
      }
    });

    return () => {
      subscription?.unsubscribe();
      unsubscribeNetInfo();
    };
  }, [uid]);

  const loadUid = async () => {
    console.log('=== AUTH CONTEXT: LOADING UID ===');
    try {
      // Check network state
      const netInfoState = await NetInfo.fetch();
      const isConnected = netInfoState.isConnected;
      console.log('AuthContext: Network connected:', isConnected);
      
      // Check if user is logged in first
      const userLoggedIn = await AsyncStorage.getItem('userLoggedIn');
      console.log('AuthContext: User logged in flag:', userLoggedIn);
      
      if (userLoggedIn !== 'true') {
        console.log('AuthContext: User not logged in, skipping session loading');
        setLoading(false);
        return;
      }
      
      if (!isConnected) {
        console.log('AuthContext: Device is offline, using stored credentials');
        // If offline, use stored UID
        const storedUid = await AsyncStorage.getItem('uid');
        if (storedUid) {
          console.log('AuthContext: Offline mode - using stored UID:', storedUid);
          setUid(storedUid);
          setIsOffline(true);
        } else {
          console.log('AuthContext: No stored UID found for offline mode');
        }
        setLoading(false);
        return;
      }
      
      console.log('AuthContext: Device is online, checking Supabase session');
      // If online, first try to get from Supabase session
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('AuthContext: Error getting session:', error.message);
        console.error('AuthContext: Full error:', JSON.stringify(error));
      }
      
      const session = data?.session;
      console.log('AuthContext: Session exists:', !!session);
      
      if (session?.user?.id) {
        console.log('AuthContext: Found user in session:', session.user.id);
        console.log('AuthContext: User email:', session.user.email);
        console.log('AuthContext: Session expires at:', new Date(session.expires_at * 1000).toISOString());
        setUid(session.user.id);
        await AsyncStorage.setItem('uid', session.user.id);
        console.log('AuthContext: UID set from session');
      } else {
        console.log('AuthContext: No active session found, checking stored UID');
        // Fall back to stored UID
        const storedUid = await AsyncStorage.getItem('uid');
        if (storedUid) {
          console.log('AuthContext: Loading stored UID:', storedUid);
          setUid(storedUid);
          
          // Try to refresh the session
          console.log('AuthContext: Attempting to refresh session');
          try {
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
            
            if (refreshError) {
              console.error('AuthContext: Session refresh failed:', refreshError.message);
              console.error('AuthContext: Full refresh error:', JSON.stringify(refreshError));
            }
            
            if (refreshData?.session?.user) {
              console.log('AuthContext: Refreshed session with UID:', refreshData.session.user.id);
              console.log('AuthContext: Refreshed user email:', refreshData.session.user.email);
              setUid(refreshData.session.user.id);
              await AsyncStorage.setItem('uid', refreshData.session.user.id);
              console.log('AuthContext: UID updated from refreshed session');
            } else {
              console.log('AuthContext: No session data after refresh attempt');
            }
          } catch (error) {
            console.error('AuthContext: Error refreshing session:', error);
            console.error('AuthContext: Full error details:', JSON.stringify(error));
          }
        } else {
          console.log('AuthContext: No UID found in storage');
        }
      }
    } catch (error) {
      console.error('AuthContext: Error loading UID:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateUid = async (newUid) => {
    console.log('=== AUTH CONTEXT: UPDATING UID ===');
    try {
      if (!newUid) {
        console.error('AuthContext: Attempted to update UID with null/undefined value');
        return;
      }
      
      console.log('AuthContext: Updating UID to:', newUid);
      console.log('AuthContext: Previous UID was:', uid);
      
      // Store the UID and set the logged in flag
      await AsyncStorage.setItem('uid', newUid);
      await AsyncStorage.setItem('userLoggedIn', 'true');
      
      // Update the state
      setUid(newUid);
      console.log('AuthContext: UID updated successfully');
      
      // Verify the update
      const storedUid = await AsyncStorage.getItem('uid');
      console.log('AuthContext: Verified stored UID:', storedUid);
      
      if (storedUid !== newUid) {
        console.error('AuthContext: UID verification failed - stored value does not match');
      }
    } catch (error) {
      console.error('AuthContext: Error saving UID:', error);
      console.error('AuthContext: Full error details:', JSON.stringify(error));
    } finally {
      console.log('=== AUTH CONTEXT: UID UPDATE COMPLETE ===');
    }
  };

  const clearUID = async () => {
    try {
      setUid(null);
      setIsOffline(false);
      await AsyncStorage.removeItem('uid');
      await AsyncStorage.removeItem('userLoggedIn');
      await AsyncStorage.removeItem('supabase-session');
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('supabase.auth.token');
      // Clear any other auth-related storage
      const keys = await AsyncStorage.getAllKeys();
      const authKeys = keys.filter(key => key.includes('auth') || key.includes('session'));
      if (authKeys.length > 0) {
        await AsyncStorage.multiRemove(authKeys);
      }
      console.log("AuthContext: UID and session data cleared successfully");
    } catch (error) {
      console.error("AuthContext: Error clearing UID:", error);
    }
  };

  const logout = async () => {
    try {
      // Sign out from Supabase first
      await supabase.auth.signOut();
      // Clear all local storage
      await clearUID();
      console.log("AuthContext: User logged out successfully");
    } catch (error) {
      console.error("AuthContext: Error during logout:", error);
      // Even if Supabase signout fails, clear local storage
      await clearUID();
    }
  };

  return (
    <AuthContext.Provider value={{ uid, loading, isOffline, updateUid, clearUID, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
