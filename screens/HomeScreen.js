import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  Image,
  StatusBar,
  ImageBackground,
  Animated,
  FlatList,
  Easing,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useProStatus } from '../hooks/useProStatus';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { LinearGradient } from 'react-native-linear-gradient';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import Header from '../components/Header';
import ThemedView, { ThemedText, ThemedCard } from '../components/ThemedView';
import FloatingButton from '../components/FloatingButton';
import FeatureCardWithDetails2 from '../components/FeatureCardWithDetails copy';
import FeatureCardWithDetailsPro from '../components/FeatureCardWithDetailsPro';
import FeatureCardWithDetailsAddon from '../components/FeatureCardWithDetailsAddon';
import { useCoinsSubscription } from '../hooks/useCoinsSubscription';

const { width, height } = Dimensions.get('window');

const HomeScreen = () => {
  const navigation = useNavigation();
  const { uid } = useAuth();
  const { isPro: isUserPro } = useProStatus();
  const { getThemeColors, currentTheme } = useTheme();
  const colors = getThemeColors();
  const { t } = useLanguage();
  const [sidePanelVisible, setSidePanelVisible] = useState(false);
  const coinCount = useCoinsSubscription(uid);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const heroTextOpacity = useRef(new Animated.Value(0)).current;
  const heroTextTranslateY = useRef(new Animated.Value(20)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  // Create a rotation transform for the hero icon
  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  useEffect(() => {
    // Animated sequence for main elements
    Animated.stagger(120, [
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        })
      ]),
      // Hero text fade in and slide up
      Animated.parallel([
        Animated.timing(heroTextOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(heroTextTranslateY, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        })
      ])
    ]).start();

    // Continuous pulse animation for icon highlights
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        })
      ])
    ).start();

    // Continuous rotation animation
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 18000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const toggleSidePanel = () => {
    setSidePanelVisible(!sidePanelVisible);
  };

  // Tools data for the grid
  const tools = [
    {
      id: 'video',
      title: t('videoGenerator'),
      description: t('processAndAnalyzeVideos'),
      icon: <MaterialCommunityIcons name="video-outline" size={26} color="#FFFFFF" />,
      colors: ['#0091EA', '#0D47A1'],
      screen: 'VideoUpload'
    },
    {
      id: 'image',
      title: t('imageAI'),
      description: t('generateImages'),
      icon: <MaterialCommunityIcons name="image-edit-outline" size={26} color="#FFFFFF" />,
      colors: ['#2962FF', '#2979FF'],
      screen: 'ImageTextScreen'
    },
   
    {
      id: 'speech',
      title: t('speechToText'),
      description: t('convertSpeechToText'),
      icon: <MaterialCommunityIcons name="microphone" size={26} color="#FFFFFF" />,
      colors: ['#FF6D00', '#F57C00'],
      screen: 'SpeechToTextScreen'
    },
    // {
    //   id: 'background',
    //   title: t('humaniseText'),
    //   description: t('humanLikeTransformations'),
    //   icon: <MaterialCommunityIcons name="human-greeting" size={26} color="#FFFFFF" />,
    //   colors: ['#D500F9', '#9C27B0'],
    //   screen: 'HumaniseText'
    // },
    // {
    //   id: 'detect',
    //   title: t('detectAI'),
    //   description: t('identifyAIGeneratedContent'),
    //   icon: <MaterialCommunityIcons name="magnify-scan" size={26} color="#FFFFFF" />,
    //   colors: ['#43A047', '#2E7D32'],
    //   screen: 'DetectAIScreen'
    // },
    {
      id: 'content',
      title: t('contentWriter'),
      description: t('aiPoweredWritingAssistant'),
      icon: <MaterialCommunityIcons name="text-box-outline" size={26} color="#FFFFFF" />,
      colors: ['#D500F9', '#9C27B0'],
      screen: 'ContentWriterScreen'
    },
  ];

  const renderTool = ({ item, index }) => {
    return (
      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [
            { scale: scaleAnim },
            { translateY: Animated.multiply(Animated.subtract(1, fadeAnim), 20) }
          ],
        }}
      >
        <TouchableOpacity 
          style={styles.toolCard}
          onPress={() => navigation.navigate(item.screen)}
          activeOpacity={0.8}
        >
          <LinearGradient 
            colors={item.colors} 
            style={styles.toolCardGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.toolCardContent}>
              <View style={styles.toolIconWrapper}>
                <Animated.View style={[styles.iconGlow, { transform: [{ scale: pulseAnim }] }]} />
                <View style={styles.toolIconContainer}>
                  {item.icon}
                </View>
              </View>
              <View style={styles.toolTextContainer}>
                <Text style={styles.toolTitle}>{item.title}</Text>
                <Text style={styles.toolDescription}>{item.description}</Text>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // Get background colors based on theme
  const getBgColor = () => {
    return currentTheme === 'dark' ? colors.background : '#F9FAFF';
  };

  const getHeaderBgColors = () => {
    return currentTheme === 'dark' 
      ? ['rgba(28, 28, 30, 0.95)', 'rgba(28, 28, 30, 0.85)']
      : ['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0.85)'];
  };

  const getHeroBgColors = () => {
    return currentTheme === 'dark' 
      ? ['#252538', '#1C1C2E'] 
      : ['#E5EAFF', '#F0F4FF'];
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: getBgColor() }]}>
      <StatusBar barStyle={currentTheme === 'dark' ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
      
      {/* Fixed header with blur effect */}
      <View style={[styles.fixedHeader, {backgroundColor: 'transparent'}]}>
        <Header navigation={navigation} uid={uid} openDrawer={toggleSidePanel}/>
        
        {/* Add subtle border to the header for better visibility */}
       
      </View>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero Banner with professional design */}
        <View style={styles.heroSection}>
          <TouchableOpacity 
            activeOpacity={0.9}
            onPress={() => navigation.navigate('Stories')}
          >
            <LinearGradient
              colors={getHeroBgColors()}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroBg}
            >
              {/* Decorative elements */}
              <Animated.View 
                style={[
                  styles.heroCircle1, 
                  { 
                    opacity: 0.1, 
                    transform: [{ rotate: spin }],
                    borderColor: colors.primary
                  }
                ]}
              />
              <Animated.View 
                style={[
                  styles.heroCircle2, 
                  { 
                    opacity: 0.15, 
                    transform: [{ rotate: spin }],
                    borderColor: currentTheme === 'dark' ? colors.secondary : colors.primary
                  }
                ]}
              />
              
              {/* Hero Content */}
              <View style={styles.heroContentContainer}>
                <View style={styles.heroTextContainer}>
                  <Animated.Text 
                    style={[
                      styles.heroTitle,
                      { 
                        color: colors.text,
                        opacity: heroTextOpacity,
                        transform: [{ translateY: heroTextTranslateY }]
                      }
                    ]}
                  >
                    MatrixAI
                  </Animated.Text>
                  
                  <Animated.Text 
                    style={[
                      styles.heroSubtitle,
                      { 
                        color: currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(60, 60, 67, 0.7)',
                        opacity: heroTextOpacity,
                        transform: [{ translateY: heroTextTranslateY }]
                      }
                    ]}
                  >
                    {t('futureOfAI')}
                  </Animated.Text>
                </View>
                
                <Animated.View 
                  style={[
                    styles.heroImageContainer,
                    {
                      opacity: heroTextOpacity,
                      transform: [{ translateY: heroTextTranslateY }]
                    }
                  ]}
                >
                  <View style={styles.heroLogoContainer}>
                    <LinearGradient
                      colors={currentTheme === 'dark' ? [colors.primary, colors.secondary] : [colors.primary, '#4A00E0']}
                      style={styles.heroLogoBg}
                    >
                      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                        <FontAwesome5 name="robot" size={42} color="#FFFFFF" />
                      </Animated.View>
                    </LinearGradient>
                    <Animated.View 
                      style={[
                        styles.heroLogoRing, 
                        { 
                          transform: [{ rotate: spin }],
                          borderColor: currentTheme === 'dark' ? `rgba(${parseInt(colors.primary.slice(1, 3), 16)}, ${parseInt(colors.primary.slice(3, 5), 16)}, ${parseInt(colors.primary.slice(5, 7), 16)}, 0.3)` : 'rgba(74, 0, 224, 0.3)'
                        }
                      ]}
                    />
                  </View>
                </Animated.View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Tools Section with improved layout */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <LinearGradient
                colors={currentTheme === 'dark' ? [colors.primary, colors.secondary] : [colors.primary, '#4A00E0']}
                style={styles.titleIconContainer}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <MaterialCommunityIcons name="tools" size={18} color="#FFFFFF" />
              </LinearGradient>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t('aiTools')}
              </Text>
            </View>
          
          </View>
          
          <FlatList
            data={tools}
            renderItem={renderTool}
            keyExtractor={item => item.id}
            numColumns={2}
            scrollEnabled={false}
            contentContainerStyle={styles.toolsGrid}
            columnWrapperStyle={styles.toolsRow}
          />
        </View>
        
        {/* Pro Features Section */}
        <View style={styles.featuresContainer}>
          <View style={styles.sectionTitleContainer}>
            <LinearGradient
              colors={['#FF6D00', '#F57C00']}
              style={styles.titleIconContainer}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <MaterialCommunityIcons name="star" size={18} color="#FFFFFF" />
            </LinearGradient>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {isUserPro ? t('proFeatures') : t('upgradeToPro')}
            </Text>
          </View>
          
          {!isUserPro ? (
                    <FeatureCardWithDetails2 />
                ) : (
                    <>
                        <FeatureCardWithDetailsPro />
                        {(coinCount < 200) && <FeatureCardWithDetailsAddon />}
                    </>
                )}
          <ThemedView style={styles.endTextContainer}>
            <ThemedText style={styles.crossBee}>MatrixAI❤️</ThemedText>
            <ThemedText style={styles.AppYard3}>{t('worldsBestAITools')}</ThemedText>
            <ThemedText style={styles.AppYard4}>{t('allRightsReserved')}</ThemedText>
          </ThemedView>
        </View>
      </ScrollView>
      
      {/* Floating Button */}
      <FloatingButton />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  fixedHeader: {
    paddingTop: 5,
    paddingHorizontal: 10,
    marginBottom: 10,
    
    
  },
  headerGradient: {
    paddingTop: 45,
    paddingHorizontal: 10,
    
  },
  headerBorder: {
    height: 1,
    width: '100%',
    borderBottomWidth: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 30,
    paddingBottom: 80,
  },
  // Hero Section
  heroSection: {
    marginHorizontal: 16,
    marginVertical: -16,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  heroBg: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
  },
  heroContentContainer: {
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 140, // Reduced height
  },
  heroTextContainer: {
    flex: 1,
    paddingRight: 16,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  heroCircle1: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 15,
    borderStyle: 'dashed',
  },
  heroCircle2: {
    position: 'absolute',
    bottom: -40,
    left: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 10,
  },
  heroImageContainer: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  heroLogoContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroLogoBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4A00E0',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  heroLogoRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  
  // Section Styling
  sectionContainer: {
    marginHorizontal: 16,
    marginTop: 32,
  },
  endTextContainer: {
    flexDirection: 'column',
    justifyContent: 'center',
    marginTop: 10,
  },
  crossBee: {
    fontSize: 28,
    color: '#95959527',
    fontWeight: 'bold',
  },
  AppYard3: { 
    fontSize: 20,
    color: '#95959527',
    fontWeight: 'bold',
  },
  AppYard4: { 
    fontSize: 12,
    color: '#9595957D',
    fontWeight: 'bold',
    marginTop: 20,
    alignSelf: 'center',
  },
  
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  viewAllButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Tools Grid
  toolsGrid: {
    paddingVertical: 8,
  },
  toolsRow: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  toolCard: {
    width: (width - 40) / 2,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    marginBottom: 16,
  },
  toolCardGradient: {
    borderRadius: 16,
  },
  toolCardContent: {
    padding: 16,
    height: 160,
  },
  toolIconWrapper: {
    marginBottom: 12,
    position: 'relative',
  },
  iconGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
  },
  toolIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  toolTextContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingBottom: 8,
  },
  toolTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  toolDescription: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 16,
  },
  // Features section
  featuresContainer: {
    marginTop: 32,
    paddingHorizontal: 16,
  },
  // Footer section
  footerContainer: {
    marginTop: 40,
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  footerGradient: {
    borderRadius: 20,
    padding: 24,
  },
  footerContent: {
    alignItems: 'center',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  logoGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  logoText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  footerBrandName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  footerTagline: {
    fontSize: 14,
    marginBottom: 6,
    textAlign: 'center',
  },
  footerCopyright: {
    fontSize: 12,
    opacity: 0.7,
    textAlign: 'center',
  },
});

export default HomeScreen; 