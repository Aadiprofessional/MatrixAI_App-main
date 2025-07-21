import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import Toast from 'react-native-toast-message';
import { useAuth } from '../context/AuthContext';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
const FeedbackScreen = ({ route, navigation }) => {
  const [issue, setIssue] = useState('');
  const [description, setDescription] = useState('');
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();
  const { uid } = useAuth();
  const { t } = useLanguage();
console.log(uid,'user');
  const commonIssues = [
    t('greatExperienceAndHelpful'),
    t('goodExperienceButCouldBeImproved'),
    t('couldBeBetter'),
    t('notHelpfulAtAll'),
    t('otherIssues'),
  ];

  const handleSubmit = async () => {
    if (!issue) {
      Alert.alert('', t('pleaseSelectIssueType'));
      return;
    }
    
    try {
      const response = await fetch('https://main-matrixai-server-lujmidrakh.cn-hangzhou.fcapp.run/api/user/submitFeedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          issue: issue,
          description: description || '',
          uid: uid,
        }),
      });
      console.log({ issue, description, uid });

      const data = await response.json();
      
      if (response.ok) {
        Toast.show({
          type: 'success',
          text1: t('success'),
          text2: t('feedbackSubmittedSuccessfully'),
        });
        navigation.goBack();
      } else {
        Alert.alert(t('error'), data.message || t('failedToSubmitFeedback'));
        console.log(data,'data');
      }
    } catch (error) {
      Alert.alert(t('error'), t('errorOccurredWhileSubmittingFeedback'));
      console.error(error);
    }
  };

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
      <View style={[styles.header, {backgroundColor: colors.background , borderBottomWidth: 0.8, borderColor: colors.border}]}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back-ios-new" size={24} color="white" />
                               </TouchableOpacity>
        <Text style={[styles.headerTitle, {color: colors.text}]}>{t('feedback')}</Text>
      </View>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 70}
      >
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
       

        <Text style={[styles.sectionTitle, {color: colors.text}]}>{t('whatDoYouThinkAboutOurApp')}</Text>
        <View style={[styles.issuesContainer, {backgroundColor: colors.background2}]}>
          {commonIssues.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.issueButton,
                issue === item && styles.issueButtonSelected,
              ]}
              onPress={() => setIssue(item)}
            >
              <Text
                style={[
                  styles.issueButtonText,
                  issue === item && styles.issueButtonTextSelected,
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.sectionTitle, {color: colors.text}]}>{t('describeYourIssue')}</Text>
        <View style={[styles.textInputContainer, {backgroundColor: colors.background2}]}>
          <TextInput
            style={[styles.textInput, {color: colors.text}]}
            multiline
            numberOfLines={6}
            placeholder={t('provideIssueDetails')}
            value={description}
            onChangeText={setDescription}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity style={[styles.submitButton, {backgroundColor: colors.primary}]} onPress={handleSubmit}>
          <Text style={[styles.submitButtonText, {color: '#fff'}]}>{t('submitRequest')}</Text>
        </TouchableOpacity>

      
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',

  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#007bff',
   
    marginRight:10,
  },
  headerIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 16,
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  orderInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderInfoText: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  issuesContainer: {
    marginBottom: 24,
  },
  issueButton: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  issueButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  issueButtonText: {
    color: '#333',
    fontSize: 14,
  },
  issueButtonTextSelected: {
    color: '#fff',
  },
  textInputContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  textInput: {
    height: 120,
    fontSize: 14,
    color: '#333',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  supportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  supportInfo: {
    flex: 1,
    marginLeft: 12,
  },
  supportTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  supportText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  callButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 24,
  },
});

export default FeedbackScreen;