import React, { useEffect, useState, useRef, forwardRef } from 'react';
const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };
  import {
      View,
      Text,
      StyleSheet,
      TouchableOpacity,
      TouchableWithoutFeedback,
      Share,
      ScrollView,
      Image,
      TextInput,
      Switch,
      Modal,
      ActivityIndicator,
      FlatList,
      Animated,
      NativeModules,
      Dimensions,
      Platform,
      PanResponder,
  } from 'react-native';
  import { SafeAreaView } from 'react-native-safe-area-context';
import { PDFDocument, rgb, PNGImage } from 'react-native-pdf-lib';
import LottieView from 'lottie-react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { svg2png } from 'svg-png-converter';
import RNFS from 'react-native-fs';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Slider from '@react-native-community/slider'; // Import the Slider component

  import { useNavigation } from '@react-navigation/native';
  import Sound from 'react-native-sound';
  import ForceDirectedGraph from '../components/mindMap';
  import { Picker } from '@react-native-picker/picker';
  import DropDownPicker from 'react-native-dropdown-picker';
  import Svg, { Path } from 'react-native-svg';
  import LinearGradient from 'react-native-linear-gradient'; // Import LinearGradient
  import { useTheme } from '../context/ThemeContext';
  import { useLanguage } from '../context/LanguageContext';
  import audioService from '../services/audioService'; // Import audioService
  import paymentService from '../services/paymentService'; // Import payment service
  import { useCoinsSubscription } from '../hooks/useCoinsSubscription'; // Import useCoinsSubscription hook
  import SRTSubtitleModal from '../components/SRTSubtitleModal'; // Import SRT Subtitle Modal

    const TranslateScreen = ({ route }) => {
    const { getThemeColors } = useTheme();
    const colors = getThemeColors();
    const { t } = useLanguage();
    const graphRef = useRef(null);
      const { audioid ,uid} = route.params || {};
      const scrollY = new Animated.Value(0);
      const playerHeight = scrollY.interpolate({
          inputRange: [0, 75, 76, 100],
          outputRange: [120, 120, 35, 35],
          extrapolate: 'clamp',
      });
      const playerPadding = scrollY.interpolate({
          inputRange: [0, 75, 76, 200],
          outputRange: [16, 16, 1, 1],
          extrapolate: 'clamp',
      });
    
      const [waveformHeights, setWaveformHeights] = useState([]);
      const [isTranscriptionGenerating, setIsTranscriptionGenerating] = useState(false);
      const [transcriptionGeneratedFor, setTranscriptionGeneratedFor] = useState(new Set());

      const [isRepeatMode, setIsRepeatMode] = useState(false);
      const [editingStates, setEditingStates] = useState([]);
      const [transcription, setTranscription] = useState([]);
      // Add a ref for the speed timer
      const speedTimerRef = useRef(null);
      const [playbackSpeed, setPlaybackSpeed] = useState(1.0); // State for tracking current playback speed
      const [isSpeedDropdownVisible, setIsSpeedDropdownVisible] = useState(false); // State for dropdown visibility
   
      const [sliderWidth, setSliderWidth] = useState(Dimensions.get('window').width);
      const [isLoading, setIsLoading] = useState(true);
      const [paragraphs, setParagraphs] = useState([]);
      const paragraphRefs = useRef({});
      const [audioUrl, setAudioUrl] = useState('');
      const [keyPoints, setKeypoints] = useState('');
      const [XMLData, setXMLData] = useState('');
      const [duration, setDuration] = useState('');
      const audioPlayerRef = useRef(null);
      const [isFullScreen, setIsFullScreen] = useState(false);
      const [showMindMap, setShowMindMap] = useState(false);
      const [isMindMapGenerated, setIsMindMapGenerated] = useState(false);
      const [isMindMapGenerating, setIsMindMapGenerating] = useState(false);
      const coinCount = useCoinsSubscription(uid);
      const scrollViewRef = useRef(null);
      const [isSeeking, setIsSeeking] = useState(false);
      const userScrollTimeoutRef = useRef(null);
      // Add state to track the user's scroll position
      const [userScrollPosition, setUserScrollPosition] = useState(0);
      // Add ref to track if user has scrolled since last auto-scroll
      const hasUserScrolledRef = useRef(false);
      // Add a mutex to prevent scroll conflicts
      const isScrollingRef = useRef(false);
      // Add a ref to prevent auto-scroll from happening too frequently
      const lastAutoScrollTimeRef = useRef(0);

      const isTranscriptionEmpty = transcription  === '';
      const coin = require('../assets/coin.png');
      const [currentWordIndex, setCurrentWordIndex] = useState({
          paraIndex: 0,
          wordIndex: 0,
          word: ''
      });
      
      // SRT Subtitle Modal states
      const [isSRTModalVisible, setIsSRTModalVisible] = useState(false);
      const [wordsData, setWordsData] = useState([]);
      const [currentTime, setCurrentTime] = useState(0);

      // Add helper function to centralize scroll decision logic
      const canScrollToCurrentParagraph = () => {
        // FIRST CHECK: Is user actively scrolling?
        // If yes, we should NOT auto-scroll
        if (isUserScrolling) {
          console.log("User is actively scrolling - blocking auto-scroll");
          return false;
        }
        
        // IMPORTANT: If user has manually scrolled, but we're coming back after the timeout,
        // we SHOULD allow auto-scrolling again to resume normal behavior
        // This ensures auto-scrolling works normally when user isn't interacting
        
        // If we're already in the middle of a scroll operation, don't start another
        if (isScrollingRef.current) {
          console.log("Already scrolling - blocking another scroll");
          return false;
        }
        
        // Check throttling (don't scroll too frequently)
        const now = Date.now();
        const timeSinceLastScroll = now - lastAutoScrollTimeRef.current;
        const MIN_SCROLL_INTERVAL = 300; // Minimum ms between scrolls
        
        if (timeSinceLastScroll < MIN_SCROLL_INTERVAL) {
          console.log("Scrolled too recently - blocking to prevent jitter");
          return false;
        }
        
        // All conditions pass, safe to scroll
        return true;
      };
      
      // Add helper function to perform auto-scroll with proper safeguards
      const performAutoScroll = (targetParagraphIndex) => {
        if (!canScrollToCurrentParagraph()) {
          return false; // Can't scroll now
        }
        
        // Update timestamp of last scroll attempt
        lastAutoScrollTimeRef.current = Date.now();
        
        // Set mutex to prevent conflicts
        isScrollingRef.current = true;
        
        // Update which paragraph we last scrolled to
        setLastScrolledPara(targetParagraphIndex);
        
        // Use the paragraph ref for more accurate scrolling
        if (paragraphRefs.current[targetParagraphIndex]) {
          paragraphRefs.current[targetParagraphIndex].measureLayout(
            scrollViewRef.current,
            (x, y) => {
              // Final check to make sure user hasn't started scrolling
              if (isUserScrolling) {
                isScrollingRef.current = false;
                return;
              }
              
              // Perform the actual scroll
              scrollViewRef.current.scrollTo({
                y: y - 20,
                animated: true
              });
              
              // Release the mutex after animation completes
              setTimeout(() => {
                isScrollingRef.current = false;
              }, 300);
            },
            () => {
              // Fallback if measurement fails
              if (isUserScrolling) {
                isScrollingRef.current = false;
                return;
              }
              
              // Fallback scroll
              scrollViewRef.current.scrollTo({
                y: targetParagraphIndex * 200,
                animated: true
              });
              
              // Release the mutex after animation
              setTimeout(() => {
                isScrollingRef.current = false;
              }, 300);
            }
          );
        } else {
          // If reference not available, use fallback
          if (isUserScrolling) {
            isScrollingRef.current = false;
            return false;
          }
          
          // Fallback scroll
          scrollViewRef.current.scrollTo({
            y: targetParagraphIndex * 200,
            animated: true
          });
          
          // Release the mutex after animation
          setTimeout(() => {
            isScrollingRef.current = false;
          }, 300);
        }
        
        return true; // Scroll was performed
      };

      useEffect(() => {
        // Don't auto-scroll in these cases:
        // 1. If the user is manually scrolling
        // 2. If a scroll operation is already in progress
        // 3. If the last auto-scroll happened too recently (prevent jittering)
        const now = Date.now();
        const timeSinceLastScroll = now - lastAutoScrollTimeRef.current;
        const MIN_SCROLL_INTERVAL = 300; // Minimum 300ms between auto-scrolls to prevent jitter
        
        // CHANGE: Removed hasUserScrolledRef.current check to allow auto-scrolling 
        // to continue during normal playback when user isn't actively scrolling
        if (scrollViewRef.current && 
            currentWordIndex.paraIndex !== undefined && 
            !isUserScrolling && 
            !isScrollingRef.current &&
            timeSinceLastScroll > MIN_SCROLL_INTERVAL) {
        
          console.log("Auto-scrolling to paragraph:", currentWordIndex.paraIndex);
          // Update the last auto-scroll time
          lastAutoScrollTimeRef.current = now;
          
          // Set the mutex to prevent user scroll interference
          isScrollingRef.current = true;
          
          // Calculate approximate y position based on paragraph index
          // Use a smaller offset to position the paragraph at the top with some padding
          const yOffset = currentWordIndex.paraIndex * 150 - 20; // Adjust based on paragraph height
          scrollViewRef.current.scrollTo({ 
            y: Math.max(0, yOffset), // Ensure we don't scroll to negative values
            animated: true 
          });
          
          // Release the scroll mutex after animation completes
          setTimeout(() => {
            isScrollingRef.current = false;
          }, 300); // Animation typically takes ~300ms
        } else if (scrollViewRef.current && isUserScrolling && hasUserScrolledRef.current) {
          // If user is actively scrolling, maintain their scroll position
          // But only do this if we're not already in a scroll operation
          if (!isScrollingRef.current) {
            scrollViewRef.current.scrollTo({
              y: userScrollPosition,
              animated: false // Don't animate when restoring user position
            });
          }
        }
      }, [currentWordIndex.paraIndex, isUserScrolling, userScrollPosition]);
      const [wordTimings, setWordTimings] = useState([]);
      const navigation = useNavigation();
     
      const [isAudioLoading, setIsAudioLoading] = useState(false);
      const [fileName, setFileName] = useState('');
      const [fileContent, setFileContent] = useState('');
      const [isSliderVisible, setSliderVisible] = useState(false);
      const [isTranscriptionVisible, setTranscriptionVisible] = useState(false);
      const [isSpeechToTextEnabled, setSpeechToTextEnabled] = useState(true);
      const [isEditingEnabled, setEditingEnabled] = useState(true);
   
      // Disable swipe-back gesture just for this screen
      useEffect(() => {
        // Save the previous state
        const previousState = navigation.getState();
        
        // Disable swipe to go back
        navigation.setOptions({
          gestureEnabled: false,
        });
        
        // Clean up - restore default behavior when component unmounts
        return () => {
          // Only restore if the navigation object is still valid
          if (navigation) {
            navigation.setOptions({
              gestureEnabled: true,
            });
          }
        };
      }, [navigation]);
   
      const [translations, setTranslations] = useState([]);
      const [selectedButton, setSelectedButton] = useState('transcription');
      const [selectedLanguage, setSelectedLanguage] = useState('zh');
      const [translatedText, setTranslatedText] = useState('');
   
    
      const [showDropdown, setShowDropdown] = useState(false);
      const [audioPosition, setAudioPosition] = useState(0);
      const [audioDuration, setAudioDuration] = useState(0);
      const [isAudioPlaying, setIsAudioPlaying] = useState(false);
      const [sound, setSound] = useState(null);
      const resizeIcon = require('../assets/robot.png');
    
      // Add a ref for the wave animation
      const waveAnimationRef = useRef(null);
      
      // Add useEffect to stop audio when leaving the screen
      useEffect(() => {
          const unsubscribe = navigation.addListener('blur', () => {
              if (sound && isAudioPlaying) {
                  sound.pause();
                  setIsAudioPlaying(false);
                  
                  // Clear speed timer when leaving screen
                  if (speedTimerRef.current) {
                      clearInterval(speedTimerRef.current);
                      speedTimerRef.current = null;
                  }
                  
                  // Pause the wave animation
                  if (waveAnimationRef.current) {
                      waveAnimationRef.current.pause();
                  }
              }
          });
          
          return unsubscribe;
      }, [navigation, sound, isAudioPlaying]);
     
      const languages = [
          { label: t('chineseSimplified'), value: 'zh' },
          {label: t('english'), value: 'en'},
          { label: t('chineseTraditional'), value: 'zh-TW' },
          { label: t('spanish'), value: 'es' },
          { label: t('french'), value: 'fr' },
          { label: t('german'), value: 'de' },
          { label: t('hindi'), value: 'hi' },
      ];
  
      // Add useEffect to sync wave animation with audio playback state
      useEffect(() => {
          if (waveAnimationRef.current) {
              if (isAudioPlaying) {
                  waveAnimationRef.current.play();
              } else {
                  waveAnimationRef.current.pause();
              }
          }
      }, [isAudioPlaying]);

      const handleSelectLanguage = (value) => {
          setSelectedLanguage(value);
 
      };
  

  
      const isMounted = useRef(true);
  
    useEffect(() => {
        // Set isMounted to true when component mounts
        isMounted.current = true;
        
        // Check for existing data in AsyncStorage first
        const checkCachedData = async () => {
            try {
                const cachedDataString = await AsyncStorage.getItem(`audioData-${audioid}`);
                if (cachedDataString) {
                    const cachedData = JSON.parse(cachedDataString);
                    
                    // Only use cached data if the transcription is valid
                    const cachedTranscription = cachedData.transcription || '';
                    const isPlaceholderMessage = cachedTranscription === 'Generating Transcription May take some time...';
                    
                    if (cachedTranscription && !isPlaceholderMessage && cachedTranscription.trim() !== '') {
                        // Use the cached data
                        console.log('Using cached transcription data');
                        setTranscription(cachedData.transcription || '');
                        setParagraphs(cachedData.paragraphs || []);
                        setAudioUrl(cachedData.audioUrl || '');
                        setKeypoints(cachedData.keyPoints || '');
                        setXMLData(cachedData.XMLData || '');
                        setDuration(cachedData.duration || 0);
                        setAudioDuration(cachedData.audioDuration || 0);
                        
                        // Still fetch fresh data from server in the background
                        fetchAudioMetadata(uid, audioid);
                    } else {
                        // If cached data is invalid, fetch fresh data
                        console.log('Cached transcription is empty or invalid, fetching fresh data');
                        fetchAudioMetadata(uid, audioid);
                    }
                } else {
                    // No cached data, fetch from server
                    fetchAudioMetadata(uid, audioid);
                }
            } catch (error) {
                console.error('Error checking cached data:', error);
                // Fall back to server fetch
                fetchAudioMetadata(uid, audioid);
            }
        };
        
        // Start by checking for cached data
        checkCachedData();
        
        // Clean up function
        return () => {
            isMounted.current = false;
            
            // Release sound resources
            if (sound) {
                sound.release();
            }
            
            // Clear any pending timeouts
            if (userScrollTimeoutRef.current) {
                clearTimeout(userScrollTimeoutRef.current);
                userScrollTimeoutRef.current = null;
            }
            
            // Clear speed timer
            if (speedTimerRef.current) {
                clearInterval(speedTimerRef.current);
                speedTimerRef.current = null;
            }
        };
    }, [uid, audioid]);

    const togglePlaybackSpeed = (selectedSpeed) => {
        if (!sound) return;
        
        // Set the new playback speed state
        setPlaybackSpeed(selectedSpeed);
        setIsSpeedDropdownVisible(false);
        
        // Clear any existing speed timer
        if (speedTimerRef.current) {
            clearInterval(speedTimerRef.current);
            speedTimerRef.current = null;
        }
        
        // Use native rate control
        if (Platform.OS === 'ios') {
            try {
                // This accesses the underlying AVAudioPlayer
                const player = sound._player;
                if (player && typeof player.setRate === 'function') {
                    player.setRate(selectedSpeed);
                    console.log(`Set iOS playback rate to ${selectedSpeed}`);
                }
            } catch (e) {
                console.log('iOS native rate control failed:', e);
            }
        } else if (Platform.OS === 'android') {
            try {
                // This accesses the underlying MediaPlayer
                const player = sound._player;
                if (player && typeof player.setPlaybackParams === 'function') {
                    const params = player.getPlaybackParams();
                    params.setSpeed(selectedSpeed);
                    player.setPlaybackParams(params);
                    console.log(`Set Android playback rate to ${selectedSpeed}`);
                }
            } catch (e) {
                console.log('Android native rate control failed:', e);
            }
        }
    };
    
  
  


  

    const toggleEdit = (index) => {
        const newEditingStates = [...editingStates];
        newEditingStates[index] = !newEditingStates[index];
        setEditingStates(newEditingStates);
    };

   
   


    const toggleSlider = () => setSliderVisible(!isSliderVisible);

    // Function to handle mind map generation with coin deduction
    const handleGenerateMindMap = async () => {
        try {
            // Check if user has at least 3 coins
            if (coinCount < 3) {
                Alert.alert(
                    'Insufficient Coins',
                    'You need at least 3 coins to generate a mind map.',
                    [{ text: 'OK' }]
                );
                return;
            }

            setIsMindMapGenerating(true);

            // Deduct 3 coins
            await paymentService.subtractCoins(uid, 3, 'Mind Map Generation');
            // Note: coinCount will be automatically updated by useCoinsSubscription hook
            
            // Set mind map as generated
            setIsMindMapGenerated(true);
            
        } catch (error) {
            console.error('Error generating mind map:', error);
            Alert.alert(
                'Error',
                'Failed to generate mind map. Please try again.',
                [{ text: 'OK' }]
            );
        } finally {
            setIsMindMapGenerating(false);
        }
    };

    // Note: Coin count is now managed by useCoinsSubscription hook

 

    const toggleTextEditing = () => {
        setEditingEnabled(!isEditingEnabled);
        // Reset all editing states when toggling editing mode
        setEditingStates(Array(paragraphs.length).fill(false));
    };
   

    const toggleSpeechToText = () => {
        setSpeechToTextEnabled(!isSpeechToTextEnabled);
        // This will control the visibility of timestamps
    };

  

    
    const handleOutsidePress = () => {
        // Close the slider when clicking outside
        if (isSliderVisible) {
            setSliderVisible(false);
        }
    };

    const azureEndpoint = 'https://api.cognitive.microsofttranslator.com';
    // API key should be stored securely and not hardcoded
    const azureKey = process.env.AZURE_TRANSLATION_KEY || ''; // Use environment variable
    const region = 'eastus';

 
    
    const handleButtonPress = (button) => {
        setSelectedButton(button);
    
        if (button === 'mindMap') {
            
            fetchAudioMetadata(uid, audioid); 
        }
    };
    useEffect(() => {
     
            fetchAudioMetadata(uid, audioid);
     
    }, [uid, audioid, selectedButton]); 
        
    const splitTranscription = (text) => {
        if (!text) return { paragraphs: [], words: [] };
        
        // Handle Chinese text specifically
        const isChinese = /[\u4e00-\u9fff]/.test(text);
        let words = isChinese ? Array.from(text) : text.split(/\s+/);
        
        if (isChinese) {
            // For Chinese text, split into smaller paragraphs
            const charsPerParagraph = 100; // Reduced from 200 to 100 for better readability
            const paragraphs = [];
            
            // First try to split by common Chinese punctuation
            const segments = text.split(/[。！？；,，]/g);
            let currentParagraph = '';
            
            for (const segment of segments) {
                if (!segment.trim()) continue;
                
                // If adding this segment would make the paragraph too long, start a new one
                if ((currentParagraph + segment).length > charsPerParagraph && currentParagraph) {
                    paragraphs.push(currentParagraph.trim());
                    currentParagraph = segment;
                } else {
                    currentParagraph += (currentParagraph ? '，' : '') + segment;
                }
            }
            
            // Add the last paragraph if it's not empty
            if (currentParagraph.trim()) {
                paragraphs.push(currentParagraph.trim() + '。');
            }
            
            // If no paragraphs were created (no punctuation found), split by character count
            if (paragraphs.length === 0) {
                for (let i = 0; i < text.length; i += charsPerParagraph) {
                    const chunk = text.slice(i, Math.min(i + charsPerParagraph, text.length));
                    if (chunk.trim()) {
                        paragraphs.push(chunk.trim());
                    }
                }
            }
            
            return { paragraphs, words };
        } else {
            // For non-Chinese text, use the original sentence-based splitting
            const sentences = text.split(/[.!?]\s+/).filter(s => s.trim().length > 0);
            const paragraphs = [];
            const sentencesPerParagraph = 9;
            
            for (let i = 0; i < sentences.length; i += sentencesPerParagraph) {
                const paragraphSentences = sentences.slice(i, i + sentencesPerParagraph);
                const paragraph = paragraphSentences.join('. ') + '.';
                if (paragraph.trim()) {
                    paragraphs.push(paragraph.trim());
                }
            }
            
            return { paragraphs, words };
        }
        
        return { paragraphs, words };
    };

    const calculateParagraphTimings = (words, duration) => {
        if (!words.length || !duration) return [];
        
        // Calculate time per paragraph based on total duration and number of paragraphs
        const wordsPerParagraph = Math.ceil(words.length / Math.ceil(words.length / (9 * 10))); // ~10 words per line, 9 lines
        const paragraphCount = Math.ceil(words.length / wordsPerParagraph);
        const timePerParagraph = duration / paragraphCount;
        
        return Array(paragraphCount).fill(0).map((_, index) => ({
            start: index * timePerParagraph,
            end: (index + 1) * timePerParagraph,
            words: words.slice(index * wordsPerParagraph, (index + 1) * wordsPerParagraph)
        }));
    };

    useEffect(() => {
        // Generate random heights for the waveform bars
        const heights = Array(100).fill(0).map(() => Math.floor(Math.random() * (60 - 10 + 1)) + 10);
        setWaveformHeights(heights);
    }, []);

    // Ensure waveform animation state is always in sync with audio playback state
    useEffect(() => {
        if (waveAnimationRef.current) {
            if (isAudioPlaying) {
                waveAnimationRef.current.play();
            } else {
                waveAnimationRef.current.pause();
            }
        }
    }, [isAudioPlaying]);

    // Add a state to track if user is manually scrolling
    const [isUserScrolling, setIsUserScrolling] = useState(false);

    // Adding a state to track the last auto-scrolled paragraph
    const [lastScrolledPara, setLastScrolledPara] = useState(0);

    // Update the inactivity timeout value to 20 seconds as requested
    const USER_SCROLL_TIMEOUT = 20000; // 20 seconds in milliseconds

    // Update the onAudioProgress function to improve scrolling behavior
    const onAudioProgress = (progress) => {
        if (!progress || !progress.currentTime || !progress.duration || !wordTimings.length) return;
        
        // Define time variables for throttling at the start of the function
        // so they're available throughout
        const now = Date.now();
        const timeSinceLastScroll = now - lastAutoScrollTimeRef.current;
        const MIN_SCROLL_INTERVAL = 300; // Minimum 300ms between auto-scrolls
        
        const currentTime = Number(progress.currentTime.toFixed(2));
        
        // STEP 1: Find the most appropriate paragraph
        let currentParaIndex = -1;
        let bestParaDistance = Infinity;
        
        // Try to find the paragraph containing the current time
        for (let i = 0; i < wordTimings.length; i++) {
            const para = wordTimings[i];
            
            // Check if time is within paragraph bounds
            if (currentTime >= para.start && currentTime < para.end) {
                currentParaIndex = i;
                break;
            }
            
            // If not in bounds, calculate distance to this paragraph
            const distanceToStart = Math.abs(para.start - currentTime);
            const distanceToEnd = Math.abs(para.end - currentTime);
            const minDistance = Math.min(distanceToStart, distanceToEnd);
            
            if (minDistance < bestParaDistance) {
                bestParaDistance = minDistance;
                currentParaIndex = i;
            }
        }
        
        // Default to first paragraph if no match found
        if (currentParaIndex === -1 && wordTimings.length > 0) {
            currentParaIndex = 0;
        }
        
        // STEP 2: Auto-scroll to keep current paragraph at the top
        // Only auto-scroll if:
        // 1. We're not in user scrolling mode, OR
        // 2. We're forcing a scroll due to seeking (jump to position)
        // This ensures we don't interrupt the user's manual scrolling
        const shouldForceScroll = isSeeking || Math.abs(currentTime - audioPosition) > 1;
        
        // If user is scrolling, don't perform any auto-scroll unless it's a force scroll
        if ((isUserScrolling || hasUserScrolledRef.current) && !shouldForceScroll) {
            // Don't auto-scroll, but still update the current paragraph and word
        } else if (currentParaIndex !== -1 && scrollViewRef.current) {
            // Check if we should perform auto-scrolling:
            // - Not in user scrolling mode OR
            // - This is a forcing scroll operation (seeking/word click)
            const shouldAutoScroll = (!isUserScrolling && !hasUserScrolledRef.current) || shouldForceScroll;
            
            // Add throttling to prevent too frequent scrolling
            const now = Date.now();
            const timeSinceLastScroll = now - lastAutoScrollTimeRef.current;
            const MIN_SCROLL_INTERVAL = 300; // Minimum 300ms between auto-scrolls
            
            // Only scroll when:
            // 1. The paragraph changes OR
            // 2. After seeking OR
            // 3. We're forcing a scroll
            // 4. Not currently in scrolling operation
            // 5. Not scrolled too recently
            if (shouldAutoScroll && 
                (currentParaIndex !== lastScrolledPara || shouldForceScroll) && 
                !isScrollingRef.current &&
                (timeSinceLastScroll > MIN_SCROLL_INTERVAL || shouldForceScroll)) {
                
                // If this is a forced scroll, reset the user scrolled flag
                if (shouldForceScroll) {
                    hasUserScrolledRef.current = false;
                }
                
                // Attempt to auto-scroll using our helper function
                performAutoScroll(currentParaIndex);
            }
        }
        
        // STEP 3: Find the appropriate word to highlight
        if (currentParaIndex !== -1) {
            const currentParagraphWords = wordTimings[currentParaIndex].words || [];
            
            // Initialize variables for word selection
            let selectedWordIdx = -1;
            let lastWordBeforeTime = -1;
            let firstWordAfterTime = -1;
            let bestWordDistance = Infinity;
            let bestWordIdx = -1;
            
            // First pass: collect information about words relative to current time
            for (let i = 0; i < currentParagraphWords.length; i++) {
                const word = currentParagraphWords[i];
                if (!word || word.start === undefined) continue;
                
                // Check for exact match (current time falls within word's time range)
                if (word.end !== undefined && currentTime >= word.start && currentTime < word.end) {
                    selectedWordIdx = i;
                    break; // Found exact match, no need to continue
                }
                
                // Track the last word that started before current time
                if (word.start <= currentTime) {
                    lastWordBeforeTime = i;
                }
                
                // Track the first word that starts after current time
                if (word.start > currentTime && (firstWordAfterTime === -1 || word.start < currentParagraphWords[firstWordAfterTime].start)) {
                    firstWordAfterTime = i;
                }
                
                // Calculate distance to this word for best approximation
                const distanceToWord = Math.min(
                    Math.abs(word.start - currentTime),
                    word.end !== undefined ? Math.abs(word.end - currentTime) : Infinity
                );
                
                if (distanceToWord < bestWordDistance) {
                    bestWordDistance = distanceToWord;
                    bestWordIdx = i;
                }
            }
            
            // STEP 4: Decision logic for word selection with improved fallback
            
            // If we found an exact match, use it
            if (selectedWordIdx === -1) {
                // No exact match found, use best alternative
                
                // Case 1: We have a word that started before current time
                if (lastWordBeforeTime !== -1) {
                    const lastWord = currentParagraphWords[lastWordBeforeTime];
                    
                    // Check if we should advance to next word
                    if (lastWord.end !== undefined && currentTime > lastWord.end) {
                        // We're past the end of the last word
                        
                        // Case 1A: We have a next word to potentially jump to
                        if (firstWordAfterTime !== -1) {
                            const nextWord = currentParagraphWords[firstWordAfterTime];
                            const timeSinceLastWordEnded = currentTime - lastWord.end;
                            const timeUntilNextWordStarts = nextWord.start - currentTime;
                            
                            // More aggressive forward-looking: advance to next word if:
                            // 1. We're closer to next word than to end of last word, OR
                            // 2. It's been more than 0.1 seconds since last word ended (reduced from 0.2)
                            if (timeUntilNextWordStarts < timeSinceLastWordEnded || timeSinceLastWordEnded > 0.1) {
                                // Verify next word timing data is valid
                                if (nextWord.start !== undefined && nextWord.end !== undefined) {
                                    selectedWordIdx = firstWordAfterTime;
                                } else {
                                    // Skip invalid word and look for next valid one
                                    let foundValidWord = false;
                                    for (let i = firstWordAfterTime + 1; i < currentParagraphWords.length; i++) {
                                        const word = currentParagraphWords[i];
                                        if (word.start !== undefined && word.end !== undefined) {
                                            selectedWordIdx = i;
                                            foundValidWord = true;
                                            break;
                                        }
                                    }
                                    
                                    // If we couldn't find a valid word ahead, use the best word by distance
                                    if (!foundValidWord && bestWordIdx !== -1) {
                                        selectedWordIdx = bestWordIdx;
                                    }
                                }
                            } else {
                                selectedWordIdx = lastWordBeforeTime;
                            }
                        } else {
                            // Case 1B: No next word in this paragraph, look ahead to next paragraph
                            if (currentParaIndex < wordTimings.length - 1) {
                                const nextParaWords = wordTimings[currentParaIndex + 1].words || [];
                                if (nextParaWords.length > 0 && nextParaWords[0].start !== undefined) {
                                    const firstWordNextPara = nextParaWords[0];
                                    const timeSinceLastWordEnded = currentTime - lastWord.end;
                                    const timeUntilNextParaStarts = firstWordNextPara.start - currentTime;
                                    
                                    // If we're very close to the next paragraph's first word, jump to next paragraph
                                    // More aggressive jumping to next paragraph
                                    if (timeUntilNextParaStarts < 1.5 && timeSinceLastWordEnded > 0.3) {
                                        // We're close enough to next paragraph, update state to move there
                                        setCurrentWordIndex({
                                            paraIndex: currentParaIndex + 1,
                                            wordIndex: 0,
                                            word: firstWordNextPara.punctuated_word || firstWordNextPara.word || ''
                                        });
                                        
                                        // Attempt to auto-scroll to the new paragraph
                                        performAutoScroll(currentParaIndex + 1);
                                        
                                        // Return early since we've handled this case
                                        return;
                                    }
                                }
                            }
                            
                            // If we can't jump to next paragraph, use best word by distance
                            selectedWordIdx = bestWordIdx !== -1 ? bestWordIdx : lastWordBeforeTime;
                        }
                    } else {
                        // We're still within the last word's time range
                        selectedWordIdx = lastWordBeforeTime;
                    }
                } 
                // Case 2: No word has started yet, but we have upcoming words
                else if (firstWordAfterTime !== -1) {
                    selectedWordIdx = firstWordAfterTime;
                } 
                // Case 3: No timing data available, use best word by distance
                else if (bestWordIdx !== -1) {
                    selectedWordIdx = bestWordIdx;
                }
                // Case 4: Absolute fallback - use first word if available
                else if (currentParagraphWords.length > 0) {
                    selectedWordIdx = 0;
                }
            }
            
            // STEP 5: If we still don't have a word, implement aggressive forward-looking
            if (selectedWordIdx === -1) {
                // Look ahead across multiple paragraphs if necessary
                let foundWord = false;
                
                // Check next few paragraphs
                for (let paraOffset = 1; paraOffset <= 3; paraOffset++) {
                    if (currentParaIndex + paraOffset < wordTimings.length) {
                        const aheadParaWords = wordTimings[currentParaIndex + paraOffset].words || [];
                        
                        if (aheadParaWords.length > 0) {
                            // Found a paragraph with words, use its first word
                            setCurrentWordIndex({
                                paraIndex: currentParaIndex + paraOffset,
                                wordIndex: 0,
                                word: aheadParaWords[0].punctuated_word || aheadParaWords[0].word || ''
                            });
                            
                            // Attempt to auto-scroll to the new paragraph
                            performAutoScroll(currentParaIndex + paraOffset);
                            
                            foundWord = true;
                            break;
                        }
                    }
                }
                
                // If we still haven't found a word, default to first word of current paragraph
                if (!foundWord && currentParagraphWords.length > 0) {
                    selectedWordIdx = 0;
                } else if (!foundWord) {
                    // Absolute fallback: stay on current paragraph but don't get stuck
                    // Find any word with valid timing data in the current paragraph
                    for (let i = 0; i < currentParagraphWords.length; i++) {
                        if (currentParagraphWords[i] && 
                            currentParagraphWords[i].start !== undefined && 
                            currentParagraphWords[i].end !== undefined) {
                            selectedWordIdx = i;
                            break;
                        }
                    }
                    
                    // If still no valid word, just use the first word
                    if (selectedWordIdx === -1 && currentParagraphWords.length > 0) {
                        selectedWordIdx = 0;
                    }
                    
                    // If absolutely nothing works, just return without updating
                    if (selectedWordIdx === -1) return;
                }
            }
            
            // STEP 6: Update the UI with our selected word
            if (selectedWordIdx !== -1) {
                // Get the current word index state
                const prevWordIndex = currentWordIndex;
                
                // Only update if we're changing words to avoid unnecessary re-renders
                if (prevWordIndex.paraIndex !== currentParaIndex || 
                    prevWordIndex.wordIndex !== selectedWordIdx) {
                    
                    setCurrentWordIndex({
                        paraIndex: currentParaIndex,
                        wordIndex: selectedWordIdx,
                        word: currentParagraphWords[selectedWordIdx]?.punctuated_word || 
                              currentParagraphWords[selectedWordIdx]?.word || ''
                    });
                }
            }
        }
    };


    // Audio player functions
    const loadAudio = () => {
        if (sound) {
            sound.release();
        }

        // Enable streaming for better performance
        Sound.setCategory('Playback');
        
        const loadWithRetry = (attempt = 0) => {
            const maxAttempts = 3;
            
            console.log(`Attempting to load audio (attempt ${attempt + 1}): ${audioUrl}`);
            
            // Create new sound instance with error handling
            const newSound = new Sound(audioUrl, '', (error) => {
                if (error) {
                    console.warn(`Failed to load sound (attempt ${attempt + 1}):`, error);
                    
                    if (attempt < maxAttempts - 1) {
                        // Retry with exponential backoff
                        setTimeout(() => {
                            loadWithRetry(attempt + 1);
                        }, Math.pow(2, attempt) * 1000);
                    } else {
                        console.error('All audio loading attempts failed');
                        Alert.alert(
                            'Audio Error',
                            'Failed to load audio. Please try again later.',
                            [{ text: 'OK' }]
                        );
                    }
                    return;
                }
                
                console.log('Audio loaded successfully');
                
                // Configure sound instance
                newSound.setVolume(1.0);
                newSound.setNumberOfLoops(0);
                
                // Apply playback rate if needed
                if (playbackSpeed !== 1.0) {
                    try {
                        // Try to set the playback rate if the device supports it
                        if (Platform.OS === 'ios') {
                            // On iOS, we can try to use AVAudioPlayer's rate property
                            const player = newSound._player;
                            if (player && player.rate !== undefined) {
                                player.setRate(playbackSpeed);
                                console.log(`Set iOS playback rate to ${playbackSpeed}`);
                            }
                        } else if (Platform.OS === 'android') {
                            // On Android, we can try to use MediaPlayer's setPlaybackParams
                            const player = newSound._player;
                            if (player && player.setPlaybackParams) {
                                player.setPlaybackParams(player.getPlaybackParams().setSpeed(playbackSpeed));
                                console.log(`Set Android playback rate to ${playbackSpeed}`);
                            }
                        }
                    } catch (e) {
                        console.log('Setting speed not supported:', e);
                    }
                }
                
                // Get duration after a small delay to ensure it's loaded
                setTimeout(() => {
                    const duration = newSound.getDuration();
                    if (duration && duration > 0) {
                        setAudioDuration(duration);
                        setSound(newSound);
                        console.log(`Audio duration: ${duration} seconds`);
                    } else {
                        console.warn('Invalid duration, checking current time');
                        // If duration is invalid, try an alternative approach
                        newSound.getCurrentTime((seconds) => {
                            if (seconds >= 0) {
                                // If we can get current time, the audio is probably valid
                                setAudioDuration(seconds > 0 ? seconds : 0);
                                setSound(newSound);
                            } else {
                                newSound.release();
                                Alert.alert(
                                    'Audio Error',
                                    'Could not determine audio duration.',
                                    [{ text: 'OK' }]
                                );
                            }
                        });
                    }
                }, 300);
            });
        };
        
        loadWithRetry();
    };

    const toggleAudioPlayback = () => {
        if (!sound) return;
        
        if (isAudioPlaying) {
            sound.pause();
            setIsAudioPlaying(false);
            
            // Clear speed timer when pausing
            if (speedTimerRef.current) {
                clearInterval(speedTimerRef.current);
                speedTimerRef.current = null;
            }
            
            // Pause the wave animation
            if (waveAnimationRef.current) {
                waveAnimationRef.current.pause();
            }
        } else {
            if (audioPosition >= audioDuration) {
                sound.setCurrentTime(0);
                setAudioPosition(0);
                setCurrentWordIndex({ paraIndex: 0 });
            }
            
            sound.play((success) => {
                if (success) {
                    if (isRepeatMode) {
                        // In repeat mode, start from beginning
                        sound.setCurrentTime(0);
                        setAudioPosition(0);
                        setCurrentWordIndex({ paraIndex: 0 });
                        sound.play();
                    } else {
                        setIsAudioPlaying(false);
                        setAudioPosition(audioDuration);
                        
                        // Clear speed timer when playback ends
                        if (speedTimerRef.current) {
                            clearInterval(speedTimerRef.current);
                            speedTimerRef.current = null;
                        }
                        
                        // Pause the wave animation when audio completes
                        if (waveAnimationRef.current) {
                            waveAnimationRef.current.pause();
                        }
                    }
                } else {
                    console.error('Playback failed');
                    setIsAudioPlaying(false);
                    
                    // Clear speed timer on failure
                    if (speedTimerRef.current) {
                        clearInterval(speedTimerRef.current);
                        speedTimerRef.current = null;
                    }
                    
                    // Pause the wave animation on failure
                    if (waveAnimationRef.current) {
                        waveAnimationRef.current.pause();
                    }
                }
            });
            
            setIsAudioPlaying(true);
            
            // Apply playback speed if needed
            if (playbackSpeed !== 1.0) {
                try {
                    // Try to set the playback rate if the device supports it
                    if (Platform.OS === 'ios') {
                        // On iOS, we can try to use AVAudioPlayer's rate property
                        const player = sound._player;
                        if (player && player.rate !== undefined) {
                            player.setRate(playbackSpeed);
                            console.log(`Re-applied iOS playback rate to ${playbackSpeed}`);
                        }
                    } else if (Platform.OS === 'android') {
                        // On Android, we can try to use MediaPlayer's setPlaybackParams
                        const player = sound._player;
                        if (player && player.setPlaybackParams) {
                            player.setPlaybackParams(player.getPlaybackParams().setSpeed(playbackSpeed));
                            console.log(`Re-applied Android playback rate to ${playbackSpeed}`);
                        }
                    }
                } catch (e) {
                    console.log('Setting speed not supported during playback:', e);
                }
            }
            
            if (waveAnimationRef.current) {
                waveAnimationRef.current.play();
            }
        }
    };

    const seekAudio = (seconds) => {
        if (!sound) return;
        
        const newPosition = Math.max(0, Math.min(audioPosition + seconds, audioDuration));
        sound.setCurrentTime(newPosition);
        setAudioPosition(newPosition);
        
        // If audio is playing, ensure the wave animation is also playing
        if (isAudioPlaying && waveAnimationRef.current) {
            waveAnimationRef.current.play();
        }
        
        // Trigger audio progress update when seeking
        onAudioProgress({
            currentTime: newPosition,
            duration: audioDuration
        });
        
        // Re-apply playback speed after seeking
        if (playbackSpeed !== 1.0 && isAudioPlaying) {
            try {
                // Try to set the playback rate if the device supports it
                if (Platform.OS === 'ios') {
                    // On iOS, we can try to use AVAudioPlayer's rate property
                    const player = sound._player;
                    if (player && player.rate !== undefined) {
                        player.setRate(playbackSpeed);
                        console.log(`Re-applied iOS playback rate to ${playbackSpeed} after seeking`);
                    }
                } else if (Platform.OS === 'android') {
                    // On Android, we can try to use MediaPlayer's setPlaybackParams
                    const player = sound._player;
                    if (player && player.setPlaybackParams) {
                        player.setPlaybackParams(player.getPlaybackParams().setSpeed(playbackSpeed));
                        console.log(`Re-applied Android playback rate to ${playbackSpeed} after seeking`);
                    }
                }
            } catch (e) {
                console.log('Setting speed not supported after seeking:', e);
            }
        }
    };

   
    
 
    useEffect(() => {
        // Basic Sound.js configuration
        Sound.setCategory('Playback');
        
        if (audioUrl) {
            console.log('Initializing audio with URL:', audioUrl);
            
            // Release previous sound if it exists
            if (sound) {
                sound.release();
                setSound(null);
            }
            
            // Determine if this is a local file
            const isLocalFile = audioUrl.startsWith('file://');
            
            // Function to load audio with retry logic
            const loadAudioWithRetry = (attempt = 0) => {
                const maxAttempts = 3;
                
                console.log(`Loading audio attempt ${attempt + 1}/${maxAttempts}`);
                
                // For local files, use empty string as the base path
                // For remote URLs, use null to indicate it's a remote URL
                const basePath = isLocalFile ? '' : null;
                
                try {
                    const newSound = new Sound(audioUrl, basePath, (error) => {
                if (error) {
                            console.error(`Audio loading error (attempt ${attempt + 1}):`, error);
                            
                            if (attempt < maxAttempts - 1) {
                                // Wait a bit longer between retries
                                setTimeout(() => {
                                    loadAudioWithRetry(attempt + 1);
                                }, (attempt + 1) * 1000);
                            } else {
                                // All attempts failed, try one last approach for remote URLs
                                if (!isLocalFile) {
                                    console.log('Trying alternative loading method...');
                                    
                                    // Try downloading the file locally first
                                    const tempFilePath = `${RNFS.CachesDirectoryPath}/temp_audio_${Date.now()}.mp3`;
                                    
                                    RNFS.downloadFile({
                                        fromUrl: audioUrl,
                                        toFile: tempFilePath,
                                        background: true
                                    }).promise.then(result => {
                                        if (result.statusCode === 200) {
                                            console.log('Downloaded audio to temp file:', tempFilePath);
                                            
                                            // Now try to load from the local file
                                            const localSound = new Sound(`file://${tempFilePath}`, '', (localError) => {
                                                if (localError) {
                                                    console.error('Failed to load downloaded audio:', localError);
                    Alert.alert(
                        'Audio Error',
                                                        'Could not load audio after multiple attempts.',
                        [{ text: 'OK' }]
                    );
                                                } else {
                                                    console.log('Successfully loaded audio from downloaded file');
                                                    localSound.setVolume(1.0);
                                                    
                                                    // Only update audioDuration if we don't already have a valid one
                                                    if (!audioDuration || audioDuration <= 0) {
                                                        // Use the duration from the API if available
                                                        if (duration && duration > 0) {
                                                            setAudioDuration(duration);
                                                        } else {
                                                            const soundDuration = localSound.getDuration();
                                                            setAudioDuration(soundDuration > 0 ? soundDuration : 30);
                                                        }
                                                    }
                                                    setSound(localSound);
                                                }
                                            });
                                        } else {
                                            console.error('Failed to download audio file:', result);
                                            Alert.alert(
                                                'Audio Error',
                                                'Could not download audio file.',
                                                [{ text: 'OK' }]
                                            );
                                        }
                                    }).catch(downloadError => {
                                        console.error('Error downloading audio:', downloadError);
                                        Alert.alert(
                                            'Audio Error',
                                            'Failed to download audio file.',
                                            [{ text: 'OK' }]
                                        );
                                    });
                                } else {
                                    Alert.alert(
                                        'Audio Error',
                                        'Could not load audio after multiple attempts.',
                                        [{ text: 'OK' }]
                                    );
                                }
                            }
                    return;
                }
                
                        // Audio loaded successfully
                        console.log('Audio loaded successfully');
                newSound.setVolume(1.0);
                
                        // Get duration with a delay to ensure it's properly loaded
                        setTimeout(() => {
                            // Only update audioDuration if we don't already have a valid one from cache
                            if (!audioDuration || audioDuration <= 0 || audioDuration === 100) {
                                // First try to use the API-provided duration
                                if (duration && duration > 0) {
                                    console.log('Using API-provided duration:', duration);
                                    setAudioDuration(duration);
                                } else {
                                    // Fall back to Sound.js duration
                                    const soundDuration = newSound.getDuration();
                                    console.log('Using Sound.js duration:', soundDuration);
                                    
                                    if (soundDuration && soundDuration > 0) {
                                        setAudioDuration(soundDuration);
                                    } else {
                                        // Try to get current time as fallback
                                        newSound.getCurrentTime((seconds) => {
                                            console.log('Current time fallback:', seconds);
                                            setAudioDuration(seconds > 0 ? seconds : 30);
                                        });
                                    }
                                }
                            } else {
                                console.log('Using cached duration:', audioDuration);
                            }
                            
                            // Always set the sound object regardless of duration source
                            setSound(newSound);
                        }, 500);
                    });
                } catch (e) {
                    console.error('Exception during audio loading:', e);
                    
                    if (attempt < maxAttempts - 1) {
                        setTimeout(() => {
                            loadAudioWithRetry(attempt + 1);
                        }, (attempt + 1) * 1000);
                    } else {
                        Alert.alert(
                            'Audio Error',
                            'An unexpected error occurred while loading audio.',
                            [{ text: 'OK' }]
                        );
                    }
                }
            };
            
            // Start loading the audio
            loadAudioWithRetry();
        }
        
        return () => {
            if (sound) {
                sound.release();
            }
        };
    }, [audioUrl, duration, audioDuration]);

    useEffect(() => {
        let interval;
        if (isAudioPlaying) {
            interval = setInterval(() => {
                if (sound && !isSeeking) { // Only update if not seeking
                    sound.getCurrentTime((seconds) => {
                        // Only update if not seeking to prevent jumps
                        if (!isSeeking) {
                            setAudioPosition(seconds);
                            setCurrentTime(seconds); // Update current time for SRT modal
                            onAudioProgress({
                                currentTime: seconds,
                                duration: audioDuration
                            });
                        }
                    });
                }
            }, 100);
        }
        
        return () => clearInterval(interval);
    }, [isAudioPlaying, sound, isSeeking, audioDuration]);

    const handleShare = async () => {
        try {
            await Share.share({
                message: transcription || t('noTranscriptionAvailable'),
            });
        } catch (error) {
            console.error('Error sharing:', error);
            if (error.message !== 'User did not share') {
                Alert.alert(t('error'), t('failedToShareText'));
            }
        }
    };

    const handlePress = async () => {
        if (transcriptionGeneratedFor.has(audioid)) return;

        setIsTranscriptionGenerating(true);

        try {
            // Clear any previously cached placeholder data
            try {
                const cachedDataString = await AsyncStorage.getItem(`audioData-${audioid}`);
                if (cachedDataString) {
                    const cachedData = JSON.parse(cachedDataString);
                    const cachedTranscription = cachedData.transcription || '';
                    const isPlaceholderMessage = cachedTranscription === 'Generating Transcription May take some time...';
                    
                    if (isPlaceholderMessage || cachedTranscription.trim() === '') {
                        // Remove invalid cached data
                        await AsyncStorage.removeItem(`audioData-${audioid}`);
                        console.log('Removed invalid cached transcription data');
                    }
                }
            } catch (e) {
                console.error('Error clearing cached data:', e);
            }

            // Use audioService instead of direct fetch
            const data = await audioService.convertAudio(uid, audioid);
            
            // If we get here, the request was successful
            setTranscriptionGeneratedFor(prev => new Set(prev).add(audioid));
            await fetchAudioMetadata(uid, audioid); // Reload data from API
        } catch (error) {
            console.error('Transcription generation failed:', error.message || error);
        } finally {
            setIsTranscriptionGenerating(false);
        }
    };
    
    const handleValueChange = (value) => {
        if (!sound) return;
        
        // Set seeking state to true to prevent position updates from the interval
        setIsSeeking(true);
        
        // Update position without triggering progress update during dragging
        setAudioPosition(value);
        
        // While dragging, we can optionally provide immediate feedback by updating the current word
        // This makes the UI more responsive during seeking
        if (wordTimings.length > 0) {
            // Find the paragraph containing this time
            let foundPara = false;
            for (let i = 0; i < wordTimings.length; i++) {
                const para = wordTimings[i];
                if (value >= para.start && value <= para.end) {
                    // Found the paragraph, now find the word
                    if (para.words && para.words.length > 0) {
                        let wordIdx = 0;
                        for (let j = 0; j < para.words.length; j++) {
                            const word = para.words[j];
                            if (word.start <= value && word.end >= value) {
                                wordIdx = j;
                                break;
                            } else if (word.start > value) {
                                // We've gone past the time, use the previous word
                                wordIdx = Math.max(0, j - 1);
                                break;
                            }
                            // If we reach the end, use the last word
                            if (j === para.words.length - 1) {
                                wordIdx = j;
                            }
                        }
                        
                        // Update current word index without scrolling (we'll scroll on sliding complete)
                        setCurrentWordIndex({
                            paraIndex: i,
                            wordIndex: wordIdx,
                            word: para.words[wordIdx]?.punctuated_word || para.words[wordIdx]?.word || ''
                        });
                        
                        foundPara = true;
                        break;
                    }
                }
            }
            
            // If we didn't find a matching paragraph, find the closest one
            if (!foundPara && wordTimings.length > 0) {
                let closestParaIdx = 0;
                let minDistance = Infinity;
                
                for (let i = 0; i < wordTimings.length; i++) {
                    const para = wordTimings[i];
                    const distToStart = Math.abs(value - para.start);
                    const distToEnd = Math.abs(value - para.end);
                    const minDist = Math.min(distToStart, distToEnd);
                    
                    if (minDist < minDistance) {
                        minDistance = minDist;
                        closestParaIdx = i;
                    }
                }
                
                // Update to the closest paragraph
                if (wordTimings[closestParaIdx]?.words?.length > 0) {
                    setCurrentWordIndex({
                        paraIndex: closestParaIdx,
                        wordIndex: 0, // Default to first word
                        word: wordTimings[closestParaIdx].words[0]?.punctuated_word || 
                              wordTimings[closestParaIdx].words[0]?.word || ''
                    });
                }
            }
        }
    };

    const handleSlidingComplete = (value) => {
        if (!sound) return;
        
        // Set the audio to the new position
        sound.setCurrentTime(value);
        
        // Update position
        setAudioPosition(value);
        
        // Use a small delay before triggering the progress update to prevent UI jumping
        setTimeout(() => {
            // Trigger progress update after a small delay
            onAudioProgress({
                currentTime: value,
                duration: audioDuration
            });
            
            // End seeking state
            setIsSeeking(false);
            
            console.log("User used slider - explicitly overriding manual scroll");
            // EXPLICIT USER ACTION: Override manual scroll
            setIsUserScrolling(false);
            hasUserScrolledRef.current = false;
            isScrollingRef.current = false;
            
            // Cancel any pending reset of user scrolling state
            if (userScrollTimeoutRef.current) {
                clearTimeout(userScrollTimeoutRef.current);
            }
        }, 100);
    };

    // Add a function to handle tapping on the waveform container
    const handleWaveformTap = (event) => {
        if (!sound || !audioDuration) return;
        
        // Get the tap position relative to the container
        const { locationX, locationX: tapX } = event.nativeEvent;
        
        // Calculate the percentage of the tap position
        const containerWidth = sliderWidth;
        const tapPercentage = tapX / containerWidth;
        
        // Calculate the new position in seconds
        const newPosition = tapPercentage * audioDuration;
        
        // Set the audio to the new position
        sound.setCurrentTime(newPosition);
        setAudioPosition(newPosition);
        
        // If audio is playing, ensure the wave animation is also playing
        if (isAudioPlaying && waveAnimationRef.current) {
            waveAnimationRef.current.play();
        }
        
        // Set seeking state to true to indicate we're performing a seek operation
        setIsSeeking(true);
        
        console.log("User tapped waveform - explicitly overriding manual scroll");
        // EXPLICIT USER ACTION: Override manual scroll flags
        setIsUserScrolling(false);
        hasUserScrolledRef.current = false;
        isScrollingRef.current = false;
        
        // Cancel any pending reset of user scrolling state
        if (userScrollTimeoutRef.current) {
            clearTimeout(userScrollTimeoutRef.current);
        }
        
        // Trigger progress update to update highlighted paragraph and scroll to it
        setTimeout(() => {
            onAudioProgress({
                currentTime: newPosition,
                duration: audioDuration
            });
            
            // End seeking state after a short delay
            setTimeout(() => {
                setIsSeeking(false);
            }, 300);
        }, 50);
    };

    // Function to handle thumb dragging
    const handleThumbDrag = (event, gestureState) => {
        if (!sound || !audioDuration) return;
        
        // Get container element measurements
        const { locationX } = event.nativeEvent;
        
        // Calculate percentage and position, ensuring it stays within bounds
        let percentage = Math.max(0, Math.min(locationX, sliderWidth)) / sliderWidth;
        
        // Handle edge cases
        if (isNaN(percentage) || !isFinite(percentage)) {
            percentage = 0;
        }
        
        // Calculate the new position in seconds
        const newPosition = percentage * audioDuration;
        
        // Update audio position
        sound.setCurrentTime(newPosition);
        setAudioPosition(newPosition);
        setIsSeeking(true);
        
        // Update progress to show the current position visually
        onAudioProgress({
            currentTime: newPosition,
            duration: audioDuration
        });
    };
    
    // Add state to track if the thumb is being actively dragged
    const [isThumbActive, setIsThumbActive] = useState(false);
    
    // Create PanResponder for the custom thumb
    const thumbPanResponder = React.useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => true,
                onMoveShouldSetPanResponder: () => true,
                onPanResponderGrant: () => {
                    setIsSeeking(true);
                    setIsThumbActive(true);
                },
                onPanResponderMove: handleThumbDrag,
                onPanResponderRelease: (e, gestureState) => {
                    // Final position update
                    handleThumbDrag(e, gestureState);
                    setIsSeeking(false);
                    setIsThumbActive(false);
                },
                onPanResponderTerminate: () => {
                    setIsSeeking(false);
                    setIsThumbActive(false);
                },
            }),
        [audioDuration, sound, sliderWidth]
    );

    const handleLayout = (event) => {
        const { width } = event.nativeEvent.layout;
        setSliderWidth(width);
    };
    
    // Calculate the position of the custom thumb
    const thumbPosition = (audioPosition / audioDuration) * sliderWidth;

    const handleTranslateParagraph = async (index) => {
        if (!paragraphs[index]) return;
    
        try {
            const data = await audioService.translateText(
                paragraphs[index],
                selectedLanguage,
                azureKey,
                region
            );
            
            console.log('Paragraph Translation Response:', data);  // Log the response to check its structure
    
            // Check if the translation is available
            if (data && data[0] && data[0].translations && data[0].translations[0]) {
                const translation = data[0].translations[0].text;
    
                setTranslations((prev) => {
                    const updatedTranslations = [...prev];
                    updatedTranslations[index] = translation;
                    return updatedTranslations;
                });
            } else {
                console.error('Translation data is not in the expected format:', data);
            }
        } catch (error) {
            console.error('Translation error:', error);
        }
    };
   
    const handleFloatingButtonPress = () => {
        if (transcription) {
            navigation.navigate('BotScreen2', { transcription , XMLData,uid,audioid });
        } else {
            alert('No transcription to translate.');
        }
    };

    const fetchAudioMetadata = async (uid, audioid) => {
        try {
            setIsLoading(true);
            
            // Show audio player container with loading state
            setAudioDuration(100); // Temporary duration to show the player
            setAudioPosition(0);
            
            // Use audioService instead of direct fetch
            const data = await audioService.getAudioFile(uid, audioid);
            console.log(data);
            
            if (data.success) {
                // Get the transcription data from the response
                const transcriptionData = data.transcription || '';
                const isPlaceholderMessage = transcriptionData === 'Generating Transcription May take some time...';
                
                // If transcription is empty or contains placeholder message, clear any cached data to prevent stale data
                if (!transcriptionData || isPlaceholderMessage || transcriptionData.trim() === '') {
                    try {
                        await AsyncStorage.removeItem(`audioData-${audioid}`);
                        console.log('Cleared cached data because transcription is empty or contains placeholder message');
                    } catch (e) {
                        console.error('Error clearing AsyncStorage:', e);
                    }
                }
                
                // Set state with fetched data
                setTranscription(transcriptionData);
                setFileName(data.audio_name || 'Untitled');
                setFileContent(data.file_path || '');
                const audioDur = data.duration || 0;
                setDuration(audioDur);

                // Directly use the audio_url from the response
                setAudioUrl(data.audioUrl || ''); // Note: audioService uses audioUrl instead of audio_url

                // Process words_data if available
                if (data.words_data && Array.isArray(data.words_data) && data.words_data.length > 0) {
                    // Store the words data for highlighting
                    setWordTimings(processWordTimings(data.words_data));
                    
                    // Set words data for SRT subtitle modal
                    setWordsData(data.words_data);
                    
                    // Create paragraphs from words_data (100 words per paragraph)
                    const { paragraphs, words } = createParagraphsFromWordsData(data.words_data);
                    setParagraphs(paragraphs);
                } else {
                    // Fallback to the old method if words_data is not available
                    let paragraphs = [];
                    let wordTimings = [];
                    if (transcriptionData && !isPlaceholderMessage) {
                        const { paragraphs: para, words } = splitTranscription(transcriptionData);
                        paragraphs = para;
                        setParagraphs(para);
                        if (data.duration) {
                            wordTimings = calculateParagraphTimings(words, data.duration);
                            setWordTimings(wordTimings);
                        }
                    }
                }

                // Set key points and XML data
                setKeypoints(data.key_points || '');
                setXMLData(data.xml_data || '');
                
                // Only cache the data if transcription is not empty and not showing the placeholder message
                if (transcriptionData && !isPlaceholderMessage && transcriptionData.trim() !== '') {
                    await AsyncStorage.setItem(`audioData-${audioid}`, JSON.stringify({
                        transcription: transcriptionData,
                        paragraphs: paragraphs || [],
                        audioUrl: data.audioUrl || '', // Note: audioService uses audioUrl instead of audio_url
                        keyPoints: data.key_points || '',
                        XMLData: data.xml_data || '',
                        duration: audioDur,
                        audioDuration: audioDur
                    }));
                } else {
                    console.log('Not caching data as transcription is empty or contains placeholder message');
                }
            } else {
                console.error('Error fetching audio metadata:', data.error_message || 'Unknown error');
                Alert.alert('Error', 'Failed to load audio data');
            }
        } catch (error) {
            console.error('Error in fetchAudioMetadata:', error);
            Alert.alert('Error', 'An unexpected error occurred while loading audio data');
        } finally {
            setIsLoading(false);
        }
    };

    // New function to process words_data into a format suitable for highlighting
    const processWordTimings = (wordsData) => {
        if (!wordsData || !Array.isArray(wordsData)) return [];
        
        // Filter out words with invalid timing data
        const validWordsData = wordsData.filter(word => 
            word && 
            typeof word.start === 'number' && 
            typeof word.end === 'number' && 
            !isNaN(word.start) && 
            !isNaN(word.end) && 
            word.start >= 0 && 
            word.end >= word.start
        );
        
        // If no valid words, return empty array
        if (validWordsData.length === 0) return [];
        
        // Group words into paragraphs (100 words per paragraph)
        const wordsPerParagraph = 100;
        const paragraphCount = Math.ceil(validWordsData.length / wordsPerParagraph);
        
        return Array(paragraphCount).fill(0).map((_, index) => {
            const startIdx = index * wordsPerParagraph;
            const endIdx = Math.min((index + 1) * wordsPerParagraph, validWordsData.length);
            const paragraphWords = validWordsData.slice(startIdx, endIdx);
            
            // Ensure all words in the paragraph have valid timing data
            const validParagraphWords = paragraphWords.map(word => {
                // Create a copy to avoid modifying the original
                const wordCopy = {...word};
                
                // Ensure start and end are valid numbers
                if (typeof wordCopy.start !== 'number' || isNaN(wordCopy.start) || wordCopy.start < 0) {
                    // If invalid start, use previous word's end or 0
                    const prevWordIdx = paragraphWords.indexOf(word) - 1;
                    wordCopy.start = prevWordIdx >= 0 ? paragraphWords[prevWordIdx].end : 0;
                }
                
                if (typeof wordCopy.end !== 'number' || isNaN(wordCopy.end) || wordCopy.end < wordCopy.start) {
                    // If invalid end, estimate based on average word duration or add small offset
                    wordCopy.end = wordCopy.start + 0.3; // Default 300ms per word if no better estimate
                }
                
                return wordCopy;
            });
            
            // Calculate paragraph start and end times
            const paraStart = validParagraphWords.length > 0 ? validParagraphWords[0].start : 0;
            const paraEnd = validParagraphWords.length > 0 ? 
                validParagraphWords[validParagraphWords.length - 1].end : 0;
            
            return {
                start: paraStart,
                end: paraEnd,
                words: validParagraphWords
            };
        });
    };

    // New function to create paragraphs from words_data
    const createParagraphsFromWordsData = (wordsData) => {
        if (!wordsData || !Array.isArray(wordsData)) {
            return { paragraphs: [], words: [] };
        }
        
        // Filter out invalid word data and ensure we have text for each word
        const validWordsData = wordsData.filter(wordData => 
            wordData && (wordData.punctuated_word || wordData.word)
        );
        
        // Extract all words, using punctuated_word if available, falling back to word
        const words = validWordsData.map(wordData => {
            // Use punctuated_word if available, otherwise use word
            // If neither is available (shouldn't happen due to filter), use empty string
            return wordData.punctuated_word || wordData.word || '';
        });
        
        // Group into paragraphs (100 words per paragraph)
        const wordsPerParagraph = 100;
        const paragraphs = [];
        
        for (let i = 0; i < words.length; i += wordsPerParagraph) {
            const paragraphWords = words.slice(i, i + wordsPerParagraph);
            
            // Process the words to add better punctuation
            const processedWords = paragraphWords.map((word, idx) => {
                // Don't modify if already has punctuation
                if (word.endsWith(',') || word.endsWith('.') || 
                    word.endsWith('!') || word.endsWith('?') || word.endsWith(';')) {
                    return word;
                }
                
                // Add comma at natural pauses (approximately every 8-12 words)
                // But not at the very end of paragraph
                if ((idx + 1) % 10 === 0 && idx !== paragraphWords.length - 1) {
                    return word + ',';
                }
                
                // Add period at the end of the paragraph
                if (idx === paragraphWords.length - 1) {
                    return word + '.';
                }
                
                return word;
            });
            
            // Join words with space, trim any extra spaces
            const paragraphText = processedWords.join(' ').replace(/\s+/g, ' ').trim();
            paragraphs.push(paragraphText);
        }
        
        return { paragraphs, words };
    };

    const toggleTranscriptionVisibility = async () => {
        // If turning on translations, check coins and deduct
        if (!isTranscriptionVisible) {
            if (coinCount < 1) {
                Alert.alert('Insufficient Coins', 'You need at least 1 coin to show translations.');
                return;
            }
            
            try {
                await paymentService.subtractCoins(uid, 1, 'Show Translation');
                // Note: coinCount will be automatically updated by useCoinsSubscription hook
                setTranscriptionVisible(true);
                paragraphs.forEach((_, index) => handleTranslateParagraph(index));
            } catch (error) {
                Alert.alert('Error', 'Failed to process payment. Please try again.');
                console.error('Error deducting coins:', error);
            }
        } else {
            setTranscriptionVisible(false);
        }
    };

    // Create PanResponder for the waveform container
    const waveformPanResponder = React.useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => true,
                onMoveShouldSetPanResponder: () => true,
                onPanResponderGrant: (e) => {
                    setIsSeeking(true);
                    setIsThumbActive(true); // Use the same visual effect
                    handleWaveformTap(e);
                },
                onPanResponderMove: (e) => {
                    if (!sound || !audioDuration) return;
                    
                    const { locationX } = e.nativeEvent;
                    const percentage = Math.max(0, Math.min(locationX, sliderWidth)) / sliderWidth;
                    const newPosition = percentage * audioDuration;
                    
                    sound.setCurrentTime(newPosition);
                    setAudioPosition(newPosition);
                    
                    onAudioProgress({
                        currentTime: newPosition,
                        duration: audioDuration
                    });
                },
                onPanResponderRelease: () => {
                    setIsSeeking(false);
                    setIsThumbActive(false);
                },
            }),
        [audioDuration, sound, sliderWidth]
    );

    useEffect(() => {
      // Only auto-scroll if all conditions allow
      if (scrollViewRef.current && currentWordIndex.paraIndex !== undefined) {
        performAutoScroll(currentWordIndex.paraIndex);
      }
    }, [currentWordIndex.paraIndex, isUserScrolling, hasUserScrolledRef.current]);

    return (
        
        <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
            
            <View style={[styles.headerContainer2, {backgroundColor: colors.background2}]}>
                <Image source={require('../assets/logo12.png')} style={[styles.headerTitle, {tintColor: colors.text}]       } />
            </View>
                 <View style={[styles.headerContainer, {backgroundColor: colors.background2}]}>
                 <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back-ios-new" size={24} color="white" />
                               </TouchableOpacity>
                <Text style={[styles.header, {color: colors.text}]  }>
                    {fileName.length > 13 ? `${fileName.substring(0, 12)}...` : fileName}
                </Text>
                <View style={{ flexDirection: 'row' }}>
                    <TouchableOpacity style={styles.iconButton} onPress={handleShare}>
                        <MaterialIcons name="ios-share" size={24} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconButton} onPress={toggleSlider}>
                       <Image
                            source={require('../assets/more.png')}
                            style={[styles.icon, {tintColor: colors.primary}]}
                        />
                    </TouchableOpacity>
                </View>
            </View>
            {/* Header Section */}
          

{audioUrl && (
    <Animated.View style={[
        styles.audioPlayerContainer,
        {
          height: playerHeight,
          padding: playerPadding,
          borderRadius: playerPadding,
        }
      ]}>
        {/* Lottie Animation at the top */}
  
        {/* Container for inputRange: 120 */}
        <Animated.View style={[
            styles.audioControlsContainer2,
          {
            display: playerHeight.interpolate({
              inputRange: [75, 76], // Use a very small range for abrupt change
              outputRange: [1, 0], // 1 = 'flex', 0 = 'none' (REVERSED)
              extrapolate: 'clamp'
            }),
            opacity: playerHeight.interpolate({
              inputRange: [75, 76], // Use a very small range for abrupt change
              outputRange: [1, 0], // This creates an instant transition (REVERSED)
              extrapolate: 'clamp'
            }),
            zIndex: playerHeight.interpolate({
              inputRange: [75, 76],
              outputRange: [10, 0], // REVERSED
              extrapolate: 'clamp'
            }),
            transform: [
              {
                scale: playerHeight.interpolate({
                  inputRange: [35, 120],
                  outputRange: [0.8, 1],
                  extrapolate: 'clamp'
                })
              }
            ]
          }
        ]}>
       
            {/* Play/Pause Button */}
            <TouchableOpacity onPress={toggleAudioPlayback} style={styles.playButton}>
              <View style={[styles.playButton2]}>
                <Image
                  source={isAudioPlaying ? require('../assets/pause.png') : require('../assets/play.png')}
                  style={styles.playIcon2}
                />
              </View>
            </TouchableOpacity>
  
            {/* Slider (80% width) */}
            <Animated.View style={[
              styles.waveformBox2,
              {
                width: '80%', // Fixed 80% width
                height: playerHeight._value - 20,
              }
            ]}>
              <View style={[styles.waveformContainer, {
                height: playerHeight._value - 20,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center', // Center slider horizontally
              }]}>
                {/* Slider with Progress Trail */}
                <View 
                  style={styles.container69} 
                  onLayout={handleLayout}
                  onTouchEnd={handleWaveformTap}
                >
                <Slider
                  style={{ width: '100%', height: 40 }}
                  minimumValue={0}
                  maximumValue={audioDuration}
                  value={audioPosition}
                  onValueChange={handleValueChange}
                  onSlidingComplete={handleSlidingComplete}
                  minimumTrackTintColor="transparent"
                  maximumTrackTintColor="transparent"
                  thumbTintColor="orange" // Hide the default thumb
                />
              
                </View>
  
                {/* Lottie Animation for Waves */}
                <View 
                  style={styles.waveAnimationContainer}
                  onTouchEnd={handleWaveformTap}
                >
                  <LottieView
                    ref={waveAnimationRef}
                    source={require('../assets/waves.json')}
                    autoPlay={false} // We'll control play/pause manually
                    loop
                    style={styles.waveAnimation}
                  />
                  {/* Mask to Reveal Animation */}
                  <Animated.View
                    style={[
                      styles.mask,
                      {
                        width: `${100 - (audioPosition / audioDuration) * 100}%`, // Dynamic width based on progress
                      }
                    ]}
                  />
                </View>
              </View>
            </Animated.View>
        
        </Animated.View>
  
        {/* Container for inputRange: 60 */}
        <Animated.View style={[
          styles.audioControlsContainer,
          {
            display: playerHeight.interpolate({
              inputRange: [75, 76], // Use a very small range for abrupt change
              outputRange: [0, 1], // 0 = 'none', 1 = 'flex' (REVERSED)
              extrapolate: 'clamp'
            }),
            opacity: playerHeight.interpolate({
              inputRange: [75, 76], // Use a very small range for abrupt change
              outputRange: [0, 1], // This creates an instant transition (REVERSED)
              extrapolate: 'clamp'
            }),
            zIndex: playerHeight.interpolate({
              inputRange: [75, 76],
              outputRange: [0, 10], // REVERSED
              extrapolate: 'clamp'
            }),
            transform: [
              {
                scale: playerHeight.interpolate({
                  inputRange: [35, 120],
                  outputRange: [0.8, 1],
                  extrapolate: 'clamp'
                })
              }
            ]
          }
        ]}>
          {/* Slider (100% width) */}
          <Animated.View style={[
            styles.waveformBox,
            {
            marginTop: 10,
              width: '95%', // Full width
              height: playerHeight._value - 20,
            }
          ]}>
            <View style={[styles.waveformContainer, {
              height: playerHeight._value - 20,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center', // Center slider horizontally
            }]}>
              {/* Slider with Progress Trail */}
              <View style={styles.container69} onLayout={handleLayout}>
                <Slider
                  style={{ width: '100%', height: 40 }}
                  minimumValue={0}
                  maximumValue={audioDuration}
                  value={audioPosition}
                  onValueChange={handleValueChange}
                  onSlidingComplete={handleSlidingComplete}
                  minimumTrackTintColor="transparent"
                  maximumTrackTintColor="transparent"
                  thumbTintColor="transparent" // Hide the default thumb
                />
                {/* Custom Thumb - Draggable */}
                <View
                  {...thumbPanResponder.panHandlers}
                  style={[
                    styles.customThumb,
                    { left: thumbPosition -1 }, // Adjust for thumb width
                    isThumbActive && { 
                      width: 20, 
                      backgroundColor: '#ff8c00', 
                      borderColor: '#ffb700',
                   
                    }
                  ]}
                />
              </View>
  
              {/* Lottie Animation for Waves */}
              <View 
                style={styles.waveAnimationContainer2}
                {...waveformPanResponder.panHandlers}
              >
                <LottieView
                  source={require('../assets/waves.json')} // Add your Lottie animation JSON here
                  autoPlay={isAudioPlaying} // Sync with audio playback
                  loop
                  style={styles.waveAnimation2}
                />
                {/* Mask to Reveal Animation */}
                <Animated.View
                  style={[
                    styles.mask2,
                    {
                      width: `${100 - (audioPosition / audioDuration) * 100}%`, // Dynamic width based on progress
                    }
                  ]}
                />
              </View>
            </View>
          </Animated.View>
  
          {/* Time Container */}
          <View style={styles.timeContainer}>
            <Text style={[styles.timeText, styles.leftTime]}>{formatTime(audioPosition)}</Text>
            <Text style={[styles.timeText, styles.rightTime]}>{formatTime(audioDuration)}</Text>
          </View>
  
          {/* Additional Controls */}
          <Animated.View style={[styles.controls, {
            opacity: playerHeight.interpolate({
              inputRange: [35, 120],
              outputRange: [0, 1], // Visible at 35, hidden at 120
              extrapolate: 'clamp'
            })
          }]}>
            <TouchableOpacity onPress={() => setIsRepeatMode(!isRepeatMode)}>
              <Image
                source={require('../assets/repeat.png')}
                style={[
                  styles.navIcon2,
                  { tintColor: isRepeatMode ? 'orange' : 'gray' } // Change color based on state
                ]}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => seekAudio(-10)}>
              <Image
                source={require('../assets/backward.png')}
                style={styles.navIcon}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={toggleAudioPlayback}>
              <Image
                source={isAudioPlaying ? require('../assets/pause.png') : require('../assets/play.png')}
                style={styles.playIcon}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => seekAudio(10)}>
              <Image
                source={require('../assets/forward.png')}
                style={styles.navIcon}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setIsSpeedDropdownVisible(!isSpeedDropdownVisible)}>
                <View style={styles.speedButton}>
                    <Text style={[styles.speedButtonText, { color: playbackSpeed > 1 ? 'orange' : 'gray' }]}>
                        {playbackSpeed}x
                    </Text>
                </View>
            </TouchableOpacity>

            {isSpeedDropdownVisible && (
                <Modal
                    transparent={true}
                    animationType="fade"
                    visible={isSpeedDropdownVisible}
                    onRequestClose={() => setIsSpeedDropdownVisible(false)}
                >
                    <TouchableWithoutFeedback onPress={() => setIsSpeedDropdownVisible(false)}>
                        <View style={styles.modalOverlay}>
                            <View style={styles.speedPickerContainer}>
                                {[0.75, 1.0, 1.25, 1.5].map((speed) => (
                                    <TouchableOpacity
                                        key={speed}
                                        style={[
                                            styles.speedOption,
                                            playbackSpeed === speed && styles.selectedSpeedOption
                                        ]}
                                        onPress={() => togglePlaybackSpeed(speed)}
                                    >
                                        <Text style={[
                                            styles.speedOptionText,
                                            playbackSpeed === speed && styles.selectedSpeedOptionText
                                        ]}>
                                            {speed}x
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </Modal>
            )}
          </Animated.View>
        </Animated.View>
      </Animated.View>
)}




            <View style={styles.buttonsContainer}>
                <TouchableOpacity
                    style={[styles.button, selectedButton === 'transcription' ? styles.selectedButton : null]}
                    onPress={() => handleButtonPress('transcription')}>
                    {selectedButton === 'transcription' ? (
                        <LinearGradient
                            colors={['#13EF97', '#1D8EC4']} // Gradient colors
                            style={styles.gradientButton} // Use a new style for the gradient
                            start={{ x: 1, y: 0 }}
                            end={{ x: 0, y: 0 }}
                        >
                            <Text style={styles.buttonText2}>
                                {t('transcription')}
                            </Text>
                        </LinearGradient>
                    ) : (
                        <Text style={styles.buttonText}>
                            {t('transcription')}
                        </Text>
                    )}
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.button, selectedButton === 'mindMap' ? styles.selectedButton : null]}
                    onPress={() => handleButtonPress('mindMap')}>
                    {selectedButton === 'mindMap' ? (
                        <LinearGradient
                            colors={['#13EF97', '#1D8EC4']} // Gradient colors
                            style={styles.gradientButton} // Use a new style for the gradient
                            start={{ x: 1, y: 0 }}
                            end={{ x: 0, y: 0 }}
                        >
                            <Text style={styles.buttonText2}>
                                {t('mindMap')}
                            </Text>
                        </LinearGradient>
                    ) : (
                        <Text style={styles.buttonText}>
                            {t('mindMap')}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>
        


{isTranscriptionEmpty && (
    <Text style={[styles.generatingText, {color: colors.text}]}>Generating Transcription May take some time...</Text>
)}

            {selectedButton === 'transcription' && (
                <ScrollView 
                    ref={scrollViewRef}
                    style={styles.contentContainer}
                    onScroll={(event) => {
                        const offsetY = event.nativeEvent.contentOffset.y;
                        scrollY.setValue(offsetY);
                        
                        // IMPORTANT: User is actively scrolling - prevent ANY auto-scroll
                        // Set the mutex to prevent auto-scroll interference
                        isScrollingRef.current = true;
                        
                        // Store the user's scroll position
                        setUserScrollPosition(offsetY);
                        
                        // Mark that user is actively scrolling (blocks immediate auto-scroll)
                        setIsUserScrolling(true);
                        
                        // Mark that the user has manually scrolled
                        hasUserScrolledRef.current = true;
                        
                        // Cancel any pending reset of user scrolling state
                        if (userScrollTimeoutRef.current) {
                            clearTimeout(userScrollTimeoutRef.current);
                        }
                        
                        // Set a new timeout - after USER_SCROLL_TIMEOUT milliseconds,
                        // re-enable auto-scrolling if user doesn't scroll again
                        userScrollTimeoutRef.current = setTimeout(() => {
                            console.log("User scroll timeout elapsed - re-enabling auto-scroll");
                            setIsUserScrolling(false);
                            // Reset the hasUserScrolledRef flag to fully restore auto-scroll after timeout
                            hasUserScrolledRef.current = false;
                            // Release the scroll mutex after timeout
                            isScrollingRef.current = false;
                        }, USER_SCROLL_TIMEOUT);
                    }}
                    onScrollBeginDrag={() => {
                        // As soon as user begins dragging, block ALL auto-scrolling
                        console.log("User began scrolling - blocking auto-scroll");
                        isScrollingRef.current = true;
                        setIsUserScrolling(true);
                        hasUserScrolledRef.current = true;
                        
                        // Cancel any pending reset of user scrolling state
                        if (userScrollTimeoutRef.current) {
                            clearTimeout(userScrollTimeoutRef.current);
                        }
                    }}
                    onScrollEndDrag={() => {
                        // User finished dragging, but still respect their intent
                        console.log("User stopped dragging - still respecting manual position");
                        
                        // Cancel any pending reset of user scrolling state
                        if (userScrollTimeoutRef.current) {
                            clearTimeout(userScrollTimeoutRef.current);
                        }
                        
                        // Keep scrolling enabled for USER_SCROLL_TIMEOUT after user stops dragging
                        // This ensures the app won't immediately jump back to highlighted text
                        userScrollTimeoutRef.current = setTimeout(() => {
                            console.log("Scroll timeout elapsed - re-enabling auto-scroll");
                            setIsUserScrolling(false);
                            // Reset the hasUserScrolledRef flag to fully restore auto-scroll
                            hasUserScrolledRef.current = false;
                            // Release the scroll mutex after timeout
                            isScrollingRef.current = false;
                        }, USER_SCROLL_TIMEOUT);
                    }}
                    onMomentumScrollEnd={() => {
                        // Momentum scrolling ended, but still respect user's position
                        console.log("Momentum scroll ended - still respecting user position");
                        
                        // Cancel any pending reset of user scrolling state
                        if (userScrollTimeoutRef.current) {
                            clearTimeout(userScrollTimeoutRef.current);
                        }
                        
                        // Keep scrolling enabled for USER_SCROLL_TIMEOUT after momentum ends
                        // This ensures we won't jump back too quickly
                        userScrollTimeoutRef.current = setTimeout(() => {
                            console.log("Momentum scroll timeout elapsed - re-enabling auto-scroll");
                            setIsUserScrolling(false);
                            hasUserScrolledRef.current = false;
                            // Release the scroll mutex after timeout
                            isScrollingRef.current = false;
                        }, USER_SCROLL_TIMEOUT);
                    }}
                    showsVerticalScrollIndicator={true}
                    bounces={true}
                    scrollEventThrottle={16}
                >
                    
                    {paragraphs.map((para, index) => (
                        <View 
                            key={index} 
                            ref={ref => paragraphRefs.current[index] = ref}
                            style={[
                                styles.paragraphContainer,
                                styles.paragraphWrapper,
                                index === currentWordIndex.paraIndex && styles.highlightedParagraph
                            ]}>
                            {isSpeechToTextEnabled && (
                                <Text style={[styles.timestamp, {color: 'orange'}]}>
                                    {formatTime(wordTimings[index]?.start || 0)}
                                </Text>
                            )}
                            <View style={styles.paragraphRow}>
                                {editingStates[index] ? (
                                    <TextInput
                                        style={[
                                            styles.paragraphText,
                                            styles.editableText,
                                            // Remove the highlightedParagraph style when editing
                                        ]}
                                        value={para}
                                        onChangeText={(text) => {
                                            const newParagraphs = [...paragraphs];
                                            newParagraphs[index] = text;
                                            setParagraphs(newParagraphs);
                                        }}
                                        multiline
                                    />
                                ) : (
                                    index === currentWordIndex.paraIndex && wordTimings[index]?.words ? (
                                        <Text style={[styles.paragraphText, {color: colors.text}]}>
                                            {wordTimings[index].words.map((wordData, wordIdx) => {
                                                const word = wordData.punctuated_word || wordData.word;
                                                return (
                                                    <Text 
                                                        key={wordIdx} 
                                                        style={[wordIdx === currentWordIndex.wordIndex ? styles.highlightedWord : styles.word, {color: colors.text}]}
                                                        onPress={() => {
                                                            // Jump to this word's timestamp when clicked
                                                            if (sound && wordData.start !== undefined) {
                                                                const newPosition = wordData.start;
                                                                sound.setCurrentTime(newPosition);
                                                                setAudioPosition(newPosition);
                                                                
                                                                // If audio is playing, ensure the wave animation is also playing
                                                                if (isAudioPlaying && waveAnimationRef.current) {
                                                                    waveAnimationRef.current.play();
                                                                }
                                                                
                                                                console.log("User clicked word - explicitly overriding manual scroll");
                                                                // EXPLICIT USER ACTION: We should override manual scroll
                                                                // and reset all scroll-blocking flags since user explicitly
                                                                // wants to jump to this position
                                                                setIsUserScrolling(false);
                                                                hasUserScrolledRef.current = false;
                                                                isScrollingRef.current = false;
                                                                
                                                                // Cancel any pending reset of user scrolling state
                                                                if (userScrollTimeoutRef.current) {
                                                                    clearTimeout(userScrollTimeoutRef.current);
                                                                }
                                                                
                                                                // Force seeking state for immediate scroll
                                                                setIsSeeking(true);
                                                                
                                                                // Trigger progress update to update highlighted paragraph
                                                                onAudioProgress({
                                                                    currentTime: newPosition,
                                                                    duration: audioDuration
                                                                });
                                                                
                                                                // Reset seeking state after a short delay
                                                                setTimeout(() => {
                                                                    setIsSeeking(false);
                                                                }, 100);
                                                            }
                                                        }}
                                                    >
                                                        {word}{' '}
                                                    </Text>
                                                );
                                            })}
                                        </Text>
                                    ) : (
                                        <Text style={[
                                            styles.paragraphText,
                                            index === currentWordIndex.paraIndex && styles.highlightedParagraph
                                        ]}>
                                            {para}
                                        </Text>
                                    )
                                )}
                              
                            </View>
                            {/* Move the pencil icon above the paragraph */}
                            {isEditingEnabled && (
                                <TouchableOpacity 
                                    onPress={() => toggleEdit(index)}
                                    style={styles.editIconAbove}
                                >
                                    <Image
                                        source={require('../assets/pencil.png')}
                                        style={styles.pencilIcon}
                                    />
                                </TouchableOpacity>
                            )}
                            {isTranscriptionVisible && translations[index] && (
                                <Text style={styles.translatedText}>{translations[index]}</Text>
                            )}
                        </View>
                    ))}
                    
                    {/* Bottom margin with thank you message */}
                    <View style={styles.bottomMarginContainer}>
                        <Text style={styles.thankYouText}>
                            Thank you for using Matrix AI transcription services ❤️
                        </Text>
                    </View>
                </ScrollView>
            )}


{selectedButton === 'mindMap' && (
   <View style={styles.contentContainer}>
  {(!XMLData || XMLData === '') && !isMindMapGenerated ? (
    <View style={styles.mindMapContainer}>
      {isMindMapGenerating ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007BFF" />
          <Text style={styles.loadingText}>Generating Mind Map...</Text>
        </View>
      ) : (
        <View >
          <TouchableOpacity 
            onPress={handleGenerateMindMap}
            style={styles.generateMindMapButton}
          >
            <Text style={styles.generateButtonText}>Generate Mindmap -3</Text>
            <Image source={coin} style={styles.coinIcon} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  ) : (
    <>
      <ForceDirectedGraph 
        ref={graphRef}
        transcription={transcription} 
        uid={uid} 
        audioid={audioid} 
        xmlData={XMLData} 
      />

      <View style={{flexDirection: 'row', position: 'absolute', bottom: 10, left: 10}}>
        <TouchableOpacity 
          onPress={() => setIsFullScreen(true)} 
          style={[styles.centerFloatingButton ,{left: 30}]}
        >
          <Image
            source={require('../assets/maximize.png')}
            style={styles.buttonImage3}
          />
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => graphRef.current?.handleDownload()}
          style={[styles.centerFloatingButton, {left: 90}]}
        >
          <MaterialIcons name="file-download" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </>
  )}
</View>

)}


            {/* Floating Buttons */}
          
            <TouchableOpacity onPress={handleFloatingButtonPress} style={styles.floatingButton2}>
                <Image source={resizeIcon} style={styles.buttonImage} />
            </TouchableOpacity>

            {/* Full Screen Modal */}
            <Modal
                visible={isFullScreen}
                transparent={false}
                animationType="slide"
                onRequestClose={() => setIsFullScreen(false)}
            >
                <View style={[styles.fullScreenContainer, {backgroundColor: colors.background}]}>
                    <View style={styles.fullScreenGraphContainer}>
                        <ForceDirectedGraph transcription={transcription} uid={uid} audioid={audioid} xmlData={XMLData} />
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
          
      {/* Slider with Toggle Buttons */}
{isSliderVisible && (
    <View style={styles.sliderOverlay}>
        <TouchableOpacity 
            style={styles.sliderBackground}
            activeOpacity={1}
            onPress={handleOutsidePress}
        />
        
        <View style={styles.sliderContainer}>
            {/* Show Translation Section */}
            <View style={styles.sliderContent}>
                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <Text style={styles.sliderText}>{t('showTranslation')} -1</Text>
                    <Image source={coin} style={[styles.coinIcon, {marginLeft: 5}]} />
                </View>
                
                {/* Language Dropdown */}
                <View style={styles.pickerContainer2}>
             
             <TouchableOpacity onPress={() => setShowDropdown(!showDropdown)} >
             <LinearGradient
                            colors={['#13EF97', '#1D8EC4']} // Gradient colors
                            style={styles.gradientButton} // Use a new style for the gradient
                            start={{ x: 1, y: 0 }}
                            end={{ x: 0, y: 0 }}
                        >
             <Text style={styles.dropdownButtonText}>
               {languages.find(lang => lang.value === selectedLanguage)?.label || 'Select'}
             </Text>
             </LinearGradient>
         </TouchableOpacity>

         {/* Custom Dropdown Modal */}
         <Modal
  transparent={true}
  animationType="slide"
  visible={showDropdown}
  onRequestClose={() => setShowDropdown(false)}
>
  <TouchableWithoutFeedback onPress={() => setShowDropdown(false)}>
    <View style={styles.modalOverlay}>
        <View style={styles.pickerContainer}>
        <Picker
        selectedValue={selectedLanguage}
        style={styles.picker}
        itemStyle={styles.pickerItem}
        onValueChange={(itemValue) => handleSelectLanguage(itemValue)}
    >
        {languages.map((lang) => (
            <Picker.Item key={lang.value} label={lang.label} value={lang.value} />
        ))}
    </Picker>
                    </View>
    </View>
  </TouchableWithoutFeedback>
</Modal>
            </View>
                <Switch
                    value={isTranscriptionVisible}
                    onValueChange={toggleTranscriptionVisibility}
                />
            </View>

            {/* Show Editing Section */}
            <View style={styles.sliderContent}>
                <Text style={styles.sliderText}>{t('showEditing')}</Text>
                <Switch
                    value={isEditingEnabled}
                    onValueChange={toggleTextEditing}
                />
            </View>

            {/* Show Date Section */}
            <View style={styles.sliderContent}>
                <Text style={styles.sliderText}>{t('showTime')}</Text>
                <Switch
                    value={isSpeechToTextEnabled}
                    onValueChange={toggleSpeechToText}
                />
            </View>
        </View>
    </View>
)}

            {/* SRT Subtitle Button */}
            <TouchableOpacity 
                style={styles.srtButton}
                onPress={() => setIsSRTModalVisible(true)}
            >
                <MaterialIcons name="subtitles" size={24} color="#fff" />
            </TouchableOpacity>

            {/* SRT Subtitle Modal */}
            <SRTSubtitleModal
                visible={isSRTModalVisible}
                onClose={() => setIsSRTModalVisible(false)}
                wordsData={wordsData}
                currentTime={currentTime}
                isDarkMode={colors.isDarkMode}
                uid={uid}
            />

            {/* Display the Mind Map if it's toggled on */}
            {isLoading ? (
                <View style={styles.loaderContainer}>
                    <ActivityIndicator size="large" color="#007BFF" style={styles.loader} />
                </View>
            ) : (
                <>
       
                </>
            )}
        </SafeAreaView>
    );
    
};

const styles = StyleSheet.create({

    progressTrail: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        backgroundColor: 'white', // This acts as the mask
        overflow: 'hidden', // Ensures the Lottie animation is clipped
    },
    waveAnimation: {
        width: '100%', // Ensure the Lottie animation covers the entire width
        height: '100%', // Ensure the Lottie animation covers the entire height
    },
    container69: {
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        // Explicitly remove any shadow
        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
      },
     
    linePointer: {
        width: 2,
        height: 40,
        backgroundColor: 'orange', // Color of the line pointer
        borderRadius: 0, // No border radius for a straight line
    },
    waveAnimationContainer: {
        position: 'absolute',
        width: '100%', // Cover the entire waveform box
        height: '100%',
        borderRadius: 50,
        overflow: 'hidden', // Clip the animation
        zIndex: 10, // Ensure it's above other elements for better tapping
        // Explicitly remove any shadow
        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
    },
    waveAnimationContainer2: {
        position: 'absolute',
        width: '100%', // Cover the entire waveform box
        height: '100%',
        overflow: 'hidden', // Clip the animation
        marginBottom: -20,
       
    },
    waveAnimation: {
        width: '200%', // Full width
        height: '250%', // Full height
    },
    waveAnimation2: {
        width: '150%', // Full width
        height: '250%', // Full height
    
    },
    picker: {
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
        marginTop: 5,
        color: '#000000',
    },
    pickerItem: {
        color: '#000000',
    },
    
    mask: {
        position: 'absolute',
        right: 0, // Start from the right
        top: 0,
        bottom: 0,
        backgroundColor: '#F2F3F7', // Acts as the mask
        // Explicitly remove any shadow
        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
    },
    mask2: {
        position: 'absolute',
        right: 0, // Start from the right
        top: 0,
        bottom: 0,
        backgroundColor: 'white', // Acts as the mask
    },
    audioPlayerContainer: {
        marginTop: 4,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 2,
    },
    audioControlsContainer: {
        position: 'absolute',
        backgroundColor: '#D5D5D6FF',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%', // Adjust width as needed
        borderRadius:10,
    },
    audioControlsContainer2: {
       flexDirection:'row',
       alignItems: 'center',
       justifyContent: 'center',
      
       position: 'absolute',
       backgroundColor: '#D5D5D6FF',
       borderRadius:50,
       paddingLeft:15,
       paddingRight:15,
       marginTop:-5,
       width: '100%', // Adjust width as needed
       // Explicitly remove any shadow
       shadowColor: 'transparent',
       shadowOffset: { width: 0, height: 0 },
       shadowOpacity: 0,
       shadowRadius: 0,
       elevation: 0,
    },
    backButton: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: '#007bff',
       
        marginRight:10,
       
        zIndex:100,
      },
      headerIcon: {
        width: 24,
        height: 24,
        resizeMode: 'contain',
      },
    waveformBox: {
        backgroundColor: '#FFFFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius:10,
        width: '80%', // Adjust width as needed
    },
    waveformBox2: {
        justifyContent: 'center',
        alignItems: 'center',
     
        // Explicitly remove any shadow
       
    },
    waveformContainer: {
        borderRadius: 10,
        overflow: 'hidden',
        width: '100%',
        position: 'relative',
        justifyContent: 'center',
        paddingVertical: 10,
        minHeight: 80,
        // Explicitly remove any shadow
      
    },
   
    waveform: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        height: '100%',
    },
    waveformBar: {
        width: 4,
        backgroundColor: '#007bff',
        marginHorizontal: 1,
        borderRadius: 2,
        minHeight: 10,
    },
    timeContainer: {
        flexDirection: 'row',
        width: '100%',
        marginBottom: 10,
        paddingHorizontal: 10,
    },
    leftTime: {
        textAlign: 'left',
        flex: 1,
    },
    rightTime: {
        textAlign: 'right',
        flex: 1,
    },
    timeText: {
        fontSize: 14,
        color: '#666',
    },
    customThumb: {
        position: 'absolute',
        width: 6,
        height: 90,
        borderRadius: 8,
        backgroundColor: 'orange',
        zIndex: 200,
        elevation: 5,
     
        // Add a subtle inner glow to indicate it's interactive
        borderWidth: 2,
        borderColor: 'rgba(255, 190, 100, 0.7)',
      },
      headerTitle: {
        width: 250,
        height: 80,
        resizeMode: 'contain',
       
       
      },
    container: {
        flex: 1,
        backgroundColor: '#fff',
         
    },
    container2: {
        backgroundColor: '#2CF105FF',
        paddingVertical: 10,
      },
    headerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
       
        backgroundColor:'#fff',
    },
    headerContainer2: {
       
        alignItems: 'center',
        alignSelf:'center',
        marginTop:-40,
        marginBottom:-50,
        zIndex:100,
        padding: 16,
       
        backgroundColor:'#fff',
    },
    overlayButtonContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
       
      
    },
    
    blueButton: {
        backgroundColor: '#007BFF',
       width:150,
        borderRadius: 20,
        
       
        marginLeft: 120,
       
        padding: 8, // Adjust padding for better touch area
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5, // Adds shadow for Android
        shadowColor: '#000', // Adds shadow for iOS
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    detailIcon2: {
        width: 14,
        height: 14,
        resizeMode: 'contain',
    },
    convert:{
        marginRight:5,
        fontSize:12,
        color:'#fff',
            },
            convert2:{
                marginRight:5,
                fontSize:16,
                color:'#fff',
                    },
  
    translatedText: {
        color: '#007bff',
        fontSize: 16,
        marginTop: 4,
    },
    word: {
        color: '#fff',
        fontSize: 16,
        lineHeight: 24,
    },
    paragraphRow:{
flexDirection:'row',
    },
    playButton2:{
        marginRight:10,
    
        backgroundColor: '#007BFFFF',
        padding:10,
        borderRadius:50,
    },
    highlightedWord: {
        backgroundColor: '#007bff',
        color: '#ffffff',
        borderRadius: 4,
        paddingHorizontal: 2,
        fontSize: 16,
        lineHeight: 24,
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
      },
      dropdownList: {
        width: '100%',
        backgroundColor: 'white',
        borderTopLeftRadius: 10,
        borderTopRightRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 20,
      },
      dropdownItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 10,
        paddingHorizontal: 5,
      },
     
    
      timeContainer: {
        flexDirection: 'row',
        width: '100%',
        marginBottom: 10,
        paddingHorizontal: 10,
      },
      leftTime: {
        textAlign: 'left',
        flex: 1,
      },
      rightTime: {
        textAlign: 'right',
        flex: 1,
      },
      timeText: {
        fontSize: 14,
        color: '#666',
      },
      loadingContainer: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
      
      },
      loadingText: {
        color: '#666',
        fontSize: 16,
      },
      controls: {
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        alignItems: 'center',
        marginTop: -10,
        marginBottom:10,
      },
    
      icon2: {
        width: 30,
        height: 30,
        tintColor: '#ffffff',
      },
      progressContainer: {
        marginHorizontal: 10,
      },
      transcriptContainer: {
        marginTop: 20,
        paddingHorizontal: 10,
      },
      transcriptText: {
        fontSize: 16,
        marginVertical: 2,
      },
   
    
      navIcon: {
        width: 24,
        height: 24,
        tintColor: '#007bff',
        marginHorizontal: 40,
      },
      navIcon2: {
        width: 24,
        height: 24,
       
        marginHorizontal: -10,
      },
      playIcon: {
        width: 32,
        height: 32,
        tintColor: '#007bff',
      },
      playIcon2: {
        width: 32,
        height: 32,
        tintColor: '#ffffff',
      },
      separator: {
        height: 1,
        backgroundColor: '#E0E0E0',
        marginVertical: 5,
      },
      tickIcon: {
   
     alignSelf:'flex-end',
        width:20,
        height:20,
        tintColor:'#0076EDFF'
      },
    button: {
        flex: 1,
        borderColor: '#1D8EC4',
        borderWidth: 1,
     
        margin: 8,
        alignItems: 'center',
        borderRadius: 10,
    },
    button2: {
        marginTop: 20,
        alignSelf: 'center',
        padding: 10,
        backgroundColor: '#007bff',
        borderRadius: 5,
      },
    buttonText: {
        color: '#007BFF',
        fontWeight: '600',
        marginVertical:5,
    },
    buttonText2: {
        color: '#fff',
        fontWeight: '600',
    },
    buttonsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginHorizontal: 16,
        marginTop:10,
    },
    dropdownButton: {
        padding: 5,
        backgroundColor: '#007BFF',
        borderRadius: 5,
        width: '100%',
        alignItems: 'center',
    },
    dropdownButtonText: {
        color: '#fff',
        fontSize: 12,
    },
  
    dropdownList: {
        backgroundColor: '#fff',
        width: '100%',
        borderRadius: 10,
   
    },
    selectedButton: {
      
        borderWidth:0,
        borderRadius:10,
        marginVertical:5,
    },
    dropdownItem: {
        paddingVertical: 10,
        paddingHorizontal: 15,
    },
    dropdownItemText: {
        fontSize: 16,
    },
    paragraphContainer: {
        marginBottom: 16,
    },
    paragraphWrapper: {
        padding: 8,
        borderRadius: 4,
    },
    highlightedParagraph: {
        backgroundColor: '#007bff20',
        borderLeftWidth: 4,
        borderLeftColor: '#007bff',
        paddingLeft: 12,
    },
    paragraphText: {
        fontSize: 16,
        lineHeight: 24,
        color: '#333',
        flex: 1,
        marginBottom: 8,
    },
    editableText: {
        fontSize: 16,
        lineHeight: 24,
        color: '#333',
        flex: 1,
        padding: 8,
        backgroundColor: '#f8f9fa',
        borderRadius: 4,
    },
    timestamp: {
        fontSize: 12,
        marginBottom: 4,
        fontWeight: '500',
    },
    
    mindMapContainer: {
        padding: 20,
       
        borderRadius: 10,
        marginTop: 10,
    },
    loader: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex:1000,
    },
    loaderContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        zIndex: 1000,
    },

    mindMapText: {
        fontSize: 18,
        color: '#333',
    },
   header: {
    fontSize: 13,
    fontWeight: '600',
zIndex:101,
    alignSelf:'center',

   
},

    iconButton: {
        padding: 8,
        zIndex:101,
    },
    icon: {
        width: 24,
        height: 24,
        resizeMode: 'contain',
        zIndex:101,
    },
    languageInput: {
        fontSize: 16,
        marginBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#007bff',
    },
  
 
 
    buttonText2: {
        color: '#fff',
        fontWeight: '600',
    },
    contentContainer: {
        flex: 1,
        paddingHorizontal: 16,
    },
    transcriptionRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    content: {
        fontSize: 16,
        lineHeight: 24,
        color: '#333',
        flex: 1,
    },
    content2: {
        fontSize: 12,
        lineHeight: 24,
        color: '#8A8A8AAE',
        flex: 1,
    },
    languageDropdownContainer: {
        position: 'absolute', // Position it absolutely at the top
        top: 20, // Adjust this as necessary to position it where you want
        left: 10,
        right: 10,
        zIndex: 10, // Ensure it appears above other elements
    },
    pickerContainer: {
        width: '70%',
        height:'30%',
      backgroundColor:'#fff',
      borderRadius:10,
      padding:10,
        
    },
    pickerContainer2: {
        width: '40%',
      
    },
    languageSelector: {
        marginVertical: 15,
    },
    picker: {
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
        marginTop: 5,
        fontSize:12,
        color:'#000',
    },
    dropDownStyle: {
        backgroundColor: '#fafafa',
        maxHeight: 200, // Limit the height of the dropdown
    },
    textInput: {
        fontSize: 16,
        lineHeight: 24,
        color: '#333',
        flex: 1,
        borderBottomWidth: 1,
        borderBottomColor: '#007bff',
    },
   
    floatingButton2: {
        position: 'absolute',
        bottom: 50,
        right: 30,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#007BFF',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 101,
        shadowColor: '#007BFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 10,
        elevation: 10,
    },
    srtButton: {
        position: 'absolute',
        bottom: 120,
        right: 30,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#FF6600',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 101,
        shadowColor: '#FF6600',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 10,
        elevation: 10,
    },
    buttonImage: {
        width: 60,
        height: 60,
        resizeMode: 'contain',
    },
    buttonImage2: {
        width: 40,
        height: 40,
        resizeMode: 'contain',
    },
    buttonImage3: {
        width: 30,
        height: 30,
      
        resizeMode: 'contain',
        tintColor:'#ffffff',
    },
    buttonImage4: {
        width: 30,
        height: 30,
      
        resizeMode: 'cover',
        tintColor:'#ffffff',
    },
    sliderOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 105,
    },
    sliderBackground: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    sliderContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'white',
        padding: 16,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
     
        elevation: 5,
    },
    sliderContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    sliderText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#333',
    },
   
    languageLabel: {
        fontSize: 14,
        color: '#666',
        marginBottom: 4,
    },
    picker: {
        width: '100%',
        height: 40,
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 10,
        width: '80%',
    },
    modalText: {
        fontSize: 18,
        marginBottom: 20,
    },
    closeButton: {
        backgroundColor: '#FF6600',
        padding: 10,
        borderRadius: 5,
        alignItems: 'center',
    },
    closeButtonText: {
        color: '#fff',
        fontSize: 16,
    },
    centerFloatingButton: {
        position: 'absolute',
        bottom: 7,
        left: 70,
        marginLeft: -30, // Half of button width to center
        width: 50,
        height: 50,
        borderRadius: 30,
        backgroundColor: '#007BFF',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100,
       
    },
   
    centerFloatingButton2: {
        position: 'absolute',
        bottom: 160,
        marginLeft: 25,
        width: 50,
        height: 50,
        borderRadius: 30,
        backgroundColor: '#007BFF',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100,
       
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
        zIndex: 1005,
     
    },
    closeIcon: {
        width: 20,
        height: 20,
        tintColor: '#fff',
    },
    pencilIcon: {
        width: 20,
        height: 20,
        tintColor: '#007bff',
        marginLeft: 8,
    },
    editIcon: {
        padding: 4,
    },
    editIconAbove: {
        position: 'absolute',
        right: 10, // Adjust as necessary for spacing
        top: 5, // Position it above the paragraph
        zIndex: 1, // Ensure it appears above other elements
    },
    gradientButton: {
       width:'100%',
       height:30,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius:10,
        marginTop:3,
    },
    squareModal: {
        width: 100,
        height: 100,
        backgroundColor: 'white',
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    speedButton: {
        borderRadius: 15,
        paddingHorizontal: 8,
        paddingVertical: 4,
        marginHorizontal: -10,
        backgroundColor: '#f0f0f0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    speedButtonText: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    speedOption: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        width: '100%',
        alignItems: 'center',
    },
    selectedSpeedOption: {
        backgroundColor: '#f0f0f0',
        borderRadius: 5,
    },
    speedOptionText: {
        fontSize: 16,
        color: '#333',
    },
    selectedSpeedOptionText: {
        color: 'orange',
        fontWeight: 'bold',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    speedPickerContainer: {
        backgroundColor: 'white',
        borderRadius: 10,
        padding: 10,
        width: '40%',
        alignItems: 'center',
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    generateButtonContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
   centeredButtonWrapper: {
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
},

generateMindMapButton: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent:'center',
  backgroundColor: '#007BFF',
  paddingVertical: 14,
  paddingHorizontal: 24,
  borderRadius: 12,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 3.84,
  elevation: 5,
},


    coinIcon: {
        width: 20,
        height: 20,
      
        resizeMode: 'contain',
    },
    generateButtonText: {
        color: '#fff',
        fontSize: 16,
      
        fontWeight: '600',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
    },
    bottomMarginContainer: {
        marginTop: 100,
        paddingHorizontal: 16,
        paddingBottom: 10,
    },
    thankYouText: {
        fontSize: 36,
        color: '#666',
        opacity: 0.3,
        textAlign: 'left',
        fontWeight: 'bold',
    },
});

export default TranslateScreen;
