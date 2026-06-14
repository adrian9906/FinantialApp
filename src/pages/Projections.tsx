import { useMemo } from 'react'
import { useFinanceStore } from '@/store/financeStore'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TrendingUp, CalendarClock, Target, BarChart3, FileText, PiggyBank, PlusCircle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useMonthlyOverview } from '@/lib/useMonthlyOverview'

export default function Projections() {
  const { wishlist, goals, events, salaries } = useFinanceStore()
  const overview = useMonthlyOverview()

  const projections = useMemo(() => {
    const monthlySavings = overview.budgetSavings
    const items: { name: string; target: number; months: number; type: string }[] = []

    wishlist.forEach((w) => {
      const remaining = w.price - w.savedAmount
      if (remaining > 0 && monthlySavings > 0) {
        items.push({ name: w.name, target: w.price, months: Math.ceil(remaining / monthlySavings), type: 'Wishlist' })
      }
    })
    goals.forEach((g) => {
      const remaining = g.targetAmount - g.currentAmount
      if (remaining > 0 && monthlySavings > 0) {
        items.push({ name: g.name, target: g.targetAmount, months: Math.ceil(remaining / monthlySavings), type: 'Goal' })
      }
    })
    events.forEach((e) => {
      const remaining = e.budget - e.spent
      if (remaining > 0 && monthlySavings > 0) {
        items.push({ name: e.name, target: e.budget, months: Math.ceil(remaining / monthlySavings), type: 'Event' })
      }
    })

    return items.sort((a, b) => a.months - b.months)
  }, [wishlist, goals, events, overview.budgetSavings])

  const chartData = useMemo(() => {
    if (salaries.length === 0) return []
    const monthlyData = []
    for (let i = 0; i < 12; i++) {
      const d = new Date()
      d.setMonth(d.getMonth() + i)
      const month = d.toLocaleString('default', { month: 'short', year: '2-digit' })
      monthlyData.push({
        month,
        savings: overview.budgetSavings,
        expenses: overview.budgetExpenses,
      })
    }
    return monthlyData
  }, [overview, salaries])

  if (salaries.length === 0) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <header>
          <h1 className="text-[28px] md:text-[36px] font-semibold text-on-surface tracking-tight">Proyecciones</h1>
          <p className="text-sm text-muted-gray">Mira cuánto falta para alcanzar tus metas</p>
        </header>
        <Card className="bg-surface border-0 shadow-vault">
          <div className="flex flex-col items-center gap-3 py-16 text-muted-gray text-sm">
            <TrendingUp className="size-8" />
            <p>Configura tu salario primero para ver proyecciones</p>
            <Button variant="secondary" className="bg-surface-container-high text-on-surface" onClick={() => window.location.href = '/salary'}>
              Ir a Salario
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] md:text-[36px] font-semibold text-on-surface tracking-tight">Projections</h1>
          <p className="text-sm text-muted-gray">Basado en tus ahorros mensuales de <span className="text-primary font-semibold">${overview.budgetSavings.toLocaleString()}</span></p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-surface rounded-xl p-5 shadow-vault">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-medium text-on-surface">Pronóstico de Ahorro a 12 Meses</h2>
            <BarChart3 className="size-5 text-primary" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3f3f3f" />
                <XAxis dataKey="month" stroke="#a3a3a3" fontSize={12} tick={{ fill: '#a3a3a3' }} />
                <YAxis stroke="#a3a3a3" fontSize={12} tick={{ fill: '#a3a3a3' }} />
                <Tooltip
                  contentStyle={{ background: '#1e1e1e', border: '1px solid #3f3f3f', borderRadius: '12px', color: '#eeeeee' }}
                />
                <Bar dataKey="savings" fill="#7c3aed" name="Ahorros" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" fill="#3f3f3f" name="Presupuesto Necesidades" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-surface rounded-xl p-5 shadow-vault flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-medium text-on-surface">Resumen</h2>
            <FileText className="size-5 text-primary" />
          </div>
          <div className="space-y-3 flex-1">
            <div className="p-3 rounded-lg bg-surface-container-low">
              <div className="flex items-center gap-2 text-sm text-muted-gray"><CalendarClock className="size-4" /> Metas Rastreadas</div>
              <div className="text-xl font-semibold text-on-surface mt-1">{projections.length}</div>
            </div>
            <div className="p-3 rounded-lg bg-surface-container-low">
              <div className="flex items-center gap-2 text-sm text-muted-gray"><Target className="size-4" /> Meta Más Cercana</div>
              {projections.length > 0 ? (
                <div className="mt-1">
                  <div className="text-sm font-medium text-on-surface">{projections[0].name}</div>
                  <div className="text-xs text-muted-gray">{projections[0].months <= 1 ? 'Menos de 1 mes' : `${projections[0].months} meses`}</div>
                </div>
              ) : (
                <div className="text-xs text-muted-gray mt-1">Sin metas activas</div>
              )}
            </div>
            <div className="p-3 rounded-lg bg-surface-container-low">
              <div className="flex items-center gap-2 text-sm text-muted-gray"><PiggyBank className="size-4" /> Ahorro Mensual</div>
              <div className="text-xl font-semibold text-primary mt-1">${overview.budgetSavings.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>

      {projections.length > 0 ? (
        <div className="bg-surface rounded-xl shadow-vault overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-graphite">
            <h2 className="text-base font-medium text-on-surface">Tiempo para la Meta</h2>
            <span className="text-xs text-muted-gray">{projections.length} artículos</span>
          </div>
          <div className="divide-y divide-graphite">
            {projections.map((p, i) => {
              const barWidth = p.months > 12 ? 100 : (p.months / 12) * 100
              return (
                <div key={i} className="p-4 hover:bg-surface-container-low transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-medium text-on-surface truncate">{p.name}</h3>
                      <p className="text-xs text-muted-gray">${p.target.toLocaleString()} &middot; {p.type}</p>
                    </div>
                    <div className="ml-3 px-2.5 py-1 rounded-full bg-primary-container/20 border border-primary-container/30">
                      <span className="text-xs text-primary font-medium whitespace-nowrap">
                        {p.months <= 1 ? '&lt;1 mes' : `${p.months} meses`}
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, barWidth)}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <Card className="bg-surface border-0 shadow-vault">
          <div className="flex flex-col items-center gap-3 py-16 text-muted-gray text-sm">
            <PlusCircle className="size-8" />
            <p>Agrega artículos a tu lista de deseos o metas para ver proyecciones</p>
          </div>
        </Card>
      )}
    </div>
  )
}
