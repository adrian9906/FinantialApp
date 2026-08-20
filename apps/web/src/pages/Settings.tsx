import { useMemo, useState, type ChangeEvent, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { toast } from 'sonner'
import { getFinancialPeriodStart } from '@plata/shared'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { AppIcon, getIconPackLabel, type AppIconName } from '@/components/icons/AppIcon'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CURRENCY_CATALOG, formatMoney } from '@/lib/currency'
import { downloadMonthlyPdfReport } from '@/lib/monthlyPdfReport'
import { getTypographyFamily, inferFontFormat, isTypographyPreset, typographyPresets } from '@/lib/typography'
import { useMonthlyOverview } from '@/lib/useMonthlyOverview'
import { parseExpenseDescription } from '@/lib/expense-utils'
import { parseWantDescription } from '@/lib/want-utils'
import { useFinanceStore } from '@/store/financeStore'
import { useAuthStore } from '@/store/authStore'
import { AutomationSettings } from '@/components/settings/AutomationSettings'
import {
  defaultFormula,
  type AllocationFormula,
  formulaPresets,
  formatFormulaLabel,
  getFormulaTotal,
  type AppAppearance,
  type AppBackground,
  type AppIconPack,
  type AppTheme,
  type AppTypographyPreset,
  type CurrencyPreference,
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
      description: 'Más frío, azul y técnico.',
      preview: 'linear-gradient(135deg, #0b1322 0%, #4d74df 100%)',
    },
    {
      id: 'ember',
      label: 'Ember',
      description: 'Oscuro cálido con energía cobre.',
      preview: 'linear-gradient(135deg, #15100d 0%, #d97544 100%)',
    },
  ]

const appearanceOptions: Array<{
  id: AppAppearance
  label: string
  description: string
  icon: AppIconName
}> = [
    {
      id: 'dark',
      label: 'Oscuro',
      description: 'La app mantiene su presencia intensa y nocturna.',
      icon: 'moon',
    },
    {
      id: 'light',
      label: 'Claro',
      description: 'Superficies luminosas con mejor contraste diurno.',
      icon: 'sun',
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
      description: 'Usa el componente HexagonBackground con una textura técnica más viva.',
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
      description: 'Plano, sobrio y con menos distracción visual.',
      preview: 'linear-gradient(135deg, #101010 0%, #202020 100%)',
    },
    {
      id: 'aurora',
      label: 'Aurora',
      description: 'Toques de color más vivos en el fondo principal.',
      preview:
        'radial-gradient(circle at 15% 15%, rgba(74,222,128,0.28), transparent 22%), radial-gradient(circle at 80% 10%, rgba(124,58,237,0.3), transparent 28%), linear-gradient(135deg, #101010 0%, #16221d 100%)',
    },
  ]

const iconPackOptions: Array<{
  id: AppIconPack
  description: string
}> = [
    {
      id: 'lucide',
      description: 'Trazos limpios y livianos. Es la librería actual de la app.',
    },
    {
      id: 'tabler',
      description: 'Más técnica y con un look de dashboard marcado.',
    },
    {
      id: 'material-symbols',
      description: 'El lenguaje de Google Icons, ideal si prefieres un estilo más familiar.',
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

function sanitizeFontName(value: string) {
  return value.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
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
            <AppIcon name="sliders" className="size-5" />
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
              className={`rounded-2xl border p-4 text-left transition-all ${selected
                ? 'border-primary/40 bg-primary/10 shadow-vault'
                : 'border-graphite bg-surface-container-low hover:border-outline-variant hover:bg-surface-container'
                }`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-on-surface">{preset.label}</p>
                {selected ? <AppIcon name="check" className="size-4 text-primary" /> : null}
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
            disabled={draftFormula.wants === 0}
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
                {draftFormula.wants === 0
                  ? 'Desactivado porque Gustos tiene una asignación de 0%.'
                  : 'Si te sobra parte del presupuesto de ahorro, se suma al dinero disponible de gustos y eventos.'}
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
            Guardar fórmula
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
            <AppIcon name="sparkles" className="size-5" />
          </div>
        }
      />

      <div className="mt-6 space-y-3">
        <div className="rounded-2xl border border-graphite bg-surface-container-low p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-medium-gray">Fórmula actual</p>
          <p className="mt-2 text-xl font-semibold text-on-surface">{formatFormulaLabel(formula)}</p>
          <p className="mt-1 text-sm text-muted-gray">
            {formula.wants === 0
              ? 'Gustos está desactivado y no recibe traspasos automáticos.'
              : formula.rolloverSavings
                ? 'Con traspaso del ahorro sobrante a gustos.'
                : 'Sin traspaso automático entre categorías.'}
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
            {appearance === 'dark' ? <AppIcon name="moon" className="size-5" /> : <AppIcon name="sun" className="size-5" />}
          </div>
        }
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {appearanceOptions.map((option) => {
          const selected = appearance === option.id

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setAppearance(option.id)}
              className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition-all ${selected
                ? 'border-primary/40 bg-primary/10 shadow-vault'
                : 'border-graphite bg-surface-container-low hover:border-outline-variant hover:bg-surface-container'
                }`}
            >
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-graphite bg-surface-container-high">
                <AppIcon name={option.icon} className="size-5 text-on-surface" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-on-surface">{option.label}</p>
                  {selected ? <AppIcon name="check" className="size-4 text-primary" /> : null}
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
            <AppIcon name="palette" className="size-5" />
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
              className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition-all ${selected
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
                  {selected ? <AppIcon name="check" className="size-4 text-primary" /> : null}
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
        description="Controla la presencia del fondo principal para hacerlo más sobrio o más expresivo."
        icon={
          <div className="flex size-11 items-center justify-center rounded-2xl bg-tertiary-container/10 text-tertiary-container shadow-vault-sm">
            <AppIcon name="sparkles" className="size-5" />
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
              className={`rounded-2xl border p-4 text-left transition-all ${selected
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
                {selected ? <AppIcon name="check" className="size-4 text-primary" /> : null}
              </div>
              <p className="mt-1 text-xs text-muted-gray">{option.description}</p>
            </button>
          )
        })}
      </div>
    </Card>
  )
}

function TypographyCard() {
  const typography = usePreferencesStore((state) => state.typography)
  const customFonts = usePreferencesStore((state) => state.customFonts)
  const setTypography = usePreferencesStore((state) => state.setTypography)
  const saveCustomFont = usePreferencesStore((state) => state.saveCustomFont)
  const removeCustomFont = usePreferencesStore((state) => state.removeCustomFont)
  const [isUploading, setIsUploading] = useState(false)

  async function handleCustomFontUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) return
    if (file.size > 2_500_000) {
      toast.error('La fuente pesa demasiado. Usa un archivo menor de 2.5 MB.')
      return
    }

    setIsUploading(true)
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(new Error('No se pudo leer el archivo de la fuente.'))
        reader.readAsDataURL(file)
      })

      const cleanName = sanitizeFontName(file.name) || `Fuente ${customFonts.length + 1}`
      const id = `custom-font-${Date.now()}`
      saveCustomFont({
        id,
        label: cleanName,
        family: `Plata Custom ${cleanName}`,
        format: inferFontFormat(file.name, file.type),
        dataUrl,
      })
      toast.success(`${cleanName} ya está disponible para usar en la app.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cargar la fuente.')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Card className="border-graphite bg-surface p-6 shadow-vault">
      <SectionIntro
        eyebrow="Tipografia"
        title="Define la voz visual de la app"
        description="Elige entre varias fuentes listas para usar o sube una tipografía local para personalizar toda la interfaz."
        icon={
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-vault-sm">
            <span className="text-lg font-semibold">Aa</span>
          </div>
        }
      />

      <div className="mt-6 grid gap-3">
        {typographyPresets.map((option) => {
          const selected = typography === option.id
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setTypography(option.id)}
              className={`rounded-2xl border p-4 text-left transition-all ${selected
                ? 'border-primary/40 bg-primary/10 shadow-vault'
                : 'border-graphite bg-surface-container-low hover:border-outline-variant hover:bg-surface-container'
                }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-on-surface">{option.label}</p>
                  <p className="mt-1 text-xs text-muted-gray">{option.description}</p>
                </div>
                {selected ? <AppIcon name="check" className="size-4 text-primary" /> : null}
              </div>
              <p
                className="mt-4 text-xl text-on-surface"
                style={{ fontFamily: option.family }}
              >
                {option.preview}
              </p>
            </button>
          )
        })}
      </div>

      <div className="mt-5 rounded-2xl border border-graphite bg-surface-container-low p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-on-surface">Subir tipografía local</p>
            <p className="mt-1 text-xs text-muted-gray">
              Acepta archivos `woff`, `woff2`, `ttf` y `otf`. La fuente queda guardada en este navegador.
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary-container px-4 py-2 text-sm font-medium text-primary-foreground transition hover:brightness-110">
            <input
              type="file"
              accept=".woff,.woff2,.ttf,.otf,font/woff,font/woff2,font/ttf,font/otf"
              onChange={(event) => void handleCustomFontUpload(event)}
              className="hidden"
              disabled={isUploading}
            />
            <span>{isUploading ? 'Cargando...' : 'Subir fuente'}</span>
          </label>
        </div>

        {customFonts.length > 0 ? (
          <div className="mt-4 space-y-3">
            {customFonts.map((font) => {
              const selected = typography === font.id
              return (
                <div
                  key={font.id}
                  className={`rounded-2xl border p-4 ${selected ? 'border-primary/35 bg-primary/8' : 'border-graphite bg-abyss/70'}`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      onClick={() => setTypography(font.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-on-surface">{font.label}</p>
                        {selected ? <Badge className="bg-primary/15 text-primary">Activa</Badge> : null}
                        {!isTypographyPreset(typography) && selected ? <Badge variant="secondary">Local</Badge> : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-gray">
                        Formato {font.format.toUpperCase()}
                      </p>
                      <p
                        className="mt-3 text-xl text-on-surface"
                        style={{ fontFamily: getTypographyFamily(font.id, customFonts) }}
                      >
                        12345 Presupuesto mensual
                      </p>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Eliminar ${font.label}`}
                      onClick={() => removeCustomFont(font.id)}
                      className="shrink-0 text-muted-gray hover:bg-error/10 hover:text-error"
                    >
                      <AppIcon name="trash" className="size-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : null}
      </div>
    </Card>
  )
}

function IconPackCard({
  iconPack,
  setIconPack,
}: {
  iconPack: AppIconPack
  setIconPack: (iconPack: AppIconPack) => void
}) {
  return (
    <Card className="border-graphite bg-surface p-6 shadow-vault">
      <SectionIntro
        eyebrow="Iconos"
        title="Cambia la librería visual"
        description="Puedes alternar entre Lucide, Tabler y Material Symbols para que la interfaz adopte el estilo que prefieras."
        icon={
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-vault-sm">
            <AppIcon name="sparkles" className="size-5" />
          </div>
        }
      />

      <div className="mt-6 grid gap-3">
        {iconPackOptions.map((option) => {
          const selected = iconPack === option.id
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setIconPack(option.id)}
              className={`rounded-2xl border p-4 text-left transition-all ${selected
                ? 'border-primary/40 bg-primary/10 shadow-vault'
                : 'border-graphite bg-surface-container-low hover:border-outline-variant hover:bg-surface-container'
                }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-on-surface">{getIconPackLabel(option.id)}</p>
                  <p className="mt-1 text-xs text-muted-gray">{option.description}</p>
                </div>
                {selected ? <AppIcon name="check" className="size-4 text-primary" /> : null}
              </div>

              <div className="mt-4 flex items-center gap-4 rounded-2xl border border-graphite bg-abyss/70 px-4 py-3 text-on-surface">
                <AppIcon pack={option.id} name="dashboard" className="size-5" />
                <AppIcon pack={option.id} name="wallet" className="size-5" />
                <AppIcon pack={option.id} name="settings" className="size-5" />
                <AppIcon pack={option.id} name="bell" className="size-5" />
              </div>
            </button>
          )
        })}
      </div>
    </Card>
  )
}

function MonthlyResetCard() {
  const authMode = useAuthStore((state) => state.authMode)
  const user = useAuthStore((state) => state.user)
  const transactions = useFinanceStore((state) => state.transactions)
  const debts = useFinanceStore((state) => state.debts)
  const wishlist = useFinanceStore((state) => state.wishlist)
  const reminders = useFinanceStore((state) => state.reminders)
  const monthlyPlanningHistory = useFinanceStore((state) => state.monthlyPlanningHistory)
  const resetMonthlyPlans = useFinanceStore((state) => state.resetMonthlyPlans)
  const restoreMonthlyPlan = useFinanceStore((state) => state.restoreMonthlyPlan)
  const wantsDisabled = usePreferencesStore((state) => state.formula.wants === 0)
  const overview = useMonthlyOverview()
  const [isResetting, setIsResetting] = useState(false)
  const [restoringKey, setRestoringKey] = useState<string | null>(null)

  const plannedExpenses = useMemo(
    () => transactions.filter((transaction) => transaction.type === 'expense'),
    [transactions],
  )
  const plannedWants = useMemo(
    () => transactions.filter((transaction) => transaction.type === 'want'),
    [transactions],
  )

  const monthlySummary = useMemo(() => {
    const expenseChecked = plannedExpenses.filter((transaction) => parseExpenseDescription(transaction.description).status === 'checked').length
    const wantChecked = plannedWants.filter((transaction) => parseWantDescription(transaction.description).status === 'checked').length

    return {
      plannedExpenses: plannedExpenses.length,
      plannedWants: plannedWants.length,
      expenseChecked,
      wantChecked,
    }
  }, [plannedExpenses, plannedWants])

  async function handleResetMonth() {
    if (isResetting) return

    setIsResetting(true)
    try {
      await downloadMonthlyPdfReport({
        overview,
        transactions,
        wishlist,
        debts,
        reminders,
        periodStart: getFinancialPeriodStart(monthlyPlanningHistory),
        userName: authMode === 'guest' ? 'Invitado local' : user?.name ?? 'Usuario',
        mode: 'closing',
      })
      await resetMonthlyPlans()
      toast.success('Informe PDF descargado y nuevo ciclo iniciado correctamente.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cerrar el mes.')
    } finally {
      setIsResetting(false)
    }
  }

  async function handleRestore(historyId: string, scope: 'expenses' | 'wants' | 'all') {
    const key = `${historyId}:${scope}`
    setRestoringKey(key)
    try {
      await restoreMonthlyPlan(historyId, scope)
      toast.success(
        scope === 'all'
          ? 'Se restauraron gastos y gustos desde el historial.'
          : scope === 'expenses'
            ? 'Se restauro la lista de gastos.'
            : 'Se restauro la lista de gustos.',
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo restaurar el historial.')
    } finally {
      setRestoringKey(null)
    }
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <Card className="border-graphite bg-surface p-6 shadow-vault">
        <SectionIntro
          eyebrow="Cierre mensual"
          title="Iniciar un nuevo ciclo"
          description="Marca este momento como el inicio del nuevo presupuesto y deja las listas listas para volver a planificar desde cero."
          icon={
            <div className="flex size-11 items-center justify-center rounded-2xl bg-warning/10 text-warning shadow-vault-sm">
              <AppIcon name="archive" className="size-5" />
            </div>
          }
        />

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-graphite bg-surface-container-low p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-medium-gray">Gastos activos</p>
            <p className="mt-2 text-2xl font-semibold text-on-surface">{monthlySummary.plannedExpenses}</p>
            <p className="mt-1 text-xs text-muted-gray">{monthlySummary.expenseChecked} ya marcados como comprados</p>
          </div>
          <div className="rounded-2xl border border-graphite bg-surface-container-low p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-medium-gray">Gustos activos</p>
            <p className="mt-2 text-2xl font-semibold text-on-surface">{monthlySummary.plannedWants}</p>
            <p className="mt-1 text-xs text-muted-gray">{monthlySummary.wantChecked} ya marcados como disfrutados</p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-graphite bg-surface-container-low p-4">
          <p className="text-sm font-medium text-on-surface">Qué hace este reset</p>
          <p className="mt-2 text-sm text-muted-gray">
            Desde el momento del reset, ingresos, gastos, gustos, ahorros y pagos de deuda se calculan dentro del nuevo ciclo. Tus datos anteriores no se borran; solo se limpian las listas activas de gastos y gustos.
          </p>

          <div className="mt-4">
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button
                    className="bg-warning text-black hover:bg-warning/85"
                    disabled={isResetting}
                    loading={isResetting}
                  />
                }
              >
                <AppIcon name="refresh" className="size-4" />
                Iniciar nuevo ciclo
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Descargar informe e iniciar un nuevo ciclo</AlertDialogTitle>
                  <AlertDialogDescription>
                    Primero se descargará el informe PDF del período. Después, el presupuesto empezará a contar desde este momento y las listas activas quedarán vacías.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isResetting}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-warning text-black hover:bg-warning/85"
                    loading={isResetting}
                    onClick={() => void handleResetMonth()}
                  >
                    <AppIcon name="download" className="size-4" />
                    Descargar y cerrar mes
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </Card>

      <Card className="border-graphite bg-surface p-6 shadow-vault">
        <SectionIntro
          eyebrow="Historial"
          title="Listas reutilizables"
          description="Cada cierre mensual guarda una version de tu lista para que puedas recuperarla luego completa o por categoria."
          icon={
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-vault-sm">
              <AppIcon name="history" className="size-5" />
            </div>
          }
        />

        <div className="mt-6 space-y-3">
          {monthlyPlanningHistory.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-graphite bg-surface-container-low p-6 text-sm text-muted-gray">
              Aun no has guardado ningún historial mensual. Cuando hagas el reset del mes, aparecera aquí para reutilizarlo.
            </div>
          ) : (
            monthlyPlanningHistory.map((history) => (
              <div key={history.id} className="rounded-2xl border border-graphite bg-surface-container-low p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-on-surface">{history.label}</p>
                    <p className="mt-1 text-xs text-muted-gray">
                      Guardado el {new Date(history.createdAt).toLocaleDateString('es-ES')} con {history.expenses.length} gasto(s) y {history.wants.length} gusto(s).
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="bg-primary/10 text-primary">
                      {history.expenses.length} gastos
                    </Badge>
                    <Badge variant="secondary" className="bg-secondary/10 text-secondary">
                      {history.wants.length} gustos
                    </Badge>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={restoringKey !== null || history.expenses.length === 0}
                    loading={restoringKey === `${history.id}:expenses`}
                    onClick={() => void handleRestore(history.id, 'expenses')}
                    className="border-graphite bg-abyss text-on-surface hover:bg-surface-container"
                  >
                    <AppIcon name="rotate" className="size-4" />
                    Restaurar gastos
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={wantsDisabled || restoringKey !== null || history.wants.length === 0}
                    loading={restoringKey === `${history.id}:wants`}
                    onClick={() => void handleRestore(history.id, 'wants')}
                    className="border-graphite bg-abyss text-on-surface hover:bg-surface-container"
                  >
                    <AppIcon name="rotate" className="size-4" />
                    Restaurar gustos
                  </Button>
                  <Button
                    size="sm"
                    disabled={
                      restoringKey !== null
                      || (history.expenses.length === 0 && history.wants.length === 0)
                      || (wantsDisabled && history.wants.length > 0)
                    }
                    loading={restoringKey === `${history.id}:all`}
                    onClick={() => void handleRestore(history.id, 'all')}
                    className="bg-primary-container text-primary-foreground hover:brightness-110"
                  >
                    <AppIcon name="rotate" className="size-4" />
                    Restaurar todo
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </section>
  )
}

function CurrencySettingsCard() {
  const currencies = usePreferencesStore((state) => state.currencies)
  const activeCurrencyCode = usePreferencesStore((state) => state.activeCurrencyCode)
  const saveCurrency = usePreferencesStore((state) => state.saveCurrency)
  const removeCurrency = usePreferencesStore((state) => state.removeCurrency)
  const setActiveCurrency = usePreferencesStore((state) => state.setActiveCurrency)
  const [draft, setDraft] = useState<CurrencyPreference>(CURRENCY_CATALOG[1])
  const [rate, setRate] = useState(String(CURRENCY_CATALOG[1].exchangeRate))

  function selectCurrency(code: string) {
    const next = currencies.find((entry) => entry.code === code)
      ?? CURRENCY_CATALOG.find((entry) => entry.code === code)
      ?? CURRENCY_CATALOG[1]
    setDraft(next)
    setRate(String(next.exchangeRate))
  }

  function handleSaveCurrency() {
    const exchangeRate = Number(rate)
    if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
      toast.error('La tasa debe ser un número mayor que cero.')
      return
    }

    saveCurrency({ ...draft, country: draft.country.trim(), exchangeRate })
    toast.success(`${draft.code} quedó disponible en el selector superior.`)
  }

  return (
    <Card className="border-graphite bg-surface p-6 shadow-vault">
      <SectionIntro
        eyebrow="Moneda de visualización"
        title="Convierte tus cifras sin alterar tus datos"
        description="Plata App guarda la contabilidad en USD. Aquí defines cuántas unidades de otra moneda equivalen a 1 USD; al seleccionarla arriba, todos los importes se multiplican por esa tasa."
        icon={
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-vault-sm">
            <AppIcon name="globe" className="size-5" />
          </div>
        }
      />

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
        <div className="rounded-2xl border border-graphite bg-abyss p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Moneda</Label>
              <Select value={draft.code} onValueChange={(value) => selectCurrency(value ?? 'CUP')}>
                <SelectTrigger className="border-graphite bg-surface-container-low text-on-surface">
                  <SelectValue>{draft.code} · {draft.name}</SelectValue>
                </SelectTrigger>
                <SelectContent className="border-graphite bg-surface text-on-surface">
                  {CURRENCY_CATALOG.filter((currency) => currency.code !== 'USD').map((currency) => (
                    <SelectItem key={currency.code} value={currency.code}>
                      {currency.code} · {currency.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency-country">País o región</Label>
              <Input
                id="currency-country"
                value={draft.country}
                onChange={(event) => setDraft((current) => ({ ...current, country: event.target.value }))}
                className="border-graphite bg-surface-container-low text-on-surface"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="currency-rate">1 USD equivale a</Label>
              <div className="flex gap-2">
                <Input
                  id="currency-rate"
                  type="number"
                  min="0.000001"
                  step="any"
                  inputMode="decimal"
                  value={rate}
                  onChange={(event) => setRate(event.target.value)}
                  className="border-graphite bg-surface-container-low text-on-surface"
                  aria-describedby="currency-rate-help"
                />
                <div className="flex h-10 min-w-16 items-center justify-center rounded-lg border border-graphite bg-surface-container-high px-3 text-sm font-semibold text-on-surface">
                  {draft.code}
                </div>
              </div>
              <p id="currency-rate-help" className="text-xs text-muted-gray">
                Ejemplo Cuba: 1 USD = 670 CUP. Puedes actualizar la tasa cuando cambie el mercado que utilizas.
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-primary">Vista previa</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-on-surface">
                $100 USD → {formatMoney(100, { ...draft, exchangeRate: Number(rate) || 0 })}
              </p>
            </div>
            <Button onClick={handleSaveCurrency} className="bg-primary-container text-primary-foreground hover:brightness-110">
              <AppIcon name="coins" className="size-4" />
              Guardar moneda
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-on-surface">Monedas disponibles</p>
            <p className="mt-1 text-xs text-muted-gray">La activa aparece resaltada y controla el selector superior.</p>
          </div>
          {currencies.map((currency) => (
            <div
              key={currency.code}
              className={`flex items-center gap-3 rounded-2xl border p-4 ${activeCurrencyCode === currency.code ? 'border-primary/40 bg-primary/8' : 'border-graphite bg-abyss'}`}
            >
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setActiveCurrency(currency.code)}>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-on-surface">{currency.code}</span>
                  {activeCurrencyCode === currency.code ? <Badge className="bg-primary/15 text-primary">Activa</Badge> : null}
                </div>
                <p className="mt-1 truncate text-xs text-muted-gray">
                  {currency.country} · {currency.code === 'USD' ? 'Moneda base' : `1 USD = ${currency.exchangeRate.toLocaleString('es-ES')} ${currency.code}`}
                </p>
              </button>
              {currency.code !== 'USD' ? (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Eliminar ${currency.code}`}
                  onClick={() => removeCurrency(currency.code)}
                  className="shrink-0 text-muted-gray hover:bg-error/10 hover:text-error"
                >
                  <AppIcon name="trash" className="size-4" />
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

function SettingsSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="space-y-4">
      <div className="rounded-3xl border border-graphite bg-surface-container-low/70 p-5 shadow-vault-sm">
        <p className="text-xs uppercase tracking-[0.22em] text-medium-gray">{eyebrow}</p>
        <div className="mt-2 space-y-2">
          <h2 className="text-2xl font-semibold text-on-surface">{title}</h2>
          <p className="max-w-3xl text-sm text-muted-gray">{description}</p>
        </div>
      </div>

      {children}
    </section>
  )
}

export default function Settings() {
  const appearance = usePreferencesStore((state) => state.appearance)
  const theme = usePreferencesStore((state) => state.theme)
  const background = usePreferencesStore((state) => state.background)
  const iconPack = usePreferencesStore((state) => state.iconPack)
  const formula = usePreferencesStore((state) => state.formula)
  const setAppearance = usePreferencesStore((state) => state.setAppearance)
  const setTheme = usePreferencesStore((state) => state.setTheme)
  const setBackground = usePreferencesStore((state) => state.setBackground)
  const setIconPack = usePreferencesStore((state) => state.setIconPack)
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
    if (nextFormula.wants === 0) {
      nextFormula.rolloverSavings = false
    }
    setFormula(nextFormula)
    setDraftFormula(nextFormula)
    toast.success('La formula financiera fue actualizada.')
  }

  function handleResetPreferences() {
    resetPreferences()
    setDraftFormula(cloneFormula(defaultFormula))
    toast.success('Se restauraron los ajustes visuales y la fórmula original.')
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-on-surface md:text-[36px]">
            Settings
          </h1>
          <p className="max-w-3xl text-sm text-muted-gray">
            Ajusta la fórmula de presupuesto, la apariencia, la tipografía y el estilo de iconos
            para que Plata App se adapte mejor a tu forma de planificar.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={handleResetPreferences}
          className="border-graphite bg-primary-container text-primary-foreground hover:bg-primary-container/85"
        >
          <AppIcon name="refresh" className="size-4" />
          Restaurar ajustes
        </Button>
      </header>

      <SettingsSection
        eyebrow="Vision general"
        title="Resumen de configuracion"
        description="Revisa de un vistazo la fórmula activa y el estilo visual que está usando la app en este momento."
      >
        <SummaryCard
          formula={formula}
          appearance={appearance}
          theme={theme}
          background={background}
        />
      </SettingsSection>

      <SettingsSection
        eyebrow="Ajustes del sistema"
        title="Controla el comportamiento de la app"
        description="Aquí agrupamos la planificación financiera, monedas, automatizaciones y el ciclo mensual para que la parte operativa quede separada de lo visual."
      >
        <div className="grid gap-4">
          <FormulaCard
            draftFormula={draftFormula}
            setDraftFormula={setDraftFormula}
            onSaveFormula={handleSaveFormula}
            isFormulaValid={isFormulaValid}
            total={total}
            formulaChanged={formulaChanged}
          />

          <CurrencySettingsCard />

          <AutomationSettings />

          <MonthlyResetCard />
        </div>
      </SettingsSection>

      <SettingsSection
        eyebrow="Ajustes esteticos"
        title="Personaliza la apariencia"
        description="Separa el modo, la paleta, el fondo, la tipografía y los iconos para que sea más fácil cambiar el look de la app sin mezclarlo con opciones del sistema."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <AppearanceCard appearance={appearance} setAppearance={setAppearance} />
          <ThemeCard theme={theme} setTheme={setTheme} />
          <BackgroundCard background={background} setBackground={setBackground} />
          <TypographyCard />
          <IconPackCard iconPack={iconPack} setIconPack={setIconPack} />
        </div>
      </SettingsSection>
    </div>
  )
}
