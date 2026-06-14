import { useFinanceStore } from '@/store/financeStore'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'
import { Plus, Wallet, Bell, Landmark, Calendar, Building2, Coffee, PiggyBank, CreditCard, ChevronRight } from 'lucide-react'
import { useMonthlyOverview } from '@/lib/useMonthlyOverview'

export default function Dashboard() {
  const navigate = useNavigate()
  const overview = useMonthlyOverview()
  const { reminders, debts } = useFinanceStore()

  const totalDebt = debts.reduce((s, d) => s + (d.totalAmount - d.paidAmount), 0)
  const pendingReminders = reminders.filter((r) => !r.completed).length

  const savingsPercentage = overview.budgetSavings > 0
    ? Math.min(100, Math.round((overview.totalSavings / overview.budgetSavings) * 100))
    : 0
  const wantsPercentage = overview.budgetWants > 0
    ? Math.min(100, Math.round((overview.totalWants / overview.budgetWants) * 100))
    : 0
  const expensesPercentage = overview.budgetExpenses > 0
    ? Math.min(100, Math.round((overview.totalExpenses / overview.budgetExpenses) * 100))
    : 0

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-[28px] md:text-[36px] font-semibold text-on-surface tracking-tight">
            Resumen Mensual
          </h1>
          <p className="text-sm text-muted-gray mt-1">
            Análisis de distribución salarial: Regla 50/25/25
          </p>
        </div>
        <div className="flex items-center gap-3 bg-surface rounded-full px-4 py-1.5 shadow-vault text-sm">
          <Calendar className="size-4 text-muted-gray" />
          <span className="font-medium text-on-surface">
            {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
          </span>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface p-6 rounded-xl shadow-vault flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary opacity-5 rounded-bl-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-500" />
          <div className="flex justify-between items-start mb-6 relative z-10">
            <div className="size-10 rounded-lg bg-surface-container-high flex items-center justify-center shadow-vault">
              <Building2 className="size-5 text-primary" />
            </div>
            <span className="bg-tertiary-container/20 text-tertiary rounded-full px-3 py-0.5 text-xs">
              50% Objetivo
            </span>
          </div>
          <div className="relative z-10">
            <p className="text-xs text-muted-gray uppercase tracking-wider mb-1">Gastos Esenciales</p>
            <h3 className="text-[28px] font-semibold text-on-surface mb-2">
              ${overview.totalExpenses.toLocaleString()}
            </h3>
            <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-1000" style={{ width: `${expensesPercentage}%` }} />
            </div>
            <p className="text-xs text-muted-gray mt-2 text-right">
              {expensesPercentage}% Consumido
            </p>
          </div>
        </div>

        <div className="bg-surface p-6 rounded-xl shadow-vault flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-secondary opacity-5 rounded-bl-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-500" />
          <div className="flex justify-between items-start mb-6 relative z-10">
            <div className="size-10 rounded-lg bg-surface-container-high flex items-center justify-center shadow-vault">
              <Coffee className="size-5 text-secondary" />
            </div>
            <span className="bg-secondary-container/20 text-secondary rounded-full px-3 py-0.5 text-xs">
              25% Objetivo
            </span>
          </div>
          <div className="relative z-10">
            <p className="text-xs text-muted-gray uppercase tracking-wider mb-1">Gustos & Estilo</p>
            <h3 className="text-[28px] font-semibold text-on-surface mb-2">
              ${overview.totalWants.toLocaleString()}
            </h3>
            <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
              <div className="h-full bg-secondary rounded-full transition-all duration-1000" style={{ width: `${wantsPercentage}%` }} />
            </div>
            <p className="text-xs text-warning mt-2 text-right">
              {wantsPercentage}% Consumido
            </p>
          </div>
        </div>

        <div className="bg-surface p-6 rounded-xl shadow-vault flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-tertiary-container opacity-5 rounded-bl-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-500" />
          <div className="flex justify-between items-start mb-6 relative z-10">
            <div className="size-10 rounded-lg bg-surface-container-high flex items-center justify-center shadow-vault">
              <PiggyBank className="size-5 text-tertiary-container" />
            </div>
            <span className="bg-tertiary-container/20 text-tertiary rounded-full px-3 py-0.5 text-xs">
              25% Objetivo
            </span>
          </div>
          <div className="relative z-10">
            <p className="text-xs text-muted-gray uppercase tracking-wider mb-1">Ahorros & Inversión</p>
            <h3 className="text-[28px] font-semibold text-on-surface mb-2">
              ${overview.totalSavings.toLocaleString()}
            </h3>
            <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
              <div className="h-full bg-tertiary-container rounded-full transition-all duration-1000" style={{ width: `${savingsPercentage}%` }} />
            </div>
            <p className="text-xs text-muted-gray mt-2 text-right">
              {savingsPercentage}% Consumido
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-surface rounded-xl shadow-vault p-6">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-graphite">
            <h3 className="text-[18px] font-medium text-on-surface">Próximos Recordatorios</h3>
            <button
              className="text-sm text-primary hover:text-primary-fixed transition-colors"
              onClick={() => navigate('/reminders')}
            >
              Ver todos
            </button>
          </div>
          {pendingReminders === 0 ? (
            <div className="flex flex-col items-center py-8 text-muted-gray text-sm">
              <Bell className="size-6 mb-2" />
              <p>No hay recordatorios pendientes</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {reminders.filter(r => !r.completed).slice(0, 3).map((r) => (
                <div key={r.id} className="flex items-center gap-4 p-2.5 rounded-lg hover:bg-surface-container-high transition-colors cursor-pointer group">
                  <div className="size-12 rounded-lg bg-surface-container-lowest flex items-center justify-center shadow-vault">
                    <CreditCard className="size-5 text-muted-gray group-hover:text-primary transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-on-surface truncate">{r.title}</p>
                    <p className="text-xs text-muted-gray">
                      {new Date(r.date).toLocaleDateString()}
                    </p>
                  </div>
                  <ChevronRight className="size-5 text-muted-gray group-hover:text-primary transition-colors" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-surface rounded-xl shadow-vault p-6 flex flex-col">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-graphite">
            <h3 className="text-[18px] font-medium text-on-surface">Estado de Deudas</h3>
          </div>
          {debts.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-muted-gray text-sm flex-1 justify-center">
              <Landmark className="size-6 mb-2" />
              <p>No hay deudas registradas</p>
              <Button variant="link" size="sm" className="mt-2" onClick={() => navigate('/debts')}>
                Agregar deuda
              </Button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-center gap-4">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-xs text-muted-gray uppercase tracking-wider mb-1">Deuda Total Activa</p>
                  <h2 className="text-[24px] font-semibold text-on-surface">
                    ${totalDebt.toLocaleString()}
                  </h2>
                </div>
              </div>
              <div className="w-full h-3 bg-surface-container-highest rounded-full overflow-hidden flex">
                {debts.slice(0, 2).map((d, i) => {
                  const pct = totalDebt > 0 ? ((d.totalAmount - d.paidAmount) / totalDebt) * 100 : 0
                  return (
                    <div
                      key={d.id}
                      className="h-full transition-all duration-700"
                      style={{
                        width: `${pct}%`,
                        background: i === 0 ? 'var(--color-outline)' : 'var(--color-outline-variant)',
                        borderRight: i < Math.min(debts.length, 2) - 1 ? '2px solid var(--color-surface)' : 'none',
                      }}
                    />
                  )}
                )}
              </div>
              <button className="w-full py-2.5 rounded-lg border border-graphite text-on-surface text-sm hover:bg-surface-container-high transition-colors shadow-vault">
                Simular Pago Extra
              </button>
            </div>
          )}
        </div>
      </section>

      {overview.totalSalary === 0 && (
        <div className="bg-surface rounded-xl shadow-vault p-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <Wallet className="size-8 text-muted-gray" />
            <p className="text-sm text-muted-gray">
              Configura tu salario mensual para empezar a trackear tus finanzas
            </p>
            <Button onClick={() => navigate('/salary')} className="bg-primary-container text-white hover:brightness-110 shadow-vault">
              <Plus className="size-4" />
              Set Salary
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
