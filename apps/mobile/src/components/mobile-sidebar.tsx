import { useMemo } from 'react'
import { router, usePathname } from 'expo-router'
import { ChevronLeft, LifeBuoy, LogOut, User } from 'lucide-react-native'
import { Pressable, ScrollView, View } from 'react-native'

import { mobileNavItems } from '../lib/mobile-nav'
import { useAuthStore } from '../store/auth-store'
import { useFinanceStore } from '../store/finance-store'
import { usePreferencesStore, formatFormulaLabel } from '../store/preferences-store'
import { resolvePalette } from '../theme/palette'
import { Avatar, AvatarFallback } from './ui/avatar'
import { Button } from './ui/button'
import { Card, CardContent } from './ui/card'
import { Text } from './ui/text'

const ChevronLeftIcon = ChevronLeft as any
const UserIcon = User as any
const LifeBuoyIcon = LifeBuoy as any
const LogOutIcon = LogOut as any

export function MobileSidebar({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const pathname = usePathname()
  const authMode = useAuthStore((state) => state.authMode)
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const resetFinance = useFinanceStore((state) => state.reset)
  const formula = usePreferencesStore((state) => state.formula)
  const appearance = usePreferencesStore((state) => state.appearance)
  const theme = usePreferencesStore((state) => state.theme)
  const palette = resolvePalette(appearance, theme)

  const profileName = authMode === 'guest' ? 'Invitado local' : user?.name ?? 'Usuario'
  const profileEmail = authMode === 'guest' ? 'Datos guardados solo en este dispositivo' : user?.email ?? ''
  const profileInitial = useMemo(() => profileName.charAt(0).toUpperCase(), [profileName])

  async function handleLogout() {
    await logout()
    await resetFinance()
    onClose()
  }

  function handleNavigate(href: string) {
    router.push(href as never)
    onClose()
  }

  if (!open) {
    return null
  }

  return (
    <>
      <Pressable className="absolute inset-0 z-30 bg-black/60" onPress={onClose} />
      <View className="absolute inset-y-0 left-0 z-40 w-[285px] border-r border-border bg-card">
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 24 }}>
          <View className="flex-row items-center justify-between px-4 pb-3 pt-5">
            <View className="flex-row items-center gap-3">
              <View className="size-10 items-center justify-center rounded-full bg-primary/15">
                <Text className="text-primary text-sm font-bold">P</Text>
              </View>
              <View>
                <Text className="text-base font-semibold">Plata App</Text>
                <Text className="text-muted-foreground text-xs">Control financiero {formatFormulaLabel(formula)}</Text>
              </View>
            </View>

            <Pressable
              className="rounded-full border border-border bg-secondary p-2"
              onPress={onClose}
            >
              <ChevronLeftIcon size={18} color={palette.text} />
            </Pressable>
          </View>

          <View className="gap-1 px-3">
            {mobileNavItems.map((item) => {
              const active = pathname === item.href
              const ItemIcon = item.icon as any

              return (
                <Pressable
                  key={item.href}
                  className={`flex-row items-center gap-3 rounded-xl px-3 py-3 ${active ? 'bg-primary' : 'bg-transparent'}`}
                  onPress={() => handleNavigate(item.href)}
                >
                  <ItemIcon size={18} color={active ? palette.textOnPrimary : palette.textMuted} />
                  <Text className={active ? 'text-primary-foreground font-semibold' : 'text-muted-foreground'}>
                    {item.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          <View className="mt-5 gap-3 px-3">
            <Card>
              <CardContent className="flex-row items-center gap-3 pt-6">
                <Avatar alt={profileName} className="size-11">
                  <AvatarFallback>
                    {authMode === 'guest' ? (
                      <UserIcon size={16} color={palette.text} />
                    ) : (
                      <Text className="font-bold">{profileInitial}</Text>
                    )}
                  </AvatarFallback>
                </Avatar>
                <View className="flex-1">
                  <Text className="font-semibold">{profileName}</Text>
                  <Text className="text-muted-foreground text-xs">{profileEmail}</Text>
                </View>
              </CardContent>
            </Card>

            <Button variant="outline" className="justify-start" onPress={() => {}}>
              <LifeBuoyIcon size={16} color={palette.textMuted} />
              <Text>Soporte</Text>
            </Button>

            <Button className="justify-start" onPress={() => void handleLogout()}>
              <LogOutIcon size={16} color={palette.textOnPrimary} />
              <Text>{authMode === 'guest' ? 'Salir del modo invitado' : 'Cerrar sesion'}</Text>
            </Button>
          </View>
        </ScrollView>
      </View>
    </>
  )
}
