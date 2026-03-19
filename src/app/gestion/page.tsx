'use client'
import { useState, useEffect } from 'react'
import { supabase, GRADOS, getEstudiantesPorGrado, agregarEstudiante, actualizarEstudiante, eliminarEstudiante } from '@/lib/supabase'
import * as XLSX from 'xlsx'

type Tab = 'agregar' | 'editar' | 'traslado' | 'eliminar' | 'importar'
type Est = { id: number; nombre: string; ci: string; contacto: string }

export default function Gestion() {
  const [tab, setTab]     = useState<Tab>('agregar')
  const [grado, setGrado] = useState(GRADOS[0])
  const [lista, setLista] = useState<Est[]>([])
  const [msg, setMsg]     = useState('')

  // Agregar
  const [nombre, setNombre]   = useState('')
  const [ci, setCi]           = useState('')
  const [contacto, setContacto] = useState('')

  // Editar
  const [selId, setSelId]       = useState<number | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [editCi, setEditCi]         = useState('')
  const [editGrado, setEditGrado]   = useState(GRADOS[0])
  const [editContacto, setEditContacto] = useState('')

  // Eliminar
  const [confirmar, setConfirmar] = useState(false)
  const [delId, setDelId]         = useState<number | null>(null)

  // Traslado
  const [trasladoId, setTrasladoId]       = useState<number | null>(null)
  const [trasladoNombre, setTrasladoNombre] = useState('')
  const [gradoOrigen, setGradoOrigen]     = useState(GRADOS[0])
  const [gradoDestino, setGradoDestino]   = useState(GRADOS[1])

  // Importar Excel
  const [preview, setPreview] = useState<any[]>([])
  const [gradoImport, setGradoImport] = useState(GRADOS[0])

  useEffect(() => {
    getEstudiantesPorGrado(grado).then((d: any) => setLista(d))
  }, [grado, msg])

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  async function handleAgregar() {
    if (!nombre.trim()) return
    await agregarEstudiante(nombre, ci, grado, contacto)
    setNombre(''); setCi(''); setContacto('')
    flash('✅ Alumno agregado.')
  }

  function selEditar(e: Est) {
    setSelId(e.id); setEditNombre(e.nombre); setEditCi(e.ci)
    setEditGrado(grado); setEditContacto(e.contacto)
  }

  async function handleEditar() {
    if (!selId) return
    await actualizarEstudiante(selId, editNombre, editCi, editGrado, editContacto)
    setSelId(null)
    flash('✅ Datos actualizados.')
  }

  async function handleEliminar() {
    if (!delId || !confirmar) return
    await eliminarEstudiante(delId)
    setDelId(null); setConfirmar(false)
    flash('✅ Alumno eliminado.')
  }

  async function handleTraslado() {
    if (!trasladoId) return
    const { data: gr } = await supabase.from('grados').select('id').eq('nombre', gradoDestino).single()
    if (!gr) return
    await supabase.from('estudiantes').update({ grado_id: gr.id }).eq('id', trasladoId)
    setTrasladoId(null)
    flash(`✅ ${trasladoNombre} trasladado a ${gradoDestino}.`)
  }

  function handleExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target?.result, { type: 'binary' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][]
      // Asumir fila 0 = encabezado, col 0 = CI, col 1 = Nombre
      const data = rows.slice(1).filter(r => r[1]).map(r => ({ ci: String(r[0]||''), nombre: String(r[1]||'') }))
      setPreview(data)
    }
    reader.readAsBinaryString(file)
  }

  async function importarExcel() {
    const { data: gr } = await supabase.from('grados').select('id').eq('nombre', gradoImport).single()
    if (!gr) return
    for (const r of preview) {
      await supabase.from('estudiantes').insert({ nombre: r.nombre.toUpperCase(), ci: r.ci, grado_id: gr.id })
    }
    setPreview([])
    flash(`✅ ${preview.length} alumnos importados.`)
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'agregar',   label: '➕ Agregar'   },
    { key: 'editar',    label: '✏️ Editar'    },
    { key: 'traslado',  label: '🔄 Traslado'  },
    { key: 'eliminar',  label: '🗑️ Eliminar'  },
    { key: 'importar',  label: '📥 Importar'  },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-4">🎓 Gestión</h1>

      {msg && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl mb-4 text-sm">{msg}</div>}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-xl">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
              tab === t.key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Grado selector */}
      {(tab === 'agregar' || tab === 'editar' || tab === 'eliminar') && (
        <div className="mb-4">
          <label className="text-xs text-gray-500 font-medium">Grado</label>
          <select value={grado} onChange={e => setGrado(e.target.value)}
            className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white">
            {GRADOS.map(g => <option key={g}>{g}</option>)}
          </select>
        </div>
      )}

      {/* ── Agregar ── */}
      {tab === 'agregar' && (
        <div className="space-y-3">
          <input value={nombre} onChange={e => setNombre(e.target.value)}
            placeholder="Nombre completo" className="w-full px-3 py-3 border border-gray-200 rounded-lg text-sm" />
          <input value={ci} onChange={e => setCi(e.target.value)}
            placeholder="CI" className="w-full px-3 py-3 border border-gray-200 rounded-lg text-sm" />
          <input value={contacto} onChange={e => setContacto(e.target.value)}
            placeholder="Contacto padre/tutor (opcional)" className="w-full px-3 py-3 border border-gray-200 rounded-lg text-sm" />
          <button onClick={handleAgregar}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold active:scale-95 transition-transform">
            Agregar Estudiante
          </button>
        </div>
      )}

      {/* ── Editar ── */}
      {tab === 'editar' && (
        <div>
          {!selId ? (
            <div className="bg-white border border-gray-100 rounded-xl divide-y divide-gray-50">
              {lista.length === 0
                ? <p className="p-4 text-sm text-gray-400">Sin estudiantes en {grado}</p>
                : lista.map((e: any) => (
                  <div key={e.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-800 text-sm">{e.nombre}</p>
                      <p className="text-xs text-gray-400">{e.ci}</p>
                    </div>
                    <button onClick={() => selEditar(e)}
                      className="text-blue-600 text-sm font-medium px-3 py-1.5 bg-blue-50 rounded-lg">
                      Editar
                    </button>
                  </div>
                ))}
            </div>
          ) : (
            <div className="space-y-3">
              <input value={editNombre} onChange={e => setEditNombre(e.target.value)}
                className="w-full px-3 py-3 border border-gray-200 rounded-lg text-sm" />
              <input value={editCi} onChange={e => setEditCi(e.target.value)}
                placeholder="CI" className="w-full px-3 py-3 border border-gray-200 rounded-lg text-sm" />
              <select value={editGrado} onChange={e => setEditGrado(e.target.value)}
                className="w-full px-3 py-3 border border-gray-200 rounded-lg text-sm bg-white">
                {GRADOS.map(g => <option key={g}>{g}</option>)}
              </select>
              <input value={editContacto} onChange={e => setEditContacto(e.target.value)}
                placeholder="Contacto" className="w-full px-3 py-3 border border-gray-200 rounded-lg text-sm" />
              <div className="flex gap-2">
                <button onClick={() => setSelId(null)}
                  className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-600 font-medium">
                  Cancelar
                </button>
                <button onClick={handleEditar}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold">
                  Guardar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Traslado ── */}
      {tab === 'traslado' && (
        <div>
          <p className="text-xs text-gray-500 mb-4">Mové un alumno de un grado a otro. Su historial de asistencia se mantiene.</p>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 font-medium">Grado de origen</label>
              <select value={gradoOrigen} onChange={e => { setGradoOrigen(e.target.value); setTrasladoId(null) }}
                className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white">
                {GRADOS.map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">Alumno a trasladar</label>
              <select value={trasladoId ?? ''} onChange={e => {
                  const id = Number(e.target.value)
                  setTrasladoId(id)
                  const est = lista.find((x: any) => x.id === id) as any
                  setTrasladoNombre(est?.nombre ?? '')
                }}
                className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white">
                <option value="">Seleccionar alumno...</option>
                {lista.filter((e: any) => {
                  // show students from gradoOrigen
                  return true
                }).map((e: any) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">Grado de destino</label>
              <select value={gradoDestino} onChange={e => setGradoDestino(e.target.value)}
                className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white">
                {GRADOS.filter(g => g !== gradoOrigen).map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
            {trasladoId && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700">
                <strong>{trasladoNombre}</strong> será trasladado de <strong>{gradoOrigen}</strong> a <strong>{gradoDestino}</strong>
              </div>
            )}
            <button onClick={handleTraslado} disabled={!trasladoId}
              className={`w-full py-3 rounded-xl font-bold text-white transition-colors ${
                trasladoId ? 'bg-blue-600 active:scale-95' : 'bg-gray-300'
              }`}>
              🔄 Confirmar traslado
            </button>
          </div>
        </div>
      )}

      {/* ── Eliminar ── */}
      {tab === 'eliminar' && (
        <div>
          <p className="text-xs text-red-500 mb-3">⚠️ Esta acción elimina al alumno y todo su historial. No se puede deshacer.</p>
          <div className="bg-white border border-gray-100 rounded-xl divide-y divide-gray-50">
            {lista.length === 0
              ? <p className="p-4 text-sm text-gray-400">Sin estudiantes en {grado}</p>
              : lista.map((e: any) => (
                <div key={e.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{e.nombre}</p>
                    <p className="text-xs text-gray-400">{e.ci}</p>
                  </div>
                  <button onClick={() => { setDelId(e.id); setConfirmar(false) }}
                    className="text-red-600 text-sm font-medium px-3 py-1.5 bg-red-50 rounded-lg">
                    🗑️
                  </button>
                </div>
              ))}
          </div>
          {delId && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm text-red-700 font-medium mb-3">
                Eliminando: <strong>{lista.find((e: any) => e.id === delId)?.nombre}</strong>
              </p>
              <label className="flex items-center gap-2 text-sm text-red-700 mb-3 cursor-pointer">
                <input type="checkbox" checked={confirmar} onChange={e => setConfirmar(e.target.checked)} />
                Confirmo que quiero eliminar este alumno
              </label>
              <div className="flex gap-2">
                <button onClick={() => setDelId(null)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-lg text-gray-600 text-sm">
                  Cancelar
                </button>
                <button onClick={handleEliminar} disabled={!confirmar}
                  className={`flex-1 py-2.5 rounded-lg text-white text-sm font-bold ${
                    confirmar ? 'bg-red-600' : 'bg-gray-300'
                  }`}>
                  Eliminar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Importar Excel ── */}
      {tab === 'importar' && (
        <div>
          <p className="text-xs text-gray-500 mb-3">Sube el Excel de asistencia. Columna A = CI, Columna B = Nombre.</p>
          <div className="mb-3">
            <label className="text-xs text-gray-500 font-medium">Grado destino</label>
            <select value={gradoImport} onChange={e => setGradoImport(e.target.value)}
              className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white">
              {GRADOS.map(g => <option key={g}>{g}</option>)}
            </select>
          </div>
          <input type="file" accept=".xlsx,.xls"
            onChange={handleExcel}
            className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-medium mb-3" />
          {preview.length > 0 && (
            <>
              <p className="text-sm text-gray-600 mb-2">{preview.length} alumnos encontrados:</p>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 max-h-48 overflow-y-auto mb-3">
                {preview.slice(0,10).map((r,i) => (
                  <p key={i} className="text-xs text-gray-700 py-0.5">{r.nombre} — {r.ci}</p>
                ))}
                {preview.length > 10 && <p className="text-xs text-gray-400">...y {preview.length-10} más</p>}
              </div>
              <button onClick={importarExcel}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold active:scale-95">
                📥 Importar {preview.length} alumnos
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
