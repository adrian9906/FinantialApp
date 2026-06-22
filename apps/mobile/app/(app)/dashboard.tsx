import { useMemo } from 'react'
import { router } from 'expo-router'
import { getMonthlyOverview } from '@plata/shared'
import {
  Bell,
  Calendar,
  Coffee,
  Landmark,
  PiggyBank,
  Sparkles,
  Wallet,
} from 'lucide-react-native'
import { Pressable, View } from 'react-native'
import Svg, { Circle, Rect } from 'react-native-svg'

import { AppFrame } from '../../src/components/app-frame'
import { Avatar, AvatarFallback } from '../../src/components/ui/avatar'
import { Button } from '../../src/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../src/components/ui/card'
import { Text } from '../../src/components/ui/text'
import { useAuthStore } from '../../src/store/auth-store'
import { useFinanceStore } from '../../src/store/finance-store'
import { formatFormulaLabel, usePreferencesStore } from '../../src/store/preferences-store'
import { resolvePalette } from '../../src/theme/palette'
import { radius, spacing } from '../../src/theme/tokens'

const WalletIcon = Wallet as any
const PiggyBankIcon = PiggyBank as any
const CoffeeIcon = Coffee as any
const BellIcon = Bell as any
const CalendarIcon = Calendar as any
const LandmarkIcon = Landmark as any
const SparklesIcon = Sparkles as any

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(value))
}

function formatLongMonth() {
  return new Intl.DateTimeFormat('es-ES', {
    month: 'long',
    year: 'numeric',
  }).format(new Date())
}

function AllocationChart({
  salary,
  expenses,
  wants,
  savings,
  palette,
}: {
  salary: number
  expenses: number
  wants: number
  savings: number
  palette: ReturnType<typeof resolvePalette>
}) {
  const chartHeight = 170
  const maxValue = Math.max(salary, expenses, wants, savings, 1)
  const bars = [
    { label: 'Salario', value: salary, color: palette.primary },
    { label: 'Gastos', value: expenses, color: palette.warning },
    { label: 'Gustos', value: wants, color: '#f97316' },
    { label: 'Ahorros', value: savings, color: palette.success },
  ]

  return (
    <View style={{ gap: spacing.md }}>
      <Svg width="100%" height={chartHeight} viewBox="0 0 260 170">
        {bars.map((bar, index) => {
          const width = 42
          const gap = 18
          const x = 16 + index * (width + gap)
          const barHeight = Math.max(8, (bar.value / maxValue) * 122)
          const y = 140 - barHeight

          return (
            <Rect
              key={bar.label}
              x={x}
              y={y}
              width={width}
              height={barHeight}
              rx={12}
              fill={bar.color}
              opacity={0.92}
            />
          )
        })}
        <Rect x="10" y="140" width="240" height="2" rx="1" fill={palette.border} />
      </Svg>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
        {bars.map((bar) => (
          <View key={bar.label} style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: bar.color }} />
              <Text style={{ color: palette.textMuted, fontSize: 12 }}>{bar.label}</Text>
            </View>
            <Text style={{ color: palette.text, fontSize: 12, fontWeight: '700' }}>{formatMoney(bar.value)}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

function CompositionChart({
  expenses,
  wants,
  savings,
  palette,
}: {
  expenses: number
  wants: number
  savings: number
  palette: ReturnType<typeof resolvePalette>
}) {
  const radiusValue = 56
  const circumference = 2 * Math.PI * radiusValue
  const total = Math.max(expenses + wants + savings, 1)
  const segments = [
    { label: 'Gastos', value: expenses, color: palette.primary },
    { label: 'Gustos', value: wants, color: '#f97316' },
    { label: 'Ahorros', value: savings, color: palette.success },
  ].filter((segment) => segment.value > 0)

  let offset = 0

  return (
    <View style={{ alignItems: 'center', gap: spacing.lg }}>
      <View style={{ width: 160, height: 160, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={160} height={160} viewBox="0 0 160 160">
          <Circle cx="80" cy="80" r={radiusValue} stroke={palette.surfaceMuted} strokeWidth="18" fill="none" />
          {segments.map((segment) => {
            const segmentLength = (segment.value / total) * circumference
            const dashOffset = circumference - offset
            offset += segmentLength

            return (
              <Circle
                key={segment.label}
                cx="80"
                cy="80"
                r={radiusValue}
                stroke={segment.color}
                strokeWidth="18"
                fill="none"
                strokeDasharray={`${segmentLength} ${circumference}`}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                transform="rotate(-90 80 80)"
              />
            )
          })}
        </Svg>
        <View style={{ position: 'absolute', alignItems: 'center', gap: 2 }}>
          <Text style={{ color: palette.text, fontSize: 22, fontWeight: '700' }}>{formatMoney(total)}</Text>
          <Text style={{ color: palette.textMuted, fontSize: 12 }}>movido este mes</Text>
        </View>
      </View>

      <View style={{ width: '100%', gap: spacing.sm }}>
        {segments.map((segment) => (
          <View
            key={segment.label}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: palette.border,
              backgroundColor: palette.surfaceMuted,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: segment.color }} />
              <Text style={{ color: palette.text, fontSize: 13 }}>{segment.label}</Text>
            </View>
            <Text style={{ color: palette.text, fontSize: 13, fontWeight: '700' }}>{formatMoney(segment.value)}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

export default function DashboardScreen() {
  const authMode = useAuthStore((state) => state.authMode)
  const user = useAuthStore((state) => state.user)
  const salaries = useFinanceStore((state) => state.salaries)
  const transactions = useFinanceStore((state) => state.transactions)
  const wishlist = useFinanceStore((state) => state.wishlist)
  const reminders = useFinanceStore((state) => state.reminders)
  const events = useFinanceStore((state) => state.events)
  const debts = useFinanceStore((state) => state.debts)
  const hasLoaded = useFinanceStore((state) => state.hasLoaded)
  const seedGuestData = useFinanceStore((state) => state.seedGuestData)
  const getWishlistProjection = useFinanceStore((state) => state.getWishlistProjection)
  const formula = usePreferencesStore((state) => state.formula)
  const appearance = usePreferencesStore((state) => state.appearance)
  const theme = usePreferencesStore((state) => state.theme)
  const palette = resolvePalette(appearance, theme)
  const overview = getMonthlyOverview(salaries, transactions, formula)
  const featuredWish = wishlist[0] ?? null
  const projection = featuredWish ? getWishlistProjection(featuredWish) : null

  const pendingReminders = useMemo(
    () => reminders.filter((reminder) => !reminder.completed).slice(0, 3),
    [reminders],
  )
  const upcomingEvents = useMemo(
    () =>
      events
        .filter((event) => new Date(event.date).getTime() >= new Date().setHours(0, 0, 0, 0))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 1),
    [events],
  )

  const totalDebt = debts.reduce((sum, debt) => sum + debt.amount, 0)
  const salaryHealth = overview.totalSalary - overview.totalExpenses - overview.totalWants - overview.totalSavings
  const savingsPercentage = overview.budgetSavings > 0 ? Math.min(100, Math.round((overview.totalSavings / overview.budgetSavings) * 100)) : 0
  const wantsPercentage = overview.budgetWants > 0 ? Math.min(100, Math.round((overview.totalWants / overview.budgetWants) * 100)) : 0
  const expensesPercentage = overview.budgetExpenses > 0 ? Math.min(100, Math.round((overview.totalExpenses / overview.budgetExpenses) * 100)) : 0

  return (
    <AppFrame
      title="Dashboard"
      subtitle="Resumen mensual con pulso financiero, distribucion real y accesos directos parecidos a la version web."
    >
      <Card
        style={{
          overflow: 'hidden',
          borderColor: `${palette.primary}22`,
          backgroundColor: palette.surface,
        }}
      >
        <CardContent className="pt-6">
          <View style={{ gap: spacing.lg }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 16,
                  backgroundColor: palette.primarySoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <WalletIcon size={22} color={palette.primary} />
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  borderRadius: radius.full,
                  borderWidth: 1,
                  borderColor: `${palette.primary}22`,
                  backgroundColor: palette.primarySoft,
                  paddingHorizontal: spacing.md,
                  paddingVertical: 6,
                }}
              >
                <SparklesIcon size={14} color={palette.primary} />
                <Text style={{ color: palette.primary, fontSize: 12, fontWeight: '700' }}>Base del mes</Text>
              </View>
            </View>

            <View style={{ gap: spacing.sm }}>
              <Text style={{ color: palette.textMuted, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase' }}>
                Salario registrado
              </Text>
              <Text style={{ color: palette.text, fontSize: 38, fontWeight: '800', marginTop: 6, height: 44, padding: 4 }}>
                {formatMoney(overview.totalSalary)}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View
                style={{
                  flex: 1,
                  borderRadius: radius.md,
                  backgroundColor: palette.surfaceMuted,
                  padding: spacing.md,
                }}
              >
                <Text style={{ color: palette.textMuted, fontSize: 11, textTransform: 'uppercase' }}>Liquidez</Text>
                <Text style={{ color: salaryHealth >= 0 ? palette.success : palette.warning, fontSize: 18, fontWeight: '700', marginTop: 6 }}>
                  {formatMoney(salaryHealth)}
                </Text>
              </View>
              <View
                style={{
                  flex: 1,
                  borderRadius: radius.md,
                  backgroundColor: palette.surfaceMuted,
                  padding: spacing.md,
                }}
              >
                <Text style={{ color: palette.textMuted, fontSize: 11, textTransform: 'uppercase' }}>Distribuido</Text>
                <Text style={{ color: palette.text, fontSize: 18, fontWeight: '700', marginTop: 6 }}>
                  {overview.totalSalary > 0 ? Math.min(100, Math.round(((overview.totalExpenses + overview.totalWants + overview.totalSavings) / overview.totalSalary) * 100)) : 0}%
                </Text>
              </View>
            </View>

            <View
              style={{
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: palette.border,
                backgroundColor: palette.backgroundAlt,
                padding: spacing.md,
                gap: spacing.sm,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: palette.textMuted, fontSize: 12 }}>Distribucion del ingreso</Text>
                <Text style={{ color: palette.textMuted, fontSize: 12 }}>{formatLongMonth()}</Text>
              </View>
              <View style={{ flexDirection: 'row', height: 10, borderRadius: radius.full, overflow: 'hidden', backgroundColor: palette.surfaceMuted }}>
                <View style={{ width: `${expensesPercentage}%`, backgroundColor: palette.primary }} />
                <View style={{ width: `${wantsPercentage}%`, backgroundColor: '#f97316' }} />
                <View style={{ width: `${savingsPercentage}%`, backgroundColor: palette.success }} />
              </View>
            </View>
          </View>
        </CardContent>
      </Card>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {[
          { label: 'Gastos esenciales', value: overview.totalExpenses, goal: overview.budgetExpenses, icon: CoffeeIcon, color: palette.primary, percent: expensesPercentage },
          { label: 'Gustos', value: overview.totalWants, goal: overview.budgetWants, icon: WalletIcon, color: '#f97316', percent: wantsPercentage },
          { label: 'Ahorros', value: overview.totalSavings, goal: overview.budgetSavings, icon: PiggyBankIcon, color: palette.success, percent: savingsPercentage },
        ].map((item) => {
          const ItemIcon = item.icon

          return (
            <Card key={item.label} className="min-w-[220px] flex-1">
              <CardContent className="pt-6">
                <View style={{ gap: spacing.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <View
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 14,
                        backgroundColor: `${item.color}22`,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <ItemIcon size={18} color={item.color} />
                    </View>
                    <View
                      style={{
                        borderRadius: radius.full,
                        backgroundColor: `${item.color}18`,
                        paddingHorizontal: spacing.sm,
                        paddingVertical: 5,
                      }}
                    >
                      <Text style={{ color: item.color, fontSize: 11, fontWeight: '700' }}>Objetivo {formatMoney(item.goal)}</Text>
                    </View>
                  </View>
                  <View>
                    <Text style={{ color: palette.textMuted, fontSize: 12, textTransform: 'uppercase' }}>{item.label}</Text>
                    <Text style={{ color: palette.text, fontSize: 28, fontWeight: '800', marginTop: 4 }}>{formatMoney(item.value)}</Text>
                  </View>
                  <View style={{ gap: 6 }}>
                    <View style={{ height: 8, borderRadius: radius.full, backgroundColor: palette.surfaceMuted, overflow: 'hidden' }}>
                      <View style={{ height: '100%', width: `${item.percent}%`, backgroundColor: item.color }} />
                    </View>
                    <Text style={{ color: palette.textMuted, fontSize: 12, textAlign: 'right' }}>{item.percent}% consumido</Text>
                  </View>
                </View>
              </CardContent>
            </Card>
          )
        })}
      </View>

      <Card>
        <CardHeader>
          <CardTitle>Pulso financiero</CardTitle>
          <CardDescription>Comparativa entre salario y movimientos del mes.</CardDescription>
        </CardHeader>
        <CardContent>
          <AllocationChart
            salary={overview.totalSalary}
            expenses={overview.totalExpenses}
            wants={overview.totalWants}
            savings={overview.totalSavings}
            palette={palette}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Composicion del mes</CardTitle>
          <CardDescription>Distribucion real entre gastos, gustos y ahorro.</CardDescription>
        </CardHeader>
        <CardContent>
          <CompositionChart
            expenses={overview.totalExpenses}
            wants={overview.totalWants}
            savings={overview.totalSavings}
            palette={palette}
          />
        </CardContent>
      </Card>

      {featuredWish && projection ? (
        <Card>
          <CardHeader>
            <CardTitle>Deseo destacado</CardTitle>
            <CardDescription>{featuredWish.name}</CardDescription>
          </CardHeader>
          <CardContent className="gap-2">
            <Text className="text-sm">Guardado: {formatMoney(featuredWish.savedAmount)} de {formatMoney(featuredWish.price)}</Text>
            <Text className="text-sm">Te faltan {formatMoney(projection.remaining)}</Text>
            <Text className="text-muted-foreground text-sm">{projection.timelineLabel}</Text>
            <Text className="text-primary text-sm font-semibold">{projection.purchaseDateLabel}</Text>
          </CardContent>
        </Card>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        <Card className="min-w-[250px] flex-1">
          <CardHeader className="flex-row items-center justify-between">
            <View>
              <CardTitle>Proximos recordatorios</CardTitle>
              <CardDescription>No pierdas facturas ni tareas pendientes.</CardDescription>
            </View>
            <Button variant="ghost" size="sm" onPress={() => router.push('/(app)/reminders')}>
              <Text>Ver todos</Text>
            </Button>
          </CardHeader>
          <CardContent className="gap-3">
            {pendingReminders.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm }}>
                <BellIcon size={22} color={palette.textMuted} />
                <Text style={{ color: palette.textMuted }}>No hay recordatorios pendientes</Text>
              </View>
            ) : (
              pendingReminders.map((reminder) => (
                <View
                  key={reminder.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                    borderRadius: radius.md,
                    backgroundColor: palette.surfaceMuted,
                    padding: spacing.md,
                  }}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: palette.backgroundAlt, alignItems: 'center', justifyContent: 'center' }}>
                    <BellIcon size={16} color={palette.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: palette.text, fontSize: 14, fontWeight: '700' }}>{reminder.title}</Text>
                    <Text style={{ color: palette.textMuted, fontSize: 12 }}>{formatShortDate(reminder.date)}</Text>
                  </View>
                </View>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="min-w-[250px] flex-1">
          <CardHeader className="flex-row items-center justify-between">
            <View>
              <CardTitle>Agenda y deudas</CardTitle>
              <CardDescription>Un vistazo rapido a lo proximo.</CardDescription>
            </View>
            <Button variant="ghost" size="sm" onPress={() => router.push('/(app)/debts')}>
              <Text>Ver deudas</Text>
            </Button>
          </CardHeader>
          <CardContent className="gap-3">
            <View
              style={{
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: palette.border,
                backgroundColor: palette.backgroundAlt,
                padding: spacing.md,
                gap: 8,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <CalendarIcon size={15} color={palette.textMuted} />
                <Text style={{ color: palette.textMuted, fontSize: 12 }}>Proximo evento</Text>
              </View>
              <Text style={{ color: palette.text, fontSize: 18, fontWeight: '700' }}>{upcomingEvents[0]?.name ?? 'Sin eventos'}</Text>
              <Text style={{ color: palette.textMuted, fontSize: 12 }}>
                {upcomingEvents[0] ? formatShortDate(upcomingEvents[0].date) : 'Agrega un evento para planificar'}
              </Text>
            </View>

            <View
              style={{
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: palette.border,
                backgroundColor: palette.backgroundAlt,
                padding: spacing.md,
                gap: 8,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <LandmarkIcon size={15} color={palette.textMuted} />
                <Text style={{ color: palette.textMuted, fontSize: 12 }}>Deuda activa</Text>
              </View>
              <Text style={{ color: palette.text, fontSize: 18, fontWeight: '700' }}>{formatMoney(totalDebt)}</Text>
              <Text style={{ color: palette.textMuted, fontSize: 12 }}>{debts[0] ? debts[0].history : 'No hay deudas pendientes'}</Text>
            </View>
          </CardContent>
        </Card>
      </View>

      {overview.totalSalary === 0 ? (
        <Card>
          <CardContent className="items-center pt-8">
            <View style={{ alignItems: 'center', gap: spacing.md }}>
              <WalletIcon size={28} color={palette.textMuted} />
              <Text style={{ color: palette.textMuted, textAlign: 'center' }}>
                Configura tu salario mensual para empezar a registrar datos en la app.
              </Text>
              <Button onPress={() => router.push('/(app)/salary')}>
                <Text>Configurar salario</Text>
              </Button>
            </View>
          </CardContent>
        </Card>
      ) : null}
    </AppFrame>
  )
}
