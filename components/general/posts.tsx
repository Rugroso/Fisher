"use client"

import { useState, useEffect, useRef } from "react"
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Dimensions,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Alert,
} from "react-native"
import { Feather, FontAwesome, MaterialCommunityIcons } from "@expo/vector-icons"
import Swiper from "react-native-swiper"
import { Video, ResizeMode } from "expo-av"
import { doc, updateDoc, arrayUnion, getFirestore, getDoc, setDoc, deleteDoc } from "firebase/firestore"
import type { User, Post, Comment, ReactionType } from "../../app/types/types"
import { createNotification } from "../../lib/notifications"

interface PostItemProps {
  user: User
  post: Post
  currentUserId: string
  onInteractionUpdate?: (postId: string, type: "Fish" | "Bait", added: boolean) => void
  onPostDeleted?: (postId: string) => void
  onPostSaved?: (postId: string, saved: boolean) => void
}

const PostItem = ({ user, post, currentUserId, onInteractionUpdate, onPostDeleted, onPostSaved }: PostItemProps) => {
  const [optionsMenuVisible, setOptionsMenuVisible] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const isPostAuthor = currentUserId === post.authorId

  useEffect(() => {
    const checkIfPostIsSaved = async () => {
      try {
        const db = getFirestore()
        const savedPostRef = doc(db, "savedPosts", `${currentUserId}_${post.id}`)
        const savedPostDoc = await getDoc(savedPostRef)

        setIsSaved(savedPostDoc.exists() && !savedPostDoc.data()?.deleted)
      } catch (error) {
        console.error("Error al verificar si el post está guardado:", error)
      }
    }

    checkIfPostIsSaved()
  }, [post.id, currentUserId])

  const toggleSavePost = async () => {
    if (isSaving) return

    setIsSaving(true)
    try {
      const db = getFirestore()
      const savedPostRef = doc(db, "savedPosts", `${currentUserId}_${post.id}`)

      if (isSaved) {
        await updateDoc(savedPostRef, {
          deleted: true,
          updatedAt: new Date().toISOString(),
        })
        setIsSaved(false)

        if (onPostSaved) {
          onPostSaved(post.id, false)
        }

        Alert.alert("Éxito", "La publicación ha sido eliminada de tus guardados.")
      } else {
        const savedPost = {
          postId: post.id,
          userId: currentUserId,
          authorId: post.authorId,
          savedAt: new Date().toISOString(),
          deleted: false,
        }

        await setDoc(savedPostRef, savedPost)
        setIsSaved(true)

        if (onPostSaved) {
          onPostSaved(post.id, true)
        }

        Alert.alert("Éxito", "La publicación ha sido guardada correctamente.")
      }

      setOptionsMenuVisible(false)
    } catch (error) {
      console.error("Error al guardar/quitar el post:", error)
      Alert.alert("Error", "Ocurrió un problema al intentar guardar la publicación.")
    } finally {
      setIsSaving(false)
    }
  }

  const deletePost = async () => {
    try {
      const db = getFirestore()

      Alert.alert(
        "Eliminar publicación",
        "¿Estás seguro que deseas eliminar esta publicación? Esta acción no se puede deshacer.",
        [
          {
            text: "Cancelar",
            style: "cancel",
          },
          {
            text: "Eliminar",
            style: "destructive",
            onPress: async () => {
              try {
                await deleteDoc(doc(db, "posts", post.id))

                if (onPostDeleted) {
                  onPostDeleted(post.id)
                  console.log("Post eliminado con ID:", post.id)
                }

                try {
                  await deleteDoc(doc(db, "comments", post.id))
                } catch (error) {
                  console.log("Error al eliminar datos asociados:", error)
                }
              } catch (error) {
                console.error("Error al eliminar el post:", error)
                Alert.alert("Error", "No se pudo eliminar la publicación. Inténtalo de nuevo más tarde.")
              }
            },
          },
        ],
      )
    } catch (error) {
      console.error("Error al intentar eliminar el post:", error)
      Alert.alert("Error", "Ocurrió un problema al intentar eliminar la publicación.")
    }
  }

  const renderOptionsMenu = () => {
    return (
      <Modal
        visible={optionsMenuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setOptionsMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.optionsModalOverlay}
          activeOpacity={1}
          onPress={() => setOptionsMenuVisible(false)}
        >
          <View style={styles.optionsMenuContainer}>
            {isPostAuthor && (
              <TouchableOpacity
                style={styles.optionItem}
                onPress={() => {
                  setOptionsMenuVisible(false)
                  deletePost()
                }}
              >
                <Feather name="trash-2" size={20} color="#FFFFFF" />
                <Text style={styles.deleteOptionText}>Eliminar publicación</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.optionItem} onPress={toggleSavePost} disabled={isSaving}>
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 16 }} />
              ) : (
                <Feather name={isSaved ? "bookmark" : "plus-circle"} size={20} color="#FFFFFF" />
              )}
              <Text style={styles.optionText}>{isSaved ? "Quitar de guardados" : "Guardar publicación"}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelOption} onPress={() => setOptionsMenuVisible(false)}>
              <Text style={styles.cancelOptionText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    )
  }

  const [mediaModalVisible, setMediaModalVisible] = useState(false)
  const [commentsModalVisible, setCommentsModalVisible] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [videoLoading, setVideoLoading] = useState<Record<string, boolean>>({})
  const [isUpdating, setIsUpdating] = useState<{ fish: boolean; bait: boolean; comment: boolean }>({
    fish: false,
    bait: false,
    comment: false,
  })
  const [commentText, setCommentText] = useState("")
  const [comments, setComments] = useState<Array<Comment & { user?: User }>>([])
  const [isLoadingComments, setIsLoadingComments] = useState(false)
  const [currentUserData, setCurrentUserData] = useState<User | null>(null)
  const [isLoadingCurrentUser, setIsLoadingCurrentUser] = useState(false)
  const commentInputRef = useRef<TextInput>(null)

  const [hasFished, setHasFished] = useState(false)
  const [hasBaited, setHasBaited] = useState(false)

  const [wavesCount, setWavesCount] = useState(post.reactionCounts.wave || 0)
  const [commentsCount, setCommentsCount] = useState(post.commentCount || 0)
  const [baitsCount, setBaitsCount] = useState(post.reactionCounts.bait || 0)
  const [fishesCount, setFishesCount] = useState(post.reactionCounts.fish || 0)

  const mediaArray = Array.isArray(post.media) ? post.media : post.media ? [post.media] : []

  const hasMedia = mediaArray.length > 0

  useEffect(() => {
    const loadCurrentUserData = async () => {
      if (!currentUserId) return

      setIsLoadingCurrentUser(true)
      try {
        const db = getFirestore()
        const userDoc = await getDoc(doc(db, "users", currentUserId))

        if (userDoc.exists()) {
          setCurrentUserData(userDoc.data() as User)
        }
      } catch (error) {
        console.error("Error al cargar datos del usuario actual:", error)
      } finally {
        setIsLoadingCurrentUser(false)
      }
    }

    loadCurrentUserData()
  }, [currentUserId])

  useEffect(() => {
    const checkUserReactions = async () => {
      try {
        const db = getFirestore()

        const fishQuery = await getDoc(doc(db, "reactions", `${post.id}_${currentUserId}_Fish`))
        setHasFished(fishQuery.exists() && !fishQuery.data()?.deleted)

        const baitQuery = await getDoc(doc(db, "reactions", `${post.id}_${currentUserId}_Bait`))
        setHasBaited(baitQuery.exists() && !baitQuery.data()?.deleted)
      } catch (error) {
        console.error("Error checking user reactions:", error)
      }
    }

    checkUserReactions()
  }, [post.id, currentUserId])

  useEffect(() => {
    if (commentsModalVisible) {
      loadCommentsWithUserInfo()
    }
  }, [commentsModalVisible])

  const loadCommentsWithUserInfo = async () => {
    setIsLoadingComments(true)

    try {
      const db = getFirestore()

      const commentsQuery = await getDoc(doc(db, "posts", post.id))

      if (!commentsQuery.exists()) {
        setIsLoadingComments(false)
        return
      }

      const updatedPost = commentsQuery.data() as Post
      setCommentsCount(updatedPost.commentCount || 0)

      const commentsSnapshot = await getDoc(doc(db, "comments", post.id))

      if (!commentsSnapshot.exists()) {
        await setDoc(doc(db, "comments", post.id), {
          comments: [],
        })
        setComments([])
        setIsLoadingComments(false)
        return
      }

      const commentsData = commentsSnapshot.data() as { comments: Comment[] }

      if (!commentsData || !commentsData.comments || commentsData.comments.length === 0) {
        setComments([])
        setIsLoadingComments(false)
        return
      }

      const userIds = [...new Set(commentsData.comments.map((comment) => comment.authorId))]

      const usersData: Record<string, User> = {}

      for (const userId of userIds) {
        const userDoc = await getDoc(doc(db, "users", userId))
        if (userDoc.exists()) {
          usersData[userId] = userDoc.data() as User
        }
      }

      const commentsWithUserInfo = commentsData.comments.map((comment) => ({
        ...comment,
        user: usersData[comment.authorId],
      }))

      commentsWithUserInfo.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

      setComments(commentsWithUserInfo)
    } catch (error) {
      console.error("Error loading comments:", error)
    } finally {
      setIsLoadingComments(false)
    }
  }

  const isVideoUrl = (url: string) => {
    return url.includes(".mp4") || url.includes(".mov") || url.includes(".avi") || url.includes("video")
  }

  const openMediaModal = (index: number) => {
    setCurrentIndex(index)
    setMediaModalVisible(true)
  }

  const openCommentsModal = () => {
    setCommentsModalVisible(true)
  }

  const sendPushNotification = async (
    expoPushTokens: string[],
    title: string,
    body: string,
    data: Record<string, any> = {},
  ) => {
    if (!expoPushTokens || expoPushTokens.length === 0) {
      console.log("No hay tokens para enviar notificaciones")
      return
    }

    try {
      const messages = expoPushTokens.map((token) => ({
        to: token,
        sound: "default",
        title,
        body,
        data,
      }))

      const chunks = []
      const chunkSize = 100

      for (let i = 0; i < messages.length; i += chunkSize) {
        chunks.push(messages.slice(i, i + chunkSize))
      }

      for (const chunk of chunks) {
        const response = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Accept-encoding": "gzip, deflate",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(chunk.length > 1 ? chunk : chunk[0]),
        })

        const responseData = await response.json()
        console.log("Notificación push enviada:", responseData)
      }
    } catch (error) {
      console.error("Error al enviar notificación push:", error)
    }
  }

  const addComment = async () => {
    if (!commentText.trim() || isUpdating.comment) return

    setIsUpdating((prev) => ({ ...prev, comment: true }))

    try {
      const db = getFirestore()

      const newComment: Comment = {
        id: `comment_${Date.now()}`,
        postId: post.id,
        authorId: currentUserId,
        content: commentText.trim(),
        createdAt: new Date().toISOString(),
      }

      const commentsRef = doc(db, "comments", post.id)
      const commentsDoc = await getDoc(commentsRef)

      if (!commentsDoc.exists()) {
        await setDoc(commentsRef, {
          comments: [newComment],
        })
      } else {
        await updateDoc(commentsRef, {
          comments: arrayUnion(newComment),
        })
      }

      await updateDoc(doc(db, "posts", post.id), {
        commentCount: (post.commentCount || 0) + 1,
      })

      const commentWithUser = {
        ...newComment,
        user: currentUserData,
      }

      setComments((prev) => [commentWithUser as Comment & { user?: User }, ...prev])
      setCommentsCount((prev) => prev + 1)
      setCommentText("")

      // Usar el nuevo servicio de notificaciones
      if (currentUserId !== post.authorId) {
        await createNotification(
          post.authorId,
          "Comment",
          `@${currentUserData?.username || "Usuario"} comentó en tu publicación`,
          currentUserId,
          post.id,
          newComment.id,
          "/(drawer)/(tabs)/stackhome/post-detail",
          { postId: post.id },
        )
      }
    } catch (error) {
      console.error("Error adding comment:", error)
    } finally {
      setIsUpdating((prev) => ({ ...prev, comment: false }))
    }
  }

  const toggleReaction = async (type: ReactionType) => {
    const isUpdatingKey = type === "Fish" ? "fish" : "bait"
    const oppositeType = type === "Fish" ? "Bait" : "Fish"
    const hasOppositeReaction = type === "Fish" ? hasBaited : hasFished

    if (isUpdating[isUpdatingKey]) return

    setIsUpdating((prev) => ({ ...prev, [isUpdatingKey]: true }))

    try {
      const db = getFirestore()
      const hasReacted = type === "Fish" ? hasFished : hasBaited
      const reactionId = `${post.id}_${currentUserId}_${type}`
      const reactionRef = doc(db, "reactions", reactionId)

      if (hasOppositeReaction) {
        const oppositeReactionId = `${post.id}_${currentUserId}_${oppositeType}`
        const oppositeReactionRef = doc(db, "reactions", oppositeReactionId)

        await updateDoc(doc(db, "posts", post.id), {
          [`reactionCounts.${oppositeType.toLowerCase()}`]: Math.max(
            0,
            (post.reactionCounts[oppositeType.toLowerCase() as keyof typeof post.reactionCounts] || 0) - 1,
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

        if (onInteractionUpdate && (oppositeType === "Fish" || oppositeType === "Bait")) {
          onInteractionUpdate(post.id, oppositeType, false)
        }
      }

      if (hasReacted) {
        await updateDoc(doc(db, "posts", post.id), {
          [`reactionCounts.${type.toLowerCase()}`]: Math.max(
            0,
            (post.reactionCounts[type.toLowerCase() as keyof typeof post.reactionCounts] || 0) - 1,
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
        if (onInteractionUpdate && (type === "Fish" || type === "Bait")) {
          onInteractionUpdate(post.id, type, false)
        }
      } else {
        await updateDoc(doc(db, "posts", post.id), {
          [`reactionCounts.${type.toLowerCase()}`]:
            (post.reactionCounts[type.toLowerCase() as keyof typeof post.reactionCounts] || 0) + 1,
        })

        const reaction = {
          id: reactionId,
          postId: post.id,
          userId: currentUserId,
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

        if (onInteractionUpdate && (type === "Fish" || type === "Bait")) {
          onInteractionUpdate(post.id, type, true)
        }

        // Usar el nuevo servicio de notificaciones
        if (currentUserId !== post.authorId) {
          await createNotification(
            post.authorId,
            type as "Bait" | "Fish",
            `@${currentUserData?.username || "Usuario"} le dio ${type.toLowerCase()} a tu publicación`,
            currentUserId,
            post.id,
            undefined,
            "/(drawer)/(tabs)/stackhome/post-detail",
            { postId: post.id },
          )
        }
      }
    } catch (error) {
      console.error(`Error toggling ${type}:`, error)
    } finally {
      setIsUpdating((prev) => ({ ...prev, [isUpdatingKey]: false }))
    }
  }

  const toggleFish = () => toggleReaction("Fish")
  const toggleBait = () => toggleReaction("Bait")

  const renderMediaPreview = () => {
    if (!hasMedia) return null

    if (mediaArray.length === 1) {
      const mediaUrl = mediaArray[0]
      const isVideo = isVideoUrl(mediaUrl)

      return (
        <TouchableOpacity style={styles.singleMediaContainer} onPress={() => openMediaModal(0)}>
          {isVideo ? (
            <View style={styles.videoPreviewContainer}>
              <Image
                source={{ uri: mediaUrl.replace(".mp4", ".jpg").replace(".mov", ".jpg") }}
                style={styles.mediaPreview}
              />
              <View style={styles.playIconOverlay}>
                <Feather name="play" size={40} color="#FFFFFF" />
              </View>
            </View>
          ) : (
            <Image source={{ uri: mediaUrl }} style={styles.mediaPreview} />
          )}
        </TouchableOpacity>
      )
    }

    return (
      <View style={styles.mediaGridContainer}>
        {mediaArray.slice(0, 4).map((mediaUrl, index) => {
          const isVideo = isVideoUrl(mediaUrl)
          const showMoreOverlay = index === 3 && mediaArray.length > 4

          return (
            <TouchableOpacity
              key={`media_${index}`}
              style={[
                styles.mediaGridItem,
                mediaArray.length === 3 && index === 0 ? styles.mediaGridItemLarge : null,
                mediaArray.length === 2 ? styles.mediaGridItemHalf : null,
              ]}
              onPress={() => openMediaModal(index)}
            >
              {isVideo ? (
                <View style={styles.videoPreviewContainer}>
                  <Image
                    source={{ uri: mediaUrl.replace(".mp4", ".jpg").replace(".mov", ".jpg") }}
                    style={styles.mediaGridImage}
                  />
                  <View style={styles.playIconOverlay}>
                    <Feather name="play" size={24} color="#FFFFFF" />
                  </View>
                </View>
              ) : (
                <Image source={{ uri: mediaUrl }} style={styles.mediaGridImage} />
              )}

              {showMoreOverlay && (
                <View style={styles.moreOverlay}>
                  <Text style={styles.moreOverlayText}>+{mediaArray.length - 4}</Text>
                </View>
              )}
            </TouchableOpacity>
          )
        })}
      </View>
    )
  }

  const renderMediaModalContent = () => {
    if (!hasMedia) return null

    return (
      <Modal
        visible={mediaModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setMediaModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.closeButton} onPress={() => setMediaModalVisible(false)}>
            <Feather name="x" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <Swiper
            index={currentIndex}
            loop={false}
            onIndexChanged={(index) => setCurrentIndex(index)}
            showsPagination={true}
            paginationStyle={styles.paginationContainer}
            dotStyle={styles.paginationDot}
            activeDotStyle={styles.paginationDotActive}
            containerStyle={styles.swiperContainer}
          >
            {mediaArray.map((mediaUrl, index) => (
              <View key={`media_${index}`} style={styles.modalMediaContainer}>
                {isVideoUrl(mediaUrl) ? (
                  <View style={styles.videoContainer}>
                    {videoLoading[mediaUrl] && (
                      <View style={styles.videoLoadingContainer}>
                        <ActivityIndicator size="large" color="#FFFFFF" />
                      </View>
                    )}
                    <Video
                      source={{ uri: mediaUrl }}
                      style={styles.video}
                      useNativeControls
                      resizeMode={ResizeMode.CONTAIN}
                      shouldPlay={true}
                      isLooping
                      onLoadStart={() => {
                        setVideoLoading((prev) => ({ ...prev, [mediaUrl]: true }))
                      }}
                      onLoad={() => {
                        setVideoLoading((prev) => ({ ...prev, [mediaUrl]: false }))
                      }}
                      onError={(error) => {
                        console.error("Error loading video:", error)
                        setVideoLoading((prev) => ({ ...prev, [mediaUrl]: false }))
                      }}
                    />
                  </View>
                ) : (
                  <Image source={{ uri: mediaUrl }} style={styles.modalImage} resizeMode="contain" />
                )}
              </View>
            ))}
          </Swiper>
        </View>
      </Modal>
    )
  }

  const renderCommentsModal = () => {
    return (
      <Modal
        visible={commentsModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setCommentsModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.commentsModalContainer}
        >
          <View style={styles.commentsModalHeader}>
            <TouchableOpacity onPress={() => setCommentsModalVisible(false)}>
              <Feather name="arrow-left" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.commentsModalTitle}>Comentarios</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.originalPostContainer}>
            <View style={styles.postHeader}>
              <View style={styles.userInfo}>
                {user.profilePicture ? (
                  <Image source={{ uri: user.profilePicture }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]} />
                )}
                <Text style={styles.username}>@{user.username}</Text>
              </View>
              <TouchableOpacity>
                <Feather name="more-horizontal" size={24} color="#AAAAAA" />
              </TouchableOpacity>
            </View>

            <View style={styles.postContent}>
              <Text style={styles.postText}>{post.content}</Text>
              {hasMedia && mediaArray.length > 0 && (
                <TouchableOpacity
                  style={styles.mediaPreviewInComments}
                  onPress={() => {
                    setCommentsModalVisible(false)
                    setTimeout(() => openMediaModal(0), 300)
                  }}
                >
                  <Image source={{ uri: mediaArray[0] }} style={styles.mediaPreviewImage} />
                  {mediaArray.length > 1 && (
                    <View style={styles.mediaCountBadge}>
                      <Text style={styles.mediaCountText}>+{mediaArray.length - 1}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.interactionsContainer}>
              <TouchableOpacity style={styles.interactionItem} activeOpacity={0.7}>
                <WaveIcon />
                <Text style={styles.interactionText}>{wavesCount}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.interactionItem} activeOpacity={0.7}>
                <CommentIcon />
                <Text style={styles.interactionText}>{commentsCount}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.interactionItem}
                activeOpacity={0.7}
                onPress={toggleBait}
                disabled={isUpdating.bait}
              >
                <HookIcon active={hasBaited} isUpdating={isUpdating.bait} />
                <Text style={[styles.interactionText, hasBaited && styles.activeInteractionText]}>{baitsCount}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.interactionItem}
                activeOpacity={0.7}
                onPress={toggleFish}
                disabled={isUpdating.fish}
              >
                <FishIcon active={hasFished} isUpdating={isUpdating.fish} />
                <Text style={[styles.interactionText, hasFished && styles.activeInteractionText]}>{fishesCount}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {isLoadingComments ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FFFFFF" />
            </View>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.commentItem}>
                  <View style={styles.commentHeader}>
                    <View style={styles.commentUserInfo}>
                      {item.user?.profilePicture ? (
                        <Image source={{ uri: item.user.profilePicture }} style={styles.commentAvatar} />
                      ) : (
                        <View style={[styles.commentAvatar, styles.avatarPlaceholder]} />
                      )}
                      <Text style={styles.commentUsername}>@{item.user?.username || "usuario"}</Text>
                    </View>
                    <TouchableOpacity>
                      <Feather name="more-horizontal" size={20} color="#AAAAAA" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.commentContent}>{item.content}</Text>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyCommentsContainer}>
                  <Text style={styles.emptyCommentsText}>No hay comentarios aún</Text>
                </View>
              }
              contentContainerStyle={styles.commentsList}
            />
          )}

          <View style={styles.commentInputContainer}>
            {currentUserData?.profilePicture ? (
              <Image source={{ uri: currentUserData.profilePicture }} style={styles.commentInputAvatar} />
            ) : (
              <View style={[styles.commentInputAvatar, styles.avatarPlaceholder]} />
            )}
            <TextInput
              ref={commentInputRef}
              style={styles.commentInput}
              placeholder="Añadir comentario..."
              placeholderTextColor="#8A8A8A"
              value={commentText}
              onChangeText={setCommentText}
              multiline
            />
            <TouchableOpacity
              style={[styles.sendButton, (!commentText.trim() || isUpdating.comment) && styles.sendButtonDisabled]}
              onPress={addComment}
              disabled={!commentText.trim() || isUpdating.comment}
            >
              {isUpdating.comment ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Feather name="send" size={20} color={!commentText.trim() ? "#8A8A8A" : "#FFFFFF"} />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    )
  }

  return (
    <View style={styles.postContainer}>
      <View style={styles.postHeader}>
        <View style={styles.userInfo}>
          {user.profilePicture ? (
            <Image source={{ uri: user.profilePicture }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]} />
          )}
          <Text style={styles.username}>@{user.username}</Text>
        </View>
        <View style={styles.headerActions}>
          {isSaved && <FontAwesome name="bookmark" size={20} color="#ffd700" style={styles.savedIcon} />}
          <TouchableOpacity onPress={() => setOptionsMenuVisible(true)}>
            <Feather name="more-horizontal" size={24} color="#AAAAAA" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.postContent}>
        <Text style={styles.postText}>{post.content}</Text>
        {renderMediaPreview()}
      </View>

      <View style={styles.interactionsContainer}>
        <TouchableOpacity style={styles.interactionItem} activeOpacity={0.7}>
          <WaveIcon />
          <Text style={styles.interactionText}>{wavesCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.interactionItem} activeOpacity={0.7} onPress={openCommentsModal}>
          <CommentIcon />
          <Text style={styles.interactionText}>{commentsCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.interactionItem}
          activeOpacity={0.7}
          onPress={toggleBait}
          disabled={isUpdating.bait}
        >
          <HookIcon active={hasBaited} isUpdating={isUpdating.bait} />
          <Text style={[styles.interactionText, hasBaited && styles.activeInteractionText]}>{baitsCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.interactionItem}
          activeOpacity={0.7}
          onPress={toggleFish}
          disabled={isUpdating.fish}
        >
          <FishIcon active={hasFished} isUpdating={isUpdating.fish} />
          <Text style={[styles.interactionText, hasFished && styles.activeInteractionText]}>{fishesCount}</Text>
        </TouchableOpacity>
      </View>

      {renderMediaModalContent()}
      {renderCommentsModal()}
      {renderOptionsMenu()}
    </View>
  )
}

const WaveIcon = () => (
  <View style={styles.iconContainer}>
    <MaterialCommunityIcons name="waves" size={20} color="#FFFFFF" />
  </View>
)

const CommentIcon = () => (
  <View style={styles.iconContainer}>
    <Feather name="message-circle" size={20} color="#FFFFFF" />
  </View>
)

interface IconProps {
  active?: boolean
  isUpdating?: boolean
}

const HookIcon = ({ active, isUpdating }: IconProps) => (
  <View style={styles.iconContainer}>
    {isUpdating ? (
      <ActivityIndicator size="small" color="#FFFFFF" />
    ) : (
      <Feather name="anchor" size={20} color={active ? "#4ECDC4" : "#FFFFFF"} />
    )}
  </View>
)

const FishIcon = ({ active, isUpdating }: IconProps) => (
  <View style={styles.iconContainer}>
    {isUpdating ? (
      <ActivityIndicator size="small" color="#FFFFFF" />
    ) : (
      <MaterialCommunityIcons name="fish" size={20} color={active ? "#FF6B6B" : "#FFFFFF"} />
    )}
  </View>
)

const { width: screenWidth, height: screenHeight } = Dimensions.get("window")

const styles = StyleSheet.create({
  optionsModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  optionsMenuContainer: {
    width: "80%",
    backgroundColor: "#3B4255",
    borderRadius: 12,
    overflow: "hidden",
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#2A3142",
  },
  optionText: {
    color: "#FFFFFF",
    marginLeft: 16,
    fontSize: 16,
  },
  deleteOptionText: {
    color: "#FFFFFF",
    marginLeft: 16,
    fontSize: 16,
  },
  cancelOption: {
    paddingVertical: 16,
    alignItems: "center",
  },
  cancelOptionText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  postContainer: {
    borderBottomWidth: 1,
    borderRadius: 12,
    backgroundColor: "#3B4255",
    borderColor: "#5B5B5B",
  },
  swiperContainer: {
    width: "100%",
  },
  postHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  savedIcon: {
    marginRight: 12,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#DDDDDD",
  },
  avatarPlaceholder: {
    backgroundColor: "#CCCCCC",
  },
  username: {
    color: "#FFFFFF",
    fontWeight: "500",
    marginLeft: 10,
  },
  postContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  postText: {
    color: "#FFFFFF",
    marginBottom: 10,
  },
  singleMediaContainer: {
    width: "100%",
    height: 300,
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 10,
  },
  mediaPreview: {
    width: "100%",
    height: "100%",
  },
  mediaGridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 10,
  },
  mediaGridItem: {
    width: "50%",
    height: 150,
    padding: 2,
  },
  mediaGridItemLarge: {
    width: "100%",
    height: 200,
  },
  mediaGridItemHalf: {
    width: "50%",
    height: 200,
  },
  mediaGridImage: {
    width: "100%",
    height: "100%",
    borderRadius: 4,
  },
  videoPreviewContainer: {
    width: "100%",
    height: "100%",
    position: "relative",
  },
  playIconOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderRadius: 4,
  },
  moreOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 4,
  },
  moreOverlayText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "bold",
  },
  interactionsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#4E566D",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
    padding: 10,
  },
  interactionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 5,
  },
  iconContainer: {
    marginRight: 5,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  interactionText: {
    color: "#FFFFFF",
  },
  activeInteractionText: {
    fontWeight: "bold",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
  },
  closeButton: {
    position: "absolute",
    top: 40,
    right: 20,
    zIndex: 10,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 20,
    padding: 8,
  },
  mediaCountIndicator: {
    position: "absolute",
    top: 40,
    left: 20,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 15,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  mediaCountText: {
    color: "#FFFFFF",
    fontSize: 14,
  },
  modalMediaContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  paginationContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
    bottom: 30,
    width: "100%",
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    margin: 3,
  },
  paginationDotActive: {
    backgroundColor: "#FFFFFF",
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  videoContainer: {
    width: "100%",
    height: screenHeight * 0.8,
    justifyContent: "center",
    alignItems: "center",
  },
  video: {
    width: "100%",
    height: "100%",
  },
  modalImage: {
    width: "100%",
    height: "100%",
  },
  videoLoadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  commentsModalContainer: {
    flex: 1,
    backgroundColor: "#2A3142",
    marginTop: screenHeight * 0.05,
  },
  commentsModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#3B4255",
  },
  commentsModalTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
  originalPostContainer: {
    backgroundColor: "#3B4255",
    borderBottomWidth: 1,
    borderBottomColor: "#5B5B5B",
    paddingBottom: 10,
  },
  mediaPreviewInComments: {
    height: 150,
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 10,
    position: "relative",
  },
  mediaPreviewImage: {
    width: "100%",
    height: "100%",
  },
  mediaCountBadge: {
    position: "absolute",
    bottom: 10,
    right: 10,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 15,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  commentsList: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  commentItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#3B4255",
  },
  commentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  commentUserInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  commentAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#DDDDDD",
  },
  commentUsername: {
    color: "#FFFFFF",
    fontWeight: "500",
    marginLeft: 8,
  },
  commentContent: {
    color: "#FFFFFF",
    marginLeft: 38,
  },
  emptyCommentsContainer: {
    padding: 20,
    alignItems: "center",
  },
  emptyCommentsText: {
    color: "#AAAAAA",
    fontSize: 16,
  },
  commentInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#3B4255",
    backgroundColor: "#2A3142",
    marginBottom: 25,
  },
  commentInputAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  commentInput: {
    flex: 1,
    backgroundColor: "#3B4255",
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    color: "#FFFFFF",
    maxHeight: 100,
  },
  sendButton: {
    marginLeft: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#4ECDC4",
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#3B4255",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
})

export default PostItem
