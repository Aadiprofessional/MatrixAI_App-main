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
  KeyboardAvoidingView,
  Modal,
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
import { supabase } from '../supabaseClient';
import MathView from 'react-native-math-view';
import MarkdownDisplay from 'react-native-markdown-display';
import * as Animatable from 'react-native-animatable';
import { DASHSCOPE_API_KEY } from '@env';

const { width, height } = Dimensions.get('window');
const scale = Math.min(width / 375, height / 812); // Base scale on iPhone X dimensions for consistency

// Function to normalize font size based on screen width
const normalize = (size) => {
  const newSize = size * scale;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

// Function to calculate responsive padding/margin
const responsiveSpacing = (size) => size * scale;

const ContentWriterContent = () => {
  const { getThemeColors, currentTheme } = useTheme();
  const colors = getThemeColors();
  const { t } = useLanguage();
  const navigation = useNavigation();
  
  // State variables
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const [contentType, setContentType] = useState('essay');
  const [wordCount, setWordCount] = useState('500');
  const [tone, setTone] = useState('professional');
  const [isCopied, setIsCopied] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [hasMathContent, setHasMathContent] = useState(false);
  const [historyFilter, setHistoryFilter] = useState(null);
  const [wordCountModalVisible, setWordCountModalVisible] = useState(false);
  const [toneModalVisible, setToneModalVisible] = useState(false);
  
  // Animated values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const historySlideAnim = useRef(new Animated.Value(width * 0.7)).current;
  const resultOpacity = useRef(new Animated.Value(0)).current;
  const resultTranslateY = useRef(new Animated.Value(20)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  // Content types - updated based on the image
  const contentTypes = [
    { id: 'essay', name: t('essay') || 'Essay', icon: 'file-document-outline' },
    { id: 'article', name: t('article') || 'Article', icon: 'newspaper' },
    { id: 'blog', name: t('blogPost') || 'Blog Post', icon: 'post-outline' },
    { id: 'letter', name: t('letter') || 'Letter', icon: 'email-outline' },
    { id: 'email', name: t('email') || 'Email', icon: 'email-outline' },
    { id: 'report', name: t('report') || 'Report', icon: 'chart-box-outline' },
    { id: 'story', name: t('story') || 'Story', icon: 'book-open-variant' },
    { id: 'social', name: t('socialMedia') || 'Social Media', icon: 'twitter' },
    { id: 'marketing', name: t('marketingCopy') || 'Marketing Copy', icon: 'bullhorn-outline' },
    { id: 'business', name: t('businessProposal') || 'Business Proposal', icon: 'briefcase-outline' },
  ];
  
  // Word count options
  const wordCountOptions = [
    { id: '250', count: 250, name: '250 words' },
    { id: '500', count: 500, name: '500 words' },
    { id: '750', count: 750, name: '750 words' },
    { id: '1000', count: 1000, name: '1000 words' },
    { id: '1500', count: 1500, name: '1500 words' },
  ];
  
  // Tone options - based on the second image
  const toneOptions = [
    { id: 'professional', name: t('professional') || 'Professional', icon: 'briefcase-outline' },
    { id: 'casual', name: t('casual') || 'Casual', icon: 'coffee' },
    { id: 'friendly', name: t('friendly') || 'Friendly', icon: 'emoticon-outline' },
    { id: 'formal', name: t('formal') || 'Formal', icon: 'format-letter-case' },
    { id: 'creative', name: t('creative') || 'Creative', icon: 'palette' },
    { id: 'persuasive', name: t('persuasive') || 'Persuasive', icon: 'bullhorn-outline' },
  ];
  
  // Quick content prompts
  const quickContentPrompts = [
    { id: 'summary', name: t('summarize') || 'Summarize a topic', prompt: 'Write a concise summary about ' },
    { id: 'explain', name: t('explain') || 'Explain a concept', prompt: 'Explain in simple terms what is ' },
    { id: 'compare', name: t('compare') || 'Compare and contrast', prompt: 'Compare and contrast between ' },
    { id: 'steps', name: t('steps') || 'Step-by-step guide', prompt: 'Create a step-by-step guide for ' },
  ];

  // History items
  const [historyItems, setHistoryItems] = useState([]);

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
    
    // Load history when panel is opened
    if (!historyOpen) {
      setIsLoadingHistory(true);
      fetchUserContent()
        .then(items => {
          setHistoryItems(items);
          setIsLoadingHistory(false);
        })
        .catch(error => {
          console.error('Error loading history:', error);
          setIsLoadingHistory(false);
        });
    }
  };
  
  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });
  
  // Function to send message to AI using the same API as BotScreen.js
  const sendMessageToAI = (userMessage, onChunk) => {
    return new Promise((resolve, reject) => {
      try {
        // Create XMLHttpRequest for streaming
        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', true);
        xhr.setRequestHeader('Authorization', `Bearer ${DASHSCOPE_API_KEY}`);
        xhr.setRequestHeader('Content-Type', 'application/json');
        
        let fullContent = '';
        let processedLength = 0; // Track how much we've already processed
        let isFirstChunk = true;
        
        xhr.onreadystatechange = function() {
          if (xhr.readyState === 3 || xhr.readyState === 4) {
            const responseText = xhr.responseText;
            
            // Only process new content that we haven't seen before
            const newContent = responseText.substring(processedLength);
            if (newContent) {
              processedLength = responseText.length; // Update processed length
              const lines = newContent.split('\n');
              
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6).trim();
                  if (data === '[DONE]') {
                    console.log('✅ Stream marked as DONE');
                    continue;
                  }
                  
                  try {
                    const parsed = JSON.parse(data);
                    const content_chunk = parsed.choices?.[0]?.delta?.content;
                    
                    if (content_chunk) {
                      if (isFirstChunk) {
                        console.log('📝 First content chunk received');
                        isFirstChunk = false;
                      }
                      
                      fullContent += content_chunk;
                      
                      // Check for math content in the chunk
                      if (content_chunk.includes('$$') || content_chunk.includes('$') || 
                          content_chunk.includes('\\(') || content_chunk.includes('\\)') ||
                          content_chunk.includes('\\[') || content_chunk.includes('\\]')) {
                        setHasMathContent(true);
                      }
                      
                      // Call the chunk callback immediately for real-time updates
                      if (onChunk) {
                        onChunk(content_chunk);
                      }
                    }
                  } catch (parseError) {
                    // Skip invalid JSON lines
                    continue;
                  }
                }
              }
            }
          }
        };
        
        xhr.onload = function() {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(fullContent);
          } else {
            console.error('Request failed with status:', xhr.status);
            reject(new Error(`Request failed with status ${xhr.status}`));
          }
        };
        
        xhr.onerror = function() {
          console.error('XMLHttpRequest error');
          reject(new Error('Failed to get response from AI. Please try again.'));
        };
        
        xhr.ontimeout = function() {
          console.error('XMLHttpRequest timeout');
          reject(new Error('Request timed out. Please try again.'));
        };
        
        xhr.timeout = 60000; // 60 second timeout
        
        // Create a system prompt based on content type
        let systemPrompt;
        
        // Common formatting instructions to avoid markdown symbols
        const formattingInstructions = 'Format your response as clean, readable text without using markdown symbols like ** or ##. Use proper paragraphs and spacing for structure instead of markdown formatting. Do not use asterisks for emphasis or hashtags for headings.';
        
        switch(contentType) {
          case 'article':
            systemPrompt = `You are a professional article writer. Create well-structured, informative, and engaging articles with proper headings, subheadings, and bullet points where appropriate. ${formattingInstructions}`;
            break;
          case 'email':
            systemPrompt = `You are an email writing assistant. Create clear, concise, and professional emails with proper subject lines, greetings, body content, and closings. ${formattingInstructions}`;
            break;
          case 'blog':
            systemPrompt = `You are a blog post writer. Create engaging blog posts with catchy titles, compelling introductions, well-structured main points with headings, and strong conclusions with calls to action. ${formattingInstructions}`;
            break;
          case 'social':
            systemPrompt = `You are a social media content creator. Create concise, engaging, and shareable social media posts with clear key points and relevant hashtags. ${formattingInstructions}`;
            break;
          case 'marketing':
            systemPrompt = `You are a marketing copywriter. Create persuasive marketing copy with compelling headlines, clear benefits, features, testimonials, and strong calls to action. ${formattingInstructions}`;
            break;
          default:
            systemPrompt = `You are a professional content writer. Create high-quality content that is well-structured and engaging. ${formattingInstructions}`;
        }
        
        // Prepare messages for the API
        const messages = [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userMessage
          }
        ];
        
        const requestBody = JSON.stringify({
          model: "qwen-vl-max",
          messages: messages,
          stream: true
        });
        
        console.log('Sending request to AI API...');
        xhr.send(requestBody);
        
      } catch (error) {
        console.error('Error in sendMessageToAI:', error);
        reject(new Error('Failed to get response from AI. Please try again.'));
      }
    });
  };
  
  // Function to fetch user content history from the API
  const fetchUserContent = async (contentType = null, searchQuery = null) => {
    try {
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        console.error('No authenticated user found');
        return [];
      }
      
      const userId = session.user.id;
      
      // Build the API URL with optional filters
      let apiUrl = `https://main-matrixai-server-lujmidrakh.cn-hangzhou.fcapp.run/api/content/getUserContent?uid=${userId}`;
      
      if (contentType) {
        apiUrl += `&contentType=${contentType}`;
      }
      
      if (searchQuery) {
        apiUrl += `&searchQuery=${encodeURIComponent(searchQuery)}`;
      }
      
      const response = await axios.get(apiUrl);
      
      if (response.data && response.data.content) {
        // Format the history items
        const formattedItems = response.data.content.map(item => ({
          id: item.id,
          prompt: item.prompt,
          content: item.content,
          type: item.content_type,
          date: new Date(item.created_at).toLocaleString(),
          title: item.title
        }));
        
        return formattedItems;
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching user content:', error);
      return [];
    }
  };
  
  // Function to save content to the API
  const saveContentToAPI = async (contentData) => {
    try {
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        console.error('No authenticated user found');
        return null;
      }
      
      const userId = session.user.id;
      
      // Prepare the request data
      const requestData = {
        uid: userId,
        prompt: contentData.prompt,
        content: contentData.content,
        title: contentData.title || `${contentType.charAt(0).toUpperCase() + contentType.slice(1)} about ${contentData.prompt.substring(0, 30)}...`,
        tags: contentData.tags || [contentType],
        content_type: contentData.type,
        tone: contentData.tone || tone,
        word_count: contentData.wordCount || wordCount,
        language: 'en'
      };
      
      const response = await axios.post(
        'https://main-matrixai-server-lujmidrakh.cn-hangzhou.fcapp.run/api/content/saveContent',
        requestData,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error saving content:', error);
      return null;
    }
  };
  
  // Function to delete content from the API
  const deleteContentFromAPI = async (contentId) => {
    try {
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        console.error('No authenticated user found');
        return { success: false };
      }
      
      const userId = session.user.id;
      
      await axios.delete(
        'https://main-matrixai-server-lujmidrakh.cn-hangzhou.fcapp.run/api/content/deleteContent',
        {
          headers: {
            'Content-Type': 'application/json'
          },
          data: {
            uid: userId,
            contentId: contentId
          }
        }
      );
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting content:', error);
      return { success: false };
    }
  };
  
  // Function to handle content deletion
  const handleDeleteContent = async (contentId) => {
    if (!contentId) return;
    
    try {
      setIsDeleting(true);
      
      // Confirm deletion with the user
      Alert.alert(
        t('confirmDelete'),
        t('deleteContentConfirmation'),
        [
          {
            text: t('cancel'),
            style: 'cancel',
            onPress: () => setIsDeleting(false)
          },
          {
            text: t('delete'),
            style: 'destructive',
            onPress: async () => {
              // Call the API to delete the content
              const result = await deleteContentFromAPI(contentId);
              
              if (result && result.success) {
                // Remove the item from local history
                setHistoryItems(historyItems.filter(item => item.id !== contentId));
                
                // If the deleted item was selected, clear the selection
                if (selectedHistoryItem && selectedHistoryItem.id === contentId) {
                  setSelectedHistoryItem(null);
                  setGeneratedContent('');
                  setPrompt('');
                }
                
                // Show success message
                Alert.alert(t('success'), t('contentDeletedSuccessfully'));
              } else {
                // Show error message
                Alert.alert(t('error'), t('failedToDeleteContent'));
              }
              
              setIsDeleting(false);
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error deleting content:', error);
      Alert.alert(t('error'), t('failedToDeleteContent'));
      setIsDeleting(false);
    }
  };
  
  // Function to share content via the API
  const shareContentViaAPI = async (contentId) => {
    try {
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        console.error('No authenticated user found');
        return null;
      }
      
      const userId = session.user.id;
      
      const response = await axios.post(
        'https://main-matrixai-server-lujmidrakh.cn-hangzhou.fcapp.run/api/content/shareContent',
        {
          uid: userId,
          contentId: contentId
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data.shareId;
    } catch (error) {
      console.error('Error sharing content:', error);
      return null;
    }
  };
  
  // Load user content history on component mount
  useEffect(() => {
    const loadUserContent = async () => {
      const content = await fetchUserContent();
      if (content.length > 0) {
        setHistoryItems(content);
      }
    };
    
    loadUserContent();
  }, []);
  
  const handleGenerate = async () => {
    if (prompt.trim() === '') {
      Alert.alert(t('error'), t('pleaseEnterPrompt'));
      return;
    }
    
    // Clear any previous content and set generating state
    setGeneratedContent('');
    setIsGenerating(true);
    
    // Animate result appearance immediately to show streaming content
    Animated.parallel([
      Animated.timing(resultOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(resultTranslateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      })
    ]).start();
    
    // Create a detailed prompt for content generation based on the selected type, word count, and tone
    let contentPrompt;
    const selectedWordCount = wordCountOptions.find(option => option.id === wordCount)?.count || 500;
    const selectedToneText = toneOptions.find(option => option.id === tone)?.name || 'Professional';
    
    // Common formatting instructions to ensure clean output without markdown artifacts
    const formattingInstructions = `
    Format your response in clean, readable text. Do not use markdown formatting symbols like ** ## or similar. 
    Use proper paragraphs, spacing, and structure but avoid raw markdown syntax.
    `;
    
    switch(contentType) {
      case 'essay':
        contentPrompt = `Write a ${selectedToneText.toLowerCase()} essay about "${prompt}". The essay should be approximately ${selectedWordCount} words. Include an introduction, body paragraphs with clear arguments, and a conclusion. ${formattingInstructions}`;
        break;
      case 'article':
        contentPrompt = `Write a ${selectedToneText.toLowerCase()} article about "${prompt}". The article should be approximately ${selectedWordCount} words. Include clear sections with proper organization. ${formattingInstructions}`;
        break;
      case 'blog':
        contentPrompt = `Write a ${selectedToneText.toLowerCase()} blog post about "${prompt}". The blog post should be approximately ${selectedWordCount} words. Include a catchy title, introduction, main points, and a conclusion. ${formattingInstructions}`;
        break;
      case 'letter':
        contentPrompt = `Write a ${selectedToneText.toLowerCase()} letter about "${prompt}". The letter should be approximately ${selectedWordCount} words. Include proper formatting with date, address, greeting, body, and closing. ${formattingInstructions}`;
        break;
      case 'email':
        contentPrompt = `Write a ${selectedToneText.toLowerCase()} email about "${prompt}". The email should be approximately ${selectedWordCount} words. Include a subject line, greeting, body, and closing. ${formattingInstructions}`;
        break;
      case 'report':
        contentPrompt = `Write a ${selectedToneText.toLowerCase()} report about "${prompt}". The report should be approximately ${selectedWordCount} words. Include an executive summary, introduction, findings, analysis, and recommendations. ${formattingInstructions}`;
        break;
      case 'story':
        contentPrompt = `Write a ${selectedToneText.toLowerCase()} story about "${prompt}". The story should be approximately ${selectedWordCount} words. Include characters, setting, plot, and narrative arc. ${formattingInstructions}`;
        break;
      case 'social':
        contentPrompt = `Create a ${selectedToneText.toLowerCase()} social media post about "${prompt}". Keep it concise but aim for about ${Math.min(selectedWordCount, 100)} words. Include relevant hashtags. ${formattingInstructions}`;
        break;
      case 'marketing':
        contentPrompt = `Create ${selectedToneText.toLowerCase()} marketing copy for "${prompt}". The copy should be approximately ${selectedWordCount} words. Include a compelling headline, key benefits, features, testimonials, and a strong call to action. ${formattingInstructions}`;
        break;
      case 'business':
        contentPrompt = `Write a ${selectedToneText.toLowerCase()} business proposal about "${prompt}". The proposal should be approximately ${selectedWordCount} words. Include an executive summary, problem statement, proposed solution, benefits, costs, and implementation plan. ${formattingInstructions}`;
        break;
      default:
        contentPrompt = `Write ${selectedToneText.toLowerCase()} content about "${prompt}" in approximately ${selectedWordCount} words. ${formattingInstructions}`;
    }
    
    try {
      // Initialize empty content for streaming
      let streamingContent = '';
      
      // Send the prompt to the AI API with streaming
      const fullResponse = await sendMessageToAI(contentPrompt, (chunk) => {
        // Update content with each chunk for real-time streaming
        streamingContent += chunk;
        setGeneratedContent(streamingContent);
      });
      
      // Create a new history item
      const newHistoryItem = {
        id: Date.now().toString(),
        prompt: prompt,
        content: streamingContent,
        type: contentType,
        tone: tone,
        wordCount: wordCount,
        date: 'Just now',
        title: `${contentType.charAt(0).toUpperCase() + contentType.slice(1)} about ${prompt.substring(0, 30)}...`
      };
      
      // Save to API
      const savedContent = await saveContentToAPI(newHistoryItem);
      
      if (savedContent && savedContent.id) {
        // Update the history item with the API-generated ID
        newHistoryItem.id = savedContent.id;
      }
      
      // Update local history
      setHistoryItems([newHistoryItem, ...historyItems]);
      
    } catch (error) {
      console.error('Error generating content:', error);
      Alert.alert(t('error'), t('failedToGenerateContent'));
      
      // Fallback to template content if API fails
      handleFallbackGeneration();
    } finally {
      setIsGenerating(false);
    }
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
      tone: tone,
      wordCount: wordCount,
      date: 'Just now',
      title: `${contentType.charAt(0).toUpperCase() + contentType.slice(1)} about ${prompt.substring(0, 30)}...`
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
    if (!generatedContent) return;
    
    try {
      // Get the selected history item (if any) or use the current content
      const contentId = historyItems.find(item => item.content === generatedContent)?.id;
      
      if (!contentId) {
        // If no history item is selected, share directly without API
        const shareOptions = {
          message: generatedContent,
          title: 'Generated Content from MatrixAI'
        };
        
        await Share.open(shareOptions);
        return;
      }
      
      // Show loading indicator
      setIsGenerating(true);
      
      // Get shareable link from API
      const shareId = await shareContentViaAPI(contentId);
      
      if (!shareId) {
        Alert.alert(t('error'), t('failedToShareContent'));
        return;
      }
      
      // Create a shareable link
      const shareableLink = `https://matrixai.app/shared/${shareId}`;
      
      // Show sharing options
      Share.share({
        message: generatedContent,
        title: 'Share Content',
        url: shareableLink
      });
    } catch (error) {
      console.error('Error sharing content:', error);
      Alert.alert(t('error'), t('failedToShareContent'));
    } finally {
      setIsGenerating(false);
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
    const isSelected = selectedHistoryItem && selectedHistoryItem.id === item.id;
    
    // Get the tone name from the tone ID
    const toneText = item.tone ? 
      (toneOptions.find(option => option.id === item.tone)?.name || 'Professional') : 
      'Professional';
    
    // Get the word count from the word count ID
    const wordCountText = item.wordCount ? 
      (wordCountOptions.find(option => option.id === item.wordCount)?.count || '500') : 
      '500';
    
    return (
      <Animatable.View 
        animation="fadeIn"
        duration={500}
        delay={200}
        style={[styles.historyItem, { 
          backgroundColor: currentTheme === 'dark' ? 'rgba(40, 40, 50, 0.6)' : 'rgba(255, 255, 255, 0.8)',
          borderColor: isSelected ? colors.primary : 'transparent',
          borderWidth: isSelected ? 1 : 0,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 3,
          elevation: 2,
        }]}
      >
        <TouchableOpacity 
          style={{ flex: 1 }}
          onPress={() => {
            setSelectedHistoryItem(item);
            setPrompt(item.prompt);
            setGeneratedContent(item.content);
            setContentType(item.type);
            if (item.tone) setTone(item.tone);
            if (item.wordCount) setWordCount(item.wordCount);
            toggleHistory();
            
            // Check if content has math formulas
            const hasMath = item.content.includes('$$') || item.content.includes('$') || 
                           item.content.includes('\\(') || item.content.includes('\\)') ||
                           item.content.includes('\\[') || item.content.includes('\\]');
            setHasMathContent(hasMath);
            
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
                {item.title || (item.prompt.length > truncateLength ? `${item.prompt.substring(0, truncateLength)}...` : item.prompt)}
              </Text>
              <View style={styles.historyItemMetaContainer}>
                <Text style={[styles.historyItemDate, { color: colors.text }]}>
                  {item.date}
                </Text>
                {item.tone && (
                  <Text style={[styles.historyItemMeta, { color: colors.text }]}>
                    • {toneText}
                  </Text>
                )}
                {item.wordCount && (
                  <Text style={[styles.historyItemMeta, { color: colors.text }]}>
                    • {wordCountText} words
                  </Text>
                )}
              </View>
            </View>
            <View style={[
              styles.historyItemBadge, 
              { 
                backgroundColor: 
                  item.type === 'essay' ? '#3F51B5' :
                  item.type === 'article' ? '#2196F3' : 
                  item.type === 'blog' ? '#4CAF50' : 
                  item.type === 'letter' ? '#795548' :
                  item.type === 'email' ? '#00BCD4' : 
                  item.type === 'report' ? '#607D8B' :
                  item.type === 'story' ? '#9C27B0' : 
                  item.type === 'social' ? '#E91E63' : 
                  item.type === 'marketing' ? '#FF9800' : 
                  item.type === 'business' ? '#F44336' : '#3F51B5',
                opacity: 0.9,
                alignSelf: isSmallScreen ? 'flex-start' : 'center'
              }
            ]}>
              <Text style={styles.historyItemBadgeText}>
                {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
              </Text>
            </View>
          </View>
          <Text style={[styles.historyItemPreview, { color: colors.text }]} numberOfLines={2}>
            {item.content}
          </Text>
        </TouchableOpacity>
        
        {/* Delete button */}
        <TouchableOpacity 
          style={styles.deleteButton} 
          onPress={() => handleDeleteContent(item.id)}
          disabled={isDeleting}
        >
          <MaterialIcons 
            name="delete-outline" 
            size={22} 
            color={colors.error || '#F44336'} 
          />
        </TouchableOpacity>
      </Animatable.View>
    );
  };
  
  // Render skeleton loading for history items
  const renderHistorySkeleton = () => {
    return Array(3).fill(0).map((_, index) => (
      <Animatable.View 
        key={`skeleton-${index}`}
        animation="pulse"
        iterationCount="infinite"
        duration={1500}
        style={[styles.historyItem, { backgroundColor: 'transparent' }]}
      >
        <LinearGradient
          colors={currentTheme === 'dark' ? 
            ['rgba(60, 60, 70, 0.8)', 'rgba(40, 40, 50, 0.6)', 'rgba(60, 60, 70, 0.8)'] : 
            ['rgba(240, 240, 240, 0.8)', 'rgba(255, 255, 255, 0.6)', 'rgba(240, 240, 240, 0.8)']}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 0}}
          style={styles.skeletonGradient}
        >
          <View style={styles.historyItemHeader}>
            <View style={styles.historyItemTextContainer}>
              <View style={[styles.skeletonText, { width: '80%', height: 18, marginBottom: 8 }]} />
              <View style={[styles.skeletonText, { width: '40%', height: 12 }]} />
            </View>
            <View style={[styles.skeletonBadge, { width: 60, height: 24 }]} />
          </View>
          <View style={[styles.skeletonText, { width: '100%', height: 14, marginTop: 8 }]} />
          <View style={[styles.skeletonText, { width: '90%', height: 14, marginTop: 4 }]} />
        </LinearGradient>
      </Animatable.View>
    ));
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
      <StatusBar barStyle={currentTheme === 'dark' ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
      

      
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
                      <Text style={[styles.bannerSubtitle, { color: colors.text }]}>
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
                  nestedScrollEnabled={true}
                />
              </View>
            </View>
            
            {/* Word Count and Tone Selector in a single line */}
            <View style={styles.standardContainer}>
              <View style={styles.combinedSelectors}>
                {/* Word Count Selector */}
                <View style={styles.selectorContainer}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('wordCount')}</Text>
                  <TouchableOpacity 
                    style={[styles.dropdownSelector, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => setWordCountModalVisible(true)}
                  >
                    <Text style={[styles.dropdownText, { color: colors.text }]}>
                      {wordCountOptions.find(item => item.id === wordCount)?.count || '500'}
                    </Text>
                    <MaterialIcons name="arrow-drop-down" size={24} color={colors.text} />
                  </TouchableOpacity>
                  
                  {/* Word Count Modal */}
                  <Modal
                    transparent={true}
                    visible={wordCountModalVisible}
                    animationType="fade"
                    onRequestClose={() => setWordCountModalVisible(false)}
                  >
                    <TouchableOpacity 
                      style={styles.modalOverlay}
                      activeOpacity={1}
                      onPress={() => setWordCountModalVisible(false)}
                    >
                      <View style={[styles.modalContent, { backgroundColor: colors.card, top: '35%' }]}>
                        <FlatList
                          data={wordCountOptions}
                          renderItem={({ item }) => (
                            <TouchableOpacity
                              style={[styles.modalItem, wordCount === item.id && styles.selectedModalItem]}
                              onPress={() => {
                                setWordCount(item.id);
                                setWordCountModalVisible(false);
                              }}
                            >
                              <Text style={[styles.modalItemText, { color: colors.text }, wordCount === item.id && { color: colors.primary, fontWeight: '600' }]}>
                                {item.count} words
                              </Text>
                              {wordCount === item.id && (
                                <MaterialIcons name="check" size={20} color={colors.primary} />
                              )}
                            </TouchableOpacity>
                          )}
                          keyExtractor={item => item.id}
                          nestedScrollEnabled={true}
                        />
                      </View>
                    </TouchableOpacity>
                  </Modal>
                </View>
                
                {/* Tone Selector */}
                <View style={styles.selectorContainer}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('tone')}</Text>
                  <TouchableOpacity 
                    style={[styles.dropdownSelector, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => setToneModalVisible(true)}
                  >
                    <Text style={[styles.dropdownText, { color: colors.text }]}>
                      {toneOptions.find(item => item.id === tone)?.name || 'Professional'}
                    </Text>
                    <MaterialIcons name="arrow-drop-down" size={24} color={colors.text} />
                  </TouchableOpacity>
                  
                  {/* Tone Modal */}
                  <Modal
                    transparent={true}
                    visible={toneModalVisible}
                    animationType="fade"
                    onRequestClose={() => setToneModalVisible(false)}
                  >
                    <TouchableOpacity 
                      style={styles.modalOverlay}
                      activeOpacity={1}
                      onPress={() => setToneModalVisible(false)}
                    >
                      <View style={[styles.modalContent, { backgroundColor: colors.card, top: '35%' }]}>
                        <FlatList
                          data={toneOptions}
                          renderItem={({ item }) => (
                            <TouchableOpacity
                              style={[styles.modalItem, tone === item.id && styles.selectedModalItem]}
                              onPress={() => {
                                setTone(item.id);
                                setToneModalVisible(false);
                              }}
                            >
                              <Text style={[styles.modalItemText, { color: colors.text }, tone === item.id && { color: colors.primary, fontWeight: '600' }]}>
                                {item.name}
                              </Text>
                              {tone === item.id && (
                                <MaterialIcons name="check" size={20} color={colors.primary} />
                              )}
                            </TouchableOpacity>
                          )}
                          keyExtractor={item => item.id}
                          nestedScrollEnabled={true}
                        />
                      </View>
                    </TouchableOpacity>
                  </Modal>
                </View>
              </View>
            </View>
            
            {/* Prompt Input */}
            <View 
              ref={promptInputRef}
              style={styles.standardContainer}
            >
              <View style={styles.promptContainer}>
                <View style={styles.promptHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('whatToWriteAbout')}</Text>
                  <TouchableOpacity 
                    style={[styles.historyButton, { backgroundColor: colors.card }]} 
                    onPress={toggleHistory}
                  >
                    <MaterialIcons name="history" size={20} color={colors.primary} />
                  </TouchableOpacity>
                </View>
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
                
                {/* Quick Content Buttons */}
                <View style={styles.quickContentContainer}>
                  <Text style={[styles.quickContentTitle, { color: colors.text }]}>{t('quickContent')}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickContentScroll}>
                    {quickContentPrompts.map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        style={[styles.quickContentButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                        onPress={() => {
                          setPrompt(item.prompt);
                          handleGenerate();
                        }}
                        disabled={isGenerating}
                      >
                        <MaterialIcons name={item.icon} size={18} color={colors.primary} />
                        <Text style={[styles.quickContentButtonText, { color: colors.text }]}>{item.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
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
                      <MarkdownDisplay
                        style={[styles.contentText, { color: colors.text }]}
                        value={generatedContent}
                        mergeStyle={{
                          body: { color: colors.text },
                          paragraph: { color: colors.text, lineHeight: 22 },
                          heading1: { color: colors.text, fontWeight: 'bold', fontSize: 24, marginBottom: 10, marginTop: 16 },
                          heading2: { color: colors.text, fontWeight: 'bold', fontSize: 20, marginBottom: 8, marginTop: 14 },
                          heading3: { color: colors.text, fontWeight: 'bold', fontSize: 18, marginBottom: 6, marginTop: 12 },
                          heading4: { color: colors.text, fontWeight: 'bold', fontSize: 16, marginBottom: 4, marginTop: 10 },
                          heading5: { color: colors.text, fontWeight: 'bold', fontSize: 14, marginBottom: 2, marginTop: 8 },
                          heading6: { color: colors.text, fontWeight: 'bold', fontSize: 12, marginBottom: 2, marginTop: 6 },
                          list_item: { color: colors.text, marginBottom: 4 },
                          bullet_list: { color: colors.text, marginBottom: 10 },
                          ordered_list: { color: colors.text, marginBottom: 10 },
                          code_block: { backgroundColor: colors.card, padding: 10, borderRadius: 5, marginVertical: 8 },
                          fence: { backgroundColor: colors.card, padding: 10, borderRadius: 5, marginVertical: 8 },
                          blockquote: { borderLeftColor: colors.primary, backgroundColor: colors.card, opacity: 0.8, paddingLeft: 10, marginVertical: 8 },
                          link: { color: colors.primary },
                          em: { fontStyle: 'italic' },
                          strong: { fontWeight: 'bold' },
                          hr: { backgroundColor: colors.border, marginVertical: 10 },
                          table: { borderColor: colors.border, marginVertical: 10 },
                          tr: { borderBottomColor: colors.border },
                          th: { padding: 5, fontWeight: 'bold' },
                          td: { padding: 5 },
                        }}
                        rules={{
                          math: (node) => {
                            return (
                              <MathView
                                key={node.key}
                                math={node.content}
                                style={{ color: colors.text }}
                              />
                            );
                          },
                          inlineMath: (node) => {
                            return (
                              <MathView
                                key={node.key}
                                math={node.content}
                                style={{ color: colors.text }}
                              />
                            );
                          }
                        }}
                      />
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
            <TouchableOpacity 
              style={styles.historyCloseButton}
              onPress={toggleHistory}
            >
              <MaterialIcons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          
          {/* History Filter */}
          <View style={styles.historyFilterContainer}>
            <Text style={[styles.historyFilterLabel, { color: colors.text }]}>{t('filterBy')}:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.historyFilterScroll}>
              <TouchableOpacity 
                style={[styles.historyFilterButton, { 
                  backgroundColor: historyFilter === null ? colors.primary : colors.card,
                  borderColor: historyFilter === null ? colors.primary : colors.border,
                }]}
                onPress={() => setHistoryFilter(null)}
              >
                <Text style={[styles.historyFilterButtonText, { color: historyFilter === null ? '#FFFFFF' : colors.text }]}>
                  {t('all')}
                </Text>
              </TouchableOpacity>
              
              {contentTypes.map((type) => (
                <TouchableOpacity 
                  key={type.id}
                  style={[styles.historyFilterButton, { 
                    backgroundColor: historyFilter === type.id ? colors.primary : colors.card,
                    borderColor: historyFilter === type.id ? colors.primary : colors.border,
                  }]}
                  onPress={() => setHistoryFilter(type.id)}
                >
                  <Text style={[styles.historyFilterButtonText, { color: historyFilter === type.id ? '#FFFFFF' : colors.text }]}>
                    {type.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          
          {isLoadingHistory ? (
            <View style={styles.historyList}>
              {renderHistorySkeleton()}
            </View>
          ) : historyItems.length > 0 ? (
            <FlatList
              data={historyFilter === null ? 
                historyItems : 
                historyItems.filter(item => item.type === historyFilter)}
              renderItem={renderHistoryItem}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.historyList}
              nestedScrollEnabled={true}
            />
          ) : (
            <View style={styles.emptyHistoryContainer}>
              <MaterialCommunityIcons 
                name="history" 
                size={48} 
                color={colors.text} 
              />
              <Text style={[styles.emptyHistoryText, { color: colors.text }]}>
                {historyFilter === null ? t('noHistoryFound') : t('noHistoryFoundForFilter')}
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
  historyCloseButton: {
    padding: 8,
    borderRadius: 20,
  },
  historyFilterContainer: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  historyFilterLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  historyFilterScroll: {
    flexDirection: 'row',
  },
  historyFilterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
  },
  historyFilterButtonText: {
    fontSize: 12,
    fontWeight: '500',
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
    fontWeight: 'bold',
    flex: 1,
  },
  historyItemDate: {
    fontSize: 12,
    color: '#9E9E9E',
    marginTop: 2,
  },
  historyItemMetaContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 2,
  },
  historyItemMeta: {
    fontSize: 12,
    color: '#9E9E9E',
    marginLeft: 4,
  },
  historyItemPreview: {
    fontSize: 14,
    lineHeight: 20,
  },
  historyItemBadge: {
    padding: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  historyItemBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  deleteButton: {
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
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
  skeletonGradient: {
    flex: 1,
    borderRadius: 12,
    padding: responsiveSpacing(12),
  },
  skeletonText: {
    borderRadius: 4,
    backgroundColor: 'rgba(200, 200, 200, 0.3)',
  },
  skeletonBadge: {
    borderRadius: 12,
    backgroundColor: 'rgba(200, 200, 200, 0.3)',
  },
  quickContentContainer: {
    marginTop: 16,
    width: '100%',
  },
  quickContentTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  quickContentScroll: {
    flexDirection: 'row',
  },
  quickContentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
  },
  quickContentButtonText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  // New styles for dropdown selectors
  combinedSelectors: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    width: '100%',
  },
  selectorContainer: {
    width: '48%',
  },
  dropdownSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  dropdownText: {
    fontSize: 14,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    maxHeight: 300,
    borderRadius: 16,
    padding: 16,
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  selectedModalItem: {
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
  },
  modalItemText: {
    fontSize: 16,
  },
  promptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsiveSpacing(12),
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

export default ContentWriterContent;