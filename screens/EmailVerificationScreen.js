import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Linking,
    Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabaseClient';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Toast from 'react-native-toast-message';

const EmailVerificationScreen = ({ navigation, route }) => {
    const { email, message, isNewUser, isPasswordReset, userData } = route.params || {};
    const [loading, setLoading] = useState(false);
    const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds
    const [verificationChecked, setVerificationChecked] = useState(false);
    const [autoCheckActive, setAutoCheckActive] = useState(true);

    // Format time as MM:SS
    const formatTime = (seconds) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
    };

    // Function to save user data after verification
    const saveUserDataAfterVerification = async (userId) => {
        if (!userData || !isNewUser) {
            console.log('No user data to save or not a new user');
            return;
        }
        
        try {
            console.log('Saving user data after verification for user ID:', userId);
            console.log('User data to save:', userData);
            
            // Check if the users table exists
            try {
                // Try to get table info first
                const { data: tablesInfo, error: tablesError } = await supabase
                    .rpc('get_table_info', { table_name: 'users' });
                    
                if (tablesError) {
                    console.error('Error checking table info:', tablesError);
                    // We'll continue anyway as the table might still exist
                }
                
                console.log('Table info result:', tablesInfo);
            } catch (tableCheckError) {
                console.error('Error during table check:', tableCheckError);
                // Continue anyway
            }
            
            // First check if user already exists with direct query
            try {
                const { data: existingUser, error: checkError } = await supabase
                    .from('users')
                    .select('uid')
                    .eq('uid', userId)
                    .maybeSingle();
                    
                console.log('Check for existing user result:', existingUser);
                
                if (checkError) {
                    console.error('Error checking if user exists:', checkError);
                    // Continue anyway, we'll try to insert
                }
                
                if (existingUser) {
                    console.log('User already exists in database, skipping insertion');
                    return;
                }
            } catch (checkError) {
                console.error('Error during existence check:', checkError);
                // Continue anyway, we'll try to insert
            }
            
            // Prepare user data for database
            const dbUserData = {
                uid: userId,
                name: userData.name,
                email: userData.email,
                age: userData.age || 0,
                gender: userData.gender || 'Not specified',
                preferred_language: userData.preferred_language || 'English',
                referral_code: userData.referral_code || '',
                user_coins: userData.referrerId ? 50 : 0, // 50 coins if referred, 0 if not
                invited_members: [],
                referred_by: userData.referrerId || null
            };
            
            console.log('Inserting new user into database:', dbUserData);
            
            // Try direct SQL insertion as a fallback
            let insertSuccess = false;
            
            // First try standard insert
            try {
                const { data: insertData, error: insertError } = await supabase
                    .from('users')
                    .insert([dbUserData])
                    .select();
                    
                if (insertError) {
                    console.error('Standard insert error:', insertError);
                } else {
                    console.log('User data inserted successfully:', insertData);
                    insertSuccess = true;
                }
            } catch (insertError) {
                console.error('Error during standard insert:', insertError);
            }
            
            // If standard insert failed, try upsert as a fallback
            if (!insertSuccess) {
                try {
                    console.log('Trying upsert as fallback...');
                    const { data: upsertData, error: upsertError } = await supabase
                        .from('users')
                        .upsert([dbUserData], { onConflict: 'uid' })
                        .select();
                        
                    if (upsertError) {
                        console.error('Upsert error:', upsertError);
                    } else {
                        console.log('User data upserted successfully:', upsertData);
                        insertSuccess = true;
                    }
                } catch (upsertError) {
                    console.error('Error during upsert:', upsertError);
                }
            }
            
            // If both failed, try one more approach with a delay
            if (!insertSuccess) {
                try {
                    console.log('Trying insert after delay...');
                    // Wait 2 seconds and try again
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    const { data: finalInsertData, error: finalInsertError } = await supabase
                        .from('users')
                        .insert([dbUserData])
                        .select();
                        
                    if (finalInsertError) {
                        console.error('Final insert error:', finalInsertError);
                        throw finalInsertError;
                    } else {
                        console.log('User data inserted successfully after delay:', finalInsertData);
                        insertSuccess = true;
                    }
                } catch (finalError) {
                    console.error('Error during final insert attempt:', finalError);
                    throw finalError;
                }
            }
            
            if (!insertSuccess) {
                throw new Error('Failed to insert user data after multiple attempts');
            }
            
            console.log('User data saved successfully');
            
            // Wait a moment to ensure data is committed before checking for referrer updates
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // If user was referred, update the referrer
            if (userData.referrerId) {
                await updateReferrer(userData.referrerId, userId);
            }
        } catch (error) {
            console.error('Error saving user data:', error);
            Toast.show({
                type: 'error',
                text1: 'Account Created',
                text2: 'Your account was created but we had trouble saving some additional data. Please try restarting the app.',
                position: 'bottom'
            });
        }
    };
    
    // Function to update referrer's invited_members and add coins
    const updateReferrer = async (referrerId, newUserId) => {
        try {
            console.log('Updating referrer:', referrerId, 'with new user:', newUserId);
            
            // Get current invited_members array - using maybeSingle to handle "no rows" gracefully
            const { data: referrerData, error: referrerError } = await supabase
                .from('users')
                .select('invited_members, user_coins')
                .eq('uid', referrerId)
                .maybeSingle();
                
            if (referrerError) {
                console.error('Error getting referrer data:', referrerError);
                throw referrerError;
            }
            
            if (!referrerData) {
                console.log('Referrer not found in database');
                return;
            }
            
            console.log('Current referrer data:', referrerData);
            
            // Prepare the updated array
            const updatedInvitedMembers = referrerData.invited_members || [];
            if (!updatedInvitedMembers.includes(newUserId)) {
                updatedInvitedMembers.push(newUserId);
            }
            
            // Calculate new coin value (add 50)
            const newCoinValue = (referrerData.user_coins || 0) + 50;
            
            // Update the referrer record
            const { error: updateError } = await supabase
                .from('users')
                .update({ 
                    invited_members: updatedInvitedMembers,
                    user_coins: newCoinValue
                })
                .eq('uid', referrerId);
                
            if (updateError) {
                console.error('Error updating referrer:', updateError);
                throw updateError;
            }
            
            console.log('Referrer updated successfully');
        } catch (error) {
            console.error('Error updating referrer:', error);
        }
    };

    // Function to open verification link in mobile browser
    const openVerificationLink = async () => {
        try {
            console.log('Opening verification link in browser for:', email);
            // This assumes your verification link is in this format, adjust as needed
            const verificationUrl = `https://app.supabase.com/project/_/auth/email/confirm`;
            await Linking.openURL(verificationUrl);
        } catch (error) {
            console.error('Error opening verification link:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Could not open browser. Please check your email app for the verification link.',
                position: 'bottom'
            });
        }
    };

    // Function to handle checking verification by signing in
    const checkEmailVerificationBySignIn = async () => {
        if (!email || !userData?.password) {
            console.log('Missing email or password for verification check');
            return null;
        }
        
        try {
            // Try to sign in - this will only work if the email is verified
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: userData.password
            });
            
            if (error) {
                console.log('Sign in failed during verification check:', error.message);
                return null;
            }
            
            console.log('Sign in succeeded - email is verified');
            return data;
        } catch (error) {
            console.error('Error checking verification by sign in:', error);
            return null;
        }
    };

    // Check verification status periodically using a safer method
    useEffect(() => {
        if (verificationChecked || !autoCheckActive) return;

        const checkVerification = async () => {
            try {
                // Instead of using getUser (which requires auth), check by trying to sign in
                const signInData = await checkEmailVerificationBySignIn();
                
                if (signInData?.user) {
                    console.log('Email verified via sign in check');
                    setVerificationChecked(true);
                    
                    // Save user data if needed
                    if (isNewUser && userData) {
                        await saveUserDataAfterVerification(signInData.user.id);
                        
                        // Add a delay to ensure data is saved before navigating
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                    
                    // Store session data
                    await AsyncStorage.setItem('uid', signInData.user.id);
                    await AsyncStorage.setItem('userLoggedIn', 'true');
                    
                    Toast.show({
                        type: 'success',
                        text1: 'Email Verified',
                        text2: 'Your email has been successfully verified!',
                        position: 'bottom'
                    });
                    
                    // Navigate to main screen
                    navigation.replace('Home');
                } else {
                    console.log('Email not verified yet for:', email);
                }
            } catch (error) {
                console.error('Error checking verification:', error);
            }
        };

        // Check immediately and then every 10 seconds (less frequent to reduce errors)
        checkVerification();
        const intervalId = setInterval(checkVerification, 10000);

        return () => clearInterval(intervalId);
    }, [email, navigation, verificationChecked, isPasswordReset, userData, isNewUser, autoCheckActive]);

    // Function to handle manual verification
    const handleManualVerification = async () => {
        setLoading(true);
        try {
            // Try to sign in - this will only work if email is verified
            const signInData = await checkEmailVerificationBySignIn();
            
            if (!signInData?.user) {
                Toast.show({
                    type: 'error',
                    text1: 'Not Verified',
                    text2: 'Your email has not been verified yet. Please check your inbox and click the verification link.',
                    position: 'bottom'
                });
                setLoading(false);
                return;
            }
            
            // Email is verified, user is signed in
            
            // Save user data if needed
            if (isNewUser && userData) {
                await saveUserDataAfterVerification(signInData.user.id);
                
                // Add a delay to ensure data is saved before navigating
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
            // Store session data
            await AsyncStorage.setItem('uid', signInData.user.id);
            await AsyncStorage.setItem('userLoggedIn', 'true');
            
            Toast.show({
                type: 'success',
                text1: 'Success',
                text2: 'Your email has been verified and you are now logged in!',
                position: 'bottom'
            });
            
            // Navigate to main screen
            navigation.replace('Home');
        } catch (error) {
            console.error('Error during manual verification:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error.message || 'Failed to verify email. Please try again.',
                position: 'bottom'
            });
        } finally {
            setLoading(false);
        }
    };

    // Handle deep linking
    useEffect(() => {
        // Function to handle deep links
        const handleDeepLink = async (event) => {
            try {
                const url = event.url;
                console.log('Received deep link:', url);
                
                // Check for expired token error first
                if (url.includes('error=') && (url.includes('expired') || url.includes('invalid'))) {
                    console.log('Link expired or invalid');
                    Toast.show({
                        type: 'error',
                        text1: 'Verification Error',
                        text2: 'The verification link has expired. Please request a new one.',
                        position: 'bottom'
                    });
                    return;
                }
                
                // Extract token from URL
                let token = null;
                let type = 'signup';
                
                // Try different patterns to extract token
                if (url.includes('token=')) {
                    const match = url.match(/[?&]token=([^&]+)/);
                    if (match && match[1]) {
                        token = decodeURIComponent(match[1]);
                    }
                } else if (url.includes('access_token=')) {
                    const match = url.match(/[?&]access_token=([^&]+)/);
                    if (match && match[1]) {
                        token = decodeURIComponent(match[1]);
                    }
                } else if (url.includes('#')) {
                    // Some links might have the token after a hash
                    const hashPart = url.split('#')[1];
                    if (hashPart) {
                        const match = hashPart.match(/token=([^&]+)/);
                        if (match && match[1]) {
                            token = decodeURIComponent(match[1]);
                        }
                    }
                }
                
                // Extract type if available
                const typeMatch = url.match(/[?&]type=([^&]+)/);
                if (typeMatch && typeMatch[1]) {
                    type = decodeURIComponent(typeMatch[1]);
                }
                
                console.log('Extracted token:', token, 'Type:', type);
                
                if (!token) {
                    console.log('No token found in URL:', url);
                    
                    // If there's an error in the URL, handle it
                    if (url.includes('error=')) {
                        Toast.show({
                            type: 'error',
                            text1: 'Verification Error',
                            text2: 'The verification link is invalid. Please request a new one.',
                            position: 'bottom'
                        });
                    }
                    return;
                }
                
                // Since we have a token, try signing in directly rather than verifying the token
                const signInData = await checkEmailVerificationBySignIn();
                
                if (signInData?.user) {
                    console.log('Successful sign in after deep link');
                    
                    // Save user data if this is a new user
                    if (isNewUser && userData) {
                        await saveUserDataAfterVerification(signInData.user.id);
                        
                        // Add a delay to ensure data is saved before navigating
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                    
                    // Store authentication data
                    await AsyncStorage.setItem('uid', signInData.user.id);
                    await AsyncStorage.setItem('userLoggedIn', 'true');
                    
                    Toast.show({
                        type: 'success',
                        text1: 'Success',
                        text2: 'Your email has been verified and you are now logged in!',
                        position: 'bottom'
                    });
                    
                    // Navigate to main screen
                    navigation.replace('Home');
                } else {
                    console.log('Could not sign in after deep link - email might not be verified yet');
                    Toast.show({
                        type: 'info',
                        text1: 'Verification Pending',
                        text2: 'Please wait a moment and try again, or check your email for the verification link.',
                        position: 'bottom'
                    });
                }
            } catch (error) {
                console.error('Error handling deep link:', error);
                Toast.show({
                    type: 'error',
                    text1: 'Error',
                    text2: error.message || 'Failed to process verification link.',
                    position: 'bottom'
                });
            }
        };

        // Set up URL handling for web links
        // This handles links that open the app
        const subscription = Linking.addEventListener('url', handleDeepLink);

        // Check for any initial URL (app opened via link)
        Linking.getInitialURL().then(url => {
            if (url) {
                console.log('Initial URL:', url);
                handleDeepLink({ url });
            } else {
                console.log('No initial URL');
            }
        });

        return () => {
            subscription.remove();
        };
    }, [navigation, isNewUser, userData, email]);

    // Timer countdown effect
    useEffect(() => {
        if (timeLeft <= 0) {
            // Time expired
            setAutoCheckActive(false);
            Toast.show({
                type: 'error',
                text1: 'Verification Time Expired',
                text2: 'The verification time has expired. Please request a new verification email.',
                position: 'bottom'
            });
            return;
        }

        const timerId = setInterval(() => {
            setTimeLeft(prevTime => prevTime - 1);
        }, 1000);

        return () => clearInterval(timerId);
    }, [timeLeft]);

    const handleResendVerification = async () => {
        setLoading(true);
        try {
            // Reset auto-check
            setAutoCheckActive(true);
            setVerificationChecked(false);
            
            // Use Supabase to resend verification email
            const { error } = await supabase.auth.resend({
                type: 'signup',
                email: email,
            });

            if (error) throw error;
            
            Toast.show({
                type: 'success',
                text1: 'Verification Email Sent',
                text2: 'A new verification email has been sent to your email address.',
                position: 'bottom'
            });
            
            // Reset timer
            setTimeLeft(600);
        } catch (error) {
            console.error('Error resending verification:', error);
            
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error.message || 'Failed to resend verification email. Please try again.',
                position: 'bottom'
            });
        } finally {
            setLoading(false);
        }
    };

    // Modified open email method to provide options
    const openEmailOptions = () => {
        Alert.alert(
            "Verify Your Email",
            "Choose how to verify your email:",
            [
                {
                    text: "Open Email App",
                    onPress: () => Linking.openURL('mailto:'),
                    style: "default"
                },
                {
                    text: "Open in Browser",
                    onPress: () => openVerificationLink(),
                },
                {
                    text: "Cancel",
                    style: "cancel"
                }
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Email Icon */}
            <View style={styles.iconContainer}>
                <MaterialIcons name="mark-email-unread" size={80} color="#2274F0" />
            </View>

            {/* Title */}
            <Text style={styles.title}>Verify Your Email</Text>

            {/* Message */}
            <Text style={styles.message}>{message || 'Please check your email and click the verification link to continue.'}</Text>

            {/* Timer */}
            <View style={styles.timerContainer}>
                <Text style={styles.timerLabel}>Time remaining:</Text>
                <Text style={styles.timer}>{formatTime(timeLeft)}</Text>
            </View>

            {/* Open Email App Button */}
            <TouchableOpacity 
                style={styles.emailButton} 
                onPress={openEmailOptions}
            >
                <View style={styles.buttonContent}>
                    <Icon name="mail" size={20} color="#fff" style={styles.buttonIcon} />
                    <Text style={styles.buttonText}>Verify Email</Text>
                </View>
            </TouchableOpacity>

            {/* Check Verification Status Button */}
            <TouchableOpacity 
                style={styles.verifyButton} 
                onPress={handleManualVerification}
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                ) : (
                    <View style={styles.buttonContent}>
                        <Icon name="checkmark-circle" size={20} color="#fff" style={styles.buttonIcon} />
                        <Text style={styles.buttonText}>I've Verified My Email</Text>
                    </View>
                )}
            </TouchableOpacity>

            {/* Resend Button */}
            <TouchableOpacity 
                style={styles.resendButton} 
                onPress={handleResendVerification}
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                ) : (
                    <View style={styles.buttonContent}>
                        <Icon name="refresh" size={20} color="#fff" style={styles.buttonIcon} />
                        <Text style={styles.buttonText}>Resend Verification Email</Text>
                    </View>
                )}
            </TouchableOpacity>

            {/* Troubleshooting Instructions */}
            <View style={styles.troubleshootingContainer}>
                <Text style={styles.troubleshootingTitle}>Having trouble?</Text>
                <Text style={styles.troubleshootingText}>
                    • Check your spam or junk folder{'\n'}
                    • Try requesting a new verification email{'\n'}
                    • Make sure you're clicking the link on this device
                </Text>
            </View>

            {/* Back to Login */}
            <TouchableOpacity 
                style={styles.backButton}
                onPress={() => navigation.navigate('EmailLogin')}
            >
                <Text style={styles.backButtonText}>Back to Login</Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        alignItems: 'center',
        padding: 20,
    },
    iconContainer: {
        width: 150,
        height: 150,
        marginTop: 60,
        marginBottom: 30,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f0f7ff',
        borderRadius: 75,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
    },
    message: {
        fontSize: 16,
        color: '#555',
        textAlign: 'center',
        marginBottom: 30,
        paddingHorizontal: 20,
    },
    timerContainer: {
        flexDirection: 'column',
        alignItems: 'center',
        marginBottom: 30,
    },
    timerLabel: {
        fontSize: 14,
        color: '#555',
        marginBottom: 5,
    },
    timer: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#2274F0',
    },
    emailButton: {
        backgroundColor: '#4CAF50', // Green
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 30,
        marginBottom: 15,
        width: '80%',
        alignItems: 'center',
    },
    verifyButton: {
        backgroundColor: '#FF9800', // Orange
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 30,
        marginBottom: 15,
        width: '80%',
        alignItems: 'center',
    },
    resendButton: {
        backgroundColor: '#2274F0',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 30,
        marginBottom: 20,
        width: '80%',
        alignItems: 'center',
    },
    buttonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonIcon: {
        marginRight: 8,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '500',
    },
    troubleshootingContainer: {
        marginTop: 10,
        marginBottom: 20,
        padding: 15,
        backgroundColor: '#f5f5f5',
        borderRadius: 10,
        width: '90%',
    },
    troubleshootingTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 5,
        color: '#333',
    },
    troubleshootingText: {
        fontSize: 14,
        color: '#555',
        lineHeight: 20,
    },
    backButton: {
        marginTop: 10,
    },
    backButtonText: {
        color: '#2274F0',
        fontSize: 16,
    },
});

export default EmailVerificationScreen; 