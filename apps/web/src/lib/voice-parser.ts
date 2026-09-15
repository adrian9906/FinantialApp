import { findCategorizationRule, type CategorizationRule, type ExpenseCategory, type WantCategory } from '@plata/shared'

export interface VoiceMovementDraft {
  id: string
  text: string
  itemName: string
  amount: string
  currencyCode: string
  type: 'expense' | 'want' | ''
  category: ExpenseCategory | WantCategory | ''
  date: string
  incomeSourceId: string
  status: 'pending' | 'checked'
  issues: string[]
}
export interface VoiceParseContext {
  today: string
  accountId: string
  currencyCode: string
  accounts: Array<{ id: string; name: string; currencyCode: string }>
  currencyCodes: string[]
  rules: CategorizationRule[]
}
const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
export function isVoiceExpenseCategory(value: string): value is ExpenseCategory { return ['food', 'home', 'services', 'gym', 'health', 'essentials'].includes(value) || /^custom:.+/.test(value) }
export function isVoiceWantCategory(value: string): value is WantCategory { return ['outings', 'shopping', 'gaming', 'subscriptions', 'selfcare'].includes(value) || /^custom:.+/.test(value) }
const units: Record<string, number> = { cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintiun: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100, ciento: 100, doscientos: 200, trescientos: 300, cuatrocientos: 400, quinientos: 500, seiscientos: 600, setecientos: 700, ochocientos: 800, novecientos: 900 }
function numberValue(words: string[]) {
  let total = 0, group = 0
  for (const word of words) {
    if (word === 'mil') { total += (group || 1) * 1000; group = 0 }
    else if (word !== 'y') group += units[word] ?? 0
  }
  return total + group
}
export function normalizeSpokenNumbers(input: string) {
  const tokens = normalize(input).replace(/\b(?:un|una)\s+(?=(?:gasto|gusto)\b)/g, '').split(/(\s+|[,.;])/)
  const isNumber = (word: string) => word in units || word === 'mil'
  const continues = (words: string[], next: string, following: string) => {
    const previous = words[words.length - 1]
    if (next === 'y') return (units[previous] ?? 0) >= 30 && (units[previous] ?? 0) < 100 && (units[following] ?? 100) > 0 && (units[following] ?? 100) < 10
    if (!isNumber(next)) return false
    if (previous === 'y') return (units[next] ?? 100) < 10
    if (next === 'mil') return !words.includes('mil')
    if (previous === 'mil') return next !== 'mil'
    return (units[previous] ?? 0) >= 100 && (units[next] ?? 1000) < 100
  }
  for (let index = 0; index < tokens.length; index++) {
    if (!isNumber(tokens[index])) continue
    // Articles before concepts are not prices.
    if (/^(un|una)$/.test(tokens[index]) && !isNumber(tokens[index + 2] ?? '') && !/^(dolares?|euros?|pesos?|centavos?)$/.test(tokens[index + 2] ?? '')) continue
    let end = index
    const words = [tokens[index]]
    while (/^\s+$/.test(tokens[end + 1] ?? '') && continues(words, tokens[end + 2] ?? '', tokens[end + 4] ?? '')) {
      end += 2; words.push(tokens[end])
    }
    let result = String(numberValue(words))
    if (/^(con|coma|punto)$/.test(tokens[end + 2] ?? '') && isNumber(tokens[end + 4] ?? '')) {
      let decimalEnd = end + 4
      const decimalWords = [tokens[decimalEnd]]
      while (/^\s+$/.test(tokens[decimalEnd + 1] ?? '') && continues(decimalWords, tokens[decimalEnd + 2] ?? '', tokens[decimalEnd + 4] ?? '')) {
        decimalEnd += 2; decimalWords.push(tokens[decimalEnd])
      }
      const fraction = numberValue(decimalWords)
      if (fraction < 100) { result += '.' + String(fraction).padStart(2, '0'); end = decimalEnd }
    }
    tokens.splice(index, end - index + 1, result)
  }
  return tokens.join('')
}
const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
function parseDate(text: string, today: string) {
  const explicit = text.match(/\b(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{4})\b/)
  const spoken = text.match(new RegExp('\\b(\\d{1,2}) de (' + months.join('|') + ') (?:de |del )?(\\d{4})\\b'))
  if (explicit) {
    const raw = explicit[0], pieces = raw.split(/[/-]/)
    const date = pieces[0].length === 4 ? raw : `${pieces[2]}-${pieces[1].padStart(2, '0')}-${pieces[0].padStart(2, '0')}`
    return { date, text: text.replace(raw, '') }
  }
  if (spoken) return { date: `${spoken[3]}-${String(months.indexOf(spoken[2]) + 1).padStart(2, '0')}-${spoken[1].padStart(2, '0')}`, text: text.replace(spoken[0], '') }
  const relative = text.match(/\b(anteayer|ayer|hoy)\b/)
  if (!relative) return { date: today, text }
  const day = new Date(today + 'T12:00:00')
  day.setDate(day.getDate() - (relative[0] === 'anteayer' ? 2 : relative[0] === 'ayer' ? 1 : 0))
  return { date: `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`, text: text.replace(relative[0], '') }
}
const categoryHints = [
  { pattern: /\b(pan|leche|comida|supermercado|mercado|arroz)\b/, type: 'expense', category: 'food' },
  { pattern: /\b(luz|agua|telefono|internet|etecsa)\b/, type: 'expense', category: 'services' },
  { pattern: /\b(alquiler|hogar|casa)\b/, type: 'expense', category: 'home' },
  { pattern: /\b(medicina|medicamentos|medico|farmacia)\b/, type: 'expense', category: 'health' },
  { pattern: /\b(gimnasio|gym|deporte)\b/, type: 'expense', category: 'gym' },
  { pattern: /\b(transporte|taxi|autobus|gasolina)\b/, type: 'expense', category: 'essentials' },
  { pattern: /\b(cine|restaurante|salida|concierto)\b/, type: 'want', category: 'outings' },
  { pattern: /\b(ropa|zapatos|compras)\b/, type: 'want', category: 'shopping' },
  { pattern: /\b(juego|videojuego)\b/, type: 'want', category: 'gaming' },
  { pattern: /\b(netflix|spotify|suscripcion)\b/, type: 'want', category: 'subscriptions' },
  { pattern: /\b(peluqueria|manicura|spa)\b/, type: 'want', category: 'selfcare' },
] as const
export function parseVoiceMovements(input: string, context: VoiceParseContext): VoiceMovementDraft[] {
  const normalized = normalizeSpokenNumbers(input.trim().slice(0, 4000))
  if (!normalized) return []
  const candidates = normalized.split(/\s+(?:y|ademas|tambien|luego)\s+|[;\n]+|,(?!\d)/)
  const segments: string[] = []
  for (const candidate of candidates) {
    const previous = segments[segments.length - 1]
    if (previous && !/\d/.test(previous) && !/\b(gasto|gusto)\b/.test(candidate)) segments[segments.length - 1] += ' y ' + candidate
    else segments.push(candidate)
  }
  return segments.filter((text) => text.trim()).map((original) => {
    const issues: string[] = []
    const dated = parseDate(original, context.today)
    let text = dated.text
    let accountId = context.accountId, currencyCode = context.currencyCode
    const accountMatch = text.match(/\b(?:cuenta|ingreso)\s+(.+?)(?=\s+(?:hoy|ayer|pagado|pendiente)\b|$)/)
    if (accountMatch) {
      const name = accountMatch[1].trim()
      const accounts = context.accounts.filter((account) => normalize(account.name) === name)
      if (accounts.length === 1) { accountId = accounts[0].id; currencyCode = accounts[0].currencyCode }
      else { accountId = ''; issues.push('Selecciona la cuenta: el nombre no coincide de forma única.') }
      text = text.replace(accountMatch[0], '')
    }
    const foundCurrencies = new Set<string>()
    text = text.replace(/\b(dolares?|usd|euros?|eur|pesos?|cup|cuc|mlc)\b/g, (token) => {
      if (/^(dolar|dolares|usd)$/.test(token)) foundCurrencies.add('USD')
      else if (/^(euro|euros|eur)$/.test(token)) foundCurrencies.add('EUR')
      else if (token === 'peso' || token === 'pesos') { issues.push('Indica qué moneda significa pesos.'); foundCurrencies.add('') }
      else foundCurrencies.add(token.toUpperCase())
      return ''
    })
    for (const code of context.currencyCodes) {
      const regex = new RegExp('\\b' + code.replace(/[^a-z]/gi, '') + '\\b', 'gi')
      if (regex.test(text)) { foundCurrencies.add(code); text = text.replace(regex, '') }
    }
    if (foundCurrencies.size === 1) currencyCode = [...foundCurrencies][0]
    else if (foundCurrencies.size > 1) { currencyCode = ''; issues.push('Hay varias monedas en el mismo movimiento.') }
    const amounts = [...text.matchAll(/\b\d+(?:[.,]\d{1,2})?\b/g)]
    const amount = amounts.length === 1 ? amounts[0][0].replace(',', '.') : ''
    if (amounts.length !== 1) issues.push(amounts.length ? 'Hay varios importes: separa o completa el movimiento.' : 'Falta el importe.')
    const explicitType = /\b(gusto|gustos)\b/.test(text) ? 'want' : /\b(gasto|gastos)\b/.test(text) ? 'expense' : ''
    const status = /\b(pagado|pagada|pague|pagados)\b/.test(text) ? 'checked' : 'pending'
    let itemName = text.replace(/\b\d+(?:[.,]\d{1,2})?\b/g, '').replace(/\b(anota|anotar|agrega|agregar|registrar|registra|pon|poner|apunta|un|una|gasto|gastos|gusto|gustos|pagado|pagada|pagados|pague|pendiente|pendientes)\b/g, '').replace(/\s+/g, ' ').trim().replace(/^(?:(?:de|en|por|para|del)\s+)+/g, '').replace(/(?:\s+(?:de|en|por|para|del))+$/g, '').trim()
    itemName = itemName.charAt(0).toUpperCase() + itemName.slice(1)
    const rule = findCategorizationRule(itemName, context.rules)
    const hint = categoryHints.find((entry) => entry.pattern.test(normalize(itemName)))
    const suggestion = rule ? { type: rule.transactionType, category: rule.category } : hint
    const type = explicitType || suggestion?.type || ''
    const category = suggestion?.type === type ? suggestion.category : ''
    if (!type) issues.push('Selecciona gasto o gusto.')
    if (!category) issues.push('Selecciona la categoría.')
    return { id: 'voice-' + crypto.randomUUID(), text: original, itemName, amount, currencyCode, type, category, date: dated.date, incomeSourceId: accountId, status, issues }
  })
}
