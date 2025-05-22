"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Platform,
  Image,
  StatusBar,
} from "react-native"
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  arrayUnion,
  getDoc,
  orderBy,
  limit,
  startAfter,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore"
import { db } from "../../../../config/Firebase_Conf"
import { Feather } from "@expo/vector-icons"
import PostItem from "@/components/general/posts"
import { useAuth } from "@/context/AuthContext"
import * as Notifications from "expo-notifications"
import * as Device from "expo-device"
import Constants from "expo-constants"
import type { User, Post, follows } from "../../../types/types"
import { useNavigation, useRouter } from "expo-router"
import { DrawerActions } from "@react-navigation/native"
import * as Haptics from "expo-haptics"

// Importar el servicio de notificaciones
import { getUnreadNotificationsCount, markAllNotificationsAsRead } from "../../../../lib/notifications"

// Define a type for the combined post and user data
interface PostWithUser {
  user: User
  post: Post
  key: string
}

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

const POSTS_PER_PAGE = 10

// Función para generar un ID aleatorio
const generateRandomId = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

const FeedScreen = () => {
  const router = useRouter()
  const [users, setUsers] = useState<Record<string, User>>({})
  const [loading, setLoading] = useState({
    trending: true,
    following: true,
    fishtanks: true,
  })
  const [refreshing, setRefreshing] = useState({
    trending: false,
    following: false,
    fishtanks: false,
  })

  // Posts para cada pestaña
  const [trendingPosts, setTrendingPosts] = useState<PostWithUser[]>([])
  const [followingPosts, setFollowingPosts] = useState<PostWithUser[]>([])
  const [fishtanksPosts, setFishtanksPosts] = useState<PostWithUser[]>([])

  const [expoPushToken, setExpoPushToken] = useState<string | null>(null)
  const [notificationPermission, setNotificationPermission] = useState<string | null>(null)
  const [currentUserData, setCurrentUserData] = useState<User | null>(null)
  const [activeTab, setActiveTab] = useState("trending")
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const { user } = useAuth()
  const navigation = useNavigation()

  // Paginación para cada pestaña
  const [loadingMore, setLoadingMore] = useState({
    trending: false,
    following: false,
    fishtanks: false,
  })
  const [allPostsLoaded, setAllPostsLoaded] = useState({
    trending: false,
    following: false,
    fishtanks: false,
  })

  const lastVisibleRef = {
    trending: useRef<QueryDocumentSnapshot<DocumentData> | null>(null),
    following: useRef<QueryDocumentSnapshot<DocumentData> | null>(null),
    fishtanks: useRef<QueryDocumentSnapshot<DocumentData> | null>(null),
  }

  // Seguidos
  const [following, setFollowing] = useState<string[]>([])
  const [loadingFollowing, setLoadingFollowing] = useState(false)

  // Fetch current user data
  const fetchCurrentUserData = async () => {
    if (!user?.uid) return

    try {
      const userRef = doc(db, "users", user.uid)
      const userDoc = await getDoc(userRef)

      if (userDoc.exists()) {
        const userData = userDoc.data() as User
        setCurrentUserData(userData)

        // Obtener lista de seguidos
        await fetchFollowing(user.uid)
      }
    } catch (error) {
      console.error("Error fetching current user data:", error)
    }
  }

  // Fetch following list
  const fetchFollowing = async (userId: string) => {
    setLoadingFollowing(true)
    try {
      const followsRef = collection(db, "follows")
      const followsQuery = query(followsRef, where("followingId", "==", userId))
      const followsSnapshot = await getDocs(followsQuery)

      const followingIds: string[] = []
      followsSnapshot.forEach((doc) => {
        const followData = doc.data() as follows
        followingIds.push(followData.followerId)
      })

      setFollowing(followingIds)
    } catch (error) {
      console.error("Error fetching following list:", error)
    } finally {
      setLoadingFollowing(false)
    }
  }

  // Fetch unread notifications count
  const fetchUnreadNotificationsCount = async () => {
    if (!user?.uid) return

    try {
      const count = await getUnreadNotificationsCount(user.uid)
      setUnreadNotifications(count)

      // También actualizar el contador en el documento del usuario si es necesario
      if (currentUserData && count !== currentUserData.notificationCount) {
        const userRef = doc(db, "users", user.uid)
        await updateDoc(userRef, {
          notificationCount: count,
        })
      }
    } catch (error) {
      console.error("Error fetching unread notifications:", error)
    }
  }

  // Register for push notifications on component mount
  useEffect(() => {
    if (user?.uid) {
      fetchCurrentUserData()
      fetchUnreadNotificationsCount()
      registerForPushNotificationsAsync().then((token) => {
        if (token) {
          setExpoPushToken(token)
          saveTokenToDatabase(token)
        }
      })
    }
  }, [user?.uid])

  // Request notification permissions and get token
  async function registerForPushNotificationsAsync() {
    let token

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
      })
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync()
      let finalStatus = existingStatus
      setNotificationPermission(existingStatus)

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync()
        finalStatus = status
        setNotificationPermission(status)
      }

      // Even if permission was previously granted, we still want to get the token
      try {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId
        if (!projectId) {
          console.log("No project ID found in app config")
          return null
        }

        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: projectId,
        })

        token = tokenData.data
        console.log("Expo Push Token:", token)
      } catch (error) {
        console.error("Error getting push token:", error)
        return null
      }
    } else {
      console.log("Must use physical device for Push Notifications")
    }

    return token
  }

  const saveTokenToDatabase = async (token: string) => {
    try {
      if (!user?.uid || !token) return
      console.log("Saving token to database:", token)
      const userRef = doc(db, "users", user.uid)
      await updateDoc(userRef, {
        expoPushTokens: arrayUnion(token),
      })

      console.log("Expo Push Token saved to database")
    } catch (error) {
      console.error("Error saving token to database:", error)
    }
  }

  const loadUsers = async () => {
    try {
      const usersSnapshot = await getDocs(collection(db, "users"))
      const usersData: Record<string, User> = {}

      usersSnapshot.docs.forEach((doc) => {
        const userData = doc.data() as User
        if (!userData.id) {
          userData.id = doc.id
        }
        usersData[doc.id] = userData
      })

      setUsers(usersData)
      return usersData
    } catch (error) {
      console.error("Error loading users:", error)
      return {}
    }
  }

  // Función genérica para cargar posts según la pestaña
  const fetchPosts = async (tab: string, isRefreshing = false) => {
    // Si ya está cargando más posts y no es un refresh, salir
    if (loadingMore[tab as keyof typeof loadingMore] && !isRefreshing) return

    try {
      if (isRefreshing) {
        // Resetear estado para refresh
        setRefreshing((prev) => ({ ...prev, [tab]: true }))
        lastVisibleRef[tab as keyof typeof lastVisibleRef].current = null
        setAllPostsLoaded((prev) => ({ ...prev, [tab]: false }))

        // Limpiar posts según la pestaña
        if (tab === "trending") setTrendingPosts([])
        else if (tab === "following") setFollowingPosts([])
        else if (tab === "fishtanks") setFishtanksPosts([])
      } else {
        // Marcar como cargando más
        setLoadingMore((prev) => ({ ...prev, [tab]: true }))
      }

      // Marcar como cargando si es la primera carga o un refresh
      if (
        isRefreshing ||
        (tab === "trending" && trendingPosts.length === 0) ||
        (tab === "following" && followingPosts.length === 0) ||
        (tab === "fishtanks" && fishtanksPosts.length === 0)
      ) {
        setLoading((prev) => ({ ...prev, [tab]: true }))
      }

      // Cargar usuarios si no están cargados
      let usersData = users
      if (Object.keys(users).length === 0) {
        usersData = await loadUsers()
      }

      const postsRef = collection(db, "posts")
      let postsQuery

      // Construir la consulta según la pestaña
      if (tab === "following" && following.length > 0) {
        postsQuery = query(
          postsRef,
          where("authorId", "in", following.slice(0, 10)),
          orderBy("createdAt", "desc"),
          limit(POSTS_PER_PAGE),
        )
      } else if (tab === "fishtanks") {
        postsQuery = query(
          postsRef,
          where("fishTankId", "!=", null),
          orderBy("createdAt", "desc"),
          limit(POSTS_PER_PAGE),
        )
      } else {
        // Trending
        postsQuery = query(
          postsRef,
          orderBy("createdAt", "desc"),
          limit(POSTS_PER_PAGE),
        )
      }

      // Si no es la primera carga, usar el último documento como punto de inicio
      if (lastVisibleRef[tab as keyof typeof lastVisibleRef].current && !isRefreshing) {
        if (tab === "following" && following.length > 0) {
          postsQuery = query(
            postsRef,
            where("authorId", "in", following.slice(0, 10)),
            orderBy("createdAt", "desc"),
            startAfter(lastVisibleRef[tab as keyof typeof lastVisibleRef].current),
            limit(POSTS_PER_PAGE),
          )
        } else if (tab === "fishtanks") {
          postsQuery = query(
            postsRef,
            where("fishTankId", "!=", null),
            orderBy("createdAt", "desc"),
            startAfter(lastVisibleRef[tab as keyof typeof lastVisibleRef].current),
            limit(POSTS_PER_PAGE),
          )
        } else {
          postsQuery = query(
            postsRef,
            orderBy("createdAt", "desc"),
            startAfter(lastVisibleRef[tab as keyof typeof lastVisibleRef].current),
            limit(POSTS_PER_PAGE),
          )
        }
      }

      const snapshot = await getDocs(postsQuery)

      // Si no hay más posts, marcar como todos cargados
      if (snapshot.empty) {
        setAllPostsLoaded((prev) => ({ ...prev, [tab]: true }))
        setLoading((prev) => ({ ...prev, [tab]: false }))
        setLoadingMore((prev) => ({ ...prev, [tab]: false }))
        setRefreshing((prev) => ({ ...prev, [tab]: false }))
        return
      }

      // Guardar el último documento para la próxima carga
      const lastVisible = snapshot.docs[snapshot.docs.length - 1]
      lastVisibleRef[tab as keyof typeof lastVisibleRef].current = lastVisible

      const newPosts: PostWithUser[] = []

      snapshot.docs.forEach((doc) => {
        const postData = doc.data() as Post
        if (!postData.id) {
          postData.id = doc.id
        }

        const authorId = postData.authorId
        const user = usersData[authorId]

        if (user) {
          // Generar una clave única para cada post
          newPosts.push({
            user,
            post: postData,
            key: generateRandomId(),
          })
        }
      })

      // Actualizar los posts según la pestaña
      if (tab === "trending") {
        if (isRefreshing) {
          setTrendingPosts(newPosts)
        } else {
          setTrendingPosts((prev) => [...prev, ...newPosts])
        }
      } else if (tab === "following") {
        if (isRefreshing) {
          setFollowingPosts(newPosts)
        } else {
          setFollowingPosts((prev) => [...prev, ...newPosts])
        }
      } else if (tab === "fishtanks") {
        if (isRefreshing) {
          setFishtanksPosts(newPosts)
        } else {
          setFishtanksPosts((prev) => [...prev, ...newPosts])
        }
      }
    } catch (error) {
      console.error(`Error fetching ${tab} posts:`, error)
    } finally {
      // Actualizar estados de carga
      setLoading((prev) => ({ ...prev, [tab]: false }))
      setLoadingMore((prev) => ({ ...prev, [tab]: false }))
      setRefreshing((prev) => ({ ...prev, [tab]: false }))
    }
  }

  // Cargar posts iniciales para la pestaña activa
  useEffect(() => {
    if (activeTab === "trending" && trendingPosts.length === 0) {
      fetchPosts("trending")
    } else if (activeTab === "following" && followingPosts.length === 0) {
      fetchPosts("following")
    } else if (activeTab === "fishtanks" && fishtanksPosts.length === 0) {
      fetchPosts("fishtanks")
    }
  }, [activeTab, following])

  // Cargar posts iniciales para trending al montar el componente
  useEffect(() => {
    fetchPosts("trending")
  }, [])

  // Refrescar la pestaña activa
  const onRefresh = useCallback(() => {
    fetchCurrentUserData()
    fetchUnreadNotificationsCount()
    fetchPosts(activeTab, true)
  }, [activeTab])

  // Cargar más posts para la pestaña activa
  const handleLoadMore = () => {
    if (
      !loadingMore[activeTab as keyof typeof loadingMore] &&
      !allPostsLoaded[activeTab as keyof typeof allPostsLoaded]
    ) {
      fetchPosts(activeTab)
    }
  }

  // Manejar eliminación de posts
  const handlePostDeleted = useCallback((postId: string) => {
    // Actualizar todas las listas de posts
    setTrendingPosts((prev) => prev.filter((item) => item.post.id !== postId))
    setFollowingPosts((prev) => prev.filter((item) => item.post.id !== postId))
    setFishtanksPosts((prev) => prev.filter((item) => item.post.id !== postId))
  }, [])

  const requestNotificationPermission = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync()
      setNotificationPermission(status)

      if (status === "granted") {
        const token = await registerForPushNotificationsAsync()
        if (token) {
          setExpoPushToken(token)
          saveTokenToDatabase(token)
        }
      }
    } catch (error) {
      console.error("Error requesting notification permission:", error)
    }
  }

  const openDrawer = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
    navigation.dispatch(DrawerActions.openDrawer())
  }

  const openNotifications = async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }

    if (user?.uid && unreadNotifications > 0) {
      try {
        await markAllNotificationsAsRead(user.uid)
        setUnreadNotifications(0)
      } catch (error) {
        console.error("Error marking notifications as read:", error)
      }
    }

    router.push("/(drawer)/(tabs)/stackhome/notifications")
  }

  // Handle tab change
  const handleTabChange = (tab: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
    setActiveTab(tab)

    // Cargar posts si no hay ninguno en la pestaña seleccionada
    if (tab === "trending" && trendingPosts.length === 0) {
      fetchPosts("trending")
    } else if (tab === "following" && followingPosts.length === 0) {
      fetchPosts("following")
    } else if (tab === "fishtanks" && fishtanksPosts.length === 0) {
      fetchPosts("fishtanks")
    }
  }

  const renderFooter = () => {
    if (!loadingMore[activeTab as keyof typeof loadingMore]) return null

    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color="#FFFFFF" />
        <Text style={styles.loadingText}>Cargando publicaciones...</Text>
      </View>
    )
  }

  const renderEmptyComponent = (tab: string) => {
    if (loading[tab as keyof typeof loading]) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      )
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          {tab === "following"
            ? "No hay publicaciones de personas que sigues. ¡Sigue a más personas para ver su contenido!"
            : tab === "fishtanks"
              ? "No hay publicaciones en peceras. ¡Únete a más peceras para ver su contenido!"
              : "No hay publicaciones disponibles."}
        </Text>
      </View>
    )
  }

  const renderActiveFeed = () => {
    if (activeTab === "trending") {
      return (
        <FlatList
          data={trendingPosts}
          keyExtractor={() => generateRandomId()}
          contentContainerStyle={styles.feedContainer}
          renderItem={({ item }) => (
            <View style={{ marginBottom: 16, marginHorizontal: 8 }}>
              {user?.uid && (
                <PostItem
                  key={generateRandomId()}
                  user={item.user}
                  post={item.post}
                  currentUserId={user.uid}
                  onPostDeleted={handlePostDeleted}
                />
              )}
            </View>
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing.trending}
              onRefresh={onRefresh}
              colors={["#FFFFFF"]}
              tintColor="#FFFFFF"
              progressBackgroundColor="#3A4154"
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={() => renderEmptyComponent("trending")}
        />
      )
    } else if (activeTab === "following") {
      return (
        <FlatList
          data={followingPosts}
          keyExtractor={() => generateRandomId()}
          contentContainerStyle={styles.feedContainer}
          renderItem={({ item }) => (
            <View style={{ marginBottom: 16, marginHorizontal: 8 }}>
              {user?.uid && (
                <PostItem
                  key={generateRandomId()}
                  user={item.user}
                  post={item.post}
                  currentUserId={user.uid}
                  onPostDeleted={handlePostDeleted}
                />
              )}
            </View>
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing.following}
              onRefresh={onRefresh}
              colors={["#FFFFFF"]}
              tintColor="#FFFFFF"
              progressBackgroundColor="#3A4154"
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={() => renderEmptyComponent("following")}
        />
      )
    } else {
      return (
        <FlatList
          data={fishtanksPosts}
          keyExtractor={() => generateRandomId()}
          contentContainerStyle={styles.feedContainer}
          renderItem={({ item }) => (
            <View style={{ marginBottom: 16, marginHorizontal: 8 }}>
              {user?.uid && (
                <PostItem
                  key={generateRandomId()}
                  user={item.user}
                  post={item.post}
                  currentUserId={user.uid}
                  onPostDeleted={handlePostDeleted}
                />
              )}
            </View>
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing.fishtanks}
              onRefresh={onRefresh}
              colors={["#FFFFFF"]}
              tintColor="#FFFFFF"
              progressBackgroundColor="#3A4154"
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={() => renderEmptyComponent("fishtanks")}
        />
      )
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#2A3142" />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.profileButton} onPress={openDrawer}>
            {currentUserData?.profilePicture ? (
              <Image source={{ uri: currentUserData.profilePicture }} style={styles.profileImage} />
            ) : (
              <Image source={require("../../../../assets/placeholders/user_icon.png")} style={styles.profileImage} />
            )}
          </TouchableOpacity>
          <Text style={styles.headerTitle}>FISHER</Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconButton} onPress={openNotifications}>
            <Feather name="bell" size={22} color="#FFFFFF" />
            {unreadNotifications > 0 && (
              <View style={styles.notificationBadge}>
                {unreadNotifications > 9 ? (
                  <Text style={styles.notificationBadgeText}>9+</Text>
                ) : (
                  <Text style={styles.notificationBadgeText}>{unreadNotifications}</Text>
                )}
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === "trending" && styles.activeTabButton]}
          onPress={() => handleTabChange("trending")}
        >
          <Text style={[styles.tabText, activeTab === "trending" && styles.activeTabText]}>Trending</Text>
          <Feather name="trending-up" size={18} color={activeTab === "trending" ? "#8BB9FE" : "#FFFFFF"} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === "following" && styles.activeTabButton]}
          onPress={() => handleTabChange("following")}
        >
          <Text style={[styles.tabText, activeTab === "following" && styles.activeTabText]}>Following</Text>
          <Feather name="users" size={18} color={activeTab === "following" ? "#8BB9FE" : "#FFFFFF"} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === "fishtanks" && styles.activeTabButton]}
          onPress={() => handleTabChange("fishtanks")}
        >
          <Text style={[styles.tabText, activeTab === "fishtanks" && styles.activeTabText]}>Fish Tanks</Text>
          <Feather name="globe" size={18} color={activeTab === "fishtanks" ? "#8BB9FE" : "#FFFFFF"} />
        </TouchableOpacity>
      </View>

      {renderActiveFeed()}
    </View>
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
    minHeight: 300,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 50 : 16,
    paddingBottom: 10,
    backgroundColor: "#3C4255",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginLeft: 12,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  notificationBadge: {
    position: "absolute",
    top: 5,
    right: 5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#FF3B30",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: "#3C4255",
  },
  notificationBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "bold",
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    backgroundColor: "#4C5366",
    borderWidth: 2,
    borderColor: "#8BB9FE",
  },
  profileImage: {
    width: "100%",
    height: "100%",
    borderRadius: 20,
  },
  profileImagePlaceholder: {
    width: "100%",
    height: "100%",
    borderRadius: 20,
    backgroundColor: "#4C5366",
    justifyContent: "center",
    alignItems: "center",
  },
  feedContainer: {
    paddingTop: 20,
    paddingBottom: 20,
    flexGrow: 1,
    minHeight: 300,
  },
  tabsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#3A4154",
    borderBottomWidth: 1,
    borderBottomColor: "#4C5366",
  },
  tabButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  activeTabButton: {
    backgroundColor: "#4C5366",
  },
  tabText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "500",
    marginRight: 8,
  },
  activeTabText: {
    color: "#8BB9FE",
    fontWeight: "bold",
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3A4154",
    borderRadius: 12,
    marginTop: 20,
    marginHorizontal: 16,
    minHeight: 200,
  },
  emptyText: {
    color: "#FFFFFF",
    fontSize: 16,
    textAlign: "center",
  },
  loadingFooter: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  loadingText: {
    color: "#FFFFFF",
    marginLeft: 10,
    fontSize: 14,
  },
})

export default FeedScreen