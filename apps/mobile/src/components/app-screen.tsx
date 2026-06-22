import { router } from 'expo-router'
import { ChevronLeft } from 'lucide-react-native'
import { Pressable, Text, View } from 'react-native'

import { AppFrame } from './app-frame'
import { usePreferencesStore } from '../store/preferences-store'
import { resolvePalette } from '../theme/palette'
import { radius, spacing } from '../theme/tokens'

const ChevronLeftIcon = ChevronLeft as any

export function AppScreen({
  title,
  description,
}: {
  title: string
  description: string
}) {
  const appearance = usePreferencesStore((state) => state.appearance)
  const theme = usePreferencesStore((state) => state.theme)
  const palette = resolvePalette(appearance, theme)

  return (
    <AppFrame
      title={title}
      subtitle={description}
      actions={
        <Pressable
          onPress={() => router.back()}
          style={{
            alignSelf: 'flex-start',
            borderRadius: radius.full,
            borderWidth: 1,
            borderColor: palette.border,
            backgroundColor: palette.surface,
            padding: spacing.md,
          }}
        >
          <ChevronLeftIcon size={18} color={palette.text} />
        </Pressable>
      }
    >
      <View
        style={{
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: palette.border,
          backgroundColor: palette.surface,
          padding: spacing.lg,
          gap: spacing.sm,
        }}
      >
        <Text style={{ color: palette.text, fontSize: 15, fontWeight: '700' }}>Paridad visual Obsidian</Text>
        <Text style={{ color: palette.textMuted, lineHeight: 22 }}>
          Esta ruta ya vive dentro del monorepo Expo y comparte la direccion visual del proyecto web.
        </Text>
      </View>

      <View
        style={{
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: palette.border,
          backgroundColor: palette.surface,
          padding: spacing.lg,
          gap: spacing.sm,
        }}
      >
        <Text style={{ color: palette.text, fontSize: 15, fontWeight: '700' }}>Siguiente integracion</Text>
        <Text style={{ color: palette.textMuted, lineHeight: 22 }}>
          Conectar widgets reales, mutaciones offline y sincronizacion incremental para esta seccion.
        </Text>
      </View>
    </AppFrame>
  )
}
