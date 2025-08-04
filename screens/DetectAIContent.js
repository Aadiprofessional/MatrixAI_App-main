import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Animated,
  Easing,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  SafeAreaView,
  FlatList,
  Image,
  Keyboard,
  Platform,
  StatusBar,
  PixelRatio,
  Alert,
  KeyboardAvoidingView
} from 'react-native';
import LottieView from 'lottie-react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { LinearGradient } from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Clipboard from '@react-native-clipboard/clipboard';
import { BlurView } from '@react-native-community/blur';
import axios from 'axios';
import { useAuthUser } from '../hooks/useAuthUser';

const { width, height } = Dimensions.get('window');
const scale = Math.min(width / 375, height / 812); // Base scale on iPhone X dimensions for consistency

// Function to normalize font size based on screen width
const normalize = (size) => {
  const newSize = size * scale;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

// Function to calculate responsive padding/margin
const responsiveSpacing = (size) => size * scale;

const DetectAIContent = ({ route }) => {
  const fromContentWriter = route?.params?.fromContentWriter || false;
  const { getThemeColors, currentTheme } = useTheme();
  const colors = getThemeColors();
  const { t } = useLanguage();
  const navigation = useNavigation();
  const { uid: userData } = useAuthUser();
  
  // State variables
  const [inputText, setInputText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  
  // Animated values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const historySlideAnim = useRef(new Animated.Value(width * 0.7)).current;
  const resultOpacity = useRef(new Animated.Value(0)).current;
  const meterAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  // History items
  const [historyItems, setHistoryItems] = useState([
    { 
      id: '1', 
      text: 'The artificial intelligence revolution has transformed how we approach problem-solving across industries.',
      aiProbability: 0.92,
      date: '3 hours ago' 
    },
    { 
      id: '2', 
      text: "Hey, I just wanted to let you know that I'll be running a bit late today. Traffic is terrible!",
      aiProbability: 0.12,
      date: '1 day ago' 
    },
  ]);

  // Add refs for ScrollView and input container
  const scrollViewRef = useRef(null);
  const inputContainerRef = useRef(null);
  
  // Add keyboard listener
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      (event) => {
        setKeyboardVisible(true);
        // When keyboard shows, scroll to ensure the entire input is visible
        if (inputContainerRef.current && scrollViewRef.current) {
          // Use timeout to ensure component measurements are complete
          setTimeout(() => {
            inputContainerRef.current.measureLayout(
              scrollViewRef.current,
              (x, y) => {
                // Get keyboard height
                const keyboardHeight = event.endCoordinates.height;
                // Calculate the position to scroll to ensure entire input is visible
                const inputHeight = 220; // Approximate height of input container
                const screenHeight = Dimensions.get('window').height;
                const inputBottomPosition = y + inputHeight;
                const visibleAreaHeight = screenHeight - keyboardHeight;
                
                // If input bottom would be covered by keyboard, scroll to make it fully visible
                if (inputBottomPosition > visibleAreaHeight) {
                  scrollViewRef.current.scrollTo({
                    y: y - 20, // Add padding at the top for better visibility
                    animated: true,
                  });
                }
              },
              () => console.log('Failed to measure')
            );
          }, 100);
        }
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidHideListener.remove();
      keyboardDidShowListener.remove();
    };
  }, []);

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
    
    // Continuous pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        })
      ])
    ).start();

    // Continuous rotation animation
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 12000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Continuous scan line animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        })
      ])
    ).start();
  }, []);

  const toggleHistory = () => {
    setHistoryOpen(!historyOpen);
    
    // Animate to 70% of the screen width
    Animated.timing(historySlideAnim, {
      toValue: historyOpen ? width * 0.7 : 0,
      duration: 300,
      easing: Easing.ease,
      useNativeDriver: true,
    }).start();
    
    // Close keyboard if it's open when toggling history
    if (keyboardVisible) {
      Keyboard.dismiss();
    }
  };
  
  const handleAnalyze = () => {
    if (inputText.trim() === '') return;
    
    setIsAnalyzing(true);
    
    // Create request payload with all settings 
    const requestPayload = { 
      uid: userData?.uid, // Use default UID if not available 
      text: inputText, 
      title: `Detection: ${inputText.substring(0, 30)}${inputText.length > 30 ? '...' : ''}`, 
      tags: ['mobile-app'], 
      language: 'en' 
    };

    // Make API request to the new detection API 
    axios.post(
      'https://main-matrixai-server-lujmidrakh.cn-hangzhou.fcapp.run/api/detection/createDetection',
      requestPayload, 
      { 
        headers: { 
          'Content-Type': 'application/json' 
        } 
      } 
    )
    .then(response => {
      // Set the detection result from API response 
      if (response.data && response.data.detection) { 
        const detection = response.data.detection; 
        setAnalysisResult({ 
          id: detection.id, 
          text: inputText,
          isAIGenerated: !detection.is_human, 
          aiProbability: detection.fake_percentage / 100, // Convert percentage to decimal 
          humanProbability: (100 - detection.fake_percentage) / 100,
          features: [
            { name: 'Repetitive patterns', score: detection.fake_percentage / 100 * 0.8 + Math.random() * 0.2 },
            { name: 'Natural language flow', score: (100 - detection.fake_percentage) / 100 * 0.8 + Math.random() * 0.2 },
            { name: 'Stylistic consistency', score: detection.fake_percentage / 100 * 0.7 + Math.random() * 0.3 },
            { name: 'Unique expressions', score: (100 - detection.fake_percentage) / 100 * 0.8 + Math.random() * 0.2 }
          ],
          analysis: `## AI Detection Results\n\n**Text Analysis:**\n\nThis text contains ${detection.ai_words} AI-generated words out of ${detection.text_words} total words (${detection.fake_percentage}% AI probability).\n\n**Sentence Breakdown:**\n\n${detection.sentences.map((sentence, index) => `${index + 1}. ${sentence}`).join('\n\n')}`, 
          summary: detection.is_human ? "This text appears to be human-written." : "This text appears to be AI-generated.", 
          fake_percentage: detection.fake_percentage, 
          ai_words: detection.ai_words, 
          text_words: detection.text_words, 
          sentences: detection.sentences, 
          tags: detection.tags, 
          language: detection.language, 
          createdAt: detection.createdAt, 
          other_feedback: detection.other_feedback 
        }); 
        
        // Add to history
        const newHistoryItem = {
          id: detection.id,
          text: inputText,
          aiProbability: detection.fake_percentage / 100,
          date: 'Just now'
        };
        
        setHistoryItems([newHistoryItem, ...historyItems]);
        
        // Animate result appearance
        Animated.parallel([
          Animated.timing(resultOpacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(meterAnim, {
            toValue: detection.fake_percentage / 100,
            duration: 1000,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          })
        ]).start();
        
        // Fetch updated history
        fetchUserDetections();
      } else {
        throw new Error('Invalid response format');
      }
    })
    .catch(error => {
      console.error('Error calling AI API:', error);
      // Use fallback if API call fails
      handleFallbackAnalysis();
    })
    .finally(() => {
      setIsAnalyzing(false);
    });
  };
  
  // Fallback function in case the API call fails
  const handleFallbackAnalysis = () => {
    // Generate a random score for demo purposes as fallback
    const aiProbability = Math.random();
    
    const result = {
      text: inputText,
      aiProbability,
      humanProbability: 1 - aiProbability,
      features: [
        { name: 'Repetitive patterns', score: Math.random() * 0.3 + (aiProbability > 0.5 ? 0.6 : 0.2) },
        { name: 'Natural language flow', score: Math.random() * 0.3 + (aiProbability < 0.5 ? 0.6 : 0.2) },
        { name: 'Stylistic consistency', score: Math.random() * 0.5 + 0.3 },
        { name: 'Unique expressions', score: Math.random() * 0.3 + (aiProbability < 0.5 ? 0.6 : 0.2) },
      ]
    };
    
    setAnalysisResult(result);
    
    // Add to history
    const newHistoryItem = {
      id: Date.now().toString(),
      text: inputText,
      aiProbability: result.aiProbability,
      date: 'Just now'
    };
    
    setHistoryItems([newHistoryItem, ...historyItems]);
    
    // Animate result appearance
    Animated.parallel([
      Animated.timing(resultOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(meterAnim, {
        toValue: result.aiProbability,
        duration: 1000,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      })
    ]).start();
    
    Alert.alert(t('notice'), t('usingFallbackAnalysis'));
  };
  
  const handleReset = () => {
    setInputText('');
    setAnalysisResult(null);
    meterAnim.setValue(0);
    resultOpacity.setValue(0);
  };
  
  // Fetch user's detection history
  const fetchUserDetections = async () => {
    if (!userData?.uid) return;
    
    try {
      const response = await axios.get(
        'https://main-matrixai-server-lujmidrakh.cn-hangzhou.fcapp.run/api/detection/getUserDetections',
        {
          params: {
            uid: userData.uid,
            page: 1,
            itemsPerPage: 10
          }
        }
      );
      
      if (response.data && response.data.detections) {
        setHistoryItems(response.data.detections);
      }
    } catch (error) {
      console.error('Error fetching detection history:', error);
    }
  };
  
  // Delete a detection from history
  const deleteDetection = async (detectionId) => {
    if (!userData?.uid) return;
    
    try {
      await axios.delete(
        'https://main-matrixai-server-lujmidrakh.cn-hangzhou.fcapp.run/api/detection/deleteDetection',
        {
          data: {
            uid: userData.uid,
            detectionId
          }
        }
      );
      
      // Remove from local state
      setHistoryItems(prev => prev.filter(item => item.id !== detectionId));
    } catch (error) {
      console.error('Error deleting detection:', error);
    }
  };
  
  // Fetch history on component mount
  useEffect(() => {
    if (userData?.uid) {
      fetchUserDetections();
    }
  }, [userData?.uid]);

  const renderFeatureItem = ({ item }) => (
    <View style={styles.featureItem}>
      <View style={[styles.featureHeader, width < 340 && { marginBottom: responsiveSpacing(8) }]}>
        <Text style={[styles.featureName, { color: colors.text }]}>
          {item.name}
        </Text>
        <Text style={[
          styles.featureIndicator, 
          { 
            color: item.name.includes('Natural') || item.name.includes('Unique') ? 
              (item.score > 0.5 ? '#4CAF50' : '#F44336') : 
              (item.score > 0.5 ? '#F44336' : '#4CAF50')
          }
        ]}>
          {item.name.includes('Natural') || item.name.includes('Unique') ? 
            (item.score > 0.5 ? 'Human' : 'AI') : 
            (item.score > 0.5 ? 'AI' : 'Human')}
        </Text>
      </View>
      <View style={styles.featureBarContainer}>
        <View style={[styles.featureBarBg, { backgroundColor: 'rgba(0, 0, 0, 0.1)' }]}>
          <View 
            style={[
              styles.featureBarFill, 
              { 
                width: `${item.score * 100}%`,
                backgroundColor: item.name.includes('Natural') || item.name.includes('Unique') ? 
                  '#4CAF50' : '#F44336'
              }
            ]} 
          />
        </View>
        <Text style={[styles.featureScore, { color: colors.textSecondary }]}>
          {Math.round(item.score * 100)}%
        </Text>
      </View>
    </View>
  );
  
  const renderHistoryItem = ({ item }) => {
    // For very small screens, we might need to truncate the text more
    const truncateLength = width < 320 ? 40 : width < 375 ? 50 : 60;
    
    return (
      <TouchableOpacity 
        style={[styles.historyItem, { 
          backgroundColor: currentTheme === 'dark' ? 'rgba(40, 40, 50, 0.6)' : 'rgba(255, 255, 255, 0.8)',
        }]}
        onPress={() => {
          setInputText(item.text);
          
          const result = {
            text: item.text,
            aiProbability: item.aiProbability,
            humanProbability: 1 - item.aiProbability,
            features: [
              { name: 'Repetitive patterns', score: Math.random() * 0.3 + (item.aiProbability > 0.5 ? 0.6 : 0.2) },
              { name: 'Natural language flow', score: Math.random() * 0.3 + (item.aiProbability < 0.5 ? 0.6 : 0.2) },
              { name: 'Stylistic consistency', score: Math.random() * 0.5 + 0.3 },
              { name: 'Unique expressions', score: Math.random() * 0.3 + (item.aiProbability < 0.5 ? 0.6 : 0.2) },
            ]
          };
          
          setAnalysisResult(result);
          toggleHistory();
          
          // Animate result appearance
          Animated.parallel([
            Animated.timing(resultOpacity, {
              toValue: 1,
              duration: 500,
              useNativeDriver: true,
            }),
            Animated.timing(meterAnim, {
              toValue: result.aiProbability,
              duration: 1000,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: false,
            })
          ]).start();
        }}
      >
        <View style={[styles.historyItemHeader, width < 340 && { flexDirection: 'column' }]}>
          <View style={[styles.historyItemTextContainer, width < 340 && { marginBottom: responsiveSpacing(8) }]}>
            <Text style={[styles.historyItemTitle, { color: colors.text }]} numberOfLines={2}>
              {item.text.length > truncateLength ? `${item.text.substring(0, truncateLength)}...` : item.text}
            </Text>
            <Text style={[styles.historyItemDate, { color: colors.text }]}>
              {item.date}
            </Text>
          </View>
          <View style={[
            styles.historyItemBadge, 
            { 
              backgroundColor: item.aiProbability > 0.7 ? '#F44336' : 
                            item.aiProbability > 0.4 ? '#FF9800' : '#4CAF50',
              opacity: 0.9,
              alignSelf: width < 340 ? 'flex-start' : 'center'
            }
          ]}>
            <Text style={styles.historyItemBadgeText}>
              {item.aiProbability > 0.7 ? 'AI' : 
              item.aiProbability > 0.4 ? 'Mixed' : 'Human'}
            </Text>
          </View>
        </View>
        <View style={styles.historyItemMeter}>
          <View style={styles.historyItemMeterBg}>
            <View 
              style={[
                styles.historyItemMeterFill, 
                { 
                  width: `${item.aiProbability * 100}%`,
                  backgroundColor: item.aiProbability > 0.7 ? '#F44336' : 
                                item.aiProbability > 0.4 ? '#FF9800' : '#4CAF50'
                }
              ]} 
            />
          </View>
          <Text style={[styles.historyItemScore, { color: colors.text }]}>
            {Math.round(item.aiProbability * 100)}% AI
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Create a rotation transform for icons
  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  // Adjust layout based on screen size
  const isSmallScreen = width < 360;
  const isMediumScreen = width >= 360 && width < 400;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={currentTheme === 'dark' ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
      

      
      {/* Main container */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: colors.background }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView 
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.contentWrapper}>
            {/* Welcome Banner with matching container */}
            <View style={styles.standardContainer}>
              <Animated.View style={[styles.welcomeBanner, { 
                opacity: fadeAnim,
                transform: [{ translateY: Animated.multiply(Animated.subtract(1, fadeAnim), 20) }]
              }]}>
                <LinearGradient
                  colors={currentTheme === 'dark' ? 
                    ['#1A237E', '#283593'] : 
                    ['#E8EAF6', '#C5CAE9']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.bannerGradient}
                >
                  {/* Decorative elements */}
                  <Animated.View 
                    style={[
                      styles.decorCircle1, 
                      { 
                        opacity: 0.1, 
                        transform: [{ rotate: spin }],
                        borderColor: colors.primary
                      }
                    ]}
                  />
                  <Animated.View 
                    style={[
                      styles.decorCircle2, 
                      { 
                        opacity: 0.15, 
                        transform: [{ rotate: spin }],
                        borderColor: currentTheme === 'dark' ? colors.secondary : colors.primary
                      }
                    ]}
                  />
                  
                  <View style={[styles.bannerContent, isSmallScreen && { flexDirection: 'column' }]}>
                    <View style={[styles.bannerTextContent, isSmallScreen && { paddingRight: 0, marginBottom: responsiveSpacing(16) }]}>
                      <Text style={[styles.bannerTitle, { color: colors.text }]}>
                        AI Text Detector
                      </Text>
                      <Text style={[styles.bannerSubtitle, { color: currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }]}>
                        Detect AI-generated content with advanced ML
                      </Text>
                      <View style={styles.featureList}>
                        <View style={styles.featureItemBanner}>
                          <Ionicons name="checkmark-circle" size={normalize(16)} color={currentTheme === 'dark' ? '#5C6BC0' : '#3F51B5'} />
                          <Text style={[styles.featureText, { color: currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }]}>
                            Fast and accurate detection
                          </Text>
                        </View>
                        <View style={styles.featureItemBanner}>
                          <Ionicons name="checkmark-circle" size={normalize(16)} color={currentTheme === 'dark' ? '#5C6BC0' : '#3F51B5'} />
                          <Text style={[styles.featureText, { color: currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }]}>
                            Detailed analytics
                          </Text>
                        </View>
                      </View>
                    </View>
                    
                    <Animated.View style={[styles.iconOuter, isSmallScreen && { alignSelf: 'center' }, { transform: [{ scale: pulseAnim }] }]}>
                      <View style={styles.iconContainer}>
                        <LinearGradient
                          colors={['#3F51B5', '#1A237E']}
                          style={styles.iconGradient}
                        >
                          <Animated.View style={{ transform: [{ rotate: spin }] }}>
                            <MaterialCommunityIcons name="shield-search" size={normalize(32)} color="#FFFFFF" />
                          </Animated.View>
                        </LinearGradient>
                        <Animated.View 
                          style={[
                            styles.iconRing, 
                            { 
                              transform: [{ rotate: spin }],
                              borderColor: currentTheme === 'dark' ? '#3F51B5' : '#3F51B5' 
                            }
                          ]}
                        />
                      </View>
                    </Animated.View>
                  </View>
                </LinearGradient>
              </Animated.View>
            </View>
            
            {/* Responsive Input Section */}
            <View 
              ref={inputContainerRef}
              style={styles.standardContainer}
            >
              <View style={styles.inputContainer}>
                <View style={styles.sectionHeaderContainer}>
                  <View style={styles.sectionTitleContainer}>
                    <MaterialCommunityIcons name="text-box-search-outline" size={normalize(20)} color={colors.primary} />
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Text Analysis</Text>
                  </View>
                  <TouchableOpacity 
                    style={[styles.historyButton, { backgroundColor: colors.card }]} 
                    onPress={toggleHistory}
                  >
                    <MaterialIcons name="history" size={20} color={colors.primary} />
                  </TouchableOpacity>
                </View>
                
                <View style={[styles.textInputContainer, { 
                  backgroundColor: currentTheme === 'dark' ? 'rgba(30, 30, 40, 0.6)' : 'rgba(255, 255, 255, 0.8)',
                  borderColor: colors.border,
                  shadowColor: colors.primary
                }]}>
                  <View style={styles.inputHeaderBar}>
                    <Text style={[styles.inputLabel, { color: '#3F51B5' }]}>
                      <MaterialCommunityIcons name="text-box-outline" size={normalize(14)} color={'#3F51B5'} /> Input Text
                    </Text>
                    <TouchableOpacity 
                      style={[styles.pasteButton, { minWidth: responsiveSpacing(70), minHeight: responsiveSpacing(30), justifyContent: 'center', alignItems: 'center' }]} 
                      onPress={async () => {
                        const clipboardText = await Clipboard.getString();
                        if (clipboardText) {
                          setInputText(clipboardText);
                        }
                      }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <MaterialCommunityIcons name="content-paste" size={normalize(14)} color={colors.primary} />
                      <Text style={[styles.pasteButtonText, { color: colors.primary }]}>Paste</Text>
                    </TouchableOpacity>
                  </View>
                  
                  <View style={[styles.textInputWrapper]}>
                    <TextInput
                      style={[styles.textInput, { 
                        color: colors.text, 
                        height: 160, // Fixed height for approximately 8 lines
                        paddingTop: 8,
                        textAlignVertical: 'top'
                      }]}
                      placeholder="Enter or paste text to analyze for AI detection..."
                      placeholderTextColor={'#A3A3A3FF'}
                      value={inputText}
                      onChangeText={setInputText}
                      multiline
                      numberOfLines={8} // Fixed number of lines
                      textAlignVertical="top"
                      editable={!isAnalyzing}
                      onFocus={() => {
                        // When input is focused, scroll to make the entire input visible
                        if (inputContainerRef.current && scrollViewRef.current) {
                          setTimeout(() => {
                            inputContainerRef.current.measureLayout(
                              scrollViewRef.current,
                              (x, y) => {
                                scrollViewRef.current.scrollTo({
                                  y: y - 20, // Add padding at the top for better visibility
                                  animated: true,
                                });
                              },
                              () => console.log('Failed to measure')
                            );
                          }, 100);
                        }
                      }}
                      onContentSizeChange={() => {
                        // When content changes size (like adding new lines), ensure input remains visible
                        if (keyboardVisible && inputContainerRef.current && scrollViewRef.current) {
                          inputContainerRef.current.measureLayout(
                            scrollViewRef.current,
                            (x, y) => {
                              scrollViewRef.current.scrollTo({
                                y: y - 20,
                                animated: true,
                              });
                            },
                            () => console.log('Failed to measure')
                          );
                        }
                      }}
                    />
                    
                    {/* Scan line animation */}
                    {inputText.length > 0 && !analysisResult && (
                      <Animated.View 
                        style={[
                          styles.scanLine,
                          {
                            backgroundColor: colors.primary,
                            opacity: 0.4,
                            transform: [
                              { 
                                translateY: scanLineAnim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0, 150 * scale]
                                })
                              }
                            ]
                          }
                        ]}
                      />
                    )}
                  </View>
                  
                  <View style={styles.textInputFooter}>
                    <Text style={[styles.characterCount, { color: '#3F51B5' }]}>
                      {inputText.length} characters
                    </Text>
                    {inputText.length > 1000 && (
                      <Text style={[styles.longTextNote, { color: '#3F51B5' }]}>
                        <Ionicons name="checkmark-circle" size={normalize(12)} color={'#3F51B5'} /> Sufficient length
                      </Text>
                    )}
                  </View>
                </View>
                
                {!analysisResult && (
                  <TouchableOpacity 
                    style={[styles.fixedAnalyzeButton, {
                      backgroundColor: isAnalyzing || inputText.trim() === '' ? '#9FA8DA' : '#3F51B5',
                      opacity: isAnalyzing || inputText.trim() === '' ? 0.7 : 1
                    }]}
                    onPress={handleAnalyze}
                    disabled={isAnalyzing || inputText.trim() === ''}
                  >
                    {isAnalyzing ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <View style={styles.fixedAnalyzeButtonContent}>
                        <Text style={styles.fixedAnalyzeButtonText}>Analyze Content</Text>
                        <MaterialCommunityIcons name="shield-search" size={normalize(20)} color="#FFFFFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>
            
            {/* Result Section with Improved Layout for Small Screens */}
            {analysisResult && (
              <View style={styles.standardContainer}>
                <Animated.View style={[styles.resultContainer, { opacity: resultOpacity }]}>
                  <View style={[styles.resultHeader, isSmallScreen && { flexDirection: 'column', alignItems: 'flex-start' }]}>
                    <View style={styles.sectionHeaderContainer}>
                      <MaterialCommunityIcons name="chart-bar" size={normalize(20)} color={colors.primary} />
                      <Text style={[styles.sectionTitle, { color: colors.text }]}>Analysis Results</Text>
                    </View>
                    <TouchableOpacity 
                      style={[styles.resetButton, isSmallScreen && { marginTop: responsiveSpacing(8) }]}
                      onPress={handleReset}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <MaterialIcons name="refresh" size={normalize(20)} color={colors.primary} />
                      <Text style={[styles.resetButtonText, { color: colors.primary }]}>
                        New Analysis
                      </Text>
                    </TouchableOpacity>
                  </View>
                  
                  {/* AI Probability Meter with Futuristic Design */}
                  <View style={[styles.meterContainer, { 
                    backgroundColor: currentTheme === 'dark' ? 'rgba(30, 30, 40, 0.6)' : 'rgba(255, 255, 255, 0.8)',
                    borderColor: colors.border
                  }]}>
                    <View style={styles.meterHeaderContainer}>
                      <Text style={[styles.meterTitle, { color: colors.text }]}>
                        AI Probability Analysis
                      </Text>
                      <View style={styles.resultBadge}>
                        <Text style={styles.resultBadgeText}>
                          {analysisResult.aiProbability > 0.8 ? 'AI Generated' : 
                          analysisResult.aiProbability > 0.5 ? 'Possibly AI' : 'Likely Human'}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.meterContent}>
                      <View style={styles.meter}>
                        <View style={[styles.meterBackground, { backgroundColor: 'rgba(0, 0, 0, 0.1)' }]}>
                          <Animated.View 
                            style={[
                              styles.meterFill, 
                              { 
                                width: meterAnim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: ['0%', '100%']
                                }),
                                backgroundColor: meterAnim.interpolate({
                                  inputRange: [0, 0.4, 0.7, 1],
                                  outputRange: ['#4CAF50', '#CDDC39', '#FF9800', '#F44336']
                                })
                              }
                            ]}
                          />
                        </View>
                        
                        <View style={styles.meterLabels}>
                          <View style={styles.meterLabelContainer}>
                            <Text style={[styles.meterLabelText, { color: '#4CAF50' }]}>Human</Text>
                            <Text style={[styles.meterLabelValue, { color: colors.text }]}>
                              {Math.round((1 - analysisResult.aiProbability) * 100)}%
                            </Text>
                          </View>
                          
                          <Animated.View style={[styles.meterValueContainer, { 
                            backgroundColor: meterAnim.interpolate({
                              inputRange: [0, 0.4, 0.7, 1],
                              outputRange: ['#4CAF50', '#CDDC39', '#FF9800', '#F44336']
                            })
                          }]}>
                            <Animated.Text style={styles.meterValue}>
                              {Math.round(analysisResult.aiProbability * 100)}%
                            </Animated.Text>
                          </Animated.View>
                          
                          <View style={styles.meterLabelContainer}>
                            <Text style={[styles.meterLabelText, { color: '#F44336' }]}>AI</Text>
                            <Text style={[styles.meterLabelValue, { color: colors.text }]}>
                              {Math.round(analysisResult.aiProbability * 100)}%
                            </Text>
                          </View>
                        </View>
                      </View>
                      
                      {/* AI Analysis Card */}
                      <View style={styles.analysisCard}>
                        <MaterialCommunityIcons 
                          name={analysisResult.aiProbability > 0.5 ? 'robot' : 'account'} 
                          size={24} 
                          color={analysisResult.aiProbability > 0.5 ? '#F44336' : '#4CAF50'} 
                          style={styles.analysisIcon}
                        />
                        <Text style={[styles.analysisText, { color: colors.text }]}>
                          {analysisResult.aiProbability > 0.8 ? 
                            'This text was very likely generated by AI. The analysis shows strong patterns of artificial generation.' :
                          analysisResult.aiProbability > 0.6 ?
                            'This text shows moderate signs of AI generation. Some patterns are consistent with AI writing.' :
                          analysisResult.aiProbability > 0.4 ?
                            'This text shows some characteristics of AI writing, but is inconclusive. Could be human-edited AI content.' :
                            'This text was likely written by a human. Few or no AI generation patterns detected.'}
                        </Text>
                      </View>
                    </View>
                  </View>
                  
                  {/* Feature Analysis with Enhanced Visual Design */}
                  <View style={[styles.featuresContainer, { 
                    backgroundColor: currentTheme === 'dark' ? 'rgba(30, 30, 40, 0.6)' : 'rgba(255, 255, 255, 0.8)',
                    borderColor: colors.border
                  }]}>
                    <View style={styles.sectionHeaderContainer}>
                      <MaterialCommunityIcons name="format-list-checks" size={20} color={colors.primary} />
                      <Text style={[styles.featuresTitle, { color: colors.text }]}>Key Indicators</Text>
                    </View>
                    
                    <FlatList
                      data={analysisResult.features}
                      renderItem={renderFeatureItem}
                      keyExtractor={(item) => item.name}
                      scrollEnabled={false}
                      contentContainerStyle={styles.featuresList}
                    />
                    
                    <View style={styles.disclaimerContainer}>
                      <MaterialCommunityIcons name="information-outline" size={16} color={colors.textSecondary} />
                      <Text style={[styles.disclaimerText, { color: colors.textSecondary }]}>
                        This analysis is based on machine learning algorithms and may not be 100% accurate.
                      </Text>
                    </View>
                  </View>
                </Animated.View>
              </View>
            )}
            
            {/* Processing Animation */}
            {isAnalyzing && (
              <View style={styles.processingContainer}>
                <LottieView 
                  source={require('../assets/image2.json')}
                  autoPlay
                  loop
                  style={styles.lottieAnimation}
                />
                <Text style={[styles.processingText, { color: colors.text }]}>
                  Analyzing text patterns...
                </Text>
                <Text style={[styles.processingSubtext, { color: colors.textSecondary }]}>
                  Using advanced machine learning to detect AI signatures
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      
      {/* Overlay for History Panel */}
      {historyOpen && (
        <TouchableOpacity 
          style={styles.overlay}
          activeOpacity={0.5}
          onPress={toggleHistory}
        />
      )}
      
      {/* History Panel */}
      <Animated.View 
        style={[styles.historyPanel, {
          backgroundColor: colors.background,
          transform: [{ translateX: historySlideAnim }],
          width: width * 0.7, // 70% of screen width
        }]}
      >
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.historyHeader}>
            <Text style={[styles.historyTitle, { color: colors.text }]}>
              History
            </Text>
            <TouchableOpacity onPress={toggleHistory}>
              <MaterialIcons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          
          {historyItems.length > 0 ? (
            <FlatList
              data={historyItems}
              renderItem={renderHistoryItem}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.historyList}
            />
          ) : (
            <View style={styles.emptyHistoryContainer}>
              <MaterialCommunityIcons 
                name="history" 
                size={48} 
                color={colors.textSecondary} 
              />
              <Text style={[styles.emptyHistoryText, { color: colors.textSecondary }]}>
                No history found
              </Text>
            </View>
          )}
        </SafeAreaView>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainContainer: {
    flex: 1,
    alignItems: 'center',
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: responsiveSpacing(16),
    paddingVertical: responsiveSpacing(16),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  backButton: {
    padding: responsiveSpacing(8),
  },
  headerTitle: {
    fontSize: normalize(18),
    fontWeight: '600',
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyButton: {
    padding: responsiveSpacing(8),
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingBottom: responsiveSpacing(40),
    alignItems: 'center',
  },
  contentWrapper: {
    width: '100%', 
    maxWidth: 600,
    paddingHorizontal: responsiveSpacing(16),
  },
  standardContainer: {
    width: '100%',
    marginTop: responsiveSpacing(16),
  },
  welcomeBanner: {
    width: '100%',
    borderRadius: responsiveSpacing(24),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  bannerGradient: {
    width: '100%',
    borderRadius: responsiveSpacing(24),
    position: 'relative',
    overflow: 'hidden',
  },
  decorCircle1: {
    position: 'absolute',
    top: -30 * scale,
    right: -30 * scale,
    width: 150 * scale,
    height: 120 * scale,
    borderRadius: 60 * scale,
    borderWidth: 10 * scale,
    borderStyle: 'dashed',
  },
  decorCircle2: {
    position: 'absolute',
    bottom: -40 * scale,
    left: -40 * scale,
    width: 100 * scale,
    height: 100 * scale,
    borderRadius: 50 * scale,
    borderWidth: 8 * scale,
    borderStyle: 'solid',
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    width: '100%',
    padding: responsiveSpacing(24),
  },
  bannerTextContent: {
    flex: 1,
    paddingRight: responsiveSpacing(16),
    minWidth: width * 0.5,
  },
  bannerTitle: {
    fontSize: normalize(26),
    fontWeight: 'bold',
    marginBottom: responsiveSpacing(8),
  },
  bannerSubtitle: {
    fontSize: normalize(14),
    lineHeight: normalize(20),
    marginBottom: responsiveSpacing(12),
  },
  featureList: {
    marginTop: responsiveSpacing(8),
  },
  featureItemBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsiveSpacing(6),
  },
  featureText: {
    fontSize: normalize(12),
    marginLeft: responsiveSpacing(6),
  },
  iconOuter: {
    width: 80 * scale,
    height: 80 * scale,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 64 * scale,
    height: 64 * scale,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  iconGradient: {
    width: 64 * scale,
    height: 64 * scale,
    borderRadius: 32 * scale,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3F51B5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  iconRing: {
    position: 'absolute',
    width: 80 * scale,
    height: 80 * scale,
    borderRadius: 40 * scale,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  sectionHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsiveSpacing(12),
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputContainer: {
    marginTop: responsiveSpacing(24),
    width: '100%',
  },
  sectionTitle: {
    fontSize: normalize(18),
    fontWeight: '600',
    marginLeft: responsiveSpacing(8),
  },
  textInputContainer: {
    width: '100%',
    borderRadius: responsiveSpacing(16),
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: responsiveSpacing(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  inputHeaderBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: responsiveSpacing(16),
    paddingVertical: responsiveSpacing(10),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  inputLabel: {
    fontSize: normalize(14),
    fontWeight: '500',
  },
  pasteButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pasteButtonText: {
    fontSize: normalize(14),
    fontWeight: '500',
    marginLeft: responsiveSpacing(4),
  },
  textInputWrapper: {
    padding: responsiveSpacing(12),
    minHeight: 160,
    maxHeight: 160, // Fixed height for the input
    position: 'relative',
  },
  textInput: {
    fontSize: normalize(16),
    flex: 1,
  },
  textInputFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: responsiveSpacing(16),
    paddingVertical: responsiveSpacing(8),
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  characterCount: {
    fontSize: normalize(12),
  },
  longTextNote: {
    fontSize: normalize(12),
    flexDirection: 'row',
    alignItems: 'center',
  },
  scanLine: {
    position: 'absolute',
    height: 2,
    left: 0,
    right: 0,
  },
  fixedAnalyzeButton: {
    width: '100%',
    height: 52,
    borderRadius: 12,
    marginTop: responsiveSpacing(12),
    marginBottom: responsiveSpacing(20),
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3F51B5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  fixedAnalyzeButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: responsiveSpacing(16),
  },
  fixedAnalyzeButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: normalize(16),
    marginRight: responsiveSpacing(10),
  },
  processingContainer: {
    alignItems: 'center',
    marginTop: responsiveSpacing(20),
    padding: responsiveSpacing(16),
  },
  lottieAnimation: {
    width: 200 * scale, 
    height: 100 * scale,
  },
  processingText: {
    fontSize: normalize(18),
    fontWeight: '600',
    marginTop: responsiveSpacing(8),
  },
  processingSubtext: {
    fontSize: normalize(14),
    marginTop: responsiveSpacing(4),
    textAlign: 'center',
  },
  resultContainer: {
    marginTop: responsiveSpacing(24),
    width: '100%',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: responsiveSpacing(16),
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    paddingHorizontal: responsiveSpacing(12),
    paddingVertical: responsiveSpacing(6),
    borderRadius: responsiveSpacing(16),
  },
  resetButtonText: {
    fontSize: normalize(14),
    fontWeight: '500',
    marginLeft: responsiveSpacing(4),
  },
  meterContainer: {
    borderRadius: responsiveSpacing(20),
    padding: responsiveSpacing(20),
    marginBottom: responsiveSpacing(20),
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    width: '100%',
  },
  meterHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsiveSpacing(20),
    flexWrap: 'wrap',
  },
  resultBadge: {
    paddingHorizontal: responsiveSpacing(12),
    paddingVertical: responsiveSpacing(4),
    borderRadius: responsiveSpacing(12),
    backgroundColor: '#3F51B5',
    marginTop: width < 360 ? responsiveSpacing(8) : 0,
  },
  resultBadgeText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: normalize(12),
  },
  meterTitle: {
    fontSize: normalize(18),
    fontWeight: '600',
    marginRight: responsiveSpacing(8),
  },
  meterContent: {
    
  },
  meter: {
    marginBottom: responsiveSpacing(24),
  },
  meterBackground: {
    height: 24 * scale,
    borderRadius: 12 * scale,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: responsiveSpacing(12),
  },
  meterFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    borderRadius: 12 * scale,
  },
  meterLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  meterLabelContainer: {
    alignItems: 'center',
  },
  meterLabelText: {
    fontSize: normalize(14),
    fontWeight: '600',
  },
  meterLabelValue: {
    fontSize: normalize(12),
    opacity: 0.7,
  },
  meterValueContainer: {
    paddingHorizontal: responsiveSpacing(12),
    paddingVertical: responsiveSpacing(6),
    borderRadius: responsiveSpacing(16),
  },
  meterValue: {
    fontSize: normalize(16),
    fontWeight: 'bold',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  analysisCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderRadius: responsiveSpacing(12),
    padding: responsiveSpacing(16),
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  analysisIcon: {
    marginRight: responsiveSpacing(12),
    marginTop: responsiveSpacing(2),
  },
  analysisText: {
    flex: 1,
    fontSize: normalize(14),
    lineHeight: normalize(20),
  },
  featuresContainer: {
    borderRadius: responsiveSpacing(20),
    padding: responsiveSpacing(20),
    marginBottom: responsiveSpacing(24),
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    width: '100%',
  },
  featuresTitle: {
    fontSize: normalize(18),
    fontWeight: '600',
    marginLeft: responsiveSpacing(8),
  },
  featuresList: {
    marginTop: responsiveSpacing(8),
  },
  featureItem: {
    marginBottom: responsiveSpacing(16),
  },
  featureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsiveSpacing(4),
    flexWrap: 'wrap',
  },
  featureName: {
    fontSize: normalize(14),
    fontWeight: '500',
    marginRight: responsiveSpacing(4),
    flex: 1,
  },
  featureIndicator: {
    fontSize: normalize(12),
    fontWeight: '600',
  },
  featureBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureBarBg: {
    height: 8 * scale,
    borderRadius: 4 * scale,
    flex: 1,
    marginRight: responsiveSpacing(8),
    overflow: 'hidden',
  },
  featureBarFill: {
    height: '100%',
    borderRadius: 4 * scale,
  },
  featureScore: {
    fontSize: normalize(12),
    width: 40 * scale,
    textAlign: 'right',
    fontWeight: '500',
  },
  disclaimerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: responsiveSpacing(12),
    paddingTop: responsiveSpacing(12),
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  disclaimerText: {
    fontSize: normalize(12),
    marginLeft: responsiveSpacing(6),
    flex: 1,
  },
  historyPanel: {
    position: 'absolute',
    top: 0,
    right: 0,
    height: '100%',
    zIndex: 10,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(0, 0, 0, 0.1)',
    shadowColor: '#000',
    shadowOffset: {
      width: -2,
      height: 0,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  historyTitle: {
    fontSize: normalize(18),
    fontWeight: '600',
    marginLeft: responsiveSpacing(8),
  },
  closeButton: {
    padding: responsiveSpacing(4),
    minWidth: responsiveSpacing(40),
    minHeight: responsiveSpacing(40),
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyList: {
    padding: responsiveSpacing(16),
  },
  historyItem: {
    borderRadius: responsiveSpacing(16),
    padding: responsiveSpacing(16),
    marginBottom: responsiveSpacing(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  historyItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: responsiveSpacing(12),
  },
  historyItemTextContainer: {
    flex: 1,
    marginRight: responsiveSpacing(12),
  },
  historyItemTitle: {
    fontSize: normalize(14),
    fontWeight: 'bold',
    marginBottom: responsiveSpacing(4),
  },
  historyItemDate: {
    fontSize: normalize(12),
  },
  historyItemBadge: {
    paddingHorizontal: responsiveSpacing(10),
    paddingVertical: responsiveSpacing(4),
    borderRadius: responsiveSpacing(12),
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: responsiveSpacing(60),
  },
  historyItemBadgeText: {
    color: '#FFFFFF',
    fontSize: normalize(12),
    fontWeight: '600',
  },
  historyItemMeter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyItemMeterBg: {
    height: 6 * scale,
    borderRadius: 3 * scale,
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    marginRight: responsiveSpacing(8),
    overflow: 'hidden',
  },
  historyItemMeterFill: {
    height: '100%',
    borderRadius: 3 * scale,
  },
  historyItemScore: {
    fontSize: normalize(12),
    width: 60 * scale,
    fontWeight: '500',
  },
  emptyHistoryContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: responsiveSpacing(60),
  },
  emptyHistoryText: {
    fontSize: normalize(16),
    marginTop: responsiveSpacing(12),
    fontWeight: '500',
  },
  emptyHistorySubtext: {
    fontSize: normalize(14),
    marginTop: responsiveSpacing(4),
    opacity: 0.7,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 9,
  },
  historyButton: {
    padding: responsiveSpacing(8),
    borderRadius: responsiveSpacing(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
});

export default DetectAIContent;
