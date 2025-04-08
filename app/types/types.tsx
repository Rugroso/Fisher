// Comentarios dentro de un post
export type PostComment = {
  commentId: string           // ID único del comentario
  content: string             // Texto del comentario
  created_at: string          // Fecha de creación (formato legible o ISO)
  updated_at: string          // Fecha de última edición
  userId: string              // ID del usuario que hizo el comentario
}

// Comentarios del usuario en otros posts
export type UserComment = {
  postId: string              // ID del post comentado
  commentId: string           // ID del comentario realizado
}

// Preferencias del usuario
export type Preferences = {
  isOceanMode: boolean        // Activación del modo oceánico (estética o visual)
  isPrivacyMode: boolean      // Modo privacidad activado o no
}

type NotificationType = 
  | "Post"
  | "Comment"
  | "Fish"
  | "Follow"
  | "Wave"
  | "Bait"
// Notifiaciones del usuario
export type Notification = {
  notificationId: string
  type: NotificationType      // Tipo de notificación (ej. "nuevo comentario", "nuevo seguidor")
                              //Se aceptan los siguientes tipos:
                                  //Post: donde se usan los campos de postId y userId
                                  //Comment: donde se usan los campos de commentId, postId y userId
                                  //Fish: donde se usan los campos de postId y userId
                                  //Follow: donde se usan los campos de userId
                                  //Wave: donde se usan los campos de postId y userId
                                  //Bait: donde se usan los campos de postId y userId
                                  //Fish: donde se usan los campos de postId y userId
  content: string             // Contenido de la notificación
  created_at: string          // Fecha en formato legible o ISO
  isRead: boolean             // Estado de lectura
  triggeredByUserId: string   // ID del usuario que generó la notificación
  postId?: string             // ID del post relacionado (opcional) - Depende del tipo
  commentId?: string          // ID del comentario relacionado (opcional)  //Depende del tipo
  pathname?: string           // Ruta a la que se redirige al usuario al hacer clic en la notificación
  params?: string             // Parámetros adicionales para la redirección
}

// Tipo general del usuario
export type User = {
  baits: {
    postId: string[]            // Post donde este usuario puso un "bait"
  }
  birthdate: string          // Fecha de nacimiento
  comments: UserComment[]     // Lista de comentarios hechos en otros posts
  email: string               // Correo del usuario
  city: string              // Ciudad del usuario
  state: string              // Estado del usuario
  country: string             // País del usuario
  cellphone: string           // Teléfono celular del usuario
  fishTankId: string[]        // IDs de peceras asociadas al usuario
  fishes: {
    postId: string[]            // Posts donde este usuario puso un "fish"
  }
  followers: {
    userId: string[]          // ID de usuarios que siguen a este usuario
  }      
  following: {
    userId: string[]            // ID de usuarios que este usuario sigue
  }
  gender: string              // Género del usuario
  name: string                // Nombre del usuario
  lastName: string            // Apellidos del usuario
  postsId: string[]           // Lista de IDs de posts creados por el usuario
  preferences: Preferences    // Preferencias personalizadas del usuario
  profilePicture: string      // URL de la imagen de perfil
  tags: string[]              // Etiquetas personales o intereses
  userId: string              // ID único del usuario
  username: string            // Nombre de usuario
  waves: {
    postId: string[]          // Post donde este usuario hizo una "wave"
  }
  expoPushTokens: string[] // Tokens de notificaciones push para Expo sera muy util para las notificaciones que en general pueda recibir el usuario --PENDIENTE
  isOnline: boolean           // Estado de conexión del usuario -- PENDIENTE
  isVerified: boolean         // Estado de verificación del usuario -- PENDITENTE
  notifications: Notification[] // Notificaciones del usuario
  created_at: string         // Fecha de creación (formato legible o ISO)
  updated_at: string         // Fecha de última edición
}

// Tipo de post
export type Post = {
  baits: {
    userId: string[]          // Usuarios que pusieron un "bait" en este post
  }
  comments: PostComment[]     // Comentarios en el post
  content: string | null            // Texto del post
  fishes: {
    userId: string[]          // Usuarios que reaccionaron con "fish"
  }
  media: string[]             // URL del recurso multimedia del post | Imagenes o Videos
  created_at: string         // Fecha de creación (formato legible o ISO)
  updated_at: string         // Fecha de última edición
  postId: string              // ID único del post
  tags: string[]              // Etiquetas del post
  userId: string              // ID del usuario que creó el post
  waves: {
    userId: string[]          // Usuarios que interactuaron con "wave"
  }
  isWave: boolean          // Indica si el post es una "wave" es decir, un "retweet" o "repost" esto afecta su visualización
  postWaveId: string | null // ID del post original si es una "wave"
}

export type fishTank = {
  members: {
    userld: string[]
  }
  postsld: string[] // Posts que pertenecen a la pecera
  fishTankPicture: string // URL de la imagen de la pecera
  tags: string[] // Etiquetas de la pecera
  fishTankId: string // ID de la comunidad a la que pertenece la pecera
  fishTankName: string // Nombre de la pecera
  isVerified: boolean //  Estado de verificación de la pecera
  created_at: string // Fecha de creación (formato legible o ISO)
  updated_at: string // Fecha de última edición
  creatorUserId: string // ID del usuario que creó la pecera
  fishTankDescription: string // Descripción de la pecera
  about: string // Información adicional sobre la pecera
  rules: string[] // Reglas de la pecera
  isPrivate: boolean // Indica si la pecera es privada o pública
  admins: {
    userId: string[] // ID de los administradores de la pecera
  }
  pendingMembers: {
    userId: string[] // ID de los usuarios que han solicitado unirse a la pecera 
  }
}
// Tipo para el item combinado de usuario y post
export type PostItem = {
  user: User                  // Información del autor del post
  post: Post                  // Información del post en sí
  key: string                 // Clave única para renderizado en la aplicación
}