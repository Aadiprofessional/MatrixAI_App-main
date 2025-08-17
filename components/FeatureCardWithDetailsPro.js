import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
const { width } = Dimensions.get('window'); // Get the screen width

const FeatureCardWithDetailsPro = () => {
  const navigation = useNavigation(); // Initialize navigation
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();
  const { t } = useLanguage();
  const handleUpgradePress = () => {
    navigation.navigate('SubscriptionScreen'); // Replace 'UpgradeScreen' with your target screen's name
  };

  return (
    <View style={[styles.container, {backgroundColor: colors.background }]}>
      <TouchableOpacity style={[styles.card, {backgroundColor: colors.card , borderWidth: 0.8, borderColor: colors.border}]}>
        {/* Top section with "Matrix AI" text and "PRO" container */}
        <View style={[styles.headerRow]}>
                <View style={styles.titleContainer}>
                    <Text style={[styles.title, {color: colors.text}]}>{t('proFeatures')}</Text>
                    <View style={[styles.proBadge , {backgroundColor: colors.primary}]}>
                        <Text style={[styles.proText ]}>{t('active')}</Text>
                    </View>
                </View>
            </View>

       <View style={styles.featureList}>
          <View style={styles.featureItem}>
            <MaterialCommunityIcons name="video-outline" size={30} color="#FF6600" style={styles.featureIcon} />
            <View style={styles.featureTextContainer}>
              <Text style={[styles.featureTitle, {color: colors.text}]}>Advanced Video Processing</Text>
              <Text style={[styles.featureDescription, {color: colors.text, opacity: 0.7}]}>Extract subtitles, generate SRT files, translate content, and analyze video content with AI-powered tools</Text>
            </View>
          </View>
    
          <View style={styles.featureItem}>
            <MaterialCommunityIcons name="image-edit-outline" size={30} color="#FF6600" style={styles.featureIcon} />
            <View style={styles.featureTextContainer}>
              <Text style={[styles.featureTitle, {color: colors.text}]}>AI Image Generation</Text>
              <Text style={[styles.featureDescription, {color: colors.text, opacity: 0.7}]}>Create stunning images from text prompts using advanced AI models with customizable styles and formats</Text>
            </View>
          </View>
          
          <View style={styles.featureItem}>
            <MaterialCommunityIcons name="microphone" size={30} color="#FF6600" style={styles.featureIcon} />
            <View style={styles.featureTextContainer}>
              <Text style={[styles.featureTitle, {color: colors.text}]}>Speech-to-Text Conversion</Text>
              <Text style={[styles.featureDescription, {color: colors.text, opacity: 0.7}]}>Convert audio and video files to accurate text transcriptions with multi-language support</Text>
            </View>
          </View>
       
          <View style={styles.featureItem}>
            <MaterialCommunityIcons name="text-box-outline" size={30} color="#FF6600" style={styles.featureIcon} />
            <View style={styles.featureTextContainer}>
              <Text style={[styles.featureTitle, {color: colors.text}]}>AI Writing Assistant</Text>
              <Text style={[styles.featureDescription, {color: colors.text, opacity: 0.7}]}>Get intelligent writing help, content generation, and text optimization powered by advanced AI models</Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <MaterialCommunityIcons name="translate" size={30} color="#FF6600" style={styles.featureIcon} />
            <View style={styles.featureTextContainer}>
              <Text style={[styles.featureTitle, {color: colors.text}]}>Multi-Language Translation</Text>
              <Text style={[styles.featureDescription, {color: colors.text, opacity: 0.7}]}>Translate subtitles, text, and content across multiple languages with high accuracy</Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <MaterialIcons name="file-download" size={30} color="#FF6600" style={styles.featureIcon} />
            <View style={styles.featureTextContainer}>
              <Text style={[styles.featureTitle, {color: colors.text}]}>Export & Download</Text>
              <Text style={[styles.featureDescription, {color: colors.text, opacity: 0.7}]}>Download SRT files, transcriptions, and generated content in various formats for easy sharing</Text>
            </View>
          </View>
        </View>
       
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center', // Center the card vertically
    alignItems: 'center', // Center the card horizontally
    backgroundColor: '#F8F9FD',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
   
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  proBadge: {
    backgroundColor: '#FF6600', // Blue background
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 15,
  
  },
  
  
  
  
  card: {
    width: '100%', // 80% of the screen width
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    margin: 10,
    borderWidth: 1, // Gray border for the card
    borderColor: '#ccc',
   
    justifyContent: 'center', // Center content inside card
    alignItems: 'center', // Center content horizontally in card
  },
  topSection: {
    flexDirection: 'row',
    justifyContent: 'center', // Center the text and PRO label horizontally
    alignItems: 'center',
    marginBottom: 5, // Add space below top section
  },
  matrixAIText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  proContainer: {
    backgroundColor: '#007BFF', // Blue background
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 15,
    marginLeft: 10, // Space between "Matrix AI" and "PRO"
  },
  proText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  featureList: {
    marginTop: 5,
    width: '100%', // Make sure feature items fill the width of the card
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  featureIcon: {
    width: 30,
    height: 30,
    marginRight: 12,
    marginTop: 2,
    resizeMode: 'contain',
  },
  featureTextContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    opacity: 0.8,
  },
  upgradeButton: {
    backgroundColor: '#007BFF', // Blue background for button
    paddingVertical: 10,
    width: width * 0.7,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginTop: 10,
    alignItems: 'center',
  },
  upgradeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default FeatureCardWithDetailsPro;
