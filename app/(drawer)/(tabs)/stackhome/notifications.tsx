"use client"

import { useState, useEffect, useCallback } from "react"
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  SafeAreaView,
  Platform,
} from "react-native"
import { useRouter, Stack } from "expo-router"
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons"
import { useAuth } from "@/context/AuthContext"
import { collection, query, where, getDocs, doc, getDoc, orderBy } from "firebase/firestore"
import { db } from "../../../../config/Firebase_Conf"
import * as Haptics from "expo-haptics"
import { markAllNotificationsAsRead, markNotificationAsRead } from "../../../../lib/notifications"
import type { Notification, User } from "@/app/types/types"

const NotificationsScreen = () => {
  const router = useRouter()
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<(Notification & { triggerUser?: User })[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [markingAllAsRead, setMarkingAllAsRead] = useState(false)

  const fetchNotifications = useCallback(async () => {
    if (!user?.uid) return

    try {
      setLoading(true)

      const notificationsQuery = query(
        collection(db, "notifications"),
        where("recipientId", "==", user.uid),
        orderBy("createdAt", "desc"),
      )

      const snapshot = await getDocs(notificationsQuery)
      const notificationsData = snapshot.docs.map((doc) => doc.data() as Notification)

      const userIds = [...new Set(notificationsData.map((n) => n.triggeredBy))]
      const usersData: Record<string, User> = {}

      for (const userId of userIds) {
        const userDoc = await getDoc(doc(db, "users", userId))
        if (userDoc.exists()) {
          usersData[userId] = userDoc.data() as User
        }
      }

      const notificationsWithUsers = notificationsData.map((notification) => ({
        ...notification,
        triggerUser: usersData[notification.triggeredBy],
      }))

      setNotifications(notificationsWithUsers)
    } catch (error) {
      console.error("Error al cargar notificaciones:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user?.uid])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const onRefresh = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
    setRefreshing(true)
    fetchNotifications()
  }, [fetchNotifications])

  const handleMarkAllAsRead = async () => {
    if (!user?.uid || markingAllAsRead) return

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    }

    setMarkingAllAsRead(true)

    try {
      const success = await markAllNotificationsAsRead(user.uid)

      if (success) {
        setNotifications((prev) =>
          prev.map((notification) => ({
            ...notification,
            isRead: true,
          })),
        )
      }
    } catch (error) {
      console.error("Error al marcar notificaciones como leídas:", error)
    } finally {
      setMarkingAllAsRead(false)
    }
  }

  const handleNotificationPress = async (notification: Notification & { triggerUser?: User }) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }

    try {
      if (!notification.isRead) {
        await markNotificationAsRead(notification.id)

        setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)))
      }

      if (notification.pathname) {
        router.push({
          pathname: notification.pathname,
          params: notification.params || {},
        })
      } else if (notification.targetPostId) {
        router.push({
          pathname: "/(drawer)/(tabs)/stackhome/post-detail",
          params: { postId: notification.targetPostId },
        })
      } else if (notification.type === "Follow" && notification.triggeredBy) {
        router.push({
          pathname: "/(drawer)/(tabs)/stackhome/profile",
          params: { userId: notification.triggeredBy },
        })
      }
    } catch (error) {
      console.error("Error al procesar notificación:", error)
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

  const renderNotificationItem = ({ item }: { item: Notification & { triggerUser?: User } }) => (
    <TouchableOpacity
      style={[styles.notificationItem, item.isRead ? styles.notificationItemRead : styles.notificationItemUnread]}
      onPress={() => handleNotificationPress(item)}
    >
      <View style={styles.notificationIconContainer}>{renderNotificationIcon(item.type)}</View>

      <View style={styles.notificationContent}>
        <View style={styles.notificationHeader}>
          {item.triggerUser?.profilePicture ? (
            <Image source={{ uri: item.triggerUser.profilePicture }} style={styles.userAvatar} />
          ) : (
            <View style={[styles.userAvatar, styles.userAvatarPlaceholder]}>
              <Feather name="user" size={12} color="#AAAAAA" />
            </View>
          )}

          <Text style={styles.username}>@{item.triggerUser?.username || "Usuario"}</Text>

          <Text style={styles.notificationTime}>{formatNotificationTime(item.createdAt)}</Text>
        </View>

        <Text style={styles.notificationText}>{item.content}</Text>
      </View>

      {!item.isRead && <View style={styles.unreadIndicator} />}
    </TouchableOpacity>
  )

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
        <TouchableOpacity
          onPress={handleMarkAllAsRead}
          disabled={markingAllAsRead || notifications.every((n) => n.isRead)}
          style={[
            styles.markAllReadButton,
            (markingAllAsRead || notifications.every((n) => n.isRead)) && styles.markAllReadButtonDisabled,
          ]}
        >
          {markingAllAsRead ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.markAllReadText}>Marcar todo como leído</Text>
          )}
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotificationItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.notificationsList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#FFFFFF"]}
              tintColor="#FFFFFF"
              progressBackgroundColor="#3A4154"
            />
          }
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
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 10 : 30,
    paddingBottom: 8,
    backgroundColor: "#3C4255",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  markAllReadButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: "#4C5366",
  },
  markAllReadButtonDisabled: {
    opacity: 0.5,
  },
  markAllReadText: {
    color: "#FFFFFF",
    fontSize: 12,
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
  notificationItemUnread: {
    backgroundColor: "#3A4154",
  },
  notificationItemRead: {
    backgroundColor: "transparent",
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
