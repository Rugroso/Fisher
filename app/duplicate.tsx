//Puro testeo
import React from "react";
import { Button, Alert } from "react-native";
import { doc, getDoc, collection, addDoc } from "firebase/firestore";
import { db } from "../config/Firebase_Conf"; 

const DuplicateUserButton = ({ userId }: { userId: string }) => {
  const handleDuplicate = async () => {
    try {
      // Paso 1: Obtener los datos del usuario original
      const originalDocRef = doc(db, "users", userId);
      const originalDocSnap = await getDoc(originalDocRef);

      if (!originalDocSnap.exists()) {
        Alert.alert("Error", "El documento original no existe.");
        return;
      }

      const originalData = originalDocSnap.data();

      // Paso 2: Crear un nuevo documento con los mismos datos
      const newDocRef = await addDoc(collection(db, "users"), {
        ...originalData,
        duplicatedFrom: userId, // Puedes agregar este campo opcionalmente
        createdAt: new Date(),
      });

      Alert.alert("Éxito", `Documento duplicado con ID: ${newDocRef.id}`);
    } catch (error) {
      console.error("Error al duplicar documento:", error);
      Alert.alert("Error", "No se pudo duplicar el documento.");
    }
  };

  return <Button title="Duplicar Usuario" onPress={handleDuplicate} />;
};

export default DuplicateUserButton;