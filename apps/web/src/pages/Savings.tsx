import { useState } from 'react'
import { buildSavingWithdrawalDescription, parseSavingDescription } from '@plata/shared'
import { useFinanceStore } from '@/store/financeStore'
import { buildExpenseDescription } from '@/lib/expense-utils'
import { buildWantDescription } from '@/lib/want-utils'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ExportExcelButton } from '@/components/reports/ExportExcelButton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DatePickerField } from '@/components/ui/date-picker-field'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Plus, Trash2, PiggyBank, Pencil, ArrowUpRight } from 'lucide-react'
import { useMonthlyOverview } from '@/lib/useMonthlyOverview'
import { Badge } from '@/components/ui/badge'
import { exportSavingsReport } from '@/lib/reportExports'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const GOAL_CATEGORY_LABELS = {
  emergency: 'Emergencia',
  travel: 'Viaje',
  rent: 'Renta',
  phone: 'Teléfono',
  custom: 'Personalizada',
} as const

export default function Savings() {
  const transactions = useFinanceStore((state) => state.transactions)
  const addTransaction = useFinanceStore((state) => state.addTransaction)
  const updateTransaction = useFinanceStore((state) => state.updateTransaction)
  const removeTransaction = useFinanceStore((state) => state.removeTransaction)
  const savingsGoals = useFinanceStore((state) => state.savingsGoals)
  const addSavingsGoal = useFinanceStore((state) => state.addSavingsGoal)
  const updateSavingsGoal = useFinanceStore((state) => state.updateSavingsGoal)
  const removeSavingsGoal = useFinanceStore((state) => state.removeSavingsGoal)
  const overview = useMonthlyOverview()
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ amount: '', date: '' })
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [goalOpen, setGoalOpen] = useState(false)
  const [goalEditId, setGoalEditId] = useState<string | null>(null)
  const [goalError, setGoalError] = useState<string | null>(null)
  const [isGoalSaving, setIsGoalSaving] = useState(false)
  const [goalForm, setGoalForm] = useState({
    name: '',
    category: 'emergency' as 'emergency' | 'travel' | 'rent' | 'phone' | 'custom',
    targetAmount: '',
    currentAmount: '',
    monthlyContribution: '',
  })
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [withdrawError, setWithdrawError] = useState<string | null>(null)
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  const [withdrawForm, setWithdrawForm] = useState({
    amount: '',
    target: 'purpose' as 'expense' | 'want' | 'purpose',
    itemName: '',
    date: '',
    sourceGoalId: '',
    sourceGoalName: '',
  })

  function resetForm() {
    setForm({ amount: '', date: '' })
    setEditId(null)
    setFormError(null)
  }

  function resetWithdrawForm() {
    setWithdrawForm({
      amount: String(Math.max(0, overview.totalSavings)),
      target: 'purpose',
      itemName: '',
      date: '',
      sourceGoalId: '',
      sourceGoalName: '',
    })
    setWithdrawError(null)
  }

  function resetGoalForm() {
    setGoalForm({
      name: '',
      category: 'emergency',
      targetAmount: '',
      currentAmount: '',
      monthlyContribution: '',
    })
    setGoalEditId(null)
    setGoalError(null)
  }

  function handleOpen(entry?: (typeof transactions)[number]) {
    if (entry) {
      setEditId(entry.id)
      setForm({ amount: String(entry.amount), date: entry.date })
    } else {
      setEditId(null)
      setForm({ amount: String(Math.max(0, remaining)), date: '' })
    }
    setFormError(null)
    setOpen(true)
  }

  function handleOpenGoal(entry?: typeof savingsGoals[number]) {
    if (entry) {
      setGoalEditId(entry.id)
      setGoalForm({
        name: entry.name,
        category: entry.category,
        targetAmount: String(entry.targetAmount),
        currentAmount: String(entry.currentAmount),
        monthlyContribution: String(entry.monthlyContribution),
      })
    } else {
      resetGoalForm()
    }
    setGoalError(null)
    setGoalOpen(true)
  }

  function handleOpenWithdraw(goal?: typeof savingsGoals[number]) {
    setWithdrawForm({
      amount: String(Math.max(0, goal?.currentAmount ?? overview.totalSavings)),
      target: 'purpose',
      itemName: '',
      date: '',
      sourceGoalId: goal?.id ?? '',
      sourceGoalName: goal?.name ?? '',
    })
    setWithdrawError(null)
    setWithdrawOpen(true)
  }

  async function handleSave() {
    if (!form.amount || isSaving) return
    const amount = Number(form.amount)

    if (editId) {
      const currentAmount = transactions.find((t) => t.id === editId)?.amount ?? 0
      const availableForEdit = Math.max(0, remaining + currentAmount)
      if (amount > availableForEdit) {
        setFormError(`Solo puedes ajustar hasta $${availableForEdit.toLocaleString()}.`)
        return
      }
    } else if (amount > remaining) {
      setFormError(`Solo puedes ahorrar hasta $${remaining.toLocaleString()}.`)
      return
    }

    const data = {
      amount,
      type: 'saving' as const,
      date: form.date || new Date().toISOString().slice(0, 10),
    }
    setIsSaving(true)

    try {
      if (editId) {
        await updateTransaction(editId, data)
      } else {
        await addTransaction(data)
      }

      resetForm()
      setOpen(false)
    } finally {
      setIsSaving(false)
    }
  }

  const savingsList = transactions.filter((transaction) => transaction.type === 'saving')
  const pct = overview.budgetSavings > 0 ? Math.min(100, Math.round((overview.totalSavings / overview.budgetSavings) * 100)) : 0
  const remaining = overview.budgetSavings - overview.totalSavings
  const budgetFull = remaining <= 0
  const availableSavings = Math.max(0, overview.totalSavings)
  const assignedToGoals = savingsGoals.reduce((sum, goal) => sum + goal.currentAmount, 0)
  const freeSavings = Math.max(0, availableSavings - assignedToGoals)
  const selectedSourceGoal = withdrawForm.sourceGoalId
    ? savingsGoals.find((goal) => goal.id === withdrawForm.sourceGoalId) ?? null
    : null
  const availableWithdrawAmount = selectedSourceGoal
    ? Math.max(0, selectedSourceGoal.currentAmount)
    : availableSavings

  async function handleSaveGoal() {
    if (isGoalSaving) return

    const targetAmount = Number(goalForm.targetAmount)
    const currentAmount = Number(goalForm.currentAmount || 0)
    const monthlyContribution = Number(goalForm.monthlyContribution || 0)

    if (!goalForm.name.trim()) {
      setGoalError('El nombre de la meta es obligatorio.')
      return
    }
    if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
      setGoalError('El monto objetivo debe ser mayor que cero.')
      return
    }
    if (!Number.isFinite(currentAmount) || currentAmount < 0) {
      setGoalError('El monto actual no puede ser negativo.')
      return
    }
    if (!Number.isFinite(monthlyContribution) || monthlyContribution < 0) {
      setGoalError('El aporte mensual no puede ser negativo.')
      return
    }

    const currentGoalAmount = goalEditId
      ? savingsGoals.find((goal) => goal.id === goalEditId)?.currentAmount ?? 0
      : 0
    const availableForGoal = Math.max(0, freeSavings + currentGoalAmount)

    if (currentAmount > availableForGoal) {
      setGoalError(`Solo puedes asignar hasta $${availableForGoal.toLocaleString()} segun el ahorro libre actual.`)
      return
    }

    const payload = {
      name: goalForm.name.trim(),
      category: goalForm.category,
      targetAmount,
      currentAmount,
      monthlyContribution,
    }

    setIsGoalSaving(true)

    try {
      if (goalEditId) {
        await updateSavingsGoal(goalEditId, payload)
      } else {
        await addSavingsGoal(payload)
      }

      resetGoalForm()
      setGoalOpen(false)
    } finally {
      setIsGoalSaving(false)
    }
  }

  async function handleWithdraw() {
    if (isWithdrawing) return

    const amount = Number(withdrawForm.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setWithdrawError('El monto debe ser mayor que cero.')
      return
    }
    if (amount > availableWithdrawAmount) {
      setWithdrawError(
        selectedSourceGoal
          ? `Solo puedes sacar hasta $${availableWithdrawAmount.toLocaleString()} del bolsillo ${selectedSourceGoal.name}.`
          : `Solo puedes sacar hasta $${availableWithdrawAmount.toLocaleString()} de tus ahorros.`,
      )
      return
    }
    if (!withdrawForm.itemName.trim()) {
      setWithdrawError('Escribe un concepto para registrar el movimiento.')
      return
    }

    const movementDate = withdrawForm.date || new Date().toISOString().slice(0, 10)
    const savingWithdrawal = {
      amount: -amount,
      type: 'saving' as const,
      description: buildSavingWithdrawalDescription(withdrawForm.target, withdrawForm.itemName, {
        sourceGoalId: selectedSourceGoal?.id,
        sourceGoalName: selectedSourceGoal?.name,
      }),
      date: movementDate,
    }
    setIsWithdrawing(true)

    try {
      if (selectedSourceGoal) {
        await updateSavingsGoal(selectedSourceGoal.id, {
          currentAmount: Math.max(0, selectedSourceGoal.currentAmount - amount),
        })

        try {
          await addTransaction(savingWithdrawal)
        } catch (error) {
          await updateSavingsGoal(selectedSourceGoal.id, {
            currentAmount: selectedSourceGoal.currentAmount,
          })
          throw error
        }
      } else {
        await addTransaction(savingWithdrawal)
      }

      if (withdrawForm.target !== 'purpose') {
        await addTransaction({
          amount,
          type: withdrawForm.target,
          description: withdrawForm.target === 'expense'
            ? buildExpenseDescription('essentials', withdrawForm.itemName, 'checked')
            : buildWantDescription('outings', withdrawForm.itemName, 'checked'),
          date: movementDate,
        })
      }

      resetWithdrawForm()
      setWithdrawOpen(false)
    } finally {
      setIsWithdrawing(false)
    }
  }

  async function handleExport() {
    setIsExporting(true)
    try {
      await exportSavingsReport(transactions)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-[28px] md:text-[36px] font-semibold text-on-surface tracking-tight">Ahorros</h1>
          <p className="text-sm text-muted-gray">Página de gestión de ahorros.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <ExportExcelButton loading={isExporting} onClick={handleExport} />
          <Button
            variant="secondary"
            onClick={() => handleOpenGoal()}
            className="bg-primary/10 text-primary hover:bg-primary/15"
          >
            <PiggyBank className="size-4" /> Nueva meta
          </Button>
          <Button
            variant="secondary"
            disabled={availableSavings <= 0}
            onClick={() => handleOpenWithdraw()}
            className="bg-surface-container-high text-on-surface hover:bg-surface-container-higher disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowUpRight className="size-4" /> Sacar dinero
          </Button>
          <Button onClick={() => handleOpen()} disabled={budgetFull} className="bg-tertiary-container text-white hover:bg-tertiary-container/80 shadow-vault disabled:opacity-40 disabled:cursor-not-allowed">
            <Plus className="size-4" /> Agregar ahorro
          </Button>
        </div>
      </header>

      <div className="bg-surface rounded-xl shadow-vault p-6 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-tertiary-container opacity-5 rounded-bl-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-500" />
        <div className="relative z-10">
          <div className="flex justify-between items-center mb-2">
            <p className="text-xs text-muted-gray uppercase tracking-wider">Presupuesto mensual (25%)</p>
            <Badge variant="secondary" className={remaining >= 0 ? 'bg-success/10 text-success' : 'bg-tertiary-container/20 text-tertiary'}>
              {remaining >= 0 ? `$${remaining.toLocaleString()} para ahorrar` : `$${Math.abs(remaining).toLocaleString()} excedido`}
            </Badge>
          </div>
          <h2 className="text-[28px] font-semibold text-on-surface mb-3">
            +${overview.totalSavings.toLocaleString()} <span className="text-base font-normal text-muted-gray">/ ${overview.budgetSavings.toLocaleString()}</span>
          </h2>
          <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
            <div className="h-full bg-tertiary-container rounded-full transition-all duration-1000" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      <section className="grid gap-4 xl:grid-cols-[0.78fr_1.22fr]">
        <Card className="border-graphite bg-surface shadow-vault">
          <div className="border-b border-graphite p-5">
            <p className="text-xs uppercase tracking-[0.22em] text-medium-gray">Metas por objetivo</p>
            <h2 className="mt-3 text-2xl font-semibold text-on-surface">Bolsillos de ahorro</h2>
            <p className="mt-2 text-sm text-muted-gray">
              Separa tu ahorro en emergencia, viaje, renta, teléfono o cualquier meta personalizada con aporte mensual.
            </p>
          </div>
          <div className="grid gap-3 p-5 md:grid-cols-2">
            <Card className="border-graphite bg-abyss p-4 shadow-vault-sm">
              <p className="text-xs uppercase tracking-[0.18em] text-medium-gray">Ahorro libre</p>
              <p className="mt-2 text-2xl font-semibold text-on-surface">${freeSavings.toLocaleString()}</p>
              <p className="mt-1 text-xs text-muted-gray">Disponible para asignar a nuevas metas.</p>
            </Card>
            <Card className="border-graphite bg-abyss p-4 shadow-vault-sm">
              <p className="text-xs uppercase tracking-[0.18em] text-medium-gray">Aporte mensual total</p>
              <p className="mt-2 text-2xl font-semibold text-on-surface">
                ${savingsGoals.reduce((sum, goal) => sum + goal.monthlyContribution, 0).toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-muted-gray">Cuanto piensas meter cada mes entre todas tus metas.</p>
            </Card>
          </div>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          {savingsGoals.length > 0 ? savingsGoals.map((goal) => {
            const progress = goal.targetAmount > 0 ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100)) : 0
            const remainingGoal = Math.max(0, goal.targetAmount - goal.currentAmount)

            return (
              <Card key={goal.id} className="border-graphite bg-surface shadow-vault">
                <div className="border-b border-graphite p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-on-surface">{goal.name}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-medium-gray">
                        {GOAL_CATEGORY_LABELS[goal.category]}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="text-muted-gray hover:text-primary" onClick={() => handleOpenGoal(goal)}>
                        <Pencil data-icon="inline-start" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-muted-gray hover:text-error" onClick={() => void removeSavingsGoal(goal.id)}>
                        <Trash2 data-icon="inline-start" />
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="space-y-4 p-5">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-medium-gray">Guardado</p>
                      <p className="mt-2 text-2xl font-semibold text-on-surface">${goal.currentAmount.toLocaleString()}</p>
                    </div>
                    <Badge variant="secondary" className="bg-surface-container-high text-on-surface">
                      Restan ${remainingGoal.toLocaleString()}
                    </Badge>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-container-highest">
                    <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-abyss p-3 shadow-vault-sm">
                      <p className="text-xs uppercase tracking-[0.16em] text-medium-gray">Meta</p>
                      <p className="mt-2 text-lg font-semibold text-on-surface">${goal.targetAmount.toLocaleString()}</p>
                    </div>
                    <div className="rounded-xl bg-abyss p-3 shadow-vault-sm">
                      <p className="text-xs uppercase tracking-[0.16em] text-medium-gray">Aporte mensual</p>
                      <p className="mt-2 text-lg font-semibold text-success">${goal.monthlyContribution.toLocaleString()}</p>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    disabled={goal.currentAmount <= 0}
                    onClick={() => handleOpenWithdraw(goal)}
                    className="w-full bg-surface-container-high text-on-surface hover:bg-surface-container-higher disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ArrowUpRight className="size-4" /> Sacar de este bolsillo
                  </Button>
                </div>
              </Card>
            )
          }) : (
            <Card className="border-dashed border-graphite bg-surface/80 p-8 shadow-vault md:col-span-2">
              <div className="flex flex-col items-center gap-3 text-center text-sm text-muted-gray">
                <PiggyBank className="size-8 text-primary" />
                <p>Aun no tienes bolsillos de ahorro. Crea metas como emergencia, viaje, renta o teléfono.</p>
              </div>
            </Card>
          )}
        </div>
      </section>

      {savingsList.length === 0 ? (
        <Card className="bg-surface border-0 shadow-vault">
          <div className="flex flex-col items-center gap-3 py-16 text-muted-gray text-sm">
            <PiggyBank className="size-8" />
            <p>Sin ahorros registrados</p>
            <Button variant="secondary" onClick={() => handleOpen()} disabled={budgetFull} className="bg-surface-container-high text-on-surface disabled:opacity-40 disabled:cursor-not-allowed">Registrar ahorro</Button>
          </div>
        </Card>
      ) : (
        <div className="bg-surface rounded-xl shadow-vault overflow-hidden">
          <div className="hidden md:grid grid-cols-[1fr_100px_80px] gap-4 p-4 border-b border-graphite bg-surface-container-lowest text-xs text-muted-gray uppercase tracking-wider font-semibold">
            <span>Fecha</span>
            <span className="text-right">Monto</span>
            <span className="text-right">Acción</span>
          </div>
          <div className="divide-y divide-graphite">
            {savingsList.map((transaction) => (
              <div key={transaction.id} className="group grid grid-cols-1 gap-3 p-4 transition-colors hover:bg-surface-container-low md:grid-cols-[1fr_100px_80px] md:gap-4 md:items-center">
                <div>
                  <p className="text-sm font-medium text-on-surface">
                    {(() => {
                      const savingDetails = parseSavingDescription(transaction.description)
                      if (savingDetails.kind === 'withdrawal') {
                        const baseLabel = savingDetails.target === 'want'
                          ? 'Retirado hacia gustos'
                          : savingDetails.target === 'purpose'
                            ? 'Pagado para un proposito'
                            : 'Retirado hacia gastos'
                        const detail = savingDetails.label ? `${baseLabel}: ${savingDetails.label}` : baseLabel
                        return savingDetails.sourceGoalName ? `${detail} desde ${savingDetails.sourceGoalName}` : detail
                      }
                      if (savingDetails.kind !== 'transfer') return 'Ahorro registrado'
                      return savingDetails.source === 'want' ? 'Transferido desde gustos' : 'Transferido desde gastos'
                    })()}
                  </p>
                  <p className="text-xs text-muted-gray">{transaction.date}</p>
                </div>
                <span className={`text-sm font-medium md:text-right ${transaction.amount >= 0 ? 'text-success' : 'text-error'}`}>
                  {transaction.amount >= 0 ? '+' : '-'}${Math.abs(transaction.amount).toLocaleString()}
                </span>
                <div className="opacity-100 transition-opacity md:text-right md:opacity-0 md:group-hover:opacity-100">
                  <div className="flex justify-end gap-1">
                    {(() => {
                      const savingDetails = parseSavingDescription(transaction.description)
                      return savingDetails.kind === 'manual' && transaction.amount >= 0 ? (
                        <Button variant="ghost" size="icon" className="text-muted-gray hover:text-primary" onClick={() => handleOpen(transaction)}>
                          <Pencil data-icon="inline-start" />
                        </Button>
                      ) : null
                    })()}
                    <Button variant="ghost" size="icon" className="text-muted-gray hover:text-error" onClick={() => void removeTransaction(transaction.id)}>
                      <Trash2 data-icon="inline-start" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={(nextOpen) => { if (!isSaving) setOpen(nextOpen) }}>
        <DialogContent className="border-graphite bg-surface sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-on-surface">{editId ? 'Editar ahorro' : 'Agregar ahorro'}</DialogTitle>
            <DialogDescription>Guarda el monto y la fecha del movimiento.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-medium-gray">Monto</Label>
              <Input type="number" placeholder="500" value={form.amount} onChange={(e) => { setFormError(null); setForm({ ...form, amount: e.target.value }) }} className="bg-abyss border-graphite text-on-surface" />
              {!editId && remaining > 0 && (
                <p className="text-xs text-muted-gray">Disponible para ahorrar: ${Math.max(0, remaining).toLocaleString()}</p>
              )}
            </div>
            <DatePickerField
              label="Fecha"
              value={form.date}
              onChange={(value) => { setFormError(null); setForm({ ...form, date: value }) }}
              description="Elige cuando entro realmente ese aporte al ahorro."
            />
            {formError ? <p className="text-sm text-error">{formError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="ghost" disabled={isSaving} onClick={() => { resetForm(); setOpen(false) }} className="text-muted-gray">Cancelar</Button>
            <Button loading={isSaving} onClick={() => void handleSave()} className="bg-primary-container text-white hover:bg-primary-container/80 shadow-vault">Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={withdrawOpen} onOpenChange={(nextOpen) => { if (!isWithdrawing) setWithdrawOpen(nextOpen) }}>
        <DialogContent className="border-graphite bg-surface sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-on-surface">Sacar dinero de ahorros</DialogTitle>
            <DialogDescription>
              Usa esta opcion cuando necesites sacar dinero guardado para un gasto, un gusto o un proposito puntual.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-medium-gray">Monto</Label>
                <Input
                  type="number"
                  placeholder="80"
                  value={withdrawForm.amount}
                  onChange={(e) => {
                    setWithdrawError(null)
                    setWithdrawForm((current) => ({ ...current, amount: e.target.value }))
                  }}
                  className="bg-abyss border-graphite text-on-surface"
                />
                <p className="text-xs text-muted-gray">
                  Disponible: ${availableWithdrawAmount.toLocaleString()}
                  {selectedSourceGoal ? ` en ${selectedSourceGoal.name}` : ' en ahorro total'}
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-medium-gray">Pasarlo a</Label>
                <Select
                  value={withdrawForm.target}
                  onValueChange={(value) => {
                    setWithdrawError(null)
                    setWithdrawForm((current) => ({ ...current, target: value as 'expense' | 'want' | 'purpose' }))
                  }}
                >
                  <SelectTrigger className="bg-abyss border-graphite text-on-surface">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-graphite bg-surface">
                    <SelectItem value="purpose">Proposito</SelectItem>
                    <SelectItem value="expense">Gasto</SelectItem>
                    <SelectItem value="want">Gusto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedSourceGoal ? (
              <Card className="border-graphite bg-abyss p-4 shadow-vault-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-medium-gray">Bolsillo origen</p>
                <p className="mt-2 text-lg font-semibold text-on-surface">{selectedSourceGoal.name}</p>
                <p className="mt-1 text-xs text-muted-gray">
                  Al guardar, tambien se descontara este monto del bolsillo.
                </p>
              </Card>
            ) : null}

            <div className="space-y-2">
              <Label className="text-medium-gray">Concepto</Label>
              <Input
                placeholder={
                  withdrawForm.target === 'expense'
                    ? 'Emergencia, medicina, reparacion...'
                    : withdrawForm.target === 'want'
                      ? 'Salida, capricho, compra...'
                      : 'Caja reguladora, tramite, pieza, objetivo pagado...'
                }
                value={withdrawForm.itemName}
                onChange={(e) => {
                  setWithdrawError(null)
                  setWithdrawForm((current) => ({ ...current, itemName: e.target.value }))
                }}
                className="bg-abyss border-graphite text-on-surface"
              />
            </div>

            <DatePickerField
              label="Fecha"
              value={withdrawForm.date}
              onChange={(value) => {
                setWithdrawError(null)
                setWithdrawForm((current) => ({ ...current, date: value }))
              }}
              description={
                withdrawForm.target === 'purpose'
                  ? 'La fecha se guarda en la salida del ahorro para dejar constancia del pago realizado.'
                  : 'La misma fecha se usa para la salida del ahorro y para el movimiento destino.'
              }
            />
            {withdrawError ? <p className="text-sm text-error">{withdrawError}</p> : null}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              disabled={isWithdrawing}
              onClick={() => {
                resetWithdrawForm()
                setWithdrawOpen(false)
              }}
              className="text-muted-gray"
            >
              Cancelar
            </Button>
            <Button
              loading={isWithdrawing}
              disabled={isWithdrawing || availableSavings <= 0}
              onClick={() => void handleWithdraw()}
              className="bg-primary-container text-white hover:bg-primary-container/80 shadow-vault"
            >
              Sacar dinero
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={goalOpen} onOpenChange={(nextOpen) => { if (!isGoalSaving) setGoalOpen(nextOpen) }}>
        <DialogContent className="border-graphite bg-surface sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-on-surface">{goalEditId ? 'Editar meta' : 'Crear meta de ahorro'}</DialogTitle>
            <DialogDescription>
              Define el bolsillo, el monto objetivo, cuanto ya tiene guardado y el aporte mensual que quieres sostener.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-medium-gray">Nombre</Label>
                <Input
                  placeholder="Fondo de emergencia"
                  value={goalForm.name}
                  onChange={(e) => {
                    setGoalError(null)
                    setGoalForm((current) => ({ ...current, name: e.target.value }))
                  }}
                  className="bg-abyss border-graphite text-on-surface"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-medium-gray">Categoria</Label>
                <Select
                  value={goalForm.category}
                  onValueChange={(value) => {
                    setGoalError(null)
                    setGoalForm((current) => ({ ...current, category: value as typeof current.category }))
                  }}
                >
                  <SelectTrigger className="bg-abyss border-graphite text-on-surface">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-graphite bg-surface">
                    <SelectItem value="emergency">Emergencia</SelectItem>
                    <SelectItem value="travel">Viaje</SelectItem>
                    <SelectItem value="rent">Renta</SelectItem>
                    <SelectItem value="phone">Teléfono</SelectItem>
                    <SelectItem value="custom">Personalizada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-medium-gray">Monto objetivo</Label>
                <Input
                  type="number"
                  value={goalForm.targetAmount}
                  onChange={(e) => {
                    setGoalError(null)
                    setGoalForm((current) => ({ ...current, targetAmount: e.target.value }))
                  }}
                  className="bg-abyss border-graphite text-on-surface"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-medium-gray">Monto actual</Label>
                <Input
                  type="number"
                  value={goalForm.currentAmount}
                  onChange={(e) => {
                    setGoalError(null)
                    setGoalForm((current) => ({ ...current, currentAmount: e.target.value }))
                  }}
                  className="bg-abyss border-graphite text-on-surface"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-medium-gray">Aporte mensual</Label>
                <Input
                  type="number"
                  value={goalForm.monthlyContribution}
                  onChange={(e) => {
                    setGoalError(null)
                    setGoalForm((current) => ({ ...current, monthlyContribution: e.target.value }))
                  }}
                  className="bg-abyss border-graphite text-on-surface"
                />
              </div>
            </div>

            <Card className="border-graphite bg-abyss p-4 shadow-vault-sm">
              <p className="text-xs uppercase tracking-[0.18em] text-medium-gray">Ahorro libre actual</p>
              <p className="mt-2 text-lg font-semibold text-on-surface">${freeSavings.toLocaleString()}</p>
              <p className="mt-1 text-xs text-muted-gray">
                Si editas una meta, se te permite reutilizar tambien lo que ya tiene asignado esa meta.
              </p>
            </Card>
            {goalError ? <p className="text-sm text-error">{goalError}</p> : null}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              disabled={isGoalSaving}
              onClick={() => {
                resetGoalForm()
                setGoalOpen(false)
              }}
              className="text-muted-gray"
            >
              Cancelar
            </Button>
            <Button
              loading={isGoalSaving}
              onClick={() => void handleSaveGoal()}
              className="bg-primary-container text-white hover:bg-primary-container/80 shadow-vault"
            >
              Guardar meta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
