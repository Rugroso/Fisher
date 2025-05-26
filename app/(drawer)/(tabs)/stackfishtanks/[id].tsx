"use client"

import React, { useState, useEffect, useCallback } from "react"
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  StatusBar,
  SafeAreaView,
  Platform,
  Image,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  RefreshControl,
} from "react-native"
import { Feather } from "@expo/vector-icons"
import { useRouter, useLocalSearchParams, Stack } from "expo-router"

import { getAuth } from "firebase/auth"
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  increment,
  serverTimestamp,
  orderBy,
  onSnapshot
} from "firebase/firestore"
import { db } from "../../../../config/Firebase_Conf"
import { useAuth } from "@/context/AuthContext"
import { FishTank, Membership, JoinRequest, JoinRequestStatus, Post, User } from "@/app/types/types"
import PostItem from "../../../../components/general/posts"

interface PostWithUser {
  user: User
  post: Post
}

const FishtankDetailScreen = () => {
  const router = useRouter()
  const { id } = useLocalSearchParams()
  const auth = getAuth()
  const { user: authUser } = useAuth() // Usar el contexto de autenticación
  
  const [fishtank, setFishtank] = useState<FishTank | null>(null)
  const [creator, setCreator] = useState<{id: string, username: string} | null>(null)
  const [membership, setMembership] = useState<Membership>({ isMember: false, role: null })
  const [loading, setLoading] = useState(true)
  const [loadingAction, setLoadingAction] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isAppAdmin, setIsAppAdmin] = useState(false)
  const [joinRequest, setJoinRequest] = useState<JoinRequest | null>(null)
  const [posts, setPosts] = useState<PostWithUser[]>([])
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [admins, setAdmins] = useState<User[]>([])
  
  // Verificar si el usuario es administrador de la aplicación
  useEffect(() => {
    const checkAppAdminStatus = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      try {
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          setIsAppAdmin(userData.isAdmin === true);
        }
      } catch (error) {
        console.error("Error verificando estado de administrador de la app:", error);
      }
    };

    checkAppAdminStatus();
  }, [auth.currentUser]);

  // Verificar si el usuario es administrador de la pecera
  useEffect(() => {
    const checkAdminStatus = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser || !id) return;

      try {
        const membershipQuery = query(
          collection(db, "fishtank_members"),
          where("fishtankId", "==", id),
          where("userId", "==", currentUser.uid),
          where("role", "==", "admin")
        );
        
        const membershipSnap = await getDocs(membershipQuery);
        setIsAdmin(!membershipSnap.empty);
      } catch (error) {
        console.error("Error verificando estado de administrador:", error);
      }
    };

    checkAdminStatus();
  }, [id, auth.currentUser]);

  // Este efecto se ejecutará cada vez que cambie el ID
  useEffect(() => {
    // Reiniciar los estados al cambiar de pecera
    setFishtank(null);
    setCreator(null);
    setMembership({ isMember: false, role: null });
    setHasAccess(false);
    setIsAdmin(false);
    
    loadFishtank();
  }, [id]);

  // Agregar efecto para escuchar cambios en las solicitudes
  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser || !id) return;

    const requestsQuery = query(
      collection(db, "fishtank_join_requests"),
      where("fishtankId", "==", id),
      where("userId", "==", currentUser.uid),
      where("status", "in", ["pending", "accepted", "rejected"])
    );

    const unsubscribe = onSnapshot(requestsQuery, (snapshot) => {
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const requestData = doc.data();
        setJoinRequest({
          id: doc.id,
          ...requestData
        } as JoinRequest);
      } else {
        setJoinRequest(null);
      }
    }, (error) => {
      console.error("Error al escuchar cambios en solicitudes:", error);
    });

    // Limpiar el listener cuando el componente se desmonte
    return () => unsubscribe();
  }, [id, auth.currentUser]);

  // Listener en tiempo real para pendingCount y adminCount
  useEffect(() => {
    if (!id) return;

    // Listener para la pecera
    const fishtankRef = doc(db, "fishtanks", id as string);
    const unsubscribeFishtank = onSnapshot(fishtankRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setFishtank((prev) => ({
          id: docSnap.id,
          name: data.name ?? prev?.name ?? "",
          description: data.description ?? prev?.description ?? "",
          about: data.about ?? prev?.about,
          fishTankPicture: data.fishTankPicture ?? prev?.fishTankPicture,
          tags: data.tags ?? prev?.tags,
          isPrivate: data.isPrivate ?? prev?.isPrivate ?? false,
          isVerified: data.isVerified ?? prev?.isVerified ?? false,
          creatorId: data.creatorId ?? prev?.creatorId ?? "",
          memberCount: typeof data.memberCount === 'number' ? data.memberCount : prev?.memberCount ?? 0,
          pendingCount: typeof data.pendingCount === 'number' ? data.pendingCount : prev?.pendingCount ?? 0,
          adminCount: typeof data.adminCount === 'number' ? data.adminCount : prev?.adminCount ?? 0,
          createdAt: data.createdAt ?? prev?.createdAt ?? "",
          updatedAt: data.updatedAt ?? prev?.updatedAt ?? "",
        }));
      }
    });

    // Listener para los miembros administradores
    const adminsQuery = query(
      collection(db, "fishtank_members"),
      where("fishtankId", "==", id),
      where("role", "==", "admin")
    );

    const unsubscribeAdmins = onSnapshot(adminsQuery, async (snapshot) => {
      try {
        const adminCount = snapshot.size;
        const fishtankRef = doc(db, "fishtanks", id as string);
        await updateDoc(fishtankRef, {
          adminCount: adminCount,
          updatedAt: new Date().toISOString()
        });
      } catch (error) {
        console.error("Error actualizando conteo de administradores:", error);
      }
    });

    return () => {
      unsubscribeFishtank();
      unsubscribeAdmins();
    };
  }, [id]);

  // Cargar posts de la pecera
  useEffect(() => {
    if (!id) return;
    setLoadingPosts(true);
    const postsQuery = query(
      collection(db, "fishtank_posts"),
      where("fishtankId", "==", id),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(postsQuery, async (snapshot) => {
      const fetchedPosts: Post[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Post[];
      // Obtener los usuarios autores
      const userIds = Array.from(new Set(fetchedPosts.map((p) => p.authorId)));
      const usersMap: Record<string, User> = {};
      await Promise.all(userIds.map(async (uid) => {
        try {
          const userSnap = await getDoc(doc(db, "users", uid));
          if (userSnap.exists()) {
            usersMap[uid] = { id: uid, ...userSnap.data() } as User;
          }
        } catch (e) { /* ignorar error individual */ }
      }));
      const postsWithUser: PostWithUser[] = fetchedPosts.map((post) => ({
        post,
        user: usersMap[post.authorId] || { id: post.authorId, username: "Usuario", name: "", lastName: "", email: "", isOnline: false, isVerified: false, preferences: { oceanMode: false, privacyMode: false }, followerCount: 0, followingCount: 0, notificationCount: 0, createdAt: "", updatedAt: "" }
      }));
      setPosts(postsWithUser);
      setLoadingPosts(false);
    });
    return () => unsubscribe();
  }, [id]);

  const handleBack = () => {
    // Imprimir información de depuración
    console.log("Estado de isAdmin:", isAdmin);
    console.log("Estado de isAppAdmin:", isAppAdmin);
    console.log("Usuario actual:", auth.currentUser?.uid);
    
    try {
      // Si es administrador de la aplicación, ir a la página de administración
      if (isAppAdmin) {
        console.log("Navegando a la pantalla de admin: /(drawer)/(admintabs)/fishtanks");
        router.push("/(drawer)/(admintabs)/fishtanks");
      } else {
        // Si no es administrador, ir a la pantalla normal de peceras
        console.log("Navegando a la pantalla normal: /(drawer)/(tabs)/stackfishtanks/");
        router.push("/(drawer)/(tabs)/stackfishtanks/");
      }
    } catch (error) {
      console.error("Error en handleBack:", error);
      // En caso de error, intentar usar la navegación más básica
      router.back();
    }
  };

  // Función mejorada para verificar solicitudes pendientes
  const checkPendingRequest = async (fishtankId: string, userId: string) => {
    try {
      const requestsQuery = query(
        collection(db, "fishtank_join_requests"),
        where("fishtankId", "==", fishtankId),
        where("userId", "==", userId),
        where("status", "in", ["pending", "accepted", "rejected"])
      );
      
      const requestDocs = await getDocs(requestsQuery);
      
      if (!requestDocs.empty) {
        const doc = requestDocs.docs[0];
        const requestData = doc.data();
        setJoinRequest({
          id: doc.id,
          ...requestData
        } as JoinRequest);
        return true;
      }
      
      setJoinRequest(null);
      return false;
    } catch (error) {
      console.error("Error al verificar solicitud pendiente:", error);
      setJoinRequest(null);
      return false;
    }
  };

  const loadFishtank = async () => {
    try {
      setLoading(true);
      
      if (!id) {
        Alert.alert("Error", "ID de pecera no válido");
        router.back();
        return;
      }
      
      const fishtankRef = doc(db, "fishtanks", id as string);
      const fishtankSnap = await getDoc(fishtankRef);
      
      if (!fishtankSnap.exists()) {
        Alert.alert("Error", "La pecera no existe");
        router.back();
        return;
      }
      
      const fishtankData = fishtankSnap.data() as FishTank;
      setFishtank({
        ...fishtankData,
        id: fishtankSnap.id
      });
      
      const currentUser = auth.currentUser;
      
      // Por defecto, si la pecera no es privada o el usuario es admin de la app, el usuario tiene acceso
      let userHasAccess = !fishtankData.isPrivate || isAppAdmin;
      
      if (currentUser && fishtankData.isPrivate && !isAppAdmin) {
        // Si el usuario es el creador, tiene acceso
        if (currentUser.uid === fishtankData.creatorId) {
          userHasAccess = true;
        } else {
          // Verificar si el usuario es miembro
          const membershipQuery = query(
            collection(db, "fishtank_members"),
            where("fishtankId", "==", id),
            where("userId", "==", currentUser.uid)
          );
          
          const membershipSnap = await getDocs(membershipQuery);
          userHasAccess = !membershipSnap.empty;
          
          // Si la pecera es privada y el usuario no tiene acceso, verificar si tiene solicitud pendiente
          if (!userHasAccess) {
            await checkPendingRequest(id as string, currentUser.uid);
          }
        }
      }
      
      setHasAccess(userHasAccess);
      
      // Cargar información del creador y membresía del usuario actual
      if (fishtankData.creatorId) {
        const creatorRef = doc(db, "users", fishtankData.creatorId);
        const creatorSnap = await getDoc(creatorRef);
        
        if (creatorSnap.exists()) {
          const creatorData = creatorSnap.data();
          setCreator({
            id: creatorSnap.id,
            username: creatorData.username || "Usuario"
          });
        }
      }
      
      if (currentUser) {
        const membershipQuery = query(
          collection(db, "fishtank_members"),
          where("fishtankId", "==", id),
          where("userId", "==", currentUser.uid)
        );
        
        const membershipSnap = await getDocs(membershipQuery);
        
        if (!membershipSnap.empty) {
          const membershipData = membershipSnap.docs[0].data();
          setMembership({
            isMember: true,
            role: membershipData.role as 'admin' | 'moderator' | 'member',
            joinedAt: membershipData.joinedAt
          });
        }
      }
    } catch (error) {
      console.error("Error loading fishtank:", error);
      Alert.alert("Error", "No se pudo cargar la información de la pecera");
    } finally {
      setLoading(false);
    }
  };

  const joinFishtank = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        Alert.alert("Error", "Debes iniciar sesión para unirte a una pecera");
        return;
      }

      // Verificar si el usuario es administrador de la aplicación
      const userRef = doc(db, "users", currentUser.uid);
      const userSnap = await getDoc(userRef);
      const isAppAdmin = userSnap.exists() && userSnap.data().isAdmin === true;
      
      // Si la pecera es privada y el usuario NO es admin de la app, mostrar modal de solicitud
      if (fishtank?.isPrivate && !isAppAdmin) {
        router.push(`/(drawer)/(tabs)/stackfishtanks/request-join?id=${id}`);
        return;
      }
      
      setLoadingAction(true);
      
      // Verificar si ya es miembro
      const membershipQuery = query(
        collection(db, "fishtank_members"),
        where("fishtankId", "==", id),
        where("userId", "==", currentUser.uid)
      );
      
      const membershipSnap = await getDocs(membershipQuery);
      
      if (!membershipSnap.empty) {
        Alert.alert("Error", "Ya eres miembro de esta pecera");
        return;
      }
      
      const currentDate = new Date().toISOString();
      
      // Crear la membresía
      await addDoc(collection(db, "fishtank_members"), {
        fishtankId: id,
        userId: currentUser.uid,
        role: isAppAdmin ? 'admin' : 'member',
        joinedAt: currentDate
      });
      
      // Actualizar contadores de la pecera
      const fishtankRef = doc(db, "fishtanks", id as string);
      await updateDoc(fishtankRef, {
        memberCount: increment(1),
        adminCount: isAppAdmin ? increment(1) : increment(0),
        updatedAt: currentDate
      });
      
      // Actualizar estado local
      setMembership({ 
        isMember: true, 
        role: isAppAdmin ? 'admin' : 'member',
        joinedAt: currentDate
      });
      
      if (fishtank) {
        setFishtank({
          ...fishtank,
          memberCount: fishtank.memberCount + 1,
          adminCount: isAppAdmin ? (fishtank.adminCount + 1) : fishtank.adminCount,
          updatedAt: currentDate
        });
      }
      
      setHasAccess(true);
      
      Alert.alert("Éxito", "Te has unido a la pecera");
    } catch (error) {
      console.error("Error joining fishtank:", error);
      Alert.alert("Error", "No se pudo unir a la pecera");
    } finally {
      setLoadingAction(false);
    }
  };

  const leaveFishtank = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        Alert.alert("Error", "Debes iniciar sesión");
        return;
      }
      
      setLoadingAction(true);
      
      const membershipQuery = query(
        collection(db, "fishtank_members"),
        where("fishtankId", "==", id),
        where("userId", "==", currentUser.uid)
      );
      
      const membershipSnap = await getDocs(membershipQuery);
      
      if (membershipSnap.empty) {
        Alert.alert("Error", "No eres miembro de esta pecera");
        return;
      }
      
      const member = membershipSnap.docs[0].data();
      
      if (member.role === 'admin') {
        const adminsQuery = query(
          collection(db, "fishtank_members"),
          where("fishtankId", "==", id),
          where("role", "==", "admin")
        );
        
        const adminsSnap = await getDocs(adminsQuery);
        
        if (adminsSnap.size === 1) {
          Alert.alert(
            "Error", 
            "Eres el único administrador. Asigna otro admin antes de salir."
          );
          return;
        }
      }
      
      await deleteDoc(membershipSnap.docs[0].ref);
      
      const currentDate = new Date().toISOString();
      const fishtankRef = doc(db, "fishtanks", id as string);
      await updateDoc(fishtankRef, {
        memberCount: increment(-1),
        updatedAt: currentDate
      });
      
      setMembership({ isMember: false, role: null });
      
      if (fishtank) {
        setFishtank({
          ...fishtank,
          memberCount: Math.max(0, fishtank.memberCount - 1),
          updatedAt: currentDate
        });
      }
      
      if (fishtank?.isPrivate) {
        setHasAccess(false);
      }

      // Eliminar la solicitud aceptada si existe
      const requestsQuery = query(
        collection(db, "fishtank_join_requests"),
        where("fishtankId", "==", id),
        where("userId", "==", currentUser.uid),
        where("status", "==", "accepted")
      );
      const requestDocs = await getDocs(requestsQuery);
      for (const docSnap of requestDocs.docs) {
        await deleteDoc(docSnap.ref);
      }
      
      Alert.alert("Éxito", "Has abandonado la pecera correctamente");
    } catch (error) {
      console.error("Error leaving fishtank:", error);
      Alert.alert("Error", "No se pudo abandonar la pecera");
    } finally {
      setLoadingAction(false);
    }
  };

  // Componente mejorado para mostrar el estado de la solicitud
  const RequestStatusView = () => {
    if (!joinRequest) return null;

    const getStatusInfo = () => {
      switch (joinRequest.status) {
        case 'pending':
          return {
            icon: 'clock' as const,
            color: '#FFC107',
            text: 'Solicitud pendiente'
          };
        case 'accepted':
          return {
            icon: 'check-circle' as const,
            color: '#30D158',
            text: 'Solicitud aceptada'
          };
        case 'rejected':
          return {
            icon: 'x-circle' as const,
            color: '#FF3B30',
            text: 'Solicitud rechazada'
          };
        default:
          return {
            icon: 'clock' as const,
            color: '#FFC107',
            text: 'Solicitud pendiente'
          };
      }
    };

    const statusInfo = getStatusInfo();

    return (
      <View style={styles.pendingRequestContainer}>
        <Feather 
          name={statusInfo.icon}
          size={24} 
          color={statusInfo.color}
          style={styles.pendingRequestIcon} 
        />
        <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
          <Text style={[styles.pendingRequestText, { color: statusInfo.color }]}>
            {statusInfo.text}
          </Text>
        </View>
      </View>
    );
  };

  // Componente para la vista de pecera privada con opción de solicitar acceso
  const PrivateAccessView = () => {
    return (
      <View style={styles.privateAccessContainer}>
        <View style={styles.privateBannerContainer}>
          <Feather name="lock" size={48} color="#FFFFFF" />
          <Text style={styles.privateBannerTitle}>Pecera Privada</Text>
          <Text style={styles.privateBannerDescription}>
            Esta pecera es privada y requiere aprobación del administrador para unirse.
          </Text>
        </View>
        
        {fishtank && (
          <View style={styles.privateInfoContainer}>
            <View style={styles.privateInfoRow}>
              <Text style={styles.privateInfoLabel}>Nombre:</Text>
              <Text style={styles.privateInfoValue}>{fishtank.name}</Text>
            </View>
            
            {creator && (
              <View style={styles.privateInfoRow}>
                <Text style={styles.privateInfoLabel}>Creador:</Text>
                <Text style={styles.privateInfoValue}>@{creator.username}</Text>
              </View>
            )}
            
            <View style={styles.privateInfoRow}>
              <Text style={styles.privateInfoLabel}>Miembros:</Text>
              <Text style={styles.privateInfoValue}>{fishtank.memberCount}</Text>
            </View>
            
            {fishtank.description && (
              <View style={styles.privateInfoDescription}>
                <Text style={styles.privateInfoLabel}>Descripción:</Text>
                <Text style={styles.privateInfoValue}>{fishtank.description}</Text>
              </View>
            )}
          </View>
        )}
        
        <View style={styles.privateActionsContainer}>
          {joinRequest ? (
            <View>
              <RequestStatusView />
              {joinRequest.status === "rejected" && (
                <TouchableOpacity
                  style={styles.retryRequestButton}
                  onPress={() => router.push(`/(drawer)/(tabs)/stackfishtanks/request-join?id=${id}`)}
                  disabled={loadingAction}
                >
                  <Feather name="refresh-cw" size={20} color="#FFFFFF" style={styles.retryRequestIcon} />
                  <Text style={styles.retryRequestText}>Volver a solicitar</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <TouchableOpacity
              style={styles.requestAccessButton}
              onPress={() => router.push(`/(drawer)/(tabs)/stackfishtanks/request-join?id=${id}`)}
              disabled={loadingAction}
            >
              {loadingAction ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="send" size={20} color="#FFFFFF" style={styles.requestAccessIcon} />
                  <Text style={styles.requestAccessText}>Solicitar unirse</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Feather name="arrow-left" size={20} color="#FFFFFF" style={styles.backButtonIcon} />
            <Text style={styles.backButtonText}>Volver a la lista</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderPosts = () => {
    if (loadingPosts) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A6FFF" />
        </View>
      );
    }
    if (posts.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Feather name="message-circle" size={64} color="#8E8E93" />
          <Text style={styles.emptyText}>No hay publicaciones en esta pecera</Text>
          {membership.isMember ? (
            <Text style={styles.emptySubtext}>¡Sé el primero en publicar algo!</Text>
          ) : (
            <Text style={styles.emptySubtext}>Únete a esta pecera para poder publicar</Text>
          )}
        </View>
      );
    }
    return (
      <View style={styles.postsListContainer}>
        {posts.map((item) => (
          <PostItem
            key={item.post.id}
            user={item.user}
            post={item.post}
            currentUserId={authUser?.uid || ""}
          />
        ))}
      </View>
    );
  };

  const Content = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A6FFF" />
        </View>
      );
    }

    if (!fishtank) {
      return (
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={64} color="#FF3B30" />
          <Text style={styles.errorText}>No se pudo cargar la pecera</Text>
          <TouchableOpacity style={styles.backToListButton} onPress={handleBack}>
            <Text style={styles.backToListText}>Volver a la lista</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    // Si la pecera es privada y el usuario no tiene acceso y NO es admin de la app, mostrar vista de solicitud
    if (fishtank.isPrivate && !hasAccess && !isAppAdmin) {
      return <PrivateAccessView />;
    }

    return (
      <ScrollView style={styles.contentContainer}>
        <View style={styles.headerContainer}>
          {/* Mostramos la imagen de la pecera si existe, de lo contrario mostramos un placeholder */}
          {fishtank.fishTankPicture ? (
            <Image 
              source={{ uri: fishtank.fishTankPicture }}
              style={styles.fishtankImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.fishtankImagePlaceholder}>
              <Feather name="image" size={48} color="#8E8E93" />
            </View>
          )}
          
          <View style={styles.fishtankInfo}>
            <View style={styles.fishtankHeader}>
              <Text style={styles.fishtankName}>{fishtank.name}</Text>
              
              {!membership.isMember ? (
                !fishtank.isPrivate || isAppAdmin ? (
                  <TouchableOpacity 
                    style={styles.joinButton}
                    onPress={joinFishtank}
                    disabled={loadingAction}
                  >
                    {loadingAction ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.joinButtonText}>Unirse</Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <View style={styles.privateBadgeSmall}>
                    <Feather name="lock" size={14} color="#FFFFFF" style={styles.privacyIcon} />
                    <Text style={styles.privateBadgeText}>Privada</Text>
                  </View>
                )
              ) : (
                <View style={styles.membershipContainer}>
                  <Text style={styles.roleBadge}>
                    {membership.role === 'admin' 
                      ? 'Administrador' 
                      : membership.role === 'moderator' 
                        ? 'Moderador' 
                        : 'Miembro'}
                  </Text>
                  <TouchableOpacity
                    style={styles.leaveButton}
                    onPress={leaveFishtank}
                    disabled={loadingAction}
                  >
                    {loadingAction ? (
                      <ActivityIndicator size="small" color="#FF3B30" />
                    ) : (
                      <Text style={styles.leaveButtonText}>Abandonar</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
            
            {fishtank.description && (
              <Text style={styles.fishtankDescription}>{fishtank.description}</Text>
            )}
            
            <View style={styles.fishtankStats}>
              <Text style={styles.statText}>
                {fishtank.memberCount} miembro{fishtank.memberCount !== 1 ? 's' : ''}
              </Text>
              {creator && (
                <Text style={styles.statText}>
                  Creada por {creator.username}
                </Text>
              )}
            </View>

            <View style={styles.actionButtonsContainer}>
              <TouchableOpacity 
                style={[styles.actionButton, styles.viewMembersButton]}
                onPress={() => router.push(`/(drawer)/(tabs)/stackfishtanks/members?id=${id}`)}
              >
                <Feather name="users" size={20} color="#FFFFFF" style={styles.actionButtonIcon} />
                <Text style={styles.actionButtonText}>Ver miembros</Text>
              </TouchableOpacity>

              {membership.isMember && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.requestsButton]}
                  onPress={() => router.push(`/(drawer)/(tabs)/stackfishtanks/requests?id=${id}`)}
                >
                  <Feather name="inbox" size={20} color="#FFFFFF" style={styles.actionButtonIcon} />
                  <Text style={styles.actionButtonText}>
                    {fishtank.pendingCount > 0 ? `${fishtank.pendingCount} solicitud${fishtank.pendingCount !== 1 ? 'es' : ''}` : 'Solicitudes'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.privacyBadgeContainer}>
              <View style={[
                styles.privacyBadge, 
                fishtank.isPrivate ? styles.privateBadge : styles.publicBadge
              ]}>
                <Feather 
                  name={fishtank.isPrivate ? "lock" : "globe"} 
                  size={14} 
                  color="#FFFFFF" 
                  style={styles.privacyIcon} 
                />
                <Text style={styles.privacyText}>
                  {fishtank.isPrivate ? "Pecera Privada" : "Pecera Pública"}
                </Text>
              </View>
            </View>
          </View>

          {/* Botón para crear post, solo para miembros */}
          {membership.isMember && (
            <TouchableOpacity
              style={styles.createPostButton}
              onPress={() => router.push(`/(drawer)/(tabs)/stackfishtanks/create-post?id=${id}`)}
            >
              <Feather name="plus-circle" size={20} color="#FFFFFF" style={styles.createPostIcon} />
              <Text style={styles.createPostText}>Crear publicación</Text>
            </TouchableOpacity>
          )}

          {/* Lista de posts */}
          <View style={styles.postsHeaderContainer}>
            <Text style={styles.postsHeaderText}>Publicaciones</Text>
          </View>
          {renderPosts()}
        </View>
      </ScrollView>
    );
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      // Recargar datos de la pecera
      if (id) {
        const fishtankDoc = await getDoc(doc(db, "fishtanks", id as string))
        if (fishtankDoc.exists()) {
          setFishtank({ id: fishtankDoc.id, ...fishtankDoc.data() } as FishTank)
        }

        // Recargar posts
        const postsQuery = query(
          collection(db, "fishtank_posts"),
          where("fishtankId", "==", id),
          orderBy("createdAt", "desc")
        )
        const snapshot = await getDocs(postsQuery)
        const fetchedPosts: Post[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Post[]

        // Obtener usuarios autores
        const userIds = Array.from(new Set(fetchedPosts.map((p) => p.authorId)))
        const usersMap: Record<string, User> = {}
        await Promise.all(userIds.map(async (uid) => {
          try {
            const userSnap = await getDoc(doc(db, "users", uid))
            if (userSnap.exists()) {
              usersMap[uid] = { id: uid, ...userSnap.data() } as User
            }
          } catch (e) { /* ignorar error individual */ }
        }))

        const postsWithUser: PostWithUser[] = fetchedPosts.map((post) => ({
          post,
          user: usersMap[post.authorId] || { id: post.authorId, username: "Usuario", name: "", lastName: "", email: "", isOnline: false, isVerified: false, preferences: { oceanMode: false, privacyMode: false }, followerCount: 0, followingCount: 0, notificationCount: 0, createdAt: "", updatedAt: "" }
        }))
        setPosts(postsWithUser)
      }
    } catch (error) {
      console.error("Error refreshing:", error)
      Alert.alert("Error", "No se pudieron actualizar los datos")
    } finally {
      setRefreshing(false)
    }
  }, [id])

  return (
    <>
      <Stack.Screen 
        options={{
          headerShown: true,
          headerTitle: fishtank?.name || "Pecera",
          headerLeft: () => (
            <TouchableOpacity onPress={handleBack}>
              <Feather name="arrow-left" size={24} color="white" />
            </TouchableOpacity>
          ),
        }} 
      />
      
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#2A3142" />
        
        <View style={styles.container}>
          <ScrollView
            style={styles.scrollView}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            <Content />
          </ScrollView>
        </View>
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#2A3142",
  },
  container: {
    flex: 1,
    backgroundColor: "#2A3142",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: "#FFFFFF",
    marginTop: 16,
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: "#8E8E93",
    marginBottom: 24,
    textAlign: "center",
  },
  backToListButton: {
    backgroundColor: "#4A6FFF",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  backToListText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  contentContainer: {
    flex: 1,
    alignSelf: "center",
    width: Platform.OS === 'web' ? "100%":"100%",
    maxWidth: Platform.OS === 'web' ? 800 : "100%",
  },
  headerContainer: {
    backgroundColor: "#2A3142",
  },
  fishtankImage: {
    width: "100%",
    height: 200,
    backgroundColor: "#3A4154",
  },
  fishtankImagePlaceholder: {
    width: "100%",
    height: 200,
    backgroundColor: "#3A4154",
    justifyContent: "center",
    alignItems: "center",
  },
  fishtankInfo: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#3A4154",
  },
  fishtankHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  fishtankName: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#FFFFFF",
    flex: 1,
  },
  joinButton: {
    backgroundColor: "#4A6FFF",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  joinButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  membershipContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  roleBadge: {
    fontSize: 12,
    color: "#8E8E93",
    marginRight: 8,
  },
  leaveButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  leaveButtonText: {
    color: "#FF3B30",
    fontWeight: "500",
  },
  fishtankDescription: {
    fontSize: 16,
    color: "#CCCCCC",
    marginBottom: 16,
  },
  fishtankStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  statText: {
    fontSize: 14,
    color: "#8E8E93",
  },
  privateContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    alignSelf: "center",
    width: Platform.OS === 'web' ? "100%":"100%",
    maxWidth: Platform.OS === 'web' ? 800 : "100%",
  },
  privacyIcon: {
    marginRight: 6,
  },
  privateText: {
    fontSize: 14,
    color: "#8E8E93",
    fontStyle: "italic",
  },
  privacyBadgeContainer: {
    marginTop: 12,
  },
  privacyBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    alignSelf: "flex-start",
  },
  privateBadge: {
    backgroundColor: "#AF52DE", 
  },
  publicBadge: {
    backgroundColor: "#30D158", 
  },
  privacyText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
  },
  postsHeaderContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#3A4154",
  },
  postsHeaderText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: "#8E8E93",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#4A6FFF",
    marginTop: 8,
  },
  privateBadgeSmall: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#AF52DE",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  privateBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "500",
  },
  
  // Estilos para la vista de acceso privado
  privateAccessContainer: {
    flex: 1,
    padding: 20,
    alignSelf: "center",
    width: Platform.OS === 'web' ? "100%":"100%",
    maxWidth: Platform.OS === 'web' ? 800 : "100%",
  },
  privateBannerContainer: {
    backgroundColor: "#3A4154",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    marginVertical: 20,
  },
  privateBannerTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginTop: 16,
    marginBottom: 8,
  },
  privateBannerDescription: {
    fontSize: 16,
    color: "#D1D5DB",
    textAlign: "center",
    lineHeight: 22,
  },
  privateInfoContainer: {
    backgroundColor: "#3A4154",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  privateInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  privateInfoDescription: {
    marginTop: 4,
  },
  privateInfoLabel: {
    fontSize: 16,
    color: "#8E8E93",
    fontWeight: "500",
  },
  privateInfoValue: {
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "500",
  },
  privateActionsContainer: {
    marginTop: 16,
  },
  requestAccessButton: {
    backgroundColor: "#4A6FFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  requestAccessIcon: {
    marginRight: 10,
  },
  requestAccessText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center", 
    backgroundColor: "#3A4154",
    paddingVertical: 14,
    borderRadius: 12,
  },
  backButtonIcon: {
    marginRight: 10,
  },
  backButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "500",
  },
  pendingRequestContainer: {
    backgroundColor: "#3A4154",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  pendingRequestIcon: {
    marginRight: 10,
  },
  pendingRequestText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "500",
  },
  
  // Estilos para el modal de solicitud
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalKeyboardView: {
    width: "100%",
    maxWidth: 400,
  },
  modalContainer: {
    backgroundColor: "#1E293B",
    borderRadius: 10,
    width: "100%",
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  modalCloseButton: {
    padding: 4,
  },
  modalDescription: {
    fontSize: 16,
    color: "#D1D5DB",
    marginBottom: 20,
    lineHeight: 22,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#3A4154",
  },
  confirmButton: {
    backgroundColor: "#4A6FFF",
  },
  modalButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  requestsButton: {
    backgroundColor: "#4A6FFF",
  },
  retryRequestButton: {
    backgroundColor: "#4A6FFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 12,
  },
  retryRequestIcon: {
    marginRight: 10,
  },
  retryRequestText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  viewMembersButton: {
    backgroundColor: "#4A6FFF",
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    paddingHorizontal: 16,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4A6FFF",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    flex: 1,
    minWidth: 160,
  },
  actionButtonIcon: {
    marginRight: 8,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  createPostButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4A6FFF",
    paddingVertical: 12,
    borderRadius: 20,
    marginVertical: 12,
  },
  createPostIcon: {
    marginRight: 8,
  },
  createPostText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  postsListContainer: {
    marginTop: 8,
    marginBottom: 24,
  },
  postCard: {
    backgroundColor: "#3A4154",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  postContent: {
    color: "#FFFFFF",
    fontSize: 16,
    marginBottom: 8,
  },
  postMeta: {
    color: "#8E8E93",
    fontSize: 12,
    textAlign: "right",
  },
  scrollView: {
    flex: 1,
  },
});

export default FishtankDetailScreen