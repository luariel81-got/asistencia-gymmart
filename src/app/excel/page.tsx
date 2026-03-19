'use client'
import { useState } from 'react'
import { GRADOS, TURNOS, hoyPY, supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'

type Periodo = 'dia' | 'semana' | 'mes'

function getFechas(periodo: Periodo, fechaRef: string): { ini: string; fin: string } {
  const d = new Date(fechaRef + 'T12:00:00')
  if (periodo === 'dia') {
    return { ini: fechaRef, fin: fechaRef }
  } else if (periodo === 'semana') {
    const day = d.getDay() || 7
    const ini = new Date(d); ini.setDate(d.getDate() - day + 1)
    const fin = new Date(d); fin.setDate(d.getDate() - day + 7)
    return {
      ini: ini.toISOString().split('T')[0],
      fin: fin.toISOString().split('T')[0],
    }
  } else {
    const ini = new Date(d.getFullYear(), d.getMonth(), 1)
    const fin = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    return {
      ini: ini.toISOString().split('T')[0],
      fin: fin.toISOString().split('T')[0],
    }
  }
}

const DIAS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function formatFecha(iso: string) {
  const d = new Date(iso + 'T12:00:00')
  return `${DIAS_ES[d.getDay()]}\n${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}`
}

export default function ExcelPage() {
  const [grado, setGrado]   = useState(GRADOS[0])
  const [turno, setTurno]   = useState(TURNOS[0])
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [fecha, setFecha]   = useState(hoyPY())
  const [loading, setLoading] = useState(false)
  const [info, setInfo]     = useState('')

  async function generarExcel() {
    setLoading(true)
    setInfo('')

    const { ini, fin } = getFechas(periodo, fecha)

    // Obtener estudiantes del grado
    const { data: estData } = await supabase
      .from('estudiantes')
      .select('id, nombre, ci, grados!inner(nombre)')
      .eq('grados.nombre', grado)
      .order('nombre')

    const estudiantes = estData ?? []

    if (estudiantes.length === 0) {
      setInfo('No hay estudiantes en ' + grado)
      setLoading(false)
      return
    }

    // Obtener asistencia del período
    const { data: asistData } = await supabase
      .from('asistencia')
      .select('estudiante_id, fecha, turno, estado')
      .in('estudiante_id', estudiantes.map((e: any) => e.id))
      .eq('turno', turno)
      .gte('fecha', ini)
      .lte('fecha', fin)
      .order('fecha')

    // Generar lista de fechas únicas del período (solo días con registros)
    const fechasSet = new Set<string>((asistData ?? []).map((a: any) => a.fecha))
    const fechas = Array.from(fechasSet).sort()

    // Lookup: estudianteId -> fecha -> estado corto
    const lookup: Record<number, Record<string, string>> = {}
    const CORTO: Record<string, string> = {
      'Presente': 'P',
      'Ausente Injustificado': 'A',
      'Ausente Justificado': 'J',
    }
    for (const r of asistData ?? [] as any[]) {
      if (!lookup[r.estudiante_id]) lookup[r.estudiante_id] = {}
      lookup[r.estudiante_id][r.fecha] = CORTO[r.estado] ?? r.estado
    }

    // ── Construir workbook ──
    const wb = XLSX.utils.book_new()
    const wsData: any[][] = []

    // Fila 1: Título
    const periodoLabel = periodo === 'dia' ? `Día ${ini}` : periodo === 'semana' ? `Semana del ${ini} al ${fin}` : `Mes ${new Date(ini + 'T12:00:00').toLocaleDateString('es-PY', { month: 'long', year: 'numeric' })}`
    wsData.push([`${grado} — ${turno} — ${periodoLabel}`])
    wsData.push([]) // fila vacía

    // Fila 3: Encabezados
    const headers = ['Nombre', 'CI', ...fechas, 'Total P', 'Total A', 'Total J', '% Asistencia']
    wsData.push(headers)

    // Filas de alumnos
    for (const est of estudiantes as any[]) {
      const row: any[] = [est.nombre, est.ci ?? '']
      let p = 0, a = 0, j = 0
      for (const f of fechas) {
        const val = lookup[est.id]?.[f] ?? ''
        row.push(val)
        if (val === 'P') p++
        else if (val === 'A') a++
        else if (val === 'J') j++
      }
      const total = p + a + j
      const pct = total > 0 ? Math.round(p / total * 100) : 0
      row.push(p, a, j, `${pct}%`)
      wsData.push(row)
    }

    // Crear worksheet
    const ws = XLSX.utils.aoa_to_sheet(wsData)

    // Anchos de columna
    const colWidths = [
      { wch: 32 }, // Nombre
      { wch: 12 }, // CI
      ...fechas.map(() => ({ wch: 7 })),
      { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 12 },
    ]
    ws['!cols'] = colWidths

    // Merge título
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }]

    // Encabezados de fecha en formato Día\ndd/mm
    for (let i = 0; i < fechas.length; i++) {
      const cellRef = XLSX.utils.encode_cell({ r: 2, c: 2 + i })
      if (ws[cellRef]) {
        ws[cellRef].v = formatFecha(fechas[i])
        ws[cellRef].t = 's'
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, `${grado} ${turno}`)

    // Nombre del archivo
    const nombreArchivo = `asistencia_${grado.replace(/[°\s]/g,'_')}_${turno}_${ini}_${fin}.xlsx`
    XLSX.writeFile(wb, nombreArchivo)
    setInfo(`✅ Excel generado: ${estudiantes.length} alumnos, ${fechas.length} días`)
    setLoading(false)
  }

  const { ini, fin } = getFechas(periodo, fecha)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-4">📊 Exportar Excel</h1>

      <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-4">

        {/* Grado */}
        <div>
          <label className="text-xs text-gray-500 font-medium">Grado</label>
          <select value={grado} onChange={e => setGrado(e.target.value)}
            className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white">
            {GRADOS.map(g => <option key={g}>{g}</option>)}
          </select>
        </div>

        {/* Turno */}
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

        {/* Período */}
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

        {/* Fecha referencia */}
        <div>
          <label className="text-xs text-gray-500 font-medium">
            {periodo === 'dia' ? 'Fecha' : periodo === 'semana' ? 'Cualquier día de la semana' : 'Cualquier día del mes'}
          </label>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
            className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white" />
        </div>

        {/* Preview período */}
        <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-500">
          📅 Período: <span className="font-medium text-gray-700">{ini}</span> al <span className="font-medium text-gray-700">{fin}</span>
        </div>

        {info && (
          <div className={`px-3 py-2 rounded-lg text-sm font-medium ${
            info.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
          }`}>
            {info}
          </div>
        )}

        <button onClick={generarExcel} disabled={loading}
          className={`w-full py-3.5 rounded-xl font-bold text-white text-base transition-all active:scale-95 ${
            loading ? 'bg-gray-400' : 'bg-blue-600'
          }`}>
          {loading ? '⏳ Generando...' : '📥 Descargar Excel'}
        </button>
      </div>

      {/* Info formato */}
      <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-700 space-y-1">
        <p className="font-semibold">Formato del Excel:</p>
        <p>• Una columna por fecha con día abreviado</p>
        <p>• Valores: <strong>P</strong> Presente · <strong>A</strong> Ausente · <strong>J</strong> Justificado</p>
        <p>• Columnas finales: Total P / A / J y % de asistencia</p>
      </div>
    </div>
  )
}
