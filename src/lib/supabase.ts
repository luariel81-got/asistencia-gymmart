import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

// ── Constantes ──────────────────────────────────────────────────────────────
export const GRADOS = [
  '7° Grado', '8° Grado', '9° Grado',
  '1° BTS',
  '1° BC', '2° BC', '3° BC',
  '1° BTI', '2° BTI', '3° BTI',
]

export const TURNOS  = ['Mañana', 'Tarde']
export const ESTADOS = ['Presente', 'Ausente Injustificado', 'Ausente Justificado']

export const ESTADO_LABEL: Record<string, string> = {
  Presente: 'P',
  'Ausente Injustificado': 'A',
  'Ausente Justificado': 'J',
}
export const LABEL_ESTADO: Record<string, string> = {
  P: 'Presente',
  A: 'Ausente Injustificado',
  J: 'Ausente Justificado',
}

// ── Fecha Paraguay ──────────────────────────────────────────────────────────
export function hoyPY(): string {
  return new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/Asuncion',
  }) // YYYY-MM-DD
}

// ── Queries ──────────────────────────────────────────────────────────────────
export async function getEstudiantesPorGrado(grado: string) {
  const { data } = await supabase
    .from('estudiantes')
    .select('id, nombre, ci, contacto, grados!inner(nombre)')
    .eq('grados.nombre', grado)
    .order('nombre')
  return data ?? []
}

export async function getAsistenciaFecha(grado: string, fecha: string, turno: string) {
  const { data } = await supabase
    .from('estudiantes')
    .select(`
      id,
      nombre,
      ci,
      grados!inner(nombre),
      asistencia(estado, fecha, turno)
    `)
    .eq('grados.nombre', grado)
    .order('nombre')

  return (data ?? []).map((e: any) => {
    const reg = e.asistencia?.find(
      (a: any) => a.fecha === fecha && a.turno === turno
    )
    return {
      id: e.id,
      nombre: e.nombre,
      ci: e.ci ?? '',
      estado: reg ? ESTADO_LABEL[reg.estado] ?? 'P' : 'P',
    }
  })
}

export async function guardarEstado(
  estudianteId: number,
  fecha: string,
  turno: string,
  label: string
) {
  const estado = LABEL_ESTADO[label] ?? 'Presente'
  await supabase.from('asistencia').upsert(
    { estudiante_id: estudianteId, fecha, turno, estado },
    { onConflict: 'estudiante_id,fecha,turno' }
  )
}

export async function guardarAsistenciaBulk(
  registros: { estudianteId: number; fecha: string; turno: string; label: string }[]
) {
  const rows = registros.map(r => ({
    estudiante_id: r.estudianteId,
    fecha: r.fecha,
    turno: r.turno,
    estado: LABEL_ESTADO[r.label] ?? 'Presente',
  }))
  await supabase.from('asistencia').upsert(rows, {
    onConflict: 'estudiante_id,fecha,turno',
  })
}

export async function getReporteEstudiante(estudianteId: number) {
  const { data } = await supabase
    .from('asistencia')
    .select('fecha, turno, estado')
    .eq('estudiante_id', estudianteId)
    .order('fecha', { ascending: false })
    .limit(60)
  return data ?? []
}

export async function getResumenGrado(grado: string) {
  const { data } = await supabase
    .from('estudiantes')
    .select(`
      id, nombre,
      grados!inner(nombre),
      asistencia(estado)
    `)
    .eq('grados.nombre', grado)
    .order('nombre')

  return (data ?? []).map((e: any) => {
    const asist = e.asistencia ?? []
    const presentes    = asist.filter((a: any) => a.estado === 'Presente').length
    const ausentes     = asist.filter((a: any) => a.estado === 'Ausente Injustificado').length
    const justificados = asist.filter((a: any) => a.estado === 'Ausente Justificado').length
    const total        = asist.length
    const pct          = total > 0 ? Math.round((presentes / total) * 100) : 0
    return { id: e.id, nombre: e.nombre, presentes, ausentes, justificados, total, pct }
  })
}

export async function getJustificadosDia(fecha: string) {
  const { data } = await supabase
    .from('asistencia')
    .select('estudiante_id, turno, estudiantes(nombre, grados(nombre))')
    .eq('fecha', fecha)
    .eq('estado', 'Ausente Justificado')
    .order('estudiante_id')
  return data ?? []
}

export async function getAusentesDia(fecha: string, grado?: string) {
  let q = supabase
    .from('asistencia')
    .select('estudiante_id, turno, estudiantes!inner(nombre, grados!inner(nombre))')
    .eq('fecha', fecha)
    .eq('estado', 'Ausente Injustificado')
  if (grado && grado !== 'Todos') {
    q = q.eq('estudiantes.grados.nombre', grado)
  }
  const { data } = await q.order('estudiante_id')
  return data ?? []
}

export async function getConfig(clave: string): Promise<string> {
  const { data } = await supabase
    .from('config')
    .select('valor')
    .eq('clave', clave)
    .single()
  return data?.valor ?? ''
}

export async function setConfig(clave: string, valor: string) {
  await supabase.from('config').upsert({ clave, valor }, { onConflict: 'clave' })
}

export async function agregarEstudiante(
  nombre: string, ci: string, grado: string, contacto: string
) {
  const { data: gr } = await supabase
    .from('grados').select('id').eq('nombre', grado).single()
  if (!gr) return
  await supabase.from('estudiantes').insert({
    nombre: nombre.toUpperCase(),
    ci,
    grado_id: gr.id,
    contacto,
  })
}

export async function actualizarEstudiante(
  id: number, nombre: string, ci: string, grado: string, contacto: string
) {
  const { data: gr } = await supabase
    .from('grados').select('id').eq('nombre', grado).single()
  if (!gr) return
  await supabase.from('estudiantes').update({
    nombre: nombre.toUpperCase(), ci, grado_id: gr.id, contacto,
  }).eq('id', id)
}

export async function eliminarEstudiante(id: number) {
  await supabase.from('asistencia').delete().eq('estudiante_id', id)
  await supabase.from('estudiantes').delete().eq('id', id)
}

export async function getGradosConLista(fecha: string): Promise<string[]> {
  const { data } = await supabase
    .from('asistencia')
    .select('estudiantes!inner(grados!inner(nombre))')
    .eq('fecha', fecha)
  const nombres = new Set<string>()
  ;(data ?? []).forEach((r: any) => {
    const n = r.estudiantes?.grados?.nombre
    if (n) nombres.add(n)
  })
  return Array.from(nombres)
}
