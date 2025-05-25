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
} from "react-native"
import { useRouter } from "expo-router"
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons"
import { collection, getDocs, doc, deleteDoc, query, orderBy } from "firebase/firestore"
import { db } from "../../../config/Firebase_Conf"
import type { User } from "../../../types" // Asumiendo que tienes un archivo de tipos

export default function UsersScreen() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [sortBy, setSortBy] = useState("createdAt")

  useEffect(() => {
    fetchUsers()
  }, [sortBy, sortOrder])

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredUsers(users)
    } else {
      const lowercasedQuery = searchQuery.toLowerCase()
      const filtered = users.filter((user) => {
        return (
          user.name.toLowerCase().includes(lowercasedQuery) ||
          user.lastName.toLowerCase().includes(lowercasedQuery) ||
          user.username.toLowerCase().includes(lowercasedQuery) ||
          user.email.toLowerCase().includes(lowercasedQuery)
        )
      })
      setFilteredUsers(filtered)
    }
  }, [searchQuery, users])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const q = query(collection(db, "users"), orderBy(sortBy, sortOrder))
      const querySnapshot = await getDocs(q)
      const usersData = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as User)
      setUsers(usersData)
      setFilteredUsers(usersData)
    } catch (error) {
      console.error("Error al obtener usuarios:", error)
      Alert.alert("Error", "No se pudieron cargar los usuarios")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const onRefresh = () => {
    setRefreshing(true)
    fetchUsers()
  }

  const handleDeleteUser = (userId: string) => {
    Alert.alert(
      "Confirmar eliminación",
      "¿Estás seguro que deseas eliminar este usuario? Esta acción no se puede deshacer.",
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
              await deleteDoc(doc(db, "users", userId))
              const updatedUsers = users.filter((user) => user.id !== userId)
              setUsers(updatedUsers)
              setFilteredUsers(updatedUsers)
              Alert.alert("Éxito", "Usuario eliminado correctamente")
            } catch (error) {
              console.error("Error al eliminar usuario:", error)
              Alert.alert("Error", "No se pudo eliminar el usuario")
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

  const renderUserItem = ({ item }: { item: User }) => (
    <TouchableOpacity 
      style={styles.userCard}
      onPress={() => {
        console.log("Navegando al perfil del usuario:", item.id);
        router.push({
          pathname: "/(drawer)/(tabs)/stackhome/profile",
          params: { userId: item.id }
        });
      }}
    >
      <View style={styles.userInfo}>
        <Image
          source={
            item.profilePicture ? { uri: item.profilePicture } : require("../../../assets/placeholders/user_icon.png")
          }
          style={styles.userAvatar}
        />
        <View style={styles.userDetails}>
          <Text style={styles.userName}>
            {item.name} {item.lastName}
          </Text>
          <Text style={styles.userUsername}>@{item.username}</Text>
          <Text style={styles.userEmail}>{item.email}</Text>
          <View style={styles.userBadges}>
            {item.isAdmin && (
              <View style={[styles.badge, styles.adminBadge]}>
                <Text style={styles.badgeText}>Admin</Text>
              </View>
            )}
            {item.isVerified && (
              <View style={[styles.badge, styles.verifiedBadge]}>
                <Text style={styles.badgeText}>Verificado</Text>
              </View>
            )}
          </View>
        </View>
      </View>
      <View style={styles.userActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={(e) => {
            e.stopPropagation();
            router.push({
              pathname: "/(drawer)/(admintabs)/edit-user",
              params: { userId: item.id },
            });
          }}
        >
          <Feather name="edit-2" size={16} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.actionButton, styles.deleteButton]} 
          onPress={(e) => {
            e.stopPropagation();
            handleDeleteUser(item.id);
          }}
        >
          <Feather name="trash-2" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.searchContainer}>
        <Feather name="search" size={20} color="#D1D5DB" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar usuarios..."
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
            style={[styles.sortButton, sortBy === "name" && styles.sortButtonActive]}
            onPress={() => changeSortBy("name")}
          >
            <Text style={[styles.sortButtonText, sortBy === "name" && styles.sortButtonTextActive]}>Nombre</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sortButton, sortBy === "username" && styles.sortButtonActive]}
            onPress={() => changeSortBy("username")}
          >
            <Text style={[styles.sortButtonText, sortBy === "username" && styles.sortButtonTextActive]}>Username</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sortButton, sortBy === "createdAt" && styles.sortButtonActive]}
            onPress={() => changeSortBy("createdAt")}
          >
            <Text style={[styles.sortButtonText, sortBy === "createdAt" && styles.sortButtonTextActive]}>Fecha</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={toggleSortOrder} style={styles.sortOrderButton}>
            <MaterialCommunityIcons name={sortOrder === "asc" ? "arrow-up" : "arrow-down"} size={20} color="#8BB9FE" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>
          Mostrando {filteredUsers.length} de {users.length} usuarios
        </Text>
      </View>
    </View>
  )

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name="account-group" size={48} color="#8BB9FE" />
      <Text style={styles.emptyText}>No hay usuarios para mostrar</Text>
      {searchQuery.length > 0 && <Text style={styles.emptySubText}>Intenta con otra búsqueda</Text>}
    </View>
  )

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingText}>Cargando usuarios...</Text>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gestión de Usuarios</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={filteredUsers}
        renderItem={renderUserItem}
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
    backgroundColor: "#3C4255",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#4C5366",
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
  },
  headerContainer: {
    padding: 16,
    backgroundColor: "#4C5366",
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
  userCard: {
    backgroundColor: "#4C5366",
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  userAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  userUsername: {
    fontSize: 14,
    color: "#D1D5DB",
  },
  userEmail: {
    fontSize: 12,
    color: "#A0AEC0",
    marginBottom: 4,
  },
  userBadges: {
    flexDirection: "row",
    marginTop: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: 6,
  },
  adminBadge: {
    backgroundColor: "#8BB9FE",
  },
  verifiedBadge: {
    backgroundColor: "#4ADE80",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "500",
  },
  userActions: {
    flexDirection: "row",
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  editButton: {
    backgroundColor: "#8BB9FE",
  },
  deleteButton: {
    backgroundColor: "#F87171",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    backgroundColor: "#4C5366",
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
  floatingButton: {
    position: "absolute",
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#8BB9FE",
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
})

