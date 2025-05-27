"use client"

import { useState, useEffect } from "react"
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Image,
  Platform,
} from "react-native"
import { useRouter } from "expo-router"
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons"
import { collection, getDocs, doc, deleteDoc, query, orderBy, where } from "firebase/firestore"
import { db } from "../../../config/Firebase_Conf"
import type { Post, User } from "../../types/types"

export default function PostsScreen() {
  const router = useRouter()
  const [posts, setPosts] = useState<Post[]>([])
  const [filteredPosts, setFilteredPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [sortBy, setSortBy] = useState("createdAt")
  const [userCache, setUserCache] = useState<Record<string, User>>({})

  useEffect(() => {
    fetchPosts()
  }, [sortBy, sortOrder])

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredPosts(posts)
    } else {
      const lowercasedQuery = searchQuery.toLowerCase()
      const filtered = posts.filter((post) => {
        return (
          post.content?.toLowerCase().includes(lowercasedQuery) ||
          userCache[post.authorId]?.username.toLowerCase().includes(lowercasedQuery)
        )
      })
      setFilteredPosts(filtered)
    }
  }, [searchQuery, posts, userCache])

  const fetchPosts = async () => {
    try {
      setLoading(true)
      const q = query(collection(db, "posts"), orderBy(sortBy, sortOrder))
      const querySnapshot = await getDocs(q)
      const postsData = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Post)
      setPosts(postsData)
      setFilteredPosts(postsData)

      // Obtener información de usuarios para los posts
      const authorIds = [...new Set(postsData.map((post) => post.authorId))]
      await fetchUserData(authorIds)
    } catch (error) {
      console.error("Error al obtener posts:", error)
      Alert.alert("Error", "No se pudieron cargar los posts")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const fetchUserData = async (userIds: string[]) => {
    try {
      const usersRef = collection(db, "users")
      const cache: Record<string, User> = { ...userCache }

      for (const userId of userIds) {
        if (!cache[userId]) {
          const q = query(usersRef, where("id", "==", userId))
          const querySnapshot = await getDocs(q)

          if (!querySnapshot.empty) {
            const userData = querySnapshot.docs[0].data() as User
            cache[userId] = userData
          }
        }
      }

      setUserCache(cache)
    } catch (error) {
      console.error("Error al obtener datos de usuarios:", error)
    }
  }

  const onRefresh = () => {
    setRefreshing(true)
    fetchPosts()
  }

  const handleDeletePost = (postId: string) => {
    Alert.alert(
      "Confirmar eliminación",
      "¿Estás seguro que deseas eliminar este post? Esta acción no se puede deshacer.",
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "posts", postId))
              const updatedPosts = posts.filter((post) => post.id !== postId)
              setPosts(updatedPosts)
              setFilteredPosts(updatedPosts)
              Alert.alert("Éxito", "Post eliminado correctamente")
            } catch (error) {
              console.error("Error al eliminar post:", error)
              Alert.alert("Error", "No se pudo eliminar el post")
            }
          },
        },
      ],
    )
  }

  const toggleSortOrder = () => {
    setSortOrder(sortOrder === "asc" ? "desc" : "asc")
  }

  const changeSortBy = (field: string) => {
    setSortBy(field)
  }

  const renderPostItem = ({ item }: { item: Post }) => {
    const author = userCache[item.authorId]

    return (
      <View style={styles.postCard}>
        <View style={styles.postHeader}>
          <View style={styles.authorInfo}>
            <Image
              source={
                author?.profilePicture
                  ? { uri: author.profilePicture }
                  : require("../../../assets/placeholders/user_icon.png")
              }
              style={styles.authorAvatar}
            />
            <View>
              <Text style={styles.authorName}>
                {author ? `${author.name} ${author.lastName}` : "Usuario desconocido"}
              </Text>
              <Text style={styles.authorUsername}>@{author?.username || "usuario"}</Text>
            </View>
          </View>
          <Text style={styles.postDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
        </View>

        <Text style={styles.postContent}>{item.content || "(Sin contenido)"}</Text>

        {item.media && item.media.length > 0 && (
          <View style={styles.mediaContainer}>
            <Image source={{ uri: item.media[0] }} style={styles.mediaImage} resizeMode="cover" />
            {item.media.length > 1 && (
              <View style={styles.mediaCountBadge}>
                <Text style={styles.mediaCountText}>+{item.media.length - 1}</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.postStats}>
          <View style={styles.postStat}>
            <MaterialCommunityIcons name="comment-outline" size={16} color="#D1D5DB" />
            <Text style={styles.postStatText}>{item.commentCount}</Text>
          </View>
          <View style={styles.postStat}>
            <MaterialCommunityIcons name="fish" size={16} color="#D1D5DB" />
            <Text style={styles.postStatText}>{item.reactionCounts.fish}</Text>
          </View>
          <View style={styles.postStat}>
            <MaterialCommunityIcons name="hook" size={16} color="#D1D5DB" />
            <Text style={styles.postStatText}>{item.reactionCounts.bait}</Text>
          </View>
          <View style={styles.postStat}>
            <MaterialCommunityIcons name="wave" size={16} color="#D1D5DB" />
            <Text style={styles.postStatText}>{item.reactionCounts.wave}</Text>
          </View>
        </View>

        <View style={styles.postActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.viewButton]}
            onPress={() =>
              router.push({
                //Pendiente
                pathname: "/(drawer)/(admin)/post-detail",
                params: { postId: item.id },
              })
            }
          >
            <Feather name="eye" size={16} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDeletePost(item.id)}
          >
            <Feather name="trash-2" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.searchContainer}>
        <Feather name="search" size={20} color="#D1D5DB" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar posts..."
          placeholderTextColor="#A0AEC0"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Feather name="x" size={20} color="#D1D5DB" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.sortContainer}>
        <Text style={styles.sortLabel}>Ordenar por:</Text>
        <View style={styles.sortButtons}>
          <TouchableOpacity
            style={[styles.sortButton, sortBy === "createdAt" && styles.sortButtonActive]}
            onPress={() => changeSortBy("createdAt")}
          >
            <Text style={[styles.sortButtonText, sortBy === "createdAt" && styles.sortButtonTextActive]}>Fecha</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sortButton, sortBy === "commentCount" && styles.sortButtonActive]}
            onPress={() => changeSortBy("commentCount")}
          >
            <Text style={[styles.sortButtonText, sortBy === "commentCount" && styles.sortButtonTextActive]}>
              Comentarios
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={toggleSortOrder} style={styles.sortOrderButton}>
            <MaterialCommunityIcons name={sortOrder === "asc" ? "arrow-up" : "arrow-down"} size={20} color="#8BB9FE" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>
          Mostrando {filteredPosts.length} de {posts.length} posts
        </Text>
      </View>
    </View>
  )

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name="post" size={48} color="#8BB9FE" />
      <Text style={styles.emptyText}>No hay posts para mostrar</Text>
      {searchQuery.length > 0 && <Text style={styles.emptySubText}>Intenta con otra búsqueda</Text>}
    </View>
  )

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingText}>Cargando posts...</Text>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gestión de Posts</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={filteredPosts}
        renderItem={renderPostItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" colors={["#FFFFFF"]} />
        }
      />
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
    paddingVertical: 12,
    backgroundColor: "#3B4255",
    width: Platform.OS === 'web' ? "100%":"100%",
    maxWidth: Platform.OS === 'web' ? 800 : "100%",
    alignSelf: "center",
    borderBottomRightRadius: Platform.OS === 'web' ? 20 : 0,
    borderBottomLeftRadius: Platform.OS === 'web' ? 20 : 0,
  },
  headerTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
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
  listContainer: {
    paddingBottom: 80,
    width: Platform.OS === 'web' ? "100%":"100%",
    maxWidth: Platform.OS === 'web' ? 800 : "100%",
    alignSelf: "center",
  },
  headerContainer: {
    padding: 16,
    backgroundColor: "#3B4255",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#5C6377",
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    color: "#FFFFFF",
    fontSize: 16,
  },
  sortContainer: {
    marginBottom: 12,
  },
  sortLabel: {
    color: "#D1D5DB",
    fontSize: 14,
    marginBottom: 8,
    fontWeight: "500",
  },
  sortButtons: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  sortButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: "#5C6377",
  },
  sortButtonActive: {
    backgroundColor: "#8BB9FE",
  },
  sortButtonText: {
    color: "#D1D5DB",
    fontSize: 14,
  },
  sortButtonTextActive: {
    color: "#FFFFFF",
  },
  sortOrderButton: {
    padding: 6,
  },
  statsContainer: {
    marginTop: 8,
  },
  statsText: {
    color: "#D1D5DB",
    fontSize: 14,
  },
  postCard: {
    backgroundColor: "#3B4255",
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  postHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  authorInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  authorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 8,
  },
  authorName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#FFFFFF",
  },
  authorUsername: {
    fontSize: 12,
    color: "#D1D5DB",
  },
  postDate: {
    fontSize: 12,
    color: "#A0AEC0",
  },
  postContent: {
    fontSize: 14,
    color: "#FFFFFF",
    marginBottom: 12,
  },
  mediaContainer: {
    height: 200,
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 12,
    position: "relative",
  },
  mediaImage: {
    width: "100%",
    height: "100%",
  },
  mediaCountBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  mediaCountText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
  postStats: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#5C6377",
    paddingTop: 12,
    marginBottom: 12,
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
  postActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  viewButton: {
    backgroundColor: "#8BB9FE",
  },
  deleteButton: {
    backgroundColor: "#F87171",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    backgroundColor: "#3B4255",
    margin: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  emptyText: {
    color: "#FFFFFF",
    fontSize: 18,
    marginTop: 16,
    textAlign: "center",
  },
  emptySubText: {
    color: "#D1D5DB",
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
})

