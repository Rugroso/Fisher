import { useEffect, useState, useCallback } from "react"
import { View, Text, ScrollView, ActivityIndicator, StyleSheet, RefreshControl, TouchableOpacity } from "react-native"
import { collection, getDocs, query, where } from "firebase/firestore"
import { db } from "../../../../config/Firebase_Conf"
import { Feather } from "@expo/vector-icons"
import PostItem from "@/components/general/posts"
import { useAuth } from "@/context/AuthContext"
import type { User, Post, PostItem as PostItemType } from "../../../types/types"

const FeedScreen = () => {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [flattenedPosts, setFlattenedPosts] = useState<PostItemType[]>([])
  const { user } = useAuth()

  const fetchPostsForUser = async (userId: string) => {
    try {
      const postsRef = collection(db, "posts")
      const q = query(postsRef, where("userId", "==", userId))
      const snapshot = await getDocs(q)

      return snapshot.docs.map((doc) => {
        const data = doc.data() as Post
        if (!data.postId) {
          data.postId = doc.id
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
      let newPosts: PostItemType[] = []
      for (const doc of usersSnapshot.docs) {
        const userData = doc.data() as User
        if (!userData.userId) {
          userData.userId = doc.id
        }
        console.log("User data:", userData)

        const posts = await fetchPostsForUser(userData.userId)
        if (posts && posts.length > 0) {
          usersList.push(userData)
          newPosts.push(
            ...posts.map((post) => ({
              user: userData,
              post,
              key: `${post.postId}`,
            }))
          )
        }
      }
      console.log("All posts:", newPosts)
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

        <TouchableOpacity style={{ flexDirection: "row", alignItems: "center"}}>
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
          flattenedPosts.map((item) => 
          <View style={{ marginBottom:16 }} key={item.post.postId}>
            {user?.uid && (
              <PostItem key={item.post.postId} user={item.user} post={item.post} currentUserId={user.uid} />
            )}
          </View>
        )
        )
         : (
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
})

export default FeedScreen

