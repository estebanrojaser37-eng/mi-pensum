import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [modo, setModo] = useState('entrar') // 'entrar' | 'registrar'
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setCargando(true)

    const accion = modo === 'entrar'
      ? supabase.auth.signInWithPassword({ email, password })
      : supabase.auth.signUp({ email, password, options: { data: { nombre: email.split('@')[0] } } })

    const { error } = await accion
    setCargando(false)

    if (error) {
      setError(error.message)
      return
    }
    navigate('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm">
        <h1 className="text-2xl font-bold text-brand mb-1">📘 Mi Pensum</h1>
        <p className="text-gray-500 text-sm mb-6">
          {modo === 'entrar' ? 'Ingresa a tu cuenta' : 'Crea una cuenta nueva'}
        </p>

        <label className="block text-sm font-medium mb-1">Correo</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-brand"
        />

        <label className="block text-sm font-medium mb-1">Contraseña</label>
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border rounded px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-brand"
        />

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        <button
          type="submit"
          disabled={cargando}
          className="w-full bg-brand text-white py-2 rounded hover:bg-brand-dark transition disabled:opacity-50"
        >
          {cargando ? 'Un momento...' : modo === 'entrar' ? 'Entrar' : 'Registrarme'}
        </button>

        <p className="text-sm text-center mt-4 text-gray-500">
          {modo === 'entrar' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
          <button
            type="button"
            className="text-brand font-medium hover:underline"
            onClick={() => setModo(modo === 'entrar' ? 'registrar' : 'entrar')}
          >
            {modo === 'entrar' ? 'Regístrate' : 'Inicia sesión'}
          </button>
        </p>
      </form>
    </div>
  )
}
