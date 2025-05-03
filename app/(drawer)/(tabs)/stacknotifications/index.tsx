"use client"

import { useState, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SectionList,
} from "react-native"
import { Feather } from "@expo/vector-icons"
import { getFirestore, doc, getDoc, updateDoc } from "firebase/firestore"
import { useAuth } from "@/context/AuthContext"
import { format } from "date-fns"
import type { Notification, User } from "../../../types/types"

interface NotificationWithUser extends Notification {
  user?: User
}

interface NotificationSection {
  title: string
  data: NotificationWithUser[]
}

const NotificationsScreen = () => {
  const [notifications, setNotifications] = useState<NotificationWithUser[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [sections, setSections] = useState<NotificationSection[]>([])
  const [userData, setUserData] = useState<User | null>(null)
  const { user } = useAuth()

  useEffect(() => {
    if (user?.uid) {
      fetchUserData()
      fetchNotifications()
    }
  }, [user])

  const fetchUserData = async () => {
    try {
      if (!user?.uid) return
      
      const db = getFirestore()
      const userRef = doc(db, "users", user.uid)
      const userDoc = await getDoc(userRef)

      if (userDoc.exists()) {
        const userDataFromFirestore = userDoc.data() as User
        setUserData(userDataFromFirestore)
      }
    } catch (error) {
      console.error("Error fetching user data:", error)
    }
  }

  const fetchNotifications = async () => {
    try {
      if (!user?.uid) return
      
      setLoading(true)
      const db = getFirestore()

      // Get notifications document for current user
      const notificationsRef = doc(db, "notifications", user.uid)
      const notificationsDoc = await getDoc(notificationsRef)

      if (!notificationsDoc.exists()) {
        setNotifications([])
        setLoading(false)
        return
      }

      const notificationsData = notificationsDoc.data()
      const userNotifications = notificationsData.notifications || []

      userNotifications.sort(
        (a: Notification, b: Notification) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )

      const userIds = [...new Set(userNotifications.map((n: Notification) => n.triggeredBy))]
      const usersData: Record<string, User> = {}

      for (const userId of userIds) {
        const userDoc = await getDoc(doc(db, "users", userId as string))
        if (userDoc.exists()) {
          usersData[userId as string] = userDoc.data() as User
        }
      }

      const notificationsWithUsers = userNotifications.map((notification: Notification) => ({
        ...notification,
        user: usersData[notification.triggeredBy],
      }))

      setNotifications(notificationsWithUsers)

      // Mark all notifications as read
      if (userNotifications.some((n: Notification) => !n.isRead)) {
        const updatedNotifications = userNotifications.map((n: Notification) => ({
          ...n,
          isRead: true,
        }))

        await updateDoc(notificationsRef, {
          notifications: updatedNotifications,
        })

        // Update user's notification count
        if (user) {
          await updateDoc(doc(db, "users", user.uid), {
            notificationCount: 0,
          })
        }
      }

      groupNotificationsByDate(notificationsWithUsers)
    } catch (error) {
      console.error("Error fetching notifications:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const groupNotificationsByDate = (notificationsData: NotificationWithUser[]) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const weekAgo = new Date(today)
    weekAgo.setDate(weekAgo.getDate() - 7)

    const todayNotifications: NotificationWithUser[] = []
    const yesterdayNotifications: NotificationWithUser[] = []
    const weekNotifications: NotificationWithUser[] = []
    const olderNotifications: NotificationWithUser[] = []

    notificationsData.forEach((notification) => {
      const notificationDate = new Date(notification.createdAt)
      notificationDate.setHours(0, 0, 0, 0)

      if (notificationDate.getTime() === today.getTime()) {
        todayNotifications.push(notification)
      } else if (notificationDate.getTime() === yesterday.getTime()) {
        yesterdayNotifications.push(notification)
      } else if (notificationDate.getTime() >= weekAgo.getTime()) {
        weekNotifications.push(notification)
      } else {
        olderNotifications.push(notification)
      }
    })

    const newSections: NotificationSection[] = []

    if (todayNotifications.length > 0) {
      newSections.push({ title: "Today", data: todayNotifications })
    }

    if (yesterdayNotifications.length > 0) {
      newSections.push({ title: "Yesterday", data: yesterdayNotifications })
    }

    if (weekNotifications.length > 0) {
      newSections.push({ title: "7 Days Ago", data: weekNotifications })
    }

    if (olderNotifications.length > 0) {
      newSections.push({ title: "Older", data: olderNotifications })
    }

    setSections(newSections)
  }

  const onRefresh = () => {
    setRefreshing(true)
    fetchUserData()
    fetchNotifications()
  }

  const getNotificationText = (notification: Notification) => {
    switch (notification.type) {
      case "Follow":
        return "started following you."
      case "Fish":
        return "gave you a fish in your post."
      case "Bait":
        return "gave you a bait in your post."
      case "Comment":
        return "commented on your post."
      case "Wave":
        return "waved your post."
      default:
        return "interacted with your content."
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return format(date, "h:mm a")
  }

  const renderNotificationItem = ({ item }: { item: NotificationWithUser }) => {
    return (
      <TouchableOpacity style={styles.notificationItem}>
        <Image source={{ uri: item.user?.profilePicture || "https://via.placeholder.com/50" }} style={styles.avatar} />
        <View style={styles.notificationContent}>
          <Text style={styles.notificationText}>
            <Text style={styles.username}>{item.user?.name || "User"}</Text> {getNotificationText(item)}
          </Text>
          <Text style={styles.timestamp}>{formatTime(item.createdAt)}</Text>
        </View>
      </TouchableOpacity>
    )
  }

  const renderSectionHeader = ({ section }: { section: NotificationSection }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
    </View>
  )

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.userInfoContainer}>
          {userData?.profilePicture ? (
            <Image source={{ uri: userData.profilePicture }} style={styles.userAvatar} />
          ) : (
            <Image source={require('../../../../assets/placeholders/user_icon.png') } style={styles.userAvatar} />
          )}
           <View style={styles.userTextContainer}>
            <Text style={styles.headerTitle}>
              {userData?.name && userData?.lastName 
                ? `${userData.name} ${userData.lastName}` 
                : userData?.name || "User"}
            </Text>
            <Text style={styles.username}>@{userData?.username || "user"}</Text>
          </View>
        </View>
      </View>

      {sections.length > 0 ? (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderNotificationItem}
          renderSectionHeader={renderSectionHeader}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#FFFFFF"]}
              tintColor="#FFFFFF"
              progressBackgroundColor="#3A4154"
            />
          }
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Feather name="bell" size={50} color="#AAAAAA" />
          <Text style={styles.emptyText}>No notifications yet</Text>
          <Text style={styles.emptySubtext}>When someone interacts with your content, you'll see it here.</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#2A2F42",
  },
  header: {
    paddingTop: 60,
    paddingBottom: 15,
    paddingHorizontal: 20,
    backgroundColor: "#2A2F42",
  },
  userInfoContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  userAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#3A4154",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  userInitials: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  userTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  username: {
    fontSize: 16,
    color: "#AAAAAA",
    marginTop: 2,
  },
  listContent: {
    paddingBottom: 20,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#2A2F42",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  notificationItem: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "#2A2F42",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#DDDDDD",
  },
  notificationContent: {
    flex: 1,
    marginLeft: 15,
    justifyContent: "center",
  },
  notificationText: {
    fontSize: 16,
    color: "#FFFFFF",
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 14,
    color: "#AAAAAA",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#2A2F42",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 16,
    color: "#AAAAAA",
    textAlign: "center",
    marginTop: 10,
  },
})

export default NotificationsScreen

