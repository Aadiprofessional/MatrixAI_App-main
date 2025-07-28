import React from 'react';
import { View, Text, ScrollView, StyleSheet, Image, TouchableOpacity, SafeAreaView } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { LinearGradient } from 'react-native-linear-gradient';


const TermsOfServiceScreen = ({ navigation }) => {
  const { getThemeColors, currentTheme } = useTheme();
  const colors = getThemeColors();
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header with back button */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Terms of Service</Text>
        <View style={styles.placeholder} />
      </View>
      
     
 
      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={true}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Icon name="document-text" size={32} color={colors.primary} style={styles.cardIcon} />
            <Text style={[styles.title, { color: colors.text }]}>Terms of Service</Text>
             <View style={styles.logoContainer}>
        <Image 
          source={require('../assets/logo7.png')} 
          style={styles.logo}
          resizeMode="contain"
        />
      </View>
          </View>
          
          <View style={styles.divider} />
          
          <Text style={[styles.text, { color: colors.text }]}>
            Welcome to MatrixAI! These Terms of Service govern your use of our application and services.
          </Text>
          
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Icon name="checkmark-circle" size={24} color={colors.primary} />
              <Text style={[styles.subtitle, { color: colors.text }]}>Acceptance of Terms</Text>
            </View>
            <View style={[styles.infoBox, { backgroundColor: currentTheme === 'dark' ? colors.subtle : '#F8F9FA' }]}>
              <Text style={[styles.infoText, { color: colors.text }]}>
                By accessing or using MatrixAI, you agree to be bound by these Terms. If you disagree, you must not use our services.
              </Text>
            </View>
          </View>

          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Icon name="key" size={24} color={colors.primary} />
              <Text style={[styles.subtitle, { color: colors.text }]}>User Responsibilities</Text>
            </View>
            <View style={[styles.infoBox, { backgroundColor: currentTheme === 'dark' ? colors.subtle : '#F8F9FA' }]}>
              <Text style={[styles.infoText, { color: colors.text }]}>
                As a user of MatrixAI, you must adhere to the following responsibilities:
              </Text>
              <View style={styles.restrictionsList}>
                <View style={styles.restrictionItem}>
                  <Icon name="close-circle" size={18} color={colors.error} style={styles.restrictionIcon} />
                  <Text style={[styles.restrictionText, { color: colors.text }]}>You must be at least 13 years old to use MatrixAI</Text>
                </View>
                <View style={styles.restrictionItem}>
                  <Icon name="close-circle" size={18} color={colors.error} style={styles.restrictionIcon} />
                  <Text style={[styles.restrictionText, { color: colors.text }]}>You are responsible for maintaining the security of your account</Text>
                </View>
                <View style={styles.restrictionItem}>
                  <Icon name="close-circle" size={18} color={colors.error} style={styles.restrictionIcon} />
                  <Text style={[styles.restrictionText, { color: colors.text }]}>You must not use MatrixAI for any illegal activities</Text>
                </View>
                <View style={styles.restrictionItem}>
                  <Icon name="close-circle" size={18} color={colors.error} style={styles.restrictionIcon} />
                  <Text style={[styles.restrictionText, { color: colors.text }]}>You must not attempt to reverse engineer or hack our services</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Icon name="shield" size={24} color={colors.primary} />
              <Text style={[styles.subtitle, { color: colors.text }]}>Intellectual Property</Text>
            </View>
            <View style={[styles.limitationsBox, { backgroundColor: currentTheme === 'dark' ? colors.subtle : '#F8F9FA', borderLeftColor: colors.primary }]}>
              <Text style={[styles.limitationsText, { color: colors.text }]}>
                All content and technology in MatrixAI are protected by copyright and other intellectual property laws. You may not copy, modify, or distribute our content without permission.
              </Text>
            </View>
          </View>

          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Icon name="alert-circle" size={24} color={colors.primary} />
              <Text style={[styles.subtitle, { color: colors.text }]}>Limitation of Liability</Text>
            </View>
            <LinearGradient
              colors={currentTheme === 'dark' ? [colors.card, colors.subtle] : ['#F8F9FA', '#E9ECEF']}
              style={styles.disclaimerBox}
            >
              <Icon name="information-circle" size={36} color={colors.primary} style={styles.disclaimerIcon} />
              <Text style={[styles.disclaimerText, { color: colors.text }]}>
                MatrixAI is provided "as is" without warranties. We are not liable for any damages arising from your use of our services.
              </Text>
            </LinearGradient>
          </View>

          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Icon name="close" size={24} color={colors.primary} />
              <Text style={[styles.subtitle, { color: colors.text }]}>Termination</Text>
            </View>
            <View style={[styles.infoBox, { backgroundColor: currentTheme === 'dark' ? colors.subtle : '#F8F9FA' }]}>
              <Text style={[styles.infoText, { color: colors.text }]}>
                We may terminate or suspend your access to MatrixAI at any time, without notice, for any reason.
              </Text>
            </View>
          </View>

          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Icon name="globe" size={24} color={colors.primary} />
              <Text style={[styles.subtitle, { color: colors.text }]}>Governing Law</Text>
            </View>
            <View style={[styles.infoBox, { backgroundColor: currentTheme === 'dark' ? colors.subtle : '#F8F9FA' }]}>
              <Text style={[styles.infoText, { color: colors.text }]}>
                These Terms are governed by the laws of India. Any disputes will be resolved in the courts of New Delhi.
              </Text>
            </View>
          </View>

          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Icon name="refresh" size={24} color={colors.primary} />
              <Text style={[styles.subtitle, { color: colors.text }]}>Changes to Terms</Text>
            </View>
            <View style={[styles.revisionsBox, { backgroundColor: currentTheme === 'dark' ? colors.subtle : '#F8F9FA' }]}>
              <View style={styles.revisionsContent}>
                <Icon name="time" size={24} color={colors.primary} style={styles.revisionsIcon} />
                <Text style={[styles.revisionsText, { color: colors.text }]}>
                  We may update these Terms from time to time. Continued use of MatrixAI constitutes acceptance of the updated Terms.
                </Text>
              </View>
            </View>
          </View>
          
          <View style={styles.agreementContainer}>
            <Icon name="checkmark-done" size={24} color={colors.primary} style={styles.agreementIcon} />
            <Text style={[styles.agreementText, { color: colors.text }]}>
              By continuing to use our services, you acknowledge that you have read and understand these Terms of Service.
            </Text>
          </View>
          
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.placeholder }]}>Last updated: June 2023</Text>
            <View style={styles.footerDivider} />
            <Text style={[styles.footerText, { color: colors.placeholder }]}>MatrixAI © 2023</Text>
          </View>
        </View>
      </ScrollView>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 10,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  placeholder: {
    width: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginVertical: 10,
    zIndex: 1,
  },
  logo: {
    width: 120,
    height: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  cardIcon: {
    marginRight: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  sectionContainer: {
    marginTop: 24,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },
  infoBox: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 15,
    lineHeight: 22,
  },
  restrictionsList: {
    marginTop: 12,
  },
  restrictionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  restrictionIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  restrictionText: {
    fontSize: 15,
    flex: 1,
    lineHeight: 22,
  },
  limitationsBox: {
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
  },
  limitationsText: {
    fontSize: 15,
    lineHeight: 22,
  },
  disclaimerBox: {
    borderRadius: 12,
    overflow: 'hidden',
    padding: 16,
    alignItems: 'center',
  },
  disclaimerIcon: {
    marginBottom: 12,
  },
  disclaimerText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  revisionsBox: {
    borderRadius: 12,
    padding: 16,
  },
  revisionsContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  revisionsIcon: {
    marginRight: 12,
  },
  revisionsText: {
    fontSize: 15,
    flex: 1,
    lineHeight: 22,
  },
  agreementContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 123, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
  },
  agreementIcon: {
    marginRight: 12,
  },
  agreementText: {
    fontSize: 15,
    flex: 1,
    fontWeight: '500',
    lineHeight: 22,
  },
  footer: {
    marginTop: 30,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    marginBottom: 4,
  },
  footerDivider: {
    width: 40,
    height: 2,
    backgroundColor: '#E0E0E0',
    marginVertical: 8,
  },
});

export default TermsOfServiceScreen;
