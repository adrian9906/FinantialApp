import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppLayout } from '@/components/layout/AppLayout'
import { Toaster } from 'sonner'
import Dashboard from '@/pages/Dashboard'
import Salary from '@/pages/Salary'
import Expenses from '@/pages/Expenses'
import Wants from '@/pages/Wants'
import Savings from '@/pages/Savings'
import Debts from '@/pages/Debts'
import Wishlist from '@/pages/Wishlist'
import Events from '@/pages/Events'
import Projections from '@/pages/Projections'
import Reminders from '@/pages/Reminders'
import Settings from '@/pages/Settings'
import { useEffect } from 'react'
import { useFinanceStore } from '@/store/financeStore'
import { useAuthStore } from '@/store/authStore'
import { usePreferencesStore } from '@/store/preferencesStore'
import Login from '@/pages/Login'

const queryClient = new QueryClient()

function AppPreferencesEffects() {
  const appearance = usePreferencesStore((state) => state.appearance)
  const theme = usePreferencesStore((state) => state.theme)
  const background = usePreferencesStore((state) => state.background)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', appearance === 'dark')
    root.dataset.appAppearance = appearance
    root.dataset.appTheme = theme
    root.dataset.appBackground = background
  }, [appearance, background, theme])

  return null
}

function ProtectedApp() {
  const location = useLocation()
  const authMode = useAuthStore((state) => state.authMode)
  const isChecking = useAuthStore((state) => state.isChecking)
  const hasChecked = useAuthStore((state) => state.hasChecked)
  const checkSession = useAuthStore((state) => state.checkSession)
  const hydrate = useFinanceStore((state) => state.hydrate)
  const reset = useFinanceStore((state) => state.reset)

  useEffect(() => {
    if (!hasChecked) {
      void checkSession()
    }
  }, [checkSession, hasChecked])

  useEffect(() => {
    if (authMode === 'authenticated' || authMode === 'guest') {
      void hydrate()
      return
    }

    reset()
  }, [authMode, hydrate, reset])

  if (isChecking && !hasChecked) {
    return (
      <div
        className="flex min-h-dvh items-center justify-center"
        style={{ background: 'var(--app-shell-background)', backgroundSize: 'var(--app-shell-background-size, auto)' }}
      >
        <div className="rounded-2xl border border-graphite bg-surface px-6 py-5 text-sm text-muted-gray shadow-vault">
          Verificando acceso...
        </div>
      </div>
    )
  }

  if (authMode === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/salary" element={<Salary />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/wants" element={<Wants />} />
        <Route path="/savings" element={<Savings />} />
        <Route path="/debts" element={<Debts />} />
        <Route path="/wishlist" element={<Wishlist />} />
        <Route path="/events" element={<Events />} />
        <Route path="/projections" element={<Projections />} />
        <Route path="/reminders" element={<Reminders />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </AppLayout>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/*" element={<ProtectedApp />} />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppPreferencesEffects />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
      <Toaster
        theme="dark"
        toastOptions={{
          style: {
            background: '#1e1e1e',
            border: '1px solid #3f3f3f',
            color: '#eeeeee',
          },
        }}
      />
    </QueryClientProvider>
  )
}
