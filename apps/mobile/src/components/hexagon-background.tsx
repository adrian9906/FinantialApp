import type { PropsWithChildren } from 'react'
import { useMemo } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import { Dimensions, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Polygon } from 'react-native-svg'

import type { Palette } from '../theme/palette'

function buildHexagons(width: number, height: number) {
  const size = 54
  const hexHeight = size * 0.88
  const verticalStep = hexHeight * 0.9
  const horizontalStep = size * 0.92
  const rows = Math.ceil(height / verticalStep) + 2
  const columns = Math.ceil(width / horizontalStep) + 2

  return Array.from({ length: rows * columns }, (_, index) => {
    const row = Math.floor(index / columns)
    const column = index % columns
    const x = column * horizontalStep + (row % 2 === 0 ? 0 : size / 2)
    const y = row * verticalStep
    return { x, y, size }
  })
}

export function HexagonBackground({
  children,
  palette,
  themeVars,
}: PropsWithChildren<{ palette: Palette; themeVars?: StyleProp<ViewStyle> }>) {
  const { width, height } = Dimensions.get('window')
  const hexagons = useMemo(() => buildHexagons(width, height), [height, width])

  return (
    <View style={[themeVars, { flex: 1, backgroundColor: palette.background }]}>
      <LinearGradient
        colors={[palette.primarySoft, palette.background] as const}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
      />
      <Svg width={width} height={height} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}>
        {hexagons.map((hexagon, index) => (
          <Polygon
            key={`${hexagon.x}-${hexagon.y}-${index}`}
            points={[
              `${hexagon.x + hexagon.size * 0.5},${hexagon.y}`,
              `${hexagon.x + hexagon.size},${hexagon.y + hexagon.size * 0.28}`,
              `${hexagon.x + hexagon.size},${hexagon.y + hexagon.size * 0.72}`,
              `${hexagon.x + hexagon.size * 0.5},${hexagon.y + hexagon.size}`,
              `${hexagon.x},${hexagon.y + hexagon.size * 0.72}`,
              `${hexagon.x},${hexagon.y + hexagon.size * 0.28}`,
            ].join(' ')}
            fill="transparent"
            stroke={palette.border}
            strokeWidth={1}
          />
        ))}
      </Svg>
      {children}
    </View>
  )
}
