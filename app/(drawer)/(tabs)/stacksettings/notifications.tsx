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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/config/Firebase_Conf';
import { useAuth } from '@/context/AuthContext';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const NOTIFICATION_SETTINGS_KEY = '@notification_settings';

// Default notification settings
const defaultSettings = {
  enabled: true,
};

interface NotificationSettings {
  enabled: boolean;
}

export default function NotificationsScreen() {
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  const [permissions, setPermissions] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    loadSettings();
    checkNotificationPermissions();
  }, []);

  // Load saved settings from AsyncStorage
  const loadSettings = async () => {
    try {
      const savedSettings = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
  };

  // Save settings to AsyncStorage
  const saveSettings = async (newSettings: NotificationSettings) => {
    try {
      await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('Error saving notification settings:', error);
      Alert.alert('Error', 'No se pudieron guardar los ajustes');
    }
  };

  // Check current notification permissions
  const checkNotificationPermissions = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    setPermissions(status === 'granted');
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
            await updateDoc(userRef, { expoPushTokens });
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
    setLoading(true);
    try {
      if (value) {
        // Si se están activando las notificaciones, registrar para push
        await registerForPushNotifications();
      } else {
        // Si se están desactivando, remover el token del usuario
        if (user?.uid) {
          const userRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userRef);
          
          if (userDoc.exists()) {

            await updateDoc(userRef, { expoPushTokens: [] });
          }
        }
      }
      
      const newSettings = { ...settings, enabled: value };
      await saveSettings(newSettings);
    } catch (error) {
      console.error('Error handling notification toggle:', error);
      Alert.alert('Error', 'No se pudo cambiar la configuración de notificaciones');
    } finally {
      setLoading(false);
    }
  };

  const renderSettingRow = (
    title: string,
    description: string,
    value: boolean,
    onValueChange: (value: boolean) => void,
    icon?: keyof typeof Feather.glyphMap,
    disabled: boolean = false
  ) => (
    <View style={styles.settingRow}>
      <View style={styles.settingInfo}>
        {icon && (
          <View style={styles.iconContainer}>
            <Feather name={icon} size={20} color="#FFFFFF" />
          </View>
        )}
        <View style={styles.settingContent}>
          <Text style={styles.settingTitle}>{title}</Text>
          <Text style={styles.settingDescription}>{description}</Text>
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#4A5164', true: '#4CAF50' }}
        thumbColor={value ? '#FFFFFF' : '#AAAAAA'}
        ios_backgroundColor="#4A5164"
        disabled={disabled || loading}
      />
    </View>
  );

  return (
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
          <Text style={styles.headerSubtitle}>Activa o desactiva tus notificaciones segun tus preferencia</Text>
        </View>

        {/* Main switch */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>General</Text>
          <View style={styles.sectionContent}>
            {renderSettingRow(
              'Habilitar notificaciones',
              'Activa o desactiva todas las notificaciones',
              settings.enabled,
              handleMainToggle,
              'bell',
              false
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2A3142',
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
  disabled: {
    opacity: 0.5,
  },
});