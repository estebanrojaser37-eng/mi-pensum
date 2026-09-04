import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'

function formatearHora(iso) {
  const fecha = new Date(iso)
  return fecha.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function Badge({ cantidad }) {
  if (!cantidad || cantidad <= 0) return null
  return (
    <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center inline-block">
      {cantidad > 99 ? '99+' : cantidad}
    </span>
  )
}

function BurbujaMensaje({ mensaje, propio, puedeBorrar, onBorrar }) {
  return (
    <div className={`flex ${propio ? 'justify-end' : 'justify-start'} mb-2`}>
      <div className={`max-w-[75%] rounded-lg px-3 py-2 relative group ${propio ? 'bg-brand text-white' : 'bg-white border'}`}>
        {!propio && (
          <p className="text-xs font-semibold mb-0.5 opacity-80">{mensaje.remitente?.nombre || 'Usuario'}</p>
        )}
        <p className="text-sm whitespace-pre-wrap pr-4">{mensaje.contenido}</p>
        <p className={`text-[10px] mt-1 ${propio ? 'text-white/70' : 'text-gray-400'}`}>
          {formatearHora(mensaje.created_at)}
        </p>
        {puedeBorrar && (
          <button
            onClick={() => onBorrar(mensaje.id)}
            title="Eliminar mensaje"
            className={`absolute top-1 right-1 text-xs ${
              propio ? 'text-white/80 hover:text-white' : 'text-gray-400 hover:text-red-500'
            }`}
          >
            🗑️
          </button>
        )}
      </div>
    </div>
  )
}

function VistaGrupal({ userId, esAdmin, onAbrirGrupal }) {
  const [mensajes, setMensajes] = useState([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    cargar()
    onAbrirGrupal()
    const canal = supabase
      .channel('mensajes-grupal')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mensajes' }, (payload) => {
        const registro = payload.new?.destinatario_id !== undefined ? payload.new : payload.old
        if (registro?.destinatario_id === null) cargar()
      })
      .subscribe()
    return () => supabase.removeChannel(canal)
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [mensajes])

  async function cargar() {
    const { data } = await supabase
      .from('mensajes')
      .select('*, remitente:profiles!mensajes_remitente_id_fkey(nombre)')
      .is('destinatario_id', null)
      .order('created_at', { ascending: true })
      .limit(200)
    setMensajes(data || [])
  }

  async function enviar() {
    if (!texto.trim()) return
    setEnviando(true)
    await supabase.from('mensajes').insert({ remitente_id: userId, destinatario_id: null, contenido: texto.trim() })
    setTexto('')
    setEnviando(false)
    cargar()
  }

  async function borrarMensaje(id) {
    if (!window.confirm('¿Eliminar este mensaje?')) return
    const { error } = await supabase.from('mensajes').delete().eq('id', id)
    if (error) alert('No se pudo eliminar el mensaje.')
    else cargar()
  }

  async function vaciarChat() {
    if (!window.confirm('¿Vaciar TODO el chat grupal? Esta acción no se puede deshacer.')) return
    const { error } = await supabase.from('mensajes').delete().is('destinatario_id', null)
    if (error) alert('No se pudo vaciar el chat.')
    else cargar()
  }

  return (
    <div className="flex flex-col h-[70vh]">
      {esAdmin && (
        <div className="flex justify-end mb-2">
          <button onClick={vaciarChat} className="text-xs text-red-500 hover:underline">
            Vaciar chat grupal
          </button>
        </div>
      )}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 bg-gray-50 rounded-t-lg border border-b-0">
        {mensajes.length === 0 && <p className="text-center text-gray-400 text-sm mt-8">Aún no hay mensajes.</p>}
        {mensajes.map((m) => (
          <BurbujaMensaje
            key={m.id}
            mensaje={m}
            propio={m.remitente_id === userId}
            puedeBorrar={m.remitente_id === userId || esAdmin}
            onBorrar={borrarMensaje}
          />
        ))}
      </div>
      <div className="flex gap-2 p-2 border rounded-b-lg bg-white">
        <input
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && enviar()}
          placeholder="Escribe un mensaje para todos..."
          className="flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <button
          onClick={enviar}
          disabled={enviando || !texto.trim()}
          className="bg-brand text-white px-4 py-2 rounded text-sm hover:bg-brand-dark transition disabled:opacity-50"
        >
          Enviar
        </button>
      </div>
    </div>
  )
}

function VistaDirecto({ userId, esAdmin, contactoInicialId, noLeidosPorContacto, onAbrirConversacion }) {
  const [contactos, setContactos] = useState([])
  const [contactoActivo, setContactoActivo] = useState(null)
  const [mensajes, setMensajes] = useState([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    cargarContactos()
  }, [])

  useEffect(() => {
    if (contactoInicialId && contactos.length > 0 && !contactoActivo) {
      const c = contactos.find((x) => x.id === contactoInicialId)
      if (c) setContactoActivo(c)
    }
  }, [contactoInicialId, contactos])

  useEffect(() => {
    if (!contactoActivo) return
    cargarMensajes()
    onAbrirConversacion(contactoActivo.id)
    const canal = supabase
      .channel(`mensajes-directo-${contactoActivo.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mensajes' }, (payload) => {
        const registro = payload.new?.remitente_id !== undefined ? payload.new : payload.old
        const esDeEstaConversacion =
          (registro.remitente_id === userId && registro.destinatario_id === contactoActivo.id) ||
          (registro.remitente_id === contactoActivo.id && registro.destinatario_id === userId)
        if (esDeEstaConversacion) cargarMensajes()
      })
      .subscribe()
    return () => supabase.removeChannel(canal)
  }, [contactoActivo])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [mensajes])

  async function cargarContactos() {
    const { data } = await supabase
      .from('profiles')
      .select('id, nombre, role')
      .neq('id', userId)
      .order('nombre', { ascending: true })
    setContactos(data || [])
  }

  async function cargarMensajes() {
    if (!contactoActivo) return
    const { data } = await supabase
      .from('mensajes')
      .select('*, remitente:profiles!mensajes_remitente_id_fkey(nombre)')
      .or(
        `and(remitente_id.eq.${userId},destinatario_id.eq.${contactoActivo.id}),and(remitente_id.eq.${contactoActivo.id},destinatario_id.eq.${userId})`
      )
      .order('created_at', { ascending: true })
      .limit(200)
    setMensajes(data || [])
  }

  async function enviar() {
    if (!texto.trim() || !contactoActivo) return
    setEnviando(true)
    await supabase.from('mensajes').insert({
      remitente_id: userId,
      destinatario_id: contactoActivo.id,
      contenido: texto.trim(),
    })
    setTexto('')
    setEnviando(false)
    cargarMensajes()
  }

  async function borrarMensaje(id) {
    if (!window.confirm('¿Eliminar este mensaje?')) return
    const { error } = await supabase.from('mensajes').delete().eq('id', id)
    if (error) alert('No se pudo eliminar el mensaje.')
    else cargarMensajes()
  }

  async function vaciarConversacion() {
    if (!window.confirm('¿Vaciar esta conversación? Esta acción no se puede deshacer.')) return
    const { error } = await supabase
      .from('mensajes')
      .delete()
      .or(
        `and(remitente_id.eq.${userId},destinatario_id.eq.${contactoActivo.id}),and(remitente_id.eq.${contactoActivo.id},destinatario_id.eq.${userId})`
      )
    if (error) alert('No se pudo vaciar la conversación.')
    else cargarMensajes()
  }

  const ETIQUETA_ROL = { admin: 'Admin', docente: 'Docente', usuario: 'Estudiante' }

  if (!contactoActivo) {
    return (
      <div className="border rounded-lg divide-y max-h-[70vh] overflow-y-auto">
        {contactos.length === 0 && <p className="text-center text-gray-400 text-sm p-6">No hay otros usuarios todavía.</p>}
        {contactos.map((c) => (
          <button
            key={c.id}
            onClick={() => setContactoActivo(c)}
            className="w-full text-left p-3 hover:bg-gray-50 flex justify-between items-center"
          >
            <span className="font-medium flex items-center gap-2">
              {c.nombre || 'Sin nombre'}
              <Badge cantidad={noLeidosPorContacto[c.id]} />
            </span>
            <span className="text-xs text-gray-400">{ETIQUETA_ROL[c.role] || c.role}</span>
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[70vh]">
      <div className="flex items-center justify-between gap-2 p-2 border rounded-t-lg bg-white">
        <div className="flex items-center gap-2">
          <button onClick={() => setContactoActivo(null)} className="text-brand text-sm hover:underline">
            &larr; Contactos
          </button>
          <span className="font-medium text-sm ml-2">{contactoActivo.nombre}</span>
        </div>
        {esAdmin && (
          <button onClick={vaciarConversacion} className="text-xs text-red-500 hover:underline">
            Vaciar chat
          </button>
        )}
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 bg-gray-50 border-x">
        {mensajes.length === 0 && <p className="text-center text-gray-400 text-sm mt-8">Sin mensajes todavía.</p>}
        {mensajes.map((m) => (
          <BurbujaMensaje
            key={m.id}
            mensaje={m}
            propio={m.remitente_id === userId}
            puedeBorrar={m.remitente_id === userId || esAdmin}
            onBorrar={borrarMensaje}
          />
        ))}
      </div>
      <div className="flex gap-2 p-2 border rounded-b-lg bg-white">
        <input
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && enviar()}
          placeholder={`Mensaje para ${contactoActivo.nombre}...`}
          className="flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <button
          onClick={enviar}
          disabled={enviando || !texto.trim()}
          className="bg-brand text-white px-4 py-2 rounded text-sm hover:bg-brand-dark transition disabled:opacity-50"
        >
          Enviar
        </button>
      </div>
    </div>
  )
}

export default function Mensajes() {
  const location = useLocation()
  const [modo, setModo] = useState('grupal')
  const [userId, setUserId] = useState(null)
  const [esAdmin, setEsAdmin] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [noLeidosGrupal, setNoLeidosGrupal] = useState(0)
  const [noLeidosPorContacto, setNoLeidosPorContacto] = useState({})

  useEffect(() => {
    if (location.state?.modo) setModo(location.state.modo)
  }, [location.state])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data?.user?.id || null
      setUserId(uid)
      if (uid) {
        const { data: perfil } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', uid)
          .single()
        setEsAdmin(perfil?.role === 'admin')
      }
      setCargando(false)
    })
  }, [])

  useEffect(() => {
    if (!userId) return
    cargarNoLeidos()
    const canal = supabase
      .channel('mensajes-badges')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, () => cargarNoLeidos())
      .subscribe()
    return () => supabase.removeChannel(canal)
  }, [userId])

  async function cargarNoLeidos() {
    if (!userId) return
    const { data: lecturasData } = await supabase
      .from('lecturas')
      .select('conversacion, ultima_lectura')
      .eq('user_id', userId)
    const mapaLecturas = {}
    ;(lecturasData || []).forEach((l) => {
      mapaLecturas[l.conversacion] = l.ultima_lectura
    })

    const { data: gruposData } = await supabase
      .from('mensajes')
      .select('id, created_at')
      .is('destinatario_id', null)
      .neq('remitente_id', userId)
    const lecturaGrupal = mapaLecturas['grupal']
    const totalGrupal = (gruposData || []).filter(
      (m) => !lecturaGrupal || new Date(m.created_at) > new Date(lecturaGrupal)
    ).length

    const { data: directosData } = await supabase
      .from('mensajes')
      .select('id, created_at, remitente_id')
      .eq('destinatario_id', userId)
    const conteoPorContacto = {}
    ;(directosData || []).forEach((m) => {
      const lecturaContacto = mapaLecturas[m.remitente_id]
      const noLeido = !lecturaContacto || new Date(m.created_at) > new Date(lecturaContacto)
      if (noLeido) conteoPorContacto[m.remitente_id] = (conteoPorContacto[m.remitente_id] || 0) + 1
    })

    setNoLeidosGrupal(totalGrupal)
    setNoLeidosPorContacto(conteoPorContacto)
  }

  async function marcarLeidoGrupal() {
    if (!userId) return
    await supabase
      .from('lecturas')
      .upsert({ user_id: userId, conversacion: 'grupal', ultima_lectura: new Date().toISOString() }, { onConflict: 'user_id,conversacion' })
    cargarNoLeidos()
  }

  async function marcarLeidoDirecto(contactoId) {
    if (!userId) return
    await supabase
      .from('lecturas')
      .upsert({ user_id: userId, conversacion: contactoId, ultima_lectura: new Date().toISOString() }, { onConflict: 'user_id,conversacion' })
    cargarNoLeidos()
  }

  if (cargando) return <div className="p-6 text-gray-500">Cargando...</div>

  const totalNoLeidosDirecto = Object.values(noLeidosPorContacto).reduce((a, b) => a + b, 0)

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Mensajes</h1>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setModo('grupal')}
          className={`px-4 py-2 rounded text-sm font-medium flex items-center gap-2 ${
            modo === 'grupal' ? 'bg-brand text-white' : 'bg-white border text-gray-600'
          }`}
        >
          Grupal <Badge cantidad={noLeidosGrupal} />
        </button>
        <button
          onClick={() => setModo('directo')}
          className={`px-4 py-2 rounded text-sm font-medium flex items-center gap-2 ${
            modo === 'directo' ? 'bg-brand text-white' : 'bg-white border text-gray-600'
          }`}
        >
          Directo <Badge cantidad={totalNoLeidosDirecto} />
        </button>
      </div>

      {modo === 'grupal' ? (
        <VistaGrupal userId={userId} esAdmin={esAdmin} onAbrirGrupal={marcarLeidoGrupal} />
      ) : (
        <VistaDirecto
          userId={userId}
          esAdmin={esAdmin}
          contactoInicialId={location.state?.modo === 'directo' ? location.state?.contactoId : null}
          noLeidosPorContacto={noLeidosPorContacto}
          onAbrirConversacion={marcarLeidoDirecto}
        />
      )}
    </div>
  )
}