"use client"

import { useState, useEffect, useCallback } from "react"
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
} from "react-native"
import { useRouter } from "expo-router"
import { useRoute, type RouteProp } from "@react-navigation/native"
import { Feather } from "@expo/vector-icons"
import { doc, getDoc, collection, query, where, getDocs, orderBy } from "firebase/firestore"
import { db } from "../../config/Firebase_Conf"
import { useAuth } from "@/context/AuthContext"
import * as Haptics from "expo-haptics"
import PostItem from "../../components/general/posts"
import type { User, Post } from "@/app/types/types"

const { width } = Dimensions.get("window")

type TabType = "posts" | "waves" | "media"

const ProfileScreen = () => {
  const route = useRoute<RouteProp<{ params: { userId: string } }, "params">>()
  const router = useRouter()
  const { user: currentUser } = useAuth()

  const userId = route.params?.userId as string

  const [user, setUser] = useState<User | null>(null)
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

  const fetchUserPosts = async (userId: string) => {
    try {
      const postsQuery = query(collection(db, "posts"), where("authorId", "==", userId), orderBy("createdAt", "desc"))
      const postsSnapshot = await getDocs(postsQuery)
      const postsData = postsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Post)
      setPosts(postsData)
    } catch (error) {
      console.error("Error fetching posts:", error)
    }
  }

  // Fetch user waves (posts with wave type)
  const fetchUserWaves = async (userId: string) => {
    try {
      const wavesQuery = query(
        collection(db, "posts"),
        where("authorId", "==", userId),
        where("type", "==", "wave"),
        // orderBy("createdAt", "desc"),
      )
      const wavesSnapshot = await getDocs(wavesQuery)
      const wavesData = wavesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Post)
      setWaves(wavesData)
    } catch (error) {
      console.error("Error fetching waves:", error)
    }
  }

  const fetchUserMedia = async (userId: string) => {
    try {
      const mediaQuery = query(collection(db, "posts"), where("authorId", "==", userId), where("media", "!=", null))
      const mediaSnapshot = await getDocs(mediaQuery)

      const allMedia: string[] = []
      mediaSnapshot.docs.forEach((doc) => {
        const post = doc.data() as Post
        if (post.media && Array.isArray(post.media)) {
          allMedia.push(...post.media)
        } else if (post.media) {
          allMedia.push(post.media as string)
        }
      })

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
    if (!currentUser?.uid || followLoading) return

    setFollowLoading(true)
    try {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      }

      setIsFollowing(!isFollowing)
      setFollowersCount((prev) => (isFollowing ? prev - 1 : prev + 1))
    } catch (error) {
      console.error("Error toggling follow status:", error)
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

  const renderMediaItem = ({ item, index }: { item: string; index: number }) => {
    return (
      <TouchableOpacity
        style={styles.mediaItem}
        onPress={() => {
        }}
      >
        <Image source={{ uri: item }} style={styles.mediaImage} />
      </TouchableOpacity>
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
    <SafeAreaView style={styles.container}>
    <View style={{ marginVertical: 16 }}>
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
                <TouchableOpacity style={styles.statItem}>
                  <Text style={styles.statValue}>{followersCount}</Text>
                  <Text style={styles.statLabel}>Seguidores</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.statItem}>
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
      </View>
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
  followButton: {
    backgroundColor: "#8BB9FE",
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 20,
    marginTop: 16,
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
    marginTop: 24,
  },
  statItem: {
    alignItems: "center",
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
    padding: 4,
  },
  mediaItem: {
    width: (width - 24) / 3,
    height: (width - 24) / 3,
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
})

export default ProfileScreen
