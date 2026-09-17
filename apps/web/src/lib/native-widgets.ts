import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'

export interface WidgetSummary {
  hasAccount: boolean
  accountName: string
  balance: string
  todayExpenses: string
  dateKey: string
  updatedLabel: string
  catalogJson: string
  selectedAccountId: string
  selectedCurrencyCode: string
}

interface PlataWidgetsPlugin {
  updateSummary(summary: WidgetSummary): Promise<void>
  clearSummary(): Promise<void>
  pinWidget(): Promise<{ requested: boolean }>
  getStatus(): Promise<{ notificationEnabled: boolean }>
  getSelection(): Promise<{ accountId: string; currencyCode: string; changed: boolean }>
  setNotificationEnabled(options: { enabled: boolean }): Promise<void>
  getLaunchAction(): Promise<{ action: 'add-expense' | 'dashboard' | null }>
  addListener(event: 'launchAction', callback: () => void): Promise<PluginListenerHandle>
}

export const NativeWidgets = registerPlugin<PlataWidgetsPlugin>('PlataWidgets')
export function supportsNativeWidgets() {
  return Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('PlataWidgets')
}
