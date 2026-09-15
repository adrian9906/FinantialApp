import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AppIcon } from '@/components/icons/AppIcon'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel, FieldDescription } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { calculateCurrencyAmount, parseCurrencyAmount } from '@/lib/currency-calculator'
import { usePreferencesStore, USD_CURRENCY, type CurrencyPreference } from '@/store/preferencesStore'

function CurrencySelect({ id, value, currencies, onChange }: {
  id: string
  value: string
  currencies: CurrencyPreference[]
  onChange: (code: string) => void
}) {
  return (
    <Select value={value} items={currencies.map((currency) => ({ value: currency.code, label: `${currency.code} · ${currency.name}` }))}
      onValueChange={(code) => { if (code) onChange(code) }}>
      <SelectTrigger id={id} className="w-full min-w-0">
        <SelectValue className="truncate" />
      </SelectTrigger>
      <SelectContent><SelectGroup>
        {currencies.map((currency) => (
          <SelectItem key={currency.code} value={currency.code}>{currency.code} · {currency.name}</SelectItem>
        ))}
      </SelectGroup></SelectContent>
    </Select>
  )
}

export default function CurrencyCalculator() {
  const currencies = usePreferencesStore((state) => state.currencies)
  const activeCurrencyCode = usePreferencesStore((state) => state.activeCurrencyCode)
  const [amountInput, setAmountInput] = useState('1')
  const [fromCode, setFromCode] = useState(activeCurrencyCode)
  const [toCode, setToCode] = useState(currencies.find((currency) => currency.code !== activeCurrencyCode)?.code ?? 'USD')
  const from = currencies.find((currency) => currency.code === fromCode) ?? currencies[0] ?? USD_CURRENCY
  const to = currencies.find((currency) => currency.code === toCode) ?? currencies[0] ?? USD_CURRENCY
  const amount = parseCurrencyAmount(amountInput)
  const result = amount === null ? null : calculateCurrencyAmount(amount, from, to)
  const rate = calculateCurrencyAmount(1, from, to)
  const invalidAmount = amountInput !== '' && amount === null
  const number = new Intl.NumberFormat('es', { maximumFractionDigits: 2 })
  const rateNumber = new Intl.NumberFormat('es', { maximumSignificantDigits: 8 })

  function swapCurrencies() {
    setFromCode(to.code)
    setToCode(from.code)
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold tracking-tight text-on-surface md:text-[36px]">Calculadora de divisas</h1>
        <p className="text-sm text-muted-gray">Convierte importes entre tus monedas.</p>
      </header>
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>¿Cuánto quieres convertir?</CardTitle>
            <CardDescription>El resultado se actualiza mientras escribes.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field data-invalid={invalidAmount || undefined}>
                <FieldLabel htmlFor="currency-amount">Importe en {from.code}</FieldLabel>
                <Input id="currency-amount" type="text" inputMode="decimal" autoComplete="off" value={amountInput}
                  onChange={(event) => setAmountInput(event.target.value)} aria-invalid={invalidAmount}
                  aria-describedby="currency-amount-help" placeholder="0,00" />
                <FieldDescription id="currency-amount-help">
                  {invalidAmount ? 'Escribe un importe positivo o cero, con coma o punto decimal.' : 'Puedes usar coma o punto para los decimales.'}
                </FieldDescription>
              </Field>
              <FieldGroup className="grid min-w-0 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                <Field className="min-w-0">
                  <FieldLabel htmlFor="currency-from">De</FieldLabel>
                  <CurrencySelect id="currency-from" value={from.code} currencies={currencies} onChange={setFromCode} />
                </Field>
                <Button variant="outline" size="icon" className="justify-self-center" aria-label="Intercambiar monedas" onClick={swapCurrencies}>
                  <AppIcon name="refresh" />
                </Button>
                <Field className="min-w-0">
                  <FieldLabel htmlFor="currency-to">A</FieldLabel>
                  <CurrencySelect id="currency-to" value={to.code} currencies={currencies} onChange={setToCode} />
                </Field>
              </FieldGroup>
            </FieldGroup>
          </CardContent>
        </Card>
        <section className="flex min-w-0 flex-col justify-center gap-4 rounded-2xl border border-graphite bg-surface p-6 shadow-vault sm:p-8" aria-label="Resultado de conversión">
          <div className="flex items-center gap-2 text-muted-gray"><AppIcon name="coins" className="size-5" /><span className="text-sm">Recibes el equivalente a</span></div>
          <output htmlFor="currency-amount currency-from currency-to" aria-live="polite" aria-atomic="true" className="flex min-w-0 flex-wrap items-baseline gap-3">
            <span className="break-all text-4xl font-semibold tracking-tight text-on-surface tabular-nums sm:text-5xl">{result === null ? '—' : number.format(result)}</span>
            <span className="text-xl font-medium text-primary">{to.code}</span>
          </output>
          <p className="text-sm text-muted-gray">{amount === null ? 'Introduce un importe para convertir.' : `${number.format(amount)} ${from.code} → ${to.name}`}</p>
          <div className="border-t border-graphite pt-4 text-sm text-on-surface">
            {rate === null ? 'Revisa las tasas de cambio en Ajustes.' : `1 ${from.code} = ${rateNumber.format(rate)} ${to.code}`}
            {amount !== null && result === null && rate !== null && <p role="alert">El importe es demasiado grande para convertirlo.</p>}
          </div>
        </section>
      </div>
      <div className="flex flex-col items-start gap-3 rounded-xl border border-graphite bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-on-surface">{currencies.length < 2 ? 'Añade otra moneda para empezar' : 'Tus tasas de cambio'}</p>
          <p className="text-sm text-muted-gray">Usamos las tasas guardadas en Ajustes respecto a USD. No se actualizan en tiempo real.</p>
        </div>
        <Button variant="outline" render={<Link to="/settings" />} className="shrink-0">Administrar divisas</Button>
      </div>
    </div>
  )
}
