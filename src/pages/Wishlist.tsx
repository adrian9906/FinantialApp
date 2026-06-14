import { useState } from 'react'
import { useFinanceStore } from '@/store/financeStore'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, ShoppingCart, Zap, Laptop, ShoppingBag, Heart, Lightbulb, ArrowRight } from 'lucide-react'

interface FormState { name: string; price: string; priority: string; savedAmount: string; url: string; notes: string }

export default function Wishlist() {
  const { wishlist, addWishlistItem, updateWishlistItem } = useFinanceStore()
  const [open, setOpen] = useState(false); const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>({ name: '', price: '', priority: 'medium', savedAmount: '0', url: '', notes: '' })

  function resetForm() { setForm({ name: '', price: '', priority: 'medium', savedAmount: '0', url: '', notes: '' }); setEditId(null) }
  function handleOpen(entry?: typeof wishlist[0]) {
    if (entry) { setEditId(entry.id); setForm({ name: entry.name, price: String(entry.price), priority: entry.priority, savedAmount: String(entry.savedAmount), url: entry.url || '', notes: entry.notes || '' }) }
    else { resetForm() }
    setOpen(true)
  }
  function handleSave() {
    if (!form.name || !form.price) return
    const data = { name: form.name, price: Number(form.price), priority: form.priority as 'low' | 'medium' | 'high', savedAmount: Number(form.savedAmount) || 0, url: form.url || undefined, notes: form.notes || undefined }
    if (editId) { updateWishlistItem(editId, data) } else { addWishlistItem(data as any) }
    resetForm(); setOpen(false)
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] md:text-[36px] font-semibold text-on-surface tracking-tight">Wishlist</h1>
          <p className="text-sm text-muted-gray max-w-xl">Visualiza tus metas de compra. Vault calcula tu capacidad de ahorro y proyecta cuándo podrás adquirir estos artículos.</p>
        </div>
        <Button onClick={() => handleOpen()} className="bg-primary-container text-white hover:brightness-110 shadow-vault">
          <Plus className="size-4" /> Add Item
        </Button>
      </header>

      {wishlist.length === 0 ? (
        <Card className="bg-surface border-0 shadow-vault">
          <div className="flex flex-col items-center gap-3 py-16 text-muted-gray text-sm">
            <ShoppingCart className="size-8" />
            <p>Your wishlist is empty</p>
            <Button variant="secondary" onClick={() => handleOpen()} className="bg-surface-container-high text-on-surface">Add your first item</Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 auto-rows-[280px]">
          {wishlist.slice(0, 1).map((item) => {
            const progress = item.price > 0 ? Math.min(100, (item.savedAmount / item.price) * 100) : 0
            return (
              <article key={item.id} className="md:col-span-8 bg-surface rounded-xl shadow-vault overflow-hidden flex flex-col md:flex-row group relative">
                <div className="w-full md:w-1/2 h-48 md:h-full relative overflow-hidden bg-surface-container-lowest">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary-container/20 to-surface-container-lowest" />
                  <div className="absolute top-3 left-3 bg-primary-container/20 backdrop-blur-md px-3 py-1 rounded-full shadow-vault">
                    <span className="text-xs text-primary font-medium flex items-center gap-1">
                      <Zap className="size-3.5" /> Featured
                    </span>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    {item.notes === 'gadget' ? <Laptop className="size-16 text-muted-gray/20" /> : <ShoppingBag className="size-16 text-muted-gray/20" />}
                  </div>
                </div>
                <div className="p-5 flex flex-col flex-1 justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <h2 className="text-lg font-semibold text-on-surface">{item.name}</h2>
                      <button className="p-1 text-muted-gray hover:text-error transition-colors"><Heart className="size-4" /></button>
                    </div>
                    <p className="text-[28px] text-primary font-semibold">${item.price.toLocaleString()}</p>
                  </div>
                  <div className="mt-auto">
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-sm text-muted-gray">Saved: ${item.savedAmount.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden shadow-vault-sm">
                      <div className="h-full bg-primary-container rounded-full shadow-vault-glow relative transition-all duration-700" style={{ width: `${progress}%` }}>
                        <div className="absolute right-0 top-0 bottom-0 w-4 bg-white/30 blur-sm" />
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            )
          })}

          {wishlist.slice(1, 3).map((item) => {
            const progress = item.price > 0 ? Math.min(100, (item.savedAmount / item.price) * 100) : 0
            return (
              <article key={item.id} className={`md:col-span-4 bg-surface rounded-xl shadow-vault p-4 flex flex-col relative overflow-hidden group hover:bg-surface-container-low transition-colors duration-300 ${wishlist.indexOf(item) === 1 ? '' : ''}`}>
                <div className="flex justify-between items-start mb-auto">
                  <div>
                    <div className="size-12 rounded-lg bg-surface-container-highest flex items-center justify-center shadow-vault-sm mb-2">
                      <ShoppingBag className="size-5 text-on-surface" />
                    </div>
                    <h3 className="text-[18px] font-medium text-on-surface">{item.name}</h3>
                    <span className="text-xs text-muted-gray">${item.price.toLocaleString()}</span>
                  </div>
                </div>
                <div className="mt-auto pt-3 border-t border-graphite">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-gray">Remaining: ${(item.price - item.savedAmount).toLocaleString()}</span>
                  </div>
                  <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                    <div className="h-full bg-secondary-container rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              </article>
            )
          })}

          <article className="md:col-span-4 bg-abyss rounded-xl border border-dashed border-graphite flex flex-col items-center justify-center text-center p-4 cursor-pointer hover:border-primary hover:bg-surface transition-all duration-300 group" onClick={() => handleOpen()}>
            <div className="size-12 rounded-full bg-surface-container-high flex items-center justify-center text-muted-gray group-hover:text-primary group-hover:bg-primary/10 transition-colors mb-2 shadow-vault">
              <Plus className="size-6" />
            </div>
            <h3 className="text-[18px] font-medium text-on-surface">Add Item</h3>
            <p className="text-xs text-muted-gray mt-1 max-w-[200px]">Register a new item for Vault to project</p>
          </article>

          <article className="md:col-span-4 bg-tertiary-fixed-dim/10 rounded-xl shadow-[rgba(208,188,255,0.15)_0px_0px_0px_1px_inset] p-4 flex flex-col justify-center">
            <div className="flex items-start gap-2 mb-2">
              <Lightbulb className="size-5 text-tertiary" />
              <h3 className="text-[18px] font-medium text-tertiary">Vault Insight</h3>
            </div>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Si reduces gastos en <span className="text-on-surface font-semibold">"Suscripciones"</span> un 15%, podrías alcanzar tu meta <strong>{wishlist[0]?.name || 'principal'}</strong> más rápido.
            </p>
            <button className="mt-2 text-left text-sm text-tertiary hover:text-white transition-colors flex items-center gap-1">
              Adjust budget <ArrowRight className="size-4 inline" />
            </button>
          </article>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-surface border-graphite max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-on-surface">{editId ? 'Edit Item' : 'Add to Wishlist'}</DialogTitle>
            <DialogDescription>What do you want?</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-medium-gray">Item Name</Label>
              <Input placeholder="New laptop" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="bg-abyss border-graphite text-on-surface" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-medium-gray">Price</Label>
                <Input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className="bg-abyss border-graphite text-on-surface" />
              </div>
              <div className="space-y-2">
                <Label className="text-medium-gray">Saved So Far</Label>
                <Input type="number" value={form.savedAmount} onChange={e => setForm({ ...form, savedAmount: e.target.value })} className="bg-abyss border-graphite text-on-surface" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-medium-gray">Priority</Label>
              <Select value={form.priority} onValueChange={(v: string | null) => setForm({ ...form, priority: v ?? 'medium' })}>
                <SelectTrigger className="bg-abyss border-graphite text-on-surface">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-surface border-graphite">
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-medium-gray">URL (optional)</Label>
              <Input placeholder="https://..." value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} className="bg-abyss border-graphite text-on-surface" />
            </div>
            <div className="space-y-2">
              <Label className="text-medium-gray">Notes (optional)</Label>
              <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="bg-abyss border-graphite text-on-surface" />
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
