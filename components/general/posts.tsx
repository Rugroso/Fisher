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
} from "react-native"
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons"
import Swiper from "react-native-swiper"
import { Video, ResizeMode } from "expo-av"
import { doc, updateDoc, arrayUnion, arrayRemove, getFirestore, getDoc } from "firebase/firestore"
import type { User, Post, PostComment, Notification } from "../../app/types/types"

interface PostItemProps {
  user: User
  post: Post
  currentUserId: string 
  onInteractionUpdate?: (postId: string, type: "fish" | "bait", added: boolean) => void
}

const PostItem = ({ user, post, currentUserId, onInteractionUpdate }: PostItemProps) => {
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
  const [comments, setComments] = useState<Array<PostComment & { user?: User }>>(post.comments || [])
  const [isLoadingComments, setIsLoadingComments] = useState(false)
  const [currentUserData, setCurrentUserData] = useState<User | null>(null)
  const [isLoadingCurrentUser, setIsLoadingCurrentUser] = useState(false)
  const commentInputRef = useRef<TextInput>(null)

  const [hasFished, setHasFished] = useState(false)
  const [hasBaited, setHasBaited] = useState(false)

  const [wavesCount, setWavesCount] = useState(post.waves?.userId?.length || 0)
  const [commentsCount, setCommentsCount] = useState(post.comments?.length || 0)
  const [baitsCount, setBaitsCount] = useState(post.baits?.userId?.length || 0)
  const [fishesCount, setFishesCount] = useState(post.fishes?.userId?.length || 0)

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
    if (post.fishes?.userId) {
      setHasFished(post.fishes.userId.includes(currentUserId))
    }

    if (post.baits?.userId) {
      setHasBaited(post.baits.userId.includes(currentUserId))
    }
  }, [post, currentUserId])

  useEffect(() => {
    if (commentsModalVisible) {
      loadCommentsWithUserInfo()
    }
  }, [commentsModalVisible])

  const loadCommentsWithUserInfo = async () => {
    if (!post.comments || post.comments.length === 0) return

    setIsLoadingComments(true)

    try {
      const db = getFirestore()
      const postDoc = await getDoc(doc(db, "posts", post.postId))

      if (postDoc.exists()) {
        const updatedPost = postDoc.data() as Post
        if (updatedPost.comments) {
          post.comments = updatedPost.comments
          setCommentsCount(updatedPost.comments.length)
        }
      }

      const userIds = [...new Set(post.comments.map((comment) => comment.userId))]

      const usersData: Record<string, User> = {}

      for (const userId of userIds) {
        const userDoc = await getDoc(doc(db, "users", userId))
        if (userDoc.exists()) {
          usersData[userId] = userDoc.data() as User
        }
      }

      const commentsWithUserInfo = post.comments.map((comment) => ({
        ...comment,
        user: usersData[comment.userId],
      }))

      commentsWithUserInfo.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      setComments(commentsWithUserInfo)
    } catch (error) {
      console.error("Error al cargar información de usuarios para comentarios:", error)
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

  const createNotification = async (type: "Comment" | "Fish" | "Bait", content: string) => {
    if (currentUserId === post.userId) return 

    try {
      const db = getFirestore()
      const userRef = doc(db, "users", post.userId)

      const notification: Notification = {
        notificationId: `notification_${Date.now()}`,
        type,
        content,
        created_at: new Date().toISOString(),
        isRead: false,
        triggeredByUserId: currentUserId,
        postId: post.postId,
        ...(type === "Comment" && { commentId: `comment_${Date.now()}` }),
      }

      await updateDoc(userRef, {
        notifications: arrayUnion(notification),
      })
    } catch (error) {
      console.error(`Error al crear notificación de ${type}:`, error)
    }
  }

  const addComment = async () => {
    if (!commentText.trim() || isUpdating.comment) return

    setIsUpdating((prev) => ({ ...prev, comment: true }))

    try {
      const db = getFirestore()
      const postRef = doc(db, "posts", post.postId)

      const newComment: PostComment = {
        commentId: `comment_${Date.now()}`,
        content: commentText.trim(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        userId: currentUserId,
      }

      await updateDoc(postRef, {
        comments: arrayUnion(newComment),
      })

      if (!post.comments) {
        post.comments = []
      }
      post.comments.push(newComment)

      const commentWithUser = {
        ...newComment,
        user: currentUserData,
      }
      if (commentsCount > 0) {
        setComments((prev) => [commentWithUser as PostComment & { user?: User }, ...prev])
      } else {
        setComments([commentWithUser as PostComment & { user?: User }])
      }
      setCommentsCount((prev) => prev + 1)
      setCommentText("")

      const userRef = doc(db, "users", currentUserId)
      await updateDoc(userRef, {
        comments: arrayUnion({
          postId: post.postId,
          commentId: newComment.commentId,
        }),
      })

      await createNotification("Comment", `@${currentUserData?.username || "Usuario"} comentó en tu publicación`)
    } catch (error) {
      console.error("Error al añadir comentario:", error)
    } finally {
      setIsUpdating((prev) => ({ ...prev, comment: false }))
    }
  }

  const toggleFish = async () => {
    if (isUpdating.fish) return 

    setIsUpdating((prev) => ({ ...prev, fish: true }))

    try {
      const db = getFirestore()
      const postRef = doc(db, "posts", post.postId)
      const userRef = doc(db, "users", currentUserId)

      const postDoc = await getDoc(postRef)

      if (!postDoc.exists()) {
        console.error("El documento del post no existe")
        return
      }

      const postData = postDoc.data()

      if (!postData.fishes) {
        await updateDoc(postRef, {
          fishes: { userId: [] },
        })
      } else if (!postData.fishes.userId) {
        await updateDoc(postRef, {
          "fishes.userId": [],
        })
      }

      if (hasFished) {
        await updateDoc(postRef, {
          "fishes.userId": arrayRemove(currentUserId),
        })

        await updateDoc(userRef, {
          "fishes.postId": arrayRemove(post.postId),
        })

        setHasFished(false)
        setFishesCount((prev) => prev - 1)
        if (onInteractionUpdate) onInteractionUpdate(post.postId, "fish", false)
      } else {
        // Dar fish
        await updateDoc(postRef, {
          "fishes.userId": arrayUnion(currentUserId),
        })

        await updateDoc(userRef, {
          "fishes.postId": arrayUnion(post.postId),
        })

        setHasFished(true)
        setFishesCount((prev) => prev + 1)
        if (onInteractionUpdate) onInteractionUpdate(post.postId, "fish", true)

        await createNotification("Fish", `@${currentUserData?.username || "Usuario"} le dio fish a tu publicación`)
      }
    } catch (error) {
      console.error("Error al actualizar fish:", error)
    } finally {
      setIsUpdating((prev) => ({ ...prev, fish: false }))
    }
  }

  const toggleBait = async () => {
    if (isUpdating.bait) return 

    setIsUpdating((prev) => ({ ...prev, bait: true }))

    try {
      const db = getFirestore()
      const postRef = doc(db, "posts", post.postId)
      const userRef = doc(db, "users", currentUserId)

      const postDoc = await getDoc(postRef)

      if (!postDoc.exists()) {
        console.error("El documento del post no existe")
        return
      }

      const postData = postDoc.data()

      if (!postData.baits) {
        await updateDoc(postRef, {
          baits: { userId: [] },
        })
      } else if (!postData.baits.userId) {
        await updateDoc(postRef, {
          "baits.userId": [],
        })
      }

      if (hasBaited) {
        await updateDoc(postRef, {
          "baits.userId": arrayRemove(currentUserId),
        })

        await updateDoc(userRef, {
          "baits.postId": arrayRemove(post.postId),
        })

        setHasBaited(false)
        setBaitsCount((prev) => prev - 1)
        if (onInteractionUpdate) onInteractionUpdate(post.postId, "bait", false)
      } else {
        await updateDoc(postRef, {
          "baits.userId": arrayUnion(currentUserId),
        })

        await updateDoc(userRef, {
          "baits.postId": arrayUnion(post.postId),
        })

        setHasBaited(true)
        setBaitsCount((prev) => prev + 1)
        if (onInteractionUpdate) onInteractionUpdate(post.postId, "bait", true)

        await createNotification("Bait", `@${currentUserData?.username || "Usuario"} le dio bait a tu publicación`)
      }
    } catch (error) {
      console.error("Error al actualizar bait:", error)
    } finally {
      setIsUpdating((prev) => ({ ...prev, bait: false }))
    }
  }

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
              keyExtractor={(item) => item.commentId}
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
        <TouchableOpacity>
          <Feather name="more-horizontal" size={24} color="#AAAAAA" />
        </TouchableOpacity>
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
  postContainer: {
    borderBottomWidth: 1,
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

