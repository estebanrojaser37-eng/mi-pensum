import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import Dialogo from '../components/Dialogo.jsx'

function ModalMateria({ onClose, onGuardada, anioSeleccionado, materiaEditar }) {
  const esEdicion = !!materiaEditar
  const [nombre, setNombre] = useState(materiaEditar?.nombre || '')
  const [anio, setAnio] = useState(materiaEditar?.anio || anioSeleccionado || 1)
  const [profesor, setProfesor] = useState(materiaEditar?.profesor || '')
  const [fecha, setFecha] = useState(materiaEditar?.fecha || '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!nombre.trim()) {
      setError('El nombre es obligatorio.')
      return
    }

    setGuardando(true)

    if (esEdicion) {
      const { error: errorUpdate } = await supabase
        .from('materias')
        .update({
          nombre: nombre.trim(),
          anio: Number(anio),
          profesor: profesor.trim() || null,
          fecha: fecha || null,
        })
        .eq('id', materiaEditar.id)

      setGuardando(false)
      if (errorUpdate) return setError(errorUpdate.message)
      return onGuardada()
    }

    const { count } = await supabase
      .from('materias')
      .select('*', { count: 'exact', head: true })
      .eq('anio', anio)

    const { error: errorInsert } = await supabase.from('materias').insert({
      nombre: nombre.trim(),
      anio: Number(anio),
      orden: (count || 0) + 1,
      profesor: profesor.trim() || null,
      fecha: fecha || null,
    })

    setGuardando(false)
    if (errorInsert) return setError(errorInsert.message)
    onGuardada()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
        <h2 className="text-lg font-bold mb-4">{esEdicion ? 'Editar materia' : 'Nueva materia'}</h2>
        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-medium mb-1">Nombre</label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full border rounded px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-brand"
            placeholder="Ej. Hermenéutica (interpretación bíblica)"
            autoFocus
          />

          <label className="block text-sm font-medium mb-1">Año</label>
          <select
            value={anio}
            onChange={(e) => setAnio(e.target.value)}
            className="w-full border rounded px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <option value={1}>Primer año</option>
            <option value={2}>Segundo año</option>
            <option value={3}>Tercer año</option>
          </select>

          <label className="block text-sm font-medium mb-1">Profesor (opcional)</label>
          <input
            type="text"
            value={profesor}
            onChange={(e) => setProfesor(e.target.value)}
            className="w-full border rounded px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-brand"
          />

          <label className="block text-sm font-medium mb-1">Fecha de inicio (opcional)</label>
          <input
            type="date"
            value={fecha || ''}
            onChange={(e) => setFecha(e.target.value)}
            className="w-full border rounded px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-brand"
          />

          {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-100">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="px-4 py-2 rounded text-sm bg-brand text-white hover:bg-brand-dark transition disabled:opacity-50"
            >
              {guardando ? 'Guardando...' : esEdicion ? 'Guardar cambios' : 'Crear materia'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const NOMBRE_ANIO = { 1: 'Primer año', 2: 'Segundo año', 3: 'Tercer año' }

export default function IndiceMaterias() {
  const [materias, setMaterias] = useState([])
  const [esAdmin, setEsAdmin] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [materiaEditar, setMateriaEditar] = useState(null)
  const [dialogo, setDialogo] = useState(null)
  const [anioActivo, setAnioActivo] = useState('todos')

  useEffect(() => {
    cargarTodo()
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      cargarTodo()
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  async function cargarTodo() {
    setCargando(true)

    const { data: userData } = await supabase.auth.getUser()
    if (userData?.user) {
      const { data: perfil } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userData.user.id)
        .single()
      setEsAdmin(perfil?.role === 'admin')
    }

    const { data, error } = await supabase
      .from('materias')
      .select('*')
      .order('anio', { ascending: true })
      .order('orden', { ascending: true })

    if (!error) setMaterias(data || [])
    setCargando(false)
  }

  function handleGuardada() {
    setModalAbierto(false)
    setMateriaEditar(null)
    cargarTodo()
  }

  function abrirEdicion(e, materia) {
    e.preventDefault()
    e.stopPropagation()
    setMateriaEditar(materia)
    setModalAbierto(true)
  }

  function eliminarMateria(e, materia) {
    e.preventDefault()
    e.stopPropagation()
    setDialogo({
      tipo: 'confirm',
      titulo: 'Eliminar materia',
      mensaje: `¿Eliminar "${materia.nombre}"? Esto también borrará sus guías y evaluaciones.`,
      onConfirmar: async () => {
        await supabase.from('materias').delete().eq('id', materia.id)
        setDialogo(null)
        cargarTodo()
      },
    })
  }

  const materiasFiltradas =
    anioActivo === 'todos' ? materias : materias.filter((m) => m.anio === Number(anioActivo))

  const porAnio = materiasFiltradas.reduce((acc, m) => {
    acc[m.anio] = acc[m.anio] || []
    acc[m.anio].push(m)
    return acc
  }, {})

  if (cargando) {
    return <div className="p-6 text-gray-500">Cargando materias...</div>
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Pensum</h1>
      <p className="text-gray-500 mb-6">{materias.length} materias en total</p>

      <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setAnioActivo('todos')}
            className={`px-3 py-1 rounded-full text-sm border ${
              anioActivo === 'todos' ? 'bg-brand text-white border-brand' : 'bg-white text-gray-600 border-gray-300'
            }`}
          >
            Todos
          </button>
          {[1, 2, 3].map((a) => (
            <button
              key={a}
              onClick={() => setAnioActivo(String(a))}
              className={`px-3 py-1 rounded-full text-sm border ${
                anioActivo === String(a) ? 'bg-brand text-white border-brand' : 'bg-white text-gray-600 border-gray-300'
              }`}
            >
              {NOMBRE_ANIO[a]}
            </button>
          ))}
        </div>

        {esAdmin && (
          <button
            onClick={() => {
              setMateriaEditar(null)
              setModalAbierto(true)
            }}
            className="bg-brand text-white px-4 py-2 rounded text-sm hover:bg-brand-dark transition whitespace-nowrap"
          >
            + Agregar materia
          </button>
        )}
      </div>

      {dialogo && <Dialogo {...dialogo} onCancelar={() => setDialogo(null)} />}

      {modalAbierto && (
        <ModalMateria
          anioSeleccionado={anioActivo === 'todos' ? 1 : Number(anioActivo)}
          materiaEditar={materiaEditar}
          onClose={() => {
            setModalAbierto(false)
            setMateriaEditar(null)
          }}
          onGuardada={handleGuardada}
        />
      )}

      {Object.keys(porAnio).length === 0 && (
        <p className="text-gray-500">No hay materias todavía.</p>
      )}

      {Object.entries(porAnio)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([anio, lista]) => (
          <div key={anio} className="mb-8">
            <h2 className="text-lg font-semibold mb-3 text-gray-700">{NOMBRE_ANIO[anio]}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {lista.map((materia) => (
                <Link
                  key={materia.id}
                  to={`/materia/${materia.id}`}
                  className="block bg-white border rounded-lg p-4 hover:shadow-md transition relative"
                >
                  <p className="font-medium pr-2">{materia.nombre}</p>
                  {materia.profesor && (
                    <p className="text-sm text-gray-500 mt-1">Prof. {materia.profesor}</p>
                  )}
                  {esAdmin && (
                    <div className="flex gap-3 mt-2 pt-2 border-t border-gray-100">
                      <button
                        onClick={(e) => abrirEdicion(e, materia)}
                        className="text-xs text-brand hover:underline"
                      >
                        Editar
                      </button>
                      <button
                        onClick={(e) => eliminarMateria(e, materia)}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Eliminar
                      </button>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </div>
        ))}
    </div>
  )
}
