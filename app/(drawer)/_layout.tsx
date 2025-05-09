"use client"

import { GestureHandlerRootView } from "react-native-gesture-handler"
import { Drawer } from "expo-router/drawer"
import { View, Text, StyleSheet, Image, Switch, TouchableOpacity } from "react-native"
import { useRouter } from "expo-router"
import { getAuth } from "firebase/auth"
import * as Haptics from "expo-haptics"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { useEffect, useState } from "react"
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore"
import { db } from "../../config/Firebase_Conf"
import { useAuth } from "@/context/AuthContext"
import { useNavigation } from "expo-router"
import { DrawerActions } from "@react-navigation/native"

interface User {
  id: string
  username: string
  email: string
  userId: string
  name: string
  lastName: string
  profilePicture: string
  isAdmin?: boolean
}

// Componente para el botón personalizado del drawer
const CustomDrawerButton = () => {
  const navigation = useNavigation()

  const openDrawer = () => {
    navigation.dispatch(DrawerActions.openDrawer())
  }

  return (
    <TouchableOpacity style={styles.drawerButton} onPress={openDrawer}>
      <MaterialCommunityIcons name="menu" size={24} color="#FFFFFF" />
    </TouchableOpacity>
  )
}

// Títulos personalizados para las rutas
const customTitles: Record<string, string> = {
  messages: "Cardúmenes",
  requests: "Solicitudes",
  fishtanks: "Peceras",
  "(tabs)/stacksaved": "Posts Guardados",
  "(tabs)/stacksettings": "Configuraciones",
  "(admin)/dashboard": "Panel de Administración",
}

export default function ClientLayout() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <Drawer
        screenOptions={({ route }) => ({
          headerShown: Object.keys(customTitles).includes(route.name),
          title: customTitles[route.name] || route.name,
          headerStyle: {
            backgroundColor: "#3C4255",
          },
          headerTintColor: "#FFFFFF",
          headerLeft: () => (
            <View style={{ flexDirection: "row", alignItems: "center", marginLeft: 10 }}>
              <CustomDrawerButton />
            </View>
          ),
          drawerStyle: {
            backgroundColor: "#3C4255", 
            width: "80%",
            borderRightWidth: 0, 
            shadowColor: "transparent", 
            elevation: 0, 
            overflow: "hidden" 
          },
          sceneContainerStyle: {
            backgroundColor: "#3C4255" 
          },
          overlayColor: "rgba(0,0,0,0.7)" 
        })}
        drawerContent={() => <CustomDrawerContent />}
      />
    </GestureHandlerRootView>
  )
}

function CustomDrawerContent() {
  const router = useRouter()
  const auth = getAuth()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [fishTankMode, setFishTankMode] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const { user } = useAuth()

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        if (!user?.uid) return

        const userDocRef = doc(db, "users", user.uid)
        const userDocSnap = await getDoc(userDocRef)

        if (userDocSnap.exists()) {
          const userData = userDocSnap.data() as User
          userData.id = userDocSnap.id
          setCurrentUser(userData)
          setIsAdmin(userData.isAdmin === true)
        } else {
          const usersRef = collection(db, "users")
          const q = query(usersRef, where("id", "==", user.uid))
          const querySnapshot = await getDocs(q)

          if (!querySnapshot.empty) {
            const userData = querySnapshot.docs[0].data() as User
            userData.id = querySnapshot.docs[0].id
            setCurrentUser(userData)
            setIsAdmin(userData.isAdmin === true)
          }
        }
      } catch (error) {
        console.error("Error al obtener datos del usuario:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchUserData()
  }, [user?.uid])

  const openProfile = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.navigate({
      pathname: "/(drawer)/(tabs)/stackhome/profile",
      params: { userId: user?.uid }
    })
  }

  const toggleFishTankMode = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setFishTankMode(!fishTankMode)
  }

  const regularMenuItems = [
    { title: "Inicio", icon: "home", path: "/(drawer)/(tabs)/stackhome" },
    { title: "Cardúmenes", icon: "message-text", path: "/(drawer)/messages" },
    { title: "Peceras", icon: "fish", path: "/(drawer)/(tabs)/stackfishtanks" },
    { title: "Post guardados", icon: "bookmark", path: "/(drawer)/(tabs)/stacksaved" },
    { title: "Configuraciónes", icon: "cog", path: "/(drawer)/(tabs)/stacksettings" },
  ]

  const adminMenuItems = [
    { title: "Inicio", icon: "home", path: "/(drawer)/(tabs)/stackhome" },
    { title: "Cardúmenes", icon: "message-text", path: "/(drawer)/stackmessages" },
    { title: "Admin Peceras", icon: "fish", path: "/(drawer)/fishtanks" },
    { title: "Post guardados", icon: "bookmark", path: "/(drawer)/(tabs)/stacksaved" },
    { title: "Configuraciónes", icon: "cog", path: "/(drawer)/(tabs)/stacksettings" },
    { title: "Panel de Admin", icon: "shield-account", path: "/(drawer)/(admintabs)" },
  ]

  const menuItems = isAdmin ? adminMenuItems : regularMenuItems

  return (
    <View style={styles.drawerOuterContainer}>
      <View style={styles.drawerContainer}>
        <View style={styles.drawerHeader}>
          {/* Logo y nombre de la app */}
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
               <Image
                source={require("../../assets/logo/in_app_fisher_logo.png")}
                width={100}
                height={100}
                style={styles.logo}
              /> 
            </View>
            <Text style={styles.appName}>FISHER</Text>
          </View>

          <View style={styles.separator} />

          <TouchableOpacity style={styles.userInfoContainer} onPress={openProfile}>
            <Image
              source={
                isLoading || !currentUser?.profilePicture
                  ? require("../../assets/placeholders/user_icon.png")
                  : { uri: currentUser.profilePicture }
              }
              style={styles.userAvatar}
            />
            <View style={styles.userTextContainer}>
              <Text style={styles.userName}>
                {isLoading ? "Cargando..." : `${currentUser?.name} ${currentUser?.lastName}` || "Usuario"}
              </Text>
              <Text style={styles.userHandle}>
                @{isLoading ? "..." : currentUser?.username?.toLowerCase() || "username"}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.separator} />
        </View>

        <View style={styles.menuContainer}>
          {menuItems.map((item, index) => (
            <View key={index}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  router.navigate(item.path as any)
                }}
              >
                <MaterialCommunityIcons name={item.icon as any} size={24} color="white" style={styles.menuIcon} />
                <Text style={styles.menuText}>{item.title}</Text>
              </TouchableOpacity>
              <View style={styles.menuSeparator} />
            </View>
          ))}
        </View>

        <View style={styles.flexSpace} />

        <View style={styles.fishTankModeContainer}>
          <View style={styles.fishTankModeTextContainer}>
            <MaterialCommunityIcons name={fishTankMode ? "waves" : "water-off"} size={24} color="white" />
            <Text style={styles.fishTankModeText}>Modo Oceano</Text>
          </View>
          <Switch
            value={fishTankMode}
            onValueChange={toggleFishTankMode}
            trackColor={{ false: "#767577", true: "#81b0ff" }}
            thumbColor={fishTankMode ? "#f5dd4b" : "#f4f3f4"}
            ios_backgroundColor="#3e3e3e"
          />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#3C4255",
  },
  drawerButton: {
    padding: 8,
    borderRadius: 50,
    backgroundColor: "#4C5366",
  },
  drawerOuterContainer: {
    flex: 1,
    backgroundColor: "#3C4255", 
    width: "100%",
    overflow: "hidden", 
  },
  drawerContainer: {
    flex: 1,
    padding: 0,
    justifyContent: "flex-start",
    backgroundColor: "#3C4255",
    width: "100%", 
  },
  drawerHeader: {
    paddingTop: 20,
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    paddingTop: 50,
    marginBottom: -10,
  },
  logoCircle: {
    justifyContent: "center",
    alignItems: "center",
    marginRight: 5,
  },
  logo: {
    width: 60,
    height: 60,
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
    backgroundColor: "#4C5366",
    width: "100%",
  },
  menuContainer: {
    width: "100%",
    marginTop: 10,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  menuSeparator: {
    height: 1,
    backgroundColor: "#4C5366",
    marginHorizontal: 20,
  },
  menuIcon: {
    marginRight: 15,
  },
  menuText: {
    fontSize: 16,
    color: "white",
    fontWeight: "500",
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
    borderTopColor: "#4C5366",
    marginBottom: 25, 
  },
  fishTankModeTextContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  fishTankModeText: {
    fontSize: 16,
    fontWeight: "500",
    color: "white",
    marginLeft: 10,
  }
})