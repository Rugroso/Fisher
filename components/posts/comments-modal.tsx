"use client"
import type React from "react"
import { useState, useRef, useEffect } from "react"
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
  FlatList,
  Dimensions,
  Alert,
} from "react-native"
import { Feather } from "@expo/vector-icons"
import { doc, updateDoc, arrayUnion, getFirestore, getDoc, setDoc } from "firebase/firestore"
import type { User, Post, Comment } from "../../app/types/types"
import { createNotification } from "../../lib/notifications"
import { WaveIcon, CommentIcon, HookIcon, FishIcon } from "./interaction-icons"

interface CommentsModalProps {
  visible: boolean
  onClose: () => void
  post: Post
  user: User
  currentUserId: string
  currentUserData: User | null
  wavesCount?: number
  commentsCount?: number
  baitsCount?: number
  fishesCount?: number
  hasBaited?: boolean
  hasFished?: boolean
  isUpdating?: { fish: boolean; bait: boolean; comment: boolean; wave: boolean }
  setIsUpdating?: React.Dispatch<
    React.SetStateAction<{ fish: boolean; bait: boolean; comment: boolean; wave: boolean }>
  >
  toggleBait?: () => void
  toggleFish?: () => void
  openWaveModal?: () => void
  openMediaModal?: (index: number) => void
  openOptionsMenu?: () => void
  onUpdateCounts?: (updates: {
    wavesCount?: number
    commentsCount?: number
    baitsCount?: number
    fishesCount?: number
    hasBaited?: boolean
    hasFished?: boolean
  }) => void
}

const CommentsModal: React.FC<CommentsModalProps> = ({
  visible,
  onClose,
  post,
  user,
  currentUserId,
  currentUserData: initialCurrentUserData,
  wavesCount: initialWavesCount,
  commentsCount: initialCommentsCount,
  baitsCount: initialBaitsCount,
  fishesCount: initialFishesCount,
  hasBaited: initialHasBaited,
  hasFished: initialHasFished,
  isUpdating: initialIsUpdating,
  setIsUpdating: externalSetIsUpdating,
  toggleBait: externalToggleBait,
  toggleFish: externalToggleFish,
  openWaveModal: externalOpenWaveModal,
  openMediaModal: externalOpenMediaModal,
  openOptionsMenu: externalOpenOptionsMenu,
  onUpdateCounts,
}) => {
  // Estados internos para cuando el modal se usa de forma independiente
  const [commentText, setCommentText] = useState("")
  const [comments, setComments] = useState<Array<Comment & { user?: User }>>([])
  const [isLoadingComments, setIsLoadingComments] = useState(false)
  const [currentUserData, setCurrentUserData] = useState<User | null>(initialCurrentUserData)
  const [isLoadingCurrentUser, setIsLoadingCurrentUser] = useState(false)
  const [wavesCount, setWavesCount] = useState(initialWavesCount || 0)
  const [commentsCount, setCommentsCount] = useState(initialCommentsCount || 0)
  const [baitsCount, setBaitsCount] = useState(initialBaitsCount || 0)
  const [fishesCount, setFishesCount] = useState(initialFishesCount || 0)
  const [hasBaited, setHasBaited] = useState(initialHasBaited || false)
  const [hasFished, setHasFished] = useState(initialHasFished || false)
  const [isUpdating, setIsUpdating] = useState(
    initialIsUpdating || { fish: false, bait: false, comment: false, wave: false }
  )
  const [isWaveModalVisible, setIsWaveModalVisible] = useState(false)
  
  const commentInputRef = useRef<TextInput>(null)
  const mediaArray = Array.isArray(post.media) ? post.media : post.media ? [post.media] : []
  const hasMedia = mediaArray.length > 0

  // Function to update parent component with current state
  const syncWithParent = () => {
    if (onUpdateCounts) {
      onUpdateCounts({
        wavesCount,
        commentsCount, 
        baitsCount,
        fishesCount,
        hasBaited,
        hasFished
      });
    }
  };

  useEffect(() => {
    if (!visible) {
      syncWithParent();
    }
  }, [visible]);

  useEffect(() => {
    syncWithParent();
  }, [wavesCount, commentsCount, baitsCount, fishesCount, hasBaited, hasFished]);

  useEffect(() => {
    if (initialWavesCount !== undefined) setWavesCount(initialWavesCount);
    if (initialCommentsCount !== undefined) setCommentsCount(initialCommentsCount);
    if (initialBaitsCount !== undefined) setBaitsCount(initialBaitsCount);
    if (initialFishesCount !== undefined) setFishesCount(initialFishesCount);
    if (initialHasBaited !== undefined) setHasBaited(initialHasBaited);
    if (initialHasFished !== undefined) setHasFished(initialHasFished);
  }, [initialWavesCount, initialCommentsCount, initialBaitsCount, initialFishesCount, initialHasBaited, initialHasFished]);

  useEffect(() => {
    const loadCurrentUserData = async () => {
      if (initialCurrentUserData || !currentUserId) return
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
  }, [initialCurrentUserData, currentUserId])

  useEffect(() => {
    const checkUserReactions = async () => {
      if ((initialHasBaited !== undefined && initialHasFished !== undefined) || !currentUserId) return
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
  }, [initialHasBaited, initialHasFished, post.id, currentUserId])

  useEffect(() => {
    if (visible) {
      loadCommentsWithUserInfo()
    }
  }, [visible])



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
      
      const reactionCounts = updatedPost.reactionCounts || {}
      setWavesCount(reactionCounts.wave || 0)
      setBaitsCount(reactionCounts.bait || 0)
      setFishesCount(reactionCounts.fish || 0)

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

  const addComment = async () => {
    if (!commentText.trim() || isUpdating.comment) return
    
    const newIsUpdating = { ...isUpdating, comment: true }
    setIsUpdating(newIsUpdating)
    if (externalSetIsUpdating) externalSetIsUpdating(newIsUpdating)
    
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
      const newCommentsCount = commentsCount + 1;
      setCommentsCount(newCommentsCount)
      setCommentText("")

      if (currentUserId !== post.authorId) {
        await createNotification(
          post.authorId,
          "Comment",
          `@${currentUserData?.username || "Usuario"} comentó en tu publicación`,
          currentUserId,
          post.id,
          newComment.id,
          "/(drawer)/(tabs)/stackhome/post-detail",
          { postId: post.id }
        )
      }
    } catch (error) {
      console.error("Error adding comment:", error)
    } finally {
      const updatedIsUpdating = { ...isUpdating, comment: false }
      setIsUpdating(updatedIsUpdating)
      if (externalSetIsUpdating) externalSetIsUpdating(updatedIsUpdating)
    }
  }

  const toggleBait = async () => {
    if (externalToggleBait) {
      externalToggleBait();
      return;
    }
    
    const newIsUpdating = { ...isUpdating, bait: true }
    setIsUpdating(newIsUpdating)
    if (externalSetIsUpdating) externalSetIsUpdating(newIsUpdating)
    
    try {
      const db = getFirestore()
      const reactionId = `${post.id}_${currentUserId}_Bait`
      const reactionRef = doc(db, "reactions", reactionId)
      const oppositeReactionId = `${post.id}_${currentUserId}_Fish`
      const oppositeReactionRef = doc(db, "reactions", oppositeReactionId)

      const fishQuery = await getDoc(oppositeReactionRef)
      const hasFishedNow = fishQuery.exists() && !fishQuery.data()?.deleted

      if (hasFishedNow) {
        await updateDoc(doc(db, "posts", post.id), {
          "reactionCounts.fish": Math.max(0, fishesCount - 1),
        })
        await updateDoc(oppositeReactionRef, {
          deleted: true,
          updatedAt: new Date().toISOString(),
        })
        setHasFished(false)
        setFishesCount((prev) => Math.max(0, prev - 1))
      }

      if (hasBaited) {
        await updateDoc(doc(db, "posts", post.id), {
          "reactionCounts.bait": Math.max(0, baitsCount - 1),
        })
        await updateDoc(reactionRef, {
          deleted: true,
          updatedAt: new Date().toISOString(),
        })
        setHasBaited(false)
        setBaitsCount((prev) => Math.max(0, prev - 1))
      } else {
        await updateDoc(doc(db, "posts", post.id), {
          "reactionCounts.bait": baitsCount + 1,
        })
        const reaction = {
          id: reactionId,
          postId: post.id,
          userId: currentUserId,
          type: "Bait",
          createdAt: new Date().toISOString(),
        }
        await setDoc(reactionRef, reaction)
        setHasBaited(true)
        setBaitsCount((prev) => prev + 1)

        if (currentUserId !== post.authorId) {
          await createNotification(
            post.authorId,
            "Bait",
            `@${currentUserData?.username || "Usuario"} le dio bait a tu publicación`,
            currentUserId,
            post.id,
            undefined,
            "/(drawer)/(tabs)/stackhome/post-detail",
            { postId: post.id }
          )
        }
      }
    } catch (error) {
      console.error("Error toggling Bait:", error)
      Alert.alert("Error", "No se pudo realizar la acción. Inténtalo de nuevo.")
    } finally {
      const updatedIsUpdating = { ...isUpdating, bait: false }
      setIsUpdating(updatedIsUpdating)
      if (externalSetIsUpdating) externalSetIsUpdating(updatedIsUpdating)
    }
  }

  const toggleFish = async () => {
    if (externalToggleFish) {
      externalToggleFish();
      return;
    }
    
    const newIsUpdating = { ...isUpdating, fish: true }
    setIsUpdating(newIsUpdating)
    if (externalSetIsUpdating) externalSetIsUpdating(newIsUpdating)
    
    try {
      const db = getFirestore()
      const reactionId = `${post.id}_${currentUserId}_Fish`
      const reactionRef = doc(db, "reactions", reactionId)
      const oppositeReactionId = `${post.id}_${currentUserId}_Bait`
      const oppositeReactionRef = doc(db, "reactions", oppositeReactionId)

      const baitQuery = await getDoc(oppositeReactionRef)
      const hasBaitedNow = baitQuery.exists() && !baitQuery.data()?.deleted

      if (hasBaitedNow) {
        await updateDoc(doc(db, "posts", post.id), {
          "reactionCounts.bait": Math.max(0, baitsCount - 1),
        })
        await updateDoc(oppositeReactionRef, {
          deleted: true,
          updatedAt: new Date().toISOString(),
        })
        setHasBaited(false)
        setBaitsCount((prev) => Math.max(0, prev - 1))
      }

      if (hasFished) {
        await updateDoc(doc(db, "posts", post.id), {
          "reactionCounts.fish": Math.max(0, fishesCount - 1),
        })
        await updateDoc(reactionRef, {
          deleted: true,
          updatedAt: new Date().toISOString(),
        })
        setHasFished(false)
        setFishesCount((prev) => Math.max(0, prev - 1))
      } else {
        await updateDoc(doc(db, "posts", post.id), {
          "reactionCounts.fish": fishesCount + 1,
        })
        const reaction = {
          id: reactionId,
          postId: post.id,
          userId: currentUserId,
          type: "Fish",
          createdAt: new Date().toISOString(),
        }
        await setDoc(reactionRef, reaction)
        setHasFished(true)
        setFishesCount((prev) => prev + 1)

        if (currentUserId !== post.authorId) {
          await createNotification(
            post.authorId,
            "Fish",
            `@${currentUserData?.username || "Usuario"} le dio fish a tu publicación`,
            currentUserId,
            post.id,
            undefined,
            "/(drawer)/(tabs)/stackhome/post-detail",
            { postId: post.id }
          )
        }
      }
    } catch (error) {
      console.error("Error toggling Fish:", error)
      Alert.alert("Error", "No se pudo realizar la acción. Inténtalo de nuevo.")
    } finally {
      const updatedIsUpdating = { ...isUpdating, fish: false }
      setIsUpdating(updatedIsUpdating)
      if (externalSetIsUpdating) externalSetIsUpdating(updatedIsUpdating)
    }
  }

  const handleOpenWaveModal = () => {
    onClose() 
  
    setTimeout(() => {
      externalOpenWaveModal?.() 
    }, 300) 
  }

  const handleOpenMediaModal = (index: number) => {
    if (externalOpenMediaModal) {
      externalOpenMediaModal(index);
      return;
    }
    
    if (mediaArray.length > 0) {
      Alert.alert("Vista previa", "Para ver la imagen completa, cierra este modal y abre la publicación", [
        { text: "OK", onPress: () => {} },
      ]);
    }
  }

  const handleOpenOptionsMenu = () => {
    if (externalOpenOptionsMenu) {
      onClose()
      setTimeout(() => {
        externalOpenOptionsMenu()
      }, 300) 
    }
  }

  return (
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.commentsModalContainer}
      >
        <View style={styles.commentsModalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Feather name="arrow-left" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.commentsModalTitle}>Post</Text>
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
            <TouchableOpacity onPress={handleOpenOptionsMenu}>
              <Feather name="more-horizontal" size={24} color="#AAAAAA" />
            </TouchableOpacity>
          </View>

          <View style={styles.postContent}>
            <Text style={styles.postText}>{post.content}</Text>
            {hasMedia && mediaArray.length > 0 && (
              <TouchableOpacity style={styles.mediaPreviewInComments} onPress={() => handleOpenMediaModal(0)}>
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
            <TouchableOpacity style={styles.interactionItem} activeOpacity={0.7} onPress={handleOpenWaveModal}>
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

const { height: screenHeight } = Dimensions.get("window")

const styles = StyleSheet.create({
  
  commentsModalContainer: {
    flex: 1,
    backgroundColor: "#2A3142",
    marginTop: screenHeight * 0.11,
    width: "100%",
    maxWidth: "100%",
    alignSelf: "stretch",
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
    width: Platform.OS === 'web' ? "100%" : "100%",
    maxWidth: Platform.OS === 'web' ? 800 : "100%",
    alignSelf: "center",
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
  mediaPreviewInComments: {
    width: "100%",
    maxWidth: Platform.OS === 'web' ? 800 : "100%",
    height: "auto",
    maxHeight: 400,
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 10,
    position: "relative",
  },
  mediaPreviewImage: {
    width: "100%",
    height: undefined,
    aspectRatio: 16/9,
    maxHeight: 400,
    resizeMode: "cover",
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
  mediaCountText: {
    color: "#FFFFFF",
    fontSize: 14,
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
  interactionText: {
    color: "#FFFFFF",
    marginLeft: 4,
  },
  activeInteractionText: {
    fontWeight: "bold",
    color: "#FFFFFF",
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
  waveModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  waveModalContent: {
    backgroundColor: "#3B4255",
    padding: 20,
    borderRadius: 12,
    width: "80%",
    alignItems: "center",
  },
  waveModalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 10,
  },
  waveModalText: {
    color: "#CCCCCC",
    textAlign: "center",
    marginBottom: 20,
  },
  waveSendButton: {
    backgroundColor: "#4ECDC4",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  waveSendButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
})
export default CommentsModal