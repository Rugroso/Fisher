"use client"

import { useState, useEffect } from "react"
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
  Image,
  Platform,
} from "react-native"
import { Feather } from "@expo/vector-icons"
import { useRouter, useLocalSearchParams, Stack } from "expo-router"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { db } from "../../../config/Firebase_Conf"
import * as Haptics from "expo-haptics"
import * as ImagePicker from "expo-image-picker"
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { storage } from "../../../config/Firebase_Conf"
import type { User } from "../../../types"

export default function EditUserScreen() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const userId = params.userId as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [userData, setUserData] = useState({
    name: "",
    lastName: "",
    username: "",
    email: "",
    cellphone: "",
    gender: "",
    birthdate: "",
    city: "",
    state: "",
    country: "",
    profilePicture: "",
    isAdmin: false,
    isVerified: false,
  })

  useEffect(() => {
    fetchUserData()
  }, [userId])

  const fetchUserData = async () => {
    if (!userId) return

    try {
      setLoading(true)
      const userRef = doc(db, "users", userId)
      const userDoc = await getDoc(userRef)

      if (userDoc.exists()) {
        const data = userDoc.data() as User
        setUserData({
          name: data.name || "",
          lastName: data.lastName || "",
          username: data.username || "",
          email: data.email || "",
          cellphone: data.cellphone || "",
          gender: data.gender || "",
          birthdate: data.birthdate || "",
          city: data.city || "",
          state: data.state || "",
          country: data.country || "",
          profilePicture: data.profilePicture || "",
          isAdmin: data.isAdmin || false,
          isVerified: data.isVerified || false,
        })
      }
    } catch (error) {
      console.error("Error al cargar datos del usuario:", error)
      Alert.alert("Error", "No se pudieron cargar los datos del usuario")
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!userId) return

    setSaving(true)
    try {
      const userRef = doc(db, "users", userId)

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
        isAdmin: userData.isAdmin,
        isVerified: userData.isVerified,
        updatedAt: new Date().toISOString(),
      })

      Alert.alert("Éxito", "Usuario actualizado correctamente")
      router.back()
    } catch (error) {
      console.error("Error al actualizar usuario:", error)
      Alert.alert("Error", "No se pudo actualizar el usuario")
    } finally {
      setSaving(false)
    }
  }

  const pickImage = async () => {
    if (Platform.OS !== "web") {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== "granted") {
        Alert.alert("Error", "Se necesitan permisos para acceder a la galería")
        return
      }
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      })

      if (!result.canceled) {
        await uploadImage(result.assets[0].uri)
      }
    } catch (error) {
      console.error("Error al seleccionar imagen:", error)
      Alert.alert("Error", "No se pudo seleccionar la imagen")
    }
  }

  const uploadImage = async (uri: string) => {
    if (!userId) return

    setUploadingImage(true)
    try {
      const response = await fetch(uri)
      const blob = await response.blob()
      const filename = `profile_pictures/${userId}_${Date.now()}`
      const storageRef = ref(storage, filename)

      const uploadTask = uploadBytesResumable(storageRef, blob)

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          console.log("Progreso de carga:", progress)
        },
        (error) => {
          console.error("Error al subir imagen:", error)
          Alert.alert("Error", "No se pudo subir la imagen")
          setUploadingImage(false)
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
          setUserData((prev) => ({ ...prev, profilePicture: downloadURL }))
          setUploadingImage(false)
        }
      )
    } catch (error) {
      console.error("Error al procesar imagen:", error)
      Alert.alert("Error", "No se pudo procesar la imagen")
      setUploadingImage(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingText}>Cargando datos del usuario...</Text>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Editar Usuario</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <TouchableOpacity style={styles.imageContainer} onPress={pickImage}>
            <Image
              source={
                userData.profilePicture
                  ? { uri: userData.profilePicture }
                  : require("../../../assets/placeholders/user_icon.png")
              }
              style={styles.profileImage}
            />
            <View style={styles.imageOverlay}>
              <Feather name="camera" size={24} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nombre</Text>
              <TextInput
                style={styles.input}
                value={userData.name}
                onChangeText={(text) => setUserData((prev) => ({ ...prev, name: text }))}
                placeholder="Nombre"
                placeholderTextColor="#A0AEC0"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Apellido</Text>
              <TextInput
                style={styles.input}
                value={userData.lastName}
                onChangeText={(text) => setUserData((prev) => ({ ...prev, lastName: text }))}
                placeholder="Apellido"
                placeholderTextColor="#A0AEC0"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Username</Text>
              <TextInput
                style={styles.input}
                value={userData.username}
                onChangeText={(text) => setUserData((prev) => ({ ...prev, username: text }))}
                placeholder="Username"
                placeholderTextColor="#A0AEC0"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={userData.email}
                onChangeText={(text) => setUserData((prev) => ({ ...prev, email: text }))}
                placeholder="Email"
                placeholderTextColor="#A0AEC0"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Teléfono</Text>
              <TextInput
                style={styles.input}
                value={userData.cellphone}
                onChangeText={(text) => setUserData((prev) => ({ ...prev, cellphone: text }))}
                placeholder="Teléfono"
                placeholderTextColor="#A0AEC0"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Género</Text>
              <TextInput
                style={styles.input}
                value={userData.gender}
                onChangeText={(text) => setUserData((prev) => ({ ...prev, gender: text }))}
                placeholder="Género"
                placeholderTextColor="#A0AEC0"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Fecha de Nacimiento</Text>
              <TextInput
                style={styles.input}
                value={userData.birthdate}
                onChangeText={(text) => setUserData((prev) => ({ ...prev, birthdate: text }))}
                placeholder="Fecha de Nacimiento"
                placeholderTextColor="#A0AEC0"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Ciudad</Text>
              <TextInput
                style={styles.input}
                value={userData.city}
                onChangeText={(text) => setUserData((prev) => ({ ...prev, city: text }))}
                placeholder="Ciudad"
                placeholderTextColor="#A0AEC0"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Estado</Text>
              <TextInput
                style={styles.input}
                value={userData.state}
                onChangeText={(text) => setUserData((prev) => ({ ...prev, state: text }))}
                placeholder="Estado"
                placeholderTextColor="#A0AEC0"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>País</Text>
              <TextInput
                style={styles.input}
                value={userData.country}
                onChangeText={(text) => setUserData((prev) => ({ ...prev, country: text }))}
                placeholder="País"
                placeholderTextColor="#A0AEC0"
              />
            </View>

            <View style={styles.switchGroup}>
              <Text style={styles.label}>Administrador</Text>
              <TouchableOpacity
                style={[styles.switch, userData.isAdmin && styles.switchActive]}
                onPress={() => setUserData((prev) => ({ ...prev, isAdmin: !prev.isAdmin }))}
              >
                <View style={[styles.switchThumb, userData.isAdmin && styles.switchThumbActive]} />
              </TouchableOpacity>
            </View>

            <View style={styles.switchGroup}>
              <Text style={styles.label}>Verificado</Text>
              <TouchableOpacity
                style={[styles.switch, userData.isVerified && styles.switchActive]}
                onPress={() => setUserData((prev) => ({ ...prev, isVerified: !prev.isVerified }))}
              >
                <View style={[styles.switchThumb, userData.isVerified && styles.switchThumbActive]} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Guardar Cambios</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#2A3142",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#3C4255",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#2A3142",
  },
  loadingText: {
    color: "#FFFFFF",
    marginTop: 12,
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  imageContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 24,
    alignSelf: "center",
    position: "relative",
  },
  profileImage: {
    width: "100%",
    height: "100%",
    borderRadius: 60,
  },
  imageOverlay: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#8BB9FE",
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    color: "#D1D5DB",
    fontWeight: "500",
  },
  input: {
    backgroundColor: "#3C4255",
    borderRadius: 8,
    padding: 12,
    color: "#FFFFFF",
    fontSize: 16,
  },
  switchGroup: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  switch: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#4C5366",
    padding: 2,
  },
  switchActive: {
    backgroundColor: "#8BB9FE",
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },
  switchThumbActive: {
    transform: [{ translateX: 22 }],
  },
  footer: {
    padding: 16,
    backgroundColor: "#3C4255",
    borderTopWidth: 1,
    borderTopColor: "#4C5366",
  },
  saveButton: {
    backgroundColor: "#8BB9FE",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
}) 