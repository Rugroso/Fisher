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
import { useRouter, Stack } from "expo-router"
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons"
import { collection, getDocs, doc, deleteDoc, query, orderBy, limit, where } from "firebase/firestore"
import { db } from "../../../config/Firebase_Conf"

type Pecera = {
  id: string;
  nombre: string;
  descripcion?: string | null;
  imagenURL?: string | null;
  miembrosCount: number;
  esPublica?: boolean;
  creadoPor?: string;
  fechaCreacion?: any;
}

export default function FishTanksAdminScreen() {
  const router = useRouter()
  const [peceras, setPeceras] = useState<Pecera[]>([])
  const [filteredPeceras, setFilteredPeceras] = useState<Pecera[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [sortBy, setSortBy] = useState("miembrosCount")
  const [errorMsg, setErrorMsg] = useState<string | null>(null) // Para depuración

  useEffect(() => {
    fetchPeceras()
  }, [sortBy, sortOrder])

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredPeceras(peceras)
    } else {
      const lowercasedQuery = searchQuery.toLowerCase()
      const filtered = peceras.filter((pecera) => {
        return (
          pecera.nombre.toLowerCase().includes(lowercasedQuery) ||
          (pecera.descripcion && pecera.descripcion.toLowerCase().includes(lowercasedQuery))
        )
      })
      setFilteredPeceras(filtered)
    }
  }, [searchQuery, peceras])

  const fetchPeceras = async () => {
    try {
      setLoading(true)
      setErrorMsg(null)
    
      const pecerasRef = collection(db, "peceras")
      const snapshot = await getDocs(pecerasRef)
      
      if (snapshot.empty) {
        console.log("No hay documentos en la colección 'peceras'")
        setErrorMsg("La colección 'peceras' está vacía")
        setPeceras([])
        setFilteredPeceras([])
        return
      }
      
      const pecerasData: Pecera[] = []
      
      snapshot.forEach((doc) => {
        const data = doc.data()
        console.log("Documento encontrado:", doc.id, data)
        
        pecerasData.push({
          id: doc.id,
          nombre: data.nombre || "Sin nombre",
          descripcion: data.descripcion || null,
          imagenURL: data.imagenURL || null,
          miembrosCount: data.miembrosCount || 0,
          esPublica: data.esPublica === false ? false : true,
          creadoPor: data.creadoPor || "",
          fechaCreacion: data.fechaCreacion || null
        })
      })
      
      console.log("Total de peceras encontradas:", pecerasData.length)
      setPeceras(pecerasData)
      setFilteredPeceras(pecerasData)
      
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
    fetchPeceras()
  }

  const handleDeletePecera = (peceraId: string) => {
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
              await deleteDoc(doc(db, "peceras", peceraId))
              const updatedPeceras = peceras.filter((pecera) => pecera.id !== peceraId)
              setPeceras(updatedPeceras)
              setFilteredPeceras(updatedPeceras)
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

  const navigateToCreatePecera = () => {
    router.push("/(drawer)/(tabs)/stackfishtanks/create")
  }

  const toggleSortOrder = () => {
    setSortOrder(sortOrder === "asc" ? "desc" : "asc")
  }

  const changeSortBy = (field: string) => {
    if (field === "name") {
      setSortBy("nombre")
    } else if (field === "memberCount") {
      setSortBy("miembrosCount")
    } else if (field === "createdAt") {
      setSortBy("fechaCreacion")
    } else {
      setSortBy(field)
    }
  }

  const renderPeceraItem = ({ item }: { item: Pecera }) => (
    <View style={styles.fishTankCard}>
      <View style={styles.fishTankHeader}>
        <View style={styles.fishTankInfo}>
          <View style={styles.fishTankImage}>
            {item.imagenURL ? (
              <Image
                source={{ uri: item.imagenURL }}
                style={styles.fishTankImageContent}
              />
            ) : (
              <Feather name="image" size={24} color="#8E8E93" />
            )}
          </View>
          <View>
            <View style={styles.fishTankNameContainer}>
              <Text style={styles.fishTankName}>{item.nombre}</Text>
            </View>
            <Text style={styles.fishTankDescription} numberOfLines={2}>
              {item.descripcion || "Sin descripción"}
            </Text>
          </View>
        </View>
        {!item.esPublica && <MaterialCommunityIcons name="lock" size={16} color="#D1D5DB" />}
      </View>

      <View style={styles.fishTankStats}>
        <View style={styles.fishTankStat}>
          <MaterialCommunityIcons name="account-group" size={16} color="#D1D5DB" />
          <Text style={styles.fishTankStatText}>{item.miembrosCount} miembros</Text>
        </View>
      </View>

      <View style={styles.fishTankActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.viewButton]}
          onPress={() =>
            router.push({
              pathname: "/(drawer)/(tabs)/stackfishtanks/[id]",
              params: { id: item.id },
            })
          }
        >
          <Feather name="eye" size={16} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={() =>
            router.push({
              pathname: "/(drawer)/(admintabs)/edit-fishtank",
              params: { id: item.id },
            })
          }
        >
          <Feather name="edit-2" size={16} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDeletePecera(item.id)}
        >
          <Feather name="trash-2" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
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
            style={[styles.sortButton, sortBy === "nombre" && styles.sortButtonActive]}
            onPress={() => changeSortBy("name")}
          >
            <Text style={[styles.sortButtonText, sortBy === "nombre" && styles.sortButtonTextActive]}>Nombre</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sortButton, sortBy === "miembrosCount" && styles.sortButtonActive]}
            onPress={() => changeSortBy("memberCount")}
          >
            <Text style={[styles.sortButtonText, sortBy === "miembrosCount" && styles.sortButtonTextActive]}>
              Miembros
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sortButton, sortBy === "fechaCreacion" && styles.sortButtonActive]}
            onPress={() => changeSortBy("createdAt")}
          >
            <Text style={[styles.sortButtonText, sortBy === "fechaCreacion" && styles.sortButtonTextActive]}>Fecha</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={toggleSortOrder} style={styles.sortOrderButton}>
            <MaterialCommunityIcons name={sortOrder === "asc" ? "arrow-up" : "arrow-down"} size={20} color="#8BB9FE" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>
          Mostrando {filteredPeceras.length} de {peceras.length} peceras
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
        onPress={navigateToCreatePecera}
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
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gestión de Peceras</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={filteredPeceras}
        renderItem={renderPeceraItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" colors={["#FFFFFF"]} />
        }
      />
      
      {/* Botón para crear nueva pecera */}
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={navigateToCreatePecera}
      >
        <Feather name="plus" size={24} color="#FFFFFF" />
      </TouchableOpacity>
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
  fishTankCard: {
    backgroundColor: "#4C5366",
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
    alignItems: "center",
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
    backgroundColor: "#5C6377",
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
  fishTankStats: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#5C6377",
    paddingTop: 12,
    marginBottom: 12,
  },
  fishTankStat: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
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
})