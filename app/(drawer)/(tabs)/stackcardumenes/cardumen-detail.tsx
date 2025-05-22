"use client"

import { useEffect, useState, useRef } from "react"
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
  KeyboardAvoidingView,
  Alert,
  Modal,
} from "react-native"
import { useAuth } from "@/context/AuthContext"
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons"
import { useRouter, Stack, useLocalSearchParams } from "expo-router"
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore"
import { ref, onValue, get, push, set, remove, update } from "firebase/database"
import { db, rtdb, storage } from "../../../../config/Firebase_Conf"
import type { Cardumen, CardumenMember, CardumenMessage, User } from "../../../types/types"
import { BlurView } from "expo-blur"
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage"
import * as ImagePicker from "expo-image-picker"
import { createNotification } from "../../../../lib/notifications"

const CardumenDetailScreen = () => {
  const { cardumenId } = useLocalSearchParams<{ cardumenId: string }>()
  const { user } = useAuth()
  const router = useRouter()
  const flatListRef = useRef<FlatList>(null)

  const [cardumen, setCardumen] = useState<Cardumen | null>(null)
  const [messages, setMessages] = useState<CardumenMessage[]>([])
  const [members, setMembers] = useState<CardumenMember[]>([])
  const [users, setUsers] = useState<Record<string, User>>({})
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(true)
  const [messageText, setMessageText] = useState("")
  const [sending, setSending] = useState(false)
  const [isMember, setIsMember] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [joining, setJoining] = useState(false)
  const [showMembersModal, setShowMembersModal] = useState(false)
  const [showImagePicker, setShowImagePicker] = useState(false)
  const [showOptionsModal, setShowOptionsModal] = useState(false)
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Cargar datos del cardumen
  useEffect(() => {
    if (!cardumenId || !user?.uid) return

    const cardumenRef = ref(rtdb, `cardumenes/${cardumenId}`)

    const unsubscribe = onValue(cardumenRef, async (snapshot) => {
      try {
        if (!snapshot.exists()) {
          Alert.alert("Error", "Este cardumen no existe o ha sido eliminado")
          router.back()
          return
        }

        const cardumenData = snapshot.val() as Cardumen
        cardumenData.id = snapshot.key || cardumenData.id
        setCardumen(cardumenData)

        // Verificar si el usuario es miembro o admin
        const memberRef = ref(rtdb, `cardumen_members/${cardumenId}/${user.uid}`)
        const memberSnapshot = await get(memberRef)

        setIsMember(memberSnapshot.exists())
        setIsAdmin(cardumenData.adminId === user.uid)

        setLoading(false)
      } catch (error) {
        console.error("Error al cargar datos del cardumen:", error)
        setLoading(false)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [cardumenId, user?.uid])

  // Cargar mensajes
  useEffect(() => {
    if (!cardumenId || !user?.uid) return

    setLoadingMessages(true)

    const messagesRef = ref(rtdb, `cardumen_messages/${cardumenId}`)

    const unsubscribe = onValue(messagesRef, async (snapshot) => {
      try {
        if (!snapshot.exists()) {
          setMessages([])
          setLoadingMessages(false)
          return
        }

        const messagesData: CardumenMessage[] = []
        const userIds = new Set<string>()

        snapshot.forEach((childSnapshot) => {
          const messageData = childSnapshot.val() as CardumenMessage
          messageData.id = childSnapshot.key || messageData.id

          // Recopilar IDs de usuario para cargar
          if (messageData.senderId && messageData.senderId !== "system") {
            userIds.add(messageData.senderId)
          }

          messagesData.push(messageData)
        })

        // Ordenar por fecha de creación (más antiguos primero)
        messagesData.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

        setMessages(messagesData)

        // Cargar datos de usuarios
        await loadUserData(Array.from(userIds))

        setLoadingMessages(false)
      } catch (error) {
        console.error("Error al cargar mensajes:", error)
        setLoadingMessages(false)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [cardumenId, user?.uid])

  // Cargar miembros
  useEffect(() => {
    if (!cardumenId || !user?.uid || !isMember) return

    const membersRef = ref(rtdb, `cardumen_members/${cardumenId}`)

    const unsubscribe = onValue(membersRef, async (snapshot) => {
      try {
        if (!snapshot.exists()) {
          setMembers([])
          return
        }

        const membersData: CardumenMember[] = []
        const userIds = new Set<string>()

        snapshot.forEach((childSnapshot) => {
          const memberData = childSnapshot.val() as CardumenMember
          const userId = childSnapshot.key

          if (userId) {
            memberData.userId = userId
            membersData.push(memberData)
            userIds.add(userId)
          }
        })

        setMembers(membersData)

        // Cargar datos de usuarios
        await loadUserData(Array.from(userIds))
      } catch (error) {
        console.error("Error al cargar miembros:", error)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [cardumenId, user?.uid, isMember])

  // Cargar datos de usuarios
  const loadUserData = async (userIds: string[]) => {
    try {
      const uniqueUserIds = userIds.filter((id) => !users[id])
      if (uniqueUserIds.length === 0) return

      const usersData = { ...users }
      let hasNewUsers = false

      for (const userId of uniqueUserIds) {
        try {
          const userDoc = await getDoc(doc(db, "users", userId))
          if (userDoc.exists()) {
            usersData[userId] = userDoc.data() as User
            hasNewUsers = true
          }
        } catch (error) {
          console.error(`Error al cargar datos del usuario ${userId}:`, error)
        }
      }

      if (hasNewUsers) {
        setUsers(usersData)
      }
    } catch (error) {
      console.error("Error al cargar datos de usuarios:", error)
    }
  }

  const handleSendMessage = async () => {
    if (!cardumenId || !user?.uid || !messageText.trim() || !isMember) return

    try {
      setSending(true)

      const messagesRef = ref(rtdb, `cardumen_messages/${cardumenId}`)
      const newMessageRef = push(messagesRef)

      const currentUser = users[user.uid] || { username: "Usuario" }

      const newMessage: CardumenMessage = {
        id: newMessageRef.key || "",
        cardumenId,
        senderId: user.uid,
        senderName: currentUser.username,
        senderProfilePicture: currentUser.profilePicture,
        content: messageText.trim(),
        createdAt: new Date().toISOString(),
        type: "text",
      }

      await set(newMessageRef, newMessage)
      setMessageText("")

      if (members.length > 0) {
        for (const member of members) {
          if (member.userId !== user.uid) {
            await createNotification(
              member.userId,
              "Cardumen",
              `@${currentUser.username} envió un mensaje en ${cardumen?.name}`,
              user.uid,
              undefined,
              undefined,
              "/(drawer)/(tabs)/stackcardumenes/cardumen-detail",
              { cardumenId },
            )
          }
        }
      }
    } catch (error) {
      console.error("Error al enviar mensaje:", error)
      Alert.alert("Error", "No se pudo enviar el mensaje")
    } finally {
      setSending(false)
    }
  }

  const handleSendImage = async () => {
    if (!cardumenId || !user?.uid || !isMember) return

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      })

      if (result.canceled) {
        setShowImagePicker(false)
        return
      }

      setSending(true)
      setShowImagePicker(false)

      const response = await fetch(result.assets[0].uri)
      const blob = await response.blob()
      const imageRef = storageRef(storage, `cardumen_messages/${cardumenId}/${user.uid}_${Date.now()}.jpg`)
      await uploadBytes(imageRef, blob)
      const imageUrl = await getDownloadURL(imageRef)

      const messagesRef = ref(rtdb, `cardumen_messages/${cardumenId}`)
      const newMessageRef = push(messagesRef)

      const currentUser = users[user.uid] || { username: "Usuario" }

      const newMessage: CardumenMessage = {
        id: newMessageRef.key || "",
        cardumenId,
        senderId: user.uid,
        senderName: currentUser.username,
        senderProfilePicture: currentUser.profilePicture,
        content: "",
        media: imageUrl,
        createdAt: new Date().toISOString(),
        type: "image",
      }

      await set(newMessageRef, newMessage)

      if (members.length > 0) {
        for (const member of members) {
          if (member.userId !== user.uid) {
            await createNotification(
              member.userId,
              "Cardumen",
              `@${currentUser.username} compartió una imagen en ${cardumen?.name}`,
              user.uid,
              undefined,
              undefined,
              "/(drawer)/(tabs)/stackcardumenes/cardumen-detail",
              { cardumenId },
            )
          }
        }
      }
    } catch (error) {
      console.error("Error al enviar imagen:", error)
      Alert.alert("Error", "No se pudo enviar la imagen")
    } finally {
      setSending(false)
    }
  }

  const handleJoinCardumen = async () => {
    if (!cardumenId || !user?.uid || isMember || joining) return

    try {
      setJoining(true)

      if (cardumen && cardumen.memberCount >= cardumen.maxMembers) {
        Alert.alert("Error", "Este cardumen ha alcanzado su límite de miembros")
        setJoining(false)
        return
      }

      const memberRef = ref(rtdb, `cardumen_members/${cardumenId}/${user.uid}`)
      await set(memberRef, {
        cardumenId,
        userId: user.uid,
        joinedAt: new Date().toISOString(),
        role: "member",
      })

      const cardumenRef = ref(rtdb, `cardumenes/${cardumenId}`)
      await update(cardumenRef, {
        memberCount: (cardumen?.memberCount || 0) + 1,
      })

      // Actualizar documento del usuario en Firestore
      const userRef = doc(db, "users", user.uid)
      await updateDoc(userRef, {
        cardumenesMember: arrayUnion(cardumenId),
      })

      // Crear mensaje de sistema
      const messagesRef = ref(rtdb, `cardumen_messages/${cardumenId}`)
      const newMessageRef = push(messagesRef)

      const currentUser =
        users[user.uid] || (await getDoc(doc(db, "users", user.uid)).then((doc) => doc.data() as User))

      await set(newMessageRef, {
        id: newMessageRef.key,
        cardumenId,
        senderId: "system",
        content: `@${currentUser.username} se ha unido al cardumen`,
        createdAt: new Date().toISOString(),
        type: "system",
      })

      // Notificar al administrador
      if (cardumen && cardumen.adminId !== user.uid) {
        await createNotification(
          cardumen.adminId,
          "Cardumen",
          `@${currentUser.username} se ha unido a tu cardumen ${cardumen.name}`,
          user.uid,
          undefined,
          undefined,
          "/(drawer)/(tabs)/stackcardumenes/cardumen-detail",
          { cardumenId },
        )
      }

      setIsMember(true)
    } catch (error) {
      console.error("Error al unirse al cardumen:", error)
      Alert.alert("Error", "No se pudo unir al cardumen")
    } finally {
      setJoining(false)
    }
  }

  const handleLeaveCardumen = async () => {
    if (!cardumenId || !user?.uid || !isMember || isAdmin) return

    try {
      Alert.alert("Abandonar cardumen", "¿Estás seguro de que quieres abandonar este cardumen?", [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Abandonar",
          style: "destructive",
          onPress: async () => {
            try {
              // Eliminar entrada de miembro
              const memberRef = ref(rtdb, `cardumen_members/${cardumenId}/${user.uid}`)
              await remove(memberRef)

              // Actualizar contador de miembros
              const cardumenRef = ref(rtdb, `cardumenes/${cardumenId}`)
              await update(cardumenRef, {
                memberCount: Math.max(1, (cardumen?.memberCount || 1) - 1),
              })

              // Actualizar documento del usuario en Firestore
              const userRef = doc(db, "users", user.uid)
              await updateDoc(userRef, {
                cardumenesMember: arrayRemove(cardumenId),
              })

              // Crear mensaje de sistema
              const messagesRef = ref(rtdb, `cardumen_messages/${cardumenId}`)
              const newMessageRef = push(messagesRef)

              const currentUser = users[user.uid] || { username: "Usuario" }

              await set(newMessageRef, {
                id: newMessageRef.key,
                cardumenId,
                senderId: "system",
                content: `@${currentUser.username} ha abandonado el cardumen`,
                createdAt: new Date().toISOString(),
                type: "system",
              })

              setIsMember(false)
              router.back()
            } catch (error) {
              console.error("Error al abandonar el cardumen:", error)
              Alert.alert("Error", "No se pudo abandonar el cardumen")
            }
          },
        },
      ])
    } catch (error) {
      console.error("Error al abandonar el cardumen:", error)
      Alert.alert("Error", "No se pudo abandonar el cardumen")
    }
  }

  const handleDeleteCardumen = async () => {
    if (!cardumenId || !user?.uid || !isAdmin) return

    try {
      setDeleting(true)

      // Eliminar cardumen
      const cardumenRef = ref(rtdb, `cardumenes/${cardumenId}`)
      await remove(cardumenRef)

      // Eliminar mensajes
      const messagesRef = ref(rtdb, `cardumen_messages/${cardumenId}`)
      await remove(messagesRef)

      // Eliminar miembros
      const membersRef = ref(rtdb, `cardumen_members/${cardumenId}`)
      await remove(membersRef)

      // Actualizar documento del usuario en Firestore (admin)
      const adminRef = doc(db, "users", user.uid)
      await updateDoc(adminRef, {
        cardumenesCreated: arrayRemove(cardumenId),
        cardumenesMember: arrayRemove(cardumenId),
      })

      // Actualizar documentos de los miembros en Firestore
      for (const member of members) {
        if (member.userId !== user.uid) {
          const memberRef = doc(db, "users", member.userId)
          await updateDoc(memberRef, {
            cardumenesMember: arrayRemove(cardumenId),
          })

          // Notificar a los miembros
          await createNotification(
            member.userId,
            "Cardumen",
            `El cardumen ${cardumen?.name} ha sido eliminado`,
            user.uid,
          )
        }
      }

      router.back()
    } catch (error) {
      console.error("Error al eliminar el cardumen:", error)
      Alert.alert("Error", "No se pudo eliminar el cardumen")
    } finally {
      setDeleting(false)
      setShowDeleteConfirmation(false)
    }
  }

  const renderMessage = ({ item }: { item: CardumenMessage }) => {
    const isCurrentUser = item.senderId === user?.uid
    const isSystemMessage = item.senderId === "system"
    const messageUser = users[item.senderId]

    if (isSystemMessage) {
      return (
        <View style={styles.systemMessageContainer}>
          <Text style={styles.systemMessageText}>{item.content}</Text>
          <Text style={styles.messageTime}>{formatMessageTime(item.createdAt)}</Text>
        </View>
      )
    }

    return (
      <View style={[styles.messageContainer, isCurrentUser ? styles.currentUserMessage : styles.otherUserMessage]}>
        {!isCurrentUser && (
          <View style={styles.messageSenderContainer}>
            {messageUser?.profilePicture ? (
              <Image source={{ uri: messageUser.profilePicture }} style={styles.messageSenderAvatar} />
            ) : (
              <View style={styles.messageSenderAvatarPlaceholder}>
                <Text style={styles.messageSenderInitial}>{messageUser?.username?.charAt(0).toUpperCase() || "U"}</Text>
              </View>
            )}
          </View>
        )}

        <View style={[styles.messageBubble, isCurrentUser ? styles.currentUserBubble : styles.otherUserBubble]}>
          {!isCurrentUser && <Text style={styles.messageSenderName}>@{messageUser?.username || "Usuario"}</Text>}

          {item.type === "image" && typeof item.media === "string" && (
            <Image source={{ uri: item.media }} style={styles.messageImage} />
          )}

          {item.content && <Text style={styles.messageText}>{item.content}</Text>}

          <Text
            style={[styles.messageTime, isCurrentUser ? styles.currentUserMessageTime : styles.otherUserMessageTime]}
          >
            {formatMessageTime(item.createdAt)}
          </Text>
        </View>
      </View>
    )
  }

  const renderMemberItem = ({ item }: { item: CardumenMember }) => {
    const memberUser = users[item.userId]
    const isAdmin = item.role === "admin"

    return (
      <View style={styles.memberItem}>
        {memberUser?.profilePicture ? (
          <Image source={{ uri: memberUser.profilePicture }} style={styles.memberAvatar} />
        ) : (
          <View style={styles.memberAvatarPlaceholder}>
            <Text style={styles.memberInitial}>{memberUser?.username?.charAt(0).toUpperCase() || "U"}</Text>
          </View>
        )}

        <View style={styles.memberInfo}>
          <Text style={styles.memberUsername}>@{memberUser?.username || "Usuario"}</Text>
          <Text style={styles.memberJoinedDate}>Se unió el {new Date(item.joinedAt).toLocaleDateString()}</Text>
        </View>

        {isAdmin && (
          <View style={styles.adminBadge}>
            <Text style={styles.adminBadgeText}>Admin</Text>
          </View>
        )}
      </View>
    )
  }

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.round(diffMs / 60000)
    const diffHours = Math.round(diffMins / 60)
    const diffDays = Math.round(diffHours / 24)

    if (diffMins < 1) return "ahora"
    if (diffMins < 60) return `${diffMins}m`
    if (diffHours < 24) return `${diffHours}h`
    if (diffDays < 7) return `${diffDays}d`

    return date.toLocaleDateString()
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      </SafeAreaView>
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

        <TouchableOpacity style={styles.headerTitleContainer} onPress={() => setShowMembersModal(true)}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {cardumen?.name || "Cardumen"}
          </Text>
          <View style={styles.memberCountContainer}>
            <MaterialCommunityIcons name="account-group" size={16} color="#FFFFFF" />
            <Text style={styles.memberCountText}>{cardumen?.memberCount || 0}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setShowOptionsModal(true)} style={styles.optionsButton}>
          <Feather name="more-vertical" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {loadingMessages ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="chat-outline" size={60} color="#8BB9FE" />
              <Text style={styles.emptyText}>
                {isMember
                  ? "No hay mensajes aún. ¡Sé el primero en escribir!"
                  : "Únete al cardumen para ver los mensajes"}
              </Text>
            </View>
          }
        />
      )}

      {isMember ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
          style={styles.inputContainer}
        >
          <TouchableOpacity style={styles.attachButton} onPress={() => setShowImagePicker(true)}>
            <Feather name="image" size={24} color="#8BB9FE" />
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder="Escribe un mensaje..."
            placeholderTextColor="#AAAAAA"
            value={messageText}
            onChangeText={setMessageText}
            multiline
          />

          <TouchableOpacity
            style={[styles.sendButton, (!messageText.trim() || sending) && styles.disabledButton]}
            onPress={handleSendMessage}
            disabled={!messageText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Feather name="send" size={20} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </KeyboardAvoidingView>
      ) : (
        <View style={styles.joinContainer}>
          <TouchableOpacity
            style={[styles.joinButton, joining && styles.disabledButton]}
            onPress={handleJoinCardumen}
            disabled={joining}
          >
            {joining ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.joinButtonText}>Unirse al Cardumen</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Modal de miembros */}
      <Modal
        visible={showMembersModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowMembersModal(false)}
      >
        <BlurView intensity={90} style={styles.modalOverlay} tint="dark">
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Miembros ({members.length})</Text>
              <TouchableOpacity onPress={() => setShowMembersModal(false)} style={styles.closeButton}>
                <Feather name="x" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={members}
              keyExtractor={(item) => item.userId}
              renderItem={renderMemberItem}
              contentContainerStyle={styles.membersList}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No hay miembros aún</Text>
                </View>
              }
            />
          </View>
        </BlurView>
      </Modal>

      {/* Modal de opciones */}
      <Modal
        visible={showOptionsModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowOptionsModal(false)}
      >
        <BlurView intensity={90} style={styles.modalOverlay} tint="dark">
          <View style={styles.optionsModalContainer}>
            {isAdmin ? (
              <>
                <TouchableOpacity
                  style={styles.optionButton}
                  onPress={() => {
                    setShowOptionsModal(false)
                    setShowDeleteConfirmation(true)
                  }}
                >
                  <Text style={styles.optionText}>Eliminar Cardumen</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {isMember && (
                  <TouchableOpacity
                    style={styles.optionButton}
                    onPress={() => {
                      setShowOptionsModal(false)
                      handleLeaveCardumen()
                    }}
                  >
                    <Text style={styles.optionText}>Abandonar Cardumen</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            <TouchableOpacity style={styles.optionButton} onPress={() => setShowOptionsModal(false)}>
              <Text style={styles.optionText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </Modal>

      {/* Modal de confirmación de eliminación */}
      <Modal
        visible={showDeleteConfirmation}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirmation(false)}
      >
        <BlurView intensity={90} style={styles.modalOverlay} tint="dark">
          <View style={styles.deleteConfirmationContainer}>
            <Text style={styles.deleteConfirmationText}>
              ¿Estás seguro de que quieres eliminar este cardumen? Esta acción no se puede deshacer.
            </Text>
            <View style={styles.confirmationButtonsContainer}>
              <TouchableOpacity
                style={[styles.confirmationButton, styles.cancelButton]}
                onPress={() => setShowDeleteConfirmation(false)}
              >
                <Text>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmationButton, styles.deleteButton]}
                onPress={handleDeleteCardumen}
                disabled={deleting}
              >
                {deleting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text>Eliminar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </Modal>

      {/* Modal de selección de imagen */}
      <Modal
        visible={showImagePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowImagePicker(false)}
      >
        <BlurView intensity={90} style={styles.modalOverlay} tint="dark">
          <View style={styles.optionsModalContainer}>
            <TouchableOpacity style={styles.optionButton} onPress={handleSendImage}>
              <Text style={styles.optionText}>Seleccionar imagen de la galería</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionButton} onPress={() => setShowImagePicker(false)}>
              <Text style={styles.optionText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </Modal>
    </SafeAreaView>
  )
}

export default CardumenDetailScreen
const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#1E293B",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 10,
      paddingTop: 10,
      paddingBottom: 5,
      backgroundColor: "#1E293B",
      borderBottomWidth: 1,
      borderBottomColor: "#334155",
    },
    backButton: {
      padding: 10,
    },
    headerTitleContainer: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: "#FFFFFF",
      marginRight: 5,
    },
    memberCountContainer: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 8,
      paddingVertical: 3,
      backgroundColor: "#334155",
      borderRadius: 15,
    },
    memberCountText: {
      fontSize: 14,
      color: "#FFFFFF",
      marginLeft: 3,
    },
    optionsButton: {
      padding: 10,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    messagesList: {
      padding: 10,
    },
    messageContainer: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginVertical: 5,
    },
    currentUserMessage: {
      justifyContent: "flex-end",
    },
    otherUserMessage: {
      justifyContent: "flex-start",
    },
    messageSenderContainer: {
      marginRight: 8,
    },
    messageSenderAvatar: {
      width: 30,
      height: 30,
      borderRadius: 15,
    },
    messageSenderAvatarPlaceholder: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: "#334155",
      justifyContent: "center",
      alignItems: "center",
    },
    messageSenderInitial: {
      fontSize: 14,
      color: "#FFFFFF",
    },
    messageBubble: {
      padding: 10,
      borderRadius: 15,
      maxWidth: "80%",
      marginBottom: 5,
      borderWidth: 1,
      borderColor: "#334155",
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 1,
      }

    },
    currentUserBubble: {
      backgroundColor: "#8BB9FE",
      alignSelf: "flex-end",
    },
    otherUserBubble: {
      backgroundColor: "#1E293B",
      alignSelf: "flex-start",
    },
    messageSenderName: {
      fontSize: 12,
      fontWeight: "bold",
      color: "#8BB9FE",
      marginBottom: 3,
    },
    messageText: {
      fontSize: 16,
      color: "#FFFFFF",
    },
    messageImage: {
      width: 200,
      height: 150,
      borderRadius: 10,
      marginBottom: 5,
    },
    messageTime: {
      fontSize: 12,
      color: "#AAAAAA",
      alignSelf: "flex-end",
    },
    currentUserMessageTime: {
      textAlign: "right",
    },
    otherUserMessageTime: {
      textAlign: "left",
    },
    systemMessageContainer: {
      alignItems: "center",
      marginVertical: 5,
    },
    systemMessageText: {
      fontSize: 14,
      fontStyle: "italic",
      color: "#AAAAAA",
    },
    inputContainer: {
      flexDirection: "row",
      alignItems: "center",
      padding: 10,
      backgroundColor: "#1E293B",
      borderTopWidth: 1,
      borderTopColor: "#334155",
    },
    attachButton: {
      padding: 10,
    },
    input: {
      flex: 1,
      paddingHorizontal: 15,
      paddingVertical: 10,
      fontSize: 16,
      color: "#FFFFFF",
      backgroundColor: "#334155",
      borderRadius: 20,
      marginRight: 10,
    },
    sendButton: {
      padding: 12,
      backgroundColor: "#8BB9FE",
      borderRadius: 25,
      justifyContent: "center",
      alignItems: "center",
    },
    disabledButton: {
      backgroundColor: "#5D7DAA",
    },
    joinContainer: {
      padding: 10,
      backgroundColor: "#1E293B",
      borderTopWidth: 1,
      borderTopColor: "#334155",
      alignItems: "center",
    },
    joinButton: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      backgroundColor: "#8BB9FE",
      borderRadius: 25,
    },
    joinButtonText: {
      fontSize: 16,
      fontWeight: "bold",
      color: "#FFFFFF",
    },
    modalOverlay: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(0,0,0,0.5)",
    },
    modalContainer: {
      backgroundColor: "#1E293B",
      borderRadius: 10,
      width: "90%",
      maxHeight: "80%",
      overflow: "hidden",
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 15,
      borderBottomWidth: 1,
      borderBottomColor: "#334155",
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: "#FFFFFF",
    },
    closeButton: {
      padding: 10,
    },
    membersList: {
      padding: 10,
    },
    memberItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: "#334155",
    },
    memberAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      marginRight: 10,
    },
    memberAvatarPlaceholder: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "#334155",
      justifyContent: "center",
      alignItems: "center",
      marginRight: 10,
    },
    memberInitial: {
      fontSize: 18,
      color: "#FFFFFF",
    },
    memberInfo: {
      flex: 1,
    },
    memberUsername: {
      fontSize: 16,
      color: "#FFFFFF",
      fontWeight: "bold",
    },
    memberJoinedDate: {
      fontSize: 12,
      color: "#AAAAAA",
    },
    adminBadge: {
      backgroundColor: "#8BB9FE",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
    },
    adminBadgeText: {
      fontSize: 12,
      fontWeight: "bold",
      color: "#0E141B",
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    emptyText: {
      fontSize: 16,
      color: "#8BB9FE",
      textAlign: "center",
      marginTop: 10,
    },
    optionsModalContainer: {
      backgroundColor: "#1E293B",
      borderRadius: 10,
      padding: 20,
      width: "80%",
    },
    optionButton: {
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor: "#334155",
    },
    optionText: {
      fontSize: 16,
      color: "#FFFFFF",
    },
    deleteConfirmationContainer: {
      backgroundColor: "#1E293B",
      borderRadius: 10,
      padding: 20,
      width: "80%",
    },
    deleteConfirmationText: {
      fontSize: 16,
      color: "#FFFFFF",
      marginBottom: 20,
      textAlign: "center",
    },
    confirmationButtonsContainer: {
      flexDirection: "row",
      justifyContent: "space-around",
    },
    confirmationButton: {
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 25,
      fontSize: 16,
    },
    cancelButton: {
      backgroundColor: "#334155",
      color: "#FFFFFF",
    },
    deleteButton: {
      backgroundColor: "#E3342F",
      color: "#FFFFFF",
    },
  })