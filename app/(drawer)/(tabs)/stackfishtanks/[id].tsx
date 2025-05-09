"use client"

import React, { useState, useEffect } from "react"
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
} from "react-native"
import { Feather } from "@expo/vector-icons"
import { useRouter, useLocalSearchParams, Stack } from "expo-router"

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
  deleteDoc, 
  increment 
} from "firebase/firestore"
import { db } from "../../../../config/Firebase_Conf"

type Pecera = {
  id: string;
  nombre: string;
  descripcion: string | null;
  imagenURL: string | null;
  creadoPor: string;
  fechaCreacion: any;
  miembrosCount: number;
  esPublica: boolean;
}

type Membresia = {
  esMiembro: boolean;
  rol: 'admin' | 'moderador' | 'miembro' | null;
  fechaUnion?: any;
}

const FishtankDetailScreen = () => {
  const router = useRouter()
  const { id } = useLocalSearchParams()
  const auth = getAuth()
  
  const [pecera, setPecera] = useState<Pecera | null>(null)
  const [creador, setCreador] = useState<{id: string, username: string} | null>(null)
  const [membresia, setMembresia] = useState<Membresia>({ esMiembro: false, rol: null })
  const [loading, setLoading] = useState(true)
  const [loadingAction, setLoadingAction] = useState(false)

  const handleBack = () => {
    router.back()
  }

  const cargarPecera = async () => {
    try {
      setLoading(true)
      
      if (!id) {
        Alert.alert("Error", "ID de pecera no válido")
        router.back()
        return
      }
      
      const peceraRef = doc(db, "peceras", id as string)
      const peceraSnap = await getDoc(peceraRef)
      
      if (!peceraSnap.exists()) {
        Alert.alert("Error", "La pecera no existe")
        router.back()
        return
      }
      
      const peceraData = peceraSnap.data() as Pecera
      setPecera({
        id: peceraSnap.id,
        ...peceraData
      })
      
      if (peceraData.creadoPor) {
        const creadorRef = doc(db, "users", peceraData.creadoPor)
        const creadorSnap = await getDoc(creadorRef)
        
        if (creadorSnap.exists()) {
          const creadorData = creadorSnap.data()
          setCreador({
            id: creadorSnap.id,
            username: creadorData.username || "Usuario"
          })
        }
      }
      
      const currentUser = auth.currentUser
      if (currentUser) {
        const membresiaQuery = query(
          collection(db, "peceras_miembros"),
          where("peceraID", "==", id),
          where("userID", "==", currentUser.uid)
        )
        
        const membresiaSnap = await getDocs(membresiaQuery)
        
        if (!membresiaSnap.empty) {
          const membresiaData = membresiaSnap.docs[0].data()
          setMembresia({
            esMiembro: true,
            rol: membresiaData.rol as 'admin' | 'moderador' | 'miembro',
            fechaUnion: membresiaData.fechaUnion
          })
        }
      }
    } catch (error) {
      console.error("Error al cargar la pecera:", error)
      Alert.alert("Error", "No se pudo cargar la información de la pecera")
    } finally {
      setLoading(false)
    }
  }

  const unirseAPecera = async () => {
    try {
      const currentUser = auth.currentUser
      if (!currentUser) {
        Alert.alert("Error", "Debes iniciar sesión para unirte a una pecera")
        return
      }
      
      setLoadingAction(true)
      
      const membresiaQuery = query(
        collection(db, "peceras_miembros"),
        where("peceraID", "==", id),
        where("userID", "==", currentUser.uid)
      )
      
      const membresiaSnap = await getDocs(membresiaQuery)
      
      if (!membresiaSnap.empty) {
        Alert.alert("Error", "Ya eres miembro de esta pecera")
        return
      }
      
      await addDoc(collection(db, "peceras_miembros"), {
        peceraID: id,
        userID: currentUser.uid,
        rol: 'miembro',
        fechaUnion: new Date()
      })
      
      const peceraRef = doc(db, "peceras", id as string)
      await updateDoc(peceraRef, {
        miembrosCount: increment(1)
      })
      
      setMembresia({ 
        esMiembro: true, 
        rol: 'miembro',
        fechaUnion: new Date()
      })
      
      if (pecera) {
        setPecera({
          ...pecera,
          miembrosCount: pecera.miembrosCount + 1
        })
      }
      
      Alert.alert("Éxito", "Te has unido a la pecera")
    } catch (error) {
      console.error("Error al unirse a la pecera:", error)
      Alert.alert("Error", "No se pudo unir a la pecera")
    } finally {
      setLoadingAction(false)
    }
  }

  const abandonarPecera = async () => {
    try {
      const currentUser = auth.currentUser
      if (!currentUser) {
        Alert.alert("Error", "Debes iniciar sesión")
        return
      }
      
      setLoadingAction(true)
      
      const membresiaQuery = query(
        collection(db, "peceras_miembros"),
        where("peceraID", "==", id),
        where("userID", "==", currentUser.uid)
      )
      
      const membresiaSnap = await getDocs(membresiaQuery)
      
      if (membresiaSnap.empty) {
        Alert.alert("Error", "No eres miembro de esta pecera")
        return
      }
      
      const miembro = membresiaSnap.docs[0].data()
      
      if (miembro.rol === 'admin') {
        const adminsQuery = query(
          collection(db, "peceras_miembros"),
          where("peceraID", "==", id),
          where("rol", "==", "admin")
        )
        
        const adminsSnap = await getDocs(adminsQuery)
        
        if (adminsSnap.size === 1) {
          Alert.alert(
            "Error", 
            "Eres el único administrador. Asigna otro admin antes de salir."
          )
          return
        }
      }
      
      await deleteDoc(membresiaSnap.docs[0].ref)
      
      const peceraRef = doc(db, "peceras", id as string)
      await updateDoc(peceraRef, {
        miembrosCount: increment(-1)
      })
      
      setMembresia({ esMiembro: false, rol: null })
      
      if (pecera) {
        setPecera({
          ...pecera,
          miembrosCount: Math.max(0, pecera.miembrosCount - 1)
        })
      }
      
      Alert.alert("Éxito", "Has abandonado la pecera correctamente")
    } catch (error) {
      console.error("Error al abandonar la pecera:", error)
      Alert.alert("Error", "No se pudo abandonar la pecera")
    } finally {
      setLoadingAction(false)
    }
  }

  useEffect(() => {
    cargarPecera()
  }, [id])

  const Content = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A6FFF" />
        </View>
      )
    }

    if (!pecera) {
      return (
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={64} color="#FF3B30" />
          <Text style={styles.errorText}>No se pudo cargar la pecera</Text>
          <TouchableOpacity style={styles.backToListButton} onPress={handleBack}>
            <Text style={styles.backToListText}>Volver a la lista</Text>
          </TouchableOpacity>
        </View>
      )
    }

    return (
      <ScrollView style={styles.contentContainer}>
        <View style={styles.headerContainer}>
          <View style={styles.peceraImagePlaceholder}>
            <Feather name="image" size={48} color="#8E8E93" />
          </View>
          
          <View style={styles.peceraInfo}>
            <View style={styles.peceraHeader}>
              <Text style={styles.peceraNombre}>{pecera.nombre}</Text>
              
              {!membresia.esMiembro ? (
                <TouchableOpacity 
                  style={styles.joinButton}
                  onPress={unirseAPecera}
                  disabled={loadingAction}
                >
                  {loadingAction ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.joinButtonText}>Unirse</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <View style={styles.membershipContainer}>
                  <Text style={styles.rolBadge}>
                    {membresia.rol === 'admin' 
                      ? 'Administrador' 
                      : membresia.rol === 'moderador' 
                        ? 'Moderador' 
                        : 'Miembro'}
                  </Text>
                  <TouchableOpacity
                    style={styles.leaveButton}
                    onPress={abandonarPecera}
                    disabled={loadingAction}
                  >
                    {loadingAction ? (
                      <ActivityIndicator size="small" color="#FF3B30" />
                    ) : (
                      <Text style={styles.leaveButtonText}>Abandonar</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
            
            {pecera.descripcion && (
              <Text style={styles.peceraDescripcion}>{pecera.descripcion}</Text>
            )}
            
            <View style={styles.peceraStats}>
              <Text style={styles.statText}>
                {pecera.miembrosCount} miembro{pecera.miembrosCount !== 1 ? 's' : ''}
              </Text>
              {creador && (
                <Text style={styles.statText}>
                  Creada por {creador.username}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.postsHeaderContainer}>
            <Text style={styles.postsHeaderText}>Publicaciones</Text>
          </View>
          
          <View style={styles.emptyContainer}>
            <Feather name="message-circle" size={64} color="#8E8E93" />
            <Text style={styles.emptyText}>
              No hay publicaciones en esta pecera
            </Text>
            {membresia.esMiembro ? (
              <Text style={styles.emptySubtext}>
                ¡Sé el primero en publicar algo!
              </Text>
            ) : (
              <Text style={styles.emptySubtext}>
                Únete a esta pecera para poder publicar
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
    )
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
              onPress={handleBack}
            >
              <Feather name="arrow-left" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.topBarTitle}>Pecera</Text>
            <View style={{ width: 40 }} />
          </View>
          
          <Content />
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
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
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
    marginBottom: 24,
  },
  backToListButton: {
    backgroundColor: "#4A6FFF",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  backToListText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  contentContainer: {
    flex: 1,
  },
  headerContainer: {
    backgroundColor: "#2A3142",
  },
  peceraImagePlaceholder: {
    width: "100%",
    height: 200,
    backgroundColor: "#3A4154",
    justifyContent: "center",
    alignItems: "center",
  },
  peceraInfo: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#3A4154",
  },
  peceraHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  peceraNombre: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#FFFFFF",
    flex: 1,
  },
  joinButton: {
    backgroundColor: "#4A6FFF",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  joinButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  membershipContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  rolBadge: {
    fontSize: 12,
    color: "#8E8E93",
    marginRight: 8,
  },
  leaveButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  leaveButtonText: {
    color: "#FF3B30",
    fontWeight: "500",
  },
  peceraDescripcion: {
    fontSize: 16,
    color: "#CCCCCC",
    marginBottom: 16,
  },
  peceraStats: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statText: {
    fontSize: 14,
    color: "#8E8E93",
  },
  postsHeaderContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#3A4154",
  },
  postsHeaderText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: "#8E8E93",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#4A6FFF",
    marginTop: 8,
  }
})

export default FishtankDetailScreen