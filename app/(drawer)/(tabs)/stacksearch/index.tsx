import { useState, useCallback, useEffect } from "react";
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Image, RefreshControl } from "react-native";
import { Feather } from "@expo/vector-icons";
import { collection, getDocs, query, where, orderBy, doc, setDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { db } from "../../../../config/Firebase_Conf";
import { useAuth } from "@/context/AuthContext";
import type { User } from "../../../types/types";

interface UserResult extends User {
  timestamp?: number;
}

const SearchScreen = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [results, setResults] = useState<UserResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<UserResult[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    if (user?.uid) {
      fetchRecentSearches();
    }
  }, [user]);

  const fetchRecentSearches = async () => {
    try {
      if (!user?.uid) return;
      const recentRef = collection(db, "users", user.uid, "recentSearches");
      const snapshot = await getDocs(recentRef);
  
      let searches = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as UserResult[];

      searches = searches.sort((a, b) => {
        const timeA = (a as any).searchedAt?.seconds || 0;
        const timeB = (b as any).searchedAt?.seconds || 0;
        return timeB - timeA;
      });
  
      setRecentSearches(searches);
    } catch (error) {
      console.error("Error cargando búsquedas recientes:", error);
    }
  };

  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (text.length > 2) {
      setLoading(true);
      try {
        const usersRef = collection(db, "users");
  
        const usernameQuery = query(
          usersRef,
          orderBy("username"),
          where("username", ">=", text),
          where("username", "<=", text + "\uf8ff")
        );
  
        const nameQuery = query(
          usersRef,
          orderBy("name"),
          where("name", ">=", text),
          where("name", "<=", text + "\uf8ff")
        );
  
        const lastNameQuery = query(
          usersRef,
          orderBy("lastName"),
          where("lastName", ">=", text),
          where("lastName", "<=", text + "\uf8ff")
        );
  
        const [usernameSnapshot, nameSnapshot, lastNameSnapshot] = await Promise.all([
          getDocs(usernameQuery),
          getDocs(nameQuery),
          getDocs(lastNameQuery),
        ]);
  
        const combinedUsers: { [key: string]: UserResult } = {};
  
        usernameSnapshot.forEach(doc => {
          combinedUsers[doc.id] = { ...(doc.data() as User), id: doc.id };
        });
  
        nameSnapshot.forEach(doc => {
          combinedUsers[doc.id] = { ...(doc.data() as User), id: doc.id };
        });
  
        lastNameSnapshot.forEach(doc => {
          combinedUsers[doc.id] = { ...(doc.data() as User), id: doc.id };
        });
  
        const usersArray = Object.values(combinedUsers);
  
        setResults(usersArray);
      } catch (error) {
        console.error("Error buscando usuarios:", error);
      } finally {
        setLoading(false);
      }
    } else {
      setResults([]);
    }
  };

  const saveRecentSearch = async (searchedUser: UserResult) => {
    try {
      if (!user?.uid || !searchedUser?.id) return;
  
      const safeUsername = searchedUser.username || "unknown";
      const safeDisplayName = searchedUser.displayName || "Usuario";
      const safeProfilePicture = searchedUser.profilePicture || "";
      const safeName = searchedUser.name || "";
      const safeLastName = searchedUser.lastName || "";
  
      const searchRef = doc(db, "users", user.uid, "recentSearches", searchedUser.id);
      await setDoc(searchRef, {
        username: safeUsername,
        displayName: safeDisplayName,
        profilePicture: safeProfilePicture,
        name: safeName,
        lastName: safeLastName,
        searchedAt: serverTimestamp(),
      });
  
      console.log("Búsqueda reciente guardada en Firebase.");
      fetchRecentSearches();
    } catch (error) {
      console.error("Error guardando búsqueda reciente:", error);
    }
  };

  const onUserSelect = async (userItem: UserResult) => {
    if (!user?.uid) return;
    await saveRecentSearch(userItem);
    console.log("Usuario seleccionado:", userItem.username);
  };

  const removeFromRecentSearches = async (userId: string) => {
    try {
      if (!user?.uid) return;
      setRecentSearches(prev => prev.filter(s => s.id !== userId));
      const searchRef = doc(db, "users", user.uid, "recentSearches", userId);
      await deleteDoc(searchRef);
      console.log("Búsqueda reciente eliminada en Firebase.");
    } catch (error) {
      console.error("Error eliminando búsqueda reciente:", error);
    }
  };

  const clearAllRecentSearches = async () => {
    try {
      if (!user?.uid) return;
      const recentRef = collection(db, "users", user.uid, "recentSearches");
      const snapshot = await getDocs(recentRef);
      const deletePromises = snapshot.docs.map(docItem => deleteDoc(doc(db, "users", user.uid, "recentSearches", docItem.id)));
      await Promise.all(deletePromises);
      setRecentSearches([]);
      console.log("Todas las búsquedas recientes eliminadas.");
    } catch (error) {
      console.error("Error eliminando todas las búsquedas recientes:", error);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRecentSearches().then(() => setRefreshing(false));
  }, []);

  const renderUserItem = (userItem: UserResult, isResult: boolean = false) => (
    <TouchableOpacity
      style={styles.searchItem}
      key={userItem.id}
      onPress={() => onUserSelect(userItem)}
    >
      <Image
        source={{ uri: userItem.profilePicture || 'https://via.placeholder.com/50' }}
        style={styles.avatar}
      />
      <View style={styles.userInfo}>
        <Text style={styles.name}>
          {userItem.name && userItem.lastName
            ? `${userItem.name} ${userItem.lastName}`
            : userItem.name || userItem.displayName || "Usuario"}
        </Text>
        <Text style={styles.username}>@{userItem.username}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Feather name="search" size={20} color="#FFFFFF" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar usuarios..."
            placeholderTextColor="#A0A0A0"
            value={searchQuery}
            onChangeText={handleSearch}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Feather name="x" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.contentContainer}
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
          {searchQuery.length > 2 ? (
            results.length > 0 ? (
              results.map(item => renderUserItem(item, true))
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No se encontraron usuarios</Text>
              </View>
            )
          ) : (
            <>
              <View style={styles.recentSearchesHeader}>
                <Text style={styles.sectionTitle}>Búsquedas recientes</Text>
                {recentSearches.length > 0 && (
                  <TouchableOpacity onPress={clearAllRecentSearches}>
                    <Text style={styles.clearAllText}>Borrar todo</Text>
                  </TouchableOpacity>
                )}
              </View>
              {recentSearches.length > 0 ? (
                recentSearches.map(item => renderUserItem(item))
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No hay búsquedas recientes</Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    backgroundColor: "#2A3142",
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#3A4154",
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4F566B",
    borderRadius: 20,
    paddingHorizontal: 15,
    height: 40,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: "#FFFFFF",
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 80,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    padding: 20,
    alignItems: "center",
  },
  emptyText: {
    color: "#A0A0A0",
    fontSize: 16,
  },
  recentSearchesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  clearAllText: {
    color: "#A0A0A0",
    fontSize: 14,
  },
  searchItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#3A4154",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#4F566B",
  },
  userInfo: {
    flex: 1,
    marginLeft: 15,
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  username: {
    fontSize: 14,
    color: "#A0A0A0",
    marginTop: 2,
  },
});

export default SearchScreen;
