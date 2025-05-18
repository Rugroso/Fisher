import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const DonateScreen = () => {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.bigcontainer}>
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Donaciones</Text>
      </View>
      
      <View style={styles.pendingContainer}>
        <Text style={styles.pendingText}>Pendiente...</Text>
      </View>
    </SafeAreaView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  bigcontainer: {
    flex: 1,
    backgroundColor: "#2A3142",
  },
  container: {
    flex: 1,
    backgroundColor: "#2A3142",
    width: Platform.OS === 'web' ? "40%":"100%",
    alignSelf: "center",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 10 : 30,
    paddingBottom: 20,
  },
  backButton: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  pendingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pendingText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default DonateScreen;