import React, { useState } from "react";
import { View, Alert, StyleSheet } from "react-native";
import { TextInput, Button, Text } from "react-native-paper";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../config/Firebase_Conf"; 
import { useRouter } from "expo-router";

export default function ResetPassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert("Error", "Por favor, ingresa tu correo electrónico");
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      Alert.alert("Correo enviado", "Revisa tu bandeja de entrada para restablecer tu contraseña.");
      router.replace("/login");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Restablecer Contraseña</Text>

      <TextInput
        label="Correo Electrónico"
        value={email}
        onChangeText={setEmail}
        mode="outlined"
        keyboardType="email-address"
        autoCapitalize="none"
        style={styles.input}
      />

      <Button
        mode="contained"
        onPress={handleResetPassword}
        loading={loading}
        disabled={loading}
        style={styles.button}
      >
        Enviar Correo de Restablecimiento
      </Button>

      <Text style={styles.loginText}>
        ¿Recordaste tu contraseña?{" "}
        <Text style={styles.loginLink} onPress={() => router.replace("/login")}>
          Inicia sesión
        </Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 10,
    backgroundColor: "#4f0c2e",
  },
  loginText: {
    textAlign: "center",
    marginTop: 20,
    fontSize: 14,
  },
  loginLink: {
    color: "#007bff",
    fontWeight: "bold",
  },
});