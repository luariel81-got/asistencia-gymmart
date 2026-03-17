'use client'
import { useState, useEffect } from 'react'
import { getConfig, setConfig } from '@/lib/supabase'

export default function Config() {
  const [nombre, setNombre] = useState('')
  const [saved, setSaved]   = useState(false)

  useEffect(() => {
    getConfig('institucion_nombre').then(v => setNombre(v || 'Institución Educativa'))
  }, [])

  async function guardar() {
    await setConfig('institucion_nombre', nombre)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-4">⚙️ Configuración</h1>

      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <label className="text-sm font-medium text-gray-700 block mb-2">
          Nombre de la institución
        </label>
        <input value={nombre} onChange={e => setNombre(e.target.value)}
          className="w-full px-3 py-3 border border-gray-200 rounded-lg text-sm mb-4" />
        <button onClick={guardar}
          className={`w-full py-3 rounded-xl font-bold text-white transition-colors ${
            saved ? 'bg-green-500' : 'bg-blue-600'
          }`}>
          {saved ? '✅ Guardado' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}
