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
  Image,
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
  orderBy,
  updateDoc,
  increment,
} from "firebase/firestore"
import { db } from "../../../../config/Firebase_Conf"
import { useAuth } from "@/context/AuthContext"

interface Member {
  id: string;
  userId: string;
  role: 'admin' | 'moderator' | 'member';
  joinedAt: string;
  username: string;
  profilePicture?: string;
}

const MembersScreen = () => {
  const router = useRouter()
  const { id } = useLocalSearchParams()
  const auth = getAuth()
  const { user: authUser } = useAuth()
  
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [fishtankName, setFishtankName] = useState("")
  const [isAdmin, setIsAdmin] = useState(false)
  const [loadingAction, setLoadingAction] = useState<string | null>(null)

  useEffect(() => {
    loadMembers()
  }, [id])

  const loadMembers = async () => {
    try {
      setLoading(true)
      
      if (!id) {
        Alert.alert("Error", "ID de pecera no válido")
        router.back()
        return
      }

      // Obtener nombre de la pecera
      const fishtankRef = doc(db, "fishtanks", id as string)
      const fishtankSnap = await getDoc(fishtankRef)
      
      if (!fishtankSnap.exists()) {
        Alert.alert("Error", "La pecera no existe")
        router.back()
        return
      }

      setFishtankName(fishtankSnap.data().name)

      // Verificar si el usuario actual es admin
      const currentUser = auth.currentUser
      if (currentUser) {
        const membershipQuery = query(
          collection(db, "fishtank_members"),
          where("fishtankId", "==", id),
          where("userId", "==", currentUser.uid),
          where("role", "==", "admin")
        )
        const membershipSnap = await getDocs(membershipQuery)
        setIsAdmin(!membershipSnap.empty)
      }

      // Obtener miembros
      const membersQuery = query(
        collection(db, "fishtank_members"),
        where("fishtankId", "==", id),
        orderBy("joinedAt", "desc")
      )

      const membersSnap = await getDocs(membersQuery)
      const membersData: Member[] = []

      for (const memberDoc of membersSnap.docs) {
        const memberData = memberDoc.data()
        const userRef = doc(db, "users", memberData.userId)
        const userSnap = await getDoc(userRef)
        
        if (userSnap.exists()) {
          const userData = userSnap.data()
          membersData.push({
            id: memberDoc.id,
            userId: memberData.userId,
            role: memberData.role,
            joinedAt: memberData.joinedAt,
            username: userData.username || "Usuario",
            profilePicture: userData.profilePicture
          })
        }
      }

      setMembers(membersData)
    } catch (error) {
      console.error("Error loading members:", error)
      Alert.alert("Error", "No se pudieron cargar los miembros")
    } finally {
      setLoading(false)
    }
  }

  const handleMakeAdmin = async (memberId: string) => {
    try {
      setLoadingAction(memberId)
      
      const memberRef = doc(db, "fishtank_members", memberId)
      const fishtankRef = doc(db, "fishtanks", id as string)
      
      // Obtener el estado actual de la pecera
      const fishtankDoc = await getDoc(fishtankRef)
      if (!fishtankDoc.exists()) {
        throw new Error("La pecera no existe")
      }
      
      const fishtankData = fishtankDoc.data()
      const currentAdminCount = fishtankData.adminCount || 0
      
      // Actualizar el rol del miembro
      await updateDoc(memberRef, {
        role: "admin"
      })

      // Actualizar los contadores de la pecera
      await updateDoc(fishtankRef, {
        adminCount: currentAdminCount + 1,
        updatedAt: new Date().toISOString()
      })

      // Actualizar el estado local
      setMembers(members.map(member => 
        member.id === memberId 
          ? { ...member, role: "admin" }
          : member
      ))

      Alert.alert("Éxito", "El miembro ahora es administrador")
    } catch (error) {
      console.error("Error al hacer admin:", error)
      Alert.alert("Error", "No se pudo hacer administrador al miembro")
    } finally {
      setLoadingAction(null)
    }
  }

  const handleRemoveAdmin = async (memberId: string) => {
    try {
      setLoadingAction(memberId)
      
      const memberRef = doc(db, "fishtank_members", memberId)
      const fishtankRef = doc(db, "fishtanks", id as string)
      
      // Obtener el estado actual de la pecera
      const fishtankDoc = await getDoc(fishtankRef)
      if (!fishtankDoc.exists()) {
        throw new Error("La pecera no existe")
      }
      
      const fishtankData = fishtankDoc.data()
      const currentAdminCount = fishtankData.adminCount || 0
      
      // Actualizar el rol del miembro
      await updateDoc(memberRef, {
        role: "member"
      })

      // Actualizar los contadores de la pecera
      await updateDoc(fishtankRef, {
        adminCount: Math.max(0, currentAdminCount - 1),
        updatedAt: new Date().toISOString()
      })

      // Actualizar el estado local
      setMembers(members.map(member => 
        member.id === memberId 
          ? { ...member, role: "member" }
          : member
      ))

      Alert.alert("Éxito", "Se ha removido el rol de administrador")
    } catch (error) {
      console.error("Error al remover admin:", error)
      Alert.alert("Error", "No se pudo remover el rol de administrador")
    } finally {
      setLoadingAction(null)
    }
  }

  const handleBack = () => {
    router.back()
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return '#FF3B30'
      case 'moderator':
        return '#FF9500'
      default:
        return '#4A6FFF'
    }
  }

  const getRoleText = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administrador'
      case 'moderator':
        return 'Moderador'
      default:
        return 'Miembro'
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
              onPress={handleBack}
            >
              <Feather name="arrow-left" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.topBarTitle}>Miembros</Text>
            <View style={{ width: 40 }} />
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4A6FFF" />
            </View>
          ) : (
            <ScrollView style={styles.contentContainer}>
              <View style={styles.headerContainer}>
                <Text style={styles.fishtankName}>{fishtankName}</Text>
                <Text style={styles.memberCount}>
                  {members.length} miembro{members.length !== 1 ? 's' : ''}
                </Text>
              </View>

              <View style={styles.membersList}>
                {members.map((member) => (
                  <View key={member.id} style={styles.memberCard}>
                    <View style={styles.memberInfo}>
                      {member.profilePicture ? (
                        <Image 
                          source={{ uri: member.profilePicture }}
                          style={styles.profilePicture}
                        />
                      ) : (
                        <View style={styles.profilePicturePlaceholder}>
                          <Feather name="user" size={24} color="#8E8E93" />
                        </View>
                      )}
                      <View style={styles.memberDetails}>
                        <Text style={styles.username}>@{member.username}</Text>
                        <View style={[
                          styles.roleBadge,
                          { backgroundColor: getRoleColor(member.role) }
                        ]}>
                          <Text style={styles.roleText}>
                            {getRoleText(member.role)}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.memberActions}>
                      <Text style={styles.joinedDate}>
                        Se unió {new Date(member.joinedAt).toLocaleDateString()}
                      </Text>
                      {isAdmin && member.userId !== auth.currentUser?.uid && (
                        <TouchableOpacity
                          style={[
                            styles.adminButton,
                            member.role === 'admin' ? styles.removeAdminButton : styles.makeAdminButton
                          ]}
                          onPress={() => member.role === 'admin' 
                            ? handleRemoveAdmin(member.id)
                            : handleMakeAdmin(member.id)
                          }
                          disabled={loadingAction === member.id}
                        >
                          {loadingAction === member.id ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Text style={styles.adminButtonText}>
                              {member.role === 'admin' ? 'Quitar admin' : 'Hacer admin'}
                            </Text>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))}
              </View>
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
    alignSelf: "center",
    width: Platform.OS === 'web' ? "100%" : "100%",
    maxWidth: Platform.OS === 'web' ? 800 : "100%",
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
  contentContainer: {
    flex: 1,
    alignSelf: "center",
    width: Platform.OS === 'web' ? "100%" : "100%",
    maxWidth: Platform.OS === 'web' ? 800 : "100%",
  },
  headerContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#3A4154",
  },
  fishtankName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  memberCount: {
    fontSize: 16,
    color: "#8E8E93",
  },
  membersList: {
    padding: 16,
  },
  memberCard: {
    backgroundColor: "#3A4154",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  memberInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  profilePicture: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  profilePicturePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#2A3142",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  memberDetails: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  roleBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "500",
  },
  joinedDate: {
    fontSize: 12,
    color: "#8E8E93",
    marginTop: 8,
  },
  memberActions: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  adminButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  makeAdminButton: {
    backgroundColor: '#4A6FFF',
  },
  removeAdminButton: {
    backgroundColor: '#FF3B30',
  },
  adminButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
})

export default MembersScreen 