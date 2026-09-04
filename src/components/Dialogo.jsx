import { useState } from 'react'

/**
 * Reemplazo de prompt()/confirm()/alert() nativos, que no funcionan de forma
 * confiable dentro del WebView de Capacitor en Android.
 *
 * tipo: 'prompt' | 'confirm' | 'alert'
 */
export default function Dialogo({ tipo, titulo, mensaje, valorInicial = '', tipoInput = 'text', onConfirmar, onCancelar }) {
  const [valor, setValor] = useState(valorInicial)

  function confirmar() {
    if (tipo === 'prompt') {
      if (!valor.trim()) return
      onConfirmar(valor.trim())
    } else {
      onConfirmar()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-sm p-6">
        {titulo && <h2 className="text-lg font-bold mb-2">{titulo}</h2>}
        {mensaje && <p className="text-sm text-gray-600 mb-4">{mensaje}</p>}

        {tipo === 'prompt' && (
          <input
            type={tipoInput}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            autoFocus
            className="w-full border rounded px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-brand"
            onKeyDown={(e) => e.key === 'Enter' && confirmar()}
          />
        )}

        <div className="flex justify-end gap-2">
          {tipo !== 'alert' && (
            <button onClick={onCancelar} className="px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-100">
              Cancelar
            </button>
          )}
          <button
            onClick={confirmar}
            className="px-4 py-2 rounded text-sm bg-brand text-white hover:bg-brand-dark transition"
          >
            {tipo === 'alert' ? 'Entendido' : 'Aceptar'}
          </button>
        </div>
      </div>
    </div>
  )
}
