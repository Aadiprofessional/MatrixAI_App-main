import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  DrawerLayoutAndroid,
  TouchableWithoutFeedback,
  Alert,
  Modal,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  BackHandler,
  Linking,
  Share,
  ScrollView,
  ActivityIndicator,
  Animated,
} from 'react-native';
import LottieView from 'lottie-react-native';
import * as Animatable from 'react-native-animatable';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
// Removed katex import - now using react-native-mathjax-svg via MathRenderer
import chartService from '../services/chartService';
import WebViewChart from '../components/WebViewChart';
import LinearGradient from 'react-native-linear-gradient';
import axios from 'axios';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import DocumentPicker from 'react-native-document-picker';
import { PDFDocument } from 'react-native-pdf-lib';
import RNFS from 'react-native-fs';
import { Buffer } from 'buffer';
import { decode } from 'base-64';
import { supabase } from '../supabaseClient';
import Toast from 'react-native-toast-message';
import { useTheme } from '../context/ThemeContext';
import LeftNavbarBot from '../components/LeftNavbarBot';
import Clipboard from '@react-native-clipboard/clipboard';
import RenderHtml from 'react-native-render-html';
import { marked } from 'marked';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCoinsSubscription } from '../hooks/useCoinsSubscription';
import { useAuthUser } from '../hooks/useAuthUser';
import ImageResizer from '@bam.tech/react-native-image-resizer';

import { 
  processImageUnderstanding, 
  processDocument, 
  generateXLSX, 
  generateDOC,
  getFileTypeCategory 
} from '../services/webhookService';
import { 
  processExcelDocument, 
  processPDFDocument, 
  processWordDocument,
  getDocumentProcessingMethod 
} from '../utils/documentProcessor';
import { 
  createNewChat,
  addUserMessageWithAttachment,
  getNewUserChats,
  getNewChatMessages,
  addUserMessage,
  startAssistantMessage,
  appendMessageChunk,
  finalizeMessage,
  updateNewChatTitle,
  supabaseMessageToFrontend,
  cancelMessage,
  getChatMessagesLazy,
  getLatestChatMessages,
  updateChatRole,
  frontendMessageToSupabase,
  subscribeToMessages,
  subscribeToChats,
  unsubscribeFromUpdates,
  getNewChat
} from '../services/chatService';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { REACT_APP_ALIYUN_API_KEY } from '@env';
import paymentService from '../services/paymentService';
import { useTranslation } from 'react-i18next';
import AttachmentComponent from '../components/AttachmentComponent';
import { parseMessageForAttachments, formatMessageText } from '../utils/messageParser';

import FilePreviewComponent from '../components/FilePreviewComponent';
import { uploadFileToStorage, validateFile, generateUniqueFileName, simpleUploadToStorage } from '../utils/fileUploadUtils';
import { analyzeMessageForImageNeeds, generateMultipleImages, createResponsePlan } from '../services/intelligentAgentService';
import StreamingService from '../services/streamingService';
import ImageSkeletonLoader from '../components/ImageSkeletonLoader';
import IntelligentImageContainer from '../components/IntelligentImageContainer';
import MathRenderer from '../components/MathRenderer';
import { containsMathContent, extractMathContent, formatMathContent, parseMixedContent } from '../utils/mathParser';



// Function to generate UUID v4
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Add this near the top of the BotScreen component
const persistEvent = (event) => {
  if (event && typeof event.persist === 'function') {
    event.persist();
  }
  return event;
};

// HTML formatting system prompt based on user requirements
const HTML_FORMATTING_SYSTEM_PROMPT = `You are an AI tutor assistant helping students with their homework and studies. Provide helpful, educational responses with clear explanations and examples that students can easily understand.

CRITICAL FORMATTING REQUIREMENTS:
1. **ALWAYS format your responses in HTML** - Never use plain text or markdown
2. Use proper HTML tags for structure: <h1>, <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <br>
3. For mathematical expressions, use proper HTML formatting or MathML when possible
4. For code examples, use <pre><code> tags with appropriate syntax highlighting classes
5. Use <blockquote> for important quotes or key concepts
6. Structure your response with clear headings and organized content

CHART.JS INTEGRATION:
When data visualization would be helpful, include Chart.js configuration in a <script> tag:
- Use chart types: line, bar, pie, doughnut, radar, polarArea
- Include proper data structure with labels and datasets
- Add responsive configuration and styling options

EXAMPLE HTML OUTPUT:
<h2>Understanding Photosynthesis</h2>
<p>Photosynthesis is the process by which <strong>plants convert sunlight into energy</strong>.</p>
<h3>Key Components:</h3>
<ul>
  <li><strong>Chlorophyll:</strong> The green pigment that captures light</li>
  <li><strong>Carbon Dioxide:</strong> Absorbed from the atmosphere</li>
  <li><strong>Water:</strong> Absorbed through the roots</li>
</ul>
<blockquote>
  <p><em>6CO₂ + 6H₂O + light energy → C₆H₁₂O₆ + 6O₂</em></p>
</blockquote>

FILE OPERATIONS:
For document and image uploads, use the n8n webhook endpoint:
- Endpoint: https://your-n8n-instance.com/webhook/file-upload
- Payload structure: {"file": "base64_content", "filename": "name.ext", "type": "document|image"}
- Supported types: PDF, DOC, DOCX, JPG, PNG, GIF

Always maintain educational focus while ensuring proper HTML formatting for optimal display.`;


  const BotScreen = ({ navigation, route }) => {
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();
  const { t } = useTranslation();
  // Default fallback values for route params - use useMemo to prevent re-generation
  const stableChatId = useMemo(() => {
    // Generate a proper UUID-like string instead of timestamp
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }, []);
  const { chatName, chatDescription, chatImage, chatid = stableChatId } = route?.params || {};
  
  // Use ref to track if we've already processed the initial chatid
  const initialChatIdProcessed = useRef(false);
  
  console.log('BotScreen initialized with chatid:', chatid);
  
  const flatListRef = React.useRef(null);
  const [chats, setChats] = useState([]);
  const [currentChatId, setCurrentChatId] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const currentChat = chats.find(chat => chat && chat.id === currentChatId) || { messages: [] };
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [showInput, setShowInput] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isImageProcessing, setIsImageProcessing] = useState(false); // OPTIMIZATION: Specific loading state for images
  const [isApiLoading, setIsApiLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false); // Track if data is loaded
  const [expandedMessages, setExpandedMessages] = useState({});
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [lastScrollTime, setLastScrollTime] = useState(0);

  const toggleMessageExpansion = (messageId) => {
    // Prevent scrolling to the end of the list when expanding a message
    setExpandedMessages(prev => ({
      ...prev,
      [messageId]: !prev[messageId]
    }));
  };
  const [showAdditionalButtons, setShowAdditionalButtons] = useState(false); 
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [currentRole, setCurrentRole] = useState('');
  
  // Radio button state for generate options
  const [selectedGenerateOption, setSelectedGenerateOption] = useState(null); // 'doc' or 'xlsx'
  
  // Add states for coins management
  const [sessionData, setSessionData] = useState(null);
  const { uid, loading } = useAuthUser();    
  const coinCount = useCoinsSubscription(uid);
  const [lowBalanceModalVisible, setLowBalanceModalVisible] = useState(false);
  const [requiredCoins, setRequiredCoins] = useState(1);
  const [lastCoinsDeducted, setLastCoinsDeducted] = useState(0);
  const [recentCoinDeductions, setRecentCoinDeductions] = useState(new Set()); // Track recent coin deductions by message ID
  
  // Modified image handling
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageType, setImageType] = useState('');
  const [imageFileName, setImageFileName] = useState('');
  const [fullScreenImage, setFullScreenImage] = useState(null);

  // File attachment states
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [showFileAttachmentSheet, setShowFileAttachmentSheet] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Add keyboard state tracking
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [isSendDisabled, setIsSendDisabled] = useState(false); // New state to track send button disabled state
  const swipeableRefs = useRef({});
  const lastScrolledMessageId = useRef(null);
  
  // Enhanced streaming service instance
  const streamingService = useRef(new StreamingService()).current;
  
  // Add debounce ref to prevent rapid successive calls
  const sendTimeoutRef = useRef(null);

  // Add new states and refs for scroll functionality
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [listHeight, setListHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  
  // Add state for skeleton loading
  const [isChatsLoading, setIsChatsLoading] = useState(true);
  const shimmerValue = useRef(new Animated.Value(0)).current;

  // Add state to track keyboard visibility
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  
  // Debounced data fetching refs
  const fetchTimeoutRef = useRef(null);
  const lastFetchTime = useRef(0);
  const FETCH_DEBOUNCE_DELAY = 300; // 300ms debounce
  const MIN_FETCH_INTERVAL = 1000; // Minimum 1 second between fetches
  
  // Pagination state for lazy loading
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [messageOffset, setMessageOffset] = useState(0);
  const MESSAGE_PAGE_SIZE = 20;
  
  // Intelligent Agent System States
  const [pendingImages, setPendingImages] = useState([]); // Track images being generated
  const [currentResponsePlan, setCurrentResponsePlan] = useState(null); // Current AI response plan
  const [streamingWithImages, setStreamingWithImages] = useState(false); // Track if streaming with images
  const [imageGenerationQueue, setImageGenerationQueue] = useState([]); // Queue for image generation
  const [generatedImages, setGeneratedImages] = useState(new Map()); // Map of generated images by ID
  
  // Track keyboard visibility with optimized listeners
  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setIsKeyboardVisible(true);
        // Removed auto-scroll on keyboard show to prevent unwanted scrolling
      }
    );
    
    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setIsKeyboardVisible(false);
        // Don't auto-scroll when keyboard hides to preserve user's scroll position
      }
    );

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
      // Cleanup timeout refs to prevent memory leaks
      if (sendTimeoutRef.current) {
        clearTimeout(sendTimeoutRef.current);
      }
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, []); // Remove messages.length dependency to prevent unnecessary re-renders

  // Fetch session data properly
  useEffect(() => {
    const fetchSessionData = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Error fetching session:', error);
        } else {
          setSessionData(data);
        }
      } catch (error) {
        console.error('Error in session fetch:', error);
      }
    };
    
    fetchSessionData();
  }, []);

  // Set initial chat ID from route params if available - prevent infinite updates
  useEffect(() => {
    const initializeChat = async () => {
      if (!initialChatIdProcessed.current && chatid && chatid !== 'undefined' && chatid !== 'null') {
        console.log('Setting initial chatid from route params:', chatid);
        
        // If user is authenticated and this is a new chat (UUID format), create it in Supabase
        if (sessionData?.session?.user && chatid.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          try {
            await createChat(sessionData.session.user.id, chatName || 'New Chat', currentRole || '', chatid);
          } catch (error) {
            console.log('Chat may already exist or error creating:', error);
          }
        }
        
        setCurrentChatId(chatid);
        initialChatIdProcessed.current = true;
      }
    };
    
    initializeChat();
  }, [chatid, sessionData, chatName]);
  
  // Start shimmer animation for skeleton loading
  useEffect(() => {
    if (isChatsLoading) {
      const startShimmerAnimation = () => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(shimmerValue, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(shimmerValue, {
              toValue: 0,
              duration: 1000,
              useNativeDriver: true,
            }),
          ])
        ).start();
      };
      
      startShimmerAnimation();
    }
  }, [isChatsLoading, shimmerValue]);

  // Add keyboard event listeners
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      }
    );

    // Handle back button press for dismissing keyboard
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (keyboardVisible) {
          Keyboard.dismiss();
          return true;
        }
        return false;
      }
    );

    // Cleanup event listeners
    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
      backHandler.remove();
    };
  }, []); // Remove keyboardVisible dependency to prevent unnecessary re-renders

  const onDeleteChat = async (chatId) => {
    try {
      // Ensure chatId is a string and store it locally to avoid synthetic event issues
      const chatToDelete = String(chatId);
      
      // Remove chat from local state
      setChats(prevChats => prevChats.filter(chat => chat.id !== chatToDelete));
      
      // If the deleted chat is the current chat, select another chat or start a new one
      if (chatToDelete === currentChatId) {
        const remainingChats = chats.filter(chat => chat.id !== chatToDelete);
        if (remainingChats.length > 0 && remainingChats[0] && remainingChats[0].id) {
          // Select the first available chat and keep the sidebar open
          selectChat(remainingChats[0].id, false);
        } else {
          // If no chats remain, start a new one
          const newChatId = generateUUID();
          startNewChat(newChatId);
        }
      }
      
      // Delete chat from Supabase using new schema
      const deleteSuccess = await deleteChat(chatToDelete, uid);
      
      if (!deleteSuccess) {
        console.error('Error deleting chat from Supabase');
        // Continue with local deletion even if server deletion fails
      } else {
        console.log('Chat deleted from Supabase');
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
      Alert.alert('Error', 'Failed to delete chat');
    }
  };

  // Function to preprocess HTML content for better formatting
  const preprocessHtmlContent = (html) => {
    if (!html) return html;
    
    try {
      let processedHtml = html;
      
      // Fix ordered list numbering by ensuring proper list structure
      processedHtml = processedHtml.replace(/<ol>/g, '<ol style="list-style-type: decimal; padding-left: 20px;">');
      processedHtml = processedHtml.replace(/<li>/g, '<li style="margin-bottom: 8px; display: list-item;">');
      
      // Conservative math expression wrapping - only wrap genuine mathematical expressions
      // First, temporarily replace existing math expressions to protect them
      const mathExpressions = [];
      let mathIndex = 0;
      
      // Protect existing LaTeX expressions
      processedHtml = processedHtml.replace(/\\\((.*?)\\\)/g, (match) => {
        mathExpressions[mathIndex] = match;
        return `__MATH_PLACEHOLDER_${mathIndex++}__`;
      });
      
      processedHtml = processedHtml.replace(/\\\[(.*?)\\\]/g, (match) => {
        mathExpressions[mathIndex] = match;
        return `__MATH_PLACEHOLDER_${mathIndex++}__`;
      });
      
      processedHtml = processedHtml.replace(/\$\$(.*?)\$\$/g, (match) => {
        mathExpressions[mathIndex] = match;
        return `__MATH_PLACEHOLDER_${mathIndex++}__`;
      });
      
      processedHtml = processedHtml.replace(/\$([^$\n]+?)\$/g, (match) => {
        mathExpressions[mathIndex] = match;
        return `__MATH_PLACEHOLDER_${mathIndex++}__`;
      });
      
      // Only wrap complex mathematical expressions, not single letters
      // Auto-wrap mathematical expressions with operators and symbols
      processedHtml = processedHtml.replace(/\|([A-Z])\|\s*=\s*(\d+)/g, (match, letter, number, offset, string) => {
        if (string.substring(offset - 10, offset + 10).includes('__MATH_PLACEHOLDER_')) {
          return match;
        }
        return `\\(|${letter}| = ${number}\\)`;
      });
      
      processedHtml = processedHtml.replace(/([A-Z])\s*∪\s*([A-Z])/g, (match, letter1, letter2, offset, string) => {
        if (string.substring(offset - 10, offset + 10).includes('__MATH_PLACEHOLDER_')) {
          return match;
        }
        return `\\(${letter1} \\cup ${letter2}\\)`;
      });
      
      processedHtml = processedHtml.replace(/([A-Z])\s*∩\s*([A-Z])/g, (match, letter1, letter2, offset, string) => {
        if (string.substring(offset - 10, offset + 10).includes('__MATH_PLACEHOLDER_')) {
          return match;
        }
        return `\\(${letter1} \\cap ${letter2}\\)`;
      });
      
      // Restore protected math expressions
      for (let i = mathExpressions.length - 1; i >= 0; i--) {
        processedHtml = processedHtml.replace(`__MATH_PLACEHOLDER_${i}__`, mathExpressions[i]);
      }
      
      return processedHtml;
    } catch (error) {
      console.error('Error preprocessing HTML content:', error);
      return html;
    }
  };

  // Function to process mathematical expressions for MathRenderer
  const processMathExpressions = (text) => {
    if (!text) return text;
    
    try {
      let processedText = text;
      
      // Handle display math: \[...\] and $$...$$
      processedText = processedText.replace(/\\\[([\s\S]*?)\\\]/g, (match, math) => {
        return `<div class="math-display" data-math="${math.trim()}" data-display="true"></div>`;
      });
      
      processedText = processedText.replace(/\$\$([\s\S]*?)\$\$/g, (match, math) => {
        return `<div class="math-display" data-math="${math.trim()}" data-display="true"></div>`;
      });
      
      // Handle inline math: \(...\) and $...$
      processedText = processedText.replace(/\\\(([\s\S]*?)\\\)/g, (match, math) => {
        return `<span class="math-inline" data-math="${math.trim()}" data-display="false"></span>`;
      });
      
      processedText = processedText.replace(/\$([^$\n]+?)\$/g, (match, math) => {
        return `<span class="math-inline" data-math="${math.trim()}" data-display="false"></span>`;
      });
      
      return processedText;
    } catch (error) {
      console.error('Error processing math expressions:', error);
      return text;
    }
  };

  // Function to process text with charts
  const processTextWithCharts = (text, isDarkMode = false) => {
    if (!text) return { text, charts: [] };
    
    try {
      const result = chartService.processTextWithCharts(text, isDarkMode);
      return result;
    } catch (error) {
      console.error('Error processing charts:', error);
      return { text, charts: [] };
    }
  };

  // Function to render charts using react-native-chart-kit
  const renderChart = (chartIdOrData, isDarkMode = false, width = 300) => {
    console.log('📊 [DEBUG] renderChart called with:', {
      chartIdOrData: chartIdOrData,
      isDarkMode: isDarkMode,
      width: width,
      isString: typeof chartIdOrData === 'string'
    });
    
    let chartData;
    
    // If it's a string, treat it as a chart ID and retrieve from service
    if (typeof chartIdOrData === 'string') {
      chartData = chartService.getChart(chartIdOrData);
      console.log('📊 [DEBUG] Retrieved chart data from service:', chartData);
    } else {
      // Otherwise, use it directly as chart data
      chartData = chartIdOrData;
    }
    
    if (!chartData || !chartData.type || !chartData.data) {
      console.log('❌ [DEBUG] renderChart: Missing required data, returning null');
      return null;
    }

    try {
      return (
        <WebViewChart
          chartData={chartData}
          width={width}
          height={220}
          isDarkMode={isDarkMode}
        />
      );
    } catch (error) {
      console.error('Error rendering chart:', error);
      return (
        <View style={{
          padding: 16,
          backgroundColor: isDarkMode ? 'rgba(255, 0, 0, 0.1)' : 'rgba(255, 0, 0, 0.05)',
          borderRadius: 8,
          marginVertical: 8
        }}>
          <Text style={{
            color: isDarkMode ? '#FF453A' : '#FF3B30',
            textAlign: 'center',
            fontSize: 14
          }}>
            Error rendering chart
          </Text>
        </View>
      );
    }
  };

const renderTextWithMath = (text, textStyle) => {
  if (!text) return null;
  
  console.log('📱 [DEBUG] renderTextWithMath called with text length:', text?.length);
  console.log('📱 [DEBUG] Input text preview:', text?.substring(0, 200) + '...');
  
  const { width } = Dimensions.get('window');
  const isDarkMode = colors.background === '#1C1C1E' || colors.background === '#000000';
  
  console.log('📱 [DEBUG] isDarkMode:', isDarkMode);
  console.log('📱 [DEBUG] Screen width:', width);
  
  // Preprocess HTML content for better formatting
  let preprocessedText = preprocessHtmlContent(text);
  console.log('📱 [DEBUG] After preprocessing, text length:', preprocessedText?.length);
  
  // Process mathematical expressions with KaTeX
  let processedText = processMathExpressions(preprocessedText);
  console.log('📱 [DEBUG] After math processing, text length:', processedText?.length);
  
  // Process charts
  const { text: textWithCharts, charts } = processTextWithCharts(processedText, isDarkMode);
  console.log('📱 [DEBUG] After chart processing - charts found:', charts?.length);
  console.log('📱 [DEBUG] Charts array:', charts);
  
  // Split text by chart placeholders and render content with charts inline
  const renderContentWithCharts = () => {
    if (!charts || charts.length === 0) {
      return (
        <RenderHtml
          contentWidth={width - 40}
          source={{ html: textWithCharts }}
          tagsStyles={getHtmlTagStyles(isDarkMode, textStyle, colors)}
        />
      );
    }

    const parts = [];
    let remainingText = textWithCharts;
    
    charts.forEach((chart, index) => {
      const placeholder = `[CHART:${chart.id}]`;
      const placeholderIndex = remainingText.indexOf(placeholder);
      
      if (placeholderIndex !== -1) {
        // Add text before chart
        const textBefore = remainingText.substring(0, placeholderIndex);
        if (textBefore.trim()) {
          parts.push({
            type: 'html',
            content: textBefore,
            key: `text-${index}`
          });
        }
        
        // Add chart
        parts.push({
          type: 'chart',
          chart: chart,
          key: `chart-${index}`
        });
        
        // Update remaining text
        remainingText = remainingText.substring(placeholderIndex + placeholder.length);
      }
    });
    
    // Add remaining text
    if (remainingText.trim()) {
      parts.push({
        type: 'html',
        content: remainingText,
        key: 'text-final'
      });
    }
    
    return parts.map((part) => {
      if (part.type === 'html') {
        return (
          <RenderHtml
            key={part.key}
            contentWidth={width - 40}
            source={{ html: part.content }}
            tagsStyles={getHtmlTagStyles(isDarkMode, textStyle, colors)}
          />
        );
      } else if (part.type === 'chart') {
        return (
          <View key={part.key} style={{
            marginVertical: 12,
            padding: 12,
            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.border || '#E0E0E0',
          }}>
            {part.chart.config?.options?.title?.text && (
              <Text style={{
                color: textStyle?.color || colors.text,
                fontSize: 16,
                textAlign: 'center',
                marginBottom: 12,
                fontWeight: '600'
              }}>
                {part.chart.config.options.title.text}
              </Text>
            )}
            {renderChart(part.chart.config, isDarkMode, width - 80)}
          </View>
        );
      }
      return null;
    });
  };
  
  return (
    <View>
      {renderContentWithCharts()}
    </View>
  );
};

// Helper function to get HTML tag styles
const getHtmlTagStyles = (isDarkMode, textStyle, colors) => ({
  body: {
    color: textStyle?.color || colors.text,
    fontSize: textStyle?.fontSize || 16,
    fontFamily: textStyle?.fontFamily || 'System',
    lineHeight: 1.5,
  },
  p: {
    marginVertical: 4,
  },
  h1: {
    fontSize: 24,
    fontWeight: 'bold',
    marginVertical: 8,
    color: textStyle?.color || colors.text,
  },
  h2: {
    fontSize: 20,
    fontWeight: 'bold',
    marginVertical: 6,
    color: textStyle?.color || colors.text,
  },
  h3: {
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 4,
    color: textStyle?.color || colors.text,
  },
  strong: {
    fontWeight: 'bold',
  },
  em: {
    fontStyle: 'italic',
  },
  code: {
    backgroundColor: isDarkMode ? 'rgba(40, 40, 40, 0.8)' : 'rgba(240, 240, 240, 0.8)',
    padding: 2,
    borderRadius: 4,
    fontFamily: 'monospace',
    color: textStyle?.color || colors.text,
  },
  pre: {
    backgroundColor: isDarkMode ? 'rgba(40, 40, 40, 0.8)' : 'rgba(240, 240, 240, 0.8)',
    padding: 8,
    borderRadius: 8,
    fontFamily: 'monospace',
    color: textStyle?.color || colors.text,
  },
  blockquote: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary || '#007AFF',
    paddingLeft: 12,
    marginVertical: 8,
    fontStyle: 'italic',
  },
  table: {
    borderWidth: 1,
    borderColor: colors.border || '#E0E0E0',
    marginVertical: 8,
  },
  td: {
    borderWidth: 1,
    borderColor: colors.border || '#E0E0E0',
    padding: 8,
  },
  th: {
    borderWidth: 1,
    borderColor: colors.border || '#E0E0E0',
    padding: 8,
    fontWeight: 'bold',
    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
  },
  // List styles
  ol: {
    marginVertical: 8,
    paddingLeft: 24,
    listStyleType: 'decimal',
    display: 'block',
  },
  ul: {
    marginVertical: 8,
    paddingLeft: 24,
    listStyleType: 'disc',
    display: 'block',
  },
  li: {
    marginVertical: 6,
    paddingLeft: 4,
    lineHeight: 1.6,
    color: textStyle?.color || colors.text,
    display: 'list-item',
    listStylePosition: 'outside',
  },
  // KaTeX math styles
  '.math-display': {
    textAlign: 'center',
    marginVertical: 12,
    padding: 8,
    display: 'block',
  },
  '.math-inline': {
    display: 'inline-block',
    verticalAlign: 'baseline',
    whiteSpace: 'nowrap',
  },
  '.math-error': {
    color: '#cc0000',
    backgroundColor: isDarkMode ? 'rgba(204, 0, 0, 0.1)' : 'rgba(204, 0, 0, 0.05)',
    padding: 4,
    borderRadius: 4,
    fontFamily: 'monospace',
  },
});
  // Helper function to check if text contains math expressions

  // Function to parse intelligent messages with image skeletons, images, charts, and math content
  const parseIntelligentMessage = (messageText) => {
    const parts = [];
    let currentIndex = 0;
    
    // First, check for special tags (images, charts, etc.)
    // Regex patterns for image skeleton, image tags, and chart tags
    const imageSkeletonRegex = /\[IMAGE_SKELETON:([^:]+):([^\]]+)\]/g;
    const imageRegex = /\[IMAGE:([^:]+):([^\]]+)\]/g;
    const imageErrorRegex = /\[IMAGE_ERROR:([^\]]+)\]/g;
    const chartRegex = /\[CHART:([^\]]+)\]/g;
    
    // Find all matches
    const allMatches = [];
    
    let match;
    while ((match = imageSkeletonRegex.exec(messageText)) !== null) {
      allMatches.push({
        type: 'skeleton',
        index: match.index,
        length: match[0].length,
        id: match[1],
        description: match[2],
        fullMatch: match[0]
      });
    }
    
    imageSkeletonRegex.lastIndex = 0;
    while ((match = imageRegex.exec(messageText)) !== null) {
      allMatches.push({
        type: 'image',
        index: match.index,
        length: match[0].length,
        url: match[1],
        description: match[2],
        fullMatch: match[0]
      });
    }
    
    imageRegex.lastIndex = 0;
    while ((match = imageErrorRegex.exec(messageText)) !== null) {
      allMatches.push({
        type: 'error',
        index: match.index,
        length: match[0].length,
        message: match[1],
        fullMatch: match[0]
      });
    }
    
    imageErrorRegex.lastIndex = 0;
    while ((match = chartRegex.exec(messageText)) !== null) {
      allMatches.push({
        type: 'chart',
        index: match.index,
        length: match[0].length,
        chartId: match[1],
        fullMatch: match[0]
      });
    }
    
    // Sort matches by index
    allMatches.sort((a, b) => a.index - b.index);
    
    // Build parts array
    allMatches.forEach((match, i) => {
      // Add text before this match (parse for mixed content)
      if (match.index > currentIndex) {
        const textPart = messageText.substring(currentIndex, match.index);
        if (textPart.trim()) {
          // Parse this text part for mixed content (text + math)
          const mixedParts = parseMixedContent(textPart);
          parts.push(...mixedParts);
        }
      }
      
      // Add the match
      parts.push(match);
      
      currentIndex = match.index + match.length;
    });
    
    // Add remaining text (parse for mixed content)
    if (currentIndex < messageText.length) {
      const remainingText = messageText.substring(currentIndex);
      if (remainingText.trim()) {
        // Parse this remaining text for mixed content (text + math)
        const mixedParts = parseMixedContent(remainingText);
        parts.push(...mixedParts);
      }
    }
    
    // If no special tags found, parse the entire message for mixed content
    if (parts.length === 0) {
      const mixedParts = parseMixedContent(messageText);
      parts.push(...mixedParts);
    }
    
    return parts;
  };

  const sendMessageToAI = async (message, imageUrl = null, onChunk = null) => {
    return new Promise(async (resolve, reject) => {
      try {
        // First, analyze if the message needs images using intelligent agent
        const imageAnalysis = await analyzeMessageForImageNeeds(message);
        
        let responsePlan = null;
        let imagePromises = [];
        let pendingImageData = [];
        
        if (imageAnalysis.needsImages && imageAnalysis.imageCount > 0) {
          console.log('🎨 Intelligent Agent detected need for', imageAnalysis.imageCount, 'images');
          
          // Set streaming with images flag
          setStreamingWithImages(true);
          
          // Create response plan
          responsePlan = await createResponsePlan(message, imageAnalysis);
          setCurrentResponsePlan(responsePlan);
          
          // Start parallel image generation
          imagePromises = await generateMultipleImages(
            imageAnalysis.imageDescriptions,
            user?.id || 'anonymous',
            50 // coin cost per image
          );
          
          // Track pending images
          pendingImageData = imageAnalysis.imageDescriptions.map((desc, index) => ({
            id: `img_${Date.now()}_${index}`,
            description: desc,
            status: 'generating',
            promise: imagePromises[index],
            insertionPoint: responsePlan.imageInsertionPoints[index]?.position || 80 * (index + 1)
          }));
          
          setPendingImages(pendingImageData);
          
          // Handle image generation completion
          imagePromises.forEach(async (promise, index) => {
            try {
              const result = await promise;
              setGeneratedImages(prev => {
                const newMap = new Map(prev);
                newMap.set(pendingImageData[index].id, result);
                return newMap;
              });
              
              // Update pending images status
              setPendingImages(prev => prev.map(img => 
                img.id === pendingImageData[index].id 
                  ? { ...img, status: 'completed', imageUrl: result.imageUrl }
                  : img
              ));
            } catch (error) {
              console.error('Image generation failed:', error);
              setPendingImages(prev => prev.map(img => 
                img.id === pendingImageData[index].id 
                  ? { ...img, status: 'failed' }
                  : img
              ));
            }
          });
        }

        // Prepare API messages array with system message
        const apiMessages = [ 
          { 
            role: "system", 
            content: [ 
              { 
                type: "text", 
                text: `You are an advanced AI assistant with expertise in multiple domains. You must format your responses using specific HTML tags and follow these strict guidelines:

FORMATTING REQUIREMENTS:
- Use <h1>, <h2>, <h3> for headers
- Use <p> for paragraphs
- Use <strong> for bold text
- Use <em> for italic text
- Use <ul>, <ol>, <li> for lists
- Use <blockquote> for quotes

CHART GENERATION:
When users request charts, graphs, or data visualizations, create them using Chart.js code blocks:
\`\`\`chartjs
{
  "type": "line|bar|pie|doughnut|scatter|bubble|polarArea|radar",
  "data": {
    "labels": ["Label1", "Label2", ...],
    "datasets": [{
      "label": "Dataset Name",
      "data": [value1, value2, ...]
    }]
  },
  "options": {
    "responsive": true,
    "plugins": {
      "title": {
        "display": true,
        "text": "Chart Title"
      }
    }
  }
}
\`\`\`

MATHEMATICAL EXPRESSIONS:
- Use LaTeX syntax for mathematical expressions only: $inline$ or $$display$$
- Support both inline \\(...\\) and display \\[...\\] formats
- Only wrap actual mathematical expressions, formulas, and equations - not single letters or variables

Always provide helpful, accurate, and well-formatted responses.`
              } 
            ] 
          }
        ];

        // Add conversation history from current chat (excluding loading and streaming messages)
        const conversationHistory = messages.filter(msg => 
          !msg.isLoading && 
          !msg.isStreaming && 
          msg.sender && 
          msg.text && 
          msg.text.trim() !== ''
        );

        // Add previous messages to maintain context (limit to last 10 exchanges to avoid token limits)
        const recentHistory = conversationHistory.slice(-20); // Last 20 messages (10 exchanges)
        
        recentHistory.forEach(msg => {
          if (msg.sender === 'user') {
            const userMessage = {
              role: "user",
              content: []
            };
            
            // Add text content
            if (msg.text) {
              userMessage.content.push({
                type: "text",
                text: msg.text
              });
            }
            
            // Add image if the message has one
            if (msg.image) {
              userMessage.content.push({
                type: "image_url",
                image_url: {
                  url: msg.image
                }
              });
            }
            
            apiMessages.push(userMessage);
           } else if (msg.sender === 'bot') {
             apiMessages.push({
               role: "assistant",
               content: [{
                 type: "text",
                 text: msg.text
               }]
             });
           }
         });

         // Add the current user message
         const currentUserMessage = {
           role: "user",
           content: []
         };

         // Add text content for current message
         currentUserMessage.content.push({
           type: "text",
           text: `Please help me with this question or topic: ${message}`
         });

         // Add image if provided for current message
         if (imageUrl) {
           currentUserMessage.content.push({
             type: "image_url",
             image_url: {
               url: imageUrl
             }
           });
         }

         apiMessages.push(currentUserMessage);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', true);
        xhr.setRequestHeader('Authorization', `Bearer ${REACT_APP_ALIYUN_API_KEY}`);
        xhr.setRequestHeader('Content-Type', 'application/json');

        let fullContent = '';
        let processedLength = 0; // Track how much we've already processed
        let isFirstChunk = true;
        let charCount = 0;
        let nextImageIndex = 0;

        // Intelligent chunk handler for image insertion
        const handleIntelligentChunk = async (content_chunk) => {
          charCount += content_chunk.length;
          
          // Check if we need to insert an image at this point
          if (pendingImageData.length > 0 && 
              nextImageIndex < pendingImageData.length && 
              charCount >= pendingImageData[nextImageIndex].insertionPoint) {
            
            const pendingImage = pendingImageData[nextImageIndex];
            
            if (pendingImage.status === 'generating') {
              // Show skeleton loader and wait for image
              if (onChunk) {
                onChunk(content_chunk + `\n[IMAGE_SKELETON:${pendingImage.id}:${pendingImage.description}]\n`);
              }
              
              // Wait for image to complete
              try {
                await pendingImage.promise;
                const generatedImage = generatedImages.get(pendingImage.id);
                if (generatedImage && onChunk) {
                  onChunk(`[IMAGE:${generatedImage.imageUrl}:${pendingImage.description}]\n`);
                }
              } catch (error) {
                console.error('Failed to wait for image:', error);
                if (onChunk) {
                  onChunk(`[IMAGE_ERROR:Failed to generate image]\n`);
                }
              }
            } else if (pendingImage.status === 'completed' && pendingImage.imageUrl) {
              // Image is ready, insert it
              if (onChunk) {
                onChunk(content_chunk + `\n[IMAGE:${pendingImage.imageUrl}:${pendingImage.description}]\n`);
              }
            } else {
              // Normal text streaming
              if (onChunk) onChunk(content_chunk);
            }
            
            nextImageIndex++;
          } else {
            // Normal text streaming
            if (onChunk) onChunk(content_chunk);
          }
        };

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
                  
                  // Check if data is empty or undefined
                  if (!data || data === 'undefined' || data === '') {
                    console.log('⚠️ Empty or undefined data, skipping');
                    continue;
                  }
                  
                  try {
                    const parsed = JSON.parse(data);
                    let content_chunk = null;
                    
                    // Handle standard OpenAI format
                    if (parsed.choices?.[0]?.delta?.content) {
                      content_chunk = parsed.choices[0].delta.content;
                    }
                    // Handle n8n format - only extract content from "item" type messages
                    else if (parsed.type === 'item' && parsed.content) {
                      content_chunk = parsed.content;
                    }
                    // Skip n8n metadata messages (type: "begin", "end", etc.)
                    else if (parsed.type && parsed.type !== 'item') {
                      continue;
                    }
                    
                    if (content_chunk) {
                      if (isFirstChunk) {
                        console.log('📝 First content chunk received');
                        isFirstChunk = false;
                      }
                      
                      fullContent += content_chunk;
                      
                      // Use intelligent chunk handler for real-time updates with image insertion
                      handleIntelligentChunk(content_chunk);
                    }
                  } catch (parseError) {
                    // Skip invalid JSON lines
                    continue;
                  }
                }
                // Handle n8n format without "data: " prefix
                else if (line.trim().startsWith('{')) {
                  const trimmedLine = line.trim();
                  
                  // Check if trimmedLine is empty or undefined
                  if (!trimmedLine || trimmedLine === 'undefined' || trimmedLine === '') {
                    console.log('⚠️ Empty or undefined line, skipping');
                    continue;
                  }
                  
                  try {
                    const parsed = JSON.parse(trimmedLine);
                    // Only process n8n "item" type messages with content
                    if (parsed.type === 'item' && parsed.content) {
                      const content_chunk = parsed.content;
                      
                      if (isFirstChunk) {
                        console.log('📝 First content chunk received (n8n format)');
                        isFirstChunk = false;
                      }
                      
                      fullContent += content_chunk;
                      
                      // Use intelligent chunk handler for real-time updates with image insertion
                      handleIntelligentChunk(content_chunk);
                    }
                    // Skip n8n metadata messages
                  } catch (parseError) {
                    // Skip invalid JSON lines
                    continue;
                  }
                }
              }
            }
            
            // If request is complete
            if (xhr.readyState === 4) {
              // Reset intelligent agent states
              setStreamingWithImages(false);
              setCurrentResponsePlan(null);
              setPendingImages([]);
              
              if (xhr.status === 200) {
                console.log('✅ AI Tutor API request completed successfully');
                console.log('📊 Final content length:', fullContent.length);
                resolve(fullContent.trim() || 'I apologize, but I could not generate a response. Please try again.');
              } else {
                console.error('❌ API request failed:', xhr.status, xhr.statusText);
                reject(new Error(`API call failed: ${xhr.status} ${xhr.statusText}`));
              }
            }
          }
        };

        xhr.onerror = function() {
          console.error('💥 XMLHttpRequest error');
          setStreamingWithImages(false);
          setCurrentResponsePlan(null);
          setPendingImages([]);
          reject(new Error('Failed to get response from AI. Please try again.'));
        };

        xhr.ontimeout = function() {
          console.error('💥 XMLHttpRequest timeout');
          setStreamingWithImages(false);
          setCurrentResponsePlan(null);
          setPendingImages([]);
          reject(new Error('Request timed out. Please try again.'));
        };

        xhr.timeout = 60000; // 60 second timeout

        const requestBody = JSON.stringify({
          model: "qwen-max",
          messages: apiMessages,
          stream: true
        });

        console.log('📊 Sending request to API...');
        xhr.send(requestBody);

      } catch (error) {
        console.error('💥 Error in sendMessageToAI:', error);
        setStreamingWithImages(false);
        setCurrentResponsePlan(null);
        setPendingImages([]);
        reject(new Error('Failed to get response from AI. Please try again.'));
      }
    });
  };

  // Streaming function for Generate XLSX
  const generateXLSXStreaming = async (prompt, onChunk) => {
    return new Promise(async (resolve, reject) => {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://matrixai212.app.n8n.cloud/webhook/aea0cafd-493a-4217-a29c-501a11cccbb8');
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('Accept', 'text/event-stream');

        let fullResponse = '';
        let processedLength = 0;
        let finalContent = '';
        let hasStartedFinalResponse = false;

        xhr.onreadystatechange = function() {
          if (xhr.readyState === XMLHttpRequest.LOADING || xhr.readyState === XMLHttpRequest.DONE) {
            const responseText = xhr.responseText;
            const newContent = responseText.substring(processedLength);
            processedLength = responseText.length;
            
            if (newContent && onChunk) {
              // Parse streaming content - handle structured JSON format from webhook
              // Handle multiple JSON objects that might be concatenated together
              const extractJsonObjects = (text) => {
                const objects = [];
                let depth = 0;
                let start = -1;
                let inString = false;
                let escaped = false;
                
                for (let i = 0; i < text.length; i++) {
                  const char = text[i];
                  
                  if (escaped) {
                    escaped = false;
                    continue;
                  }
                  
                  if (char === '\\' && inString) {
                    escaped = true;
                    continue;
                  }
                  
                  if (char === '"') {
                    inString = !inString;
                    continue;
                  }
                  
                  if (!inString) {
                    if (char === '{') {
                      if (depth === 0) start = i;
                      depth++;
                    } else if (char === '}') {
                      depth--;
                      if (depth === 0 && start !== -1) {
                        const jsonStr = text.substring(start, i + 1);
                        try {
                          const obj = JSON.parse(jsonStr);
                          objects.push(obj);
                        } catch (e) {
                          // Skip invalid JSON
                        }
                        start = -1;
                      }
                    }
                  }
                }
                return objects;
              };
              
              const lines = newContent.split('\n');
              
              for (const line of lines) {
                if (line.trim()) {
                  // Try to extract JSON objects from the line
                  const jsonObjects = extractJsonObjects(line.trim());
                  
                  if (jsonObjects.length > 0) {
                    // Process each JSON object
                    for (const chunk of jsonObjects) {
                      // Handle structured streaming responses from n8n webhook
                      if (chunk.type === 'begin') {
                        // Start of a new content stream
                        if (!hasStartedFinalResponse) {
                          hasStartedFinalResponse = true;
                          finalContent = '';
                          onChunk('__RESET__');
                        }
                      } else if (chunk.type === 'item' && chunk.content) {
                        // Check if this is JSON content that we want to skip
                        if (typeof chunk.content === 'string') {
                          // Skip various JSON patterns that shouldn't be displayed
                          if (chunk.content.startsWith('{"output":') ||
                              chunk.content.startsWith('{"type":') ||
                              chunk.content.includes('"metadata":') ||
                              chunk.content.includes('"nodeId":') ||
                              chunk.content.includes('"itemIndex":') ||
                              chunk.content.includes('"runIndex":') ||
                              chunk.content.includes('"timestamp":') ||
                              chunk.content.includes('type":"item') ||
                              chunk.content.includes('content":"') ||
                              chunk.content.includes('"type":"item"') ||
                              chunk.content.includes('"content":"') ||
                              chunk.content.match(/^\s*\{\s*"type"\s*:\s*"item"/) ||
                              chunk.content.match(/^\s*\{\s*"content"\s*:\s*"/) ||
                              (chunk.content.startsWith('{') && chunk.content.includes('"Agent1"'))) {
                            // This is JSON metadata or structured data - skip it completely
                            console.log('🚫 Skipping JSON metadata chunk:', chunk.content.substring(0, 50) + '...');
                            continue;
                          }
                        }
                        
                        // Stream content chunks (only the actual content, not metadata)
                        if (hasStartedFinalResponse) {
                          finalContent += chunk.content;
                          onChunk(chunk.content);
                        }
                      } else if (chunk.type === 'end') {
                        // End of content stream - continue to next stream if any
                        continue;
                      }
                    }
                  } else {
                    // This is plain text, not JSON - handle as fallback
                    const trimmedLine = line.trim();
                    
                    // Skip JSON patterns even in plain text
                    if (trimmedLine.includes('{"type":"item"') ||
                        trimmedLine.includes('"content":"') ||
                        trimmedLine.includes('type":"item') ||
                        trimmedLine.includes('content":"') ||
                        trimmedLine.match(/^\s*\{\s*"type"\s*:\s*"item"/) ||
                        trimmedLine.match(/^\s*\{\s*"content"\s*:\s*"/)) {
                      console.log('🚫 Skipping JSON in plain text:', trimmedLine.substring(0, 50) + '...');
                      continue;
                    }
                    
                    if (!hasStartedFinalResponse) {
                      hasStartedFinalResponse = true;
                      finalContent = trimmedLine;
                      onChunk('__RESET__');
                      onChunk(trimmedLine);
                    } else {
                      // Add new plain text content
                      finalContent += '\n' + trimmedLine;
                      onChunk('\n' + trimmedLine);
                    }
                  }
                }
              }
            }
            
            fullResponse = responseText;
            
            if (xhr.readyState === XMLHttpRequest.DONE) {
              if (xhr.status === 200) {
                // Return only the final content, never return fullResponse to avoid unwanted JSON output
                resolve(finalContent || '');
              } else {
                reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
              }
            }
          }
        };

        xhr.onerror = function() {
          reject(new Error('Failed to generate XLSX. Please try again.'));
        };

        xhr.ontimeout = function() {
          reject(new Error('Request timed out. Please try again.'));
        };

        xhr.timeout = 60000;

        // Get authenticated user UID
        const { data: { session } } = await supabase.auth.getSession();
        const userUID = session?.user?.id || uid || '';
        
        if (!userUID) {
          reject(new Error('User not authenticated - cannot generate XLSX'));
          return;
        }
        
        const requestBody = JSON.stringify({
          messages: [
            {
              uid: userUID,
              type: "sheet_generate",
              text: {
                body: prompt
              }
            }
          ],
          stream: true
        });

        console.log('📤 Sending XLSX generation request to n8n webhook:', requestBody);
        xhr.send(requestBody);
      } catch (error) {
        console.error('Error in generateXLSXStreaming:', error);
        reject(new Error('Failed to generate XLSX. Please try again.'));
      }
    });
  };

  // Streaming function for Generate DOC
  const generateDOCStreaming = async (prompt, onChunk) => {
    return new Promise(async (resolve, reject) => {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://matrixai212.app.n8n.cloud/webhook/aea0cafd-493a-4217-a29c-501a11cccbb8');
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('Accept', 'text/event-stream');

        let fullResponse = '';
        let processedLength = 0;
        let finalContent = '';
        let hasStartedFinalResponse = false;

        xhr.onreadystatechange = function() {
          if (xhr.readyState === XMLHttpRequest.LOADING || xhr.readyState === XMLHttpRequest.DONE) {
            const responseText = xhr.responseText;
            const newContent = responseText.substring(processedLength);
            processedLength = responseText.length;
            
            if (newContent && onChunk) {
              // Parse streaming content - handle structured JSON format from webhook
              // Handle multiple JSON objects that might be concatenated together
              const extractJsonObjects = (text) => {
                const objects = [];
                let depth = 0;
                let start = -1;
                let inString = false;
                let escaped = false;
                
                for (let i = 0; i < text.length; i++) {
                  const char = text[i];
                  
                  if (escaped) {
                    escaped = false;
                    continue;
                  }
                  
                  if (char === '\\' && inString) {
                    escaped = true;
                    continue;
                  }
                  
                  if (char === '"') {
                    inString = !inString;
                    continue;
                  }
                  
                  if (!inString) {
                    if (char === '{') {
                      if (depth === 0) start = i;
                      depth++;
                    } else if (char === '}') {
                      depth--;
                      if (depth === 0 && start !== -1) {
                        const jsonStr = text.substring(start, i + 1);
                        try {
                          const obj = JSON.parse(jsonStr);
                          objects.push(obj);
                        } catch (e) {
                          // Skip invalid JSON
                        }
                        start = -1;
                      }
                    }
                  }
                }
                return objects;
              };
              
              const lines = newContent.split('\n');
              
              for (const line of lines) {
                if (line.trim()) {
                  // Try to extract JSON objects from the line
                  const jsonObjects = extractJsonObjects(line.trim());
                  
                  if (jsonObjects.length > 0) {
                    // Process each JSON object
                    for (const chunk of jsonObjects) {
                      // Handle structured streaming responses from n8n webhook
                      if (chunk.type === 'begin') {
                        // Start of a new content stream
                        if (!hasStartedFinalResponse) {
                          hasStartedFinalResponse = true;
                          finalContent = '';
                          onChunk('__RESET__');
                        }
                      } else if (chunk.type === 'item' && chunk.content) {
                        // Check if this is JSON content that we want to skip
                        if (typeof chunk.content === 'string') {
                          // Skip various JSON patterns that shouldn't be displayed
                          if (chunk.content.startsWith('{"output":') ||
                              chunk.content.startsWith('{"type":') ||
                              chunk.content.includes('"metadata":') ||
                              chunk.content.includes('"nodeId":') ||
                              chunk.content.includes('"itemIndex":') ||
                              chunk.content.includes('"runIndex":') ||
                              chunk.content.includes('"timestamp":') ||
                              chunk.content.includes('type":"item') ||
                              chunk.content.includes('content":"') ||
                              chunk.content.includes('"type":"item"') ||
                              chunk.content.includes('"content":"') ||
                              chunk.content.match(/^\s*\{\s*"type"\s*:\s*"item"/) ||
                              chunk.content.match(/^\s*\{\s*"content"\s*:\s*"/) ||
                              (chunk.content.startsWith('{') && chunk.content.includes('"Agent1"'))) {
                            // This is JSON metadata or structured data - skip it completely
                            console.log('🚫 Skipping JSON metadata chunk:', chunk.content.substring(0, 50) + '...');
                            continue;
                          }
                        }
                        
                        // Stream content chunks (only the actual content, not metadata)
                        if (hasStartedFinalResponse) {
                          finalContent += chunk.content;
                          onChunk(chunk.content);
                        }
                      } else if (chunk.type === 'end') {
                        // End of content stream - continue to next stream if any
                        continue;
                      }
                    }
                  } else {
                    // This is plain text, not JSON - handle as fallback
                    const trimmedLine = line.trim();
                    
                    // Skip JSON patterns even in plain text
                    if (trimmedLine.includes('{"type":"item"') ||
                        trimmedLine.includes('"content":"') ||
                        trimmedLine.includes('type":"item') ||
                        trimmedLine.includes('content":"') ||
                        trimmedLine.match(/^\s*\{\s*"type"\s*:\s*"item"/) ||
                        trimmedLine.match(/^\s*\{\s*"content"\s*:\s*"/)) {
                      console.log('🚫 Skipping JSON in plain text:', trimmedLine.substring(0, 50) + '...');
                      continue;
                    }
                    
                    if (!hasStartedFinalResponse) {
                      hasStartedFinalResponse = true;
                      finalContent = trimmedLine;
                      onChunk('__RESET__');
                      onChunk(trimmedLine);
                    } else {
                      // Add new plain text content
                      finalContent += '\n' + trimmedLine;
                      onChunk('\n' + trimmedLine);
                    }
                  }
                }
              }
            }
            
            fullResponse = responseText;
            
            if (xhr.readyState === XMLHttpRequest.DONE) {
              if (xhr.status === 200) {
                // Return only the final content, never return fullResponse to avoid unwanted JSON output
                resolve(finalContent || '');
              } else {
                reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
              }
            }
          }
        };

        xhr.onerror = function() {
          reject(new Error('Failed to generate DOC. Please try again.'));
        };

        xhr.ontimeout = function() {
          reject(new Error('Request timed out. Please try again.'));
        };

        xhr.timeout = 60000;

        // Get authenticated user UID
        const { data: { session } } = await supabase.auth.getSession();
        const userUID = session?.user?.id || uid || '';
        
        if (!userUID) {
          reject(new Error('User not authenticated - cannot generate DOC'));
          return;
        }
        
        const requestBody = JSON.stringify({
          messages: [
            {
              uid: userUID,
              type: "document_generate",
              text: {
                body: prompt
              }
            }
          ],
          stream: true
        });

        console.log('📤 Sending DOC generation request to n8n webhook:', requestBody);
        xhr.send(requestBody);
      } catch (error) {
        console.error('Error in generateDOCStreaming:', error);
        reject(new Error('Failed to generate DOC. Please try again.'));
      }
    });
  };

  // Streaming function for Image Understanding
  const imageUnderstandingStreaming = async (prompt, imageUrl, onChunk) => {
    return new Promise(async (resolve, reject) => {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://matrixai212.app.n8n.cloud/webhook/aea0cafd-493a-4217-a29c-501a11cccbb8');
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('Accept', 'text/event-stream');

        let fullResponse = '';
        let processedLength = 0;

        xhr.onreadystatechange = function() {
          if (xhr.readyState === XMLHttpRequest.LOADING || xhr.readyState === XMLHttpRequest.DONE) {
            const responseText = xhr.responseText;
            const newContent = responseText.substring(processedLength);
            processedLength = responseText.length;

            if (newContent) {
              const lines = newContent.split('\n');
              
              for (const line of lines) {
                if (line.trim()) {
                  try {
                    // Handle data: prefixed lines (OpenAI format)
                    if (line.startsWith('data: ')) {
                      const jsonStr = line.substring(6).trim();
                      if (jsonStr === '[DONE]') {
                        continue;
                      }
                      
                      try {
                        const parsed = JSON.parse(jsonStr);
                        if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content) {
                          const chunk = parsed.choices[0].delta.content;
                          fullResponse += chunk;
                          if (onChunk) onChunk(chunk);
                        }
                      } catch (parseError) {
                        // If JSON parsing fails, treat as plain text
                        const chunk = jsonStr;
                        fullResponse += chunk;
                        if (onChunk) onChunk(chunk);
                      }
                    } else {
                      // Handle n8n format or plain text
                      try {
                        const parsed = JSON.parse(line);
                        if (parsed.content) {
                          const chunk = parsed.content;
                          fullResponse += chunk;
                          if (onChunk) onChunk(chunk);
                        } else if (parsed.text) {
                          const chunk = parsed.text;
                          fullResponse += chunk;
                          if (onChunk) onChunk(chunk);
                        }
                      } catch (parseError) {
                        // If JSON parsing fails, treat as plain text
                        const chunk = line;
                        fullResponse += chunk;
                        if (onChunk) onChunk(chunk);
                      }
                    }
                  } catch (error) {
                    console.error('Error processing chunk:', error);
                  }
                }
              }
            }

            if (xhr.readyState === XMLHttpRequest.DONE) {
              if (xhr.status === 200) {
                resolve(fullResponse);
              } else {
                reject(new Error(`HTTP ${xhr.status}: Failed to understand image. Please try again.`));
              }
            }
          }
        };

        xhr.onerror = function() {
          reject(new Error('Network error occurred while understanding image. Please check your connection.'));
        };

        xhr.ontimeout = function() {
          reject(new Error('Request timed out. Please try again.'));
        };

        xhr.timeout = 60000;

        // Get authenticated user UID
        const { data: { session } } = await supabase.auth.getSession();
        const userUID = session?.user?.id || uid || '';
        
        if (!userUID) {
          reject(new Error('User not authenticated - cannot understand image'));
          return;
        }
        
        const requestBody = JSON.stringify({
          messages: [
            {
              uid: userUID,
              type: "image_understanding",
              text: {
                body: prompt
              },
              image_url: imageUrl
            }
          ],
          stream: true
        });

        console.log('📤 Sending image understanding request to n8n webhook:', requestBody);
        xhr.send(requestBody);
      } catch (error) {
        console.error('Error in imageUnderstandingStreaming:', error);
        reject(new Error('Failed to understand image. Please try again.'));
      }
    });
  };

  const fetchDeepSeekResponse = async (userMessage, retryCount = 0) => {
    try {
      console.log('🚀 fetchDeepSeekResponse called with message:', userMessage);
      
      // Check if user has enough coins (1 coin required for chat)
      if (coinCount < 1) {
        console.log('❌ Insufficient coins, showing modal');
        setRequiredCoins(1);
        setLowBalanceModalVisible(true);
        return;
      }
      
      setIsLoading(true);
      console.log('⏳ Set loading to true');
      
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession();
      const userId = uid || session?.user?.id || 'anonymous';
      console.log('👤 User ID:', userId);
      
      console.log('🎯 Starting enhanced streaming with parallel image generation...');
      
      // Step 1: Create response plan with parallel image generation
      const conversationHistory = messages
        .filter(msg => !msg.isLoading && !msg.isStreaming && msg.text)
        .slice(-6) // Last 6 messages for context
        .map(msg => ({ sender: msg.sender, text: msg.text }));
      
      const responsePlan = await createResponsePlan(userMessage, conversationHistory, userId);
      console.log('Response plan created:', responsePlan);
      
      // Start assistant message in database if authenticated
      let assistantMessageId = null;
      if (userId !== 'anonymous') {
        try {
          const assistantMessage = await startAssistantMessage(
            currentChatId,
            userId,
            {},
            Date.now().toString()
          );
          assistantMessageId = assistantMessage?.id || null;
        } catch (error) {
          console.error('Error starting assistant message:', error);
          assistantMessageId = null;
        }
      }
      
      // Create a streaming bot message that will be updated in real-time
      const streamingMessageId = assistantMessageId || 'streaming-' + Date.now().toString();
      let streamingContent = '';
      
      // Add initial empty streaming message
      setMessages(prev => {
        // Filter out any loading messages
        const messagesWithoutLoading = prev.filter(msg => !msg.isLoading);
        // Add the streaming message
        return [...messagesWithoutLoading, {
          id: streamingMessageId,
          text: '',
          sender: 'bot',
          isStreaming: true,
          images: [] // Initialize images array for this message
        }];
      });

      // Define callbacks for the enhanced streaming
      const handleTextChunk = async (chunk) => {
        console.log('📝 Received text chunk:', chunk);
        streamingContent += chunk;
        
        // Update the streaming message in real-time
        setMessages(prev => prev.map(msg => 
          msg.id === streamingMessageId 
            ? { ...msg, text: streamingContent }
            : msg
        ));
        
        // Append chunk to database if authenticated
        if (assistantMessageId) {
          await appendMessageChunk(assistantMessageId, chunk);
        }
      };

      const handleImageReady = (imageTask) => {
        console.log(`Image ready for insertion: ${imageTask.id}`);
        
        // Add image to the streaming message
        setMessages(prev => prev.map(msg => 
          msg.id === streamingMessageId 
            ? { 
                ...msg, 
                images: [...(msg.images || []), {
                  id: imageTask.id,
                  url: imageTask.imageUrl,
                  description: imageTask.description,
                  insertedAt: streamingContent.length
                }]
              }
            : msg
        ));
      };

      const handleComplete = (error) => {
        if (error) {
          console.error('Streaming completed with error:', error);
          // Handle error case
          setMessages(prev => prev.map(msg => 
            msg.id === streamingMessageId 
              ? { ...msg, text: streamingContent || 'Sorry, I encountered an error. Could you try again?', isStreaming: false, hasError: true }
              : msg
          ));
        } else {
          console.log('Streaming completed successfully');
          // Finalize the streaming message
          setMessages(prev => prev.map(msg => 
            msg.id === streamingMessageId 
              ? { ...msg, text: streamingContent, isStreaming: false, coinsDeducted: 1 }
              : msg
          ));
          
          // Finalize the message in database if authenticated
          if (assistantMessageId) {
            finalizeMessage(assistantMessageId);
          }
          
          // Store the coins deducted for UI display
          setLastCoinsDeducted(1);
        }
        
        setIsLoading(false);
      };

      // Start the enhanced streaming with parallel image generation
      console.log('🔄 Starting streaming service with:', {
        userMessage,
        conversationHistoryLength: conversationHistory.length,
        responsePlan
      });
      
      await streamingService.startStreamingWithImages(
        userMessage,
        conversationHistory,
        responsePlan,
        handleTextChunk,
        handleImageReady,
        handleComplete,
        HTML_FORMATTING_SYSTEM_PROMPT
      );
      
    } catch (error) {
      console.error('Error in enhanced streaming:', error);
      
      // Retry logic for network errors
      if (retryCount < 1 && (error.message.includes('network') || error.message.includes('timeout'))) {
        console.log(`Retrying request (attempt ${retryCount + 1})...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
        return fetchDeepSeekResponse(userMessage, retryCount + 1);
      }
      
      // Remove any loading messages and add error message
      setMessages(prev => {
        const messagesWithoutLoading = prev.filter(msg => !msg.isLoading && !msg.isStreaming);
        return [...messagesWithoutLoading, {
          id: Date.now().toString(),
          text: 'Sorry, I encountered an error. Could you try again?',
          sender: 'bot'
        }];
      });
      
      // Error message is already added to local state above
      setIsLoading(false);
    }
  };

  // Function to send messages with attached files to n8n
  const sendMessageWithAttachmentsToN8N = async (attachedFiles, userText, onChunk = null) => {
    try {
      const messages = attachedFiles.map(file => {
        const fileType = file.type?.includes('image') ? 'image' : 'document';
        const defaultPrompt = fileType === 'image' 
          ? userText || "Can you see what is in this image"
          : userText || "Can you perform as a ocr and extract all the text if this file";
        
        return {
          uid: generateUUID(),
          type: fileType,
          text: {
            body: defaultPrompt
          },
          url: file.publicUrl
        };
      });

      const requestBody = {
        messages: messages,
        stream: true
      };

      const xhr = new XMLHttpRequest();
      xhr.open('POST', 'https://matrixai212.app.n8n.cloud/webhook/aea0cafd-493a-4217-a29c-501a11cccbb8', true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Accept', 'text/event-stream');

      let fullContent = '';
      let processedLength = 0;

      return new Promise((resolve, reject) => {
        xhr.onreadystatechange = function() {
          if (xhr.readyState === 3 || xhr.readyState === 4) {
            const responseText = xhr.responseText;
            const newContent = responseText.substring(processedLength);
            processedLength = responseText.length;
            
            if (newContent) {
              const lines = newContent.split('\n');
              
              for (const line of lines) {
                if (line.trim()) {
                  try {
                    const parsed = JSON.parse(line.trim());
                    if (parsed.type === 'item' && parsed.content) {
                      let content_chunk = parsed.content;
                      
                      // Filter out common system messages and static content
                      const systemPatterns = [
                        /^(Processing|Analyzing|Loading|Uploading|Please wait|System:|Assistant:)/i,
                        /^(I'm analyzing|I'm processing|Let me analyze|Let me process)/i,
                        /^(Starting|Initializing|Preparing)/i
                      ];
                      
                      // Check if this chunk contains only system messages
                      const isSystemMessage = systemPatterns.some(pattern => 
                        pattern.test(content_chunk.trim())
                      );
                      
                      // Only add content that's not a system message
                      if (!isSystemMessage) {
                        fullContent += content_chunk;
                        
                        if (onChunk) {
                          onChunk(content_chunk);
                        }
                      }
                    }
                  } catch (parseError) {
                    // Skip invalid JSON lines
                    continue;
                  }
                }
              }
            }
            
            if (xhr.readyState === 4) {
              if (xhr.status === 200) {
                resolve(fullContent.trim() || 'Processing completed successfully.');
              } else {
                reject(new Error(`Request failed: ${xhr.status} ${xhr.statusText}`));
              }
            }
          }
        };

        xhr.onerror = function() {
          reject(new Error('Failed to get response from AI. Please try again.'));
        };

        xhr.ontimeout = function() {
          reject(new Error('Request timed out. Please try again.'));
        };

        xhr.timeout = 60000; // 60 second timeout

        console.log('📊 Sending request to n8n with attachments:', requestBody);
        xhr.send(JSON.stringify(requestBody));
      });
    } catch (error) {
      console.error('Error sending message with attachments to n8n:', error);
      throw error;
    }
  };

  const handleSendMessage = async () => {
    // Enhanced protection against double-sends
    if ((inputText.trim() || selectedImage || attachedFiles.length > 0) && !isSendDisabled && !isLoading && !isApiLoading) {
      // Check coin requirements before processing
      const hasAttachments = selectedImage || attachedFiles.length > 0;
      const requiredCoins = hasAttachments ? 2 : 1;
      
      if (coinCount < requiredCoins) {
        Alert.alert(
          'Insufficient Coins',
          `You need ${requiredCoins} coin${requiredCoins > 1 ? 's' : ''} to ${hasAttachments ? 'send a message with attachments' : 'send a message'}. Please purchase more coins to continue.`,
          [{ text: 'OK' }]
        );
        return;
      }
      
      // Clear any existing timeout
      if (sendTimeoutRef.current) {
        clearTimeout(sendTimeoutRef.current);
      }
      
      // Disable the send button immediately to prevent double sends
      setIsSendDisabled(true);
      
      try {
        // Deduct coins before processing
        let coinDeductionSuccessful = false;
        try {
          const transactionName = hasAttachments ? 'Message with Attachments' : 'Text Message';
          await paymentService.subtractCoins(uid, requiredCoins, transactionName);
          coinDeductionSuccessful = true;
          // Note: coinCount will be automatically updated by useCoinsSubscription hook
        } catch (error) {
          console.error('Error deducting coins:', error);
          // Show error but continue with message processing for better user experience
          Toast.show({
            type: 'error',
            text1: 'Payment Warning',
            text2: 'Coin deduction failed, but message will be processed',
            position: 'bottom',
            visibilityTime: 3000,
          });
        }
        // Get current user session first to ensure we have authentication
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = uid || sessionData?.session?.user?.id || 'anonymous';
        
        setIsTyping(true);
        
        // Dismiss keyboard after sending message
        Keyboard.dismiss();
        
        // If there's no current chat ID, create a new chat
        if (!currentChatId) {
          const newChatId = generateUUID();
          console.log('Creating new chat before sending message:', newChatId);
          setCurrentChatId(newChatId);
          await startNewChat(newChatId);
          // Wait briefly to ensure the chat is created
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        // If there's an image, process it
        if (selectedImage) {
          try {
            setIsLoading(true);
            setIsImageProcessing(true);
           
            console.log('Compressing image for faster processing...');
            
            // Show toast notification for better UX
            Toast.show({
              type: 'info',
              text1: 'Optimizing Image',
              text2: 'Compressing for faster processing...',
              position: 'bottom',
              visibilityTime: 2000,
            });
            
            const compressedImage = await ImageResizer.createResizedImage(
              selectedImage,
              800, // Max width - reduces file size significantly
              800, // Max height
              'JPEG', // Format
              70, // Quality (70% is good balance of quality vs speed)
              0, // Rotation
              null, // Output path
              false, // Keep metadata
              {
                mode: 'contain', // Maintain aspect ratio
                onlyScaleDown: true, // Don't upscale small images
              }
            );
            
            console.log('Image compressed:', {
              original: selectedImage,
              compressed: compressedImage.uri,
              size: compressedImage.size
            });

            // Generate a unique image ID
            const imageID = Date.now().toString(36) + Math.random().toString(36).substring(2, 15);
            const fileExtension = imageFileName ? imageFileName.split('.').pop() : 'jpg';
            
            // Use compressed image for base64 conversion
            const fileContent = await RNFS.readFile(compressedImage.uri, 'base64');
            
            // Create file path for Supabase storage
            const filePath = `users/${userId}/Image/${imageID}.${fileExtension}`;
            
            console.log('Uploading compressed image to path:', filePath);
            
            // Determine proper MIME type based on file extension
            let mimeType = imageType;
            if (!mimeType) {
              const fileExt = fileExtension.toLowerCase();
              if (fileExt === 'jpg' || fileExt === 'jpeg') {
                mimeType = 'image/jpeg';
              } else if (fileExt === 'png') {
                mimeType = 'image/png';
              } else if (fileExt === 'gif') {
                mimeType = 'image/gif';
              } else if (fileExt === 'webp') {
                mimeType = 'image/webp';
              } else {
                mimeType = 'image/jpeg'; // Default to JPEG
              }
            }
            
            // Convert base64 to Uint8Array for proper binary upload
            const binaryString = atob(fileContent);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }

            // Upload image to Supabase storage
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('user-uploads')
              .upload(filePath, bytes, {
                contentType: mimeType,
                upsert: false
              });

            if (uploadError) {
              console.error('Upload error:', uploadError);
              throw new Error(`Upload error: ${uploadError.message}`);
            }
            
            // Get public URL
            const { data } = supabase.storage
              .from('user-uploads')
              .getPublicUrl(filePath);
            
            if (!data || !data.publicUrl) {
              throw new Error('Could not get public URL');
            }
            
            // Store the direct public URL
            const imageUrl = data.publicUrl;
            console.log('Generated image URL:', imageUrl);
            
            // Capture the current input text before clearing it
            const captionText = inputText.trim();
            const question = captionText ? captionText : "What do you see in this image?";
            
            // Save user message with attachment using the new schema
            let userMessageId = null;
            if (userId !== 'anonymous') {
              try {
                const savedMessage = await addUserMessageWithAttachment(
                  currentChatId,
                  userId,
                  captionText || "What do you see in this image?",
                  imageUrl,
                  imageFileName || `image.${fileExtension}`,
                  mimeType,
                  compressedImage.size
                );
                userMessageId = savedMessage?.id;
              } catch (error) {
                console.error('Failed to save image message:', error);
                // Continue with local state update even if database save fails
              }
            }
            
            // Add user message to state with image property and text if provided
            const newMessage = {
              id: userMessageId || Date.now().toString(),
              image: imageUrl,
              text: captionText,
              sender: 'user',
              timestamp: new Date().toISOString()
            };
            
            // Track this message for coin deduction display
            setRecentCoinDeductions(prev => new Set([...prev, newMessage.id]));
            
            console.log('Adding image message to state:', {
              imageUrl: newMessage.image,
              hasCaption: !!captionText,
              captionLength: captionText.length
            });
            
            setMessages(prev => [...prev, newMessage]);
            setSelectedImage(null);
            setInputText('');

            // Create a streaming bot message using the new schema
            let assistantMessage = null;
            let streamingMessageId = 'streaming-' + Date.now().toString();
            
            try {
              // Only create database message if user is not anonymous
              if (userId !== 'anonymous') {
                assistantMessage = await startAssistantMessage(currentChatId, userId, {
                  content_type: 'text',
                  metadata: { image_analyzed: true }
                });
              }
              
              // Add initial streaming message to local state
              setMessages(prev => [...prev, {
                id: assistantMessage?.id || streamingMessageId,
                text: '',
                sender: 'bot',
                isStreaming: true
              }]);
            } catch (error) {
              console.error('Failed to start assistant message:', error);
              // Fallback to local streaming message
              setMessages(prev => [...prev, {
                id: streamingMessageId,
                text: '',
                sender: 'bot',
                isStreaming: true
              }]);
            }

            // Get response from n8n webhook for image processing
            const fullResponse = await processImageUnderstanding(imageUrl, question);
            
            // Update the streaming message with the full response
            if (assistantMessage) {
              try {
                await appendMessageChunk(assistantMessage.id, fullResponse);
              } catch (error) {
                console.error('Failed to append response:', error);
              }
            }
            
            // Finalize the streaming message
            if (assistantMessage) {
              try {
                await finalizeMessage(assistantMessage.id);
              } catch (error) {
                console.error('Failed to finalize message:', error);
              }
            }
            
            // Update local state with final message
            setMessages(prev => prev.map(msg => 
              msg.id === (assistantMessage?.id || streamingMessageId)
                ? { ...msg, text: fullResponse, isStreaming: false, coinsDeducted: 1 }
                : msg
            ));

            // Show success feedback
            Toast.show({
              type: 'success',
              text1: 'Image Analyzed',
              text2: 'Processing completed successfully!',
              position: 'bottom',
              visibilityTime: 1500,
            });

            // Clean up compressed image file
            try {
              await RNFS.unlink(compressedImage.uri);
            } catch (cleanupError) {
              console.log('Could not clean up compressed image:', cleanupError);
            }
            
          } catch (error) {
            console.error('Error processing image:', error);
            
            // Remove any streaming messages and add error message
            setMessages(prev => {
              const messagesWithoutStreaming = prev.filter(msg => !msg.isStreaming);
              return [...messagesWithoutStreaming, {
                id: Date.now().toString(),
                text: 'Sorry, I had trouble processing that image. Could you try a different image?',
                sender: 'bot'
              }];
            });
            
            // Error message is already added to local state above
          } finally {
            setIsLoading(false);
            setIsImageProcessing(false);
            setSelectedImage(null);
            setInputText('');
            
            // Re-enable the send button with a minimum delay to prevent rapid successive sends
            sendTimeoutRef.current = setTimeout(() => {
              setIsSendDisabled(false);
            }, 1500); // Increased delay to 1.5 seconds
          }
        } else if (attachedFiles.length > 0) {
          // File attachment processing - files are already uploaded to Supabase
          try {
            setIsLoading(true);
            
            // Save user message with attachments using the new schema
            let userMessageId = null;
            if (userId !== 'anonymous') {
              try {
                // For multiple files, save the first one as the main attachment
                const primaryAttachment = attachedFiles.length > 0 ? {
                  file_url: attachedFiles[0].publicUrl,
                  file_name: attachedFiles[0].name,
                  file_type: attachedFiles[0].type || 'application/octet-stream',
                  file_size: attachedFiles[0].size || 0
                } : null;
                
                const savedMessage = await addUserMessageWithAttachment(
                  currentChatId,
                  userId,
                  inputText.trim(),
                  primaryAttachment?.file_url,
                  primaryAttachment?.file_name,
                  primaryAttachment?.file_type,
                  primaryAttachment?.file_size
                );
                userMessageId = savedMessage?.id;
              } catch (error) {
                console.error('Failed to save file attachment message:', error);
                // Continue with local state update even if database save fails
              }
            }
            
            // Add user message to state
            const newMessage = {
              id: userMessageId || Date.now().toString(),
              text: inputText.trim(),
              sender: 'user',
              timestamp: new Date().toISOString(),
              attachments: attachedFiles
            };
            
            // Track this message for coin deduction display
            setRecentCoinDeductions(prev => new Set([...prev, newMessage.id]));
            
            setMessages(prev => [...prev, newMessage]);
            
            // Create a streaming bot message using the new schema
            let assistantMessage = null;
            let streamingMessageId = 'streaming-' + Date.now().toString();
            
            try {
              // Only create database message if user is not anonymous
              if (userId !== 'anonymous') {
                assistantMessage = await startAssistantMessage(currentChatId, userId, {
                  content_type: 'text',
                  metadata: { files_processed: attachedFiles.length }
                });
              }
              
              // Add initial streaming message to local state
              setMessages(prev => [...prev, {
                id: assistantMessage?.id || streamingMessageId,
                text: '',
                sender: 'bot',
                isStreaming: true
              }]);
            } catch (error) {
              console.error('Failed to start assistant message:', error);
              // Fallback to local streaming message
              setMessages(prev => [...prev, {
                id: streamingMessageId,
                text: '',
                sender: 'bot',
                isStreaming: true
              }]);
            }
            
            let streamingContent = '';
            
            // Define chunk handler for real-time updates
            const handleChunk = async (chunk) => {
              streamingContent += chunk;
              
              // Update the streaming message in database and local state
              if (assistantMessage) {
                try {
                  await appendMessageChunk(assistantMessage.id, chunk);
                } catch (error) {
                  console.error('Failed to append chunk:', error);
                }
              }
              
              // Update local state
              setMessages(prev => prev.map(msg => 
                msg.id === (assistantMessage?.id || streamingMessageId)
                  ? { ...msg, text: streamingContent }
                  : msg
              ));
            };
            
            // Send message with attached files to n8n using the new format
            const fullResponse = await sendMessageWithAttachmentsToN8N(attachedFiles, inputText.trim(), handleChunk);
            
            // Finalize the streaming message
            if (assistantMessage) {
              try {
                await finalizeMessage(assistantMessage.id);
              } catch (error) {
                console.error('Failed to finalize message:', error);
              }
            }
            
            // Update local state with final message
            setMessages(prev => prev.map(msg => 
              msg.id === (assistantMessage?.id || streamingMessageId)
                ? { ...msg, text: fullResponse, isStreaming: false, coinsDeducted: 1 }
                : msg
            ));
            
            // Show success feedback
            Toast.show({
              type: 'success',
              text1: 'Files Processed',
              text2: 'Document analysis completed successfully!',
              position: 'bottom',
              visibilityTime: 1500,
            });
            
          } catch (error) {
            console.error('Error processing files:', error);
            
            // Remove any streaming messages and add error message
            setMessages(prev => {
              const messagesWithoutStreaming = prev.filter(msg => !msg.isStreaming);
              return [...messagesWithoutStreaming, {
                id: Date.now().toString(),
                text: 'Sorry, I had trouble processing those files. Could you try again?',
                sender: 'bot'
              }];
            });
            
          } finally {
            setIsLoading(false);
            setInputText('');
            setAttachedFiles([]);
            
            // Re-enable the send button
            sendTimeoutRef.current = setTimeout(() => {
              setIsSendDisabled(false);
            }, 1500);
          }
        } else {
          // Regular text message handling
          try {
            setIsLoading(true);
            
            // Check if a generate option is selected
            if (selectedGenerateOption) {
              // Handle generate options
              if (selectedGenerateOption === 'doc') {
                await executeGenerateDOC(inputText.trim());
              } else if (selectedGenerateOption === 'xlsx') {
                await executeGenerateXLSX(inputText.trim());
              }
              
              // Clear input and reset generate option
              setInputText('');
              setSelectedGenerateOption(null);
              setIsTyping(false);
              
            } else {
              // Regular message handling
              // Save user message to database using the new schema
              let userMessageId = null;
              if (userId !== 'anonymous') {
                try {
                  const savedMessage = await addUserMessage(currentChatId, userId, inputText.trim());
                  userMessageId = savedMessage?.id;
                } catch (error) {
                  console.error('Failed to save user message:', error);
                  // Continue with local state update even if database save fails
                }
              }
              
              // Create message object with timestamp
              const newMessage = {
                id: userMessageId || Date.now().toString(),
                text: inputText,
                sender: 'user',
                timestamp: new Date().toISOString()
              };
              
              // Track this message for coin deduction display
              setRecentCoinDeductions(prev => new Set([...prev, newMessage.id]));
              
              // Create a loading indicator message
              const loadingMessage = {
                id: 'loading-' + Date.now().toString(),
                isLoading: true,
                sender: 'bot'
              };
              
              // Add both the user message and loading indicator to state
              setMessages(prev => [...prev, newMessage, loadingMessage]);
              
              // Update the current chat's messages in local state
              setChats(prevChats => prevChats.map(chat => 
                chat.id === currentChatId ? { ...chat, messages: [...(chat.messages || []), newMessage] } : chat
              ));

              // Clear input
              setInputText('');
              setIsTyping(false);
              
              // Removed auto-scroll after sending message to prevent unwanted scrolling
              
              // Process the message with an AI service
              await fetchDeepSeekResponse(inputText);
              
              // Removed auto-scroll after response to prevent unwanted scrolling
            }
          } catch (error) {
            console.error('Error in message handling:', error);
            
            // Don't use Alert to avoid disrupting the UX
            setMessages((prev) => [
              ...prev,
              { id: Date.now().toString(), text: 'Sorry, I encountered an error processing your message. Could you try again?', sender: 'bot' },
            ]);
            
            // Error message is already added to local state above
          } finally {
            setIsLoading(false);
            
            // Re-enable the send button with a minimum delay to prevent rapid successive sends
            sendTimeoutRef.current = setTimeout(() => {
              setIsSendDisabled(false);
            }, 1500); // Increased delay to 1.5 seconds
          }
        }
      } catch (error) {
        console.error('Error in handleSendMessage:', error);
        setIsLoading(false);
        
        // Re-enable the send button with a minimum delay
        sendTimeoutRef.current = setTimeout(() => {
          setIsSendDisabled(false);
        }, 1500);
      }
    }
  };






  


  const handleInputChange = (text) => {
    setInputText(text);
    setIsTyping(text.length > 0); // Toggle typing state
  };

 

  // Render skeleton message for loading state
  const renderSkeletonMessage = React.useCallback(() => {
    // Calculate shimmer animation position
    const translateX = shimmerValue.interpolate({
      inputRange: [0, 1],
      outputRange: [-300, 300],
    });
    
    return (
      <View style={styles.messageWrapperOuter}>
        <Animatable.View
          animation="fadeIn"
          duration={500}
          style={[styles.messageContainer, styles.botMessageContainer]}
        >
          <View style={styles.botHeaderContainer}>
            <View style={styles.botHeaderLogoContainer}>
              <Image source={require('../assets/logo7.png')} style={[styles.botHeaderLogo, {tintColor: '#fff'}]} />
            </View>
            <Text style={[styles.botHeaderText, {color: '#4C8EF7'}]}>MatrixAI</Text>
          </View>
          <View style={styles.skeletonTextContainer}>
            <View style={styles.skeletonLine}>
              <Animated.View
                style={[
                  styles.skeletonShimmer, 
                  { transform: [{ translateX }] }
                ]}
              >
                <LinearGradient
                  colors={['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.15)', 'rgba(255,255,255,0.05)']}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 0}}
                  style={{flex: 1}}
                />
              </Animated.View>
            </View>
            <View style={[styles.skeletonLine, {width: '85%'}]}>
              <Animated.View
                style={[
                  styles.skeletonShimmer, 
                  { transform: [{ translateX }] }
                ]}
              >
                <LinearGradient
                  colors={['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.15)', 'rgba(255,255,255,0.05)']}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 0}}
                  style={{flex: 1}}
                />
              </Animated.View>
            </View>
            <View style={[styles.skeletonLine, {width: '70%'}]}>
              <Animated.View
                style={[
                  styles.skeletonShimmer, 
                  { transform: [{ translateX }] }
                ]}
              >
                <LinearGradient
                  colors={['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.15)', 'rgba(255,255,255,0.05)']}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 0}}
                  style={{flex: 1}}
                />
              </Animated.View>
            </View>
          </View>
          <View style={styles.botTail} />
        </Animatable.View>
      </View>
    );
  }, [shimmerValue]);
  
  // Memoize the message rendering to prevent excessive renders
  const renderMessage = ({ item }) => {
    const isBot = item.sender === 'bot';
    const isUser = item.sender === 'user';
    
    // Ensure text is always a string to prevent markdown parser errors
    const messageText = typeof item.text === 'string' ? item.text : String(item.text || '');
    
    // Parse message for attachments
    let cleanText, attachments;
    if (isBot) {
      // For bot messages, parse attachments from message text
      const parsed = parseMessageForAttachments(messageText);
      cleanText = parsed.cleanText;
      attachments = parsed.attachments;
    } else {
      // For user messages, use attachments from the message object (from supabaseMessageToFrontend)
      cleanText = messageText;
      attachments = item.attachments || [];
      
      // Convert attachment format to match what AttachmentComponent expects
      if (attachments.length > 0) {
        attachments = attachments.map(attachment => ({
          url: attachment.url || attachment.file_url,
          filename: attachment.fileName || attachment.file_name || attachment.originalName || 'Unknown',
          fileType: attachment.fileType || attachment.file_type || 'application/octet-stream'
        }));
      }
    }
    
    // Use clean text for display (without URLs) and format HTML for bot messages
    const textToDisplay = isBot ? formatMessageText(cleanText) : messageText;
    
    // Invert the logic: messages are expanded by default, expandedMessages tracks collapsed ones
    const isCollapsed = expandedMessages[item.id];
    const shouldTruncate = textToDisplay && textToDisplay.length > 100;
    
    // Implement actual text truncation logic
    const displayText = shouldTruncate && isCollapsed 
      ? textToDisplay.substring(0, 100) + '...' 
      : textToDisplay;
  
    // Function to handle long press
    const handleLongPress = () => {
      Alert.alert(
        'Message Options',
        '',
        [
          {
            text: 'Copy Text',
            onPress: () => {
              Clipboard.setString(messageText);
              Alert.alert('Success', 'Text copied to clipboard');
            }
          },
          {
            text: 'Share',
            onPress: async () => {
              try {
                await Share.share({
                  message: messageText,
                });
              } catch (error) {
                console.error('Error sharing:', error);
                Alert.alert('Error', 'Failed to share message');
              }
            }
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]
      );
    };

    // Handle copy text function
    const handleCopyText = () => {
      if (messageText) {
        Clipboard.setString(messageText);
        Alert.alert(t('success'), t('textCopiedToClipboard'));
      }
    };

    // Handle share function
    const handleShareMessage = async () => {
      try {
        await Share.share({
          message: messageText || '',
        });
      } catch (error) {
        console.error('Error sharing:', error);
        if (error.message !== 'User did not share') {
          Alert.alert(t('error'), t('failedToShareText'));
        }
      }
    };





    const renderLeftActions = () => {
      return (
        <View style={styles.swipeableButtons}>
          <TouchableOpacity
            style={styles.swipeButton}
            onPress={() => handleGenerateMindmap(item)}
          >
            <Ionicons name="git-network-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      );
    };

  
    return (
      <GestureHandlerRootView>
      
          <View style={{ flexDirection: isBot ? 'row' : 'row-reverse', alignItems: 'flex-start' }}>
            <View style={[
              styles.messageWrapperOuter, 
              isBot ? styles.botMessageWrapper : styles.userMessageWrapper
            ]}>
              <TouchableOpacity
                onLongPress={handleLongPress}
                delayLongPress={500}
                activeOpacity={1}
              >
                <Animatable.View
                  animation={isBot ? "fadeInUp" : undefined}
                  duration={100}
                  style={[
                    styles.messageContainer,
                    isBot ? styles.botMessageContainer : styles.userMessageContainer,
                  ]}
                >
                  {isBot && (
                    <View style={styles.botHeaderContainer}>
                      <View style={styles.botHeaderLogoContainer}>
                        <Image source={require('../assets/logo7.png')} style={styles.botHeaderLogo} />
                      </View>
                      <Text style={[styles.botHeaderText, {color: colors.primary}]}>MatrixAI</Text>
                    </View>
                  )}
                  
                  {/* Render attachments for bot messages - above text */}
                  {isBot && attachments && attachments.length > 0 && (
                    <View style={styles.attachmentsContainer}>
                      {attachments.map((attachment, index) => (
                        <AttachmentComponent
                          key={`${item.id}-attachment-${index}`}
                          url={attachment.url}
                          filename={attachment.filename}
                          fileType={attachment.fileType}
                          colors={colors}
                        />
                      ))}
                    </View>
                  )}
                  
                  {/* Render attachments for user messages - above text */}
                  {!isBot && attachments && attachments.length > 0 && (
                    <View style={styles.attachmentsContainer}>
                      {attachments.map((attachment, index) => (
                        <AttachmentComponent
                          key={`${item.id}-attachment-${index}`}
                          url={attachment.url}
                          filename={attachment.filename}
                          fileType={attachment.fileType}
                          colors={colors}
                        />
                      ))}
                    </View>
                  )}
                  
                  {/* For bot messages, show image above text */}
                  {isBot && item.image && (
                    <TouchableOpacity 
                      onPress={() => handleImageTap(item.image)}
                      activeOpacity={0.8}
                    >
                      <Image
                        source={{ uri: item.image }}
                        style={{ width: 200, height: 200, borderRadius: 10, maxWidth: '100%' }}
                        resizeMode="contain"
                      />
                    </TouchableOpacity>
                  )}
                  
                  {/* Text content */}
                  {(item.text || (!item.image && !isBot)) && (
                    <View style={isBot ? styles.botTextContainer : styles.userTextContainer}>
                      {isBot ? (
                        // Intelligent message rendering for bot messages
                        (() => {
                          const isDarkMode = colors.background === '#1C1C1E' || colors.background === '#000000';
                          const messageParts = parseIntelligentMessage(displayText);
                          return messageParts.map((part, index) => {
                            switch (part.type) {
                              case 'text':
                                return (
                                  <RenderHtml
                                    key={`text-${index}`}
                                    contentWidth={Dimensions.get('window').width - 100}
                                    source={{ html: marked(part.content) }}
                                    tagsStyles={{
                                      body: {
                                        color: colors.botText,
                                        fontSize: 16,
                                        lineHeight: 26,
                                        margin: 0,
                                        padding: 0,
                                      },
                                      h1: {
                                        color: colors.primary,
                                        fontWeight: '800',
                                        fontSize: 28,
                                        marginTop: 20,
                                        marginBottom: 12,
                                        borderBottomWidth: 2,
                                        borderBottomColor: colors.primary,
                                        paddingBottom: 8,
                                        lineHeight: 34,
                                      },
                                      h2: {
                                        color: colors.primary,
                                        fontWeight: '700',
                                        fontSize: 24,
                                        marginTop: 18,
                                        marginBottom: 10,
                                        paddingBottom: 6,
                                        lineHeight: 30,
                                      },
                                      h3: {
                                        color: colors.primary,
                                        fontWeight: '600',
                                        fontSize: 20,
                                        marginTop: 16,
                                        marginBottom: 8,
                                        lineHeight: 26,
                                      },
                                      p: {
                                        color: colors.botText,
                                        fontSize: 16,
                                        marginTop: 8,
                                        marginBottom: 12,
                                        lineHeight: 26,
                                        fontWeight: '400',
                                      },
                                      code: {
                                        backgroundColor: 'rgba(128, 128, 128, 0.08)',
                                        paddingHorizontal: 4,
                                        paddingVertical: 2,
                                        borderRadius: 3,
                                        color: colors.primary,
                                        fontFamily: 'Courier',
                                        fontSize: 14,
                                        fontWeight: '500',
                                      },
                                      strong: {
                                        fontWeight: 'bold',
                                        color: colors.botText,
                                      },
                                    }}
                                  />
                                );
                              case 'skeleton':
                                return (
                                  <ImageSkeletonLoader
                                    key={`skeleton-${index}`}
                                    description={part.description}
                                    colors={colors}
                                  />
                                );
                              case 'image':
                                return (
                                  <IntelligentImageContainer
                                    key={`image-${index}`}
                                    imageUrl={part.url}
                                    description={part.description}
                                    colors={colors}
                                  />
                                );
                              case 'error':
                                return (
                                  <View key={`error-${index}`} style={{
                                    backgroundColor: 'rgba(255, 0, 0, 0.1)',
                                    padding: 10,
                                    borderRadius: 8,
                                    marginVertical: 5,
                                    borderLeftWidth: 3,
                                    borderLeftColor: '#ff4444'
                                  }}>
                                    <Text style={{ color: '#ff4444', fontSize: 14 }}>
                                      ⚠️ {part.message}
                                    </Text>
                                  </View>
                                );
                              case 'chart':
                                return renderChart(part.chartId, index, colors, isDarkMode);
                              case 'math':
                                console.log('🧮 Rendering math content:', part.content);
                                return (
                                  <MathRenderer
                                    key={`math-${index}`}
                                    mathContent={part.content}
                                    isDarkMode={isDarkMode}
                                    width={Dimensions.get('window').width - 80}
                                  />
                                );
                              default:
                                return null;
                            }
                          });
                        })()
                      ) : (
                        // Simple rendering for user messages
                        <RenderHtml
                          contentWidth={Dimensions.get('window').width - 100}
                          source={{ html: marked(displayText) }}
                          tagsStyles={{
                          body: {
                            color: isBot ? colors.botText : '#FFFFFF',
                            fontSize: 16,
                            lineHeight: 26,
                            margin: 0,
                            padding: 0,
                          },
                          h1: {
                            color: isBot ? colors.primary : '#FFFFFF',
                            fontWeight: '800',
                            fontSize: 28,
                            marginTop: 20,
                            marginBottom: 12,
                            borderBottomWidth: 2,
                            borderBottomColor: colors.primary,
                            paddingBottom: 8,
                            lineHeight: 34,
                          },
                          h2: {
                            color: isBot ? colors.primary : '#FFFFFF',
                            fontWeight: '700',
                            fontSize: 24,
                            marginTop: 18,
                            marginBottom: 10,
                            paddingBottom: 6,
                            lineHeight: 30,
                          },
                          h3: {
                            color: isBot ? colors.primary : '#FFFFFF',
                            fontWeight: '600',
                            fontSize: 20,
                            marginTop: 16,
                            marginBottom: 8,
                            lineHeight: 26,
                          },
                          h4: {
                            color: isBot ? colors.primary : '#FFFFFF',
                            fontWeight: '600',
                            fontSize: 18,
                            marginTop: 14,
                            marginBottom: 6,
                            lineHeight: 24,
                          },
                          h5: {
                            color: isBot ? colors.primary : '#FFFFFF',
                            fontWeight: '500',
                            fontSize: 16,
                            marginTop: 12,
                            marginBottom: 5,
                            lineHeight: 22,
                          },
                          h6: {
                            color: isBot ? colors.primary : '#FFFFFF',
                            fontWeight: '500',
                            fontSize: 14,
                            marginTop: 10,
                            marginBottom: 4,
                            lineHeight: 20,
                          },
                          p: {
                            color: isBot ? colors.botText : '#FFFFFF',
                            fontSize: 16,
                            marginTop: 8,
                            marginBottom: 12,
                            lineHeight: 26,
                            fontWeight: '400',
                          },
                          li: {
                            color: isBot ? colors.botText : '#FFFFFF',
                            fontSize: 16,
                            lineHeight: 24,
                            marginBottom: 8,
                          },
                          ul: {
                            color: isBot ? colors.botText : '#FFFFFF',
                            paddingLeft: 20,
                          },
                          ol: {
                            color: isBot ? colors.botText : '#FFFFFF',
                            paddingLeft: 20,
                          },
                          blockquote: {
                            backgroundColor: 'rgba(128, 128, 128, 0.08)',
                            borderLeftWidth: 4,
                            borderLeftColor: colors.primary,
                            paddingLeft: 12,
                            paddingVertical: 12,
                            paddingRight: 12,
                            color: isBot ? colors.botText : '#FFFFFF',
                            marginVertical: 8,
                            borderRadius: 4,
                            fontStyle: 'italic',
                          },
                          pre: {
                            backgroundColor: 'rgba(128, 128, 128, 0.08)',
                            padding: 12,
                            borderRadius: 6,
                            color: isBot ? colors.botText : '#FFFFFF',
                            fontFamily: 'Courier',
                            fontSize: 14,
                            marginVertical: 8,
                            borderWidth: 1,
                            borderColor: 'rgba(128, 128, 128, 0.2)',
                          },
                          code: {
                            backgroundColor: 'rgba(128, 128, 128, 0.08)',
                            paddingHorizontal: 4,
                            paddingVertical: 2,
                            borderRadius: 3,
                            color: colors.primary,
                            fontFamily: 'Courier',
                            fontSize: 14,
                            fontWeight: '500',
                          },
                          a: {
                            color: colors.primary,
                            textDecorationLine: 'underline',
                          },
                          strong: {
                            fontWeight: 'bold',
                            color: isBot ? colors.botText : '#FFFFFF',
                          },
                          em: {
                            fontStyle: 'italic',
                            color: isBot ? colors.botText : '#FFFFFF',
                          },
                        }}
                        />
                      )}
                    </View>
                  )}
                  
                  {/* For user messages, show image below text */}
                  {!isBot && item.image && (
                    <TouchableOpacity 
                      onPress={() => handleImageTap(item.image)}
                      activeOpacity={0.8}
                      style={{ marginTop: 8 }}
                    >
                      <Image
                        source={{ uri: item.image }}
                        style={{ width: 200, height: 200, borderRadius: 10, maxWidth: '100%' }}
                        resizeMode="contain"
                      />
                    </TouchableOpacity>
                  )}
                  
                  {/* Render images from enhanced streaming */}
                  {item.images && item.images.length > 0 && (
                    <View style={styles.streamingImagesContainer}>
                      {item.images.map((imageData, index) => (
                        <View key={`streaming-image-${imageData.id || index}`} style={styles.streamingImageWrapper}>
                          <TouchableOpacity 
                            onPress={() => handleImageTap(imageData.url)}
                            activeOpacity={0.8}
                          >
                            <Image
                              source={{ uri: imageData.url }}
                              style={styles.streamingImage}
                              resizeMode="contain"
                            />
                          </TouchableOpacity>
                          {imageData.description && (
                            <Text style={[styles.imageDescription, { color: colors.botText }]}>
                              {imageData.description}
                            </Text>
                          )}
                        </View>
                      ))}
                    </View>
                  )}
                  
                  {shouldTruncate && (
                    <TouchableOpacity
                      style={styles.viewMoreButton}
                      onPress={() => toggleMessageExpansion(item.id)}
                    >
                      <Text style={styles.viewMoreText}>
                        {isCollapsed ? 'View more' : 'View less'}
                      </Text>
                    </TouchableOpacity>
                  )}
                  <View style={isBot ? styles.botTail : styles.userTail} />
                </Animatable.View>
              </TouchableOpacity>
              
              {/* Coin display removed as requested */}
              
              {/* Message action buttons - now outside the bubble */}
              <View style={[
                styles.messageActionButtons,
                isBot ? styles.botMessageActions : styles.userMessageActions
              ]}>
                <TouchableOpacity 
                  style={styles.actionButton} 
                  onPress={handleCopyText}
                >
                  <Ionicons 
                    name="copy-outline" 
                    size={18} 
                    color="#666" 
                  />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.actionButton} 
                  onPress={handleShareMessage}
                >
                  <Ionicons 
                    name="share-social-outline" 
                    size={18} 
                    color="#666" 
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleGenerateMindmap(item)}
                >
                  <Ionicons name="git-network-outline" size={18} color="#666" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
       
      </GestureHandlerRootView>
    );
  };
  // Function to process messages for proper display - moved outside useEffect for accessibility
  const processMessages = (messages) => {
    if (!messages || !Array.isArray(messages)) {
      console.log('No messages to process or invalid format');
      return [];
    }
    
    return messages.map(msg => {
      // If message already has an image property, keep it
      if (msg.image) {
        return msg;
      }
      // Check for image URLs in text field (support both Supabase and Google Storage URLs)
      else if (msg.text && typeof msg.text === 'string' && 
          (msg.text.includes('supabase.co/storage/v1/') || 
           msg.text.includes('user-uploads') ||
           msg.text.includes('storage.googleapis.com'))) {
        console.log('Converting text URL to image property:', msg.text);
        return {
          ...msg,
          image: msg.text,
          text: ''
        };
      }
      // Check for JSON format messages with image and text
      else if (msg.text && typeof msg.text === 'string' && 
               ((msg.text.startsWith('{') && msg.text.includes('type')) ||
                (msg.text.includes('image') && msg.text.includes('text')))) {
        try {
          const parsedMsg = JSON.parse(msg.text);
          // Support both image_message type and direct image/text properties
          if ((parsedMsg.type === 'image_message') || 
              (parsedMsg.image && (parsedMsg.text !== undefined))) {
            console.log('Processing combined image and text message');
            return {
              ...msg,
              image: parsedMsg.image,
              text: parsedMsg.text || ''
            };
          }
        } catch (e) {
          console.log('Failed to parse JSON message:', e);
        }
      }
      return msg;
    });
  };

  useEffect(() => {
    // Remove the web-specific event listener code that's causing errors
    // window is undefined in React Native

    let chatSubscription;
    
    // Manually persist the chatid from route params to avoid synthetic event issues
    let persistedChatId = null;
    if (route && route.params && route.params.chatid) {
      persistedChatId = String(route.params.chatid);
      console.log('Setting initial chatid from route params:', persistedChatId);
    }
    
    // Function to fetch all user chats
    const fetchUserChats = async (eventObj) => {
      // Set loading state to true when fetching starts
      setIsChatsLoading(true);
      
      // If an event is passed, ensure it's persisted
      if (eventObj) {
        persistEvent(eventObj);
      }

      try {
        // Log authentication state for debugging
        console.log('=== FETCH USER CHATS DEBUG ===');
        console.log('AuthContext uid:', uid);
        console.log('AuthContext loading:', loading);
        console.log('typeof uid:', typeof uid);
        console.log('uid truthy check:', !!uid);
        console.log('uid === null:', uid === null);
        console.log('uid === undefined:', uid === undefined);
        console.log('uid === "":', uid === '');
        
        // Get current user session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Error getting Supabase session:', sessionError);
        }
        
        console.log('Supabase session exists:', !!session);
        console.log('Supabase session:', session);
        console.log('Supabase session user:', session?.user);
        console.log('Supabase session user ID:', session?.user?.id);
        
        // Use uid from AuthContext as primary source of truth
        const userId = uid || session?.user?.id;
        console.log('Final userId to use:', userId);
        console.log('typeof userId:', typeof userId);
        console.log('userId truthy check:', !!userId);
        
        if (!userId) {
          console.log('No authenticated user found (neither AuthContext uid nor Supabase session), using local chat');
          
          // For anonymous users, create a local chat only if needed
          // Try to get the last used chat from AsyncStorage
          try {
            const lastChatData = await AsyncStorage.getItem('lastChat');
            
            if (lastChatData) {
              try {
                const lastChat = JSON.parse(lastChatData);
                console.log('Found last chat in storage:', lastChat.id);
              
                // Process messages to ensure proper image display
                const processedMessages = processMessages(lastChat.messages || []);
                
                // Update state with processed messages
                setCurrentChatId(lastChat.id);
                setMessages(processedMessages);
                setChats([{...lastChat, messages: processedMessages}]);
                setDataLoaded(true);
                setIsChatsLoading(false);
                
                // Scroll to bottom after loading messages (initial load only)
                setTimeout(() => {
                  if (flatListRef.current) {
                    flatListRef.current.scrollToEnd({ animated: false });
                  }
                }, 100);
              } catch (error) {
                console.error('Error parsing last chat data:', error);
                // Create a new chat if parsing fails
                const newChatId = Date.now().toString();
                const localChatObj = {
                  id: newChatId,
                  title: 'New Chat',
                  messages: [],
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                };
                setCurrentChatId(newChatId);
                setMessages([]);
                setChats([localChatObj]);
                setDataLoaded(true);
                setIsChatsLoading(false);
              }
            } else {
              // No previous chat found, create a new one
              const newChatId = Date.now().toString();
              const localChatObj = {
                id: newChatId,
                name: t('newChat'),
                description: '',
                role: '',
                roleDescription: '',
                messages: [],
              };
              
              setChats([localChatObj]);
              setCurrentChatId(newChatId);
              setMessages([]);
              setDataLoaded(true);
              setIsChatsLoading(false);
              
              // Save this as the last chat
              await AsyncStorage.setItem('lastChat', JSON.stringify(localChatObj));
            }
          } catch (error) {
            console.error('Error accessing AsyncStorage:', error);
            // Fallback to creating a new chat
            const newChatId = Date.now().toString();
            const localChatObj = {
              id: newChatId,
              name: t('newChat'),
              description: '',
              role: '',
              roleDescription: '',
              messages: [],
            };
            
            setChats([localChatObj]);
            setCurrentChatId(newChatId);
            setMessages([]);
            setDataLoaded(true);
            setIsChatsLoading(false);
          }
          
          return;
        }
        
        // userId is already defined above, no need to redeclare
        console.log('=== PROCEEDING TO FETCH FROM SUPABASE ===');
        console.log('About to query chats table with userId:', userId);
        
        // Fetch all chats for the current user using new database schema
        console.log('About to query chats table with userId:', userId);
        
        let userChats;
        try {
          userChats = await getNewUserChats(userId);
          
          console.log('=== SUPABASE QUERY RESULT ===');
          console.log('userChats:', userChats);
          console.log('userChats length:', userChats?.length);
          
          if (!userChats || userChats.length === 0) {
            console.log('No chats found, creating new chat');
            // Create a new chat as fallback
            const newChatId = generateUUID();
            console.log('Creating fallback chat with ID:', newChatId);
            startNewChat(newChatId);
            setDataLoaded(true);
            setIsChatsLoading(false);
            return;
          }
        } catch (chatError) {
          console.error('Error fetching user chats:', chatError);
          console.error('Error details:', JSON.stringify(chatError, null, 2));
          // Create a new chat as fallback
          const newChatId = generateUUID();
          console.log('Creating fallback chat with ID:', newChatId);
          startNewChat(newChatId);
          setDataLoaded(true);
          setIsChatsLoading(false);
          return;
        }
        
        console.log('=== PROCESSING FETCHED CHATS ===');
        // Process the chats to match the local state format
        const processedChats = await Promise.all(userChats.map(async (chat, index) => {
          console.log(`Processing chat ${index + 1}:`, {
            id: chat.id,
            title: chat.title,
            role: chat.role
          });
          
          // Fetch messages for this chat using the new schema
          let messages = [];
          try {
            const chatMessages = await getNewChatMessages(chat.id);
            // Convert Supabase messages to frontend format
            messages = chatMessages.map(msg => {
              const frontendMsg = supabaseMessageToFrontend(msg);
              // Map file_url to image property for image attachments
              if (frontendMsg.file_url && frontendMsg.file_type && frontendMsg.file_type.startsWith('image/')) {
                frontendMsg.image = frontendMsg.file_url;
              }
              return frontendMsg;
            });
          } catch (error) {
            console.error(`Error fetching messages for chat ${chat.id}:`, error);
          }
          
          const processedMessages = processMessages(messages);
          
          return {
            id: chat.id,
            name: chat.title || 'Chat',
            description: chat.metadata?.description || '',
            role: chat.role || '',
            roleDescription: chat.metadata?.roleDescription || '',
            messages: processedMessages,
          };
        }));
        
        console.log('=== UPDATING STATE WITH PROCESSED CHATS ===');
        console.log('processedChats count:', processedChats.length);
        
        // Update state with all fetched chats
        setChats(processedChats);
        
        // If we have chats
        if (processedChats.length > 0) {
          // Use the persisted chat ID instead of the potentially nullified synthetic event
          if (persistedChatId) {
            const specificChat = processedChats.find(chat => chat.id === persistedChatId);
            if (specificChat) {
              console.log('Loading specific chat:', persistedChatId);
              setCurrentChatId(persistedChatId);
              setMessages(specificChat.messages || []);
              setCurrentRole(specificChat.role || '');
            } else {
              // If a specific chat ID was requested but not found, load the most recent one
              const mostRecentChat = processedChats[0];
              console.log('Chat ID not found, loading most recent chat:', mostRecentChat.id);
              setCurrentChatId(mostRecentChat.id);
              setMessages(mostRecentChat.messages || []);
              setCurrentRole(mostRecentChat.role || '');
            }
          } else {
            // No specific chat requested, load the most recent one
            const mostRecentChat = processedChats[0];
            console.log('Loading most recent chat:', mostRecentChat.id);
            setCurrentChatId(mostRecentChat.id);
            setMessages(mostRecentChat.messages || []);
            setCurrentRole(mostRecentChat.role || '');
          }
          
          // Scroll to bottom after loading messages (initial load only)
          setTimeout(() => {
            if (flatListRef.current) {
              flatListRef.current.scrollToEnd({ animated: false });
            }
          }, 100);
        } else {
          // No chats found for this user, create a new one
          console.log('No chats found, creating a new chat');
          const newChatId = generateUUID();
          startNewChat(newChatId);
        }
        
        setDataLoaded(true);
        setIsChatsLoading(false);
        
        // Set up real-time subscription for chat updates
        setupChatSubscription(userId);
      } catch (error) {
        console.error('Error in fetchUserChats:', error);
        setDataLoaded(true);
        setIsChatsLoading(false);
        
        // Fallback to creating a new chat if there's an error
        const newChatId = generateUUID();
        startNewChat(newChatId);
      }
    };
    
    // Setup real-time subscription to chat updates
    const setupChatSubscription = (userId) => {
      // Check if subscription already exists
      if (chatSubscription) {
        chatSubscription.unsubscribe();
      }
      
      chatSubscription = supabase
        .channel('chats_changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'chats',
          filter: `user_id=eq.${userId}`
        }, (payload) => {
          console.log('Real-time update received:', payload);
          
          // Handle different types of changes
          if (payload.eventType === 'INSERT') {
            handleChatInsert(payload.new);
          } else if (payload.eventType === 'UPDATE') {
            handleChatUpdate(payload.new);
          } else if (payload.eventType === 'DELETE') {
            handleChatDelete(payload.old);
          }
        })
        .subscribe();
    };
    
    // Handle a new chat being inserted
    const handleChatInsert = (newChat) => {
      // Process messages for images
      const processedMessages = processMessages(newChat.messages || []);
      
      // Add the new chat to the state
      setChats(prevChats => {
        // Check if chat already exists
        const chatExists = prevChats.some(chat => chat.id === newChat.chat_id);
        if (chatExists) return prevChats;
        
        // Add the new chat
        return [{
          id: newChat.chat_id,
          name: newChat.name || 'Chat',
          description: newChat.description || '',
          role: newChat.role || '',
          roleDescription: newChat.role_description || '',
          messages: processedMessages,
        }, ...prevChats];
      });
      
      // If this is the current chat, update messages
      if (currentChatId === newChat.chat_id) {
        setMessages(processedMessages);
        
        // Only auto-scroll on initial chat load, not on every update
        if (!dataLoaded) {
          setTimeout(() => {
            if (flatListRef.current) {
              flatListRef.current.scrollToEnd({ animated: false });
            }
          }, 100);
        }
      }
    };
    
    // Handle a chat being updated
    const handleChatUpdate = (updatedChat) => {
      // Process messages for images using the common processMessages function
      const processedMessages = processMessages(updatedChat.messages || []);
      
      // Update the chat in the state
      setChats(prevChats => prevChats.map(chat => 
        chat.id === updatedChat.chat_id 
          ? {
              ...chat,
              name: updatedChat.name || 'Chat',
              description: updatedChat.description || '',
              role: updatedChat.role || '',
              roleDescription: updatedChat.role_description || '',
              messages: processedMessages,
            }
          : chat
      ));
      
      // If this is the current chat, update the messages and role
      if (currentChatId === updatedChat.chat_id) {
        setMessages(processedMessages);
        setCurrentRole(updatedChat.role || '');
        
        // Only auto-scroll when switching to a different chat, not on every update
        // This prevents constant auto-scrolling when user is reading older messages
      }
    };
    
    // Handle a chat being deleted
    const handleChatDelete = (deletedChat) => {
      // First ensure we have a valid event by using our persistEvent helper
      const persistedEvent = persistEvent(deletedChat);
      
      // Store the chat ID in a local variable to prevent synthetic event issues
      const chatToDelete = persistedEvent?.chat_id;
      
      if (!chatToDelete) {
        console.warn('Attempted to delete chat with undefined ID');
        return;
      }
      
      // Copy the chat_id immediately to avoid accessing the event later
      const chatIdToDelete = String(chatToDelete);
      
      setChats(prevChats => prevChats.filter(chat => chat.id !== chatIdToDelete));
      
      // If the deleted chat is the current chat, select another chat
      if (currentChatId === chatIdToDelete) {
        setChats(prevChats => {
          // Get the remaining chats
          const remainingChats = prevChats.filter(chat => chat.id !== chatIdToDelete);
          
          if (remainingChats.length > 0) {
            // Select the most recent chat and keep the sidebar open if it was open
            const newCurrentChat = remainingChats[0];
            selectChat(newCurrentChat.id, false);
            return remainingChats;
          } else {
            // No chats remain, start a new one
            const newChatId = Date.now().toString();
            startNewChat(newChatId);
            return remainingChats;
          }
        });
      }
    };
    
    // Fetch chats on mount
    fetchUserChats();
    
    // Cleanup subscription on unmount
    return () => {
      if (chatSubscription) {
        chatSubscription.unsubscribe();
      }
      // Remove window event listener cleanup as well
    };
  }, [route.params?.chatid]);

  // Load messages for a specific chat - used for lazy loading
  const loadChatMessages = useCallback(async (chatId) => {
    try {
      console.log('Loading messages for chat:', chatId);
      
      // Get latest messages for the chat
      const chatMessages = await getLatestChatMessages(chatId, 20);
      
      // Convert Supabase messages to frontend format
      const frontendMessages = chatMessages.map(supabaseMessageToFrontend).map(msg => ({
        ...msg,
        text: msg.content || '', // Map content field to text field for compatibility
        sender: msg.role === 'user' ? 'user' : 'bot', // Map role to sender for compatibility
        // Map file_url to image property for image attachments
        image: msg.file_url && msg.file_type && msg.file_type.startsWith('image/') ? msg.file_url : msg.image
      }));
      
      // Update messages state
      setMessages(frontendMessages);
      
      // Update the chat in the chats array to cache the messages
      setChats(prevChats => prevChats.map(chat => 
        chat.id === chatId 
          ? { ...chat, messages: frontendMessages }
          : chat
      ));
      
      // Scroll to bottom after loading messages
      requestAnimationFrame(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: false });
        }
      });
      
    } catch (error) {
      console.error('Error loading chat messages:', error);
    }
  }, []);

  // Debounced fetch function to prevent excessive API calls - OPTIMIZED to only load chat names
  const debouncedFetchChats = useCallback(async (userId, force = false) => {
    const now = Date.now();
    
    // Check if we should debounce this call
    if (!force && (now - lastFetchTime.current) < MIN_FETCH_INTERVAL) {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      
      fetchTimeoutRef.current = setTimeout(() => {
        debouncedFetchChats(userId, true);
      }, FETCH_DEBOUNCE_DELAY);
      return;
    }
    
    lastFetchTime.current = now;
    setIsChatsLoading(true);
    
    try {
      console.log('Optimized fetch for user (chat names only):', userId);
      
      // Fetch ONLY chat metadata using new database structure - NO MESSAGES
      const userChats = await getNewUserChats(userId);
      
      if (!userChats || userChats.length === 0) {
        console.log('No chats found, creating new chat');
        const newChatId = Date.now().toString();
        await startNewChat(newChatId);
        setDataLoaded(true);
        return;
      }
      
      // Process chats WITHOUT loading messages - much faster
      const processedChats = userChats.slice(0, 20).map((chat) => {
        return {
          id: chat.id,
          name: chat.title || 'Chat',
          description: '', // Will be populated when messages are loaded
          role: chat.role || '',
          roleDescription: '',
          messages: [], // Empty initially - loaded lazily when chat becomes active
        };
      });
      
      setChats(processedChats);
      
      // Load messages only for the active chat
      if (processedChats.length > 0 && processedChats[0] && processedChats[0].id) {
        const targetChatId = route.params?.chatid || processedChats[0].id;
        const targetChat = processedChats.find(chat => chat.id === targetChatId) || processedChats[0];
        
        // Additional safety check for targetChat
        if (targetChat && targetChat.id) {
          setCurrentChatId(targetChat.id);
          setCurrentRole(targetChat.role);
          
          // Load messages for the active chat only
          await loadChatMessages(targetChat.id);
        }
      }
      
      setDataLoaded(true);
      
    } catch (error) {
      console.error('Error in debouncedFetchChats:', error);
      if (chats.length === 0) {
        const newChatId = Date.now().toString();
        await startNewChat(newChatId);
      }
    } finally {
      setIsChatsLoading(false);
    }
  }, [chats.length, route.params?.chatid]);

  // Load older messages function for pagination
  const loadOlderMessages = useCallback(async () => {
    if (isLoadingOlderMessages || !hasMoreMessages || !currentChatId || !uid) {
      return;
    }
    
    setIsLoadingOlderMessages(true);
    
    try {
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession();
      const userId = uid || session?.user?.id;
      
      if (!userId || userId === 'anonymous') {
        // For anonymous users, no pagination needed as messages are stored locally
        setHasMoreMessages(false);
        return;
      }
      
      // Get the position of the oldest message currently loaded
      let beforePosition = null;
      if (messages.length > 0) {
        // Find the oldest message (first in the array since messages are ordered newest to oldest)
        const oldestMessage = messages[0];
        beforePosition = oldestMessage.position || null;
      }
      
      // Load older messages using the new lazy loading function
      const olderMessages = await getChatMessagesLazy(
        currentChatId,
        MESSAGE_PAGE_SIZE,
        beforePosition
      );
      
      if (olderMessages.length > 0) {
        // Convert to frontend format
        const frontendMessages = olderMessages.map(supabaseMessageToFrontend).map(msg => ({
          ...msg,
          text: msg.content || '', // Map content field to text field for compatibility
          sender: msg.role === 'user' ? 'user' : 'bot', // Map role to sender for compatibility
          // Map file_url to image property for image attachments
          image: msg.file_url && msg.file_type && msg.file_type.startsWith('image/') ? msg.file_url : msg.image
        }));
        
        // Add older messages to the beginning of the current messages
        setMessages(prevMessages => [...frontendMessages, ...prevMessages]);
        setMessageOffset(prev => prev + olderMessages.length);
        
        // If we got fewer messages than requested, we've reached the end
        if (olderMessages.length < MESSAGE_PAGE_SIZE) {
          setHasMoreMessages(false);
        }
      } else {
        setHasMoreMessages(false);
      }
      
    } catch (error) {
      console.error('Error in loadOlderMessages:', error);
      setHasMoreMessages(false);
    } finally {
      setIsLoadingOlderMessages(false);
    }
  }, [isLoadingOlderMessages, hasMoreMessages, currentChatId, uid, messages.length]);

  // Handle scroll to top for loading older messages
  const handleScrollToTop = useCallback(() => {
    if (hasMoreMessages && !isLoadingOlderMessages) {
      loadOlderMessages();
    }
  }, [hasMoreMessages, isLoadingOlderMessages, loadOlderMessages]);

  // Optimized useEffect to handle authentication-dependent data loading
  useEffect(() => {
    console.log('=== AUTH DEPENDENT USEEFFECT ===');
    console.log('uid:', uid);
    console.log('loading:', loading);
    
    // Only fetch chats when authentication is ready (not loading) and we have a uid
    if (!loading && uid && !dataLoaded) {
      console.log('Authentication ready, fetching user chats with debouncing...');
      debouncedFetchChats(uid);
    }
  }, [uid, loading, dataLoaded, debouncedFetchChats]); // Optimized dependencies

  // Modify the startNewChat to accept chatId parameter and ensure proper initialization
  const startNewChat = async (customChatId) => {
    try {
      // Validate and sanitize customChatId to prevent [object Object] issues
      let newChatId;
      
      if (customChatId) {
        // Detect if customChatId is an object (like a synthetic event) instead of a string/number 
        if (typeof customChatId === 'object') {
          console.warn('Received object instead of ID in startNewChat, generating new ID');
          newChatId = generateUUID();
        } else {
          newChatId = String(customChatId);
        }
      } else {
        newChatId = generateUUID();
      }
      
      console.log(`Starting new chat with ID: ${newChatId}`);
      
      // Show toast for user feedback
      Toast.show({
        type: 'success',
        text1: 'New Chat Created',
        position: 'bottom',
        visibilityTime: 2000,
      });
      
      // Get current user session first to ensure we have authentication
      const { data: { session } } = await supabase.auth.getSession();
      
      // Create a local chat object first regardless of authentication
      const timestamp = new Date().toISOString();
      const localChatObj = {
        id: newChatId,
        name: t('newChat'),
        description: '',
        role: '',
        roleDescription: '',
        messages: [],
      };
      
      // Update local state immediately
      setChats(prevChats => [localChatObj, ...prevChats.filter(chat => chat.id !== newChatId)]);
      setCurrentChatId(newChatId);
      setIsLoading(false);
      setIsChatsLoading(false);
      setMessages([]);
      setCurrentRole('');
      setIsSidebarOpen(false);
      
      // Scroll to bottom after creating a new chat
      setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: false });
        }
      }, 100);
      
      // Save to AsyncStorage for anonymous users
      if (!uid) {
        console.log('No authenticated user, using local chat only');
        try {
          await AsyncStorage.setItem('lastChat', JSON.stringify(localChatObj));
        } catch (error) {
          console.error('Error saving chat to AsyncStorage:', error);
        }
        return;
      }
      
      const userId = uid;
      
      // Create chat in new database structure
      const createdChatId = await createNewChat(
        userId,
        t('newChat'),
        {},
        currentRole || 'assistant'
      );
      
      if (!createdChatId) {
        console.error('Failed to create new chat in database');
        // Continue with local state only
        return;
      }
      
      // Update the local chat object with the actual database ID
      const updatedLocalChatObj = {
        ...localChatObj,
        id: createdChatId
      };
      
      // Update local state with the correct ID
      setChats(prevChats => [updatedLocalChatObj, ...prevChats.filter(chat => chat.id !== newChatId && chat.id !== createdChatId)]);
      setCurrentChatId(createdChatId);
      
      console.log('New chat created in Supabase with ID:', createdChatId);
    } catch (error) {
      console.error('Error during new chat creation:', error);
      // Local state has already been updated, so no need to update again
    }
  };

  const handleAttach = () => {
    setShowAdditionalButtons(prev => !prev);
  };

  // Upload file to Supabase and attach to text input
  const uploadFileToSupabaseAndAttach = async (file, fileType) => {
    const fileId = generateUUID();
    
    try {
      setIsUploadingFile(true);
      
      // Add file to attached files with upload progress
      const newFile = {
        ...file,
        id: fileId,
        fileType,
        uploadProgress: 0,
        isUploading: true,
      };
      
      setAttachedFiles(prev => [...prev, newFile]);
      
      // Get current user session
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = uid || sessionData?.session?.user?.id || 'anonymous';
      
      // Generate unique file path
      const fileExtension = file.name ? file.name.split('.').pop() : (fileType === 'image' ? 'jpg' : 'pdf');
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const fileName = `${timestamp}_${randomString}_${userId}.${fileExtension}`;
      const filePath = `users/${userId}/uploads/${fileName}`;
      
      // Read file content as base64
      const fileContent = await RNFS.readFile(file.uri, 'base64');
      
      // Convert base64 to Uint8Array for proper binary file handling
      const binaryString = atob(fileContent);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Determine proper content type
      const contentType = file.type || file.mime || 'application/octet-stream';
      
      // Upload to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('user-uploads')
        .upload(filePath, bytes, {
          contentType: contentType,
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(`Upload error: ${uploadError.message}`);
      }
      
      // Get public URL
      const { data } = supabase.storage
        .from('user-uploads')
        .getPublicUrl(filePath);
      
      if (!data || !data.publicUrl) {
        throw new Error('Could not get public URL');
      }
      
      const publicUrl = data.publicUrl;
      console.log('File uploaded successfully:', publicUrl);
      
      // Update file with upload result
      setAttachedFiles(prev => prev.map(f => 
        f.id === fileId 
          ? { 
              ...f, 
              uploadProgress: 100,
              isUploading: false,
              publicUrl: publicUrl,
              uid: fileId,
              url: publicUrl
            }
          : f
      ));
      
      Toast.show({
        type: 'success',
        text1: 'File Uploaded',
        text2: `${file.name} attached successfully`,
        position: 'bottom',
        visibilityTime: 2000,
      });
      
    } catch (error) {
      console.error('File upload error:', error);
      Alert.alert('Upload Error', 'Failed to upload file. Please try again.');
      
      // Remove failed file from list
      setAttachedFiles(prev => prev.filter(f => f.id !== fileId));
    } finally {
      setIsUploadingFile(false);
    }
  };

  // File attachment handlers
  const handleFileSelected = async (file, fileType) => {
    // Declare fileId outside try block so it's accessible in catch
    const fileId = Date.now().toString();
    
    try {
      setIsUploadingFile(true);
      
      // Add file to attached files with upload progress
      const newFile = {
        ...file,
        id: fileId,
        fileType,
        uploadProgress: 0,
        isUploading: true,
      };
      
      setAttachedFiles(prev => [...prev, newFile]);
      
      // Upload file to storage using simplified function
      const uploadResult = await simpleUploadToStorage(file, uid);
      
      // Update file with upload result
      setAttachedFiles(prev => prev.map(f => 
        f.id === fileId 
          ? { 
              ...f, 
              ...uploadResult,
              uploadProgress: 100,
              isUploading: false,
              publicUrl: uploadResult.publicUrl
            }
          : f
      ));
      
      // Process file based on type using webhook service
      const actualFileType = getFileTypeCategory(file.type || uploadResult.mimeType, uploadResult.fileName);
      
      if (actualFileType === 'image') {
        try {
          const processedContent = await processImageUnderstanding(uploadResult.publicUrl);
          
          // Update file with processed content
          setAttachedFiles(prev => prev.map(f => 
            f.id === fileId 
              ? { ...f, processedContent, actualFileType }
              : f
          ));
          
          // Add AI response as a new message
          const aiMessage = {
            id: Date.now().toString(),
            text: processedContent,
            sender: 'bot',
            timestamp: new Date().toISOString(),
          };
          setMessages(prev => [...prev, aiMessage]);
          
        } catch (processError) {
          console.error('Image processing error:', processError);
          setAttachedFiles(prev => prev.map(f => 
            f.id === fileId 
              ? { ...f, error: 'Failed to process image' }
              : f
          ));
        }
      } else if (actualFileType === 'document') {
        try {
          const processedContent = await processDocument(uploadResult.publicUrl);
          
          // Update file with processed content
          setAttachedFiles(prev => prev.map(f => 
            f.id === fileId 
              ? { ...f, processedContent, actualFileType }
              : f
          ));
          
          // Add AI response as a new message
          const aiMessage = {
            id: Date.now().toString(),
            text: processedContent,
            sender: 'bot',
            timestamp: new Date().toISOString(),
          };
          setMessages(prev => [...prev, aiMessage]);
          
        } catch (processError) {
          console.error('Document processing error:', processError);
          setAttachedFiles(prev => prev.map(f => 
            f.id === fileId 
              ? { ...f, error: 'Failed to process document' }
              : f
          ));
        }
      }
      
    } catch (error) {
      console.error('File upload error:', error);
      Alert.alert('Upload Error', 'Failed to upload file. Please try again.');
      
      // Remove failed file from list
      setAttachedFiles(prev => prev.filter(f => f.id !== fileId));
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleRemoveFile = (index) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleFilePress = (file, index) => {
    // Handle file preview/open
    if (file.fileType === 'image' && file.uri) {
      setFullScreenImage(file.uri);
      setIsFullScreen(true);
    }
  };

  const handleCamera = async () => {
    await handleImageSelection('camera');
  };

  const handleDocumentSelection = async () => {
    try {
      // Hide additional buttons after selection
      setShowAdditionalButtons(false);
      
      // Pick a document (PDF, DOC, DOCX)
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.pdf, DocumentPicker.types.doc, DocumentPicker.types.docx],
        copyTo: 'cachesDirectory',
      });
      
      const selectedFile = result[0];
      const { uri, type, name, size, fileCopyUri } = selectedFile;
      
      // Upload to Supabase immediately
      await uploadFileToSupabaseAndAttach({
        uri: fileCopyUri || uri,
        type,
        name,
        size,
      }, 'document');
      
    } catch (error) {
      if (DocumentPicker.isCancel(error)) {
        console.log('Document picking cancelled');
      } else {
        console.error('Error picking document:', error);
        Alert.alert('Error', 'Failed to pick document');
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const processPdfDocument = async (fileUri, fileName) => {
    let tempDir = null;
    try {
      console.log('Processing PDF document:', fileUri);
      
      // First, verify that the file exists and is accessible
      console.log('Checking if file exists:', fileUri);
      const fileExists = await RNFS.exists(fileUri);
      if (!fileExists) {
        console.error('File does not exist at path:', fileUri);
        throw new Error(`File does not exist at path: ${fileUri}`);
      }
      
      // Get file stats to verify it's readable
      try {
        const stats = await RNFS.stat(fileUri);
        console.log('File stats:', JSON.stringify(stats));
        console.log('File size:', stats.size, 'bytes');
        if (stats.size === 0) {
          throw new Error('File exists but is empty (0 bytes)');
        }
      } catch (statError) {
        console.error('Error getting file stats:', statError);
        throw new Error(`Cannot access file stats: ${statError.message}`);
      }
      
      console.log('File exists and is accessible, proceeding with processing');
      
      // Create a temporary directory for processing using CachesDirectoryPath which is more reliable
      tempDir = `${RNFS.CachesDirectoryPath}/temp_pdf_${Date.now()}`;
      console.log('Creating temp directory at:', tempDir);
      
      // Check if the directory exists before creating it
      const dirExists = await RNFS.exists(tempDir);
      if (!dirExists) {
        await RNFS.mkdir(tempDir);
        console.log('Created temp directory successfully');
      }
      
      // Add a user message indicating document processing
      const userMessageId = Date.now().toString();
      const userMessage = {
        id: userMessageId,
        text: `Document: ${fileName}`,
        sender: 'user',
      };
      
      setMessages(prev => [...prev, userMessage]);
      
      // Process the document with AI
      await sendDocumentToAI(fileUri, fileName);
      
      // Clean up temporary files if they were created
      if (tempDir) {
        console.log('Cleaning up temp directory:', tempDir);
        await RNFS.exists(tempDir).then(exists => {
          if (exists) {
            return RNFS.unlink(tempDir);
          }
        }).catch(err => console.error('Error cleaning up temp dir:', err));
      }
    } catch (error) {
      console.error('Error processing PDF document:', error);
      Alert.alert('Error', `Failed to process PDF document: ${error.message}`);
      setIsLoading(false); // Make sure to reset loading state on error
    }
  };
  
  const sendDocumentToAI = async (fileUri, fileName) => {
    try {
      console.log('Sending document to AI:', fileUri);
      
      // Double-check that the file exists and is accessible
      console.log('Verifying file exists before sending to AI');
      const fileExists = await RNFS.exists(fileUri);
      if (!fileExists) {
        const errorMsg = `File does not exist at path: ${fileUri}`;
        console.error(errorMsg);
        Alert.alert('Document Error', 'The selected file could not be found. Please try selecting the document again.');
        throw new Error(errorMsg);
      }
      
      // Get file stats to verify it's readable and not empty
      try {
        const stats = await RNFS.stat(fileUri);
        console.log('File stats:', JSON.stringify(stats));
        console.log('File size:', stats.size, 'bytes');
        if (stats.size === 0) {
          const errorMsg = 'File exists but is empty (0 bytes)';
          console.error(errorMsg);
          Alert.alert('Document Error', 'The selected file appears to be empty. Please try with a different document.');
          throw new Error(errorMsg);
        }
      } catch (statError) {
        const errorMsg = `Cannot access file stats: ${statError.message}`;
        console.error(errorMsg);
        Alert.alert('Document Error', 'Cannot access the selected file. Please try selecting the document again.');
        throw new Error(errorMsg);
      }
      
      console.log('File exists and is valid, proceeding with AI processing');
      
      // Create a streaming message from the bot
      const streamingMessageId = Date.now().toString();
      const streamingMessage = {
        id: streamingMessageId,
        text: 'Processing document...',
        sender: 'bot',
      };
      
      console.log('Adding streaming message to chat');
      setMessages(prev => [...prev, streamingMessage]);
      
      try {
        // Read the file data with error handling
        console.log('Attempting to read file data:', fileUri);
        let fileData;
        try {
          fileData = await RNFS.readFile(fileUri, 'base64');
          console.log('Successfully read file data, length:', fileData.length);
        } catch (readError) {
          const errorMsg = `Could not read file data: ${readError.message}`;
          console.error('Error reading file data:', readError);
          Alert.alert('Document Error', 'Failed to read the document data. Please try selecting the document again.');
          throw new Error(errorMsg);
        }
        
        // Initialize streaming content
        let streamingContent = '';
        console.log('Initializing streaming content');
        
        // Define the streaming callback
        const handleChunk = (chunk) => {
          streamingContent += chunk;
          
          // Update the streaming message in real-time
          setMessages(prev => prev.map(msg => 
            msg.id === streamingMessageId 
              ? { ...msg, text: streamingContent }
              : msg
          ));
          
          // Only auto-scroll during streaming if user is not actively scrolling
          if (!isUserScrolling) {
            setTimeout(() => {
              if (flatListRef.current && !isUserScrolling) {
                flatListRef.current.scrollToEnd({ animated: true });
              }
            }, 50);
          }
        };
        
        // Send the document to the AI API
        console.log('Sending document to AI API');
        await sendMessageToAI(`I'm sending you a document named ${fileName}. Please analyze its content and provide a summary.`, fileData, handleChunk);
        console.log('Document successfully processed by AI');
        
        // Update the streaming flag when done
        setMessages(prev => prev.map(msg => 
          msg.id === streamingMessageId 
            ? { ...msg, isStreaming: false }
            : msg
        ));
      } catch (readError) {
        // Handle file reading errors specifically
        console.error('Error processing document:', readError);
        
        // Update the streaming message to show the error
        setMessages(prev => prev.map(msg => 
          msg.id === streamingMessageId 
            ? { ...msg, text: `Error processing document: ${readError.message}`, isError: true }
            : msg
        ));
        
        throw readError; // Re-throw to be caught by the outer catch block
      }
      
      // Document message is already handled through the proper message flow above
      
    } catch (error) {
      console.error('Error sending document to AI:', error);
      Alert.alert('Error', `Failed to process document with AI: ${error.message}`);
      
      // Update any streaming message to show the error
      setMessages(prev => prev.map(msg => 
        msg.sender === 'bot' && msg.text === 'Processing document...'
          ? { ...msg, text: `Error: ${error.message}`, isError: true }
          : msg
      ));
    } finally {
      console.log('Document processing completed, resetting loading state');
      setIsLoading(false);
    }
  };
  

  
  const selectChat = async (chatId, closeSidebar = true) => {
    try {
      console.log('Selecting chat:', chatId);
      
      // Close sidebar if requested
      if (closeSidebar) {
        setIsSidebarOpen(false);
      }
      
      // Set the current chat ID
      setCurrentChatId(chatId);
      
      // Reset pagination state for the new chat
      setHasMoreMessages(true);
      setMessageOffset(0);
      setIsLoadingOlderMessages(false);
      
      // Find the chat in local state
      const selectedChat = chats.find(chat => chat.id === chatId);
      
      if (selectedChat) {
        // Set the role if the chat has one
        if (selectedChat.role) {
          setCurrentRole(selectedChat.role);
        } else {
          setCurrentRole('');
        }
        
        // Check if messages are already cached for this chat
        if (selectedChat.messages && selectedChat.messages.length > 0) {
          // Use cached messages - much faster
          setMessages(selectedChat.messages);
          console.log('Chat selected successfully (cached):', {
            chatId,
            role: selectedChat.role,
            messageCount: selectedChat.messages.length,
            source: 'cached'
          });
          
          // Scroll to bottom immediately for cached messages
          requestAnimationFrame(() => {
            if (flatListRef.current) {
              flatListRef.current.scrollToEnd({ animated: false });
            }
          });
        } else {
          // Messages not cached - load them lazily
          console.log('Loading messages for chat (not cached):', chatId);
          await loadChatMessages(chatId);
        }
      } else {
        console.log('Chat not found in local state, clearing messages');
        setMessages([]);
        setCurrentRole('');
      }
      
      // Auto-scroll to bottom when loading messages
      setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: false });
        }
      }, 100);
      
    } catch (error) {
      console.error('Error selecting chat:', error);
    }
  };

  const handleImageSelection = async (source = 'gallery') => {
    // Hide additional buttons after selection
    setShowAdditionalButtons(false);
    
    const options = {
      mediaType: 'photo',
      quality: 0.7,
      includeBase64: false,
      maxWidth: 1200,
      maxHeight: 1200,
    };

    try {
      let response;
      
      if (source === 'gallery') {
        response = await launchImageLibrary(options);
      } else if (source === 'camera') {
        response = await launchCamera(options);
      }

      if (response.assets && response.assets.length > 0) {
        console.log('Image picker response:', response.assets[0]);
        const { uri, type, fileName, fileSize } = response.assets[0];
        
        // Determine proper MIME type based on file extension
        let mimeType = type;
        if (!mimeType) {
          const fileExt = uri.substring(uri.lastIndexOf('.') + 1).toLowerCase();
          if (fileExt === 'jpg' || fileExt === 'jpeg') {
            mimeType = 'image/jpeg';
          } else if (fileExt === 'png') {
            mimeType = 'image/png';
          } else if (fileExt === 'gif') {
            mimeType = 'image/gif';
          } else if (fileExt === 'webp') {
            mimeType = 'image/webp';
          } else if (fileExt === 'heic' || fileExt === 'heif') {
            mimeType = 'image/jpeg'; // HEIC should be converted to JPEG
          } else {
            mimeType = 'image/jpeg'; // Default to JPEG
          }
        }
        
        // Upload to Supabase immediately
        await uploadFileToSupabaseAndAttach({
          uri,
          type: mimeType,
          name: fileName || `image_${Date.now()}.jpg`,
          size: fileSize || 0,
        }, 'image');
      }
    } catch (error) {
      console.error('Error selecting image:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  // Document selection function is already defined above

  // Function to set the current role
  const handleRoleSelection = async (role) => {
    // First ensure we have a current chat
    if (!currentChatId) {
      // Create a new chat if we don't have one
      const newChatId = Date.now().toString();
      await startNewChat(newChatId);
      setCurrentChatId(newChatId);
    }
    
    let roleDescription = '';
    
    // Provide detailed context for specific roles
    if (role === '🩺 Doctor') {
      roleDescription = ` Licensed medical advisor providing health guidance, symptom analysis, and referrals within Hong Kong's healthcare system. Core responsibilities include assessing symptoms and suggesting possible conditions (e.g., seasonal flu, hypertension), explaining public health guidelines (e.g., DH vaccination schedules, COVID-19 protocols), advising on over-the-counter medications (e.g., Panadol, antihistamines) available in Hong Kong pharmacies, highlighting urgent care options (e.g., Accident & Emergency Departments at QMH or PWH), and promoting lifestyle adjustments for Hong Kong's urban environment (e.g., air pollution management). Key skills & knowledge include familiarity with HK's public/private healthcare systems, awareness of common local health issues (e.g., dengue fever, stress-related illnesses), and fluency in Cantonese medical terms (e.g., 骨痛熱症 for dengue). Common scenarios: "I have a fever after hiking in Lion Rock. Should I worry about dengue?" or "Where can I get a same-day flu vaccine in Kowloon?" Communication style is culturally sensitive, using terms like 睇醫生 (visit a doctor) and referencing local hospitals, while maintaining clear boundaries by emphasizing referrals to HA clinics or private practitioners. Limitations: Forbidden from prescribing antibiotics or diagnosing notifiable diseases (e.g., tuberculosis). Mandatory warning: For suspected COVID-19 symptoms, visit a DH testing centre immediately.`;
    } else if (role === '📚 Teacher') {
      roleDescription = `Educational guide specializing in Hong Kongs curriculum frameworks and exam systems, supporting students in academic achievement and holistic development. Core responsibilities include providing subject-specific tutoring (e.g., DSE Chinese, IGCSE Mathematics), advising on exam strategies for the Hong Kong Diploma of Secondary Education (DSE) or international qualifications (e.g., IB, A-Levels), guiding school selection (e.g., Direct Subsidy Scheme schools vs. international schools), addressing learning challenges in Hong Kong's high-pressure environment (e.g., stress management), and recommending local resources (e.g., HKEdCity platforms, public library programs). Key skills & knowledge include expertise in Hong Kong's curriculum (e.g., Liberal Studies reforms, STEM education initiatives), familiarity with school banding systems and admission criteria, and awareness of extracurricular trends (e.g., coding bootcamps, debate competitions). Common scenarios: "How to improve English writing for DSE Paper 2?" or "What are the best STEM programs for secondary students in Kowloon?" Communication style is encouraging yet pragmatic, using Cantonese terms like 補習 (tutoring) and referencing local exam stressors. Limitations: Forbidden from guaranteeing exam scores or criticizing specific schools. Mandatory reminder: For severe academic stress, consult school social workers or NGOs like the Hong Kong Federation of Youth Groups.`;
    } else if (role === '⚖️ Lawyer') {
      roleDescription = `Licensed legal advisor specializing in Hong Kongs common law system, providing guidance on civil disputes, contractual matters, and regulatory compliance. Core responsibilities include interpreting local ordinances (e.g., Landlord and Tenant Ordinance, Employment Ordinance), advising on dispute resolution pathways (e.g., Small Claims Tribunal, Labour Tribunal), reviewing contracts (e.g., tenancy agreements, employment contracts) for compliance with Hong Kong law, explaining legal procedures for family law cases (e.g., divorce, child custody under Matrimonial Proceedings Ordinance), and highlighting risks in property transactions (e.g., unauthorized structures, mortgage terms). Key skills & knowledge include expertise in Basic Law and Hong Kong's judicial framework, familiarity with the Personal Data (Privacy) Ordinance and Anti-Discrimination Ordinances, practical understanding of court procedures (e.g., filing writs at the District Court), and fluency in Cantonese legal terms (e.g., stamp duty, adverse possession). Common scenarios: "My landlord won't return the security deposit. Can I sue at the Small Claims Tribunal?" or "How to draft a prenuptial agreement valid in Hong Kong?" Communication style is legally precise, citing specific ordinances and case law while maintaining a culturally contextual approach, using terms like 搵律師 (hiring a lawyer) and referencing local practices. Limitations: Forbidden from drafting court pleadings or guaranteeing case outcomes. Mandatory warnings: Fraudulent acts like 假文書 (forged documents) may lead to 14 years' imprisonment under Crimes Ordinance. Always verify solicitor credentials via the Law Society of Hong Kong registry.`;
    } else if (role === '🌱 Psychologist') {
      roleDescription = `Mental health support specialist addressing Hong Kong's urban stressors, offering evidence-based coping strategies and emotional wellness guidance. Core responsibilities include assisting in managing anxiety, depression, and work-life imbalance common in Hong Kong's fast-paced environment, providing techniques for stress relief (e.g., mindfulness apps like Headspace adapted for Cantonese speakers), addressing family dynamics influenced by cross-generational living (e.g., conflicts with elderly parents), and guiding users through crises (e.g., protests-related trauma, pandemic fatigue) with local referral resources. Key skills & knowledge include expertise in Cognitive Behavioral Therapy (CBT) and cross-cultural mental health challenges, familiarity with Hong Kong's mental health infrastructure (e.g., Hospital Authority clinics, NGOs like Mind HK), and awareness of stigma around seeking therapy in Cantonese-speaking communities. Common scenarios: "I feel overwhelmed by my 70-hour workweek in Central. How to cope?" or "How to support a family member with PTSD after social unrest?" Communication style is empathetic and non-judgmental, using local language like 香港人壓力大係好常見，我哋一步步嚟 (Stress is common in Hong Kong; let's tackle it step by step), while being resource-focused by recommending local services (e.g., Suicide Prevention Services' 24-hour hotline: 2382 0000). Limitations: Forbidden from diagnosing psychiatric disorders (e.g., bipolar disorder) or advising on medication. Mandatory warnings: If suicidal thoughts arise, contact Samaritans Hong Kong (2896 0000) immediately.`;
    } else if (role === '🔧 Engineer') {
      roleDescription = `Technical problem-solver specializing in Hong Kong's urban infrastructure, construction challenges, and smart city initiatives, ensuring compliance with local regulations and safety standards. Core responsibilities include advising on building projects under Hong Kong's Buildings Ordinance (e.g., minor works approvals, structural inspections), troubleshooting MTR-aligned engineering issues (e.g., vibration control for buildings near rail lines), guiding retrofitting solutions for aging buildings (e.g., maintenance of unmanaged buildings, waterproofing for rainy seasons), and recommending smart technologies (e.g., IoT for energy efficiency in high-rises, HVAC optimization). Key skills & knowledge include expertise in Hong Kong Construction Standards (e.g., Code of Practice for Structural Use of Concrete), familiarity with BEAM Plus certification for sustainable buildings, and knowledge of unauthorized structures regulations. Common scenarios: "How to fix water leakage in a 40-year-old apartment in Sham Shui Po?" or "What permits are needed to install solar panels on a village house in the New Territories?" Communication style is technically precise with local context, referencing iconic projects like ICC or Tseung Kwan O Cross Bay Link, and maintaining a safety-first tone. Limitations: Forbidden from approving structural designs without a Registered Structural Engineer (RSE) or advising on illegal modifications (e.g., removing load-bearing walls). Mandatory warnings: For slope safety concerns, contact the Geotechnical Engineering Office (GEO) immediately.`;
    } else if (role === '📐 Surveyor') {
      roleDescription = `Licensed professional specializing in Hong Kong's land, construction, and property sectors, ensuring compliance with local ordinances and optimizing value across development projects. General Practice Surveyor (產業測量師): Conducts property valuations, advises on land development under Hong Kong's planning framework, negotiates tenancy terms, and analyzes stamp duty implications. Quantity Surveyor (工料測量師): Prepares Bills of Quantities (BQ), manages cost overruns, resolves claims under Hong Kong Standard Form of Building Contract, and advises on demolition order cost assessments. Building Surveyor (建築測量師): Inspects unmanaged buildings for Mandatory Building Inspection Scheme (MBIS) compliance, assesses unauthorized structures risks, supervises urgent repair orders, and advises on heritage revitalization projects. Key skills & knowledge include expertise in the Rating and Valuation Department (RVD) guidelines, knowledge of first-time buyer incentives, and familiarity with Mandatory Window Inspection Scheme. Common scenarios: "How is the value of a village house in Yuen Long affected by small house policy?" or "How to legalize an unauthorized rooftop structure in Tsuen Wan?" Communication style is data-driven and legally cautious, referencing transaction data from real estate firms and government regulations. Limitations: Forbidden from certifying Occupation Permits without site inspection. Mandatory warnings: Unauthorized alterations may lead to demolition orders under Buildings Ordinance.`;
    } else if (role === '🏤 Architect') {
      roleDescription = `Licensed building design expert specializing in Hong Kong's high-density urban environment, balancing aesthetics, functionality, and compliance with stringent local regulations. Core responsibilities include designing residential and commercial spaces under Buildings Ordinance constraints (e.g., plot ratios, setback requirements), guiding heritage revitalization projects (e.g., converting pre-war shophouses into boutique hotels), optimizing micro-unit layouts for livability, integrating BEAM Plus standards for energy efficiency, and addressing typhoon resilience. Key skills & knowledge include mastery of submitting building plans workflows to the Buildings Department, expertise in subdivided unit legality and fire safety compliance, and fluency in local architectural terminology. Common scenarios: "How to maximize natural light in a 300 sq. ft flat in Causeway Bay?" or "What are the approval steps for converting industrial space into co-living units?" Communication style is practical and creative, citing regulatory standards while referencing iconic designs like PMQ or Tai Kwun. Limitations: Forbidden from approving structural modifications without a Registered Structural Engineer (RSE). Mandatory warnings: Unauthorized alterations may lead to demolition orders under Cap. 123.`;
    } else if (role === '📈 Financial Advisor') {
      roleDescription = `Licensed wealth management expert navigating Hong Kong's dynamic financial landscape, focusing on tax efficiency, retirement planning, and cross-border asset strategies. Core responsibilities include optimizing Mandatory Provident Fund (MPF) portfolios, advising on first-time buyer mortgage strategies, planning for emigration tax implications, mitigating risks in high-yield products (e.g., ELNs or crypto ETFs), and explaining Wealth Management Connect opportunities. Key skills & knowledge include expertise in Hong Kong's tax regime, knowledge of family trusts and offshore setups for asset protection, and familiarity with regulatory product risks. Common scenarios: "Should I invest in HKEX-listed tech stocks or US ETFs?" or "How to reduce tax on rental income from a Kowloon flat?" Communication style is risk-transparent, using localized analogies like comparing investments to property rentals, while ensuring compliance with SFC regulations. Limitations: Forbidden from recommending unregulated shadow banking products or guaranteeing risk-free returns. Mandatory warnings: Virtual asset platforms may lack proper licensing—verify with SFC.`;
    } 
    else {
      roleDescription = `I'll now a ${role}. How can I help you?`;
    }
    
    // Set current role and store the roleDescription internally for use in API calls
    setCurrentRole(role);
    
    // Update the current chat with the selected role
    setChats(prevChats => prevChats.map(chat => 
      chat.id === currentChatId ? { ...chat, role, roleDescription } : chat
    ));
    
    // Add a simple message to the user indicating the role has been set
    const userVisibleMessage = `I'll now a ${role}. How can I help you?`;
    const newMessage = {
      id: Date.now().toString(),
      text: userVisibleMessage,
      sender: 'bot',
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, newMessage]);
    
    try {
      // Check if user is authenticated before attempting database operations
      if (!uid) {
        console.log('No authenticated user, skipping database operations for role setting');
        return;
      }
      
      const supabaseUserId = uid;
      console.log('Authenticated Supabase user found, proceeding with role database operations:', supabaseUserId);
      
      // Check if the chat exists in the database
      const { data: existingChat, error: checkError } = await supabase
        .from('user_chats')
        .select('*')
        .eq('chat_id', currentChatId)
        .single();
      
      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking if chat exists:', checkError);
      }
      
      if (existingChat) {
        // If the chat exists, update it
        const { error: updateError } = await supabase
          .from('user_chats')
          .update({
            role: role,
            role_description: roleDescription,
            updated_at: new Date().toISOString(),
            messages: [...(existingChat.messages || []), newMessage]
          })
          .eq('chat_id', currentChatId);
        
        if (updateError) {
          console.error('Error updating role in Supabase:', updateError);
        } else {
          console.log('Role updated in Supabase');
        }
      } else {
        // If the chat doesn't exist, create it
        const { error: insertError } = await supabase
          .from('user_chats')
          .insert({
            chat_id: currentChatId,
            user_id: supabaseUserId,
            name: t('newChat'),
            description: userVisibleMessage,
            role: role,
            role_description: roleDescription,
            messages: [newMessage],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        
        if (insertError) {
          console.error('Error creating chat with role in Supabase:', insertError);
        } else {
          console.log('New chat with role created in Supabase');
        }
      }
    } catch (error) {
      console.error('Error saving role to Supabase:', error);
    }
  };

  // AI Generation handlers

  // Radio button handlers for generate options
  const handleSelectGenerateXLSX = () => {
    setSelectedGenerateOption(selectedGenerateOption === 'xlsx' ? null : 'xlsx');
  };

  const handleSelectGenerateDOC = () => {
    setSelectedGenerateOption(selectedGenerateOption === 'doc' ? null : 'doc');
  };

  // Actual generation functions called when send button is pressed
  const executeGenerateXLSX = async (text) => {
    try {
      setIsSendDisabled(true);
      
      // Save user message to database if authenticated
      let userMessageId = null;
      if (uid !== 'anonymous') {
        const savedUserMessage = await addUserMessage(
          currentChatId,
          uid,
          text,
          {},
          Date.now().toString()
        );
        userMessageId = savedUserMessage?.id;
      }
      
      // Add user message (as normal chat message)
      const userMessage = {
        id: userMessageId || Date.now().toString(),
        text: text,
        sender: 'user',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, userMessage]);
      
      // Track this message for coin deduction display
      setRecentCoinDeductions(prev => new Set([...prev, userMessage.id]));
      
      // Update the current chat's messages in local state
      setChats(prevChats => prevChats.map(chat => 
        chat.id === currentChatId ? { ...chat, messages: [...(chat.messages || []), userMessage] } : chat
      ));
      
      // Create a streaming bot message that will be updated in real-time
      const streamingMessageId = 'streaming-' + Date.now().toString();
      let streamingContent = '';
      
      // Add initial empty streaming message
      setMessages(prev => [...prev, {
        id: streamingMessageId,
        text: '',
        sender: 'bot',
        isStreaming: true
      }]);

      // Define chunk handler for real-time updates
      let displayContent = '';
      
      const handleChunk = (chunk) => {
        // Check for reset signal
        if (chunk === '__RESET__') {
          displayContent = '';
          return;
        }
        if (chunk.startsWith('__RESET__')) {
          displayContent = '';
          chunk = chunk.substring(9);
        }
        
        // Since the streaming function already sends clean content, just accumulate it
        displayContent += chunk;
        
        // Update the streaming message with clean content
        setMessages(prev => prev.map(msg => 
          msg.id === streamingMessageId 
            ? { ...msg, text: displayContent || 'Processing...' }
            : msg
        ));
      };

      // Call streaming webhook for XLSX generation
      const result = await generateXLSXStreaming(text, handleChunk);
      
      // Finalize the streaming message with the clean response
      const finalText = displayContent || result || 'Response completed';
      setMessages(prev => prev.map(msg => 
        msg.id === streamingMessageId 
          ? { ...msg, text: finalText, isStreaming: false, timestamp: new Date().toISOString() }
          : msg
      ));
      
      // Save AI response to database if authenticated
      if (uid !== 'anonymous') {
        const assistantMessage = await startAssistantMessage(currentChatId, uid, {}, streamingMessageId);
        if (assistantMessage) {
          await appendMessageChunk(assistantMessage.id, finalText);
          await finalizeMessage(assistantMessage.id);
        }
      }
      
    } catch (error) {
      console.error('Error generating XLSX:', error);
      Alert.alert('Error', 'Failed to generate spreadsheet. Please try again.');
      // Remove loading message on error
      setMessages(prev => prev.filter(msg => !msg.isLoading));
    } finally {
      setIsSendDisabled(false);
    }
  };

  const executeGenerateDOC = async (text) => {
    try {
      setIsSendDisabled(true);
      
      // Save user message to database if authenticated
      let userMessageId = null;
      if (uid !== 'anonymous') {
        const savedUserMessage = await addUserMessage(
          currentChatId,
          uid,
          text,
          {},
          Date.now().toString()
        );
        userMessageId = savedUserMessage?.id;
      }
      
      // Add user message (as normal chat message)
      const userMessage = {
        id: userMessageId || Date.now().toString(),
        text: text,
        sender: 'user',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, userMessage]);
      
      // Track this message for coin deduction display
      setRecentCoinDeductions(prev => new Set([...prev, userMessage.id]));
      
      // Update the current chat's messages in local state
      setChats(prevChats => prevChats.map(chat => 
        chat.id === currentChatId ? { ...chat, messages: [...(chat.messages || []), userMessage] } : chat
      ));
      
      // Create a streaming bot message that will be updated in real-time
      const streamingMessageId = 'streaming-' + Date.now().toString();
      let streamingContent = '';
      
      // Add initial empty streaming message
      setMessages(prev => [...prev, {
        id: streamingMessageId,
        text: '',
        sender: 'bot',
        isStreaming: true
      }]);

      // Define chunk handler for real-time updates
      let displayContent = '';
      
      const handleChunk = (chunk) => {
        // Check for reset signal
        if (chunk === '__RESET__') {
          displayContent = '';
          return;
        }
        if (chunk.startsWith('__RESET__')) {
          displayContent = '';
          chunk = chunk.substring(9);
        }
        
        // Since the streaming function already sends clean content, just accumulate it
        displayContent += chunk;
        
        // Update the streaming message with clean content
        setMessages(prev => prev.map(msg => 
          msg.id === streamingMessageId 
            ? { ...msg, text: displayContent || 'Processing...' }
            : msg
        ));
      };

      // Call streaming webhook for DOC generation
      const result = await generateDOCStreaming(text, handleChunk);
      
      // Finalize the streaming message with the clean response
      const finalText = displayContent || result || 'Response completed';
      setMessages(prev => prev.map(msg => 
        msg.id === streamingMessageId 
          ? { ...msg, text: finalText, isStreaming: false, timestamp: new Date().toISOString() }
          : msg
      ));
      
      // Save AI response to database if authenticated
      if (uid !== 'anonymous') {
        const assistantMessage = await startAssistantMessage(currentChatId, uid, {}, streamingMessageId);
        if (assistantMessage) {
          await appendMessageChunk(assistantMessage.id, finalText);
          await finalizeMessage(assistantMessage.id);
        }
      }
      
    } catch (error) {
      console.error('Error generating DOC:', error);
      Alert.alert('Error', 'Failed to generate document. Please try again.');
      // Remove loading message on error
      setMessages(prev => prev.filter(msg => !msg.isLoading));
    } finally {
      setIsSendDisabled(false);
    }
  };

  // Function to handle image tap and show fullscreen view
  const handleImageTap = (imageUri) => {
    console.log('Opening image in full screen:', imageUri);
    if (typeof imageUri === 'string' && imageUri) {
      setFullScreenImage(imageUri);
    } else {
      console.error('Invalid image URI:', imageUri);
      Toast.show({
        type: 'error',
        text1: 'Cannot display image',
        text2: 'The image URL appears to be invalid',
        position: 'bottom',
        visibilityTime: 3000,
      });
    }
  };

  // Add a function to render tables
  const renderTable = (tableData, index) => {
    if (!tableData.tableHeaders || !tableData.tableData || 
        tableData.tableHeaders.length === 0 || tableData.tableData.length === 0) {
      return null;
    }
    
    // Process table data to remove asterisks/stars from content
    const processedTableHeaders = tableData.tableHeaders.map(header => 
      header ? header.replace(/\*\*/g, '').replace(/\*/g, '').trim() : '');
    
    const processedTableData = tableData.tableData.map(row => 
      row.map(cell => cell ? cell.toString().replace(/\*\*/g, '').replace(/\*/g, '').trim() : ''));
    
    // Calculate column widths based on content
    const getMaxTextLengthForColumn = (colIndex) => {
      const headerLength = processedTableHeaders[colIndex]?.length || 0;
      const cellLengths = processedTableData.map(row => (row[colIndex]?.length || 0));
      return Math.max(headerLength, ...cellLengths);
    };
    
    const columnCount = processedTableHeaders.length;
    const columnLengths = Array.from({ length: columnCount }, (_, i) => getMaxTextLengthForColumn(i));
    
    // Calculate minimum width for each column (at least 80px, max 200px for auto-sizing)
    const getColumnWidth = (colIndex) => {
      const textLength = columnLengths[colIndex];
      const baseWidth = Math.max(80, Math.min(200, textLength * 8 + 20));
      return baseWidth;
    };
    
    // Calculate total table width
    const totalTableWidth = columnLengths.reduce((sum, _, index) => sum + getColumnWidth(index), 0);
    const screenWidth = 350; // Approximate screen width for table container
    
    // Determine if table needs horizontal scrolling
    const needsHorizontalScroll = totalTableWidth > screenWidth || columnCount > 3;
    
    // Check if this is a schedule-like table
    const isScheduleTable = processedTableHeaders.some(header => 
      header && (header.includes("Day") || header.includes("Morning") || header.includes("Afternoon") || 
                 header.includes("Time") || header.includes("Schedule")));
    
    return (
      <View key={`table-${index}`} style={[
        styles.tableContainer,
        isScheduleTable && styles.scheduleTableContainer,
        needsHorizontalScroll && { maxWidth: '100%' }
      ]}>
        {needsHorizontalScroll ? (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={true}
            style={{ maxWidth: '100%' }}
            contentContainerStyle={{ minWidth: totalTableWidth }}
          >
            <TableContent 
              tableHeaders={processedTableHeaders}
              tableData={processedTableData}
              columnLengths={columnLengths} 
              getColumnWidth={getColumnWidth}
              isScheduleTable={isScheduleTable}
              needsHorizontalScroll={needsHorizontalScroll}
            />
          </ScrollView>
        ) : (
          <TableContent 
            tableHeaders={processedTableHeaders}
            tableData={processedTableData}
            columnLengths={columnLengths} 
            getColumnWidth={getColumnWidth}
            isScheduleTable={isScheduleTable}
            needsHorizontalScroll={needsHorizontalScroll}
          />
        )}
      </View>
    );
  };

  // Create a separate component for table content
  const TableContent = React.memo(({ 
    tableHeaders, 
    tableData, 
    columnLengths, 
    getColumnWidth, 
    isScheduleTable, 
    needsHorizontalScroll 
  }) => {
    return (
      <View style={[
        isScheduleTable ? styles.scheduleTableWrapper : styles.regularTableWrapper,
        needsHorizontalScroll && { minWidth: columnLengths.reduce((sum, _, index) => sum + getColumnWidth(index), 0) }
      ]}>
        {/* Table header row */}
        <View style={[styles.tableHeaderRow, isScheduleTable && styles.scheduleTableHeaderRow]}>
          {tableHeaders.map((header, headerIndex) => {
            const columnWidth = getColumnWidth(headerIndex);
            
            return (
              <View 
                key={`header-${headerIndex}`} 
                style={[
                  styles.tableHeaderCell,
                  {
                    width: needsHorizontalScroll ? columnWidth : undefined,
                    flex: needsHorizontalScroll ? 0 : 1,
                    minWidth: needsHorizontalScroll ? columnWidth : 80,
                  },
                  headerIndex === 0 ? styles.tableFirstColumn : null,
                  headerIndex === tableHeaders.length - 1 ? styles.tableLastColumn : null,
                  isScheduleTable && styles.scheduleTableHeaderCell
                ]}
              >
                <Text 
                  style={[
                    styles.tableHeaderText,
                    { color: '#333333' },
                    isScheduleTable && styles.scheduleTableHeaderText
                  ]}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {header || ''}
                </Text>
              </View>
            );
          })}
        </View>
        
        {/* Table data rows */}
        {tableData.map((row, rowIndex) => {
          // Check if the row contains day information
          const isDayRow = row.some(cell => cell && cell.toString().includes && 
            (cell.toString().includes("Day") || cell.toString().includes("day")));
          
          return (
            <View 
              key={`row-${rowIndex}`} 
              style={[
                styles.tableRow,
                rowIndex % 2 === 0 ? styles.tableEvenRow : styles.tableOddRow,
                isScheduleTable && styles.scheduleTableRow,
                isDayRow && styles.dayRow,
                rowIndex === tableData.length - 1 && styles.tableLastRow
              ]}
            >
              {row.map((cell, cellIndex) => {
                const columnWidth = getColumnWidth(cellIndex);
                
                return (
                  <View 
                    key={`cell-${rowIndex}-${cellIndex}`} 
                    style={[
                      styles.tableCell,
                      {
                        width: needsHorizontalScroll ? columnWidth : undefined,
                        flex: needsHorizontalScroll ? 0 : 1,
                        minWidth: needsHorizontalScroll ? columnWidth : 80,
                      },
                      cellIndex === 0 ? styles.tableFirstColumn : null,
                      cellIndex === row.length - 1 ? styles.tableLastColumn : null,
                      isScheduleTable && styles.scheduleTableCell,
                      isDayRow && styles.dayCellStyle
                    ]}
                  >
                    <Text 
                      style={[
                        styles.tableCellText,
                        { color: '#333333' },
                        isScheduleTable && styles.scheduleTableCellText,
                        isDayRow && styles.dayText
                      ]}
                      numberOfLines={3}
                      ellipsizeMode="tail"
                    >
                      {cell || ''}
                    </Text>
                  </View>
                );
              })}
            </View>
          );
        })}
      </View>
    );
  });

  // Improve scrollToBottom function
  const scrollToBottom = () => {
    if (flatListRef.current && messages.length > 0) {
      // Use requestAnimationFrame for smoother scrolling
      requestAnimationFrame(() => {
        flatListRef.current.scrollToEnd({ animated: true });
      });
    }
  };
  
  // Improved handleScroll function to detect user scrolling and manage scroll button
  const handleScroll = (event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const contentSizeHeight = event.nativeEvent.contentSize.height;
    const layoutHeight = event.nativeEvent.layoutMeasurement.height;
    
    // Track user scrolling to prevent auto-scroll interference
    setIsUserScrolling(true);
    setLastScrollTime(Date.now());
    
    // Show the scroll button if not near the bottom
    // For non-inverted FlatList, bottom is when offsetY + layoutHeight >= contentSizeHeight
    const isNearBottom = offsetY + layoutHeight >= contentSizeHeight - 50;
    setShowScrollToBottom(!isNearBottom);
    
    // Reset user scrolling flag after a longer delay to prevent auto-scroll interference
    setTimeout(() => {
      if (Date.now() - lastScrollTime >= 2000) { // Increased from 1000ms to 2000ms
        setIsUserScrolling(false);
      }
    }, 2000);
  };
  
  // Memoize the last message to prevent unnecessary effect triggers
  const lastMessage = useMemo(() => {
    return messages.length > 0 ? messages[messages.length - 1] : null;
  }, [messages.length, messages[messages.length - 1]?.id, messages[messages.length - 1]?.isStreaming]);

  // Add an effect to handle scrolling when messages change - only for new messages from user or bot
  useEffect(() => {
    if (lastMessage && !isUserScrolling) {
      // Only auto-scroll for genuinely new messages (user messages or completed bot messages)
      if (lastMessage.id !== lastScrolledMessageId.current && 
          (lastMessage.sender === 'user' || (lastMessage.sender === 'bot' && !lastMessage.isStreaming))) {
        lastScrolledMessageId.current = lastMessage.id;
        const timeoutId = setTimeout(() => {
          if (!isUserScrolling) {
            scrollToBottom();
          }
        }, 300); // Increased delay to give user more time
        
        return () => clearTimeout(timeoutId);
      }
    }
  }, [lastMessage, isUserScrolling]);

  const navigateToSubscription = () => {
    setLowBalanceModalVisible(false);
    navigation.navigate('SubscriptionScreen');
  };
  
 

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
      

      
      {/* Header */}
      <View style={[styles.header, {backgroundColor: colors.background2 , borderColor: colors.border ,borderBottomWidth: 1}]}>
        <TouchableOpacity style={styles.backButton2} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back-ios-new" size={24} color="white" />
        </TouchableOpacity>
        
        <View style={styles.headerCenterContent}>
          <Image source={require('../assets/Avatar/Cat.png')} style={styles.botIcon} />
          <View style={styles.headerTextContainer}>
            <Text style={styles.botRole}>{t('matrixAIBot')}</Text>
          </View>
        </View>
        
        {/* Header Right Actions */}
        <View style={styles.headerRightActions}>
          {/* New Chat Button */}
          <TouchableOpacity 
            style={styles.headerNewChatButton} 
            onPress={startNewChat}
          >
            <MaterialCommunityIcons name="chat-plus-outline" size={22} color="white" />
          </TouchableOpacity>
          
          {/* Navbar Toggle Button */}
          <TouchableOpacity 
            style={styles.navbarToggleButton} 
            onPress={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            <MaterialIcons name="menu" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main content area - using KeyboardAvoidingView for the entire chat area */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        {/* Chat List */}
        <View style={{ flex: 1 }}>
          <Animatable.View 
            animation="fadeIn" 
            duration={1000} 
            style={{ flex: 1 }}
          >
            {isChatsLoading ? (
              // Show skeleton loading when chats are loading
              <ScrollView 
                style={styles.messagesList}
                contentContainerStyle={styles.messagesContainer}
              >
                {[1, 2, 3].map((_, index) => (
                  <View key={`skeleton-${index}`}>
                    {renderSkeletonMessage()}
                  </View>
                ))}
              </ScrollView>
            ) : messages.length > 0 ? (
              <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item, index) => item.id ? item.id.toString() : `message-${index}`}
                renderItem={renderMessage}
                contentContainerStyle={[
                  styles.messagesContainer,
                
                ]}
                style={styles.messagesList}
                onScroll={handleScroll}
                scrollEventThrottle={200}
                // Lazy loading optimizations
                initialNumToRender={10} // Only render first 10 messages initially
                maxToRenderPerBatch={5} // Render 5 messages per batch
                windowSize={10} // Keep 10 screens worth of messages in memory
                removeClippedSubviews={true} // Remove off-screen views to save memory
                // Pagination for loading older messages
                onEndReached={handleScrollToTop}
                onEndReachedThreshold={0.1}
                inverted={false} // Display messages in chronological order
                maintainVisibleContentPosition={{
                  minIndexForVisible: 0,
                  autoscrollToTopThreshold: 10,
                }}
                ListHeaderComponent={isLoadingOlderMessages ? (
                  <View style={styles.loadingOlderContainer}>
                    <ActivityIndicator size="small" color="#4C8EF7" />
                    <Text style={styles.loadingOlderText}>Loading older messages...</Text>
                  </View>
                ) : null}
                onContentSizeChange={() => {
                  // Only auto-scroll during initial load or when actively streaming
                  // Remove excessive auto-scroll that causes constant scrolling issues
                }}
                onLayout={() => {
                  // Only auto-scroll on initial layout, not on every layout change
                  if (flatListRef.current && messages.length > 0 && !dataLoaded) {
                    flatListRef.current.scrollToEnd({ animated: false });
                  }
                }}
                // Performance optimizations
                updateCellsBatchingPeriod={50}
                legacyImplementation={false}
                // Removed maintainVisibleContentPosition as it interferes with manual scrolling
              />
            ) : (
              <View style={styles.emptyStateContainer}>
                {/* ... existing empty state code ... */}
              </View>
            )}

            {/* Placeholder for New Chat */}
            {messages.length === 0 && dataLoaded && (
              <View style={styles.placeholderContainer}>
                <Image source={require('../assets/matrix.png')} style={styles.placeholderImage} />
                <Text style={[styles.placeholderText , {color: colors.text}]}>{t('hiImMatrixAIBot')}</Text>
                <Text style={[styles.placeholderText2 , {color: colors.text}]}>{t('howCanIHelpYouToday')}</Text>
                
                {/* New role selection UI */}
                <Text style={[styles.placeholderText3 , {color: colors.text}]}>{t('youCanAskMeAnyQuestionOrYouCanSelectTheBelowRole')}</Text>
                <Text style={[styles.placeholderText4 , {color: colors.text}]}></Text>
                <View style={styles.roleButtonsContainer}>
                  <View style={styles.roleButtonRow}>
                    <TouchableOpacity 
                      style={styles.roleButton} 
                      onPress={() => handleRoleSelection('🩺 Doctor')}
                    >
                      <Text style={styles.roleButtonText}>🩺</Text>
                      <Text style={styles.roleButtonText}>{t('doctor')}</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.roleButton} 
                      onPress={() => handleRoleSelection('📚 Teacher')}
                    >
                      <Text style={styles.roleButtonText}>📚</Text>
                      <Text style={styles.roleButtonText}>{t('teacher')}</Text>
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.roleButtonRow}>
                    <TouchableOpacity 
                      style={styles.roleButton} 
                      onPress={() => handleRoleSelection('⚖️ Lawyer')}
                    >
                      <Text style={styles.roleButtonText}>⚖️</Text>
                      <Text style={styles.roleButtonText}>{t('lawyer')}</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.roleButton} 
                      onPress={() => handleRoleSelection('🌱 Psychologist')}
                    >
                      <Text style={styles.roleButtonText}>🌱</Text>
                      <Text style={styles.roleButtonText}>{t('psychologist')}</Text>
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.roleButtonRow}>
                    <TouchableOpacity 
                      style={styles.roleButton} 
                      onPress={() => handleRoleSelection('🔧 Engineer')}
                    >
                      <Text style={styles.roleButtonText}>🔧</Text>
                      <Text style={styles.roleButtonText}>{t('engineer')}</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.roleButton} 
                      onPress={() => handleRoleSelection('📐 Surveyor')}
                    >
                      <Text style={styles.roleButtonText}>📐</Text>
                      <Text style={styles.roleButtonText}>{t('surveyor')}</Text>
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.roleButtonRow}>
                    <TouchableOpacity 
                      style={styles.roleButton} 
                      onPress={() => handleRoleSelection('🏤 Architect')}
                    >
                      <Text style={styles.roleButtonText}>🏤</Text>
                      <Text style={styles.roleButtonText}>{t('architect')}</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.roleButton} 
                      onPress={() => handleRoleSelection('📈 Financial Advisor')}
                    >
                      <Text style={styles.roleButtonText}>📈</Text>
                      <Text style={styles.roleButtonText}>{t('financialAdvisor')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          </Animatable.View>
        </View>

        {/* Input area */}
        <View style={styles.inputContainer}>
          <View style={styles.inputContentContainer}>
            {/* File Preview Component */}
            <FilePreviewComponent
              attachedFiles={attachedFiles}
              onRemoveFile={handleRemoveFile}
              onFilePress={handleFilePress}
              colors={colors}
            />
            
            {selectedImage && (
              <View style={[styles.imagePreviewContainer]}>
                <View style={styles.imageIconContainer}>
                  <Ionicons name="image-outline" size={24} color="#fff" />
                </View>
                <Text style={styles.imageNameText} numberOfLines={1} ellipsizeMode="middle">
                  {imageFileName || "Selected Image"}
                </Text>
                <TouchableOpacity 
                  style={styles.removeImageButton}
                  onPress={() => setSelectedImage(null)}
                >
                  <Ionicons name="close-circle" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
            <View style={[styles.chatBoxContainer2 , {zIndex: 20}]}>
              <LinearGradient
                colors={['transparent', 'transparent', colors.background2, colors.background2]}
                locations={[0, 0.5, 0.5, 1]}
                style={{
                  height:40,
                  width: '100%',
                  overflow: 'visible'
                }}>
                <View style={[styles.chatBoxContainer , {zIndex: 20}]}>
                  <TextInput
                    style={[styles.textInput, { textAlignVertical: 'top' }]}
                    placeholder={selectedImage ? "Add a caption..." : t('sendAMessage')}
                    placeholderTextColor="#ccc"
                    value={inputText}
                    onChangeText={handleInputChange}
                    onSubmitEditing={() => {
                      handleSendMessage();
                      Keyboard.dismiss();
                    }}
                    multiline={true}
                    numberOfLines={3}
                    maxLength={2000}
                    scrollEnabled={true}
                    returnKeyType="send"
                    blurOnSubmit={Platform.OS === 'ios' ? false : true}
                  />
                  <TouchableOpacity onPress={handleAttach} style={styles.sendButton}>
                    {showAdditionalButtons ? (
                      <Ionicons name="close" size={28} color="#4C8EF7" />
                    ) : (
                      <Ionicons name="add" size={28} color="#4C8EF7" />
                    )}
                  </TouchableOpacity>
                  <View style={styles.sendButtonContainer}>
                    <TouchableOpacity 
                      onPress={handleSendMessage} 
                      style={[styles.sendButton, isSendDisabled && styles.sendButtonDisabled]} 
                      disabled={isSendDisabled}
                    >
                      {isSendDisabled ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Ionicons name="send" size={24} color="#4C8EF7" />
                      )}
                    </TouchableOpacity>
                    {/* Coin cost label on send button */}
                    {(inputText.trim() || selectedImage || selectedGenerateOption) && (
                      <View style={styles.sendButtonCoinLabel}>
                        <Image 
                          source={require('../assets/coin.png')} 
                          style={styles.sendButtonCoinIcon} 
                        />
                        <Text style={styles.sendButtonCoinText}>
                          -{selectedGenerateOption ? '5' : (selectedImage ? '2' : '1')}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </LinearGradient>
            </View>
            
            {/* Radio buttons for generate options - below text input */}
            <View style={styles.radioButtonsContainer}>
              <TouchableOpacity 
                onPress={handleSelectGenerateDOC} 
                style={[
                  styles.radioButton, 
                  selectedGenerateOption === 'doc' && styles.radioButtonSelected
                ]}
              >
                <View style={styles.radioButtonContent}>
                  <MaterialCommunityIcons 
                    name="file-word" 
                    size={18} 
                    color={selectedGenerateOption === 'doc' ? '#fff' : '#4C8EF7'} 
                  />
                  <Text style={[
                    styles.radioButtonText,
                    selectedGenerateOption === 'doc' && styles.radioButtonTextSelected
                  ]}>
                    Generate Doc
                  </Text>
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={handleSelectGenerateXLSX} 
                style={[
                  styles.radioButton, 
                  selectedGenerateOption === 'xlsx' && styles.radioButtonSelected
                ]}
              >
                <View style={styles.radioButtonContent}>
                  <MaterialCommunityIcons 
                    name="file-excel" 
                    size={18} 
                    color={selectedGenerateOption === 'xlsx' ? '#fff' : '#4C8EF7'} 
                  />
                  <Text style={[
                    styles.radioButtonText,
                    selectedGenerateOption === 'xlsx' && styles.radioButtonTextSelected
                  ]}>
                    Generate XLSX
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
            
            {showAdditionalButtons && (
              <View style={[styles.additionalButtonsContainer, {backgroundColor: colors.background2} , {zIndex: 10}]}>
                <View style={styles.buttonRow}>
                  <TouchableOpacity style={styles.additionalButton2} onPress={() => handleImageSelection('camera')}>
                    <View style={styles.additionalButton}>
                      <Ionicons name="camera" size={28} color="#4C8EF7" />
                    </View>
                    <Text style={{color: colors.text}}>Photo</Text>
                  </TouchableOpacity>
                        
                  <TouchableOpacity style={styles.additionalButton2} onPress={() => handleImageSelection('gallery')}>
                    <View style={styles.additionalButton}>
                      <Ionicons name="image" size={28} color="#4C8EF7" />
                    </View>
                    <Text style={{color: colors.text}}>Image</Text>
                  </TouchableOpacity>
                        
                  <TouchableOpacity style={styles.additionalButton2} onPress={handleDocumentSelection}>
                    <View style={styles.additionalButton}>
                      <Ionicons name="attach" size={28} color="#4C8EF7" />
                    </View>
                    <Text style={{color: colors.text}}>Document</Text>
                  </TouchableOpacity>
                </View>
                

              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      {isSidebarOpen && (
        <TouchableWithoutFeedback onPress={() => setIsSidebarOpen(false)}>
          <LeftNavbarBot
            chats={chats}
            onSelectChat={selectChat}
            onNewChat={startNewChat}
            onClose={() => setIsSidebarOpen(false)}
            onDeleteChat={onDeleteChat}
            currentChatId={currentChatId}
            isLoading={isChatsLoading}
          />
        </TouchableWithoutFeedback>
      )}

      {/* Full Screen Image Modal */}
      <Modal
        visible={fullScreenImage !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setFullScreenImage(null)}
      >
        <View style={styles.fullScreenImageContainer}>
          {fullScreenImage ? (
            <View style={styles.fullScreenImageWrapper}>
              <Image
                source={{ uri: fullScreenImage }}
                style={styles.fullScreenImage}
                resizeMode="contain"
                onError={() => {
                  console.error('Failed to load image:', fullScreenImage);
                  Alert.alert(
                    'Image Error',
                    'Unable to load the image. The URL may be invalid.',
                    [{ text: 'OK', onPress: () => setFullScreenImage(null) }]
                  );
                }}
              />
            </View>
          ) : (
            <View style={styles.fullScreenImageError}>
              <Text style={styles.fullScreenErrorText}>
                Unable to load the image. The URL may be invalid.
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.closeFullScreenButton}
            onPress={() => setFullScreenImage(null)}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          
          {/* Background overlay to close on tap */}
          <TouchableOpacity
            style={styles.fullScreenBackdrop}
            activeOpacity={1}
            onPress={() => setFullScreenImage(null)}
          />
        </View>
      </Modal>

      {/* Scroll to bottom button */}
      {showScrollToBottom && (
        <TouchableOpacity 
          style={[
            styles.scrollToBottomButton,
            showAdditionalButtons && styles.scrollToBottomButtonAdjusted
          ]}
          onPress={scrollToBottom}
        >
          <Text style={styles.scrollToBottomIcon}>↓</Text>
        </TouchableOpacity>
      )}
      
      {/* Add Low Balance Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={lowBalanceModalVisible}
        onRequestClose={() => setLowBalanceModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, {backgroundColor: colors.background2}]}>
            <Image 
              source={require('../assets/coin.png')} 
              style={styles.modalCoinImage} 
            />
            <Text style={[styles.modalTitle, {color: colors.text}]}>Insufficient Balance</Text>
            <Text style={[styles.modalMessage, {color: colors.text}]}>
              You need {requiredCoins} coins to use this feature.
              Your current balance is {coinCount} coins.
            </Text>
            <View style={styles.modalButtonsContainer}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => setLowBalanceModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.rechargeButton]} 
                onPress={navigateToSubscription}
              >
                <Text style={styles.rechargeButtonText}>Recharge Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>


    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  // Skeleton styles
  skeletonTextContainer: {
    padding: 15,
    paddingTop: 5,
  },
  skeletonLine: {
    height: 15,
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 4,
    marginBottom: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  skeletonShimmer: {
    width: 100,
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },

  backButton: {
    position: 'absolute',
    left: 0,
    top: '50%',
    zIndex: 1,
    width:20,
    height:70,
    backgroundColor:'#EDEDEDC8',
    justifyContent:'center',
    alignItems:'center',
    borderRadius:15,
  },


  backButton2: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#007bff',
   
    marginRight:10,
  },
  backIcon: {
    width: 24,
    height: 24,
    tintColor: '#000',
  },
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    backgroundColor: '#FFFFFF',
    zIndex: 10,
  },
  headerCenterContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    marginHorizontal: 10,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerNewChatButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(76, 142, 247, 0.2)',
  },
  navbarToggleButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(76, 142, 247, 0.1)',
  },
  headerIcon: {
    width: 30,
    height: 30,
    resizeMode: 'contain',
   
  },
  headerIcon2: {

  },
  headerIcon3: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  keyboardAvoidingView: {
    width: '100%',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 10,
    position: 'absolute',
  },
  inputContentContainer: {
    width: '100%',
    paddingBottom: 5,
  },
  chatBoxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginHorizontal: 10, // fixed padding is better than '%'
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#007bff',
    paddingHorizontal: 10,
    backgroundColor: '#fff',
    zIndex: 10,
  },
  chatBoxContainer2: {
   height: 40, // Set a specific height to properly show the gradient
   width: '100%',
   overflow: 'visible',
   zIndex: -10,
  },
  NewChat: {
    alignSelf: 'center',
    backgroundColor: '#4C8EF7',
    borderRadius: 10,
    marginBottom: 10,
  },
  NewChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 5,
    justifyContent: 'center',

    borderRadius: 20,
  },
  NewChatText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },

  botIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  sendButton: {
   padding: 5,
  },
  disabledButton: {
    // No opacity or visual changes, just disable the button functionality
  },
  
  // WhatsApp style image preview container
  imagePreviewContainer: {
  marginBottom:5,
  marginLeft:15,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    width: '70%',
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderWidth: 1,
    borderColor: '#4C8EF7',
    zIndex: 5,
  },
  imageIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4C8EF7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageNameText: {
    color: '#333',
    fontSize: 14,
    flex: 1,
    marginHorizontal: 10,
  },
  removeImageButton: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: '#4C8EF7',
    borderRadius: 15,
    padding: 2,
    zIndex: 10,
  },
  headerTextContainer: {
    flex: 1,
    marginHorizontal: 10,
  },
  botName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  botRole: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4C8EF7',
    marginTop: 2,
  },
  botDescription: {
    fontSize: 12,
    color: '#666',
  },
  chat: {
    paddingVertical: 10,
    flexGrow: 1,
  },
 

  messageContainer: {
    maxWidth: '85%',
    marginVertical: 4,
    padding: 8,
    borderRadius: 5,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    flexDirection: 'column',
    flexShrink: 1,
    overflow: 'visible', // Changed from 'hidden' to show tails
    position: 'relative',
  },
  botMessageContainer: {
    alignSelf: 'stretch',
    width: '100%',
    maxWidth: '100%',
    marginLeft: 0,
    marginRight: 0,
    padding: 15,
    backgroundColor: 'transparent',
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    marginTop: 0,
    marginBottom: 0,
  },
  userMessageContainer: {
    alignSelf: 'flex-end',
    backgroundColor: '#4C8EF7',
    marginRight: 15,
    maxWidth: '90%',
    padding: 6,
    paddingVertical: 4,
    borderRadius: 18,
    borderBottomRightRadius: 4,
    shadowColor: '#4C8EF7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
    marginVertical: 1,
  },
  botTail: {
    display: 'none', // Hide the tail for bot messages
  },
  userTail: {
    position: 'absolute',
    right: -10,
    bottom: 0,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 10,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#4C8EF7',
  },

  attachmentsContainer: {
    marginTop: 10,
    paddingHorizontal: 5,
  },

  streamingImagesContainer: {
    marginTop: 10,
    paddingHorizontal: 5,
  },

  streamingImageWrapper: {
    marginBottom: 10,
    alignItems: 'center',
  },

  streamingImage: {
    width: 200,
    height: 200,
    borderRadius: 10,
    maxWidth: '100%',
  },

  imageDescription: {
    marginTop: 5,
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingHorizontal: 10,
  },

  loadingContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
    marginLeft: 1,
    marginTop: -50, // Move the animation higher by adding negative top margin
    padding: 15,
    borderRadius: 15,
    maxWidth: 150,
    minHeight: 100,
  },
  loadingMessageContainer: {
    display: 'none', // Hide this container completely
    position: 'absolute',
    opacity: 0,
    width: 0,
    height: 0,
  },
  loadingAnimation: {
    width: 250,
    height: 200,
  },
  botText: {
    fontSize: 16,
    color: '#333333', // Default color that will be overridden with inline style
  },
  userText: {
    color: '#fff',
    fontSize: 16,
  },
  textInput: {
    flex: 1,
    maxHeight: 80, // Limit height for roughly 3 lines
    minHeight: 40,
    padding: 10,
    fontSize: 16,
    marginHorizontal: 10,
    justifyContent: 'center',
    alignSelf: 'center',
    textAlignVertical: 'top',
  },
  inputContainer: {
    width: '100%',
    backgroundColor: 'transparent',
  },
  icon: {
    marginHorizontal: 10,
  },
  loading: {
    fontSize: 14,
    color: '#777',
    textAlign: 'center',
    marginTop: 10,
  },
  viewMoreButton: {
    alignSelf: 'flex-end',
    marginTop: 5,
  },
  viewMoreText: {
    color: '#4C8EF7',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  placeholderContainer: {
    position: 'absolute',
    top: '40%',
    left: '50%',
    transform: [{ translateX: '-50%' }, { translateY: '-50%' }],
    alignItems: 'center',
    zIndex: 1,
  },
  placeholderImage: {
    width: 100,
    height: 100,
    tintColor: '#fff',
    resizeMode: 'contain',
  },
  placeholderText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  placeholderText2: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  placeholderText3: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
  
  },
  placeholderText4: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
   
    marginBottom: 10,
  },
  roleButtonsContainer: {
    marginTop: 10,
    width: '90%',
    alignItems: 'center',
  },
  roleButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 10,
  },
  roleButton: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,

  
    backgroundColor:'#F0F8FF',
    minWidth: '48%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
  },
  roleButtonText: {
    color: '#4C8EF7',
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 20,
    width: '90%',
    maxHeight: '80%',
    justifyContent: 'space-between',
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
    marginTop: 5,
  },
  imageContainer: {
    marginVertical: 5,
    borderRadius: 10,
    overflow: 'hidden',
    width: '100%',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  questionInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    padding: 10,
    fontSize: 16,
    marginBottom: 15,
    maxHeight: 80,
    textAlignVertical: 'top',
    width: '100%',
  },
  quickQuestionsContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    marginBottom: 15,
    maxHeight: 200,
    width: '100%',
  },
  quickQuestionButton: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#4C8EF7',
    borderRadius: 10,
    marginBottom: 8,
    width: '100%',
  },
  quickQuestionText: {
    fontSize: 14,
    color: '#4C8EF7',
  },
  confirmButton: {
    backgroundColor: '#4C8EF7',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 5,
    width: '100%',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 5,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  additionalButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 10,
    backgroundColor: '#333',
    paddingHorizontal: 20,
    marginBottom: -10,
    zIndex: -5,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  additionalButton2: {
    flex: 1, // Allow buttons to take equal space
    alignItems: 'center', // Center the content

   
  },
  additionalButton: {
    alignItems: 'center',
    backgroundColor:'#D1D1D151',
    borderRadius:15,
    width:'90%',
   paddingVertical:23,
  padding:28,
  },
  additionalButton3: {
    alignItems: 'center',
    alignSelf:'center',
    backgroundColor:'#76767651',
    borderRadius:15,
  padding:8,
  zIndex:30,
  },
  additionalIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  summaryPromptContainer: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 20,
    borderTopWidth: 1,
    borderColor: '#ccc',
    alignItems: 'center',
  },
  summaryPromptText: {
    fontSize: 16,
    marginBottom: 10,
  },
  summaryPromptButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  summaryPromptButton: {
    padding: 10,
    backgroundColor: '#007AFF',
    borderRadius: 5,
  },
  summaryPromptButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  quickActionContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    position: 'absolute',
    width: '100%',
    paddingHorizontal: 10,
  },
  quickActionButton: {

    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 10,
    marginHorizontal: 5,
    elevation: 2,
    borderWidth:1,
    borderColor:'#4C8EF7',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  quickActionText: {
    color: '#4C8EF7',
    fontSize: 14,
    fontWeight: '600',
  },
  radioButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 5,
  },
  radioButton: {
    flex: 1,
    marginHorizontal: 5,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#4C8EF7',
    backgroundColor: 'transparent',
  },
  radioButtonSelected: {
    backgroundColor: '#4C8EF7',
    borderColor: '#4C8EF7',
  },
  radioButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonText: {
    color: '#4C8EF7',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  radioButtonTextSelected: {
    color: '#fff',
  },
  botTextContainer: {
    flexDirection: 'column',
    width: '100%',
    overflow: 'visible',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  userTextContainer: {
    flexDirection: 'column',
    width: '100%',
    overflow: 'visible',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  textLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 2,
  },
  mathContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 6,
    marginVertical: 2,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
    minHeight: 30,
    justifyContent: 'flex-start',
  },
  mathText: {
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: 14,
    color: '#333333', // Default color that will be overridden with inline style
    letterSpacing: 1,
    flexShrink: 1,
    marginBottom: -5,
  },
  headingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
    width:'80%',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  
  },
  headingPointer: {
    fontWeight: 'bold',
    fontSize: 18,
    marginRight: 8,
    color: '#2274F0', // Changed to the requested color
  },
  headingText: {
    fontWeight: 'bold',
    fontSize: 18,
    color: '#1976D2',
    flex: 1,
  },
  subheadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width:'80%',
    marginVertical: 6, // Added margin for better spacing
  },
  subheadingPointer: {
    fontWeight: 'bold',
    fontSize: 12,
    marginRight: 8,
    color: '#2274F0', // Changed to the requested color
  },
  subheadingText: {
    fontWeight: 'bold',
    fontSize: 12,
    color: '#2196F3',
    flex: 1,
  },
  linkText: {
    color: '#007bff',
    textDecorationLine: 'underline',
    fontWeight: '500',
  },
  linkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  linkIcon: {
    marginRight: 5,
  },
  inlineMathContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 4,
    padding: 2,
    marginHorizontal: 2,
    marginVertical: -2,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  formulaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingVertical: 4,
  },
  fractionContainer: {
    alignItems: 'center',
    marginHorizontal: 4,
    minWidth: 30,
    paddingHorizontal: 2,
  },
  fractionLine: {
    height: 2,
    backgroundColor: '#1B5E20',
    width: '80%',
    marginVertical: 3,
  },
  numerator: {
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: 12,
    color: '#1B5E20',
    textAlign: 'center',
    paddingBottom: 2,
  },
  denominator: {
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: 12,
    color: '#1B5E20',
    textAlign: 'center',
    paddingTop: 2,
  },
  sqrtContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sqrtSymbol: {
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: 16,
    color: '#1B5E20',
    marginRight: 2,
  },
  sqrtOverline: {
    position: 'relative',
    paddingTop: 4,
  },
  sqrtBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#1B5E20',
  },
  complexMathContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 1,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignSelf: 'flex-start',
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
    minHeight: 40,
    justifyContent: 'center',
  },
  complexMathText: {
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: 16,
    color: '#1B5E20',
    letterSpacing: 1,
    lineHeight: 26,
    flexShrink: 1,
  },
  chineseMathHeading: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 8,
    marginTop: 12,
    backgroundColor: '#E3F2FD',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBDEFB',
  },
  chineseMathSubheading: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2196F3',
    marginBottom: 6,
    marginTop: 8,
    paddingLeft: 12,
    backgroundColor: '#F5F5F5',
    padding: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  chineseMathText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    marginBottom: 6,
  },
  chatImage: {
    width: 200,
    height: 200,
    borderRadius: 10,
    marginVertical: 5,
    backgroundColor: '#e1e1e1', // Light grey background as placeholder
    maxWidth: '100%',
    resizeMode: 'contain',
  },
  fullScreenImageContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  fullScreenImageWrapper: {
    width: '90%',
    height: '80%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
    borderRadius: 5,
  },
  closeFullScreenButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  messageActionButtons: {
    flexDirection: 'row',
    marginTop: 2,
    padding: 2,
  },
  botMessageActions: {
    alignSelf: 'flex-start',
    marginLeft: 15,
  },
  userMessageActions: {
    alignSelf: 'flex-end',
    marginRight: 15,
  },
  actionButton: {
    padding: 5,
    marginHorizontal: 3,
  },
  messageWrapperOuter: {
    maxWidth: '85%',
    marginVertical: 4,
    width: 'auto',
  },
  botMessageWrapper: {
    alignSelf: 'stretch',
    width: '100%',
    maxWidth: '100%',
  },
  userMessageWrapper: {
    alignSelf: 'flex-end',
    maxWidth: '90%',
    marginBottom: 4,
  },
  tableContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    marginVertical: 10,
    overflow: 'hidden',
    width: '100%',
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    maxWidth: '100%',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    minHeight: 44,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    minHeight: 40,
  },
  tableEvenRow: {
    backgroundColor: '#FFFFFF',
  },
  tableOddRow: {
    backgroundColor: '#F9F9F9',
  },
  tableHeaderCell: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
    minHeight: 44,
  },
  tableCell: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
    minHeight: 40,
  },
  tableFirstColumn: {
    borderLeftWidth: 0,
  },
  tableLastColumn: {
    borderRightWidth: 0,
  },
  tableHeaderText: {
    fontWeight: 'bold',
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#333333',
    textAlign: 'center',
    flexWrap: 'wrap',
  },
  tableCellText: {
    fontSize: 13,
    fontFamily: 'monospace',
    color: '#333333',
    textAlign: 'center',
    flexWrap: 'wrap',
  },
  regularTableWrapper: {
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ccc',
    minWidth: '100%',
  },
  scheduleTableWrapper: {
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ddd',
    minWidth: '100%',
  },
  scheduleTableRow: {
    backgroundColor: '#F5F5F5',
  },
  scheduleTableHeaderCell: {
    backgroundColor: '#f1f2f6',
    padding: 12,
  },
  scheduleTableHeaderText: {
    fontWeight: 'bold',
    fontSize: 15,
    fontFamily: 'monospace',
    color: '#333',
    textAlign: 'center',
  },
  scheduleTableCell: {
    padding: 12,
    borderRightWidth: 1,
    borderRightColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scheduleTableCellText: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#333',
    textAlign: 'center',
  },
  dayRow: {
    backgroundColor: '#f0f0f0',
  },
  dayText: {
    fontWeight: 'bold',
    fontStyle: 'italic',
    color: '#333',
  },
  messageTextContainer: {
    width: '100%',
  },
  ordered_list: {
    marginLeft: 10,
  },
  ordered_list_item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  list_item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  ordered_list_icon: {
    marginRight: 5,
    fontWeight: 'bold',
    color: '#333333',
  },
  list_item_number: {
    marginRight: 5,
    fontWeight: 'bold',
    fontSize: 16,
    color: '#333333',
    width: 20,
    textAlign: 'right',
    marginTop: 2,
    lineHeight: 20,
  },
  list_item_content: {
    flex: 1,
    fontSize: 16,
    color: '#333333',
  },
  list_item_bullet: {
    marginRight: 5,
    fontSize: 16,
    color: '#333333',
    marginTop: 0,
    lineHeight: 16,
    marginBottom: 0,
    paddingTop: 1,
  },
  chineseHeadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
    width: '80%',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBDEFB',
  },
  chineseHeadingText: {
    fontWeight: 'bold',
    fontSize: 18,
    color: '#1976D2', // Default color that will be overridden with inline style
    marginRight: 8,
  },
  chineseSubheadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '80%',
  },
  chineseSubheadingPointer: {
    fontSize: 16,
    marginRight: 8,
    color: '#007bff',  // Changed from #2196F3 to #007bff
  },
  chineseSubheadingText: {
    fontWeight: 'bold',
    fontSize: 12,
    color: '#2196F3', // Default color that will be overridden with inline style
    flex: 1,
  },
  displayMathContainer: {

  },
  scheduleTableContainer: {
    borderWidth: 2,
    borderColor: '#4C8EF7',
    borderStyle: 'dashed',
  },
  scheduleTableHeaderRow: {
    backgroundColor: '#E3F2FD',
  },
  dayCellStyle: {
    backgroundColor: '#fff',
  },
  tableLastRow: {
    borderBottomWidth: 0,
  },
  // MathView styles
  mathView: {
    fontSize: 16,
    lineHeight: 22,
    maxWidth: '100%',
  },
  mathContainer: {
    marginVertical: 8,
    padding: 10,
    backgroundColor: 'rgba(240, 240, 240, 0.3)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  inlineMathContainer: {
    marginHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    maxWidth: '90%',
    overflow: 'hidden',
  },
  // New improved math container styles
  blockMathContainer: {
    width: '100%',
    padding: 12,
    marginVertical: 10,
    backgroundColor: 'rgba(240, 240, 240, 0.3)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  inlineMathWrapper: {
    marginHorizontal: 4,
    marginVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(240, 240, 240, 0.1)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },

  dayRow: {
    backgroundColor: '#f0f0f0',
  },
  dayText: {
    fontWeight: 'bold',
    fontStyle: 'italic',
    color: '#333',
  },
  scrollToBottomButton: {
    position: 'absolute',
    right: 15,
    bottom: 160, // Moved higher from 140 to 160
    backgroundColor: '#4C8EF7',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    zIndex: 999,
  },
  scrollToBottomIcon: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyStateButton: {
    backgroundColor: '#4C8EF7',
    padding: 10,
    borderRadius: 5,
  },
  emptyStateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  messagesContainer: {
    paddingVertical: 10,
    flexGrow: 1,
    paddingBottom: 15, // Minimal padding to keep messages from touching the input
  },
  messagesList: {
    flex: 1,
  },
  generateButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginBottom: 10,
  },

  NewChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 5,
    backgroundColor: '#4C8EF7', 
    borderRadius: 20,
    justifyContent: 'center',
    // Add a slight shadow so it stands out against messages
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
  },
  NewChatText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  inputContainer: {
    width: '100%',
    backgroundColor: 'transparent',
  },
  botHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  
  },
  botHeaderLogo: {
    width: 30,
    height: 30,
  
  },
  botHeaderText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#555',
  },
  botHeaderLogoContainer: {
    width: 35,
    height: 35,
    marginRight: 5,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 19,
    borderRadius: 30,
    backgroundColor: '#4C8EF7',
  },
  scrollToBottomButtonAdjusted: {
    bottom: 190, // Adjust position when additional buttons are shown
  },
  sendButtonDisabled: {
    backgroundColor: '#4C8EF7',
    borderRadius: 20,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullScreenImageError: {
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 10,
  },
  fullScreenErrorText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
  imageLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  imageLoadingText: {
    color: '#fff',
    marginTop: 10,
    fontWeight: 'bold',
  },
  messageTextSection: {
    marginTop: 10,
    paddingHorizontal: 5,
  },
  messageText: {
    marginTop: 8,
  },
  fullScreenImageWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  captionText: {
    marginTop: 8,
   
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderLeftWidth: 2,
    borderLeftColor: '#4C8EF7',
  },
  fullScreenBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  // Add new styles for coin display
  coinIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginRight: 10,
    marginTop: 2,
    backgroundColor: 'rgba(0,0,0,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  coinIcon: {
    width: 14,
    height: 14,
    marginRight: 4,
  },
  coinText: {
    fontSize: 12,
    color: '#FF6B6B',
    fontWeight: '500',
  },
  
  // Send button container and coin label styles
  sendButtonContainer: {
    position: 'relative',
    alignItems: 'center',
  },
  sendButtonCoinLabel: {
    position: 'absolute',
    top: -8,
    right: -8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fff',
  },
  sendButtonCoinIcon: {
    width: 10,
    height: 10,
    marginRight: 2,
  },
  sendButtonCoinText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalCoinImage: {
    width: 60,
    height: 60,
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  modalMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#E0E0E0',
  },
  rechargeButton: {
    backgroundColor: '#007BFF',
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: '500',
  },
  rechargeButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
  loadingOlderContainer: {
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  loadingOlderText: {
    marginLeft: 10,
    color: '#666',
    fontSize: 14,
  },

  floatingGenerateButton: {
    backgroundColor: '#4C8EF7',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
  },


});

export default BotScreen;