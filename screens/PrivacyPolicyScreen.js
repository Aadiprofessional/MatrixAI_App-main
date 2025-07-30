import React from 'react';
import { View, Text, ScrollView, StyleSheet, Image, TouchableOpacity, SafeAreaView } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { LinearGradient } from 'react-native-linear-gradient';


const PrivacyPolicyScreen = ({ navigation }) => {
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
        
        <Text style={[styles.headerTitle, { color: colors.text }]}>Privacy Policy</Text>
        <View style={styles.placeholder} />
      </View>
   
 
      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={true}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Icon name="shield-checkmark" size={32} color={colors.primary} style={styles.cardIcon} />
            <Text style={[styles.title, { color: colors.text }]}>Privacy Policy</Text>
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
            At MatrixAI, we take your privacy seriously. This Privacy Policy explains how we collect, use, and protect your personal information.
          </Text>
          
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Icon name="information-circle" size={24} color={colors.primary} />
              <Text style={[styles.subtitle, { color: colors.text }]}>Information We Collect</Text>
            </View>
            <View style={[styles.infoBox, { backgroundColor: currentTheme === 'dark' ? colors.subtle : '#F8F9FA' }]}>
              <View style={styles.infoItem}>
                <Icon name="person" size={18} color={colors.primary} style={styles.infoIcon} />
                <Text style={[styles.infoText, { color: colors.text }]}>Personal identification information</Text>
              </View>
              <View style={styles.infoItem}>
                <Icon name="analytics" size={18} color={colors.primary} style={styles.infoIcon} />
                <Text style={[styles.infoText, { color: colors.text }]}>Usage data and analytics</Text>
              </View>
              <View style={styles.infoItem}>
                <Icon name="phone-portrait" size={18} color={colors.primary} style={styles.infoIcon} />
                <Text style={[styles.infoText, { color: colors.text }]}>Device information</Text>
              </View>
              <View style={styles.infoItem}>
                <Icon name="card" size={18} color={colors.primary} style={styles.infoIcon} />
                <Text style={[styles.infoText, { color: colors.text }]}>Payment information</Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Icon name="settings" size={24} color={colors.primary} />
              <Text style={[styles.subtitle, { color: colors.text }]}>How We Use Your Information</Text>
            </View>
            <View style={[styles.infoBox, { backgroundColor: currentTheme === 'dark' ? colors.subtle : '#F8F9FA' }]}>
              <View style={styles.infoItem}>
                <Icon name="cloud-done" size={18} color={colors.primary} style={styles.infoIcon} />
                <Text style={[styles.infoText, { color: colors.text }]}>To provide and maintain our services</Text>
              </View>
              <View style={styles.infoItem}>
                <Icon name="happy" size={18} color={colors.primary} style={styles.infoIcon} />
                <Text style={[styles.infoText, { color: colors.text }]}>To improve user experience</Text>
              </View>
              <View style={styles.infoItem}>
                <Icon name="cash" size={18} color={colors.primary} style={styles.infoIcon} />
                <Text style={[styles.infoText, { color: colors.text }]}>To process transactions</Text>
              </View>
              <View style={styles.infoItem}>
                <Icon name="chatbubbles" size={18} color={colors.primary} style={styles.infoIcon} />
                <Text style={[styles.infoText, { color: colors.text }]}>To communicate with you</Text>
              </View>
              <View style={styles.infoItem}>
                <Icon name="shield" size={18} color={colors.primary} style={styles.infoIcon} />
                <Text style={[styles.infoText, { color: colors.text }]}>For security and fraud prevention</Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Icon name="lock-closed" size={24} color={colors.primary} />
              <Text style={[styles.subtitle, { color: colors.text }]}>Data Security</Text>
            </View>
            <View style={[styles.securityBox, { backgroundColor: currentTheme === 'dark' ? colors.subtle : '#F8F9FA' }]}>
              <Icon name="shield" size={36} color={colors.primary} style={styles.securityIcon} />
              <Text style={[styles.securityText, { color: colors.text }]}>
                We implement industry-standard security measures to protect your data, including encryption and secure servers.
              </Text>
            </View>
          </View>

          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Icon name="checkmark-circle" size={24} color={colors.primary} />
              <Text style={[styles.subtitle, { color: colors.text }]}>Your Rights</Text>
            </View>
            <LinearGradient
              colors={currentTheme === 'dark' ? [colors.card, colors.subtle] : ['#F8F9FA', '#E9ECEF']}
              style={styles.rightsBox}
            >
              <View style={styles.rightsContent}>
                <Text style={[styles.rightsText, { color: colors.text }]}>
                  You have the right to access, correct, or delete your personal information.
                </Text>
                <TouchableOpacity style={[styles.contactButton, { backgroundColor: colors.primary }]}>
                  <Icon name="mail" size={16} color="#FFFFFF" style={styles.contactIcon} />
                  <Text style={styles.contactButtonText}>Contact Us</Text>
                </TouchableOpacity>
                <Text style={[styles.emailText, { color: colors.text }]}>privacy@matrixaiglobal.com</Text>
              </View>
            </LinearGradient>
          </View>

          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Icon name="refresh" size={24} color={colors.primary} />
              <Text style={[styles.subtitle, { color: colors.text }]}>Changes to This Policy</Text>
            </View>
            <View style={[styles.noticeBox, { backgroundColor: currentTheme === 'dark' ? colors.subtle : '#F8F9FA' }]}>
              <Icon name="notifications" size={24} color={colors.primary} style={styles.noticeIcon} />
              <Text style={[styles.noticeText, { color: colors.text }]}>
                We may update this policy from time to time. We will notify you of any significant changes.
              </Text>
            </View>
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
    paddingVertical: 10,
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
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoIcon: {
    marginRight: 12,
    width: 22,
  },
  infoText: {
    fontSize: 15,
    flex: 1,
  },
  securityBox: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  securityIcon: {
    marginBottom: 12,
  },
  securityText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  rightsBox: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  rightsContent: {
    padding: 16,
    alignItems: 'center',
  },
  rightsText: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 8,
  },
  contactIcon: {
    marginRight: 6,
  },
  contactButtonText: {
    color: '#FFFFFF',
    fontWeight: '500',
    fontSize: 14,
  },
  emailText: {
    fontSize: 14,
    opacity: 0.8,
  },
  noticeBox: {
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  noticeIcon: {
    marginRight: 12,
  },
  noticeText: {
    fontSize: 15,
    flex: 1,
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

export default PrivacyPolicyScreen;
