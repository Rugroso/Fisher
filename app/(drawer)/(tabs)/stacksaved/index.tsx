import React, { useEffect, useState, useCallback } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  RefreshControl, 
  ActivityIndicator, 
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Platform,
  Image,
} from "react-native";
import { collection, query, where, getDocs, doc as firestoreDoc, getDoc } from "firebase/firestore";
import { db } from "../../../../config/Firebase_Conf";
import { useAuth } from "@/context/AuthContext";
import { Feather, FontAwesome } from "@expo/vector-icons";
import PostItem from "@/components/general/posts";
import type { User, Post } from "../../../types/types";
import { useFocusEffect } from '@react-navigation/native';
import { useNavigation, DrawerActions } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";

// Define a type for the combined post and user data
interface PostWithUser {
  user: User;
  post: Post;
  key: string;
  savedAt: string;
}

export default function SavedScreen() {
  const [savedPosts, setSavedPosts] = useState<PostWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserData, setCurrentUserData] = useState<User | null>(null);
  const { user } = useAuth();
  const navigation = useNavigation();
  const router = useRouter();

  const openDrawer = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    navigation.dispatch(DrawerActions.openDrawer());
  }, [navigation]);

  const fetchCurrentUserData = async () => {
    if (!user?.uid) return;

    try {
      const userRef = firestoreDoc(db, "users", user.uid);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        setCurrentUserData(userDoc.data() as User);
      }
    } catch (error) {
      console.error("Error fetching current user data:", error);
    }
  };

  const fetchSavedPosts = async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      
      // Obtener todos los documentos de savedPosts para el usuario actual
      const savedPostsRef = collection(db, "savedPosts");
      const q = query(savedPostsRef, where("userId", "==", user.uid), where("deleted", "!=", true));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        setSavedPosts([]);
        setLoading(false);
        return;
      }
      
      const savedPostsWithUser: PostWithUser[] = [];
      
      for (const docSnapshot of snapshot.docs) {
        const savedData = docSnapshot.data();
        const postId = savedData.postId;
        
        const postDocRef = firestoreDoc(db, "posts", postId);
        const postDocSnapshot = await getDoc(postDocRef);
        
        if (postDocSnapshot.exists()) {
          const postData = postDocSnapshot.data() as Post;
          if (!postData.id) {
            postData.id = postDocSnapshot.id;
          }
          
          const authorDocRef = firestoreDoc(db, "users", postData.authorId);
          const authorDocSnapshot = await getDoc(authorDocRef);
          
          if (authorDocSnapshot.exists()) {
            const authorData = authorDocSnapshot.data() as User;
            if (!authorData.id) {
              authorData.id = authorDocSnapshot.id;
            }
            
            savedPostsWithUser.push({
              user: authorData,
              post: postData,
              key: `saved_${postData.id}`,
              savedAt: savedData.savedAt
            });
          }
        }
      }
      
      savedPostsWithUser.sort((a, b) => 
        new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
      );
      
      setSavedPosts(savedPostsWithUser);
    } catch (error) {
      console.error("Error fetchSavedPosts:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setSavedPosts([]);
      fetchSavedPosts();
      fetchCurrentUserData();
    }, [user?.uid])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setSavedPosts([]); 
    fetchSavedPosts();
    fetchCurrentUserData();
  }, [user?.uid]);

  const handlePostDeleted = useCallback((postId: string) => {
    setSavedPosts(prevPosts => 
      prevPosts.filter(item => item.post.id !== postId)
    );
  }, []);

  const handlePostSaved = useCallback((postId: string, saved: boolean) => {
    if (!saved) {
      setSavedPosts(prevPosts => 
        prevPosts.filter(item => item.post.id !== postId)
      );
    }
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#2A3142" />
      
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.profileButton} onPress={openDrawer}>
            <Image 
              source={{ uri: currentUserData?.profilePicture || "" }} 
              style={styles.profileImage}
              defaultSource={require("../../../../assets/placeholders/user_icon.png")}
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Post guardados</Text>
        </View>
        <TouchableOpacity style={styles.bookmarkButton}>
          <FontAwesome name="bookmark" size={24} color="#ffd700" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      ) : savedPosts.length > 0 ? (
        <FlatList
          data={savedPosts}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => (
            <View style={styles.postItemContainer}>
              {user?.uid && (
                <PostItem 
                  key={item.post.id} 
                  user={item.user} 
                  post={item.post} 
                  currentUserId={user.uid}
                  onPostDeleted={handlePostDeleted}
                  onPostSaved={handlePostSaved}
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
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Feather name="bookmark" size={80} color="#4E566D" style={styles.emptyIcon} />
          <Text style={styles.emptyText}>No tienes publicaciones guardadas</Text>
          <Text style={styles.emptySubtext}>Las publicaciones que guardes aparecerán aquí</Text>
        </View>
      )}
    </View>
  );
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
    borderBottomWidth: 1,
    borderBottomColor: "#3A4154",
    alignSelf: "center",
    width: Platform.OS === 'web' ? "100%":"100%",
    maxWidth: Platform.OS === 'web' ? 800 : "100%",
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
    backgroundColor: "#4C5366",
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
  bookmarkButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    padding: 16,
    paddingBottom: 30,
    flexGrow: 1,
  },
  postItemContainer: {
    marginTop: 16,
    alignSelf: "center",
    width: Platform.OS === 'web' ? "100%":"100%",
    maxWidth: Platform.OS === 'web' ? 800 : "100%",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyIcon: {
    marginBottom: 24,
    opacity: 0.5,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 12,
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 16,
    color: "#AAAAAA",
    textAlign: "center",
  },
});