"use client"

import { useState, useEffect } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
  FlatList,
} from "react-native"
import { Feather } from "@expo/vector-icons"
import * as ImagePicker from "expo-image-picker"
import * as VideoThumbnails from "expo-video-thumbnails"
import { useNavigation } from "@react-navigation/native"
import { getAuth } from "firebase/auth"
import { collection, addDoc, doc, getDoc, updateDoc } from "firebase/firestore"
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { db } from "../../../../config/Firebase_Conf"
import { User, Post } from "../../../types/types"

// Tipo para los medios seleccionados
type MediaItem = {
  id: string
  uri: string
  type: "image" | "video"
  thumbnailUri?: string
}

const CreatePostScreen = () => {
  const navigation = useNavigation()
  const auth = getAuth()
  const storage = getStorage()

  // Estados
  const [content, setContent] = useState("")
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)

  // Cargar datos del usuario actual
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const currentUser = auth.currentUser
        if (!currentUser) return

        const userDoc = await getDoc(doc(db, "users", currentUser.uid))
        if (userDoc.exists()) {
          setUser({
            userId: currentUser.uid,
            username: userDoc.data().username || "Usuario",
            profilePicture: userDoc.data().profilePicture || "",
          } as User)
        }
      } catch (error) {
        console.error("Error al obtener datos del usuario:", error)
      }
    }

    fetchUserData()
  }, [])

  const pickImages = async () => {
    const hasVideo = mediaItems.some((item) => item.type === "video")

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
        quality: 0.8,
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
        try {
          const { uri: thumbnailUri } = await VideoThumbnails.getThumbnailAsync(result.assets[0].uri, {
            time: 1000,
          })

          const newVideo: MediaItem = {
            id: `video_${Date.now()}`,
            uri: result.assets[0].uri,
            type: "video",
            thumbnailUri,
          }

          setMediaItems((prev) => [...prev, newVideo])
        } catch (e) {
          console.error("Error al generar thumbnail:", e)

          const newVideo: MediaItem = {
            id: `video_${Date.now()}`,
            uri: result.assets[0].uri,
            type: "video",
          }

          setMediaItems((prev) => [...prev, newVideo])
        }
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
      const currentUser = auth.currentUser
      if (!currentUser) throw new Error("Usuario no autenticado")

      const timestamp = new Date().getTime()
      const fileExtension = item.uri.split(".").pop() || ""
      const fileName = `${currentUser.uid}_${timestamp}_${item.id}.${fileExtension}`
      const storageRef = ref(storage, `${item.type === "image" ? "images" : "videos"}/${fileName}`)

      const response = await fetch(item.uri)
      const blob = await response.blob()

      await uploadBytes(storageRef, blob)

      const downloadURL = await getDownloadURL(storageRef)
      return downloadURL
    } catch (error) {
      console.error(`Error al subir ${item.type}:`, error)
      throw error
    }
  }

  const publishPost = async () => {
    if (!content.trim() && mediaItems.length === 0) {
      Alert.alert("Error", "El post debe tener contenido o media")
      return
    }

    setIsLoading(true)
    setUploadProgress(0)

    try {
      const currentUser = auth.currentUser
      if (!currentUser) throw new Error("Usuario no autenticado")

      const hashtagRegex = /#[a-zA-Z0-9_]+/g
      const tags = content.match(hashtagRegex) || []

      const formattedTags = tags.map((tag) => tag.substring(1).toLowerCase())

      const mediaUrls: string[] = []

      for (let i = 0; i < mediaItems.length; i++) {
        const url = await uploadMediaItem(mediaItems[i])
        mediaUrls.push(url)

        setUploadProgress(((i + 1) / mediaItems.length) * 100)
      }

      const currentDate = new Date().toISOString()
      const newPost: Omit<Post, "postId"> = {
        baits: { userId: [] },
        comments: [],
        content: content.trim(),
        fishes: { userId: [] },
        media: mediaUrls,
        created_at: currentDate,
        updated_at: currentDate,
        tags: formattedTags,
        userId: currentUser.uid,
        waves: { userId: [] },
        isWave: false,
        postWaveId: null,
      }

      const docRef = await addDoc(collection(db, "posts"), newPost)

      await updateDoc(doc(db, "posts", docRef.id), {
        postId: docRef.id,
      })

      const userRef = doc(db, "users", currentUser.uid)
      const userDoc = await getDoc(userRef)

      if (userDoc.exists()) {
        const userData = userDoc.data()
        const postsId = userData.postsId || []

        await updateDoc(userRef, {
          postsId: [...postsId, docRef.id],
        })
      }

      Alert.alert("Éxito", "Post publicado correctamente")

      navigation.goBack()
    } catch (error) {
      console.error("Error al publicar post:", error)
      Alert.alert("Error", "No se pudo publicar el post")
    } finally {
      setIsLoading(false)
      setUploadProgress(0)
    }
  }

  const renderMediaItem = ({ item }: { item: MediaItem }) => {
    return (
      <View style={styles.mediaItemContainer}>
        {item.type === "image" ? (
          <Image source={{ uri: item.uri }} style={styles.mediaPreview} />
        ) : (
          <View style={styles.videoContainer}>
            {item.thumbnailUri ? (
              <Image source={{ uri: item.thumbnailUri }} style={styles.mediaPreview} />
            ) : (
              <View style={styles.mediaPreview}>
                <ActivityIndicator size="large" color="#FFFFFF" />
              </View>
            )}
            <View style={styles.playIconContainer}>
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <View style={styles.header}>
      </View>

      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.postButton, !content.trim() && mediaItems.length === 0 && styles.postButtonDisabled]}
          onPress={publishPost}
          disabled={(!content.trim() && mediaItems.length === 0) || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.postButtonText}>Post</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.userInfoContainer}>
        <Image
          source={user?.profilePicture ? { uri: user.profilePicture } :  { uri: '' }}
          style={styles.avatar}
        />
        <Text style={styles.username}>{user?.username || "David"}</Text>
      </View>

      <ScrollView style={styles.contentContainer}>
        <TextInput
          style={styles.input}
          placeholder="I think..."
          placeholderTextColor="#8E8E93"
          multiline
          value={content}
          onChangeText={setContent}
          maxLength={500}
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

        {isLoading && uploadProgress > 0 && (
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { width: `${uploadProgress}%` }]} />
            <Text style={styles.progressText}>{`Subiendo... ${Math.round(uploadProgress)}%`}</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.mediaButtonsContainer}>
        <TouchableOpacity style={styles.mediaButton} onPress={pickImages} disabled={isLoading}>
          <Feather name="image" size={24} color="#FFFFFF" />
          <Text style={styles.mediaButtonText}>Images</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.mediaButton}
          onPress={pickVideo}
          disabled={isLoading || mediaItems.some((item) => item.type === "video")}
        >
          <Feather name="video" size={24} color="#FFFFFF" />
          <Text style={styles.mediaButtonText}>Videos</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#2A3142",
  },
  header: {
    paddingTop: 50,
    paddingBottom: 10,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#3A4154",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  actionBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#3A4154",
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  cancelButtonText: {
    fontSize: 16,
    color: "#FFFFFF",
  },
  postButton: {
    backgroundColor: "#4A6FFF",
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  postButtonDisabled: {
    backgroundColor: "#4A6FFF80",
  },
  postButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  userInfoContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#3A4154",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#DDDDDD",
  },
  username: {
    fontSize: 16,
    fontWeight: "500",
    color: "#FFFFFF",
    marginLeft: 12,
  },
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  input: {
    fontSize: 16,
    color: "#FFFFFF",
    minHeight: 100,
    textAlignVertical: "top",
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
  playIconContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderRadius: 8,
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
  mediaButtonsContainer: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#3A4154",
    paddingVertical: 12,
    paddingHorizontal: 16,
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
  progressContainer: {
    marginTop: 16,
    backgroundColor: "#3A4154",
    height: 24,
    borderRadius: 12,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#4A6FFF",
  },
  progressText: {
    position: "absolute",
    color: "#FFFFFF",
    fontSize: 12,
    alignSelf: "center",
    top: 4,
  },
})

export default CreatePostScreen

