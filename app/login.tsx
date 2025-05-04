import React, { useState } from "react";
import { View, StyleSheet, Image, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { TextInput, Button, Text } from "react-native-paper";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Camera } from "lucide-react-native";
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';

export default function AuthScreen() {
  const router = useRouter();
  const { login, register, signInWithGoogle } = useAuth();
  const [activeTab, setActiveTab] = useState("login");
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [registerEmail, setRegisterEmail] = useState("");
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other">("male");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [registerLoading, setRegisterLoading] = useState(false);
  const [profileImage, setProfileImage] = useState<string | undefined>(undefined);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter email and password");
      return;
    }
    
    setLoginLoading(true);
    try {
      // Primero intentamos iniciar sesión
      const userCredential = await login(email, password);
      
      if (userCredential && userCredential.user) {
        // Verificar si la cuenta está desactivada
        const db = getFirestore();
        const userRef = doc(db, 'users', userCredential.user.uid);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          if (userData.isActive === false) {
            // Reactivar la cuenta
            await updateDoc(userRef, {
              isActive: true,
              reactivatedAt: new Date().toISOString(),
              lastReactivation: new Date().toISOString(),
            });
            
            Alert.alert(
              'Cuenta reactivada',
              '¡Bienvenido de vuelta! Tu cuenta ha sido reactivada exitosamente.',
              [
                {
                  text: 'OK',
                  onPress: () => router.replace('/(tabs)')
                }
              ]
            );
          } else {
            // Cuenta activa, continuar normalmente
            router.replace('/(tabs)');
          }
        } else {
          // Si no existe el documento de usuario, continuar normalmente
          router.replace('/(tabs)');
        }
      }
    } catch (error) {
      console.log(error);
      Alert.alert("Error", "No se pudo iniciar sesión. Verifica tus credenciales.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const userCredential = await signInWithGoogle();
      
      if (userCredential && userCredential.user) {
        // Verificar si la cuenta está desactivada para login con Google también
        const db = getFirestore();
        const userRef = doc(db, 'users', userCredential.user.uid);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          if (userData.isActive === false) {
            // Reactivar la cuenta
            await updateDoc(userRef, {
              isActive: true,
              reactivatedAt: new Date().toISOString(),
              lastReactivation: new Date().toISOString(),
            });
            
            Alert.alert(
              'Cuenta reactivada',
              '¡Bienvenido de vuelta! Tu cuenta ha sido reactivada exitosamente.',
              [
                {
                  text: 'OK',
                  onPress: () => router.replace('/(tabs)')
                }
              ]
            );
          } else {
            // Cuenta activa, continuar normalmente
            router.replace('/(tabs)');
          }
        } else {
          // Si no existe el documento de usuario, continuar normalmente
          router.replace('/(tabs)');
        }
      }
    } catch (error) {
      console.log(error);
    }
  };

  const handleRegister = async () => {
    if (!registerEmail || !username || !firstName || !lastName || !phoneNumber || 
        !birthDate || !gender || !city || !state || !country || 
        !registerPassword || !confirmPassword) {
      Alert.alert("Error", "All fields are required.");
      return;
    }

    if (registerPassword !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }
    
    // Validate gender is one of the allowed values
    if (gender !== "male" && gender !== "female" && gender !== "other") {
      Alert.alert("Error", "Gender must be 'male', 'female', or 'other'.");
      return;
    }

    setRegisterLoading(true);
    try {
      await register(
        registerEmail,
        registerPassword,
        confirmPassword,
        firstName,
        lastName,
        username,
        phoneNumber,
        birthDate,
        gender,
        city,
        state,
        country,
        profileImage
      );
    } catch (error) {
      Alert.alert("Error", "Error during registration.");
    } finally {
      setRegisterLoading(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant permission to access your photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      setProfileImage(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant permission to access your camera');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled) {
      setProfileImage(result.assets[0].uri);
    }
  };

  const showImageOptions = () => {
    Alert.alert(
      "Profile Photo",
      "Choose an option",
      [
        { text: "Take Photo", onPress: takePhoto },
        { text: "Choose from Gallery", onPress: pickImage },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  const handleGenderChange = (value: string) => {
    if (value === "male" || value === "female" || value === "other") {
      setGender(value);
    } else {
      Alert.alert("Invalid Gender", "Please enter 'male', 'female', or 'other'");
    }
  };

  const renderLoginForm = () => (
    <View style={styles.formContainer}>
      <TextInput
        label="Username/Mail"
        value={email}
        onChangeText={setEmail}
        mode="flat"
        style={styles.input}
        underlineColor="transparent"
        textColor="#fff"
        autoCapitalize="none"
        theme={{ colors: { primary: '#fff', onSurfaceVariant: '#8e8e93' } }}
      />

      <TextInput
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        mode="flat"
        style={styles.input}
        underlineColor="transparent"
        textColor="#fff"
        theme={{ colors: { primary: '#fff', onSurfaceVariant: '#8e8e93' } }}
      />

      <Button
        mode="contained"
        onPress={handleLogin}
        loading={loginLoading}
        disabled={loginLoading}
        style={styles.signInButton}
        labelStyle={styles.signInLabel}
      >
        Log in
      </Button>

      <View style={styles.orContainer}>
        <View style={styles.divider} />
        <Text style={styles.orText}>or</Text>
        <View style={styles.divider} />
      </View>

      <Button
        mode="outlined"
        icon="google"
        onPress={handleGoogleLogin}
        style={styles.googleButton}
        labelStyle={styles.googleLabel}
      >
        Sign in with Google
      </Button>
    </View>
  );

  const renderRegisterForm = () => (
    <ScrollView contentContainerStyle={styles.scrollFormContainer}>
      
      <View style={styles.photoContainer}>
        <TouchableOpacity style={styles.addPhotoButton} onPress={showImageOptions}>
          {profileImage ? (
            <Image source={{ uri: profileImage }} style={styles.profileImage} />
          ) : (
            <>
              <Camera color="#fff" size={24} />
              <Text style={styles.addPhotoText}>Add Photo</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
      <Text style={{color: "#c9c9c9", fontSize: 16, textAlign: "center", marginBottom: 20}}>
        Puedes añadir una foto de perfil después
      </Text>

      <TextInput
        label="Name"
        value={firstName}
        onChangeText={setFirstName}
        mode="flat"
        style={styles.input}
        underlineColor="transparent"
        textColor="#fff"
        theme={{ colors: { primary: '#fff', onSurfaceVariant: '#8e8e93' } }}
      />

      <TextInput
        label="Last Name"
        value={lastName}
        onChangeText={setLastName}
        mode="flat"
        style={styles.input}
        underlineColor="transparent"
        textColor="#fff"
        theme={{ colors: { primary: '#fff', onSurfaceVariant: '#8e8e93' } }}
      />

      <TextInput
        label="Username"
        value={username}
        onChangeText={(text) => setUsername(text.toLowerCase())}
        mode="flat"
        style={styles.input}
        underlineColor="transparent"
        textColor="#fff"
        autoCapitalize="none"
        theme={{ colors: { primary: '#fff', onSurfaceVariant: '#8e8e93' } }}
      />

      <TextInput
        label="E-mail address"
        value={registerEmail}
        onChangeText={setRegisterEmail}
        mode="flat"
        style={styles.input}
        underlineColor="transparent"
        textColor="#fff"
        autoCapitalize="none"
        keyboardType="email-address"
        theme={{ colors: { primary: '#fff', onSurfaceVariant: '#8e8e93' } }}
      />

      <TextInput
        label="Phone number"
        value={phoneNumber}
        onChangeText={setPhoneNumber}
        mode="flat"
        style={styles.input}
        underlineColor="transparent"
        textColor="#fff"
        keyboardType="phone-pad"
        theme={{ colors: { primary: '#fff', onSurfaceVariant: '#8e8e93' } }}
      />

      <TextInput
        label="Date of birth (YYYY-MM-DD)"
        value={birthDate}
        onChangeText={setBirthDate}
        mode="flat"
        style={styles.input}
        underlineColor="transparent"
        textColor="#fff"
        theme={{ colors: { primary: '#fff', onSurfaceVariant: '#8e8e93' } }}
      />

      <TextInput
        label="Gender (male, female, or other)"
        value={gender}
        onChangeText={handleGenderChange}
        mode="flat"
        style={styles.input}
        underlineColor="transparent"
        textColor="#fff"
        theme={{ colors: { primary: '#fff', onSurfaceVariant: '#8e8e93' } }}
      />

      <TextInput
        label="City"
        value={city}
        onChangeText={setCity}
        mode="flat"
        style={styles.input}
        underlineColor="transparent"
        textColor="#fff"
        theme={{ colors: { primary: '#fff', onSurfaceVariant: '#8e8e93' } }}
      />

      <TextInput
        label="State"
        value={state}
        onChangeText={setState}
        mode="flat"
        style={styles.input}
        underlineColor="transparent"
        textColor="#fff"
        theme={{ colors: { primary: '#fff', onSurfaceVariant: '#8e8e93' } }}
      />

      <TextInput
        label="Country"
        value={country}
        onChangeText={setCountry}
        mode="flat"
        style={styles.input}
        underlineColor="transparent"
        textColor="#fff"
        theme={{ colors: { primary: '#fff', onSurfaceVariant: '#8e8e93' } }}
      />

      <TextInput
        label="Password"
        value={registerPassword}
        onChangeText={setRegisterPassword}
        secureTextEntry
        mode="flat"
        style={styles.input}
        underlineColor="transparent"
        textColor="#fff"
        theme={{ colors: { primary: '#fff', onSurfaceVariant: '#8e8e93' } }}
      />

      <TextInput
        label="Confirm Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        mode="flat"
        style={styles.input}
        underlineColor="transparent"
        textColor="#fff"
        theme={{ colors: { primary: '#fff', onSurfaceVariant: '#8e8e93' } }}
      />

      <Button
        mode="contained"
        onPress={handleRegister}
        loading={registerLoading}
        disabled={registerLoading}
        style={styles.signInButton}
        labelStyle={styles.signInLabel}
      >
        Sign up
      </Button>
    </ScrollView>
  );

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.logoContainer}>
        <Image
          // source={require('../assets/fish-logo.png')}
          style={styles.logo}
        />
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "login" && styles.activeTab]}
          onPress={() => setActiveTab("login")}
        >
          <Text style={styles.tabText}>Log in</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "register" && styles.activeTab]}
          onPress={() => setActiveTab("register")}
        >
          <Text style={styles.tabText}>Sign up</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.dividerLine} />

      {activeTab === "login" ? renderLoginForm() : renderRegisterForm()}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1A1A2E",
    paddingHorizontal: 20,
  },
  logoContainer: {
    alignItems: "center",
    marginTop: 60,
    marginBottom: 30,
  },
  logo: {
    width: 80,
    height: 80,
    resizeMode: "contain",
  },
  tabContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 10,
  },
  tab: {
    paddingHorizontal: 30,
    paddingVertical: 10,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: "#fff",
  },
  tabText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  dividerLine: {
    height: 1,
    backgroundColor: "#444",
    marginBottom: 20,
  },
  formContainer: {
    flex: 1,
    paddingTop: 10,
  },
  scrollFormContainer: {
    paddingTop: 10,
    paddingBottom: 40,
  },
  input: {
    marginBottom: 15,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 5,
    height: 50,
  },
  signInButton: {
    backgroundColor: "#299FE6",
    marginTop: 10,
    borderRadius: 5,
    height: 50,
    justifyContent: "center",
  },
  signInLabel: {
    color: "#fff",
    fontSize: 16,
  },
  orContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: "#444",
  },
  orText: {
    color: "#fff",
    marginHorizontal: 10,
    fontSize: 16,
  },
  googleButton: {
    borderColor: "#fff",
    borderWidth: 1,
    borderRadius: 5,
    height: 50,
    justifyContent: "center",
  },
  googleLabel: {
    color: "#fff",
  },
  personalDataText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },
  photoContainer: {
    alignItems: "center",
    marginBottom: 10,
  },
  addPhotoButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  addPhotoText: {
    color: "#fff",
    fontSize: 12,
    marginTop: 5,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
});