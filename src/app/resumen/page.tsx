'use client'
import { useState, useEffect } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'
import { GRADOS, TURNOS, supabase } from '@/lib/supabase'

type Row = { id: number; nombre: string; presentes: number; ausentes: number; justificados: number; total: number; pct: number }

export default function Resumen() {
  const [grado, setGrado] = useState(GRADOS[0])
  const [turno, setTurno] = useState(TURNOS[0])
  const [data, setData]   = useState<Row[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { cargar() }, [grado, turno])

  async function cargar() {
    setLoading(true)
    const { data: estData } = await supabase
      .from('estudiantes')
      .select('id, nombre, grados!inner(nombre)')
      .eq('grados.nombre', grado)
      .order('nombre')

    const estudiantes = estData ?? []
    if (estudiantes.length === 0) { setData([]); setLoading(false); return }

    const { data: asistData } = await supabase
      .from('asistencia')
      .select('estudiante_id, estado')
      .in('estudiante_id', (estudiantes as any[]).map(e => e.id))
      .eq('turno', turno)

    const rows: Row[] = (estudiantes as any[]).map(e => {
      const asist = (asistData ?? []).filter((a: any) => a.estudiante_id === e.id)
      const presentes    = asist.filter((a: any) => a.estado === 'Presente').length
      const ausentes     = asist.filter((a: any) => a.estado === 'Ausente Injustificado').length
      const justificados = asist.filter((a: any) => a.estado === 'Ausente Justificado').length
      const total        = asist.length
      const pct          = total > 0 ? Math.round(presentes / total * 100) : 0
      return { id: e.id, nombre: e.nombre, presentes, ausentes, justificados, total, pct }
    })

    setData(rows)
    setLoading(false)
  }

  const totalP   = data.reduce((s,r) => s + r.presentes, 0)
  const totalA   = data.reduce((s,r) => s + r.ausentes, 0)
  const totalJ   = data.reduce((s,r) => s + r.justificados, 0)
  const totalReg = data.reduce((s,r) => s + r.total, 0)
  const pctGlobal = totalReg > 0 ? Math.round(totalP / totalReg * 100) : 0

  const pieData = [
    { name: 'Presentes', value: totalP, color: '#22c55e' },
    { name: 'Injustificados', value: totalA, color: '#ef4444' },
    { name: 'Justificados', value: totalJ, color: '#eab308' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-4">📈 Resumen</h1>

      <div className="grid grid-cols-2 gap-3 mb-4">
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
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Cargando...</div>
      ) : data.length === 0 || totalReg === 0 ? (
        <div className="text-center py-10 text-gray-400">Sin registros para {grado} — {turno}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-5">
            {[
              { l: 'Estudiantes',      v: data.length,      c: 'text-gray-700' },
              { l: `% Asistencia`,     v: `${pctGlobal}%`,  c: pctGlobal >= 75 ? 'text-green-600' : 'text-red-500' },
              { l: 'F. Injustificadas',v: totalA,            c: 'text-red-500' },
              { l: 'F. Justificadas',  v: totalJ,            c: 'text-yellow-500' },
            ].map(m => (
              <div key={m.l} className="bg-white border border-gray-100 rounded-xl p-4 text-center">
                <div className={`text-2xl font-bold ${m.c}`}>{m.v}</div>
                <div className="text-xs text-gray-400 mt-1">{m.l}</div>
              </div>
            ))}
          </div>

          <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4">
            <h3 className="font-semibold text-gray-700 mb-3">Distribución — {turno}</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                  dataKey="value" label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}
                  labelLine={false}>
                  {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4">
            <h3 className="font-semibold text-gray-700 mb-3">% por estudiante — {turno}</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data} margin={{ bottom: 60 }}>
                <XAxis dataKey="nombre" tick={{ fontSize: 9 }} angle={-35} textAnchor="end" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: any) => `${v}%`} />
                <ReferenceLine y={75} stroke="#ef4444" strokeDasharray="4 2" label={{ value:'75%', fill:'#ef4444', fontSize:10 }} />
                <Bar dataKey="pct" name="Asistencia %" radius={[4,4,0,0]}>
                  {data.map((r, i) => <Cell key={i} fill={r.pct >= 75 ? '#22c55e' : '#ef4444'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-600 font-semibold">Nombre</th>
                  <th className="text-center px-2 py-3 text-gray-600 font-semibold">P</th>
                  <th className="text-center px-2 py-3 text-gray-600 font-semibold">A</th>
                  <th className="text-center px-2 py-3 text-gray-600 font-semibold">J</th>
                  <th className="text-center px-2 py-3 text-gray-600 font-semibold">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.map(r => (
                  <tr key={r.id}>
                    <td className="px-4 py-2.5 text-gray-800 font-medium text-xs">{r.nombre}</td>
                    <td className="text-center px-2 py-2.5 text-green-600">{r.presentes}</td>
                    <td className="text-center px-2 py-2.5 text-red-500">{r.ausentes}</td>
                    <td className="text-center px-2 py-2.5 text-yellow-500">{r.justificados}</td>
                    <td className={`text-center px-2 py-2.5 font-bold ${r.pct >= 75 ? 'text-green-600' : 'text-red-500'}`}>
                      {r.pct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
