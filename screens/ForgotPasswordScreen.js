import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { supabase } from '../supabaseClient';
import Toast from 'react-native-toast-message';

const ForgotPasswordScreen = ({ navigation }) => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);

    const handleResetPassword = async () => {
        // Validate email
        if (email.trim() === '' || !email.includes('@')) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Please enter a valid email address',
                position: 'bottom'
            });
            return;
        }

        setLoading(true);
        try {
            // Use Supabase directly for password reset
            const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
                redirectTo: 'https://main-matrixai-server-lujmidrakh.cn-hangzhou.fcapp.run/reset-password-callback',
            });

            if (error) throw error;
            
            Toast.show({
                type: 'success',
                text1: 'Success',
                text2: 'Password reset email sent successfully!',
                position: 'bottom'
            });
            
            // Navigate to verification screen
            navigation.navigate('EmailVerification', {
                email: email.trim(),
                message: 'We have sent a password reset link to your email. Please check your inbox and follow the instructions to reset your password.',
                isPasswordReset: true
            });
        } catch (error) {
            console.error('Error requesting password reset:', error);
            
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error.message || 'Failed to send reset password email. Please try again.',
                position: 'bottom'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Back Button */}
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <View style={styles.backButtonCircle}>
                    <Icon name="arrow-back" size={20} color="#fff" />
                </View>
            </TouchableOpacity>

            {/* Header */}
            <Text style={styles.headerText}>Forgot Password</Text>
            
            {/* Subheader */}
            <Text style={styles.subheaderText}>
                Enter your email address and we'll send you a link to reset your password
            </Text>

            {/* Email Input */}
            <View style={styles.inputContainer}>
                <Icon name="mail-outline" size={20} color="#aaa" style={styles.inputIcon} />
                <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor="#aaa"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                />
            </View>

            {/* Reset Password Button */}
            <TouchableOpacity 
                style={styles.resetButton} 
                onPress={handleResetPassword}
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                ) : (
                    <Text style={styles.resetButtonText}>Send Reset Link</Text>
                )}
            </TouchableOpacity>

            {/* Back to Login */}
            <TouchableOpacity 
                style={styles.loginLinkContainer}
                onPress={() => navigation.navigate('EmailLogin')}
            >
                <Text style={styles.loginLinkText}>
                    Remember your password? <Text style={styles.loginLink}>Login</Text>
                </Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        padding: 20,
        alignItems: 'center',
    },
    backButton: {
        position: 'absolute',
        top: 50,
        left: 20,
        zIndex: 10,
    },
    backButtonCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#2274F0',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#aaa',
    },
    headerText: {
        fontSize: 24,
        fontWeight: 'bold',
        marginTop: 100,
        marginBottom: 20,
        textAlign: 'center',
    },
    subheaderText: {
        fontSize: 16,
        color: '#555',
        textAlign: 'center',
        marginBottom: 30,
        paddingHorizontal: 20,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 10,
        width: '100%',
        marginBottom: 30,
        paddingHorizontal: 15,
        paddingVertical: 12,
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: '#000',
    },
    resetButton: {
        backgroundColor: '#2274F0',
        paddingVertical: 12,
        borderRadius: 30,
        width: '90%',
        alignItems: 'center',
        marginBottom: 20,
    },
    resetButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '500',
    },
    loginLinkContainer: {
        marginTop: 20,
    },
    loginLinkText: {
        fontSize: 14,
        color: '#000',
    },
    loginLink: {
        color: '#2274F0',
        fontWeight: 'bold',
    },
});

export default ForgotPasswordScreen; 