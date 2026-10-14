import { AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { accountHealthMessage } from '@/lib/account-health'
import { formatAccountHealthMoney } from '@/lib/account-health-notifications'
import { useAccountHealth } from '@/lib/useAccountHealth'
import { usePreferencesStore } from '@/store/preferencesStore'

export function AccountHealthCards() {
  const { alerts, inLastWeek } = useAccountHealth()
  const selectAccount = usePreferencesStore(state => state.setActiveIncomeSource)
  const navigate = useNavigate()
  if (!inLastWeek || !alerts.length) return null
  return <section className="flex flex-col gap-3" aria-label="Revisión de fin de mes por cuenta">
    <div><h2 className="text-xl font-semibold">Cómo llegas a fin de mes</h2><p className="mt-1 text-sm text-muted-gray">Revisión de todas tus cuentas con los últimos datos registrados.</p></div>
    <div className="grid gap-3 md:grid-cols-2">{alerts.map(alert => {
      const message = accountHealthMessage(alert, formatAccountHealthMoney)
      const color = alert.level === 'critical' ? 'var(--error)' : alert.level === 'success' ? 'var(--success)' : 'var(--warning)'
      const Icon = alert.level === 'success' ? CheckCircle2 : AlertTriangle
      return <Card key={alert.accountId} style={{ borderColor: `color-mix(in srgb, ${color} 50%, transparent)`, backgroundColor: `color-mix(in srgb, ${color} 8%, var(--surface))` }}>
        <CardHeader><CardTitle className="flex items-start gap-2" style={{ color }}><Icon className="mt-0.5 size-5 shrink-0" />{message.title}</CardTitle><CardDescription>{alert.currencyCode} · Últimos 7 días del mes</CardDescription></CardHeader>
        <CardContent className="flex flex-col gap-3"><p className="text-sm leading-relaxed">{message.body}</p><dl className="grid grid-cols-2 gap-3 text-xs"><div><dt className="text-muted-gray">Pagos pendientes</dt><dd className="mt-1 font-medium">{formatAccountHealthMoney(alert.commitments, alert.currencyCode)}</dd></div><div><dt className="text-muted-gray">Gasto adicional estimado</dt><dd className="mt-1 font-medium">{formatAccountHealthMoney(alert.forecast, alert.currencyCode)}</dd></div></dl><p className="text-xs text-muted-gray">Estimación hasta fin de mes. No incluye pagos que aún no hayas registrado.</p></CardContent>
        <CardFooter><Button variant="outline" size="sm" onClick={() => { selectAccount(alert.accountId); navigate(alert.level === 'success' ? '/salary' : '/expenses') }}>{alert.level === 'success' ? 'Revisar cuenta y ahorro' : 'Revisar gastos'}<ArrowRight data-icon="inline-end" /></Button></CardFooter>
      </Card>
    })}</div>
  </section>
}
