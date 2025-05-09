"use client"

import React, { useState } from "react"
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Image,
  RefreshControl,
  ActivityIndicator,
} from "react-native"
import { useRouter } from "expo-router"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore"
import { db } from "../../../config/Firebase_Conf"
import type { User, Post } from "../../types/types" 

export default function AdminDashboard() {
  const router = useRouter()
  const [refreshing, setRefreshing] = useState(false)
  const [recentUsers, setRecentUsers] = useState<User[]>([])
  const [recentPosts, setRecentPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    users: 0,
    posts: 0,
    fishTanks: 0,
    reports: 0,
  })

  React.useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)

      const usersQuery = query(collection(db, "users"), orderBy("createdAt", "desc"), limit(5))
      const usersSnapshot = await getDocs(usersQuery)
      const usersCount = usersSnapshot.size
      const recentUsersData = usersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as User)

      const postsQuery = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(5))
      const postsSnapshot = await getDocs(postsQuery)
      const postsCount = postsSnapshot.size
      const recentPostsData = postsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Post)

      console.log("Consultando colección 'peceras'...")
      const pecerasQuery = query(collection(db, "peceras"))
      const pecerasSnapshot = await getDocs(pecerasQuery)
      const pecerasCount = pecerasSnapshot.size
      
      console.log("Peceras encontradas:", pecerasCount)

      setStats({
        users: usersCount,
        posts: postsCount,
        fishTanks: pecerasCount, 
        reports: 0,
      })

      setRecentUsers(recentUsersData)
      setRecentPosts(recentPostsData)
    } catch (error) {
      console.error("Error al cargar datos del dashboard:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const onRefresh = () => {
    setRefreshing(true)
    fetchDashboardData()
  }

  const adminModules = [
    {
      title: "Usuarios",
      icon: "account-group",
      count: stats.users,
      onPress: () => router.push("/(drawer)/(admintabs)/users"),
    },
    {
      title: "Posts",
      icon: "post",
      count: stats.posts,
      onPress: () => router.push("/(drawer)/(admintabs)/posts"),
    },
    {
      title: "Peceras",
      icon: "fish",
      count: stats.fishTanks,
      onPress: () => router.push("/(drawer)/(admintabs)/fishtanks"),
    },
    {
      title: "Reportes",
      icon: "flag",
      count: stats.reports,
      onPress: () => router.push("/(drawer)/(admintabs)/reports"),
    },
  ]

  const renderUserItem = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={styles.userItem}
      onPress={() =>
        router.push({
          pathname: "/(drawer)/(admin)/user-detail",
          params: { userId: item.id },
        })
      }
    >
      <Image
        source={
          item.profilePicture ? { uri: item.profilePicture } : require("../../../assets/placeholders/user_icon.png")
        }
        style={styles.userAvatar}
      />
      <View style={styles.userInfo}>
        <Text style={styles.userName}>
          {item.name} {item.lastName}
        </Text>
        <Text style={styles.userUsername}>@{item.username}</Text>
        <View style={styles.userMeta}>
          <Text style={styles.userMetaText}>
            {item.isVerified && "✓ "}
            {item.isAdmin && "Admin • "}
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  )

  const renderPostItem = ({ item }: { item: Post }) => (
    <TouchableOpacity
      style={styles.postItem}
      onPress={() =>
        router.push({
          pathname: "/(drawer)/(admin)/post-detail",
          params: { postId: item.id },
        })
      }
    >
      <View style={styles.postHeader}>
        <Text style={styles.postAuthor}>Post de {item.authorId}</Text>
        <Text style={styles.postDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
      </View>
      <Text style={styles.postContent} numberOfLines={2}>
        {item.content || "(Sin contenido)"}
      </Text>
      <View style={styles.postStats}>
        <View style={styles.postStat}>
          <MaterialCommunityIcons name="comment-outline" size={14} color="#D1D5DB" />
          <Text style={styles.postStatText}>{item.commentCount}</Text>
        </View>
        <View style={styles.postStat}>
          <MaterialCommunityIcons name="fish" size={14} color="#D1D5DB" />
          <Text style={styles.postStatText}>{item.reactionCounts.fish}</Text>
        </View>
        <View style={styles.postStat}>
          <MaterialCommunityIcons name="hook" size={14} color="#D1D5DB" />
          <Text style={styles.postStatText}>{item.reactionCounts.bait}</Text>
        </View>
        <View style={styles.postStat}>
          <MaterialCommunityIcons name="wave" size={14} color="#D1D5DB" />
          <Text style={styles.postStatText}>{item.reactionCounts.wave}</Text>
        </View>
      </View>
    </TouchableOpacity>
  )

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingText}>Cargando panel de administración...</Text>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Panel de Administración</Text>
          <Text style={styles.headerSubtitle}>Gestiona tu aplicación FISHER</Text>
        </View>

        <View style={styles.statsContainer}>
          {adminModules.map((module, index) => (
            <TouchableOpacity key={index} style={styles.statCard} onPress={module.onPress}>
              <MaterialCommunityIcons name={module.icon as any} size={32} color="#FFFFFF" />
              <Text style={styles.statCount}>{module.count}</Text>
              <Text style={styles.statTitle}>{module.title}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Usuarios Recientes</Text>
            <TouchableOpacity onPress={() => router.push("/(drawer)/(admintabs)/users")}>
              <Text style={styles.sectionLink}>Ver todos</Text>
            </TouchableOpacity>
          </View>

          {recentUsers.length > 0 ? (
            <FlatList
              data={recentUsers}
              renderItem={renderUserItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No hay usuarios recientes</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Posts Recientes</Text>
            <TouchableOpacity onPress={() => router.push("/(drawer)/(admintabs)/posts")}>
              <Text style={styles.sectionLink}>Ver todos</Text>
            </TouchableOpacity>
          </View>

          {recentPosts.length > 0 ? (
            <FlatList
              data={recentPosts}
              renderItem={renderPostItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No hay posts recientes</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Acciones Rápidas</Text>
          </View>

          <View style={styles.quickActions}>

            <TouchableOpacity style={styles.quickActionButton} onPress={() => router.push("/(drawer)/(admintabs)/reports")}>
              <MaterialCommunityIcons name="flag" size={24} color="#FFFFFF" />
              <Text style={styles.quickActionText}>Ver Reportes</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => router.push("/(drawer)/(tabs)/stacksettings")}
            >
              <MaterialCommunityIcons name="cog" size={24} color="#FFFFFF" />
              <Text style={styles.quickActionText}>Configuración</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#3C4255",
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#3C4255",
  },
  loadingText: {
    color: "#FFFFFF",
    marginTop: 12,
    fontSize: 16,
    fontWeight: "500",
  },
  header: {
    backgroundColor: "#4C5366",
    padding: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: "#E0E0E0",
  },
  statsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    padding: 16,
    marginTop: 8,
  },
  statCard: {
    width: "48%",
    backgroundColor: "#4C5366",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  statCount: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginTop: 8,
  },
  statTitle: {
    fontSize: 14,
    color: "#D1D5DB",
    marginTop: 4,
  },
  section: {
    marginTop: 8,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  sectionLink: {
    fontSize: 14,
    color: "#8BB9FE",
    fontWeight: "500",
  },
  userItem: {
    flexDirection: "row",
    backgroundColor: "#4C5366",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#FFFFFF",
  },
  userUsername: {
    fontSize: 14,
    color: "#D1D5DB",
  },
  userMeta: {
    marginTop: 4,
  },
  userMetaText: {
    fontSize: 12,
    color: "#A0AEC0",
  },
  postItem: {
    backgroundColor: "#4C5366",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  postHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  postAuthor: {
    fontSize: 14,
    fontWeight: "500",
    color: "#FFFFFF",
  },
  postDate: {
    fontSize: 12,
    color: "#A0AEC0",
  },
  postContent: {
    fontSize: 14,
    color: "#E0E0E0",
    marginBottom: 8,
  },
  postStats: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#5C6377",
    paddingTop: 8,
  },
  postStat: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
  },
  postStatText: {
    fontSize: 12,
    color: "#D1D5DB",
    marginLeft: 4,
  },
  emptyState: {
    padding: 20,
    alignItems: "center",
    backgroundColor: "#4C5366",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  emptyStateText: {
    color: "#D1D5DB",
    fontSize: 14,
  },
  quickActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  quickActionButton: {
    width: "48%",
    backgroundColor: "#4C5366",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  quickActionText: {
    fontSize: 14,
    color: "#FFFFFF",
    marginTop: 8,
    textAlign: "center",
    fontWeight: "500",
  },
})