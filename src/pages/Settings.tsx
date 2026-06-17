import { useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import {
  Check,
  MoonStar,
  Palette,
  RefreshCcw,
  SlidersHorizontal,
  Sparkles,
  SunMedium,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  defaultFormula,
  type AllocationFormula,
  formulaPresets,
  formatFormulaLabel,
  getFormulaTotal,
  type AppAppearance,
  type AppBackground,
  type AppTheme,
  usePreferencesStore,
} from '@/store/preferencesStore'

const themeOptions: Array<{
  id: AppTheme
  label: string
  description: string
  preview: string
}> = [
  {
    id: 'obsidian',
    label: 'Obsidiana',
    description: 'El look original, profundo y violeta.',
    preview: 'linear-gradient(135deg, #171717 0%, #7c3aed 100%)',
  },
  {
    id: 'midnight',
    label: 'Midnight',
    description: 'Mas frio, azul y tecnico.',
    preview: 'linear-gradient(135deg, #0b1322 0%, #4d74df 100%)',
  },
  {
    id: 'ember',
    label: 'Ember',
    description: 'Oscuro calido con energia cobre.',
    preview: 'linear-gradient(135deg, #15100d 0%, #d97544 100%)',
  },
]

const appearanceOptions: Array<{
  id: AppAppearance
  label: string
  description: string
  icon: typeof MoonStar
}> = [
  {
    id: 'dark',
    label: 'Oscuro',
    description: 'La app mantiene su presencia intensa y nocturna.',
    icon: MoonStar,
  },
  {
    id: 'light',
    label: 'Claro',
    description: 'Superficies luminosas con mejor contraste diurno.',
    icon: SunMedium,
  },
]

const backgroundOptions: Array<{
  id: AppBackground
  label: string
  description: string
  preview: string
}> = [
  {
    id: 'grid',
    label: 'Hexagonos',
    description: 'Usa el componente HexagonBackground con una textura tecnica mas viva.',
    preview:
      'radial-gradient(circle at 20% 18%, rgba(124,58,237,0.24), transparent 26%), linear-gradient(135deg, #171717 0%, #2a1c49 100%)',
  },
  {
    id: 'nebula',
    label: 'Nebula',
    description: 'Capas suaves con halos y profundidad.',
    preview:
      'radial-gradient(circle at 20% 20%, rgba(124,58,237,0.38), transparent 32%), radial-gradient(circle at 80% 18%, rgba(206,189,255,0.22), transparent 24%), linear-gradient(135deg, #121212 0%, #1f1834 100%)',
  },
  {
    id: 'carbon',
    label: 'Carbon',
    description: 'Plano, sobrio y con menos distraccion visual.',
    preview: 'linear-gradient(135deg, #101010 0%, #202020 100%)',
  },
  {
    id: 'aurora',
    label: 'Aurora',
    description: 'Toques de color mas vivos en el fondo principal.',
    preview:
      'radial-gradient(circle at 15% 15%, rgba(74,222,128,0.28), transparent 22%), radial-gradient(circle at 80% 10%, rgba(124,58,237,0.3), transparent 28%), linear-gradient(135deg, #101010 0%, #16221d 100%)',
  },
]

function cloneFormula(formula: AllocationFormula): AllocationFormula {
  return {
    expenses: formula.expenses,
    wants: formula.wants,
    savings: formula.savings,
    rolloverSavings: formula.rolloverSavings,
  }
}

function parseDraftValue(value: string) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.min(100, Math.max(0, Math.round(parsed)))
}

function SectionIntro({
  eyebrow,
  title,
  description,
  icon,
}: {
  eyebrow: string
  title: string
  description: string
  icon: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-medium-gray">{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-semibold text-on-surface">{title}</h2>
        <p className="mt-2 text-sm text-muted-gray">{description}</p>
      </div>
      {icon}
    </div>
  )
}

function FormulaInputs({
  draftFormula,
  setDraftFormula,
}: {
  draftFormula: AllocationFormula
  setDraftFormula: Dispatch<SetStateAction<AllocationFormula>>
}) {
  return (
    <div className="mt-6 grid gap-4 md:grid-cols-3">
      <div className="space-y-2">
        <Label className="text-medium-gray">Gastos</Label>
        <Input
          type="number"
          min="0"
          max="100"
          value={draftFormula.expenses}
          onChange={(event) =>
            setDraftFormula((current) => ({
              ...current,
              expenses: parseDraftValue(event.target.value),
            }))
          }
          className="border-graphite bg-abyss text-on-surface"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-medium-gray">Gustos</Label>
        <Input
          type="number"
          min="0"
          max="100"
          value={draftFormula.wants}
          onChange={(event) =>
            setDraftFormula((current) => ({
              ...current,
              wants: parseDraftValue(event.target.value),
            }))
          }
          className="border-graphite bg-abyss text-on-surface"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-medium-gray">Ahorros</Label>
        <Input
          type="number"
          min="0"
          max="100"
          value={draftFormula.savings}
          onChange={(event) =>
            setDraftFormula((current) => ({
              ...current,
              savings: parseDraftValue(event.target.value),
            }))
          }
          className="border-graphite bg-abyss text-on-surface"
        />
      </div>
    </div>
  )
}

function FormulaCard({
  draftFormula,
  setDraftFormula,
  onSaveFormula,
  isFormulaValid,
  total,
  formulaChanged,
}: {
  draftFormula: AllocationFormula
  setDraftFormula: Dispatch<SetStateAction<AllocationFormula>>
  onSaveFormula: () => void
  isFormulaValid: boolean
  total: number
  formulaChanged: boolean
}) {
  return (
    <Card className="border-graphite bg-surface p-6 shadow-vault">
      <SectionIntro
        eyebrow="Formula"
        title="Distribucion del dinero"
        description="Cambia como se reparte el salario mensual entre gastos esenciales, gustos y ahorro."
        icon={
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-vault-sm">
            <SlidersHorizontal className="size-5" />
          </div>
        }
      />

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {formulaPresets.map((preset) => {
          const selected =
            formatFormulaLabel(draftFormula) === formatFormulaLabel(preset.formula) &&
            draftFormula.rolloverSavings === preset.formula.rolloverSavings

          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => setDraftFormula(cloneFormula(preset.formula))}
              className={`rounded-2xl border p-4 text-left transition-all ${
                selected
                  ? 'border-primary/40 bg-primary/10 shadow-vault'
                  : 'border-graphite bg-surface-container-low hover:border-outline-variant hover:bg-surface-container'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-on-surface">{preset.label}</p>
                {selected ? <Check className="size-4 text-primary" /> : null}
              </div>
              <p className="mt-2 text-xs text-muted-gray">{preset.description}</p>
            </button>
          )
        })}
      </div>

      <FormulaInputs draftFormula={draftFormula} setDraftFormula={setDraftFormula} />

      <div className="mt-5 rounded-2xl border border-graphite bg-surface-container-low p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-on-surface">Total configurado</p>
            <p className="mt-1 text-xs text-muted-gray">La suma debe dar exactamente 100%.</p>
          </div>
          <Badge
            variant="secondary"
            className={isFormulaValid ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}
          >
            {total}%
          </Badge>
        </div>

        <div className="mt-4">
          <Checkbox
            checked={draftFormula.rolloverSavings}
            onCheckedChange={(checked) =>
              setDraftFormula((current) => ({
                ...current,
                rolloverSavings: Boolean(checked),
              }))
            }
            className="text-sm text-on-surface"
          >
            <div>
              <p className="font-medium text-on-surface">Mover ahorro no usado a gustos</p>
              <p className="text-xs text-muted-gray">
                Si te sobra parte del presupuesto de ahorro, se suma al dinero disponible de gustos y eventos.
              </p>
            </div>
          </Checkbox>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            onClick={onSaveFormula}
            disabled={!isFormulaValid || !formulaChanged}
            className="bg-primary-container text-primary-foreground shadow-vault hover:brightness-110"
          >
            Guardar formula
          </Button>
          {!isFormulaValid ? (
            <p className="self-center text-xs text-warning">
              Ajusta los porcentajes hasta completar 100%.
            </p>
          ) : null}
        </div>
      </div>
    </Card>
  )
}

function SummaryCard({
  formula,
  appearance,
  theme,
  background,
}: {
  formula: AllocationFormula
  appearance: AppAppearance
  theme: AppTheme
  background: AppBackground
}) {
  return (
    <Card className="border-graphite bg-surface p-6 shadow-vault">
      <SectionIntro
        eyebrow="Resumen activo"
        title="Tu configuracion actual"
        description=""
        icon={
          <div className="flex size-11 items-center justify-center rounded-2xl bg-secondary/10 text-secondary shadow-vault-sm">
            <Sparkles className="size-5" />
          </div>
        }
      />

      <div className="mt-6 space-y-3">
        <div className="rounded-2xl border border-graphite bg-surface-container-low p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-medium-gray">Formula actual</p>
          <p className="mt-2 text-xl font-semibold text-on-surface">{formatFormulaLabel(formula)}</p>
          <p className="mt-1 text-sm text-muted-gray">
            {formula.rolloverSavings
              ? 'Con traspaso del ahorro sobrante a gustos.'
              : 'Sin traspaso automatico entre categorias.'}
          </p>
        </div>

        <div className="rounded-2xl border border-graphite bg-surface-container-low p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-medium-gray">Apariencia</p>
          <p className="mt-2 text-xl font-semibold text-on-surface">
            {appearance === 'dark' ? 'Oscuro' : 'Claro'}
          </p>
          <p className="mt-1 text-sm text-muted-gray">
            {themeOptions.find((option) => option.id === theme)?.label ?? 'Obsidiana'} con{' '}
            {backgroundOptions.find((option) => option.id === background)?.label ?? 'Hexagonos'} de
            fondo.
          </p>
        </div>

        <div className="rounded-2xl border border-graphite bg-surface-container-low p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-medium-gray">Tema visual</p>
          <p className="mt-2 text-xl font-semibold text-on-surface">
            {themeOptions.find((option) => option.id === theme)?.label ?? 'Obsidiana'}
          </p>
          <p className="mt-1 text-sm text-muted-gray">
            {backgroundOptions.find((option) => option.id === background)?.label ?? 'Hexagonos'} como
            fondo principal.
          </p>
        </div>
      </div>
    </Card>
  )
}

function AppearanceCard({
  appearance,
  setAppearance,
}: {
  appearance: AppAppearance
  setAppearance: (appearance: AppAppearance) => void
}) {
  return (
    <Card className="border-graphite bg-surface p-6 shadow-vault">
      <SectionIntro
        eyebrow="Modo"
        title="Apariencia general"
        description="Elige si quieres la app en oscuro o en claro antes de afinar la paleta."
        icon={
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-vault-sm">
            {appearance === 'dark' ? <MoonStar className="size-5" /> : <SunMedium className="size-5" />}
          </div>
        }
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {appearanceOptions.map((option) => {
          const selected = appearance === option.id
          const Icon = option.icon

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setAppearance(option.id)}
              className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition-all ${
                selected
                  ? 'border-primary/40 bg-primary/10 shadow-vault'
                  : 'border-graphite bg-surface-container-low hover:border-outline-variant hover:bg-surface-container'
              }`}
            >
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-graphite bg-surface-container-high">
                <Icon className="size-5 text-on-surface" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-on-surface">{option.label}</p>
                  {selected ? <Check className="size-4 text-primary" /> : null}
                </div>
                <p className="mt-1 text-xs text-muted-gray">{option.description}</p>
              </div>
            </button>
          )
        })}
      </div>
    </Card>
  )
}

function ThemeCard({
  theme,
  setTheme,
}: {
  theme: AppTheme
  setTheme: (theme: AppTheme) => void
}) {
  return (
    <Card className="border-graphite bg-surface p-6 shadow-vault">
      <SectionIntro
        eyebrow="Tema"
        title="Paleta de la aplicacion"
        description="Cambia la identidad de los paneles, botones y contrastes generales."
        icon={
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-vault-sm">
            <Palette className="size-5" />
          </div>
        }
      />

      <div className="mt-6 grid gap-3">
        {themeOptions.map((option) => {
          const selected = theme === option.id

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setTheme(option.id)}
              className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition-all ${
                selected
                  ? 'border-primary/40 bg-primary/10 shadow-vault'
                  : 'border-graphite bg-surface-container-low hover:border-outline-variant hover:bg-surface-container'
              }`}
            >
              <div
                className="h-14 w-14 shrink-0 rounded-2xl border border-graphite"
                style={{ background: option.preview }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-on-surface">{option.label}</p>
                  {selected ? <Check className="size-4 text-primary" /> : null}
                </div>
                <p className="mt-1 text-xs text-muted-gray">{option.description}</p>
              </div>
            </button>
          )
        })}
      </div>
    </Card>
  )
}

function BackgroundCard({
  background,
  setBackground,
}: {
  background: AppBackground
  setBackground: (background: AppBackground) => void
}) {
  return (
    <Card className="border-graphite bg-surface p-6 shadow-vault">
      <SectionIntro
        eyebrow="Fondo"
        title="Color y atmosfera"
        description="Controla la presencia del fondo principal para hacerlo mas sobrio o mas expresivo."
        icon={
          <div className="flex size-11 items-center justify-center rounded-2xl bg-tertiary-container/10 text-tertiary-container shadow-vault-sm">
            <Sparkles className="size-5" />
          </div>
        }
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {backgroundOptions.map((option) => {
          const selected = background === option.id

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setBackground(option.id)}
              className={`rounded-2xl border p-4 text-left transition-all ${
                selected
                  ? 'border-primary/40 bg-primary/10 shadow-vault'
                  : 'border-graphite bg-surface-container-low hover:border-outline-variant hover:bg-surface-container'
              }`}
            >
              <div
                className="h-24 rounded-2xl border border-graphite"
                style={{ background: option.preview }}
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-on-surface">{option.label}</p>
                {selected ? <Check className="size-4 text-primary" /> : null}
              </div>
              <p className="mt-1 text-xs text-muted-gray">{option.description}</p>
            </button>
          )
        })}
      </div>
    </Card>
  )
}

export default function Settings() {
  const appearance = usePreferencesStore((state) => state.appearance)
  const theme = usePreferencesStore((state) => state.theme)
  const background = usePreferencesStore((state) => state.background)
  const formula = usePreferencesStore((state) => state.formula)
  const setAppearance = usePreferencesStore((state) => state.setAppearance)
  const setTheme = usePreferencesStore((state) => state.setTheme)
  const setBackground = usePreferencesStore((state) => state.setBackground)
  const setFormula = usePreferencesStore((state) => state.setFormula)
  const resetPreferences = usePreferencesStore((state) => state.resetPreferences)

  const [draftFormula, setDraftFormula] = useState<AllocationFormula>(() => cloneFormula(formula))

  const total = useMemo(() => getFormulaTotal(draftFormula), [draftFormula])
  const isFormulaValid = total === 100
  const formulaChanged =
    draftFormula.expenses !== formula.expenses ||
    draftFormula.wants !== formula.wants ||
    draftFormula.savings !== formula.savings ||
    draftFormula.rolloverSavings !== formula.rolloverSavings

  function handleSaveFormula() {
    if (!isFormulaValid) {
      toast.error('La formula debe sumar exactamente 100%.')
      return
    }

    const nextFormula = cloneFormula(draftFormula)
    setFormula(nextFormula)
    setDraftFormula(nextFormula)
    toast.success('La formula financiera fue actualizada.')
  }

  function handleResetPreferences() {
    resetPreferences()
    setDraftFormula(cloneFormula(defaultFormula))
    toast.success('Se restauraron los ajustes visuales y la formula original.')
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-on-surface md:text-[36px]">
            Settings
          </h1>
          <p className="max-w-3xl text-sm text-muted-gray">
            Ajusta la formula de presupuesto, la paleta general y el fondo para que Plata App
            se adapte mejor a tu forma de planificar.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={handleResetPreferences}
          className="border-graphite bg-primary-container text-primary-foreground hover:bg-primary-container/85"
        >
          <RefreshCcw className="size-4" />
          Restaurar ajustes
        </Button>
      </header>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <FormulaCard
          draftFormula={draftFormula}
          setDraftFormula={setDraftFormula}
          onSaveFormula={handleSaveFormula}
          isFormulaValid={isFormulaValid}
          total={total}
          formulaChanged={formulaChanged}
        />

        <SummaryCard
          formula={formula}
          appearance={appearance}
          theme={theme}
          background={background}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <AppearanceCard appearance={appearance} setAppearance={setAppearance} />
        <ThemeCard theme={theme} setTheme={setTheme} />
        <BackgroundCard background={background} setBackground={setBackground} />
      </section>
    </div>
  )
}
