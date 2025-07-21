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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("AuthContext: Auth state changed:", event, session?.user?.id);
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
          if (session?.user) {
            await updateUid(session.user.id);
            setIsOffline(false);
          }
        } else if (event === 'SIGNED_OUT') {
          // Clear the UID
          setUid(null);
          setIsOffline(false);
          await AsyncStorage.removeItem('uid');
          await AsyncStorage.removeItem('userLoggedIn');
        }
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
    try {
      // Check network state
      const netInfoState = await NetInfo.fetch();
      const isConnected = netInfoState.isConnected;
      
      // Check if user is logged in first
      const userLoggedIn = await AsyncStorage.getItem('userLoggedIn');
      if (userLoggedIn !== 'true') {
        console.log('AuthContext: User not logged in');
        setLoading(false);
        return;
      }
      
      if (!isConnected) {
        // If offline, use stored UID
        const storedUid = await AsyncStorage.getItem('uid');
        if (storedUid) {
          console.log('AuthContext: Offline mode - using stored UID:', storedUid);
          setUid(storedUid);
          setIsOffline(true);
        }
        setLoading(false);
        return;
      }
      
      // If online, first try to get from Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        console.log('AuthContext: Found user in session:', session.user.id);
        setUid(session.user.id);
        await AsyncStorage.setItem('uid', session.user.id);
      } else {
        // Fall back to stored UID
        const storedUid = await AsyncStorage.getItem('uid');
        if (storedUid) {
          console.log('AuthContext: Loading stored UID:', storedUid);
          setUid(storedUid);
          
          // Try to refresh the session
          try {
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
            if (refreshData?.session?.user) {
              console.log('AuthContext: Refreshed session with UID:', refreshData.session.user.id);
              setUid(refreshData.session.user.id);
              await AsyncStorage.setItem('uid', refreshData.session.user.id);
            } else if (refreshError) {
              console.log('AuthContext: Session refresh failed:', refreshError.message);
            }
          } catch (error) {
            console.error('AuthContext: Error refreshing session:', error);
          }
        } else {
          console.log('AuthContext: No UID found');
        }
      }
    } catch (error) {
      console.error('AuthContext: Error loading UID:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateUid = async (newUid) => {
    try {
      console.log('AuthContext: Updating UID to:', newUid);
      await AsyncStorage.setItem('uid', newUid);
      await AsyncStorage.setItem('userLoggedIn', 'true');
      setUid(newUid);
    } catch (error) {
      console.error('AuthContext: Error saving UID:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ uid, loading, isOffline, updateUid }}>
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
