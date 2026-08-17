import { useEffect, useRef, useState } from 'react'
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native'
import { Sparkles, Trophy, X } from 'lucide-react-native'

import { Text } from '../ui/text'
import { resolvePalette } from '../../theme/palette'
import { radius, spacing } from '../../theme/tokens'
import { usePreferencesStore } from '../../store/preferences-store'

const TrophyIcon = Trophy as any
const XIcon = X as any
const SparklesIcon = Sparkles as any

const CONFETTI_COLORS = ['#e879f9', '#818cf8', '#38bdf8', '#fbbf24', '#34d399', '#fb7185', '#a78bfa']

interface PieceSpec {
  left: number
  duration: number
  delay: number
  color: string
  size: number
  rotate: number
  round: boolean
}

interface WantCelebrationProps {
  onClose: () => void
}

export function WantCelebration({ onClose }: WantCelebrationProps) {
  const appearance = usePreferencesStore((state) => state.appearance)
  const theme = usePreferencesStore((state) => state.theme)
  const palette = resolvePalette(appearance, theme)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  const [pieces] = useState<PieceSpec[]>(() =>
    Array.from({ length: 28 }, (_, index) => ({
      left: Math.random() * 100,
      duration: 1800 + Math.random() * 1300,
      delay: Math.random() * 700,
      color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
      size: 6 + Math.random() * 5,
      rotate: Math.random() * 360,
      round: Math.random() > 0.5,
    })),
  )

  const progressRef = useRef<(Animated.Value | null)[]>([])
  if (progressRef.current.length !== pieces.length) {
    progressRef.current = Array.from({ length: pieces.length }, () => new Animated.Value(0))
  }
  const bounce = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const animations = pieces.map((piece, index) =>
      Animated.timing(progressRef.current[index] as Animated.Value, {
        toValue: 1,
        duration: piece.duration,
        delay: piece.delay,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    )
    Animated.parallel(animations).start()
    Animated.spring(bounce, {
      toValue: 1,
      friction: 6,
      tension: 60,
      useNativeDriver: true,
    }).start()

    const timer = setTimeout(() => closeRef.current(), 5000)
    return () => {
      animations.forEach((animation) => animation.stop())
      clearTimeout(timer)
    }
  }, [bounce, pieces])

  const bannerTranslate = bounce.interpolate({ inputRange: [0, 1], outputRange: [24, 0] })
  const bannerScale = bounce.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] })
  const bannerOpacity = bounce.interpolate({ inputRange: [0, 1], outputRange: [0, 1] })

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View style={[StyleSheet.absoluteFill, { zIndex: 1000, overflow: 'hidden' }]} pointerEvents="none">
        {pieces.map((piece, index) => {
          const progress = progressRef.current[index] as Animated.Value
          const translateY = progress.interpolate({
            inputRange: [0, 1],
            outputRange: [-40, 760],
          })
          const opacity = progress.interpolate({
            inputRange: [0, 0.7, 1],
            outputRange: [1, 1, 0],
          })
          const rotate = progress.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', `${540 + piece.rotate}deg`],
          })

          return (
            <Animated.View
              key={index}
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0,
                left: `${piece.left}%`,
                width: piece.size,
                height: piece.size + 3,
                borderRadius: piece.round ? 50 : 2,
                backgroundColor: piece.color,
                opacity,
                transform: [{ translateY }, { rotate }],
              }}
            />
          )
        })}
      </View>

      <View
        style={[
          StyleSheet.absoluteFill,
          { zIndex: 1001, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
        ]}
      >
        <Animated.View
          style={{
            width: '100%',
            maxWidth: 360,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: palette.primary,
            backgroundColor: palette.surface,
            padding: spacing.xl,
            alignItems: 'center',
            opacity: bannerOpacity,
            transform: [{ translateY: bannerTranslate }, { scale: bannerScale }],
          }}
        >
          <Pressable
            onPress={onClose}
            style={{ position: 'absolute', right: spacing.sm, top: spacing.sm, padding: spacing.xs }}
          >
            <XIcon size={16} color={palette.textMuted} />
          </Pressable>

          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: palette.primarySoft,
            }}
          >
            <TrophyIcon size={28} color={palette.primary} />
          </View>

          <Text style={{ color: palette.text, fontSize: 18, fontWeight: '800', marginTop: spacing.md, textAlign: 'center' }}>
            ¡Deseo Completado!
          </Text>
          <Text style={{ color: palette.textMuted, fontSize: 14, lineHeight: 21, marginTop: spacing.xs, textAlign: 'center' }}>
            Felicidades, sigue trabajando duro y lograrás más objetivos.
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.md }}>
            <SparklesIcon size={16} color={palette.primary} />
            <SparklesIcon size={12} color={palette.primary} />
            <SparklesIcon size={16} color={palette.primary} />
          </View>
        </Animated.View>
      </View>
    </View>
  )
}