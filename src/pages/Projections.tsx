import { useState } from 'react'
import { useFinanceStore } from '@/store/financeStore'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { TrendingUp, PlusCircle, Pencil, Trash2, Target } from 'lucide-react'

export default function Projections() {
  const { projections, salaries, addProjection, updateProjection, removeProjection } = useFinanceStore()
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [targetSalary, setTargetSalary] = useState('')

  const latestSalary = salaries.length > 0
    ? salaries.reduce((max, salary) => new Date(salary.month) > new Date(max.month) ? salary : max)
    : null

  function resetForm() {
    setTargetSalary('')
    setEditId(null)
  }

  function handleOpen(entry?: typeof projections[number]) {
    if (entry) {
      setEditId(entry.id)
      setTargetSalary(String(entry.targetSalary))
    } else {
      resetForm()
    }
    setOpen(true)
  }

  async function handleSave() {
    if (!targetSalary) return
    const payload = { targetSalary: Number(targetSalary) }
    if (editId) {
      await updateProjection(editId, payload)
    } else {
      await addProjection(payload)
    }
    resetForm()
    setOpen(false)
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] md:text-[36px] font-semibold text-on-surface tracking-tight">Proyecciones</h1>
          <p className="text-sm text-muted-gray">CRUD directo del modelo `Proyeccion` usando `salarioMeta`.</p>
        </div>
        <Button onClick={() => handleOpen()} className="bg-primary-container text-white hover:brightness-110 shadow-vault">
          <PlusCircle className="size-4" /> Nueva proyección
        </Button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-surface rounded-xl p-5 shadow-vault">
          <div className="flex items-center justify-between mb-2 text-muted-gray">
            <span className="text-base font-medium">Salario actual</span>
            <TrendingUp className="size-5 text-primary" />
          </div>
          <div className="text-[28px] font-semibold text-on-surface">${latestSalary?.amount.toLocaleString() ?? '0'}</div>
          <p className="text-xs text-muted-gray mt-1">{latestSalary?.month ?? 'Sin salario base'}</p>
        </div>
        <div className="bg-surface rounded-xl p-5 shadow-vault">
          <div className="flex items-center justify-between mb-2 text-muted-gray">
            <span className="text-base font-medium">Proyecciones guardadas</span>
            <Target className="size-5 text-primary" />
          </div>
          <div className="text-[28px] font-semibold text-on-surface">{projections.length}</div>
        </div>
        <div className="bg-surface rounded-xl p-5 shadow-vault">
          <div className="flex items-center justify-between mb-2 text-muted-gray">
            <span className="text-base font-medium">Meta más alta</span>
            <Target className="size-5 text-primary" />
          </div>
          <div className="text-[28px] font-semibold text-on-surface">
            ${Math.max(0, ...projections.map((projection) => projection.targetSalary)).toLocaleString()}
          </div>
        </div>
      </div>

      {projections.length === 0 ? (
        <Card className="bg-surface border-0 shadow-vault">
          <div className="flex flex-col items-center gap-3 py-16 text-muted-gray text-sm">
            <TrendingUp className="size-8" />
            <p>Sin proyecciones guardadas</p>
            <Button variant="secondary" className="bg-surface-container-high text-on-surface" onClick={() => handleOpen()}>
              Crear una proyección
            </Button>
          </div>
        </Card>
      ) : (
        <div className="bg-surface rounded-xl shadow-vault overflow-hidden">
          <div className="hidden md:grid grid-cols-[1fr_1fr_1fr_80px] gap-4 p-4 border-b border-graphite bg-surface-container-lowest text-xs text-muted-gray uppercase tracking-wider font-semibold">
            <span>Salario meta</span>
            <span>Diferencia</span>
            <span>Estado</span>
            <span className="text-right">Acción</span>
          </div>
          <div className="divide-y divide-graphite">
            {projections.map((projection) => {
              const gap = projection.targetSalary - (latestSalary?.amount ?? 0)
              const reached = gap <= 0
              return (
                <div key={projection.id} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_80px] gap-3 md:gap-4 p-4 hover:bg-surface-container-low transition-colors items-center group">
                  <div className="text-sm font-medium text-on-surface">${projection.targetSalary.toLocaleString()}</div>
                  <div className={`text-sm ${gap > 0 ? 'text-warning' : 'text-success'}`}>
                    {gap > 0 ? `Faltan $${gap.toLocaleString()}` : `Superado por $${Math.abs(gap).toLocaleString()}`}
                  </div>
                  <div>
                    <Badge variant="secondary" className={reached ? 'bg-success/10 text-success' : 'bg-primary/15 text-primary'}>
                      {reached ? 'Alcanzada' : 'En progreso'}
                    </Badge>
                  </div>
                  <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="text-muted-gray hover:text-primary" onClick={() => handleOpen(projection)}>
                      <Pencil data-icon="inline-start" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-muted-gray hover:text-error" onClick={() => void removeProjection(projection.id)}>
                      <Trash2 data-icon="inline-start" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-graphite bg-surface sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-on-surface">{editId ? 'Editar proyección' : 'Agregar proyección'}</DialogTitle>
            <DialogDescription>Define el salario meta que quieres alcanzar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-medium-gray">Salario meta</Label>
              <Input type="number" value={targetSalary} onChange={(e) => setTargetSalary(e.target.value)} className="bg-abyss border-graphite text-on-surface" />
            </div>
            <Card className="border-graphite bg-abyss p-4 shadow-vault-sm">
              <p className="text-xs uppercase tracking-[0.22em] text-medium-gray">Vista previa</p>
              <p className="mt-2 text-lg font-semibold text-on-surface">
                {targetSalary ? `$${Number(targetSalary).toLocaleString()}` : 'Define una meta'}
              </p>
              <p className="mt-1 text-sm text-muted-gray">
                {targetSalary && latestSalary
                  ? Number(targetSalary) - latestSalary.amount > 0
                    ? `Te faltan $${(Number(targetSalary) - latestSalary.amount).toLocaleString()} para alcanzarla.`
                    : `Ya superaste esta meta por $${Math.abs(Number(targetSalary) - latestSalary.amount).toLocaleString()}.`
                  : 'Usa esta tarjeta para validar el impacto antes de guardar.'}
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
