import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore"
import { db } from "../config/Firebase_Conf"
import type { Notification, NotificationType, User } from "../app/types/types"

/**
 * Verifica si el usuario tiene las notificaciones habilitadas
 * @param userId ID del usuario
 */
async function checkUserNotificationsEnabled(userId: string): Promise<boolean> {
  try {
    const userRef = doc(db, "users", userId)
    const userDoc = await getDoc(userRef)
    
    if (!userDoc.exists()) {
      console.log(`Usuario ${userId} no existe - permitiendo notificaciones por defecto`)
      return true // Si no existe el usuario, permitir por defecto
    }
    
    const userData = userDoc.data()
    console.log(`Estado de notificaciones para usuario ${userId}:`, userData.notificationsEnabled)
    
    // Si el campo existe y es false, retornar false
    if (userData.notificationsEnabled === false) {
      console.log(`Notificaciones deshabilitadas para usuario ${userId}`)
      return false
    }
    
    // Si el campo no existe o es true, retornar true
    console.log(`Notificaciones habilitadas para usuario ${userId}`)
    return true
  } catch (error) {
    console.error("Error al verificar configuración de notificaciones:", error)
    return true // Por defecto, permitir notificaciones en caso de error
  }
}

/**
 * Crea una nueva notificación en Firestore
 * @param recipientId ID del usuario que recibirá la notificación
 * @param type Tipo de notificación
 * @param content Texto de la notificación
 * @param triggeredBy ID del usuario que generó la notificación
 * @param targetPostId ID del post relacionado (opcional)
 * @param targetCommentId ID del comentario relacionado (opcional)
 * @param pathname Ruta a la que redirigir (opcional)
 * @param params Parámetros adicionales para la ruta (opcional)
 */
export async function createNotification(
  recipientId: string,
  type: NotificationType,
  content: string,
  triggeredBy: string,
  targetPostId?: string,
  targetCommentId?: string,
  pathname?: string,
  params?: Record<string, any>,
): Promise<string | null> {
  try {
    // No crear notificación si el usuario se notifica a sí mismo
    if (recipientId === triggeredBy) {
      console.log(`No se crea notificación: usuario ${triggeredBy} se notifica a sí mismo`)
      return null
    }

    // Verificar si el usuario tiene las notificaciones habilitadas
    const notificationsEnabled = await checkUserNotificationsEnabled(recipientId)
    
    if (!notificationsEnabled) {
      console.log(`Notificaciones deshabilitadas para el usuario ${recipientId}`)
      return null
    }

    console.log(`Creando notificación para usuario ${recipientId} - Notificaciones habilitadas: ${notificationsEnabled}`)

    // Crear objeto de notificación según el tipo definido
    const notificationId = `notification_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    const notification: Notification = {
      id: notificationId,
      recipientId,
      type,
      content,
      triggeredBy,
      createdAt: new Date().toISOString(),
      isRead: false,
    }

    // Añadir campos opcionales si están presentes
    if (targetPostId) notification.targetPostId = targetPostId
    if (targetCommentId) notification.targetCommentId = targetCommentId
    if (pathname) notification.pathname = pathname
    if (params) notification.params = params

    // Guardar la notificación en Firestore
    await setDoc(doc(db, "notifications", notificationId), notification)

    // Actualizar el contador de notificaciones del usuario
    const userRef = doc(db, "users", recipientId)
    const userDoc = await getDoc(userRef)

    if (userDoc.exists()) {
      const userData = userDoc.data() as User
      await updateDoc(userRef, {
        notificationCount: (userData.notificationCount || 0) + 1,
      })
    }

    // Enviar notificación push si es posible
    await sendPushNotificationToUser(recipientId, type, content, {
      type,
      targetPostId,
      triggeredBy,
      pathname,
      params,
    })

    return notificationId
  } catch (error) {
    console.error("Error al crear notificación:", error)
    return null
  }
}

/**
 * Marca una notificación como leída
 * @param notificationId ID de la notificación
 */
export async function markNotificationAsRead(notificationId: string): Promise<boolean> {
  try {
    const notificationRef = doc(db, "notifications", notificationId)
    await updateDoc(notificationRef, {
      isRead: true,
    })
    return true
  } catch (error) {
    console.error("Error al marcar notificación como leída:", error)
    return false
  }
}

/**
 * Marca todas las notificaciones de un usuario como leídas
 * @param userId ID del usuario
 */
export async function markAllNotificationsAsRead(userId: string): Promise<boolean> {
  try {
    const notificationsQuery = query(
      collection(db, "notifications"),
      where("recipientId", "==", userId),
      where("isRead", "==", false),
    )

    const snapshot = await getDocs(notificationsQuery)

    const batch = snapshot.docs.map((doc) => updateDoc(doc.ref, { isRead: true }))

    await Promise.all(batch)

    // Actualizar el contador de notificaciones del usuario
    const userRef = doc(db, "users", userId)
    await updateDoc(userRef, {
      notificationCount: 0,
    })

    return true
  } catch (error) {
    console.error("Error al marcar todas las notificaciones como leídas:", error)
    return false
  }
}

/**
 * Obtiene el número de notificaciones no leídas de un usuario
 * @param userId ID del usuario
 */
export async function getUnreadNotificationsCount(userId: string): Promise<number> {
  try {
    const notificationsQuery = query(
      collection(db, "notifications"),
      where("recipientId", "==", userId),
      where("isRead", "==", false),
    )

    const snapshot = await getDocs(notificationsQuery)
    return snapshot.size
  } catch (error) {
    console.error("Error al obtener conteo de notificaciones:", error)
    return 0
  }
}

/**
 * Envía una notificación push a un usuario
 * @param userId ID del usuario destinatario
 * @param type Tipo de notificación
 * @param body Texto de la notificación
 * @param data Datos adicionales para la notificación
 */
async function sendPushNotificationToUser(
  userId: string,
  type: NotificationType,
  body: string,
  data: Record<string, any> = {},
): Promise<void> {
  try {
    // Primero verificar si el usuario tiene las notificaciones habilitadas
    const notificationsEnabled = await checkUserNotificationsEnabled(userId)
    
    if (!notificationsEnabled) {
      console.log(`Notificaciones deshabilitadas para el usuario ${userId}`)
      return
    }

    // Obtener tokens de push del usuario
    const userRef = doc(db, "users", userId)
    const userDoc = await getDoc(userRef)

    if (!userDoc.exists()) return

    const userData = userDoc.data() as User
    const expoPushTokens = userData.expoPushTokens || []

    if (expoPushTokens.length === 0) return

    // Determinar el título según el tipo de notificación
    let title = "Nueva notificación"

    switch (type) {
      case "Comment":
        title = "Nuevo comentario"
        break
      case "Fish":
        title = "Nueva reacción: Fish"
        break
      case "Bait":
        title = "Nueva reacción: Bait"
        break
      case "Follow":
        title = "Nuevo seguidor"
        break
      case "Post":
        title = "Nueva publicación"
        break
      case "Wave":
        title = "Nuevo wave"
        break
    }

    // Enviar notificación a través de Expo
    await sendPushNotification(expoPushTokens, title, body, data)
  } catch (error) {
    console.error("Error al enviar notificación push:", error)
  }
}

/**
 * Envía notificaciones push a través de la API de Expo
 * @param expoPushTokens Array de tokens de Expo
 * @param title Título de la notificación
 * @param body Texto de la notificación
 * @param data Datos adicionales para la notificación
 */
async function sendPushNotification(
  expoPushTokens: string[],
  title: string,
  body: string,
  data: Record<string, any> = {},
): Promise<void> {
  if (!expoPushTokens || expoPushTokens.length === 0) {
    console.log("No hay tokens para enviar notificaciones")
    return
  }

  try {
    const messages = expoPushTokens.map((token) => ({
      to: token,
      sound: "default",
      title,
      body,
      data,
    }))

    const chunks = []
    const chunkSize = 100

    for (let i = 0; i < messages.length; i += chunkSize) {
      chunks.push(messages.slice(i, i + chunkSize))
    }

    for (const chunk of chunks) {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chunk.length > 1 ? chunk : chunk[0]),
      })

      const responseData = await response.json()
      console.log("Notificación push enviada:", responseData)
    }
  } catch (error) {
    console.error("Error al enviar notificación push:", error)
  }
}