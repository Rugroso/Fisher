import React, { createContext, useContext, useEffect, useState } from "react";
import { User as FirebaseUser, onAuthStateChanged, signOut, signInWithCredential, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { auth, db, storage } from "../config/Firebase_Conf";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import { Alert } from "react-native";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { webCLientIdGoogle } from "../config/Firebase_Conf";
import { iosClientIdGoogle } from "../config/Firebase_Conf";
import { androidClientIdGoogle } from "../config/Firebase_Conf";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { User, Preferences } from "../app/types/types";

WebBrowser.maybeCompleteAuthSession();

interface AuthContextType {
  user: FirebaseUser | null;
  appUser: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string, 
    password: string, 
    confirmPassword: string, 
    name: string, 
    lastName: string, 
    username: string, 
    cellphone: string, 
    birthdate: string, 
    gender: "male" | "female" | "other", 
    city: string,
    state: string,
    country: string,
    profileImage?: string
  ) => Promise<void>;
  registerwithGoogle: (
    email: string, 
    name: string, 
    lastName: string, 
    username: string,
    birthdate: string, 
    gender: "male" | "female" | "other", 
    city: string,
    state: string,
    country: string,
    imageUrl: string, 
    uid: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  uploadProfileImage: (uri: string, userId: string) => Promise<string>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [requestGoogle, responseGoogle, promptGoogle] = Google.useAuthRequest({
    webClientId: webCLientIdGoogle,
    iosClientId: iosClientIdGoogle,
    androidClientId: androidClientIdGoogle
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsAuthenticated(!!firebaseUser);
      setUser(firebaseUser);
      
      if (firebaseUser) {
        try {
          const userDocRef = doc(db, "users", firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data() as User;
            setAppUser(userData);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      } else {
        setAppUser(null);
      }
      
      setLoading(false);
      console.log(firebaseUser?.email);
    });
    return () => unsubscribe();
  }, []);

  const uploadProfileImage = async (uri: string, userId: string): Promise<string> => {
    if (!uri) return "";
    
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      
      const storageRef = ref(storage, `profileImages/${userId}`);
      const uploadTask = uploadBytesResumable(storageRef, blob);
      
      return new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log('Upload is ' + progress + '% done');
          },
          (error) => {
            console.error("Upload error:", error);
            reject("");
          },
          async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(downloadURL);
          }
        );
      });
    } catch (error) {
      console.error("Error preparing image upload:", error);
      return "";
    }
  };

  const signInGoogle = async () => {
    if (responseGoogle?.type === "success") {
      const { id_token } = responseGoogle.params;
      console.log("Google ID Token:", id_token);
  
      if (!id_token) {
        console.error("Error: id_token es undefined");
        return;
      }
  
      const credential = GoogleAuthProvider.credential(id_token);
      const userCredential = await signInWithCredential(auth, credential);
      const firebaseUser = userCredential.user;

      try {
        const userDocRef = doc(db, "users", firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          router.replace("/(drawer)/(tabs)/stackhome");
          return;
        }
        Alert.alert("Sesión con Google autenticada con éxito");
        router.replace({ 
          pathname: "/registerAuthProvider", //Esto aun no existe, esto se hara tras tener el auth con google.
          params: { 
            nameParam: firebaseUser?.displayName, 
            emailParam: firebaseUser?.email, 
            imageUrlParam: firebaseUser?.photoURL, 
            uidParam: firebaseUser?.uid 
          } 
        });
      } catch (error) {
        Alert.alert("Hubo un error al intentar iniciar sesión con Google");
        console.error("Error en signInWithCredential:", error);
      }
    }
  };

  useEffect(() => {
    signInGoogle();
  }, [responseGoogle]);

  const register = async (
    email: string,
    password: string,
    confirmPassword: string,
    name: string,
    lastName: string,
    username: string,
    cellphone: string,
    birthdate: string,
    gender: "male" | "female" | "other",
    city: string,
    state: string,
    country: string,
    profileImage?: string
  ) => {
    if (
      !email || !password || !confirmPassword || !name || !lastName ||
      !birthdate || !gender || !city || !state || !country || !cellphone
    ) {
      Alert.alert("Error", "Todos los campos son obligatorios");
      return;
    }
  
    if (password !== confirmPassword) {
      Alert.alert("Error", "Las contraseñas no coinciden");
      return;
    }
  
    setLoading(true);
  
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      const userId = firebaseUser.uid;
      
      let profilePictureUrl = "";
      console.log("Profile Image URL:", profileImage);
      if (profileImage) {
        profilePictureUrl = await uploadProfileImage(profileImage, userId);
      }
      
      const createdAt = new Date().toISOString();
      
      // Create user with new interface structure
      const newUser: User = {
        id: userId,
        name,
        lastName,
        username,
        email,
        cellphone,
        birthdate,
        city,
        state,
        country,
        gender,
        profilePicture: profilePictureUrl || undefined,
        tags: [],
        expoPushTokens: [],
        isOnline: true,
        isVerified: false,
        preferences: {
          oceanMode: false,
          privacyMode: false
        },
        followerCount: 0,
        followingCount: 0,
        notificationCount: 0,
        createdAt,
        updatedAt: createdAt
      };
  
      await setDoc(doc(db, "users", userId), newUser);
  
      await sendEmailVerification(firebaseUser);
  
      Alert.alert(
        "Registro exitoso",
        "Te hemos enviado un correo de verificación. Revisa tu bandeja de entrada."
      );
  
      router.replace("/login");
    } catch (error: any) {
      if (error.message === 'Firebase: Error (auth/email-already-in-use).') {
        Alert.alert("Error", "El correo ya está en uso");
      } else if (error.message === 'Firebase: Error (auth/invalid-email).') {
        Alert.alert("Error", "Correo inválido");
      } else if (error.message === 'Firebase: Error (auth/weak-password).') {
        Alert.alert("Error", "La contraseña debe tener al menos 6 caracteres");
      } else {
        Alert.alert("Error", "Error desconocido: " + error.message);
      }
    }
  
    setLoading(false);
  };

  const registerwithGoogle = async (
    email: string, 
    name: string, 
    lastName: string, 
    username: string,
    birthdate: string, 
    gender: "male" | "female" | "other", 
    city: string,
    state: string,
    country: string,
    imageUrl: string, 
    uid: string
  ) => {
    if (!email || !name || !lastName || !username || !birthdate || !gender || !city || !state || !country) {
      Alert.alert("Error", "Todos los campos son obligatorios");
      return;
    }
    console.log(imageUrl);
     
    setLoading(true);
    try {
      const createdAt = new Date().toISOString();
      
      // Create user with new interface structure
      const newUser: User = {
        id: uid,
        name,
        lastName,
        username,
        email,
        birthdate,
        city,
        state,
        country,
        gender,
        profilePicture: imageUrl || undefined,
        isOnline: true,
        isVerified: false,
        preferences: {
          oceanMode: false,
          privacyMode: false
        },
        followerCount: 0,
        followingCount: 0,
        notificationCount: 0,
        createdAt,
        updatedAt: createdAt
      };
      
      await setDoc(doc(db, "users", uid), newUser);

      Alert.alert("Registro exitoso");
      router.replace("/(drawer)/(tabs)/stackhome");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
    setLoading(false);
  };

  const login = async (email: string, password: string) => {
    if (!email || !password) {
      Alert.alert("Error", "Email y contraseña son requeridos");
      return;
    }
    
    setLoading(true);
    try {
      const response = await signInWithEmailAndPassword(auth, email, password);
      let userId = response.user.uid;

      const userDocRef = doc(db, "users", userId); 
      const userSnapshot = await getDoc(userDocRef);

      if (!userSnapshot.exists()) {
        Alert.alert("Error", "No se encontró la información del usuario.");
        setLoading(false);
        return;
      }

      const userData = userSnapshot.data() as User;
      setAppUser(userData);
      
      Alert.alert("Bienvenido", "Sesión iniciada con éxito");
      router.replace("/(drawer)/(tabs)/stackhome"); 
    } catch (error: any) {
      if (error.message === 'Firebase: Error (auth/invalid-email).') {
        Alert.alert("Error", 'El correo electrónico es incorrecto');
      } else if (error.message === 'Firebase: Error (auth/invalid-credential).') {
        Alert.alert("Error", 'La contraseña es incorrecta');
      } else {
        Alert.alert("Error", error.message);
      }
    }
    setLoading(false);
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setAppUser(null);
  };

  const signInWithGoogle = async () => {
    promptGoogle();
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      appUser,
      loading, 
      logout, 
      signInWithGoogle, 
      login, 
      register, 
      registerwithGoogle,
      uploadProfileImage
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de un AuthProvider");
  }
  return context;
};