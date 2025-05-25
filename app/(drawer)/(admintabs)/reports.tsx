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
import { collection, getDocs, doc, updateDoc, query, orderBy, where, getDoc } from "firebase/firestore"
import { db } from "../../../config/Firebase_Conf"

interface Report {
  id: string
  type: "post" | "comment" | "user" | "fishtank"
  targetId: string
  reason: string
  description: string
  reporterId: string
  reporterName: string
  status: "pending" | "approved" | "rejected"
  createdAt: string
  updatedAt: string
  postId?: string
  authorId?: string
  fishtankId?: string
}

export default function ReportsScreen() {
  const router = useRouter()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all")

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

  const handleStatusChange = async (reportId: string, newStatus: "approved" | "rejected") => {
    try {
      const reportRef = doc(db, "reports", reportId)
      await updateDoc(reportRef, {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      })

      setReports((prevReports) =>
        prevReports.map((report) =>
          report.id === reportId ? { ...report, status: newStatus } : report
        )
      )

      Alert.alert(
        "Éxito",
        `Reporte ${newStatus === "approved" ? "aprobado" : "rechazado"} correctamente`
      )
    } catch (error) {
      console.error("Error al actualizar estado del reporte:", error)
      Alert.alert("Error", "No se pudo actualizar el estado del reporte")
    }
  }

  const handleViewContent = async (report: Report) => {
    try {
      console.log("Navegando a contenido reportado:", report)
      
      // Determinar el tipo de reporte basado en los campos disponibles
      let reportType = report.type
      if (!reportType) {
        if (report.postId) {
          reportType = "post"
        } else if (report.authorId) {
          reportType = "user"
        } else if (report.fishtankId) {
          reportType = "fishtank"
        }
      }
      
      console.log("Tipo de reporte determinado:", reportType)
      
      switch (reportType) {
        case "post":
          console.log("Navegando a post:", report.postId || report.targetId)
          router.push({
            pathname: "/(drawer)/(tabs)/stackhome/post-detail",
            params: { 
              postId: report.postId || report.targetId,
              fromReports: "true"
            }
          })
          break
        case "comment":
          console.log("Navegando a comentario:", report.targetId)
          const commentRef = doc(db, "comments", report.targetId)
          const commentDoc = await getDoc(commentRef)
          if (commentDoc.exists()) {
            const postId = commentDoc.data().postId
            console.log("Post ID encontrado:", postId)
            router.push({
              pathname: "/(drawer)/(tabs)/stackhome/post-detail",
              params: { postId, commentId: report.targetId }
            })
          } else {
            console.log("No se encontró el comentario")
            Alert.alert("Error", "No se encontró el comentario reportado")
          }
          break
        case "user":
          console.log("Navegando a perfil de usuario:", report.authorId || report.targetId)
          router.push({
            pathname: "/(drawer)/(tabs)/stackhome/profile",
            params: { userId: report.authorId || report.targetId }
          })
          break
        case "fishtank":
          console.log("Navegando a pecera:", report.fishtankId || report.targetId)
          router.push({
            pathname: "/(drawer)/(tabs)/stackfishtanks/[id]",
            params: { id: report.fishtankId || report.targetId }
          })
          break
        default:
          console.log("Tipo de reporte no reconocido:", reportType)
          Alert.alert("Error", "No se pudo determinar el tipo de contenido reportado")
      }
    } catch (error) {
      console.error("Error al navegar al contenido:", error)
      Alert.alert("Error", "No se pudo acceder al contenido reportado")
    }
  }

  const getReportTypeIcon = (report: Report) => {
    // Determinar el tipo de reporte basado en los campos disponibles
    let type = report.type
    if (!type) {
      if (report.postId) {
        type = "post"
      } else if (report.authorId) {
        type = "user"
      } else if (report.fishtankId) {
        type = "fishtank"
      }
    }
    
    switch (type) {
      case "post":
        return "file-text"
      case "comment":
        return "message-square"
      case "user":
        return "user"
      case "fishtank":
        return "layers"
      default:
        return "alert-circle"
    }
  }

  const getReportTypeText = (report: Report) => {
    // Determinar el tipo de reporte basado en los campos disponibles
    let type = report.type
    if (!type) {
      if (report.postId) {
        type = "post"
      } else if (report.authorId) {
        type = "user"
      } else if (report.fishtankId) {
        type = "fishtank"
      }
    }
    
    if (!type) return "Desconocido"
    return type.charAt(0).toUpperCase() + type.slice(1)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "#F59E0B"
      case "approved":
        return "#10B981"
      case "rejected":
        return "#EF4444"
      default:
        return "#6B7280"
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return "Pendiente"
      case "approved":
        return "Aprobado"
      case "rejected":
        return "Rechazado"
      default:
        return status
    }
  }

  const renderReportItem = ({ item }: { item: Report }) => (
    <TouchableOpacity 
      style={styles.reportCard}
      onPress={() => handleViewContent(item)}
    >
      <View style={styles.reportHeader}>
        <View style={styles.reportType}>
          <Feather name={getReportTypeIcon(item)} size={20} color="#8BB9FE" />
          <Text style={styles.reportTypeText}>
            {getReportTypeText(item)}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
        </View>
      </View>

      <Text style={styles.reasonText}>{item.reason}</Text>
      {item.description && <Text style={styles.descriptionText}>{item.description}</Text>}

      <View style={styles.reportFooter}>
        <Text style={styles.reporterText}>Reportado por: {item.reporterName}</Text>
        <Text style={styles.dateText}>
          {new Date(item.createdAt).toLocaleDateString()}
        </Text>
      </View>

      {item.status === "pending" && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.resolveButton]}
            onPress={(e) => {
              e.stopPropagation()
              handleStatusChange(item.id, "approved")
            }}
          >
            <Feather name="check" size={16} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Aprobar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.dismissButton]}
            onPress={(e) => {
              e.stopPropagation()
              handleStatusChange(item.id, "rejected")
            }}
          >
            <Feather name="x" size={16} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Rechazar</Text>
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
        <Text style={[styles.filterButtonText, filter === "all" && styles.filterButtonTextActive]}>
          Todos
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.filterButton, filter === "pending" && styles.filterButtonActive]}
        onPress={() => setFilter("pending")}
      >
        <Text style={[styles.filterButtonText, filter === "pending" && styles.filterButtonTextActive]}>
          Pendientes
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.filterButton, filter === "approved" && styles.filterButtonActive]}
        onPress={() => setFilter("approved")}
      >
        <Text style={[styles.filterButtonText, filter === "approved" && styles.filterButtonTextActive]}>
          Aprobados
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.filterButton, filter === "rejected" && styles.filterButtonActive]}
        onPress={() => setFilter("rejected")}
      >
        <Text style={[styles.filterButtonText, filter === "rejected" && styles.filterButtonTextActive]}>
          Rechazados
        </Text>
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="flag" size={48} color="#8BB9FE" />
            <Text style={styles.emptyText}>No hay reportes para mostrar</Text>
            {filter !== "all" && (
              <Text style={styles.emptySubText}>
                No hay reportes con el estado seleccionado
              </Text>
            )}
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
