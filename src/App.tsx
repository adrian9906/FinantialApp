import { BrowserRouter, Routes, Route } from 'react-router-dom'
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
import { useEffect } from 'react'
import { useFinanceStore } from '@/store/financeStore'

const queryClient = new QueryClient()

function AppRoutes() {
  const hydrate = useFinanceStore((state) => state.hydrate)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

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
      </Routes>
    </AppLayout>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
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
