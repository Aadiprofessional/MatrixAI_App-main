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
  Alert,
  Keyboard,
  StatusBar,
  Platform,
  PixelRatio,
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
import Share from 'react-native-share';
import axios from 'axios';

const { width, height } = Dimensions.get('window');
const scale = Math.min(width / 375, height / 812); // Base scale on iPhone X dimensions for consistency

// Function to normalize font size based on screen width
const normalize = (size) => {
  const newSize = size * scale;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

// Function to calculate responsive padding/margin
const responsiveSpacing = (size) => size * scale;

const ContentWriterScreen = () => {
  const { getThemeColors, currentTheme } = useTheme();
  const colors = getThemeColors();
  const { t } = useLanguage();
  const navigation = useNavigation();
  
  // State variables
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const [contentType, setContentType] = useState('article');
  const [isCopied, setIsCopied] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  
  // Animated values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const historySlideAnim = useRef(new Animated.Value(width * 0.7)).current;
  const resultOpacity = useRef(new Animated.Value(0)).current;
  const resultTranslateY = useRef(new Animated.Value(20)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  // Content types
  const contentTypes = [
    { id: 'article', name: t('article'), icon: 'newspaper' },
    { id: 'email', name: t('email'), icon: 'email-outline' },
    { id: 'blog', name: t('blogPost'), icon: 'post-outline' },
    { id: 'social', name: t('socialMedia'), icon: 'twitter' },
    { id: 'marketing', name: t('marketing'), icon: 'bullhorn-outline' },
  ];

  // History items
  const [historyItems, setHistoryItems] = useState([
    { 
      id: '1', 
      prompt: 'Write about the benefits of AI in healthcare',
      content: 'Artificial Intelligence is revolutionizing healthcare by enabling faster diagnostics, personalized treatment plans, and more efficient patient care...',
      type: 'article',
      date: '2 hours ago' 
    },
    { 
      id: '2', 
      prompt: 'Create an email to reschedule a business meeting',
      content: 'Dear [Name], I hope this email finds you well. I am writing to request a rescheduling of our meeting originally planned for...',
      type: 'email',
      date: '1 day ago' 
    },
  ]);

  // Add a ref for the ScrollView
  const scrollViewRef = useRef(null);
  // Add a ref for the input container
  const promptInputRef = useRef(null);

  // Add keyboard listener
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      (event) => {
        setKeyboardVisible(true);
        // When keyboard shows, scroll to ensure the entire input is visible
        if (promptInputRef.current && scrollViewRef.current) {
          // Use timeout to ensure component measurements are complete
          setTimeout(() => {
            promptInputRef.current.measureLayout(
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
  
  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });
  
  const handleGenerate = () => {
    if (prompt.trim() === '') {
      Alert.alert(t('error'), t('pleaseEnterPrompt'));
      return;
    }
    
    setIsGenerating(true);
    
    // Create a detailed prompt for content generation based on the selected type
    let contentPrompt;
    
    switch(contentType) {
      case 'article':
        contentPrompt = `Write a professional article about "${prompt}". Include headings, subheadings, and bullet points where appropriate. The article should be well-structured, informative, and engaging.`;
        break;
      case 'email':
        contentPrompt = `Write a professional email about "${prompt}". Include a subject line, greeting, body, and closing. The email should be clear, concise, and professional.`;
        break;
      case 'blog':
        contentPrompt = `Write an engaging blog post about "${prompt}". Include a catchy title, introduction, main points with headings, and a conclusion. Make it conversational and include a call to action at the end.`;
        break;
      case 'social':
        contentPrompt = `Create a social media post about "${prompt}". Keep it concise, engaging, and include relevant hashtags. Make it engaging and shareable, with clear key points.`;
        break;
      case 'marketing':
        contentPrompt = `Create marketing copy for "${prompt}". Include a compelling headline, key benefits, features, testimonials, and a strong call to action. Make it persuasive and focused on value.`;
        break;
      default:
        contentPrompt = `Write content about "${prompt}".`;
    }
    
    // Make API call to matrix-server
    axios.post('https://ddtgdhehxhgarkonvpfq.supabase.co/functions/v1/createContent', {
      prompt: contentPrompt
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    })
    .then(response => {
      // Extract the response
      const result = response.data.output.text.trim();
      
      setGeneratedContent(result);
      
      // Add to history
      const newHistoryItem = {
        id: Date.now().toString(),
        prompt: prompt,
        content: result,
        type: contentType,
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
        Animated.timing(resultTranslateY, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        })
      ]).start();
    })
    .catch(error => {
      console.error('Error generating content:', error);
      Alert.alert(t('error'), t('failedToGenerateContent'));
      
      // Fallback to template content if API fails
      handleFallbackGeneration();
    })
    .finally(() => {
      setIsGenerating(false);
    });
  };
  
  // Fallback function for content generation if API fails
  const handleFallbackGeneration = () => {
    // Generate content based on type
    let result = '';
    
    switch(contentType) {
      case 'article':
        result = `# ${prompt}\n\nIn recent years, the topic of ${prompt.toLowerCase()} has gained significant attention across various sectors. This article explores the key aspects and implications of this important subject.\n\n## Background\n\nThe concept of ${prompt.toLowerCase()} first emerged in the early 2000s when researchers began exploring its potential applications. Since then, it has evolved considerably, incorporating new methodologies and approaches.\n\n## Key Benefits\n\n- Improved efficiency and productivity\n- Enhanced decision-making capabilities\n- Greater accessibility and inclusivity\n- Reduced operational costs\n\n## Future Outlook\n\nAs we look ahead, ${prompt.toLowerCase()} is likely to continue its trajectory of innovation and development. Experts predict that we will see even more sophisticated implementations in the coming years.`;
        break;
      case 'email':
        result = `Subject: Regarding ${prompt}\n\nDear [Recipient],\n\nI hope this email finds you well. I am writing to discuss ${prompt.toLowerCase()} and its potential impact on our ongoing projects.\n\nRecently, our team has been exploring various approaches to address the challenges related to this matter. We believe that a collaborative strategy would yield the most favorable outcomes.\n\nWould you be available for a brief meeting next week to discuss this further? Your insights would be invaluable to our planning process.\n\nThank you for your consideration, and I look forward to your response.\n\nBest regards,\n[Your Name]`;
        break;
      case 'blog':
        result = `# ${prompt}: A Comprehensive Guide\n\n![Featured Image](https://example.com/image.jpg)\n\n## Introduction\n\nWelcome to our comprehensive guide on ${prompt.toLowerCase()}! In this blog post, we'll explore everything you need to know about this fascinating topic, from its fundamentals to advanced applications.\n\n## Why This Matters\n\nIn today's rapidly evolving landscape, understanding ${prompt.toLowerCase()} is more important than ever. It affects how we approach problems, make decisions, and plan for the future.\n\n## Getting Started\n\nIf you're new to ${prompt.toLowerCase()}, here are some basic concepts to help you get started:\n\n1. Understand the core principles\n2. Familiarize yourself with key terminology\n3. Explore practical applications\n4. Connect with the community\n\n## Conclusion\n\nAs we've seen, ${prompt.toLowerCase()} offers tremendous potential for innovation and growth. By staying informed and engaged, you can leverage its benefits for your personal and professional development.\n\n## Share Your Thoughts\n\nHave you had experience with ${prompt.toLowerCase()}? Share your thoughts and questions in the comments section below!`;
        break;
      case 'social':
        result = `📣 Just published a new piece on ${prompt}! \n\nKey takeaways:\n• Understanding the fundamentals is crucial\n• Implementation can lead to 30% better outcomes\n• Start small and scale gradually\n\nCheck out the full post here: [link] #${prompt.replace(/\s+/g, '')} #Innovation`;
        break;
      case 'marketing':
        result = `# ${prompt} - Transform Your Approach Today\n\n## Are you struggling with conventional methods?\n\nIntroducing our revolutionary approach to ${prompt.toLowerCase()} - designed to help you achieve unprecedented results with minimal effort.\n\n## Key Features:\n\n✅ Streamlined implementation process\n✅ Customizable to your specific needs\n✅ Comprehensive analytics and reporting\n✅ Expert support team available 24/7\n\n## Limited Time Offer\n\nSign up today and receive a 20% discount on our premium package! Use code: ${prompt.replace(/\s+/g, '').toUpperCase()}20\n\n## Testimonials\n\n"Implementing this solution transformed our business completely!" - John D., CEO\n\n"The results exceeded our expectations by 200%" - Sarah L., Marketing Director\n\n## Contact Us\n\nReady to transform your approach to ${prompt.toLowerCase()}? Contact our team at info@example.com or call (555) 123-4567`;
        break;
      default:
        result = `Content about ${prompt}`;
    }
    
    setGeneratedContent(result);
    
    // Add to history
    const newHistoryItem = {
      id: Date.now().toString(),
      prompt: prompt,
      content: result,
      type: contentType,
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
      Animated.timing(resultTranslateY, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      })
    ]).start();
    
    Alert.alert(t('notice'), t('usingTemplateContent'));
  };
  
  const handleClearForm = () => {
    setPrompt('');
    setGeneratedContent('');
    resultOpacity.setValue(0);
    resultTranslateY.setValue(20);
  };
  
  const copyToClipboard = () => {
    Clipboard.setString(generatedContent);
    setIsCopied(true);
    
    // Reset copied status after 2 seconds
    setTimeout(() => {
      setIsCopied(false);
    }, 2000);
  };
  
  const shareContent = async () => {
    try {
      const shareOptions = {
        message: generatedContent,
        title: 'Generated Content from MatrixAI'
      };
      
      await Share.open(shareOptions);
    } catch (error) {
      console.log('Error sharing content:', error);
    }
  };
  
  const renderContentTypeItem = ({ item }) => {
    // Determine the appropriate background color based on content type when selected
    const selectedColor = item.id === 'email' ? '#2196F3' : 
                          item.id === 'blog' ? '#4CAF50' : 
                          item.id === 'social' ? '#9C27B0' : 
                          item.id === 'marketing' ? '#FF9800' : '#FF6D00';
    
    // Apply different styling based on selection state
    const isSelected = contentType === item.id;
    
    return (
      <TouchableOpacity
        style={[
          styles.typeItem,
          isSelected && [styles.selectedTypeItem, { backgroundColor: selectedColor }],
          { 
            backgroundColor: currentTheme === 'dark' ? 'rgba(30, 30, 40, 0.6)' : 'rgba(255, 255, 255, 0.8)',
            borderWidth: 1,
            borderColor: isSelected ? selectedColor : 'transparent',
            transform: isSelected ? [{ scale: 1.05 }] : [{ scale: 1 }]
          }
        ]}
        onPress={() => setContentType(item.id)}
      >
        <MaterialCommunityIcons 
          name={item.icon} 
          size={normalize(24)} 
          color={isSelected ? colors.text : colors.text} 
        />
        <Text style={[
          styles.typeName,
          { 
            color: isSelected ? colors.text : colors.text,
            fontWeight: isSelected ? '600' : '500'
          }
        ]}>
          {item.name}
        </Text>
        
        {/* Add a small indicator for the selected item */}
        {isSelected && (
          <View style={styles.selectedIndicator}>
            <MaterialIcons name="check" size={16} color="#FFFFFF" />
          </View>
        )}
      </TouchableOpacity>
    );
  };
  
  const renderHistoryItem = ({ item }) => {
    // For very small screens, we might need to truncate the text more
    const truncateLength = width < 320 ? 40 : width < 375 ? 50 : 60;
    const isSmallScreen = width < 360;
    
    return (
      <TouchableOpacity 
        style={[styles.historyItem, { 
          backgroundColor: currentTheme === 'dark' ? 'rgba(40, 40, 50, 0.6)' : 'rgba(255, 255, 255, 0.8)',
        }]}
        onPress={() => {
          setPrompt(item.prompt);
          setGeneratedContent(item.content);
          setContentType(item.type);
          toggleHistory();
          
          // Animate result appearance
          Animated.parallel([
            Animated.timing(resultOpacity, {
              toValue: 1,
              duration: 500,
              useNativeDriver: true,
            }),
            Animated.timing(resultTranslateY, {
              toValue: 0,
              duration: 500,
              useNativeDriver: true,
            })
          ]).start();
        }}
      >
        <View style={[styles.historyItemHeader, isSmallScreen && { flexDirection: 'column' }]}>
          <View style={[styles.historyItemTextContainer, isSmallScreen && { marginBottom: responsiveSpacing(8) }]}>
            <Text style={[styles.historyItemTitle, { color: colors.text }]} numberOfLines={2}>
              {item.prompt.length > truncateLength ? `${item.prompt.substring(0, truncateLength)}...` : item.prompt}
            </Text>
            <Text style={[styles.historyItemDate, { color: colors.textSecondary }]}>
              {item.date}
            </Text>
          </View>
          <View style={[
            styles.historyItemBadge, 
            { 
              backgroundColor: item.type === 'email' ? '#2196F3' : 
                               item.type === 'blog' ? '#4CAF50' : 
                               item.type === 'social' ? '#9C27B0' : 
                               item.type === 'marketing' ? '#FF9800' : '#3F51B5',
              opacity: 0.9,
              alignSelf: isSmallScreen ? 'flex-start' : 'center'
            }
          ]}>
            <Text style={styles.historyItemBadgeText}>
              {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
            </Text>
          </View>
        </View>
        <Text style={[styles.historyItemPreview, { color: colors.textSecondary }]} numberOfLines={2}>
          {item.content}
        </Text>
      </TouchableOpacity>
    );
  };

  const getContentTypeIcon = () => {
    const selectedType = contentTypes.find(type => type.id === contentType);
    return selectedType ? selectedType.icon : 'text';
  };

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
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('contentWriter')}</Text>
        <TouchableOpacity 
          style={styles.historyButton} 
          onPress={toggleHistory}
        >
          <MaterialIcons name="history" size={24} color={colors.text} />
        </TouchableOpacity>
      </Animated.View>
      
      {/* Main Content */}
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
          bounces={true}
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
                    ['#FF6D00', '#F57C00'] : 
                    ['#FFF3E0', '#FFE0B2']}
                  style={styles.bannerGradient}
                >
                  <View style={styles.bannerContent}>
                    <View style={styles.bannerTextContent}>
                      <Text style={[styles.bannerTitle, { color: colors.text }]}>
                        {t('aiContentWriter')}
                      </Text>
                      <Text style={[styles.bannerSubtitle, { color: colors.textSecondary }]}>
                        {t('generateProfessionalContent')}
                      </Text>
                    </View>
                    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                      <View style={styles.iconContainer}>
                        <LinearGradient
                          colors={['#FF6D00', '#F57C00']}
                          style={styles.iconGradient}
                        >
                          <MaterialCommunityIcons name="text-box-outline" size={32} color="#FFFFFF" />
                        </LinearGradient>
                      </View>
                    </Animated.View>
                  </View>
                </LinearGradient>
              </Animated.View>
            </View>
            
            {/* Content Type Selector */}
            <View style={styles.standardContainer}>
              <View style={styles.typeContainer}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('contentType')}</Text>
                <FlatList
                  data={contentTypes}
                  renderItem={renderContentTypeItem}
                  keyExtractor={item => item.id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.typeList}
                />
              </View>
            </View>
            
            {/* Prompt Input */}
            <View 
              ref={promptInputRef}
              style={styles.standardContainer}
            >
              <View style={styles.promptContainer}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('whatToWriteAbout')}</Text>
                <View style={[styles.promptInputWrapper, { 
                  backgroundColor: colors.card,
                  borderColor: colors.border
                }]}>
                  <TextInput
                    style={[styles.promptInput, { 
                      color: colors.text,
                      height: 160, // Fixed height for approximately 8 lines
                      paddingTop: 8,
                      textAlignVertical: 'top'
                    }]}
                    placeholder={t('enterTopicOrRequest')}
                    placeholderTextColor={'#A3A3A3FF'}
                    value={prompt}
                    onChangeText={setPrompt}
                    multiline
                    numberOfLines={8} // Fixed number of lines
                    textAlignVertical="top"
                    editable={!isGenerating}
                    onFocus={() => {
                      // When input is focused, scroll to make the entire input visible
                      if (promptInputRef.current && scrollViewRef.current) {
                        setTimeout(() => {
                          promptInputRef.current.measureLayout(
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
                      if (keyboardVisible && promptInputRef.current && scrollViewRef.current) {
                        promptInputRef.current.measureLayout(
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
                </View>
              </View>
            </View>
            
            {/* Generate Button */}
            {!generatedContent && (
              <View style={styles.standardContainer}>
                <TouchableOpacity 
                  style={[styles.generateButton, {
                    backgroundColor: colors.primary,
                    opacity: isGenerating || prompt.trim() === '' ? 0.7 : 1
                  }]}
                  onPress={handleGenerate}
                  disabled={isGenerating || prompt.trim() === ''}
                >
                  {isGenerating ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Text style={styles.generateButtonText}>{t('generate')}</Text>
                      <MaterialCommunityIcons 
                        name={getContentTypeIcon()} 
                        size={20} 
                        color="#FFFFFF" 
                      />
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
            
            {/* Result Section */}
            {generatedContent !== '' && (
              <View style={styles.standardContainer}>
                <Animated.View style={[styles.resultContainer, {
                  opacity: resultOpacity,
                  transform: [{ translateY: resultTranslateY }]
                }]}>
                  <View style={styles.resultHeader}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('generatedContent')}</Text>
                    <TouchableOpacity 
                      style={styles.newContentButton}
                      onPress={handleClearForm}
                    >
                      <MaterialIcons name="refresh" size={20} color={colors.primary} />
                      <Text style={[styles.newContentButtonText, { color: colors.primary }]}>
                        {t('newContent')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  
                  <View style={[styles.contentBox, {
                    backgroundColor: colors.card,
                    borderColor: colors.border
                  }]}>
                    <ScrollView 
                      style={styles.contentScroll}
                      nestedScrollEnabled={true}
                    >
                      <Text style={[styles.contentText, { color: colors.text }]}>
                        {generatedContent}
                      </Text>
                    </ScrollView>
                  </View>
                  
                  <View style={styles.actionButtons}>
                    <TouchableOpacity 
                      style={[styles.actionButton, { backgroundColor: colors.card }]}
                      onPress={copyToClipboard}
                    >
                      <MaterialIcons 
                        name={isCopied ? "check" : "content-copy"} 
                        size={22} 
                        color={isCopied ? "#4CAF50" : colors.text} 
                      />
                      <Text style={[styles.actionButtonText, { 
                        color: isCopied ? "#4CAF50" : colors.text 
                      }]}>
                        {isCopied ? t('copied') : t('copy')}
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={[styles.actionButton, { backgroundColor: colors.card }]}
                      onPress={shareContent}
                    >
                      <MaterialIcons name="share" size={22} color={colors.text} />
                      <Text style={[styles.actionButtonText, { color: colors.text }]}>
                        {t('share')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              </View>
            )}
            
            {/* Processing Animation */}
            {isGenerating && (
              <View style={styles.processingContainer}>
                <LottieView 
                  source={require('../assets/image2.json')}
                  autoPlay
                  loop
                  style={styles.lottieAnimation}
                />
                <Text style={[styles.processingText, { color: colors.text }]}>
                  {t('creatingYourContent')}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      
      {/* Overlay - add this */}
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
              {t('contentHistory')}
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
                {t('noHistoryFound')}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  historyButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingBottom: 40,
    alignItems: 'center',
  },
  contentWrapper: {
    width: '100%', 
    maxWidth: 600,
    paddingHorizontal: 16,
  },
  welcomeBanner: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bannerGradient: {
    width: '100%',
    borderRadius: 20,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: 20,
  },
  bannerTextContent: {
    flex: 1,
    paddingRight: 16,
  },
  bannerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  bannerSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#F57C00',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  iconGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeContainer: {
    marginTop: 24,
    width: '100%',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  typeList: {
    paddingVertical: 8,
    marginLeft: responsiveSpacing(16),
  },
  typeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginRight: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  selectedTypeItem: {
    backgroundColor: '#FF6D00',
    borderColor: '#FF6D00',
  },
  typeName: {
    marginLeft: 8,
    fontWeight: '500',
  },
  promptContainer: {
    marginTop: 24,
    width: '100%',
  },
  promptInputWrapper: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    minHeight: 160,
    maxHeight: 160, // Fixed height for the input
  },
  promptInput: {
    fontSize: 16,
    flex: 1,
  },
  generateButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 20,
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
    marginRight: 8,
  },
  processingContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  lottieAnimation: {
    width: 200,
    height: 100,
  },
  processingText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 8,
  },
  resultContainer: {
    marginTop: 24,
    width: '100%',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  newContentButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  newContentButtonText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  contentBox: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    minHeight: 200,
    maxHeight: 400,
  },
  contentScroll: {
    flex: 1,
  },
  contentText: {
    fontSize: 15,
    lineHeight: 22,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flex: 0.48,
  },
  actionButtonText: {
    fontWeight: '500',
    fontSize: 14,
    marginLeft: 8,
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
    fontSize: 18,
    fontWeight: '600',
  },
  historyList: {
    padding: 16,
    paddingBottom: 40,
  },
  historyItem: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 8, // Add some margin on the sides for better appearance
  },
  historyItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  historyItemTextContainer: {
    flex: 1,
    marginRight: 8,
  },
  historyItemTitle: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  historyItemDate: {
    fontSize: 12,
    color: '#9E9E9E',
    marginTop: 2,
  },
  historyItemPreview: {
    fontSize: 14,
    lineHeight: 20,
  },
  historyItemBadge: {
    padding: 4,
    borderRadius: 4,
  },
  historyItemBadgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyHistoryContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyHistoryText: {
    fontSize: 16,
    marginTop: 12,
  },
  selectedIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  standardContainer: {
    width: '100%',
    marginTop: 16,
  },
});

export default ContentWriterScreen;