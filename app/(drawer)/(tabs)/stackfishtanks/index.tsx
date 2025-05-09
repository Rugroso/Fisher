"use client"

import React, { useState, useEffect } from "react"
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native"
import { Feather } from "@expo/vector-icons"
import { useRouter } from "expo-router"

import { getAuth } from "firebase/auth"
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore"
import { db } from "../../../../config/Firebase_Conf"

type Pecera = {
  id: string;
  nombre: string;
  descripcion: string | null;
  miembrosCount: number;
}

const FishtanksScreen = () => {
  const router = useRouter()
  const [peceras, setPeceras] = useState<Pecera[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const crearPecera = () => {
    router.push("/(drawer)/(tabs)/stackfishtanks/create")
  }

  const verPecera = (id: string) => {
    router.push({
      pathname: "/(drawer)/(tabs)/stackfishtanks/[id]",
      params: { id }
    })
  }

  const cargarPeceras = async () => {
    try {
      setLoading(true)
      
      const q = query(
        collection(db, "peceras"),
        orderBy("fechaCreacion", "desc"),
        limit(20)
      )
      
      const snapshot = await getDocs(q)
      const lista: Pecera[] = []
      
      snapshot.forEach(doc => {
        const data = doc.data()
        lista.push({
          id: doc.id,
          nombre: data.nombre || "Sin nombre",
          descripcion: data.descripcion || null,
          miembrosCount: data.miembrosCount || 0
        })
      })
      
      setPeceras(lista)
    } catch (error) {
      console.error("Error al cargar peceras:", error)
      Alert.alert(
        "Error", 
        "No se pudieron cargar las peceras. Revisa la consola para más detalles."
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = () => {
    setRefreshing(true)
    cargarPeceras()
  }

  useEffect(() => {
    cargarPeceras()
  }, [])

  const renderPecera = ({ item }: { item: Pecera }) => (
    <TouchableOpacity 
      style={styles.peceraItem} 
      onPress={() => verPecera(item.id)}
    >
      <View style={styles.peceraContent}>
        <Text style={styles.peceraNombre}>{item.nombre}</Text>
        {item.descripcion && (
          <Text style={styles.peceraDescripcion} numberOfLines={2}>
            {item.descripcion}
          </Text>
        )}
        <Text style={styles.peceraStats}>
          {item.miembrosCount} miembro{item.miembrosCount !== 1 ? 's' : ''}
        </Text>
      </View>
    </TouchableOpacity>
  )

  const renderEmpty = () => {
    if (loading) return null
    
    return (
      <View style={styles.emptyContainer}>
        <Feather name="package" size={64} color="#8E8E93" />
        <Text style={styles.emptyText}>No hay peceras disponibles</Text>
        <TouchableOpacity
          style={styles.emptyButton}
          onPress={crearPecera}
        >
          <Text style={styles.emptyButtonText}>Crear una pecera</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Peceras</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={crearPecera}
          disabled={loading && !refreshing}
        >
          <Feather name="plus" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A6FFF" />
        </View>
      ) : (
        <FlatList
          data={peceras}
          renderItem={renderPecera}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={handleRefresh}
              tintColor="#4A6FFF" 
              colors={["#4A6FFF"]}
            />
          }
        />
      )}
    </View>
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
    borderBottomWidth: 1,
    borderBottomColor: "#3A4154",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#4A6FFF",
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
  peceraItem: {
    backgroundColor: "#3A4154",
    borderRadius: 12,
    marginBottom: 16,
    overflow: "hidden",
  },
  peceraContent: {
    padding: 16,
  },
  peceraNombre: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  peceraDescripcion: {
    fontSize: 14,
    color: "#CCCCCC",
    marginBottom: 12,
  },
  peceraStats: {
    fontSize: 14,
    color: "#8E8E93",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: "#8E8E93",
    marginTop: 16,
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: "#4A6FFF",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  emptyButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
})

export default FishtanksScreen