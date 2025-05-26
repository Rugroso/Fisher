"use client"

import { useState, useEffect } from "react"
import { View, StyleSheet, ActivityIndicator, SafeAreaView, Text, Alert, TouchableOpacity } from "react-native"
import { useLocalSearchParams, Stack, useRouter } from "expo-router"
import { doc, getDoc, getFirestore, updateDoc, setDoc } from "firebase/firestore"
import { useAuth } from "@/context/AuthContext"
import PostItem from "../../../components/general/posts"
import type { Post, User, ReactionType } from "@/app/types/types"
import * as Haptics from "expo-haptics"
import { Platform } from "react-native"
import { Feather } from "@expo/vector-icons"

const PostDetailScreen = () => {
  const { postId, fromReports } = useLocalSearchParams()
  const { user } = useAuth()
  const router = useRouter()
  const [post, setPost] = useState<Post | null>(null)
  const [postAuthor, setPostAuthor] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUserData, setCurrentUserData] = useState<User | null>(null)

  // Estados para modales
  const [commentsModalVisible, setCommentsModalVisible] = useState(false)
  const [mediaModalVisible, setMediaModalVisible] = useState(false)
  const [waveModalVisible, setWaveModalVisible] = useState(false)
  const [optionsMenuVisible, setOptionsMenuVisible] = useState(false)
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0)

  // Estados para interacciones
  const [isUpdating, setIsUpdating] = useState<{ fish: boolean; bait: boolean; comment: boolean; wave: boolean }>({
    fish: false,
    bait: false,
    comment: false,
    wave: false,
  })
  const [isWaving, setIsWaving] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Estados para reacciones
  const [hasFished, setHasFished] = useState(false)
  const [hasBaited, setHasBaited] = useState(false)
  const [wavesCount, setWavesCount] = useState(0)
  const [commentsCount, setCommentsCount] = useState(0)
  const [baitsCount, setBaitsCount] = useState(0)
  const [fishesCount, setFishesCount] = useState(0)

  const handleCountsUpdate = (updates: {
    wavesCount?: number
    commentsCount?: number
    baitsCount?: number
    fishesCount?: number
    hasBaited?: boolean
    hasFished?: boolean
  }) => {
    if (updates.wavesCount !== undefined) setWavesCount(updates.wavesCount)
    if (updates.commentsCount !== undefined) setCommentsCount(updates.commentsCount)
    if (updates.baitsCount !== undefined) setBaitsCount(updates.baitsCount)
    if (updates.fishesCount !== undefined) setFishesCount(updates.fishesCount)
    if (updates.hasBaited !== undefined) setHasBaited(updates.hasBaited)
    if (updates.hasFished !== undefined) setHasFished(updates.hasFished)
  }

  useEffect(() => {
    const fetchPostData = async () => {
      if (!postId || !user) return

      try {
        setLoading(true)
        const db = getFirestore()

        // Obtener datos del post
        const postDoc = await getDoc(doc(db, "posts", postId as string))

        if (!postDoc.exists()) {
          setError("La publicación no existe o ha sido eliminada")
          setLoading(false)
          return
        }

        const postData = postDoc.data() as Post
        setPost(postData)

        // Actualizar contadores
        setWavesCount(postData.reactionCounts?.wave || 0)
        setCommentsCount(postData.commentCount || 0)
        setBaitsCount(postData.reactionCounts?.bait || 0)
        setFishesCount(postData.reactionCounts?.fish || 0)

        // Obtener datos del autor
        const authorDoc = await getDoc(doc(db, "users", postData.authorId))
        if (authorDoc.exists()) {
          setPostAuthor(authorDoc.data() as User)
        }

        // Obtener datos del usuario actual
        const currentUserDoc = await getDoc(doc(db, "users", user.uid))
        if (currentUserDoc.exists()) {
          setCurrentUserData(currentUserDoc.data() as User)
        }

        // Verificar si el post está guardado
        const savedPostRef = doc(db, "savedPosts", `${user.uid}_${postId}`)
        const savedPostDoc = await getDoc(savedPostRef)
        setIsSaved(savedPostDoc.exists() && !savedPostDoc.data()?.deleted)

        // Verificar reacciones del usuario
        const fishQuery = await getDoc(doc(db, "reactions", `${postId}_${user.uid}_Fish`))
        setHasFished(fishQuery.exists() && !fishQuery.data()?.deleted)

        const baitQuery = await getDoc(doc(db, "reactions", `${postId}_${user.uid}_Bait`))
        setHasBaited(baitQuery.exists() && !baitQuery.data()?.deleted)

        // Abrir automáticamente el modal de comentarios
        setTimeout(() => {
          setCommentsModalVisible(true)
        }, 300)
      } catch (err) {
        console.error("Error al cargar el post:", err)
        setError("Error al cargar la publicación")
      } finally {
        setLoading(false)
      }
    }

    fetchPostData()
  }, [postId, user])

  const handleCloseCommentsModal = () => {
    setCommentsModalVisible(false)
    // Volver a la pantalla anterior cuando se cierra el modal
    setTimeout(() => {
      router.back()
    }, 100)
  }

  const toggleReaction = async (type: ReactionType) => {
    if (!post || !user) return

    const isUpdatingKey = type.toLowerCase() as keyof typeof isUpdating
    if (isUpdating[isUpdatingKey]) return

    setIsUpdating((prev) => ({ ...prev, [isUpdatingKey]: true }))

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }

    try {
      const db = getFirestore()
      const hasReacted = type === "Fish" ? hasFished : hasBaited
      const reactionId = `${post.id}_${user.uid}_${type}`
      const reactionRef = doc(db, "reactions", reactionId)

      // Verificar si el post existe antes de intentar actualizarlo
      const postRef = doc(db, "posts", post.id)
      const postDoc = await getDoc(postRef)
      
      if (!postDoc.exists()) {
        Alert.alert("Error", "La publicación ya no existe")
        router.back()
        return
      }

      // Si ya existe la reacción opuesta, la eliminamos
      const oppositeType = type === "Fish" ? "Bait" : "Fish"
      const hasOppositeReaction = type === "Fish" ? hasBaited : hasFished

      if (hasOppositeReaction) {
        const oppositeReactionId = `${post.id}_${user.uid}_${oppositeType}`
        const oppositeReactionRef = doc(db, "reactions", oppositeReactionId)

        await updateDoc(postRef, {
          [`reactionCounts.${oppositeType.toLowerCase()}`]: Math.max(
            0,
            (post.reactionCounts?.[oppositeType.toLowerCase() as keyof typeof post.reactionCounts] || 0) - 1,
          ),
        })

        await updateDoc(oppositeReactionRef, {
          deleted: true,
          updatedAt: new Date().toISOString(),
        })

        if (oppositeType === "Fish") {
          setHasFished(false)
          setFishesCount((prev) => Math.max(0, prev - 1))
        } else {
          setHasBaited(false)
          setBaitsCount((prev) => Math.max(0, prev - 1))
        }
      }

      // Ahora manejamos la reacción actual
      if (hasReacted) {
        // Eliminar reacción
        await updateDoc(postRef, {
          [`reactionCounts.${type.toLowerCase()}`]: Math.max(
            0,
            (post.reactionCounts?.[type.toLowerCase() as keyof typeof post.reactionCounts] || 0) - 1,
          ),
        })

        await updateDoc(reactionRef, {
          deleted: true,
          updatedAt: new Date().toISOString(),
        })

        if (type === "Fish") {
          setHasFished(false)
          setFishesCount((prev) => Math.max(0, prev - 1))
        } else {
          setHasBaited(false)
          setBaitsCount((prev) => Math.max(0, prev - 1))
        }
      } else {
        // Añadir reacción
        await updateDoc(postRef, {
          [`reactionCounts.${type.toLowerCase()}`]:
            (post.reactionCounts?.[type.toLowerCase() as keyof typeof post.reactionCounts] || 0) + 1,
        })

        const reaction = {
          id: reactionId,
          postId: post.id,
          userId: user.uid,
          type,
          createdAt: new Date().toISOString(),
        }

        await setDoc(reactionRef, reaction)

        if (type === "Fish") {
          setHasFished(true)
          setFishesCount((prev) => prev + 1)
        } else {
          setHasBaited(true)
          setBaitsCount((prev) => prev + 1)
        }
      }

      // Actualizar el post local
      if (post) {
        const updatedPost = { ...post }
        if (!updatedPost.reactionCounts) {
          updatedPost.reactionCounts = { fish: 0, bait: 0, wave: 0 }
        }
        updatedPost.reactionCounts = {
          ...updatedPost.reactionCounts,
          [type.toLowerCase()]:
            type === "Fish"
              ? hasFished
                ? fishesCount - 1
                : fishesCount + 1
              : hasBaited
                ? baitsCount - 1
                : baitsCount + 1,
        }
        setPost(updatedPost)
      }
    } catch (error) {
      console.error(`Error toggling ${type}:`, error)
      Alert.alert("Error", `No se pudo procesar tu reacción. Inténtalo de nuevo.`)
    } finally {
      setIsUpdating((prev) => ({ ...prev, [isUpdatingKey]: false }))
    }
  }

  const toggleFish = () => toggleReaction("Fish")
  const toggleBait = () => toggleReaction("Bait")

  const openWaveModal = () => {
    setCommentsModalVisible(false)
    setTimeout(() => {
      setWaveModalVisible(true)
    }, 300)
  }

  const openMediaModal = (index: number) => {
    setCurrentMediaIndex(index)
    setCommentsModalVisible(false)
    setTimeout(() => {
      setMediaModalVisible(true)
    }, 300)
  }

  const openOptionsMenu = () => {
    setCommentsModalVisible(false)
    setTimeout(() => {
      setOptionsMenuVisible(true)
    }, 300)
  }

  const toggleSavePost = async () => {
    if (!post || !user || isSaving) return

    setIsSaving(true)

    try {
      const db = getFirestore()
      const savedPostId = `${user.uid}_${post.id}`
      const savedPostRef = doc(db, "savedPosts", savedPostId)

      if (isSaved) {
        // Eliminar de guardados
        await updateDoc(savedPostRef, {
          deleted: true,
          updatedAt: new Date().toISOString(),
        })
        setIsSaved(false)
      } else {
        // Añadir a guardados
        await setDoc(savedPostRef, {
          id: savedPostId,
          userId: user.uid,
          postId: post.id,
          createdAt: new Date().toISOString(),
          deleted: false,
        })
        setIsSaved(true)
      }
    } catch (error) {
      console.error("Error toggling save post:", error)
      Alert.alert("Error", "No se pudo guardar la publicación. Inténtalo de nuevo.")
    } finally {
      setIsSaving(false)
    }
  }

  const handlePostSaved = (postId: string, saved: boolean) => {
    if (postId === post?.id) {
      setIsSaved(saved)
    }
  }

  const handlePostDeleted = () => {
    router.back()
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        post &&
        postAuthor && (
          <>
            <View style={styles.header}>
              <TouchableOpacity 
                onPress={() => {
                  if (fromReports === "true") {
                    router.back()
                  } else {
                    router.back()
                  }
                }} 
                style={styles.backButton}
              >
                <Feather name="arrow-left" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Detalle del Post</Text>
              <View style={{ width: 24 }} />
            </View>
            <View style={styles.postContainer}>
              <PostItem
                post={post}
                user={postAuthor}
                currentUserId={user?.uid || ""}
                onInteractionUpdate={() => {}}
                onPostDeleted={handlePostDeleted}
                onPostSaved={handlePostSaved}
              />
            </View>
          </>
        )
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#2A3142",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    color: "#FFFFFF",
    fontSize: 16,
    textAlign: "center",
  },
  postContainer: {
    flex: 1,
    paddingTop: 16,
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
  reportsButton: {
    padding: 8,
    backgroundColor: "#8BB9FE",
    borderRadius: 20,
  },
})

export default PostDetailScreen
