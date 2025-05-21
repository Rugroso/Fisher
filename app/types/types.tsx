// ——————————————————————————————————————————————————
// 1) Preferencias del usuari
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
  | "Fish"    // Notificación de una reacción "fish"
  | "Follow"  // Notificación de un nuevo seguidor
  | "Wave"    // Notificación de un repost ("wave")
  | "Bait"    // Notificación de una reacción "bait"
  | "Cardumen" // Notificación de un nuevo cardumen

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
  targetCardumenId?: string // ID del cardumen relacionado
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
  notificationsEnabled?: boolean // Si el usuario tiene habilitadas las notificaciones (opcional)
  isOnline: boolean          // Estado de conexión en tiempo real
  isVerified: boolean        // Usuario verificado o no
  preferences: Preferences   // Preferencias de visualización
  followerCount: number      // Cantidad de seguidores
  followingCount: number     // Cantidad de usuarios seguidos
  notificationCount: number  // Cantidad de notificaciones no leídas
   cardumenesCreated?: string[] // IDs de cardúmenes creados por el usuario
  cardumenesMember?: string[] // IDs de cardúmenes a los que pertenece el usuario
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
  isWave: boolean            // Indica si es un "wave" (repost)
  waveOf?: string            // ID del post original en caso de repost
  commentCount: number       // Número total de comentarios
  reactionCounts: {          // Conteo de reacciones por tipo
    bait: number             // Reacciones "bait"
    fish: number             // Reacciones "fish"
    wave: number             // Reactions "wave"
  }
  deleted: boolean           // Marca si el post ha sido eliminado
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
  id: string;
  name: string;
  description?: string;
  isPrivate: boolean;
  creatorId: string;
  memberCount: number;
  pendingCount: number;
  fishTankPicture?: string;
  createdAt: string;
  updatedAt: string;
}

// ——————————————————————————————————————————————————
// 10) Roles para miembros de pecera
// ——————————————————————————————————————————————————
export type FishTankMemberRole = "member" | "pending" | "admin" | "moderator"
// "member": miembro aprobado
// "pending": solicitud en espera
// "moderator": moderador de la pecera
// "admin": administrador de la pecera

// ——————————————————————————————————————————————————
// 11) Miembros de pecera (colección global)
// ——————————————————————————————————————————————————
export interface FishTankMember {
  id: string                 // ID único del documento (doc ID)
  fishTankId: string         // ID de la pecera asociada
  userId: string             // ID del usuario miembro
  role: FishTankMemberRole   // Rol asignado en la pecera
  joinedAt: string           // Fecha de unión en ISO
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
// ——————————————————————————————————————————————————
// 14) Rutas de navegación
// ——————————————————————————————————————————————————
export type SettingsRoutes = 
  | '/stacksettings/account'        // Pantalla de información de cuenta
  | '/stacksettings/notifications'  // Pantalla de configuración de notificaciones  
  | '/stacksettings/donate'         // Pantalla de donaciones
  | '/stacksettings/edit-profile'   // Pantalla de edición de perfil
  | '/stacksettings/change-password' // Pantalla de cambio de contraseña
  | '/login'                        // Pantalla de inicio de sesión

// ——————————————————————————————————————————————————
// 15) Items del menú de configuración
// ——————————————————————————————————————————————————
export interface SettingsMenuItem {
  title: string       // Título del item del menú
  description: string // Descripción detallada del item
  icon: string       // Nombre del ícono a mostrar (Feather icons)
  onPress: () => void // Función que se ejecuta al presionar
}

// ——————————————————————————————————————————————————
// 16) Contexto de autenticación
// ——————————————————————————————————————————————————
export interface AuthContextType {
  user: User | null           // Usuario actual o null si no está autenticado
  logout: () => Promise<void> // Función para cerrar sesión
  // Otros métodos que puedas tener en tu AuthContext
}

// ——————————————————————————————————————————————————
// 17) Estado del formulario de edición de perfil
// ——————————————————————————————————————————————————
export interface UserEditFormData {
  name: string      // Nombre del usuario
  lastName: string  // Apellido del usuario
  username: string  // Nombre de usuario (generalmente no editable)
  email: string     // Correo electrónico (generalmente no editable)
  cellphone: string // Número de teléfono celular
  gender: string    // Género (como string para manejo de formulario)
  birthdate: string // Fecha de nacimiento en formato string
  city: string      // Ciudad de residencia
  state: string     // Estado o provincia
  country: string   // País
}

// ——————————————————————————————————————————————————
// 18) Seguidores (colección global)
// ——————————————————————————————————————————————————

export interface follows {
  followingId: string             // ID del usuario que sigue
  followerId: string         // ID del usuario seguido
  timestamp: string          // Fecha de seguimiento en ISO
}

// ——————————————————————————————————————————————————
// 19) Reportes (colección global)
// ——————————————————————————————————————————————————

export interface follows {
  authorId: string           // ID del autor del post
  createdAt: string          // Fecha de creación en ISO 
  postId: string             // ID del post al que se le hace el reporte
  reason: string             // Motivo del reporte
  reporterId: string         // ID del usuario que reporta
  status: "pending" | "resolved" // Estado del reporte (pendiente o resuelto)
}
// ——————————————————————————————————————————————————
// 20) Estado de membresía de usuario en una pecera
// ——————————————————————————————————————————————————
export interface FishTankMembership {
  isMember: boolean          // Si el usuario es miembro
  role: FishTankMemberRole | null // Rol del usuario (null si no es miembro)
  joinedAt?: string          // Fecha en que se unió
}

// ——————————————————————————————————————————————————
// 20) Cardúmenes (colección global en realtime database)
// ——————————————————————————————————————————————————
export interface Cardumen {
  id: string // ID único del cardumen
  name: string // Nombre del cardumen
  description: string // Descripción del cardumen
  imageUrl?: string // URL de la imagen del cardumen
  adminId: string // ID del creador/administrador
  createdAt: string // Fecha de creación
  updatedAt?: string // Fecha de última actualización
  memberCount: number // Cantidad de miembros
  isPrivate: boolean // Si es privado, requiere aprobación para unirse
  tags?: string[] // Etiquetas para categorizar el cardumen
  maxMembers: number // Máximo de miembros (por defecto 50)
}

// ——————————————————————————————————————————————————
// 21) Miembros de cardúmenes (colección global en realtime database)
// ——————————————————————————————————————————————————

export interface CardumenMember {
  cardumenId: string // ID del cardumen
  userId: string // ID del usuario
  joinedAt: string // Fecha de unión
  role: "admin" | "member" // Rol en el cardumen
  lastReadMessageId?: string // ID del último mensaje leído
}

// ——————————————————————————————————————————————————
// 22) Mensajes de cardúmenes (colección global en realtime database)
// ——————————————————————————————————————————————————
export interface CardumenMessage {
  id: string // ID único del mensaje
  cardumenId: string // ID del cardumen
  senderId: string // ID del remitente
  senderName?: string // Nombre del remitente
  senderProfilePicture?: string //  URL de la foto de perfil del remitente
  content: string // Texto del mensaje
  media?: string | string[] // URLs de imágenes
  createdAt: string // Fecha de creación en ISO
  type: "text" | "image" | "system" // Tipo de mensaje
  replyTo?: string // ID del mensaje al que responde
}

// ——————————————————————————————————————————————————
// 23) Invitaciones a cardúmenes (colección global en realtime database)
// ——————————————————————————————————————————————————

export interface CardumenJoinRequest {
  id: string
  cardumenId: string
  userId: string
  status: "pending" | "accepted" | "rejected"
  createdAt: string
  message?: string // Mensaje opcional del solicitante
}

// Tipos para usuarios
export interface User {
  id: string;
  username: string;
  profilePicture?: string;
  isAdmin?: boolean;
  createdAt: string;
  updatedAt: string;
}

