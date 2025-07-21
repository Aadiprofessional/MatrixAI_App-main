import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { useCoinsSubscription } from '../hooks/useCoinsSubscription';
import { supabase } from '../supabaseClient';
import { saveProStatus, saveCoinsCount, getProStatus, getCoinsCount } from '../utils/proStatusUtils';
import { useProStatus } from '../hooks/useProStatus';
import { useTheme } from '../context/ThemeContext';
import { useProfileUpdate } from '../context/ProfileUpdateContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../context/LanguageContext';

const Header = ({ navigation, uid, openDrawer }) => {
    console.log("Header rendering with UID:", uid);
    const coinCount = useCoinsSubscription(uid);
    const { t } = useLanguage();
    const [userName, setUserName] = useState('');
    const [dpUrl, setDpUrl] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isLoadingCoins, setIsLoadingCoins] = useState(true);
    const { isPro, checkProStatus } = useProStatus();
    const [localIsPro, setLocalIsPro] = useState(false);
    const { getThemeColors } = useTheme();
    const { lastUpdate } = useProfileUpdate();
    const colors = getThemeColors();
    const [localCoinCount, setLocalCoinCount] = useState(0);
    
    // Initialize from stored values on mount
    useEffect(() => {
        const initializeFromStorage = async () => {
            try {
                // Get stored pro status
                const storedProStatus = await getProStatus();
                setLocalIsPro(storedProStatus);
                
                // Get stored coin count as fallback
                const storedCoins = await getCoinsCount();
                if (storedCoins !== null) {
                    setLocalCoinCount(storedCoins);
                    // Still loading from API, but we have placeholder data now
                    setIsLoadingCoins(false);
                }
                
                // Get cached username and dp_url
                const cachedName = await AsyncStorage.getItem('user_name');
                const cachedDpUrl = await AsyncStorage.getItem('user_dp_url');
                
                if (cachedName) setUserName(cachedName);
                if (cachedDpUrl) setDpUrl(cachedDpUrl);
                
                // If stored status says user is pro but context doesn't, update context
                if (storedProStatus && !isPro && uid) {
                    checkProStatus(uid);
                }
            } catch (error) {
                console.error('Error initializing from storage:', error);
            }
        };
        
        initializeFromStorage();
    }, [isPro, uid]);
    
    // Save coins count whenever it changes from API
    useEffect(() => {
        if (coinCount !== undefined && coinCount !== null) {
            saveCoinsCount(coinCount);
            setLocalCoinCount(coinCount);
            setIsLoadingCoins(false); // API data received, no longer loading
        }
    }, [coinCount]);
    
    useEffect(() => {
        if (uid) {
            fetchUserData();
        }
    }, [uid, lastUpdate]);

    const fetchUserData = async () => {
        if (!uid) return;
        
        // Don't restart loading state if we already have cached data
        if (!userName && !dpUrl) {
            setLoading(true);
        }
        
        try {
            const { data, error } = await supabase
                .from('users')
                .select('name, dp_url, subscription_active')
                .eq('uid', uid)
                .single();

            if (error) {
                console.error('Error fetching user data:', error);
                return;
            }

            if (data) {
                // Get first name and limit to 10 characters
                const firstName = data.name?.split(' ')[0] || '';
                const processedName = firstName.substring(0, 10);
                setUserName(processedName);
                
                // Cache the name
                await AsyncStorage.setItem('user_name', processedName);
                
                // Set profile picture URL if it exists
                if (data.dp_url) {
                    setDpUrl(data.dp_url);
                    // Cache the dp_url
                    await AsyncStorage.setItem('user_dp_url', data.dp_url);
                }
                
                // Set pro status and save it to utils
                const isUserPro = data.subscription_active || false;
                saveProStatus(isUserPro);
                setLocalIsPro(isUserPro);
                
                // Update global pro status context
                if (checkProStatus) {
                    checkProStatus(uid);
                }
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    // Determine if user should be treated as pro based on both context and local state
    const isUserPro = isPro || localIsPro;

    // Use local coin count as fallback when coinCount is not available
    const displayCoinCount = (coinCount !== undefined && coinCount !== null) ? coinCount : localCoinCount;

    if (!uid) {
        console.log("No UID in Header");
        // Return a placeholder header with coin display
        return (
            <View style={[styles.header]}>
                <View style={[styles.rowContainer]}>
                    <View style={[styles.icon, {backgroundColor: '#F0F0F0'}]} />
                    <Text style={[styles.welcomeText, {color: colors.text}]}>Welcome!</Text>
                </View>
                
                <TouchableOpacity
                    style={[styles.coinContainer, {backgroundColor: colors.background2, borderWidth: 0.8, borderColor: colors.border}]}
                    disabled={true}
                >
                    <Image source={require('../assets/coin.png')} style={[styles.coinIcon]} />
                    <Text style={[styles.coinText]}>...</Text>
                </TouchableOpacity>
            </View>
        );
    }

    console.log("Current coin count:", displayCoinCount);

    return (
        <View style={[styles.header]}>
            {/* Welcome Text with Profile Picture */}
            <View style={[styles.rowContainer]}>
                <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
                    {loading && !dpUrl ? (
                        <View style={[styles.icon, {backgroundColor: '#F0F0F0'}]}>
                            <ActivityIndicator size="small" color="#666" />
                        </View>
                    ) : (
                        <Image 
                            source={dpUrl ? { uri: dpUrl } : require('../assets/Avatar/Cat.png')} 
                            style={[styles.icon]} 
                        />
                    )}
                </TouchableOpacity>
                
                {loading && !userName ? (
                    <ActivityIndicator size="small" color="#333" style={{ marginLeft: 10 }} />
                ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {isUserPro ? (
                            <View style={styles.proContainer}>
                                <Text style={[styles.welcomeText, {color: colors.text}]}>
                                    {userName || 'User'} 
                                </Text>
                                <View style={[styles.proBadge, {backgroundColor: colors.primary}]}>
                                    <Text style={[styles.proText]}>{t('pro')}</Text>
                                </View>
                            </View>
                        ) : (
                            <Text style={[styles.welcomeText, {color: colors.text}]}>
                                {userName ? `${userName}` : 'Welcome!'}
                            </Text>
                        )}
                    </View>
                )}
            </View>

            {/* Coin Display with Coin Icon */}
            <TouchableOpacity
                style={[styles.coinContainer, {backgroundColor: colors.background2, borderWidth: 0.8, borderColor: colors.border}]}
                onPress={() =>
                    navigation.navigate('TransactionScreen', { coinCount: displayCoinCount })
                }
            >
                <Image source={require('../assets/coin.png')} style={[styles.coinIcon]} />
                {isLoadingCoins ? (
                    <ActivityIndicator size="small" color="#FF6600" style={{width: 24, height: 20}} />
                ) : (
                    <Text style={[styles.coinText]}>
                        {displayCoinCount.toString()}
                    </Text>
                )}
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '95%',
     
    

    },
    menuButton: {
        padding: 5,
    },
    menuIcon: {
        width: 24,
        height: 24,
    },
    rowContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    icon: {
        width: 40,
        height: 40,
        marginRight: 10,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    welcomeText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    coinContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: '#C9C9C9',
        borderRadius: 15,
        minWidth: 65, // Ensure container doesn't change size during loading
        minHeight: 30,
    },
    coinIcon: {
        width: 20,
        height: 20,
        marginRight: 5,
    },
    coinText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FF6600',
        minWidth: 24, // Ensure text area doesn't change size
    },
    proContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    proBadge: {
        backgroundColor: '#FF6600',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
        marginLeft: 6,
    },
    proText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 12,
    },
});

export default Header;
