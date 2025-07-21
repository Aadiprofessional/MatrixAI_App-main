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
            <MaterialCommunityIcons name="text-recognition" size={30} color="#FF6600" style={styles.featureIcon} />
            <Text style={[styles.featureText, {color: colors.text}]}>{t('highAccuracySpeechToText')}</Text>
          </View>
    
          <View style={styles.featureItem}>
            <MaterialIcons name="translate" size={30} color="#FF6600" style={styles.featureIcon} />
                  <Text style={[styles.featureText, {color: colors.text}]}>{t('multilingualTextTranslation')}</Text>
          </View>
          <View style={styles.featureItem}>
            <MaterialCommunityIcons name="robot" size={30} color="#FF6600" style={styles.featureIcon} />
            <Text style={[styles.featureText, {color: colors.text}]}>{t('aiChatbot')}</Text>
          </View>
       
          <View style={styles.featureItem}>
            <MaterialCommunityIcons name="image" size={30} color="#FF6600" style={styles.featureIcon} />
            <Text style={[styles.featureText, {color: colors.text}]}>{t('aiChatbotWithPicture')}</Text>
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
    alignItems: 'center',
    marginBottom: 10,
  },
  featureIcon: {
    width: 30,
    height: 30,
    marginRight: 10,
    resizeMode: 'contain',
  },
  featureText: {
    fontSize: 14,
    color: '#666',
    flex: 1, // Ensures text takes up remaining space
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
