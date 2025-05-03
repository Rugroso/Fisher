import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';

const EditProfileScreen = () => {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userData, setUserData] = useState({
    name: '',
    lastName: '',
    username: '',
    email: '',
    cellphone: '',
    gender: '',
    birthdate: '',
    city: '',
    state: '',
    country: '',
  });

  useEffect(() => {
    fetchUserData();
  }, [user]);

  const fetchUserData = async () => {
    if (!user?.uid) return;
    
    try {
      const db = getFirestore();
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserData({
          name: data.name || '',
          lastName: data.lastName || '',
          username: data.username || '',
          email: data.email || '',
          cellphone: data.cellphone || '',
          gender: data.gender || '',
          birthdate: data.birthdate || '',
          city: data.city || '',
          state: data.state || '',
          country: data.country || '',
        });
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      Alert.alert('Error', 'No se pudo cargar la información del usuario');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user?.uid) return;
    
    setSaving(true);
    try {
      const db = getFirestore();
      const userRef = doc(db, 'users', user.uid);
      
      await updateDoc(userRef, {
        name: userData.name,
        lastName: userData.lastName,
        username: userData.username,
        cellphone: userData.cellphone,
        gender: userData.gender,
        birthdate: userData.birthdate,
        city: userData.city,
        state: userData.state,
        country: userData.country,
        updatedAt: new Date().toISOString(),
      });
      
      Alert.alert('Éxito', 'Tu perfil ha sido actualizado');
      router.back();
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'No se pudo actualizar el perfil');
    } finally {
      setSaving(false);
    }
  };



  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen 
        options={{
          headerShown: false,
        }}
      />
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Editar perfil</Text>
          <TouchableOpacity 
            onPress={handleSave} 
            disabled={saving}
            style={styles.saveButton}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Guardar</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Información personal */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Información personal</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nombre</Text>
              <TextInput
                style={styles.input}
                value={userData.name}
                onChangeText={(text) => setUserData({...userData, name: text})}
                placeholder="Tu nombre"
                placeholderTextColor="#6B7280"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Apellido</Text>
              <TextInput
                style={styles.input}
                value={userData.lastName}
                onChangeText={(text) => setUserData({...userData, lastName: text})}
                placeholder="Tu apellido"
                placeholderTextColor="#6B7280"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nombre de usuario</Text>
              <TextInput
                style={[styles.input, styles.disabledInput]}
                value={userData.username}
                onChangeText={(text) => setUserData({...userData, username: text})}
                placeholder="Tu nombre de usuario"
                placeholderTextColor="#6B7280"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Género</Text>
              <View style={styles.genderOptions}>
                <TouchableOpacity
                  style={[
                    styles.genderOption,
                    userData.gender === 'male' && styles.genderOptionSelected
                  ]}
                  onPress={() => setUserData({...userData, gender: 'male'})}
                >
                  <Text style={[
                    styles.genderOptionText,
                    userData.gender === 'male' && styles.genderOptionTextSelected
                  ]}>
                    Hombre
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.genderOption,
                    userData.gender === 'female' && styles.genderOptionSelected
                  ]}
                  onPress={() => setUserData({...userData, gender: 'female'})}
                >
                  <Text style={[
                    styles.genderOptionText,
                    userData.gender === 'female' && styles.genderOptionTextSelected
                  ]}>
                    Mujer
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.genderOption,
                    userData.gender === 'other' && styles.genderOptionSelected
                  ]}
                  onPress={() => setUserData({...userData, gender: 'other'})}
                >
                  <Text style={[
                    styles.genderOptionText,
                    userData.gender === 'other' && styles.genderOptionTextSelected
                  ]}>
                    Otro
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Fecha de nacimiento</Text>
              <TextInput
                style={styles.input}
                value={userData.birthdate}
                onChangeText={(text) => setUserData({...userData, birthdate: text})}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#6B7280"
              />
            </View>
          </View>

          {/* Información de contacto */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Información de contacto</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Correo electrónico</Text>
              <TextInput
                style={[styles.input, styles.disabledInput]}
                value={userData.email}
                editable={false}
                placeholder="Tu correo electrónico"
                placeholderTextColor="#6B7280"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Número de teléfono</Text>
              <TextInput
                style={styles.input}
                value={userData.cellphone}
                onChangeText={(text) => setUserData({...userData, cellphone: text})}
                placeholder="Tu número de teléfono"
                placeholderTextColor="#6B7280"
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* Información de ubicación */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ubicación</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Ciudad</Text>
              <TextInput
                style={styles.input}
                value={userData.city}
                onChangeText={(text) => setUserData({...userData, city: text})}
                placeholder="Tu ciudad"
                placeholderTextColor="#6B7280"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Estado</Text>
              <TextInput
                style={styles.input}
                value={userData.state}
                onChangeText={(text) => setUserData({...userData, state: text})}
                placeholder="Tu estado"
                placeholderTextColor="#6B7280"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>País</Text>
              <TextInput
                style={styles.input}
                value={userData.country}
                onChangeText={(text) => setUserData({...userData, country: text})}
                placeholder="Tu país"
                placeholderTextColor="#6B7280"
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2A3142',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: '#AAAAAA',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#3A4154',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#4A5164',
  },
  disabledInput: {
    backgroundColor: '#2D3445',
    color: '#6B7280',
  },
  genderOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  genderOption: {
    flex: 1,
    backgroundColor: '#3A4154',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4A5164',
  },
  genderOptionSelected: {
    backgroundColor: '#4B5563',
    borderColor: '#6B7280',
  },
  genderOptionText: {
    color: '#AAAAAA',
    fontSize: 16,
  },
  genderOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

export default EditProfileScreen;