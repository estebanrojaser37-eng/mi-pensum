import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'


export default function Perfil() {
  const [nombre, setNombre] = useState('')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    cargarPerfil()
  }, [])

  async function cargarPerfil() {
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData?.user?.id
    if (!uid) return setCargando(false)

    const { data } = await supabase.from('profiles').select('nombre').eq('id', uid).single()
    setNombre(data?.nombre || '')
    setCargando(false)
  }

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true)
    setMensaje('')

    const { data: userData } = await supabase.auth.getUser()
    const uid = userData?.user?.id

    const { error } = await supabase.from('profiles').update({ nombre: nombre.trim() }).eq('id', uid)

    setGuardando(false)
    setMensaje(error ? 'Error al guardar: ' + error.message : 'Guardado correctamente.')
  }

  if (cargando) return <div className="p-6 text-gray-500">Cargando...</div>

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-6">Mi perfil</h1>
      <form onSubmit={guardar}>
        <label className="block text-sm font-medium mb-1">Nombre completo</label>
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="w-full border rounded px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-brand"
          placeholder="Ej. Juan Pérez"
        />

        {mensaje && (
          <p className={`text-sm mb-4 ${mensaje.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
            {mensaje}
          </p>
        )}

        <button
          type="submit"
          disabled={guardando}
          className="bg-brand text-white px-4 py-2 rounded text-sm hover:bg-brand-dark transition disabled:opacity-50"
        >
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
      </form>
    </div>
  )
}
