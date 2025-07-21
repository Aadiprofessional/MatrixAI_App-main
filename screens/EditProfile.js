import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  ActivityIndicator,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabaseClient';
import RNFS from 'react-native-fs';
import { decode } from 'base-64'; // Import decode from base-64 package

import Ionicons from 'react-native-vector-icons/Ionicons';
import * as ImagePicker from 'react-native-image-picker';
import { useAuthUser } from '../hooks/useAuthUser';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { ThemedView, ThemedText, ThemedCard } from '../components/ThemedView';
import ThemedStatusBar from '../components/ThemedStatusBar';
import { useProfileUpdate } from '../context/ProfileUpdateContext';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
// Convert base64 to byte array - React Native compatible approach
const decodeBase64 = (base64String) => {
  const byteCharacters = decode(base64String);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  return new Uint8Array(byteNumbers);
};

const EditProfile = ({ navigation }) => {
  const { uid } = useAuthUser();
  const { t } = useLanguage();
  const { getThemeColors } = useTheme();
  const { triggerUpdate } = useProfileUpdate();
  const colors = getThemeColors();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [profileData, setProfileData] = useState({
    name: '',
    gender: '',
    age: '',
    email: '',
    dp_url: '',
  });
  const [editingField, setEditingField] = useState(null);
  const [tempValue, setTempValue] = useState('');
  const [isEdited, setIsEdited] = useState(false);
  
  // Animated values for skeleton loading
  const shimmerValue = useRef(new Animated.Value(0)).current;
  
  // Shimmer animation
  useEffect(() => {
    if (loading || uploading) {
      // Start shimmer animation
      Animated.loop(
        Animated.timing(shimmerValue, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
          easing: Easing.linear,
        })
      ).start();
    }
    return () => {
      shimmerValue.setValue(0);
    };
  }, [loading, uploading]);
  
  // Calculate shimmer translation
  const shimmerTranslate = shimmerValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-100, 220],
  });

  const fetchUserData = async () => {
    if (!uid) {
      console.error('No UID available to fetch user data');
      setLoading(false);
      return;
    }
    
    try {
      console.log('Fetching user data for UID:', uid);
      
      const response = await fetch('https://main-matrixai-server-lujmidrakh.cn-hangzhou.fcapp.run/api/user/userinfo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uid }),
      });
      
      const result = await response.json();
      console.log('User info API response:', result);
      
      if (result.success) {
        const userData = result.data;
        console.log('Setting profile data:', userData);
        setProfileData({
          ...userData
        });
      } else {
        console.error('API returned error:', result.message || 'Unknown error');
        Alert.alert('Error', result.message || 'Failed to fetch user data');
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      Alert.alert('Error', 'Failed to fetch user data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  const handleImagePick = async () => {
    const options = {
      mediaType: 'photo',
      quality: 1,
      includeBase64: true, // Request base64 data
    };

    try {
      const result = await ImagePicker.launchImageLibrary(options);
      if (result.assets && result.assets[0]) {
        setUploading(true);
        const asset = result.assets[0];
        
        // Get file extension from uri
        const fileExt = asset.uri.substring(asset.uri.lastIndexOf('.') + 1);
        
        // Create file name with correct extension
        const filePath = `users/${uid}/profile-${Date.now()}.${fileExt}`;

        // Method 1: Using base64 data directly from the picker result
        if (asset.base64) {
          console.log('Using base64 data directly from picker result');
          const arrayBuffer = decodeBase64(asset.base64);
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('user-uploads')
            .upload(filePath, arrayBuffer, {
              contentType: asset.type || 'image/jpeg',
              cacheControl: '3600'
            });

          if (uploadError) throw uploadError;
        } 
        // Method 2: Reading file from filesystem (fallback)
        else {
          // For iOS, we need to handle the file:// protocol
          let imageUri = asset.uri;
          if (Platform.OS === 'ios' && !imageUri.startsWith('file://')) {
            imageUri = `file://${imageUri}`;
          }
          
          console.log('Reading file from filesystem');
          // Read the file as base64
          const fileContent = await RNFS.readFile(imageUri, 'base64');
          const arrayBuffer = decodeBase64(fileContent);
          
          // Upload to Supabase storage using the approach that works in other parts of the app
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('user-uploads')
            .upload(filePath, arrayBuffer, {
              contentType: asset.type || 'image/jpeg',
              cacheControl: '3600'
            });

          if (uploadError) throw uploadError;
        }

        // Get the public URL
        const { data: { publicUrl } } = supabase.storage
          .from('user-uploads')
          .getPublicUrl(filePath);

        console.log('Upload successful, public URL:', publicUrl);
        setProfileData(prev => ({ ...prev, dp_url: publicUrl }));
        setIsEdited(true);
      }
    } catch (error) {
      console.error('Error uploading image:', error.message || error);
      Alert.alert('Error', 'Failed to upload image: ' + (error.message || 'Unknown error'));
    } finally {
      setUploading(false);
    }
  };

  const handleUpdate = async () => {
    if (!uid) {
      console.error('No UID available to update user data');
      Alert.alert('Error', 'User ID not available');
      return;
    }
    
    try {
      console.log('Updating profile for UID:', uid, 'with data:', {
        name: profileData.name,
        age: parseInt(profileData.age),
        gender: profileData.gender,
        dp_url: profileData.dp_url,
      });
      
      const response = await fetch('https://main-matrixai-server-lujmidrakh.cn-hangzhou.fcapp.run/api/user/edituser', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uid,
          name: profileData.name,
          age: parseInt(profileData.age),
          gender: profileData.gender,
          dp_url: profileData.dp_url,
        }),
      });

      const result = await response.json();
      console.log('Edit user API response:', result);
      
      if (result.success) {
        // Trigger profile update to refresh headers
        console.log('Profile updated successfully, triggering update');
        triggerUpdate();
        
        Alert.alert('Success', t('profileUpdated'));
        fetchUserData();
        setIsEdited(false);
      } else {
        console.error('API returned error:', result.message || 'Unknown error');
        Alert.alert('Error', result.message || t('errorOccurred'));
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', t('errorOccurred'));
    }
  };

  const renderField = (label, value, field) => (
    <TouchableOpacity 
      style={[styles.fieldContainer, {backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border}]}
      onPress={() => {
        setEditingField(field);
        setTempValue(value?.toString() || '');
      }}
    >
      <View style={styles.fieldHeader}>
        <View style={styles.iconContainer}>
          <Ionicons name={field === 'name' ? 'person-outline' : field === 'age' ? 'calendar-outline' : 'transgender-outline'} size={20} color={colors.primary} />
        </View>
        <ThemedText style={[styles.fieldLabel, {color: colors.text}]}>{label}</ThemedText>
        <Ionicons name="chevron-forward" size={20} color={colors.text + '80'} />
      </View>
      {editingField === field ? (
        <TextInput
          style={[styles.input, {color: colors.text, borderBottomColor: colors.primary}]}
          value={tempValue}
          onChangeText={setTempValue}
          onBlur={() => {
            setProfileData(prev => ({ ...prev, [field]: tempValue }));
            setEditingField(null);
            setIsEdited(true);
          }}
          keyboardType={field === 'age' ? 'numeric' : 'default'}
          autoFocus
        />
      ) : (
        <ThemedText style={[styles.fieldValue, {color: colors.text}]}>{value || t('notSet')}</ThemedText>
      )}
    </TouchableOpacity>
  );

  // Render skeleton for a field value
  const renderSkeletonValue = () => (
    <View style={styles.skeletonValue}>
      <Animated.View
        style={[
          styles.shimmer,
          {
            transform: [{ translateX: shimmerTranslate }],
          },
        ]}
      >
        <LinearGradient
          colors={[
            'rgba(255, 255, 255, 0.1)',
            'rgba(255, 255, 255, 0.3)',
            'rgba(255, 255, 255, 0.1)',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.shimmerGradient}
        />
      </Animated.View>
    </View>
  )
  
  // Render field with skeleton loading for text
  const renderSkeletonField = (label, field, icon) => (
    <View 
      style={[styles.fieldContainer, {backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border}]}
    >
      <View style={styles.fieldHeader}>
        <View style={styles.iconContainer}>
          <Ionicons name={icon} size={20} color={colors.primary} />
        </View>
        <ThemedText style={[styles.fieldLabel, {color: colors.text}]}>{label}</ThemedText>
        <Ionicons name="chevron-forward" size={20} color={colors.text + '80'} />
      </View>
      <View style={{marginLeft: 35, marginTop: 5}}>
        {renderSkeletonValue()}
      </View>
    </View>
  );
  
  // Render the profile image with skeleton if loading
  const renderProfileImage = () => {
    if (loading) {
      return (
        <View style={styles.skeletonContainer}>
          <Animated.View
            style={[
              styles.shimmer,
              {
                transform: [{ translateX: shimmerTranslate }],
              },
            ]}
          >
            <LinearGradient
              colors={[
                'rgba(255, 255, 255, 0.1)',
                'rgba(255, 255, 255, 0.3)',
                'rgba(255, 255, 255, 0.1)',
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.shimmerGradient}
            />
          </Animated.View>
        </View>
      );
    }
    
    if (uploading) {
      return (
        <View style={styles.skeletonContainer}>
          <Animated.View
            style={[
              styles.shimmer,
              {
                transform: [{ translateX: shimmerTranslate }],
              },
            ]}
          >
            <LinearGradient
              colors={[
                'rgba(255, 255, 255, 0.1)',
                'rgba(255, 255, 255, 0.3)',
                'rgba(255, 255, 255, 0.1)',
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.shimmerGradient}
            />
          </Animated.View>
        </View>
      );
    }
    
    return (
      <Image
        source={
          profileData.dp_url
            ? { uri: profileData.dp_url }
            : require('../assets/avatar.png')
        }
        style={styles.profileImage}
      />
    );
  };

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
      <ThemedStatusBar />
      <View style={[styles.header, {backgroundColor: colors.background, borderBottomColor: colors.border}]}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back-ios-new" size={24} color="white" />
      </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, {color: colors.text}]}>{t('editProfile')}</ThemedText>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileImageContainer}>
          <View style={[styles.imageWrapper, {backgroundColor: colors.card}]}>
            {renderProfileImage()}
            <TouchableOpacity
              style={[styles.imageEditButton, {backgroundColor: colors.primary}]}
              onPress={handleImagePick}
              disabled={loading}
            >
              <Ionicons name="camera" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <ThemedCard style={[styles.card, {backgroundColor: colors.card, borderWidth: 0.8, borderColor: colors.border}]}>
          {loading ? (
            <>
              {renderSkeletonField(t('name'), 'name', 'person-outline')}
              {renderSkeletonField(t('age'), 'age', 'calendar-outline')}
              {renderSkeletonField(t('gender'), 'gender', 'transgender-outline')}
              <View style={[styles.fieldContainer, {backgroundColor: colors.card, borderBottomWidth: 0}]}>
                <View style={styles.fieldHeader}>
                  <View style={styles.iconContainer}>
                    <Ionicons name="mail-outline" size={20} color={colors.primary} />
                  </View>
                  <ThemedText style={[styles.fieldLabel, {color: colors.text}]}>{t('email')}</ThemedText>
                </View>
                <View style={{marginLeft: 35, marginTop: 5}}>
                  {renderSkeletonValue()}
                </View>
              </View>
            </>
          ) : (
            <>
              {renderField(t('name'), profileData.name, 'name')}
              {renderField(t('age'), profileData.age, 'age')}
              {renderField(t('gender'), profileData.gender, 'gender')}
              <TouchableOpacity style={[styles.fieldContainer, {backgroundColor: colors.card, borderBottomWidth: 0}]}>
                <View style={styles.fieldHeader}>
                  <View style={styles.iconContainer}>
                    <Ionicons name="mail-outline" size={20} color={colors.primary} />
                  </View>
                  <ThemedText style={[styles.fieldLabel, {color: colors.text}]}>{t('email')}</ThemedText>
                </View>
                <ThemedText style={[styles.fieldValue, {color: colors.text}]}>{profileData.email}</ThemedText>
              </TouchableOpacity>
            </>
          )}
        </ThemedCard>

        {isEdited && !loading && (
          <TouchableOpacity 
            style={[styles.updateButton, {backgroundColor: colors.primary}]} 
            onPress={handleUpdate}
          >
            <Text style={styles.updateButtonText}>{t('updateProfile')}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};




const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#007bff',
    marginRight:10,
  },
  headerIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 16,
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  profileImageContainer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  imageWrapper: {
    position: 'relative',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
  },
  skeletonContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    backgroundColor: 'rgba(200, 200, 200, 0.3)',
  },
  skeletonIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(200, 200, 200, 0.3)',
  },
  skeletonText: {
    width: '70%',
    height: 16,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(200, 200, 200, 0.3)',
  },
  skeletonValue: {
    width: '50%',
    height: 14,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(200, 200, 200, 0.3)',
  },
  shimmer: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  shimmerGradient: {
    width: '100%',
    height: '100%',
  },
  imageEditButton: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: '#007AFF',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fieldContainer: {
    flexDirection: 'column',
    paddingVertical: 15,
    width: '100%',
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    marginRight: 15,
  },
  fieldLabel: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
  },
  fieldValue: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
    marginLeft: 35,
  },
  input: {
    fontSize: 16,
    color: '#333',
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
    paddingVertical: 4,
  },
  updateButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  updateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default EditProfile;
