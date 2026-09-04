import { PushNotifications } from '@capacitor/push-notifications'
import { Capacitor } from '@capacitor/core'
import { supabase } from './supabase.js'

let yaRegistrado = false

export async function registrarPush(userId) {
  console.log('[PUSH] registrarPush llamado con userId:', userId)

  if (!Capacitor.isNativePlatform()) {
    console.log('[PUSH] No es plataforma nativa, saliendo.')
    return
  }
  if (!userId) {
    console.log('[PUSH] No hay userId, saliendo.')
    return
  }
  if (yaRegistrado) {
    console.log('[PUSH] Ya estaba registrado, saliendo.')
    return
  }
  yaRegistrado = true

  console.log('[PUSH] Verificando permisos...')
  let permiso
  try {
    permiso = await PushNotifications.checkPermissions()
    console.log('[PUSH] Permiso actual:', JSON.stringify(permiso))
  } catch (e) {
    console.log('[PUSH] ERROR en checkPermissions:', e.message || e)
    return
  }

  if (permiso.receive === 'prompt' || permiso.receive === 'prompt-with-rationale') {
    try {
      permiso = await PushNotifications.requestPermissions()
      console.log('[PUSH] Permiso tras pedirlo:', JSON.stringify(permiso))
    } catch (e) {
      console.log('[PUSH] ERROR en requestPermissions:', e.message || e)
      return
    }
  }

  if (permiso.receive !== 'granted') {
    console.log('[PUSH] Permiso NO concedido:', permiso.receive)
    return
  }

  console.log('[PUSH] Permiso concedido, registrando...')
  try {
    await PushNotifications.register()
    console.log('[PUSH] PushNotifications.register() ejecutado.')
  } catch (e) {
    console.log('[PUSH] ERROR en register():', e.message || e)
    return
  }

  PushNotifications.addListener('registration', async (token) => {
    console.log('[PUSH] Token recibido:', token.value)
    const { error } = await supabase
      .from('push_tokens')
      .upsert({ user_id: userId, token: token.value, plataforma: 'android' }, { onConflict: 'token' })
    if (error) console.log('[PUSH] ERROR guardando token:', JSON.stringify(error))
    else console.log('[PUSH] Token guardado correctamente en Supabase.')
  })

  PushNotifications.addListener('registrationError', (err) => {
    console.log('[PUSH] registrationError:', JSON.stringify(err))
  })
}

let navegarRef = null
export function setNavegador(fn) {
  navegarRef = fn
}

PushNotifications.addListener('pushNotificationActionPerformed', (accion) => {
  const datos = accion.notification.data
  console.log('[PUSH] Notificación tocada:', JSON.stringify(datos))
  if (!navegarRef) return

  if (datos.tipo === 'grupal') {
    navegarRef('/mensajes', { state: { modo: 'grupal' } })
  } else {
    navegarRef('/mensajes', { state: { modo: 'directo', contactoId: datos.remitente_id } })
  }
})