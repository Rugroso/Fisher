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
} from "react-native";
import { collection, query, where, getDocs, doc as firestoreDoc, getDoc } from "firebase/firestore";
import { db } from "../../../../config/Firebase_Conf";
import { useAuth } from "@/context/AuthContext";
import { Feather, FontAwesome } from "@expo/vector-icons";
import PostItem from "@/components/general/posts";
import type { User, Post } from "../../../types/types";
import { useFocusEffect } from '@react-navigation/native';

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
  const { user } = useAuth();

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
    }, [user?.uid])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setSavedPosts([]); 
    fetchSavedPosts();
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
    <View style={styles.bigcontainer}>
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#2A3142" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Publicaciones guardadas</Text>
        <FontAwesome name="bookmark" size={24} color="#ffd700" />
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
    </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  bigcontainer: {
    flex: 1,
    backgroundColor: "#2A3142",
  },
  container: {
    flex: 1,
    backgroundColor: "#2A3142",
    width: Platform.OS === 'web' ? "40%":"100%",
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" || Platform.OS === "android" ? 50 : 16,
    paddingBottom: 16,
    backgroundColor: "#3B4255",
    borderBottomWidth: 1,
    borderBottomColor: "#5B5B5B",
    borderBottomRightRadius: Platform.OS === 'web' ? 20 : 0,
    borderBottomLeftRadius: Platform.OS === 'web' ? 20 : 0,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    paddingBottom: 20,
  },
  postItemContainer: {
    marginTop: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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