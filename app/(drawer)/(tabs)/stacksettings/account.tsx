"use client"

import { useState, useEffect, useCallback } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native"
import { Feather } from "@expo/vector-icons"
import { useRouter, Stack } from "expo-router"
import { useAuth } from "@/context/AuthContext"
import { getFirestore, doc, getDoc, deleteDoc, updateDoc} from "firebase/firestore"
import { deleteUser } from "firebase/auth"
import * as Haptics from "expo-haptics"

const AccountScreen = () => {
  const router = useRouter()
  const { user, logout } = useAuth()
  const [userData, setUserData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)

  useEffect(() => {
    fetchUserData()
  }, [user])

  const fetchUserData = async () => {
    if (!user?.uid) return

    try {
      const db = getFirestore()
      const userRef = doc(db, "users", user.uid)
      const userDoc = await getDoc(userRef)

      if (userDoc.exists()) {
        setUserData(userDoc.data())
      }
    } catch (error) {
      console.error("Error fetching user data:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const onRefresh = useCallback(async () => {
    // Proporcionar feedback táctil al usuario
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }

    setRefreshing(true)
    await fetchUserData()
    setLastRefreshed(new Date())
  }, [user])

  const handleEditProfile = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
    router.push("/(drawer)/(tabs)/stacksettings/edit-profile")
  }

  const handleChangePassword = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
    router.push("/(drawer)/(tabs)/stacksettings/change-password")
  }

  const handleDeactivateAccount = () => {
    Alert.alert(
      'Desactivar cuenta',
      '¿Estás seguro que quieres desactivar tu cuenta? Podrás reactivarla cuando quieras iniciando sesión nuevamente.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Desactivar', 
          style: 'destructive',
          onPress: async () => {
            try {
              if (!user?.uid) return;
              
              const db = getFirestore();
              const userRef = doc(db, 'users', user.uid);
              
              // Marcar la cuenta como desactivada
              await updateDoc(userRef, {
                isActive: false,
                deactivatedAt: new Date().toISOString(),
                lastDeactivation: new Date().toISOString(),
              });
              
              // Cerrar sesión
              await logout();
              
              Alert.alert(
                'Cuenta desactivada',
                'Tu cuenta ha sido desactivada. Puedes reactivarla iniciando sesión nuevamente.',
                [
                  {
                    text: 'OK',
                    onPress: () => router.replace('/login')
                  }
                ]
              );
            } catch (error) {
              console.error('Error deactivating account:', error);
              Alert.alert('Error', 'No se pudo desactivar la cuenta. Intenta más tarde.');
            }
          }
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    }
    Alert.alert(
      "Eliminar cuenta",
      "Esta acción es irreversible. Se eliminarán todos tus datos, publicaciones y conexiones. ¿Estás seguro?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar permanentemente",
          style: "destructive",
          onPress: () => {
            Alert.alert("Confirmación final", "Por favor, confirma que deseas eliminar tu cuenta permanentemente.", [
              { text: "Cancelar", style: "cancel" },
              {
                text: "Eliminar mi cuenta",
                style: "destructive",
                onPress: async () => {
                  try {
                    if (!user) return

                    // Eliminar datos del usuario de Firestore
                    const db = getFirestore()
                    await deleteDoc(doc(db, "users", user.uid))

                    // Eliminar cuenta de autenticación
                    await deleteUser(user)

                    // Cerrar sesión y redirigir
                    await logout()
                    router.replace("/login")
                  } catch (error) {
                    console.error("Error deleting account:", error)
                    Alert.alert("Error", "No se pudo eliminar la cuenta. Intenta más tarde.")
                  }
                },
              },
            ])
          },
        },
      ],
    )
  }

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.bigcontainer}>
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>Cargando información de la cuenta...</Text>
        </View>
      </SafeAreaView>
      </SafeAreaView>
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <SafeAreaView style={styles.bigcontainer}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Tu cuenta</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#FFFFFF"
              colors={["#FFFFFF"]}
              progressBackgroundColor="#3A4154"
              title="Actualizando..."
              titleColor="#AAAAAA"
            />
          }
        >
          {/* Sección de perfil */}
          <View style={styles.profileSection}>
            <Image
              source={{ uri: userData?.profilePicture || "https://via.placeholder.com/150" }}
              style={styles.profileImage}
            />
            <Text style={styles.userName}>
              {userData?.name} {userData?.lastName}
            </Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
            <Text style={styles.username}>@{userData?.username}</Text>
            {lastRefreshed && (
              <Text style={styles.lastRefreshedText}>Actualizado: {lastRefreshed.toLocaleTimeString()}</Text>
            )}
          </View>

          {/* Opciones de cuenta */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Información de la cuenta</Text>

            <TouchableOpacity style={styles.optionItem} onPress={handleEditProfile}>
              <View style={styles.optionLeft}>
                <Feather name="user" size={22} color="#FFFFFF" />
                <Text style={styles.optionText}>Editar perfil</Text>
              </View>
              <Feather name="chevron-right" size={22} color="#6B7280" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionItem} onPress={handleChangePassword}>
              <View style={styles.optionLeft}>
                <Feather name="lock" size={22} color="#FFFFFF" />
                <Text style={styles.optionText}>Cambiar contraseña</Text>
              </View>
              <Feather name="chevron-right" size={22} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Sección de peligro */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Zona de peligro</Text>

            <TouchableOpacity style={[styles.optionItem, styles.dangerOption]} onPress={handleDeactivateAccount}>
              <View style={styles.optionLeft}>
                <Feather name="pause-circle" size={22} color="#FFA500" />
                <Text style={[styles.optionText, styles.dangerText]}>Desactivar cuenta</Text>
              </View>
              <Feather name="chevron-right" size={22} color="#FFA500" />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.optionItem, styles.dangerOption]} onPress={handleDeleteAccount}>
              <View style={styles.optionLeft}>
                <Feather name="trash-2" size={22} color="#FF4444" />
                <Text style={[styles.optionText, styles.dangerText]}>Eliminar cuenta</Text>
              </View>
              <Feather name="chevron-right" size={22} color="#FF4444" />
            </TouchableOpacity>
          </View>

          {/* Información adicional */}
          <View style={styles.infoSection}>
            <Text style={styles.infoText}>
              Cuenta creada el: {userData?.createdAt ? new Date(userData.createdAt).toLocaleDateString() : "N/A"}
            </Text>
            <Text style={styles.infoText}>ID de usuario: {user?.uid.slice(0, 8)}...</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
      </SafeAreaView>
    </>
  )
}

const styles = StyleSheet.create({
  bigcontainer: {
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#FFFFFF",
    marginTop: 12,
    fontSize: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  scrollContent: {
    paddingBottom: 100,
  },
  profileSection: {
    alignItems: "center",
    paddingVertical: 30,
    borderBottomWidth: 1,
    borderBottomColor: "#3A4154",
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
    backgroundColor: "#3A4154",
  },
  userName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: "#AAAAAA",
    marginBottom: 4,
  },
  username: {
    fontSize: 16,
    color: "#6B7280",
    marginBottom: 8,
  },
  lastRefreshedText: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 8,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 16,
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#3A4154",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  optionLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  optionText: {
    fontSize: 16,
    color: "#FFFFFF",
    marginLeft: 16,
  },
  dangerOption: {
    backgroundColor: "#3A4154",
    borderWidth: 1,
    borderColor: "#4A5164",
  },
  dangerText: {
    color: "#FFFFFF",
  },
  infoSection: {
    paddingHorizontal: 20,
    paddingVertical: 30,
    alignItems: "center",
  },
  infoText: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 8,
  },
})

export default AccountScreen
