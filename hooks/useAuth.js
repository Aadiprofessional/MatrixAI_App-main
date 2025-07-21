import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabaseClient';
import NetInfo from '@react-native-community/netinfo';

export const useAuth = () => {
    const [uid, setUid] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isOffline, setIsOffline] = useState(false);

    // Function to initialize user from AsyncStorage when offline
    const initializeOfflineUser = async () => {
        try {
            const storedUid = await AsyncStorage.getItem('uid');
            const userLoggedIn = await AsyncStorage.getItem('userLoggedIn');
            
            if (storedUid && userLoggedIn === 'true') {
                console.log("Offline mode: Using stored UID:", storedUid);
                setUid(storedUid);
                setIsOffline(true);
                return true;
            }
            return false;
        } catch (error) {
            console.error("Error initializing offline user:", error);
            return false;
        }
    };

    useEffect(() => {
        const initializeUser = async () => {
            try {
                console.log("Initializing user authentication...");
                let userId = null;
                
                // Check network state first
                const netInfo = await NetInfo.fetch();
                const isConnected = netInfo.isConnected;
                
                if (!isConnected) {
                    console.log("Device is offline, using offline authentication");
                    setIsOffline(true);
                    const offlineInitialized = await initializeOfflineUser();
                    if (offlineInitialized) {
                        setLoading(false);
                        return;
                    }
                }
                
                // If we're online, use normal authentication flow
                // First check if we have a valid session
                const { data: { session }, sessionError } = await supabase.auth.getSession();
                
                if (session?.user?.id) {
                    console.log("Found authenticated user in active session:", session.user.id);
                    userId = session.user.id;
                    // Ensure the UID is stored in AsyncStorage
                    await AsyncStorage.setItem('uid', session.user.id);
                    await AsyncStorage.setItem('userLoggedIn', 'true');
                } else {
                    console.log("No active session found in Supabase", sessionError?.message || "");
                    
                    // Try to get user from Supabase
                    const { data: { user }, error } = await supabase.auth.getUser();
                    
                    if (user?.id) {
                        console.log("Found authenticated user from Supabase:", user.id);
                        userId = user.id;
                        await AsyncStorage.setItem('uid', user.id);
                        await AsyncStorage.setItem('userLoggedIn', 'true');
                    } else {
                        // Log if Supabase doesn't have a user
                        console.log("No user found in Supabase authentication", error?.message || "");
                        
                        // Fallback to AsyncStorage
                        const storedUid = await AsyncStorage.getItem('uid');
                        const userLoggedIn = await AsyncStorage.getItem('userLoggedIn');
                        
                        if (storedUid && userLoggedIn === 'true') {
                            console.log("Found stored UID in AsyncStorage:", storedUid);
                            // Try to verify this UID with Supabase before using it
                            try {
                                // Try to refresh the session
                                const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
                                
                                if (refreshData?.session?.user?.id) {
                                    // Use the refreshed session UID
                                    userId = refreshData.session.user.id;
                                    console.log("Refreshed session, using UID:", userId);
                                    await AsyncStorage.setItem('uid', userId);
                                } else if (!refreshError) {
                                    // No error but no session either - use stored UID
                                    userId = storedUid;
                                } else {
                                    console.log("Session refresh failed:", refreshError?.message);
                                    // If refresh fails, check if the session was removed
                                    if (refreshError.message.includes('session not found')) {
                                        // Session is invalid, clear stored UID
                                        console.log("Invalid session, clearing UID");
                                        await AsyncStorage.removeItem('uid');
                                        await AsyncStorage.removeItem('userLoggedIn');
                                        userId = null;
                                    } else {
                                        // Some other error, use stored UID but log warning
                                        console.log("Warning: using stored UID without verification");
                                        userId = storedUid;
                                    }
                                }
                            } catch (verifyError) {
                                console.error("Error verifying stored UID:", verifyError);
                                
                                if (!isConnected) {
                                    // If offline, use stored UID anyway
                                    console.log("Offline mode - using stored UID without verification");
                                    userId = storedUid;
                                    setIsOffline(true);
                                } else {
                                    // Use stored UID anyway as fallback
                                    userId = storedUid;
                                }
                            }
                        } else {
                            console.log("No valid UID found in AsyncStorage or user not logged in");
                        }
                    }
                }
                
                // Set the UID in state if we found one
                if (userId) {
                    console.log("Setting authenticated user ID:", userId);
                    setUid(userId);
                } else {
                    console.log("No user ID found, user is not authenticated");
                }
            } catch (error) {
                console.error("Error initializing user:", error);
                // Try offline authentication as fallback
                await initializeOfflineUser();
            } finally {
                setLoading(false);
            }
        };

        initializeUser();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                console.log("Auth state changed:", event, session?.user?.id);
                
                if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
                    if (session?.user) {
                        console.log("User signed in or updated:", session.user.id);
                        setUid(session.user.id);
                        setIsOffline(false);
                        await AsyncStorage.setItem('uid', session.user.id);
                        await AsyncStorage.setItem('userLoggedIn', 'true');
                    }
                } else if (event === 'SIGNED_OUT') {
                    console.log("User signed out");
                    setUid(null);
                    setIsOffline(false);
                    await AsyncStorage.removeItem('uid');
                    await AsyncStorage.removeItem('userLoggedIn');
                }
            }
        );

        // Set up network status listener
        const unsubscribeNetInfo = NetInfo.addEventListener(state => {
            setIsOffline(!state.isConnected);
            
            // If we transition from offline to online and have a UID, 
            // try to verify the session and sync with server
            if (state.isConnected && uid) {
                supabase.auth.refreshSession().then(({ data, error }) => {
                    if (error) {
                        console.log("Failed to refresh session on reconnect:", error.message);
                    } else if (data?.session) {
                        console.log("Successfully refreshed session on reconnect");
                    }
                });
            }
        });

        return () => {
            subscription?.unsubscribe();
            unsubscribeNetInfo();
        };
    }, []);

    return { uid, loading, isOffline };
}; 