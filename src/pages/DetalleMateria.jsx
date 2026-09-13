import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import Dialogo from '../components/Dialogo.jsx'
import { descargarArchivo } from '../lib/descargas.js'

const ICONO_TIPO = { word: '📄', excel: '📊', pdf: '📕', otro: '📎' }
const NOMBRE_ANIO = { 1: 'Primer año', 2: 'Segundo año', 3: 'Tercer año' }
const ETIQUETAS_TIPO_PREGUNTA = {
  seleccion_simple: 'Selección simple',
  verdadero_falso: 'Verdadero / Falso',
  respuesta_corta: 'Respuesta corta',
}

function sanitizarNombreArchivo(nombre) {
  const sinAcentos = nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return sinAcentos.replace(/[^a-zA-Z0-9.\-_]/g, '_').replace(/_+/g, '_')
}

// ============================================================
// Lector de PDF en línea (para guías) — usando el visor nativo del navegador
// ============================================================
function VisorPDF({ url, nombre, onCerrar }) {
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex flex-col p-2 sm:p-6">
      <div className="bg-white rounded-lg flex-1 flex flex-col overflow-hidden">
        <div className="flex justify-between items-center px-4 py-2 border-b">
          <p className="text-sm font-medium truncate pr-2">{nombre}</p>
          <button onClick={onCerrar} className="text-gray-500 hover:text-black text-sm flex-shrink-0">
            ✕ Cerrar
          </button>
        </div>
        <iframe src={url} title={nombre} className="flex-1 w-full" />
      </div>
    </div>
  )
}

// ============================================================
// Modal para crear una evaluación (archivo simple o examen estructurado)
// ============================================================
function ModalEvaluacion({ onClose, onCreada, materiaId }) {
  const [nombre, setNombre] = useState('')
  const [fechaLimite, setFechaLimite] = useState('')
  const [formato, setFormato] = useState('archivo') // 'archivo' | 'examen'
  const [preguntas, setPreguntas] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  function agregarPregunta() {
    setPreguntas((prev) => [
      ...prev,
      { tipo: 'seleccion_simple', enunciado: '', opciones: ['', ''], respuesta_correcta: '', puntos: 1 },
    ])
  }

  function actualizarPregunta(index, cambios) {
    setPreguntas((prev) => prev.map((p, i) => (i === index ? { ...p, ...cambios } : p)))
  }

  function borrarPregunta(index) {
    setPreguntas((prev) => prev.filter((_, i) => i !== index))
  }

  function actualizarOpcion(indexPregunta, indexOpcion, valor) {
    setPreguntas((prev) =>
      prev.map((p, i) => {
        if (i !== indexPregunta) return p
        const nuevasOpciones = [...p.opciones]
        nuevasOpciones[indexOpcion] = valor
        return { ...p, opciones: nuevasOpciones }
      })
    )
  }

  function agregarOpcion(indexPregunta) {
    setPreguntas((prev) =>
      prev.map((p, i) => (i === indexPregunta ? { ...p, opciones: [...p.opciones, ''] } : p))
    )
  }

  function quitarOpcion(indexPregunta, indexOpcion) {
    setPreguntas((prev) =>
      prev.map((p, i) => {
        if (i !== indexPregunta) return p
        return { ...p, opciones: p.opciones.filter((_, oi) => oi !== indexOpcion) }
      })
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!nombre.trim()) return setError('El nombre es obligatorio.')

    if (formato === 'examen') {
      if (preguntas.length === 0) return setError('Añade al menos una pregunta.')
      for (const p of preguntas) {
        if (!p.enunciado.trim()) return setError('Todas las preguntas necesitan un enunciado.')
        if (p.tipo === 'seleccion_simple') {
          const opcionesValidas = p.opciones.filter((o) => o.trim())
          if (opcionesValidas.length < 2) return setError('Cada pregunta de selección simple necesita al menos 2 opciones.')
          if (!p.respuesta_correcta.trim()) return setError('Marca la respuesta correcta en cada pregunta de selección simple.')
        }
        if (p.tipo === 'verdadero_falso' && !p.respuesta_correcta) {
          return setError('Marca si la respuesta correcta es Verdadero o Falso en cada pregunta.')
        }
      }
    }

    setGuardando(true)

    const { data: evaluacionCreada, error: errorInsert } = await supabase
      .from('evaluaciones')
      .insert({ materia_id: materiaId, nombre: nombre.trim(), tipo: 'examen', fecha_limite: fechaLimite || null, formato })
      .select()
      .single()

    if (errorInsert) {
      setGuardando(false)
      return setError(errorInsert.message)
    }

    if (formato === 'examen') {
      const filasPreguntas = preguntas.map((p, i) => ({
        evaluacion_id: evaluacionCreada.id,
        orden: i,
        tipo: p.tipo,
        enunciado: p.enunciado.trim(),
        opciones: p.tipo === 'seleccion_simple' ? p.opciones.filter((o) => o.trim()) : null,
        respuesta_correcta: p.tipo === 'respuesta_corta' ? null : p.respuesta_correcta,
        puntos: Number(p.puntos) || 1,
      }))

      const { error: errorPreguntas } = await supabase.from('preguntas').insert(filasPreguntas)
      setGuardando(false)
      if (errorPreguntas) return setError(errorPreguntas.message)
      return onCreada()
    }

    setGuardando(false)
    onCreada()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
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

          <label className="block text-sm font-medium mb-2">Formato</label>
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setFormato('archivo')}
              className={`flex-1 py-2 rounded text-sm border ${formato === 'archivo' ? 'bg-brand text-white border-brand' : 'text-gray-600 border-gray-300'}`}
            >
              📎 Subir archivo
            </button>
            <button
              type="button"
              onClick={() => setFormato('examen')}
              className={`flex-1 py-2 rounded text-sm border ${formato === 'examen' ? 'bg-brand text-white border-brand' : 'text-gray-600 border-gray-300'}`}
            >
              📝 Examen en la app
            </button>
          </div>

          {formato === 'examen' && (
            <div className="mb-4">
              {preguntas.map((p, index) => (
                <div key={index} className="border rounded-lg p-3 mb-3 bg-gray-50">
                  <div className="flex justify-between items-center mb-2">
                    <select
                      value={p.tipo}
                      onChange={(e) => actualizarPregunta(index, { tipo: e.target.value, respuesta_correcta: '', opciones: ['', ''] })}
                      className="text-sm border rounded px-2 py-1"
                    >
                      <option value="seleccion_simple">Selección simple</option>
                      <option value="verdadero_falso">Verdadero / Falso</option>
                      <option value="respuesta_corta">Respuesta corta</option>
                    </select>
                    <button type="button" onClick={() => borrarPregunta(index)} className="text-red-500 text-xs">
                      Borrar pregunta
                    </button>
                  </div>

                  <input
                    type="text"
                    placeholder="Escribe la pregunta"
                    value={p.enunciado}
                    onChange={(e) => actualizarPregunta(index, { enunciado: e.target.value })}
                    className="w-full border rounded px-2 py-1.5 text-sm mb-2"
                  />

                  {p.tipo === 'seleccion_simple' && (
                    <div className="pl-2">
                      {p.opciones.map((op, oi) => (
                        <div key={oi} className="flex items-center gap-2 mb-1.5">
                          <input
                            type="radio"
                            name={`correcta-${index}`}
                            checked={p.respuesta_correcta === op && op !== ''}
                            onChange={() => actualizarPregunta(index, { respuesta_correcta: op })}
                          />
                          <input
                            type="text"
                            placeholder={`Opción ${oi + 1}`}
                            value={op}
                            onChange={(e) => {
                              actualizarOpcion(index, oi, e.target.value)
                              if (p.respuesta_correcta === op) actualizarPregunta(index, { respuesta_correcta: e.target.value })
                            }}
                            className="flex-1 border rounded px-2 py-1 text-sm"
                          />
                          {p.opciones.length > 2 && (
                            <button type="button" onClick={() => quitarOpcion(index, oi)} className="text-red-400 text-xs">✕</button>
                          )}
                        </div>
                      ))}
                      <button type="button" onClick={() => agregarOpcion(index)} className="text-brand text-xs mt-1">
                        + Añadir opción
                      </button>
                      <p className="text-xs text-gray-400 mt-1">Marca el círculo junto a la opción correcta.</p>
                    </div>
                  )}

                  {p.tipo === 'verdadero_falso' && (
                    <div className="flex gap-3 pl-2">
                      <label className="flex items-center gap-1.5 text-sm">
                        <input
                          type="radio"
                          name={`vf-${index}`}
                          checked={p.respuesta_correcta === 'verdadero'}
                          onChange={() => actualizarPregunta(index, { respuesta_correcta: 'verdadero' })}
                        />
                        Verdadero
                      </label>
                      <label className="flex items-center gap-1.5 text-sm">
                        <input
                          type="radio"
                          name={`vf-${index}`}
                          checked={p.respuesta_correcta === 'falso'}
                          onChange={() => actualizarPregunta(index, { respuesta_correcta: 'falso' })}
                        />
                        Falso
                      </label>
                    </div>
                  )}

                  {p.tipo === 'respuesta_corta' && (
                    <p className="text-xs text-gray-400 pl-2">Esta pregunta se calificará manualmente después de que el alumno responda.</p>
                  )}

                  <div className="flex items-center gap-2 mt-2 pl-2">
                    <label className="text-xs text-gray-500">Puntos:</label>
                    <input
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={p.puntos}
                      onChange={(e) => actualizarPregunta(index, { puntos: e.target.value })}
                      className="w-16 border rounded px-2 py-1 text-sm"
                    />
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={agregarPregunta}
                className="w-full border-2 border-dashed border-gray-300 rounded-lg py-2 text-sm text-gray-500 hover:border-brand hover:text-brand"
              >
                + Añadir pregunta
              </button>
            </div>
          )}

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

// ============================================================
// Vista del docente/admin para un examen estructurado: ver respuestas y calificar
// ============================================================
function ExamenAdmin({ evaluacion, onBorrar }) {
  const [abierto, setAbierto] = useState(false)
  const [preguntas, setPreguntas] = useState([])
  const [entregas, setEntregas] = useState([])
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState(null)
  const [respuestasAlumno, setRespuestasAlumno] = useState([])
  const [cargando, setCargando] = useState(false)
  const [puntosManuales, setPuntosManuales] = useState({})
  const [guardandoNota, setGuardandoNota] = useState(false)

  async function cargarPreguntasYEntregas() {
    setCargando(true)
    const [{ data: p }, { data: e }] = await Promise.all([
      supabase.from('preguntas').select('*').eq('evaluacion_id', evaluacion.id).order('orden', { ascending: true }),
      supabase.from('examenes_entregados').select('*, profiles(nombre)').eq('evaluacion_id', evaluacion.id),
    ])
    setPreguntas(p || [])
    setEntregas(e || [])
    setCargando(false)
  }

  function toggle() {
    if (!abierto) cargarPreguntasYEntregas()
    setAbierto(!abierto)
  }

  async function verRespuestasDe(entrega) {
    setAlumnoSeleccionado(entrega)
    const { data } = await supabase
      .from('respuestas_examen')
      .select('*')
      .eq('user_id', entrega.user_id)
      .in('pregunta_id', preguntas.map((p) => p.id))
    setRespuestasAlumno(data || [])
    const iniciales = {}
    for (const r of data || []) {
      if (r.puntaje_obtenido != null) iniciales[r.pregunta_id] = r.puntaje_obtenido
    }
    setPuntosManuales(iniciales)
  }

  async function guardarCalificacionManual() {
    setGuardandoNota(true)

    for (const pregunta of preguntas) {
      if (pregunta.tipo !== 'respuesta_corta') continue
      const puntos = Number(puntosManuales[pregunta.id]) || 0
      const respuesta = respuestasAlumno.find((r) => r.pregunta_id === pregunta.id)
      if (respuesta) {
        await supabase
          .from('respuestas_examen')
          .update({ puntaje_obtenido: puntos })
          .eq('id', respuesta.id)
      }
    }

    // Recalcula la nota final = suma de todos los puntajes obtenidos
    const { data: todasLasRespuestas } = await supabase
      .from('respuestas_examen')
      .select('puntaje_obtenido')
      .eq('user_id', alumnoSeleccionado.user_id)
      .in('pregunta_id', preguntas.map((p) => p.id))

    const notaFinal = (todasLasRespuestas || []).reduce((s, r) => s + (Number(r.puntaje_obtenido) || 0), 0)

    await supabase
      .from('examenes_entregados')
      .update({ calificacion_final: notaFinal })
      .eq('id', alumnoSeleccionado.id)

    setGuardandoNota(false)
    setAlumnoSeleccionado(null)
    cargarPreguntasYEntregas()
  }

  return (
    <div className="bg-white rounded shadow-sm p-3">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm font-medium">{evaluacion.nombre} <span className="text-xs text-gray-400">(examen)</span></p>
          <p className="text-xs text-gray-400">{evaluacion.fecha_limite ? `vence ${evaluacion.fecha_limite}` : 'sin fecha límite'}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={toggle} className="text-brand text-sm hover:underline">
            {abierto ? 'Ocultar' : 'Ver entregas'}
          </button>
          <button onClick={() => onBorrar(evaluacion)} className="text-red-500 text-sm hover:underline">Borrar</button>
        </div>
      </div>

      {abierto && (
        <div className="mt-3 border-t pt-3">
          {cargando && <p className="text-xs text-gray-400">Cargando...</p>}
          {!cargando && entregas.length === 0 && <p className="text-xs text-gray-400">Nadie ha enviado el examen todavía.</p>}
          {entregas.map((e) => (
            <div key={e.id} className="flex justify-between items-center py-1.5 text-sm border-b last:border-0">
              <span>{e.profiles?.nombre || 'Estudiante'}</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">
                  {e.calificacion_final != null ? `Nota: ${e.calificacion_final}` : 'Pendiente de calificar'}
                </span>
                <button onClick={() => verRespuestasDe(e)} className="text-brand text-xs hover:underline">Revisar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {alumnoSeleccionado && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto">
            <h3 className="font-bold mb-4">Respuestas de {alumnoSeleccionado.profiles?.nombre}</h3>
            {preguntas.map((p) => {
              const r = respuestasAlumno.find((x) => x.pregunta_id === p.id)
              return (
                <div key={p.id} className="mb-4 pb-3 border-b last:border-0">
                  <p className="text-sm font-medium mb-1">{p.enunciado}</p>
                  <p className="text-xs text-gray-500 mb-1">Tipo: {ETIQUETAS_TIPO_PREGUNTA[p.tipo]} · {p.puntos} pts</p>
                  <p className="text-sm mb-1">
                    Respuesta del alumno: <span className="font-medium">{r?.respuesta || '(sin responder)'}</span>
                  </p>
                  {p.tipo !== 'respuesta_corta' ? (
                    <p className={`text-xs font-medium ${r?.es_correcta ? 'text-green-600' : 'text-red-500'}`}>
                      {r?.es_correcta ? `✓ Correcta (${p.puntos} pts)` : `✗ Incorrecta (0 pts) — correcta: ${p.respuesta_correcta}`}
                    </p>
                  ) : (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500">Puntos otorgados (máx {p.puntos}):</label>
                      <input
                        type="number"
                        min="0"
                        max={p.puntos}
                        step="0.5"
                        value={puntosManuales[p.id] ?? ''}
                        onChange={(e) => setPuntosManuales((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        className="w-16 border rounded px-2 py-1 text-sm"
                      />
                    </div>
                  )}
                </div>
              )
            })}
            <div className="flex justify-end gap-2">
              <button onClick={() => setAlumnoSeleccionado(null)} className="px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-100">
                Cerrar
              </button>
              <button
                onClick={guardarCalificacionManual}
                disabled={guardandoNota}
                className="px-4 py-2 rounded text-sm bg-brand text-white hover:bg-brand-dark disabled:opacity-50"
              >
                {guardandoNota ? 'Guardando...' : 'Guardar calificación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Vista del alumno para tomar un examen estructurado
// ============================================================
function ExamenEstudiante({ evaluacion, userId }) {
  const [preguntas, setPreguntas] = useState([])
  const [respuestas, setRespuestas] = useState({})
  const [yaEntregado, setYaEntregado] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [dialogo, setDialogo] = useState(null)

  useEffect(() => {
    cargarExamen()
  }, [])

  async function cargarExamen() {
    setCargando(true)
    const [{ data: p }, { data: entrega }] = await Promise.all([
      supabase.from('preguntas').select('*').eq('evaluacion_id', evaluacion.id).order('orden', { ascending: true }),
      supabase.from('examenes_entregados').select('*').eq('evaluacion_id', evaluacion.id).eq('user_id', userId).maybeSingle(),
    ])
    setPreguntas(p || [])
    setYaEntregado(entrega)

    if (entrega) {
      const { data: r } = await supabase
        .from('respuestas_examen')
        .select('*')
        .eq('user_id', userId)
        .in('pregunta_id', (p || []).map((preg) => preg.id))
      const mapa = {}
      for (const respuesta of r || []) mapa[respuesta.pregunta_id] = respuesta.respuesta
      setRespuestas(mapa)
    }

    setCargando(false)
  }

  function responder(preguntaId, valor) {
    setRespuestas((prev) => ({ ...prev, [preguntaId]: valor }))
  }

  async function enviarExamen() {
    const faltantes = preguntas.filter((p) => !respuestas[p.id]?.toString().trim())
    if (faltantes.length > 0) {
      setDialogo({ tipo: 'alert', mensaje: 'Responde todas las preguntas antes de enviar.', onConfirmar: () => setDialogo(null) })
      return
    }

    setDialogo({
      tipo: 'confirm',
      titulo: 'Enviar examen',
      mensaje: 'Una vez enviado no podrás cambiar tus respuestas. ¿Confirmas?',
      onConfirmar: async () => {
        setDialogo(null)
        setEnviando(true)

        let notaAutomatica = 0
        const filas = preguntas.map((p) => {
          const respuestaDada = respuestas[p.id]
          let esCorrecta = null
          let puntajeObtenido = null

          if (p.tipo !== 'respuesta_corta') {
            esCorrecta = respuestaDada === p.respuesta_correcta
            puntajeObtenido = esCorrecta ? Number(p.puntos) : 0
            notaAutomatica += puntajeObtenido
          }

          return {
            pregunta_id: p.id,
            user_id: userId,
            respuesta: respuestaDada,
            es_correcta: esCorrecta,
            puntaje_obtenido: puntajeObtenido,
          }
        })

        const { error: errorRespuestas } = await supabase.from('respuestas_examen').insert(filas)
        if (errorRespuestas) {
          setEnviando(false)
          setDialogo({ tipo: 'alert', mensaje: 'Error al enviar: ' + errorRespuestas.message, onConfirmar: () => setDialogo(null) })
          return
        }

        const hayRespuestaCorta = preguntas.some((p) => p.tipo === 'respuesta_corta')

        const { data: entrega, error: errorEntrega } = await supabase
          .from('examenes_entregados')
          .insert({
            evaluacion_id: evaluacion.id,
            user_id: userId,
            calificacion_final: hayRespuestaCorta ? null : notaAutomatica,
          })
          .select()
          .single()

        setEnviando(false)
        if (errorEntrega) {
          setDialogo({ tipo: 'alert', mensaje: 'Error al entregar: ' + errorEntrega.message, onConfirmar: () => setDialogo(null) })
          return
        }
        setYaEntregado(entrega)
      },
    })
  }

  if (cargando) return <p className="text-xs text-gray-400">Cargando examen...</p>

  return (
    <div className="bg-white rounded shadow-sm p-4">
      {dialogo && <Dialogo {...dialogo} onCancelar={() => setDialogo(null)} />}
      <div className="flex justify-between items-center mb-3">
        <p className="text-sm font-medium">{evaluacion.nombre}</p>
        {yaEntregado && (
          <span className="text-xs font-semibold text-green-600">
            {yaEntregado.calificacion_final != null ? `Nota: ${yaEntregado.calificacion_final}` : 'Entregado — pendiente de calificar'}
          </span>
        )}
      </div>

      {preguntas.map((p, i) => (
        <div key={p.id} className="mb-4 pb-3 border-b last:border-0">
          <p className="text-sm font-medium mb-2">{i + 1}. {p.enunciado}</p>

          {p.tipo === 'seleccion_simple' && (
            <div className="pl-2">
              {(p.opciones || []).map((op) => (
                <label key={op} className="flex items-center gap-2 text-sm mb-1.5">
                  <input
                    type="radio"
                    name={`pregunta-${p.id}`}
                    checked={respuestas[p.id] === op}
                    disabled={!!yaEntregado}
                    onChange={() => responder(p.id, op)}
                  />
                  {op}
                </label>
              ))}
            </div>
          )}

          {p.tipo === 'verdadero_falso' && (
            <div className="flex gap-4 pl-2">
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name={`pregunta-${p.id}`}
                  checked={respuestas[p.id] === 'verdadero'}
                  disabled={!!yaEntregado}
                  onChange={() => responder(p.id, 'verdadero')}
                />
                Verdadero
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name={`pregunta-${p.id}`}
                  checked={respuestas[p.id] === 'falso'}
                  disabled={!!yaEntregado}
                  onChange={() => responder(p.id, 'falso')}
                />
                Falso
              </label>
            </div>
          )}

          {p.tipo === 'respuesta_corta' && (
            <textarea
              value={respuestas[p.id] || ''}
              disabled={!!yaEntregado}
              onChange={(e) => responder(p.id, e.target.value)}
              rows={2}
              className="w-full border rounded px-2 py-1.5 text-sm disabled:bg-gray-50"
              placeholder="Escribe tu respuesta"
            />
          )}
        </div>
      ))}

      {!yaEntregado && (
        <button
          onClick={enviarExamen}
          disabled={enviando}
          className="w-full bg-brand text-white text-sm font-medium py-2 rounded hover:bg-brand-dark transition disabled:opacity-50"
        >
          {enviando ? 'Enviando...' : 'Enviar respuestas'}
        </button>
      )}
    </div>
  )
}

// ============================================================
// (Se mantienen tal cual: ModalEvaluacion original de archivo ya fusionado arriba,
// FilaEvaluacionAdmin/FilaEvaluacionEstudiante para evaluaciones tipo 'archivo')
// ============================================================
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

    const nombreLimpio = sanitizarNombreArchivo(file.name)
    const storagePath = `${userId}/${evaluacion.id}_${nombreLimpio}`
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

// ============================================================
// Componente principal
// ============================================================
export default function DetalleMateria() {
  const { id } = useParams()
  const [materia, setMateria] = useState(null)
  const [guias, setGuias] = useState([])
  const [evaluaciones, setEvaluaciones] = useState([])
  const [esAdmin, setEsAdmin] = useState(false)
  const [esDocente, setEsDocente] = useState(false)
  const [esDocenteDeEstaMateria, setEsDocenteDeEstaMateria] = useState(false)
  const [userId, setUserId] = useState(null)
  const [tab, setTab] = useState('guias')
  const [subiendo, setSubiendo] = useState(false)
  const [modalEvaluacionAbierto, setModalEvaluacionAbierto] = useState(false)
  const [dialogo, setDialogo] = useState(null)
  const [pdfAbierto, setPdfAbierto] = useState(null) // { url, nombre }

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
      const admin = perfil?.role === 'admin'
      setEsAdmin(admin)
      setEsDocente(perfil?.role === 'docente')

      const { data: asignacion } = await supabase
        .from('materia_docentes')
        .select('id')
        .eq('materia_id', id)
        .eq('profile_id', uid)
        .maybeSingle()

      // El admin siempre tiene vista de docente; cualquier otra cuenta solo si está
      // asignada específicamente a ESTA materia (independiente de su rol global).
      setEsDocenteDeEstaMateria(admin || !!asignacion)
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
    const nombreLimpio = sanitizarNombreArchivo(file.name)
    const storagePath = `${id}/${Date.now()}_${nombreLimpio}`

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

  async function verGuia(guia) {
    if (guia.tipo !== 'pdf') {
      return setDialogo({
        tipo: 'alert',
        mensaje: 'La vista previa en línea solo está disponible para archivos PDF. Usa "Descargar" para este archivo.',
        onConfirmar: () => setDialogo(null),
      })
    }

    const { data, error } = await supabase.storage.from('guias').createSignedUrl(guia.storage_path, 3600)
    if (error) {
      return setDialogo({ tipo: 'alert', mensaje: 'No se pudo abrir el PDF: ' + error.message, onConfirmar: () => setDialogo(null) })
    }
    const urlVisorGoogle = `https://docs.google.com/viewer?url=${encodeURIComponent(data.signedUrl)}&embedded=true`
    setPdfAbierto({ url: urlVisorGoogle, nombre: guia.nombre_archivo })
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
      {pdfAbierto && (
        <VisorPDF url={pdfAbierto.url} nombre={pdfAbierto.nombre} onCerrar={() => setPdfAbierto(null)} />
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
          {esDocenteDeEstaMateria && (
            <div className="mb-4">
              <label className="inline-block cursor-pointer bg-brand text-white px-4 py-2 rounded text-sm hover:bg-brand-dark transition">
                {subiendo ? 'Subiendo...' : '+ Subir guía (Word / Excel / PDF)'}
                <input
                  type="file"
                  className="hidden"
                  onChange={handleSubirGuia}
                  disabled={subiendo}
                  accept=".doc,.docx,.xls,.xlsx,.pdf"
                />
              </label>
              <p className="text-xs text-gray-400 mt-1">Los estudiantes de esta materia podrán verla y descargarla de inmediato.</p>
            </div>
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
                  {g.tipo === 'pdf' && (
                    <button onClick={() => verGuia(g)} className="text-brand text-sm hover:underline" title="Leer en línea">
                      Ver
                    </button>
                  )}
                  <button onClick={() => descargarGuia(g)} className="text-brand text-sm hover:underline" title="Descarga el archivo a tu dispositivo">
                    Descargar
                  </button>
                  {esDocenteDeEstaMateria && (
                    <button onClick={() => pedirBorrarGuia(g)} className="text-red-500 text-sm hover:underline" title="Los estudiantes ya no podrán verla ni descargarla">
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
          {esDocenteDeEstaMateria && (
            <button
              onClick={() => setModalEvaluacionAbierto(true)}
              className="mb-4 bg-brand text-white px-4 py-2 rounded text-sm hover:bg-brand-dark transition"
            >
              + Agregar evaluación
            </button>
          )}

          <div className="grid gap-2">
            {evaluaciones.map((ev) => {
              if (ev.formato === 'examen') {
                return esDocenteDeEstaMateria
                  ? <ExamenAdmin key={ev.id} evaluacion={ev} onBorrar={pedirBorrarEvaluacion} />
                  : <ExamenEstudiante key={ev.id} evaluacion={ev} userId={userId} />
              }
              return esDocenteDeEstaMateria
                ? <FilaEvaluacionAdmin key={ev.id} evaluacion={ev} onBorrar={pedirBorrarEvaluacion} />
                : <FilaEvaluacionEstudiante key={ev.id} evaluacion={ev} userId={userId} />
            })}
            {evaluaciones.length === 0 && (
              <p className="text-gray-400 text-center py-6">Aún no hay evaluaciones registradas.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
