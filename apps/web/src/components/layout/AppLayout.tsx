import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Wallet,
  ArrowUpRight,
  Heart,
  PiggyBank,
  Landmark,
  ShoppingCart,
  Calendar,
  TrendingUp,
  Bell,
  Settings2,
  Activity,
  Menu,
  X,
  ChevronUp,
  LifeBuoy,
  LogOut,
  User,
  UserPlus,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { GlobalSearchDialog } from '@/components/layout/GlobalSearchDialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { HexagonBackground } from '@/components/animate-ui/components/backgrounds/hexagon'
import { useAuthStore } from '@/store/authStore'
import { useFinanceStore } from '@/store/financeStore'
import { formatFormulaLabel, usePreferencesStore } from '@/store/preferencesStore'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/salary', icon: Wallet, label: 'Salario' },
  { to: '/expenses', icon: ArrowUpRight, label: 'Gastos' },
  { to: '/wants', icon: Heart, label: 'Gustos' },
  { to: '/savings', icon: PiggyBank, label: 'Ahorros' },
  { to: '/debts', icon: Landmark, label: 'Deudas' },
  { to: '/wishlist', icon: ShoppingCart, label: 'Deseos' },
  { to: '/events', icon: Calendar, label: 'Eventos' },
  { to: '/projections', icon: TrendingUp, label: 'Proyecciones' },
  { to: '/reminders', icon: Bell, label: 'Recordatorios' },
  { to: '/reports', icon: Activity, label: 'Informes' },
  { to: '/settings', icon: Settings2, label: 'Ajustes' },
]

function handleSupportClick() {
  toast.info('El acceso a soporte estara disponible pronto.')
}

export function Sidebar() {
  const [open, setOpen] = useState(false)
  const authMode = useAuthStore((state) => state.authMode)
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const resetFinance = useFinanceStore((state) => state.reset)
  const formula = usePreferencesStore((state) => state.formula)

  const profileName = authMode === 'guest' ? 'Invitado local' : user?.name ?? 'Usuario'
  const profileEmail = authMode === 'guest' ? 'Datos guardados solo en este navegador' : user?.email ?? ''
  const profileInitial = profileName.charAt(0).toUpperCase()

  async function handleLogout() {
    await logout()
    resetFinance()
    setOpen(false)
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden text-on-surface hover:text-primary"
        onClick={() => setOpen(!open)}
        aria-label="Abrir menu"
      >
        {open ? <X data-icon="inline-start" /> : <Menu data-icon="inline-start" />}
      </Button>

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-graphite bg-surface shadow-vault transition-transform duration-200 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="mb-2 flex items-center gap-3 px-5 py-5">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary-container shadow-vault">
            <span className="text-sm font-bold text-white">P</span>
          </div>
          <div>
            <h1 className="text-[18px] font-semibold leading-tight tracking-tight text-on-surface">
              Plata App
            </h1>
            <p className="text-[12px] text-muted-gray">Control financiero {formatFormulaLabel(formula)}</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150',
                  isActive
                    ? 'bg-secondary-container text-on-secondary-container font-bold scale-[0.97] shadow-vault'
                    : 'text-muted-gray hover:bg-surface-container-high hover:text-on-surface'
                )
              }
            >
              <item.icon className="size-[18px] shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-1 border-t border-graphite px-3 pb-4 pt-3">
          <DropdownMenu>
            <DropdownMenuTrigger
              className="mb-2 flex w-full items-center gap-3 rounded-xl border border-graphite bg-abyss px-3 py-3 text-left shadow-vault-sm outline-hidden transition-colors hover:bg-surface-container-high"
              aria-label="Abrir menu de usuario"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-on-surface">
                {authMode === 'guest' ? <User className="size-4" /> : <span className="text-sm font-semibold">{profileInitial}</span>}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-on-surface">{profileName}</p>
                <p className="truncate text-xs text-muted-gray">{profileEmail}</p>
              </div>
              <ChevronUp className="size-4 shrink-0 text-muted-gray" />
            </DropdownMenuTrigger>

            <DropdownMenuContent
              side="top"
              align="start"
              className="w-56 rounded-xl border border-graphite bg-surface p-1 text-on-surface shadow-vault"
            >
              <DropdownMenuGroup>
                <DropdownMenuLabel className="px-3 py-2">
                  <p className="truncate text-sm font-semibold text-on-surface">{profileName}</p>
                  <p className="truncate text-xs font-normal text-muted-gray">{profileEmail}</p>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator className="bg-graphite" />
              <DropdownMenuItem
                onClick={() => void handleLogout()}
                className="rounded-lg px-3 py-2 text-sm text-muted-gray hover:text-on-surface focus:bg-surface-container-high focus:text-on-surface"
              >
                <LogOut className="size-[18px]" />
                {authMode === 'guest' ? 'Salir del modo invitado' : 'Cerrar sesion'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            type="button"
            onClick={handleSupportClick}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-gray transition-all hover:bg-surface-container-high hover:text-on-surface"
          >
            <LifeBuoy className="size-[18px]" />
            Soporte
          </button>
        </div>
      </aside>

      {open && (
        <button
          type="button"
          aria-label="Cerrar menu lateral"
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  )
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const authMode = useAuthStore((state) => state.authMode)
  const background = usePreferencesStore((state) => state.background)

  return (
    <div
      className="relative flex min-h-dvh overflow-hidden"
      style={{ background: 'var(--app-shell-background)', backgroundSize: 'var(--app-shell-background-size, auto)' }}
    >
      {background === 'grid' ? (
        <div className="absolute inset-0 z-0">
          <HexagonBackground
            className="absolute inset-0 min-h-full bg-transparent dark:bg-transparent"
            hexagonSize={60}
            hexagonMargin={4}
            hexagonProps={{
              className:
                'before:opacity-55 dark:before:bg-white/12 before:bg-slate-900/12 after:dark:bg-[color:var(--surface-dim)] after:bg-[color:var(--background)]',
            }}
          />
        </div>
      ) : null}

      <Sidebar />
      <main className="pointer-events-none relative z-10 min-h-dvh flex-1 lg:pl-64">
        <div className="pointer-events-auto mx-auto w-full max-w-full px-3 py-5 sm:px-6 md:max-w-[94%] lg:max-w-[90%] lg:px-8 lg:py-8">
          <div className="mb-5">
            <GlobalSearchDialog />
          </div>

          {authMode === 'guest' && (
            <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-[color:color-mix(in_srgb,var(--warning)_14%,var(--surface))] px-4 py-4 text-sm text-on-surface shadow-vault sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="font-semibold text-on-surface">Estas usando Plata App como invitado.</p>
                <p className="text-[color:color-mix(in_srgb,var(--on-surface)_78%,var(--warning))]">
                  Tus datos se guardan solo en este navegador. Si quieres guardarlos en tu cuenta, inicia sesion o crea una cuenta.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <NavLink
                  to="/login?mode=login"
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-amber-500/35 bg-transparent px-4 text-sm font-medium text-on-surface transition-colors hover:bg-amber-200/15"
                >
                  Iniciar sesion
                </NavLink>
                <NavLink
                  to="/login?mode=register"
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-amber-200 px-4 text-sm font-semibold text-amber-950 transition-colors hover:bg-amber-100"
                >
                  <UserPlus className="mr-2 size-4" />
                  Crear cuenta
                </NavLink>
              </div>
            </div>
          )}

          {children}
        </div>
      </main>
    </div>
  )
}
