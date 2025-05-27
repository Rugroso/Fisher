"use client"

import { useState, useEffect, useCallback } from "react"
import {
  StyleSheet,
  Platform,
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
import { useRouter, Stack } from "expo-router"
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons"
import { collection, getDocs, doc, deleteDoc, query, orderBy, limit, where, getDoc, onSnapshot } from "firebase/firestore"
import { db } from "../../../config/Firebase_Conf"
import { useAuth } from "@/context/AuthContext"
import { useNavigation, DrawerActions } from "@react-navigation/native"
import * as Haptics from "expo-haptics"
import type { User } from "@/app/types/types"

type FishTank = {
  id: string
  name: string
  description?: string | null
  fishTankPicture?: string | null
  memberCount: number
  isPrivate: boolean
  isVerified: boolean
  creatorId: string
  pendingCount: number
  adminCount: number
  createdAt: any
  updatedAt: any
}

// Hook personalizado para admins en tiempo real
function useAdminCount(fishtankId: string) {
  const [adminCount, setAdminCount] = useState<number>(0);

  useEffect(() => {
    if (!fishtankId) return;
    const q = query(
      collection(db, "fishtank_members"),
      where("fishtankId", "==", fishtankId),
      where("role", "==", "admin")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAdminCount(snapshot.size);
    });
    return () => unsubscribe();
  }, [fishtankId]);

  return adminCount;
}

// Componente para cada tarjeta de pecera
function FishtankCard({ item, onView, onEdit, onDelete }: { item: FishTank, onView: () => void, onEdit: () => void, onDelete: () => void }) {
  const adminCount = useAdminCount(item.id);
  return (
    <View style={styles.fishTankCard}>
      <View style={styles.fishTankHeader}>
        <View style={styles.fishTankInfo}>
          <View style={styles.fishTankImage}>
            {item.fishTankPicture ? (
              <Image
                source={{ uri: item.fishTankPicture }}
                style={styles.fishTankImageContent}
              />
            ) : (
              <Feather name="image" size={24} color="#8E8E93" />
            )}
          </View>
          <View>
            <View style={styles.fishTankNameContainer}>
              <Text style={styles.fishTankName}>{item.name}</Text>
              {item.isVerified && (
                <Feather name="check-circle" size={14} color="#0A84FF" style={{ marginLeft: 4 }} />
              )}
            </View>
            <Text style={styles.fishTankDescription} numberOfLines={2}>
              {item.description || "Sin descripción"}
            </Text>
          </View>
        </View>
        <View style={styles.badgesContainer}>
          <View style={[
            styles.privacyBadge, 
            item.isPrivate ? styles.privateBadge : styles.publicBadge
          ]}>
            <Feather 
              name={item.isPrivate ? "lock" : "globe"} 
              size={12} 
              color="#FFFFFF" 
              style={styles.badgeIcon} 
            />
            <Text style={styles.badgeText}>
              {item.isPrivate ? "Privada" : "Pública"}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.fishTankStats}>
        <View style={styles.fishTankStat}>
          <MaterialCommunityIcons name="account-group" size={16} color="#D1D5DB" />
          <Text style={styles.fishTankStatText}>{item.memberCount} miembros</Text>
        </View>
        <View style={styles.fishTankStat}>
          <MaterialCommunityIcons name="account-cog" size={16} color="#D1D5DB" />
          <Text style={styles.fishTankStatText}>{adminCount} admins</Text>
        </View>
        {item.pendingCount > 0 && (
          <View style={styles.fishTankStat}>
            <MaterialCommunityIcons name="account-clock" size={16} color="#D1D5DB" />
            <Text style={styles.fishTankStatText}>{item.pendingCount} pendientes</Text>
          </View>
        )}
      </View>
      <View style={styles.fishTankActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.viewButton]}
          onPress={onView}
        >
          <Feather name="eye" size={16} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={onEdit}
        >
          <Feather name="edit-2" size={16} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={onDelete}
        >
          <Feather name="trash-2" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function FishTanksAdminScreen() {
  const router = useRouter()
  const navigation = useNavigation()
  const { user } = useAuth()
  const [fishtanks, setFishtanks] = useState<FishTank[]>([])
  const [filteredFishtanks, setFilteredFishtanks] = useState<FishTank[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [sortBy, setSortBy] = useState("memberCount")
  const [errorMsg, setErrorMsg] = useState<string | null>(null) // Para depuración
  const [currentUserData, setCurrentUserData] = useState<User | null>(null)

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

  useEffect(() => {
    fetchFishtanks()
    fetchCurrentUserData()
  }, [sortBy, sortOrder])

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredFishtanks(fishtanks)
    } else {
      const lowercasedQuery = searchQuery.toLowerCase()
      const filtered = fishtanks.filter((fishtank) => {
        return (
          fishtank.name.toLowerCase().includes(lowercasedQuery) ||
          (fishtank.description && fishtank.description.toLowerCase().includes(lowercasedQuery))
        )
      })
      setFilteredFishtanks(filtered)
    }
  }, [searchQuery, fishtanks])

  // Nuevo efecto para manejar el ordenamiento
  useEffect(() => {
    const sortedFishtanks = [...filteredFishtanks].sort((a, b) => {
      if (sortBy === "name") {
        return sortOrder === "asc" 
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name)
      } else if (sortBy === "memberCount") {
        return sortOrder === "asc"
          ? a.memberCount - b.memberCount
          : b.memberCount - a.memberCount
      } else if (sortBy === "createdAt") {
        const dateA = a.createdAt?.toDate?.() || new Date(0)
        const dateB = b.createdAt?.toDate?.() || new Date(0)
        return sortOrder === "asc"
          ? dateA.getTime() - dateB.getTime()
          : dateB.getTime() - dateA.getTime()
      }
      return 0
    })
    setFilteredFishtanks(sortedFishtanks)
  }, [sortBy, sortOrder, fishtanks])

  const fetchFishtanks = async () => {
    try {
      setLoading(true)
      setErrorMsg(null)
    
      const fishtanksRef = collection(db, "fishtanks")
      const snapshot = await getDocs(fishtanksRef)
      
      if (snapshot.empty) {
        console.log("No hay documentos en la colección 'fishtanks'")
        setErrorMsg("La colección 'fishtanks' está vacía")
        setFishtanks([])
        setFilteredFishtanks([])
        return
      }
      
      const fishtanksData: FishTank[] = []
      
      snapshot.forEach((doc) => {
        const data = doc.data()
        console.log("Documento encontrado:", doc.id, data)
        
        fishtanksData.push({
          id: doc.id,
          name: data.name || "Sin nombre",
          description: data.description || null,
          fishTankPicture: data.fishTankPicture || null,
          memberCount: data.memberCount || 0,
          isPrivate: data.isPrivate === true,
          isVerified: data.isVerified === true,
          creatorId: data.creatorId || "",
          pendingCount: data.pendingCount || 0,
          adminCount: data.adminCount || 0,
          createdAt: data.createdAt || null,
          updatedAt: data.updatedAt || null
        })
      })
      
      console.log("Total de peceras encontradas:", fishtanksData.length)
      setFishtanks(fishtanksData)
      setFilteredFishtanks(fishtanksData)
      
    } catch (error) {
      console.error("Error al obtener peceras:", error)
      setErrorMsg(`Error: ${error instanceof Error ? error.message : String(error)}`)
      Alert.alert("Error", "No se pudieron cargar las peceras")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const onRefresh = () => {
    setRefreshing(true)
    fetchFishtanks()
    fetchCurrentUserData()
  }

  const handleDeleteFishtank = (fishtankId: string) => {
    Alert.alert(
      "Confirmar eliminación",
      "¿Estás seguro que deseas eliminar esta pecera? Esta acción no se puede deshacer.",
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
              await deleteDoc(doc(db, "fishtanks", fishtankId))
              const updatedFishtanks = fishtanks.filter((fishtank) => fishtank.id !== fishtankId)
              setFishtanks(updatedFishtanks)
              setFilteredFishtanks(updatedFishtanks)
              Alert.alert("Éxito", "Pecera eliminada correctamente")
            } catch (error) {
              console.error("Error al eliminar pecera:", error)
              Alert.alert("Error", "No se pudo eliminar la pecera")
            }
          },
        },
      ],
    )
  }

  const navigateToCreateFishtank = () => {
    router.push("/(drawer)/(tabs)/stackfishtanks/create")
  }

  const toggleSortOrder = () => {
    setSortOrder(sortOrder === "asc" ? "desc" : "asc")
  }

  const changeSortBy = (field: string) => {
    if (field === "name") {
      setSortBy("name")
    } else if (field === "memberCount") {
      setSortBy("memberCount")
    } else if (field === "createdAt") {
      setSortBy("createdAt")
    } else {
      setSortBy(field)
    }
  }

  const renderFishtankItem = ({ item }: { item: FishTank }) => (
    <FishtankCard
      item={item}
      onView={() =>
        router.push({
          pathname: "/(drawer)/(tabs)/stackfishtanks/[id]",
          params: { id: item.id },
        })
      }
      onEdit={() =>
        router.push({
          pathname: "/(drawer)/(admintabs)/edit-fishtank",
          params: { id: item.id },
        })
      }
      onDelete={() => handleDeleteFishtank(item.id)}
    />
  )

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.searchContainer}>
        <Feather name="search" size={20} color="#D1D5DB" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar peceras..."
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
            style={[styles.sortButton, sortBy === "memberCount" && styles.sortButtonActive]}
            onPress={() => changeSortBy("memberCount")}
          >
            <Text style={[styles.sortButtonText, sortBy === "memberCount" && styles.sortButtonTextActive]}>
              Miembros
            </Text>
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
          Mostrando {filteredFishtanks.length} de {fishtanks.length} peceras
        </Text>
      </View>
    </View>
  )

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name="fish" size={48} color="#8BB9FE" />
      <Text style={styles.emptyText}>No hay peceras para mostrar</Text>
      {searchQuery.length > 0 && <Text style={styles.emptySubText}>Intenta con otra búsqueda</Text>}
      {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
      
      <TouchableOpacity
        style={styles.createButton}
        onPress={navigateToCreateFishtank}
      >
        <Text style={styles.createButtonText}>Crear nueva pecera</Text>
      </TouchableOpacity>
    </View>
  )

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingText}>Cargando peceras...</Text>
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
          <Text style={styles.headerTitle}>Gestión de Peceras</Text>
        </View>
      </View>

      <View style={styles.webContentWrapper}>
        {renderHeader()}
        <FlatList
          data={filteredFishtanks}
          renderItem={renderFishtankItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={renderEmptyList}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" colors={["#FFFFFF"]} />
          }
        />
      </View>
      
      {/* Botón para crear nueva pecera */}
      <TouchableOpacity
        style={styles.floatingButtonBottom}
        onPress={navigateToCreateFishtank}
      >
        <Feather name="plus" size={24} color="#FFFFFF" />
      </TouchableOpacity>
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
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: "#3B4255",
    borderBottomWidth: 1,
    borderBottomColor: "#5B5B5B",
    width: Platform.OS === 'web' ? "100%":"100%",
    maxWidth: Platform.OS === 'web' ? 800 : "100%",
    alignSelf: "center",
    borderBottomRightRadius: Platform.OS === 'web' ? 20 : 0,
    borderBottomLeftRadius: Platform.OS === 'web' ? 20 : 0,
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
  listContainer: {
    paddingBottom: 80,
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
    backgroundColor: "#3B4255",
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
    backgroundColor: "#3B4255",
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
  fishTankCard: {
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
  fishTankHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  fishTankInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  fishTankImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
    backgroundColor: "#5B5B5B",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  fishTankImageContent: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  fishTankNameContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  fishTankName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginRight: 4,
  },
  fishTankDescription: {
    fontSize: 14,
    color: "#D1D5DB",
    marginTop: 4,
    width: "90%",
  },
  badgesContainer: {
    flexDirection: "column",
    alignItems: "flex-end",
  },
  privacyBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 12,
    marginBottom: 4,
  },
  privateBadge: {
    backgroundColor: "#AF52DE", 
  },
  publicBadge: {
    backgroundColor: "#30D158", 
  },
  badgeIcon: {
    marginRight: 3,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "500",
  },
  fishTankStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderTopWidth: 1,
    borderTopColor: "#5B5B5B",
    paddingTop: 12,
    marginBottom: 12,
  },
  fishTankStat: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
    marginBottom: 4,
  },
  fishTankStatText: {
    fontSize: 12,
    color: "#D1D5DB",
    marginLeft: 4,
  },
  fishTankActions: {
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
  editButton: {
    backgroundColor: "#4ADE80",
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
  errorText: {
    color: "#F87171",
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  createButton: {
    backgroundColor: "#4A6FFF",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginTop: 16,
  },
  createButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  floatingButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#4A6FFF",
    justifyContent: "center",
    alignItems: "center",
  },
  floatingButtonBottom: {
    position: "absolute",
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#4A6FFF",
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  webContentWrapper: {
    width: "100%",
    maxWidth: Platform.OS === 'web' ? 800 : "100%",
    alignSelf: "center",
  },
})