"use client"

import React, { useState, useEffect, useCallback } from "react"
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
  Platform,
} from "react-native"
import { useRouter, useFocusEffect, Stack } from "expo-router"
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons"
import { 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  limit,
  onSnapshot,
  doc,
  getDoc
} from "firebase/firestore"
import { db } from "../../../config/Firebase_Conf"
import { useAuth } from "@/context/AuthContext"
import { useNavigation, DrawerActions } from "@react-navigation/native"
import * as Haptics from "expo-haptics"
import type { User, Post } from "../../types/types" 

interface FishTank {
  id: string
  name: string
  description?: string
  fishTankPicture?: string
  isPrivate: boolean
  isVerified: boolean
  creatorId: string
  memberCount: number
  pendingCount: number
  adminCount: number
  createdAt: string
  updatedAt: string
}

export default function AdminDashboard() {
  const router = useRouter()
  const navigation = useNavigation()
  const { user } = useAuth()
  const [refreshing, setRefreshing] = useState(false)
  const [recentUsers, setRecentUsers] = useState<User[]>([])
  const [recentPosts, setRecentPosts] = useState<Post[]>([])
  const [recentFishtanks, setRecentFishtanks] = useState<FishTank[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserData, setCurrentUserData] = useState<User | null>(null)
  const [stats, setStats] = useState({
    users: 0,
    posts: 0,
    fishTanks: 0,
    reports: 0,
  })

  const openDrawer = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
    navigation.dispatch(DrawerActions.openDrawer())
  }, [navigation])

  const fetchCurrentUserData = async () => {
    if (!user?.uid) return

    try {
      const userRef = doc(db, "users", user.uid)
      const userDoc = await getDoc(userRef)

      if (userDoc.exists()) {
        setCurrentUserData(userDoc.data() as User)
      }
    } catch (error) {
      console.error("Error fetching current user data:", error)
    }
  }

  const fetchRecentData = async () => {
    try {
      const usersQuery = query(collection(db, "users"), orderBy("createdAt", "desc"), limit(5))
      const usersSnapshot = await getDocs(usersQuery)
      const recentUsersData = usersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as User)
      setRecentUsers(recentUsersData)

      const postsQuery = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(5))
      const postsSnapshot = await getDocs(postsQuery)
      const recentPostsData = postsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Post)
      setRecentPosts(recentPostsData)

      // Fetching recent fishtanks
      const fishtanksQuery = query(collection(db, "fishtanks"), orderBy("createdAt", "desc"), limit(5))
      const fishtanksSnapshot = await getDocs(fishtanksQuery)
      const recentFishtanksData = fishtanksSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as FishTank)
      setRecentFishtanks(recentFishtanksData)
    } catch (error) {
      console.error("Error al cargar datos recientes:", error)
    }
  }

  useEffect(() => {
    setLoading(true)
    fetchCurrentUserData()
    
    console.log("Configurando listeners en tiempo real...")
    
    const unsubscribeUsers = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        setStats(prevStats => ({
          ...prevStats,
          users: snapshot.size
        }))
        console.log("Actualización en tiempo real: Usuarios =", snapshot.size)
      },
      (error) => {
        console.error("Error en listener de usuarios:", error)
      }
    )
    
    const unsubscribePosts = onSnapshot(
      collection(db, "posts"),
      (snapshot) => {
        setStats(prevStats => ({
          ...prevStats,
          posts: snapshot.size
        }))
        console.log("Actualización en tiempo real: Posts =", snapshot.size)
      },
      (error) => {
        console.error("Error en listener de posts:", error)
      }
    )
    
    const unsubscribeFishtanks = onSnapshot(
      collection(db, "fishtanks"),
      (snapshot) => {
        setStats(prevStats => ({
          ...prevStats,
          fishTanks: snapshot.size
        }))
        console.log("Actualización en tiempo real: Peceras =", snapshot.size)
      },
      (error) => {
        console.error("Error en listener de peceras:", error)
      }
    )
    
    const unsubscribeReports = onSnapshot(
      collection(db, "reports"),
      (snapshot) => {
        setStats(prevStats => ({
          ...prevStats,
          reports: snapshot.size
        }))
        console.log("Actualización en tiempo real: Reportes =", snapshot.size)
      },
      (error) => {
        if (error.code !== 'permission-denied') {
          console.error("Error en listener de reportes:", error)
        }
      }
    )
    
    fetchRecentData().then(() => {
      setLoading(false)
    })
    
    return () => {
      console.log("Limpiando listeners...")
      unsubscribeUsers()
      unsubscribePosts()
      unsubscribeFishtanks()
      unsubscribeReports()
    }
  }, [])

  useFocusEffect(
    React.useCallback(() => {
      console.log("Dashboard recibió foco, actualizando datos recientes...")
      fetchRecentData()
      fetchCurrentUserData()
      
      return () => {
      }
    }, [])
  )

  const onRefresh = () => {
    setRefreshing(true)
    fetchRecentData().then(() => {
      setRefreshing(false)
    })
    fetchCurrentUserData()
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

  const renderFishtankItem = ({ item }: { item: FishTank }) => (
    <TouchableOpacity
      style={styles.fishtankItem}
      onPress={() =>
        router.push({
          pathname: "/(drawer)/(admin)/fishtank-detail",
          params: { fishtankId: item.id },
        })
      }
    >
      <View style={styles.fishtankHeader}>
        <Text style={styles.fishtankName}>{item.name}</Text>
        <View style={styles.fishtankBadgeContainer}>
          <View style={[
            styles.fishtankBadge, 
            item.isPrivate ? styles.privateBadge : styles.publicBadge
          ]}>
            <Feather 
              name={item.isPrivate ? "lock" : "globe"} 
              size={12} 
              color="#FFFFFF" 
              style={styles.fishtankBadgeIcon} 
            />
            <Text style={styles.fishtankBadgeText}>
              {item.isPrivate ? "Privada" : "Pública"}
            </Text>
          </View>
          {item.isVerified && (
            <View style={styles.verifiedBadge}>
              <Feather name="check-circle" size={12} color="#FFFFFF" style={styles.fishtankBadgeIcon} />
              <Text style={styles.fishtankBadgeText}>Verificada</Text>
            </View>
          )}
        </View>
      </View>
      
      {item.description && (
        <Text style={styles.fishtankDescription} numberOfLines={2}>
          {item.description}
        </Text>
      )}
      
      <View style={styles.fishtankStats}>
        <View style={styles.fishtankStat}>
          <MaterialCommunityIcons name="account-group" size={14} color="#D1D5DB" />
          <Text style={styles.fishtankStatText}>{item.memberCount} miembros</Text>
        </View>
        <View style={styles.fishtankStat}>
          <MaterialCommunityIcons name="account-cog" size={14} color="#D1D5DB" />
          <Text style={styles.fishtankStatText}>{item.adminCount} admins</Text>
        </View>
        {item.pendingCount > 0 && (
          <View style={styles.fishtankStat}>
            <MaterialCommunityIcons name="account-clock" size={14} color="#D1D5DB" />
            <Text style={styles.fishtankStatText}>{item.pendingCount} pendientes</Text>
          </View>
        )}
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
      <Stack.Screen 
        options={{
          headerShown: false,
          title: ""
        }} 
      />
      
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.profileButton} onPress={openDrawer}>
            <Image 
              source={{ uri: currentUserData?.profilePicture || "" }} 
              style={styles.profileImage}
              defaultSource={require("../../../assets/placeholders/user_icon.png")}
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Panel de Administración</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />}
      >
        <View style={styles.webContentWrapper}>
          <View style={styles.welcomeContainer}>
            <Text style={styles.welcomeSubtitle}>Gestiona tu aplicación FISHER</Text>
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
              <Text style={styles.sectionTitle}>Peceras Recientes</Text>
              <TouchableOpacity onPress={() => router.push("/(drawer)/(admintabs)/fishtanks")}> 
                <Text style={styles.sectionLink}>Ver todas</Text>
              </TouchableOpacity>
            </View>

            {recentFishtanks.length > 0 ? (
              <FlatList
                data={recentFishtanks}
                renderItem={renderFishtankItem}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
              />
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No hay peceras recientes</Text>
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
        </View>
      </ScrollView>
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
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: "#3B4255",
    borderBottomWidth: 1,
    borderBottomColor: "#5B5B5B",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    backgroundColor: "#3B4255",
    borderWidth: 2,
    borderColor: "#8BB9FE",
    marginRight: 12,
  },
  profileImage: {
    width: "100%",
    height: "100%",
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  welcomeContainer: {
    backgroundColor: "#3B4255",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: "#E0E0E0",
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#2A3142",
  },
  loadingText: {
    color: "#FFFFFF",
    marginTop: 12,
    fontSize: 16,
    fontWeight: "500",
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
    backgroundColor: "#3B4255",
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
    backgroundColor: "#3B4255",
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
    backgroundColor: "#3B4255",
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
    borderTopColor: "#5B5B5B",
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
  fishtankItem: {
    backgroundColor: "#3B4255",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  fishtankHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  fishtankName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    flex: 1,
    marginRight: 8,
  },
  fishtankBadgeContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  fishtankBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 12,
    marginBottom: 4,
    marginLeft: 4,
  },
  privateBadge: {
    backgroundColor: "#AF52DE", 
  },
  publicBadge: {
    backgroundColor: "#30D158", 
  },
  verifiedBadge: {
    backgroundColor: "#0A84FF", 
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 12,
    marginBottom: 4,
    marginLeft: 4,
  },
  fishtankBadgeIcon: {
    marginRight: 3,
  },
  fishtankBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "500",
  },
  fishtankDescription: {
    fontSize: 14,
    color: "#E0E0E0",
    marginBottom: 8,
  },
  fishtankStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderTopWidth: 1,
    borderTopColor: "#5B5B5B",
    paddingTop: 8,
  },
  fishtankStat: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
    marginBottom: 4,
  },
  fishtankStatText: {
    fontSize: 12,
    color: "#D1D5DB",
    marginLeft: 4,
  },
  emptyState: {
    padding: 20,
    alignItems: "center",
    backgroundColor: "#3B4255",
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
    backgroundColor: "#3B4255",
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
  webContentWrapper: {
    width: "100%",
    maxWidth: Platform.OS === 'web' ? 800 : "100%",
    alignSelf: "center",
  },
})