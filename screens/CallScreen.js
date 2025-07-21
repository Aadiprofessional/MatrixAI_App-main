import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert, Platform, Animated, Dimensions } from 'react-native';
import Tts from 'react-native-tts'; // Import for text-to-speech
import { SafeAreaView } from 'react-native-safe-area-context';
import Lottie from 'lottie-react-native';
import { useNavigation } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Buffer } from 'buffer';
import AudioRecord from 'react-native-audio-record';
import RNFS from 'react-native-fs';
import pako from 'pako';
import { v4 as uuidv4 } from 'uuid';
import 'react-native-get-random-values';
import { PERMISSIONS, request, check, RESULTS, openSettings } from 'react-native-permissions';

let dataSubscription = null;
let websocketConnection = null;
let chunkStartTime = 0; // Track when we started collecting the current chunk
let currentChunkBuffers = []; // Collect raw buffer chunks instead of base64 strings
let chunkCounter = 0; // Counter for chunks
let websocketReady = false; // Flag to indicate when WebSocket is fully ready to receive audio

// TextDecoder polyfill for React Native
const decodeUTF8 = (bytes) => {
  return Buffer.from(bytes).toString('utf8');
};

// Function to create a WAV file from PCM data
const createWavFile = (pcmData, sampleRate = 16000, bitsPerSample = 16, channels = 1) => {
  // Calculate sizes
  const dataSize = pcmData.length;
  const headerSize = 44; // Standard WAV header size
  const totalSize = headerSize + dataSize;
  
  // Create a buffer for the WAV file
  const wavBuffer = Buffer.alloc(totalSize);
  
  // Write WAV header
  // "RIFF" chunk descriptor
  wavBuffer.write('RIFF', 0, 'ascii');
  wavBuffer.writeUInt32LE(36 + dataSize, 4); // Chunk size (file size - 8)
  wavBuffer.write('WAVE', 8, 'ascii');
  
  // "fmt " sub-chunk
  wavBuffer.write('fmt ', 12, 'ascii');
  wavBuffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  wavBuffer.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
  wavBuffer.writeUInt16LE(channels, 22); // NumChannels
  wavBuffer.writeUInt32LE(sampleRate, 24); // SampleRate
  wavBuffer.writeUInt32LE(sampleRate * channels * bitsPerSample / 8, 28); // ByteRate
  wavBuffer.writeUInt16LE(channels * bitsPerSample / 8, 32); // BlockAlign
  wavBuffer.writeUInt16LE(bitsPerSample, 34); // BitsPerSample
  
  // "data" sub-chunk
  wavBuffer.write('data', 36, 'ascii');
  wavBuffer.writeUInt32LE(dataSize, 40); // Subchunk2Size
  
  // Copy PCM data
  pcmData.copy(wavBuffer, headerSize);
  
  return wavBuffer;
};

// Generate a simple UUID for tracing
const generateSimpleUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Utility function to normalize file paths across platforms
const normalizeFilePath = (filePath) => {
  if (!filePath) return null;
  
  // Handle iOS symlinks and double prefixing issues
  if (Platform.OS === 'ios') {
    // Remove double prefixing if it exists
    if (filePath.includes('/Documents//var/mobile/')) {
      // Replace the double prefix with just the DocumentDirectoryPath
      return filePath.replace(
        /^\/var\/mobile\/.*Documents\/\/var\/mobile\/.*Documents\//,
        `${RNFS.DocumentDirectoryPath}/`
      );
    }
    
    // Handle /private prefix (symlink in iOS)
    if (filePath.startsWith('/private/')) {
      return filePath.replace(/^\/private/, '');
    }
  }
  
  return filePath;
};

// Helper to check if a file exists with proper error handling
const fileExists = async (path) => {
  if (!path) return false;
  
  try {
    const normalizedPath = normalizeFilePath(path);
    return await RNFS.exists(normalizedPath);
  } catch (error) {
    console.error('Error checking if file exists:', error);
    return false;
  }
};

const CallScreen = ({ navigation }) => {

  const [transcribedText, setTranscribedText] = useState('');
  const [responseText, setResponseText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [conversation, setConversation] = useState([]);
  const [callActive, setCallActive] = useState(true);
  const [ttsReady, setTtsReady] = useState(false);
  const [animationSpeed, setAnimationSpeed] = useState(0.5);
  const [countdownSeconds, setCountdownSeconds] = useState(0);
  // Add new states for the new features
  const [showRoleSlider, setShowRoleSlider] = useState(false);
  const [showTextContainer, setShowTextContainer] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentRole, setCurrentRole] = useState('Assistant');
  const [animationMode, setAnimationMode] = useState('normal');
  
  // WebSocket and recording states
  const [recording, setRecording] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [loadingPermission, setLoadingPermission] = useState(true);
  const [audioPath, setAudioPath] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isStartingRecording, setIsStartingRecording] = useState(false);
  
  // Store conversation history for DeepSeek
  const conversationHistory = useRef([
    {
      role: "system",
      content: "You are an AI assistant on a phone call. Keep your responses brief and conversational as if speaking on the phone. Limit responses to 1-3 sentences. Remember previous parts of our conversation for context."
    }
  ]);
  
  // WebSocket and audio recording refs
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const sequenceNumber = useRef(0);
  const connectIdRef = useRef(uuidv4());
  const websocketPausedRef = useRef(false);
  const pausedAudioBufferRef = useRef([]);
  
  // Other refs
  const isProcessing = useRef(false);
  const ttsFinishListener = useRef(null);
  const silenceTimer = useRef(null);
  
  // Animation refs
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const aiAnimationRef = useRef(null);
  const audioWavesRef = useRef(null);
  const pulseAnimation = useRef(new Animated.Value(1)).current;
  const roleSliderAnim = useRef(new Animated.Value(0)).current;
  
  const lastTranscribedText = useRef('');
  const lastTextChangeTime = useRef(Date.now());
  const animationRef = useRef(null);
  const countdownInterval = useRef(null);
  const silenceCheckInterval = useRef(null);
  const countdownEffectInterval = useRef(null);
  const responseTimer = useRef(null);
  
  // Add a reference to track the last processed text
  const lastProcessedText = useRef('');

  // Add a ref for maximum recording duration timer
  const maxRecordingTimer = useRef(null);
  
  // Function to handle AI speaking animation
  const startSpeakingAnimation = () => {
    setIsSpeaking(true);
    setAnimationMode('speaking');
    setAnimationSpeed(1.5);
    
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 1.2,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 0.8,
          duration: 300,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };
  
  const stopSpeakingAnimation = () => {
    setIsSpeaking(false);
    setAnimationMode('normal');
    setAnimationSpeed(0.5);
    
    pulseAnimation.setValue(1);
    Animated.timing(pulseAnimation).stop();
  };
  
  // Add a new function for thinking animation
  const startThinkingAnimation = () => {
    setAnimationMode('thinking');
    setAnimationSpeed(0.3);
    
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 1.1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 0.9,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };
  
  // Role slider animation
  const toggleRoleSlider = () => {
    const toValue = showRoleSlider ? 0 : 1;
    setShowRoleSlider(!showRoleSlider);
    
    Animated.spring(roleSliderAnim, {
      toValue,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };
  
  // Select a role
  const selectRole = (role) => {
    setCurrentRole(role);
    // Update the system prompt based on the selected role
    const rolePrompts = {
      'Assistant': "You are an AI assistant on a phone call. Keep your responses brief and conversational as if speaking on the phone.",
      'Teacher': "You are an AI teacher on a phone call. Explain concepts clearly and provide educational guidance.",
      'Mathematician': "You are an AI mathematician on a phone call. Help solve math problems and explain mathematical concepts.",
      'English Teacher': "You are an AI English teacher on a phone call. Help with language learning, grammar, and vocabulary.",
      'Programmer': "You are an AI programming expert on a phone call. Help with coding problems and explain programming concepts.",
      'Singer': "You are an AI singer on a phone call. You can create lyrics, discuss music theory, and talk about songs."
    };
    
    conversationHistory.current = [
      {
        role: "system",
        content: rolePrompts[role] + " Limit responses to 1-3 sentences. Remember previous parts of our conversation for context."
      }
    ];
    
    // Close the slider after selection
    toggleRoleSlider();
  };
  
  // Add rotation animation
  useEffect(() => {
    const startRotationAnimation = () => {
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 10000,
          useNativeDriver: true,
        })
      ).start();
    };
    
    startRotationAnimation();
  }, []);
  
  // Calculate rotation interpolation
  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  // Add effect to handle animation mode changes
  useEffect(() => {
    if (animationMode === 'normal') {
      setAnimationSpeed(0.5);
      pulseAnimation.setValue(1);
      Animated.timing(pulseAnimation).stop();
    } else if (animationMode === 'thinking') {
      startThinkingAnimation();
    } else if (animationMode === 'speaking') {
      startSpeakingAnimation();
    }
  }, [animationMode]);

  // Initialize TTS and audio recording
  useEffect(() => {
    const setup = async () => {
      // For iOS, bypass permission check
      if (Platform.OS === 'ios') {
        setPermissionGranted(true);
        await initializeAudioRecorder();
      } else {
        const hasPermission = await checkPermission();
        if (hasPermission) {
          await initializeAudioRecorder();
        } else {
          console.log('Permission not granted in initial setup');
        }
      }
      setLoadingPermission(false);
      
      // Setup TTS
      try {
        // Set up TTS finish listener
        ttsFinishListener.current = Tts.addEventListener('tts-finish', () => {
          console.log('TTS finished speaking');
          stopSpeakingAnimation();
          isProcessing.current = false;
        });
        
        // Set TTS ready state
        setTtsReady(true);
      } catch (error) {
        console.error('Error setting up TTS:', error);
      }
    };
    
    setup();
    
    // Add rotation animation
    const startRotationAnimation = () => {
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 10000,
          useNativeDriver: true,
        })
      ).start();
    };
    
    startRotationAnimation();
    
    // Cleanup
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      if (dataSubscription) {
        dataSubscription.remove();
        dataSubscription = null;
      }
      
      if (websocketConnection) {
        websocketConnection.close();
        websocketConnection = null;
      }
      
      if (ttsFinishListener.current) {
        ttsFinishListener.current.remove();
      }
      
      Tts.stop();
      AudioRecord.stop();
    };
  }, []);
  
  // Start call when TTS is ready
  useEffect(() => {
    if (ttsReady && permissionGranted) {
      startCall();
    }
  }, [ttsReady, permissionGranted]);

  const checkPermission = async () => {
    try {
      console.log('[Permissions] Checking microphone permission');
      if (Platform.OS === 'android') {
        const result = await check(PERMISSIONS.ANDROID.RECORD_AUDIO);
        console.log('[Permissions] Android permission check result:', result);
        
        if (result === RESULTS.GRANTED) {
          console.log('[Permissions] Microphone permission already granted');
          setPermissionGranted(true);
          return true;
        } else if (result === RESULTS.DENIED) {
          console.log('[Permissions] Microphone permission denied, requesting...');
          const requestResult = await request(PERMISSIONS.ANDROID.RECORD_AUDIO);
          console.log('[Permissions] Permission request result:', requestResult);
          const isGranted = requestResult === RESULTS.GRANTED;
          setPermissionGranted(isGranted);
          return isGranted;
        } else {
          // BLOCKED or UNAVAILABLE
          console.log('[Permissions] Microphone permission blocked or unavailable');
          setPermissionGranted(false);
          Alert.alert(
            'Microphone Permission Required',
            'This app needs access to your microphone. Please enable microphone permission in your device settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => openSettings() }
            ]
          );
          return false;
        }
      } else {
        // For iOS, try to request permissions explicitly
        try {
          const iosResult = await check(PERMISSIONS.IOS.MICROPHONE);
          console.log('[Permissions] iOS microphone permission check result:', iosResult);
          
          if (iosResult === RESULTS.DENIED) {
            const requestResult = await request(PERMISSIONS.IOS.MICROPHONE);
            console.log('[Permissions] iOS permission request result:', requestResult);
          }
          
          // We'll set as granted regardless since iOS audio can work in various ways
          console.log('[Permissions] Setting iOS permissions as granted');
          setPermissionGranted(true);
          return true;
        } catch (iosError) {
          console.log('[Permissions] Error with iOS permissions, setting as granted anyway:', iosError);
          setPermissionGranted(true);
          return true;
        }
      }
    } catch (error) {
      console.error('[Permissions] Error checking permissions:', error);
      setError(`Permission error: ${error.message}`);
      // For iOS, return true anyway to bypass permission issues
      if (Platform.OS === 'ios') {
        setPermissionGranted(true);
        return true;
      }
      return false;
    }
  };

  const initializeAudioRecorder = async () => {
    try {
      console.log('[Audio] Initializing AudioRecord...');
      
      // Clean up any existing listeners first to avoid "Invalid event" error
      if (dataSubscription) {
        console.log('[Audio] Removing existing data subscription');
        dataSubscription.remove();
        dataSubscription = null;
      }
      
      // Stop any existing recording
      try {
        console.log('[Audio] Stopping any existing recording');
        await AudioRecord.stop();
      } catch (e) {
        console.log('[Audio] No active recording to stop');
      }
      
      // Create a unique path for each recording to avoid conflicts
      const recordingId = Date.now().toString();
      
      // Ensure we have a clean, standardized path for iOS to avoid double prefixing
      let tempFilePath;
      if (Platform.OS === 'ios') {
        // Use RNFS.DocumentDirectoryPath directly instead of constructing the path
        tempFilePath = `${RNFS.DocumentDirectoryPath}/recording_${recordingId}.wav`;
        console.log('[Audio] iOS recording path:', tempFilePath);
      } else {
        tempFilePath = `${RNFS.DocumentDirectoryPath}/recording_${recordingId}.wav`;
        console.log('[Audio] Android recording path:', tempFilePath);
      }
      
      // Remove any existing file with the same name
      try {
        if (await fileExists(tempFilePath)) {
          console.log('[Audio] Removing existing file at path:', tempFilePath);
          await RNFS.unlink(tempFilePath);
        }
      } catch (err) {
        console.error('[Audio] Error checking/removing existing file:', err);
        // Continue anyway, it might still work
      }
      
      // Options optimized for both platforms
      const options = {
        sampleRate: 16000,  // 16kHz as required by API
        channels: 1,        // Mono
        bitsPerSample: 16,  // 16-bit
        audioSource: Platform.OS === 'android' ? 6 : 0,  // MIC source type
        // Set a clear, unique file path for each recording
        wavFile: Platform.OS === 'ios' ? `recording_${recordingId}.wav` : tempFilePath,
        // Add buffer size configuration - important for iOS
        bufferSize: Platform.OS === 'ios' ? 4096 : 8192,
      };
      
      console.log('[Audio] Initializing AudioRecord with options:', JSON.stringify(options));
      
      // Initialize with a promise wrapper to handle exceptions better
      await new Promise((resolve, reject) => {
        try {
          AudioRecord.init(options);
          console.log('[Audio] AudioRecord initialized successfully');
          resolve();
        } catch (error) {
          console.error('[Audio] Error in AudioRecord.init():', error);
          reject(error);
        }
      });
      
      // For both platforms, set up the audio data listener
      setupAudioListener();
      
      // Store the audio path
      setAudioPath(tempFilePath);
      
      console.log('[Audio] Initialization complete');
      
      return true;
    } catch (error) {
      console.error('[Audio] Error initializing audio recorder:', error);
      setError(`Audio init error: ${error.message}`);
      return false;
    }
  };

  const startCall = async () => {
    // Wait a moment before greeting to ensure TTS is ready
    setTimeout(() => {
      const greeting = "Hello, how can I help you?";
      
      // Add greeting to conversation
      addToConversation('AI', greeting);
      
      // Add to DeepSeek history
      conversationHistory.current.push({
        role: "assistant",
        content: greeting
      });
      
      // Start speaking animation for AI greeting
      startSpeakingAnimation();
      
      // Remove any existing TTS finish listener before speaking
      if (ttsFinishListener.current) {
        ttsFinishListener.current.remove();
        ttsFinishListener.current = null;
      }
      
      // Set up the TTS finish listener BEFORE speaking
      ttsFinishListener.current = Tts.addEventListener('tts-finish', () => {
        console.log('TTS finished speaking greeting');
        
        // Stop speaking animation
        stopSpeakingAnimation();
        
        // Make sure processing flag is reset
        isProcessing.current = false;
        
        // Remove listener to prevent multiple triggers
        if (ttsFinishListener.current) {
          ttsFinishListener.current.remove();
          ttsFinishListener.current = null;
        }
        
        // Connect to WebSocket and start recording after greeting
        if (callActive) {
          console.log('AI finished greeting, connecting WebSocket and starting recording...');
          connectToWebSocket();
          // Give WebSocket a moment to connect before starting recording
          setTimeout(() => {
            startRecording();
          }, 1000);
        }
      });
      
      // Speak the greeting AFTER setting up the listener
      try {
        console.log('Speaking greeting:', greeting);
        Tts.speak(greeting);
      } catch (err) {
        console.error('TTS speak error:', err);
        // If speaking fails, still connect WebSocket and start listening
        if (callActive) {
          setTimeout(() => {
            connectToWebSocket();
            startRecording();
          }, 500);
        }
      }
    }, 1000);
  };

  const addToConversation = (speaker, text) => {
    setConversation(prev => [...prev, { speaker, text }]);
  };

  const startRecording = async () => {
    // Don't start recording if AI is speaking or we're processing
    if (isSpeaking || isProcessing.current || !callActive) {
      console.log('[Recording] Cannot start - AI is speaking or call not active');
      return;
    }
    
    console.log('[Recording] Starting recording...');
    
    try {
      // Check if we're connected to the WebSocket
      if (!isConnected || !websocketConnection) {
        console.log('[Recording] WebSocket not connected, connecting now...');
        connectToWebSocket();
        
        // Wait for WebSocket to connect and initialize
        let attempts = 0;
        const maxAttempts = 10;
        
        while (!websocketReady && attempts < maxAttempts) {
          console.log(`[Recording] Waiting for WebSocket to be ready (attempt ${attempts + 1}/${maxAttempts})...`);
          await new Promise(resolve => setTimeout(resolve, 500));
          attempts++;
        }
        
        if (!websocketReady) {
          console.error('[Recording] WebSocket failed to become ready after waiting');
          setError('Unable to connect to transcription service. Please try again.');
          return;
        }
      }
      
      // Reset the WebSocket pause flag
      websocketPausedRef.current = false;
      
      // Reset audio parameters before starting
      audioChunksRef.current = [];
      currentChunkBuffers = [];
      chunkStartTime = Date.now();
      chunkCounter = 0;
      
      // Clear any previous transcription
      setTranscribedText('');
      
      // Start the audio recording
      console.log('[Recording] Starting AudioRecord...');
      await AudioRecord.start();
      
      // Update state
      setRecording(true);
      
      // Start the AudioWaves animation
      if (audioWavesRef.current) {
        audioWavesRef.current.play();
      }
      
      // Set animation state for user speaking
      setAnimationSpeed(1.0);
      
      // Clear any existing max recording timer
      if (maxRecordingTimer.current) {
        clearTimeout(maxRecordingTimer.current);
      }
      
      // Set maximum recording duration (10 seconds)
      maxRecordingTimer.current = setTimeout(() => {
        if (recording) {
          console.log('[Recording] Maximum recording duration reached (10s), stopping recording');
          const currentText = transcribedText;
          stopRecording();
          
          // Only send to API if we have a valid transcription
          if (currentText && currentText.trim().length > 5) {
            sendToApi(currentText);
          }
        }
      }, 10000); // 10 seconds maximum recording time
      
      console.log('[Recording] Recording started successfully');
    } catch (error) {
      console.error('[Recording] Error starting recording:', error);
      setError(`Recording error: ${error.message}`);
    }
  };

  const stopRecording = async () => {
    if (!recording) {
      console.log('[Recording] Not recording, ignoring stop recording call');
      return;
    }
    
    // Clear the maximum recording timer
    if (maxRecordingTimer.current) {
      clearTimeout(maxRecordingTimer.current);
      maxRecordingTimer.current = null;
    }
    
    console.log('[Recording] Stopping recording...');
    
    try {
      // Stop the AudioWaves animation first
      if (audioWavesRef.current) {
        audioWavesRef.current.pause();
      }
      
      // Set the WebSocket to paused so we don't send more audio
      websocketPausedRef.current = true;
      
      // Stop the audio recording
      const audioFile = await AudioRecord.stop();
      console.log(`[Recording] Stopped, audio file: ${audioFile}`);
      
      // Update state
      setRecording(false);
      
      // Check if we got a valid audio file
      if (!audioFile) {
        console.warn('[Recording] No audio file was produced');
        setError('No audio was recorded. Please try again.');
        return;
      }
      
      // Send the final audio chunk with the isLastChunk flag
      // Get the absolute path
      let audioFilePath;
      if (Platform.OS === 'ios') {
        audioFilePath = `${RNFS.DocumentDirectoryPath}/${audioFile}`;
      } else {
        audioFilePath = audioFile;
      }
      
      // Verify file exists
      const exists = await fileExists(audioFilePath);
      if (!exists) {
        console.error(`[Recording] Audio file not found at ${audioFilePath}`);
        setError('Recorded audio file not found. Please try again.');
        return;
      }
      
      console.log(`[Recording] Sending final audio from file: ${audioFilePath}`);
      
      // Send the final audio to complete the transcription
      await sendFinalAudioToWebsocket(audioFilePath);
      
      // Get the current transcription and use it if it's valid
      const currentTranscription = transcribedText;
      if (currentTranscription && currentTranscription.trim() !== '') {
        console.log(`[Recording] Using transcription: "${currentTranscription}"`);
        sendToApi(currentTranscription);
      } else {
        console.warn('[Recording] No transcription available after stopping');
        setError('No speech was detected. Please try again.');
        
        // If no transcription, restart recording after a delay
        if (callActive && !isSpeaking) {
          setTimeout(() => {
            startRecording();
          }, 1500);
        }
      }
    } catch (error) {
      console.error('[Recording] Error stopping recording:', error);
      setError(`Error stopping recording: ${error.message}`);
      
      // Try to recover by resetting state
      setRecording(false);
      
      // If AI isn't already speaking, restart recording
      if (!isSpeaking && callActive) {
        setTimeout(() => {
          startRecording();
        }, 1500);
      }
    }
  };
  
  const sendFinalAudioToWebsocket = async (audioFilePath) => {
    if (!audioFilePath) {
      console.error('[WebSocket] No audio file path provided for final audio');
      return false;
    }
    
    if (!isConnected || !websocketConnection || websocketConnection.readyState !== WebSocket.OPEN) {
      console.error('[WebSocket] Cannot send final audio - WebSocket not connected');
      setError('WebSocket connection lost - please try again');
      return false;
    }
    
    try {
      // Normalize path for platform compatibility
      const normalizedPath = normalizeFilePath(audioFilePath);
      
      // Read the file stats
      const fileStats = await RNFS.stat(normalizedPath);
      console.log(`[WebSocket] Audio file size: ${fileStats.size} bytes`);
      
      if (fileStats.size <= 44) { // WAV header is 44 bytes
        console.warn('[WebSocket] Audio file is too small, might not contain actual audio data');
        setError('No audio data captured - please try again');
        return false;
      }
      
      // Read the file as base64
      console.log(`[WebSocket] Reading file from: ${normalizedPath}`);
      const wavData = await RNFS.readFile(normalizedPath, 'base64');
      
      // Convert to buffer
      const wavBuffer = Buffer.from(wavData, 'base64');
      console.log(`[WebSocket] Sending final audio file, size: ${wavBuffer.length} bytes`);
      
      // Pass true for isLastChunk to indicate this is the final chunk
      const success = sendAudioChunkToWebSocket(wavBuffer, true);
      
      if (success) {
        console.log('[WebSocket] Final audio sent successfully');
      } else {
        console.error('[WebSocket] Failed to send final audio');
        setError('Error sending final audio data');
      }
      
      return success;
    } catch (error) {
      console.error('[WebSocket] Error sending final audio file:', error);
      setError(`Error sending final file: ${error.message}`);
      return false;
    }
  };

  const sendToApi = async (text) => {
    console.log('sendToApi called with text:', text);
    
    // Set processing flag to prevent multiple requests
    isProcessing.current = true;
    
    // Make sure transcribed text is cleared again
    setTranscribedText('');
    
    // Start animation for AI thinking
    startThinkingAnimation();
    
    try {
      // Add to conversation
      addToConversation('You', text);
      
      // Add to DeepSeek history
      conversationHistory.current.push({
        role: "user",
        content: text
      });
      
      // Get AI response
      console.log('Sending request to DeepSeek API...');
      const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer 95fad12c-0768-4de2-a4c2-83247337ea89',
        },
        body: JSON.stringify({
          model: "doubao-pro-32k-241215",
          messages: conversationHistory.current,
          max_tokens: 150
        }),
      });
      
      const data = await response.json();
      console.log('Received response from DeepSeek API');
      const aiResponse = data.choices?.[0]?.message?.content || "I'm sorry, I couldn't process that.";
      
      // Update UI and conversation history
      setResponseText(aiResponse);
      addToConversation('AI', aiResponse);
      conversationHistory.current.push({
        role: "assistant",
        content: aiResponse
      });
      
      // Start speaking animation for AI response
      startSpeakingAnimation();
      
      // Remove any existing TTS listener
      if (ttsFinishListener.current) {
        ttsFinishListener.current.remove();
        ttsFinishListener.current = null;
      }
      
      // Set up TTS finish listener
      ttsFinishListener.current = Tts.addEventListener('tts-finish', () => {
        console.log('TTS finished speaking response');
        
        // Stop the speaking animation when TTS finishes
        stopSpeakingAnimation();
        
        // Make sure processing flag is reset
        isProcessing.current = false;
        
        // Remove listener to prevent multiple triggers
        if (ttsFinishListener.current) {
          ttsFinishListener.current.remove();
          ttsFinishListener.current = null;
        }
        
        // Start recording after AI response, but only if call is still active
        if (callActive) {
          setTimeout(() => {
            startRecording();
          }, 500);
        }
      });
      
      // Speak the AI response
      Tts.speak(aiResponse);
      
    } catch (error) {
      console.error('API error:', error);
      
      // Handle error case
      const errorMessage = 'Sorry, there was an error processing your request.';
      setResponseText(errorMessage);
      addToConversation('AI', errorMessage);
      
      // Stop thinking animation in case of error
      stopSpeakingAnimation();
      
      // Clear any previous TTS listener
      if (ttsFinishListener.current) {
        ttsFinishListener.current.remove();
        ttsFinishListener.current = null;
      }
      
      // Set up TTS finish listener for error case
      ttsFinishListener.current = Tts.addEventListener('tts-finish', () => {
        console.log('TTS finished speaking error message');
        
        // Make sure processing flag is reset
        isProcessing.current = false;
        
        // Remove listener to prevent multiple triggers
        if (ttsFinishListener.current) {
          ttsFinishListener.current.remove();
          ttsFinishListener.current = null;
        }
        
        // Start recording after error message, but only if call is still active
        if (callActive) {
          setTimeout(() => {
            startRecording();
          }, 500);
        }
      });
      
      // Speak error message
      Tts.speak(errorMessage);
    } finally {
      // Make sure processing flag is reset
      isProcessing.current = false;
    }
  };

  const endCall = () => {
    console.log('Ending call and cleaning up resources...');
    
    // Update state first
    setCallActive(false);
    setRecording(false);
    isProcessing.current = false;
    
    // Clear any pending timers
    clearTimeout(silenceTimer.current);
    
    // Clear maximum recording timer 
    if (maxRecordingTimer.current) {
      clearTimeout(maxRecordingTimer.current);
      maxRecordingTimer.current = null;
    }
    
    // Safe cleanup for TTS listeners
    if (ttsFinishListener.current) {
      console.log('Removing TTS finish listener');
      ttsFinishListener.current.remove();
      ttsFinishListener.current = null;
    }
    
    // Stop recording
    try {
      console.log('Stopping recording');
      AudioRecord.stop();
    } catch (err) {
      console.error('Audio stop error:', err);
    }
    
    // Close WebSocket connection
    if (websocketConnection) {
      try {
        console.log('Closing WebSocket connection');
        websocketConnection.close();
        websocketConnection = null;
        websocketReady = false;
        setIsConnected(false);
        setIsConnecting(false);
      } catch (err) {
        console.error('WebSocket close error:', err);
      }
    }
    
    // Remove data subscription
    if (dataSubscription) {
      try {
        console.log('Removing data subscription');
        dataSubscription.remove();
        dataSubscription = null;
      } catch (err) {
        console.error('Data subscription removal error:', err);
      }
    }
    
    // Stop any ongoing TTS - with safe error handling for iOS
    try {
      console.log('Stopping TTS');
      // On iOS, don't use await with stop() - it causes the BOOL error
      Tts.stop();
    } catch (err) {
      console.error('TTS stop error:', err);
    }
    
    // Reset global variables
    chunkStartTime = 0;
    currentChunkBuffers = [];
    chunkCounter = 0;
    websocketReady = false;
    
    // Reset animation
    setAnimationSpeed(0);
    
    // Navigate back
    navigation.goBack();
  };

  const setupAudioListener = () => {
    console.log('Setting up audio listener...');
    
    try {
      // Clean up existing subscription
      if (dataSubscription) {
        dataSubscription.remove();
        dataSubscription = null;
      }

      // Reset chunk collection
      currentChunkBuffers = [];
      chunkStartTime = Date.now();
      chunkCounter = 0;

      // Set up new listener for both platforms
      dataSubscription = AudioRecord.on('data', data => {
        try {
          // Log data receipt for debugging
          console.log(`[Audio] Data received, length: ${data.length}`);
          
          // Convert base64 data to raw binary buffer
          const chunk = Buffer.from(data, 'base64');
          
          if (chunk.byteLength > 0) {
            console.log(`[Audio] Raw chunk size: ${chunk.byteLength} bytes`);
            
            // Add to the current audio chunks array (for reference)
            audioChunksRef.current.push(data);
            
            // Add raw buffer to our current 1-second chunk collection
            currentChunkBuffers.push(chunk);
            
            // Check if we've collected 1 second worth of audio
            const currentTime = Date.now();
            if (currentTime - chunkStartTime >= 1000) {
              processAudioChunk(currentTime);
            }
          } else {
            console.warn('[Audio] Warning: Received empty audio chunk');
          }
        } catch (error) {
          console.error('[Audio] Error in data listener:', error);
          setError(`Audio data error: ${error.message}`);
        }
      });
      
      console.log('[Audio] Listener setup complete');
    } catch (error) {
      console.error('[Audio] Error setting up audio listener:', error);
      setError(`Error setting up audio: ${error.message}`);
    }
  };
  
  // Move the audio chunk processing to a separate function
  const processAudioChunk = async (currentTime) => {
    try {
      // Combine all buffers into one larger buffer
      const totalLength = currentChunkBuffers.reduce((sum, buffer) => sum + buffer.length, 0);
      console.log(`Combined chunk length: ${totalLength} bytes from ${currentChunkBuffers.length} chunks`);
      
      if (totalLength === 0) {
        console.warn('Warning: Empty audio buffer - no audio data received');
        // Reset and continue
        currentChunkBuffers = [];
        chunkStartTime = currentTime;
        return;
      }
      
      const combinedPCMBuffer = Buffer.concat(currentChunkBuffers, totalLength);
      
      // Convert PCM to WAV
      const wavBuffer = createWavFile(combinedPCMBuffer);
      
      // Generate unique filename
      chunkCounter++;
      const wavFileName = `chunk_${Date.now()}_${chunkCounter}.wav`;
      const chunkFilePath = `${RNFS.DocumentDirectoryPath}/${wavFileName}`;
      
      // Save the WAV file
      const wavBase64 = wavBuffer.toString('base64');
      await RNFS.writeFile(chunkFilePath, wavBase64, 'base64');
      console.log(`WAV chunk saved to ${chunkFilePath}, size: ${wavBuffer.length} bytes`);
      
      // Check WebSocket status with more detail
      const wsStatus = websocketConnection ? websocketConnection.readyState : 'null';
      console.log(`WebSocket status: ${wsStatus}, Ready flag: ${websocketReady}`);
      
      // Send the chunk to the WebSocket if it's fully ready
      if (websocketReady && websocketConnection && websocketConnection.readyState === WebSocket.OPEN) {
        console.log(`Sending WAV chunk ${chunkCounter}, size: ${wavBuffer.length} bytes`);
        const result = sendAudioChunkToWebSocket(wavBuffer, false);
        console.log(`Chunk ${chunkCounter} sent: ${result}`);
      } else {
        console.log(`WebSocket not ready to send chunk ${chunkCounter}. Status: ${wsStatus}, Ready: ${websocketReady}`);
        
        // Store the chunk for delayed sending if needed
        // We could implement a queue here to send chunks once the WebSocket is ready
      }
      
      // Reset for the next 1-second chunk
      currentChunkBuffers = [];
      chunkStartTime = currentTime;
    } catch (error) {
      console.error('Error processing 1-second chunk:', error);
      setError(`Chunk processing error: ${error.message}`);
      
      // Just reset the buffers and continue recording
      currentChunkBuffers = [];
      chunkStartTime = Date.now();
    }
  };

  const connectToWebSocket = () => {
    // Already connected or connecting
    if (isConnected || isConnecting) return;
    
    try {
      setIsConnecting(true);
      websocketReady = false; // Reset websocket ready flag
      
      // Generate a new UUID for this connection
      connectIdRef.current = uuidv4();
      
      // Use the fluid model WebSocket endpoint
      const wsUrl = 'wss://openspeech.bytedance.com/api/v3/sauc/bigmodel';
      
      console.log(`[WebSocket] Connecting to: ${wsUrl} with ID: ${connectIdRef.current}`);
      
      websocketConnection = new WebSocket(wsUrl, [], {
        headers: {
          'X-Api-App-Key': process.env.API_APP_KEY || '',  // APP ID
          'X-Api-Access-Key': process.env.API_ACCESS_KEY || '',  // Access Token
          'X-Api-Resource-Id': 'volc.bigasr.sauc.duration',  // Resource ID for the hourly version
          'X-Api-Connect-Id': connectIdRef.current,  // Connection tracking ID
        }
      });
      
      websocketConnection.binaryType = 'arraybuffer';
      
      websocketConnection.onopen = () => {
        console.log('[WebSocket] Connection opened successfully');
        setIsConnected(true);
        setIsConnecting(false);
        
        // Send initial request with parameters
        sendInitialRequest();
      };
      
      websocketConnection.onmessage = (event) => {
        // Set the ready flag after receiving first message from server
        // This indicates the WebSocket has successfully established bidirectional communication
        if (!websocketReady) {
          console.log('[WebSocket] Now ready to receive audio data');
          websocketReady = true;
        }
        
        handleWebSocketMessage(event.data);
      };
      
      websocketConnection.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        setError(`WebSocket error: ${error.message || 'Unknown error'}`);
        setIsConnected(false);
        setIsConnecting(false);
        websocketReady = false;
      };
      
      websocketConnection.onclose = (event) => {
        console.log(`[WebSocket] Connection closed: code=${event.code}, reason=${event.reason}`);
        setIsConnected(false);
        setIsConnecting(false);
        websocketReady = false;
      };
    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
      setError(`WebSocket connection error: ${error.message}`);
      setIsConnected(false);
      setIsConnecting(false);
      websocketReady = false;
    }
  };
  
  const sendInitialRequest = () => {
    if (!websocketConnection || websocketConnection.readyState !== WebSocket.OPEN) {
      console.error('[WebSocket] Cannot send initial request, WebSocket not open');
      return;
    }
    
    try {
      // Prepare the request parameters
      const requestParams = {
        user: {
          uid: `user_${Date.now()}`,
          platform: Platform.OS,
        },
        audio: {
          format: 'wav',  // WAV format
          rate: 16000,
          bits: 16,
          channel: 1,
        },
        request: {
          model_name: 'bigmodel',
          enable_itn: true,
          enable_punc: true,
          enable_ddc: true,
          show_utterances: true,
          vad_segment_duration: 1500,
          end_window_size: 600,
        },
      };
      
      // Convert to JSON string and log it for debugging
      const jsonParams = JSON.stringify(requestParams);
      console.log('[WebSocket] Initial request params:', jsonParams);
      
      // Compress the JSON string using GZIP
      const compressedParams = pako.gzip(jsonParams);
      console.log(`[WebSocket] Compressed params: ${compressedParams.length} bytes`);
      
      // Create the header - 4 bytes as described in the documentation
      const headerBuffer = new ArrayBuffer(4);
      const headerView = new DataView(headerBuffer);
      
      // Set header values
      // Format: 4 bits version (0001), 4 bits header size (0001), 
      // 4 bits message type (0001), 4 bits message flags (0000),
      // 4 bits serialization (0001), 4 bits compression (0001), 8 bits reserved (00000000)
      headerView.setUint8(0, (1 << 4) | 1); // Version & Header size
      headerView.setUint8(1, (1 << 4) | 0); // Message type & Message flags
      headerView.setUint8(2, (1 << 4) | 1); // Serialization & Compression
      headerView.setUint8(3, 0); // Reserved
      
      // Create payload size (4 bytes)
      const payloadSizeBuffer = new ArrayBuffer(4);
      const payloadSizeView = new DataView(payloadSizeBuffer);
      payloadSizeView.setUint32(0, compressedParams.length, false); // Set as big-endian
      
      // Combine all parts into a single buffer
      const finalBuffer = new Uint8Array(headerBuffer.byteLength + payloadSizeBuffer.byteLength + compressedParams.length);
      finalBuffer.set(new Uint8Array(headerBuffer), 0);
      finalBuffer.set(new Uint8Array(payloadSizeBuffer), headerBuffer.byteLength);
      finalBuffer.set(compressedParams, headerBuffer.byteLength + payloadSizeBuffer.byteLength);
      
      console.log(`[WebSocket] Sending initial request, total size: ${finalBuffer.length} bytes`);
      
      // Send the binary message
      websocketConnection.send(finalBuffer);
      console.log('[WebSocket] Initial request sent successfully');
    } catch (error) {
      console.error('[WebSocket] Error sending initial request:', error);
      setError(`Error sending initial request: ${error.message}`);
    }
  };

  const sendAudioChunkToWebSocket = (chunk, isLastChunk = false) => {
    if (!websocketConnection || websocketConnection.readyState !== WebSocket.OPEN) {
      console.error('[WebSocket] Cannot send audio chunk, WebSocket not open');
      return false;
    }
    
    try {
      console.log(`[WebSocket] Processing ${chunk.length} bytes audio chunk, isLastChunk: ${isLastChunk}`);
      
      // Check if it's a valid WAV file (should have RIFF header)
      const isWavFile = chunk.length > 12 && 
                        chunk.toString('ascii', 0, 4) === 'RIFF' && 
                        chunk.toString('ascii', 8, 12) === 'WAVE';
      
      console.log(`[WebSocket] Audio format check: ${isWavFile ? 'WAV file' : 'PCM data'}`);
      
      // For iOS, we are directly reading WAV files, so we don't need to convert
      let dataToSend = chunk;
      
      if (!isWavFile && Platform.OS === 'android') {
        // Convert PCM to WAV for Android 
        console.log('[WebSocket] Converting PCM to WAV for Android');
        dataToSend = createWavFile(chunk);
      }
      
      // Ensure we have valid data to send
      if (!dataToSend || dataToSend.length <= 44) { // WAV header is 44 bytes
        console.warn('[WebSocket] No valid audio data to send');
        return false;
      }
      
      try {
        // Compress the audio chunk using GZIP
        const compressedChunk = pako.gzip(dataToSend);
        console.log(`[WebSocket] Compressed to ${compressedChunk.length} bytes from ${dataToSend.length}`);
        
        // Create the header - 4 bytes
        const headerBuffer = new ArrayBuffer(4);
        const headerView = new DataView(headerBuffer);
        
        // Set header values
        // Format: 4 bits version (0001), 4 bits header size (0001), 
        // 4 bits message type (0010 for audio), 4 bits message flags (0000 or 0010 for last chunk),
        // 4 bits serialization (0000), 4 bits compression (0001), 8 bits reserved (00000000)
        headerView.setUint8(0, (1 << 4) | 1); // Version & Header size
        // For last chunk, set the second bit in message flags (0010)
        headerView.setUint8(1, (2 << 4) | (isLastChunk ? 2 : 0)); // Message type & Message flags
        headerView.setUint8(2, (0 << 4) | 1); // Serialization & Compression
        headerView.setUint8(3, 0); // Reserved
        
        // Create payload size (4 bytes)
        const payloadSizeBuffer = new ArrayBuffer(4);
        const payloadSizeView = new DataView(payloadSizeBuffer);
        payloadSizeView.setUint32(0, compressedChunk.length, false); // Set as big-endian
        
        // Combine all parts into a single buffer
        const finalBuffer = new Uint8Array(headerBuffer.byteLength + payloadSizeBuffer.byteLength + compressedChunk.length);
        finalBuffer.set(new Uint8Array(headerBuffer), 0);
        finalBuffer.set(new Uint8Array(payloadSizeBuffer), headerBuffer.byteLength);
        finalBuffer.set(compressedChunk, headerBuffer.byteLength + payloadSizeBuffer.byteLength);
        
        // Send the binary message
        websocketConnection.send(finalBuffer);
        console.log(`[WebSocket] Sent ${finalBuffer.length} bytes ${isLastChunk ? 'FINAL' : 'chunk'}`);
        
        if (isLastChunk) {
          console.log('[WebSocket] Sent last audio chunk');
        }
        
        return true;
      } catch (compressionError) {
        console.error('[WebSocket] Error compressing/sending audio chunk:', compressionError);
        return false;
      }
    } catch (error) {
      console.error('[WebSocket] Error processing audio chunk:', error);
      setError(`Error sending audio chunk: ${error.message}`);
      return false;
    }
  };

  const handleWebSocketMessage = (data) => {
    try {
      // Parse the binary message
      const dataView = new DataView(data);
      
      // Extract header information
      const header1 = dataView.getUint8(0);
      const header2 = dataView.getUint8(1);
      const header3 = dataView.getUint8(2);
      
      // Extract fields from headers
      const messageType = (header2 >> 4) & 0x0F;
      const messageFlags = header2 & 0x0F;
      const compression = header3 & 0x0F;
      
      console.log(`[WebSocket] Received message: type=${messageType}, flags=${messageFlags}, compression=${compression}`);
      
      // Check for error message (messageType === 15)
      if (messageType === 15) {
        const errorCode = dataView.getUint32(4, false); // Big-endian
        const errorMessageSize = dataView.getUint32(8, false); // Big-endian
        
        // Extract error message text using Buffer instead of TextDecoder
        const errorMessageBytes = new Uint8Array(data, 12, errorMessageSize);
        const errorMessage = decodeUTF8(errorMessageBytes);
        
        console.error('[WebSocket] Error from server:', errorCode, errorMessage);
        setError(`Server error: ${errorMessage} (Code: ${errorCode})`);
        return;
      }
      
      // Check for server response (messageType === 9)
      if (messageType === 9) {
        // Extract sequence number (4 bytes)
        const sequenceNumber = dataView.getUint32(4, false); // Big-endian
        
        // Extract payload size (4 bytes)
        const payloadSize = dataView.getUint32(8, false); // Big-endian
        
        console.log(`[WebSocket] Response: seq=${sequenceNumber}, payloadSize=${payloadSize}`);
        
        // Extract compressed payload
        const compressedPayload = new Uint8Array(data, 12, payloadSize);
        
        // Decompress the payload if it's compressed
        let jsonText;
        if (compression === 1) {
          try {
            // Decompress using pako
            const decompressedPayload = pako.ungzip(compressedPayload);
            // Use Buffer instead of TextDecoder
            jsonText = decodeUTF8(decompressedPayload);
          } catch (error) {
            console.error('[WebSocket] Error decompressing payload:', error);
            setError(`Decompression error: ${error.message}`);
            return;
          }
        } else {
          // Not compressed, use Buffer instead of TextDecoder
          jsonText = decodeUTF8(compressedPayload);
        }
        
        // Parse the JSON payload
        const responseData = JSON.parse(jsonText);
        console.log('[WebSocket] Received response:', JSON.stringify(responseData).substring(0, 150) + '...');
        
        // Update the transcription
        if (responseData.result && responseData.result.text) {
          const newText = responseData.result.text;
          setTranscribedText(newText);
          console.log('[WebSocket] Updated transcription with text:', newText);
          
          // Store the last time the text was updated
          lastTextChangeTime.current = Date.now();
          
          // Check if this is the final transcription (has 'is_final' flag or hasn't changed for a while)
          if (responseData.result.is_final === true) {
            console.log('[WebSocket] Final transcription received:', newText);
            if (recording && newText.trim().length > 5 && !isProcessing.current) {
              console.log('[WebSocket] Processing final transcription from is_final flag');
              stopRecording();
              sendToApi(newText);
            }
          }
        }

        // Also check for utterances if show_utterances was enabled
        if (responseData.result && 
            responseData.result.utterances && 
            responseData.result.utterances.length > 0) {
          
          // Log all utterances for debugging
          responseData.result.utterances.forEach(utterance => {
            console.log(`[WebSocket] Utterance: ${utterance.text} (${utterance.definite ? 'definite' : 'interim'})`);
          });
          
          // Display the transcription based on all utterances
          const allText = responseData.result.utterances
            .map(u => u.text)
            .join(' ');
          
          if (allText.trim()) {
            setTranscribedText(allText);
            console.log('[WebSocket] Set transcription from utterances:', allText);
            
            // Store the last time the text was updated
            lastTextChangeTime.current = Date.now();
            
            // Check if there's a definite utterance and we're not already processing
            const hasDefiniteUtterance = responseData.result.utterances.some(u => u.definite);
            
            // If we have a definite utterance and it's not very short, and the user seems to have paused speaking
            if (hasDefiniteUtterance && 
                allText.length > 10 && 
                !isProcessing.current &&
                recording) {
              
              // Check if the text hasn't changed significantly in the last 1.5 seconds
              const currentTime = Date.now();
              const timeSinceLastChange = currentTime - lastTextChangeTime.current;
              
              // If we detect a natural pause (1.5+ seconds of no significant change), process the text
              if (timeSinceLastChange > 1500) {
                console.log('[WebSocket] Detected natural pause in speech, processing utterance');
                stopRecording();
                sendToApi(allText);
              }
            }
          }
        }
        
        // Handle end of speech detection via silence
        if (responseData.result && responseData.result.is_end_of_speech === true) {
          console.log('[WebSocket] End of speech detected by server');
          
          // If we're still recording and have transcription, process it
          if (recording && transcribedText && transcribedText.trim().length > 5 && !isProcessing.current) {
            console.log('[WebSocket] Processing transcription after end of speech');
            stopRecording();
            sendToApi(transcribedText);
          }
        }
      }
    } catch (error) {
      console.error('[WebSocket] Error handling message:', error);
      setError(`Error handling message: ${error.message}`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.gradientContainer, { transform: [{ rotate }] }]}>
        <LinearGradient
          colors={['#0C7BB3', '#F2BAE8']}
          style={styles.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>
     
        <View style={styles.headerContainer}>
          <TouchableOpacity 
            style={styles.roleButton}
            onPress={toggleRoleSlider}
          >
            <Text style={styles.roleButtonText}>{currentRole}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.textButton}
            onPress={() => setShowTextContainer(!showTextContainer)}
          >
            <Text style={styles.textButtonText}>
              {showTextContainer ? 'Hide Text' : 'Show Text'}
            </Text>
          </TouchableOpacity>
          
          {isConnecting && (
            <View style={styles.connectionIndicator}>
              <Text style={styles.connectionText}>Connecting...</Text>
            </View>
          )}
          
          {isConnected && (
            <View style={styles.connectionIndicator}>
              <Text style={styles.connectionText}>Connected</Text>
            </View>
          )}
        </View>
        
        {/* Role selection slider */}
        <Animated.View 
          style={[
            styles.roleSlider,
            {
              transform: [
                { 
                  translateY: roleSliderAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [300, 0]
                  }) 
                }
              ],
              opacity: roleSliderAnim
            }
          ]}
        >
          <View style={styles.roleSliderContent}>
            <Text style={styles.roleSliderTitle}>Select AI Role</Text>
            <View style={styles.roleOptions}>
              {['Assistant', 'Teacher', 'Mathematician', 'English Teacher', 'Programmer', 'Singer'].map((role) => (
                <TouchableOpacity 
                  key={role} 
                  style={[
                    styles.roleOption,
                    currentRole === role && styles.selectedRoleOption
                  ]}
                  onPress={() => selectRole(role)}
                >
                  <Text style={[
                    styles.roleOptionText,
                    currentRole === role && styles.selectedRoleOptionText
                  ]}>
                    {role}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Animated.View>
   

      <View style={styles.contentContainer}>
        <View style={styles.avatarContainer}>
          <Animated.View style={{
            transform: [{ scale: pulseAnimation }]
          }}>
            <Lottie
              ref={aiAnimationRef}
              source={require('../assets/Animation - 1740689806927.json')}
              autoPlay
              loop
              speed={animationSpeed}
              style={styles.animation}
            />
          </Animated.View>
        </View>
      </View>
      
      {/* Full screen text container */}
      {showTextContainer && (
        <View style={styles.fullScreenTextContainer}>
          <View style={styles.textContainerHeader}>
            <Text style={styles.conversationTitle}>Conversation</Text>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setShowTextContainer(false)}
            >
              <Icon name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          {/* Conversation history */}
          <View style={styles.conversationHistory}>
            {conversation.map((item, index) => (
              <View key={index} style={styles.messageContainer}>
                <Text style={styles.speakerLabel}>{item.speaker}:</Text>
                <Text style={styles.messageText}>{item.text}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
      
      <View style={styles.controlsContainer2}>
        <View style={styles.audioWavesContainer}>
          <Lottie
            ref={audioWavesRef}
            source={require('../assets/AudioWaves.json')}
            autoPlay={false}
            loop
            speed={1.0}
            style={styles.animation2}
          />
          
          {/* Transcribed text below AudioWaves */}
          {recording && transcribedText && (
            <View style={styles.transcriptionContainer}>
              <Text style={styles.transcriptionText}>{transcribedText}</Text>
            </View>
          )}
        </View>
        
        <View style={styles.controlsContainer}>
          <TouchableOpacity 
            style={styles.endCallButton2} 
            onPress={startRecording}
            disabled={recording || isSpeaking}
          >
            <Icon name="mic" size={24} color={recording || isSpeaking ? "rgba(255,255,255,0.5)" : "white"} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.stopButton} 
            onPress={stopRecording}
            disabled={!recording || isSpeaking}
          >
            <Icon name="stop" size={24} color={!recording || isSpeaking ? "rgba(255,255,255,0)" : "white"} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.endCallButton} 
            onPress={endCall}
          >
            <Icon name="call-end" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradientContainer: {
    position: 'absolute',
    width: Dimensions.get('window').width * 4,
    height: Dimensions.get('window').height * 2,
    top: -Dimensions.get('window').height / 2,
    left: -Dimensions.get('window').width / 2,
  },
  gradient: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    zIndex: 50,
  },
  roleButton: {
    position: 'absolute',
    left: '50%',
    top: Platform.OS === 'ios' ? 50 : 20,
    transform: [{ translateX: -50 }],
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    zIndex: 10,
    elevation: 5,
  },
  textButton: {
    position: 'absolute',
    right: 20,
    top: Platform.OS === 'ios' ? 50 : 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    zIndex: 10,
    elevation: 5,
  },
  roleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginRight: 10,
  },
  textButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginRight: 10,
  },
  connectionIndicator: {
    position: 'absolute',
    left: 20,
    top: Platform.OS === 'ios' ? 50 : 20,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderRadius: 15,
  },
  connectionText: {
    color: '#fff',
    fontSize: 12,
  },
  roleSlider: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 10,
    height: 300,
  },
  roleSliderContent: {
    paddingBottom: 30,
  },
  roleSliderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  roleOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  roleOption: {
    width: '48%',
    backgroundColor: 'rgba(12, 123, 179, 0.1)',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    alignItems: 'center',
  },
  selectedRoleOption: {
    backgroundColor: 'rgba(12, 123, 179, 0.3)',
    borderWidth: 1,
    borderColor: '#0C7BB3',
  },
  roleOptionText: {
    color: '#333',
    fontWeight: '500',
  },
  selectedRoleOptionText: {
    color: '#0C7BB3',
    fontWeight: 'bold',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 1,
  },
  avatarContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
    pointerEvents: 'none', // Make sure it doesn't block touch events
  },
  animation: {
    width: 400,
    height: 400,
    alignSelf: 'center',
  },
  animation2: {
    width: 100,
    height: 100,
    marginBottom: 10,
    alignSelf: 'center',
  },
  fullScreenTextContainer: {
    position: 'absolute',
    top: '25%',
    left: '10%',
    right: '10%',
    maxHeight: '50%',
    backgroundColor: 'rgba(65, 0, 111, 0.04)',
    zIndex: 50,
    padding: 20,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  textContainerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  closeButton: {
    padding: 5,
  },
  transcriptionContainer: {
    padding: 10,
    borderRadius: 10,
    marginTop: 5,
    marginBottom: 10,
    width: '90%',
    alignSelf: 'center',
  },
  transcriptionText: {
    color: '#333',
    textAlign: 'center',
    fontSize: 16,
  },
  conversationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  conversationHistory: {
    maxHeight: '90%',
  },
  messageContainer: {
    marginBottom: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    padding: 10,
    borderRadius: 10,
  },
  speakerLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#555',
  },
  messageText: {
    fontSize: 16,
    color: '#333',
  },
  controlsContainer2: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    marginTop: -50,
  },
  audioWavesContainer: {
    alignItems: 'center',
    width: '100%',
  },
  controlsContainer: {
    alignItems: 'center',
    paddingBottom: 20,
    flexDirection: 'row',
    alignSelf: 'center',
    marginTop: 10,
  },
  stopButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FFFFFF90',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    marginRight: 20,
  },
  endCallButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(220, 53, 69, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  endCallButton2: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FFFFFF90',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    marginRight: 20,
  },
});

export default CallScreen;
