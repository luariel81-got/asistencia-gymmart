'use client'
import { useState } from 'react'
import { GRADOS, TURNOS, hoyPY, supabase } from '@/lib/supabase'

type AusenteGrado = { grado: string; texto: string }

export default function Reportes() {
  const [fecha, setFecha]         = useState(hoyPY())
  const [turno, setTurno]         = useState(TURNOS[0])
  const [textoJust, setTextoJust] = useState('')
  const [ausentesPorGrado, setAusentesPorGrado] = useState<AusenteGrado[]>([])
  const [loading, setLoading]     = useState(false)
  const [copiado, setCopiado]     = useState<string | null>(null)

  function saludo() {
    return turno === 'Mañana' ? 'Buenos días' : 'Buenas tardes'
  }

  function formatFecha(iso: string) {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-PY', {
      weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric'
    })
  }

  async function generar() {
    setLoading(true)
    const fechaStr = formatFecha(fecha)

    // ── Justificados (todos los grados juntos) ──
    const { data: justData } = await supabase
      .from('asistencia')
      .select('estudiante_id, estudiantes!inner(nombre, grados!inner(nombre))')
      .eq('fecha', fecha)
      .eq('turno', turno)
      .eq('estado', 'Ausente Justificado')
      .order('estudiante_id')

    if ((justData ?? []).length === 0) {
      setTextoJust(`Buenas queridos docentes 🙏\n\nNo hay ausencias justificadas para el ${fechaStr}.\n\n¡Bendiciones!`)
    } else {
      let lineas = [
        `Buenas queridos docentes 🙏`,
        ``,
        `Les comparto las ausencias *justificadas* del ${fechaStr}:`,
        ``,
      ]
      let gradoAct = ''
      for (const r of justData as any[]) {
        const g = r.estudiantes?.grados?.nombre ?? ''
        const n = r.estudiantes?.nombre ?? ''
        if (g !== gradoAct) {
          if (gradoAct) lineas.push('')
          gradoAct = g
          lineas.push(`*${g}*`)
        }
        lineas.push(`  • ${n}`)
      }
      lineas.push(``, `_Por favor considerarlas. ¡Bendiciones! 🙏_`)
      setTextoJust(lineas.join('\n'))
    }

    // ── Ausentes por grado ──
    const { data: ausData } = await supabase
      .from('asistencia')
      .select('estudiante_id, estudiantes!inner(nombre, grados!inner(nombre))')
      .eq('fecha', fecha)
      .eq('turno', turno)
      .eq('estado', 'Ausente Injustificado')
      .order('estudiante_id')

    // Agrupar por grado
    const porGrado = new Map<string, string[]>()
    for (const r of ausData as any[] ?? []) {
      const g = r.estudiantes?.grados?.nombre ?? ''
      const n = r.estudiantes?.nombre ?? ''
      if (!porGrado.has(g)) porGrado.set(g, [])
      porGrado.get(g)!.push(n)
    }

    // Generar texto por grado en el orden de GRADOS
    const resultado: AusenteGrado[] = []
    for (const grado of GRADOS) {
      const alumnos = porGrado.get(grado)
      if (!alumnos || alumnos.length === 0) continue
      const lineas = [
        `${saludo()} 👋`,
        ``,
        `Comparto la lista de *ausencias sin justificar* del *${grado}*`,
        `📅 ${fechaStr}`,
        ``,
        ...alumnos.map(n => `  • ${n}`),
        ``,
        `_Total: ${alumnos.length} alumno(s)_`,
      ]
      resultado.push({ grado, texto: lineas.join('\n') })
    }

    setAusentesPorGrado(resultado)
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

      {/* Filtros */}
      <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3 mb-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 font-medium">Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
              className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white" />
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

        <button onClick={generar} disabled={loading}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold active:scale-95 transition-transform">
          {loading ? 'Generando...' : '📊 Generar Reportes'}
        </button>
      </div>

      {/* Justificados */}
      {textoJust && (
        <div className="mb-5">
          <div className="flex justify-between items-center mb-2">
            <h2 className="font-bold text-gray-700">📝 Justificados — Para docentes</h2>
            <button onClick={() => copiar(textoJust, 'just')}
              className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
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

      {/* Ausentes por grado */}
      {ausentesPorGrado.length > 0 && (
        <div>
          <h2 className="font-bold text-gray-700 mb-3">🔴 Ausentes — Por grado</h2>
          <div className="space-y-4">
            {ausentesPorGrado.map(({ grado, texto }) => (
              <div key={grado} className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                <div className="flex justify-between items-center px-4 py-2.5 bg-red-50 border-b border-red-100">
                  <span className="font-bold text-red-700 text-sm">{grado}</span>
                  <button onClick={() => copiar(texto, grado)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                      copiado === grado ? 'bg-green-100 text-green-700' : 'bg-white text-gray-600 border border-gray-200'
                    }`}>
                    {copiado === grado ? '✅ Copiado' : '📋 Copiar'}
                  </button>
                </div>
                <textarea readOnly value={texto}
                  className="w-full px-3 py-3 text-sm bg-gray-50 font-mono border-0 focus:outline-none"
                  rows={Math.min(texto.split('\n').length + 1, 12)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sin ausentes */}
      {ausentesPorGrado.length === 0 && textoJust && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <div className="text-2xl mb-1">✅</div>
          <p className="text-green-700 font-medium text-sm">Sin ausentes injustificados — {turno}</p>
        </div>
      )}
    </div>
  )
}
