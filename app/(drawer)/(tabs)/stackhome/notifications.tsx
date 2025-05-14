"use client"

import { useEffect, useState, useCallback } from "react"
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  Platform,
  SafeAreaView,
} from "react-native"
import { useAuth } from "@/context/AuthContext"
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons"
import { useRouter, Stack } from "expo-router"
import { doc, getDoc } from "firebase/firestore"
import { ref, onValue, get } from "firebase/database"
import { db, rtdb } from "../../../../config/Firebase_Conf"
import type { Notification, User } from "../../../types/types"
import { markNotificationAsRead } from "../../../../lib/notifications"
import * as Haptics from "expo-haptics"

const NotificationsScreen = () => {
  const { user } = useAuth()
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [users, setUsers] = useState<Record<string, User>>({})

  const loadUserData = async (userIds: string[]) => {
    try {
      const uniqueUserIds = [...new Set(userIds)]
      const usersData: Record<string, User> = {}

      for (const userId of uniqueUserIds) {
        const userDoc = await getDoc(doc(db, "users", userId))
        if (userDoc.exists()) {
          usersData[userId] = userDoc.data() as User
        }
      }

      setUsers(usersData)
    } catch (error) {
      console.error("Error al cargar datos de usuarios:", error)
    }
  }

  useEffect(() => {
    if (!user?.uid) return

    setLoading(true)

    const userNotificationsRef = ref(rtdb, `user-notifications/${user.uid}`)

    const unsubscribe = onValue(userNotificationsRef, async (snapshot) => {
      try {
        if (!snapshot.exists()) {
          setNotifications([])
          setLoading(false)
          return
        }

        const notificationsData: Notification[] = []
        const notificationPromises: Promise<void>[] = []
        const userIdsToLoad: string[] = []

        snapshot.forEach((childSnapshot) => {
          const notificationId = childSnapshot.key
          if (!notificationId) return

          const promise = new Promise<void>((resolve, reject) => {
            onValue(
              ref(rtdb, `notifications/${notificationId}`),
              (notifSnapshot) => {
                if (notifSnapshot.exists()) {
                  const notificationData = notifSnapshot.val() as Notification
                  notificationsData.push(notificationData)

                  if (notificationData.triggeredBy) {
                    userIdsToLoad.push(notificationData.triggeredBy)
                  }
                }
                resolve()
              },
              (error) => {
                console.error(`Error al obtener notificación ${notificationId}:`, error)
                reject(error)
              }
            )
          })

          notificationPromises.push(promise)
        })

        await Promise.all(notificationPromises)

        notificationsData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

        setNotifications(notificationsData)

        await loadUserData(userIdsToLoad)
      } catch (error) {
        console.error("Error al procesar notificaciones:", error)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [user?.uid])

  const handleNotificationPress = async (notification: Notification) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }

    try {
      if (!notification.isRead && user?.uid) {
        await markNotificationAsRead(notification.id, user.uid)

        setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)))
      }

      if (notification.targetPostId) {
        router.push({
          pathname: "/(drawer)/(tabs)/stackhome/post-detail",
          params: { postId: notification.targetPostId },
        })
      } else if (notification.pathname && notification.params) {
        router.push({
          pathname: notification.pathname,
          params: notification.params,
        })
      } else if (notification.pathname) {
        router.push(notification.pathname)
      } else if (notification.triggeredBy) {
        router.push({
          pathname: "/(drawer)/(tabs)/stackhome/profile",
          params: { userId: notification.triggeredBy },
        })
      }
    } catch (error) {
      console.error("Error al manejar notificación:", error)
    }
  }

  const renderNotificationIcon = (type: string) => {
    switch (type) {
      case "Comment":
        return <Feather name="message-circle" size={20} color="#FFFFFF" style={styles.notificationTypeIcon} />
      case "Fish":
        return <MaterialCommunityIcons name="fish" size={20} color="#FF6B6B" style={styles.notificationTypeIcon} />
      case "Bait":
        return <Feather name="anchor" size={20} color="#4ECDC4" style={styles.notificationTypeIcon} />
      case "Follow":
        return <Feather name="user-plus" size={20} color="#8BB9FE" style={styles.notificationTypeIcon} />
      case "Post":
        return <Feather name="file-text" size={20} color="#FFFFFF" style={styles.notificationTypeIcon} />
      case "Wave":
        return <MaterialCommunityIcons name="waves" size={20} color="#4A6FFF" style={styles.notificationTypeIcon} />
      default:
        return <Feather name="bell" size={20} color="#FFFFFF" style={styles.notificationTypeIcon} />
    }
  }

  const renderNotificationItem = ({ item }: { item: Notification }) => {
    const triggerUser = users[item.triggeredBy]

    return (
      <TouchableOpacity
        style={[styles.notificationItem, !item.isRead && styles.unreadNotification]}
        onPress={() => handleNotificationPress(item)}
      >
        <View style={styles.notificationIconContainer}>{renderNotificationIcon(item.type)}</View>

        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            {triggerUser?.profilePicture ? (
              <Image source={{ uri: triggerUser.profilePicture }} style={styles.userAvatar} />
            ) : (
              <View style={[styles.userAvatar, styles.userAvatarPlaceholder]}>
                <Feather name="user" size={12} color="#AAAAAA" />
              </View>
            )}

            <Text style={styles.username}>@{triggerUser?.username || "Usuario"}</Text>

            <Text style={styles.notificationTime}>{formatNotificationTime(item.createdAt)}</Text>
          </View>

          <Text style={styles.notificationText}>{item.content}</Text>
        </View>

        {!item.isRead && <View style={styles.unreadIndicator} />}
      </TouchableOpacity>
    )
  }

  const formatNotificationTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.round(diffMs / 60000)
    const diffHours = Math.round(diffMins / 60)
    const diffDays = Math.round(diffHours / 24)

    if (diffMins < 1) return "ahora"
    if (diffMins < 60) return `${diffMins}m`
    if (diffHours < 24) return `${diffHours}h`
    if (diffDays < 7) return `${diffDays}d`

    return date.toLocaleDateString()
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notificaciones</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotificationItem}
          contentContainerStyle={styles.notificationsList}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="bell-off" size={60} color="#8BB9FE" />
              <Text style={styles.emptyText}>No tienes notificaciones</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#2A3142",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 10 : 30,
    paddingBottom: 16,
    backgroundColor: "#3C4255",
  },
  backButton: {
    padding: 8,
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  notificationsList: {
    paddingVertical: 8,
  },
  notificationItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#3A4154",
  },
  notificationIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#4C5366",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  notificationTypeIcon: {},
  unreadNotification: {
    backgroundColor: "#3A4154",
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  userAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  userAvatarPlaceholder: {
    backgroundColor: "#4C5366",
    justifyContent: "center",
    alignItems: "center",
  },
  username: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },
  notificationTime: {
    color: "#AAAAAA",
    fontSize: 12,
    marginLeft: "auto",
  },
  notificationText: {
    color: "#E0E0E0",
    fontSize: 14,
  },
  unreadIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#8BB9FE",
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
  },
  emptyText: {
    color: "#FFFFFF",
    fontSize: 16,
    marginTop: 16,
  },
})

export default NotificationsScreen
