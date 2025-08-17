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
    const unsubscribeNetInfo = NetInfo.addEventListener(async state => {
      const offline = !state.isConnected;
      setIsOffline(offline);
      
      // If we go from offline to online and have a uid, try to refresh session
      if (!offline && uid) {
        // Check if we're using the new API authentication system
        const token = await AsyncStorage.getItem('token');
        if (token) {
          console.log('AuthContext: Using new API authentication system, skipping Supabase session refresh on reconnect');
          // Ensure userLoggedIn flag is set
          await AsyncStorage.setItem('userLoggedIn', 'true');
          // Make sure the UID is still set in AsyncStorage
          await AsyncStorage.setItem('uid', uid);
          // Ensure token is persisted
          await AsyncStorage.setItem('token', token);
          return;
        }
        
        // Check if user is logged in
        const userLoggedIn = await AsyncStorage.getItem('userLoggedIn');
        if (userLoggedIn !== 'true') {
          console.log('AuthContext: User not logged in, skipping session refresh on reconnect');
          return;
        }
        
        // Ensure UID is set in AsyncStorage even if userLoggedIn is not true
        if (uid) {
          await AsyncStorage.setItem('uid', uid);
          await AsyncStorage.setItem('userLoggedIn', 'true');
        }
        
        // Only try to refresh Supabase session if not using the new API auth
        supabase.auth.refreshSession().then(({ data, error }) => {
          if (error) {
            console.log('AuthContext: Failed to refresh session on reconnect:', error.message);
            // Even if refresh fails, ensure we keep the current UID
            AsyncStorage.setItem('userLoggedIn', 'true');
          } else if (data?.session) {
            updateUid(data.session.user.id);
            console.log('AuthContext: Successfully refreshed session on reconnect');
          } else {
            // No session data but we have a UID, so keep it
            console.log('AuthContext: No session data after reconnect, keeping current UID');
            AsyncStorage.setItem('userLoggedIn', 'true');
          }
        }).catch(error => {
          console.error('AuthContext: Error during session refresh on reconnect:', error);
          // On error, ensure we keep the current UID
          AsyncStorage.setItem('userLoggedIn', 'true');
        });
      }
    });

    return () => {
      subscription?.unsubscribe();
      unsubscribeNetInfo();
    };
  }, [uid]);

  const loadUid = async () => {
    console.log('=== AUTH CONTEXT: LOADING UID START ===');
    console.log('AuthContext: loadUid called at:', new Date().toISOString());
    console.log('AuthContext: Current uid state:', uid);
    console.log('AuthContext: Current loading state:', loading);
    try {
      // Check network state
      const netInfoState = await NetInfo.fetch();
      const isConnected = netInfoState.isConnected;
      console.log('AuthContext: Network connected:', isConnected);
      
      // Check if we're using the new API authentication system
      const token = await AsyncStorage.getItem('token');
      const usingNewAuth = !!token;
      if (usingNewAuth) {
        console.log('AuthContext: Using new API authentication system');
        // If using new API auth, just load the stored UID and skip Supabase session checks
        console.log('AuthContext: Using new API authentication system, loading stored UID');
        const storedUid = await AsyncStorage.getItem('uid');
        if (storedUid) {
          console.log('AuthContext: Loading stored UID for new API auth:', storedUid);
          setUid(storedUid);
          // Ensure userLoggedIn flag is set
          await AsyncStorage.setItem('userLoggedIn', 'true');
          // Make sure the UID is still set in AsyncStorage
          await AsyncStorage.setItem('uid', storedUid);
          // Ensure we have a token stored
          if (token) {
            await AsyncStorage.setItem('token', token);
          }
        } else {
          console.log('AuthContext: No stored UID found for new API auth');
        }
        console.log('AuthContext: Setting loading to false (new API auth)');
        setLoading(false);
        return;
      }
      
      // Check if user is logged in first (only for Supabase auth)
      const userLoggedIn = await AsyncStorage.getItem('userLoggedIn');
      console.log('AuthContext: User logged in flag:', userLoggedIn);
      
      if (userLoggedIn !== 'true') {
        console.log('AuthContext: User not logged in, skipping session loading');
        console.log('AuthContext: Setting loading to false (user not logged in)');
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
        console.log('AuthContext: Setting loading to false (offline mode)');
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
          
          // We already have a stored UID, so use it
          console.log('AuthContext: Using stored UID, checking if we need to refresh session');
          
          try {
            // Check if we're using the new API authentication system
            const token = await AsyncStorage.getItem('token');
            
            if (token) {
              console.log('AuthContext: Using new API authentication system, skipping Supabase session refresh');
              // We're using the new API authentication, no need to refresh Supabase session
              // Just set the UID from storage and continue
              setUid(storedUid);
              await AsyncStorage.setItem('userLoggedIn', 'true');
              // Make sure the UID is still set in AsyncStorage
              await AsyncStorage.setItem('uid', storedUid);
            } else {
              // Before trying to refresh, check if we have a valid session
              const { data: sessionData } = await supabase.auth.getSession();
              const hasSession = !!sessionData?.session?.user;
              
              if (hasSession) {
                console.log('AuthContext: Found existing session, using it');
                setUid(sessionData.session.user.id);
                await AsyncStorage.setItem('uid', sessionData.session.user.id);
                await AsyncStorage.setItem('userLoggedIn', 'true');
                return;
              }
              
              // Try to refresh the Supabase session only if we're still using Supabase auth
              console.log('AuthContext: Attempting to refresh Supabase session');
              try {
                const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
                
                if (refreshError) {
                  console.error('AuthContext: Session refresh failed:', refreshError.message);
                  console.error('AuthContext: Full refresh error:', JSON.stringify(refreshError));
                  // Even if refresh fails, still use the stored UID
                  setUid(storedUid);
                  // Ensure userLoggedIn flag is set
                  await AsyncStorage.setItem('userLoggedIn', 'true');
                  // Make sure the UID is still set in AsyncStorage
                  await AsyncStorage.setItem('uid', storedUid);
                  
                  // Check if we have a token and ensure it's persisted
                  const token = await AsyncStorage.getItem('token');
                  if (token) {
                    await AsyncStorage.setItem('token', token);
                  }
                }
                
                if (refreshData?.session?.user) {
                  console.log('AuthContext: Refreshed session with UID:', refreshData.session.user.id);
                  console.log('AuthContext: Refreshed user email:', refreshData.session.user.email);
                  setUid(refreshData.session.user.id);
                  await AsyncStorage.setItem('uid', refreshData.session.user.id);
                  await AsyncStorage.setItem('userLoggedIn', 'true');
                  console.log('AuthContext: UID updated from refreshed session');
                } else {
                  console.log('AuthContext: No session data after refresh attempt, using stored UID');
                  setUid(storedUid);
                  // Ensure userLoggedIn flag is set
                  await AsyncStorage.setItem('userLoggedIn', 'true');
                  // Make sure the UID is still set in AsyncStorage
                  await AsyncStorage.setItem('uid', storedUid);
                  
                  // Check if we have a token and ensure it's persisted
                  const token = await AsyncStorage.getItem('token');
                  if (token) {
                    await AsyncStorage.setItem('token', token);
                  }
                }
              } catch (refreshError) {
                console.error('AuthContext: Error refreshing session:', refreshError);
                console.error('AuthContext: Full error details:', JSON.stringify(refreshError));
                // On error, still use the stored UID
                setUid(storedUid);
                // Ensure userLoggedIn flag is set
                await AsyncStorage.setItem('userLoggedIn', 'true');
                // Make sure the UID is still set in AsyncStorage
                await AsyncStorage.setItem('uid', storedUid);
              }
            }
          } catch (storageError) {
            console.error('AuthContext: Error accessing AsyncStorage during UID loading:', storageError);
            // Even if there's an error accessing storage, still use the stored UID we already have
            setUid(storedUid);
          }
        } else {
          console.log('AuthContext: No UID found in storage');
        }
      }
    } catch (error) {
      console.error('AuthContext: Error loading UID:', error);
    } finally {
      console.log('AuthContext: Setting loading to false (finally block)');
      console.log('AuthContext: Final uid state:', uid);
      console.log('AuthContext: loadUid completed at:', new Date().toISOString());
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
      console.log('AuthContext: Clearing UID and all authentication data');
      setUid(null);
      setIsOffline(false);
      
      // Check if we're using the new API authentication system
      const token = await AsyncStorage.getItem('token');
      const usingNewAuth = !!token;
      
      // Clear specific auth items
      await AsyncStorage.removeItem('uid');
      await AsyncStorage.removeItem('userLoggedIn');
      await AsyncStorage.removeItem('token'); // Clear new API auth token
      
      // Only clear Supabase-related items if not using new API auth
      if (!usingNewAuth) {
        await AsyncStorage.removeItem('supabase-session');
        await AsyncStorage.removeItem('user');
        await AsyncStorage.removeItem('supabase.auth.token');
        
        // Sign out from Supabase
        await supabase.auth.signOut();
      }
      
      // Clear any other auth-related storage
      const keys = await AsyncStorage.getAllKeys();
      const authKeys = keys.filter(key => 
        key.includes('token') || 
        key.includes('auth') || 
        key.includes('session') || 
        key.includes('supabase') ||
        key === 'uid' // Explicitly include uid key
      );
      
      if (authKeys.length > 0) {
        console.log('AuthContext: Clearing additional auth keys:', authKeys);
        await AsyncStorage.multiRemove(authKeys);
      }
      
      // Double-check that uid and userLoggedIn are removed
      await AsyncStorage.removeItem('uid');
      await AsyncStorage.removeItem('userLoggedIn');
      
      console.log("AuthContext: UID and session data cleared successfully");
      
      // Verify that auth data is cleared
      const verifyUid = await AsyncStorage.getItem('uid');
      const verifyLoggedIn = await AsyncStorage.getItem('userLoggedIn');
      const verifyToken = await AsyncStorage.getItem('token');
      
      if (verifyUid || verifyLoggedIn || verifyToken) {
        console.error("AuthContext: Warning - Some auth data still exists after clearing");
        // Force remove again
        await AsyncStorage.removeItem('uid');
        await AsyncStorage.removeItem('userLoggedIn');
        await AsyncStorage.removeItem('token');
      } else {
        console.log("AuthContext: Verified all auth data is cleared");
      }
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
