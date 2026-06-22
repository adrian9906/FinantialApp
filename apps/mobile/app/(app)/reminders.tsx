import { useEffect, useState } from 'react'
import { Bell, BellOff, Calendar, Pencil, Plus, Trash2 } from 'lucide-react-native'
import { Pressable, View } from 'react-native'

import { AppFrame } from '../../src/components/app-frame'
import { Button } from '../../src/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../src/components/ui/card'
import { Dialog } from '../../src/components/ui/dialog'
import { Input } from '../../src/components/ui/input'
import { Text } from '../../src/components/ui/text'
import { useFinanceStore } from '../../src/store/finance-store'
import { usePreferencesStore } from '../../src/store/preferences-store'
import { resolvePalette } from '../../src/theme/palette'
import { radius, spacing } from '../../src/theme/tokens'

const BellIcon = Bell as any
const BellOffIcon = BellOff as any
const CalendarIcon = Calendar as any
const PencilIcon = Pencil as any
const PlusIcon = Plus as any
const Trash2Icon = Trash2 as any
const DAY_IN_MS = 1000 * 60 * 60 * 24

function getStartOfTodayMs() {
  const current = new Date()
  current.setHours(0, 0, 0, 0)
  return current.getTime()
}

export default function RemindersScreen() {
  const reminders = useFinanceStore((state) => state.reminders)
  const addReminder = useFinanceStore((state) => state.addReminder)
  const updateReminder = useFinanceStore((state) => state.updateReminder)
  const toggleReminder = useFinanceStore((state) => state.toggleReminder)
  const removeReminder = useFinanceStore((state) => state.removeReminder)
  const appearance = usePreferencesStore((state) => state.appearance)
  const theme = usePreferencesStore((state) => state.theme)
  const palette = resolvePalette(appearance, theme)
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ title: '', description: '', date: '' })
  const [todayMs, setTodayMs] = useState<number | null>(null)

  useEffect(() => {
    setTodayMs(getStartOfTodayMs())
    const id = setInterval(() => setTodayMs(getStartOfTodayMs()), 60_000)
    return () => clearInterval(id)
  }, [])

  const activeReminders = reminders.filter((r) => !r.completed)
  const completedReminders = reminders.filter((r) => r.completed)

  function resetForm() {
    setForm({ title: '', description: '', date: '' })
    setEditId(null)
    setOpen(false)
  }

  function handleOpen(entry?: (typeof reminders)[number]) {
    if (entry) {
      setEditId(entry.id)
      setForm({ title: entry.title, description: entry.description, date: entry.date })
      setOpen(true)
      return
    }
    setForm({ title: '', description: '', date: '' })
    setEditId(null)
    setOpen(true)
  }

  function getReminderDiff(date: string) {
    const dateMs = Date.parse(date)
    if (todayMs === null) return null
    return Math.ceil((dateMs - todayMs) / DAY_IN_MS)
  }

  async function handleSave() {
    if (!form.title || !form.date) return
    const payload = { title: form.title, description: form.description, date: form.date }
    if (editId) await updateReminder(editId, payload)
    else await addReminder({ ...payload, completed: false })
    resetForm()
  }

  function borderColorForDate(date: string) {
    const diff = getReminderDiff(date)
    if (diff === null) return palette.primary
    if (diff < 0) return palette.danger
    if (diff <= 3) return palette.warning
    return palette.primary
  }

  return (
    <AppFrame
      title="Recordatorios"
      subtitle="Nunca pierdas una factura o tarea financiera."
      actions={
        <Button variant="default" className="self-start" onPress={() => handleOpen()}>
          <PlusIcon size={16} color={palette.text} />
          <Text>Agregar recordatorio</Text>
        </Button>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Activos ({activeReminders.length})</CardTitle>
          <CardDescription>Recordatorios pendientes por atender.</CardDescription>
        </CardHeader>
        <CardContent className="gap-3">
          {activeReminders.length === 0 ? (
            <Text style={{ color: palette.textMuted, textAlign: 'center', paddingVertical: spacing.xl }}>Sin recordatorios activos</Text>
          ) : activeReminders.map((reminder) => {
            const diff = getReminderDiff(reminder.date) ?? 0
            const isOverdue = diff < 0
            const isClose = diff >= 0 && diff <= 3
            return (
              <View key={reminder.id} style={{ borderRadius: radius.md, borderLeftWidth: 3, borderColor: borderColorForDate(reminder.date), backgroundColor: palette.backgroundAlt, padding: spacing.md, gap: 8 }}>
                <Text style={{ color: isOverdue ? palette.danger : palette.text, fontSize: 15, fontWeight: '700' }}>{reminder.title}</Text>
                {reminder.description ? <Text style={{ color: palette.textMuted, fontSize: 12 }}>{reminder.description}</Text> : null}
                <Text style={{ color: isOverdue ? palette.danger : isClose ? palette.warning : palette.textMuted, fontSize: 12 }}>
                  {reminder.date} {isOverdue ? '(Vencido)' : isClose ? '(Pronto)' : ''}
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm }}>
                  <Pressable onPress={() => handleOpen(reminder)}><PencilIcon size={18} color={palette.primary} /></Pressable>
                  <Pressable onPress={() => void toggleReminder(reminder.id)}><BellOffIcon size={18} color={palette.warning} /></Pressable>
                  <Pressable onPress={() => void removeReminder(reminder.id)}><Trash2Icon size={18} color={palette.danger} /></Pressable>
                </View>
              </View>
            )
          })}
        </CardContent>
      </Card>

      {completedReminders.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Completados ({completedReminders.length})</CardTitle>
            <CardDescription>Recordatorios ya marcados como atendidos.</CardDescription>
          </CardHeader>
          <CardContent className="gap-3">
            {completedReminders.map((reminder) => (
              <View key={reminder.id} style={{ borderRadius: radius.md, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surfaceMuted, padding: spacing.md, gap: 8, opacity: 0.75 }}>
                <Text style={{ color: palette.text, fontSize: 15, fontWeight: '700', textDecorationLine: 'line-through' }}>{reminder.title}</Text>
                {reminder.description ? <Text style={{ color: palette.textMuted, fontSize: 12, textDecorationLine: 'line-through' }}>{reminder.description}</Text> : null}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: palette.textMuted, fontSize: 12 }}>{reminder.date}</Text>
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <Pressable onPress={() => handleOpen(reminder)}><PencilIcon size={18} color={palette.primary} /></Pressable>
                    <Pressable onPress={() => void toggleReminder(reminder.id)}><BellIcon size={18} color={palette.warning} /></Pressable>
                    <Pressable onPress={() => void removeReminder(reminder.id)}><Trash2Icon size={18} color={palette.danger} /></Pressable>
                  </View>
                </View>
              </View>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
          if (!nextOpen) {
            setEditId(null)
          }
        }}
        title={editId ? 'Editar recordatorio' : 'Agregar recordatorio'}
        description="Configura una fecha, un titulo y una nota opcional."
        footer={
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button variant="ghost" className="flex-1" onPress={resetForm}><Text>Cancelar</Text></Button>
            <Button className="flex-1" onPress={() => void handleSave()}><Text>Guardar</Text></Button>
          </View>
        }
      >
        <View style={{ gap: spacing.md }}>
          <Input value={form.title} onChangeText={(value) => setForm((current) => ({ ...current, title: value }))} placeholder="Titulo" />
          <Input value={form.description} onChangeText={(value) => setForm((current) => ({ ...current, description: value }))} placeholder="Descripcion (opcional)" multiline />
          <Input value={form.date} onChangeText={(value) => setForm((current) => ({ ...current, date: value }))} placeholder="2026-06-22" />
        </View>
      </Dialog>
    </AppFrame>
  )
}
