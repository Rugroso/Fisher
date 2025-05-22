// app/(drawer)/(tabs)/stackfishtanks/create.tsx
"use client"

import React, { useState, useEffect } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  StatusBar,
  SafeAreaView,
  Image,
} from "react-native"
import { Feather } from "@expo/vector-icons"
import { useRouter, Stack } from "expo-router"
import * as ImagePicker from "expo-image-picker"
import { getAuth } from "firebase/auth"
import { collection, addDoc, doc, updateDoc, getDoc } from "firebase/firestore"
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage"
import { db, storage } from "../../../../config/Firebase_Conf"

const CreateFishtankScreen = () => {
  const router = useRouter()
  const auth = getAuth()
  
  // Todos los estados al principio del componente
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [isPrivate, setIsPrivate] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedImage, setSelectedImage] = useState(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [isAppAdmin, setIsAppAdmin] = useState(false)

  // Verificar si el usuario es administrador de la aplicación
  useEffect(() => {
    const checkAppAdminStatus = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      try {
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          setIsAppAdmin(userData.isAdmin === true);
        }
      } catch (error) {
        console.error("Error verificando estado de administrador de la app:", error);
      }
    };

    checkAppAdminStatus();
  }, [auth.currentUser]);

  const handleCancel = () => {
    if (!name && !description && !selectedImage) {
      // Si no hay datos ingresados, redirigir según el rol
      if (isAppAdmin) {
        router.push("/(drawer)/(admintabs)/fishtanks");
      } else {
        router.push("/(drawer)/(tabs)/stackfishtanks/");
      }
      return;
    }

    Alert.alert(
      "¿Cancelar creación?",
      "Toda la información de la pecera se perderá.",
      [
        { text: "No", style: "cancel" },
        { 
          text: "Sí, cancelar", 
          style: "destructive", 
          onPress: () => {
            // Redirigir según el rol
            if (isAppAdmin) {
              router.push("/(drawer)/(admintabs)/fishtanks");
            } else {
              router.push("/(drawer)/(tabs)/stackfishtanks/");
            }
          }
        }
      ]
    )
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
        quality: 0.5,
      })

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImage(result.assets[0].uri)
      }
    } catch (error) {
      console.error("Error al seleccionar imagen:", error)
      Alert.alert("Error", "No se pudo seleccionar la imagen")
    }
  }

  const createFishtank = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "El nombre de la pecera es obligatorio")
      return
    }

    setIsLoading(true)

    try {
      const currentUser = auth.currentUser
      if (!currentUser) {
        Alert.alert("Error", "Debes iniciar sesión para crear una pecera")
        return
      }

      // Upload image if selected
      let fishTankPictureUrl = null
      if (selectedImage) {
        setUploadingImage(true)
        const response = await fetch(selectedImage)
        const blob = await response.blob()
        
        const timestamp = new Date().getTime()
        const imageRef = storageRef(storage, `fishtank_images/${currentUser.uid}_${timestamp}.jpg`)
        
        await uploadBytes(imageRef, blob)
        fishTankPictureUrl = await getDownloadURL(imageRef)
        setUploadingImage(false)
      }

      const currentDate = new Date().toISOString()

      const newFishtank = {
        name: name.trim(),
        description: description.trim() || null,
        fishTankPicture: fishTankPictureUrl,
        isPrivate: isPrivate,
        isVerified: false,
        creatorId: currentUser.uid,
        memberCount: 1,
        pendingCount: 0,
        adminCount: 1,
        createdAt: currentDate,
        updatedAt: currentDate,
      }
      
      const fishtankRef = await addDoc(collection(db, "fishtanks"), newFishtank)
      
      await updateDoc(doc(db, "fishtanks", fishtankRef.id), {
        id: fishtankRef.id
      })
      
      await addDoc(collection(db, "fishtank_members"), {
        fishtankId: fishtankRef.id,
        userId: currentUser.uid,
        role: 'admin',
        joinedAt: currentDate
      })
      
      Alert.alert(
        "Éxito", 
        "Pecera creada correctamente",
        [{ 
          text: "OK", 
          onPress: () => {
            router.push({
              pathname: "/(drawer)/(tabs)/stackfishtanks/[id]",
              params: { id: fishtankRef.id }
            })
          }
        }]
      )
    } catch (error) {
      console.error("Error creating fishtank:", error)
      Alert.alert("Error", "No se pudo crear la pecera")
    } finally {
      setIsLoading(false)
      setUploadingImage(false)
    }
  }

  return (
    <>
      <Stack.Screen 
        options={{
          headerShown: false,
          title: ""
        }} 
      />
      
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#2A3142" />
        
        <View style={styles.container}>
          <View style={styles.actionBar}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.createButton, !name.trim() && styles.createButtonDisabled]}
              onPress={createFishtank}
              disabled={!name.trim() || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.createButtonText}>Crear</Text>
              )}
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
          >
            <ScrollView style={styles.contentContainer}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Nombre de la Pecera*</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej: Amantes de fish"
                  placeholderTextColor="#8E8E93"
                  value={name}
                  onChangeText={setName}
                  maxLength={50}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Descripción</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Describe de qué trata esta comunidad..."
                  placeholderTextColor="#8E8E93"
                  multiline
                  value={description}
                  onChangeText={setDescription}
                  maxLength={200}
                />
              </View>

              {/* Imagen de la Pecera */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Imagen de la Pecera</Text>
                <TouchableOpacity 
                  style={styles.imagePickerContainer} 
                  onPress={pickImage}
                  disabled={uploadingImage}
                >
                  {selectedImage ? (
                    <Image 
                      source={{ uri: selectedImage }} 
                      style={styles.imagePreview} 
                    />
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <Feather name="image" size={40} color="#8E8E93" />
                      <Text style={styles.imagePlaceholderText}>Toca para seleccionar una imagen</Text>
                    </View>
                  )}
                  
                  {uploadingImage && (
                    <View style={styles.uploadingOverlay}>
                      <ActivityIndicator size="large" color="#FFFFFF" />
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.privacyContainer}>
                <Text style={styles.label}>Tipo de Pecera</Text>
                
                <View style={styles.privacyOptions}>
                  <TouchableOpacity 
                    style={[
                      styles.privacyOption, 
                      !isPrivate ? styles.privacyOptionSelected : null
                    ]} 
                    onPress={() => setIsPrivate(false)}
                  >
                    <Feather 
                      name="globe" 
                      size={18} 
                      color={!isPrivate ? "#4A6FFF" : "#8E8E93"} 
                      style={styles.privacyIcon} 
                    />
                    <View>
                      <Text style={[
                        styles.privacyOptionTitle,
                        !isPrivate ? styles.privacyOptionTitleSelected : null
                      ]}>
                        Pública
                      </Text>
                      <Text style={styles.privacyOptionDescription}>
                        Cualquiera puede unirse
                      </Text>
                    </View>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[
                      styles.privacyOption, 
                      isPrivate ? styles.privacyOptionSelected : null
                    ]} 
                    onPress={() => setIsPrivate(true)}
                  >
                    <Feather 
                      name="lock" 
                      size={18} 
                      color={isPrivate ? "#4A6FFF" : "#8E8E93"} 
                      style={styles.privacyIcon} 
                    />
                    <View>
                      <Text style={[
                        styles.privacyOptionTitle,
                        isPrivate ? styles.privacyOptionTitleSelected : null
                      ]}>
                        Privada
                      </Text>
                      <Text style={styles.privacyOptionDescription}>
                        Solo por invitación
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </SafeAreaView>
    </>
  )
}

const styles = StyleSheet.create({
  safeArea: {
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
  actionBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#3A4154",
    backgroundColor: "#2A3142",
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  cancelButtonText: {
    fontSize: 16,
    color: "#FFFFFF",
  },
  createButton: {
    backgroundColor: "#4A6FFF",
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  createButtonDisabled: {
    backgroundColor: "#4A6FFF80",
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "500",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#3A4154",
    borderRadius: 8,
    color: "#FFFFFF",
    fontSize: 16,
    padding: 12,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  privacyContainer: {
    marginBottom: 20,
  },
  privacyOptions: {
    marginTop: 8,
  },
  privacyOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3A4154",
    borderRadius: 8,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#3A4154",
  },
  privacyOptionSelected: {
    borderColor: "#4A6FFF",
    backgroundColor: "#374161",
  },
  privacyIcon: {
    marginRight: 12,
  },
  privacyOptionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  privacyOptionTitleSelected: {
    color: "#4A6FFF",
  },
  privacyOptionDescription: {
    fontSize: 14,
    color: "#8E8E93",
  },
  // Nuevos estilos para el selector de imágenes
  imagePickerContainer: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    backgroundColor: "#3A4154",
    marginTop: 8,
    overflow: "hidden",
  },
  imagePreview: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  imagePlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  imagePlaceholderText: {
    color: "#8E8E93",
    marginTop: 8,
    fontSize: 14,
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  }
})

export default CreateFishtankScreen