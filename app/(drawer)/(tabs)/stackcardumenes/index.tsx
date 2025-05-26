"use client"

import { useEffect, useState, useCallback } from "react"
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Platform,
  SafeAreaView,
  TextInput,
  Alert,
} from "react-native"
import { useAuth } from "@/context/AuthContext"
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons"
import { useRouter, Stack } from "expo-router"
import { doc, getDoc, updateDoc, arrayUnion, onSnapshot } from "firebase/firestore"
import { ref, onValue, push, set, get } from "firebase/database"
import { db, rtdb, storage } from "../../../../config/Firebase_Conf"
import type { Cardumen, CardumenJoinRequest, User } from "../../../types/types"
import * as Haptics from "expo-haptics"
import { BlurView } from "expo-blur"
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage"
import * as ImagePicker from "expo-image-picker"
import { useNavigation } from "@react-navigation/native"
import { DrawerActions } from "@react-navigation/native"
import { createNotification } from "../../../../lib/notifications"

const CardumenesScreen = () => {
  const { user } = useAuth()
  const router = useRouter()
  const [cardumenes, setCardumenes] = useState<Cardumen[]>([])
  const [myCardumenes, setMyCardumenes] = useState<Cardumen[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [currentUserData, setCurrentUserData] = useState<User | null>(null)
  const [activeTab, setActiveTab] = useState<"discover" | "my">("discover")
  const [pendingRequests, setPendingRequests] = useState<Record<string, boolean>>({})
  const [showJoinRequestModal, setShowJoinRequestModal] = useState(false)
  const [selectedCardumen, setSelectedCardumen] = useState<Cardumen | null>(null)
  const [joinRequestMessage, setJoinRequestMessage] = useState("")
  const [sendingRequest, setSendingRequest] = useState(false)
  const [showPendingRequestsModal, setShowPendingRequestsModal] = useState(false)
  const [pendingRequestsList, setPendingRequestsList] = useState<CardumenJoinRequest[]>([])
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [requestUsers, setRequestUsers] = useState<Record<string, User>>({})

  // Estados para la creación de cardumen
  const [newCardumenName, setNewCardumenName] = useState("")
  const [newCardumenDescription, setNewCardumenDescription] = useState("")
  const [newCardumenImage, setNewCardumenImage] = useState<string | null>(null)
  const [newCardumenTags, setNewCardumenTags] = useState<string[]>([])
  const [newCardumenTag, setNewCardumenTag] = useState("")
  const [isPrivate, setIsPrivate] = useState(false)
  const [creatingCardumen, setCreatingCardumen] = useState(false)

  const navigation = useNavigation()
  const openDrawer = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
    navigation.dispatch(DrawerActions.openDrawer())
  }, [navigation])

  // Cargar datos del usuario actual
  useEffect(() => {
    if (!user?.uid) return

    // Referencia al documento del usuario en Firestore
    const userRef = doc(db, "users", user.uid)

    // Suscribirse a los cambios del usuario
    const unsubscribeUser = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        setCurrentUserData(doc.data() as User)
      }
    })

    return () => {
      unsubscribeUser()
    }
  }, [user?.uid])

  // Cargar cardúmenes
  useEffect(() => {
    if (!user?.uid) return

    setLoading(true)

    // Referencia a todos los cardúmenes en Realtime Database
    const cardumenesRef = ref(rtdb, "cardumenes")

    const unsubscribe = onValue(cardumenesRef, async (snapshot) => {
      try {
        if (!snapshot.exists()) {
          setCardumenes([])
          setMyCardumenes([])
          setLoading(false)
          return
        }

        const allCardumenes: Cardumen[] = []
        const cardumenPromises: Promise<void>[] = []

        // Obtener todos los cardúmenes
        snapshot.forEach((childSnapshot) => {
          const cardumenData = childSnapshot.val() as Cardumen
          cardumenData.id = childSnapshot.key || cardumenData.id
          
          // Crear una promesa para obtener el número de miembros
          const memberPromise = (async () => {
            const membersRef = ref(rtdb, `cardumen_members/${cardumenData.id}`)
            const membersSnapshot = await get(membersRef)
            const memberCount = membersSnapshot.exists() ? Object.keys(membersSnapshot.val()).length : 0
            cardumenData.memberCount = memberCount
            allCardumenes.push(cardumenData)
          })()
          
          cardumenPromises.push(memberPromise)
        })

        // Esperar a que todas las promesas se resuelvan
        await Promise.all(cardumenPromises)

        // Ordenar por fecha de creación (más recientes primero)
        allCardumenes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

        setCardumenes(allCardumenes)

        // Filtrar mis cardúmenes (creados o miembro)
        if (currentUserData) {
          const myCardumenesList = allCardumenes.filter((cardumen) => {
            // Verificar si el usuario es el administrador
            const isAdmin = cardumen.adminId === user?.uid;
            // Verificar si el usuario es miembro actual
            const isMember = currentUserData.cardumenesMember?.includes(cardumen.id);
            // Solo incluir si es admin o miembro actual
            return isAdmin || isMember;
          });

          setMyCardumenes(myCardumenesList);
        }

        // Cargar solicitudes pendientes del usuario
        await loadPendingRequests(allCardumenes)
      } catch (error) {
        console.error("Error al cargar cardúmenes:", error)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [user?.uid, currentUserData])

  // Cargar solicitudes pendientes del usuario
  const loadPendingRequests = async (cardumenesList: Cardumen[]) => {
    if (!user?.uid) return

    try {
      const pendingReqs: Record<string, boolean> = {}

      // Verificar solicitudes pendientes para cada cardumen
      for (const cardumen of cardumenesList) {
        const requestRef = ref(rtdb, `cardumen_join_requests/${cardumen.id}/${user.uid}`)
        const snapshot = await get(requestRef)

        if (snapshot.exists()) {
          const request = snapshot.val() as CardumenJoinRequest
          if (request.status === "pending") {
            pendingReqs[cardumen.id] = true
          }
        }
      }

      setPendingRequests(pendingReqs)
    } catch (error) {
      console.error("Error al cargar solicitudes pendientes:", error)
    }
  }

  // Cargar solicitudes pendientes para cardúmenes administrados por el usuario
  const loadPendingRequestsForAdmin = async () => {
    if (!user?.uid || !currentUserData?.cardumenesCreated?.length) {
      setPendingRequestsList([])
      return
    }

    setLoadingRequests(true)

    try {
      const allRequests: CardumenJoinRequest[] = []
      const userIds = new Set<string>()

      // Obtener solicitudes para cada cardumen administrado
      for (const cardumenId of currentUserData.cardumenesCreated) {
        const requestsRef = ref(rtdb, `cardumen_join_requests/${cardumenId}`)
        const snapshot = await get(requestsRef)

        if (snapshot.exists()) {
          snapshot.forEach((childSnapshot) => {
            const request = childSnapshot.val() as CardumenJoinRequest
            if (request.status === "pending") {
              request.id = childSnapshot.key || request.id
              allRequests.push(request)
              userIds.add(request.userId)
            }
          })
        }
      }

      // Cargar datos de usuarios
      const usersData: Record<string, User> = {}
      for (const userId of userIds) {
        const userDoc = await getDoc(doc(db, "users", userId))
        if (userDoc.exists()) {
          usersData[userId] = userDoc.data() as User
        }
      }

      setPendingRequestsList(allRequests)
      setRequestUsers(usersData)
    } catch (error) {
      console.error("Error al cargar solicitudes pendientes para admin:", error)
    } finally {
      setLoadingRequests(false)
    }
  }

  const handleCardumenPress = (cardumen: Cardumen) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }

    // Si el usuario ya es miembro o es el administrador, navegar al detalle
    const isMember = currentUserData?.cardumenesMember?.includes(cardumen.id) || false
    const isAdmin = cardumen.adminId === user?.uid

    if (isMember || isAdmin) {
      router.push({
        pathname: "/(drawer)/(tabs)/stackcardumenes/cardumen-detail",
        params: { cardumenId: cardumen.id },
      })
    } else if (cardumen.isPrivate) {
      // Si es privado y no es miembro, mostrar modal para solicitar unirse
      setSelectedCardumen(cardumen)

      // Verificar si ya hay una solicitud pendiente
      if (pendingRequests[cardumen.id]) {
        Alert.alert(
          "Solicitud pendiente",
          "Ya has enviado una solicitud para unirte a este cardumen. Espera a que el administrador la revise.",
          [{ text: "Entendido" }],
        )
      } else {
        setJoinRequestMessage("")
        setShowJoinRequestModal(true)
      }
    } else {
      // Si es público y no es miembro, unirse directamente
      handleJoinPublicCardumen(cardumen)
    }
  }

  const handleJoinPublicCardumen = async (cardumen: Cardumen) => {
    if (!user?.uid) return

    try {
      // Verificar si hay espacio en el cardumen
      if (cardumen.memberCount >= cardumen.maxMembers) {
        Alert.alert("Error", "Este cardumen ha alcanzado su límite de miembros")
        return
      }

      // Crear entrada de miembro
      const memberRef = ref(rtdb, `cardumen_members/${cardumen.id}/${user.uid}`)
      await set(memberRef, {
        cardumenId: cardumen.id,
        userId: user.uid,
        joinedAt: new Date().toISOString(),
        role: "member",
      })

      // Actualizar contador de miembros
      const cardumenRef = ref(rtdb, `cardumenes/${cardumen.id}`)
      await set(cardumenRef, {
        ...cardumen,
        memberCount: cardumen.memberCount + 1,
      })

      // Actualizar documento del usuario en Firestore
      const userRef = doc(db, "users", user.uid)
      await updateDoc(userRef, {
        cardumenesMember: arrayUnion(cardumen.id),
      })

      // Crear mensaje de sistema
      const messagesRef = ref(rtdb, `cardumen_messages/${cardumen.id}`)
      const newMessageRef = push(messagesRef)

      await set(newMessageRef, {
        id: newMessageRef.key,
        cardumenId: cardumen.id,
        senderId: "system",
        content: `@${currentUserData?.username || "Usuario"} se ha unido al cardumen`,
        createdAt: new Date().toISOString(),
        type: "system",
      })

      // Notificar al administrador
      if (cardumen.adminId !== user.uid) {
        await createNotification(
          cardumen.adminId,
          "Cardumen",
          `@${currentUserData?.username || "Usuario"} se ha unido a tu cardumen ${cardumen.name}`,
          user.uid,
          undefined,
          undefined,
          "/(drawer)/(tabs)/stackcardumenes/cardumen-detail",
          { cardumenId: cardumen.id },
        )
      }

      // Navegar al detalle del cardumen
      router.push({
        pathname: "/(drawer)/(tabs)/stackcardumenes/cardumen-detail",
        params: { cardumenId: cardumen.id },
      })
    } catch (error) {
      console.error("Error al unirse al cardumen:", error)
      Alert.alert("Error", "No se pudo unir al cardumen")
    }
  }

  const handleSendJoinRequest = async () => {
    if (!user?.uid || !selectedCardumen || sendingRequest) return

    try {
      setSendingRequest(true)

      // Crear solicitud en Realtime Database
      const requestRef = ref(rtdb, `cardumen_join_requests/${selectedCardumen.id}/${user.uid}`)

      const newRequest: CardumenJoinRequest = {
        id: user.uid,
        cardumenId: selectedCardumen.id,
        userId: user.uid,
        status: "pending",
        createdAt: new Date().toISOString(),
        message: joinRequestMessage.trim() || undefined,
      }

      await set(requestRef, newRequest)

      // Actualizar estado local
      setPendingRequests({
        ...pendingRequests,
        [selectedCardumen.id]: true,
      })

      // Notificar al administrador
      await createNotification(
        selectedCardumen.adminId,
        "JoinRequest",
        `@${currentUserData?.username || "Usuario"} ha solicitado unirse a tu cardumen ${selectedCardumen.name}`,
        user.uid,
        undefined,
        undefined,
        "/(drawer)/(tabs)/stackcardumenes/index",
        {},
      )

      // Cerrar modal y mostrar mensaje
      setShowJoinRequestModal(false)
      Alert.alert(
        "Solicitud enviada",
        "Tu solicitud para unirte al cardumen ha sido enviada. Recibirás una notificación cuando sea revisada.",
        [{ text: "Entendido" }],
      )
    } catch (error) {
      console.error("Error al enviar solicitud:", error)
      Alert.alert("Error", "No se pudo enviar la solicitud")
    } finally {
      setSendingRequest(false)
    }
  }

  const handleAcceptRequest = async (request: CardumenJoinRequest) => {
    if (!user?.uid) return

    try {
      // Obtener datos del cardumen
      const cardumenRef = ref(rtdb, `cardumenes/${request.cardumenId}`)
      const cardumenSnapshot = await get(cardumenRef)

      if (!cardumenSnapshot.exists()) {
        Alert.alert("Error", "El cardumen no existe o ha sido eliminado")
        return
      }

      const cardumen = cardumenSnapshot.val() as Cardumen

      // Verificar si hay espacio en el cardumen
      if (cardumen.memberCount >= cardumen.maxMembers) {
        Alert.alert("Error", "Este cardumen ha alcanzado su límite de miembros")
        return
      }

      // Actualizar estado de la solicitud
      const requestRef = ref(rtdb, `cardumen_join_requests/${request.cardumenId}/${request.userId}`)
      await set(requestRef, {
        ...request,
        status: "accepted",
      })

      // Crear entrada de miembro
      const memberRef = ref(rtdb, `cardumen_members/${request.cardumenId}/${request.userId}`)
      await set(memberRef, {
        cardumenId: request.cardumenId,
        userId: request.userId,
        joinedAt: new Date().toISOString(),
        role: "member",
      })

      // Actualizar contador de miembros
      await set(cardumenRef, {
        ...cardumen,
        memberCount: cardumen.memberCount + 1,
      })

      // Actualizar documento del usuario en Firestore
      const userRef = doc(db, "users", request.userId)
      await updateDoc(userRef, {
        cardumenesMember: arrayUnion(request.cardumenId),
      })

      // Crear mensaje de sistema
      const messagesRef = ref(rtdb, `cardumen_messages/${request.cardumenId}`)
      const newMessageRef = push(messagesRef)
      const requestUser = requestUsers[request.userId]

      await set(newMessageRef, {
        id: newMessageRef.key,
        cardumenId: request.cardumenId,
        senderId: "system",
        content: `@${requestUser?.username || "Usuario"} se ha unido al cardumen`,
        createdAt: new Date().toISOString(),
        type: "system",
      })

      // Notificar al usuario
      await createNotification(
        request.userId,
        "Cardumen",
        `Tu solicitud para unirte al cardumen ${cardumen.name} ha sido aceptada`,
        user.uid,
        undefined,
        undefined,
        "/(drawer)/(tabs)/stackcardumenes/cardumen-detail",
        { cardumenId: request.cardumenId },
      )

      // Actualizar lista de solicitudes
      setPendingRequestsList(pendingRequestsList.filter((r) => r.id !== request.id))
    } catch (error) {
      console.error("Error al aceptar solicitud:", error)
      Alert.alert("Error", "No se pudo aceptar la solicitud")
    }
  }

  const handleRejectRequest = async (request: CardumenJoinRequest) => {
    if (!user?.uid) return

    try {
      // Obtener datos del cardumen
      const cardumenRef = ref(rtdb, `cardumenes/${request.cardumenId}`)
      const cardumenSnapshot = await get(cardumenRef)

      if (!cardumenSnapshot.exists()) {
        Alert.alert("Error", "El cardumen no existe o ha sido eliminado")
        return
      }

      const cardumen = cardumenSnapshot.val() as Cardumen

      // Actualizar estado de la solicitud
      const requestRef = ref(rtdb, `cardumen_join_requests/${request.cardumenId}/${request.userId}`)
      await set(requestRef, {
        ...request,
        status: "rejected",
      })

      // Notificar al usuario
      await createNotification(
        request.userId,
        "Cardumen",
        `Tu solicitud para unirte al cardumen ${cardumen.name} ha sido rechazada`,
        user.uid,
      )

      // Actualizar lista de solicitudes
      setPendingRequestsList(pendingRequestsList.filter((r) => r.id !== request.id))
    } catch (error) {
      console.error("Error al rechazar solicitud:", error)
      Alert.alert("Error", "No se pudo rechazar la solicitud")
    }
  }

  const handleCreateCardumen = async () => {
    if (!user?.uid || !newCardumenName.trim() || !newCardumenDescription.trim()) {
      return
    }

    try {
      setCreatingCardumen(true)

      // Subir imagen si existe
      let imageUrl = undefined
      if (newCardumenImage) {
        const response = await fetch(newCardumenImage)
        const blob = await response.blob()
        const imageRef = storageRef(storage, `cardumenes/${user.uid}_${Date.now()}.jpg`)
        await uploadBytes(imageRef, blob)
        imageUrl = await getDownloadURL(imageRef)
      }

      // Crear nuevo cardumen en Realtime Database
      const cardumenesRef = ref(rtdb, "cardumenes")
      const newCardumenRef = push(cardumenesRef)
      const cardumenId = newCardumenRef.key

      if (!cardumenId) {
        throw new Error("No se pudo generar ID para el cardumen")
      }

      const newCardumen: Cardumen = {
        id: cardumenId,
        name: newCardumenName.trim(),
        description: newCardumenDescription.trim(),
        imageUrl,
        adminId: user.uid,
        createdAt: new Date().toISOString(),
        memberCount: 1, // El creador es el primer miembro
        isPrivate,
        tags: newCardumenTags,
        maxMembers: 50,
      }

      // Guardar cardumen en Realtime Database
      await set(newCardumenRef, newCardumen)

      // Crear entrada de miembro para el creador
      const memberRef = ref(rtdb, `cardumen_members/${cardumenId}/${user.uid}`)
      await set(memberRef, {
        cardumenId,
        userId: user.uid,
        joinedAt: new Date().toISOString(),
        role: "admin",
      })

      // Actualizar documento del usuario en Firestore
      const userRef = doc(db, "users", user.uid)
      await updateDoc(userRef, {
        cardumenesCreated: arrayUnion(cardumenId),
        cardumenesMember: arrayUnion(cardumenId),
      })

      // Crear mensaje de sistema en el cardumen
      const messagesRef = ref(rtdb, `cardumen_messages/${cardumenId}`)
      const newMessageRef = push(messagesRef)
      await set(newMessageRef, {
        id: newMessageRef.key,
        cardumenId,
        senderId: "system",
        content: `¡Cardumen "${newCardumenName}" creado por @${currentUserData?.username || "Usuario"}!`,
        createdAt: new Date().toISOString(),
        type: "system",
      })

      // Limpiar formulario
      setNewCardumenName("")
      setNewCardumenDescription("")
      setNewCardumenImage(null)
      setNewCardumenTags([])
      setNewCardumenTag("")
      setIsPrivate(false)
      setShowCreateModal(false)

      // Navegar al nuevo cardumen
      router.push({
        pathname: "/(drawer)/(tabs)/stackcardumenes/cardumen-detail",
        params: { cardumenId },
      })
    } catch (error) {
      console.error("Error al crear cardumen:", error)
    } finally {
      setCreatingCardumen(false)
    }
  }

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })

    if (!result.canceled) {
      setNewCardumenImage(result.assets[0].uri)
    }
  }

  const addTag = () => {
    if (newCardumenTag.trim() && !newCardumenTags.includes(newCardumenTag.trim())) {
      setNewCardumenTags([...newCardumenTags, newCardumenTag.trim()])
      setNewCardumenTag("")
    }
  }

  const removeTag = (tag: string) => {
    setNewCardumenTags(newCardumenTags.filter((t) => t !== tag))
  }

  const filteredCardumenes =
    activeTab === "discover"
      ? cardumenes.filter(
          (c) =>
            c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (c.tags && c.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))),
        )
      : myCardumenes.filter(
          (c) =>
            c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (c.tags && c.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))),
        )

  const renderCardumenItem = ({ item }: { item: Cardumen }) => {
    const isAdmin = item.adminId === user?.uid
    const isMember = currentUserData?.cardumenesMember?.includes(item.id) || false
    const hasPendingRequest = pendingRequests[item.id] || false

    return (
      <TouchableOpacity style={styles.cardumenItem} onPress={() => handleCardumenPress(item)}>
        <View style={styles.cardumenImageContainer}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.cardumenImage} />
          ) : (
            <View style={styles.cardumenImagePlaceholder}>
              <MaterialCommunityIcons name="fish" size={30} color="#8BB9FE" />
            </View>
          )}
        </View>

        <View style={styles.cardumenContent}>
          <View style={styles.cardumenHeader}>
            <Text style={styles.cardumenName}>{item.name}</Text>
            {item.isPrivate && (
              <MaterialCommunityIcons name="lock" size={16} color="#AAAAAA" style={styles.privateIcon} />
            )}
          </View>

          <Text style={styles.cardumenDescription} numberOfLines={2}>
            {item.description}
          </Text>

          <View style={styles.cardumenFooter}>
            <View style={styles.cardumenStats}>
              <MaterialCommunityIcons name="account-group" size={16} color="#AAAAAA" />
              <Text style={styles.cardumenStatText}>
                {item.memberCount}/{item.maxMembers}
              </Text>
            </View>

            {isAdmin && (
              <View style={styles.adminBadge}>
                <Text style={styles.adminBadgeText}>Admin</Text>
              </View>
            )}

            {isMember && !isAdmin && (
              <View style={styles.memberBadge}>
                <Text style={styles.memberBadgeText}>Miembro</Text>
              </View>
            )}

            {!isMember && !isAdmin && hasPendingRequest && (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>Pendiente</Text>
              </View>
            )}
          </View>

          {item.tags && item.tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {item.tags.slice(0, 3).map((tag, index) => (
                <View key={index} style={styles.tagBadge}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
              {item.tags.length > 3 && <Text style={styles.moreTagsText}>+{item.tags.length - 3}</Text>}
            </View>
          )}
        </View>
      </TouchableOpacity>
    )
  }

  const renderRequestItem = ({ item }: { item: CardumenJoinRequest }) => {
    const requestUser = requestUsers[item.userId]
    const cardumen = cardumenes.find((c) => c.id === item.cardumenId)

    if (!requestUser || !cardumen) return null

    return (
      <View style={styles.requestItem}>
        <View style={styles.requestUserInfo}>
          {requestUser.profilePicture ? (
            <Image source={{ uri: requestUser.profilePicture }} style={styles.requestUserAvatar} />
          ) : (
            <View style={styles.requestUserAvatarPlaceholder}>
              <Text style={styles.requestUserInitial}>{requestUser.username?.charAt(0).toUpperCase() || "U"}</Text>
            </View>
          )}
          <View style={styles.requestUserDetails}>
            <Text style={styles.requestUserName}>@{requestUser.username || "Usuario"}</Text>
            <Text style={styles.requestCardumenName}>Cardumen: {cardumen.name}</Text>
            <Text style={styles.requestDate}>Solicitado el {new Date(item.createdAt).toLocaleDateString()}</Text>
          </View>
        </View>

        {item.message && (
          <View style={styles.requestMessageContainer}>
            <Text style={styles.requestMessageLabel}>Mensaje:</Text>
            <Text style={styles.requestMessage}>{item.message}</Text>
          </View>
        )}

        <View style={styles.requestActions}>
          <TouchableOpacity
            style={[styles.requestActionButton, styles.acceptButton]}
            onPress={() => handleAcceptRequest(item)}
          >
            <Text style={styles.requestActionButtonText}>Aceptar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.requestActionButton, styles.rejectButton]}
            onPress={() => handleRejectRequest(item)}
          >
            <Text style={styles.requestActionButtonText}>Rechazar</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  // Verificar si hay solicitudes pendientes para mostrar el botón
  const hasAdminCardumenes = currentUserData?.cardumenesCreated?.length > 0
  const [hasPendingRequestsForAdmin, setHasPendingRequestsForAdmin] = useState(false)

  useEffect(() => {
    const checkPendingRequests = async () => {
      if (!user?.uid || !currentUserData?.cardumenesCreated?.length) return

      try {
        let hasRequests = false

        for (const cardumenId of currentUserData.cardumenesCreated) {
          const requestsRef = ref(rtdb, `cardumen_join_requests/${cardumenId}`)
          const snapshot = await get(requestsRef)

          if (snapshot.exists()) {
            snapshot.forEach((childSnapshot) => {
              const request = childSnapshot.val() as CardumenJoinRequest
              if (request.status === "pending") {
                hasRequests = true
              }
            })
          }

          if (hasRequests) break
        }

        setHasPendingRequestsForAdmin(hasRequests)
      } catch (error) {
        console.error("Error al verificar solicitudes pendientes:"
      }
    }

    checkPendingRequests()
  }, [user?.uid, currentUserData?.cardumenesCreated])

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.profileButton} onPress={openDrawer}>
            <Image source={{ uri: currentUserData?.profilePicture || "" }} style={styles.profileImage} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Cardúmenes</Text>
        </View>

        <View style={styles.headerRight}>
          {hasAdminCardumenes && (
            <TouchableOpacity
              style={[styles.requestsButton, hasPendingRequestsForAdmin && styles.hasRequestsButton]}
              onPress={() => {
                loadPendingRequestsForAdmin()
                setShowPendingRequestsModal(true)
              }}
            >
              <MaterialCommunityIcons
                name="account-multiple-plus"
                size={24}
                color={hasPendingRequestsForAdmin ? "#FFFFFF" : "#AAAAAA"}
              />
              {hasPendingRequestsForAdmin && (
                <View style={styles.requestsBadge}>
                  <Text style={styles.requestsBadgeText}>!</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setShowCreateModal(true)} style={styles.createButton}>
            <Feather name="plus" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Feather name="search" size={20} color="#AAAAAA" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar cardúmenes..."
          placeholderTextColor="#AAAAAA"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "discover" && styles.activeTab]}
          onPress={() => setActiveTab("discover")}
        >
          <Text style={[styles.tabText, activeTab === "discover" && styles.activeTabText]}>Descubrir</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "my" && styles.activeTab]}
          onPress={() => setActiveTab("my")}
        >
          <Text style={[styles.tabText, activeTab === "my" && styles.activeTabText]}>Mis Cardúmenes</Text>
        </TouchableOpacity>
      </View>

        <FlatList
          data={filteredCardumenes}
          keyExtractor={(item) => item.id}
          renderItem={renderCardumenItem}
          contentContainerStyle={styles.cardumenesList}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="fish-off" size={60} color="#8BB9FE" />
              <Text style={styles.emptyText}>
                {activeTab === "discover" ? "No hay cardúmenes disponibles" : "No perteneces a ningún cardumen"}
              </Text>
              {activeTab === "my" && (
                <TouchableOpacity style={styles.createCardumenButton} onPress={() => setShowCreateModal(true)}>
                  <Text style={styles.createCardumenButtonText}>Crear Cardumen</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />

      {/* Modal para crear cardumen */}
      {showCreateModal && (
        <BlurView intensity={90} style={styles.modalOverlay} tint="dark">
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Crear Cardumen</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)} style={styles.closeButton}>
                <Feather name="x" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.imagePickerContainer} onPress={pickImage}>
              {newCardumenImage ? (
                <Image source={{ uri: newCardumenImage }} style={styles.cardumenImagePreview} />
              ) : (
                <View style={styles.imagePickerPlaceholder}>
                  <Feather name="camera" size={30} color="#8BB9FE" />
                  <Text style={styles.imagePickerText}>Añadir imagen</Text>
                </View>
              )}
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              placeholder="Nombre del cardumen"
              placeholderTextColor="#AAAAAA"
              value={newCardumenName}
              onChangeText={setNewCardumenName}
              maxLength={30}
            />

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Descripción"
              placeholderTextColor="#AAAAAA"
              value={newCardumenDescription}
              onChangeText={setNewCardumenDescription}
              multiline
              numberOfLines={4}
              maxLength={200}
            />

            <View style={styles.tagInputContainer}>
              <TextInput
                style={styles.tagInput}
                placeholder="Añadir etiqueta"
                placeholderTextColor="#AAAAAA"
                value={newCardumenTag}
                onChangeText={setNewCardumenTag}
                maxLength={20}
              />
              <TouchableOpacity style={styles.addTagButton} onPress={addTag}>
                <Feather name="plus" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {newCardumenTags.length > 0 && (
              <View style={styles.selectedTagsContainer}>
                {newCardumenTags.map((tag, index) => (
                  <View key={index} style={styles.selectedTag}>
                    <Text style={styles.selectedTagText}>{tag}</Text>
                    <TouchableOpacity onPress={() => removeTag(tag)}>
                      <Feather name="x" size={14} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity style={styles.privacyToggle} onPress={() => setIsPrivate(!isPrivate)}>
              <View style={[styles.checkbox, isPrivate && styles.checkboxChecked]}>
                {isPrivate && <Feather name="check" size={14} color="#FFFFFF" />}
              </View>
              <Text style={styles.privacyText}>Cardumen privado</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.createCardumenButton,
                (!newCardumenName.trim() || !newCardumenDescription.trim() || creatingCardumen) &&
                  styles.disabledButton,
              ]}
              onPress={handleCreateCardumen}
              disabled={!newCardumenName.trim() || !newCardumenDescription.trim() || creatingCardumen}
            >
              {creatingCardumen ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.createCardumenButtonText}>Crear Cardumen</Text>
              )}
            </TouchableOpacity>
          </View>
        </BlurView>
      )}

      {/* Modal para solicitar unirse a cardumen privado */}
      {showJoinRequestModal && selectedCardumen && (
        <BlurView intensity={90} style={styles.modalOverlay} tint="dark">
          <View style={styles.joinRequestModalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Solicitar unirse</Text>
              <TouchableOpacity onPress={() => setShowJoinRequestModal(false)} style={styles.closeButton}>
                <Feather name="x" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.joinRequestCardumenName}>{selectedCardumen.name}</Text>

            <Text style={styles.joinRequestDescription}>
              Este cardumen es privado. Envía una solicitud al administrador para unirte.
            </Text>

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Mensaje para el administrador (opcional)"
              placeholderTextColor="#AAAAAA"
              value={joinRequestMessage}
              onChangeText={setJoinRequestMessage}
              multiline
              numberOfLines={4}
              maxLength={200}
            />

            <TouchableOpacity
              style={[styles.createCardumenButton, sendingRequest && styles.disabledButton]}
              onPress={handleSendJoinRequest}
              disabled={sendingRequest}
            >
              {sendingRequest ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.createCardumenButtonText}>Enviar Solicitud</Text>
              )}
            </TouchableOpacity>
          </View>
        </BlurView>
      )}

      {/* Modal para ver solicitudes pendientes */}
      {showPendingRequestsModal && (
        <BlurView intensity={90} style={styles.modalOverlay} tint="dark">
          <View style={styles.pendingRequestsModalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Solicitudes pendientes</Text>
              <TouchableOpacity onPress={() => setShowPendingRequestsModal(false)} style={styles.closeButton}>
                <Feather name="x" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
 
              <FlatList
                data={pendingRequestsList}
                keyExtractor={(item) => `${item.cardumenId}-${item.userId}`}
                renderItem={renderRequestItem}
                contentContainerStyle={styles.requestsList}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <MaterialCommunityIcons name="account-check" size={60} color="#8BB9FE" />
                    <Text style={styles.emptyText}>No hay solicitudes pendientes</Text>
                  </View>
                }
              />
            
          </View>
        </BlurView>
      )}
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
    paddingTop: Platform.OS === "ios" ? 10 : 30,
    paddingBottom: 16,
    backgroundColor: "#3C4255",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginLeft: 12,
  },
  createButton: {
    padding: 8,
  },
  requestsButton: {
    padding: 8,
    marginRight: 8,
    position: "relative",
  },
  hasRequestsButton: {
    backgroundColor: "#8BB9FE",
    borderRadius: 20,
  },
  requestsBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#FF5252",
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  requestsBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "bold",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3A4154",
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 16,
    padding: 0,
  },
  tabsContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#3A4154",
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: "#8BB9FE",
  },
  tabText: {
    color: "#AAAAAA",
    fontSize: 16,
  },
  activeTabText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  cardumenesList: {
    paddingVertical: 8,
  },
  cardumenItem: {
    flexDirection: "row",
    backgroundColor: "#3A4154",
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    overflow: "hidden",
  },
  cardumenImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: "hidden",
    marginRight: 12,
  },
  cardumenImage: {
    width: "100%",
    height: "100%",
  },
  cardumenImagePlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#4C5366",
    justifyContent: "center",
    alignItems: "center",
  },
  cardumenContent: {
    flex: 1,
  },
  cardumenHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  cardumenName: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
  },
  privateIcon: {
    marginLeft: 6,
  },
  cardumenDescription: {
    color: "#D9D9D9",
    fontSize: 14,
    marginBottom: 8,
  },
  cardumenFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardumenStats: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardumenStatText: {
    color: "#AAAAAA",
    fontSize: 14,
    marginLeft: 4,
  },
  adminBadge: {
    backgroundColor: "#8BB9FE",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adminBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  memberBadge: {
    backgroundColor: "#4C5366",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  memberBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  pendingBadge: {
    backgroundColor: "#FFA726",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pendingBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
  },
  tagBadge: {
    backgroundColor: "#4C5366",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 4,
    marginBottom: 4,
  },
  tagText: {
    color: "#D9D9D9",
    fontSize: 12,
  },
  moreTagsText: {
    color: "#AAAAAA",
    fontSize: 12,
    marginLeft: 4,
    alignSelf: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyText: {
    color: "#FFFFFF",
    fontSize: 16,
    marginTop: 16,
    textAlign: "center",
  },
  createCardumenButton: {
    backgroundColor: "#8BB9FE",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 16,
    alignItems: "center",
  },
  createCardumenButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  modalContainer: {
    backgroundColor: "#3A4154",
    borderRadius: 12,
    padding: 20,
    width: "90%",
    maxWidth: 400,
    maxHeight: "80%",
  },
  joinRequestModalContainer: {
    backgroundColor: "#3A4154",
    borderRadius: 12,
    padding: 20,
    width: "90%",
    maxWidth: 400,
  },
  pendingRequestsModalContainer: {
    backgroundColor: "#3A4154",
    borderRadius: 12,
    padding: 20,
    width: "90%",
    maxWidth: 400,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "bold",
  },
  closeButton: {
    padding: 4,
  },
  joinRequestCardumenName: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  joinRequestDescription: {
    color: "#D9D9D9",
    fontSize: 14,
    marginBottom: 16,
  },
  imagePickerContainer: {
    width: "100%",
    height: 150,
    backgroundColor: "#4C5366",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    overflow: "hidden",
  },
  imagePickerPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  imagePickerText: {
    color: "#FFFFFF",
    marginTop: 8,
  },
  cardumenImagePreview: {
    width: "100%",
    height: "100%",
  },
  input: {
    backgroundColor: "#4C5366",
    borderRadius: 8,
    padding: 12,
    color: "#FFFFFF",
    fontSize: 16,
    marginBottom: 12,
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  tagInputContainer: {
    flexDirection: "row",
    marginBottom: 12,
  },
  tagInput: {
    flex: 1,
    backgroundColor: "#4C5366",
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    padding: 12,
    color: "#FFFFFF",
    fontSize: 16,
  },
  addTagButton: {
    backgroundColor: "#8BB9FE",
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  selectedTagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 12,
  },
  selectedTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#8BB9FE",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 8,
    marginBottom: 8,
  },
  selectedTagText: {
    color: "#FFFFFF",
    marginRight: 6,
  },
  privacyToggle: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#8BB9FE",
    marginRight: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: "#8BB9FE",
  },
  privacyText: {
    color: "#FFFFFF",
    fontSize: 16,
  },
  disabledButton: {
    opacity: 0.5,
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    backgroundColor: "#4C5366",
    borderWidth: 2,
    borderColor: "#8BB9FE",
  },
  profileImage: {
    width: "100%",
    height: "100%",
    borderRadius: 20,
  },
  requestsList: {
    paddingVertical: 8,
  },
  requestItem: {
    backgroundColor: "#4C5366",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  requestUserInfo: {
    flexDirection: "row",
    marginBottom: 8,
  },
  requestUserAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  requestUserAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#3A4154",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  requestUserInitial: {
    fontSize: 20,
    color: "#FFFFFF",
  },
  requestUserDetails: {
    flex: 1,
    justifyContent: "center",
  },
  requestUserName: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  requestCardumenName: {
    color: "#D9D9D9",
    fontSize: 14,
  },
  requestDate: {
    color: "#AAAAAA",
    fontSize: 12,
  },
  requestMessageContainer: {
    backgroundColor: "#3A4154",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  requestMessageLabel: {
    color: "#AAAAAA",
    fontSize: 12,
    marginBottom: 4,
  },
  requestMessage: {
    color: "#FFFFFF",
    fontSize: 14,
  },
  requestActions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  requestActionButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    marginHorizontal: 4,
  },
  acceptButton: {
    backgroundColor: "#4CAF50",
  },
  rejectButton: {
    backgroundColor: "#F44336",
  },
  requestActionButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
})

export default CardumenesScreen
