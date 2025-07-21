import React from 'react';
import { View, Text, ScrollView, StyleSheet, Image, TouchableOpacity } from 'react-native';


const PrivacyPolicyScreen = ({ navigation }) => {
  return (
    <View style={styles.container}>
     
      <Image 
        source={require('../assets/logo.png')} 
        style={styles.watermark}
        resizeMode="contain"
      />
 
      <ScrollView style={styles.content}>
        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.text}>
          At MatrixAI, we take your privacy seriously. This Privacy Policy explains how we collect, use, and protect your personal information.
        </Text>
        
        <Text style={styles.subtitle}>Information We Collect</Text>
        <Text style={styles.text}>
          - Personal identification information (Name, email address, phone number)
          - Usage data and analytics
          - Device information
          - Payment information (processed securely through third-party providers)
        </Text>

        <Text style={styles.subtitle}>How We Use Your Information</Text>
        <Text style={styles.text}>
          - To provide and maintain our services
          - To improve user experience
          - To process transactions
          - To communicate with you
          - For security and fraud prevention
        </Text>

        <Text style={styles.subtitle}>Data Security</Text>
        <Text style={styles.text}>
          We implement industry-standard security measures to protect your data, including encryption and secure servers.
        </Text>

        <Text style={styles.subtitle}>Your Rights</Text>
        <Text style={styles.text}>
          You have the right to access, correct, or delete your personal information. Contact us at privacy@matrixai.com for any requests.
        </Text>

        <Text style={styles.subtitle}>Changes to This Policy</Text>
        <Text style={styles.text}>
          We may update this policy from time to time. We will notify you of any significant changes.
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',

  },
  backButton: {
    width: 24,
    height: 24,
    marginRight: 15,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  watermark: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0.1,
    zIndex: 1,
  },
  content: {
    paddingHorizontal:15
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    alignSelf:'center',
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 15,
    marginBottom: 10,
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 15,
  },
});

export default PrivacyPolicyScreen;
