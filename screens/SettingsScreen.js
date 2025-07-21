import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ScrollView,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { ThemedView, ThemedText, ThemedCard } from '../components/ThemedView';
import { useLanguage } from '../context/LanguageContext';
import { LANGUAGES } from '../utils/languageUtils';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAuthUser } from '../hooks/useAuthUser';
import ThemedStatusBar from '../components/ThemedStatusBar';

const SettingsScreen = ({ navigation }) => {
  const { t, currentLanguage, changeLanguage } = useLanguage();
  const { getThemeColors, currentTheme, changeTheme, themes } = useTheme();
  const { uid } = useAuthUser();
  const colors = getThemeColors();
  
  const [isDarkMode, setIsDarkMode] = useState(currentTheme === 'dark');
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(currentLanguage);
  const [selectedTheme, setSelectedTheme] = useState(currentTheme);
  const [isEdited, setIsEdited] = useState(false);
  
  useEffect(() => {
    setIsDarkMode(currentTheme === 'dark');
    setSelectedTheme(currentTheme);
    setSelectedLanguage(currentLanguage);
  }, [currentTheme, currentLanguage]);
  
  const toggleTheme = () => {
    const newTheme = !isDarkMode ? 'dark' : 'light';
    setSelectedTheme(newTheme);
    setIsDarkMode(!isDarkMode);
    setIsEdited(true);
  };
  
  const handleSelectLanguage = (language) => {
    setSelectedLanguage(language);
    setLanguageModalVisible(false);
    setIsEdited(true);
  };

  const handleSelectTheme = (theme) => {
    setSelectedTheme(theme);
    setThemeModalVisible(false);
    setIsEdited(true);
  };
  
  const saveSettings = async () => {
    try {
      // Save settings to server
      const response = await fetch('https://main-matrixai-server-lujmidrakh.cn-hangzhou.fcapp.run/api/user/edituser', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uid,
          preferred_language: selectedLanguage,
          preferred_theme: selectedTheme,
        }),
      });

      const result = await response.json();
      if (result.success) {
        // Apply settings
        if (selectedLanguage !== currentLanguage) {
          await changeLanguage(selectedLanguage);
        }
        
        if (selectedTheme !== currentTheme) {
          await changeTheme(selectedTheme);
        }
        
        Alert.alert('Success', t('settingsSaved'));
        setIsEdited(false);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', t('errorOccurred'));
    }
  };
  
  const checkForUpdates = () => {
    // Simulate update check
    Alert.alert('Update Check', 'Your app is up to date.');
  };
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ThemedStatusBar />
      <View style={[styles.header, {backgroundColor: colors.background}]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back-ios-new" size={24} color="white" />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>{t('settings')}</ThemedText>
      </View>
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>{t('appearance')}</ThemedText>
          
          <ThemedCard style={styles.settingCard}>
            {/* Language Setting */}
            <TouchableOpacity 
              style={styles.settingItem} 
              onPress={() => setLanguageModalVisible(true)}
            >
              <View style={styles.settingInfo}>
                <Ionicons name="language-outline" size={24} color={colors.primary} />
                <ThemedText style={styles.settingLabel}>{t('language')}</ThemedText>
              </View>
              <View style={styles.settingAction}>
                <ThemedText style={styles.settingValue}>
                  {LANGUAGES[selectedLanguage]?.name || t('notSet')}
                </ThemedText>
                <MaterialIcons name="chevron-right" size={24} color={colors.text} />
              </View>
            </TouchableOpacity>
            
            {/* Theme Setting */}
            <TouchableOpacity 
              style={styles.settingItem} 
              onPress={() => setThemeModalVisible(true)}
            >
              <View style={styles.settingInfo}>
                <Ionicons name="color-palette-outline" size={24} color={colors.primary} />
                <ThemedText style={styles.settingLabel}>{t('themeMode')}</ThemedText>
              </View>
              <View style={styles.settingAction}>
                <ThemedText style={styles.settingValue}>
                  {themes[selectedTheme]?.name || t('notSet')}
                </ThemedText>
                <MaterialIcons name="chevron-right" size={24} color={colors.text} />
              </View>
            </TouchableOpacity>
            
            {/* Dark Mode Toggle */}
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Ionicons 
                  name={isDarkMode ? "moon" : "sunny-outline"} 
                  size={24} 
                  color={colors.primary} 
                />
                <ThemedText style={styles.settingLabel}>{t('darkMode')}</ThemedText>
              </View>
              <Switch
                trackColor={{ false: colors.border, true: colors.primary + '80' }}
                thumbColor={isDarkMode ? colors.primary : colors.disabled}
                ios_backgroundColor={colors.border}
                onValueChange={toggleTheme}
                value={isDarkMode}
              />
            </View>
          </ThemedCard>
        </View>
        
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>{t('application')}</ThemedText>
          
          <ThemedCard style={styles.settingCard}>
            {/* Check for Updates */}
            <TouchableOpacity 
              style={styles.settingItem} 
              onPress={checkForUpdates}
            >
              <View style={styles.settingInfo}>
                <Ionicons name="cloud-download-outline" size={24} color={colors.primary} />
                <ThemedText style={styles.settingLabel}>{t('checkForUpdates')}</ThemedText>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={colors.text} />
            </TouchableOpacity>
            
            {/* About */}
            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Ionicons name="information-circle-outline" size={24} color={colors.primary} />
                <ThemedText style={styles.settingLabel}>{t('about')}</ThemedText>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={colors.text} />
            </TouchableOpacity>
          </ThemedCard>
          
          <ThemedText style={styles.versionInfo}>Version 1.0.0</ThemedText>
        </View>
        
        {isEdited && (
          <TouchableOpacity 
            style={[styles.saveButton, {backgroundColor: colors.primary}]} 
            onPress={saveSettings}
          >
            <Text style={styles.saveButtonText}>{t('saveSettings')}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
      
      {/* Language Selection Modal */}
      <Modal
        visible={languageModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setLanguageModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, {backgroundColor: colors.card}]}>
            <View style={[styles.modalHeader, {borderBottomColor: colors.border}]}>
              <ThemedText style={styles.modalTitle}>{t('chooseLanguage')}</ThemedText>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setLanguageModalVisible(false)}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={Object.keys(LANGUAGES)}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    {borderBottomColor: colors.border},
                    selectedLanguage === item && [styles.selectedItem, {backgroundColor: colors.primary}],
                  ]}
                  onPress={() => handleSelectLanguage(item)}
                >
                  <ThemedText
                    style={[
                      styles.modalItemText,
                      selectedLanguage === item && styles.selectedItemText,
                    ]}
                  >
                    {LANGUAGES[item].name}
                  </ThemedText>
                  {selectedLanguage === item && (
                    <Ionicons name="checkmark" size={20} color="#fff" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Theme Selection Modal */}
      <Modal
        visible={themeModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setThemeModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, {backgroundColor: colors.card}]}>
            <View style={[styles.modalHeader, {borderBottomColor: colors.border}]}>
              <ThemedText style={styles.modalTitle}>{t('chooseTheme')}</ThemedText>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setThemeModalVisible(false)}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={Object.keys(themes)}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    {borderBottomColor: colors.border},
                    selectedTheme === item && [styles.selectedItem, {backgroundColor: colors.primary}],
                  ]}
                  onPress={() => handleSelectTheme(item)}
                >
                  <View style={styles.themeColorPreview}>
                    <View 
                      style={[
                        styles.themeColorSwatch, 
                        { backgroundColor: themes[item].colors.background }
                      ]} 
                    />
                    <View 
                      style={[
                        styles.themeColorSwatch, 
                        { backgroundColor: themes[item].colors.card }
                      ]} 
                    />
                    <View 
                      style={[
                        styles.themeColorSwatch, 
                        { backgroundColor: themes[item].colors.primary }
                      ]} 
                    />
                  </View>
                  <ThemedText
                    style={[
                      styles.modalItemText,
                      selectedTheme === item && styles.selectedItemText,
                      {flex: 1}
                    ]}
                  >
                    {themes[item].name}
                  </ThemedText>
                  {selectedTheme === item && (
                    <Ionicons name="checkmark" size={20} color="#fff" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
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
    padding: 16,
    paddingBottom: 8,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#007bff',
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginLeft: 8,
    marginBottom: 12,
    opacity: 0.7,
  },
  settingCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 8,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(150, 150, 150, 0.2)',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
  },
  settingAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingValue: {
    fontSize: 14,
    opacity: 0.7,
    marginRight: 8,
  },
  versionInfo: {
    fontSize: 14,
    opacity: 0.5,
    textAlign: 'center',
    marginTop: 16,
  },
  saveButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  selectedItem: {
    backgroundColor: '#007AFF',
  },
  modalItemText: {
    fontSize: 16,
  },
  selectedItemText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  themeColorPreview: {
    flexDirection: 'row',
    marginRight: 12,
  },
  themeColorSwatch: {
    width: 20,
    height: 20,
    borderRadius: 4,
    marginRight: 4,
    borderWidth: 1,
    borderColor: 'rgba(150, 150, 150, 0.3)',
  },
});

export default SettingsScreen;
