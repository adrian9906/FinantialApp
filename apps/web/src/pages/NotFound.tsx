import { useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { AppIcon } from '@/components/icons/AppIcon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

const suggestedLinks = [
  { to: '/', label: 'Volver al dashboard', icon: 'dashboard' as const },
  { to: '/expenses', label: 'Revisar gastos', icon: 'expenses' as const },
  { to: '/reports', label: 'Abrir informes', icon: 'reports' as const },
]

export default function NotFound() {
  const location = useLocation()
  const missingPath = useMemo(() => location.pathname || '/', [location.pathname])

  return (
    <div className="animate-in fade-in duration-500">
      <Card className="relative overflow-hidden border-graphite bg-surface shadow-vault">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.16),transparent_58%)]" />
        <div className="absolute -left-16 top-10 size-36 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative z-10 grid gap-6 px-6 py-8 md:px-10 md:py-10 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <Badge variant="secondary" className="w-fit border-primary/20 bg-primary/10 text-primary">
              <AppIcon name="alert-circle" className="size-3.5" />
              Error 404
            </Badge>

            <div className="space-y-3">
              <p className="text-[72px] font-semibold leading-none tracking-[-0.05em] text-on-surface md:text-[96px]">
                404
              </p>
              <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-on-surface md:text-4xl">
                Esta ruta no existe dentro de Plata App
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-muted-gray">
                Intentaste abrir una pantalla que no encontramos. Puede que el enlace esté viejo, que la ruta haya cambiado o que se haya escrito mal.
              </p>
            </div>

            <div className="rounded-2xl border border-graphite bg-abyss/80 px-4 py-4 shadow-vault-sm">
              <p className="text-[11px] uppercase tracking-[0.18em] text-medium-gray">Ruta solicitada</p>
              <p className="mt-2 break-all text-sm font-medium text-on-surface">{missingPath}</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild className="bg-primary-container text-white shadow-vault hover:brightness-110">
                <Link to="/">
                  <AppIcon name="dashboard" className="size-4" />
                  Ir al dashboard
                </Link>
              </Button>
              <Button asChild variant="outline" className="border-graphite bg-surface-container-low text-on-surface hover:bg-surface-container">
                <Link to="/reports">
                  <AppIcon name="reports" className="size-4" />
                  Ver informes
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3 self-start">
            {suggestedLinks.map((entry) => (
              <Link
                key={entry.to}
                to={entry.to}
                className="group rounded-2xl border border-graphite bg-abyss/80 p-4 transition-all hover:border-primary/30 hover:bg-surface-container-low"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-on-surface">{entry.label}</p>
                    <p className="mt-1 text-xs leading-6 text-muted-gray">
                      Atajo rápido para volver a una zona activa de la aplicación.
                    </p>
                  </div>
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-surface-container-high text-on-surface transition-colors group-hover:text-primary">
                    <AppIcon name={entry.icon} className="size-4" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </Card>
    </div>
  )
}
