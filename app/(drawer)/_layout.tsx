import { GestureHandlerRootView } from "react-native-gesture-handler"
import { Drawer } from "expo-router/drawer"
import { View, Text, Pressable, StyleSheet, Image, Switch, TouchableOpacity } from "react-native"
import { useRouter } from "expo-router"
import { signOut, getAuth } from "firebase/auth"
import * as Haptics from "expo-haptics"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { useEffect, useState } from "react"
import { collection, getDocs, query, where } from "firebase/firestore"
import { db } from "../../config/Firebase_Conf"
import { useAuth } from "@/context/AuthContext"

interface User {
  id: string
  username: string
  email: string
  userId: string
  name: string
  lastName: string
  profilePicture: string
}

export default function Layout() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <Drawer screenOptions={{ headerShown: false }} drawerContent={() => <CustomDrawerContent />} />
    </GestureHandlerRootView>
  )
}

function CustomDrawerContent() {
  const router = useRouter()
  const auth = getAuth()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [fishTankMode, setFishTankMode] = useState(false)
  const { user } = useAuth()

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        if (!user?.uid) return;
  
        const usersRef = collection(db, "users")
        const q = query(usersRef, where("id", "==", user.uid))
        const querySnapshot = await getDocs(q)
  
        if (!querySnapshot.empty) {
          const userData = querySnapshot.docs[0].data() as User
          userData.id = querySnapshot.docs[0].id
          setCurrentUser(userData)
          console.log("Usuario encontrado:", userData.profilePicture)
        }
      } catch (error) {
        console.error("Error al obtener datos del usuario:", error)
      } finally {
        setIsLoading(false)
      }
    }
  
    fetchUserData()
  }, [user?.uid]) 

  const handleLogout = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    try {
      await signOut(auth)
      console.log("Cerrando sesión...")
      router.replace("/login")
    } catch (error) {
      console.error("Error al cerrar sesión:", error)
    }
  }

  const toggleFishTankMode = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setFishTankMode(!fishTankMode)
  }

  const menuItems = [
    //Las rutas estas son provisionales
    { title: "Cardúmenes", icon: "message-text", onPress: () => router.push("/(drawer)/messages") },
    { title: "Solicitudes", icon: "account-multiple", onPress: () => router.push("/(drawer)/requests") },
    { title: "Peceras", icon: "fish", onPress: () => router.push("/(drawer)/fishtanks") },
    { title: "Tus guardados", icon: "bookmark", onPress: () => router.push("/(drawer)/(tabs)/stacksaved") },
    { title: "Configuración", icon: "cog", onPress: () => router.push("/(drawer)/settings") },
  ]

  return (
    <View style={{flex: 1, backgroundColor: "#000"}}>
    <View style={styles.drawerContainer}>
      {/* El logo esta pendiente */}
      <View style={styles.logoContainer}>
        <View style={styles.logoCircle}>
          {/* <Image
            source={[require("../assets/fish-logo.png")]}
            style={styles.logo}
            defaultSource={require("../assets/fish-logo.png")}
          /> */}
        </View>
        <Text style={styles.appName}>FISHER</Text>
      </View>

      <View style={styles.separator} />

      <View style={styles.userInfoContainer}>
        <Image
          source={
            isLoading || !currentUser?.profilePicture ? require('../../assets/placeholders/user_icon.png')  : { uri: currentUser.profilePicture }
          }
          style={styles.userAvatar}
        />
        <View style={styles.userTextContainer}>
          <Text style={styles.userName}>{isLoading ? "Cargando..." : `${currentUser?.name} ${currentUser?.lastName}`  || "Usuario"}</Text>
          <Text style={styles.userHandle}>@{isLoading ? "..." : currentUser?.username?.toLowerCase() || "username"}</Text>
        </View>
      </View>

      <View style={styles.separator} />

      <View style={styles.menuContainer}>
        {menuItems.map((item, index) => (
          <TouchableOpacity key={index} style={styles.menuItem} onPress={item.onPress}>
            <MaterialCommunityIcons name={item.icon as any} size={24} color="white" style={styles.menuIcon} />
            <Text style={styles.menuText}>{item.title}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.flexSpace} />

      <View style={styles.fishTankModeContainer}>
        <Text style={styles.fishTankModeText}>Modo Oceano</Text>
        <Switch
          value={fishTankMode}
          onValueChange={toggleFishTankMode}
          trackColor={{ false: "#767577", true: "#81b0ff" }}
          thumbColor={fishTankMode ? "#f5dd4b" : "#f4f3f4"}
          ios_backgroundColor="#3e3e3e"
        />
      </View>

      <Pressable
        onPress={handleLogout}
        style={({ pressed }) => [styles.logoutButton, pressed ? styles.logoutButtonPressed : {}]}
      >
        <MaterialCommunityIcons name="logout" size={20} color="white" />
        <Text style={styles.logoutText}>Cerrar Sesión</Text>
      </Pressable>
    </View>
    </View>

  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  drawerContainer: {
    flex: 1,
    padding: 0,
    justifyContent: "flex-start",
    backgroundColor: "#3C4255",
    borderRadius:60
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    paddingTop: 50,
  },
  logoCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  logo: {
    width: 30,
    height: 30,
  },
  appName: {
    fontSize: 28,
    fontWeight: "bold",
    color: "white",
  },
  userInfoContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#E0E0E0",
    marginRight: 15,
  },
  userTextContainer: {
    justifyContent: "center",
  },
  userName: {
    fontSize: 18,
    fontWeight: "500",
    color: "white",
  },
  userHandle: {
    fontSize: 14,
    color: "#E0E0E0",
  },
  separator: {
    height: 1,
    backgroundColor: "#8890A6",
    width: "100%",
  },
  menuContainer: {
    width: "100%",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#8890A6",
  },
  menuIcon: {
    marginRight: 15,
  },
  menuText: {
    fontSize: 18,
    color: "white",
  },
  flexSpace: {
    flex: 1,
  },
  fishTankModeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: "#8890A6",
  },
  fishTankModeText: {
    fontSize: 16,
    fontWeight: "500",
    color: "white",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    margin: 20,
    borderRadius: 8,
    backgroundColor: "#DC2626",
    justifyContent: "center",
  },
  logoutButtonPressed: {
    backgroundColor: "#B91C1C",
  },
  logoutText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
})

