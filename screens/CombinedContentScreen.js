import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  ScrollView,
  Dimensions,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  PixelRatio,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

// Import the component versions of the screens
import DetectAIContent from './DetectAIContent';
import HumaniseTextContent from './HumaniseTextContent';
import ContentWriterContent from './ContentWriterContent';

const { width, height } = Dimensions.get('window');
const scale = Math.min(width / 375, height / 812); // Base scale on iPhone X dimensions for consistency

// Function to normalize font size based on screen width
const normalize = (size) => {
  const newSize = size * scale;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

// Function to calculate responsive padding/margin
const responsiveSpacing = (size) => size * scale;

const CombinedContentScreen = ({ route }) => {
  const { getThemeColors, currentTheme } = useTheme();
  const colors = getThemeColors();
  const { t } = useLanguage();
  const navigation = useNavigation();
  
  // Get activeTab from route params if available, default to 'content'
  const [activeTab, setActiveTab] = useState(route?.params?.activeTab || 'content');
  
  // Animated values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  
  // Update activeTab when route params change
  useEffect(() => {
    if (route?.params?.activeTab) {
      setActiveTab(route.params.activeTab);
    }
  }, [route?.params?.activeTab]);
  
  useEffect(() => {
    // Initial animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);
  
  // Adjust layout based on screen size
  const isSmallScreen = width < 360;
  const isMediumScreen = width >= 360 && width < 400;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <Animated.View style={[styles.header, { 
        transform: [{ scale: scaleAnim }], 
        backgroundColor: colors.background2
      }]}>
         <TouchableOpacity 
          style={[styles.backButton, { backgroundColor: '#4285F4' }]} 
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('contentWriter')}</Text>
        <View style={styles.headerRightPlaceholder} />
      </Animated.View>
      
      {/* Main Content */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: colors.background }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.contentWrapper}>
            {/* Tab Buttons */}
            <View style={styles.standardContainer}>
              <Animated.View style={[styles.tabButtonsContainer, { 
                opacity: fadeAnim,
                transform: [{ translateY: Animated.multiply(Animated.subtract(1, fadeAnim), 20) }],
                backgroundColor: colors.card
              }]}>
                <TouchableOpacity 
                  style={styles.tabButtonWrapper}
                  onPress={() => setActiveTab('content')}
                >
                  <View 
                    style={[styles.tabButton, styles.buttonShadow, { backgroundColor: activeTab === 'content' ? '#4F75E2' : colors.card }]} >
                    <MaterialCommunityIcons 
                      name="text-box-outline" 
                      size={22} 
                      color={activeTab === 'content' ? '#FFFFFF' : colors.text} 
                    />
                    <Text style={[styles.tabButtonText, { color: activeTab === 'content' ? '#FFFFFF' : colors.text }]} numberOfLines={1} ellipsizeMode="tail">
                      {t('contentWriter')}
                    </Text>
                  </View>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.tabButtonWrapper}
                  onPress={() => setActiveTab('detector')}
                >
                  <View 
                    style={[styles.tabButton, styles.buttonShadow, { backgroundColor: activeTab === 'detector' ? '#FF5252' : colors.card }]} >
                    <MaterialCommunityIcons 
                      name="magnify" 
                      size={22} 
                      color={activeTab === 'detector' ? '#FFFFFF' : colors.text} 
                    />
                    <Text style={[styles.tabButtonText, { color: activeTab === 'detector' ? '#FFFFFF' : colors.text }]} numberOfLines={1} ellipsizeMode="tail">
                      {t('aiDetector')}
                    </Text>
                  </View>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.tabButtonWrapper}
                  onPress={() => setActiveTab('humanizer')}
                >
                  <View style={[styles.tabButton, styles.buttonShadow, { backgroundColor: activeTab === 'humanizer' ? '#4CAF50' : colors.card }]}>
                    <MaterialCommunityIcons 
                      name="human" 
                      size={22} 
                      color={activeTab === 'humanizer' ? '#FFFFFF' : colors.text} 
                    />
                    <Text style={[styles.tabButtonText, { color: activeTab === 'humanizer' ? '#FFFFFF' : colors.text }]} numberOfLines={1} ellipsizeMode="tail">
                      {t('humanizer')}
                    </Text>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            </View>
            
            {/* Main Content Area - Conditionally render based on activeTab */}
            {activeTab === 'content' && (
              <ContentWriterContent />
            )}
            
            {/* AI Detector Tab */}
            {activeTab === 'detector' && (
              <DetectAIContent />
            )}
            
            {/* Humanizer Tab */}
            {activeTab === 'humanizer' && (
              <HumaniseTextContent />
            )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: responsiveSpacing(16),
    paddingVertical: responsiveSpacing(12),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  backButton: {
    padding: responsiveSpacing(8),
    borderRadius: 50,
    width: responsiveSpacing(40),
    height: responsiveSpacing(40),
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  headerTitle: {
    fontSize: normalize(18),
    fontWeight: '700',
  },
  headerRightPlaceholder: {
    width: 40,
  },
  contentWrapper: {
    flex: 1,
    paddingBottom: responsiveSpacing(40),
  },
  standardContainer: {
    paddingHorizontal: responsiveSpacing(16),
    paddingTop: responsiveSpacing(16),
  },
  tabButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: responsiveSpacing(16),
    borderRadius: 30,
    padding: responsiveSpacing(4),
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  tabButtonWrapper: {
    flex: 1,
    marginHorizontal: 3,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsiveSpacing(10),
    paddingHorizontal: responsiveSpacing(5),
    borderRadius: 25,
    height: responsiveSpacing(44),
  },
  buttonShadow: {
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.27,
    shadowRadius: 4.65,
  },
  tabButtonText: {
    fontSize: normalize(11),
    fontWeight: '600',
    marginLeft: responsiveSpacing(3),
    flexShrink: 1,
    textAlign: 'center',
    maxWidth: '70%',
  },
});

export default CombinedContentScreen;