import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import ExcelJS from 'exceljs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const DIAS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const grado   = searchParams.get('grado') ?? ''
  const turno   = searchParams.get('turno') ?? 'Mañana'
  const ini     = searchParams.get('ini') ?? ''
  const fin     = searchParams.get('fin') ?? ''

  // Obtener estudiantes
  const { data: estData } = await supabase
    .from('estudiantes')
    .select('id, nombre, ci, grados!inner(nombre)')
    .eq('grados.nombre', grado)
    .order('nombre')

  const estudiantes = (estData ?? []) as any[]

  // Obtener asistencia
  const { data: asistData } = await supabase
    .from('asistencia')
    .select('estudiante_id, fecha, estado')
    .in('estudiante_id', estudiantes.map(e => e.id))
    .eq('turno', turno)
    .gte('fecha', ini)
    .lte('fecha', fin)
    .order('fecha')

  // Fechas únicas
  const fechasSet = new Set<string>((asistData ?? []).map((a: any) => a.fecha))
  const fechas = Array.from(fechasSet).sort()

  // Lookup estado
  const CORTO: Record<string, string> = {
    'Presente': 'P', 'Ausente Injustificado': 'A', 'Ausente Justificado': 'J',
  }
  const lookup: Record<number, Record<string, string>> = {}
  for (const r of (asistData ?? []) as any[]) {
    if (!lookup[r.estudiante_id]) lookup[r.estudiante_id] = {}
    lookup[r.estudiante_id][r.fecha] = CORTO[r.estado] ?? ''
  }

  // ── Crear Excel con ExcelJS ──
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(`${grado} ${turno}`)

  const totalCols = 2 + fechas.length + 4

  // Anchos de columna
  ws.getColumn(1).width = 34
  ws.getColumn(2).width = 13
  for (let i = 0; i < fechas.length; i++) ws.getColumn(3 + i).width = 7
  ws.getColumn(3 + fechas.length).width = 10
  ws.getColumn(4 + fechas.length).width = 10
  ws.getColumn(5 + fechas.length).width = 10
  ws.getColumn(6 + fechas.length).width = 13

  // ── Fila 1: Título ──
  ws.mergeCells(1, 1, 1, totalCols)
  const tituloCell = ws.getCell(1, 1)
  tituloCell.value = `Centro Cultural Gymmart — ${grado} — ${turno}`
  tituloCell.font  = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
  tituloCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } }
  tituloCell.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(1).height = 24

  // ── Fila 2: Período ──
  ws.mergeCells(2, 1, 2, totalCols)
  const periodoCell = ws.getCell(2, 1)
  periodoCell.value = `${ini} al ${fin}`
  periodoCell.font  = { italic: true, size: 10, color: { argb: 'FFFFFFFF' } }
  periodoCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E75B6' } }
  periodoCell.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(2).height = 16

  // ── Fila 3: vacía ──
  ws.getRow(3).height = 6

  // ── Fila 4: Encabezados ──
  ws.getRow(4).height = 36

  function hdrCell(row: number, col: number, value: string) {
    const cell = ws.getCell(row, col)
    cell.value = value
    cell.font  = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
      bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
      left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
      right: { style: 'thin', color: { argb: 'FFFFFFFF' } },
    }
  }

  ws.getCell(4, 1).value = 'Nombre'
  ws.getCell(4, 1).font  = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
  ws.getCell(4, 1).fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } }
  ws.getCell(4, 1).alignment = { horizontal: 'left', vertical: 'middle' }

  ws.getCell(4, 2).value = 'CI'
  ws.getCell(4, 2).font  = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
  ws.getCell(4, 2).fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } }
  ws.getCell(4, 2).alignment = { horizontal: 'center', vertical: 'middle' }

  for (let i = 0; i < fechas.length; i++) {
    const d = new Date(fechas[i] + 'T12:00:00')
    const lbl = `${DIAS_ES[d.getDay()]}\n${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}`
    hdrCell(4, 3 + i, lbl)
  }
  hdrCell(4, 3 + fechas.length,     'Total P')
  hdrCell(4, 4 + fechas.length,     'Total A')
  hdrCell(4, 5 + fechas.length,     'Total J')
  hdrCell(4, 6 + fechas.length,     '% Asist.')

  // Colores P/A/J
  const BG_P = 'FFC6EFCE', FG_P = 'FF006100'
  const BG_A = 'FFFFC7CE', FG_A = 'FF9C0006'
  const BG_J = 'FFFFEB9C', FG_J = 'FF9C6500'

  // ── Filas de alumnos ──
  for (let ri = 0; ri < estudiantes.length; ri++) {
    const est   = estudiantes[ri]
    const rowN  = 5 + ri
    const bgRow = ri % 2 === 0 ? 'FFFFFFFF' : 'FFF2F2F2'
    ws.getRow(rowN).height = 18

    // Nombre
    const cNom = ws.getCell(rowN, 1)
    cNom.value = est.nombre
    cNom.font  = { bold: true, size: 10 }
    cNom.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgRow } }
    cNom.alignment = { horizontal: 'left', vertical: 'middle' }
    cNom.border = { bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } } }

    // CI
    const cCi = ws.getCell(rowN, 2)
    cCi.value = est.ci ?? ''
    cCi.font  = { size: 10 }
    cCi.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgRow } }
    cCi.alignment = { horizontal: 'center', vertical: 'middle' }
    cCi.border = { bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } } }

    let p = 0, a = 0, j = 0

    // Celdas P/A/J
    for (let fi = 0; fi < fechas.length; fi++) {
      const val  = lookup[est.id]?.[fechas[fi]] ?? ''
      const cell = ws.getCell(rowN, 3 + fi)
      cell.value = val
      cell.font  = { bold: val !== '', size: 11,
        color: { argb: val === 'P' ? FG_P : val === 'A' ? FG_A : val === 'J' ? FG_J : 'FF000000' } }
      cell.fill  = { type: 'pattern', pattern: 'solid',
        fgColor: { argb: val === 'P' ? BG_P : val === 'A' ? BG_A : val === 'J' ? BG_J : bgRow } }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = {
        top:    { style: 'thin', color: { argb: 'FFD9D9D9' } },
        bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        left:   { style: 'thin', color: { argb: 'FFD9D9D9' } },
        right:  { style: 'thin', color: { argb: 'FFD9D9D9' } },
      }
      if (val === 'P') p++
      else if (val === 'A') a++
      else if (val === 'J') j++
    }

    const total = p + a + j
    const pct   = total > 0 ? Math.round(p / total * 100) : 0

    // Totales
    const totDef = [
      { v: p, bg: p > 0 ? BG_P : bgRow, fg: p > 0 ? FG_P : 'FF666666' },
      { v: a, bg: a > 0 ? BG_A : bgRow, fg: a > 0 ? FG_A : 'FF666666' },
      { v: j, bg: j > 0 ? BG_J : bgRow, fg: j > 0 ? FG_J : 'FF666666' },
    ]
    for (let ti = 0; ti < 3; ti++) {
      const cell = ws.getCell(rowN, 3 + fechas.length + ti)
      cell.value = totDef[ti].v
      cell.font  = { bold: true, size: 10, color: { argb: totDef[ti].fg } }
      cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: totDef[ti].bg } }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
    }

    // % Asistencia
    const cPct = ws.getCell(rowN, 6 + fechas.length)
    cPct.value = `${pct}%`
    cPct.font  = { bold: true, size: 10, color: { argb: pct >= 75 ? FG_P : FG_A } }
    cPct.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: pct >= 75 ? BG_P : BG_A } }
    cPct.alignment = { horizontal: 'center', vertical: 'middle' }
  }

  // Generar buffer
  const buffer = await wb.xlsx.writeBuffer()
  const nombre = `asistencia_${grado.replace(/[°\s]/g,'_')}_${turno}_${ini}_${fin}.xlsx`

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nombre}"`,
    },
  })
}
