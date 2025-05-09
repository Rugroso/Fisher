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

type FishTank = {
  id: string
  name: string
  description: string | null
  memberCount: number
  isPrivate: boolean
}

const FishtanksScreen = () => {
  const router = useRouter()
  const [fishtanks, setFishtanks] = useState<FishTank[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const createFishtank = () => {
    router.push("/(drawer)/(tabs)/stackfishtanks/create")
  }

  const viewFishtank = (id: string) => {
    router.push({
      pathname: "/(drawer)/(tabs)/stackfishtanks/[id]",
      params: { id }
    })
  }

  const loadFishtanks = async () => {
    try {
      setLoading(true)
      
      const q = query(
        collection(db, "fishtanks"),
        orderBy("createdAt", "desc"),
        limit(20)
      )
      
      const snapshot = await getDocs(q)
      const list: FishTank[] = []
      
      snapshot.forEach(doc => {
        const data = doc.data()
        list.push({
          id: doc.id,
          name: data.name || "No name",
          description: data.description || null,
          memberCount: data.memberCount || 0,
          isPrivate: data.isPrivate || false
        })
      })
      
      setFishtanks(list)
    } catch (error) {
      console.error("Error loading fishtanks:", error)
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
    loadFishtanks()
  }

  useEffect(() => {
    loadFishtanks()
  }, [])

  const renderFishtank = ({ item }: { item: FishTank }) => (
    <TouchableOpacity 
      style={styles.fishtankItem} 
      onPress={() => viewFishtank(item.id)}
    >
      <View style={styles.fishtankContent}>
        <Text style={styles.fishtankName}>{item.name}</Text>
        {item.description && (
          <Text style={styles.fishtankDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}
        <View style={styles.fishtankStatsRow}>
          <Text style={styles.fishtankStats}>
            {item.memberCount} miembro{item.memberCount !== 1 ? 's' : ''}
          </Text>
          {item.isPrivate && (
            <View style={styles.privateTag}>
              <Feather name="lock" size={12} color="#FFFFFF" style={styles.privateIcon} />
              <Text style={styles.privateText}>Privada</Text>
            </View>
          )}
        </View>
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
          onPress={createFishtank}
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
          onPress={createFishtank}
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
          data={fishtanks}
          renderItem={renderFishtank}
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
  fishtankItem: {
    backgroundColor: "#3A4154",
    borderRadius: 12,
    marginBottom: 16,
    overflow: "hidden",
  },
  fishtankContent: {
    padding: 16,
  },
  fishtankName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  fishtankDescription: {
    fontSize: 14,
    color: "#CCCCCC",
    marginBottom: 12,
  },
  fishtankStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  fishtankStats: {
    fontSize: 14,
    color: "#8E8E93",
  },
  privateTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4A4F5A",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  privateIcon: {
    marginRight: 4,
  },
  privateText: {
    fontSize: 12,
    color: "#FFFFFF",
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