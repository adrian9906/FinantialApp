import { Redirect } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'

import { BackgroundSurface } from '../src/components/background-surface'
import { useAuthStore } from '../src/store/auth-store'
import { usePreferencesStore } from '../src/store/preferences-store'
import { resolvePalette } from '../src/theme/palette'

export default function IndexScreen() {
  const authMode = useAuthStore((state) => state.authMode)
  const hasChecked = useAuthStore((state) => state.hasChecked)
  const isChecking = useAuthStore((state) => state.isChecking)
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

  return <Redirect href={authMode === 'anonymous' ? '/(auth)/login' : '/(app)/dashboard'} />
}
