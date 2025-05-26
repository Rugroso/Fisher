"use client"

import { useState, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native"
import { Feather } from "@expo/vector-icons"
import { useRouter, Stack } from "expo-router"
import { collection, getDocs, doc, updateDoc, query, orderBy, where } from "firebase/firestore"
import { db } from "../../../config/Firebase_Conf"
import type { Report } from "@/app/types/types"

export default function ReportsScreen() {
  const router = useRouter()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<"all" | "pending" | "resolved">("all")

  useEffect(() => {
    fetchReports()
  }, [filter])

  const fetchReports = async () => {
    try {
      setLoading(true)
      let q = query(collection(db, "reports"), orderBy("createdAt", "desc"))

      if (filter !== "all") {
        q = query(q, where("status", "==", filter))
      }

      const querySnapshot = await getDocs(q)
      const reportsData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Report[]

      setReports(reportsData)
    } catch (error) {
      console.error("Error al cargar reportes:", error)
      Alert.alert("Error", "No se pudieron cargar los reportes")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const onRefresh = () => {
    setRefreshing(true)
    fetchReports()
  }

  const handleStatusChange = async (reportId: string, newStatus: "resolved") => {
    try {
      const reportRef = doc(db, "reports", reportId)
      await updateDoc(reportRef, {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      })

      setReports((prevReports) =>
        prevReports.map((report) => (report.id === reportId ? { ...report, status: newStatus } : report)),
      )

      Alert.alert("Éxito", `Reporte resuelto correctamente`)
    } catch (error) {
      console.error("Error al actualizar estado del reporte:", error)
      Alert.alert("Error", "No se pudo actualizar el estado del reporte")
    }
  }

  const handleViewContent = async (report: Report) => {
    try {
      console.log("Navegando a contenido reportado:", report)

      // Navegar al post reportado
      if (report.postId) {
        console.log("Navegando a post:", report.postId)
        router.push({
          pathname: "/(drawer)/(tabs)/stackhome/post-detail",
          params: {
            postId: report.postId,
            fromReports: "true",
          },
        })
      } else {
        Alert.alert("Error", "No se pudo determinar el contenido reportado")
      }
    } catch (error) {
      console.error("Error al navegar al contenido:", error)
      Alert.alert("Error", "No se pudo acceder al contenido reportado")
    }
  }

  const getReportTypeIcon = () => {
    // Siempre devuelve el icono de post ya que según el tipo Report solo maneja posts
    return "file-text"
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "#F59E0B"
      case "resolved":
        return "#10B981"
      default:
        return "#6B7280"
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return "Pendiente"
      case "resolved":
        return "Resuelto"
      default:
        return status
    }
  }

  const renderReportItem = ({ item }: { item: Report & { id: string } }) => (
    <TouchableOpacity style={styles.reportCard} onPress={() => handleViewContent(item)}>
      <View style={styles.reportHeader}>
        <View style={styles.reportType}>
          <Feather name={getReportTypeIcon()} size={20} color="#8BB9FE" />
          <Text style={styles.reportTypeText}>Post</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
        </View>
      </View>

      <Text style={styles.reasonText}>{item.reason}</Text>

      <View style={styles.reportFooter}>
        <Text style={styles.reporterText}>Reportado por: ID: {item.reporterId}</Text>
        <Text style={styles.dateText}>{new Date(item.createdAt).toLocaleDateString()}</Text>
      </View>

      {item.status === "pending" && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.resolveButton]}
            onPress={(e) => {
              e.stopPropagation()
              handleStatusChange(item.id, "resolved")
            }}
          >
            <Feather name="check" size={16} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Resolver</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  )

  const renderFilterButtons = () => (
    <View style={styles.filterContainer}>
      <TouchableOpacity
        style={[styles.filterButton, filter === "all" && styles.filterButtonActive]}
        onPress={() => setFilter("all")}
      >
        <Text style={[styles.filterButtonText, filter === "all" && styles.filterButtonTextActive]}>Todos</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.filterButton, filter === "pending" && styles.filterButtonActive]}
        onPress={() => setFilter("pending")}
      >
        <Text style={[styles.filterButtonText, filter === "pending" && styles.filterButtonTextActive]}>Pendientes</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.filterButton, filter === "resolved" && styles.filterButtonActive]}
        onPress={() => setFilter("resolved")}
      >
        <Text style={[styles.filterButtonText, filter === "resolved" && styles.filterButtonTextActive]}>Resueltos</Text>
      </TouchableOpacity>
    </View>
  )

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingText}>Cargando reportes...</Text>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reportes</Text>
        <View style={{ width: 24 }} />
      </View>

      {renderFilterButtons()}

      <FlatList
        data={reports}
        renderItem={renderReportItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="flag" size={48} color="#8BB9FE" />
            <Text style={styles.emptyText}>No hay reportes para mostrar</Text>
            {filter !== "all" && <Text style={styles.emptySubText}>No hay reportes con el estado seleccionado</Text>}
          </View>
        }
      />
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
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#3C4255",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
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
  },
  filterContainer: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: "#3C4255",
    borderBottomWidth: 1,
    borderBottomColor: "#4C5366",
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: "#4C5366",
  },
  filterButtonActive: {
    backgroundColor: "#8BB9FE",
  },
  filterButtonText: {
    color: "#D1D5DB",
    fontSize: 14,
  },
  filterButtonTextActive: {
    color: "#FFFFFF",
    fontWeight: "500",
  },
  listContainer: {
    padding: 16,
  },
  reportCard: {
    backgroundColor: "#3C4255",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  reportHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  reportType: {
    flexDirection: "row",
    alignItems: "center",
  },
  reportTypeText: {
    color: "#8BB9FE",
    marginLeft: 8,
    fontSize: 16,
    fontWeight: "500",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "500",
  },
  reasonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  descriptionText: {
    color: "#D1D5DB",
    fontSize: 14,
    marginBottom: 12,
  },
  reportFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#4C5366",
  },
  reporterText: {
    color: "#A0AEC0",
    fontSize: 12,
  },
  dateText: {
    color: "#A0AEC0",
    fontSize: 12,
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 12,
    gap: 8,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  resolveButton: {
    backgroundColor: "#10B981",
  },
  dismissButton: {
    backgroundColor: "#6B7280",
  },
  actionButtonText: {
    color: "#FFFFFF",
    marginLeft: 4,
    fontSize: 14,
    fontWeight: "500",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    backgroundColor: "#3C4255",
    borderRadius: 12,
    marginTop: 20,
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
})
