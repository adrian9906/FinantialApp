import { View } from 'react-native'
import { appearanceOptions, backgroundOptions, formulaPresets, themeOptions } from '@plata/shared'

import { AppFrame } from '../../src/components/app-frame'
import { Button } from '../../src/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../src/components/ui/card'
import { Switch } from '../../src/components/ui/switch'
import { Text } from '../../src/components/ui/text'
import { useAuthStore } from '../../src/store/auth-store'
import { usePreferencesStore } from '../../src/store/preferences-store'
import { resolvePalette } from '../../src/theme/palette'

export default function SettingsScreen() {
  const authMode = useAuthStore((state) => state.authMode)
  const logout = useAuthStore((state) => state.logout)
  const appearance = usePreferencesStore((state) => state.appearance)
  const theme = usePreferencesStore((state) => state.theme)
  const background = usePreferencesStore((state) => state.background)
  const formula = usePreferencesStore((state) => state.formula)
  const setAppearance = usePreferencesStore((state) => state.setAppearance)
  const setTheme = usePreferencesStore((state) => state.setTheme)
  const setBackground = usePreferencesStore((state) => state.setBackground)
  const setFormula = usePreferencesStore((state) => state.setFormula)
  const palette = resolvePalette(appearance, theme)

  function renderOptionGroup(
    title: string,
    description: string,
    options: Array<{ id: string; label: string; description: string }>,
    selected: string,
    onSelect: (id: string) => void,
  ) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="gap-3">
          {options.map((option) => (
            <Button
              key={option.id}
              variant={selected === option.id ? 'default' : 'outline'}
              className="justify-start"
              onPress={() => onSelect(option.id)}
            >
              <Text>{option.label}</Text>
            </Button>
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <AppFrame
      title="Ajustes"
      subtitle="Formula, tema, apariencia y fondo con la misma logica visual de Plata App."
    >
      {renderOptionGroup(
        'Apariencia',
        'Alterna entre claro y oscuro manteniendo la identidad de la app.',
        appearanceOptions,
        appearance,
        (value) => setAppearance(value as typeof appearance),
      )}

      {renderOptionGroup(
        'Tema',
        'Elige la paleta principal que define acentos y contraste.',
        themeOptions,
        theme,
        (value) => setTheme(value as typeof theme),
      )}

      {renderOptionGroup(
        'Fondo',
        'Selecciona el tratamiento visual principal de toda la app.',
        backgroundOptions,
        background,
        (value) => setBackground(value as typeof background),
      )}

      <Card>
        <CardHeader>
          <CardTitle>Formula de presupuesto</CardTitle>
          <CardDescription>Presets listos para cambiar la distribucion mensual.</CardDescription>
        </CardHeader>
        <CardContent className="gap-3">
          {formulaPresets.map((preset) => {
            const selected =
              preset.formula.expenses === formula.expenses &&
              preset.formula.wants === formula.wants &&
              preset.formula.savings === formula.savings &&
              preset.formula.rolloverSavings === formula.rolloverSavings

            return (
              <Button
                key={preset.id}
                variant={selected ? 'default' : 'outline'}
                className="justify-start"
                onPress={() => setFormula(preset.formula)}
              >
                <Text>{preset.label}</Text>
              </Button>
            )
          })}

          <View className="mt-2 flex-row items-center justify-between gap-3">
            <View className="flex-1">
              <Text className="font-semibold">Usar ahorro restante en gustos</Text>
              <Text className="text-muted-foreground mt-1 text-sm">
                Si sobra parte del presupuesto de ahorro, se suma al disponible de gustos.
              </Text>
            </View>
            <Switch
              checked={formula.rolloverSavings}
              onCheckedChange={(rolloverSavings) => setFormula({ ...formula, rolloverSavings })}
            />
          </View>
        </CardContent>
      </Card>

      <Card
        className="border"
        style={{
          borderColor: authMode === 'guest' ? `${palette.warning}44` : undefined,
          backgroundColor: authMode === 'guest' ? `${palette.warning}18` : undefined,
        }}
      >
        <CardHeader>
          <CardTitle>Sesion</CardTitle>
          <CardDescription>
            {authMode === 'guest'
              ? 'Estas en modo invitado. Tus datos viven solo localmente y no se sincronizan con Neon.'
              : 'Tu sesion autenticada esta lista para conectarse con la API y persistir en PostgreSQL.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="self-start" onPress={() => void logout()}>
            <Text>{authMode === 'guest' ? 'Salir del modo invitado' : 'Cerrar sesion'}</Text>
          </Button>
        </CardContent>
      </Card>
    </AppFrame>
  )
}
