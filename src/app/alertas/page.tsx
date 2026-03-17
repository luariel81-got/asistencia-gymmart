'use client'
import { useState, useEffect } from 'react'
import { supabase, GRADOS } from '@/lib/supabase'

type Alerta = { nombre: string; grado: string; contacto: string; faltas: number; desde: string }

export default function Alertas() {
  const [grado, setGrado]   = useState('Todos')
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { cargar() }, [grado])

  async function cargar() {
    setLoading(true)
    let q = supabase
      .from('asistencia')
      .select('estudiante_id, fecha, estudiantes!inner(nombre, contacto, grados!inner(nombre))')
      .eq('estado', 'Ausente Injustificado')
      .order('estudiante_id')
      .order('fecha', { ascending: false })

    const { data } = await q
    if (!data) { setLoading(false); return }

    // Detectar rachas
    const porEst = new Map<number, { nombre: string; grado: string; contacto: string; fechas: string[] }>()
    for (const r of data as any[]) {
      const id  = r.estudiante_id
      const nom = r.estudiantes?.nombre ?? ''
      const gr  = r.estudiantes?.grados?.nombre ?? ''
      const con = r.estudiantes?.contacto ?? 'Sin contacto'
      if (grado !== 'Todos' && gr !== grado) continue
      if (!porEst.has(id)) porEst.set(id, { nombre: nom, grado: gr, contacto: con, fechas: [] })
      porEst.get(id)!.fechas.push(r.fecha)
    }

    const result: Alerta[] = []
    for (const [, e] of porEst) {
      const fechas = e.fechas.sort().reverse()
      let racha = 1
      for (let i = 1; i < fechas.length; i++) {
        const diff = (new Date(fechas[i-1]).getTime() - new Date(fechas[i]).getTime()) / 86400000
        if (diff <= 3) racha++
        else break
      }
      if (racha >= 2) result.push({ nombre: e.nombre, grado: e.grado, contacto: e.contacto, faltas: racha, desde: fechas[fechas.length-1] })
    }

    result.sort((a,b) => b.faltas - a.faltas)
    setAlertas(result)
    setLoading(false)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-4">🚨 Alertas de Faltas</h1>

      <div className="mb-4">
        <label className="text-xs text-gray-500 font-medium">Filtrar por grado</label>
        <select value={grado} onChange={e => setGrado(e.target.value)}
          className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white">
          <option>Todos</option>
          {GRADOS.map(g => <option key={g}>{g}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Cargando...</div>
      ) : alertas.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <div className="text-3xl mb-2">✅</div>
          <p className="text-green-700 font-medium">Sin alertas de faltas consecutivas</p>
        </div>
      ) : (
        <>
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-700 font-medium">
            ⚠️ {alertas.length} estudiante(s) con 2+ faltas consecutivas
          </div>
          <div className="space-y-3">
            {alertas.map((a, i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-xl p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-gray-800">{a.nombre}</p>
                    <p className="text-xs text-gray-500 mt-0.5">📚 {a.grado}</p>
                  </div>
                  <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded-lg">
                    {a.faltas} faltas
                  </span>
                </div>
                <div className="mt-2 flex gap-4 text-xs text-gray-500">
                  <span>📅 Desde {a.desde}</span>
                  <span>📞 {a.contacto}</span>
                </div>
                {a.contacto && a.contacto !== 'Sin contacto' && (
                  <a href={`https://wa.me/595${a.contacto.replace(/^0/, '')}`}
                    target="_blank"
                    className="mt-2 inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                    💬 WhatsApp
                  </a>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
