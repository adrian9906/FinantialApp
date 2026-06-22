import '../global.css'
import { useEffect, useState } from 'react'
import { Stack } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StatusBar } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { useAuthStore } from '../src/store/auth-store'
import { useFinanceStore } from '../src/store/finance-store'
import { usePreferencesStore } from '../src/store/preferences-store'

function AppBootstrap() {
  const checkSession = useAuthStore((state) => state.checkSession)
  const hasChecked = useAuthStore((state) => state.hasChecked)
  const authMode = useAuthStore((state) => state.authMode)
  const hydrate = useFinanceStore((state) => state.hydrate)

  useEffect(() => {
    void checkSession()
  }, [checkSession])

  useEffect(() => {
    if (!hasChecked) return
    void hydrate()
  }, [authMode, hasChecked, hydrate])

  return null
}

export default function RootLayout() {
  const appearance = usePreferencesStore((state) => state.appearance)
  const [queryClient] = useState(() => new QueryClient())

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar barStyle={appearance === 'light' ? 'dark-content' : 'light-content'} />
          <AppBootstrap />
          <Stack screenOptions={{ headerShown: false }} />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
