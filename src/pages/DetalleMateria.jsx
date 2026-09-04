import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import Dialogo from '../components/Dialogo.jsx'
import { descargarArchivo } from '../lib/descargas.js'

const ICONO_TIPO = { word: '📄', excel: '📊', pdf: '📕', otro: '📎' }
const NOMBRE_ANIO = { 1: 'Primer año', 2: 'Segundo año', 3: 'Tercer año' }

function ModalEvaluacion({ onClose, onCreada, materiaId }) {
  const [nombre, setNombre] = useState('')
  const [fechaLimite, setFechaLimite] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!nombre.trim()) return setError('El nombre es obligatorio.')
    setGuardando(true)
    const { error: errorInsert } = await supabase
      .from('evaluaciones')
      .insert({ materia_id: materiaId, nombre: nombre.trim(), tipo: 'examen', fecha_limite: fechaLimite || null })
    setGuardando(false)
    if (errorInsert) return setError(errorInsert.message)
    onCreada()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-sm p-6">
        <h2 className="text-lg font-bold mb-4">Nueva evaluación</h2>
        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-medium mb-1">Nombre (ej. Parcial 1)</label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            autoFocus
            className="w-full border rounded px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <label className="block text-sm font-medium mb-1">Fecha límite (opcional)</label>
          <input
            type="date"
            value={fechaLimite}
            onChange={(e) => setFechaLimite(e.target.value)}
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
              {guardando ? 'Guardando...' : 'Crear evaluación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function FilaEvaluacionAdmin({ evaluacion, onBorrar }) {
  const [entregas, setEntregas] = useState([])
  const [abierto, setAbierto] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [dialogo, setDialogo] = useState(null)

  async function cargarEntregas() {
    setCargando(true)
    const { data } = await supabase
      .from('entregas')
      .select('*, profiles(nombre)')
      .eq('evaluacion_id', evaluacion.id)
    setEntregas(data || [])
    setCargando(false)
  }

  function toggle() {
    if (!abierto) cargarEntregas()
    setAbierto(!abierto)
  }

  function pedirCalificacion(entrega) {
    setDialogo({
      tipo: 'prompt',
      tipoInput: 'number',
      titulo: 'Calificación',
      valorInicial: entrega.calificacion ?? '',
      onConfirmar: async (valor) => {
        await supabase.from('entregas').update({ calificacion: parseFloat(valor) }).eq('id', entrega.id)
        setDialogo(null)
        cargarEntregas()
      },
    })
  }

  async function descargarEntrega(entrega) {
    const { data, error } = await supabase.storage.from('entregas').download(entrega.storage_path)
    if (error) return setDialogo({ tipo: 'alert', mensaje: 'No se pudo descargar: ' + error.message, onConfirmar: () => setDialogo(null) })
    await descargarArchivo(data, entrega.nombre_archivo)
  }

  return (
    <div className="bg-white rounded shadow-sm p-3">
      {dialogo && <Dialogo {...dialogo} onCancelar={() => setDialogo(null)} />}

      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm font-medium">{evaluacion.nombre}</p>
          <p className="text-xs text-gray-400 capitalize">
            {evaluacion.tipo} {evaluacion.fecha_limite ? `· vence ${evaluacion.fecha_limite}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={toggle} className="text-brand text-sm hover:underline">
            {abierto ? 'Ocultar entregas' : 'Ver entregas'}
          </button>
          <button onClick={() => onBorrar(evaluacion)} className="text-red-500 text-sm hover:underline">
            Borrar
          </button>
        </div>
      </div>

      {abierto && (
        <div className="mt-3 border-t pt-3">
          {cargando && <p className="text-xs text-gray-400">Cargando entregas...</p>}
          {!cargando && entregas.length === 0 && (
            <p className="text-xs text-gray-400">Nadie ha entregado todavía.</p>
          )}
          {entregas.map((e) => (
            <div key={e.id} className="flex justify-between items-center py-1 text-sm">
              <span>{e.profiles?.nombre || 'Estudiante'} — {e.nombre_archivo}</span>
              <div className="flex items-center gap-3">
                <button onClick={() => descargarEntrega(e)} className="text-brand hover:underline text-xs">
                  Descargar
                </button>
                <button onClick={() => pedirCalificacion(e)} className="font-semibold text-brand hover:underline text-xs">
                  {e.calificacion != null ? e.calificacion : 'Calificar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FilaEvaluacionEstudiante({ evaluacion, userId }) {
  const [entrega, setEntrega] = useState(null)
  const [subiendo, setSubiendo] = useState(false)
  const [dialogo, setDialogo] = useState(null)

  useEffect(() => {
    cargarEntrega()
  }, [])

  async function cargarEntrega() {
    const { data } = await supabase
      .from('entregas')
      .select('*')
      .eq('evaluacion_id', evaluacion.id)
      .eq('user_id', userId)
      .maybeSingle()
    setEntrega(data)
  }

  async function subirArchivo(event) {
    const file = event.target.files[0]
    if (!file) return
    setSubiendo(true)

    const storagePath = `${userId}/${evaluacion.id}_${file.name}`
    const { error: errorSubida } = await supabase.storage
      .from('entregas')
      .upload(storagePath, file, { upsert: true })

    if (!errorSubida) {
      await supabase.from('entregas').upsert(
        { evaluacion_id: evaluacion.id, user_id: userId, nombre_archivo: file.name, storage_path: storagePath },
        { onConflict: 'evaluacion_id,user_id' }
      )
      cargarEntrega()
    } else {
      setDialogo({ tipo: 'alert', mensaje: 'Error al subir: ' + errorSubida.message, onConfirmar: () => setDialogo(null) })
    }
    setSubiendo(false)
    event.target.value = ''
  }

  return (
    <div className="bg-white rounded shadow-sm p-3 flex justify-between items-center">
      {dialogo && <Dialogo {...dialogo} onCancelar={() => setDialogo(null)} />}

      <div>
        <p className="text-sm font-medium">{evaluacion.nombre}</p>
        <p className="text-xs text-gray-400 capitalize">
          {evaluacion.tipo} {evaluacion.fecha_limite ? `· vence ${evaluacion.fecha_limite}` : ''}
        </p>
        {entrega && <p className="text-xs text-gray-500 mt-1">Entregado: {entrega.nombre_archivo}</p>}
      </div>

      <div className="text-right">
        {entrega?.calificacion != null ? (
          <span className="text-sm font-semibold text-green-600">Nota: {entrega.calificacion}</span>
        ) : (
          <>
            <label className="cursor-pointer text-brand text-sm hover:underline">
              {subiendo ? 'Subiendo...' : entrega ? 'Reemplazar entrega' : '+ Subir entrega'}
              <input type="file" className="hidden" onChange={subirArchivo} disabled={subiendo} />
            </label>
            {entrega && <p className="text-xs text-gray-400 mt-1">Pendiente de calificación</p>}
          </>
        )}
      </div>
    </div>
  )
}

export default function DetalleMateria() {
  const { id } = useParams()
  const [materia, setMateria] = useState(null)
  const [guias, setGuias] = useState([])
  const [evaluaciones, setEvaluaciones] = useState([])
  const [esAdmin, setEsAdmin] = useState(false)
  const [esDocente, setEsDocente] = useState(false)
  const [userId, setUserId] = useState(null)
  const [tab, setTab] = useState('guias')
  const [subiendo, setSubiendo] = useState(false)
  const [modalEvaluacionAbierto, setModalEvaluacionAbierto] = useState(false)
  const [dialogo, setDialogo] = useState(null)

  useEffect(() => {
    cargarTodo()
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      cargarTodo()
    })
    return () => listener.subscription.unsubscribe()
  }, [id])

  async function cargarTodo() {
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData?.user?.id
    setUserId(uid)

    if (uid) {
      const { data: perfil } = await supabase.from('profiles').select('role').eq('id', uid).single()
      setEsAdmin(perfil?.role === 'admin')
      setEsDocente(perfil?.role === 'docente')
    }

    const { data: m } = await supabase.from('materias').select('*').eq('id', id).single()
    const { data: g } = await supabase
      .from('guias')
      .select('*')
      .eq('materia_id', id)
      .order('created_at', { ascending: false })
    const { data: e } = await supabase
      .from('evaluaciones')
      .select('*')
      .eq('materia_id', id)
      .order('fecha_limite', { ascending: true })

    setMateria(m)
    setGuias(g || [])
    setEvaluaciones(e || [])
  }

  async function handleSubirGuia(event) {
    const file = event.target.files[0]
    if (!file) return
    setSubiendo(true)

    const ext = file.name.split('.').pop().toLowerCase()
    const tipo = ['doc', 'docx'].includes(ext)
      ? 'word'
      : ['xls', 'xlsx'].includes(ext)
      ? 'excel'
      : ext === 'pdf'
      ? 'pdf'
      : 'otro'
    const storagePath = `${id}/${Date.now()}_${file.name}`

    const { error: errorSubida } = await supabase.storage.from('guias').upload(storagePath, file)

    if (!errorSubida) {
      await supabase.from('guias').insert({
        materia_id: id,
        nombre_archivo: file.name,
        tipo,
        storage_path: storagePath,
        subido_por: userId,
      })
      cargarTodo()
    } else {
      setDialogo({ tipo: 'alert', mensaje: 'Error al subir el archivo: ' + errorSubida.message, onConfirmar: () => setDialogo(null) })
    }
    setSubiendo(false)
    event.target.value = ''
  }

  async function descargarGuia(guia) {
    const { data, error } = await supabase.storage.from('guias').download(guia.storage_path)
    if (error) {
      return setDialogo({ tipo: 'alert', mensaje: 'No se pudo descargar: ' + error.message, onConfirmar: () => setDialogo(null) })
    }
    await descargarArchivo(data, guia.nombre_archivo)
  }

  function pedirBorrarGuia(guia) {
    setDialogo({
      tipo: 'confirm',
      titulo: 'Borrar guía',
      mensaje: `¿Borrar "${guia.nombre_archivo}"?`,
      onConfirmar: async () => {
        await supabase.storage.from('guias').remove([guia.storage_path])
        await supabase.from('guias').delete().eq('id', guia.id)
        setDialogo(null)
        cargarTodo()
      },
    })
  }

  function pedirBorrarEvaluacion(evaluacion) {
    setDialogo({
      tipo: 'confirm',
      titulo: 'Borrar evaluación',
      mensaje: `¿Borrar "${evaluacion.nombre}" y todas sus entregas?`,
      onConfirmar: async () => {
        await supabase.from('evaluaciones').delete().eq('id', evaluacion.id)
        setDialogo(null)
        cargarTodo()
      },
    })
  }

  if (!materia) return <p className="text-gray-500 p-6">Cargando...</p>

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {dialogo && <Dialogo {...dialogo} onCancelar={() => setDialogo(null)} />}
      {modalEvaluacionAbierto && (
        <ModalEvaluacion
          materiaId={id}
          onClose={() => setModalEvaluacionAbierto(false)}
          onCreada={() => {
            setModalEvaluacionAbierto(false)
            cargarTodo()
          }}
        />
      )}

      <Link to="/" className="text-brand text-sm hover:underline">&larr; Volver al índice</Link>
      <h1 className="text-2xl font-bold mt-2 mb-1">{materia.nombre}</h1>
      <p className="text-gray-500 mb-6">
        {NOMBRE_ANIO[materia.anio]}
        {materia.profesor ? ` · Prof. ${materia.profesor}` : ''}
      </p>

      <div className="flex gap-2 mb-4 border-b">
        <button
          onClick={() => setTab('guias')}
          className={`px-4 py-2 text-sm ${tab === 'guias' ? 'border-b-2 border-brand text-brand font-medium' : 'text-gray-500'}`}
        >
          📎 Guías ({guias.length})
        </button>
        <button
          onClick={() => setTab('evaluaciones')}
          className={`px-4 py-2 text-sm ${tab === 'evaluaciones' ? 'border-b-2 border-brand text-brand font-medium' : 'text-gray-500'}`}
        >
          📝 Evaluaciones ({evaluaciones.length})
        </button>
      </div>

      {tab === 'guias' && (
        <div>
          {(esAdmin || esDocente) && (
            <label className="inline-block mb-4 cursor-pointer bg-brand text-white px-4 py-2 rounded text-sm hover:bg-brand-dark transition">
              {subiendo ? 'Subiendo...' : '+ Subir guía (Word / Excel / PDF)'}
              <input
                type="file"
                className="hidden"
                onChange={handleSubirGuia}
                disabled={subiendo}
                accept=".doc,.docx,.xls,.xlsx,.pdf"
              />
            </label>
          )}

          <div className="grid gap-2">
            {guias.map((g) => (
              <div key={g.id} className="bg-white rounded shadow-sm p-3 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{ICONO_TIPO[g.tipo] || ICONO_TIPO.otro}</span>
                  <div>
                    <p className="text-sm font-medium">{g.nombre_archivo}</p>
                    <p className="text-xs text-gray-400">{new Date(g.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => descargarGuia(g)} className="text-brand text-sm hover:underline">
                    Descargar
                  </button>
                  {(esAdmin || esDocente) && (
                    <button onClick={() => pedirBorrarGuia(g)} className="text-red-500 text-sm hover:underline">
                      Borrar
                    </button>
                  )}
                </div>
              </div>
            ))}
            {guias.length === 0 && <p className="text-gray-400 text-center py-6">Aún no hay guías subidas.</p>}
          </div>
        </div>
      )}

      {tab === 'evaluaciones' && (
        <div>
          {(esAdmin || esDocente) && (
            <button
              onClick={() => setModalEvaluacionAbierto(true)}
              className="mb-4 bg-brand text-white px-4 py-2 rounded text-sm hover:bg-brand-dark transition"
            >
              + Agregar evaluación
            </button>
          )}

          <div className="grid gap-2">
            {evaluaciones.map((ev) =>
              (esAdmin || esDocente) ? (
                <FilaEvaluacionAdmin key={ev.id} evaluacion={ev} onBorrar={pedirBorrarEvaluacion} />
              ) : (
                <FilaEvaluacionEstudiante key={ev.id} evaluacion={ev} userId={userId} />
              )
            )}
            {evaluaciones.length === 0 && (
              <p className="text-gray-400 text-center py-6">Aún no hay evaluaciones registradas.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
