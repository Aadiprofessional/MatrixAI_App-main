import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Alert, Modal, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Toast from 'react-native-toast-message';
import { supabase } from '../supabaseClient';
import { LANGUAGES, DEFAULT_LANGUAGE } from '../utils/languageUtils';

const SignUpDetailsScreen = ({ navigation }) => {
    const route = useRoute();
    const { userInfo = {}, email = '', disableEmailInput = false } = route.params || {};
    const [loading, setLoading] = useState(false);
    const [name, setName] = useState(userInfo?.name || '');
    const [age, setAge] = useState(userInfo?.age || '');
    const [gender, setGender] = useState('Male');
    const [inputEmail, setInputEmail] = useState(userInfo?.email || email || '');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [referralCode, setReferralCode] = useState('');
    const [preferredLanguage, setPreferredLanguage] = useState(DEFAULT_LANGUAGE);
    const [languageModalVisible, setLanguageModalVisible] = useState(false);

    useEffect(() => {
        console.log('Received user info:', userInfo);
    }, [userInfo]);

    // Function to generate a random 6-digit alphanumeric code
    const generateReferralCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    };

    // Function to check if referral code is valid
    const checkReferralCode = async (code) => {
        if (!code) return { valid: true, referrerId: null }; // Empty code is considered valid (optional)
        
        try {
            const { data, error } = await supabase
                .from('users')
                .select('uid')
                .eq('referral_code', code.toUpperCase())
                .single();
                
            if (error) throw error;
            
            return { valid: !!data, referrerId: data?.uid };
        } catch (error) {
            console.error('Error checking referral code:', error);
            return { valid: false, referrerId: null };
        }
    };

  

    const handleSelectLanguage = (language) => {
        setPreferredLanguage(language);
        setLanguageModalVisible(false);
    };

    const handleSignUp = async () => {
        // Validate inputs
        if (!name.trim()) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Please enter your name',
                position: 'bottom'
            });
            return;
        }

        if (!inputEmail.trim() || !inputEmail.includes('@')) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Please enter a valid email address',
                position: 'bottom'
            });
            return;
        }

        if (password.length < 6) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Password must be at least 6 characters long',
                position: 'bottom'
            });
            return;
        }

        if (password !== confirmPassword) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Passwords do not match',
                position: 'bottom'
            });
            return;
        }

        setLoading(true);
        try {
            // Check if referral code is valid
            const { valid, referrerId } = await checkReferralCode(referralCode);
            
            if (referralCode && !valid) {
                Toast.show({
                    type: 'error',
                    text1: 'Error',
                    text2: 'Invalid referral code',
                    position: 'bottom'
                });
                setLoading(false);
                return;
            }
            
            // Generate a unique referral code for the new user
            const newReferralCode = generateReferralCode();
            
            // Use Supabase directly for signup
            const { data, error } = await supabase.auth.signUp({
                email: inputEmail.trim(),
                password: password,
                options: {
                    data: {
                        name: name.trim(),
                        age: age ? parseInt(age, 10) : null,
                        gender: gender,
                        preferred_language: preferredLanguage
                    }
                }
            });

            if (error) throw error;

            console.log('Signup successful:', data);
            
            // Instead of storing in the database now, pass the data to verification screen
            const userData = {
                uid: data.user.id,
                name: name.trim(),
                email: inputEmail.trim(),
                age: age ? parseInt(age, 10) : null,
                gender: gender,
                preferred_language: preferredLanguage,
                referral_code: newReferralCode,
                referrerId: referrerId,
                password: password // Pass password for auto-login after verification
            };
            
            Toast.show({
                type: 'success',
                text1: 'Success',
                text2: 'Account created successfully! Please check your email for verification.',
                position: 'bottom'
            });

            // Navigate to email verification screen with user data
            navigation.navigate('EmailVerification', {
                email: inputEmail.trim(),
                message: 'We have sent a verification link to your email. Please verify your email within 10 minutes to continue.',
                isNewUser: true,
                userData: userData // Pass the user data to be saved after verification
            });
        } catch (error) {
            console.error('Error during signup:', error);
            
            // Handle specific error cases
            if (error.message.includes('already registered')) {
                Toast.show({
                    type: 'error',
                    text1: 'Error',
                    text2: 'This email is already registered. Please login instead.',
                    position: 'bottom'
                });
                navigation.navigate('EmailLogin');
                return;
            }
            
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error.message || 'Signup failed. Please try again.',
                position: 'bottom'
            });
        } finally {
            setLoading(false);
        }
    };

    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword);
    };

    const toggleConfirmPasswordVisibility = () => {
        setShowConfirmPassword(!showConfirmPassword);
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
            >
                <ScrollView 
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Back Button */}
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <View style={styles.backButtonCircle}>
                            <Icon name="arrow-back" size={20} color="#fff" />
                        </View>
                    </TouchableOpacity>

                    {/* Header */}
                    <Text style={styles.headerText}>Create Your Account</Text>

                    {/* Input Fields */}
                    <View style={styles.inputContainer}>
                        <Icon name="person-outline" size={20} color="#aaa" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Enter Your Name"
                            placeholderTextColor="#aaa"
                            value={name}
                            onChangeText={setName}
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Icon name="mail-outline" size={20} color="#aaa" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Email Address"
                            placeholderTextColor="#aaa"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            value={inputEmail}
                            onChangeText={setInputEmail}
                            editable={!disableEmailInput}
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Icon name="calendar-outline" size={20} color="#aaa" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Age (Optional)"
                            placeholderTextColor="#aaa"
                            keyboardType="numeric"
                            value={age}
                            onChangeText={setAge}
                        />
                    </View>

                    {/* Gender Selection */}
                    <Text style={styles.genderLabel}>Select Gender</Text>
                    <View style={styles.genderContainer}>
                        {['Male', 'Female', 'Others'].map((item) => (
                            <TouchableOpacity
                                key={item}
                                style={[
                                    styles.genderButton,
                                    gender === item && styles.genderButtonSelected,
                                ]}
                                onPress={() => setGender(item)}
                            >
                                <Text style={{ color: gender === item ? '#fff' : '#000' }}>{item}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Language Selection Button */}
                    <View style={styles.languageSection}>
                        <Text style={styles.languageLabel}>Preferred Language</Text>
                        <TouchableOpacity 
                            style={styles.languageSelector}
                            onPress={() => setLanguageModalVisible(true)}
                        >
                            <Text style={styles.languageText}>
                                {LANGUAGES[preferredLanguage]?.name || preferredLanguage}
                            </Text>
                            <Icon name="chevron-down" size={20} color="#666" />
                        </TouchableOpacity>
                    </View>

                    {/* Password Fields */}
                    <View style={styles.inputContainer}>
                        <Icon name="lock-closed-outline" size={20} color="#aaa" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Password"
                            placeholderTextColor="#aaa"
                            secureTextEntry={!showPassword}
                            value={password}
                            onChangeText={setPassword}
                        />
                        <TouchableOpacity style={styles.eyeIcon} onPress={togglePasswordVisibility}>
                            <Icon name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#aaa" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.inputContainer}>
                        <Icon name="lock-closed-outline" size={20} color="#aaa" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Confirm Password"
                            placeholderTextColor="#aaa"
                            secureTextEntry={!showConfirmPassword}
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                        />
                        <TouchableOpacity style={styles.eyeIcon} onPress={toggleConfirmPasswordVisibility}>
                            <Icon name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#aaa" />
                        </TouchableOpacity>
                    </View>

                    {/* Referral Code */}
                    <View style={styles.inputContainer}>
                        <Icon name="gift-outline" size={20} color="#aaa" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Referral Code (Optional)"
                            placeholderTextColor="#aaa"
                            value={referralCode}
                            onChangeText={setReferralCode}
                            autoCapitalize="characters"
                        />
                    </View>

                    {/* Signup Button */}
                    <TouchableOpacity
                        style={styles.signupButton}
                        onPress={handleSignUp}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <Text style={styles.signupButtonText}>Sign Up</Text>
                        )}
                    </TouchableOpacity>

                    {/* Login Link */}
                    <View style={styles.loginLinkContainer}>
                        <Text style={styles.loginText}>Already have an account?</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('EmailLogin')}>
                            <Text style={styles.loginLink}>Login</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Language Selection Modal */}
            <Modal
                visible={languageModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setLanguageModalVisible(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Choose Language</Text>
                            <TouchableOpacity onPress={() => setLanguageModalVisible(false)}>
                                <Icon name="close" size={24} color="#333" />
                            </TouchableOpacity>
                        </View>

                        <FlatList
                            data={Object.keys(LANGUAGES)}
                            keyExtractor={(item) => item}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[
                                        styles.languageItem,
                                        preferredLanguage === item && styles.selectedLanguageItem,
                                    ]}
                                    onPress={() => handleSelectLanguage(item)}
                                >
                                    <Text
                                        style={[
                                            styles.languageItemText,
                                            preferredLanguage === item && styles.selectedLanguageText,
                                        ]}
                                    >
                                        {LANGUAGES[item].name}
                                    </Text>
                                    {preferredLanguage === item && (
                                        <Icon name="checkmark" size={20} color="#fff" />
                                    )}
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        padding: 20,
    },
    backButton: {
        marginBottom: 20,
        alignSelf: 'flex-start',
    },
    backButtonCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#2274F0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerText: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 30,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 10,
        marginBottom: 15,
        paddingHorizontal: 15,
        height: 50,
        backgroundColor: '#f9f9f9',
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: '#333',
    },
    eyeIcon: {
        padding: 10,
    },
    genderLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#555',
        marginBottom: 10,
    },
    genderContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    genderButton: {
        flex: 1,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 10,
        marginHorizontal: 5,
        backgroundColor: '#f9f9f9',
    },
    genderButtonSelected: {
        backgroundColor: '#2274F0',
        borderColor: '#2274F0',
    },
    languageSection: {
        marginBottom: 20,
    },
    languageLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#555',
        marginBottom: 10,
    },
    languageSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 10,
        paddingHorizontal: 15,
        height: 50,
        backgroundColor: '#f9f9f9',
    },
    languageText: {
        fontSize: 16,
        color: '#333',
    },
    signupButton: {
        backgroundColor: '#2274F0',
        height: 55,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 30,
        marginBottom: 15,
    },
    signupButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    loginLinkContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 30,
    },
    loginText: {
        color: '#666',
        fontSize: 16,
        marginRight: 5,
    },
    loginLink: {
        color: '#2274F0',
        fontSize: 16,
        fontWeight: 'bold',
    },
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        paddingBottom: 24,
        maxHeight: '70%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    languageItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    selectedLanguageItem: {
        backgroundColor: '#2274F0',
    },
    languageItemText: {
        fontSize: 16,
        color: '#333',
    },
    selectedLanguageText: {
        color: '#fff',
        fontWeight: 'bold',
    }
});

export default SignUpDetailsScreen;
