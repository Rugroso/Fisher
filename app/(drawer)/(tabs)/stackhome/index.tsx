"use client"

import { useEffect, useState, useCallback, useRef, useMemo, memo } from "react"
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Platform,
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
import { DrawerActions, } from "@react-navigation/native"
import * as Haptics from "expo-haptics"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { Image } from "expo-image"
import { useOceanMode } from '../../../context/OceanModeContext'

import { getUnreadNotificationsCount, markAllNotificationsAsRead } from "../../../../lib/notifications"

interface PostWithUser {
  user: User
  post: Post
  key: string
  fishtank?: { name: string; fishTankPicture?: string }
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
const POST_ITEM_HEIGHT = 350
const CACHE_EXPIRY = 1000 * 60 * 15


const ProfileImage = memo(({ uri, style }: { uri?: string; style: any }) => {
  const blurhash = "LGF5]+Yk^6#M@-5c,1J5@[or[Q6."

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={style}
        placeholder={blurhash}
        contentFit="cover"
        transition={300}
        cachePolicy="memory-disk"
      />
    )
  }

  return (
    <Image
      source={require("../../../../assets/placeholders/user_icon.png")}
      style={style}
      contentFit="cover"
      transition={300}
    />
  )
})

const PostItemMemo = memo(
  ({
    item,
    currentUserId,
    onPostDeleted,
    onRefreshPost,
  }: { item: PostWithUser; currentUserId: string; onPostDeleted: (id: string) => void; onRefreshPost: (postId: string) => void }) => {
    return (
      <View style={{ marginBottom: 16, marginHorizontal: 8 }}>
        <PostItem
          key={item.post.id}
          user={item.user}
          post={item.post}
          currentUserId={currentUserId}
          onPostDeleted={onPostDeleted}
          fishtank={item.fishtank}
          onRefreshPost={onRefreshPost}
        />
      </View>
    )
  },
  (prevProps, nextProps) => {
    return prevProps.item.post.id === nextProps.item.post.id && prevProps.currentUserId === nextProps.currentUserId
  },
)

const LoadingFooter = memo(({ loading }: { loading: boolean }) => {
  if (!loading) return null

  return (
    <View style={styles.loadingFooter}>
      <ActivityIndicator size="small" color="#FFFFFF" />
      <Text style={styles.loadingText}>Cargando publicaciones...</Text>
    </View>
  )
})

const EmptyComponent = memo(({ loading, tab }: { loading: boolean; tab: string }) => {
  if (loading) {
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
})

const FeedScreen = () => {
  const router = useRouter()
  const { isOceanMode, scrollProgress, setScrollProgress } = useOceanMode()
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

  const trendingListRef = useRef<FlatList>(null)
  const followingListRef = useRef<FlatList>(null)
  const fishtanksListRef = useRef<FlatList>(null)

  const [following, setFollowing] = useState<string[]>([])
  const [loadingFollowing, setLoadingFollowing] = useState(false)

  const postsCache = useRef<{
    trending: { data: PostWithUser[]; timestamp: number } | null
    following: { data: PostWithUser[]; timestamp: number } | null
    fishtanks: { data: PostWithUser[]; timestamp: number } | null
  }>({
    trending: null,
    following: null,
    fishtanks: null,
  })

  const checkForDuplicates = useCallback((posts: PostWithUser[], tabName: string) => {
    const ids = posts.map(post => post.post.id);
    const uniqueIds = new Set(ids);
    
    if (ids.length !== uniqueIds.size) {
      console.warn(`[${tabName}] Duplicados detectados: ${ids.length - uniqueIds.size} posts duplicados`);
      
      const duplicates: Record<string, number> = {};
      ids.forEach(id => {
        duplicates[id] = (duplicates[id] || 0) + 1;
      });
      
      Object.entries(duplicates)
        .filter(([_, count]) => count > 1)
        .forEach(([id, count]) => {
          console.warn(`ID ${id} aparece ${count} veces`);
        });
    } else {
      console.log(`[${tabName}] No se detectaron duplicados en ${posts.length} posts`);
    }
  }, []);

  const fetchCurrentUserData = async () => {
    if (!user?.uid) return

    try {
      const cachedUserData = await AsyncStorage.getItem(`user_${user.uid}`)
      if (cachedUserData) {
        const { data, timestamp } = JSON.parse(cachedUserData)
        const now = Date.now()

        if (now - timestamp < CACHE_EXPIRY) {
          setCurrentUserData(data)
          fetchFollowing(user.uid)
          return
        }
      }

      const userRef = doc(db, "users", user.uid)
      const userDoc = await getDoc(userRef)

      if (userDoc.exists()) {
        const userData = userDoc.data() as User
        setCurrentUserData(userData)

        await AsyncStorage.setItem(
          `user_${user.uid}`,
          JSON.stringify({
            data: userData,
            timestamp: Date.now(),
          }),
        )

        await fetchFollowing(user.uid)
      }
    } catch (error) {
      console.error("Error fetching current user data:", error)
      try {
        const cachedUserData = await AsyncStorage.getItem(`user_${user.uid}`)
        if (cachedUserData) {
          const { data } = JSON.parse(cachedUserData)
          setCurrentUserData(data)
        }
      } catch (e) {
        console.error("Error reading from cache:", e)
      }
    }
  }

  const fetchFollowing = async (userId: string) => {
    setLoadingFollowing(true)
    try {
      const cachedFollowing = await AsyncStorage.getItem(`following_${userId}`)
      if (cachedFollowing) {
        const { data, timestamp } = JSON.parse(cachedFollowing)
        const now = Date.now()

        if (now - timestamp < CACHE_EXPIRY) {
          setFollowing(data)
          setLoadingFollowing(false)
          return
        }
      }

      const followsRef = collection(db, "follows")
      const followsQuery = query(followsRef, where("followingId", "==", userId))
      const followsSnapshot = await getDocs(followsQuery)

      const followingIds: string[] = []
      followsSnapshot.forEach((doc) => {
        const followData = doc.data() as follows
        followingIds.push(followData.followerId)
      })

      setFollowing(followingIds)

      await AsyncStorage.setItem(
        `following_${userId}`,
        JSON.stringify({
          data: followingIds,
          timestamp: Date.now(),
        }),
      )
    } catch (error) {
      console.error("Error fetching following list:", error)
      try {
        const cachedFollowing = await AsyncStorage.getItem(`following_${userId}`)
        if (cachedFollowing) {
          const { data } = JSON.parse(cachedFollowing)
          setFollowing(data)
        }
      } catch (e) {
        console.error("Error reading from cache:", e)
      }
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

    if (Platform.OS === 'web') {
      openDrawer();
    }

    cleanOldCache()
  }, [user?.uid])

  const cleanOldCache = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys()
      const now = Date.now()

      for (const key of keys) {
        if (key.startsWith("user_") || key.startsWith("following_") || key.startsWith("posts_")) {
          const data = await AsyncStorage.getItem(key)
          if (data) {
            const { timestamp } = JSON.parse(data)
            if (now - timestamp > 1000 * 60 * 60 * 24) {
              await AsyncStorage.removeItem(key)
            }
          }
        }
      }
    } catch (error) {
      console.error("Error cleaning old cache:", error)
    }
  }

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
      const cachedUsers = await AsyncStorage.getItem("users_data")
      if (cachedUsers) {
        const { data, timestamp } = JSON.parse(cachedUsers)
        const now = Date.now()

        if (now - timestamp < CACHE_EXPIRY * 2) {
          setUsers(data)
          return data
        }
      }

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

      await AsyncStorage.setItem(
        "users_data",
        JSON.stringify({
          data: usersData,
          timestamp: Date.now(),
        }),
      )

      return usersData
    } catch (error) {
      console.error("Error loading users:", error)

      try {
        const cachedUsers = await AsyncStorage.getItem("users_data")
        if (cachedUsers) {
          const { data } = JSON.parse(cachedUsers)
          setUsers(data)
          return data
        }
      } catch (e) {
        console.error("Error reading from cache:", e)
      }

      return {}
    }
  }

  const fetchPosts = async (tab: string, isRefreshing = false) => {
    if (loadingMore[tab as keyof typeof loadingMore] && !isRefreshing) return

    try {
      if (isRefreshing) {
        setRefreshing((prev) => ({ ...prev, [tab]: true }))
        lastVisibleRef[tab as keyof typeof lastVisibleRef].current = null
        setAllPostsLoaded((prev) => ({ ...prev, [tab]: false }))

        postsCache.current[tab as keyof typeof postsCache.current] = null
        await AsyncStorage.removeItem(`posts_${tab}`)
      } else {
        setLoadingMore((prev) => ({ ...prev, [tab]: true }))
      }

      if (
        isRefreshing ||
        (tab === "trending" && trendingPosts.length === 0) ||
        (tab === "following" && followingPosts.length === 0) ||
        (tab === "fishtanks" && fishtanksPosts.length === 0)
      ) {
        setLoading((prev) => ({ ...prev, [tab]: true }))

        if (!isRefreshing && !lastVisibleRef[tab as keyof typeof lastVisibleRef].current) {
          const cachedPosts = await AsyncStorage.getItem(`posts_${tab}`)
          if (cachedPosts) {
            const { data, timestamp, lastVisible } = JSON.parse(cachedPosts)
            const now = Date.now()

            if (now - timestamp < CACHE_EXPIRY / 3) {
              if (tab === "trending") setTrendingPosts(data)
              else if (tab === "following") setFollowingPosts(data)
              else if (tab === "fishtanks") setFishtanksPosts(data)

              postsCache.current[tab as keyof typeof postsCache.current] = {
                data,
                timestamp,
              }

              if (lastVisible) {
                lastVisibleRef[tab as keyof typeof lastVisibleRef].current = lastVisible as any
              }

              setLoading((prev) => ({ ...prev, [tab]: false }))
              setLoadingMore((prev) => ({ ...prev, [tab]: false }))
              return
            }
          }
        }
      }

      let usersData = users
      if (Object.keys(users).length === 0) {
        usersData = await loadUsers()
      }

      const postsRef = collection(db, "posts")
      let postsQuery

      if (tab === "following" && following.length > 0) {
        postsQuery = query(
          postsRef,
          where("authorId", "in", following.slice(0, 10)),
          orderBy("createdAt", "desc"),
          limit(POSTS_PER_PAGE),
        )
      } else if (tab === "fishtanks") {
        // Obtener los IDs de las peceras a las que pertenece el usuario
        const membershipsQuery = query(
          collection(db, "fishtank_members"),
          where("userId", "==", user?.uid)
        )
        const membershipsSnap = await getDocs(membershipsQuery)
        const userFishtankIds = membershipsSnap.docs.map(doc => doc.data().fishtankId)
        if (userFishtankIds.length === 0) {
          setFishtanksPosts([])
          setLoading((prev) => ({ ...prev, fishtanks: false }))
          return
        }

        // Verificar qué peceras siguen existiendo
        const fishtankSnaps = await Promise.all(
          userFishtankIds.map(id => getDoc(doc(db, "fishtanks", id)))
        )
        const existingFishtankIds = fishtankSnaps
          .filter(snap => snap.exists())
          .map(snap => snap.id)

        if (existingFishtankIds.length === 0) {
          setFishtanksPosts([])
          setLoading((prev) => ({ ...prev, fishtanks: false }))
          return
        }

        // Consulta a posts con fishTankId en 'posts' SOLO de las peceras existentes
        const postsWithFishtankQuery = query(
          postsRef,
          where("fishTankId", "in", existingFishtankIds.slice(0, 10)),
          where("deleted", "==", false),
          orderBy("createdAt", "desc"),
          limit(POSTS_PER_PAGE),
        )
        // Consulta a 'fishtank_posts' SOLO de las peceras existentes
        const fishtankPostsRef = collection(db, "fishtank_posts")
        const fishtankPostsQuery = query(
          fishtankPostsRef,
          where("fishtankId", "in", existingFishtankIds.slice(0, 10)),
          where("deleted", "==", false),
          orderBy("createdAt", "desc"),
          limit(POSTS_PER_PAGE),
        )
        // Ejecutar ambas consultas en paralelo
        const [postsSnap, fishtankPostsSnap] = await Promise.all([
          getDocs(postsWithFishtankQuery),
          getDocs(fishtankPostsQuery),
        ])
        // Procesar ambos resultados y asegurar estructura completa
        const posts: PostWithUser[] = []
        const fishtankIdSet = new Set<string>()
        for (const snap of [postsSnap, fishtankPostsSnap]) {
          for (const docSnap of snap.docs) {
            const postData = docSnap.data()
            if (postData.fishtankId) fishtankIdSet.add(postData.fishtankId)
            const userRef = doc(db, "users", postData.authorId)
            const userSnap = await getDoc(userRef)
            let user: User
            if (userSnap.exists()) {
              user = { ...userSnap.data(), id: userSnap.id } as User
            } else {
              user = {
                id: postData.authorId,
                name: "Usuario",
                lastName: "",
                username: "usuario",
                email: "",
                isOnline: false,
                isVerified: false,
                preferences: { oceanMode: false, privacyMode: false },
                followerCount: 0,
                followingCount: 0,
                notificationCount: 0,
                createdAt: "",
                updatedAt: ""
              }
            }
            // Completar post con campos requeridos si faltan
            const post: Post = {
              id: docSnap.id,
              authorId: postData.authorId || "",
              content: postData.content || "",
              media: postData.media || [],
              tags: postData.tags || [],
              isWave: postData.isWave || false,
              waveOf: postData.waveOf,
              fishtankId: postData.fishtankId,
              commentCount: postData.commentCount || 0,
              reactionCounts: postData.reactionCounts || { bait: 0, fish: 0, wave: 0 },
              deleted: postData.deleted || false,
              createdAt: postData.createdAt || "",
              updatedAt: postData.updatedAt || ""
            }
            posts.push({
              post,
              user,
              key: post.id
            })
          }
        }
        // Obtener info de las peceras
        const fishtankIds = Array.from(fishtankIdSet)
        let fishtankMap: Record<string, { name: string, fishTankPicture?: string }> = {}
        if (fishtankIds.length > 0) {
          const fishtankSnaps = await Promise.all(
            fishtankIds.map(id => getDoc(doc(db, "fishtanks", id)))
          )
          fishtankSnaps.forEach(snap => {
            if (snap.exists()) {
              const data = snap.data()
              fishtankMap[snap.id] = { name: data.name, fishTankPicture: data.fishTankPicture }
            }
          })
        }
        // Asignar info de la pecera a cada post
        const postsWithFishtank: PostWithUser[] = posts.map(p => ({
          ...p,
          fishtank: p.post.fishtankId ? fishtankMap[p.post.fishtankId] : undefined
        }))
        setFishtanksPosts(postsWithFishtank)
        setLoading((prev) => ({ ...prev, fishtanks: false }))
        return
      } else {
        postsQuery = query(postsRef, orderBy("createdAt", "desc"), limit(POSTS_PER_PAGE))
      }

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

      if (snapshot.empty) {
        setAllPostsLoaded((prev) => ({ ...prev, [tab]: true }))
        setLoading((prev) => ({ ...prev, [tab]: false }))
        setLoadingMore((prev) => ({ ...prev, [tab]: false }))
        setRefreshing((prev) => ({ ...prev, [tab]: false }))
        return
      }

      const lastVisible = snapshot.docs[snapshot.docs.length - 1]
      lastVisibleRef[tab as keyof typeof lastVisibleRef].current = lastVisible

      const newPosts: PostWithUser[] = []
      const processedIds = new Set<string>()

      snapshot.docs.forEach((doc) => {
        const postData = doc.data() as Post
        if (!postData.id) {
          postData.id = doc.id
        }

        if (postData.deleted || processedIds.has(postData.id)) return

        processedIds.add(postData.id)

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

      console.log(`[${tab}] Fetched ${newPosts.length} new posts`)

      let updatedPosts: PostWithUser[] = []

      if (tab === "trending") {
        if (isRefreshing) {
          updatedPosts = newPosts
          setTrendingPosts(updatedPosts)
        } else {
          const existingPostIds = new Set(trendingPosts.map((item) => item.post.id))
          const filteredNewPosts = newPosts.filter((item) => !existingPostIds.has(item.post.id))
          updatedPosts = [...trendingPosts, ...filteredNewPosts].sort((a, b) => {
            return new Date(b.post.createdAt).getTime() - new Date(a.post.createdAt).getTime()
          })
          setTrendingPosts(updatedPosts)
        }
      } else if (tab === "following") {
        if (isRefreshing) {
          updatedPosts = newPosts
          setFollowingPosts(updatedPosts)
        } else {
          const existingPostIds = new Set(followingPosts.map((item) => item.post.id))
          const filteredNewPosts = newPosts.filter((item) => !existingPostIds.has(item.post.id))
          updatedPosts = [...followingPosts, ...filteredNewPosts].sort((a, b) => {
            return new Date(b.post.createdAt).getTime() - new Date(a.post.createdAt).getTime()
          })
          setFollowingPosts(updatedPosts)
        }
      } else if (tab === "fishtanks") {
        if (isRefreshing) {
          updatedPosts = newPosts
          setFishtanksPosts(updatedPosts)
        } else {
          const existingPostIds = new Set(fishtanksPosts.map((item) => item.post.id))
          const filteredNewPosts = newPosts.filter((item) => !existingPostIds.has(item.post.id))
          updatedPosts = [...fishtanksPosts, ...filteredNewPosts].sort((a, b) => {
            return new Date(b.post.createdAt).getTime() - new Date(a.post.createdAt).getTime()
          })
          setFishtanksPosts(updatedPosts)
        }
      }

      postsCache.current[tab as keyof typeof postsCache.current] = {
        data: updatedPosts,
        timestamp: Date.now(),
      }

      if (isRefreshing || !lastVisibleRef[tab as keyof typeof lastVisibleRef].current) {
        await AsyncStorage.setItem(
          `posts_${tab}`,
          JSON.stringify({
            data: updatedPosts.slice(0, POSTS_PER_PAGE),
            timestamp: Date.now(),
            lastVisible: null,
          }),
        )
      }
    } catch (error) {
      console.error(`Error fetching ${tab} posts:`, error)
    } finally {
      setLoading((prev) => ({ ...prev, [tab]: false }))
      setLoadingMore((prev) => ({ ...prev, [tab]: false }))
      setRefreshing((prev) => ({ ...prev, [tab]: false }))
    }
  }

  useEffect(() => {
    if (activeTab === "trending" && trendingPosts.length === 0) {
      fetchPosts("trending")
    } else if (activeTab === "following" && followingPosts.length === 0) {
      fetchPosts("following")
    } else if (activeTab === "fishtanks" && fishtanksPosts.length === 0) {
      fetchPosts("fishtanks")
    }
  }, [activeTab, following])

  useEffect(() => {
    fetchPosts("trending")
  }, [])

  useEffect(() => {
    if (trendingPosts.length > 0) {
      checkForDuplicates(trendingPosts, "trending");
    }
  }, [trendingPosts, checkForDuplicates]);

  useEffect(() => {
    if (followingPosts.length > 0) {
      checkForDuplicates(followingPosts, "following");
    }
  }, [followingPosts, checkForDuplicates]);

  useEffect(() => {
    if (fishtanksPosts.length > 0) {
      checkForDuplicates(fishtanksPosts, "fishtanks");
    }
  }, [fishtanksPosts, checkForDuplicates]);

  const onRefresh = useCallback(() => {
    fetchCurrentUserData()
    fetchUnreadNotificationsCount()
    fetchPosts(activeTab, true)
  }, [activeTab])

  const handleLoadMore = useCallback(() => {
    if (
      !loadingMore[activeTab as keyof typeof loadingMore] &&
      !allPostsLoaded[activeTab as keyof typeof allPostsLoaded]
    ) {
      setTimeout(() => {
        fetchPosts(activeTab);
      }, 300);
    }
  }, [activeTab, loadingMore, allPostsLoaded]);

  const handlePostDeleted = useCallback((postId: string) => {
    setTrendingPosts((prev) => prev.filter((item) => item.post.id !== postId))
    setFollowingPosts((prev) => prev.filter((item) => item.post.id !== postId))
    setFishtanksPosts((prev) => prev.filter((item) => item.post.id !== postId))

    Object.keys(postsCache.current).forEach(async (key) => {
      const cacheKey = key as keyof typeof postsCache.current
      const cache = postsCache.current[cacheKey]
      if (cache) {
        const updatedData = cache.data.filter((item) => item.post.id !== postId)
        postsCache.current[cacheKey] = {
          data: updatedData,
          timestamp: Date.now(),
        }

        await AsyncStorage.setItem(
          `posts_${key}`,
          JSON.stringify({
            data: updatedData.slice(0, POSTS_PER_PAGE),
            timestamp: Date.now(),
            lastVisible: null,
          }),
        )
      }
    })
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

  const openDrawer = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
    navigation.dispatch(DrawerActions.openDrawer())
  }, [navigation])

  const openNotifications = useCallback(async () => {
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
  }, [user?.uid, unreadNotifications, router])

  const handleTabChange = useCallback(
    (tab: string) => {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      }
      setActiveTab(tab)

      if (tab === "trending" && trendingPosts.length === 0) {
        fetchPosts("trending")
      } else if (tab === "following" && followingPosts.length === 0) {
        fetchPosts("following")
      } else if (tab === "fishtanks" && fishtanksPosts.length === 0) {
        fetchPosts("fishtanks")
      }
    },
    [trendingPosts.length, followingPosts.length, fishtanksPosts.length],
  )

  const getItemLayout = useCallback(
    (data: any, index: number) => ({
      length: POST_ITEM_HEIGHT,
      offset: POST_ITEM_HEIGHT * index,
      index,
    }),
    [],
  )
  const renderFooter = useCallback(() => {
    return <LoadingFooter loading={loadingMore[activeTab as keyof typeof loadingMore]} />
  }, [loadingMore, activeTab])

  const renderEmptyComponent = useCallback(() => {
    return <EmptyComponent loading={loading[activeTab as keyof typeof loading]} tab={activeTab} />
  }, [loading, activeTab])

  const refreshPost = async (postId: string) => {
    try {
      // Buscar el post en ambas colecciones
      const postDoc = await getDoc(doc(db, "posts", postId))
      let postData = null
      if (postDoc.exists()) {
        postData = { ...postDoc.data(), id: postDoc.id }
      } else {
        const fishtankPostDoc = await getDoc(doc(db, "fishtank_posts", postId))
        if (fishtankPostDoc.exists()) {
          postData = { ...fishtankPostDoc.data(), id: fishtankPostDoc.id }
        }
      }
      if (!postData) return
      // Buscar el usuario autor
      const userDoc = await getDoc(doc(db, "users", postData.authorId))
      if (!userDoc.exists()) return
      const user = { ...userDoc.data(), id: userDoc.id }
      // Buscar info de la pecera si aplica
      let fishtank = undefined
      if (postData.fishtankId) {
        const fishtankDoc = await getDoc(doc(db, "fishtanks", postData.fishtankId))
        if (fishtankDoc.exists()) {
          const data = fishtankDoc.data()
          fishtank = { name: data.name, fishTankPicture: data.fishTankPicture }
        }
      }
      // Actualizar el post en el estado correspondiente
      setTrendingPosts((prev) => prev.map((item) => item.post.id === postId ? { ...item, post: postData, user, fishtank } : item))
      setFollowingPosts((prev) => prev.map((item) => item.post.id === postId ? { ...item, post: postData, user, fishtank } : item))
      setFishtanksPosts((prev) => prev.map((item) => item.post.id === postId ? { ...item, post: postData, user, fishtank } : item))
    } catch (error) {
      console.error("Error refrescando post:", error)
    }
  }

  const renderItem = useCallback(
    ({ item }: { item: PostWithUser }) => {
      if (!user?.uid) return null
      return <PostItemMemo item={item} currentUserId={user.uid} onPostDeleted={handlePostDeleted} onRefreshPost={refreshPost} />
    },
    [user?.uid, handlePostDeleted],
  )

  const activeData = useMemo(() => {
    if (activeTab === "trending") return trendingPosts
    if (activeTab === "following") return followingPosts
    return fishtanksPosts
  }, [activeTab, trendingPosts, followingPosts, fishtanksPosts])

  const refreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={refreshing[activeTab as keyof typeof refreshing]}
        onRefresh={onRefresh}
        colors={["#FFFFFF"]}
        tintColor="#FFFFFF"
        progressBackgroundColor="#3A4154"
      />
    ),
    [refreshing, activeTab, onRefresh],
  )

  const handleScroll = (event: any) => {
    if (!isOceanMode) return;
    
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const scrollPercentage = contentOffset.y / (contentSize.height - layoutMeasurement.height);
    setScrollProgress(Math.min(scrollPercentage, 1));
  };

  const renderContent = () => {
    const currentListRef = activeTab === "trending" ? trendingListRef : activeTab === "following" ? followingListRef : fishtanksListRef;
    const currentPosts = activeTab === "trending" ? trendingPosts : activeTab === "following" ? followingPosts : fishtanksPosts;
    const currentLoading = loading[activeTab as keyof typeof loading];
    const currentRefreshing = refreshing[activeTab as keyof typeof refreshing];
    const currentLoadingMore = loadingMore[activeTab as keyof typeof loadingMore];

    return (
      <FlatList
        ref={currentListRef}
        data={currentPosts}
        renderItem={({ item }) => (
          <PostItemMemo
            item={item}
            currentUserId={user?.uid || ""}
            onPostDeleted={handlePostDeleted}
            onRefreshPost={refreshPost}
          />
        )}
        keyExtractor={(item) => item.post.id}
        onEndReached={() => handleLoadMore()}
        onEndReachedThreshold={0.5}
        ListFooterComponent={<LoadingFooter loading={currentLoadingMore} />}
        ListEmptyComponent={<EmptyComponent loading={currentLoading} tab={activeTab} />}
        refreshControl={
          <RefreshControl
            refreshing={currentRefreshing}
            onRefresh={() => onRefresh()}
            colors={["#FFFFFF"]}
            tintColor="#FFFFFF"
          />
        }
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.listContent}
        removeClippedSubviews={true}
        maxToRenderPerBatch={5}
        updateCellsBatchingPeriod={50}
        windowSize={10}
        initialNumToRender={5}
        getItemLayout={getItemLayout}
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
        }}
      />
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#2A3142" />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.profileButton} onPress={openDrawer}>
            <ProfileImage uri={currentUserData?.profilePicture} style={styles.profileImage} />
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

      {renderContent()}
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
    width: Platform.OS === 'web' ? "100%":"100%",
    maxWidth: Platform.OS === 'web' ? 800 : "100%",
    alignSelf: "center",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" || Platform.OS === "android" ? 50 : 16,
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
    width: Platform.OS === "ios" ? 40 : 25 ,
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
  feedContainer: {
    paddingTop: 20,
    paddingBottom: 20,  
    alignSelf: "center",
    width: Platform.OS === 'web' ? "100%":"100%",
    maxWidth: Platform.OS === 'web' ? 800 : "100%",
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
    width: Platform.OS === 'web' ? "100%":"100%",
    maxWidth: Platform.OS === 'web' ? 800 : "100%",
    alignSelf: "center",
    borderBottomRightRadius: Platform.OS === 'web' ? 20 : 0,
    borderBottomLeftRadius: Platform.OS === 'web' ? 20 : 0,
  },
  tabButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: Platform.OS === "ios" ? 12 : Platform.OS === "android" ? 4 : 4 ,
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
  listContent: {
    paddingTop: 20,
    paddingBottom: 20,  
    alignSelf: "center",
    width: Platform.OS === 'web' ? "100%":"100%",
    maxWidth: Platform.OS === 'web' ? 800 : "100%",
    flexGrow: 1,
    minHeight: 300,
  },
})

export default FeedScreen