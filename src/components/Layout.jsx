import { useEffect, useState } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { registrarPush } from '../lib/push.js'

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [nombre, setNombre] = useState('')
  const [rol, setRol] = useState('usuario')
  const [userId, setUserId] = useState(null)
  const [toast, setToast] = useState(null)
  const esAdmin = rol === 'admin'
  const esDocente = rol === 'docente'

  useEffect(() => {
    cargarPerfil()
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      cargarPerfil()
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  async function cargarPerfil() {
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData?.user?.id
    if (!uid) return

    setUserId(uid)
    registrarPush(uid)
    const { data } = await supabase.from('profiles').select('nombre, role').eq('id', uid).single()
    setNombre(data?.nombre || userData.user.email)
    setRol(data?.role || 'usuario')
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  useEffect(() => {
    if (!userId) return

    const canal = supabase
      .channel('avisos-mensajes-global')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, async (payload) => {
        const m = payload.new
        const esParaMi = m.destinatario_id === null || m.destinatario_id === userId
        const noSoyYo = m.remitente_id !== userId
        const noEstoyEnMensajes = location.pathname !== '/mensajes'

        if (esParaMi && noSoyYo && noEstoyEnMensajes) {
          const { data: remitente } = await supabase.from('profiles').select('nombre').eq('id', m.remitente_id).single()
          setToast({
            titulo: m.destinatario_id === null ? 'Mensaje grupal' : 'Mensaje directo',
            texto: `${remitente?.nombre || 'Alguien'}: ${m.contenido}`,
          })
          setTimeout(() => setToast(null), 5000)
        }
      })
      .subscribe()

    return () => supabase.removeChannel(canal)
  }, [userId, location.pathname])

  const colorHeader = esAdmin ? 'bg-[#1B4F72]' : esDocente ? 'bg-[#2E6F4E]' : 'bg-brand'
  const colorFondo = esAdmin ? 'bg-amber-50/40' : esDocente ? 'bg-emerald-50/40' : ''
  const etiquetaRol = esAdmin ? 'Admin' : esDocente ? 'Docente' : 'Estudiante'
  const colorEtiqueta = esAdmin
    ? 'bg-amber-400 text-amber-950'
    : esDocente
    ? 'bg-emerald-300 text-emerald-950'
    : 'bg-white/20 text-white'

  return (
    <div className={`min-h-screen ${colorFondo}`}>
      <header className={`${colorHeader} text-white shadow`}>
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <Link to="/" className="text-lg font-semibold whitespace-nowrap">📘 Mi Pensum</Link>

            <div className="flex items-center gap-2 text-sm">
              <span className="hidden sm:inline">{nombre}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${colorEtiqueta}`}>
                {etiquetaRol}
              </span>
              <button
                onClick={handleLogout}
                className="bg-brand-dark px-3 py-1 rounded hover:bg-brand-light transition whitespace-nowrap"
              >
                Salir
              </button>
            </div>
          </div>

          <nav className="flex gap-4 text-sm mt-2 flex-wrap">
            <Link to="/" className="hover:underline">Materias</Link>
            <Link to="/mensajes" className="hover:underline">Mensajes</Link>
            <Link to="/record" className="hover:underline">Récord académico</Link>
            <Link to="/perfil" className="hover:underline">Mi perfil</Link>
          </nav>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Outlet />
      </main>

      {toast && (
        <button
          onClick={() => {
            navigate('/mensajes')
            setToast(null)
          }}
          className="fixed bottom-4 right-4 max-w-xs bg-[#1a1a2e] text-white rounded-lg shadow-lg p-4 text-left z-50 animate-pulse-once"
        >
          <p className="text-xs font-semibold text-brand-light mb-1">{toast.titulo}</p>
          <p className="text-sm line-clamp-2">{toast.texto}</p>
        </button>
      )}
    </div>
  )
}
