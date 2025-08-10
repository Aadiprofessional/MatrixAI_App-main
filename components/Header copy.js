import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, ActivityIndicator } from 'react-native';

import { supabase } from '../supabaseClient';
import { useTheme } from '../context/ThemeContext';
import { useProfileUpdate } from '../context/ProfileUpdateContext';
import { useLanguage } from '../context/LanguageContext';

const Header2 = ({ navigation, uid, openDrawer }) => {
    console.log("Header rendering with UID:", uid);

    const [userName, setUserName] = useState('');
    const [dpUrl, setDpUrl] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isPro, setIsPro] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [showHumanIcon, setShowHumanIcon] = useState(true);
    const { getThemeColors } = useTheme();
    const { lastUpdate } = useProfileUpdate();
    const colors = getThemeColors();
    const { t } = useLanguage();
    useEffect(() => {
        if (uid) {
            fetchUserData();
        }
    }, [uid, lastUpdate]);

    const fetchUserData = async () => {
        setLoading(true);
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
                setUserName(firstName.substring(0, 10));
                
                // Set profile picture URL if it exists
                if (data.dp_url) {
                    setDpUrl(data.dp_url);
                    setImageLoaded(false);
                    setShowHumanIcon(true);
                }
                
                // Set pro status
                setIsPro(data.subscription_active || false);
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!uid) {
        console.log("No UID in Header");
        return <ActivityIndicator size="small" color="#333" style={{ marginLeft: 10 }} />;
    }



    return (
        <View style={[styles.header, {backgroundColor: 'transparent'}]}>
            {/* Menu Icon */}
         

            {/* Welcome Text with Profile Picture */}
            <View style={styles.rowContainer}>
              <View style={styles.iconContainer}>
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
                
                {loading ? (
                    <ActivityIndicator size="small" color="#333" style={{ marginLeft: 10 }} />
                ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {isPro ? (
                            <View style={styles.proContainer}>
                                <Text style={[styles.welcomeText, {color: colors.text}]}>
                                    {userName} 
                                </Text>
                                <View style={[styles.proBadge , {backgroundColor: colors.primary}]}>
                                    <Text style={styles.proText}>{t('pro')}</Text>
                                </View>
                            </View>
                        ) : (
                            <Text style={[styles.welcomeText, {color: colors.text}]}>
                                Welcome{userName ? ` ${userName}!`: '!'}
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
     marginTop:10,
     paddingHorizontal:10,
        paddingBottom:5,
      
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
        marginRight: 3,
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

export default Header2;
