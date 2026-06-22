import type { PropsWithChildren, ReactNode } from 'react'
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { usePreferencesStore } from '../../store/preferences-store'
import { resolvePalette } from '../../theme/palette'
import { radius, spacing } from '../../theme/tokens'
import { Text } from './text'

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  footer,
  children,
}: PropsWithChildren<{
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  footer?: ReactNode
}>) {
  const appearance = usePreferencesStore((state) => state.appearance)
  const theme = usePreferencesStore((state) => state.theme)
  const palette = resolvePalette(appearance, theme)

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={() => onOpenChange(false)}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={{ flex: 1 }} onPress={() => onOpenChange(false)}>
            <View style={{ flex: 1, justifyContent: 'center', padding: spacing.lg }}>
              <Pressable onPress={(event) => event.stopPropagation()}>
                <View
                  style={{
                    maxHeight: '88%',
                    borderRadius: radius.lg,
                    borderWidth: 1,
                    borderColor: palette.border,
                    backgroundColor: palette.surface,
                    overflow: 'hidden',
                  }}
                >
                  <ScrollView
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
                  >
                    <View style={{ gap: spacing.sm }}>
                      <Text style={{ color: palette.text, fontSize: 22, fontWeight: '800' }}>
                        {title}
                      </Text>
                      {description ? (
                        <Text style={{ color: palette.textMuted, fontSize: 14, lineHeight: 21 }}>
                          {description}
                        </Text>
                      ) : null}
                    </View>

                    {children}

                    {footer ? (
                      <View style={{ paddingTop: spacing.sm }}>
                        {footer}
                      </View>
                    ) : null}
                  </ScrollView>
                </View>
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  )
}
