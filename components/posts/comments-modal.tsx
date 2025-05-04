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
  wavesCount: number
  commentsCount: number
  baitsCount: number
  fishesCount: number
  hasBaited: boolean
  hasFished: boolean
  isUpdating: { fish: boolean; bait: boolean; comment: boolean; wave: boolean }
  setIsUpdating: React.Dispatch<React.SetStateAction<{ fish: boolean; bait: boolean; comment: boolean; wave: boolean }>>
  toggleBait: () => void
  toggleFish: () => void
  openWaveModal: () => void
  openMediaModal: (index: number) => void
}

const CommentsModal: React.FC<CommentsModalProps> = ({
  visible,
  onClose,
  post,
  user,
  currentUserId,
  currentUserData,
  wavesCount,
  commentsCount,
  baitsCount,
  fishesCount,
  hasBaited,
  hasFished,
  isUpdating,
  setIsUpdating,
  toggleBait,
  toggleFish,
  openWaveModal,
  openMediaModal,
}) => {
  const [commentText, setCommentText] = useState("")
  const [comments, setComments] = useState<Array<Comment & { user?: User }>>([])
  const [isLoadingComments, setIsLoadingComments] = useState(false)
  const commentInputRef = useRef<TextInput>(null)

  const mediaArray = Array.isArray(post.media) ? post.media : post.media ? [post.media] : []
  const hasMedia = mediaArray.length > 0

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
                  onClose()
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
            <TouchableOpacity style={styles.interactionItem} activeOpacity={0.7} onPress={openWaveModal}>
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
  },
  activeInteractionText: {
    fontWeight: "bold",
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

export default CommentsModal
