import type React from "react"
import { View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator, Alert } from "react-native"
import { Feather } from "@expo/vector-icons"
import { doc, updateDoc, setDoc, deleteDoc, getFirestore } from "firebase/firestore"

interface OptionsMenuModalProps {
  visible: boolean
  onClose: () => void
  postId: string
  authorId: string
  currentUserId: string
  isSaved: boolean
  isSaving: boolean
  setIsSaved: (saved: boolean) => void
  setIsSaving: (saving: boolean) => void
  onPostDeleted?: (postId: string) => void
  onPostSaved?: (postId: string, saved: boolean) => void
}

const OptionsMenuModal: React.FC<OptionsMenuModalProps> = ({
  visible,
  onClose,
  postId,
  authorId,
  currentUserId,
  isSaved,
  isSaving,
  setIsSaved,
  setIsSaving,
  onPostDeleted,
  onPostSaved,
}) => {
  const isPostAuthor = currentUserId === authorId

  const toggleSavePost = async () => {
    if (isSaving) return

    setIsSaving(true)
    try {
      const db = getFirestore()
      const savedPostRef = doc(db, "savedPosts", `${currentUserId}_${postId}`)

      if (isSaved) {
        await updateDoc(savedPostRef, {
          deleted: true,
          updatedAt: new Date().toISOString(),
        })
        setIsSaved(false)

        if (onPostSaved) {
          onPostSaved(postId, false)
        }

        Alert.alert("Éxito", "La publicación ha sido eliminada de tus guardados.")
      } else {
        const savedPost = {
          postId: postId,
          userId: currentUserId,
          authorId: authorId,
          savedAt: new Date().toISOString(),
          deleted: false,
        }

        await setDoc(savedPostRef, savedPost)
        setIsSaved(true)

        if (onPostSaved) {
          onPostSaved(postId, true)
        }

        Alert.alert("Éxito", "La publicación ha sido guardada correctamente.")
      }

      onClose()
    } catch (error) {
      console.error("Error al guardar/quitar el post:", error)
      Alert.alert("Error", "Ocurrió un problema al intentar guardar la publicación.")
    } finally {
      setIsSaving(false)
    }
  }

  const deletePost = async () => {
    try {
      const db = getFirestore()

      Alert.alert(
        "Eliminar publicación",
        "¿Estás seguro que deseas eliminar esta publicación? Esta acción no se puede deshacer.",
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
                await deleteDoc(doc(db, "posts", postId))

                if (onPostDeleted) {
                  onPostDeleted(postId)
                  console.log("Post eliminado con ID:", postId)
                }

                try {
                  await deleteDoc(doc(db, "comments", postId))
                } catch (error) {
                  console.log("Error al eliminar datos asociados:", error)
                }
              } catch (error) {
                console.error("Error al eliminar el post:", error)
                Alert.alert("Error", "No se pudo eliminar la publicación. Inténtalo de nuevo más tarde.")
              }
            },
          },
        ],
      )
    } catch (error) {
      console.error("Error al intentar eliminar el post:", error)
      Alert.alert("Error", "Ocurrió un problema al intentar eliminar la publicación.")
    }
  }

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.optionsModalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.optionsMenuContainer}>
          {isPostAuthor && (
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => {
                onClose()
                deletePost()
              }}
            >
              <Feather name="trash-2" size={20} color="#FFFFFF" />
              <Text style={styles.deleteOptionText}>Eliminar publicación</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.optionItem} onPress={toggleSavePost} disabled={isSaving}>
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 16 }} />
            ) : (
              <Feather name={isSaved ? "bookmark" : "plus-circle"} size={20} color="#FFFFFF" />
            )}
            <Text style={styles.optionText}>{isSaved ? "Quitar de guardados" : "Guardar publicación"}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelOption} onPress={onClose}>
            <Text style={styles.cancelOptionText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  )
}

const styles = StyleSheet.create({
  optionsModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  optionsMenuContainer: {
    width: "80%",
    backgroundColor: "#3B4255",
    borderRadius: 12,
    overflow: "hidden",
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#2A3142",
  },
  optionText: {
    color: "#FFFFFF",
    marginLeft: 16,
    fontSize: 16,
  },
  deleteOptionText: {
    color: "#FFFFFF",
    marginLeft: 16,
    fontSize: 16,
  },
  cancelOption: {
    paddingVertical: 16,
    alignItems: "center",
  },
  cancelOptionText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
})

export default OptionsMenuModal
