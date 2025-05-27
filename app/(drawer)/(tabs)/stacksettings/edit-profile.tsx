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
  KeyboardAvoidingView,
} from "react-native"
import { Feather, FontAwesome5, MaterialCommunityIcons } from "@expo/vector-icons"
import { useRouter, Stack } from "expo-router"
import { useAuth } from "@/context/AuthContext"
import { getFirestore, doc, getDoc, updateDoc } from "firebase/firestore"
import * as ImagePicker from "expo-image-picker"
import { storage, db } from "../../../../config/Firebase_Conf"
import * as Haptics from "expo-haptics"
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"

const EditProfileScreen = () => {
  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profilePicture, setProfilePicture] = useState("")
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
    bio: "",
  })

  useEffect(() => {
    fetchUserData()
  }, [user])

  const fetchUserData = async () => {
    if (!user?.uid) return

    try {
      const db = getFirestore()
      const userRef = doc(db, "users", user.uid)
      const userDoc = await getDoc(userRef)

      if (userDoc.exists()) {
        const data = userDoc.data()
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
          bio: data.bio || "",
        })
        setProfilePicture(data.profilePicture || "")
      }
    } catch (error) {
      console.error("Error fetching user data:", error)
      Alert.alert("Error", "No se pudo cargar la información del usuario")
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!user?.uid) return

    setSaving(true)
    try {
      const db = getFirestore()
      const userRef = doc(db, "users", user.uid)

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
        bio: userData.bio,
        updatedAt: new Date().toISOString(),
      })

      Alert.alert("Éxito", "Tu perfil ha sido actualizado")
      router.back()
    } catch (error) {
      console.error("Error updating profile:", error)
      Alert.alert("Error", "No se pudo actualizar el perfil")
    } finally {
      setSaving(false)
    }
  }

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== "granted") {
        Alert.alert("Permiso denegado", "Necesitamos permisos para acceder a tu galería")
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.4,
      })

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedImageUri = result.assets[0].uri

        setProfilePicture(selectedImageUri)

        await uploadProfilePicture(selectedImageUri)
      }
    } catch (error) {
      console.error("Error picking image:", error)
      Alert.alert("Error", "No se pudo seleccionar la imagen")
    }
  }

  const uploadProfilePicture = async (imageUri: string) => {
    if (!user?.uid) return

    setUploadingImage(true)
    try {
      const response = await fetch(imageUri)
      const blob = await response.blob()

      const imageName = `users/${user.uid}_${Date.now()}.jpg`
      const storageRef = ref(storage, imageName)

      const uploadTask = uploadBytesResumable(storageRef, blob)

      await new Promise((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
            console.log(`Upload is ${progress}% done`)
          },
          (error) => {
            console.error("Error uploading image:", error)
            reject(error)
          },
          async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)

            const userRef = doc(db, "users", user.uid)
            await updateDoc(userRef, { profilePicture: downloadURL })

            setProfilePicture(downloadURL)
            setUserData((prev) => ({ ...prev, profilePicture: downloadURL }))

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            resolve(null)
          },
        )
      })

      Alert.alert("Éxito", "La foto de perfil ha sido actualizada")
    } catch (error) {
      console.error("Error uploading profile picture:", error)
      Alert.alert("Error", "No se pudo subir la foto de perfil")

      setProfilePicture(userData.profilePicture)
    } finally {
      setUploadingImage(false)
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.bigcontainer}>
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      </SafeAreaView>
      </SafeAreaView>
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <SafeAreaView style={styles.bigcontainer}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Editar perfil</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveButton}>
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Guardar</Text>
            )}
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
          >
            {/* Foto de Perfil */}
            <View style={[styles.profileSection, { marginBottom: -20 }]}>
              <Text style={styles.sectionTitle}>Foto de Perfil</Text>
              <View style={styles.profileImageWrapper}>
                <TouchableOpacity onPress={pickImage} disabled={uploadingImage} style={styles.profileImageContainer}>
                  {uploadingImage ? (
                    <View style={styles.uploadingOverlay}>
                      <ActivityIndicator size="large" color="#FFFFFF" />
                    </View>
                  ) : null}

                  {profilePicture ? (
                    <Image source={{ uri: profilePicture }} style={styles.profileImage} />
                  ) : (
                    <View style={styles.placeholderContainer}>
                      <FontAwesome5 name="user-circle" size={100} color="#4C5366" />
                    </View>
                  )}

                  <View style={styles.editIconContainer}>
                    <MaterialCommunityIcons name="camera" size={20} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>

                <Text style={styles.profileImageHint}>Toca la imagen para cambiar tu foto de perfil</Text>
              </View>
            </View>

            {/* Descripción */}
            <View style={styles.profileSection}>
              <Text style={styles.sectionTitle}>Descripción</Text>
              <View style={styles.bioContainer}>
                <TextInput
                  style={styles.bioInput}
                  placeholder="Cuéntanos sobre ti..."
                  placeholderTextColor="#8A8A8A"
                  value={userData.bio}
                  onChangeText={(text) => setUserData((prev) => ({ ...prev, bio: text }))}
                  multiline
                  maxLength={150}
                />
                <Text style={styles.characterCount}>{userData.bio.length}/150</Text>
              </View>
            </View>

            {/* Información personal */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Información personal</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nombre</Text>
                <TextInput
                  style={styles.input}
                  value={userData.name}
                  onChangeText={(text) => setUserData({ ...userData, name: text })}
                  placeholder="Tu nombre"
                  placeholderTextColor="#6B7280"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Apellido</Text>
                <TextInput
                  style={styles.input}
                  value={userData.lastName}
                  onChangeText={(text) => setUserData({ ...userData, lastName: text })}
                  placeholder="Tu apellido"
                  placeholderTextColor="#6B7280"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nombre de usuario</Text>
                <TextInput
                  style={[styles.input, styles.disabledInput]}
                  value={userData.username}
                  onChangeText={(text) => setUserData({ ...userData, username: text })}
                  placeholder="Tu nombre de usuario"
                  placeholderTextColor="#6B7280"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Género</Text>
                <View style={styles.genderOptions}>
                  <TouchableOpacity
                    style={[styles.genderOption, userData.gender === "male" && styles.genderOptionSelected]}
                    onPress={() => setUserData({ ...userData, gender: "male" })}
                  >
                    <Text
                      style={[styles.genderOptionText, userData.gender === "male" && styles.genderOptionTextSelected]}
                    >
                      Hombre
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.genderOption, userData.gender === "female" && styles.genderOptionSelected]}
                    onPress={() => setUserData({ ...userData, gender: "female" })}
                  >
                    <Text
                      style={[styles.genderOptionText, userData.gender === "female" && styles.genderOptionTextSelected]}
                    >
                      Mujer
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.genderOption, userData.gender === "other" && styles.genderOptionSelected]}
                    onPress={() => setUserData({ ...userData, gender: "other" })}
                  >
                    <Text
                      style={[styles.genderOptionText, userData.gender === "other" && styles.genderOptionTextSelected]}
                    >
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
                  onChangeText={(text) => setUserData({ ...userData, birthdate: text })}
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
                  onChangeText={(text) => setUserData({ ...userData, cellphone: text })}
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
                  onChangeText={(text) => setUserData({ ...userData, city: text })}
                  placeholder="Tu ciudad"
                  placeholderTextColor="#6B7280"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Estado</Text>
                <TextInput
                  style={styles.input}
                  value={userData.state}
                  onChangeText={(text) => setUserData({ ...userData, state: text })}
                  placeholder="Tu estado"
                  placeholderTextColor="#6B7280"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>País</Text>
                <TextInput
                  style={styles.input}
                  value={userData.country}
                  onChangeText={(text) => setUserData({ ...userData, country: text })}
                  placeholder="Tu país"
                  placeholderTextColor="#6B7280"
                />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      </SafeAreaView>
    </>
  )
}

const styles = StyleSheet.create({
  bigcontainer: {
    flex: 1,
    backgroundColor: "#2A3142",
  },
  container: {
    flex: 1,
    backgroundColor: "#2A3142",
    alignSelf: "center",
    width: Platform.OS === 'web' ? "100%":"100%",
    maxWidth: Platform.OS === 'web' ? 800 : "100%",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
    flex: 1,
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#4B5563",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.8,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  scrollContent: {
    paddingBottom: 100,
  },
  profileSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    alignItems: "center",
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 16,
    alignSelf: "flex-start",
  },
  profileImageWrapper: {
    alignItems: "center",
    marginBottom: 20,
  },
  profileImageContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#3A4154",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "#4C5366",
  },
  profileImage: {
    width: "100%",
    height: "100%",
    borderRadius: 60,
  },
  placeholderContainer: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#3A4154",
  },
  editIconContainer: {
    position: "absolute",
    bottom: 0,
    right: 0,
    left: 0,
    height: 36,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  profileImageHint: {
    color: "#AAAAAA",
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: "#AAAAAA",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#3A4154",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#4A5164",
  },
  disabledInput: {
    backgroundColor: "#2D3445",
    color: "#6B7280",
  },
  genderOptions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  genderOption: {
    flex: 1,
    backgroundColor: "#3A4154",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#4A5164",
  },
  genderOptionSelected: {
    backgroundColor: "#4B5563",
    borderColor: "#6B7280",
  },
  genderOptionText: {
    color: "#AAAAAA",
    fontSize: 16,
  },
  genderOptionTextSelected: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  bioContainer: {
    backgroundColor: "#5C6377",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  bioInput: {
    color: "#FFFFFF",
    minHeight: 100,
    textAlignVertical: "top",
    fontSize: 16,
  },
  characterCount: {
    color: "#8A8A8A",
    fontSize: 12,
    textAlign: "right",
    marginTop: 4,
  },
})

export default EditProfileScreen
