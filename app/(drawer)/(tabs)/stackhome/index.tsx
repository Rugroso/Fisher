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
  Alert,
  Platform,
} from "react-native"
import { collection, getDocs, query, where, doc, updateDoc, arrayUnion } from "firebase/firestore"
import { db } from "../../../../config/Firebase_Conf"
import { Feather } from "@expo/vector-icons"
import PostItem from "@/components/general/posts"
import { useAuth } from "@/context/AuthContext"
import * as Notifications from "expo-notifications"
import * as Device from "expo-device"
import Constants from "expo-constants"
import type { User, Post } from "../../../types/types"

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
  }),
})

const FeedScreen = () => {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [flattenedPosts, setFlattenedPosts] = useState<PostWithUser[]>([])
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null)
  const [notificationPermission, setNotificationPermission] = useState<string | null>(null)
  const { user } = useAuth()

  // Register for push notifications on component mount
  useEffect(() => {
    if (user?.uid) {
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
      Alert.alert("Must use physical device for Push Notifications")
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    )
  }

  return (
    <View style={styles.container}>


      <View style={styles.tabsContainer}>
        <TouchableOpacity style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={styles.tabText}>Trending</Text>
          <View>
            <Feather name="trending-up" size={18} color="#FFFFFF" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={styles.tabText}>Following</Text>
          <View>
            <Feather name="users" size={18} color="#FFFFFF" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={styles.tabText}>Fish Tanks</Text>
          <View>
            <Feather name="globe" size={18} color="#FFFFFF" />
          </View>
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
            <View style={{ marginBottom: 16 }} key={item.key}>
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
            <Text style={styles.emptyText}>Cargando...</Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    backgroundColor: "#2A3142",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#2A3142",
  },
  feedContainer: {
    paddingBottom: 20,
  },
  tabsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  tabText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
    paddingLeft: 16,
    marginRight: 8,
  },
  emptyContainer: {
    padding: 20,
    alignItems: "center",
  },
  emptyText: {
    color: "#FFFFFF",
    fontSize: 16,
  },
  tokenInfoContainer: {
    backgroundColor: "#3A4154",
    padding: 12,
    margin: 10,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#4ECDC4",
  },
  tokenInfoTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 5,
  },
  tokenInfoText: {
    color: "#E0E0E0",
    fontSize: 12,
    marginBottom: 3,
  },
  permissionButton: {
    backgroundColor: "#4ECDC4",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    alignSelf: "flex-start",
    marginTop: 8,
  },
  permissionButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 14,
  },
})

export default FeedScreen
