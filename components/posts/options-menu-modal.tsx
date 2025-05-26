"use client"

import type React from "react"
import { View, Text, TouchableOpacity, StyleSheet, Modal, Alert, Platform } from "react-native"
import { Feather } from "@expo/vector-icons"
import type { Post, User } from "../../app/types/types"
import { doc, getFirestore, updateDoc, setDoc, deleteDoc } from "firebase/firestore"

interface OptionsMenuModalProps {
  visible: boolean
  onClose: () => void
  post: Post
  authorId: string
  currentUserId: string
  isSaved: boolean
  isSaving: boolean
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
  const isAuthor = currentUserId === authorId


  const handleDeletePost = async () => {
    if (!isAuthor) return
    Alert.alert(
      "Eliminar publicación",
      "¿Estás seguro de que quieres eliminar esta publicación? Esta acción no se puede deshacer.",
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
              await deleteDoc(doc(db, collectionName, post.id))
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

          {isAuthor && (
            <TouchableOpacity style={styles.optionItem} onPress={handleDeletePost}>
              <Feather name="trash-2" size={22} color="#FF5252" />
              <Text style={[styles.optionText, styles.deleteText]}>Eliminar publicación</Text>
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
