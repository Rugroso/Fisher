import React, { useState } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  ScrollView,
  FlatList,
} from "react-native"
import { Feather } from "@expo/vector-icons"
import { useRouter, useLocalSearchParams, Stack } from "expo-router"
import { getAuth } from "firebase/auth"
import { collection, addDoc } from "firebase/firestore"
import { db } from "../../../../config/Firebase_Conf"
import { useAuth } from "@/context/AuthContext"
import * as ImagePicker from "expo-image-picker"
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage"

type MediaItem = {
  id: string
  uri: string
  type: "image" | "video"
  thumbnailUri?: string
}

const CreatePostScreen = () => {
  const router = useRouter()
  const { id: fishtankId } = useLocalSearchParams()
  const { user } = useAuth()
  const [content, setContent] = useState("")
  const [loading, setLoading] = useState(false)
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])

  const pickImages = async () => {
    const currentImageCount = mediaItems.filter((item) => item.type === "image").length
    const remainingImageSlots = 5 - currentImageCount

    if (remainingImageSlots <= 0) {
      Alert.alert("Límite alcanzado", "Ya has seleccionado el máximo de 5 imágenes.")
      return
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: remainingImageSlots,
        quality: 0.4,
      })

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newImages: MediaItem[] = result.assets.map((asset) => ({
          id: `image_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          uri: asset.uri,
          type: "image",
        }))

        setMediaItems((prev) => [...prev, ...newImages])
      }
    } catch (error) {
      console.error("Error al seleccionar imágenes:", error)
      Alert.alert("Error", "No se pudieron seleccionar las imágenes")
    }
  }

  const pickVideo = async () => {
    const hasVideo = mediaItems.some((item) => item.type === "video")

    if (hasVideo) {
      Alert.alert("Límite alcanzado", "Solo puedes seleccionar un video por post.")
      return
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.4,
      })

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newVideo: MediaItem = {
          id: `video_${Date.now()}`,
          uri: result.assets[0].uri,
          type: "video",
        }

        setMediaItems((prev) => [...prev, newVideo])
      }
    } catch (error) {
      console.error("Error al seleccionar video:", error)
      Alert.alert("Error", "No se pudo seleccionar el video")
    }
  }

  const removeMediaItem = (id: string) => {
    setMediaItems((prev) => prev.filter((item) => item.id !== id))
  }

  const uploadMediaItem = async (item: MediaItem): Promise<string> => {
    try {
      const storage = getStorage()
      const response = await fetch(item.uri)
      const blob = await response.blob()
      const ext = item.uri.split('.').pop()
      const filename = `fishtank_posts/${Date.now()}_${Math.floor(Math.random()*10000)}.${ext}`
      const storageRef = ref(storage, filename)
      await uploadBytes(storageRef, blob)
      const url = await getDownloadURL(storageRef)
      return url
    } catch (error) {
      console.error(`Error al subir ${item.type}:`, error)
      throw error
    }
  }

  const handleCreatePost = async () => {
    if (!content.trim() && mediaItems.length === 0) {
      Alert.alert("Error", "El contenido o una imagen/video es requerido.")
      return
    }
    const currentUser = getAuth().currentUser
    if (!currentUser || !fishtankId) {
      Alert.alert("Error", "No se pudo identificar el usuario o la pecera.")
      return
    }
    setLoading(true)
    try {
      let mediaUrls: string[] = []
      if (mediaItems.length > 0) {
        for (const item of mediaItems) {
          const url = await uploadMediaItem(item)
          mediaUrls.push(url)
        }
      }
      await addDoc(collection(db, "fishtank_posts"), {
        fishtankId,
        authorId: currentUser.uid,
        content: content.trim(),
        media: mediaUrls,
        isWave: false,
        commentCount: 0,
        reactionCounts: { bait: 0, fish: 0, wave: 0 },
        deleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      setContent("")
      setMediaItems([])
      Alert.alert("Éxito", "¡Publicación creada!")
      router.back()
    } catch (error) {
      console.error("Error al crear publicación:", error)
      Alert.alert("Error", "No se pudo crear la publicación.")
    } finally {
      setLoading(false)
    }
  }

  const renderMediaItem = ({ item }: { item: MediaItem }) => {
    return (
      <View style={styles.mediaItemContainer}>
        {item.type === "image" ? (
          <Image source={{ uri: item.uri }} style={styles.mediaPreview} />
        ) : (
          <View style={styles.videoContainer}>
            <View style={styles.mediaPreview}>
              <Feather name="play" size={30} color="#FFFFFF" />
            </View>
          </View>
        )}
        <TouchableOpacity style={styles.removeMediaButton} onPress={() => removeMediaItem(item.id)}>
          <Feather name="x" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    )
  }

  const renderMediaCounter = () => {
    const imageCount = mediaItems.filter((item) => item.type === "image").length
    const videoCount = mediaItems.filter((item) => item.type === "video").length

    return (
      <View style={styles.mediaCounterContainer}>
        <Text style={styles.mediaCounterText}>
          {imageCount}/5 Imágenes • {videoCount}/1 Video
        </Text>
      </View>
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: "Nueva publicación",
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()}>
              <Feather name="arrow-left" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          ),
        }}
      />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.form}>
          <Text style={styles.label}>¿Qué quieres compartir?</Text>
          <TextInput
            style={styles.input}
            placeholder="Escribe tu publicación..."
            placeholderTextColor="#8E8E93"
            multiline
            value={content}
            onChangeText={setContent}
            editable={!loading}
          />
          {mediaItems.length > 0 && (
            <>
              {renderMediaCounter()}
              <FlatList
                data={mediaItems}
                renderItem={renderMediaItem}
                keyExtractor={(item) => item.id}
                horizontal={false}
                scrollEnabled={false}
              />
            </>
          )}
          <View style={styles.mediaButtonsContainer}>
            <TouchableOpacity style={styles.mediaButton} onPress={pickImages} disabled={loading}>
              <Feather name="image" size={24} color="#FFFFFF" />
              <Text style={styles.mediaButtonText}>Imágenes</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.mediaButton}
              onPress={pickVideo}
              disabled={loading || mediaItems.some((item) => item.type === "video")}
            >
              <Feather name="video" size={24} color="#FFFFFF" />
              <Text style={styles.mediaButtonText}>Videos</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleCreatePost}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Feather name="send" size={20} color="#FFFFFF" style={styles.submitIcon} />
                <Text style={styles.submitText}>Publicar</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#2A3142",
    paddingTop: Platform.OS === "android" ? 32 : 0,
  },
  form: {
    flex: 1,
    padding: 24,
  },
  label: {
    color: "#8E8E93",
    fontSize: 16,
    marginBottom: 12,
  },
  input: {
    backgroundColor: "#3A4154",
    color: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: "top",
    marginBottom: 24,
  },
  mediaButtonsContainer: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#3A4154",
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 18,
  },
  mediaButton: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 24,
  },
  mediaButtonText: {
    color: "#FFFFFF",
    marginLeft: 8,
    fontSize: 16,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4A6FFF",
    paddingVertical: 14,
    borderRadius: 12,
  },
  submitIcon: {
    marginRight: 10,
  },
  submitText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  mediaCounterContainer: {
    marginTop: 16,
    marginBottom: 8,
  },
  mediaCounterText: {
    color: "#AAAAAA",
    fontSize: 14,
  },
  mediaItemContainer: {
    marginBottom: 12,
    position: "relative",
  },
  mediaPreview: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    backgroundColor: "#3A4154",
  },
  videoContainer: {
    position: "relative",
  },
  removeMediaButton: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: "center",
    alignItems: "center",
  },
})

export default CreatePostScreen 