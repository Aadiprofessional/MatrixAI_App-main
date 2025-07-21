import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  Modal,
  Dimensions,
  Linking,
  KeyboardAvoidingView,
  ScrollView,
  Share,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Animated,
} from 'react-native';
import LottieView from 'lottie-react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import * as Animatable from 'react-native-animatable';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import DocumentPicker from 'react-native-document-picker';
import { PDFDocument } from 'react-native-pdf-lib';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';
import { GestureHandlerRootView, Swipeable} from 'react-native-gesture-handler';
import ForceDirectedGraph2 from '../components/mindMap2';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AntDesign from 'react-native-vector-icons/AntDesign';
import RNFS from 'react-native-fs';
import { Buffer } from 'buffer';
import { supabase } from '../supabaseClient';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import Clipboard from '@react-native-clipboard/clipboard';
import Markdown from 'react-native-markdown-display';
import MathView from 'react-native-math-view';
import { useCoinsSubscription } from '../hooks/useCoinsSubscription';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

// Function to decode base64 to ArrayBuffer
const decode = (base64) => {
  const bytes = Buffer.from(base64, 'base64');
  return bytes;
};

// Add a module-scope variable to persist summary call status across mounts
const summaryCalledForAudioId = {};

const BotScreen2 = ({ navigation, route }) => {
  const { t } = useLanguage();
  const flatListRef = React.useRef(null);
  const { transcription, XMLData, uid, audioid } = route.params || {};
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false); // Track if data is loaded
  const [isInitialLoading, setIsInitialLoading] = useState(true); // New state for initial loading
  const [showSummaryPrompt, setShowSummaryPrompt] = useState(true); // New state for summary prompt
  const isMounted = useRef(true);
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();  
  // Initialize messages state with an empty array instead of default message
  const [messages, setMessages] = useState([]);

  // New state variables for image preview modal
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageType, setImageType] = useState('');
  const [imageFileName, setImageFileName] = useState('');
  const [fullScreenImage, setFullScreenImage] = useState(null);

  useEffect(() => {
    return () => {
      isMounted.current = false;
      // Cleanup timeout ref to prevent memory leaks
      if (sendTimeoutRef.current) {
        clearTimeout(sendTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const checkSummaryPreference = async () => {
      if (!isMounted.current || !dataLoaded) return;

      if (!audioid || summaryCalledForAudioId[audioid]) {
        return;
      }

      try {
        const response = await axios.post('https://main-matrixai-server-lujmidrakh.cn-hangzhou.fcapp.run/getSummaryPreference', {
          uid,
          audioid,
        });
        const preference = response.data.preference;

        // Check if chat history is empty
        const chatHistoryIsEmpty = messages.length === 1 && 
          (messages[0]?.text === "Hello.👋 I'm your new friend, MatrixAI Bot. You can ask me any questions.");

        // If chat is empty and we have transcription, show the prompt
        if (chatHistoryIsEmpty && transcription) {
          setShowSummaryPrompt(true);
        }
      } catch (error) {
        console.error('Error fetching summary preference:', error);
      }
    };

    if (transcription && audioid) {
      checkSummaryPreference();
    }
  }, [transcription, dataLoaded, audioid, messages.length]);

  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isApiLoading, setIsApiLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isImageProcessing, setIsImageProcessing] = useState(false);
  const [expandedMessages, setExpandedMessages] = useState({});
  const [fullTranscription, setFullTranscription] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showAdditionalButtons, setShowAdditionalButtons] = useState(false); // New state for additional buttons
  const [isSendDisabled, setIsSendDisabled] = useState(false); // New state to track send button disabled state
  const swipeableRefs = useRef({});
  const lastScrolledMessageId = useRef(null);

  // Add debounce ref to prevent rapid successive calls
  const sendTimeoutRef = useRef(null);

  const toggleMessageExpansion = (messageId) => {
    // Prevent scrolling to the end of the list when expanding a message
    setExpandedMessages(prev => ({
      ...prev,
      [messageId]: !prev[messageId]
    }));
  };

  const handleAttach = () => {
    setShowAdditionalButtons(prev => !prev); // Toggle additional buttons visibility
    // Change the icon from plus to cross
  };

  // Format message history for API
  const messageHistory = messages.map(msg => ({
    role: msg.sender === 'bot' ? 'assistant' : 'user',
    content: msg.text
  }));

  const handleCamera = (navigation) => {
    navigation.navigate('CameraScreen');
  };

  const saveChatHistory = async (messageText, sender, coinsDeducted = 0) => {
    try {
      const response = await axios.post('https://main-matrixai-server-lujmidrakh.cn-hangzhou.fcapp.run/sendChat', {
        uid,
        chatid: audioid, // Using audioid as chatid
        updatedMessage: messageText,
        sender,
        coinsDeducted,
      });
      console.log('Message saved:', response.data);
    } catch (error) {
      console.error('Error saving chat history:', error);
    }
  };

  const handleSendMessage = async () => {
    // Enhanced protection against double-sends
    if ((inputText.trim() || selectedImage) && !isSendDisabled && !isLoading) {
      // Clear any existing timeout
      if (sendTimeoutRef.current) {
        clearTimeout(sendTimeoutRef.current);
      }
      
      // Disable the send button immediately
      setIsSendDisabled(true);
      
      try {
        setIsLoading(true);
       
        // If there's an image, process it
        if (selectedImage) {
          try {
            setIsImageProcessing(true);
           
            console.log('Compressing image for faster processing...');
            
            // Generate a unique image ID
            const imageID = Date.now().toString(36) + Math.random().toString(36).substring(2, 15);
            const fileExtension = imageFileName ? imageFileName.split('.').pop() : 'jpg';
            
            // Read the file as base64
            const fileContent = await RNFS.readFile(selectedImage, 'base64');
            
            // Create file path for Supabase storage
            const filePath = `users/${uid}/Image/${imageID}.${fileExtension}`;
            
            // Upload to Supabase storage
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('user-uploads')
              .upload(filePath, decode(fileContent), {
                contentType: imageType || 'image/jpeg',
                upsert: false
              });
              
            if (uploadError) {
              throw new Error(`Upload error: ${uploadError.message}`);
            }
            
            // Get the public URL for the uploaded image
            const { data: { publicUrl } } = supabase.storage
              .from('user-uploads')
              .getPublicUrl(filePath);
            
            // Add the image to messages
            const newMessage = {
              id: Date.now().toString(),
              image: publicUrl,
              text: inputText.trim() ? inputText : "",
              sender: 'user'
            };
            
            setMessages((prev) => [...prev, newMessage]);
            
            // Save the chat history for the image
            await saveChatHistory(publicUrl, 'user');
            
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

            // Use the question from input or default
            const question = inputText.trim() || "What do you see in this image? Please analyze and describe it in detail.";
            
            // Get streaming response with image
            const fullResponse = await sendMessageToAI(question, publicUrl, handleChunk);
            
            // Finalize the streaming message
            setMessages(prev => prev.map(msg => 
              msg.id === streamingMessageId 
                ? { ...msg, text: fullResponse, isStreaming: false, coinsDeducted: 1 }
                : msg
            ));
            
            // Save the chat history for the bot response
            await saveChatHistory(fullResponse, 'bot', 1);
            
            // Clear the image and text
            setSelectedImage(null);
            setInputText('');
            
          } catch (error) {
            console.error('Error processing image:', error);
            Alert.alert('Error', 'Failed to process image');
            
            setMessages((prev) => [
              ...prev,
              { id: Date.now().toString(), text: 'Error processing image. Please try again.', sender: 'bot' },
            ]);
          } finally {
            setIsLoading(false);
            setIsImageProcessing(false);
            // Re-enable the send button with a minimum delay to prevent rapid successive sends
            sendTimeoutRef.current = setTimeout(() => {
              setIsSendDisabled(false);
            }, 1500); // Increased delay to 1.5 seconds
          }
        } else {
          // Regular text message handling
          const newMessage = {
            id: Date.now().toString(),
            text: inputText,
            sender: 'user',
          };
          setMessages((prev) => [...prev, newMessage]);
          saveChatHistory(inputText, 'user');
          fetchDeepSeekResponse(inputText);
          setInputText('');
          
          // Ensure scroll to bottom after sending a message
          setTimeout(() => {
            if (flatListRef.current) {
              flatListRef.current.scrollToEnd({ animated: true });
            }
          }, 100);
          
          // Re-enable the send button with a minimum delay to prevent rapid successive sends
          sendTimeoutRef.current = setTimeout(() => {
            setIsSendDisabled(false);
          }, 1500); // Increased delay to 1.5 seconds
        }
      } catch (error) {
        console.error("Error sending message:", error);
        Alert.alert("Error", "Failed to send message. Please try again.");
        
        // Re-enable the send button with a minimum delay
        sendTimeoutRef.current = setTimeout(() => {
          setIsSendDisabled(false);
        }, 1500);
      }
    }
  };

  // New streaming API function compatible with React Native
  const sendMessageToAI = async (message, imageUrl = null, onChunk = null) => {
    return new Promise((resolve, reject) => {
      try {
        // Prepare messages array
        const messages = [
          {
            role: "system",
            content: [
              {
                type: "text", 
                text: "You are an AI tutor assistant helping students with their homework and studies. Provide helpful, educational responses with clear explanations and examples that students can easily understand. Use proper markdown formatting for better readability."
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

  const handleAddImage = () => {
    launchImageLibrary({ noData: true }, (response) => {
      if (response.assets) {
        const { uri } = response.assets[0];
        setMessages((prev) => [
          ...prev,
          { 
            id: Date.now().toString(), 
            image: uri,
            sender: 'user' 
          },
        ]);
      }
    });
  };

  const handleImageOCR = async (source = 'gallery') => {
    const options = {
      mediaType: 'photo',
      quality: 1,
      includeBase64: false,
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

  const handleDocumentSelection = async () => {
    try {
      // Hide additional buttons after selection
      setShowAdditionalButtons(false);
      
      // Pick a document (PDF, DOC, DOCX)
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.pdf, DocumentPicker.types.doc, DocumentPicker.types.docx],
      });
      
      // Show loading indicator
      setIsLoading(true);
      
      // Get the selected file
      const selectedFile = result[0];
      const { uri, type, name } = selectedFile;
      
      // Check if it's a PDF file
      if (type === 'application/pdf') {
        await processPdfDocument(uri, name);
      } else {
        // For DOC/DOCX files, alert the user to convert to PDF first
        Alert.alert(
          'Document Format',
          'DOC/DOCX files need to be converted to PDF first. Please convert and try again.',
          [{ text: 'OK' }]
        );
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error selecting document:', error);
      if (DocumentPicker.isCancel(error)) {
        // User cancelled the picker
        console.log('User cancelled document picker');
      } else {
        Alert.alert('Error', 'Failed to select document');
      }
      setIsLoading(false);
    }
  };
  
  const processPdfDocument = async (fileUri, fileName) => {
    try {
      // Create a temporary directory for processing
      const tempDir = `${RNFS.DocumentDirectoryPath}/temp_pdf_${Date.now()}`;
      await RNFS.mkdir(tempDir);
      
      // Add a user message indicating document processing
      const userMessageId = Date.now().toString();
      const userMessage = {
        id: userMessageId,
        text: `Document: ${fileName}`,
        sender: 'user',
      };
      
      setMessages(prev => [...prev, userMessage]);
      await saveChatHistory(userMessage.text, 'user');
      
      // Process the document and send to AI
      await sendDocumentToAI(fileUri, fileName);
      
      // Clean up temporary files
      await RNFS.unlink(tempDir).catch(err => console.error('Error cleaning up temp dir:', err));
      
    } catch (error) {
      console.error('Error processing PDF document:', error);
      Alert.alert('Error', 'Failed to process PDF document');
      setIsLoading(false);
    }
  };
  
  const sendDocumentToAI = async (fileUri, fileName) => {
    try {
      // Create a streaming message from the bot
      const streamingMessageId = Date.now().toString();
      const streamingMessage = {
        id: streamingMessageId,
        text: 'Processing document...',
        sender: 'bot',
      };
      
      setMessages(prev => [...prev, streamingMessage]);
      
      // Read the file data
      const fileData = await RNFS.readFile(fileUri, 'base64');
      
      // Initialize streaming content
      let streamingContent = '';
      
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
      
      // Send the document content to the AI API
      const aiResponse = await sendMessageToAI(`I'm sending you a document named ${fileName}. Please analyze its content.`, null, handleChunk);
      
      // Save the chat history
      await saveChatHistory(aiResponse, 'bot');
      
      // Set loading to false
      setIsLoading(false);
      
    } catch (error) {
      console.error('Error sending document to AI:', error);
      Alert.alert('Error', 'Failed to process document with AI');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const fetchChatHistory = async () => {
      try {
        setIsInitialLoading(true);
        const response = await axios.post('https://main-matrixai-server-lujmidrakh.cn-hangzhou.fcapp.run/getChat', {
          uid,
          chatid: audioid, // Using audioid as chatid
        });

        const fetchedMessages = response.data.messages || [];
        const hasChatHistory = fetchedMessages.length > 0;

        if (hasChatHistory) {
          // If we have chat history, update messages with fetched messages
          setMessages(fetchedMessages.map(msg => ({
            ...msg,
            image: msg.imageUrl || msg.image,
            text: msg.text.replace(/(\*\*|\#\#)/g, ""),
          })));
        } else {
          // If no chat history, create and save the initial greeting message
          const initialMessage = {
            id: '1',
            text: "Hello.👋 I'm your new friend, MatrixAI Bot. You can ask me any questions.",
            sender: 'bot',
          };
          
          // Set the initial message in state
          setMessages([initialMessage]);
          
          // Save initial message to database
          await saveChatHistory(initialMessage.text, initialMessage.sender);
        }

        setDataLoaded(true);
      } catch (error) {
        console.error('Error fetching chat history:', error);
        // Handle 404 or other errors by setting the initial greeting message
        const initialMessage = {
          id: '1',
          text: "Hello.👋 I'm your new friend, MatrixAI Bot. You can ask me any questions.",
          sender: 'bot',
        };
        setMessages([initialMessage]);
        setDataLoaded(true);
      } finally {
        setIsInitialLoading(false);
      }
    };

    fetchChatHistory();
  }, [audioid]);
  
  const handleGeneratePPT = (message) => {
    navigation.navigate('CreatePPTScreen', {
      message: message.text,
      audioid,
      number: 1,
    });
  };

  const handleGenerateMindmap = (message) => {
    setSelectedMessage(message);
    setIsFullScreen(true);
  };

  // Function to detect if the text is a mathematical expression
  const isMathExpression = (text) => {
    // Skip if text is too long (likely not a math expression)
    if (text.length > 100) return false;
    
    // Skip if it's just a simple number
    if (/^\d+$/.test(text)) return false;
    
    // Skip if it's a date
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(text) || /^\d{1,2}\-\d{1,2}\-\d{2,4}$/.test(text)) return false;
    
    // Skip if it's likely a list item with a number (e.g., "1. Item")
    if (/^\d+\.\s+.+/.test(text) && !text.includes('=')) return false;
    
    // Skip if it's likely a normal sentence with numbers
    if (text.split(' ').length > 8 && !/[\=\+\-\*\/\^\(\)]/.test(text)) return false;
    
    // Check for Pythagorean theorem pattern (3^2 + 4^2 = c^2)
    if (/\d+\s*\^\s*\d+\s*[\+\-]\s*\d+\s*\^\s*\d+\s*=/.test(text)) {
      return true;
    }
    
    // Check for equation patterns (must have equals sign)
    const hasEquation = /\=/.test(text);
    
    // Check for mathematical operators
    const hasOperators = /[\+\-\*\/\(\)\[\]\{\}\^×÷]/.test(text);
    
    // Check for number patterns with operators (this is the strongest indicator)
    const hasNumberWithOperator = /\d+\s*[\+\-\*\/\=\(\)\[\]\{\}\^×÷]\s*\d+/.test(text);
    
    // Check for common math expressions at the start of the text
    const isCommonMathExpression = /^(solve|calculate|find|evaluate|simplify|compute)/.test(text.toLowerCase());
    
    // Check for fractions
    const hasFraction = /\d+\s*\/\s*\d+/.test(text) && !/https?:\/\//.test(text); // Exclude URLs
    
    // Check for square roots or exponents or other math functions
    const hasAdvancedMath = /sqrt|square root|\^|x\^2|x\^3|sin\(|cos\(|tan\(|log\(|π|pi/.test(text.toLowerCase());
    
    // Check for multiple numbers and operators (likely a calculation)
    const hasMultipleOperations = /\d+\s*[\+\-\*\/]\s*\d+\s*[\+\-\*\/]\s*\d+/.test(text);
    
    // Check for specific equation patterns
    const isEquation = /^\s*\d+\s*[\+\-\*\/]\s*\d+\s*\=/.test(text) || // 2 + 2 =
                       /^\s*\d+\s*[\+\-\*\/\=]\s*\d+/.test(text) && text.length < 20; // Short expressions like 2+2
    
    // Check for common school math formulas
    const hasCommonFormula = /(area|perimeter|volume|circumference|radius|diameter)\s*[\=:]/.test(text.toLowerCase()) ||
                             /(a\^2\s*\+\s*b\^2\s*=\s*c\^2)|(E\s*=\s*mc\^2)|(F\s*=\s*ma)/.test(text);
    
    // Check for equations with variables
    const hasVariables = /[a-z]\s*[\+\-\*\/\=]\s*\d+/.test(text.toLowerCase()) || 
                         /\d+\s*[\+\-\*\/\=]\s*[a-z]/.test(text.toLowerCase()) ||
                         /[a-z]\s*[\+\-\*\/\=]\s*[a-z]/.test(text.toLowerCase());
    
    // Return true if it looks like a math expression
    return (isEquation ||
            hasNumberWithOperator || 
            (hasEquation && hasOperators) || 
            (isCommonMathExpression && (hasOperators || hasEquation)) ||
            hasFraction || 
            hasAdvancedMath ||
            hasMultipleOperations ||
            hasCommonFormula ||
            hasVariables);
  };

  // Function to detect if the text has math subscripts
  const hasMathSubscripts = (text) => {
    return /([a-zA-Z])_(\d)|([a-zA-Z])_n|([a-zA-Z])_i|([a-zA-Z])_j|([a-zA-Z])_k|([a-zA-Z])_a|([a-zA-Z])_x|([a-zA-Z])_\{([^}]+)\}/.test(text);
  };

  // Function to detect ChatGPT style section titles and parse them properly
  const detectAndFormatTitles = (text) => {
    if (!text) return text;
    
    // Look for patterns like "## Title" at the beginning of a message or line
    const lines = text.split('\n');
    let formattedText = '';
    let inSection = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check for markdown headings (## Title)
      if (/^##\s+(.+)/.test(line)) {
        const title = line.replace(/^##\s+/, '');
        formattedText += `\n\n<strong class="title">${title}</strong>\n\n`;
        inSection = true;
      } 
      // Check for title with colon at end (Title:)
      else if (/^([A-Z][^:.!?]*):$/.test(line)) {
        const title = line.replace(/:$/, '');
        formattedText += `\n\n<strong class="title">${title}</strong>\n\n`;
        inSection = true;
      }
      // Regular text
      else {
        formattedText += line + '\n';
      }
    }
    
    return formattedText.trim();
  };

  // Function to process and format the message text
  const formatMessageText = (text, sender) => {
    if (!text) return [];
    
    const isBot = sender === 'bot';
    const isChineseContent = /[\u3400-\u9FBF]/.test(text);
    
    // Apply the title detection and formatting for bot messages
    if (isBot) {
      text = detectAndFormatTitles(text);
    }
    
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
        
        // For section titles that look like natural language questions or statements
        // Detect patterns like "What is X?" or "How to X" at the beginning of paragraphs
        text = text.replace(/^(What is|How to|Why|When|Where|Who|How can|How do|Is there)([^?:.!]*[?:.!])/gim, '## $1$2');
        
        // Convert lines that end with colon and look like headings to markdown headings
        text = text.replace(/^([A-Z][^.!?:]*):$/gm, '## $1');
        
        // For Chinese content, process headings and subheadings differently
        if (isChineseContent) {
          // Find Chinese headings (typically marked with ### or 标题：)
          text = text.replace(/^(#+\s+.+)|^([\u4e00-\u9fa5]+[：:])$/gm, '## $1$2');
          
          // Process numbered lists in Chinese
          text = text.replace(/^(\d+)[、.．][\s](.+)/gm, '$1. $2');
          
          // Process bullet points in Chinese
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
                .map(cell => cell.trim())
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

  const renderMessage = ({ item }) => {
    const isBot = item.sender === 'bot';
    const isUser = item.sender === 'user';
    // Invert the logic: messages are expanded by default, expandedMessages tracks collapsed ones
    const isCollapsed = expandedMessages[item.id];
    const shouldTruncate = item.text && item.text.length > 100;
  
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

    // Function to detect if text has math subscripts
    const hasMathSubscripts = (text) => {
      return /([a-zA-Z])_(\d)|([a-zA-Z])_n|([a-zA-Z])_i|([a-zA-Z])_j|([a-zA-Z])_k|([a-zA-Z])_a|([a-zA-Z])_x|([a-zA-Z])_\{([^}]+)\}/.test(text);
    };

    // Function to render text with math expressions
    const renderTextWithMath = (line, index) => {
      const isBot = line.sender === 'bot';
      
      // Check for LaTeX-style formulas
      if (line.text.startsWith('\\[') || line.text.startsWith('\\(')) {
        return renderLatexFormula(line.text, index, line.sender);
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
          
          // Add the formula
          parts.push({
            type: 'inline-math',
            content: match[1]
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
                    style={[isBot ? styles.botText : styles.userText, isBot && { color: colors.botText }]}
                  >
                    {part.content}
                  </Text>
                );
              } else if (part.type === 'inline-math') {
                return (
                  <View key={`inline-math-${index}-${partIndex}`} style={styles.inlineMathContainer}>
                    <MathView
                      math={part.content}
                      style={[styles.mathView, { color: colors.botText }]}
                      resizeMode="cover"
                    />
                  </View>
                );
              } else if (part.type === 'display-math') {
                return (
                  <View key={`display-math-${index}-${partIndex}`} style={styles.displayMathContainer}>
                    <MathView
                      math={part.content}
                      style={[styles.mathView, { color: colors.botText }]}
                      resizeMode="cover"
                    />
                  </View>
                );
              }
              return null;
            })}
          </View>
        );
      }
      
      // Add support for subscript notation
      if (hasMathSubscripts(line.text)) {
        // Process subscripts and use MathView for rendering
        const mathText = line.text
          .replace(/([a-zA-Z])_(\d)/g, '$1_{$2}')
          .replace(/([a-zA-Z])_n/g, '$1_{n}')
          .replace(/([a-zA-Z])_i/g, '$1_{i}')
          .replace(/([a-zA-Z])_j/g, '$1_{j}')
          .replace(/([a-zA-Z])_k/g, '$1_{k}')
          .replace(/([a-zA-Z])_a/g, '$1_{a}')
          .replace(/([a-zA-Z])_x/g, '$1_{x}')
          .replace(/([a-zA-Z])_\{([^}]+)\}/g, '$1_{$2}');
        
        return (
          <View key={`math-line-${index}`} style={styles.mathContainer}>
            <MathView
              math={mathText}
              style={[styles.mathView, { color: colors.botText }]}
              resizeMode="cover"
            />
          </View>
        );
      }
      
      // Check for specific patterns like Pythagorean theorem (a^2 + b^2 = c^2)
      if (/[a-z]\^2\s*[\+\-]\s*[a-z]\^2\s*=\s*[a-z]\^2/.test(line.text) ||
          /\d+\^2\s*[\+\-]\s*\d+\^2\s*=\s*[a-z]\^2/.test(line.text) ||
          /\d+\s*\^\s*2\s*\+\s*\d+\s*\^\s*2\s*=\s*[a-z]\s*\^\s*2/.test(line.text) ||
          /\d+\s*\+\s*\d+\s*=\s*[a-z]\^2/.test(line.text) ||
          /[a-z]\^2\s*[\+\-]\s*[a-z]\^2\s*=/.test(line.text)) {
        // Format it as LaTeX
        let latexFormula = line.text
          .replace(/([a-z])\s*\^\s*(\d+)/g, '$1^{$2}')
          .replace(/(\d+)\s*\^\s*(\d+)/g, '$1^{$2}')
          .replace(/sqrt\(([^)]+)\)/g, '\\sqrt{$1}')
          .replace(/√\s*([a-z0-9]+)/g, '\\sqrt{$1}');
        
        return (
          <View key={`pythagorean-${index}`} style={styles.mathContainer}>
            <MathView
              math={latexFormula}
              style={[styles.mathView, { color: colors.botText }]}
              resizeMode="cover"
            />
          </View>
        );
      }

      // Special case for c = sqrt{25} = 5 pattern
      if (/[a-z]\s*=\s*\\?sqrt\{?\d+\}?\s*=\s*\d+/.test(line.text) || 
          /[a-z]\s*=\s*\\?sqrt\{?\d+\}?/.test(line.text)) {
        let latexFormula = line.text
          .replace(/sqrt\{?(\d+)\}?/g, '\\sqrt{$1}');
        
        return (
          <View key={`sqrt-result-${index}`} style={styles.mathContainer}>
            <MathView
              math={latexFormula}
              style={[styles.mathView, { color: colors.botText }]}
              resizeMode="cover"
            />
          </View>
        );
      }
      
      // Use regex to find math expressions in the text
      const mathRegex = /(\d+\s*[\+\-\*\/\=\(\)\[\]\{\}\^×÷]\s*\d+)|(\b\d+\s*[×÷=]\s*\d+\b)|(sqrt\([^)]+\))|(sin\([^)]+\))|(cos\([^)]+\))|(tan\([^)]+\))|(log\([^)]+\))/g;
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
                <MathView
                  math={latexExpression}
                  style={[styles.mathView, { color: colors.botText }]}
                  resizeMode="cover"
                />
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
      
      // If line is a Chinese heading
      if (line.isChineseHeading) {
        return (
          <View key={`chinese-heading-${index}`} style={styles.chineseHeadingContainer}>
            <Text style={[styles.chineseHeadingText, {
              color: isBot ? colors.botText : '#333333',
              fontWeight: 'bold'
            }]}>
              {line.text.replace(/^##+\s+|\d+\.\s+/, '')}
            </Text>
          </View>
        );
      }
      
      // If line is a Chinese subheading
      if (line.isChineseSubheading) {
        return (
          <View key={`chinese-subheading-${index}`} style={styles.chineseSubheadingContainer}>
            <Text style={[styles.chineseSubheadingPointer, {color: '#2274F0'}]}>•</Text>
            <Text style={[styles.chineseSubheadingText, {
              color: isBot ? colors.botText : '#333333',
              fontWeight: 'bold'
            }]}>
              {line.text.replace(/^[•·◦◆■◉○●][\s]+|^\d+[、.．][\s]+|^[一二三四五六七八九十]、/, '')}
            </Text>
          </View>
        );
      }
      
      // If no math expressions found, return regular text
      return (
        <Text key={`text-${index}`} style={[
          isBot ? styles.botText : styles.userText,
          isBot && { color: colors.botText }
        ]}>
          {line.text}
        </Text>
      );
    };

    // Function to convert regular math expressions to LaTeX format
    const formatMathToLatex = (expression) => {
      let latex = expression;
      
      // Handle simple arithmetic expressions with equals sign (3^2 + 4^2 = c^2)
      if (/\d+\s*[\^]\s*\d+\s*[\+\-]\s*\d+\s*[\^]\s*\d+\s*=\s*[a-z]\s*[\^]\s*\d+/.test(expression)) {
        latex = latex
          .replace(/([a-z0-9])\s*\^(\s*\d+)/g, '$1^{$2}')
          .replace(/(\d+)\s*\^(\s*\d+)/g, '$1^{$2}');
        return latex;
      }
      
      // Handle result formulas (c^2 = 25 or c = sqrt{25} = 5)
      if (/[a-z]\s*\^2\s*=\s*\d+/.test(expression) || 
          /[a-z]\s*=\s*\\?sqrt\{?\d+\}?\s*=\s*\d+/.test(expression) ||
          /[a-z]\s*=\s*\\?sqrt\{?\d+\}?/.test(expression)) {
        latex = latex
          .replace(/([a-z])\s*\^(\s*\d+)/g, '$1^{$2}')
          .replace(/sqrt\{?(\d+)\}?/g, '\\sqrt{$1}');
        return latex;
      }
      
      // Handle simple arithmetic expressions (9 + 16 = 25)
      if (/\d+\s*[\+\-\*\/]\s*\d+\s*=\s*\d+/.test(expression)) {
        return latex;
      }
      
      // Convert regular math operations to LaTeX
      latex = latex.replace(/\*/g, '\\times ');
      latex = latex.replace(/\//g, '\\div ');
      latex = latex.replace(/sqrt\(([^)]+)\)/g, '\\sqrt{$1}');
      latex = latex.replace(/square root of (\d+)/gi, '\\sqrt{$1}');
      latex = latex.replace(/square root/gi, '\\sqrt{}');
      
      // Convert fractions
      latex = latex.replace(/(\d+)\s*\/\s*(\d+)/g, '\\frac{$1}{$2}');
      
      // Convert trigonometric functions
      latex = latex.replace(/sin\(([^)]+)\)/g, '\\sin($1)');
      latex = latex.replace(/cos\(([^)]+)\)/g, '\\cos($1)');
      latex = latex.replace(/tan\(([^)]+)\)/g, '\\tan($1)');
      
      // Convert logarithmic functions
      latex = latex.replace(/log\(([^)]+)\)/g, '\\log($1)');
      
      // Replace ^ with LaTeX power notation
      latex = latex.replace(/([a-zA-Z0-9])\s*\^(\s*\d+)/g, '$1^{$2}');
      latex = latex.replace(/([a-zA-Z0-9])\s*\^([a-zA-Z0-9])/g, '$1^{$2}');
      
      // Format pi
      latex = latex.replace(/\bpi\b/gi, '\\pi ');
      
      return latex;
    };
    
    // Render square root notation using MathView
    const renderSquareRoot = (formula, sender) => {
      // Extract the content inside the square root
      const rootMatch = formula.match(/√\(([^)]+)\)/);
      const rootContent = rootMatch ? rootMatch[1] : formula.replace(/√/g, '').trim();
      const isBot = sender === 'bot';
      
      return (
        <View style={styles.sqrtContainer}>
          <MathView
            math={`\\sqrt{${rootContent}}`}
            style={[styles.mathView, { color: colors.botText }]}
            resizeMode="cover"
          />
        </View>
      );
    };
    
    // Function to format math expressions to LaTeX format
    const formatMathExpression = (expression) => {
      // Convert to LaTeX format
      let latex = expression;
      
      // Replace * with × for multiplication
      latex = latex.replace(/\*/g, '\\times ');
      
      // Format fractions
      latex = latex.replace(/(\d+)\s*\/\s*(\d+)/g, '\\frac{$1}{$2}');
      
      // Format square roots
      latex = latex.replace(/sqrt\(([^)]+)\)/g, '\\sqrt{$1}');
      latex = latex.replace(/square root of (\d+)/gi, '\\sqrt{$1}');
      latex = latex.replace(/square root/gi, '\\sqrt{}');
      
      // Format pi
      latex = latex.replace(/\bpi\b/gi, '\\pi ');
      
      // Format trigonometric functions
      latex = latex.replace(/\b(sin|cos|tan)\(/g, '\\$1(');
      
      // Format logarithmic functions
      latex = latex.replace(/\blog\(/g, '\\log(');
      
      // Handle exponents
      latex = latex.replace(/\^2/g, '^{2}');
      latex = latex.replace(/\^3/g, '^{3}');
      latex = latex.replace(/\^(\d+)/g, '^{$1}');
      
      // Check if the expression has fractions
      const hasFraction = /\\frac\{.+\}\{.+\}/.test(latex);
      
      // Check if the expression has square roots
      const hasSquareRoot = /\\sqrt\{.+\}/.test(latex);
      
      return { formattedMath: latex, hasFraction, hasSquareRoot };
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
                        style={{ width: 200, height: 200, borderRadius: 10 }}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  ) : (
                    <View style={isBot ? styles.botTextContainer : styles.userTextContainer}>
                      {formatMessageText(item.text, item.sender).map((line, index) => {
                        if (line.isMarkdown) {
                          return (
                            <Markdown 
                              key={`markdown-${index}`}
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
                                  color: '#333333', // Keep tables with standard color
                                },
                                td: {
                                  padding: 8,
                                  borderRightWidth: 1,
                                  borderRightColor: '#E0E0E0',
                                  color: '#333333', // Keep tables with standard color
                                },
                                text: {
                                  color: colors.botText,
                                }
                              }}
                              // Adding custom renderers for better ordered lists
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
                                // Custom text renderer to ensure text color
                                text: (node, children, parent, styles) => {
                                  // Use dynamic color based on sender
                                  return (
                                    <Text key={node.key} style={[styles.text, {color: isBot ? colors.botText : '#333333'}]}>
                                      {node.content}
                                    </Text>
                                  );
                                }
                              }}
                            >
                              {isCollapsed && shouldTruncate ? line.text.substring(0, 100) + '...' : line.text}
                            </Markdown>
                          );
                        } else if (line.isTable) {
                          return !isCollapsed ? renderTable(line, index) : null;
                        } else if (line.isChineseHeading) {
                          return (
                            <View key={`chinese-heading-${index}`} style={styles.chineseHeadingContainer}>
                              <Text style={[styles.chineseHeadingText, {
                                color: isBot ? colors.botText : '#333333',
                                fontWeight: 'bold'
                              }]}>
                                {line.text.replace(/^##+\s+|\d+\.\s+/, '')}
                              </Text>
                            </View>
                          );
                        } else if (line.isChineseSubheading) {
                          return (
                            <View key={`chinese-subheading-${index}`} style={styles.chineseSubheadingContainer}>
                              <Text style={[styles.chineseSubheadingPointer, {color: '#2274F0'}]}>•</Text>
                              <Text style={[styles.chineseSubheadingText, {
                                color: isBot ? colors.botText : '#333333',
                                fontWeight: 'bold'
                              }]}>
                                {line.text.replace(/^[•·◦◆■◉○●][\s]+|^\d+[、.．][\s]+|^[一二三四五六七八九十]、/, '')}
                              </Text>
                            </View>
                          );
                        } else if (line.isChineseSubSubheading) {
                          return (
                            <View key={`chinese-subsubheading-${index}`} style={styles.chineseSubSubheadingContainer}>
                              <Text style={[styles.chineseSubSubheadingPointer, {color: '#2274F0'}]}>-</Text>
                              <Text style={[styles.chineseSubSubheadingText, {
                                color: colors.botText,
                                fontWeight: 'bold'
                              }]}>
                                {line.text.trim()}
                              </Text>
                            </View>
                          );
                        } else if (line.hasMathExpression) {
                          return !isCollapsed ? renderTextWithMath(line, index) : null;
                        } else {
                          return (
                            <Text key={`text-${index}`} style={[
                              isBot ? styles.botText : styles.userText,
                              isBot && { color: colors.botText }
                            ]}>
                              {isCollapsed && shouldTruncate ? line.text.substring(0, 100) + '...' : line.text}
                            </Text>
                          );
                        }
                      })}
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

  // Function to handle image tap and show fullscreen view
  const handleImageTap = (imageUri) => {
    console.log('Image tapped, displaying in fullscreen:', imageUri);
    setFullScreenImage(imageUri);
  };

  // Render a formula with proper fractions
  const renderFractionFormula = (parts, sender) => {
    const isBot = sender === 'bot';
    return (
      <View style={styles.formulaContainer}>
        {parts.map((part, i) => {
          if (part.type === 'text') {
            return (
              <Text key={`formula-part-${i}`} style={[styles.mathText, { color: isBot ? colors.botText : '#fff' }]}>
                {part.content}
              </Text>
            );
          } else if (part.type === 'fraction') {
            return (
              <View key={`fraction-${i}`} style={styles.fractionContainer}>
                <Text style={[styles.numerator, { color: isBot ? colors.botText : '#fff' }]}>{part.numerator}</Text>
                <View style={[styles.fractionLine, { backgroundColor: isBot ? colors.botText : '#fff' }]} />
                <Text style={[styles.denominator, { color: isBot ? colors.botText : '#fff' }]}>{part.denominator}</Text>
              </View>
            );
          }
          return null;
        })}
      </View>
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
    
    return parts.length > 0 ? parts : [{ type: 'text', content: formula }];
  };

  // Render LaTeX style formulas
  const renderLatexFormula = (formula, index, sender) => {
    const isBot = sender === 'bot';
    
    // Remove the LaTeX delimiters
    let cleanFormula = formula.replace(/\\\[|\\\]|\\\(|\\\)/g, '');
    
    // Handle subscripts like a_{n} before other replacements
    cleanFormula = cleanFormula.replace(/([a-zA-Z])_{([^}]+)}/g, '$1ₙ');
    cleanFormula = cleanFormula.replace(/([a-zA-Z])_(\d)/g, (match, p1, p2) => {
      const subscripts = {
        '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
        '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉'
      };
      return p1 + subscripts[p2];
    });
    
    // Replace LaTeX-style commands with proper math notation
    cleanFormula = cleanFormula
      .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2')
      .replace(/\\int/g, '∫')
      .replace(/\\sum/g, '∑')
      .replace(/\\prod/g, '∏')
      .replace(/\\infty/g, '∞')
      .replace(/\\rightarrow/g, '→')
      .replace(/\\leftarrow/g, '←')
      .replace(/\\Rightarrow/g, '⇒')
      .replace(/\\Leftarrow/g, '⇐')
      .replace(/\\alpha/g, 'α')
      .replace(/\\beta/g, 'β')
      .replace(/\\gamma/g, 'γ')
      .replace(/\\delta/g, 'δ')
      .replace(/\\epsilon/g, 'ε')
      .replace(/\\zeta/g, 'ζ')
      .replace(/\\eta/g, 'η')
      .replace(/\\theta/g, 'θ')
      .replace(/\\iota/g, 'ι')
      .replace(/\\kappa/g, 'κ')
      .replace(/\\lambda/g, 'λ')
      .replace(/\\mu/g, 'μ')
      .replace(/\\nu/g, 'ν')
      .replace(/\\xi/g, 'ξ')
      .replace(/\\pi/g, 'π')
      .replace(/\\rho/g, 'ρ')
      .replace(/\\sigma/g, 'σ')
      .replace(/\\tau/g, 'τ')
      .replace(/\\upsilon/g, 'υ')
      .replace(/\\phi/g, 'φ')
      .replace(/\\chi/g, 'χ')
      .replace(/\\psi/g, 'ψ')
      .replace(/\\omega/g, 'ω')
      .replace(/\\_\{([^}]+)\}/g, '_$1')
      .replace(/\\in/g, '∈')
      .replace(/\\subset/g, '⊂')
      .replace(/\\supset/g, '⊃')
      .replace(/\\cup/g, '∪')
      .replace(/\\cap/g, '∩')
      .replace(/\\cdot/g, '·')
      .replace(/\\times/g, '×')
      .replace(/\\div/g, '÷')
      .replace(/\\equiv/g, '≡')
      .replace(/\\approx/g, '≈')
      .replace(/\\neq/g, '≠')
      .replace(/\\leq/g, '≤')
      .replace(/\\geq/g, '≥')
      .replace(/\\partial/g, '∂')
      .replace(/\\nabla/g, '∇')
      .replace(/\\forall/g, '∀')
      .replace(/\\exists/g, '∃');
    
    // Check if we need to handle fractions or square roots
    const hasFraction = /\d+\s*\/\s*\d+/.test(cleanFormula);
    const hasSquareRoot = /√\(([^)]+)\)/.test(cleanFormula) || /√\d+/.test(cleanFormula);
    
    if (hasFraction) {
      const fractionParts = parseFractionFormula(cleanFormula);
      return (
        <View key={`latex-formula-${index}`} style={styles.complexMathContainer}>
          {renderFractionFormula(fractionParts, sender)}
        </View>
      );
    } else if (hasSquareRoot) {
      return (
        <View key={`latex-formula-${index}`} style={styles.complexMathContainer}>
          {renderSquareRoot(cleanFormula, sender)}
        </View>
      );
    } else {
      return (
        <View key={`latex-formula-${index}`} style={styles.complexMathContainer}>
          <Text style={styles.complexMathText}>{cleanFormula}</Text>
        </View>
      );
    }
  };

  useEffect(() => {
    // This will ensure the FlatList scrolls to the end when a new message is added
    if (messages.length > 0 && flatListRef.current) {
      setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: true });
        }
      }, 100);
      
      // Re-enable the send button after a short delay to prevent double-sends
      setTimeout(() => {
        setIsSendDisabled(false);
      }, 1000);
    }
  }, [messages.length]);

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
      {/* Header */}  
      <View style={[styles.header, {backgroundColor: colors.background2 , borderColor: colors.border}]}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back-ios-new" size={24} color="white" />
                               </TouchableOpacity>
        <Image source={require('../assets/Avatar/Cat.png')} style={styles.botIcon} />
        <View style={styles.headerTextContainer}>
          <Text style={[styles.botName, {color: colors.text}]}>MatrixAI Bot</Text>
          <Text style={[styles.botDescription, {color: colors.text}]  }>Your virtual assistant</Text>
        </View>
      </View>

      {/* Loading State */}
      {isInitialLoading ? (
        <View style={styles.loadingFullScreenContainer}>
          <LottieView
            source={require('../assets/loading.json')}
            autoPlay
            loop
            style={styles.loadingFullScreenAnimation}
          />
        </View>
      ) : (
        // Chat List or No Messages View
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 90}
        >
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={[styles.chat,]}
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
            ref={flatListRef}
            style={{ marginBottom: showAdditionalButtons ? 220 : 120 }}
            ListEmptyComponent={
              !isInitialLoading && (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No messages yet. Start a conversation!</Text>
                </View>
              )
            }
          />
        </KeyboardAvoidingView>
      )}
        <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 60}
      >
      {/* Loading Animation */}
      {isLoading && (
        <View style={[styles.loadingContainer, { 
          bottom: showAdditionalButtons && selectedImage ? 30 : 
                 showAdditionalButtons ? 60 : 
                 selectedImage ? 30 : 
                 -40 
        }]}>
          <LottieView
            source={require('../assets/dot.json')}
            autoPlay
            loop
            style={styles.loadingAnimation}
          />
        </View>
      )}

      {selectedImage && (
        <View style={styles.imagePreviewContainer}>
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

      {/* Quick Action Buttons */}
    

      {/* Chat Input Box */}
      <View style={styles.chatBoxContainer}>
        <TextInput
          style={[styles.textInput, { textAlignVertical: 'top' }]}
          placeholder="Type a message..."
          placeholderTextColor="#ccc"
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleSendMessage}
          multiline={true}
          numberOfLines={3}
          maxLength={2000}
          scrollEnabled={true}
        />
        <TouchableOpacity onPress={handleAttach} style={styles.sendButton}>
          {showAdditionalButtons ? (
            <Ionicons name="close" size={28} color="#4C8EF7" />
          ) : (
            <Ionicons name="add" size={28} color="#4C8EF7" />
          )}
        </TouchableOpacity>
       
        <TouchableOpacity 
          onPress={handleSendMessage} 
          style={[styles.sendButton, isSendDisabled && styles.disabledButton]} 
          disabled={isSendDisabled}
        >
          <Ionicons name="send" size={24} color={isSendDisabled ? "#ccc" : "#4C8EF7"} />
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={[styles.quickActionContainer , {backgroundColor: colors.background2}]}>
        <TouchableOpacity 
          style={[styles.quickActionButton , {backgroundColor: colors.background2}]}
          onPress={() => transcription && fetchDeepSeekResponse(`Please provide a summary of this text in very structured format in the original language of the transcription : ${transcription}`+'make sure to only show the summary in the original language of the transcription')}
        >
          <Text style={styles.quickActionText}>Quick Summary</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.quickActionButton , {backgroundColor: colors.background2}]}
          onPress={() => transcription && fetchDeepSeekResponse(`Please extract and list the key points from this text in a structured format in the original language of the transcription: ${transcription}`+'make sure to only show the key points in the original language of the transcription')}
        >
          <Text style={styles.quickActionText}>Key Points</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.quickActionButton , {backgroundColor: colors.background2}]}
          onPress={() => transcription && fetchDeepSeekResponse(`Please analyze this text and provide potential solutions or recommendations for any problems or challenges mentioned and in the original language of the transcription: ${transcription}`+'make sure to only show the solutions or recommendations in the original language of the transcription')}
        >
          <Text style={styles.quickActionText}>Solution</Text>
        </TouchableOpacity>
      </View>
      </ScrollView>
      {showAdditionalButtons && (
             <View style={[styles.additionalButtonsContainer, {backgroundColor: colors.background2}]  }>
                <View style={styles.buttonRow}>
                    <TouchableOpacity style={styles.additionalButton2} onPress={() => handleImageOCR('camera')}>
                        <View style={styles.additionalButton}>
                            <Ionicons name="camera" size={28} color="#4C8EF7" />
                        </View>
                        <Text style={{color: colors.text}}>Photo</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.additionalButton2} onPress={() => handleImageOCR('gallery')}>
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
</KeyboardAvoidingView>

      <Modal
        visible={isFullScreen}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setIsFullScreen(false)}
      >
        <View style={[styles.fullScreenContainer, {backgroundColor: colors.background}]}>
          <View style={styles.fullScreenGraphContainer}>
            <ForceDirectedGraph2 message={selectedMessage?.text || ''} uid={uid} audioid={audioid}/>
          </View>
          <TouchableOpacity
            onPress={() => setIsFullScreen(false)}
            style={[styles.closeFullScreenButton, {
              width: 50,
              height: 50,
              borderRadius: 25,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 3.84,
              elevation: 5,
            }]}
          >
            <Ionicons name="close" size={30} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Full Screen Image Modal */}
      <Modal
        visible={fullScreenImage !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setFullScreenImage(null)}
      >
        <View style={[styles.fullScreenImageContainer]}>
          {fullScreenImage ? (
            <Image
              source={{ uri: fullScreenImage }}
              style={[styles.fullScreenImage, {backgroundColor: colors.background2}]}
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E0E0E0',
  },

  chatBoxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf:'center',
    width: '95%',
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#007bff',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    marginHorizontal: '5%',

  },
  messageImage: {
    width: 200,  // Adjust width based on your UI design
    height: 200, // Adjust height as needed
    borderRadius: 10,
    marginVertical: 10,
  },
 
  headerIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  textInput: {
    flex: 1,
    maxHeight: 80, // Limit height for roughly 3 lines
    minHeight: 40,
    padding: 10,
    fontSize: 16,
  },
  sendButton: {
    padding: 5,
  },
  disabledButton: {
    opacity: 0.5,
  },
  sendIcon: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
    tintColor: '#4C8EF7',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: '5%',
    marginTop: 10,
  },
  button: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    marginHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },

  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#007bff',
   
    marginRight:10,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  messageContainer: {
    maxWidth: '85%',
    marginVertical: 5,
    padding: 10,
    borderRadius: 10,
    position: 'relative',
    overflow: 'visible',
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
  botText: {
    fontSize: 16,
    color: '#333333', // Default color that will be overridden with inline style
    lineHeight: 24,
  },
  headingText: {
    fontWeight: 'bold',
    fontSize: 18,
    marginVertical: 8,
    color: '#4C8EF7',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingBottom: 5,
  },
  subheadingText: {
    fontWeight: 'bold',
    fontSize: 16,
    marginVertical: 6,
    color: '#4C8EF7',
  },
  userText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 10,
  },
  fullScreenContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    backgroundColor: '#fff',
    padding: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenGraphContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    maxWidth: '100%',
    maxHeight: '100%',
    marginTop:20,
    marginRight:-10,
    padding: 10,
    overflow: 'hidden',
  },
  closeFullScreenButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF6600',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1001,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
  },
  closeIcon: {
    width: 20,
    height: 20,
    tintColor: '#fff',
  },
  animationContainer: {
    width: '100%',
    height: 600,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFFFF',
    borderRadius: 20,
    margin: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
    zIndex: 1,
  },
  animation: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    position: 'absolute',

    left: -200,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingAnimation: {
    width: 300,
    height: 300,
  },
  headerIcon: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
  },
  botIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginLeft: 10,
  },
  headerTextContainer: {
    marginLeft: 10,
  },
  botName: {
    fontWeight: 'bold',
    fontSize: 18,
  },
  botDescription: {
    color: '#888',
    fontSize: 14,
  },
  viewMoreText: {
    color: '#007bff',
    fontWeight: 'bold',
    marginLeft: 5,
  },
  swipeableButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  swipeButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#007AFF',
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  additionalButton: {
    alignItems: 'center',
    backgroundColor:'#D1D1D151',
    borderRadius:15,
    width:'90%',
    paddingVertical:23,
   padding:28,
  },
  additionalButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 10,
paddingVertical:10,
marginBottom:-10,
    backgroundColor: '#fff',
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
  additionalButton3: {
    alignItems: 'center',
    alignSelf:'center',
    backgroundColor:'#76767651',
    borderRadius:15,
    width:'90%',
    paddingVertical:23,
   padding:28,
  zIndex:30,
  },

  additionalIcon: {
    width: 28,
    height: 28,
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
    width: '100%',
    paddingHorizontal: 10,
  paddingVertical:10,
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
    padding: 2,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  mathView: {
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
    width: '100%',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  headingPointer: {
    fontWeight: 'bold',
    fontSize: 18,
    marginRight: 8,
    color: '#2274F0', // Changed to blue color
  },
  headingText: {
    fontWeight: 'bold',
    fontSize: 18,
    flex: 1,
  },
  subheadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 4,
    paddingLeft: 16,
  },
  subheadingPointer: {
    fontWeight: 'bold',
    fontSize: 12,
    marginRight: 8,
    color: '#2274F0', // Changed to blue color
  },
  subheadingText: {
    fontWeight: 'bold',
    fontSize: 14,
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
    backgroundColor: '#EAF5FF',
    borderRadius: 12,
    padding: 8,
    marginVertical: 4,
    borderWidth: 2,
    borderColor: '#4C8EF7',
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
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
    flexWrap: 'wrap',
    flexShrink: 1,
    overflow: 'hidden',
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
  imagePreviewContainer: {
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    width: '70%',
 marginLeft:'15',
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderWidth: 1,
    borderColor: '#4C8EF7',
    marginBottom: 10,
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
  fullScreenImageContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  fullScreenImage: {
    width: '95%',
    height: '80%',
    borderRadius: 5,
  },
  keyboardAvoidingView: {
    width: '100%',
    position: 'absolute',
    marginBottom: 15,
    bottom: 0,
    left: 0,
    right: 0,
  },
  loadingFullScreenContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  loadingFullScreenAnimation: {
    width: 200,
    height: 200,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
  chineseHeadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
    width: '100%',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  chineseHeadingText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976D2',  // This will be overridden by inline style with colors.botText
  },
  chineseSubheadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    width: '100%',
  },
  chineseSubheadingPointer: {
    fontWeight: 'bold',
    fontSize: 12,
    marginRight: 8,
    color: '#2274F0', // Changed to blue color
  },
  chineseSubheadingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',  // This will be overridden by inline style with colors.botText
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
  inlineMathContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 4,
    padding: 4,
    marginHorizontal: 2,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignSelf: 'flex-start',
  },
  chineseSubSubheadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    paddingLeft: 32,
  },
  chineseSubSubheadingPointer: {
    fontWeight: 'bold',
    fontSize: 12,
    marginRight: 8,
    color: '#2274F0', // Changed to blue color
  },
  chineseSubSubheadingText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  messageWrapperOuter: {
    maxWidth: '80%',
    marginVertical: 5,
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
  messageActionButtons: {
    flexDirection: 'row',
    marginTop: 2,
    padding: 2,
    marginBottom: 3,
  },
  botMessageActions: {
    alignSelf: 'flex-start',
    marginLeft: 15,
  },
  userMessageActions: {
    alignSelf: 'flex-end',
    marginRight: 10,
  },
  actionButton: {
    padding: 5,
    marginHorizontal: 3,
    backgroundColor: 'transparent',
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
  list_item_bullet: {
    marginRight: 5,
    fontSize: 16,
    color: '#333333', // Default color that will be overridden with inline style
  },
  // MathView styles
  mathView: {
    minHeight: 30,
    alignSelf: 'center',
    margin: 5,
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
  mathContainer: {
    marginVertical: 5,
    padding: 5,
    backgroundColor: 'rgba(240, 240, 240, 0.3)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineMathContainer: {
    marginHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  displayMathContainer: {
    marginVertical: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(240, 240, 240, 0.3)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  
  // Table styles
  tableContainer: {
    marginVertical: 10,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#fff',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f2f6',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  tableHeaderCell: {
    padding: 10,
    fontWeight: 'bold',
    flex: 1,
    minWidth: 100,
    borderRightWidth: 1,
    borderRightColor: '#ccc',
  },
  tableHeaderText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tableCell: {
    padding: 10,
    flex: 1,
    minWidth: 100,
    borderRightWidth: 1,
    borderRightColor: '#eee',
  },
  tableCellText: {
    fontSize: 14,
  },
  tableEvenRow: {
    backgroundColor: '#fff',
  },
  tableOddRow: {
    backgroundColor: '#f9f9f9',
  },
  tableFirstColumn: {
    borderLeftWidth: 0,
  },
  tableLastColumn: {
    borderRightWidth: 0,
  },
  summaryTableWrapper: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  summaryTableHeaderCell: {
    backgroundColor: '#f1f2f6',
    padding: 12,
  },
  summaryTableHeaderText: {
    fontWeight: 'bold',
    fontSize: 15,
    fontFamily: 'monospace',
    color: '#333',
    textAlign: 'center',
  },
  summaryTableRow: {
    backgroundColor: '#fff',
  },
  summaryTableCell: {
    padding: 12,
    borderRightWidth: 1,
    borderRightColor: '#eee',
  },
  summaryTableCellText: {
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
  // ... existing code ...
  scheduleTableContainer: {
    borderWidth: 2,
    borderColor: '#4C8EF7',
    borderStyle: 'dashed',
  },
  scheduleTableHeaderRow: {
    backgroundColor: '#E3F2FD',
  },
  scheduleTableRow: {
    backgroundColor: '#F5F5F5',
  },
  dayCellStyle: {
    backgroundColor: '#fff',
  },
  tableLastRow: {
    borderBottomWidth: 0,
  },
  // ... existing code ...
  fractionContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 2,
  },
  numerator: {
    fontSize: 16,
    textAlign: 'center',
  },
  fractionLine: {
    height: 1,
    width: '100%',
    backgroundColor: '#333',
    marginVertical: 2,
  },
  denominator: {
    fontSize: 16,
    textAlign: 'center',
  },
  formulaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    padding: 5,
  },
  sqrtContainer: {
    padding: 5,
    alignItems: 'center',
  },
  textLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 2,
  },
  complexMathContainer: {
    marginVertical: 5,
    backgroundColor: 'rgba(240, 240, 240, 0.2)',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  complexMathText: {
    fontSize: 16,
    fontFamily: 'monospace',
  },
  
  // Chinese content styles
  chineseHeadingContainer: {
    marginTop: 10,
    marginBottom: 5,
  },
  chineseHeadingText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  chineseSubheadingContainer: {
    flexDirection: 'row',
    marginTop: 5,
    marginBottom: 3,
    paddingLeft: 10,
  },
  chineseSubheadingPointer: {
    marginRight: 5,
    fontSize: 16,
  },
  chineseSubheadingText: {
    fontSize: 16,
    flex: 1,
  },
  // ... existing code ...
  botHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  botHeaderLogo: {
    width: 30,
    height: 30,
    tintColor: '#fff',
  },
  botHeaderText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4C8EF7',
  },
  botHeaderLogoContainer: {
    width: 35,
    height: 35,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 19,
    borderRadius: 30,
    backgroundColor: '#4C8EF7',
  },
  
  // Add ChatGPT-style title container
  titleContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingBottom: 8,
    marginBottom: 10,
    marginTop: 5,
  },
  titleText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4C8EF7',
  },
  
  // Enhanced list styles to look more like ChatGPT
  list_item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 4,
    paddingRight: 10,
  },
  list_item_bullet: {
    marginRight: 8,
    fontSize: 16,
    color: '#4C8EF7',
    width: 15,
    textAlign: 'center',
  },
  list_item_number: {
    marginRight: 8,
    fontWeight: 'bold',
    fontSize: 16,
    color: '#4C8EF7',
    width: 22,
    textAlign: 'right',
  },
  list_item_content: {
    flex: 1,
  },
  
  // Improve code block styling
  code_block: {
    backgroundColor: '#F6F8FA',
    padding: 12,
    borderRadius: 6,
    fontFamily: 'monospace',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginVertical: 8,
  },
  code_inline: {
    backgroundColor: '#F6F8FA',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontFamily: 'monospace',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  
  // Improve blockquote styling
  blockquote: {
    borderLeftWidth: 4,
    borderLeftColor: '#4C8EF7',
    paddingLeft: 12,
    marginVertical: 8,
    backgroundColor: '#F6F8FA',
    paddingVertical: 8,
    paddingRight: 8,
    borderRadius: 0,
  },
  blockquoteText: {
    fontStyle: 'italic',
    color: '#333333',
  },
  
  // ... existing styles ...
});

export default BotScreen2;
