'use client'
import './globals.css'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/lista',    label: '📋 Lista'     },
  { href: '/reportes', label: '📨 Reportes'  },
  { href: '/excel',    label: '📊 Excel'     },
  { href: '/resumen',  label: '📈 Resumen'   },
  { href: '/alertas',  label: '🚨 Alertas'   },
  { href: '/gestion',  label: '🎓 Gestión'   },
  { href: '/config',   label: '⚙️ Config'    },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  return (
    <html lang="es">
      <body className="bg-gray-50 min-h-screen">
        {/* Sidebar desktop / bottom bar mobile */}
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <aside className="hidden md:flex flex-col w-56 bg-white border-r border-gray-200 p-4 gap-1 fixed h-full z-10">
            <div className="text-center mb-4 pb-4 border-b">
              <div className="text-3xl">🏫</div>
              <div className="font-bold text-sm mt-1 text-gray-700">Asistencia Escolar</div>
              <div className="text-xs text-gray-400">MEC Paraguay</div>
            </div>
            {NAV.map(n => (
              <Link key={n.href} href={n.href}
                className={`px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                  path.startsWith(n.href)
                    ? 'bg-green-50 text-green-700 border-l-4 border-green-500'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}>
                {n.label}
              </Link>
            ))}
          </aside>

          {/* Main content */}
          <main className="flex-1 md:ml-56 pb-20 md:pb-0">
            <div className="max-w-3xl mx-auto px-4 py-6">
              {children}
            </div>
          </main>

          {/* Bottom nav mobile */}
          <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-10">
            {NAV.map(n => (
              <Link key={n.href} href={n.href}
                className={`flex-1 flex flex-col items-center py-2 text-xs font-medium transition-colors ${
                  path.startsWith(n.href)
                    ? 'text-green-600'
                    : 'text-gray-400'
                }`}>
                <span className="text-lg">{n.label.split(' ')[0]}</span>
                <span className="text-[10px]">{n.label.split(' ').slice(1).join(' ')}</span>
              </Link>
            ))}
          </nav>
        </div>
      </body>
    </html>
  )
}
