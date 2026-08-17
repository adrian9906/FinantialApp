export type DashboardWidgetId =
  | 'decision-today'
  | 'safe-available'
  | 'daily-margin'
  | 'financial-score'
  | 'accounts-balances'
  | 'expenses-by-category'
  | 'savings-goals'
  | 'upcoming-payments'
  | 'debts'
  | 'wishlist'
  | 'net-worth'
  | 'household-activity'

export interface DashboardWidgetDefinition {
  id: DashboardWidgetId
  label: string
  description: string
}

export const dashboardWidgetCatalog: DashboardWidgetDefinition[] = [
  { id: 'decision-today', label: 'Decisión de hoy', description: 'La acción financiera más importante del momento.' },
  { id: 'safe-available', label: 'Disponible seguro', description: 'Saldo utilizable después de compromisos y ahorro.' },
  { id: 'daily-margin', label: 'Margen diario', description: 'Cuánto puedes usar cada día hasta cerrar el mes.' },
  { id: 'financial-score', label: 'Score financiero', description: 'Puntaje de salud financiera y su tendencia.' },
  { id: 'accounts-balances', label: 'Cuentas y saldos', description: 'Entrada, salida y ahorro del periodo.' },
  { id: 'expenses-by-category', label: 'Gastos por categoría', description: 'Dónde se concentra el gasto esencial.' },
  { id: 'savings-goals', label: 'Objetivos de ahorro', description: 'Progreso de las metas activas.' },
  { id: 'upcoming-payments', label: 'Próximos pagos', description: 'Recordatorios pendientes y vencimientos.' },
  { id: 'debts', label: 'Deudas', description: 'Saldo pendiente y próximas obligaciones.' },
  { id: 'wishlist', label: 'Wishlist', description: 'Deseos y cuánto falta para alcanzarlos.' },
  { id: 'net-worth', label: 'Patrimonio', description: 'Estimación de activos menos obligaciones.' },
  { id: 'household-activity', label: 'Actividad del hogar', description: 'Últimos movimientos de este perfil financiero.' },
]

export const defaultDashboardWidgets: DashboardWidgetId[] = [
  'decision-today',
  'safe-available',
  'daily-margin',
  'financial-score',
  'expenses-by-category',
  'upcoming-payments',
  'debts',
]

const dashboardWidgetIds = new Set<DashboardWidgetId>(dashboardWidgetCatalog.map((widget) => widget.id))

export function normalizeDashboardWidgets(value?: readonly string[] | null): DashboardWidgetId[] {
  if (!value) return [...defaultDashboardWidgets]
  const unique = new Set<DashboardWidgetId>()
  value.forEach((id) => {
    if (dashboardWidgetIds.has(id as DashboardWidgetId)) unique.add(id as DashboardWidgetId)
  })
  return Array.from(unique)
}
