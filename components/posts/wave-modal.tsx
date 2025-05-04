"use client"

import type React from "react"
import { useState } from "react"
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Alert,
} from "react-native"
import { Feather } from "@expo/vector-icons"
import { doc, updateDoc, getFirestore, addDoc, collection, setDoc } from "firebase/firestore"
import type { User, Post } from "../../app/types/types"
import { createNotification } from "../../lib/notifications"

interface WaveModalProps {
  visible: boolean
  onClose: () => void
  post: Post
  user: User
  currentUserId: string
  currentUserData: User | null
  isWaving: boolean
  setIsWaving: React.Dispatch<React.SetStateAction<boolean>>
  setWavesCount: React.Dispatch<React.SetStateAction<number>>
}

const WaveModal: React.FC<WaveModalProps> = ({
  visible,
  onClose,
  post,
  user,
  currentUserId,
  currentUserData,
  isWaving,
  setIsWaving,
  setWavesCount,
}) => {
  const [waveContent, setWaveContent] = useState("")

  const mediaArray = Array.isArray(post.media) ? post.media : post.media ? [post.media] : []
  const hasMedia = mediaArray.length > 0

  const createWave = async () => {
    if (isWaving) return

    setIsWaving(true)
    try {
      const db = getFirestore()
      const currentDate = new Date().toISOString()

      // Crear un nuevo post que es un wave
      const wavePost = {
        authorId: currentUserId,
        content: waveContent.trim(),
        commentCount: 0,
        reactionCounts: {
          bait: 0,
          fish: 0,
          wave: 0,
        },
        isWave: true,
        waveOf: post.id,
        createdAt: currentDate,
        updatedAt: currentDate,
      }

      // Añadir el wave a la colección de posts
      const docRef = await addDoc(collection(db, "posts"), wavePost)

      // Actualizar el documento con su ID
      await updateDoc(doc(db, "posts", docRef.id), {
        id: docRef.id,
      })

      // Crear la colección de comentarios para este post
      await setDoc(doc(db, "comments", docRef.id), {
        comments: [],
      })

      // Incrementar el contador de waves del post original
      await updateDoc(doc(db, "posts", post.id), {
        "reactionCounts.wave": (post.reactionCounts.wave || 0) + 1,
      })

      // Actualizar el contador local
      setWavesCount((prev) => prev + 1)

      // Enviar notificación al autor del post original
      if (currentUserId !== post.authorId) {
        await createNotification(
          post.authorId,
          "Wave",
          `@${currentUserData?.username || "Usuario"} hizo wave a tu publicación`,
          currentUserId,
          post.id,
          undefined,
          "/(drawer)/(tabs)/stackhome/post-detail",
          { postId: post.id },
        )
      }

      // Cerrar el modal y limpiar el contenido
      onClose()
      setWaveContent("")

      // Mostrar confirmación
      Alert.alert("Éxito", "Wave publicado correctamente")
    } catch (error) {
      console.error("Error al crear wave:", error)
      Alert.alert("Error", "No se pudo publicar el wave. Inténtalo de nuevo.")
    } finally {
      setIsWaving(false)
    }
  }

  return (
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.waveModalContainer}>
        <View style={styles.waveModalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Feather name="x" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.waveModalTitle}>Crear Wave</Text>
          <TouchableOpacity
            style={[styles.wavePostButton, !waveContent.trim() && styles.wavePostButtonDisabled]}
            onPress={createWave}
            disabled={!waveContent.trim() || isWaving}
          >
            {isWaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.wavePostButtonText}>Wave</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.originalWavePostContainer}>
          <View style={styles.wavePostHeader}>
            <View style={styles.userInfo}>
              {user.profilePicture ? (
                <Image source={{ uri: user.profilePicture }} style={styles.waveAvatar} />
              ) : (
                <View style={[styles.waveAvatar, styles.avatarPlaceholder]} />
              )}
              <Text style={styles.waveUsername}>@{user.username}</Text>
            </View>
          </View>

          <View style={styles.wavePostContent}>
            <Text style={styles.wavePostText}>{post.content}</Text>
            {hasMedia && mediaArray.length > 0 && (
              <Image source={{ uri: mediaArray[0] }} style={styles.waveMediaPreview} />
            )}
          </View>
        </View>

        <View style={styles.waveInputContainer}>
          {currentUserData?.profilePicture ? (
            <Image source={{ uri: currentUserData.profilePicture }} style={styles.waveUserAvatar} />
          ) : (
            <View style={[styles.waveUserAvatar, styles.avatarPlaceholder]} />
          )}
          <TextInput
            style={styles.waveInput}
            placeholder="Añade un comentario a tu wave..."
            placeholderTextColor="#8A8A8A"
            value={waveContent}
            onChangeText={setWaveContent}
            multiline
            autoFocus
            maxLength={280}
          />
        </View>

        <Text style={styles.waveCharCount}>{waveContent.length}/280</Text>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const { height: screenHeight } = Dimensions.get("window")

const styles = StyleSheet.create({
  waveModalContainer: {
    flex: 1,
    backgroundColor: "#2A3142",
    marginTop: screenHeight * 0.11,
  },
  waveModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#3B4255",
  },
  waveModalTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
  wavePostButton: {
    backgroundColor: "#4A6FFF",
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  wavePostButtonDisabled: {
    backgroundColor: "#4A6FFF80",
  },
  wavePostButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  originalWavePostContainer: {
    backgroundColor: "#3B4255",
    borderBottomWidth: 1,
    borderBottomColor: "#5B5B5B",
    padding: 16,
    margin: 16,
    borderRadius: 12,
  },
  wavePostHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  waveAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#DDDDDD",
  },
  avatarPlaceholder: {
    backgroundColor: "#CCCCCC",
  },
  waveUsername: {
    color: "#FFFFFF",
    fontWeight: "500",
    marginLeft: 8,
    fontSize: 14,
  },
  wavePostContent: {
    marginLeft: 38,
  },
  wavePostText: {
    color: "#FFFFFF",
    fontSize: 14,
    marginBottom: 10,
  },
  waveMediaPreview: {
    width: "100%",
    height: 120,
    borderRadius: 8,
    marginBottom: 10,
  },
  waveInputContainer: {
    flexDirection: "row",
    padding: 16,
  },
  waveUserAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  waveInput: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 16,
    textAlignVertical: "top",
    minHeight: 100,
  },
  waveCharCount: {
    color: "#AAAAAA",
    textAlign: "right",
    paddingRight: 16,
    fontSize: 12,
  },
})

export default WaveModal
