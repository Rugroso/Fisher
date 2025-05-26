/**
 * Formatea una fecha en formato ISO a un texto relativo según el tiempo transcurrido
 * - Menos de 24 horas: "Hace X horas"
 * - Entre 1 y 6 días: "Hace X días"
 * - 7 días o más: Fecha completa (DD/MM/YYYY)
 */
export function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()

  // Diferencia en milisegundos
  const diffMs = now.getTime() - date.getTime()

  // Convertir a horas
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

  // Convertir a días
  const diffDays = Math.floor(diffHours / 24)

  if (diffHours < 24) {
    // Menos de 24 horas
    return diffHours === 0 ? "Hace unos minutos" : `Hace ${diffHours} ${diffHours === 1 ? "hora" : "horas"}`
  } else if (diffDays < 7) {
    // Entre 1 y 6 días
    return `Hace ${diffDays} ${diffDays === 1 ? "día" : "días"}`
  } else {
    // 7 días o más: mostrar fecha completa
    return date.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  }
}
