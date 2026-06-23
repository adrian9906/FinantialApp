import { useState } from 'react'
import { Alert, Image, Pressable, View } from 'react-native'
import { ImagePlus, Upload, X } from 'lucide-react-native'

import { Button } from '../ui/button'
import { Text } from '../ui/text'
import { usePreferencesStore } from '../../store/preferences-store'
import { resolvePalette } from '../../theme/palette'
import { radius, spacing } from '../../theme/tokens'

const ImagePlusIcon = ImagePlus as any
const UploadIcon = Upload as any
const CloseIcon = X as any

export function ImageUploadField({
  value,
  onChange,
}: {
  value?: string
  onChange: (value?: string) => void
}) {
  const appearance = usePreferencesStore((state) => state.appearance)
  const theme = usePreferencesStore((state) => state.theme)
  const palette = resolvePalette(appearance, theme)
  const [isPicking, setIsPicking] = useState(false)
  const [isBroken, setIsBroken] = useState(false)

  async function handlePickImage() {
    setIsPicking(true)

    try {
      const ImagePicker = await import('expo-image-picker')
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()

      if (!permission.granted) {
        Alert.alert('Permiso requerido', 'Necesitas dar acceso a tus fotos para subir una imagen del producto.')
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.85,
        base64: true,
      })

      if (result.canceled || !result.assets?.length) {
        return
      }

      const asset = result.assets[0]
      const mimeType = asset.mimeType || 'image/jpeg'
      const nextValue = asset.base64 ? `data:${mimeType};base64,${asset.base64}` : asset.uri
      setIsBroken(false)
      onChange(nextValue)
    } catch (error) {
      Alert.alert(
        'No se pudo abrir el selector',
        error instanceof Error
          ? error.message
          : 'Instala o actualiza expo-image-picker para subir fotos desde el dispositivo.',
      )
    } finally {
      setIsPicking(false)
    }
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <Pressable
        onPress={() => void handlePickImage()}
        style={{
          borderRadius: radius.lg,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: palette.border,
          backgroundColor: palette.backgroundAlt,
          padding: spacing.md,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            opacity: 0.45,
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 4,
            padding: 8,
          }}
        >
          {Array.from({ length: 36 }, (_, index) => (
            <View
              key={index}
              style={{
                width: '15%',
                minWidth: 18,
                aspectRatio: 1,
                borderRadius: 8,
                backgroundColor: index % 2 === 0 ? palette.surface : palette.surfaceMuted,
              }}
            />
          ))}
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
          <View
            style={{
              width: 112,
              height: 96,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: palette.border,
              backgroundColor: palette.surface,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            {value && !isBroken ? (
              <Image
                source={{ uri: value }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
                onError={() => setIsBroken(true)}
              />
            ) : (
              <View style={{ alignItems: 'center', gap: 6 }}>
                <ImagePlusIcon size={18} color={palette.textMuted} />
                <Text style={{ color: palette.textMuted, fontSize: 11 }}>Vista previa</Text>
              </View>
            )}
          </View>

          <View style={{ flex: 1, gap: 8 }}>
            <View
              style={{
                alignSelf: 'flex-start',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                borderRadius: radius.full,
                borderWidth: 1,
                borderColor: palette.border,
                backgroundColor: palette.surface,
                paddingHorizontal: spacing.md,
                paddingVertical: 6,
              }}
            >
              <UploadIcon size={12} color={palette.textMuted} />
              <Text style={{ color: palette.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>
                Imagen del producto
              </Text>
            </View>
            <Text style={{ color: palette.text, fontSize: 14, fontWeight: '700' }}>
              Toca aqui para subir una foto
            </Text>
            <Text style={{ color: palette.textMuted, fontSize: 12, lineHeight: 18 }}>
              Se mostrara en la vista de tarjetas para reconocer el producto mas rapido.
            </Text>
          </View>
        </View>
      </Pressable>

      {value ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: spacing.md,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: palette.border,
            backgroundColor: palette.surface,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
          }}
        >
          <Text style={{ color: palette.textMuted, fontSize: 12, flex: 1 }}>
            Foto lista para mostrarse en la tarjeta.
          </Text>
          <Button
            variant="ghost"
            size="sm"
            onPress={() => {
              setIsBroken(false)
              onChange(undefined)
            }}
          >
            <CloseIcon size={14} color={palette.textMuted} />
            <Text>Quitar</Text>
          </Button>
        </View>
      ) : null}

      {isPicking ? <Text style={{ color: palette.textMuted, fontSize: 12 }}>Abriendo galeria...</Text> : null}
    </View>
  )
}
