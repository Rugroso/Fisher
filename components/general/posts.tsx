"use client"

import { useState, useEffect, useRef } from "react"
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  Dimensions,
  StatusBar,
  Modal,
  ActivityIndicator,
  Alert
} from "react-native"
import { Feather, FontAwesome, MaterialCommunityIcons } from "@expo/vector-icons"
import { doc, updateDoc, getFirestore, getDoc, setDoc } from "firebase/firestore"
import type { User, Post, ReactionType } from "../../app/types/types"
import * as Haptics from "expo-haptics"
import { useRouter } from "expo-router"
import { createNotification } from "../../lib/notifications"
import { formatTimeAgo } from "../../lib/time-utils"

import OptionsMenuModal from "../posts/options-menu-modal"
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
  fishtank?: { name: string, fishTankPicture?: string }
  onRefreshPost?: (postId: string) => void
}

const { width: screenWidth } = Dimensions.get("window")

const PostItem = ({ user, post, currentUserId, onInteractionUpdate, onPostDeleted, onPostSaved, fishtank, onRefreshPost }: PostItemProps) => {
  const router = useRouter()
  const [optionsMenuVisible, setOptionsMenuVisible] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

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
    if (onRefreshPost) onRefreshPost(post.id)
  }

  const [currentUserData, setCurrentUserData] = useState<User | null>(null)
  const [isLoadingCurrentUser, setIsLoadingCurrentUser] = useState(false)

  const [originalPost, setOriginalPost] = useState<Post | null>(null)
  const [originalUser, setOriginalUser] = useState<User | null>(null)
  const [isLoadingOriginalPost, setIsLoadingOriginalPost] = useState(false)

  const [mediaArray, setMediaArray] = useState<Array<string>>([])
  const [originalMediaArray, setOriginalMediaArray] = useState<Array<string>>([])

  const hasMedia = mediaArray.length > 0

  const [mediaViewerVisible, setMediaViewerVisible] = useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [loadedImages, setLoadedImages] = useState<Record<number, boolean>>({})
  const [isScrolling, setIsScrolling] = useState(false)

  const scrollViewRef = useRef<ScrollView>(null)

  const handleImageLoad = (index: number) => {
    setLoadedImages((prev) => ({
      ...prev,
      [index]: true,
    }))
  }

  const handlePreviousImage = () => {
    if (selectedImageIndex > 0) {
      setSelectedImageIndex(selectedImageIndex - 1)
    }
  }

  const handleNextImage = () => {
    if (selectedImageIndex < mediaArray.length - 1) {
      setSelectedImageIndex(selectedImageIndex + 1)
    }
  }

  const handleScroll = (event: any) => {
    if (isScrolling) return

    const offsetX = event.nativeEvent.contentOffset.x
    const newIndex = Math.round(offsetX / screenWidth)

    if (newIndex !== selectedImageIndex) {
      setSelectedImageIndex(newIndex)
    }
  }

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

  useEffect(() => {
    const postMediaArray = Array.isArray(post.media) ? post.media : post.media ? [post.media] : []
    setMediaArray(postMediaArray)
  }, [post.media])

  useEffect(() => {
    if (originalPost) {
      const media = Array.isArray(originalPost.media)
        ? originalPost.media
        : originalPost.media
          ? [originalPost.media]
          : []
      setOriginalMediaArray(media)
    }
  }, [originalPost])

  const isVideoUrl = (url: string) => {
    return url.includes(".mp4") || url.includes(".mov") || url.includes(".avi") || url.includes("video")
  }

  const openMediaModal = (index: number) => {
    setSelectedImageIndex(index)
    setMediaViewerVisible(true)
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

      // Determinar la colección correcta basada en si el post tiene fishtankId
      const collectionName = post.fishtankId ? "fishtank_posts" : "posts"
      const postRef = doc(db, collectionName, post.id)
      const postDoc = await getDoc(postRef)
      
      if (!postDoc.exists()) {
        Alert.alert("Error", "La publicación ya no existe")
        return
      }

      if (hasOppositeReaction) {
        const oppositeReactionId = `${post.id}_${currentUserId}_${oppositeType}`
        const oppositeReactionRef = doc(db, "reactions", oppositeReactionId)

        await updateDoc(postRef, {
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
        await updateDoc(postRef, {
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
        await updateDoc(postRef, {
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
            undefined,
          )
        }
      }
    } catch (error) {
      console.error(`Error toggling ${type}:`, error)
      Alert.alert("Error", "No se pudo realizar la acción. Inténtalo de nuevo.")
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

  const openOriginalMediaModal = (index: number) => {
    if (originalMediaArray.length > 0) {
      setSelectedImageIndex(index)
      setMediaViewerVisible(true)
      // Set the media array to the original post's media
      setMediaArray(originalMediaArray)
    }
  }

  const closeMediaViewer = () => {
    setMediaViewerVisible(false)
    // Reset media array to current post's media
    const postMediaArray = Array.isArray(post.media) ? post.media : post.media ? [post.media] : []
    setMediaArray(postMediaArray)
  }

  const renderOriginalPost = () => {
    if (!post.isWave || !originalPost || !originalUser) return null

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
              onPress={() => openOriginalMediaModal(0)}
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

  // Renderizar info de la pecera si existe
  const renderFishtankInfo = () => {
    if (!fishtank) return null
    return (
      <View style={styles.fishtankInfoContainer}>
        <View style={styles.fishtankImageWrapper}>
          {fishtank.fishTankPicture ? (
            <Image source={{ uri: fishtank.fishTankPicture }} style={styles.fishtankImage} />
          ) : (
            <View style={[styles.fishtankImage, styles.fishtankImagePlaceholder]} />
          )}
        </View>
        <View style={styles.fishtankTextContainer}>
          <Text style={styles.fishtankName}>{fishtank.name}</Text>
          <Text style={styles.fishtankSubtitle}>Pecera</Text>
        </View>
      </View>
    )
  }

  useEffect(() => {
    if (mediaViewerVisible && scrollViewRef.current && !isScrolling) {
      setIsScrolling(true)
      scrollViewRef.current.scrollTo({
        x: selectedImageIndex * screenWidth,
        animated: true,
      })

      setTimeout(() => {
        setIsScrolling(false)
      }, 300)
    }
  }, [selectedImageIndex, mediaViewerVisible, screenWidth])

  return (
    <TouchableOpacity style={styles.postContainer} onPress={() => openCommentsModal()} activeOpacity={0.8}>
      {renderFishtankInfo()}
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
          <View style={styles.userInfoText}>
            <Text style={styles.username}>@{user.username}</Text>
            <Text style={styles.postDate}>{formatTimeAgo(post.createdAt)}</Text>
          </View>
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

      {/* Visor de imágenes integrado */}
      <Modal
        visible={mediaViewerVisible}
        transparent
        animationType="fade"
        onRequestClose={closeMediaViewer}
      >
        <StatusBar backgroundColor="#000000" barStyle="light-content" />
        <View style={styles.mediaViewerContainer}>
          <View style={styles.mediaViewerHeader}>
            <TouchableOpacity onPress={closeMediaViewer} style={styles.mediaViewerCloseButton}>
              <Feather name="x" size={24} color="#FFFFFF" />
            </TouchableOpacity>

            {mediaArray.length > 1 && (
              <View style={styles.mediaViewerPagination}>
                <Feather name="image" size={16} color="#FFFFFF" />
                <Text style={styles.mediaViewerPaginationText}>
                  {selectedImageIndex + 1}/{mediaArray.length}
                </Text>
              </View>
            )}

            <View style={{ width: 40 }} />
          </View>

          <View style={styles.mediaViewerContent}>
            <ScrollView
              ref={scrollViewRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleScroll}
              scrollEventThrottle={16}
              contentContainerStyle={styles.mediaViewerScrollContent}
            >
              {mediaArray.map((uri, index) => (
                <View key={`image-${index}`} style={[styles.mediaViewerImageContainer, { width: screenWidth }]}>
                  {!loadedImages[index] && (
                    <View style={styles.mediaViewerLoadingContainer}>
                      <ActivityIndicator size="large" color="#FFFFFF" />
                    </View>
                  )}

                  {isVideoUrl(uri) ? (
                    <View style={styles.mediaViewerVideoContainer}>
                      <Image
                        source={{ uri: uri.replace(".mp4", ".jpg").replace(".mov", ".jpg") }}
                        style={styles.mediaViewerImage}
                        resizeMode="contain"
                        onLoad={() => handleImageLoad(index)}
                      />
                      <View style={styles.mediaViewerPlayIconOverlay}>
                        <Feather name="play" size={50} color="#FFFFFF" />
                      </View>
                    </View>
                  ) : (
                    <Image
                      source={{ uri }}
                      style={styles.mediaViewerImage}
                      resizeMode="contain"
                      onLoad={() => handleImageLoad(index)}
                    />
                  )}
                </View>
              ))}
            </ScrollView>

            {mediaArray.length > 1 && (
              <>
                {selectedImageIndex > 0 && (
                  <TouchableOpacity
                    style={[styles.mediaViewerNavButton, styles.mediaViewerLeftButton]}
                    onPress={handlePreviousImage}
                  >
                    <Feather name="chevron-left" size={30} color="#FFFFFF" />
                  </TouchableOpacity>
                )}

                {selectedImageIndex < mediaArray.length - 1 && (
                  <TouchableOpacity
                    style={[styles.mediaViewerNavButton, styles.mediaViewerRightButton]}
                    onPress={handleNextImage}
                  >
                    <Feather name="chevron-right" size={30} color="#FFFFFF" />
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>
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
    width: Platform.OS === "web" ? "100%" : "100%",
    maxWidth: Platform.OS === "web" ? 800 : "100%",
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
  userInfoText: {
    marginLeft: 10,
  },
  postDate: {
    color: "#AAAAAA",
    fontSize: 12,
    marginTop: 2,
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
  fishtankInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#23283A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#3A4154',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 2,
  },
  fishtankImageWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#8BB9FE',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2A3142',
    marginRight: 12,
  },
  fishtankImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4A6FFF',
  },
  fishtankImagePlaceholder: {
    backgroundColor: '#4A6FFF55',
  },
  fishtankTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  fishtankName: {
    color: '#8BB9FE',
    fontWeight: 'bold',
    fontSize: 17,
    marginBottom: 2,
  },
  fishtankSubtitle: {
    color: '#B0B8D1',
    fontSize: 13,
    fontWeight: '500',
  },
  mediaViewerContainer: {
    flex: 1,
    backgroundColor: "#000000",
  },
  mediaViewerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight || 16 : 16,
  },
  mediaViewerCloseButton: {
    position: "absolute",
    top: 64,
    left: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(17, 11, 11, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 20,
  },  
  mediaViewerPagination: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  mediaViewerPaginationText: {
    color: "#FFFFFF",
    marginLeft: 8,
    fontWeight: "500",
  },
  mediaViewerContent: {
    flex: 1,
    position: "relative",
  },
  mediaViewerScrollContent: {
    flexGrow: 1,
    alignItems: "center",
  },
  mediaViewerImageContainer: {
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  mediaViewerImage: {
    width: "100%",
    height: "80%",
    resizeMode: "contain",
  },
  mediaViewerLoadingContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 5,
  },
  mediaViewerVideoContainer: {
    width: "100%",
    height: "80%",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  mediaViewerPlayIconOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  mediaViewerNavButton: {
    position: "absolute",
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  mediaViewerLeftButton: {
    left: 16,
    top: "50%",
    marginTop: -25,
  },
  mediaViewerRightButton: {
    right: 16,
    top: "50%",
    marginTop: -25,
  },
})

export default PostItem
