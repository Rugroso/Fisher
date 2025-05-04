"use client"

import { useEffect, useState, useCallback } from "react"
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Platform,
  Image,
  StatusBar,
} from "react-native"
import { collection, getDocs, query, where, doc, updateDoc, arrayUnion, getDoc } from "firebase/firestore"
import { db } from "../../../../config/Firebase_Conf"
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons"
import PostItem from "@/components/general/posts"
import { useAuth } from "@/context/AuthContext"
import * as Notifications from "expo-notifications"
import * as Device from "expo-device"
import Constants from "expo-constants"
import type { User, Post } from "../../../types/types"
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

const FeedScreen = () => {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [flattenedPosts, setFlattenedPosts] = useState<PostWithUser[]>([])
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null)
  const [notificationPermission, setNotificationPermission] = useState<string | null>(null)
  const [currentUserData, setCurrentUserData] = useState<User | null>(null)
  const [activeTab, setActiveTab] = useState("trending")
  const [unreadNotifications, setUnreadNotifications] = useState(3) // Número de notificaciones sin leer
  const { user } = useAuth()
  const navigation = useNavigation()

  // Fetch current user data
  const fetchCurrentUserData = async () => {
    if (!user?.uid) return

    try {
      const userRef = doc(db, "users", user.uid)
      const userDoc = await getDoc(userRef)

      if (userDoc.exists()) {
        const userData = userDoc.data() as User
        setCurrentUserData(userData)
      }
    } catch (error) {
      console.error("Error fetching current user data:", error)
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

  // Save token to Firestore
  const saveTokenToDatabase = async (token: string) => {
    try {
      if (!user?.uid || !token) return

      console.log("Saving token to database:", token)

      // Update the user document with the new token
      const userRef = doc(db, "users", user.uid)

      // Use arrayUnion to add the token only if it doesn't already exist
      await updateDoc(userRef, {
        expoPushTokens: arrayUnion(token),
      })

      console.log("Expo Push Token saved to database")
    } catch (error) {
      console.error("Error saving token to database:", error)
    }
  }

  const fetchPostsForUser = async (userId: string) => {
    try {
      const postsRef = collection(db, "posts")
      // Update the query to use authorId instead of userId
      const q = query(postsRef, where("authorId", "==", userId))
      const snapshot = await getDocs(q)

      return snapshot.docs.map((doc) => {
        const data = doc.data() as Post
        // Ensure the post has an id
        if (!data.id) {
          data.id = doc.id
        }
        return data
      })
    } catch (error) {
      console.error("Error fetching posts:", error)
      return []
    }
  }

  const fetchUsersWithPosts = async () => {
    try {
      const usersSnapshot = await getDocs(collection(db, "users"))
      const usersList: User[] = []
      const newPosts: PostWithUser[] = []

      for (const doc of usersSnapshot.docs) {
        const userData = doc.data() as User
        // Ensure the user has an id
        if (!userData.id) {
          userData.id = doc.id
        }

        // Fetch posts for this user
        const posts = await fetchPostsForUser(userData.id)
        if (posts && posts.length > 0) {
          usersList.push(userData)
          newPosts.push(
            ...posts.map((post) => ({
              user: userData,
              post,
              key: `${post.id}`,
            })),
          )
        }
      }

      setFlattenedPosts(newPosts)
      setUsers(usersList)
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchUsersWithPosts()
  }, [])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    setFlattenedPosts([])
    fetchCurrentUserData()
    fetchUnreadNotificationsCount()
    fetchUsersWithPosts()
  }, [])

  const handlePostDeleted = useCallback((postId: string) => {
    // Filtrar el post eliminado de la lista de posts
    setFlattenedPosts((prevPosts) => prevPosts.filter((item) => item.post.id !== postId))
  }, [])

  // Request notifications permission again
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

  // Open drawer navigation
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
    // Aquí podrías implementar la lógica para filtrar los posts según la pestaña seleccionada
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    )
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

      <ScrollView
        contentContainerStyle={styles.feedContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#FFFFFF"]}
            tintColor="#FFFFFF"
            progressBackgroundColor="#3A4154"
          />
        }
      >
        {flattenedPosts.length > 0 ? (
          flattenedPosts.map((item) => (
            <View style={{ marginBottom: 16, marginHorizontal: 8 }} key={item.key}>
              {user?.uid && (
                <PostItem
                  key={item.post.id}
                  user={item.user}
                  post={item.post}
                  currentUserId={user.uid}
                  onPostDeleted={handlePostDeleted}
                />
              )}
            </View>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Cargando Publicaciones...</Text>
          </View>
        )}
      </ScrollView>
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
  },
  emptyText: {
    color: "#FFFFFF",
    fontSize: 16,
    textAlign: "center",
  },
})

export default FeedScreen
