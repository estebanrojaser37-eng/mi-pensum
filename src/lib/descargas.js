import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Descarga un archivo (Blob) tanto en navegador normal (web/PWA)
 * como dentro de la app nativa empaquetada con Capacitor.
 */
export async function descargarArchivo(blob, nombreArchivo) {
  if (!Capacitor.isNativePlatform()) {
    // Navegador normal: el truco clásico del <a download> sí funciona aquí
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = nombreArchivo
    a.click()
    URL.revokeObjectURL(url)
    return
  }

  // App nativa (APK): guardar en caché y abrir el menú de compartir/guardar de Android
  const base64 = await blobToBase64(blob)
  const resultado = await Filesystem.writeFile({
    path: nombreArchivo,
    data: base64,
    directory: Directory.Cache,
  })

  await Share.share({
    title: nombreArchivo,
    url: resultado.uri,
    dialogTitle: 'Guardar o abrir archivo',
  })
}
