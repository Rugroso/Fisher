"use client"

import { useState, useEffect } from "react"
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  StatusBar,
  SafeAreaView,
  Platform,
  Image,
} from "react-native"
import { Feather } from "@expo/vector-icons"
import { useRouter, Stack, useLocalSearchParams } from "expo-router"

import { getAuth } from "firebase/auth"
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  updateDoc, 
  deleteDoc, 
  increment,
  orderBy,
  addDoc,
  onSnapshot
} from "firebase/firestore"
import { db } from "../../../../config/Firebase_Conf"
import { useAuth } from "@/context/AuthContext"

type JoinRequestStatus = 'pending' | 'accepted' | 'rejected';

interface JoinRequest {
  id: string;
  fishtankId: string;
  userId: string;
  status: JoinRequestStatus;
  createdAt: any;
  updatedAt?: any;
  userData?: {
    username: string;
    profilePicture?: string;
  };
  fishtankData?: {
    name: string;
    description?: string;
    memberCount: number;
  };
}

const FishtankRequestsScreen = () => {
  const router = useRouter()
  const auth = getAuth()
  const { user: authUser } = useAuth()
  const { id } = useLocalSearchParams()
  
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingAction, setLoadingAction] = useState(false)

  // Reemplazar el useEffect existente con uno que use onSnapshot
  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    
    const requestsQuery = query(
      collection(db, "fishtank_join_requests"),
      where("fishtankId", "==", id),
      where("status", "==", "pending"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(requestsQuery, async (snapshot) => {
      try {
        const requests: JoinRequest[] = [];
        
        for (const requestDoc of snapshot.docs) {
          const requestData = requestDoc.data();
          
          // Obtener datos del usuario
          const userRef = doc(db, "users", requestData.userId);
          const userDoc = await getDoc(userRef);
          
          // Obtener datos de la pecera
          const fishtankRef = doc(db, "fishtanks", requestData.fishtankId);
          const fishtankDoc = await getDoc(fishtankRef);
          
          requests.push({
            id: requestDoc.id,
            ...requestData,
            userData: userDoc.exists() ? {
              username: userDoc.data().username || "Usuario",
              profilePicture: userDoc.data().profilePicture
            } : undefined,
            fishtankData: fishtankDoc.exists() ? {
              name: fishtankDoc.data().name,
              description: fishtankDoc.data().description,
              memberCount: fishtankDoc.data().memberCount
            } : undefined
          } as JoinRequest);
        }
        
        setJoinRequests(requests);
      } catch (error) {
        console.error("Error al procesar solicitudes:", error);
      } finally {
        setLoading(false);
      }
    }, (error) => {
      console.error("Error al escuchar cambios en solicitudes:", error);
      setLoading(false);
    });

    // Limpiar el listener cuando el componente se desmonte
    return () => unsubscribe();
  }, [id]);

  // Manejar respuesta a solicitud
  const handleRequestResponse = async (requestId: string, accept: boolean) => {
    try {
      setLoadingAction(true)
      
      const requestRef = doc(db, "fishtank_join_requests", requestId)
      const requestDoc = await getDoc(requestRef)
      
      if (!requestDoc.exists()) {
        Alert.alert("Error", "La solicitud no existe")
        return
      }
      
      const requestData = requestDoc.data()
      const currentDate = new Date().toISOString()
      
      // Actualizar estado de la solicitud
      await updateDoc(requestRef, {
        status: accept ? "accepted" : "rejected",
        updatedAt: currentDate
      })
      
      if (accept) {
        // Si se acepta, agregar al usuario como miembro
        await addDoc(collection(db, "fishtank_members"), {
          fishtankId: requestData.fishtankId,
          userId: requestData.userId,
          role: "member",
          joinedAt: currentDate
        })
        
        // Actualizar contador de miembros
        const fishtankRef = doc(db, "fishtanks", requestData.fishtankId)
        await updateDoc(fishtankRef, {
          memberCount: increment(1),
          pendingCount: increment(-1),
          updatedAt: currentDate
        })
      } else {
        // Si se rechaza, solo actualizar contador de solicitudes pendientes
        const fishtankRef = doc(db, "fishtanks", requestData.fishtankId)
        await updateDoc(fishtankRef, {
          pendingCount: increment(-1),
          updatedAt: currentDate
        })
      }
      
      // Actualizar lista de solicitudes
      setJoinRequests(prev => prev.filter(req => req.id !== requestId))
      
      Alert.alert(
        "Éxito",
        accept ? "Usuario agregado a la pecera" : "Solicitud rechazada"
      )
    } catch (error) {
      console.error("Error al procesar solicitud:", error)
      Alert.alert("Error", "No se pudo procesar la solicitud")
    } finally {
      setLoadingAction(false)
    }
  }

  return (
    <>
      <Stack.Screen 
        options={{
          headerShown: false,
          title: ""
        }} 
      />
      
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#2A3142" />
        
        <View style={styles.container}>
          <View style={styles.topBar}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Feather name="arrow-left" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.topBarTitle}>Solicitudes pendientes</Text>
            <View style={{ width: 40 }} />
          </View>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4A6FFF" />
            </View>
          ) : joinRequests.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Feather name="inbox" size={64} color="#8E8E93" />
              <Text style={styles.emptyText}>
                No hay solicitudes pendientes
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.requestsList}>
              {joinRequests.map((request) => (
                <View key={request.id} style={styles.requestItem}>
                  <View style={styles.requestHeader}>
                    <View style={styles.userInfo}>
                      {request.userData?.profilePicture ? (
                        <Image 
                          source={{ uri: request.userData.profilePicture }}
                          style={styles.userAvatar}
                        />
                      ) : (
                        <View style={styles.userAvatarPlaceholder}>
                          <Feather name="user" size={20} color="#FFFFFF" />
                        </View>
                      )}
                      <Text style={styles.username}>
                        @{request.userData?.username || "Usuario"}
                      </Text>
                    </View>
                    <Text style={styles.requestDate}>
                      {new Date(request.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  
                  <View style={styles.fishtankInfo}>
                    <Text style={styles.fishtankName}>
                      {request.fishtankData?.name || "Pecera"}
                    </Text>
                    <Text style={styles.memberCount}>
                      {request.fishtankData?.memberCount || 0} miembros
                    </Text>
                  </View>
                  
                  <View style={styles.requestActions}>
                    <TouchableOpacity
                      style={[styles.requestButton, styles.acceptButton]}
                      onPress={() => handleRequestResponse(request.id, true)}
                      disabled={loadingAction}
                    >
                      <Feather name="check" size={20} color="#FFFFFF" />
                      <Text style={styles.requestButtonText}>Aceptar</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.requestButton, styles.rejectButton]}
                      onPress={() => handleRequestResponse(request.id, false)}
                      disabled={loadingAction}
                    >
                      <Feather name="x" size={20} color="#FFFFFF" />
                      <Text style={styles.requestButtonText}>Rechazar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </SafeAreaView>
    </>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#2A3142",
  },
  container: {
    flex: 1,
    backgroundColor: "#2A3142",
        alignSelf: "center",
    width: Platform.OS === 'web' ? "100%":"100%",
    maxWidth: Platform.OS === 'web' ? 800 : "100%",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#2A3142",
    borderBottomWidth: 1,
    borderBottomColor: "#3A4154",
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  backButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: "#8E8E93",
    marginTop: 16,
  },
  requestsList: {
    flex: 1,
    padding: 16,
    alignSelf: "center",
    width: Platform.OS === 'web' ? "100%":"100%",
    maxWidth: Platform.OS === 'web' ? 800 : "100%",
  },
  requestItem: {
    backgroundColor: "#334155",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  requestHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
        alignSelf: "center",
    width: Platform.OS === 'web' ? "100%":"100%",
    maxWidth: Platform.OS === 'web' ? 800 : "100%",
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  userAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#4C5366",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  username: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  requestDate: {
    color: "#8E8E93",
    fontSize: 14,
  },
  fishtankInfo: {
    marginBottom: 16,
  },
  fishtankName: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  memberCount: {
    color: "#8E8E93",
    fontSize: 14,
  },
  requestActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  requestButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  acceptButton: {
    backgroundColor: "#30D158",
  },
  rejectButton: {
    backgroundColor: "#FF3B30",
  },
  requestButtonText: {
    color: "#FFFFFF",
    marginLeft: 4,
    fontWeight: "600",
  },
})

export default FishtankRequestsScreen 