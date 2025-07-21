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
        // When keyboard shows, scroll to the bottom after a short delay
        if (messages.length > 0) {
          setTimeout(() => {
            if (flatListRef.current) {
              flatListRef.current.scrollToEnd({ animated: false });
            }
          }, 100);
        }
      }
    );
    
    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setIsKeyboardVisible(false);
        // When keyboard hides, scroll to adjust view
        if (messages.length > 0) {
          setTimeout(() => {
            if (flatListRef.current) {
              flatListRef.current.scrollToEnd({ animated: false });
            }
          }, 100);
        }
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

  // New streaming API function compatible with React Native
  const sendMessageToAI = async (message, imageUrl = null, onChunk = null) => {
    return new Promise((resolve, reject) => {
      try {
        // Check if user has enough coins (1 coin required for chat)
        if (coinCount < 1) {
          setRequiredCoins(1);
          setLowBalanceModalVisible(true);
          return;
        }

        // Get the current role context
        const currentChatObj = chats.find(chat => chat.id === currentChatId);
        let systemContent = 'You are an AI tutor assistant helping students with their homework and studies. Provide helpful, educational responses with clear explanations and examples that students can easily understand. Use proper markdown formatting for better readability.';
        
        if (currentRole) {
          if (currentChatObj && currentChatObj.roleDescription) {
            systemContent = `You are MatrixAI Bot, acting as a ${currentRole}. ${currentChatObj.roleDescription}`;
          } else {
            systemContent = `You are MatrixAI Bot, acting as a ${currentRole}. Please provide responses with the expertise and perspective of a ${currentRole} while being helpful and informative.`;
          }
        }

        // Prepare messages array
        const messages = [
          {
            role: "system",
            content: [
              {
                type: "text", 
                text: systemContent
              }
            ]
          },
          {
            role: "user",
            content: []
          }
        ];

        // Add text content
        messages[1].content.push({
          type: "text",
          text: `Please help me with this question or topic: ${message}`
        });

        // Add image if provided
        if (imageUrl) {
          messages[1].content.push({
            type: "image_url",
            image_url: {
              url: imageUrl
            }
          });
        }

        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', true);
        xhr.setRequestHeader('Authorization', 'Bearer sk-256fda005a1445628fe2ceafcda9e389');
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
          messages: messages,
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
        
        // Auto-scroll to bottom as content streams in
        setTimeout(() => {
          if (flatListRef.current) {
            flatListRef.current.scrollToEnd({ animated: true });
          }
        }, 50);
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
      
      // Ensure scroll to bottom after receiving bot response
      setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: true });
        }
      }, 100);
      
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
      
      // Ensure scroll to bottom even after error
      setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: true });
        }
      }, 100);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    // Enhanced protection against double-sends
    if ((inputText.trim() || selectedImage) && !isSendDisabled && !isLoading && !isApiLoading) {
      // Clear any existing timeout
      if (sendTimeoutRef.current) {
        clearTimeout(sendTimeoutRef.current);
      }
      
      // Disable the send button immediately to prevent double sends
      setIsSendDisabled(true);
      
      try {
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
            
            // Upload image to Supabase storage
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('user-uploads')
              .upload(filePath, decode(fileContent), {
                contentType: imageType || 'image/jpeg',
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
              
              // Auto-scroll to bottom as content streams in
              setTimeout(() => {
                if (flatListRef.current) {
                  flatListRef.current.scrollToEnd({ animated: true });
                }
              }, 50);
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
            
            // Ensure scroll to bottom after sending a message
            setTimeout(() => {
              if (flatListRef.current) {
                flatListRef.current.scrollToEnd({ animated: true });
              }
            }, 100);

            // Save the user's message to Supabase
            await saveChatHistory(inputText, 'user');
            
            // Process the message with an AI service
            await fetchDeepSeekResponse(inputText);
            
            // Scroll to bottom after getting the response
            setTimeout(() => {
              if (flatListRef.current) {
                flatListRef.current.scrollToEnd({ animated: true });
              }
            }, 200);
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

  const toggleMessageExpansion = (messageId) => {
    // Update expanded messages state
    setExpandedMessages(prev => ({
      ...prev,
      [messageId]: !prev[messageId]
    }));
  };
  const isMathExpression = (text) => {
    // Skip if text is too long (likely not a math expression)
    if (text.length > 200) return false;
    
    // Skip if it's just a simple number
    if (/^\d+$/.test(text)) return false;
    
    // Skip if it's a date
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(text) || /^\d{1,2}\-\d{1,2}\-\d{2,4}$/.test(text)) return false;
    
    // Skip if it's likely a list item with a number (e.g., "1. Item")
    if (/^\d+\.\s+.+/.test(text) && !text.includes('=') && !text.includes('+') && !text.includes('-')) return false;
    
    // Skip if it's likely a normal sentence with numbers
    if (text.split(' ').length > 10 && !/[\=\+\-\*\/\^\(\)]/.test(text)) return false;

    // Check for specific patterns like bullet points with derivatives (• The derivative of (g(x)) is (g'(x) = 2x + 3))
    if (/^[•\*-]\s*The derivative of\s*\([a-z]\(x\)\)\s*is\s*\([a-z]'\(x\)\s*=/.test(text)) {
      return true;
    }
    
    // Check for common derivative patterns like g'(x) = 2x + 3
    if (/[a-z]'\(x\)\s*=/.test(text)) {
      return true;
    }

    // Check for LaTeX delimiters - highest priority as these are explicit math
    if (text.includes('$$') || text.includes('\\[') || text.includes('\\(') || 
        text.match(/\$[^$]+\$/) || text.includes('\\begin{equation}')) {
      return true;
    }
    
    // Check for fraction patterns like "x^2 - 2x + 2 \over (x - 1)^2"
    if (text.includes('\\over') || text.includes('\\frac')) {
      return true;
    }
    
    // Check for Pythagorean theorem pattern (a^2 + b^2 = c^2 or 3^2 + 4^2 = c^2)
    if (/[a-z\d]\s*\^\s*\d+\s*[\+\-]\s*[a-z\d]\s*\^\s*\d+\s*=/.test(text)) {
      return true;
    }
    
    // Check for equation patterns with explicit notation (like Step 2: Find g'(x) and h'(x))
    if (/[a-zA-Z]'?\([a-zA-Z]\)/.test(text) && text.length < 100) {
      return true;
    }
    
    // Check for quotient rule formulas like f'(x) = \frac{...}{...}
    if (/f'\(x\)\s*=\s*\\frac/.test(text) || /\[f'\(x\)\s*=\s*\\frac/.test(text)) {
      return true;
    }
    
    // Check for Step notation with math content
    if (/Step\s+\d+:.*/.test(text) && (
        text.includes('Apply the Quotient Rule') ||
        text.includes('Simplify the Numerator') ||
        text.includes('g\'(x)') ||
        text.includes('h\'(x)') ||
        text.includes('f\'(x)')
    )) {
      return true;
    }

    // Check for equation patterns (must have equals sign)
    const hasEquation = /\=/.test(text);
    
    // Check for mathematical operators
    const hasOperators = /[\+\-\*\/\(\)\[\]\{\}\^×÷]/.test(text);
    
    // Check for number patterns with operators (this is the strongest indicator)
    const hasNumberWithOperator = /\d+\s*[\+\-\*\/\=]\s*\d+/.test(text);
    
    // Check for common math expressions at the start of the text
    const isCommonMathExpression = /^(solve|calculate|find|evaluate|simplify|compute)/.test(text.toLowerCase());
    
    // Check for fractions
    const hasFraction = /\d+\s*\/\s*\d+/.test(text) && !/https?:\/\//.test(text); // Exclude URLs
    
    // Check for square roots or exponents or other math functions
    const hasAdvancedMath = /sqrt|square root|\\sqrt|\^|x\^2|x\^3|sin\(|cos\(|tan\(|log\(|π|pi|\\sum|\\int|\\lim/.test(text.toLowerCase());
    
    // Check for multiple numbers and operators (likely a calculation)
    const hasMultipleOperations = /\d+\s*[\+\-\*\/]\s*\d+\s*[\+\-\*\/]\s*\d+/.test(text);
    
    // Check for specific equation patterns
    const isEquation = /^\s*\d+\s*[\+\-\*\/]\s*\d+\s*\=/.test(text) || // 2 + 2 =
                       /^\s*\d+\s*[\+\-\*\/\=]\s*\d+/.test(text) && text.length < 30;
    
    // Check for common school math formulas
    const hasCommonFormula = /(area|perimeter|volume|circumference|radius|diameter)\s*[\=:]/.test(text.toLowerCase()) ||
                             /(a\^2\s*\+\s*b\^2\s*=\s*c\^2)|(E\s*=\s*mc\^2)|(F\s*=\s*ma)/.test(text);
    
    // Check for equations with variables
    const hasVariables = /[a-zA-Z]\s*[\+\-\*\/\=]\s*\d+/.test(text.toLowerCase()) || 
                         /\d+\s*[\+\-\*\/\=]\s*[a-zA-Z]/.test(text.toLowerCase()) ||
                         /[a-zA-Z]\s*[\+\-\*\/\=]\s*[a-zA-Z]/.test(text.toLowerCase());
    
    // Check for subscript notation like a_n or a_{n}
    const hasSubscript = /[a-zA-Z]_[a-zA-Z0-9]/.test(text.toLowerCase()) ||
                         /[a-zA-Z]_\{[^}]+\}/.test(text.toLowerCase());
    
    // Check for square root symbols
    const hasSquareRoot = text.includes('√') || /\\sqrt/.test(text) || text.includes('\\sqrt{');
    
    // Check for derivative notation
    const hasDerivative = /f'|\s[a-z]'|\s[a-z]'\(x\)|\s[a-z]''\(x\)/.test(text);
    
    // Check for Step N: text followed by a mathematical function, often indicating math steps
    const isStepWithMath = /Step\s+\d+:.*([a-z]\(x\)|[a-z]'|\(x\^2|\\frac)/.test(text);
    
    // Return true if it looks like a math expression
    return (isEquation ||
            hasNumberWithOperator || 
            (hasEquation && hasOperators) || 
            (isCommonMathExpression && (hasOperators || hasEquation)) ||
            hasFraction || 
            hasAdvancedMath ||
            hasMultipleOperations ||
            hasCommonFormula ||
            hasVariables ||
            hasSubscript ||
            hasSquareRoot ||
            hasDerivative ||
            isStepWithMath);
  };

  // Check if text looks like it has a math expression with subscripts
  const hasMathSubscripts = (text) => {
    // Check for typical subscript patterns in mathematical notation
    return (
      /([a-zA-Z])_(\d)/.test(text) ||       // x_2
      /([a-zA-Z])_([a-zA-Z])/.test(text) || // x_n, a_i, etc.
      /([a-zA-Z])_\{([^}]+)\}/.test(text)   // x_{n+1}
    );
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
  const renderMessage = React.useCallback(({ item }) => {
    // Ensure messages is an array and data is loaded
    if (!dataLoaded || !Array.isArray(messages) || messages.length === 0) return null; 
  
    // Special case for loading animation - only show one loading indicator
    if (item.isLoading && item.sender === 'bot') {
      return (
        <View style={[styles.loadingContainer, { marginTop: -80 }]}>
          <LottieView
            source={require('../assets/dot.json')}
            autoPlay
            loop
            style={[styles.loadingAnimation, { marginBottom: 30 }]}
          />
        </View>
      );
    }
  
    // Enhanced logging for image debugging
    if (item.image) {
      console.log('Rendering message with image:', {
        id: item.id,
        imageUrl: item.image,
        imageType: typeof item.image,
        sender: item.sender
      });
    }
  
    const isBot = item.sender === 'bot';
    // Invert the logic: messages are expanded by default, expandedMessages tracks collapsed ones
    const isCollapsed = expandedMessages[item.id];
    const shouldTruncate = item.text && item.text.length > 100;
    const displayText = shouldTruncate && isCollapsed 
      ? `${item.text.substring(0, 100)}...`
      : item.text;

    // Handle copy text function
    const handleCopyText = () => {
      if (item.text) {
        Clipboard.setString(item.text);
        Toast.show({
          type: 'success',
          text1: 'Text copied to clipboard',
          position: 'bottom',
          visibilityTime: 2000,
        });
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
      }
    };

    // Check if this is the last message, if it's from the user, and if loading is active
    const isLastMessage = messages[messages.length - 1]?.id === item.id;
    const isLastUserMessage = isLastMessage && !isBot && isLoading;
    
    // Check if the message has an image
    if (item.image) {
      console.log('Rendering image message with URL:', item.image);
      
      // Clean the URL if needed
      let imageUrl = item.image;
      if (typeof imageUrl === 'string' && !imageUrl.startsWith('http')) {
        console.log('Image URL does not start with http, may need processing:', imageUrl);
      }
      
      return (
        <View style={[
          styles.messageWrapperOuter, 
          isBot ? styles.botMessageWrapper : styles.userMessageWrapper
        ]}>
          <Animatable.View
            animation="fadeInUp"
            duration={800}
            style={[
              styles.messageContainer,
              isBot ? styles.botMessageContainer : styles.userMessageContainer,
            ]}
          >
            {isBot && (
              <View style={styles.botHeaderContainer}>
                <View style={styles.botHeaderLogoContainer}>
                  <Image source={require('../assets/logo7.png')} style={[styles.botHeaderLogo, {tintColor: '#fff'}]} />
                </View>
                <Text style={[styles.botHeaderText, {color: '#4C8EF7'}]}>MatrixAI</Text>
              </View>
            )}
            
            <TouchableOpacity 
              onPress={() => handleImageTap(item.image)}
              style={styles.imageContainer}
            >
              <Image
                source={{ uri: item.image }}
                style={styles.chatImage}
                resizeMode="cover"
                onError={(e) => {
                  console.error('Image error details:', {
                    error: e.nativeEvent.error,
                    url: item.image,
                    messageId: item.id
                  });
                }}
              />
            </TouchableOpacity>
            
            {item.text && item.text.trim() !== '' && (
              <Text style={[
                isBot ? styles.botText : styles.userText,
                styles.messageText,
                styles.captionText
              ]}>
                {item.text}
              </Text>
            )}
            
            <View style={isBot ? styles.botTail : styles.userTail} />
          </Animatable.View>
          
          {/* Message action buttons */}
          <Animatable.View
            animation="fadeInUp"
            duration={800}
            delay={200}
            style={[
              styles.messageActionButtons,
              isBot ? styles.botMessageActions : styles.userMessageActions
            ]}
          >
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
          </Animatable.View>
        </View>
      );
    }
  
    // Function to detect if the text contains a URL
    const containsUrl = (text) => {
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      return text && urlRegex.test(text);
    };
  
    // Function to process and format the message text
    const formatMessageText = (text, sender) => {
      if (!text) return [];
      
      const isBot = sender === 'bot';
      const isChineseContent = /[\u3400-\u9FBF]/.test(text);
      
      // Check if the text is already in markdown format or should be converted to markdown
      const hasExistingMarkdown = /(\#{1,3}\s.+)|(\*\*.+\*\*)|(^\s*[\*\-]\s.+)|(^\s*\d+\.\s.+)|(^>.+)|(^\`\`.+\`\`)/.test(text);
      
      // For bot messages, we'll enhance with markdown formatting
      if (isBot) {
        // If it doesn't already have markdown formatting, add it
        if (!hasExistingMarkdown) {
          // Pre-process text to enhance with markdown formatting
          
          // Convert numbered lists (e.g., "1. Item") to markdown formatted lists
          text = text.replace(/^(\d+)\.[ \t]+(.+)/gm, '$1. $2');
          
          // Convert bullet points to markdown bullet lists
          text = text.replace(/^[\-•][ \t]+(.+)/gm, '* $1');
          
          // Convert lines that end with colon and look like headings to markdown headings
          text = text.replace(/^([A-Z][^.!?:]*):$/gm, '## $1');
          
          // For Chinese content, process headings and subheadings differently
          if (isChineseContent) {
            // Find Chinese headings (typically marked with ### or 标题：)
            text = text.replace(/^(#+\s+.+)|^([\u4e00-\u9fa5]+[：:])$/gm, '## $1$2');
            
            // Add numbers to section titles (1., 2., etc.)
            text = text.replace(/^##\s+(.*?)$/gm, (match, p1, offset) => {
              // Count previous headings to determine number
              const prevHeadings = text.substring(0, offset).match(/^##\s+/gm) || [];
              const headingNum = prevHeadings.length + 1;
              return `## ${headingNum}. ${p1}`;
            });
            
            // Process numbered lists in Chinese - letter for subtitles (a., b., etc.)
            text = text.replace(/^([a-z])[、.．][\s](.+)/gm, '$1. $2');
            
            // Process bullet points in Chinese with specific color
            text = text.replace(/^[•·◦◆■◉○●][\s](.+)/gm, '* $1');
          }
          
          // Add bold to important words
          text = text.replace(/\b(Note|Important|Warning|Caution):/g, '**$1:**');
          
          // Convert section titles (all caps) to headings
          text = text.replace(/^([A-Z][A-Z\s]+)$/gm, '## $1');
        }
        
        // Process math expressions in the text
        // Look for LaTeX-style math expressions ($...$ or $$...$$)
        text = text.replace(/\$\$(.+?)\$\$/g, (match, equation) => {
          // For display math, keep as is
          return match;
        });
        
        text = text.replace(/\$(.+?)\$/g, (match, equation) => {
          // For inline math, keep as is
          return match;
        });
        
        // For tables, we need to maintain the special handling
        const lines = text.split('\n');
        let isInTable = false;
        let tableContent = [];
        let nonTableContent = [];

        // First detect tables
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          
          // Check for table rows (containing | character)
          if (line.includes('|') && (line.indexOf('|') !== line.lastIndexOf('|'))) {
            if (!isInTable) {
              isInTable = true;
              tableContent = [line];
            } else {
              tableContent.push(line);
            }
          } else {
            if (isInTable) {
              // We've ended a table, process it
              const tableResult = {
                isTable: true,
                tableText: tableContent.join('\n')
              };
              nonTableContent.push(tableResult);
              isInTable = false;
              tableContent = [];
            }
            
            if (line.trim() !== '') {
              nonTableContent.push({
                isTable: false,
                text: line
              });
            }
          }
        }
        
        // Handle case where text ends with a table
        if (isInTable && tableContent.length > 0) {
          nonTableContent.push({
            isTable: true,
            tableText: tableContent.join('\n')
          });
        }
        
        // If we found any tables, return a mix of markdown and table components
        if (nonTableContent.some(item => item.isTable)) {
          return nonTableContent.map(item => {
            if (item.isTable) {
              // Parse the table for our table renderer
              const tableLines = item.tableText.split('\n');
              let tableHeaders = [];
              let tableData = [];
              let separatorFound = false;
              
              tableLines.forEach(line => {
                // Check if this is a separator row
                const isSeparator = line.replace(/\|/g, '').trim().replace(/[^-:]/g, '') !== '';
                
                if (isSeparator) {
                  separatorFound = true;
                  return;
                }
                
                // Parse cells
                const cells = line
                  .split('|')
                  .map(cell => {
                    // Remove stars and other markdown from cell content
                    return cell.trim()
                      .replace(/^\*\s/, '') // Remove bullet points
                      .replace(/^\d+\.\s/, '') // Remove numbered list markers
                      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
                      .replace(/\*(.*?)\*/g, '$1'); // Remove italics
                  })
                  .filter((cell, idx, arr) => {
                    if (idx === 0 && cell === '' && line.startsWith('|')) return false;
                    if (idx === arr.length - 1 && cell === '' && line.endsWith('|')) return false;
                    return true;
                  });
                
                if (cells.length > 0) {
                  if (!separatorFound && tableHeaders.length === 0) {
                    tableHeaders = cells;
                  } else if (separatorFound) {
                    tableData.push(cells);
                  }
                }
              });
              
              return {
                isTable: true,
                tableHeaders,
                tableData,
                tableLines
              };
            } else {
              // For non-table content, process math expressions and other formatting
              const line = item.text;
              const isHeading = /^#{1,3}\s.+/.test(line) || /^[A-Z].*:$/.test(line);
              const isSubheading = /^[\*\-•]\s+.+/.test(line) || /^\d+\.\s+.+/.test(line);
              const hasMathExpression = isMathExpression(line) || /\$(.+?)\$/.test(line);
              const isChineseHeading = isChineseContent && (/^#+\s+.+/.test(line) || /^([\u4e00-\u9fa5]+[：:])$/.test(line));
              const isChineseSubheading = isChineseContent && (/^[•·◦◆■◉○●][\s]/.test(line) || /^[一二三四五六七八九十]、/.test(line) || /^\d+[、.．][\s]/.test(line));
              
              return {
                text: line,
                isHeading,
                isSubheading,
                hasMathExpression,
                isTable: false,
                isMarkdown: true,
                isChineseHeading,
                isChineseSubheading,
                isChineseContent
              };
            }
          });
        } else {
          // If there are no tables, just return the enhanced text as markdown
          const lines = text.split('\n');
          return lines.map(line => {
            const isHeading = /^#{1,3}\s.+/.test(line) || /^[A-Z].*:$/.test(line);
            const isSubheading = /^[\*\-•]\s+.+/.test(line) || /^\d+\.\s+.+/.test(line);
            const hasMathExpression = isMathExpression(line) || /\$(.+?)\$/.test(line);
            const isChineseHeading = isChineseContent && (/^#+\s+.+/.test(line) || /^([\u4e00-\u9fa5]+[：:])$/.test(line));
            const isChineseSubheading = isChineseContent && (/^[•·◦◆■◉○●][\s]/.test(line) || /^[一二三四五六七八九十]、/.test(line) || /^\d+[、.．][\s]/.test(line));
            
            return {
              text: line,
              isHeading,
              isSubheading,
              hasMathExpression,
              isTable: false,
              isMarkdown: true,
              isChineseHeading,
              isChineseSubheading,
              isChineseContent
            };
          });
        }
      } else {
        // For user messages, just return as plain text
        return [{
          text: text,
          isMarkdown: false,
          isTable: false
        }];
      }
    };
  


    // MathJax configuration for proper rendering
  

    // Render LaTeX style formulas
    const renderLatexFormula = (formula, index) => {
      // Remove the LaTeX delimiters, but preserve the content for MathJax
      let cleanFormula = formula
        .replace(/\\\[|\\\]/g, '')
        .replace(/\\\(|\\\)/g, '')
        .replace(/^\$\$|\$\$$/g, '');
      
      // Apply additional formatting to ensure proper LaTeX rendering
      cleanFormula = formatMathToLatex(cleanFormula);
      
      // Wrap the formula in LaTeX delimiters for MathJaxSvg
      const mathJaxFormula = `$$${cleanFormula}$$`;
      
      // Use MathJaxSvg to render the formula properly
      return (
        <View key={`latex-formula-${index}`} style={styles.displayMathContainer}>
          <MathJaxSvg
            fontSize={18}
            color={colors.botText}
            fontCache={true}
          >
            {mathJaxFormula}
          </MathJaxSvg>
        </View>
      );
    };
  
    return (
      <View style={[
        styles.messageWrapperOuter, 
        isBot ? styles.botMessageWrapper : styles.userMessageWrapper
      ]}>
        <Animatable.View
          animation="fadeInUp"
          duration={800}
          style={[
            styles.messageContainer,
            isBot ? styles.botMessageContainer : styles.userMessageContainer,
          ]}
        >
          {isBot && (
            <View style={styles.botHeaderContainer}>
              <View style={styles.botHeaderLogoContainer}>
                <Image source={require('../assets/logo7.png')} style={[styles.botHeaderLogo , {tintColor: '#fff'}]} />
              </View>
              <Text style={[styles.botHeaderText, {color: '#4C8EF7'}]}>MatrixAI</Text>
            </View>
          )}
          <View style={isBot ? styles.botTextContainer : styles.userTextContainer}>
            {formatMessageText(item.text, item.sender).map((line, index) => {
              if (isCollapsed && shouldTruncate && line.isMarkdown) {
                return (
                  <Markdown 
                    key={`markdown-${index}-${line.text.substring(0, 10)}`}
                    style={{
                      body: {
                        color: isBot ? colors.botText : '#fff',
                        fontSize: 16,
                      },
                      heading1: {
                        color: isBot ? colors.botText : '#fff',
                        fontWeight: 'bold',
                        fontSize: 20,
                        marginTop: 8,
                        marginBottom: 4,
                      },
                      heading2: {
                        color: isBot ? colors.botText : '#fff',
                        fontWeight: 'bold',
                        fontSize: 18,
                        marginTop: 8,
                        marginBottom: 4,
                      },
                      heading3: {
                        color: isBot ? colors.botText : '#fff',
                        fontWeight: 'bold',
                        fontSize: 16,
                        marginTop: 8,
                        marginBottom: 4,
                      },
                      paragraph: {
                        color: isBot ? colors.botText : '#fff',
                        fontSize: 16,
                        marginTop: 4,
                        marginBottom: 4,
                      },
                      list_item: {
                        color: isBot ? colors.botText : '#fff',
                        fontSize: 16,
                        marginTop: 4,
                      },
                      bullet_list: {
                        color: isBot ? colors.botText : '#fff',
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
                      blockquote: {
                        backgroundColor: 'rgba(128, 128, 128, 0.1)',
                        borderLeftWidth: 4,
                        borderLeftColor: isBot ? colors.primary : '#fff',
                        paddingLeft: 8,
                        paddingVertical: 4,
                        color: isBot ? colors.botText : '#fff',
                      },
                      code_block: {
                        backgroundColor: 'rgba(128, 128, 128, 0.1)',
                        padding: 8,
                        borderRadius: 4,
                        color: isBot ? colors.botText : '#fff',
                      },
                      code_inline: {
                        backgroundColor: 'rgba(128, 128, 128, 0.1)',
                        padding: 2,
                        borderRadius: 2,
                        color: isBot ? colors.botText : '#fff',
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
                        color: isBot ? colors.botText : '#FFFFFF',
                      }
                    }}
                    rules={{
                      // Custom ordered list renderer
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
                      // Custom ordered list item renderer
                      list_item: (node, children, parent, styles) => {
                        if (parent.ordered) {
                          return (
                            <View key={node.key} style={styles.ordered_list_item}>
                              <Text style={[styles.list_item_number, {color: isBot ? '#2274F0' : '#fff'}]}>{node.index + 1}.</Text>
                              <View style={styles.list_item_content}>
                                {children}
                              </View>
                            </View>
                          );
                        }
                        return (
                          <View key={node.key} style={styles.list_item}>
                            <Text style={[styles.list_item_bullet, {color: isBot ? '#2274F0' : '#fff'}]}>•</Text>
                            <View style={{ flex: 1 }}>
                              {children}
                            </View>
                          </View>
                        );
                      }
                    }}
                  >
                    {line.text.substring(0, 100) + '...'}
                  </Markdown>
                );
              } else if (line.isMarkdown) {
                return (
                  <Markdown 
                    key={`markdown-${index}-${line.text.substring(0, 10)}`}
                    style={{
                      body: {
                        color: isBot ? colors.botText : '#fff',
                        fontSize: 16,
                      },
                      heading1: {
                        color: isBot ? colors.botText : '#fff',
                        fontWeight: 'bold',
                        fontSize: 20,
                        marginTop: 8,
                        marginBottom: 4,
                      },
                      heading2: {
                        color: isBot ? colors.botText : '#fff',
                        fontWeight: 'bold',
                        fontSize: 18,
                        marginTop: 8,
                        marginBottom: 4,
                      },
                      heading3: {
                        color: isBot ? colors.botText : '#fff',
                        fontWeight: 'bold',
                        fontSize: 16,
                        marginTop: 8,
                        marginBottom: 4,
                      },
                      paragraph: {
                        color: isBot ? colors.botText : '#fff',
                        fontSize: 16,
                        marginTop: 4,
                        marginBottom: 4,
                      },
                      list_item: {
                        color: isBot ? colors.botText : '#fff',
                        fontSize: 16,
                        marginTop: 4,
                      },
                      bullet_list: {
                        color: isBot ? colors.botText : '#fff',
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
                      blockquote: {
                        backgroundColor: 'rgba(128, 128, 128, 0.1)',
                        borderLeftWidth: 4,
                        borderLeftColor: isBot ? colors.primary : '#fff',
                        paddingLeft: 8,
                        paddingVertical: 4,
                        color: isBot ? colors.botText : '#fff',
                      },
                      code_block: {
                        backgroundColor: 'rgba(128, 128, 128, 0.1)',
                        padding: 8,
                        borderRadius: 4,
                        color: isBot ? colors.botText : '#fff',
                      },
                      code_inline: {
                        backgroundColor: 'rgba(128, 128, 128, 0.1)',
                        padding: 2,
                        borderRadius: 2,
                        color: isBot ? colors.botText : '#fff',
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
                        color: isBot ? colors.botText : '#FFFFFF',
                      }
                    }}
                    rules={{
                      // Custom ordered list renderer
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
                      // Custom ordered list item renderer
                      list_item: (node, children, parent, styles) => {
                        if (parent.ordered) {
                          return (
                            <View key={node.key} style={styles.ordered_list_item}>
                              <Text style={[styles.list_item_number, {color: isBot ? '#2274F0' : '#fff'}]}>{node.index + 1}.</Text>
                              <View style={styles.list_item_content}>
                                {children}
                              </View>
                            </View>
                          );
                        }
                        return (
                          <View key={node.key} style={styles.list_item}>
                            <Text style={[styles.list_item_bullet, {color: isBot ? '#2274F0' : '#fff'}]}>•</Text>
                            <View style={{ flex: 1 }}>
                              {children}
                            </View>
                          </View>
                        );
                      }
                    }}
                  >
                    {line.text}
                  </Markdown>
                );
              }
              
              // Handle table rendering
              if (line.isTable) {
                return isCollapsed ? null : renderTable(line, index);
              }
              
              // Handle LaTeX formula
              if (line.isLatexFormula) {
                return renderLatexFormula(line.text, index);
              }
              
              // Handle Chinese mathematical headings and subheadings
              if (line.isChineseMath) {
                if (line.isChineseHeading) {
                  return (
                    <Text key={`chinese-heading-${index}`} style={styles.chineseMathHeading}>
                      {line.text}
                    </Text>
                  );
                }
                
                if (line.isChineseSubheading) {
                  return (
                    <Text key={`chinese-subheading-${index}`} style={styles.chineseMathSubheading}>
                      {line.text}
                    </Text>
                  );
                }
                
                // Regular Chinese math text
                return (
                  <Text key={`chinese-math-text-${index}`} style={styles.chineseMathText}>
                    {line.text}
                  </Text>
                );
              }
              
              // Handle links in the text
              if (containsUrl(line.text)) {
                const urlRegex = /(https?:\/\/[^\s]+)/g;
                const parts = line.text.split(urlRegex);
                const elements = [];
                
                parts.forEach((part, i) => {
                  if (urlRegex.test(part)) {
                    elements.push(
                      <TouchableOpacity 
                        key={`link-${index}-${i}`}
                        onPress={() => Linking.openURL(part)}
                        style={styles.linkContainer}
                      >
                        <Ionicons name="link" size={16} color="#007bff" style={styles.linkIcon} />
                        <Text style={styles.linkText}>{part}</Text>
                      </TouchableOpacity>
                    );
                  } else if (part) {
                    elements.push(<Text key={`text-${index}-${i}`} style={[isBot ? styles.botText : styles.userText, { color: isBot ? colors.botText : '#fff' }]}>{part}</Text>);
                  }
                });
                
                return (
                  <View key={`line-${index}`} style={styles.textLine}>
                    {elements}
                  </View>
                );
              }
              
              // Handle math expressions
              else if (line.hasMathExpression) {
                return renderTextWithMath(line, index);
              }
              
              // Handle headings
              else if (line.isHeading) {
                return (
                  <View key={`line-${index}`} style={styles.headingContainer}>
                    <Text style={[styles.headingPointer, {color: isBot ? '#2274F0' : '#fff'}]}>➤</Text>
                    <Text style={[styles.botText, {
                      color: isBot ? colors.botText : '#fff',
                      fontWeight: 'bold',
                      fontSize: 18
                    }]}>{line.text}</Text>
                  </View>
                );
              }
              
              // Handle subheadings
              else if (line.isSubheading) {
                return (
                  <View key={`line-${index}`} style={styles.subheadingContainer}>
                    <Text style={[styles.subheadingPointer, {color: isBot ? '#2274F0' : '#fff'}]}>•</Text>
                    <Text style={[styles.botText, {
                      color: isBot ? colors.botText : '#fff',
                      fontWeight: 'bold',
                      fontSize: 16
                    }]}>{line.text}</Text>
                  </View>
                );
              }
              
              // Regular text - check for inline math expressions
              else if (isMathExpression(line.text)) {
                return isCollapsed ? (
                  <Text key={`collapsed-math-${index}`} style={[styles.botText, {color: isBot ? colors.botText : '#fff'}]}>
                    {line.text.substring(0, 100) + '...'}
                  </Text>
                ) : renderTextWithMath(line, index);
              }
              
              // Plain text with no special formatting
              else {
                // Check for inline math expressions like 2^2
                const text = line.text;
                if (text.includes('^')) {
                  // Split by potential math expressions with ^ symbol
                  // This regex matches patterns like 2^2, x^2, 10^n, etc.
                  const parts = text.split(/([\w\d]+\^[\w\d]+)/g);
                  
                  if (parts.length > 1) {
                    return (
                      <View key={`line-math-inline-${index}`} style={styles.textLine}>
                        {parts.map((part, i) => {
                          // Check if this part contains a math expression with ^
                          if (/[\w\d]+\^[\w\d]+/.test(part)) {
                            const mathContent = formatMathToLatex(part);
                            return (
                              <MathJaxSvg
                                key={`inline-math-${index}-${i}`}
                                fontSize={16}
                                color={isBot ? colors.botText : '#fff'}
                                fontCache={true}
                              >
                                {`$$${mathContent}$$`}
                              </MathJaxSvg>
                            );
                          } else if (part) {
                            return (
                              <Text key={`text-${index}-${i}`} style={[styles.botText, {color: isBot ? colors.botText : '#fff'}]}>
                                {part}
                              </Text>
                            );
                          }
                          return null;
                        })}
                      </View>
                    );
                  }
                }
                
                // No math expressions found, render as regular text
                return (
                  <Text key={`line-${index}`} style={[styles.botText, {color: isBot ? colors.botText : '#fff'}]}>
                    {isCollapsed && shouldTruncate ? line.text.substring(0, 100) + '...' : line.text}
                  </Text>
                );
              }
            })}
          </View>
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
        
        {/* Message action buttons - outside the bubble but inside the animation */}
        <Animatable.View
          animation="fadeInUp"
          duration={800}
          delay={200}
          style={[
            styles.messageActionButtons,
            isBot ? styles.botMessageActions : styles.userMessageActions
          ]}
        >
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
        </Animatable.View>
      </View>
    );
  }, [dataLoaded, messages, expandedMessages, isLoading, colors.botText, colors.primary, colors.background]);

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
              
              // Scroll to bottom after loading messages
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
          
          // Scroll to bottom after loading messages
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
        
        // Scroll to bottom after updating messages
        setTimeout(() => {
          if (flatListRef.current) {
            flatListRef.current.scrollToEnd({ animated: true });
          }
        }, 100);
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
        
        // Scroll to bottom after updating messages
        setTimeout(() => {
          if (flatListRef.current) {
            flatListRef.current.scrollToEnd({ animated: true });
          }
        }, 100);
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
          
          // Auto-scroll to bottom as content streams in
          setTimeout(() => {
            if (flatListRef.current) {
              flatListRef.current.scrollToEnd({ animated: true });
            }
          }, 50);
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
      
      // Scroll to bottom after loading messages
      setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: true });
        }
      }, 100);
      
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
        
        console.log('Selected image details:', {
          uri: uri,
          type: type || 'image/jpeg',
          fileName: fileName || `image_${Date.now()}.jpg`
        });
        
        // Set the selected image
        setSelectedImage(uri);
        setImageType(type || 'image/jpeg');
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

  // Function to render a single line of text with math expressions highlighted
  const renderTextWithMath = (line, index) => {
    const isBot = line.sender === 'bot';
    
    // Check for "Thus:" pattern
    if (/^Thus:$/.test(line.text)) {
      return (
        <Text key={`thus-${index}`} style={[
          isBot ? styles.botText : styles.userText,
          {color: isBot ? colors.botText : '#fff'}
        ]}>
          {line.text}
        </Text>
      );
    }
    
    // Check for standalone square brackets that should be rendered as math
    if (/^\[.*\]$/.test(line.text)) {
      const mathContent = formatMathToLatex(line.text.replace(/^\[|\]$/g, ''));
      return (
        <View key={`math-bracket-${index}`} style={[styles.mathContainer, {paddingVertical: 10}]}>
          <MathJaxSvg
            fontSize={18}
            color={isBot ? colors.botText : '#fff'}
            fontCache={true}
          >
            {`$$${mathContent}$$`}
          </MathJaxSvg>
        </View>
      );
    }
    
    // Check for any mathematical expression in square brackets
    if (/\[.*\]/.test(line.text)) {
      const mathContent = formatMathToLatex(line.text.replace(/^\[|\]$/g, ''));
      return (
        <View key={`math-expression-${index}`} style={[styles.mathContainer, {paddingVertical: 10}]}>
          <MathJaxSvg
            fontSize={18}
            color={isBot ? colors.botText : '#fff'}
            fontCache={true}
          >
            {`$$${mathContent}$$`}
          </MathJaxSvg>
        </View>
      );
    }
    
    // Check for any formula with equals sign and mathematical notation
    if (/[a-z0-9\)]\s*=\s*[a-z0-9\(]/.test(line.text) && 
        (line.text.includes('^') || line.text.includes('sqrt') || 
         line.text.includes('frac') || line.text.includes('/') || 
         line.text.includes('\\') || line.text.includes('_'))) {
      return (
        <View key={`equation-${index}`} style={styles.mathContainer}>
          <Text style={[styles.messageText, { color: isBot ? colors.botText : '#fff' }]}>
            {formatMathToLatex(line.text)}
          </Text>
        </View>
      );
    }
    
    // Check for derivative expressions
    if (/[a-z]'\(x\)/.test(line.text) || /f'\(x\)/.test(line.text) || /g'\(x\)/.test(line.text) || /h'\(x\)/.test(line.text)) {
      return (
        <View key={`derivative-${index}`} style={styles.mathContainer}>
          <Text style={[styles.messageText, { color: isBot ? colors.botText : '#fff' }]}>
            {formatMathToLatex(line.text)}
          </Text>
        </View>
      );
    }
    
    // Check for bullet points with mathematical content
    if (/^[•\*-]\s*.*([a-z]'\(x\)|\^|_|\\frac|\\sqrt|=)/.test(line.text)) {
      // Try to extract mathematical parts
      const parts = line.text.split(/([a-z]'\(x\)\s*=\s*[^.]+|\$[^$]+\$)/);
      
      if (parts.length > 1) {
        return (
          <View key={`bullet-math-${index}`} style={styles.textLine}>
            {parts.map((part, partIndex) => {
              // Check if this part contains math notation
              if (/([a-z]'\(x\)|\^|_|\\frac|\\sqrt|=)/.test(part) && 
                  !/^[•\*-]\s*/.test(part)) {
                const mathContent = formatMathToLatex(part);
                return (
                  <View key={`math-part-${index}-${partIndex}`} style={styles.inlineMathContainer}>
                    <MathJaxSvg
                      fontSize={16}
                      color={isBot ? colors.botText : '#fff'}
                      fontCache={true}
                    >
                      {`$$${mathContent}$$`}
                    </MathJaxSvg>
                  </View>
                );
              } else {
                return (
                  <Text key={`text-part-${index}-${partIndex}`} 
                        style={[isBot ? styles.botText : styles.userText, {color: isBot ? colors.botText : '#fff'}]}>
                    {part}
                  </Text>
                );
              }
            })}
          </View>
        );
      }
    }
    
    // Handle expressions with mathematical notation
    if (/([a-z]'\(x\)|\^|_|\\frac|\\sqrt|=|\+|-|\*|\/|\\times|\\div)/.test(line.text)) {
      const mathContent = formatMathToLatex(line.text);
      return (
        <View key={`math-notation-${index}`} style={styles.mathContainer}>
          <MathJaxSvg
            fontSize={18}
            color={isBot ? colors.botText : '#fff'}
            fontCache={true}
          >
            {`$$${mathContent}$$`}
          </MathJaxSvg>
        </View>
      );
    }
    
    // Check for LaTeX-style formulas
    if (line.text.startsWith('\\[') || line.text.startsWith('\\(') || 
        line.text.startsWith('$$') || line.text.startsWith('\\begin{equation}')) {
      return renderLatexFormula(line.text, index);
    }
    
    // Check for common mathematical patterns like equations with = sign
    if (/[a-z0-9\)][\s]*=[\s]*[a-z0-9\(]/.test(line.text) && 
        (line.text.includes('^') || line.text.includes('sqrt') || 
         line.text.includes('frac') || line.text.includes('/') || 
         line.text.includes('\\') || line.text.includes('_'))) {
      const mathContent = formatMathToLatex(line.text);
      return (
        <View key={`equation-${index}`} style={styles.mathContainer}>
          <MathJaxSvg
            fontSize={18}
            color={isBot ? colors.botText : '#fff'}
            fontCache={true}
          >
            {`$$${mathContent}$$`}
          </MathJaxSvg>
        </View>
      );
    }
    
    // Process dollar sign delimited LaTeX (like $x^2$)
    if (line.text.includes('$')) {
      const parts = [];
      const dollarRegex = /\$(.*?)\$/g;
      let lastIndex = 0;
      let match;
      
      while ((match = dollarRegex.exec(line.text)) !== null) {
        // Add text before the formula
        if (match.index > lastIndex) {
          parts.push({
            type: 'text',
            content: line.text.substring(lastIndex, match.index)
          });
        }
        
        // Add the formula - ensure it's properly formatted for MathJax
        const mathContent = match[1].trim();
        parts.push({
          type: 'inline-math',
          content: formatMathToLatex(mathContent)
        });
        
        lastIndex = match.index + match[0].length;
      }
      
      // Add any remaining text
      if (lastIndex < line.text.length) {
        parts.push({
          type: 'text',
          content: line.text.substring(lastIndex)
        });
      }
      
      return (
        <View key={`math-line-${index}`} style={styles.textLine}>
          {parts.map((part, partIndex) => {
            if (part.type === 'text') {
              return (
                <Text 
                  key={`text-part-${index}-${partIndex}`} 
                  style={[isBot ? styles.botText : styles.userText, {color: isBot ? colors.botText : '#fff'}]}
                >
                  {part.content}
                </Text>
              );
            } else if (part.type === 'inline-math') {
              return (
                <View key={`inline-math-${index}-${partIndex}`} style={styles.inlineMathContainer}>
                  <MathJaxSvg
                    fontSize={18}
                    color={isBot ? colors.botText : '#fff'}
                    fontCache={true}
                  >
                    {`$$${part.content}$$`}
                  </MathJaxSvg>
                </View>
              );
            }
            return null;
          })}
        </View>
      );
    }
    
    // Check for function notation like f'(x) or h'(x)
    if (/[a-z]'?\([a-z]\)/.test(line.text)) {
      // Format it as LaTeX
      let latexFormula = line.text
        .replace(/([a-z])'\(([a-z])\)/g, '$1^{\\prime}($2)')
        .replace(/([a-z])''\(([a-z])\)/g, '$1^{\\prime\\prime}($2)');
      
      return (
        <View key={`function-notation-${index}`} style={styles.mathContainer}>
          <MathJaxSvg
            fontSize={18}
            color={isBot ? colors.botText : '#fff'}
            fontCache={true}
          >
            {`$$${latexFormula}$$`}
          </MathJaxSvg>
        </View>
      );
    }
    
    // Check for step notation with math formulas
    if (/Step\s+\d+:.*/.test(line.text)) {
      // Don't convert it to LaTeX, but identify parts that should be in LaTeX
      const parts = [];
      const stepRegex = /(Step\s+\d+:)\s*(.*)/;
      const match = line.text.match(stepRegex);
      
      if (match) {
        const stepLabel = match[1];
        const mathContent = match[2];
        
        parts.push({
          type: 'text',
          content: stepLabel + ' ',
          style: { fontWeight: '600' } // Make Step label bold
        });
        
        // Check if the math content contains mathematical notation
        // Expanded pattern to catch more math expressions
        if (/([a-z]'\(x\)|\^|_|\\frac|\\sqrt|=|\+|-|\*|\/|\\times|\\div|\$|\\|\(|\)|\[|\]|\{|\}|\d+\/\d+|√|\bdx\b|\bdy\b|\bdt\b|\bpartial\b|\bint\b|\bsum\b|\blim\b|\binfty\b|\bpi\b|\btheta\b|\balpha\b|\bbeta\b|\bdelta\b|\bsigma\b|\bomega\b)/.test(mathContent)) {
          parts.push({
            type: 'inline-math',
            content: formatMathToLatex(mathContent)
          });
        } else {
          parts.push({
            type: 'text',
            content: mathContent
          });
        }
        
        return (
          <View key={`step-math-${index}`} style={styles.textLine}>
            {parts.map((part, partIndex) => {
              if (part.type === 'text') {
                return (
                  <Text 
                    key={`text-part-${index}-${partIndex}`} 
                    style={[isBot ? styles.botText : styles.userText, 
                           {color: isBot ? colors.botText : '#fff', fontWeight: partIndex === 0 ? 'bold' : 'normal'}]}
                  >
                    {part.content}
                  </Text>
                );
              } else if (part.type === 'inline-math') {
                return (
                  <View key={`inline-math-${index}-${partIndex}`} style={styles.inlineMathContainer}>
                    <MathJaxSvg
                      fontSize={16}
                      color={isBot ? colors.botText : '#fff'}
                      fontCache={true}
                    >
                      {`$$${part.content}$$`}
                    </MathJaxSvg>
                  </View>
                );
              }
              return null;
            })}
          </View>
        );
      }
    }
    
    // Add support for subscript notation
    if (hasMathSubscripts(line.text)) {
      // Process subscripts and use MathJax for rendering
      const mathText = line.text
        .replace(/([a-zA-Z])_(\d)/g, '$1_{$2}')
        .replace(/([a-zA-Z])_([a-zA-Z])/g, '$1_{$2}')
        .replace(/([a-zA-Z])_\{([^}]+)\}/g, '$1_{$2}');
      
      return (
        <View key={`math-line-${index}`} style={styles.mathContainer}>
          <MathJaxSvg
            fontSize={18}
            color={isBot ? colors.botText : '#fff'}
            fontCache={true}
          >
            {`$$${mathText}$$`}
          </MathJaxSvg>
        </View>
      );
    }
    
    // Enhanced pattern matching for mathematical formulas
    // Check for specific patterns like Pythagorean theorem (a^2 + b^2 = c^2)
    if (/[a-z\d]\s*\^\s*\d+\s*[\+\-]\s*[a-z\d]\s*\^\s*\d+\s*=/.test(line.text) ||
        /\d+\^2\s*[\+\-]\s*\d+\^2\s*=\s*[a-z]\^2/.test(line.text) ||
        /\d+\s*\^\s*2\s*\+\s*\d+\s*\^\s*2\s*=\s*[a-z]\s*\^\s*2/.test(line.text) ||
        /[a-z\d]\s*\^\s*[a-z\d]\s*[\+\-]\s*[a-z\d]\s*\^\s*[a-z\d]/.test(line.text) ||
        /\d+\s*\+\s*\d+\s*=\s*[a-z]\^2/.test(line.text) ||
        /[a-z]\^2\s*[\+\-]\s*[a-z]\^2\s*=/.test(line.text) ||
        /[a-z\d]\^[a-z\d]/.test(line.text) && /[\+\-\=]/.test(line.text)) {
      // Format it as LaTeX
      let latexFormula = line.text
        .replace(/([a-z\d])\s*\^\s*(\d+)/g, '$1^{$2}')
        .replace(/([a-z\d])\s*\^\s*([a-z\d])/g, '$1^{$2}')
        .replace(/sqrt\(([^)]+)\)/g, '\\sqrt{$1}')
        .replace(/√\s*([a-z0-9]+)/g, '\\sqrt{$1}');
      
      return (
        <View key={`pythagorean-${index}`} style={styles.mathContainer}>
          <MathJaxSvg
            fontSize={18}
            color={isBot ? colors.botText : '#fff'}
            fontCache={true}
          >
            {`$$${latexFormula}$$`}
          </MathJaxSvg>
        </View>
      );
    }

    // Special case for c = sqrt{25} = 5 pattern
    if (/[a-z]\s*=\s*\\?sqrt\{?\d+\}?\s*=\s*\d+/.test(line.text) || 
        /[a-z]\s*=\s*\\?sqrt\{?\d+\}?/.test(line.text) ||
        /[a-z]\s*=\s*√\d+/.test(line.text)) {
      let latexFormula = line.text
        .replace(/sqrt\{?(\d+)\}?/g, '\\sqrt{$1}')
        .replace(/√\s*(\d+)/g, '\\sqrt{$1}');
      
      return (
        <View key={`sqrt-result-${index}`} style={styles.mathContainer}>
          <MathJaxSvg
            fontSize={18}
            color={isBot ? colors.botText : '#fff'}
            fontCache={true}
          >
            {`$$${latexFormula}$$`}
          </MathJaxSvg>
        </View>
      );
    }
    
    // Specific case for fractions in quotient rule formula
    if (/\\frac\{.*\}\{.*\}/.test(line.text) || line.text.includes('\\over')) {
      return (
        <View key={`fraction-formula-${index}`} style={styles.mathContainer}>
          <MathJaxSvg
            fontSize={18}
            color={isBot ? colors.botText : '#fff'}
            fontCache={true}
          >
            {`$$${line.text}$$`}
          </MathJaxSvg>
        </View>
      );
    }
    
    // Enhance the regex to catch more mathematical expressions
    const mathRegex = /(\\?[a-z]\^[a-z\d]|[a-z\d]\^\d|\\?sqrt\{?[^}]+\}?|\\frac\{[^}]+\}\{[^}]+\}|\d+\s*[\+\-\*\/×÷\=\(\)\[\]\{\}\^]\s*\d+|sin\([^)]+\)|cos\([^)]+\)|tan\([^)]+\)|log\([^)]+\)|[a-z]'|[a-z]'\([a-z]\))/g;
    const matches = line.text.match(mathRegex) || [];
    
    // If we found math expressions, split and format them
    if (matches.length > 0) {
      const parts = line.text.split(mathRegex);
      const elements = [];
      
      parts.forEach((part, i) => {
        if (part) {
          elements.push(
            <Text key={`text-part-${index}-${i}`} style={[
              isBot ? styles.botText : styles.userText,
              isBot && { color: colors.botText }
            ]}>
              {part}
            </Text>
          );
        }
        
        if (matches[i]) {
          // Format the math expression for better readability
          const latexExpression = formatMathToLatex(matches[i]);
          
          elements.push(
            <View key={`math-part-${index}-${i}`} style={styles.mathContainer}>
              <Text
                style={[styles.mathView, { color: isBot ? colors.botText : '#fff' }]}
              >
                {latexExpression}
              </Text>
            </View>
          );
        }
      });
      
      return (
        <View key={`line-${index}`} style={styles.textLine}>
          {elements}
        </View>
      );
    }
    
    // Check if the entire line might be a math formula
    if (/[a-z\d]\s*[\+\-\*\/×÷\=\^]\s*[a-z\d]/.test(line.text) && 
        (line.text.includes('^') || line.text.includes('=') || line.text.includes('+') || line.text.includes('-'))) {
      const latexFormula = formatMathToLatex(line.text);
      
      return (
        <View key={`full-math-${index}`} style={styles.mathContainer}>
          <Text
            style={[styles.mathView, { color: isBot ? colors.botText : '#fff' }]}
          >
            {latexFormula}
          </Text>
        </View>
      );
    }
    
    // If no math expressions found, return regular text
    return (
      <Text key={`text-${index}`} style={[
        isBot ? styles.botText : styles.userText,
        {color: isBot ? colors.botText : '#fff'}
      ]}>
        {line.text}
      </Text>
    );
  };
  
  // Parse a math formula to identify fractions
  const parseFractionFormula = (formula) => {
    // Split the formula into parts - operators, numbers, and fractions
    const fractionRegex = /(\d+)\s*\/\s*(\d+)/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    
    while ((match = fractionRegex.exec(formula)) !== null) {
      // Add the text before the fraction
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: formula.substring(lastIndex, match.index).trim()
        });
      }
      
      // Add the fraction
      parts.push({
        type: 'fraction',
        numerator: match[1].trim(),
        denominator: match[2].trim()
      });
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add any remaining text
    if (lastIndex < formula.length) {
      parts.push({
        type: 'text',
        content: formula.substring(lastIndex).trim()
      });
    }
    
    return parts;
  };
  
  // Render a formula with proper fractions using plain text
  const renderFractionFormula = (parts, sender) => {
    const isBot = sender === 'bot';
    
    // Convert the parts to a plain text formula
    let plainTextFormula = '';
    
    parts.forEach(part => {
      if (part.type === 'text') {
        plainTextFormula += part.content;
      } else if (part.type === 'fraction') {
        plainTextFormula += `${part.numerator}/${part.denominator}`;
      }
    });
    
    // Use regular Text component for rendering
    return (
      <View style={styles.formulaContainer}>
        <Text style={[styles.messageText, { color: isBot ? colors.botText : '#fff' }]}>
          {plainTextFormula}
        </Text>
      </View>
    );
  };
  
  // Render square root notation using plain text
  const renderSquareRoot = (formula, sender) => {
    // Extract the content inside the square root
    const rootMatch = formula.match(/√\(([^)]+)\)/); 
    const rootContent = rootMatch ? rootMatch[1] : formula.replace(/√/g, '').trim();
    const isBot = sender === 'bot';
    
    return (
      <View style={styles.sqrtContainer}>
        <Text style={[styles.messageText, { color: isBot ? colors.botText : '#fff' }]}>
          √{rootContent}
        </Text>
      </View>
    );
  };
  
  // New function to convert regular math expressions to LaTeX format
  // Format math expressions to LaTeX for MathJax rendering
 
  const formatMathToLatex = (expression) => {
    // If the expression is empty or null, return an empty string
    if (!expression || expression.trim() === '') return '';
    
    // Handle the raw LaTeX expression - if it's already in LaTeX format, return it as is
    if ((expression.includes('\\') && !expression.match(/\\+$/)) || 
        /^\$.*\$$/.test(expression)) {
      // If it's already in dollar sign delimited format, remove the dollar signs
      if (/^\$.*\$$/.test(expression)) {
        return expression.replace(/^\$|\$$/g, '');
      }
      return expression;
    }
    
    let latex = expression;
    
    // Handle derivative notation with more precision
    latex = latex.replace(/([a-z])'\(([a-z])\)/g, '$1^{\\prime}($2)')
                 .replace(/([a-z])''\(([a-z])\)/g, '$1^{\\prime\\prime}($2)')
                 .replace(/([a-z])'/g, '$1^{\\prime}');
    
    // Handle fractions with \frac or / notation
    // First, preserve existing \frac commands
    latex = latex.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '\\frac{$1}{$2}');
    
    // Handle simple fractions with / notation (digits only)
    latex = latex.replace(/(\d+)\s*\/\s*(\d+)/g, '\\frac{$1}{$2}');
    
    // Handle more complex fractions with variables and expressions
    // Match expressions like (a+b)/(c+d) or a/(b+c) or (a+b)/c
    latex = latex.replace(/\(([^()]+)\)\s*\/\s*\(([^()]+)\)/g, '\\frac{$1}{$2}');
    latex = latex.replace(/\(([^()]+)\)\s*\/\s*([a-zA-Z0-9]+)/g, '\\frac{$1}{$2}');
    latex = latex.replace(/([a-zA-Z0-9]+)\s*\/\s*\(([^()]+)\)/g, '\\frac{$1}{$2}');
    
    // Handle variable/variable fractions
    latex = latex.replace(/([a-zA-Z])\s*\/\s*([a-zA-Z])/g, '\\frac{$1}{$2}');
    
    // Handle square roots
    latex = latex.replace(/sqrt\(([^)]+)\)/g, '\\sqrt{$1}');
    latex = latex.replace(/square root of (\d+)/gi, '\\sqrt{$1}');
    latex = latex.replace(/square root/gi, '\\sqrt{}');
    latex = latex.replace(/√(\d+)/g, '\\sqrt{$1}');
    
    // Handle exponents (^) - convert all forms to proper LaTeX
    // First handle expressions with spaces around the ^ operator
    latex = latex.replace(/([a-zA-Z0-9])\s*\^\s*([a-zA-Z0-9])/g, '$1^{$2}');
    latex = latex.replace(/([a-zA-Z0-9])\s*\^\s*(\d+)/g, '$1^{$2}');
    // Then handle expressions without spaces
    latex = latex.replace(/([a-zA-Z0-9])\^([a-zA-Z0-9])(?![{])/g, '$1^{$2}');
    latex = latex.replace(/([a-zA-Z0-9])\^(\d+)(?![{])/g, '$1^{$2}');
    // Ensure all exponents are properly wrapped in curly braces
    latex = latex.replace(/\^([a-zA-Z0-9])(?![{])/g, '^{$1}');
    // Additional check to ensure all numeric exponents have curly braces
    latex = latex.replace(/\^(\d+)(?![{])/g, '^{$1}');
    // Final check for any remaining exponents without braces
    latex = latex.replace(/([a-zA-Z0-9])\^(\d+)(?![{])/g, '$1^{$2}');
    
    // Handle subscripts (_) - convert all forms to proper LaTeX
    latex = latex.replace(/([a-zA-Z])_(\d+|[a-zA-Z])/g, '$1_{$2}');
    latex = latex.replace(/([a-zA-Z])_([a-zA-Z0-9])/g, '$1_{$2}');
    
    // Convert operators to LaTeX format
    latex = latex.replace(/\*/g, '\\times ');
    latex = latex.replace(/\//g, '\\div ');
    
    // Handle common mathematical symbols
    latex = latex.replace(/\bpi\b/gi, '\\pi')
                 .replace(/\binfty\b/gi, '\\infty')
                 .replace(/\btheta\b/gi, '\\theta')
                 .replace(/\balpha\b/gi, '\\alpha')
                 .replace(/\bbeta\b/gi, '\\beta')
                 .replace(/\bdelta\b/gi, '\\delta')
                 .replace(/\bsigma\b/gi, '\\sigma')
                 .replace(/\bomega\b/gi, '\\omega');
    
    // Handle common mathematical functions
    latex = latex.replace(/\bsin\b/g, '\\sin')
                 .replace(/\bcos\b/g, '\\cos')
                 .replace(/\btan\b/g, '\\tan')
                 .replace(/\blog\b/g, '\\log')
                 .replace(/\bln\b/g, '\\ln')
                 .replace(/\blim\b/g, '\\lim');
    
    // Handle specific patterns for derivatives and equations
    if (/[a-z]'\(x\)\s*=/.test(expression)) {
      latex = latex.replace(/([a-z])'\(x\)\s*=\s*(.*)/g, '$1^{\\prime}(x) = $2');
    }
    
    // Handle equations with exponents
    if (/[a-z\d]\s*\^\s*\d+/.test(expression) && /=/.test(expression)) {
      latex = latex.replace(/([a-z\d])\s*\^\s*(\d+)/g, '$1^{$2}');
    }
    
    // Handle matrix notation [a b; c d]
    if (/\[.*\;.*\]/.test(latex)) {
      latex = latex.replace(/\[(.*?)\]/g, (match, content) => {
        if (content.includes(';')) {
          const rows = content.split(';').map(row => row.trim());
          const formattedRows = rows.map(row => row.split(/\s+/).join(' & '));
          return '\\begin{bmatrix} ' + formattedRows.join(' \\\\ ') + ' \\end{bmatrix}';
        }
        return match;
      });
    }
    
    // Convert fractions
    latex = latex.replace(/(\d+)\s*\/\s*(\d+)/g, '\\frac{$1}{$2}');
    
    // Convert trigonometric functions
    latex = latex.replace(/sin\(([^)]+)\)/g, '\\sin($1)')
                 .replace(/cos\(([^)]+)\)/g, '\\cos($1)')
                 .replace(/tan\(([^)]+)\)/g, '\\tan($1)');
    
    // Convert logarithmic functions
    latex = latex.replace(/log\(([^)]+)\)/g, '\\log($1)');
    
    // Replace ^ with LaTeX power notation - make this more robust
    latex = latex.replace(/([a-zA-Z0-9])\s*\^\s*(\d+)/g, '$1^{$2}')
                 .replace(/([a-zA-Z0-9])\s*\^\s*([a-zA-Z0-9])/g, '$1^{$2}')
                 .replace(/\^([a-zA-Z0-9])(?![{])/g, '^{$1}')
                 .replace(/\^(\d+)(?![{])/g, '^{$1}');
    
    // Format pi
    latex = latex.replace(/\bpi\b/gi, '\\pi ');
    
    // Handle the specific quotient rule formula pattern
    if (/f'\(x\)\s*=\s*\\frac\{.*\}\{.*\}/.test(expression)) {
      // It's already in LaTeX format, just return it
      return expression;
    }
    
    // Handle the alternative notation with square brackets
    if (/\[f'\(x\)\s*=\s*\\frac\{.*\}\{.*\}\s*\]/.test(expression)) {
      // Remove the square brackets and return
      return expression.replace(/^\[|\]$/g, '');
    }
    
    // Handle non-LaTeX fraction notation for quotient rule 
    if (/f'\(x\)\s*=\s*\(\d+x.*\)\(x.*\) - \(x\^2.*\)\(\d+\)/.test(expression)) {
      // Convert to proper LaTeX fraction
      const parts = expression.match(/f'\(x\)\s*=\s*(.+?) - (.+?)\/(.+)/);
      if (parts) {
        return `f^{\\prime}(x) = \\frac{${parts[1]} - ${parts[2]}}{${parts[3]}}`;
      }
    }
    
    // Handle algebraic expansion pattern [(2x + 3)(x - 1) - (x^2 + 3x - 5)(1)]
    if (/\[\s*\(\d+x.*\)\(x.*\)\s*-\s*\(x\^2.*\)\(\d+\)\s*\]/.test(expression)) {
      // Already in a good format for LaTeX, just replace square brackets
      return expression.replace(/^\[|\]$/g, '');
    }
    
    // Handle intermediate steps of expansion (e.g., [2x^2 - 2x + 3x - 3])
    if (/\[\s*\d+x\^\d+\s*[\+\-]\s*\d+x\s*[\+\-]/.test(expression)) {
      // Already in a good format for LaTeX, just replace square brackets
      let formula = expression.replace(/^\[|\]$/g, '');
      // Format the exponents properly
      formula = formula.replace(/(\d+)x\^(\d+)/g, '$1x^{$2}');
      return formula;
    }
    
    // Handle final simplification step [= x^2 - 2x + 2]
    if (/\[\s*=\s*[a-z]\^\d+\s*[\+\-]/.test(expression)) {
      // Already in a good format for LaTeX, just replace square brackets
      let formula = expression.replace(/^\[|\]$/g, '');
      // Format the exponents properly
      formula = formula.replace(/([a-z])\^(\d+)/g, '$1^{$2}');
      return formula;
    }
    
    return latex;
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
  
  // Simplify the handleScroll function to just handle the scroll button visibility
  const handleScroll = (event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const contentSizeHeight = event.nativeEvent.contentSize.height;
    const layoutHeight = event.nativeEvent.layoutMeasurement.height;
    
    // Show the scroll button if not near the bottom
    setShowScrollToBottom(offsetY < contentSizeHeight - layoutHeight - 20);
  };
  
  // Add an effect to handle scrolling when messages change
  useEffect(() => {
    if (messages.length > 0) {
      // Only auto-scroll if the last message is a new one
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.id !== lastScrolledMessageId.current) {
        lastScrolledMessageId.current = lastMsg.id;
        setTimeout(() => scrollToBottom(), 100);
      }
    }
  }, [messages]);

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
                scrollEventThrottle={400}
                onContentSizeChange={() => {
                  if (flatListRef.current) {
                    flatListRef.current.scrollToEnd({ animated: true });
                  }
                }}
                onLayout={() => {
                  if (flatListRef.current && messages.length > 0) {
                    flatListRef.current.scrollToEnd({ animated: false });
                  }
                }}
                maintainVisibleContentPosition={{
                  minIndexForVisible: 0,
                  autoscrollToTopThreshold: 10
                }}
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
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 10,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignSelf: 'flex-start',
    width: '100%', 
    maxWidth: '100%',
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
    fontSize: 18,
    lineHeight: 24,
  },
  mathContainer: {
    marginVertical: 8,
    padding: 10,
    backgroundColor: 'rgba(240, 240, 240, 0.3)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    overflow: 'hidden',
  },
  inlineMathContainer: {
    marginHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  displayMathContainer: {
    marginVertical: 12,
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: 'rgba(240, 240, 240, 0.3)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    width: '100%',
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
