import { Redirect, Stack } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'

import { BackgroundSurface } from '../../src/components/background-surface'
import { useAuthStore } from '../../src/store/auth-store'
import { usePreferencesStore } from '../../src/store/preferences-store'
import { resolvePalette } from '../../src/theme/palette'

export default function AppLayout() {
  const authMode = useAuthStore((state) => state.authMode)
  const isChecking = useAuthStore((state) => state.isChecking)
  const hasChecked = useAuthStore((state) => state.hasChecked)
  const appearance = usePreferencesStore((state) => state.appearance)
  const theme = usePreferencesStore((state) => state.theme)
  const palette = resolvePalette(appearance, theme)

  if (!hasChecked || isChecking) {
    return (
      <BackgroundSurface>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={palette.primary} size="large" />
        </View>
      </BackgroundSurface>
    )
  }

  if (authMode === 'anonymous') {
    return <Redirect href="/(auth)/login" />
  }

  return <Stack screenOptions={{ headerShown: false }} />
}
