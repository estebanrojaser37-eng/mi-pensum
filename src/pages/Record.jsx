import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import Dialogo from '../components/Dialogo.jsx'

const NOMBRE_ANIO = { 1: 'Primer año', 2: 'Segundo año', 3: 'Tercer año' }

function agruparPorMateria(entregas) {
  const grupos = {}
  let sumaTotal = 0
  let contTotal = 0

  for (const e of entregas) {
    const materia = e.evaluaciones?.materias
    if (!materia) continue

    if (!grupos[materia.id]) {
      grupos[materia.id] = { id: materia.id, nombre: materia.nombre, anio: materia.anio, notas: [] }
    }
    grupos[materia.id].notas.push({ evaluacion: e.evaluaciones.nombre, calificacion: e.calificacion })

    if (e.calificacion != null) {
      sumaTotal += Number(e.calificacion)
      contTotal += 1
    }
  }

  const lista = Object.values(grupos).map((m) => {
    const calificadas = m.notas.filter((n) => n.calificacion != null)
    const promedio = calificadas.length
      ? calificadas.reduce((s, n) => s + Number(n.calificacion), 0) / calificadas.length
      : null
    return { ...m, promedio }
  })

  lista.sort((a, b) => a.anio - b.anio || a.nombre.localeCompare(b.nombre))
  return { lista, promedioGeneral: contTotal ? sumaTotal / contTotal : null }
}

function VistaMaterias({ nombreEstudiante, porMateria, promedioGeneral, onVolver }) {
  return (
    <div>
      {onVolver && (
        <button onClick={onVolver} className="text-brand text-sm hover:underline mb-4 block">
          &larr; Volver a la lista de estudiantes
        </button>
      )}
      <h1 className="text-2xl font-bold mb-1">
        {nombreEstudiante ? `Récord de ${nombreEstudiante}` : 'Récord académico'}
      </h1>
      <p className="text-gray-500 mb-6">
        Promedio general:{' '}
        <span className="font-semibold text-brand">
          {promedioGeneral != null ? promedioGeneral.toFixed(2) : '— (sin calificar aún)'}
        </span>
      </p>

      {porMateria.length === 0 && <p className="text-gray-400">Aún no hay entregas calificadas.</p>}

      {[1, 2, 3].map((anio) => {
        const materiasAnio = porMateria.filter((m) => m.anio === anio)
        if (materiasAnio.length === 0) return null
        return (
          <div key={anio} className="mb-8">
            <h2 className="text-lg font-semibold mb-3 text-gray-700">{NOMBRE_ANIO[anio]}</h2>
            <div className="grid gap-3">
              {materiasAnio.map((m) => (
                <div key={m.id} className="bg-white border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <p className="font-medium">{m.nombre}</p>
                    <span className="text-sm font-semibold text-brand">
                      {m.promedio != null ? m.promedio.toFixed(2) : 'Sin calificar'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 space-y-1">
                    {m.notas.map((n, i) => (
                      <div key={i} className="flex justify-between">
                        <span>{n.evaluacion}</span>
                        <span>{n.calificacion != null ? n.calificacion : 'Pendiente'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function Record() {
  const [cargando, setCargando] = useState(true)
  const [esAdmin, setEsAdmin] = useState(false)
  const [esDocente, setEsDocente] = useState(false)
  const [estudiantes, setEstudiantes] = useState([])
  const [estudianteSeleccionado, setEstudianteSeleccionado] = useState(null)
  const [propioRecord, setPropioRecord] = useState(null)
  const [dialogo, setDialogo] = useState(null)

  function editarNombre(estudiante) {
    if (!esAdmin) return
    setDialogo({
      tipo: 'prompt',
      titulo: 'Nombre completo',
      valorInicial: estudiante.nombre,
      onConfirmar: async (nuevoNombre) => {
        await supabase.from('profiles').update({ nombre: nuevoNombre }).eq('id', estudiante.id)
        setDialogo(null)
        cargarRecord()
      },
    })
  }

  useEffect(() => {
    cargarRecord()
  }, [])

  async function cargarRecord() {
    setCargando(true)

    const { data: userData } = await supabase.auth.getUser()
    const uid = userData?.user?.id
    if (!uid) {
      setCargando(false)
      return
    }

    const { data: perfil } = await supabase.from('profiles').select('role').eq('id', uid).single()
    const admin = perfil?.role === 'admin'
    const docente = perfil?.role === 'docente'
    setEsAdmin(admin)
    setEsDocente(docente)

    if (admin || docente) {
      const { data: perfilesEstudiantes } = await supabase
        .from('profiles')
        .select('id, nombre')
        .eq('role', 'usuario')

      const { data: entregas } = await supabase
        .from('entregas')
        .select('calificacion, user_id, evaluaciones(nombre, materias(id, nombre, anio))')

      const entregasPorUsuario = {}
      for (const e of entregas || []) {
        entregasPorUsuario[e.user_id] = entregasPorUsuario[e.user_id] || []
        entregasPorUsuario[e.user_id].push(e)
      }

      const lista = (perfilesEstudiantes || []).map((p) => {
        const misEntregas = entregasPorUsuario[p.id] || []
        const { promedioGeneral } = agruparPorMateria(misEntregas)
        return { id: p.id, nombre: p.nombre || 'Sin nombre', promedioGeneral, entregas: misEntregas }
      })

      lista.sort((a, b) => a.nombre.localeCompare(b.nombre))
      setEstudiantes(lista)
    } else {
      const { data: entregas } = await supabase
        .from('entregas')
        .select('calificacion, evaluaciones(nombre, materias(id, nombre, anio))')
        .eq('user_id', uid)

      setPropioRecord(agruparPorMateria(entregas || []))
    }

    setCargando(false)
  }

  if (cargando) return <div className="p-6 text-gray-500">Cargando récord académico...</div>

  if (!esAdmin && !esDocente) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <VistaMaterias porMateria={propioRecord.lista} promedioGeneral={propioRecord.promedioGeneral} />
      </div>
    )
  }

  if (estudianteSeleccionado) {
    const { lista, promedioGeneral } = agruparPorMateria(estudianteSeleccionado.entregas)
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <VistaMaterias
          nombreEstudiante={estudianteSeleccionado.nombre}
          porMateria={lista}
          promedioGeneral={promedioGeneral}
          onVolver={() => setEstudianteSeleccionado(null)}
        />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {dialogo && <Dialogo {...dialogo} onCancelar={() => setDialogo(null)} />}
      <h1 className="text-2xl font-bold mb-1">Récord académico — Estudiantes</h1>
      <p className="text-gray-500 mb-6">{estudiantes.length} estudiante(s) registrado(s)</p>

      {estudiantes.length === 0 && (
        <p className="text-gray-400">Aún no hay estudiantes registrados.</p>
      )}

      <div className="grid gap-2">
        {estudiantes.map((est) => (
          <div
            key={est.id}
            className="bg-white border rounded-lg p-4 flex justify-between items-center hover:shadow-md transition"
          >
            <button onClick={() => setEstudianteSeleccionado(est)} className="text-left flex-1">
              <span className="font-medium">{est.nombre}</span>
            </button>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-brand">
                {est.promedioGeneral != null ? est.promedioGeneral.toFixed(2) : 'Sin calificar'}
              </span>
              {esAdmin && (
                <button
                  onClick={() => editarNombre(est)}
                  className="text-xs text-gray-400 hover:text-brand hover:underline"
                >
                  Editar nombre
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
