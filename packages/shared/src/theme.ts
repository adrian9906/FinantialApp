import type { AppAppearance, AppBackground, AppTheme } from './preferences'

export const appearanceOptions: Array<{ id: AppAppearance; label: string; description: string }> = [
  {
    id: 'dark',
    label: 'Oscuro',
    description: 'Contraste profundo y look Obsidian.',
  },
  {
    id: 'light',
    label: 'Claro',
    description: 'Superficies limpias con la misma jerarquia visual.',
  },
]

export const themeOptions: Array<{ id: AppTheme; label: string; description: string }> = [
  {
    id: 'obsidian',
    label: 'Obsidian',
    description: 'Violeta mineral con superficies densas.',
  },
  {
    id: 'midnight',
    label: 'Midnight',
    description: 'Azules nocturnos y contraste frio.',
  },
  {
    id: 'ember',
    label: 'Ember',
    description: 'Acentos calidos para una presencia más enérgica.',
  },
]

export const backgroundOptions: Array<{ id: AppBackground; label: string; description: string }> = [
  {
    id: 'grid',
    label: 'Hexagonos',
    description: 'Malla geometricamente viva para el fondo principal.',
  },
  {
    id: 'nebula',
    label: 'Nebula',
    description: 'Velos suaves y gradientes amplios.',
  },
  {
    id: 'carbon',
    label: 'Carbon',
    description: 'Textura discreta y más técnica.',
  },
  {
    id: 'aurora',
    label: 'Aurora',
    description: 'Tonos luminosos con energía flotante.',
  },
]
