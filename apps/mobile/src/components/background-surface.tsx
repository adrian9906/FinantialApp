import type { PropsWithChildren } from 'react'
import { View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { vars } from 'nativewind'

import { HexagonBackground } from './hexagon-background'
import { usePreferencesStore } from '../store/preferences-store'
import { getPaletteCssVars, resolvePalette } from '../theme/palette'

export function BackgroundSurface({ children }: PropsWithChildren) {
  const appearance = usePreferencesStore((state) => state.appearance)
  const theme = usePreferencesStore((state) => state.theme)
  const background = usePreferencesStore((state) => state.background)
  const palette = resolvePalette(appearance, theme)
  const themeVars = vars(getPaletteCssVars(palette))

  if (background === 'grid') {
    return (
      <HexagonBackground palette={palette} themeVars={themeVars}>
        {children}
      </HexagonBackground>
    )
  }

  const overlayColors =
    background === 'nebula'
      ? ([palette.primarySoft, 'transparent', palette.background] as const)
      : background === 'carbon'
        ? ([palette.backgroundAlt, palette.background, palette.background] as const)
        : ([palette.primarySoft, 'rgba(255,255,255,0.04)', palette.background] as const)

  return (
    <View style={[themeVars, { flex: 1, backgroundColor: palette.background }]}>
      <LinearGradient
        colors={overlayColors}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
      />
      <View
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          opacity: background === 'carbon' ? 0.24 : 0.3,
          backgroundColor: background === 'carbon' ? palette.text : 'transparent',
        }}
      />
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  )
}
