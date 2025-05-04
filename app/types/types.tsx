// ——————————————————————————————————————————————————
// 1) Preferencias del usuario
// ——————————————————————————————————————————————————
export interface Preferences {
  oceanMode: boolean   // Activa el modo oceánico (estética/visual)
  privacyMode: boolean // Activa el modo privacidad (oculta datos sensibles)
}

// ——————————————————————————————————————————————————
// 2) Tipos de notificación disponibles
// ——————————————————————————————————————————————————
export type NotificationType =
  | "Post"    // Notificación relacionada a un nuevo post
  | "Comment" // Notificación de un nuevo comentario
  | "Fish"    // Notificación de una reacción “fish”
  | "Follow"  // Notificación de un nuevo seguidor
  | "Wave"    // Notificación de un repost (“wave”)
  | "Bait"    // Notificación de una reacción “bait”

// ——————————————————————————————————————————————————
// 3) Notificaciones (colección global)
// ——————————————————————————————————————————————————
export interface Notification {
  id: string                 // ID único de la notificación (doc ID)
  recipientId: string        // ID del usuario que recibe la notificación
  type: NotificationType     // Tipo de notificación
  content: string            // Texto o mensaje de la notificación
  triggeredBy: string        // ID del usuario que generó la notificación
  targetPostId?: string      // ID del post relacionado (si aplica)
  targetCommentId?: string   // ID del comentario relacionado (si aplica)
  pathname?: string          // Ruta a la que redirige al clicar
  params?: Record<string, any> // Parámetros extra para la ruta
  createdAt: string          // Fecha de creación en ISO
  isRead: boolean            // Marca si ya ha sido leída
}

// ——————————————————————————————————————————————————
// 4) Usuarios
// ——————————————————————————————————————————————————
export interface User {
  id: string                 // ID único del usuario (doc ID)
  name: string               // Nombre(s) del usuario
  lastName: string           // Apellidos del usuario
  username: string           // Nombre de usuario público
  email: string              // Correo electrónico
  cellphone?: string         // Teléfono celular (opcional)
  birthdate?: string         // Fecha de nacimiento (ISO, opcional)
  city?: string              // Ciudad de residencia (opcional)
  state?: string             // Estado/provincia (opcional)
  country?: string           // País (opcional)
  gender?: "male" | "female" | "other" // Género (opcional)
  profilePicture?: string    // URL de la foto de perfil (opcional)
  bio?: string               // Biografía breve (opcional)
  isAdmin?: boolean          // Si el usuario es administrador (opcional)
  tags?: string[]            // Etiquetas/intereses (opcional)
  expoPushTokens?: string[]  // Tokens de Expo Push (opcional)
  isOnline: boolean          // Estado de conexión en tiempo real
  isVerified: boolean        // Usuario verificado o no
  preferences: Preferences   // Preferencias de visualización
  followerCount: number      // Cantidad de seguidores
  followingCount: number     // Cantidad de usuarios seguidos
  notificationCount: number  // Cantidad de notificaciones no leídas
  createdAt: string          // Fecha de creación en ISO
  updatedAt: string          // Fecha de última actualización en ISO
}

// ——————————————————————————————————————————————————
// 5) Posts
// ——————————————————————————————————————————————————
export interface Post {
  id: string                 // ID único del post (doc ID)
  authorId: string           // ID del usuario autor
  content?: string           // Texto del post (opcional)
  media?: string[]           // URLs de imágenes/videos (opcional)
  tags?: string[]            // Etiquetas del post (opcional)
  isWave: boolean            // Indica si es un “wave” (repost)
  waveOf?: string            // ID del post original en caso de repost
  commentCount: number       // Número total de comentarios
  reactionCounts: {          // Conteo de reacciones por tipo
    bait: number             // Reacciones “bait”
    fish: number             // Reacciones “fish”
    wave: number             // Reactions “wave”
  }
  createdAt: string          // Fecha de creación en ISO
  updatedAt: string          // Fecha de última edición en ISO
}

// ——————————————————————————————————————————————————
// 6) Comentarios (colección global)
// ——————————————————————————————————————————————————
export interface Comment {
  id: string                 // ID único del comentario (doc ID)
  postId: string             // ID del post al que pertenece
  authorId: string           // ID del usuario que comenta
  content: string            // Texto del comentario
  createdAt: string          // Fecha de creación en ISO
  updatedAt?: string         // Fecha de edición (ISO, opcional)
}

// ——————————————————————————————————————————————————
// 7) Tipos de reacción disponibles
// ——————————————————————————————————————————————————
export type ReactionType = "Bait" | "Fish" | "Wave" // Tres tipos de reacciones

// ——————————————————————————————————————————————————
// 8) Reacciones (colección global)
// ——————————————————————————————————————————————————
export interface Reaction {
  id: string                 // ID único de la reacción (doc ID)
  postId: string             // ID del post reaccionado
  userId: string             // ID del usuario que reaccionó
  type: ReactionType         // Tipo de reacción aplicada
  createdAt: string          // Fecha de creación en ISO
}

// ——————————————————————————————————————————————————
// 9) Peceras / Comunidades
// ——————————————————————————————————————————————————
export interface FishTank {
  id: string                 // ID único de la pecera (doc ID)
  name: string               // Nombre de la comunidad
  description?: string       // Descripción breve (opcional)
  about?: string             // Información adicional (opcional)
  fishTankPicture?: string   // URL de la imagen de la pecera (opcional)
  tags?: string[]            // Etiquetas asociadas (opcional)
  isPrivate: boolean         // Si la comunidad es privada
  isVerified: boolean        // Verificación oficial de la comunidad
  creatorId: string          // ID del usuario creador
  memberCount: number        // Cantidad de miembros activos
  pendingCount: number       // Solicitudes de unión pendientes
  adminCount: number         // Número de administradores
  createdAt: string          // Fecha de creación en ISO
  updatedAt: string          // Fecha de última modificación en ISO
}

// ——————————————————————————————————————————————————
// 10) Roles para miembros de pecera
// ——————————————————————————————————————————————————
export type FishTankMemberRole = "member" | "pending" | "admin" 
// "member": miembro aprobado
// "pending": solicitud en espera
// "admin": administrador de la pecera

// ——————————————————————————————————————————————————
// 11) Miembros de pecera (colección global)
// ——————————————————————————————————————————————————
export interface FishTankMember {
  id: string                 // ID único del documento (doc ID)
  fishTankId: string         // ID de la pecera asociada
  userId: string             // ID del usuario miembro
  role: FishTankMemberRole   // Rol asignado en la pecera
  timestamp: string          // Fecha de acción (ISO): unión, petición o promoción
}

// ——————————————————————————————————————————————————
// 12) Posts guardados (colección global)
// ——————————————————————————————————————————————————
export interface SavedPost {
  id: string        // ID único del documento (doc ID)
  userId: string    // ID del usuario que guardó el post
  postId: string    // ID del post guardado
  savedAt: string   // Fecha de guardado en ISO
  deleted: boolean  // Si ha sido eliminado/quitado de guardados
}

// ——————————————————————————————————————————————————
// 13) Historial de búsquedas es para cada usuario buscado o cualquier termino (es es un array con maps que se guarda dentro de usuarios)
// ——————————————————————————————————————————————————
export interface RecentSearches {
  userId: string             // ID del usuario si se entra a un usuario de una entonces se guarda este
  searchTerm: string         // Término de búsqueda | esto si no se busca a un usuario de una, y entonces hace una busqueda más general
  timestamp: string          // Fecha de búsqueda en ISO
}