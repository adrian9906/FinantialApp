import { useEffect, useMemo } from 'react'
import { buildReceivableReminder, isReceivable } from '@plata/shared'
import { toast } from 'sonner'

import { formatMoney } from '@/lib/currency'
import { getTodayDateKey } from '@/lib/date'
import { useFinanceStore } from '@/store/financeStore'

export function ReceivableDueNotifier() {
  const debts = useFinanceStore((state) => state.debts)
  const dueToday = useMemo(() => {
    const today = getTodayDateKey()
    return debts.filter((debt) => isReceivable(debt) && !debt.isSettled && debt.endDate === today)
  }, [debts])

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
