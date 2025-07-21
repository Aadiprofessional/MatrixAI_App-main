import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  FlatList
} from 'react-native';
import LottieView from 'lottie-react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { getTranslation } from '../utils/translations';

const { width, height } = Dimensions.get('window');

const PPTGenerateScreen = () => {
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();
  // Function to get translations
  const t = (key) => getTranslation(key);
  const [userText, setUserText] = useState('');
  const [isFinished, setIsFinished] = useState(false);
  const [transcription, setTranscription] = useState(t('tellMeAboutYourPPT'));
  const [selectedNumber, setSelectedNumber] = useState(1); // Default selection
  const navigation = useNavigation();
  const [historyOpen, setHistoryOpen] = useState(false);
  const historySlideAnim = useRef(new Animated.Value(width)).current;
  
  // Mock data for history
  const [pptHistory, setPptHistory] = useState([
    {
      id: '1',
      imageUrl: 'https://via.placeholder.com/150',
      prompt: 'Business strategy presentation for Q3',
      date: '2023-05-22',
    },
    {
      id: '2',
      imageUrl: 'https://via.placeholder.com/150',
      prompt: 'Marketing campaign overview for new product launch',
      date: '2023-05-20',
    },
    {
      id: '3',
      imageUrl: 'https://via.placeholder.com/150',
      prompt: 'Annual sales report with financial analysis',
      date: '2023-05-18',
    },
  ]);
  
  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0);
  const sendRotation = new Animated.Value(0);

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.ease,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.timing(sendRotation, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      )
    ]).start();
  }, []);

  const toggleHistory = () => {
    setHistoryOpen(!historyOpen);
    Animated.timing(historySlideAnim, {
      toValue: historyOpen ? width : 0,
      duration: 300,
      easing: Easing.ease,
      useNativeDriver: true,
    }).start();
  };

  const handleSend = () => {
    if (userText.trim().length > 0) {
      setIsFinished(true);
    }
  };

  const handleGenerate = () => {
    navigation.navigate('CreatePPTScreen', { message: transcription, number: selectedNumber ,template: 2});
  };
  
  const backgrounds = {
    1: require('../assets/bg/bg3.jpg'),
    2: require('../assets/bg/bg2.jpg'),
    3: require('../assets/bg/bg1.jpg'),
    4: require('../assets/bg/bg4.jpg'),
    5: require('../assets/bg/bg5.jpg'),
    6: require('../assets/bg/bg6.jpeg'),
    7: require('../assets/bg/bg7.jpeg'),
    8: require('../assets/bg/bg8.jpeg'),
    9: require('../assets/bg/bg9.jpeg'),
    10: require('../assets/bg/bg10.jpeg'),
  };

  const renderHistoryItem = ({ item }) => (
    <View style={styles.historyItem}>
      <Image source={{ uri: item.imageUrl }} style={styles.historyImage} />
      <View style={styles.historyItemContent}>
        <Text style={styles.historyDate}>{item.date}</Text>
        <Text style={styles.historyPrompt} numberOfLines={2}>{item.prompt}</Text>
        <View style={styles.historyActions}>
          <TouchableOpacity style={styles.historyActionButton}>
            <Image source={require('../assets/back.png')} style={[styles.historyActionIcon, {tintColor: '#fff'}]} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.historyActionButton}>
            <Image source={require('../assets/send2.png')} style={[styles.historyActionIcon, {tintColor: '#fff'}]} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={{flex: 1}}>
      <Animated.View style={[styles.container, { opacity: fadeAnim, backgroundColor: colors.background}]}>
        {/* Header Animation */}
        <Animated.View style={[styles.header, { transform: [{ scale: scaleAnim }], backgroundColor: colors.background2}]}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>  
            <Image source={require('../assets/back.png')} style={[styles.backIcon, {tintColor: colors.text}]} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, {color: colors.text}]}>Matrix AI</Text>
          <TouchableOpacity 
            style={styles.historyButton} 
            onPress={toggleHistory}
          >
            <Image source={require('../assets/back.png')} style={[styles.backIcon, {tintColor: colors.text, transform: [{rotate: '180deg'}]}]} />
          </TouchableOpacity>
        </Animated.View>
      
        {!isFinished && (
          <Animated.View style={[styles.placeholderContainer, { opacity: fadeAnim }]}>
            <Image   
              source={require('../assets/matrix.png')}
              style={{width: 120, height: 120,resizeMode:'contain',marginTop:20}}
            />
            <Text style={[styles.placeholderText, {color: colors.text}]}>{t('hiWelcomeToMatrixAI')}</Text>
            <Text style={[styles.placeholderText2, {color: colors.text}]}>{t('whatCanIGenerateForYouToday')}</Text>
          </Animated.View>
        )}
        
        <LottieView 
          source={require('../assets/image2.json')}
          autoPlay
          loop
          style={{width: '100%', height: 100, backgroundColor: colors.background2}}
        />
        
        {/* Selection Rectangles */}
        {isFinished && (
          <View style={styles.selectionContainer}>
            {[1, 2, 3, 4,5,6,7,8,9,10].map((num) => (
              <TouchableOpacity
                key={num}
                style={[styles.rectangle, selectedNumber === num && styles.selectedRectangle]}
                onPress={() => setSelectedNumber(num)}
              >
                <Image source={backgrounds[num]} style={styles.image} />
              </TouchableOpacity>
            ))}
          </View>
        )}
        
        {/* Generate Button */}
        {isFinished && (
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.generateButton} onPress={handleGenerate}>
              <View style={styles.horizontalContent}>
                <View style={styles.generateContent}>
                  <Text style={styles.generateText}>{t('generatePPT')}</Text>
                  <View style={styles.horizontalContent}>
                    <Text style={styles.coinText}>{t('coinCost')}</Text>
                    <Image source={require('../assets/coin.png')} style={styles.coinIcon} />
                  </View>
                </View>
                <Image source={require('../assets/send2.png')} style={styles.icon} />
              </View>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>

      {/* Input section - Separate KeyboardAvoidingView */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidView}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 10}
      >
        {!isFinished && (
          <View style={styles.textInputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder={t('typeYourPromptHere')}
              placeholderTextColor="#999"
              value={userText}
              onChangeText={(text) => {
                setUserText(text);
                setTranscription(text || t('tellMeAboutYourPPT'));
              }}
            />
            <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
              <Image source={require('../assets/send2.png')} style={styles.sendIcon} />
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* History Panel */}
      <Animated.View 
        style={[
          styles.historyPanel, 
          {
            transform: [{ translateX: historySlideAnim }],
            backgroundColor: colors.background2
          }
        ]}
      >
        <View style={styles.historyHeader}>
          <Text style={styles.historyTitle}>{t('pptHistory')}</Text>
          <TouchableOpacity onPress={toggleHistory}>
            <Image 
              source={require('../assets/back.png')} 
              style={[styles.historyCloseIcon, {tintColor: '#fff'}]} 
            />
          </TouchableOpacity>
        </View>
        <FlatList
          data={pptHistory}
          renderItem={renderHistoryItem}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.historyList}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: 50,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingRight: 10,
  },
  headerIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  placeholderContainer: { 
    alignItems: 'center',
    marginTop: 20,
  },
  placeholderText: {
    fontSize: 18,
    color: '#333',
    marginTop: 10,
  },
  placeholderText2: {
    fontSize: 14,
    color: '#666', // Using a color that works well in both light and dark themes
  },
  headerTitle:{
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  selectionContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginVertical: 20,
    width: '100%',
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  historyButton: {
    padding: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  backIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  rectangle: {
    width: '45%',  
    aspectRatio: 1.5,
    margin: 5,
    borderWidth: 2,
    borderColor: '#ccc',
    borderRadius: 10,
    overflow: 'hidden',
  },
  selectedRectangle: {
    borderColor: '#007BFF',
    borderWidth: 3,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  keyboardAvoidView: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
  },
  textInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '90%',
    alignSelf: 'center',
    backgroundColor: '#F9F9F9',
    borderRadius: 25,
    paddingVertical: 10,
    paddingHorizontal: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  sendButton: {
    backgroundColor: '#007BFF',
    padding: 10,
    borderRadius: 25,
    marginLeft: 10,
  },
  sendIcon: {
    width: 20,
    height: 20,
    tintColor: '#FFFFFF',
    resizeMode: 'contain',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 70,
    alignSelf: 'center',
  },
  generateButton: {
    backgroundColor: '#007BFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginHorizontal: 10,
  },
  generateText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  horizontalContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  generateContent: {
    alignItems: 'center',
  },
  coinIcon: {
    width: 12,
    height: 12,
    marginLeft: 2,
  },
  coinText: {
    fontSize: 12,
    color: '#fff',
  },
  icon: {
    width: 16,
    height: 16,
    tintColor: '#fff',
    marginLeft: 10,
  },
  // History panel styles
  historyPanel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: '70%',
    height: '100%',
    backgroundColor: '#1E1E2E',
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 10,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    marginTop: 40,
  },
  historyTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  historyCloseIcon: {
    width: 24,
    height: 24,
    transform: [{rotate: '180deg'}],
  },
  historyList: {
    padding: 15,
  },
  historyItem: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 15,
  },
  historyImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  historyItemContent: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  historyDate: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  historyPrompt: {
    color: '#fff',
    fontSize: 14,
    marginVertical: 4,
  },
  historyActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  historyActionButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    padding: 6,
    borderRadius: 15,
    marginLeft: 8,
  },
  historyActionIcon: {
    width: 16,
    height: 16,
  },
});

export default PPTGenerateScreen;
