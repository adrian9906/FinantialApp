import type { PropsWithChildren, ReactNode } from 'react'
import { useState } from 'react'
import { router } from 'expo-router'
import { Menu, X } from 'lucide-react-native'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { BackgroundSurface } from './background-surface'
import { MobileSidebar } from './mobile-sidebar'
import { useAuthStore } from '../store/auth-store'
import { usePreferencesStore } from '../store/preferences-store'
import { resolvePalette } from '../theme/palette'
import { radius, spacing } from '../theme/tokens'

const MenuIcon = Menu as any
const CloseIcon = X as any

export function AppFrame({
  title,
  subtitle,
  actions,
  children,
}: PropsWithChildren<{
  title: string
  subtitle?: string
  actions?: ReactNode
}>) {
  const appearance = usePreferencesStore((state) => state.appearance)
  const theme = usePreferencesStore((state) => state.theme)
  const authMode = useAuthStore((state) => state.authMode)
  const palette = resolvePalette(appearance, theme)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <BackgroundSurface>
      <SafeAreaView style={{ flex: 1 }}>
        <MobileSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.xl,
            gap: spacing.lg,
            paddingBottom: spacing.xxl,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
            }}
          >
            <Pressable
              onPress={() => setSidebarOpen((current) => !current)}
              style={{
                alignSelf: 'flex-start',
                borderRadius: radius.full,
                borderWidth: 1,
                borderColor: palette.border,
                backgroundColor: palette.surface,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,

              }}
            >
              {sidebarOpen ? <CloseIcon size={18} color={palette.text} /> : <MenuIcon size={18} color={palette.text} />}
            </Pressable>

            <View
              style={{
                flex: 0.5,
                borderRadius: radius.full,
                borderWidth: 1,
                borderColor: palette.border,
                backgroundColor: palette.surface,
                paddingHorizontal: spacing.xs,
                paddingVertical: spacing.sm,
                justifyContent: 'flex-start',
                alignItems: 'flex-start',
                marginLeft: spacing.md,   // Menos espacio a la izquierda
                marginRight: spacing.xxl, // Más espacio a la derecha
              }}
            >
              <Text
                style={{
                  color: palette.primary,
                  fontSize: 12,
                  fontWeight: '700',
                  letterSpacing: 1.2,
                  textTransform: 'uppercase',
                  alignSelf: 'center',
                }}
              >
                Plata App
              </Text>
            </View>
          </View>

          {authMode === 'guest' ? (
            <View
              style={{
                gap: spacing.md,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: `${palette.warning}55`,
                backgroundColor: `${palette.warning}16`,
                padding: spacing.lg,
              }}
            >
              <View style={{ gap: 6 }}>
                <Text style={{ color: palette.text, fontSize: 15, fontWeight: '700' }}>
                  Estas usando Plata App como invitado.
                </Text>
                <Text style={{ color: palette.textMuted, fontSize: 13, lineHeight: 20 }}>
                  Tus datos se guardan solo en este dispositivo. Si quieres guardarlos en tu cuenta,
                  inicia sesion o crea una cuenta.
                </Text>
              </View>

              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Pressable
                  onPress={() => router.push('/(auth)/login?mode=login')}
                  style={{
                    flex: 1,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: `${palette.warning}55`,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.md,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: palette.text, fontSize: 13, fontWeight: '600' }}>
                    Iniciar sesion
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => router.push('/(auth)/login?mode=register')}
                  style={{
                    flex: 1,
                    borderRadius: radius.md,
                    backgroundColor: palette.warning,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.md,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: palette.background, fontSize: 13, fontWeight: '700' }}>
                    Crear cuenta
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <View
            style={{
              gap: spacing.sm,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: palette.border,
              backgroundColor: palette.surface,
              padding: spacing.lg,
            }}
          >
            <Text
              style={{
                color: palette.text,
                fontSize: 28,
                lineHeight: 34,
                fontWeight: '700',
              }}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text
                style={{
                  color: palette.textMuted,
                  fontSize: 15,
                  lineHeight: 23,
                }}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>

          {actions}
          {children}
        </ScrollView>
      </SafeAreaView>
    </BackgroundSurface>
  )
}
