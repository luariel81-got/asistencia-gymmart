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
    return { ini: ini.toISOString().split('T')[0], fin: fin.toISOString().split('T')[0] }
  } else {
    const ini = new Date(d.getFullYear(), d.getMonth(), 1)
    const fin = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    return { ini: ini.toISOString().split('T')[0], fin: fin.toISOString().split('T')[0] }
  }
}

const DIAS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

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

    const { data: estData } = await supabase
      .from('estudiantes')
      .select('id, nombre, ci, grados!inner(nombre)')
      .eq('grados.nombre', grado)
      .order('nombre')
    const estudiantes = estData ?? []
    if (estudiantes.length === 0) { setInfo('No hay estudiantes en ' + grado); setLoading(false); return }

    const { data: asistData } = await supabase
      .from('asistencia')
      .select('estudiante_id, fecha, estado')
      .in('estudiante_id', (estudiantes as any[]).map(e => e.id))
      .eq('turno', turno)
      .gte('fecha', ini)
      .lte('fecha', fin)
      .order('fecha')

    const fechasSet = new Set<string>((asistData ?? []).map((a: any) => a.fecha))
    const fechas = Array.from(fechasSet).sort()

    const lookup: Record<number, Record<string, string>> = {}
    const CORTO: Record<string, string> = {
      'Presente': 'P', 'Ausente Injustificado': 'A', 'Ausente Justificado': 'J',
    }
    for (const r of asistData ?? [] as any[]) {
      if (!lookup[r.estudiante_id]) lookup[r.estudiante_id] = {}
      lookup[r.estudiante_id][r.fecha] = CORTO[r.estado] ?? r.estado
    }

    // ── Crear workbook con estilos ──
    const wb = XLSX.utils.book_new()
    const wsData: any[][] = []

    // Fila 1: Título
    const institucion = 'Centro Cultural Gymmart'
    wsData.push([`${institucion} — ${grado} — ${turno}`])
    // Fila 2: Período
    const periodoStr = periodo === 'dia'
      ? ini
      : periodo === 'semana'
        ? `${ini} al ${fin}`
        : `${new Date(ini + 'T12:00:00').toLocaleDateString('es-PY', { month: 'long', year: 'numeric' })}`
    wsData.push([periodoStr])
    // Fila 3: vacía
    wsData.push([])
    // Fila 4: Encabezados
    const headers = ['Nombre', 'CI', ...fechas.map(f => {
      const d = new Date(f + 'T12:00:00')
      return `${DIAS_ES[d.getDay()]}\n${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}`
    }), 'Total P', 'Total A', 'Total J', '% Asistencia']
    wsData.push(headers)

    // Filas de alumnos
    const alumnosRows: { row: any[]; estados: string[] }[] = []
    for (const est of estudiantes as any[]) {
      const row: any[] = [est.nombre, est.ci ?? '']
      let p = 0, a = 0, j = 0
      const estados: string[] = []
      for (const f of fechas) {
        const val = lookup[est.id]?.[f] ?? ''
        row.push(val)
        estados.push(val)
        if (val === 'P') p++
        else if (val === 'A') a++
        else if (val === 'J') j++
      }
      const total = p + a + j
      const pct = total > 0 ? Math.round(p / total * 100) : 0
      row.push(p, a, j, `${pct}%`)
      alumnosRows.push({ row, estados })
      wsData.push(row)
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData)

    // ── Estilos ──
    const totalCols = 2 + fechas.length + 4

    // Merge título (fila 1)
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: totalCols - 1 } },
    ]

    // Anchos de columna
    ws['!cols'] = [
      { wch: 32 }, { wch: 12 },
      ...fechas.map(() => ({ wch: 7 })),
      { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 13 },
    ]

    // Alto de filas
    ws['!rows'] = [
      { hpt: 24 }, // título
      { hpt: 16 }, // período
      { hpt: 6  }, // vacía
      { hpt: 36 }, // encabezados
    ]

    // Función para aplicar estilo a celda
    function styleCell(ref: string, style: any) {
      if (!ws[ref]) ws[ref] = { t: 's', v: '' }
      ws[ref].s = style
    }

    // Estilo título — azul oscuro
    const cellTitulo = XLSX.utils.encode_cell({ r: 0, c: 0 })
    styleCell(cellTitulo, {
      fill: { fgColor: { rgb: '1F4E79' } },
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 14 },
      alignment: { horizontal: 'center', vertical: 'center' },
    })

    // Estilo período — azul claro
    const cellPeriodo = XLSX.utils.encode_cell({ r: 1, c: 0 })
    styleCell(cellPeriodo, {
      fill: { fgColor: { rgb: '2E75B6' } },
      font: { italic: true, color: { rgb: 'FFFFFF' }, sz: 10 },
      alignment: { horizontal: 'center', vertical: 'center' },
    })

    // Encabezados — fila 4 (índice 3)
    for (let c = 0; c < totalCols; c++) {
      const ref = XLSX.utils.encode_cell({ r: 3, c })
      styleCell(ref, {
        fill: { fgColor: { rgb: '1F4E79' } },
        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: {
          top: { style: 'thin', color: { rgb: 'FFFFFF' } },
          bottom: { style: 'thin', color: { rgb: 'FFFFFF' } },
          left: { style: 'thin', color: { rgb: 'FFFFFF' } },
          right: { style: 'thin', color: { rgb: 'FFFFFF' } },
        }
      })
    }
    // Nombre y CI con fondo más claro en encabezado
    for (let c = 0; c < 2; c++) {
      const ref = XLSX.utils.encode_cell({ r: 3, c })
      styleCell(ref, {
        fill: { fgColor: { rgb: '1F4E79' } },
        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
        alignment: { horizontal: 'left', vertical: 'center' },
      })
    }

    // Filas de alumnos
    const COLOR_P = 'C6EFCE'  // verde claro
    const COLOR_A = 'FFC7CE'  // rojo claro
    const COLOR_J = 'FFEB9C'  // amarillo claro
    const FONT_P  = '006100'
    const FONT_A  = '9C0006'
    const FONT_J  = '9C6500'

    for (let ri = 0; ri < alumnosRows.length; ri++) {
      const rowIdx = 4 + ri
      const { estados } = alumnosRows[ri]
      const bgRow = ri % 2 === 0 ? 'FFFFFF' : 'F2F2F2'

      // Nombre
      const refNom = XLSX.utils.encode_cell({ r: rowIdx, c: 0 })
      styleCell(refNom, {
        fill: { fgColor: { rgb: bgRow } },
        font: { bold: true, sz: 10 },
        alignment: { horizontal: 'left', vertical: 'center' },
        border: { bottom: { style: 'thin', color: { rgb: 'D9D9D9' } } }
      })
      // CI
      const refCi = XLSX.utils.encode_cell({ r: rowIdx, c: 1 })
      styleCell(refCi, {
        fill: { fgColor: { rgb: bgRow } },
        font: { sz: 10 },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: { bottom: { style: 'thin', color: { rgb: 'D9D9D9' } } }
      })

      // Celdas P/A/J
      for (let fi = 0; fi < fechas.length; fi++) {
        const ref = XLSX.utils.encode_cell({ r: rowIdx, c: 2 + fi })
        const val = estados[fi]
        let bg = bgRow, fontColor = '000000'
        if (val === 'P') { bg = COLOR_P; fontColor = FONT_P }
        else if (val === 'A') { bg = COLOR_A; fontColor = FONT_A }
        else if (val === 'J') { bg = COLOR_J; fontColor = FONT_J }
        styleCell(ref, {
          fill: { fgColor: { rgb: bg } },
          font: { bold: val !== '', color: { rgb: fontColor }, sz: 11 },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: 'D9D9D9' } },
            bottom: { style: 'thin', color: { rgb: 'D9D9D9' } },
            left: { style: 'thin', color: { rgb: 'D9D9D9' } },
            right: { style: 'thin', color: { rgb: 'D9D9D9' } },
          }
        })
      }

      // Totales P/A/J/%
      const totals = [
        { v: alumnosRows[ri].row[2 + fechas.length],     bg: COLOR_P, fc: FONT_P },
        { v: alumnosRows[ri].row[2 + fechas.length + 1], bg: COLOR_A, fc: FONT_A },
        { v: alumnosRows[ri].row[2 + fechas.length + 2], bg: COLOR_J, fc: FONT_J },
      ]
      for (let ti = 0; ti < 3; ti++) {
        const ref = XLSX.utils.encode_cell({ r: rowIdx, c: 2 + fechas.length + ti })
        styleCell(ref, {
          fill: { fgColor: { rgb: totals[ti].v === 0 ? bgRow : totals[ti].bg } },
          font: { bold: true, color: { rgb: totals[ti].v === 0 ? '666666' : totals[ti].fc }, sz: 10 },
          alignment: { horizontal: 'center', vertical: 'center' },
        })
      }
      // % asistencia
      const pct = alumnosRows[ri].row[2 + fechas.length + 3]
      const pctNum = parseInt(pct)
      const refPct = XLSX.utils.encode_cell({ r: rowIdx, c: 2 + fechas.length + 3 })
      styleCell(refPct, {
        fill: { fgColor: { rgb: pctNum >= 75 ? COLOR_P : COLOR_A } },
        font: { bold: true, color: { rgb: pctNum >= 75 ? FONT_P : FONT_A }, sz: 10 },
        alignment: { horizontal: 'center', vertical: 'center' },
      })
    }

    XLSX.utils.book_append_sheet(wb, ws, `${grado} ${turno}`)
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
          📅 Período: <span className="font-medium text-gray-700">{ini}</span> al <span className="font-medium text-gray-700">{fin}</span>
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
        <p>• Título azul oscuro con nombre de institución, grado y turno</p>
        <p>• Columnas finales: Total P / A / J y % asistencia con color</p>
      </div>
    </div>
  )
}
