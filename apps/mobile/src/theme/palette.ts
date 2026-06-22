import type { AppAppearance, AppTheme } from '@plata/shared'

type Palette = {
  background: string
  backgroundAlt: string
  surface: string
  surfaceMuted: string
  border: string
  primary: string
  primarySoft: string
  primaryForeground: string
  text: string
  textMuted: string
  textOnPrimary: string
  warning: string
  success: string
  danger: string
}

function hexToHslChannels(hexColor: string) {
  const normalized = hexColor.replace('#', '')
  const safeValue =
    normalized.length === 3
      ? normalized
          .split('')
          .map((segment) => `${segment}${segment}`)
          .join('')
      : normalized

  const red = Number.parseInt(safeValue.slice(0, 2), 16) / 255
  const green = Number.parseInt(safeValue.slice(2, 4), 16) / 255
  const blue = Number.parseInt(safeValue.slice(4, 6), 16) / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const delta = max - min

  let hue = 0
  if (delta !== 0) {
    if (max === red) hue = ((green - blue) / delta) % 6
    else if (max === green) hue = (blue - red) / delta + 2
    else hue = (red - green) / delta + 4
  }

  hue = Math.round(hue * 60)
  if (hue < 0) hue += 360

  const lightness = (max + min) / 2
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1))

  return `${hue} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`
}

const palettes: Record<AppAppearance, Record<AppTheme, Palette>> = {
  dark: {
    obsidian: {
      background: '#111111',
      backgroundAlt: '#191919',
      surface: '#1f1f1f',
      surfaceMuted: '#272727',
      border: 'rgba(255,255,255,0.10)',
      primary: '#7c3aed',
      primarySoft: 'rgba(124,58,237,0.16)',
      primaryForeground: '#efe7ff',
      text: '#f5f3f2',
      textMuted: '#b3afae',
      textOnPrimary: '#f7f2ff',
      warning: '#f59e0b',
      success: '#34d399',
      danger: '#ef4444',
    },
    midnight: {
      background: '#0b1220',
      backgroundAlt: '#111b30',
      surface: '#14203a',
      surfaceMuted: '#1b2947',
      border: 'rgba(148,163,184,0.18)',
      primary: '#38bdf8',
      primarySoft: 'rgba(56,189,248,0.16)',
      primaryForeground: '#dff7ff',
      text: '#edf5ff',
      textMuted: '#a5b4cc',
      textOnPrimary: '#04293a',
      warning: '#f59e0b',
      success: '#34d399',
      danger: '#fb7185',
    },
    ember: {
      background: '#16110d',
      backgroundAlt: '#211711',
      surface: '#2a1d17',
      surfaceMuted: '#34241d',
      border: 'rgba(255,219,180,0.14)',
      primary: '#f97316',
      primarySoft: 'rgba(249,115,22,0.18)',
      primaryForeground: '#fff1e7',
      text: '#fff3eb',
      textMuted: '#d4b5a1',
      textOnPrimary: '#3b1200',
      warning: '#fbbf24',
      success: '#4ade80',
      danger: '#f87171',
    },
  },
  light: {
    obsidian: {
      background: '#f5f2fb',
      backgroundAlt: '#efe8fb',
      surface: '#ffffff',
      surfaceMuted: '#f4eefc',
      border: 'rgba(62,39,113,0.12)',
      primary: '#6d28d9',
      primarySoft: 'rgba(109,40,217,0.10)',
      primaryForeground: '#f7f2ff',
      text: '#1d1630',
      textMuted: '#665f76',
      textOnPrimary: '#ffffff',
      warning: '#d97706',
      success: '#059669',
      danger: '#dc2626',
    },
    midnight: {
      background: '#eef6ff',
      backgroundAlt: '#ddeafb',
      surface: '#ffffff',
      surfaceMuted: '#edf4ff',
      border: 'rgba(30,64,175,0.12)',
      primary: '#2563eb',
      primarySoft: 'rgba(37,99,235,0.10)',
      primaryForeground: '#eff6ff',
      text: '#0f172a',
      textMuted: '#52607a',
      textOnPrimary: '#ffffff',
      warning: '#d97706',
      success: '#059669',
      danger: '#dc2626',
    },
    ember: {
      background: '#fff5ed',
      backgroundAlt: '#ffe7d0',
      surface: '#ffffff',
      surfaceMuted: '#fff1e5',
      border: 'rgba(194,65,12,0.12)',
      primary: '#ea580c',
      primarySoft: 'rgba(234,88,12,0.12)',
      primaryForeground: '#fff7f2',
      text: '#431407',
      textMuted: '#8a5a4b',
      textOnPrimary: '#ffffff',
      warning: '#ca8a04',
      success: '#059669',
      danger: '#dc2626',
    },
  },
}

export function resolvePalette(appearance: AppAppearance, theme: AppTheme) {
  return palettes[appearance][theme]
}

export function getPaletteCssVars(palette: Palette) {
  const borderHex = palette.border.startsWith('#') ? palette.border : palette.surfaceMuted

  return {
    '--background': hexToHslChannels(palette.background),
    '--foreground': hexToHslChannels(palette.text),
    '--card': hexToHslChannels(palette.surface),
    '--card-foreground': hexToHslChannels(palette.text),
    '--popover': hexToHslChannels(palette.surface),
    '--popover-foreground': hexToHslChannels(palette.text),
    '--primary': hexToHslChannels(palette.primary),
    '--primary-foreground': hexToHslChannels(palette.textOnPrimary),
    '--secondary': hexToHslChannels(palette.surfaceMuted),
    '--secondary-foreground': hexToHslChannels(palette.text),
    '--muted': hexToHslChannels(palette.surfaceMuted),
    '--muted-foreground': hexToHslChannels(palette.textMuted),
    '--accent': hexToHslChannels(palette.surfaceMuted),
    '--accent-foreground': hexToHslChannels(palette.text),
    '--destructive': hexToHslChannels(palette.danger),
    '--destructive-foreground': hexToHslChannels('#ffffff'),
    '--border': hexToHslChannels(borderHex),
    '--input': hexToHslChannels(palette.surfaceMuted),
    '--ring': hexToHslChannels(palette.primary),
  }
}

export type { Palette }
