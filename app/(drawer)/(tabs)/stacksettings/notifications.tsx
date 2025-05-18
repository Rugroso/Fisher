import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Switch,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  TouchableOpacity
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { useRouter } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/config/Firebase_Conf';
import { useAuth } from '@/context/AuthContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function NotificationsScreen() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (user?.uid) {
      loadUserSettings();
    }
  }, [user]);

  // Load saved settings from Firebase
  const loadUserSettings = async () => {
    if (!user?.uid) return;
    
    try {
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        // Check if user has notifications enabled (default to true if not set)
        const enabled = userData.notificationsEnabled !== false;
        setNotificationsEnabled(enabled);
      }
    } catch (error) {
      console.error('Error loading user settings:', error);
    }
  };

  // Register for push notifications and save token to Firebase
  const registerForPushNotifications = async (): Promise<string | undefined> => {
    if (!Device.isDevice) {
      Alert.alert('Error', 'Las notificaciones push requieren un dispositivo físico');
      return;
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        Alert.alert('Error', 'No se pudo obtener permiso para notificaciones push');
        return;
      }

      const token = (await Notifications.getExpoPushTokenAsync()).data;
      
      // Save token to Firebase
      if (user?.uid && token) {
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const expoPushTokens = userData.expoPushTokens || [];
          
          if (!expoPushTokens.includes(token)) {
            expoPushTokens.push(token);
            await updateDoc(userRef, { 
              expoPushTokens,
              notificationsEnabled: true 
            });
          }
        }
      }
      
      if (Platform.OS === 'android') {
        Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }
      
      return token;
    } catch (error) {
      console.error('Error registering for push notifications:', error);
      Alert.alert('Error', 'No se pudo registrar para notificaciones push');
    }
  };

  // Handle main enabled toggle
  const handleMainToggle = async (value: boolean) => {
    if (!user?.uid) {
      Alert.alert('Error', 'Debes iniciar sesión para cambiar esta configuración');
      return;
    }

    setLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      
      if (value) {
        // Si se están activando las notificaciones, registrar para push
        await registerForPushNotifications();
        await updateDoc(userRef, { notificationsEnabled: true });
        console.log(`Notificaciones activadas para usuario ${user.uid}`);
      } else {
        // Si se están desactivando, actualizar solo el flag en Firebase
        await updateDoc(userRef, { notificationsEnabled: false });
        console.log(`Notificaciones desactivadas para usuario ${user.uid}`);
      }
      
      setNotificationsEnabled(value);
    } catch (error) {
      console.error('Error handling notification toggle:', error);
      Alert.alert('Error', 'No se pudo cambiar la configuración de notificaciones');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.bigcontainer}>
    <View style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Feather name="arrow-left" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notificaciones</Text>
          <Text style={styles.headerSubtitle}>Personaliza tus preferencias de notificación</Text>
        </View>

        {/* Main switch */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>General</Text>
          <View style={styles.sectionContent}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={styles.iconContainer}>
                  <Feather name="bell" size={20} color="#FFFFFF" />
                </View>
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>Habilitar notificaciones</Text>
                  <Text style={styles.settingDescription}>
                    Activa o desactiva todas las notificaciones
                  </Text>
                </View>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={handleMainToggle}
                trackColor={{ false: '#4A5164', true: '#4CAF50' }}
                thumbColor={notificationsEnabled ? '#FFFFFF' : '#AAAAAA'}
                ios_backgroundColor="#4A5164"
                disabled={loading}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
    </View>
  );
}

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
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 100,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
  },
  backButton: {
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#AAAAAA',
  },
  section: {
    marginTop: 20,
    marginHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
    paddingLeft: 4,
  },
  sectionContent: {
    backgroundColor: '#3A4154',
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#4A5164',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4A5164',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#AAAAAA',
    lineHeight: 18,
  },
});