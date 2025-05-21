"use client"

import React, { useState, useEffect } from "react"
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  StatusBar,
  SafeAreaView,
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
  addDoc, 
  updateDoc, 
  increment,
  onSnapshot
} from "firebase/firestore"
import { db } from "../../../../config/Firebase_Conf"
import { useAuth } from "@/context/AuthContext"
import { FishTank, User, JoinRequestStatus } from "@/app/types/types"

const RequestJoinScreen = () => {
  const router = useRouter()
  const { id } = useLocalSearchParams()
  const auth = getAuth()
  const { user: authUser } = useAuth()
  
  const [fishtank, setFishtank] = useState<FishTank | null>(null)
  const [creator, setCreator] = useState<{id: string, username: string} | null>(null)
  const [loading, setLoading] = useState(true)
  const [sendingRequest, setSendingRequest] = useState(false)
  const [requestStatus, setRequestStatus] = useState<JoinRequestStatus | null>(null)

  // Cargar información de la pecera
  const loadFishtank = async () => {
    try {
      setLoading(true)
      
      if (!id) {
        Alert.alert("Error", "ID de pecera no válido")
        router.back()
        return
      }
      
      const fishtankRef = doc(db, "fishtanks", id as string)
      const fishtankSnap = await getDoc(fishtankRef)
      
      if (!fishtankSnap.exists()) {
        Alert.alert("Error", "La pecera no existe")
        router.back()
        return
      }
      
      const fishtankData = fishtankSnap.data() as FishTank
      setFishtank({
        ...fishtankData,
        id: fishtankSnap.id
      })
      
      // Cargar información del creador
      if (fishtankData.creatorId) {
        const creatorRef = doc(db, "users", fishtankData.creatorId)
        const creatorSnap = await getDoc(creatorRef)
        
        if (creatorSnap.exists()) {
          const creatorData = creatorSnap.data()
          setCreator({
            id: creatorSnap.id,
            username: creatorData.username || "Usuario"
          })
        }
      }

      // Verificar si ya existe una solicitud
      const currentUser = auth.currentUser
      if (currentUser) {
        const requestsQuery = query(
          collection(db, "fishtank_join_requests"),
          where("fishtankId", "==", id),
          where("userId", "==", currentUser.uid)
        )
        
        const requestDocs = await getDocs(requestsQuery)
        if (!requestDocs.empty) {
          const requestData = requestDocs.docs[0].data()
          setRequestStatus(requestData.status as JoinRequestStatus)
        } else {
          setRequestStatus(null)
        }
      }
    } catch (error) {
      console.error("Error loading fishtank:", error)
      Alert.alert("Error", "No se pudo cargar la información de la pecera")
    } finally {
      setLoading(false)
    }
  }

  // Enviar solicitud
  const sendJoinRequest = async () => {
    if (!auth.currentUser || !fishtank) {
      Alert.alert("Error", "Debes iniciar sesión para enviar una solicitud")
      return
    }

    // Solo bloquear si hay una solicitud pendiente
    if (requestStatus === "pending") {
      Alert.alert(
        "Solicitud existente",
        "Ya tienes una solicitud pendiente para esta pecera"
      )
      return
    }

    try {
      setSendingRequest(true)
      const currentDate = new Date().toISOString()
      const fishtankId = id as string
      
      // Crear la solicitud
      await addDoc(collection(db, "fishtank_join_requests"), {
        fishtankId,
        userId: auth.currentUser.uid,
        status: "pending",
        createdAt: currentDate,
        updatedAt: currentDate
      })

      // Actualizar la pecera
      await updateDoc(doc(db, "fishtanks", fishtankId), {
        pendingCount: increment(1),
        updatedAt: currentDate
      })

      Alert.alert(
        "Solicitud enviada",
        "Tu solicitud para unirte a esta pecera ha sido enviada.",
        [
          {
            text: "OK",
            onPress: () => router.back()
          }
        ]
      )
    } catch (error) {
      console.error("Error al enviar solicitud:", error)
      Alert.alert("Error", "No se pudo enviar la solicitud")
    } finally {
      setSendingRequest(false)
    }
  }

  // Agregar efecto para escuchar cambios en las solicitudes
  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser || !id) return;

    const requestsQuery = query(
      collection(db, "fishtank_join_requests"),
      where("fishtankId", "==", id),
      where("userId", "==", currentUser.uid)
    );

    const unsubscribe = onSnapshot(requestsQuery, (snapshot) => {
      if (!snapshot.empty) {
        const requestData = snapshot.docs[0].data();
        setRequestStatus(requestData.status as JoinRequestStatus);
      } else {
        setRequestStatus(null);
      }
    }, (error) => {
      console.error("Error al escuchar cambios en solicitudes:", error);
    });

    // Limpiar el listener cuando el componente se desmonte
    return () => unsubscribe();
  }, [id, auth.currentUser]);

  useEffect(() => {
    loadFishtank()
  }, [id])

  // Componente para mostrar el estado de la solicitud
  const RequestStatusView = () => {
    switch (requestStatus) {
      case "pending":
        return (
          <View style={styles.existingRequestContainer}>
            <Feather name="clock" size={24} color="#FFC107" />
            <Text style={styles.existingRequestText}>
              Solicitud pendiente
            </Text>
          </View>
        );
      case "rejected":
        return (
          <View>
            <View style={[styles.existingRequestContainer, { backgroundColor: "#4A1C1C" }]}>
              <Feather name="x-circle" size={24} color="#FF3B30" />
              <Text style={[styles.existingRequestText, { color: "#FF3B30" }]}>
                Solicitud rechazada
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.requestButton, { marginTop: 12 }]}
              onPress={sendJoinRequest}
              disabled={sendingRequest}
            >
              {sendingRequest ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="refresh-cw" size={20} color="#FFFFFF" style={styles.requestIcon} />
                  <Text style={styles.requestButtonText}>Volver a solicitar</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        );
      case "accepted":
        return (
          <View style={[styles.existingRequestContainer, { backgroundColor: "#1C4A1C" }]}>
            <Feather name="check-circle" size={24} color="#30D158" />
            <Text style={[styles.existingRequestText, { color: "#30D158" }]}>
              Solicitud aceptada
            </Text>
          </View>
        );
      default:
        return (
          <TouchableOpacity
            style={styles.requestButton}
            onPress={sendJoinRequest}
            disabled={sendingRequest}
          >
            {sendingRequest ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Feather name="send" size={20} color="#FFFFFF" style={styles.requestIcon} />
                <Text style={styles.requestButtonText}>Enviar solicitud</Text>
              </>
            )}
          </TouchableOpacity>
        );
    }
  };

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
            <Text style={styles.topBarTitle}>Solicitar unirse</Text>
            <View style={{ width: 40 }} />
          </View>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4A6FFF" />
            </View>
          ) : !fishtank ? (
            <View style={styles.errorContainer}>
              <Feather name="alert-circle" size={64} color="#FF3B30" />
              <Text style={styles.errorText}>No se pudo cargar la pecera</Text>
            </View>
          ) : (
            <View style={styles.content}>
              <View style={styles.fishtankInfo}>
                {fishtank.fishTankPicture ? (
                  <Image 
                    source={{ uri: fishtank.fishTankPicture }}
                    style={styles.fishtankImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.fishtankImagePlaceholder}>
                    <Feather name="image" size={48} color="#8E8E93" />
                  </View>
                )}
                
                <Text style={styles.fishtankName}>{fishtank.name}</Text>
                
                {creator && (
                  <Text style={styles.creatorText}>
                    Creada por @{creator.username}
                  </Text>
                )}
                
                <Text style={styles.memberCount}>
                  {fishtank.memberCount} miembro{fishtank.memberCount !== 1 ? 's' : ''}
                </Text>
                
                {fishtank.description && (
                  <Text style={styles.description}>{fishtank.description}</Text>
                )}
              </View>
              
              <View style={styles.actions}>
                <RequestStatusView />
              </View>
            </View>
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
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: "#FFFFFF",
    marginTop: 16,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  fishtankInfo: {
    backgroundColor: "#334155",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 24,
  },
  fishtankImage: {
    width: "100%",
    height: 200,
    backgroundColor: "#3A4154",
  },
  fishtankImagePlaceholder: {
    width: "100%",
    height: 200,
    backgroundColor: "#3A4154",
    justifyContent: "center",
    alignItems: "center",
  },
  fishtankName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
    padding: 16,
    paddingBottom: 8,
  },
  creatorText: {
    fontSize: 16,
    color: "#8E8E93",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  memberCount: {
    fontSize: 14,
    color: "#8E8E93",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  description: {
    fontSize: 16,
    color: "#CCCCCC",
    padding: 16,
    paddingTop: 0,
  },
  actions: {
    padding: 16,
  },
  requestButton: {
    backgroundColor: "#4A6FFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
  },
  requestIcon: {
    marginRight: 8,
  },
  requestButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  existingRequestContainer: {
    backgroundColor: "#334155",
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
  },
  existingRequestText: {
    color: "#FFFFFF",
    fontSize: 16,
    marginLeft: 12,
    flex: 1,
  },
})

export default RequestJoinScreen 