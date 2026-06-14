import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Wallet,
  ArrowUpRight,
  Heart,
  PiggyBank,
  Landmark,
  Target,
  ShoppingCart,
  Calendar,
  TrendingUp,
  Bell,
  Menu,
  X,
  Plus,
  LifeBuoy,
  LogOut,
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/salary', icon: Wallet, label: 'Salario' },
  { to: '/expenses', icon: ArrowUpRight, label: 'Gastos' },
  { to: '/wants', icon: Heart, label: 'Gustos' },
  { to: '/savings', icon: PiggyBank, label: 'Ahorros' },
  { to: '/debts', icon: Landmark, label: 'Deudas' },
  { to: '/goals', icon: Target, label: 'Metas' },
  { to: '/wishlist', icon: ShoppingCart, label: 'Deseos' },
  { to: '/events', icon: Calendar, label: 'Eventos' },
  { to: '/projections', icon: TrendingUp, label: 'Proyecciones' },
  { to: '/reminders', icon: Bell, label: 'Recordatorios' },
]

export function Sidebar() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        className="fixed top-4 left-4 z-50 lg:hidden text-on-surface hover:text-primary transition-colors"
        onClick={() => setOpen(!open)}
        aria-label="Abrir menú"
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-graphite bg-surface shadow-vault transition-transform duration-200 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center gap-3 px-5 py-5 mb-2">
          <div className="size-10 rounded-full bg-primary-container flex items-center justify-center shadow-vault">
            <span className="text-white text-sm font-bold">V</span>
          </div>
          <div>
            <h1 className="text-[18px] font-semibold text-on-surface leading-tight tracking-tight">
              Vault 50/25/25
            </h1>
            <p className="text-[12px] text-muted-gray">Bóveda Cristalina</p>
          </div>
        </div>

        <div className="px-3 mb-4">
          <button className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-primary-container text-white text-sm font-medium shadow-vault hover:brightness-110 transition-all active:scale-[0.98]">
            <Plus className="size-4" />
            Agregar Transacción
          </button>
        </div>

        <nav className="flex-1 flex flex-col gap-1 px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150',
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

        <div className="mt-auto flex flex-col gap-1 border-t border-graphite pt-3 px-3 pb-4">
          <a className="flex items-center gap-3 px-3 py-2 text-sm text-muted-gray hover:bg-surface-container-high hover:text-on-surface rounded-lg transition-all" href="#">
            <LifeBuoy className="size-[18px]" />
            Soporte
          </a>
          <a className="flex items-center gap-3 px-3 py-2 text-sm text-muted-gray hover:bg-surface-container-high hover:text-on-surface rounded-lg transition-all" href="#">
            <LogOut className="size-[18px]" />
            Cerrar sesión
          </a>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  )
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-surface-dim">
      <Sidebar />
      <main className="flex-1 lg:pl-64 min-h-dvh">
        <div className="mx-auto w-full max-w-[1120px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
