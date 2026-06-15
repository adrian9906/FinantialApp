import { useState } from 'react'
import { useFinanceStore } from '@/store/financeStore'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, ShoppingCart, Pencil, Trash2, ArrowRight } from 'lucide-react'

interface FormState {
  name: string
  price: string
  priority: 'low' | 'medium' | 'high'
  savedAmount: string
  url: string
}

export default function Wishlist() {
  const { wishlist, addWishlistItem, updateWishlistItem, removeWishlistItem } = useFinanceStore()
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>({
    name: '',
    price: '',
    priority: 'medium',
    savedAmount: '0',
    url: '',
  })

  function resetForm() {
    setForm({
      name: '',
      price: '',
      priority: 'medium',
      savedAmount: '0',
      url: '',
    })
    setEditId(null)
  }

  function handleOpen(entry?: typeof wishlist[number]) {
    if (entry) {
      setEditId(entry.id)
      setForm({
        name: entry.name,
        price: String(entry.price),
        priority: entry.priority,
        savedAmount: String(entry.savedAmount),
        url: entry.url ?? '',
      })
    } else {
      resetForm()
    }
    setOpen(true)
  }

  async function handleSave() {
    if (!form.name || !form.price) return
    const data = {
      name: form.name,
      price: Number(form.price),
      priority: form.priority,
      savedAmount: Number(form.savedAmount) || 0,
      url: form.url || undefined,
    }
    if (editId) {
      await updateWishlistItem(editId, data)
    } else {
      await addWishlistItem(data)
    }
    resetForm()
    setOpen(false)
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] md:text-[36px] font-semibold text-on-surface tracking-tight">Deseos</h1>
          <p className="text-sm text-muted-gray max-w-xl">Cada tarjeta corresponde a un `Deseo` y su primer `DeseoItem` en Prisma.</p>
        </div>
        <Button onClick={() => handleOpen()} className="bg-primary-container text-white hover:brightness-110 shadow-vault">
          <Plus className="size-4" /> Agregar artículo
        </Button>
      </header>

      {wishlist.length === 0 ? (
        <Card className="bg-surface border-0 shadow-vault">
          <div className="flex flex-col items-center gap-3 py-16 text-muted-gray text-sm">
            <ShoppingCart className="size-8" />
            <p>Tu lista de deseos está vacía</p>
            <Button variant="secondary" onClick={() => handleOpen()} className="bg-surface-container-high text-on-surface">Agrega tu primer artículo</Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {wishlist.map((item) => {
            const progress = item.price > 0 ? Math.min(100, (item.savedAmount / item.price) * 100) : 0
            const remaining = Math.max(0, item.price - item.savedAmount)
            return (
              <article key={item.id} className="bg-surface rounded-xl shadow-vault p-5 flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Badge variant="secondary" className="mb-1 bg-surface-container-high text-muted-gray">
                      Prioridad {item.priority === 'high' ? 'alta' : item.priority === 'low' ? 'baja' : 'media'}
                    </Badge>
                    <h2 className="text-xl font-semibold text-on-surface">{item.name}</h2>
                    <p className="text-sm text-primary mt-1">${item.price.toLocaleString()}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="text-muted-gray hover:text-primary" onClick={() => handleOpen(item)}>
                      <Pencil data-icon="inline-start" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-muted-gray hover:text-error" onClick={() => void removeWishlistItem(item.id)}>
                      <Trash2 data-icon="inline-start" />
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl bg-abyss border border-graphite p-4">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted-gray">Ahorrado</span>
                    <span className="text-on-surface font-medium">${item.savedAmount.toLocaleString()}</span>
                  </div>
                  <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-xs mt-2 text-muted-gray">
                    <span>{Math.round(progress)}% completado</span>
                    <span>Restan ${remaining.toLocaleString()}</span>
                  </div>
                </div>

                {item.url ? (
                  <a className="text-sm text-primary hover:text-primary-fixed transition-colors inline-flex items-center gap-1" href={item.url} target="_blank" rel="noreferrer">
                    Ver referencia <ArrowRight className="size-4" />
                  </a>
                ) : (
                  <p className="text-xs text-muted-gray">Sin enlace de referencia</p>
                )}
              </article>
            )
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto border-graphite bg-surface sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-on-surface">{editId ? 'Editar artículo' : 'Agregar deseo'}</DialogTitle>
            <DialogDescription>Completa solo los campos soportados por el schema actual.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-medium-gray">Nombre del artículo</Label>
              <Input placeholder="Laptop nueva" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-abyss border-graphite text-on-surface" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-medium-gray">Precio</Label>
                <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="bg-abyss border-graphite text-on-surface" />
              </div>
              <div className="space-y-2">
                <Label className="text-medium-gray">Ahorrado</Label>
                <Input type="number" value={form.savedAmount} onChange={(e) => setForm({ ...form, savedAmount: e.target.value })} className="bg-abyss border-graphite text-on-surface" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-medium-gray">Prioridad</Label>
              <Select value={form.priority} onValueChange={(value) => setForm({ ...form, priority: value as FormState['priority'] })}>
                <SelectTrigger className="bg-abyss border-graphite text-on-surface">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-surface border-graphite">
                  <SelectItem value="low">Baja</SelectItem>
                  <SelectItem value="medium">Media</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-medium-gray">URL (opcional)</Label>
              <Input placeholder="https://..." value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className="bg-abyss border-graphite text-on-surface" />
            </div>
            <Card className="border-graphite bg-abyss p-4 shadow-vault-sm">
              <p className="text-xs uppercase tracking-[0.22em] text-medium-gray">Resumen del deseo</p>
              <p className="mt-2 text-lg font-semibold text-on-surface">{form.name || 'Articulo sin nombre'}</p>
              <p className="mt-1 text-sm text-muted-gray">
                {form.price
                  ? `Meta: $${Number(form.price).toLocaleString()}`
                  : 'Agrega precio y progreso para ver mejor la meta de compra.'}
              </p>
              <p className="mt-1 text-sm text-muted-gray">
                {form.savedAmount ? `Ahorrado: $${Number(form.savedAmount).toLocaleString()}` : 'Aun no hay ahorro asociado.'}
              </p>
            </Card>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { resetForm(); setOpen(false) }} className="text-muted-gray">Cancelar</Button>
            <Button onClick={() => void handleSave()} className="bg-primary-container text-white hover:brightness-110 shadow-vault">Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
