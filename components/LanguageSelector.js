import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useLanguage } from '../context/LanguageContext';
import { LANGUAGES } from '../utils/languageUtils';

const LanguageSelector = ({ style, iconSize = 20, textStyle = {} }) => {
  const { currentLanguage, changeLanguage, t } = useLanguage();
  const [modalVisible, setModalVisible] = useState(false);

  const handleSelectLanguage = async (language) => {
    await changeLanguage(language);
    setModalVisible(false);
  };

  return (
    <View style={style}>
      <TouchableOpacity
        style={styles.button}
        onPress={() => setModalVisible(true)}
      >
        <Ionicons name="language" size={iconSize} color="#333" />
        <Text style={[styles.buttonText, textStyle]}>
          {LANGUAGES[currentLanguage]?.name || currentLanguage}
        </Text>
        <Ionicons name="chevron-down" size={iconSize - 4} color="#333" />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('chooseLanguage')}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={Object.keys(LANGUAGES)}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.languageItem,
                    currentLanguage === item && styles.selectedLanguageItem,
                  ]}
                  onPress={() => handleSelectLanguage(item)}
                >
                  <Text
                    style={[
                      styles.languageText,
                      currentLanguage === item && styles.selectedLanguageText,
                    ]}
                  >
                    {LANGUAGES[item].name}
                  </Text>
                  {currentLanguage === item && (
                    <Ionicons name="checkmark" size={20} color="#fff" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  buttonText: {
    marginHorizontal: 8,
    fontSize: 16,
    color: '#333',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  selectedLanguageItem: {
    backgroundColor: '#007AFF',
  },
  languageText: {
    fontSize: 16,
    color: '#333',
  },
  selectedLanguageText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default LanguageSelector; 