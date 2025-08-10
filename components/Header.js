import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '../supabaseClient';
import { saveProStatus, getProStatus } from '../utils/proStatusUtils';
import { useProStatus } from '../hooks/useProStatus';
import { useTheme } from '../context/ThemeContext';
import { useProfileUpdate } from '../context/ProfileUpdateContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../context/LanguageContext';

const Header = ({ navigation, uid, openDrawer }) => {
    console.log("Header rendering with UID:", uid);
    const { t } = useLanguage();
    const [userName, setUserName] = useState('');
    const [dpUrl, setDpUrl] = useState(null);
    const [loading, setLoading] = useState(true);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [showHumanIcon, setShowHumanIcon] = useState(true);
    const { isPro, checkProStatus } = useProStatus();
    const [localIsPro, setLocalIsPro] = useState(false);
    const { getThemeColors } = useTheme();
    const { lastUpdate } = useProfileUpdate();
    const colors = getThemeColors();
    
    // Initialize from stored values on mount
    useEffect(() => {
        const initializeFromStorage = async () => {
            try {
                // Get stored pro status
                const storedProStatus = await getProStatus();
                setLocalIsPro(storedProStatus);
                

                
                // Get cached username and dp_url
                const cachedName = await AsyncStorage.getItem('user_name');
                const cachedDpUrl = await AsyncStorage.getItem('user_dp_url');
                
                if (cachedName) setUserName(cachedName);
                if (cachedDpUrl) {
                    setDpUrl(cachedDpUrl);
                    setImageLoaded(false);
                    setShowHumanIcon(true);
                }
                
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
                    setImageLoaded(false);
                    setShowHumanIcon(true);
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

    if (!uid) {
        console.log("No UID in Header");
        // Return a placeholder header with avatar only
        return (
            <View style={[styles.header]}>
                <View style={[styles.rowContainer]}>
                    <View style={[styles.icon, {backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center'}]}>
                            <Text style={{fontSize: 20, color: '#666'}}>👤</Text>
                        </View>
                    <Text style={[styles.welcomeText, {color: colors.text}]}>Welcome!</Text>
                </View>
            </View>
        );
    }



    return (
        <View style={[styles.header]}>
            {/* Welcome Text with Profile Picture */}
            <View style={[styles.rowContainer]}>
                <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
                    {loading && !dpUrl ? (
                        <View style={[styles.iconContainer]}>
                            <View style={[styles.icon, styles.humanIconContainer]}>
                                <Text style={[styles.humanIconText, {opacity: 0.5}]}>👤</Text>
                                <ActivityIndicator size="small" color="#666" style={{position: 'absolute'}} />
                            </View>
                        </View>
                    ) : (
                        <View style={[styles.iconContainer]}>
                             {dpUrl && (
                                 <Image 
                                     source={{ uri: dpUrl }} 
                                     style={[styles.icon, {position: 'absolute', zIndex: 2}]}
                                     onLoad={() => {
                                         setImageLoaded(true);
                                         setTimeout(() => setShowHumanIcon(false), 300);
                                     }}
                                 />
                             )}
                             {(!dpUrl || showHumanIcon) && (
                                 <View style={[styles.icon, styles.humanIconContainer]}>
                                     <Text style={styles.humanIconText}>👤</Text>
                                 </View>
                             )}
                         </View>
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
    iconContainer: {
        width: 40,
        height: 40,
        marginLeft: 15,
        marginRight: 10,
        borderRadius: 20,
        position: 'relative',
        overflow: 'hidden',
    },
    icon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        overflow: 'hidden',
    },
    humanIconContainer: {
        backgroundColor: '#F0F0F0',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 3,
    },
    humanIconText: {
        fontSize: 20,
        color: '#666',
    },
    welcomeText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
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
