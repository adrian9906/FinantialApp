import type { PropsWithChildren, ReactNode } from 'react'
import { useState } from 'react'
import { Menu } from 'lucide-react-native'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { BackgroundSurface } from './background-surface'
import { MobileSidebar } from './mobile-sidebar'
import { usePreferencesStore } from '../store/preferences-store'
import { resolvePalette } from '../theme/palette'
import { radius, spacing } from '../theme/tokens'

const MenuIcon = Menu as any

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
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: spacing.md,
            }}
          >
            <View
              style={{
                alignSelf: 'flex-start',
                borderRadius: radius.full,
                borderWidth: 1,
                borderColor: palette.border,
                backgroundColor: palette.surface,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.sm,
              }}
            >
              <Text
                style={{
                  color: palette.primary,
                  fontSize: 12,
                  fontWeight: '700',
                  letterSpacing: 1.2,
                  textTransform: 'uppercase',
                }}
              >
                Plata App
              </Text>
            </View>

            <Pressable
              onPress={() => setSidebarOpen(true)}
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
              <MenuIcon size={18} color={palette.text} />
            </Pressable>
          </View>

          <View style={{ gap: spacing.sm }}>
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
