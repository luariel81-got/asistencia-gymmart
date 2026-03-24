'use client'
import { useState } from 'react'
import { GRADOS, TURNOS, hoyPY } from '@/lib/supabase'

type Periodo = 'dia' | 'semana' | 'mes'

function getFechas(periodo: Periodo, fechaRef: string): { ini: string; fin: string } {
  const d = new Date(fechaRef + 'T12:00:00')
  if (periodo === 'dia') {
    return { ini: fechaRef, fin: fechaRef }
  } else if (periodo === 'semana') {
    const day = d.getDay() || 7
    const ini = new Date(d); ini.setDate(d.getDate() - day + 1)
    const fin = new Date(d); fin.setDate(d.getDate() - day + 7)
    return { ini: ini.toISOString().split('T')[0], fin: fin.toISOString().split('T')[0] }
  } else {
    const ini = new Date(d.getFullYear(), d.getMonth(), 1)
    const fin = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    return { ini: ini.toISOString().split('T')[0], fin: fin.toISOString().split('T')[0] }
  }
}

export default function ExcelPage() {
  const [grado, setGrado]     = useState(GRADOS[0])
  const [turno, setTurno]     = useState(TURNOS[0])
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [fecha, setFecha]     = useState(hoyPY())
  const [loading, setLoading] = useState(false)
  const [info, setInfo]       = useState('')

  async function generarExcel() {
    setLoading(true); setInfo('')
    const { ini, fin } = getFechas(periodo, fecha)

    try {
      const params = new URLSearchParams({ grado, turno, ini, fin })
      const res = await fetch(`/api/excel?${params}`)
      if (!res.ok) throw new Error('Error al generar')

      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `asistencia_${grado.replace(/[°\s]/g,'_')}_${turno}_${ini}_${fin}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      setInfo('✅ Excel descargado correctamente')
    } catch (e) {
      setInfo('❌ Error al generar el Excel')
    }
    setLoading(false)
  }

  const { ini, fin } = getFechas(periodo, fecha)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-4">📊 Exportar Excel</h1>
      <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-4">
        <div>
          <label className="text-xs text-gray-500 font-medium">Grado</label>
          <select value={grado} onChange={e => setGrado(e.target.value)}
            className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white">
            {GRADOS.map(g => <option key={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium">Turno</label>
          <div className="flex gap-2 mt-1">
            {TURNOS.map(t => (
              <button key={t} onClick={() => setTurno(t)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                  turno === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'
                }`}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium">Período</label>
          <div className="flex gap-2 mt-1">
            {([['dia','Día'],['semana','Semana'],['mes','Mes']] as const).map(([k,l]) => (
              <button key={k} onClick={() => setPeriodo(k)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                  periodo === k ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200'
                }`}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium">
            {periodo === 'dia' ? 'Fecha' : periodo === 'semana' ? 'Cualquier día de la semana' : 'Cualquier día del mes'}
          </label>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
            className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white" />
        </div>
        <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-500">
          📅 <span className="font-medium text-gray-700">{ini}</span> al <span className="font-medium text-gray-700">{fin}</span>
        </div>
        {info && (
          <div className={`px-3 py-2 rounded-lg text-sm font-medium ${info.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            {info}
          </div>
        )}
        <button onClick={generarExcel} disabled={loading}
          className={`w-full py-3.5 rounded-xl font-bold text-white text-base transition-all active:scale-95 ${loading ? 'bg-gray-400' : 'bg-blue-600'}`}>
          {loading ? '⏳ Generando...' : '📥 Descargar Excel'}
        </button>
      </div>
      <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-700 space-y-1">
        <p className="font-semibold">Formato del Excel:</p>
        <p>🟢 Verde = Presente · 🔴 Rojo = Ausente · 🟡 Amarillo = Justificado</p>
        <p>• Título azul con institución, grado y turno</p>
        <p>• % asistencia verde ≥75% / rojo &lt;75%</p>
      </div>
    </div>
  )
}
