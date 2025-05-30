"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  SafeAreaView,
  Platform,
  Alert,
  ScrollView,
  StatusBar,
  Modal,
} from "react-native"
import { useRouter } from "expo-router"
import { useRoute, type RouteProp } from "@react-navigation/native"
import { Feather } from "@expo/vector-icons"
import { doc, getDoc, collection, query, where, getDocs, orderBy, setDoc, deleteDoc } from "firebase/firestore"
import { db } from "../../config/Firebase_Conf"
import { useAuth } from "@/context/AuthContext"
import * as Haptics from "expo-haptics"
import PostItem from "../../components/general/posts"
import { createNotification } from "../../lib/notifications"
import type { User, Post, follows } from "@/app/types/types"

const { width } = Dimensions.get("window")

type TabType = "posts" | "waves" | "media"

const ProfileScreen = () => {
  const route = useRoute<RouteProp<{ params: { userId: string } }, "params">>()
  const router = useRouter()
  const { user: currentUser } = useAuth()

  const userId = route.params?.userId as string

  const [user, setUser] = useState<User | null>(null)
  const [currentUserData, setCurrentUserData] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>("posts")
  const [posts, setPosts] = useState<Post[]>([])
  const [waves, setWaves] = useState<Post[]>([])
  const [media, setMedia] = useState<string[]>([])
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [showImageViewer, setShowImageViewer] = useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [loadedImages, setLoadedImages] = useState<Record<number, boolean>>({})
  const [isScrolling, setIsScrolling] = useState(false)
  const scrollViewRef = useRef<ScrollView>(null)
  const imageContainerWidth = useRef(width).current

  const fetchUserData = useCallback(async () => {
    if (!userId) return

    try {
      setLoading(true)
      const userRef = doc(db, "users", userId)
      const userDoc = await getDoc(userRef)

      if (userDoc.exists()) {
        const userData = userDoc.data() as User
        setUser(userData)

        const followersQuery = query(collection(db, "follows"), where("followingId", "==", userId))
        const followersSnapshot = await getDocs(followersQuery)
        setFollowersCount(followersSnapshot.size)

        const followingQuery = query(collection(db, "follows"), where("followerId", "==", userId))
        const followingSnapshot = await getDocs(followingQuery)
        setFollowingCount(followingSnapshot.size)

        if (currentUser?.uid) {
          const isFollowingQuery = query(
            collection(db, "follows"),
            where("followerId", "==", currentUser.uid),
            where("followingId", "==", userId),
          )
          const isFollowingSnapshot = await getDocs(isFollowingQuery)
          setIsFollowing(!isFollowingSnapshot.empty)
        }
        await fetchUserPosts(userId)
        await fetchUserWaves(userId)
        await fetchUserMedia(userId)
      } else {
        console.log("No user found with ID:", userId)
      }
    } catch (error) {
      console.error("Error fetching user data:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [userId, currentUser?.uid])

  const fetchCurrentUserData = useCallback(async () => {
    if (!currentUser?.uid) return
    try {
      const userRef = doc(db, "users", currentUser.uid)
      const userSnap = await getDoc(userRef)
      if (userSnap.exists()) {
        setCurrentUserData(userSnap.data() as User)
      }
    } catch (error) {
      console.error("Error fetching current user data:", error)
    }
  }, [currentUser?.uid])

  useEffect(() => {
    fetchCurrentUserData()
  }, [fetchCurrentUserData])

  const fetchUserPosts = async (userId: string) => {
    try {
      const postsQuery = query(
        collection(db, "posts"),
        where("authorId", "==", userId),
        where("isWave", "==", false),
        orderBy("createdAt", "desc")
      )
      const postsSnapshot = await getDocs(postsQuery)
      const postsData = postsSnapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }) as Post)
        .filter(post => post.deleted !== true)
      console.log("Fetched posts:", postsData.length) // Debug log
      setPosts(postsData)
    } catch (error) {
      console.error("Error fetching posts:", error)
      // If there's an index error, try without orderBy
      try {
        const fallbackQuery = query(
          collection(db, "posts"),
          where("authorId", "==", userId),
          where("isWave", "==", false)
        )
        const fallbackSnapshot = await getDocs(fallbackQuery)
        const fallbackData = fallbackSnapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }) as Post)
          .filter(post => post.deleted !== true)
        console.log("Fetched posts (fallback):", fallbackData.length) 
        setPosts(fallbackData)
      } catch (fallbackError) {
        console.error("Error in fallback query:", fallbackError)
      }
    }
  }

  const fetchUserWaves = async (userId: string) => {
    try {
      const wavesQuery = query(
        collection(db, "posts"),
        where("authorId", "==", userId),
        where("isWave", "==", true),
        orderBy("createdAt", "desc")
      )
      const wavesSnapshot = await getDocs(wavesQuery)
      const wavesData = wavesSnapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }) as Post)
        .filter(post => post.deleted !== true)
      console.log("Fetched waves:", wavesData.length)
      setWaves(wavesData)
    } catch (error) {
      console.error("Error fetching waves:", error)
      try {
        const fallbackQuery = query(
          collection(db, "posts"),
          where("authorId", "==", userId),
          where("isWave", "==", true)
        )
        const fallbackSnapshot = await getDocs(fallbackQuery)
        const fallbackData = fallbackSnapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }) as Post)
          .filter(post => post.deleted !== true)
        console.log("Fetched waves (fallback):", fallbackData.length)
        setWaves(fallbackData)
      } catch (fallbackError) {
        console.error("Error in fallback query:", fallbackError)
      }
    }
  }

  const fetchUserMedia = async (userId: string) => {
    try {
      const mediaQuery = query(
        collection(db, "posts"),
        where("authorId", "==", userId),
        where("media", "!=", null),
        orderBy("createdAt", "desc")
      )
      const mediaSnapshot = await getDocs(mediaQuery)
      console.log("Fetched media posts:", mediaSnapshot.size)

      const allMedia: string[] = []
      mediaSnapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }) as Post)
        .filter(post => post.deleted !== true)
        .forEach((post) => {
          if (post.media && Array.isArray(post.media)) {
            allMedia.push(...post.media)
          } else if (post.media) {
            allMedia.push(post.media as string)
          }
        })
      console.log("Total media items:", allMedia.length)
      setMedia(allMedia)
    } catch (error) {
      console.error("Error fetching media:", error)
    }
  }

  useEffect(() => {
    fetchUserData()
  }, [fetchUserData])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchUserData()
  }, [fetchUserData])

  const handleTabChange = (tab: TabType) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
    setActiveTab(tab)
  }

  const handleFollowToggle = async () => {
    if (!currentUser?.uid || followLoading || !user) return

    setFollowLoading(true)
    try {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      }

      const followId = `${currentUser.uid}_${userId}`
      const followRef = doc(db, "follows", followId)

      if (isFollowing) {
        await deleteDoc(followRef)
        setIsFollowing(false)
        setFollowersCount((prev) => Math.max(0, prev - 1))
      } else {
        const followData: follows = {
          followerId: currentUser.uid,
          followingId: userId,
          timestamp: new Date().toISOString(),
        }

        await setDoc(followRef, followData)
        setIsFollowing(true)
        setFollowersCount((prev) => prev + 1)

        await createNotification(
          userId,
          "Follow",
          `@${currentUserData?.username || "Usuario"} comenzó a seguirte`,
          currentUser.uid,
          undefined,
          undefined,
          "/(drawer)/(tabs)/stackhome/profile",
          { userId: currentUser.uid },
        )
      }
    } catch (error) {
      console.error("Error toggling follow status:", error)
      Alert.alert(
        "Error",
        isFollowing
          ? "No se pudo dejar de seguir al usuario. Inténtalo de nuevo."
          : "No se pudo seguir al usuario. Inténtalo de nuevo.",
      )

      // Revertir cambios en la UI si hay error
      setIsFollowing((prev) => !prev)
      setFollowersCount((prev) => (isFollowing ? prev + 1 : Math.max(0, prev - 1)))
    } finally {
      setFollowLoading(false)
    }
  }

  const handleInteractionUpdate = (postId: string, type: "Fish" | "Bait", added: boolean) => {
    const updatePosts = (postsList: Post[]) => {
      return postsList.map((post) => {
        if (post.id === postId) {
          const currentCount = post.reactionCounts?.[type.toLowerCase() as keyof typeof post.reactionCounts] || 0
          return {
            ...post,
            reactionCounts: {
              ...post.reactionCounts,
              [type.toLowerCase()]: added ? currentCount + 1 : Math.max(0, currentCount - 1),
            },
          }
        }
        return post
      })
    }

    setPosts(updatePosts(posts))
    setWaves(updatePosts(waves))
  }

  const handlePostDeleted = (postId: string) => {
    setPosts(posts.filter((post) => post.id !== postId))
    setWaves(waves.filter((post) => post.id !== postId))
  }

  const handleOpenMediaModal = (index: number) => {
    if (media.length > 0) {
      setSelectedImageIndex(index)
      setShowImageViewer(true)
    }
  }

  const handlePreviousImage = () => {
    if (selectedImageIndex > 0) {
      setSelectedImageIndex(selectedImageIndex - 1)
    }
  }

  const handleNextImage = () => {
    if (selectedImageIndex < media.length - 1) {
      setSelectedImageIndex(selectedImageIndex + 1)
    }
  }

  const handleImageLoad = (index: number) => {
    setLoadedImages((prev) => ({
      ...prev,
      [index]: true,
    }))
  }

  const closeImageViewer = () => {
    setShowImageViewer(false)
  }

  // Handle scroll events
  const handleScroll = (event: any) => {
    if (isScrolling) return

    const offsetX = event.nativeEvent.contentOffset.x
    const newIndex = Math.round(offsetX / imageContainerWidth)

    if (newIndex !== selectedImageIndex) {
      setSelectedImageIndex(newIndex)
    }
  }

  // Effect for handling scroll when selected index changes
  useEffect(() => {
    if (showImageViewer && scrollViewRef.current && !isScrolling) {
      setIsScrolling(true)
      scrollViewRef.current.scrollTo({
        x: selectedImageIndex * imageContainerWidth,
        animated: true,
      })
      setTimeout(() => {
        setIsScrolling(false)
      }, 300)
    }
  }, [selectedImageIndex, showImageViewer, imageContainerWidth])

  const renderMediaItem = ({ item, index }: { item: string; index: number }) => {
    return (
      <TouchableOpacity
        style={styles.mediaItem}
        onPress={() => handleOpenMediaModal(index)}
      >
        <Image source={{ uri: item }} style={styles.mediaImage} />
      </TouchableOpacity>
    )
  }

  const renderImageViewer = () => {
    return (
      <View style={styles.imageViewerContainer}>
        <View style={styles.imageViewerHeader}>
          <TouchableOpacity onPress={closeImageViewer} style={styles.imageViewerCloseButton}>
            <Feather name="arrow-left" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          {media.length > 1 && (
            <View style={styles.imageViewerPagination}>
              <Feather name="image" size={16} color="#FFFFFF" />
              <Text style={styles.imageViewerPaginationText}>
                {selectedImageIndex + 1}/{media.length}
              </Text>
            </View>
          )}

          <View style={{ width: 40 }} />
        </View>

        <View style={styles.imageViewerContent}>
          <ScrollView
            ref={scrollViewRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleScroll}
            scrollEventThrottle={16}
            contentContainerStyle={styles.scrollViewContent}
          >
            {media.map((uri, index) => (
              <View key={`image-${index}`} style={[styles.imageContainer, { width: imageContainerWidth }]}>
                {!loadedImages[index] && (
                  <View style={styles.imageViewerLoadingContainer}>
                    <ActivityIndicator size="large" color="#FFFFFF" />
                  </View>
                )}
                <Image
                  source={{ uri }}
                  style={styles.imageViewerImage}
                  resizeMode="contain"
                  onLoad={() => handleImageLoad(index)}
                />
              </View>
            ))}
          </ScrollView>

          {media.length > 1 && (
            <>
              {selectedImageIndex > 0 && (
                <TouchableOpacity
                  style={[styles.imageViewerNavButton, styles.imageViewerLeftButton]}
                  onPress={handlePreviousImage}
                >
                  <Feather name="chevron-left" size={30} color="#FFFFFF" />
                </TouchableOpacity>
              )}

              {selectedImageIndex < media.length - 1 && (
                <TouchableOpacity
                  style={[styles.imageViewerNavButton, styles.imageViewerRightButton]}
                  onPress={handleNextImage}
                >
                  <Feather name="chevron-right" size={30} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>
    )
  }

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingText}>Cargando perfil...</Text>
      </SafeAreaView>
    )
  }

  return (
    <View style={styles.bigcontainer}>
      <SafeAreaView style={styles.container}>
        <FlatList
          data={activeTab === "posts" ? posts : activeTab === "waves" ? waves : []}
          renderItem={({ item }) =>
            user && (
              <View style={{ marginTop: 16 }}>
                <PostItem
                  user={user}
                  post={item}
                  currentUserId={currentUser?.uid || ""}
                  onInteractionUpdate={handleInteractionUpdate}
                  onPostDeleted={handlePostDeleted}
                />
              </View>
            )
          }
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ flexGrow: 1 }}
          style={{ flex: 1 }}
          ListHeaderComponent={
            <>
              <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                  <Feather name="arrow-left" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              <View style={styles.profileHeader}>
                <Image
                  source={{ uri: user?.profilePicture || "https://via.placeholder.com/100" }}
                  style={styles.profileImage}
                />
                <Text style={styles.username}>@{user?.username || "@Usuario"}</Text>
                <Text style={styles.description}>{user?.bio || "Sin descripción"}</Text>

                {currentUser?.uid === userId && (
                  <TouchableOpacity
                    style={styles.editProfileButton}
                    onPress={() => {
                      // TODO: Implement edit profile navigation
                      router.push("/(drawer)/(tabs)/stacksettings/edit-profile")
                    }}
                  >
                    <Text style={styles.editProfileButtonText}>Editar Perfil</Text>
                  </TouchableOpacity>
                )}

                {currentUser?.uid !== userId && (
                  <TouchableOpacity
                    style={[styles.followButton, isFollowing ? styles.followingButton : {}]}
                    onPress={handleFollowToggle}
                    disabled={followLoading}
                  >
                    {followLoading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.followButtonText}>{isFollowing ? "Siguiendo" : "Seguir"}</Text>
                    )}
                  </TouchableOpacity>
                )}

                <View style={styles.statsContainer}>
                  <TouchableOpacity
                    style={styles.statItem}
                    onPress={() =>
                      router.push({
                        pathname: "/(drawer)/(tabs)/stackhome/followers",
                        params: { userId: userId, type: "followers" },
                      })
                    }
                  >
                    <Text style={styles.statValue}>{followersCount}</Text>
                    <Text style={styles.statLabel}>Seguidores</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.statItem}
                    onPress={() =>
                      router.push({
                        pathname: "/(drawer)/(tabs)/stackhome/followers",
                        params: { userId: userId, type: "following" },
                      })
                    }
                  >
                    <Text style={styles.statValue}>{followingCount}</Text>
                    <Text style={styles.statLabel}>Siguiendo</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.tabsContainer}>
                <TouchableOpacity
                  style={[styles.tab, activeTab === "posts" && styles.activeTab]}
                  onPress={() => handleTabChange("posts")}
                >
                  <Text style={[styles.tabText, activeTab === "posts" && styles.activeTabText]}>Posts</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.tab, activeTab === "waves" && styles.activeTab]}
                  onPress={() => handleTabChange("waves")}
                >
                  <Text style={[styles.tabText, activeTab === "waves" && styles.activeTabText]}>Waves</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.tab, activeTab === "media" && styles.activeTab]}
                  onPress={() => handleTabChange("media")}
                >
                  <Text style={[styles.tabText, activeTab === "media" && styles.activeTabText]}>Media</Text>
                </TouchableOpacity>
              </View>
            </>
          }
          ListEmptyComponent={
            activeTab === "media" ? (
              <View style={{ flex: 1 }}>
                <FlatList
                  data={media}
                  renderItem={renderMediaItem}
                  keyExtractor={(item, index) => `media_${index}`}
                  numColumns={3}
                  contentContainerStyle={styles.mediaGrid}
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyText}>No hay contenido para mostrar</Text>
                    </View>
                  }
                />
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No hay contenido para mostrar</Text>
              </View>
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#FFFFFF"]}
              tintColor="#FFFFFF"
              progressBackgroundColor="#3A4154"
            />
          }
        />
      </SafeAreaView>

      <Modal
        visible={showImageViewer}
        transparent={true}
        animationType="fade"
        onRequestClose={closeImageViewer}
      >
        <SafeAreaView style={styles.modalContainer}>
          {renderImageViewer()}
        </SafeAreaView>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  bigcontainer: {
    flex: 1,
    backgroundColor: "#2A3142",
    height: '100%',
  },
  container: {
    flex: 1,
    backgroundColor: "#2A3142",
    width: Platform.OS === 'web' ? "100%" : "100%",
    maxWidth: Platform.OS === 'web' ? 800 : "100%",    
    alignSelf: "center",
    height: Platform.OS === 'web' ? '100%' : '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#2A3142",
  },
  loadingText: {
    color: "#FFFFFF",
    marginTop: 12,
    fontSize: 16,
  },
  header: {
    position: "absolute",
    top: 20,
    left: 20,
    zIndex: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  profileHeader: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: "#3C4255",
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#D9D9D9",
  },
  username: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginTop: 12,
  },
  description: {
    fontSize: 14,
    color: "#D9D9D9",
    marginTop: 8,
    textAlign: "center",
    paddingHorizontal: 32,
  },
  editProfileButton: {
    backgroundColor: "#5269eb",
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 20,
    marginTop: 32,
  },
  editProfileButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },
  followButton: {
    backgroundColor: "#8BB9FE",
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 20,
  },
  followingButton: {
    backgroundColor: "#4C5366",
  },
  followButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },
  statsContainer: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-around",
    marginTop: 8,
  },
  statItem: {
    alignItems: "center",
    padding: 10,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  statLabel: {
    fontSize: 14,
    color: "#D9D9D9",
    marginTop: 4,
  },
  tabsContainer: {
    flexDirection: "row",
    backgroundColor: "#3C4255",
    borderBottomWidth: 1,
    borderBottomColor: "#4C5366",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 16,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: "#8BB9FE",
  },
  tabText: {
    fontSize: 16,
    color: "#D9D9D9",
  },
  activeTabText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  mediaGrid: {
    padding: 100,
    maxWidth: Platform.OS === 'web' ? 800 : "100%",
    flexGrow: 1,
  },
  mediaItem: {
    width: Platform.OS === "web"? 270 :(width) / 3,
    height: Platform.OS === "web"? 270 :(width) / 3,
    margin: 2,
  },
  mediaImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#4C5366",
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    color: "#D9D9D9",
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#000000",
  },
  imageViewerContainer: {
    flex: 1,
    backgroundColor: "#000000",
  },
  imageViewerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  imageViewerCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  imageViewerPagination: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  imageViewerPaginationText: {
    color: "#FFFFFF",
    marginLeft: 8,
    fontWeight: "600",
    fontSize: 16,
  },
  imageViewerContent: {
    flex: 1,
    position: "relative",
  },
  scrollViewContent: {
    flexGrow: 1,
    alignItems: "center",
  },
  imageContainer: {
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  imageViewerImage: {
    width: "100%",
    height: "80%",
    resizeMode: "contain",
  },
  imageViewerLoadingContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 5,
  },
  imageViewerNavButton: {
    position: "absolute",
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  imageViewerLeftButton: {
    left: 20,
    top: "50%",
    marginTop: -25,
  },
  imageViewerRightButton: {
    right: 20,
    top: "50%",
    marginTop: -25,
  },
})

export default ProfileScreen
