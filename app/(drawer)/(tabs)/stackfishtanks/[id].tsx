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
import { useAuth } from "@/context/AuthContext"
import { FishTank } from "@/app/types/types"

type Membership = {
  isMember: boolean
  role: 'admin' | 'moderator' | 'member' | null
  joinedAt?: any
}

const FishtankDetailScreen = () => {
  const router = useRouter()
  const { id } = useLocalSearchParams()
  const auth = getAuth()
  const { user: authUser } = useAuth() // Usar el contexto de autenticación
  
  const [fishtank, setFishtank] = useState<FishTank | null>(null)
  const [creator, setCreator] = useState<{id: string, username: string} | null>(null)
  const [membership, setMembership] = useState<Membership>({ isMember: false, role: null })
  const [loading, setLoading] = useState(true)
  const [loadingAction, setLoadingAction] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false) // Estado para controlar si el usuario es admin

  // Comprobar si el usuario es administrador al montar el componente
  useEffect(() => {
    const checkAdminStatus = async () => {
      // Si tenemos el rol de usuario en el contexto, lo usamos directamente
      if (authUser?.isAdmin !== undefined) {
        setIsAdmin(authUser.isAdmin);
        return;
      }
      
      // De lo contrario, verificamos en Firestore
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) return;
        
        const userRef = doc(db, "users", currentUser.uid);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setIsAdmin(userData.isAdmin === true);
        }
      } catch (error) {
        console.error("Error verificando estado de administrador:", error);
      }
    };
    
    checkAdminStatus();
  }, [authUser]);

  // Este efecto se ejecutará cada vez que cambie el ID
  useEffect(() => {
    // Reiniciar los estados al cambiar de pecera
    setFishtank(null);
    setCreator(null);
    setMembership({ isMember: false, role: null });
    setHasAccess(false);
    // No reiniciamos isAdmin porque ese valor depende del usuario, no de la pecera
    
    loadFishtank();
  }, [id]);  // Dependencia en el ID para recargar cuando cambia

  const handleBack = () => {
    // Imprimir información de depuración
    console.log("Estado de isAdmin:", isAdmin);
    console.log("Usuario actual:", auth.currentUser?.uid);
    
    try {
      // Si es administrador, ir a la página de administración
      if (isAdmin) {
        console.log("Navegando a la pantalla de admin: /(drawer)/(admintabs)/fishtanks");
        router.push("/(drawer)/(admintabs)/fishtanks");
      } else {
        // Si no es administrador, ir a la pantalla normal de peceras
        console.log("Navegando a la pantalla normal: /(drawer)/(tabs)/stackfishtanks/");
        router.push("/(drawer)/(tabs)/stackfishtanks/");
      }
    } catch (error) {
      console.error("Error en handleBack:", error);
      // En caso de error, intentar usar la navegación más básica
      router.back();
    }
  };

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
        id: fishtankSnap.id,
        ...fishtankData
      })
      
      const currentUser = auth.currentUser
      
      let userHasAccess = !fishtankData.isPrivate
      
      if (currentUser && fishtankData.isPrivate) {
        if (currentUser.uid === fishtankData.creatorId) {
          userHasAccess = true
        } else {
          const membershipQuery = query(
            collection(db, "fishtank_members"),
            where("fishtankId", "==", id),
            where("userId", "==", currentUser.uid)
          )
          
          const membershipSnap = await getDocs(membershipQuery)
          userHasAccess = !membershipSnap.empty
        }
      }
      
      setHasAccess(userHasAccess)
      
      // Solo cargar el resto de la información si tiene acceso
      if (userHasAccess) {
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
        
        if (currentUser) {
          const membershipQuery = query(
            collection(db, "fishtank_members"),
            where("fishtankId", "==", id),
            where("userId", "==", currentUser.uid)
          )
          
          const membershipSnap = await getDocs(membershipQuery)
          
          if (!membershipSnap.empty) {
            const membershipData = membershipSnap.docs[0].data()
            setMembership({
              isMember: true,
              role: membershipData.role as 'admin' | 'moderator' | 'member',
              joinedAt: membershipData.joinedAt
            })
          }
        }
      }
    } catch (error) {
      console.error("Error loading fishtank:", error)
      Alert.alert("Error", "No se pudo cargar la información de la pecera")
    } finally {
      setLoading(false)
    }
  }

  const joinFishtank = async () => {
    try {
      const currentUser = auth.currentUser
      if (!currentUser) {
        Alert.alert("Error", "Debes iniciar sesión para unirte a una pecera")
        return
      }
      
      if (fishtank?.isPrivate) {
        Alert.alert(
          "Error", 
          "No puedes unirte a una pecera privada. El creador debe invitarte."
        )
        return
      }
      
      setLoadingAction(true)
      
      const membershipQuery = query(
        collection(db, "fishtank_members"),
        where("fishtankId", "==", id),
        where("userId", "==", currentUser.uid)
      )
      
      const membershipSnap = await getDocs(membershipQuery)
      
      if (!membershipSnap.empty) {
        Alert.alert("Error", "Ya eres miembro de esta pecera")
        return
      }
      
      const currentDate = new Date().toISOString()
      
      await addDoc(collection(db, "fishtank_members"), {
        fishtankId: id,
        userId: currentUser.uid,
        role: 'member',
        joinedAt: currentDate
      })
      
      const fishtankRef = doc(db, "fishtanks", id as string)
      await updateDoc(fishtankRef, {
        memberCount: increment(1),
        updatedAt: currentDate
      })
      
      setMembership({ 
        isMember: true, 
        role: 'member',
        joinedAt: currentDate
      })
      
      if (fishtank) {
        setFishtank({
          ...fishtank,
          memberCount: fishtank.memberCount + 1,
          updatedAt: currentDate
        })
      }
      
      Alert.alert("Éxito", "Te has unido a la pecera")
    } catch (error) {
      console.error("Error joining fishtank:", error)
      Alert.alert("Error", "No se pudo unir a la pecera")
    } finally {
      setLoadingAction(false)
    }
  }

  const leaveFishtank = async () => {
    try {
      const currentUser = auth.currentUser
      if (!currentUser) {
        Alert.alert("Error", "Debes iniciar sesión")
        return
      }
      
      setLoadingAction(true)
      
      const membershipQuery = query(
        collection(db, "fishtank_members"),
        where("fishtankId", "==", id),
        where("userId", "==", currentUser.uid)
      )
      
      const membershipSnap = await getDocs(membershipQuery)
      
      if (membershipSnap.empty) {
        Alert.alert("Error", "No eres miembro de esta pecera")
        return
      }
      
      const member = membershipSnap.docs[0].data()
      
      if (member.role === 'admin') {
        const adminsQuery = query(
          collection(db, "fishtank_members"),
          where("fishtankId", "==", id),
          where("role", "==", "admin")
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
      
      await deleteDoc(membershipSnap.docs[0].ref)
      
      const currentDate = new Date().toISOString()
      const fishtankRef = doc(db, "fishtanks", id as string)
      await updateDoc(fishtankRef, {
        memberCount: increment(-1),
        updatedAt: currentDate
      })
      
      setMembership({ isMember: false, role: null })
      
      if (fishtank) {
        setFishtank({
          ...fishtank,
          memberCount: Math.max(0, fishtank.memberCount - 1),
          updatedAt: currentDate
        })
      }
      
      if (fishtank?.isPrivate) {
        setHasAccess(false)
      }
      
      Alert.alert("Éxito", "Has abandonado la pecera correctamente")
    } catch (error) {
      console.error("Error leaving fishtank:", error)
      Alert.alert("Error", "No se pudo abandonar la pecera")
    } finally {
      setLoadingAction(false)
    }
  }

  const PrivateAccessDenied = () => {
    return (
      <View style={styles.errorContainer}>
        <Feather name="lock" size={64} color="#FF3B30" />
        <Text style={styles.errorText}>Esta pecera es privada</Text>
        <Text style={styles.errorSubtext}>
          No tienes acceso a la información de esta pecera
        </Text>
        <TouchableOpacity style={styles.backToListButton} onPress={handleBack}>
          <Text style={styles.backToListText}>Volver a la lista</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const Content = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A6FFF" />
        </View>
      )
    }

    if (!fishtank) {
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
    
    // Si la pecera es privada y el usuario no tiene acceso, mostrar mensaje de acceso denegado
    if (fishtank.isPrivate && !hasAccess) {
      return <PrivateAccessDenied />
    }

    return (
      <ScrollView style={styles.contentContainer}>
        <View style={styles.headerContainer}>
          <View style={styles.fishtankImagePlaceholder}>
            <Feather name="image" size={48} color="#8E8E93" />
          </View>
          
          <View style={styles.fishtankInfo}>
            <View style={styles.fishtankHeader}>
              <Text style={styles.fishtankName}>{fishtank.name}</Text>
              
              {!membership.isMember ? (
                !fishtank.isPrivate ? (
                  <TouchableOpacity 
                    style={styles.joinButton}
                    onPress={joinFishtank}
                    disabled={loadingAction}
                  >
                    {loadingAction ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.joinButtonText}>Unirse</Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <View style={styles.privateBadgeSmall}>
                    <Feather name="lock" size={14} color="#FFFFFF" style={styles.privacyIcon} />
                    <Text style={styles.privateBadgeText}>Privada</Text>
                  </View>
                )
              ) : (
                <View style={styles.membershipContainer}>
                  <Text style={styles.roleBadge}>
                    {membership.role === 'admin' 
                      ? 'Administrador' 
                      : membership.role === 'moderator' 
                        ? 'Moderador' 
                        : 'Miembro'}
                  </Text>
                  <TouchableOpacity
                    style={styles.leaveButton}
                    onPress={leaveFishtank}
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
            
            {fishtank.description && (
              <Text style={styles.fishtankDescription}>{fishtank.description}</Text>
            )}
            
            <View style={styles.fishtankStats}>
              <Text style={styles.statText}>
                {fishtank.memberCount} miembro{fishtank.memberCount !== 1 ? 's' : ''}
              </Text>
              {creator && (
                <Text style={styles.statText}>
                  Creada por {creator.username}
                </Text>
              )}
            </View>

            <View style={styles.privacyBadgeContainer}>
              <View style={[
                styles.privacyBadge, 
                fishtank.isPrivate ? styles.privateBadge : styles.publicBadge
              ]}>
                <Feather 
                  name={fishtank.isPrivate ? "lock" : "globe"} 
                  size={14} 
                  color="#FFFFFF" 
                  style={styles.privacyIcon} 
                />
                <Text style={styles.privacyText}>
                  {fishtank.isPrivate ? "Pecera Privada" : "Pecera Pública"}
                </Text>
              </View>
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
            {membership.isMember ? (
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
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: "#8E8E93",
    marginBottom: 24,
    textAlign: "center",
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
  fishtankImagePlaceholder: {
    width: "100%",
    height: 200,
    backgroundColor: "#3A4154",
    justifyContent: "center",
    alignItems: "center",
  },
  fishtankInfo: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#3A4154",
  },
  fishtankHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  fishtankName: {
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
  roleBadge: {
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
  fishtankDescription: {
    fontSize: 16,
    color: "#CCCCCC",
    marginBottom: 16,
  },
  fishtankStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  statText: {
    fontSize: 14,
    color: "#8E8E93",
  },
  privateContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  privateIcon: {
    marginRight: 6,
  },
  privateText: {
    fontSize: 14,
    color: "#8E8E93",
    fontStyle: "italic",
  },
  privacyBadgeContainer: {
    marginTop: 12,
  },
  privacyBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    alignSelf: "flex-start",
  },
  privateBadge: {
    backgroundColor: "#AF52DE", 
  },
  publicBadge: {
    backgroundColor: "#30D158", 
  },
  privacyIcon: {
    marginRight: 6,
  },
  privacyText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
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
  },
  privateBadgeSmall: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#AF52DE",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  privateBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "500",
  }
})

export default FishtankDetailScreen