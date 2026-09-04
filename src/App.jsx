import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase.js'
import { setNavegador } from './lib/push.js'
import IndiceMaterias from './pages/IndiceMaterias.jsx'
import DetalleMateria from './pages/DetalleMateria.jsx'
import Record from './pages/Record.jsx'
import Login from './pages/Login.jsx'
import Layout from './components/Layout.jsx'
import Perfil from './pages/Perfil.jsx'
import SplashScreen from './components/SplashScreen.jsx'
import Mensajes from './pages/Mensajes.jsx'

export default function App() {
  const [sesionLista, setSesionLista] = useState(false)
  const [autenticado, setAutenticado] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAutenticado(!!data.session)
      setSesionLista(true)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAutenticado(!!session)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    setNavegador(navigate)
  }, [navigate])

  if (!sesionLista) return <SplashScreen />

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={autenticado ? <Layout /> : <Navigate to="/login" replace />}>
        <Route path="/" element={<IndiceMaterias />} />
        <Route path="/materia/:id" element={<DetalleMateria />} />
        <Route path="/record" element={<Record />} />
        <Route path="/perfil" element={<Perfil />} />
        <Route path="/mensajes" element={<Mensajes />} />
      </Route>
    </Routes>
  )
}
