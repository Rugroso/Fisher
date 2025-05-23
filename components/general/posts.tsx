"use client"

import { useState, useEffect } from "react"
import { View, Text, Image, TouchableOpacity, StyleSheet, Platform } from "react-native"
import { Feather, FontAwesome, MaterialCommunityIcons } from "@expo/vector-icons"
import { doc, updateDoc, getFirestore, getDoc, setDoc } from "firebase/firestore"
import type { User, Post, ReactionType } from "../../app/types/types"
import * as Haptics from "expo-haptics"
import { useRouter } from "expo-router"
import { createNotification } from "../../lib/notifications"

import OptionsMenuModal from "../posts/options-menu-modal"
import MediaModal from "../posts/media-modal"
import CommentsModal from "../posts/comments-modal"
import WaveModal from "../posts/wave-modal"

import { WaveIcon, CommentIcon, HookIcon, FishIcon } from "../posts/interaction-icons"

interface PostItemProps {
  user: User
  post: Post
  currentUserId: string
  onInteractionUpdate?: (postId: string, type: "Fish" | "Bait", added: boolean) => void
  onPostDeleted?: (postId: string) => void
  onPostSaved?: (postId: string, saved: boolean) => void
}

const PostItem = ({ user, post, currentUserId, onInteractionUpdate, onPostDeleted, onPostSaved }: PostItemProps) => {
  const router = useRouter()
  const [optionsMenuVisible, setOptionsMenuVisible] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const [mediaModalVisible, setMediaModalVisible] = useState(false)
  const [commentsModalVisible, setCommentsModalVisible] = useState(false)
  const [waveModalVisible, setWaveModalVisible] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  const [isUpdating, setIsUpdating] = useState<{ fish: boolean; bait: boolean; comment: boolean; wave: boolean }>({
    fish: false,
    bait: false,
    comment: false,
    wave: false,
  })
  const [isWaving, setIsWaving] = useState(false)

  const [hasFished, setHasFished] = useState(false)
  const [hasBaited, setHasBaited] = useState(false)
  const [wavesCount, setWavesCount] = useState(post.reactionCounts.wave || 0)
  const [commentsCount, setCommentsCount] = useState(post.commentCount || 0)
  const [baitsCount, setBaitsCount] = useState(post.reactionCounts.bait || 0)
  const [fishesCount, setFishesCount] = useState(post.reactionCounts.fish || 0)

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

  const [currentUserData, setCurrentUserData] = useState<User | null>(null)
  const [isLoadingCurrentUser, setIsLoadingCurrentUser] = useState(false)

  const [originalPost, setOriginalPost] = useState<Post | null>(null)
  const [originalUser, setOriginalUser] = useState<User | null>(null)
  const [isLoadingOriginalPost, setIsLoadingOriginalPost] = useState(false)

  const mediaArray = Array.isArray(post.media) ? post.media : post.media ? [post.media] : []
  const hasMedia = mediaArray.length > 0

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

  useEffect(() => {
    const loadOriginalPost = async () => {
      if (!post.isWave || !post.waveOf) return

      setIsLoadingOriginalPost(true)
      try {
        const db = getFirestore()
        const originalPostDoc = await getDoc(doc(db, "posts", post.waveOf))

        if (originalPostDoc.exists()) {
          const originalPostData = originalPostDoc.data() as Post
          setOriginalPost(originalPostData)

          const originalUserDoc = await getDoc(doc(db, "users", originalPostData.authorId))
          if (originalUserDoc.exists()) {
            setOriginalUser(originalUserDoc.data() as User)
          }
        }
      } catch (error) {
        console.error("Error al cargar el post original:", error)
      } finally {
        setIsLoadingOriginalPost(false)
      }
    }

    loadOriginalPost()
  }, [post.isWave, post.waveOf])

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

  const openWaveModal = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    }
    setWaveModalVisible(true)
  }

  const openOptionsMenu = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
    setOptionsMenuVisible(true)
  }

  const openProfile = (userId: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
    router.push({
      pathname: "/(drawer)/(tabs)/stackhome/profile",
      params: { userId: userId },
    })
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

        if (post.authorId !== currentUserId) {
          const notificationType = type === "Fish" ? "Fish" : "Bait"
          await createNotification(
            post.authorId,
            notificationType,
            `@${currentUserData?.username || "Usuario"} interactuó con tu publicación`,
            currentUserId,
            post.id,
            undefined,
            undefined,
            undefined
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

  // Renderizar el post original si es un wave
  const renderOriginalPost = () => {
    if (!post.isWave || !originalPost || !originalUser) return null

    const originalMediaArray = Array.isArray(originalPost.media)
      ? originalPost.media
      : originalPost.media
        ? [originalPost.media]
        : []

    const hasOriginalMedia = originalMediaArray.length > 0

    return (
      <View style={styles.originalPostWrapper}>
        <TouchableOpacity style={styles.originalPostHeader} onPress={() => openProfile(originalUser.id)}>
          {originalUser.profilePicture ? (
            <Image source={{ uri: originalUser.profilePicture }} style={styles.originalPostAvatar} />
          ) : (
            <View style={[styles.originalPostAvatar, styles.avatarPlaceholder]} />
          )}
          <Text style={styles.originalPostUsername}>@{originalUser.username}</Text>
        </TouchableOpacity>

        <View style={styles.originalPostContent}>
          <Text style={styles.originalPostText}>{originalPost.content}</Text>

          {hasOriginalMedia && originalMediaArray.length > 0 && (
            <TouchableOpacity
              style={styles.originalPostMediaPreview}
              onPress={() => {
                // Aquí podrías implementar la visualización del media del post original
              }}
            >
              <Image source={{ uri: originalMediaArray[0] }} style={styles.originalPostMediaImage} />
              {originalMediaArray.length > 1 && (
                <View style={styles.originalPostMediaBadge}>
                  <Text style={styles.originalPostMediaCount}>+{originalMediaArray.length - 1}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    )
  }

  return (
    <TouchableOpacity style={styles.postContainer} onPress={() => openCommentsModal()} activeOpacity={0.8}>
      {post.isWave && (
        <View style={styles.waveIndicator}>
          <MaterialCommunityIcons name="waves" size={16} color="#4A6FFF" />
          <Text style={styles.waveIndicatorText}>Wave por @{user.username}</Text>
        </View>
      )}

      <View style={styles.postHeader}>
        <TouchableOpacity style={styles.userInfo} onPress={() => openProfile(user.id)}>
          {user.profilePicture ? (
            <Image source={{ uri: user.profilePicture }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]} />
          )}
          <Text style={styles.username}>@{user.username}</Text>
        </TouchableOpacity>
        <View style={styles.headerActions}>
          {isSaved && <FontAwesome name="bookmark" size={20} color="#ffd700" style={styles.savedIcon} />}
          <TouchableOpacity onPress={openOptionsMenu} activeOpacity={0.7}>
            <Feather name="more-horizontal" size={24} color="#AAAAAA" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.postContent}>
        {post.content && <Text style={styles.postText}>{post.content}</Text>}

        {post.isWave && renderOriginalPost()}

        {!post.isWave && renderMediaPreview()}
      </View>

      <View style={styles.interactionsContainer}>
        <TouchableOpacity style={styles.interactionItem} activeOpacity={0.7} onPress={openWaveModal}>
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

      <OptionsMenuModal
        visible={optionsMenuVisible}
        onClose={() => setOptionsMenuVisible(false)}
        post={post}
        authorId={post.authorId}
        currentUserId={currentUserId}
        isSaved={isSaved}
        isSaving={isSaving}
        setIsSaved={setIsSaved}
        setIsSaving={setIsSaving}
        onPostDeleted={() => onPostDeleted?.(post.id)}
        onPostSaved={onPostSaved}
      />

      <MediaModal
        visible={mediaModalVisible}
        onClose={() => setMediaModalVisible(false)}
        mediaArray={mediaArray}
        initialIndex={currentIndex}
      />

        <CommentsModal
          visible={commentsModalVisible}
          onClose={() => setCommentsModalVisible(false)}
          post={post}
          user={user}
          currentUserId={currentUserId}
          currentUserData={currentUserData}
          wavesCount={wavesCount}
          commentsCount={commentsCount}
          baitsCount={baitsCount}
          fishesCount={fishesCount}
          hasBaited={hasBaited}
          hasFished={hasFished}
          isUpdating={isUpdating}
          setIsUpdating={setIsUpdating}
          toggleBait={toggleBait}
          toggleFish={toggleFish}
          openWaveModal={openWaveModal}
          openMediaModal={openMediaModal}
          openOptionsMenu={openOptionsMenu}
          onUpdateCounts={handleCountsUpdate} 
        />

      <WaveModal
        visible={waveModalVisible}
        onClose={() => setWaveModalVisible(false)}
        post={post}
        user={user}
        currentUserId={currentUserId}
        currentUserData={currentUserData}
        isWaving={isWaving}
        setIsWaving={setIsWaving}
        setWavesCount={setWavesCount}
      />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  postContainer: {
    borderBottomWidth: 1,
    borderRadius: 12,
    shadowColor: "#000000",
    shadowOffset: {
      width: 3,
      height: 3,
    },
    shadowOpacity: 0.4,
    shadowRadius: 1.41,
    elevation: 2,
    backgroundColor: "#3B4255",
    borderColor: "#5B5B5B",
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
  interactionText: {
    color: "#FFFFFF",
  },
  activeInteractionText: {
    fontWeight: "bold",
  },
  // Estilos para el indicador de wave
  waveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 0,
  },
  waveIndicatorText: {
    color: "#4A6FFF",
    fontSize: 12,
    marginLeft: 4,
  },
  // Estilos para el post original dentro de un wave
  originalPostWrapper: {
    backgroundColor: "#2A3142",
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#4A6FFF30",
  },
  originalPostHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  originalPostAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#DDDDDD",
  },
  originalPostUsername: {
    color: "#FFFFFF",
    fontWeight: "500",
    fontSize: 13,
    marginLeft: 8,
  },
  originalPostContent: {
    marginLeft: 32,
  },
  originalPostText: {
    color: "#FFFFFF",
    fontSize: 13,
    marginBottom: 8,
  },
  originalPostMediaPreview: {
    height: 120,
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 4,
  },
  originalPostMediaImage: {
    width: "100%",
    height: "100%",
  },
  originalPostMediaBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  originalPostMediaCount: {
    color: "#FFFFFF",
    fontSize: 12,
  },
})

export default PostItem
