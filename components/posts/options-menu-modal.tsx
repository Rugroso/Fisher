"use client"

import type React from "react"
import { View, Text, TouchableOpacity, StyleSheet, Modal, Alert, Platform } from "react-native"
import { Feather } from "@expo/vector-icons"
import type { Post, User } from "../../app/types/types"
import { doc, getFirestore, updateDoc, setDoc, deleteDoc, getDoc } from "firebase/firestore"
import { useAuth } from "@/context/AuthContext"
import { useState, useEffect } from "react"

interface OptionsMenuModalProps {
  visible: boolean
  onClose: () => void
  post: Post
  authorId: string
  currentUserId: string
  isSaved: boolean
  isSaving: boolean
  isAdmin?: boolean
  setIsSaved: (saved: boolean) => void
  setIsSaving: (saving: boolean) => void
  onPostDeleted: () => void
  onPostSaved?: (postId: string, saved: boolean) => void
}

const OptionsMenuModal: React.FC<OptionsMenuModalProps> = ({
  visible,
  onClose,
  post,
  authorId,
  currentUserId,
  isSaved,
  isSaving,
  setIsSaved,
  setIsSaving,
  onPostDeleted,
  onPostSaved,
}) => {
  const [isCurrentUserAdmin, setIsCurrentUserAdmin] = useState<boolean>(false)
  const [isLoadingAdminStatus, setIsLoadingAdminStatus] = useState<boolean>(true)
  
  const isAuthor = currentUserId === authorId

  // Verificar si el usuario actual es admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!currentUserId) {
        setIsCurrentUserAdmin(false)
        setIsLoadingAdminStatus(false)
        return
      }

      try {
        const user = await userData(currentUserId)
        setIsCurrentUserAdmin(user?.isAdmin || false)
      } catch (error) {
        console.error("Error checking admin status:", error)
        setIsCurrentUserAdmin(false)
      } finally {
        setIsLoadingAdminStatus(false)
      }
    }

    if (visible) {
      checkAdminStatus()
    }
  }, [visible, currentUserId])

  const userData = async (userId: string): Promise<User | null> => {
    try {
      const db = getFirestore()
      const userDoc = await getDoc(doc(db, "users", userId))
      if (userDoc.exists()) {
        return { id: userDoc.id, ...userDoc.data() } as User
      } else {
        console.warn(`User with ID ${userId} does not exist.`)
        return null
      }
    } catch (error) {
      console.error("Error fetching user data:", error)
      Alert.alert("Error", "No se pudo obtener la información del usuario. Inténtalo de nuevo.")
      return null
    }
  }

  const handleDeletePost = async () => {
    // Verificar si el usuario puede eliminar el post (autor o admin)
    if (!isAuthor && !isCurrentUserAdmin) return

    const isAdminDeleting = !isAuthor && isCurrentUserAdmin
    const alertTitle = isAdminDeleting ? "Eliminar publicación (Admin)" : "Eliminar publicación"
    const alertMessage = isAdminDeleting 
      ? "¿Estás seguro de que quieres eliminar esta publicación como administrador? Esta acción no se puede deshacer."
      : "¿Estás seguro de que quieres eliminar esta publicación? Esta acción no se puede deshacer."

    Alert.alert(
      alertTitle,
      alertMessage,
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              const db = getFirestore()
              const collectionName = post.fishtankId ? "fishtank_posts" : "posts"
              
              if (isAdminDeleting) {
                // Admin: eliminación real del documento
                await deleteDoc(doc(db, collectionName, post.id))
              } else {
                // Usuario normal: marcar como eliminado
                await updateDoc(doc(db, collectionName, post.id), {
                  deleted: true,
                  updatedAt: new Date().toISOString(),
                })
              }

              onClose()
              onPostDeleted()
            } catch (error) {
              console.error("Error deleting post:", error)
              Alert.alert("Error", "No se pudo eliminar la publicación. Inténtalo de nuevo.")
            }
          },
        },
      ],
    )
  }

  const toggleSavePost = async () => {
    if (isSaving) return

    setIsSaving(true)
    try {
      const db = getFirestore()
      const savedPostRef = doc(db, "savedPosts", `${currentUserId}_${post.id}`)

      if (isSaved) {
        await updateDoc(savedPostRef, {
          deleted: true,
          updatedAt: new Date().toISOString(),
        })
        setIsSaved(false)
        if (onPostSaved) onPostSaved(post.id, false)
      } else {
        await setDoc(savedPostRef, {
          userId: currentUserId,
          postId: post.id,
          createdAt: new Date().toISOString(),
          deleted: false,
        })
        setIsSaved(true)
        if (onPostSaved) onPostSaved(post.id, true)
      }
    } catch (error) {
      console.error("Error toggling saved post:", error)
      Alert.alert("Error", "No se pudo completar la acción. Inténtalo de nuevo.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleReportPost = () => {
    if (isAuthor) return

    Alert.alert("Reportar publicación", "¿Quieres reportar esta publicación por contenido inapropiado?", [
      {
        text: "Cancelar",
        style: "cancel",
      },
      {
        text: "Reportar",
        onPress: async () => {
          try {
            const db = getFirestore()
            await setDoc(doc(db, "reports", `${post.id}_${currentUserId}`), {
              postId: post.id,
              reporterId: currentUserId,
              authorId: authorId,
              reason: "Contenido inapropiado",
              createdAt: new Date().toISOString(),
              status: "pending",
            })
            Alert.alert(
              "Reporte enviado",
              "Gracias por ayudarnos a mantener la comunidad segura. Revisaremos tu reporte lo antes posible.",
            )
            onClose()
          } catch (error) {
            console.error("Error reporting post:", error)
            Alert.alert("Error", "No se pudo enviar el reporte. Inténtalo de nuevo.")
          }
        },
      },
    ])
  }

  // Determinar si se debe mostrar la opción de eliminar
  const canDeletePost = isAuthor || isCurrentUserAdmin

  return (
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Opciones</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.optionItem} onPress={toggleSavePost} disabled={isSaving}>
            <Feather name={isSaved ? "bookmark" : "plus"} size={22} color="#FFFFFF" />
            <Text style={styles.optionText}>{isSaved ? "Eliminar de guardados" : "Guardar publicación"}</Text>
          </TouchableOpacity>

          {canDeletePost && !isLoadingAdminStatus && (
            <TouchableOpacity style={styles.optionItem} onPress={handleDeletePost}>
              <Feather name="trash-2" size={22} color="#FF5252" />
              <Text style={[styles.optionText, styles.deleteText]}>
                {isAuthor ? "Eliminar publicación" : "Eliminar publicación (Admin)"}
              </Text>
            </TouchableOpacity>
          )}

          {!isAuthor && (
            <TouchableOpacity style={styles.optionItem} onPress={handleReportPost}>
              <Feather name="flag" size={22} color="#FFCC00" />
              <Text style={styles.optionText}>Reportar publicación</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "#2A3142",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
    width: Platform.OS === "web" ? "100%" : "100%",
    maxWidth: Platform.OS === "web" ? 800 : "100%",
    alignSelf: "center",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#3B4255",
  },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#3B4255",
  },
  optionText: {
    color: "#FFFFFF",
    fontSize: 16,
    marginLeft: 16,
  },
  deleteText: {
    color: "#FF5252",
  },
  cancelButton: {
    padding: 16,
    alignItems: "center",
    marginTop: 10,
  },
  cancelText: {
    color: "#4ECDC4",
    fontSize: 16,
    fontWeight: "600",
  },
})

export default OptionsMenuModal