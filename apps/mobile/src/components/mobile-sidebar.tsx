import { useEffect, useMemo, useState } from 'react'
import { router, usePathname } from 'expo-router'
import { LifeBuoy, LogOut, User, X } from 'lucide-react-native'
import { Pressable, ScrollView, View } from 'react-native'
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { mobileNavItems } from '../lib/mobile-nav'
import { useAuthStore } from '../store/auth-store'
import { useFinanceStore } from '../store/finance-store'
import { usePreferencesStore, formatFormulaLabel } from '../store/preferences-store'
import { resolvePalette } from '../theme/palette'
import { radius } from '../theme/tokens'
import { Avatar, AvatarFallback } from './ui/avatar'
import { Button } from './ui/button'
import { Card, CardContent } from './ui/card'
import { Text } from './ui/text'

const UserIcon = User as any
const LifeBuoyIcon = LifeBuoy as any
const LogOutIcon = LogOut as any
const CloseIcon = X as any
const AnimatedPressable = Animated.createAnimatedComponent(Pressable)
const SIDEBAR_WIDTH = 292

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
  const [isMounted, setIsMounted] = useState(open)
  const progress = useSharedValue(open ? 1 : 0)

  const profileName = authMode === 'guest' ? 'Invitado local' : user?.name ?? 'Usuario'
  const profileEmail = authMode === 'guest' ? 'Datos guardados solo en este dispositivo' : user?.email ?? ''
  const profileInitial = useMemo(() => profileName.charAt(0).toUpperCase(), [profileName])

  useEffect(() => {
    if (open) {
      setIsMounted(true)
    }

    progress.value = withTiming(open ? 1 : 0, {
      duration: open ? 220 : 180,
      easing: open ? Easing.out(Easing.cubic) : Easing.inOut(Easing.cubic),
    })

    if (!open) {
      const timeout = setTimeout(() => setIsMounted(false), 190)
      return () => clearTimeout(timeout)
    }
  }, [open, progress])

  async function handleLogout() {
    await logout()
    await resetFinance()
    onClose()
  }

  function handleNavigate(href: string) {
    router.push(href as never)
    onClose()
  }

  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1]),
  }))

  const sidebarAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.7, 1]),
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [-SIDEBAR_WIDTH - 18, 0]) },
    ],
  }))

  if (!isMounted) {
    return null
  }

  return (
    <>
      <AnimatedPressable
        pointerEvents={open ? 'auto' : 'none'}
        onPress={onClose}
        style={[
          {
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: 30,
            backgroundColor: 'rgba(0,0,0,0.6)',
          },
          overlayAnimatedStyle,
        ]}
      />
      <Animated.View
        pointerEvents={open ? 'auto' : 'none'}
        style={[
          {
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            zIndex: 40,
            width: SIDEBAR_WIDTH,
            borderRightWidth: 1,
            borderColor: palette.border,
            backgroundColor: palette.surface,
            shadowColor: '#000',
            shadowOpacity: 0.25,
            shadowRadius: 16,
            shadowOffset: { width: 4, height: 0 },
            elevation: 18,
          },
          sidebarAnimatedStyle,
        ]}
      >
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
              style={{ borderRadius: radius.full }}
              onPress={onClose}
            >
              <CloseIcon size={18} color={palette.text} />
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
      </Animated.View>
    </>
  )
}
