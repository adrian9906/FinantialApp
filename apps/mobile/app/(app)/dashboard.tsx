import { router } from 'expo-router'
import { getMonthlyOverview } from '@plata/shared'
import { View } from 'react-native'

import { AppFrame } from '../../src/components/app-frame'
import { mobileNavItems } from '../../src/lib/mobile-nav'
import { Avatar, AvatarFallback } from '../../src/components/ui/avatar'
import { Button } from '../../src/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../src/components/ui/card'
import { Text } from '../../src/components/ui/text'
import { useAuthStore } from '../../src/store/auth-store'
import { useFinanceStore } from '../../src/store/finance-store'
import { usePreferencesStore } from '../../src/store/preferences-store'
import { resolvePalette } from '../../src/theme/palette'

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

export default function DashboardScreen() {
  const authMode = useAuthStore((state) => state.authMode)
  const user = useAuthStore((state) => state.user)
  const salaries = useFinanceStore((state) => state.salaries)
  const transactions = useFinanceStore((state) => state.transactions)
  const wishlist = useFinanceStore((state) => state.wishlist)
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

  return (
    <AppFrame
      title="Dashboard"
      subtitle="Resumen principal, bloques de ahorro y accesos rapidos para el clon mobile de Plata App."
      actions={
        authMode === 'guest' ? (
          <Card
            className="border"
            style={{
              borderColor: `${palette.warning}44`,
              backgroundColor: `${palette.warning}18`,
            }}
          >
            <CardContent className="pt-6">
              <Text className="font-semibold">Estas usando Plata App como invitado</Text>
              <Text className="text-muted-foreground mt-2 text-sm leading-6">
                Tus datos viven solo en este dispositivo. Si quieres guardarlos en tu cuenta, inicia sesion o crea una cuenta.
              </Text>
              {!hasLoaded || salaries.length === 0 ? (
                <Button className="mt-4 self-start" onPress={() => void seedGuestData()}>
                  <Text>Cargar demo local</Text>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex-row items-center gap-4 pt-6">
              <Avatar alt={user?.name ?? 'Usuario'} className="size-12">
                <AvatarFallback>
                  <Text className="font-bold">{(user?.name ?? 'U').slice(0, 1).toUpperCase()}</Text>
                </AvatarFallback>
              </Avatar>
              <View className="flex-1">
                <Text className="font-semibold">{user?.name ?? 'Usuario'}</Text>
                <Text className="text-muted-foreground text-sm">Sesion lista para sincronizar con Prisma + PostgreSQL.</Text>
              </View>
            </CardContent>
          </Card>
        )
      }
    >
      <View className="flex-row flex-wrap gap-3">
        {[
          { label: 'Ingresos', value: formatMoney(overview.totalSalary) },
          { label: 'Gastos', value: formatMoney(overview.totalExpenses) },
          { label: 'Gustos', value: formatMoney(overview.totalWants) },
          { label: 'Ahorro', value: formatMoney(overview.totalSavings) },
        ].map((card) => (
          <Card key={card.label} className="min-w-[150px] flex-1">
            <CardContent className="pt-6">
              <Text className="text-muted-foreground text-sm">{card.label}</Text>
              <Text className="mt-2 text-2xl font-bold">{card.value}</Text>
            </CardContent>
          </Card>
        ))}
      </View>

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

      <Card>
        <CardHeader>
          <CardTitle>Secciones</CardTitle>
          <CardDescription>Navegacion base del clon mobile usando componentes reusables.</CardDescription>
        </CardHeader>
        <CardContent className="flex-row flex-wrap gap-3">
          {mobileNavItems.map((route) => (
            <Button key={route.href} variant="outline" className="self-start" onPress={() => router.push(route.href as never)}>
              <Text>{route.label}</Text>
            </Button>
          ))}
        </CardContent>
      </Card>
    </AppFrame>
  )
}
