import { useState } from 'react'
import { useFinanceStore } from '@/store/financeStore'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, Calendar, Wallet, CalendarDays, Timer, Search, BarChart3 } from 'lucide-react'

interface FormState { name: string; date: string; budget: string; spent: string }

export default function Events() {
  const { events, addEvent, updateEvent, removeEvent } = useFinanceStore()
  const [open, setOpen] = useState(false); const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>({ name: '', date: '', budget: '', spent: '' })

  function resetForm() { setForm({ name: '', date: '', budget: '', spent: '' }); setEditId(null) }
  function handleOpen(entry?: typeof events[0]) {
    if (entry) { setEditId(entry.id); setForm({ name: entry.name, date: entry.date, budget: String(entry.budget), spent: String(entry.spent) }) }
    else { resetForm() }
    setOpen(true)
  }
  function handleSave() {
    if (!form.name) return
    const data = { name: form.name, date: form.date, budget: Number(form.budget) || 0, spent: Number(form.spent) || 0 }
    if (editId) { updateEvent(editId, data) } else { addEvent(data as any) }
    resetForm(); setOpen(false)
  }

  const overview = {
    totalReserved: events.reduce((s, e) => s + e.budget, 0),
    activeEvents: events.length,
    nearestEvent: events.length > 0
      ? events.filter(e => e.date).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0]
      : null,
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] md:text-[36px] font-semibold text-on-surface tracking-tight">Event Budgets</h1>
          <p className="text-sm text-muted-gray">Manage funding and track expenses for future milestones.</p>
        </div>
        <Button onClick={() => handleOpen()} className="bg-surface text-on-surface hover:bg-surface-container-high shadow-vault border border-graphite">
          <Plus className="size-4" /> New Event
        </Button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface rounded-xl p-5 shadow-vault flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between text-muted-gray mb-2">
            <span className="text-base font-medium">Total Reserved</span>
            <Wallet className="size-5 text-primary" />
          </div>
          <div>
            <div className="text-[28px] font-semibold text-on-surface">${overview.totalReserved.toLocaleString()}</div>
          </div>
        </div>
        <div className="bg-surface rounded-xl p-5 shadow-vault flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between text-muted-gray mb-2">
            <span className="text-base font-medium">Active Events</span>
            <CalendarDays className="size-5 text-primary" />
          </div>
          <div>
            <div className="text-[28px] font-semibold text-on-surface">{overview.activeEvents}</div>
          </div>
        </div>
        <div className="bg-surface rounded-xl p-5 shadow-vault flex flex-col justify-between min-h-[120px] relative overflow-hidden">
          <div className="absolute right-0 top-0 w-32 h-32 bg-primary-container opacity-10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
          <div className="flex items-center justify-between text-muted-gray mb-2 relative z-10">
            <span className="text-base font-medium">Nearest Event</span>
            <Timer className="size-5 text-warning" />
          </div>
          <div className="relative z-10">
            <div className="text-lg font-semibold text-on-surface truncate">{overview.nearestEvent?.name || 'N/A'}</div>
            {overview.nearestEvent?.date && (
              <div className="text-xs text-muted-gray mt-1">
                {Math.ceil((new Date(overview.nearestEvent.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days remaining
              </div>
            )}
          </div>
        </div>
      </div>

      {events.length === 0 ? (
        <Card className="bg-surface border-0 shadow-vault">
          <div className="flex flex-col items-center gap-3 py-16 text-muted-gray text-sm">
            <Calendar className="size-8" />
            <p>No events planned</p>
            <Button variant="secondary" onClick={() => handleOpen()} className="bg-surface-container-high text-on-surface">Plan an event</Button>
          </div>
        </Card>
      ) : (
        <>
          <div className="bg-surface rounded-xl shadow-vault overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-graphite bg-surface-container-low">
              <div className="relative w-full max-w-xs">
                <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-gray" />
                <input className="w-full bg-abyss border border-graphite text-on-surface text-sm rounded-lg pl-9 pr-3 py-1.5 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors placeholder:text-muted-gray"
                  placeholder="Filter events..." type="text" />
              </div>
            </div>

            <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_2fr_0.5fr] gap-4 p-4 border-b border-graphite bg-surface-container-lowest text-xs text-muted-gray uppercase tracking-wider font-semibold">
              <span>Event & Date</span><span className="text-right">Target Budget</span><span className="text-right">Funded</span><span>Funding Progress</span><span className="text-right">Actions</span>
            </div>

            <div className="divide-y divide-graphite">
              {events.map((e) => {
                const progress = e.budget > 0 ? Math.min(100, Math.round((e.spent / e.budget) * 100)) : 0
                return (
                  <div key={e.id} className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_2fr_0.5fr] gap-2 md:gap-4 p-4 hover:bg-surface-container-low transition-colors items-start md:items-center group">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-lg bg-surface-bright flex items-center justify-center border border-graphite shadow-vault-sm">
                        <CalendarDays className="size-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-medium text-on-surface truncate">{e.name}</h3>
                        {e.date && <p className="text-xs text-muted-gray flex items-center gap-1">{e.date}</p>}
                      </div>
                    </div>
                    <div className="flex justify-between md:block md:text-right">
                      <span className="md:hidden text-xs text-muted-gray">Target:</span>
                      <span className="text-sm text-on-surface">${e.budget.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between md:block md:text-right">
                      <span className="md:hidden text-xs text-muted-gray">Funded:</span>
                      <span className="text-sm text-on-surface">${e.spent.toLocaleString()}</span>
                    </div>
                    <div className="w-full flex flex-col gap-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-primary">{progress}%</span>
                        <span className="text-muted-gray">Remaining: ${Math.max(0, e.budget - e.spent).toLocaleString()}</span>
                      </div>
                      <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1 text-muted-gray hover:text-primary" onClick={() => handleOpen(e)}><Pencil className="size-4" /></button>
                      <button className="p-1 text-muted-gray hover:text-error" onClick={() => removeEvent(e.id)}><Trash2 className="size-4" /></button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {events.length > 0 && (
            <div className="flex flex-col gap-4">
              <h3 className="text-lg font-semibold text-on-surface flex items-center gap-2">
                <BarChart3 className="size-5 text-primary" />
                Expense Breakdown: {overview.nearestEvent?.name || events[0]?.name}
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 bg-surface rounded-xl p-4 shadow-vault">
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-graphite">
                    <span className="text-sm text-muted-gray font-medium">Allocated Funds</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low hover:bg-surface-container-high transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-8 bg-secondary rounded-sm" />
                        <div><div className="text-sm text-on-surface">Budget Allocated</div><div className="text-xs text-muted-gray">Total event budget</div></div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-on-surface">${events[0]?.budget.toLocaleString() || 0}</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low hover:bg-surface-container-high transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-8 bg-tertiary rounded-sm" />
                        <div><div className="text-sm text-on-surface">Spent So Far</div><div className="text-xs text-muted-gray">Current expenses</div></div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-on-surface">${events[0]?.spent.toLocaleString() || 0}</div>
                        <div className="text-xs text-success">Partially spent</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low hover:bg-surface-container-high transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-8 bg-primary-container rounded-sm" />
                        <div><div className="text-sm text-on-surface">Remaining</div><div className="text-xs text-muted-gray">Unallocated funds</div></div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-on-surface">${Math.max(0, (events[0]?.budget || 0) - (events[0]?.spent || 0)).toLocaleString()}</div>
                        <div className="text-xs text-muted-gray">Unspent</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-abyss border border-graphite rounded-xl p-4 flex flex-col justify-center items-center text-center relative overflow-hidden">
                  <div className="absolute inset-0 opacity-5"
                    style={{
                      backgroundImage: 'repeating-linear-gradient(45deg, #3f3f3f 25%, transparent 25%, transparent 75%, #3f3f3f 75%, #3f3f3f), repeating-linear-gradient(45deg, #3f3f3f 25%, #131313 25%, #131313 75%, #3f3f3f 75%, #3f3f3f)',
                      backgroundPosition: '0 0, 10px 10px',
                      backgroundSize: '20px 20px',
                    }} />
                  <div className="relative z-10 w-full flex flex-col items-center">
                    <div className="size-24 rounded-full border-4 border-surface-container-high flex items-center justify-center mb-3 relative">
                      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" fill="none" r="46" stroke="#201f1f" strokeWidth="8" />
                        <circle cx="50" cy="50" fill="none" r="46" stroke="#d2bbff" strokeDasharray="289" strokeDashoffset="104" strokeLinecap="round" strokeWidth="8" />
                      </svg>
                      <span className="text-lg font-semibold text-on-surface">
                        {events[0] && events[0].budget > 0 ? Math.round((events[0].spent / events[0].budget) * 100) : 0}%
                      </span>
                    </div>
                    <h4 className="text-base font-medium text-on-surface mb-1">On Track</h4>
                    <p className="text-xs text-muted-gray px-4">
                      Save approx <strong className="text-primary">${events[0] && events[0].budget > events[0].spent ? Math.ceil((events[0].budget - events[0].spent) / 3) : 0}/mo</strong> to hit target.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-surface border-graphite">
          <DialogHeader>
            <DialogTitle className="text-on-surface">{editId ? 'Edit Event' : 'Add Event'}</DialogTitle>
            <DialogDescription>Plan your event budget</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-medium-gray">Event Name</Label>
              <Input placeholder="Vacation" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="bg-abyss border-graphite text-on-surface" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-medium-gray">Date</Label>
                <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="bg-abyss border-graphite text-on-surface" />
              </div>
              <div className="space-y-2">
                <Label className="text-medium-gray">Budget</Label>
                <Input type="number" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} className="bg-abyss border-graphite text-on-surface" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-medium-gray">Already Spent</Label>
              <Input type="number" value={form.spent} onChange={e => setForm({ ...form, spent: e.target.value })} className="bg-abyss border-graphite text-on-surface" />
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
