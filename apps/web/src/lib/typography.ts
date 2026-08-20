import type { AppTypographyPreset } from '@plata/shared'

export interface TypographyPresetOption {
  id: AppTypographyPreset
  label: string
  description: string
  family: string
  preview: string
}

export interface CustomTypographyOption {
  id: string
  label: string
  family: string
  format: 'woff' | 'woff2' | 'truetype' | 'opentype'
  dataUrl: string
}

export const typographyPresets: TypographyPresetOption[] = [
  {
    id: 'inter',
    label: 'Inter',
    description: 'Neutral, muy legible y pensada para producto digital.',
    family: '"Inter", ui-sans-serif, system-ui, -apple-system, sans-serif',
    preview: '12345 Presupuesto mensual',
  },
  {
    id: 'space-grotesk',
    label: 'Space Grotesk',
    description: 'Más geométrica y tecnológica, con bastante personalidad.',
    family: '"Space Grotesk", ui-sans-serif, system-ui, sans-serif',
    preview: '12345 Presupuesto mensual',
  },
  {
    id: 'manrope',
    label: 'Manrope',
    description: 'Limpia y moderna, ideal si quieres un look más suave.',
    family: '"Manrope", ui-sans-serif, system-ui, sans-serif',
    preview: '12345 Presupuesto mensual',
  },
  {
    id: 'ibm-plex-sans',
    label: 'IBM Plex Sans',
    description: 'Más editorial y técnica, con aire utilitario.',
    family: '"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif',
    preview: '12345 Presupuesto mensual',
  },
  {
    id: 'playfair-display',
    label: 'Playfair Display',
    description: 'Más expresiva y elegante para una interfaz con acento editorial.',
    family: '"Playfair Display", Georgia, serif',
    preview: '12345 Presupuesto mensual',
  },
]

export function isTypographyPreset(value: string): value is AppTypographyPreset {
  return typographyPresets.some((preset) => preset.id === value)
}

export function getTypographyFamily(
  selectedId: string,
  customFonts: CustomTypographyOption[],
) {
  const preset = typographyPresets.find((option) => option.id === selectedId)
  if (preset) return preset.family

  const customFont = customFonts.find((font) => font.id === selectedId)
  if (customFont) return `"${customFont.family}", ui-sans-serif, system-ui, sans-serif`

  return typographyPresets[0].family
}

export function inferFontFormat(fileName: string, mimeType: string) {
  const lowerName = fileName.toLowerCase()
  if (mimeType.includes('woff2') || lowerName.endsWith('.woff2')) return 'woff2' as const
  if (mimeType.includes('woff') || lowerName.endsWith('.woff')) return 'woff' as const
  if (mimeType.includes('otf') || lowerName.endsWith('.otf')) return 'opentype' as const
  return 'truetype' as const
}
