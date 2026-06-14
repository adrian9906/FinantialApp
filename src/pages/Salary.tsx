import { useState } from 'react'
import { useFinanceStore } from '@/store/financeStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Plus, Pencil, Trash2, Wallet, Receipt } from 'lucide-react'

export default function Salary() {
  const { salaries, addSalary, updateSalary, removeSalary } = useFinanceStore()
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [month, setMonth] = useState('')

  const latestSalary = salaries.length > 0
    ? salaries.reduce((max, s) => new Date(s.month) > new Date(max.month) ? s : max)
    : null

  function resetForm() {
    setAmount(''); setMonth(''); setEditId(null)
  }

  function handleOpen(entry?: typeof salaries[0]) {
    if (entry) {
      setEditId(entry.id); setAmount(String(entry.amount)); setMonth(entry.month)
    } else { resetForm() }
    setOpen(true)
  }

  function handleSave() {
    if (!amount || !month) return
    if (editId) {
      updateSalary(editId, { amount: Number(amount), month })
    } else {
      addSalary({ id: '', amount: Number(amount), month, received: true })
    }
    resetForm(); setOpen(false)
  }

  const half = latestSalary ? latestSalary.amount * 0.5 : 0
  const quarter = latestSalary ? latestSalary.amount * 0.25 : 0

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col gap-1">
        <h1 className="text-[28px] md:text-[36px] font-semibold text-on-surface tracking-tight">
          Income Matrix
        </h1>
        <p className="text-sm text-muted-gray max-w-2xl">
          Distribuye tu capital entre obligaciones fijas, gastos variables y ahorro estructurado.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <section className="lg:col-span-5 flex flex-col gap-4 bg-surface rounded-xl p-6 shadow-vault">
          <div className="flex justify-between items-center pb-3 border-b border-graphite">
            <h3 className="text-lg font-semibold text-on-surface flex items-center gap-2">
              <Wallet className="size-8 text-primary" />
              Monthly Inflow
            </h3>
            <Button variant="ghost" size="sm" onClick={() => handleOpen()} className="text-primary-container hover:text-white">
              <Plus className="size-4" />
              {salaries.length > 0 ? 'Update' : 'Add'}
            </Button>
          </div>

          {latestSalary ? (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-medium-gray uppercase tracking-widest">Net Salary</label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-muted-gray text-lg">$</span>
                  <input
                    className="w-full bg-abyss border border-graphite rounded-lg py-2.5 pl-8 pr-3 text-on-surface text-lg font-medium focus:border-tertiary-container focus:ring-1 focus:ring-tertiary-container transition-all outline-none"
                    type="text"
                    value={latestSalary.amount.toLocaleString()}
                    readOnly
                  />
                </div>
                <p className="text-xs text-muted-gray mt-1">{latestSalary.month}</p>
              </div>

              <div className="flex flex-col gap-2 bg-abyss rounded-lg p-4 shadow-vault-sm">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-gray">50% Needs</span>
                  <span className="text-base font-semibold text-primary-fixed">${half.toLocaleString()}</span>
                </div>
                <div className="w-full h-1 bg-graphite rounded-full overflow-hidden">
                  <div className="h-full bg-primary w-1/2 rounded-full" />
                </div>
                <div className="flex justify-between items-center text-sm mt-1">
                  <span className="text-muted-gray">25% Wants</span>
                  <span className="text-base font-semibold text-secondary">${quarter.toLocaleString()}</span>
                </div>
                <div className="w-full h-1 bg-graphite rounded-full overflow-hidden">
                  <div className="h-full bg-secondary w-1/4 rounded-full" />
                </div>
                <div className="flex justify-between items-center text-sm mt-1">
                  <span className="text-muted-gray">25% Savings</span>
                  <span className="text-base font-semibold text-tertiary-container">${quarter.toLocaleString()}</span>
                </div>
                <div className="w-full h-1 bg-graphite rounded-full overflow-hidden">
                  <div className="h-full bg-tertiary-container w-1/4 rounded-full" />
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center py-10 text-muted-gray text-sm gap-3">
              <Wallet className="size-8" />
              <p>No hay salario registrado</p>
              <Button variant="secondary" size="sm" onClick={() => handleOpen()}>
                <Plus className="size-4" /> Add Salary
              </Button>
            </div>
          )}
        </section>

        <section className="lg:col-span-7 flex flex-col gap-4 bg-surface rounded-xl p-6 shadow-vault">
          <div className="flex justify-between items-center pb-3 border-b border-graphite">
            <h3 className="text-lg font-semibold text-on-surface flex items-center gap-2">
              <Receipt className="size-8 text-secondary" />
              Salary History
            </h3>
          </div>
          {salaries.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-muted-gray text-sm">
              <p>No salary records</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 overflow-y-auto max-h-[350px] pr-1">
              {salaries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between p-3 bg-abyss rounded-lg border border-graphite group hover:border-outline-variant transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-lg bg-surface-container flex items-center justify-center text-muted-gray shadow-vault-sm">
                      <Wallet className="size-4" />
                    </div>
                    <div>
                      <p className="text-base font-medium text-on-surface">
                        ${entry.amount.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-gray">{entry.month}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-1.5 text-muted-gray hover:text-primary transition-colors" onClick={() => handleOpen(entry)}>
                      <Pencil className="size-4" />
                    </button>
                    <button className="p-1.5 text-muted-gray hover:text-error transition-colors" onClick={() => removeSalary(entry.id)}>
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-surface border-graphite">
          <DialogHeader>
            <DialogTitle className="text-on-surface">{editId ? 'Edit Salary' : 'Add Salary'}</DialogTitle>
            <DialogDescription>Enter your monthly income details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount" className="text-medium-gray">Amount</Label>
              <Input id="amount" type="number" placeholder="5000" value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-abyss border-graphite text-on-surface focus:border-tertiary-container" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="month" className="text-medium-gray">Month</Label>
              <Input id="month" type="month" value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="bg-abyss border-graphite text-on-surface focus:border-tertiary-container" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} className="text-muted-gray">Cancel</Button>
            <Button onClick={handleSave} className="bg-primary-container text-white hover:brightness-110 shadow-vault">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
