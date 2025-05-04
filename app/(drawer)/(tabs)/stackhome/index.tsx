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
  DocumentData,
  QueryDocumentSnapshot,
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

import { getUnreadNotificationsCount, markAllNotificationsAsRead } from "../../../../lib/notifications"

interface PostWithUser {
  user: User
  post: Post
  key: string
}

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

const FeedScreen = () => {
  const router = useRouter()
  const [users, setUsers] = useState<Record<string, User>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [flattenedPosts, setFlattenedPosts] = useState<PostWithUser[]>([])
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null)
  const [notificationPermission, setNotificationPermission] = useState<string | null>(null)
  const [currentUserData, setCurrentUserData] = useState<User | null>(null)
  const [activeTab, setActiveTab] = useState("trending")
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const { user } = useAuth()
  const navigation = useNavigation()

  const [loadingMore, setLoadingMore] = useState(false)
  const [allPostsLoaded, setAllPostsLoaded] = useState(false)
  const lastVisibleRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null)

  const [following, setFollowing] = useState<string[]>([])
  const [loadingFollowing, setLoadingFollowing] = useState(false)

  const fetchCurrentUserData = async () => {
    if (!user?.uid) return

    try {
      const userRef = doc(db, "users", user.uid)
      const userDoc = await getDoc(userRef)

      if (userDoc.exists()) {
        const userData = userDoc.data() as User
        setCurrentUserData(userData)

        await fetchFollowing(user.uid)
      }
    } catch (error) {
      console.error("Error fetching current user data:", error)
    }
  }

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

  const fetchUnreadNotificationsCount = async () => {
    if (!user?.uid) return

    try {
      const count = await getUnreadNotificationsCount(user.uid)
      setUnreadNotifications(count)

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

  const fetchPosts = async (isRefreshing = false, isTabChange = false) => {
    if (loadingMore && !isRefreshing && !isTabChange) return

    try {
      if (isRefreshing || isTabChange) {
        setLoading(true)
        setFlattenedPosts([])
        lastVisibleRef.current = null
        setAllPostsLoaded(false)
      } else {
        setLoadingMore(true)
      }

      let usersData = users
      if (Object.keys(users).length === 0) {
        usersData = await loadUsers()
      }

      const postsRef = collection(db, "posts")
      let postsQuery

      if (activeTab === "following" && following.length > 0) {

        postsQuery = query(
          postsRef,
          where("authorId", "in", following.slice(0, 10)),
          orderBy("createdAt", "desc"),
          limit(POSTS_PER_PAGE),
        )
      } else if (activeTab === "fishtanks") {
        postsQuery = query(
          postsRef,
          where("fishTankId", "!=", null),
          orderBy("createdAt", "desc"),
          limit(POSTS_PER_PAGE),
        )
      } else {
        postsQuery = query(
          postsRef,
          orderBy("createdAt", "desc"),
          limit(POSTS_PER_PAGE),
        )
      }

      if (lastVisibleRef.current && !isRefreshing && !isTabChange) {
        if (activeTab === "following" && following.length > 0) {
          postsQuery = query(
            postsRef,
            where("authorId", "in", following.slice(0, 10)),
            orderBy("createdAt", "desc"),
            startAfter(lastVisibleRef.current),
            limit(POSTS_PER_PAGE),
          )
        } else if (activeTab === "fishtanks") {
          postsQuery = query(
            postsRef,
            where("fishTankId", "!=", null),
            orderBy("createdAt", "desc"),
            startAfter(lastVisibleRef.current),
            limit(POSTS_PER_PAGE),
          )
        } else {
          postsQuery = query(
            postsRef,
            orderBy("createdAt", "desc"),
            startAfter(lastVisibleRef.current),
            limit(POSTS_PER_PAGE),
          )
        }
      }

      const snapshot = await getDocs(postsQuery)

      if (snapshot.empty) {
        setAllPostsLoaded(true)
        setLoading(false)
        setLoadingMore(false)
        setRefreshing(false)
        return
      }

      const lastVisible = snapshot.docs[snapshot.docs.length - 1]
      lastVisibleRef.current = lastVisible

      const newPosts: PostWithUser[] = []

      snapshot.docs.forEach((doc) => {
        const postData = doc.data() as Post
        if (!postData.id) {
          postData.id = doc.id
        }

        const authorId = postData.authorId
        const user = usersData[authorId]

        if (user) {
          newPosts.push({
            user,
            post: postData,
            key: postData.id,
          })
        }
      })

      if (isRefreshing || isTabChange) {
        setFlattenedPosts(newPosts)
      } else {
        setFlattenedPosts((prev) => [...prev, ...newPosts])
      }
    } catch (error) {
      console.error("Error fetching posts:", error)
    } finally {
      setLoading(false)
      setLoadingMore(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchPosts()
  }, [])

  useEffect(() => {
    fetchPosts(false, true)
  }, [activeTab, following])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchCurrentUserData()
    fetchUnreadNotificationsCount()
    fetchPosts(true)
  }, [])

  const handleLoadMore = () => {
    if (!loadingMore && !allPostsLoaded) {
      fetchPosts()
    }
  }

  const handlePostDeleted = useCallback((postId: string) => {
    setFlattenedPosts((prevPosts) => prevPosts.filter((item) => item.post.id !== postId))
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

  const handleTabChange = (tab: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
    setActiveTab(tab)
  }

  const renderFooter = () => {
    if (!loadingMore) return null

    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color="#FFFFFF" />
        <Text style={styles.loadingText}>Cargando más publicaciones...</Text>
      </View>
    )
  }

  const renderEmptyComponent = () => {
    if (loading) return null

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          {activeTab === "following"
            ? "No hay publicaciones de personas que sigues. ¡Sigue a más personas para ver su contenido!"
            : activeTab === "fishtanks"
            ? "No hay publicaciones en peceras. ¡Únete a más peceras para ver su contenido!"
            : "No hay publicaciones disponibles."}
        </Text>
      </View>
    )
  }

  if (loading && flattenedPosts.length === 0) {
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

      <FlatList
        data={flattenedPosts}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.feedContainer}
        renderItem={({ item }) => (
          <View style={{ marginBottom: 16, marginHorizontal: 8 }}>
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
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#FFFFFF"]}
            tintColor="#FFFFFF"
            progressBackgroundColor="#3A4154"
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmptyComponent}
      />
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
    flexGrow: 1,
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
