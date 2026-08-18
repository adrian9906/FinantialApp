import { useEffect, useMemo } from 'react'
import { buildReceivableReminder } from '@plata/shared'
import { toast } from 'sonner'

import { formatMoney } from '@/lib/currency'
import { getTodayDateKey } from '@/lib/date'
import { useReceivablesStore } from '@/store/receivablesStore'

export function ReceivableDueNotifier() {
  const hydrate = useReceivablesStore((state) => state.hydrate)
  const receivables = useReceivablesStore((state) => state.receivables)
  const dueToday = useMemo(() => {
    const today = getTodayDateKey()
    return receivables.filter((debt) => !debt.isSettled && debt.endDate === today)
  }, [receivables])

  useEffect(() => { hydrate() }, [hydrate])

  useEffect(() => {
    for (const debt of dueToday) {
      const notificationKey = `plata-receivable-notified:${debt.id}:${debt.endDate}`
      if (sessionStorage.getItem(notificationKey)) continue
      const reminder = buildReceivableReminder(debt, formatMoney)
      toast.warning(reminder.title, { description: reminder.description, duration: 12_000 })
      sessionStorage.setItem(notificationKey, '1')
    }
  }, [dueToday])

  return null
}
