"use client"

import { useState, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Platform,
} from "react-native"
import { useRouter } from "expo-router"
import { useRoute, type RouteProp } from "@react-navigation/native"
import { Feather } from "@expo/vector-icons"
import { collection, query, where, getDocs, doc, getDoc, addDoc, deleteDoc } from "firebase/firestore"
import { db } from "../../../../config/Firebase_Conf"
import { useAuth } from "@/context/AuthContext"
import type { User } from "@/app/types/types"

type FollowersScreenParams = {
  userId: string
  type: "followers" | "following"
}

const FollowersScreen = () => {
  const route = useRoute<RouteProp<{ params: FollowersScreenParams }, "params">>()
  const router = useRouter()
  const { user: currentUser } = useAuth()
  const { userId, type } = route.params

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({})
  const [followingInProgress, setFollowingInProgress] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true)

        // Determinar qué campo consultar basado en el tipo
        const fieldToQuery = type === "followers" ? "followingId" : "followerId"
        const otherField = type === "followers" ? "followerId" : "followingId"

        // Consultar las relaciones de seguimiento
        const followsQuery = query(collection(db, "follows"), where(fieldToQuery, "==", userId))

        const followsSnapshot = await getDocs(followsQuery)

        if (followsSnapshot.empty) {
          setUsers([])
          setLoading(false)
          return
        }

        // Extraer los IDs de usuarios
        const userIds = followsSnapshot.docs.map((doc) => doc.data()[otherField])

        // Obtener los datos de cada usuario
        const usersData: User[] = []

        for (const id of userIds) {
          const userDoc = await getDoc(doc(db, "users", id))
          if (userDoc.exists()) {
            usersData.push({ id, ...userDoc.data() } as User)
          }
        }

        setUsers(usersData)

        // Check which users the current user is following
        if (currentUser?.uid) {
          await checkFollowingStatus(usersData)
        }
      } catch (error) {
        console.error("Error fetching users:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchUsers()
  }, [userId, type, currentUser?.uid])

  const checkFollowingStatus = async (usersData: User[]) => {
    if (!currentUser?.uid) return

    try {
      const followingStatus: Record<string, boolean> = {}

      // For each user in the list, check if current user is following them
      for (const user of usersData) {
        if (user.id === currentUser.uid) continue // Skip self

        const followQuery = query(
          collection(db, "follows"),
          where("followerId", "==", currentUser.uid),
          where("followingId", "==", user.id),
        )

        const followSnapshot = await getDocs(followQuery)
        followingStatus[user.id] = !followSnapshot.empty
      }

      setFollowingMap(followingStatus)
    } catch (error) {
      console.error("Error checking following status:", error)
    }
  }

  const handleFollowToggle = async (targetUserId: string) => {
    if (!currentUser?.uid || followingInProgress[targetUserId]) return

    try {
      setFollowingInProgress((prev) => ({ ...prev, [targetUserId]: true }))

      const isFollowing = followingMap[targetUserId]

      if (isFollowing) {
        // Unfollow: Delete the follow document
        const followQuery = query(
          collection(db, "follows"),
          where("followerId", "==", currentUser.uid),
          where("followingId", "==", targetUserId),
        )

        const followSnapshot = await getDocs(followQuery)

        if (!followSnapshot.empty) {
          // There should be only one document matching these criteria
          const followDoc = followSnapshot.docs[0]
          await deleteDoc(doc(db, "follows", followDoc.id))
        }
      } else {
        // Follow: Create a new follow document
        await addDoc(collection(db, "follows"), {
          followerId: currentUser.uid,
          followingId: targetUserId,
          createdAt: new Date().toISOString(),
        })
      }

      // Update local state
      setFollowingMap((prev) => ({
        ...prev,
        [targetUserId]: !isFollowing,
      }))
    } catch (error) {
      console.error("Error toggling follow status:", error)
    } finally {
      setFollowingInProgress((prev) => ({ ...prev, [targetUserId]: false }))
    }
  }

  const navigateToProfile = (userId: string) => {
    router.push({
      pathname: "/(drawer)/(tabs)/stackhome/profile",
      params: { userId },
    })
  }

  const renderUserItem = ({ item }: { item: User }) => {
    const isFollowing = followingMap[item.id] || false
    const inProgress = followingInProgress[item.id] || false

    return (
      <TouchableOpacity style={styles.userItem} onPress={() => navigateToProfile(item.id)}>
        <Image source={{ uri: item.profilePicture || "https://via.placeholder.com/50" }} style={styles.avatar} />
        <View style={styles.userInfo}>
          <Text style={styles.username}>@{item.username}</Text>
          <Text style={styles.bio} numberOfLines={1}>
            {item.bio || "Sin descripción"}
          </Text>
        </View>
        {currentUser?.uid !== item.id && (
          <TouchableOpacity
            style={[styles.followButton, isFollowing && styles.followingButton]}
            onPress={() => handleFollowToggle(item.id)}
            disabled={inProgress}
          >
            {inProgress ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.followButtonText}>{isFollowing ? "Siguiendo" : "Seguir"}</Text>
            )}
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.bigcontainer}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{type === "followers" ? "Seguidores" : "Siguiendo"}</Text>
          <View style={{ width: 24 }} />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFFFFF" />
          </View>
        ) : (
          <FlatList
            data={users}
            renderItem={renderUserItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {type === "followers" ? "Este usuario no tiene seguidores aún" : "Este usuario no sigue a nadie aún"}
                </Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  bigcontainer: {
    flex: 1,
    backgroundColor: "#2A3142",
  },
  container: {
    flex: 1,
    backgroundColor: "#2A3142",
    width: Platform.OS === "web" ? "100%" : "100%",
    maxWidth: Platform.OS === "web" ? 800 : "100%",
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" || Platform.OS === "android" ? 50 : 16,
    backgroundColor: "#3C4255",
    borderBottomWidth: 1,
    borderBottomColor: "#4C5366",
    borderBottomRightRadius: Platform.OS === "web" ? 20 : 0,
    borderBottomLeftRadius: Platform.OS === "web" ? 20 : 0,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContainer: {
    padding: 16,
  },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#3C4255",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#D9D9D9",
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  username: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  bio: {
    fontSize: 14,
    color: "#D9D9D9",
    marginTop: 2,
  },
  followButton: {
    backgroundColor: "#8BB9FE",
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    minWidth: 90,
    alignItems: "center",
  },
  followingButton: {
    backgroundColor: "#4C5366",
  },
  followButtonText: {
    color: "#FFFFFF",
    fontWeight: "500",
    fontSize: 14,
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    color: "#D9D9D9",
    fontSize: 16,
    textAlign: "center",
  },
})

export default FollowersScreen
