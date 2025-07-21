import React from 'react';
import { View, Text, ScrollView, StyleSheet, Image, TouchableOpacity } from 'react-native';


const TermsOfServiceScreen = ({ navigation }) => {
  return (
    <View style={styles.container}>
     
      
      <Image 
        source={require('../assets/logo.png')} 
        style={styles.watermark}
        resizeMode="contain"
      />
   
      <ScrollView style={styles.content}>
        <Text style={styles.title}>Terms of Service</Text>
        <Text style={styles.text}>
          Welcome to MatrixAI! These Terms of Service govern your use of our application and services.
        </Text>

        <Text style={styles.subtitle}>Acceptance of Terms</Text>
        <Text style={styles.text}>
          By accessing or using MatrixAI, you agree to be bound by these Terms. If you disagree, you must not use our services.
        </Text>

        <Text style={styles.subtitle}>User Responsibilities</Text>
        <Text style={styles.text}>
          - You must be at least 13 years old to use MatrixAI
          - You are responsible for maintaining the security of your account
          - You must not use MatrixAI for any illegal activities
          - You must not attempt to reverse engineer or hack our services
        </Text>

        <Text style={styles.subtitle}>Intellectual Property</Text>
        <Text style={styles.text}>
          All content and technology in MatrixAI are protected by copyright and other intellectual property laws. You may not copy, modify, or distribute our content without permission.
        </Text>

        <Text style={styles.subtitle}>Limitation of Liability</Text>
        <Text style={styles.text}>
          MatrixAI is provided "as is" without warranties. We are not liable for any damages arising from your use of our services.
        </Text>

        <Text style={styles.subtitle}>Termination</Text>
        <Text style={styles.text}>
          We may terminate or suspend your access to MatrixAI at any time, without notice, for any reason.
        </Text>

        <Text style={styles.subtitle}>Governing Law</Text>
        <Text style={styles.text}>
          These Terms are governed by the laws of India. Any disputes will be resolved in the courts of New Delhi.
        </Text>

        <Text style={styles.subtitle}>Changes to Terms</Text>
        <Text style={styles.text}>
          We may update these Terms from time to time. Continued use of MatrixAI constitutes acceptance of the updated Terms.
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
    marginBottom: 20,
    alignSelf:'center',
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

export default TermsOfServiceScreen;
