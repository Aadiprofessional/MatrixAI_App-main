import React, { useEffect, useState, useRef, useCallback } from 'react';
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
import { MathJaxSvg } from 'react-native-mathjax-html-to-svg';
import LinearGradient from 'react-native-linear-gradient';
import axios from 'axios';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import DocumentPicker from 'react-native-document-picker';
import { PDFDocument } from 'react-native-pdf-lib';
import RNFS from 'react-native-fs';
import { Buffer } from 'buffer';
import { supabase } from '../supabaseClient';
import Toast from 'react-native-toast-message';
import { useTheme } from '../context/ThemeContext';
import LeftNavbarBot from '../components/LeftNavbarBot';
import Clipboard from '@react-native-clipboard/clipboard';
import Markdown from 'react-native-markdown-display';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCoinsSubscription } from '../hooks/useCoinsSubscription';
import { useAuthUser } from '../hooks/useAuthUser';
import ImageResizer from '@bam.tech/react-native-image-resizer';
import MathView from 'react-native-math-view';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DASHSCOPE_API_KEY } from '@env';
import paymentService from '../services/paymentService';

// Function to decode base64 to ArrayBuffer
const decode = (base64) => {
  const bytes = Buffer.from(base64, 'base64');
  return bytes;
};

// Add this near the top of the BotScreen component
const persistEvent = (event) => {
  if (event && typeof event.persist === 'function') {
    event.persist();
  }
  return event;
};

  const BotScreen = ({ navigation, route }) => {
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();
  // Default fallback values for route params
  const { chatName, chatDescription, chatImage, chatid = Date.now().toString() } = route?.params || {};
  
  // Use ref to track if we've already processed the initial chatid
  const initialChatIdProcessed = useRef(false);
  
  console.log('BotScreen initialized with chatid:', chatid);
  
  const flatListRef = React.useRef(null);
  const [chats, setChats] = useState([]);
  const [currentChatId, setCurrentChatId] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const currentChat = chats.find(chat => chat.id === currentChatId) || { messages: [] };
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
  
  // Add states for coins management
  const { data: sessionData } = supabase.auth.getSession();
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

  // Add keyboard state tracking
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [isSendDisabled, setIsSendDisabled] = useState(false); // New state to track send button disabled state
  const swipeableRefs = useRef({});
  const lastScrolledMessageId = useRef(null);
  
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
  
  // Track keyboard visibility
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
      // Cleanup timeout ref to prevent memory leaks
      if (sendTimeoutRef.current) {
        clearTimeout(sendTimeoutRef.current);
      }
    };
  }, [messages.length]);

  // Set initial chat ID from route params if available - prevent infinite updates
  useEffect(() => {
    if (!initialChatIdProcessed.current && chatid && chatid !== 'undefined' && chatid !== 'null') {
      console.log('Setting initial chatid from route params:', chatid);
      setCurrentChatId(chatid);
      initialChatIdProcessed.current = true;
    }
  }, [chatid]);
  
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
  }, [keyboardVisible]);

  const onDeleteChat = async (chatId) => {
    try {
      // Ensure chatId is a string and store it locally to avoid synthetic event issues
      const chatToDelete = String(chatId);
      
      // Remove chat from local state
      setChats(prevChats => prevChats.filter(chat => chat.id !== chatToDelete));
      
      // If the deleted chat is the current chat, select another chat or start a new one
      if (chatToDelete === currentChatId) {
        const remainingChats = chats.filter(chat => chat.id !== chatToDelete);
        if (remainingChats.length > 0) {
          // Select the first available chat and keep the sidebar open
          selectChat(remainingChats[0].id, false);
        } else {
          // If no chats remain, start a new one
          const newChatId = Date.now().toString();
          startNewChat(newChatId);
        }
      }
      
      // Delete chat from Supabase
      const { error: deleteError } = await supabase
        .from('user_chats')
        .delete()
        .eq('chat_id', chatToDelete);
      
      if (deleteError) {
        console.error('Error deleting chat from Supabase:', deleteError);
        // Continue with local deletion even if server deletion fails
      } else {
        console.log('Chat deleted from Supabase');
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
      Alert.alert('Error', 'Failed to delete chat');
    }
  };

const renderTextWithMath = (text, textStyle) => {
  if (!text) return null;
  
  // Split text by both LaTeX expressions and custom math tags
  const parts = text.split(/(\\\([^\)]*\\\)|\\\[[^\]]*\\\]|<math>[\s\S]*?<\/math>|<math3>[\s\S]*?<\/math3>)/);
  
  return (
    <Text style={textStyle}>
      {parts.map((part, index) => {
        // Check if this part is a LaTeX expression
        if (part.match(/^\\\([^\)]*\\\)$/)) {
          // Inline math expression
          const mathContent = part.slice(2, -2); // Remove \( and \)
          return (
            <MathView
              key={index}
              math={mathContent}
              style={{
                fontSize: textStyle?.fontSize || 16,
                color: '#007AFF',
                marginVertical: 0,
                marginTop: 10,
                marginBottom: 0,
                paddingVertical: 0,
                lineHeight: textStyle?.fontSize || 16,
              }}
            />
          );
        } else if (part.match(/^\\\[[^\]]*\\\]$/)) {
          // Block math expression
          const mathContent = part.slice(2, -2); // Remove \[ and \]
          return (
            <View key={index} style={styles.mathContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <MathView
                  math={mathContent}
                  style={{
                    fontSize: 18,
                    color: '#007AFF',
                    marginVertical: 8,
                    textAlign: 'center',
                    maxWidth: 350,
                  }}
                />
              </ScrollView>
            </View>
          );
        } else if (part.match(/^<math>[\s\S]*?<\/math>$/)) {
          // Custom inline math tag
          const mathContent = part.slice(6, -7); // Remove <math> and </math>
          return (
            <MathView
              key={index}
              math={mathContent}
              style={{
                fontSize: textStyle?.fontSize || 16,
                color: '#007AFF',
                marginVertical: 0,
                marginTop: 0,
                marginBottom: 0,
                paddingVertical: 0,
                lineHeight: textStyle?.fontSize || 16,
              }}
            />
          );
        } else if (part.match(/^<math3>[\s\S]*?<\/math3>$/)) {
          // Custom display math tag
          const mathContent = part.slice(7, -8); // Remove <math3> and </math3>
          return (
            <View key={index} style={styles.mathContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <MathView
                  math={mathContent}
                  style={{
                    fontSize: 18,
                    color: '#007AFF',
                    textAlign: 'center',
                    maxWidth: 350,
                  }}
                />
              </ScrollView>
            </View>
          );
        } else {
          // Regular text
          return part;
        }
      })}
    </Text>
  );
};
  // Helper function to check if text contains math expressions


  const sendMessageToAI = async (message, imageUrl = null, onChunk = null) => {
    return new Promise((resolve, reject) => {
      try {
        // Prepare API messages array with system message
        const apiMessages = [ 
          { 
            role: "system", 
            content: [ 
              { 
                type: "text", 
                text: "You are an AI tutor assistant helping students with their homework and studies. Provide helpful, educational responses with clear explanations and examples that students can easily understand. Use proper markdown formatting for better readability. IMPORTANT: When including mathematical expressions, please wrap inline math with <math>...</math> tags and display math (block equations) with <math3>...</math3> tags. For example: <math>x^2 + y^2 = z^2</math> for inline math, and <math3>\\int_0^1 x^2 dx = \\frac{1}{3}</math3> for display math. This helps with proper mathematical rendering." 
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
            
            // If request is complete
            if (xhr.readyState === 4) {
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
          reject(new Error('Failed to get response from AI. Please try again.'));
        };

        xhr.ontimeout = function() {
          console.error('💥 XMLHttpRequest timeout');
          reject(new Error('Request timed out. Please try again.'));
        };

        xhr.timeout = 60000; // 60 second timeout

        const requestBody = JSON.stringify({
          model: "qwen-vl-max",
          messages: apiMessages,
          stream: true
        });

        console.log('📊 Sending request to API...');
        xhr.send(requestBody);

      } catch (error) {
        console.error('💥 Error in sendMessageToAI:', error);
        reject(new Error('Failed to get response from AI. Please try again.'));
      }
    });
  };

  const fetchDeepSeekResponse = async (userMessage, retryCount = 0) => {
    try {
      // Check if user has enough coins (1 coin required for chat)
      if (coinCount < 1) {
        setRequiredCoins(1);
        setLowBalanceModalVisible(true);
        return;
      }
      
      setIsLoading(true);
      
      // Create a streaming bot message that will be updated in real-time
      const streamingMessageId = 'streaming-' + Date.now().toString();
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
          isStreaming: true
        }];
      });

      // Define chunk handler for real-time updates
      const handleChunk = (chunk) => {
        streamingContent += chunk;
        
        // Update the streaming message in real-time
        setMessages(prev => prev.map(msg => 
          msg.id === streamingMessageId 
            ? { ...msg, text: streamingContent }
            : msg
        ));
        
        // Removed auto-scroll during streaming to prevent unwanted scrolling
      };

      // Get streaming response
      const fullResponse = await sendMessageToAI(userMessage, null, handleChunk);
      
      // Finalize the streaming message
      setMessages(prev => prev.map(msg => 
        msg.id === streamingMessageId 
          ? { ...msg, text: fullResponse, isStreaming: false, coinsDeducted: 1 }
          : msg
      ));
      
      // Store the coins deducted for UI display
      setLastCoinsDeducted(1);
      
      // Save the chat history for the bot response
      await saveChatHistory(fullResponse, 'bot', 1);
      
      // Removed auto-scroll after bot response to prevent unwanted scrolling
      
    } catch (error) {
      console.error('Error fetching streaming response:', error);
      
      // If we need to handle network errors, we can retry
      if (retryCount < 1 && (error.message.includes('timeout') || error.message.includes('network'))) {
        console.log('Retrying due to possible network error...');
        return fetchDeepSeekResponse(userMessage, retryCount + 1);
      }
      
      // Remove the loading indicator and add an error message
      setMessages(prev => {
        // Filter out any loading or streaming messages
        const messagesWithoutLoading = prev.filter(msg => !msg.isLoading && !msg.isStreaming);
        // Add the error message
        return [...messagesWithoutLoading, {
          id: Date.now().toString(),
          text: 'Sorry, I encountered an error. Could you try again?',
          sender: 'bot'
        }];
      });
      
      // Save the error message
      await saveChatHistory('Sorry, I encountered an error. Could you try again?', 'bot');
      
      // Removed auto-scroll after error to prevent unwanted scrolling
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    // Enhanced protection against double-sends
    if ((inputText.trim() || selectedImage) && !isSendDisabled && !isLoading && !isApiLoading) {
      // Check coin requirements before processing
      const requiredCoins = selectedImage ? 2 : 1;
      
      if (coinCount < requiredCoins) {
        Alert.alert(
          'Insufficient Coins',
          `You need ${requiredCoins} coin${requiredCoins > 1 ? 's' : ''} to ${selectedImage ? 'send an image' : 'send a message'}. Please purchase more coins to continue.`,
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
        try {
          const transactionName = selectedImage ? 'Image Message' : 'Text Message';
          await paymentService.subtractCoins(uid, requiredCoins, transactionName);
          // Note: coinCount will be automatically updated by useCoinsSubscription hook
        } catch (error) {
          console.error('Error deducting coins:', error);
          Alert.alert(
            'Payment Error',
            'Failed to process payment. Please try again.',
            [{ text: 'OK' }]
          );
          setIsSendDisabled(false);
          return;
        }
        // Get current user session first to ensure we have authentication
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id || 'anonymous';
        
        setIsTyping(true);
        
        // Dismiss keyboard after sending message
        Keyboard.dismiss();
        
        // If there's no current chat ID, create a new chat
        if (!currentChatId) {
          const newChatId = Date.now().toString();
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
            
            // Upload image to Supabase storage
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('user-uploads')
              .upload(filePath, decode(fileContent), {
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
            
            // Add user message to state with image property and text if provided
            const newMessage = {
              id: Date.now().toString(),
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

            // Save user's message to chat history
            await saveChatHistory(JSON.stringify({
              type: 'image_message',
              image: imageUrl,
              text: captionText
            }), 'user');

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
            const handleChunk = (chunk) => {
              streamingContent += chunk;
              
              // Update the streaming message in real-time
              setMessages(prev => prev.map(msg => 
                msg.id === streamingMessageId 
                  ? { ...msg, text: streamingContent }
                  : msg
              ));
              
              // Removed auto-scroll during streaming to prevent unwanted scrolling
            };

            // Get streaming response with image
            const fullResponse = await sendMessageToAI(question, imageUrl, handleChunk);
            
            // Finalize the streaming message
            setMessages(prev => prev.map(msg => 
              msg.id === streamingMessageId 
                ? { ...msg, text: fullResponse, isStreaming: false, coinsDeducted: 1 }
                : msg
            ));
            
            // Save the bot response to chat history
            await saveChatHistory(fullResponse, 'bot', 1);

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
            
            // Save the error message to chat history
            await saveChatHistory('Sorry, I had trouble processing that image. Could you try a different image?', 'bot');
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
        } else {
          // Regular text message handling
          try {
            setIsLoading(true);
            
            // Create message object with timestamp
            const newMessage = {
              id: Date.now().toString(),
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

            // Save the user's message to Supabase
            await saveChatHistory(inputText, 'user');
            
            // Process the message with an AI service
            await fetchDeepSeekResponse(inputText);
            
            // Removed auto-scroll after response to prevent unwanted scrolling
          } catch (error) {
            console.error('Error in message handling:', error);
            
            // Don't use Alert to avoid disrupting the UX
            setMessages((prev) => [
              ...prev,
              { id: Date.now().toString(), text: 'Sorry, I encountered an error processing your message. Could you try again?', sender: 'bot' },
            ]);
            
            // Save the error message to chat history
            await saveChatHistory('Sorry, I encountered an error processing your message. Could you try again?', 'bot');
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

  const saveChatHistory = async (messageText, sender, coinsDeducted = 0) => {
    try {
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        console.error('No authenticated user found');
        return;
      }
      
      const userId = session.user.id;
      
      // Make sure we have a valid chat id
      if (!currentChatId) {
        console.log('No current chat ID, creating a new chat');
        const newChatId = Date.now().toString();
        setCurrentChatId(newChatId);
        
        // Create a new empty chat first
        const timestamp = new Date().toISOString();
        const newChat = {
          chat_id: newChatId,
          user_id: userId,
          name: 'New Chat',
          description: messageText.substring(0, 30) + (messageText.length > 30 ? '...' : ''),
          role: currentRole || '',
          role_description: '',
          messages: [],
          created_at: timestamp,
          updated_at: timestamp
        };
        
        // Insert the chat before adding the message
        const { error: insertError } = await supabase
          .from('user_chats')
          .insert(newChat);
        
        if (insertError) {
          console.error('Error creating new chat:', insertError);
          return;
        }
        
        // Update local state
        setChats(prevChats => [
          {
            id: newChatId,
            name: 'New Chat',
            description: messageText.substring(0, 30) + (messageText.length > 30 ? '...' : ''),
            role: currentRole || '',
            roleDescription: '',
            messages: [],
          },
          ...prevChats
        ]);
      }
      
      // Now we proceed with adding the message, using the currentChatId which is now guaranteed to exist
      const chatIdToUse = currentChatId;
      
      // Check if chat exists in the database
      const { data: existingChat, error: chatError } = await supabase
        .from('user_chats')
        .select('*')
        .eq('chat_id', chatIdToUse)
        .single();
      
      if (chatError && chatError.code !== 'PGRST116') { // PGRST116 is "not found" error
        console.error('Error checking chat existence:', chatError);
        return;
      }
      
      const timestamp = new Date().toISOString();
      let newMessage;
      let description = '';
      
      // Check if this is a combined image and text message (in JSON format)
      let parsedMessage = null;
      if (typeof messageText === 'string' && messageText.startsWith('{') && messageText.includes('type')) {
        try {
          parsedMessage = JSON.parse(messageText);
        } catch (e) {
          console.log('Not a valid JSON message:', e);
        }
      }
      
      // Check if the message is an image URL from Supabase Storage
      const isImageUrl = typeof messageText === 'string' && 
                        (messageText.includes('supabase.co/storage/v1/') || 
                         messageText.includes('user-uploads'));
      
      if (parsedMessage && parsedMessage.type === 'image_message') {
        // For combined image and text messages
        newMessage = {
          id: Date.now().toString(),
          image: parsedMessage.image,
          text: parsedMessage.text || '',
          sender: sender,
          timestamp: timestamp
        };
        description = parsedMessage.text ? parsedMessage.text.substring(0, 30) + (parsedMessage.text.length > 30 ? '...' : '') : 'Image';
        console.log('Saving image with caption in chat history');
      } else if (isImageUrl && sender === 'user') {
        // For legacy image-only messages
        newMessage = {
          id: Date.now().toString(),
          image: messageText,
          text: '',
          sender: sender,
          timestamp: timestamp
        };
        description = 'Image';
        console.log('Saving image URL in chat history:', messageText);
      } else {
        // Regular text message
        newMessage = {
          id: Date.now().toString(),
          text: messageText,
          sender: sender,
          timestamp: timestamp
        };
        description = messageText.substring(0, 30) + (messageText.length > 30 ? '...' : '');
      }
      
      // Check if we need to update the chat name from 'New Chat' to 'MatrixAI Bot'
      let chatName = existingChat?.name || '';
      const shouldUpdateName = chatName === 'New Chat' && sender === 'user';
      if (shouldUpdateName) {
        chatName = 'MatrixAI Bot';
      }
      
      if (existingChat) {
        // Chat exists, update messages array
        // Limit the number of messages to prevent database size issues
        // Keep only the last 50 messages
        const updatedMessages = [...(existingChat.messages || []), newMessage].slice(-50);
        
        const { error: updateError } = await supabase
          .from('user_chats')
          .update({
            messages: updatedMessages,
            updated_at: timestamp,
            // Update name from 'New Chat' to 'MatrixAI Bot' if this is first user message
            name: shouldUpdateName ? chatName : existingChat.name,
            // Also update description to the latest message for preview
            description: description
          })
          .eq('chat_id', chatIdToUse);
        
        if (updateError) {
          console.error('Error updating chat:', updateError);
          
          // If error is related to size, try with fewer messages
          if (updateError.message && updateError.message.includes('size')) {
            console.log('Trying with fewer messages due to size constraint');
            
            // Try again with only 10 most recent messages
            const reducedMessages = [...(existingChat.messages || []), newMessage].slice(-10);
            
            const { error: retryError } = await supabase
              .from('user_chats')
              .update({
                messages: reducedMessages,
                updated_at: timestamp,
                name: shouldUpdateName ? chatName : existingChat.name,
                description: description
              })
              .eq('chat_id', chatIdToUse);
              
            if (retryError) {
              console.error('Error on retry with reduced messages:', retryError);
              return;
            }
          } else {
            return;
          }
        }
        
        console.log('Chat history updated in Supabase');
      } else {
        // This is just a fallback - we should never get here as we create the chat first if it doesn't exist
        console.log('Chat not found, creating a new one with the message');
        
        // Create new chat with only this message to ensure size limits
        const newChat = {
          chat_id: chatIdToUse,
          user_id: userId,
          name: 'MatrixAI Bot', // Always use 'MatrixAI Bot' for new chats with messages
          description: description,
          role: currentRole || '',
          role_description: '',
          messages: [newMessage],
          created_at: timestamp,
          updated_at: timestamp
        };
        
        const { error: insertError } = await supabase
          .from('user_chats')
          .insert(newChat);
        
        if (insertError) {
          console.error('Error creating new chat:', insertError);
          return;
        }
        
        console.log('New chat created in Supabase');
      }
    
      
      // Update the chat in the local state
      setChats(prevChats => prevChats.map(chat => 
        chat.id === chatIdToUse 
          ? { 
              ...chat, 
              messages: [...(chat.messages || []), newMessage],
              name: shouldUpdateName ? chatName : chat.name,
              description: description
            } 
          : chat
      ));
    } catch (error) {
      console.error('Error saving chat history:', error);
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
    // Invert the logic: messages are expanded by default, expandedMessages tracks collapsed ones
    const isCollapsed = expandedMessages[item.id];
    const shouldTruncate = item.text && item.text.length > 100;
    
    // Implement actual text truncation logic
    const displayText = shouldTruncate && isCollapsed 
      ? item.text.substring(0, 100) + '...' 
      : item.text;
  
    // Function to handle long press
    const handleLongPress = () => {
      Alert.alert(
        'Message Options',
        '',
        [
          {
            text: 'Copy Text',
            onPress: () => {
              Clipboard.setString(item.text);
              Alert.alert('Success', 'Text copied to clipboard');
            }
          },
          {
            text: 'Share',
            onPress: async () => {
              try {
                await Share.share({
                  message: item.text,
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
      if (item.text) {
        Clipboard.setString(item.text);
        Alert.alert(t('success'), t('textCopiedToClipboard'));
      }
    };

    // Handle share function
    const handleShareMessage = async () => {
      try {
        await Share.share({
          message: item.text || '',
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
                  
                  {item.image ? (
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
                  ) : (
                    <View style={isBot ? styles.botTextContainer : styles.userTextContainer}>
                      <Markdown 
                        style={{
                          body: {
                            color: isBot ? colors.botText : '#333333',
                            fontSize: 16,
                          },
                          heading1: {
                            color: isBot ? colors.primary : '#333333',
                            fontWeight: 'bold',
                            fontSize: 22,
                            marginTop: 12,
                            marginBottom: 6,
                            borderBottomWidth: 1,
                            borderBottomColor: colors.border,
                            paddingBottom: 6,
                          },
                          heading2: {
                            color: isBot ? colors.primary : '#333333',
                            fontWeight: 'bold',
                            fontSize: 18,
                            marginTop: 10,
                            marginBottom: 5,
                            paddingBottom: 4,
                          },
                          heading3: {
                            color: isBot ? colors.primary : '#333333',
                            fontWeight: 'bold',
                            fontSize: 16,
                            marginTop: 8,
                            marginBottom: 4,
                          },
                          paragraph: {
                            color: isBot ? colors.botText : '#333333',
                            fontSize: 16,
                            marginTop: 4,
                            marginBottom: 4,
                          },
                          list_item: {
                            color: isBot ? colors.botText : '#333333',
                            fontSize: 16,
                            marginTop: 4,
                          },
                          bullet_list: {
                            color: isBot ? colors.botText : '#333333',
                          },
                          ordered_list: {
                            marginLeft: 10,
                          },
                          ordered_list_item: {
                            flexDirection: 'row',
                            alignItems: 'flex-start',
                            marginBottom: 4,
                          },
                          ordered_list_icon: {
                            marginRight: 5,
                            fontWeight: 'bold',
                            color: colors.botText,
                          },
                          list_item_number: {
                            marginRight: 5,
                            fontWeight: 'bold',
                            fontSize: 16,
                            color: colors.botText,
                            width: 20,
                            textAlign: 'right',
                          },
                          list_item_content: {
                            flex: 1,
                            fontSize: 16,
                            color: colors.botText,
                          },
                          list_item_bullet: {
                            marginRight: 5,
                            fontSize: 16,
                            color: colors.botText,
                          },
                          blockquote: {
                            backgroundColor: 'rgba(128, 128, 128, 0.1)',
                            borderLeftWidth: 4,
                            borderLeftColor: colors.primary,
                            paddingLeft: 8,
                            paddingVertical: 4,
                            color: colors.botText,
                          },
                          code_block: {
                            backgroundColor: 'rgba(128, 128, 128, 0.1)',
                            padding: 8,
                            borderRadius: 4,
                            color: colors.botText,
                          },
                          code_inline: {
                            backgroundColor: 'rgba(128, 128, 128, 0.1)',
                            padding: 2,
                            borderRadius: 2,
                            color: colors.botText,
                          },
                          link: {
                            color: colors.primary,
                            textDecorationLine: 'underline',
                          },
                          table: {
                            borderWidth: 1,
                            borderColor: '#E0E0E0',
                            marginVertical: 10,
                          },
                          tr: {
                            borderBottomWidth: 1,
                            borderBottomColor: '#E0E0E0',
                            flexDirection: 'row',
                          },
                          th: {
                            padding: 8,
                            fontWeight: 'bold',
                            borderRightWidth: 1,
                            borderRightColor: '#E0E0E0',
                            backgroundColor: '#F5F5F5',
                            color: '#333333',
                          },
                          td: {
                            padding: 8,
                            borderRightWidth: 1,
                            borderRightColor: '#E0E0E0',
                            color: '#333333',
                          },
                          text: {
                            color: colors.botText,
                          }
                        }}
                        rules={{
                          list: (node, children, parent, styles) => {
                            if (node.ordered) {
                              return (
                                <View key={node.key} style={styles.ordered_list}>
                                  {children}
                                </View>
                              );
                            }
                            return (
                              <View key={node.key} style={styles.bullet_list}>
                                {children}
                              </View>
                            );
                          },
                          list_item: (node, children, parent, styles) => {
                            if (parent.ordered) {
                              return (
                                <View key={node.key} style={styles.ordered_list_item}>
                                  <Text style={[styles.list_item_number, {color: '#2274F0'}]}>{node.index + 1}.</Text>
                                  <View style={styles.list_item_content}>
                                    {children}
                                  </View>
                                </View>
                              );
                            }
                            return (
                              <View key={node.key} style={styles.list_item}>
                                <Text style={[styles.list_item_bullet, {color: '#2274F0'}]}>•</Text>
                                <View style={{ flex: 1 }}>
                                  {children}
                                </View>
                              </View>
                            );
                          },
                          text: (node, children, parent, styles) => {
  const textStyle = [styles.text, {color: isBot ? colors.botText : '#fff'}];
  return (
    <View key={node.key} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
      {renderTextWithMath(node.content, textStyle)}
    </View>
  );
}
                        }}
                      >
                        {displayText}
                      </Markdown>
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
              
              {/* Coin cost indicator for user messages - only show when coins were recently deducted */}
              {isUser && recentCoinDeductions.has(item.id) && (
                <View style={styles.coinIndicator}>
                  <Image 
                    source={require('../assets/coin.png')} 
                    style={styles.coinIcon} 
                  />
                  <Text style={styles.coinText}>-{item.image ? '2' : '1'}</Text>
                </View>
              )}
              
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
        // Get current user session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user?.id) {
          console.log('No authenticated user found, using local chat');
          
          // For anonymous users, create a local chat only if needed
          // Try to get the last used chat from AsyncStorage
          try {
            const lastChatData = await AsyncStorage.getItem('lastChat');
            
            if (lastChatData) {
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
            } else {
              // No previous chat found, create a new one
              const newChatId = Date.now().toString();
              const localChatObj = {
                id: newChatId,
                name: 'New Chat',
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
              name: 'New Chat',
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
        
        const userId = session.user.id;
        
        // Fetch all chats for the current user, ordered by most recent
        const { data: userChats, error: chatError } = await supabase
          .from('user_chats')
          .select('*')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false });
        
        if (chatError) {
          console.error('Error fetching user chats:', chatError);
          // Create a new chat as fallback
          const newChatId = Date.now().toString();
          startNewChat(newChatId);
          setDataLoaded(true);
          setIsChatsLoading(false);
          return;
        }
        
        // Process the chats to match the local state format and ensure messages is an array
        const processedChats = userChats.map(chat => {
          // Process messages for proper display
          const processedMessages = processMessages(chat.messages || []);
          
          return {
            id: chat.chat_id,
            name: chat.name || 'Chat',
            description: chat.description || '',
            role: chat.role || '',
            roleDescription: chat.role_description || '',
            messages: processedMessages,
          };
        });
        
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
          const newChatId = Date.now().toString();
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
        const newChatId = Date.now().toString();
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
        .channel('user_chats_changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'user_chats',
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
  }, [navigation, route]);

  // Modify the startNewChat to accept chatId parameter and ensure proper initialization
  const startNewChat = async (customChatId) => {
    try {
      // Validate and sanitize customChatId to prevent [object Object] issues
      let newChatId;
      
      if (customChatId) {
        // Detect if customChatId is an object (like a synthetic event) instead of a string/number 
        if (typeof customChatId === 'object') {
          console.warn('Received object instead of ID in startNewChat, generating new ID');
          newChatId = Date.now().toString();
        } else {
          newChatId = String(customChatId);
        }
      } else {
        newChatId = Date.now().toString();
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
        name: 'New Chat',
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
      if (!session?.user?.id) {
        console.log('No authenticated user, using local chat only');
        try {
          await AsyncStorage.setItem('lastChat', JSON.stringify(localChatObj));
        } catch (error) {
          console.error('Error saving chat to AsyncStorage:', error);
        }
        return;
      }
      
      const userId = session.user.id;
      
      // Check if the chat already exists in Supabase
      const { data: existingChat, error: checkError } = await supabase
        .from('user_chats')
        .select('*')
        .eq('chat_id', newChatId)
        .single();
      
      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking if chat exists:', checkError);
      }
      
      // If chat already exists, just use local updates
      if (existingChat) {
        console.log('Chat already exists in Supabase, using existing data');
        return;
      }
      
      // Create a new chat object for Supabase
      const newChat = {
        chat_id: newChatId,
        user_id: userId,
        name: 'New Chat',
        description: '',
        role: '',
        role_description: '',
        messages: [],
        created_at: timestamp,
        updated_at: timestamp
      };
      
      // Insert the new chat in Supabase
      const { error: insertError } = await supabase
        .from('user_chats')
        .insert(newChat);
      
      if (insertError) {
        // Handle duplicate key violation specifically
        if (insertError.code === '23505') {
          console.log('Chat with this ID already exists in database, using local state only');
          // No need to show an error to the user, just continue with local state
          return;
        }
        console.error('Error creating new chat in Supabase:', insertError);
        // Continue using local state, already set up above
      } else {
        console.log('New chat created in Supabase');
      }
    } catch (error) {
      console.error('Error during new chat creation:', error);
      // Local state has already been updated, so no need to update again
    }
  };

  const handleAttach = () => {
    setShowAdditionalButtons(prev => !prev); // Toggle additional buttons visibility
    // Change the icon from plus to cross
  };

  const handleCamera = (navigation) => {
    navigation.navigate('CameraScreen');
  };

  const handleDocumentSelection = async () => {
    try {
      // Hide additional buttons after selection
      setShowAdditionalButtons(false);
      
      // Pick a document (PDF, DOC, DOCX)
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.pdf, DocumentPicker.types.doc, DocumentPicker.types.docx],
        copyTo: 'cachesDirectory', // Copy file to app's cache directory for reliable access
      });
      
      // Show loading indicator
      setIsLoading(true);
      
      // Get the selected file
      const selectedFile = result[0];
      const { uri, type, name, fileCopyUri } = selectedFile;
      
      console.log('Selected document URI:', uri);
      console.log('Selected document type:', type);
      console.log('Selected document name:', name);
      console.log('File copy URI (if available):', fileCopyUri);
      
      // Use fileCopyUri if available (from copyTo option), otherwise fall back to uri
      let processableUri = fileCopyUri || uri;
      
      // For iOS, we need to handle file:// URLs properly
      if (Platform.OS === 'ios' && processableUri.startsWith('file://')) {
        // On iOS, we need to decode the URI to handle special characters in filenames
        processableUri = decodeURIComponent(processableUri);
        console.log('Decoded URI for iOS:', processableUri);
      }
      
      // Check if it's a PDF file
      if (type === 'application/pdf') {
        await processPdfDocument(processableUri, name);
      } else {
        // For DOC/DOCX files, alert the user to convert to PDF first
        Alert.alert(
          'Document Format',
          'DOC/DOCX files need to be converted to PDF first. Please convert and try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      if (DocumentPicker.isCancel(error)) {
        // User cancelled the picker
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
      
      // Save the chat history
      await saveChatHistory(`Document: ${fileName}`, 'user');
      
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
      
      // Find the chat in local state
      const selectedChat = chats.find(chat => chat.id === chatId);
      
      if (selectedChat) {
        // Set the role if the chat has one
        if (selectedChat.role) {
          setCurrentRole(selectedChat.role);
        } else {
          setCurrentRole('');
        }
        
        // Process and load messages from the selected chat
        if (selectedChat.messages && selectedChat.messages.length > 0) {
          // Make sure processMessages function exists before calling it
          if (typeof processMessages === 'function') {
            // Ensure messages are properly processed for display
            const processedMessages = processMessages(selectedChat.messages);
            setMessages(processedMessages);
            
            // Update the chat in state with processed messages
            setChats(prevChats => prevChats.map(chat => 
              chat.id === chatId 
                ? { ...chat, messages: processedMessages }
                : chat
            ));
          } else {
            // If processMessages function doesn't exist, just use the messages as is
            console.warn('processMessages function not found, using raw messages');
            setMessages(selectedChat.messages);
          }
        } else {
          setMessages([]);
        }
        
        console.log('Chat selected successfully:', {
          chatId,
          role: selectedChat.role,
          messageCount: selectedChat.messages?.length || 0
        });
      } else {
        console.log('Chat not found in local state, clearing messages');
        setMessages([]);
        setCurrentRole('');
      }
      
      // Only scroll to bottom on initial chat load, not when switching between chats
      if (!dataLoaded) {
        setTimeout(() => {
          if (flatListRef.current) {
            flatListRef.current.scrollToEnd({ animated: false });
          }
        }, 100);
      }
      
    } catch (error) {
      console.error('Error selecting chat:', error);
    }
  };

  const handleImageSelection = async (source = 'gallery') => {
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
        const { uri, type, fileName } = response.assets[0];
        
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
        
        console.log('Selected image details:', {
          uri: uri,
          type: mimeType,
          fileName: fileName || `image_${Date.now()}.jpg`
        });
        
        // Set the selected image
        setSelectedImage(uri);
        setImageType(mimeType);
        setImageFileName(fileName || `image_${Date.now()}.jpg`);
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
            user_id: (await supabase.auth.getSession()).data.session.user.id,
            name: 'New Chat',
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
    const isNearBottom = offsetY >= contentSizeHeight - layoutHeight - 50;
    setShowScrollToBottom(!isNearBottom);
    
    // Reset user scrolling flag after a longer delay to prevent auto-scroll interference
    setTimeout(() => {
      if (Date.now() - lastScrollTime >= 2000) { // Increased from 1000ms to 2000ms
        setIsUserScrolling(false);
      }
    }, 2000);
  };
  
  // Add an effect to handle scrolling when messages change - only for new messages from user or bot
  useEffect(() => {
    if (messages.length > 0 && !isUserScrolling) {
      const lastMsg = messages[messages.length - 1];
      // Only auto-scroll for genuinely new messages (user messages or completed bot messages)
      if (lastMsg && lastMsg.id !== lastScrolledMessageId.current && 
          (lastMsg.sender === 'user' || (lastMsg.sender === 'bot' && !lastMsg.isStreaming))) {
        lastScrolledMessageId.current = lastMsg.id;
        setTimeout(() => {
          if (!isUserScrolling) {
            scrollToBottom();
          }
        }, 300); // Increased delay to give user more time
      }
    }
  }, [messages, isUserScrolling]);

  const navigateToSubscription = () => {
    setLowBalanceModalVisible(false);
    navigation.navigate('SubscriptionScreen');
  };
  
 

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
      
      {/* Back Button */}
      <TouchableOpacity 
        style={[styles.backButton , {zIndex: 1, marginLeft: isSidebarOpen ? 300 : 0 }]}
        onPress={() => {
          if (isSidebarOpen) {
            setIsSidebarOpen(false);
          } else {
            setIsSidebarOpen(true);
          }
        }}
      >
        {isSidebarOpen ? (
          <MaterialIcons name="arrow-back-ios" size={24} color="#000" style={styles.headerIcon2} />
        ) : (
          <MaterialIcons name="arrow-forward-ios" size={24} color="#000" style={styles.headerIcon} />
        )}
      </TouchableOpacity>
      
      {/* Header */}
      <View style={[styles.header, {backgroundColor: colors.background2 , borderColor: colors.border ,borderBottomWidth: 1}]}>
      <TouchableOpacity style={styles.backButton2} onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back-ios-new" size={24} color="white" />
                               </TouchableOpacity>
          <Image source={require('../assets/Avatar/Cat.png')} style={styles.botIcon} />
        <View style={styles.headerTextContainer}>
        
          <Text style={styles.botRole}>MatrixAI Bot</Text>
        
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
                keyExtractor={(item) => item.id}
                renderItem={renderMessage}
                contentContainerStyle={[
                  styles.messagesContainer,
                
                ]}
                style={styles.messagesList}
                onScroll={handleScroll}
                scrollEventThrottle={200}
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
                <Text style={[styles.placeholderText , {color: colors.text}]}>Hi, I'm MatrixAI Bot.</Text>
                <Text style={[styles.placeholderText2 , {color: colors.text}]}>How can I help you today?</Text>
                
                {/* New role selection UI */}
                <Text style={[styles.placeholderText3 , {color: colors.text}]}>You can ask me any question or you</Text>
                <Text style={[styles.placeholderText4 , {color: colors.text}]}>can select the below role:</Text>
                <View style={styles.roleButtonsContainer}>
                  <View style={styles.roleButtonRow}>
                    <TouchableOpacity 
                      style={styles.roleButton} 
                      onPress={() => handleRoleSelection('🩺 Doctor')}
                    >
                      <Text style={styles.roleButtonText}>🩺</Text>
                      <Text style={styles.roleButtonText}>Doctor</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.roleButton} 
                      onPress={() => handleRoleSelection('📚 Teacher')}
                    >
                      <Text style={styles.roleButtonText}>📚</Text>
                      <Text style={styles.roleButtonText}>Teacher</Text>
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.roleButtonRow}>
                    <TouchableOpacity 
                      style={styles.roleButton} 
                      onPress={() => handleRoleSelection('⚖️ Lawyer')}
                    >
                      <Text style={styles.roleButtonText}>⚖️</Text>
                      <Text style={styles.roleButtonText}>Lawyer</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.roleButton} 
                      onPress={() => handleRoleSelection('🌱 Psychologist')}
                    >
                      <Text style={styles.roleButtonText}>🌱</Text>
                      <Text style={styles.roleButtonText}>Psychologist</Text>
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.roleButtonRow}>
                    <TouchableOpacity 
                      style={styles.roleButton} 
                      onPress={() => handleRoleSelection('🔧 Engineer')}
                    >
                      <Text style={styles.roleButtonText}>🔧</Text>
                      <Text style={styles.roleButtonText}>Engineer</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.roleButton} 
                      onPress={() => handleRoleSelection('📐 Surveyor')}
                    >
                      <Text style={styles.roleButtonText}>📐</Text>
                      <Text style={styles.roleButtonText}>Surveyor</Text>
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.roleButtonRow}>
                    <TouchableOpacity 
                      style={styles.roleButton} 
                      onPress={() => handleRoleSelection('🏤 Architect')}
                    >
                      <Text style={styles.roleButtonText}>🏤</Text>
                      <Text style={styles.roleButtonText}>Architect</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.roleButton} 
                      onPress={() => handleRoleSelection('📈 Financial Advisor')}
                    >
                      <Text style={styles.roleButtonText}>📈</Text>
                      <Text style={styles.roleButtonText}>Financial Advisor</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          </Animatable.View>
        </View>

        {/* Input area with New Chat button above it */}
        <View style={styles.inputContainer}>
          {/* New Chat Button - Positioned just above the input with transparency */}
          <View style={styles.newChatButtonContainer} pointerEvents="box-none">
            <TouchableOpacity onPress={startNewChat} style={styles.NewChatButton}>
              <MaterialCommunityIcons name="chat-plus-outline" size={24} color="#fff" />
              <Text style={styles.NewChatText}>New Chat</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputContentContainer}>
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
                    placeholder={selectedImage ? "Add a caption..." : "Send a message..."}
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
                      <MaterialCommunityIcons name="plus" size={28} color="#4C8EF7" />
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
                    {(inputText.trim() || selectedImage) && (
                      <View style={styles.sendButtonCoinLabel}>
                        <Image 
                          source={require('../assets/coin.png')} 
                          style={styles.sendButtonCoinIcon} 
                        />
                        <Text style={styles.sendButtonCoinText}>-{selectedImage ? '2' : '1'}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </LinearGradient>
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
    padding: 10,
    backgroundColor: '#FFFFFF',
 
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
    padding: 12,
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
    maxWidth: '85%',
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
  botTextContainer: {
    flexDirection: 'column',
    flexShrink: 1,
    width: '100%',
    overflow: 'hidden',
  },
  userTextContainer: {
    flexDirection: 'column',
    flexShrink: 1,
    width: '100%',
    overflow: 'hidden',
  },
  textLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 2,
  },
  mathContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 8,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignSelf: 'flex-start',
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
    minHeight: 40,
    justifyContent: 'center',
  },
  mathText: {
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: 14,
    color: '#333333', // Default color that will be overridden with inline style
    letterSpacing: 1,
    flexShrink: 1,
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
    padding: 4,
    marginHorizontal: 2,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignSelf: 'flex-start',
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
    maxWidth: '85%',
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
    bottom: 100, // Adjust based on your input bar height
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
  newChatButtonContainer: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 5,
    top: -40, // Position above the input box
    backgroundColor: 'transparent',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'box-none', // This allows touches to pass through to components behind it
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


});

export default BotScreen;
