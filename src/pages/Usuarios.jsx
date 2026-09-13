import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'

const ROLES = ['usuario', 'docente', 'admin']

function etiquetaRol(rol) {
  if (rol === 'admin') return 'Admin'
  if (rol === 'docente') return 'Docente'
  return 'Alumno'
}

function colorRol(rol) {
  if (rol === 'admin') return 'bg-purple-100 text-purple-700'
  if (rol === 'docente') return 'bg-blue-100 text-blue-700'
  return 'bg-gray-100 text-gray-600'
}

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [esAdmin, setEsAdmin] = useState(false)
  const [error, setError] = useState('')
  const [actualizandoId, setActualizandoId] = useState(null)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    cargarUsuarios()
  }, [])

  async function cargarUsuarios() {
    setCargando(true)

    const { data: userData } = await supabase.auth.getUser()
    const uid = userData?.user?.id
    if (uid) {
      const { data: perfil } = await supabase.from('profiles').select('role').eq('id', uid).single()
      setEsAdmin(perfil?.role === 'admin')
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, nombre, role')
      .order('nombre', { ascending: true })

    if (error) setError(error.message)
    else setUsuarios(data || [])
    setCargando(false)
  }

  async function cambiarRol(id, nuevoRol) {
    const rolAnterior = usuarios.find((u) => u.id === id)?.role
    setActualizandoId(id)

    setUsuarios((prev) => prev.map((u) => (u.id === id ? { ...u, role: nuevoRol } : u)))

    const { error } = await supabase.from('profiles').update({ role: nuevoRol }).eq('id', id)

    setActualizandoId(null)

    if (error) {
      setError(error.message)
      setUsuarios((prev) => prev.map((u) => (u.id === id ? { ...u, role: rolAnterior } : u)))
    }
  }

  const usuariosFiltrados = usuarios.filter((u) =>
    (u.nombre || '').toLowerCase().includes(busqueda.toLowerCase())
  )

  if (cargando) return <div className="p-6 text-gray-500">Cargando usuarios...</div>

  if (!esAdmin) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <p className="text-gray-500">Solo el administrador puede ver esta página.</p>
        <Link to="/" className="text-brand text-sm hover:underline">&larr; Volver al índice</Link>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link to="/" className="text-brand text-sm hover:underline">&larr; Volver al índice</Link>
      <h1 className="text-2xl font-bold mt-2 mb-1">Usuarios y roles</h1>
      <p className="text-gray-500 mb-4">{usuarios.length} cuenta(s) registrada(s)</p>

      <input
        type="text"
        placeholder="Buscar por nombre"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        className="w-full border rounded px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-brand"
      />

      {error && <p className="text-red-600 text-sm mb-4">Error: {error}</p>}

      <div className="grid gap-2">
        {usuariosFiltrados.map((u) => (
          <div key={u.id} className="bg-white border rounded-lg p-4 flex justify-between items-center">
            <div>
              <p className="font-medium">{u.nombre || 'Sin nombre'}</p>
              <span className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1 ${colorRol(u.role)}`}>
                {etiquetaRol(u.role)}
              </span>
            </div>
            <select
              value={u.role || 'usuario'}
              onChange={(e) => cambiarRol(u.id, e.target.value)}
              disabled={actualizandoId === u.id}
              className="border rounded px-2 py-1.5 text-sm disabled:opacity-50"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{etiquetaRol(r)}</option>
              ))}
            </select>
          </div>
        ))}
        {usuariosFiltrados.length === 0 && (
          <p className="text-gray-400 text-center py-6">Sin resultados</p>
        )}
      </div>
    </div>
  )
}
