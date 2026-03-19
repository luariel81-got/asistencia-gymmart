'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase, GRADOS, TURNOS, hoyPY, guardarEstado, getAsistenciaFecha } from '@/lib/supabase'

type Alumno = { id: number; nombre: string; ci: string; estado: string }
type Reporte = { fecha: string; turno: string; estado: string }

export default function PasarLista() {
  const [grado, setGrado]   = useState(GRADOS[0])
  const [turno, setTurno]   = useState(TURNOS[0])
  const [fecha, setFecha]   = useState(hoyPY())
  const [alumnos, setAlumnos] = useState<Alumno[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving]   = useState<number | null>(null)
  const [confirmBorrar, setConfirmBorrar] = useState(false)
  const [guardado, setGuardado] = useState<number | null>(null)
  const [reporte, setReporte]  = useState<{ id: number; data: Reporte[] } | null>(null)
  const [loadingRep, setLoadingRep] = useState(false)
  const [formAgregar, setFormAgregar] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoCi, setNuevoCi]         = useState('')

  const cargarLista = useCallback(async () => {
    setLoading(true)
    const data = await getAsistenciaFecha(grado, fecha, turno)
    setAlumnos(data)
    setLoading(false)
  }, [grado, fecha, turno])

  useEffect(() => { cargarLista() }, [cargarLista])

  // Marcar P/A/J — guarda en BD instantáneamente
  async function marcar(id: number, label: string) {
    // Actualizar UI inmediatamente
    setAlumnos(prev => prev.map(a => a.id === id ? { ...a, estado: label } : a))
    setSaving(id)
    await guardarEstado(id, fecha, turno, label)
    setSaving(null)
    setGuardado(id)
    setTimeout(() => setGuardado(null), 1200)
  }

  // Marcar todos presentes
  const [confirmTodos, setConfirmTodos] = useState(false)

  async function marcarTodosPresentes() {
    setAlumnos(prev => prev.map(a => ({ ...a, estado: 'P' })))
    setSaving(-1)
    await Promise.all(alumnos.map(a => guardarEstado(a.id, fecha, turno, 'P')))
    setSaving(null)
    setConfirmTodos(false)
  }

  // Guardar toda la lista de una vez
  async function guardarTodo() {
    setSaving(-1)
    await Promise.all(alumnos.map(a => guardarEstado(a.id, fecha, turno, a.estado)))
    setSaving(null)
    setGuardado(-1)
    setTimeout(() => setGuardado(null), 2000)
  }

  // Borrar lista del día
  async function borrarLista() {
    setSaving(-1)
    const ids = alumnos.map(a => a.id)
    await supabase
      .from('asistencia')
      .delete()
      .in('estudiante_id', ids)
      .eq('fecha', fecha)
      .eq('turno', turno)
    setSaving(null)
    setConfirmBorrar(false)
    // Recargar lista desde BD
    await cargarLista()
  }

  // Ver reporte del alumno
  async function verReporte(id: number) {
    if (reporte?.id === id) { setReporte(null); return }
    setLoadingRep(true)
    const { data } = await supabase
      .from('asistencia')
      .select('fecha, turno, estado')
      .eq('estudiante_id', id)
      .order('fecha', { ascending: false })
      .limit(60)
    setReporte({ id, data: data ?? [] })
    setLoadingRep(false)
  }

  // Agregar alumno rápido
  async function agregarAlumno() {
    if (!nuevoNombre.trim()) return
    const { data: gr } = await supabase.from('grados').select('id').eq('nombre', grado).single()
    if (!gr) return
    await supabase.from('estudiantes').insert({
      nombre: nuevoNombre.trim().toUpperCase(),
      ci: nuevoCi.trim(),
      grado_id: gr.id,
    })
    setNuevoNombre(''); setNuevoCi(''); setFormAgregar(false)
    cargarLista()
  }

  const ausentes    = alumnos.filter(a => a.estado === 'A').length
  const justificados = alumnos.filter(a => a.estado === 'J').length
  const presentes   = alumnos.length - ausentes - justificados

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-4">📋 Pasar Lista</h1>

      {/* Filtros */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="text-xs text-gray-500 font-medium">Grado</label>
          <select value={grado} onChange={e => setGrado(e.target.value)}
            className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white">
            {GRADOS.map(g => <option key={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium">Fecha</label>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
            className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white" />
        </div>
      </div>

      {/* Turno */}
      <div className="flex gap-2 mb-4">
        {TURNOS.map(t => (
          <button key={t} onClick={() => setTurno(t)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
              turno === t
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* Resumen */}
      {!loading && alumnos.length > 0 && (
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { label: 'Total', val: alumnos.length, color: 'text-gray-700' },
            { label: 'Presentes', val: presentes, color: 'text-green-600' },
            { label: 'Ausentes', val: ausentes, color: 'text-red-500' },
            { label: 'Justif.', val: justificados, color: 'text-yellow-500' },
          ].map(m => (
            <div key={m.label} className="bg-white rounded-lg p-2 text-center border border-gray-100">
              <div className={`text-xl font-bold ${m.color}`}>{m.val}</div>
              <div className="text-xs text-gray-400">{m.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Acciones */}
      <div className="flex gap-2 mb-4">
        {!confirmTodos ? (
          <button onClick={() => setConfirmTodos(true)} disabled={saving !== null}
            className="flex-1 py-2.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm font-medium active:scale-95 transition-transform">
            ✅ Todos Presentes
          </button>
        ) : (
          <div className="flex-1 flex gap-1">
            <button onClick={() => setConfirmTodos(false)}
              className="flex-1 py-2.5 border border-gray-200 rounded-lg text-gray-500 text-xs bg-white">
              ✕
            </button>
            <button onClick={marcarTodosPresentes}
              className="flex-1 py-2.5 bg-green-500 text-white rounded-lg text-xs font-bold active:scale-95">
              ✓ Confirmar
            </button>
          </div>
        )}
        <button onClick={() => setFormAgregar(!formAgregar)}
          className="px-4 py-2.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-sm font-medium active:scale-95 transition-transform">
          ➕
        </button>
      </div>

      {/* Formulario agregar */}
      {formAgregar && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <p className="text-sm font-medium text-blue-800 mb-2">Agregar a {grado}</p>
          <input value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)}
            placeholder="APELLIDO, Nombre" className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm mb-2 bg-white" />
          <input value={nuevoCi} onChange={e => setNuevoCi(e.target.value)}
            placeholder="CI" className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm mb-2 bg-white" />
          <button onClick={agregarAlumno}
            className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
            ✅ Agregar
          </button>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="text-center py-10 text-gray-400">Cargando...</div>
      ) : alumnos.length === 0 ? (
        <div className="text-center py-10 text-gray-400">No hay estudiantes en {grado}</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
          {alumnos.map(a => (
            <div key={a.id}>
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Nombre */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-800 text-sm truncate">{a.nombre}</div>
                  {a.ci && <div className="text-xs text-gray-400">{a.ci}</div>}
                </div>

                {/* Indicador guardado */}
                {guardado === a.id && (
                  <span className="text-xs text-green-500 font-medium">✓</span>
                )}
                {saving === a.id && (
                  <span className="text-xs text-gray-400">...</span>
                )}

                {/* Botones P/A/J */}
                {(['P','A','J'] as const).map(lbl => {
                  const colors: Record<string, string> = {
                    P: a.estado === 'P' ? 'bg-green-500 text-white border-green-500' : 'border-green-400 text-green-500 bg-white',
                    A: a.estado === 'A' ? 'bg-red-500 text-white border-red-500' : 'border-red-400 text-red-500 bg-white',
                    J: a.estado === 'J' ? 'bg-yellow-500 text-white border-yellow-500' : 'border-yellow-400 text-yellow-500 bg-white',
                  }
                  return (
                    <button key={lbl}
                      onClick={() => marcar(a.id, lbl)}
                      className={`w-11 h-11 rounded-lg border-2 font-bold text-sm transition-all active:scale-90 ${colors[lbl]}`}>
                      {lbl}
                    </button>
                  )
                })}

                {/* Reporte */}
                <button onClick={() => verReporte(a.id)}
                  className={`w-9 h-11 rounded-lg border text-sm transition-all active:scale-90 ${
                    reporte?.id === a.id
                      ? 'bg-purple-100 border-purple-300 text-purple-600'
                      : 'border-gray-200 text-gray-400 bg-white'
                  }`}>
                  📋
                </button>
              </div>

              {/* Reporte inline */}
              {reporte?.id === a.id && (
                <div className="mx-4 mb-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                  {loadingRep ? (
                    <p className="text-xs text-gray-400">Cargando...</p>
                  ) : reporte.data.length === 0 ? (
                    <p className="text-xs text-gray-400">Sin registros aún.</p>
                  ) : (
                    <>
                      {/* Métricas */}
                      <div className="grid grid-cols-4 gap-2 mb-3">
                        {[
                          { l: 'Presentes',    v: reporte.data.filter(r => r.estado === 'Presente').length,              c: 'text-green-600' },
                          { l: 'Ausentes',     v: reporte.data.filter(r => r.estado === 'Ausente Injustificado').length, c: 'text-red-500' },
                          { l: 'Justif.',      v: reporte.data.filter(r => r.estado === 'Ausente Justificado').length,   c: 'text-yellow-500' },
                          { l: 'Asistencia',   v: `${Math.round(reporte.data.filter(r => r.estado === 'Presente').length / reporte.data.length * 100)}%`, c: 'text-blue-600' },
                        ].map(m => (
                          <div key={m.l} className="text-center">
                            <div className={`text-lg font-bold ${m.c}`}>{m.v}</div>
                            <div className="text-xs text-gray-400">{m.l}</div>
                          </div>
                        ))}
                      </div>
                      {/* Historial */}
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {reporte.data.slice(0, 20).map((r, i) => {
                          const badge: Record<string, string> = {
                            'Presente': '🟢 PRESENTE',
                            'Ausente Injustificado': '🔴 AUSENTE',
                            'Ausente Justificado': '🟡 JUSTIFICADO',
                          }
                          return (
                            <div key={i} className="flex justify-between items-center px-2 py-1.5 bg-white rounded text-xs">
                              <span className="text-gray-600">{r.fecha} <span className="text-gray-300">{r.turno}</span></span>
                              <span>{badge[r.estado] ?? r.estado}</span>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Botones guardar y borrar */}
      {alumnos.length > 0 && (
        <div className="mt-4 space-y-2">
          <button onClick={guardarTodo} disabled={saving !== null}
            className={`w-full py-3.5 rounded-xl font-bold text-white text-base transition-all active:scale-95 ${
              saving !== null ? 'bg-gray-400' :
              guardado === -1 ? 'bg-green-500' : 'bg-blue-600'
            }`}>
            {saving !== null ? '⏳ Guardando...' :
             guardado === -1 ? '✅ ¡Guardado!' : '💾 Guardar todo'}
          </button>

          {!confirmBorrar ? (
            <button onClick={() => setConfirmBorrar(true)}
              className="w-full py-2.5 rounded-xl font-medium text-sm text-red-500 border border-red-200 bg-red-50 active:scale-95 transition-all">
              🗑️ Borrar lista del día
            </button>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-sm text-red-700 font-medium mb-2 text-center">
                ¿Borrar todos los registros de <strong>{grado} — {turno} — {fecha}</strong>?
              </p>
              <p className="text-xs text-red-500 text-center mb-3">Esta acción no se puede deshacer</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmBorrar(false)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-lg text-gray-600 text-sm font-medium bg-white">
                  Cancelar
                </button>
                <button onClick={borrarLista} disabled={saving !== null}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm font-bold active:scale-95">
                  {saving !== null ? '⏳...' : '🗑️ Sí, borrar'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
