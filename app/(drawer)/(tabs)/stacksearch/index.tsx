"use client"

import { useState, useCallback, useEffect } from "react"
import {
  View,
  Text,
  Platform,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  RefreshControl,
} from "react-native"
import { Feather } from "@expo/vector-icons"
import { collection, getDocs, query, where, orderBy, doc, updateDoc, arrayRemove, getDoc } from "firebase/firestore"
import { db } from "../../../../config/Firebase_Conf"
import { useAuth } from "@/context/AuthContext"
import type { User, RecentSearches } from "../../../types/types"

const SearchScreen = () => {
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [results, setResults] = useState<User[]>([])
  const [recentSearches, setRecentSearches] = useState<RecentSearches[]>([])
  const [userDataCache, setUserDataCache] = useState<{ [userId: string]: User | null }>({})
  const { user } = useAuth()

  // Fetch user data for all recent searches at once
  useEffect(() => {
    const fetchUserDataForSearches = async () => {
      if (!user?.uid) return

      // Get unique user IDs from recent searches
      const userIds = recentSearches
        .filter((search) => search.userId && !search.searchTerm)
        .map((search) => search.userId)
        .filter((id, index, self) => id && self.indexOf(id) === index)

      // Filter out IDs that are already in the cache
      const idsToFetch = userIds.filter((id) => !userDataCache[id])

      if (idsToFetch.length === 0) return

      try {
        const fetchPromises = idsToFetch.map(async (userId) => {
          const userDocRef = doc(db, "users", userId)
          const userDoc = await getDoc(userDocRef)
          if (userDoc.exists()) {
            return { id: userId, data: { ...userDoc.data(), id: userId } as User }
          }
          return { id: userId, data: null }
        })

        const results = await Promise.all(fetchPromises)

        const newCache = { ...userDataCache }
        results.forEach((result) => {
          newCache[result.id] = result.data
        })

        setUserDataCache(newCache)
      } catch (error) {
        console.error("Error fetching user data for searches:", error)
      }
    }

    fetchUserDataForSearches()
  }, [recentSearches])

  useEffect(() => {
    if (user?.uid) {
      fetchRecentSearches()
    }
  }, [user])

  const fetchRecentSearches = async () => {
    try {
      if (!user?.uid) return

      // Get the user document which contains the recentSearches array
      const userDocRef = doc(db, "users", user.uid)
      const userDoc = await getDoc(userDocRef)

      if (userDoc.exists()) {
        const userData = userDoc.data()
        // Get the recentSearches array from the user document
        const searches = userData.recentSearches || []

        // Sort by timestamp in descending order
        const sortedSearches = [...searches].sort((a, b) => {
          const timeA = new Date(a.timestamp).getTime()
          const timeB = new Date(b.timestamp).getTime()
          return timeB - timeA
        })

        setRecentSearches(sortedSearches)
      }
    } catch (error) {
      console.error("Error cargando búsquedas recientes:", error)
    }
  }

  const handleSearch = async (text: string) => {
    setSearchQuery(text)
    if (text.length > 2) {
      setLoading(true)
      try {
        const usersRef = collection(db, "users")

        const usernameQuery = query(
          usersRef,
          orderBy("username"),
          where("username", ">=", text),
          where("username", "<=", text + "\uf8ff"),
        )

        const nameQuery = query(
          usersRef,
          orderBy("name"),
          where("name", ">=", text),
          where("name", "<=", text + "\uf8ff"),
        )

        const lastNameQuery = query(
          usersRef,
          orderBy("lastName"),
          where("lastName", ">=", text),
          where("lastName", "<=", text + "\uf8ff"),
        )

        const [usernameSnapshot, nameSnapshot, lastNameSnapshot] = await Promise.all([
          getDocs(usernameQuery),
          getDocs(nameQuery),
          getDocs(lastNameQuery),
        ])

        const combinedUsers: { [key: string]: User } = {}

        usernameSnapshot.forEach((doc) => {
          combinedUsers[doc.id] = { ...(doc.data() as User), id: doc.id }
        })

        nameSnapshot.forEach((doc) => {
          combinedUsers[doc.id] = { ...(doc.data() as User), id: doc.id }
        })

        lastNameSnapshot.forEach((doc) => {
          combinedUsers[doc.id] = { ...(doc.data() as User), id: doc.id }
        })

        const usersArray = Object.values(combinedUsers)

        setResults(usersArray)
      } catch (error) {
        console.error("Error buscando usuarios:", error)
      } finally {
        setLoading(false)
      }
    } else {
      setResults([])
    }
  }

  const saveRecentSearch = async (searchedUser: User) => {
    try {
      if (!user?.uid || !searchedUser?.id) return

      // Create a new RecentSearches object according to the type definition
      const newSearch: RecentSearches = {
        userId: searchedUser.id,
        searchTerm: "", // Empty since we're searching for a specific user
        timestamp: new Date().toISOString(),
      }

      // Update the user document to add the new search to the recentSearches array
      const userDocRef = doc(db, "users", user.uid)

      // First, check if this user is already in recent searches to avoid duplicates
      const userDoc = await getDoc(userDocRef)
      if (userDoc.exists()) {
        const userData = userDoc.data()
        const existingSearches = userData.recentSearches || []

        // Remove any existing search for this user
        const filteredSearches = existingSearches.filter((search: RecentSearches) => search.userId !== searchedUser.id)

        // Add the new search at the beginning
        const updatedSearches = [newSearch, ...filteredSearches]

        // Limit to 10 recent searches
        const limitedSearches = updatedSearches.slice(0, 10)

        // Update the user document
        await updateDoc(userDocRef, {
          recentSearches: limitedSearches,
        })
      } else {
        // If user document doesn't exist (unlikely), update with just this search
        await updateDoc(userDocRef, {
          recentSearches: [newSearch],
        })
      }

      console.log("Búsqueda reciente guardada.")
      fetchRecentSearches()
    } catch (error) {
      console.error("Error guardando búsqueda reciente:", error)
    }
  }

  const saveTermSearch = async (term: string) => {
    try {
      if (!user?.uid || !term) return

      // Create a new RecentSearches object for a term search
      const newSearch: RecentSearches = {
        userId: "", // Empty since this is a term search, not a user search
        searchTerm: term,
        timestamp: new Date().toISOString(),
      }

      // Update the user document
      const userDocRef = doc(db, "users", user.uid)

      // Check for existing searches
      const userDoc = await getDoc(userDocRef)
      if (userDoc.exists()) {
        const userData = userDoc.data()
        const existingSearches = userData.recentSearches || []

        // Remove any existing search for this term
        const filteredSearches = existingSearches.filter((search: RecentSearches) => search.searchTerm !== term)

        // Add the new search at the beginning
        const updatedSearches = [newSearch, ...filteredSearches]

        // Limit to 10 recent searches
        const limitedSearches = updatedSearches.slice(0, 10)

        // Update the user document
        await updateDoc(userDocRef, {
          recentSearches: limitedSearches,
        })
      } else {
        await updateDoc(userDocRef, {
          recentSearches: [newSearch],
        })
      }
    } catch (error) {
      console.error("Error guardando búsqueda de término:", error)
    }
  }

  const onUserSelect = async (userItem: User) => {
    if (!user?.uid) return
    await saveRecentSearch(userItem)
    console.log("Usuario seleccionado:", userItem.username)
    // Here you would navigate to the user profile or perform other actions
  }

  const onTermSearch = async () => {
    if (searchQuery.length > 2) {
      await saveTermSearch(searchQuery)
    }
  }

  const removeFromRecentSearches = async (search: RecentSearches) => {
    try {
      if (!user?.uid) return

      // Update the user document to remove this search
      const userDocRef = doc(db, "users", user.uid)

      await updateDoc(userDocRef, {
        recentSearches: arrayRemove(search),
      })

      // Update local state
      setRecentSearches((prev) =>
        prev.filter((s) => !(s.userId === search.userId && s.searchTerm === search.searchTerm)),
      )

      console.log("Búsqueda reciente eliminada.")
    } catch (error) {
      console.error("Error eliminando búsqueda reciente:", error)
    }
  }

  const clearAllRecentSearches = async () => {
    try {
      if (!user?.uid) return

      // Update the user document to clear all searches
      const userDocRef = doc(db, "users", user.uid)
      await updateDoc(userDocRef, {
        recentSearches: [],
      })

      setRecentSearches([])
      console.log("Todas las búsquedas recientes eliminadas.")
    } catch (error) {
      console.error("Error eliminando todas las búsquedas recientes:", error)
    }
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchRecentSearches().then(() => setRefreshing(false))
  }, [])

  const renderUserItem = (userItem: User) => (
    <TouchableOpacity style={styles.searchItem} key={userItem.id} onPress={() => onUserSelect(userItem)}>
      <Image source={{ uri: userItem.profilePicture || "https://via.placeholder.com/50" }} style={styles.avatar} />
      <View style={styles.userInfo}>
        <Text style={styles.name}>
          {userItem.name && userItem.lastName ? `${userItem.name} ${userItem.lastName}` : userItem.name || "Usuario"}
        </Text>
        <Text style={styles.username}>@{userItem.username}</Text>
      </View>
    </TouchableOpacity>
  )

  const renderSearchItem = (search: RecentSearches) => {
    // If it's a user search
    if (search.userId) {
      const userData = userDataCache[search.userId]

      // If we don't have the user data yet, show a loading placeholder
      if (userData === undefined) {
        return (
          <View style={styles.searchItem} key={search.userId + search.timestamp}>
            <View style={styles.searchItemContent}>
              <View style={styles.avatar} />
              <View style={styles.userInfo}>
                <View style={styles.loadingPlaceholder} />
                <View style={[styles.loadingPlaceholder, { width: "50%" }]} />
              </View>
            </View>
          </View>
        )
      }

      // If user data is null (user not found), skip rendering
      if (userData === null) {
        return null
      }

      return (
        <View style={styles.searchItem} key={search.userId + search.timestamp}>
          <TouchableOpacity style={styles.searchItemContent} onPress={() => onUserSelect(userData)}>
            <Image
              source={{ uri: userData.profilePicture || "https://via.placeholder.com/50" }}
              style={styles.avatar}
            />
            <View style={styles.userInfo}>
              <Text style={styles.name}>
                {userData.name && userData.lastName
                  ? `${userData.name} ${userData.lastName}`
                  : userData.name || "Usuario"}
              </Text>
              <Text style={styles.username}>@{userData.username}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => removeFromRecentSearches(search)}>
            <Feather name="x" size={20} color="#A0A0A0" />
          </TouchableOpacity>
        </View>
      )
    }
    // If it's a term search
    else if (search.searchTerm) {
      return (
        <View style={styles.searchItem} key={search.searchTerm + search.timestamp}>
          <TouchableOpacity
            style={styles.searchItemContent}
            onPress={() => {
              setSearchQuery(search.searchTerm)
              handleSearch(search.searchTerm)
            }}
          >
            <View style={styles.searchTermIcon}>
              <Feather name="search" size={20} color="#FFFFFF" />
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.name}>{search.searchTerm}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => removeFromRecentSearches(search)}>
            <Feather name="x" size={20} color="#A0A0A0" />
          </TouchableOpacity>
        </View>
      )
    }

    return null
  }

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
            onSubmitEditing={onTermSearch}
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
              results.map((item) => renderUserItem(item))
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
                recentSearches.map((item) => renderSearchItem(item))
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
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    backgroundColor: "#2A3142",
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Platform.OS === "web" ? "":"#3A4154",
    alignSelf: "center",
    width: Platform.OS === 'web' ? "100%":"100%",
    maxWidth: Platform.OS === 'web' ? 800 : "100%",
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
    alignSelf: "center",
    width: Platform.OS === 'web' ? "100%":"100%",
    maxWidth: Platform.OS === 'web' ? 800 : "100%",
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
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#3A4154",
  },
  searchItemContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#4F566B",
  },
  searchTermIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#4F566B",
    justifyContent: "center",
    alignItems: "center",
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
  loadingPlaceholder: {
    height: 16,
    width: "70%",
    backgroundColor: "#4F566B",
    borderRadius: 4,
    marginBottom: 8,
  },
})

export default SearchScreen
