"use client"

import React, { useState } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  StatusBar,
  SafeAreaView,
} from "react-native"
import { Feather } from "@expo/vector-icons"
import { useRouter, Stack } from "expo-router"

import { getAuth } from "firebase/auth"
import { collection, addDoc, doc, updateDoc } from "firebase/firestore"
import { db } from "../../../../config/Firebase_Conf"

const CreateFishtankScreen = () => {
  const router = useRouter()
  const auth = getAuth()
  
  const [nombre, setNombre] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [esPublica, setEsPublica] = useState(true)
  const [isLoading, setIsLoading] = useState(false)

  const handleCancel = () => {
    if (!nombre && !descripcion) {
      router.back()
      return
    }

    Alert.alert(
      "¿Cancelar creación?",
      "Toda la información de la pecera se perderá.",
      [
        { text: "No", style: "cancel" },
        { 
          text: "Sí, cancelar", 
          style: "destructive", 
          onPress: () => router.back() 
        }
      ]
    )
  }

  // Crear una nueva pecera
  const crearPecera = async () => {
    if (!nombre.trim()) {
      Alert.alert("Error", "El nombre de la pecera es obligatorio")
      return
    }

    setIsLoading(true)

    try {
      const currentUser = auth.currentUser
      if (!currentUser) {
        Alert.alert("Error", "Debes iniciar sesión para crear una pecera")
        return
      }

      // Crear el documento de la pecera
      const nuevaPecera = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        imagenURL: null, // Imagenes pendientes
        creadoPor: currentUser.uid,
        fechaCreacion: new Date(),
        miembrosCount: 1,
        esPublica: esPublica
      }
      
      const peceraRef = await addDoc(collection(db, "peceras"), nuevaPecera)
      
      // Actualizar el ID
      await updateDoc(doc(db, "peceras", peceraRef.id), {
        id: peceraRef.id
      })
      
      // Añadir al creador como administrador de la pecera
      await addDoc(collection(db, "peceras_miembros"), {
        peceraID: peceraRef.id,
        userID: currentUser.uid,
        rol: 'admin',
        fechaUnion: new Date()
      })
      
      Alert.alert(
        "Éxito", 
        "Pecera creada correctamente",
        [{ 
          text: "OK", 
          onPress: () => {
            // Navegar a la pantalla de detalle de la pecera recién creada
            router.push({
              pathname: "/(drawer)/(tabs)/stackfishtanks/[id]",
              params: { id: peceraRef.id }
            })
          }
        }]
      )
    } catch (error) {
      console.error("Error al crear pecera:", error)
      Alert.alert("Error", "No se pudo crear la pecera")
    } finally {
      setIsLoading(false)
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
          <View style={styles.actionBar}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.createButton, !nombre.trim() && styles.createButtonDisabled]}
              onPress={crearPecera}
              disabled={!nombre.trim() || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.createButtonText}>Crear</Text>
              )}
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
          >
            <ScrollView style={styles.contentContainer}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Nombre de la Pecera*</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej: Amantes de los Gatos"
                  placeholderTextColor="#8E8E93"
                  value={nombre}
                  onChangeText={setNombre}
                  maxLength={50}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Descripción</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Describe de qué trata esta comunidad..."
                  placeholderTextColor="#8E8E93"
                  multiline
                  value={descripcion}
                  onChangeText={setDescripcion}
                  maxLength={200}
                />
              </View>

              <View style={styles.toggleContainer}>
                <Text style={styles.label}>Pecera pública</Text>
                <TouchableOpacity 
                  style={[styles.toggleButton, esPublica ? styles.toggleActive : styles.toggleInactive]} 
                  onPress={() => setEsPublica(!esPublica)}
                >
                  <View style={[styles.toggleCircle, esPublica ? styles.toggleCircleRight : styles.toggleCircleLeft]} />
                </TouchableOpacity>
                <Text style={styles.toggleHint}>
                  {esPublica 
                    ? "Cualquiera puede unirse a esta pecera" 
                    : "Solo personas invitadas pueden unirse"}
                </Text>
              </View>

              <View style={styles.infoMessage}>
                <Feather name="info" size={20} color="#4A6FFF" style={styles.infoIcon} />
                <Text style={styles.infoText}>
                  La subida de imágenes para peceras estará disponible en futuras versiones
                </Text>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
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
  actionBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#3A4154",
    backgroundColor: "#2A3142",
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  cancelButtonText: {
    fontSize: 16,
    color: "#FFFFFF",
  },
  createButton: {
    backgroundColor: "#4A6FFF",
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  createButtonDisabled: {
    backgroundColor: "#4A6FFF80",
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "500",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#3A4154",
    borderRadius: 8,
    color: "#FFFFFF",
    fontSize: 16,
    padding: 12,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  toggleContainer: {
    marginBottom: 20,
  },
  toggleButton: {
    width: 50,
    height: 30,
    borderRadius: 15,
    padding: 2,
    marginTop: 8,
    marginBottom: 8,
  },
  toggleActive: {
    backgroundColor: "#4A6FFF",
  },
  toggleInactive: {
    backgroundColor: "#3A4154",
  },
  toggleCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
  },
  toggleCircleLeft: {
    alignSelf: "flex-start",
  },
  toggleCircleRight: {
    alignSelf: "flex-end",
  },
  toggleHint: {
    fontSize: 14,
    color: "#8E8E93",
  },
  infoMessage: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3A4154",
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  infoIcon: {
    marginRight: 8,
  },
  infoText: {
    color: "#FFFFFF",
    fontSize: 14,
    flex: 1,
  },
})

export default CreateFishtankScreen