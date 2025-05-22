"use client"

import { useState, useEffect } from "react"
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native"
import { Stack, useLocalSearchParams, useRouter } from "expo-router"
import { Feather } from "@expo/vector-icons"
import { doc, getDoc, updateDoc, onSnapshot } from "firebase/firestore"
import { db } from "../../../config/Firebase_Conf"
import { useAuth } from "@/context/AuthContext"
import * as ImagePicker from "expo-image-picker"
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage"

type FishTank = {
  id: string
  name: string
  description: string
  fishTankPicture: string
}

export default function EditFishTankScreen() {
  const { id } = useLocalSearchParams()
  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fishtank, setFishtank] = useState<FishTank | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [image, setImage] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return

    const fishtankRef = doc(db, "fishtanks", id as string)
    
    // Configurar el listener en tiempo real
    const unsubscribe = onSnapshot(fishtankRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data()
        setFishtank({
          id: doc.id,
          name: data.name,
          description: data.description || "",
          fishTankPicture: data.fishTankPicture || "",
        })
        setName(data.name)
        setDescription(data.description || "")
        setImage(data.fishTankPicture || null)
      }
      setLoading(false)
    }, (error) => {
      console.error("Error en el listener:", error)
      Alert.alert("Error", "No se pudo mantener la conexión en tiempo real")
      setLoading(false)
    })

    // Limpiar el listener cuando el componente se desmonte
    return () => unsubscribe()
  }, [id])

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      
      if (status !== "granted") {
        Alert.alert("Error", "Se necesitan permisos para acceder a la galería")
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      })

      if (!result.canceled) {
        setImage(result.assets[0].uri)
      }
    } catch (error) {
      console.error("Error al seleccionar imagen:", error)
      Alert.alert("Error", "No se pudo seleccionar la imagen")
    }
  }

  const uploadImage = async (uri: string): Promise<string> => {
    try {
      const response = await fetch(uri)
      const blob = await response.blob()
      
      const storage = getStorage()
      const storageRef = ref(storage, `fishtanks/${id}/${Date.now()}.jpg`)
      
      await uploadBytes(storageRef, blob)
      const downloadURL = await getDownloadURL(storageRef)
      
      return downloadURL
    } catch (error) {
      console.error("Error al subir la imagen:", error)
      throw new Error("No se pudo subir la imagen")
    }
  }

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "El nombre es obligatorio")
      return
    }

    try {
      setSaving(true)
      const fishtankRef = doc(db, "fishtanks", id as string)
      
      let fishTankPicture = fishtank?.fishTankPicture || ""
      
      if (image && image !== fishtank?.fishTankPicture) {
        fishTankPicture = await uploadImage(image)
      }

      await updateDoc(fishtankRef, {
        name: name.trim(),
        description: description.trim(),
        fishTankPicture,
        updatedAt: new Date(),
      })

      Alert.alert("Éxito", "Pecera actualizada correctamente")
      router.back()
    } catch (error) {
      console.error("Error al actualizar la pecera:", error)
      Alert.alert("Error", "No se pudo actualizar la pecera")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingText}>Cargando pecera...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Editar Pecera",
          headerStyle: {
            backgroundColor: "#4C5366",
          },
          headerTintColor: "#FFFFFF",
        }}
      />

      <View style={styles.content}>
        <TouchableOpacity style={styles.imageContainer} onPress={pickImage}>
          {image ? (
            <Image source={{ uri: image }} style={styles.image} />
          ) : (
            <View style={styles.placeholderImage}>
              <Feather name="image" size={40} color="#8E8E93" />
              <Text style={styles.placeholderText}>Seleccionar imagen</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Nombre</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Nombre de la pecera"
              placeholderTextColor="#8E8E93"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Descripción</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Descripción de la pecera"
              placeholderTextColor="#8E8E93"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Guardar cambios</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#3C4255",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#3C4255",
  },
  loadingText: {
    color: "#FFFFFF",
    marginTop: 12,
    fontSize: 16,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  imageContainer: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#4C5366",
    marginBottom: 24,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  placeholderImage: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    color: "#8E8E93",
    marginTop: 8,
    fontSize: 16,
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    gap: 8,
  },
  label: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "500",
  },
  input: {
    backgroundColor: "#4C5366",
    borderRadius: 8,
    padding: 12,
    color: "#FFFFFF",
    fontSize: 16,
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  saveButton: {
    backgroundColor: "#4A6FFF",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 24,
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