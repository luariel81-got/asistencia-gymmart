'use client'
import { useState } from 'react'
import { GRADOS, hoyPY, getJustificadosDia, getAusentesDia } from '@/lib/supabase'

export default function Reportes() {
  const [fecha, setFecha]       = useState(hoyPY())
  const [grado, setGrado]       = useState('Todos')
  const [textoJust, setTextoJust]   = useState('')
  const [textoAus, setTextoAus]     = useState('')
  const [loading, setLoading]   = useState(false)
  const [copiado, setCopiado]   = useState<string | null>(null)

  async function generar() {
    setLoading(true)
    const [justData, ausData] = await Promise.all([
      getJustificadosDia(fecha),
      getAusentesDia(fecha, grado === 'Todos' ? undefined : grado),
    ])

    // Justificados
    const fechaStr = new Date(fecha + 'T12:00:00').toLocaleDateString('es-PY', { day:'2-digit', month:'2-digit', year:'numeric' })

    let lineasJ = [`📋 *JUSTIFICADOS — ${fechaStr}*`, '']
    let gradoAct = ''
    for (const r of justData as any[]) {
      const g = r.estudiantes?.grados?.nombre ?? ''
      const n = r.estudiantes?.nombre ?? ''
      if (g !== gradoAct) {
        if (gradoAct) lineasJ.push('')
        gradoAct = g
        lineasJ.push(`*${g}*`)
      }
      lineasJ.push(`  • ${n}`)
    }
    lineasJ.push('', `_Total: ${justData.length} alumno(s)_`)
    setTextoJust(justData.length === 0 ? `✅ Sin justificados el ${fechaStr}` : lineasJ.join('\n'))

    // Ausentes
    let lineasA = [`🔴 *AUSENTES — ${fechaStr}*`]
    if (grado !== 'Todos') lineasA[0] += ` — *${grado}*`
    lineasA.push('')
    gradoAct = ''
    for (const r of ausData as any[]) {
      const g = r.estudiantes?.grados?.nombre ?? ''
      const n = r.estudiantes?.nombre ?? ''
      if (grado === 'Todos' && g !== gradoAct) {
        if (gradoAct) lineasA.push('')
        gradoAct = g
        lineasA.push(`*${g}*`)
      }
      lineasA.push(`  • ${n}`)
    }
    lineasA.push('', `_Total: ${ausData.length} alumno(s)_`)
    setTextoAus(ausData.length === 0 ? `✅ Sin ausentes el ${fechaStr}` : lineasA.join('\n'))
    setLoading(false)
  }

  function copiar(texto: string, key: string) {
    navigator.clipboard.writeText(texto)
    setCopiado(key)
    setTimeout(() => setCopiado(null), 2000)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-4">📨 Reportes</h1>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-xs text-gray-500 font-medium">Fecha</label>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
            className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white" />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium">Grado (ausentes)</label>
          <select value={grado} onChange={e => setGrado(e.target.value)}
            className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white">
            <option>Todos</option>
            {GRADOS.map(g => <option key={g}>{g}</option>)}
          </select>
        </div>
      </div>

      <button onClick={generar} disabled={loading}
        className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold mb-5 active:scale-95 transition-transform">
        {loading ? 'Generando...' : '📊 Generar Reportes'}
      </button>

      {textoJust && (
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1">
            <h2 className="font-bold text-gray-700">📝 Justificados</h2>
            <button onClick={() => copiar(textoJust, 'just')}
              className={`text-sm px-3 py-1 rounded-lg transition-colors ${
                copiado === 'just' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
              }`}>
              {copiado === 'just' ? '✅ Copiado' : '📋 Copiar'}
            </button>
          </div>
          <textarea readOnly value={textoJust}
            className="w-full px-3 py-3 border border-gray-200 rounded-lg text-sm bg-gray-50 font-mono"
            rows={Math.min(textoJust.split('\n').length + 1, 15)} />
        </div>
      )}

      {textoAus && (
        <div>
          <div className="flex justify-between items-center mb-1">
            <h2 className="font-bold text-gray-700">🔴 Ausentes</h2>
            <button onClick={() => copiar(textoAus, 'aus')}
              className={`text-sm px-3 py-1 rounded-lg transition-colors ${
                copiado === 'aus' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
              }`}>
              {copiado === 'aus' ? '✅ Copiado' : '📋 Copiar'}
            </button>
          </div>
          <textarea readOnly value={textoAus}
            className="w-full px-3 py-3 border border-gray-200 rounded-lg text-sm bg-gray-50 font-mono"
            rows={Math.min(textoAus.split('\n').length + 1, 15)} />
        </div>
      )}
    </div>
  )
}
