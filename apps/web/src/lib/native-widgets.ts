import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'

export interface WidgetSummary {
  hasAccount: boolean
  accountName: string
  balance: string
  todayExpenses: string
  dateKey: string
  updatedLabel: string
}

interface PlataWidgetsPlugin {
  updateSummary(summary: WidgetSummary): Promise<void>
  clearSummary(): Promise<void>
  pinWidget(): Promise<{ requested: boolean }>
  getStatus(): Promise<{ notificationEnabled: boolean }>
  setNotificationEnabled(options: { enabled: boolean }): Promise<void>
  getLaunchAction(): Promise<{ action: 'add-expense' | 'dashboard' | null }>
  addListener(event: 'launchAction', callback: () => void): Promise<PluginListenerHandle>
}

export const NativeWidgets = registerPlugin<PlataWidgetsPlugin>('PlataWidgets')
export function supportsNativeWidgets() {
  return Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('PlataWidgets')
}
