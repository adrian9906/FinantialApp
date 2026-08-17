import type { CategorizationRule } from './categorization'
import { findCategorizationRule } from './categorization'
import type { ExpenseCategory } from './expense-utils'
import type { WantCategory } from './want-utils'

export type ReceiptOCRFieldConfidence = 'high' | 'medium' | 'low'
export type ReceiptOCRTransactionType = 'expense' | 'want'

export type OCRWorkflowStatus = 'idle' | 'preparing' | 'recognizing' | 'parsing' | 'done' | 'error'

export interface OCRWorkflowProgress {
  status: OCRWorkflowStatus
  progress?: number
  message?: string
}

export interface ReceiptOCRRawResult {
  text: string
  confidence?: number
}

export interface ReceiptOCRLineItem {
  name: string
  price: number
  category?: ExpenseCategory | WantCategory
}

export interface ReceiptOCRParsedDraft {
  amount?: number
  date?: string
  merchant?: string
  suggestedName?: string
  suggestedCategory?: ExpenseCategory | WantCategory
  lineItems?: ReceiptOCRLineItem[]
  rawText: string
  warnings: string[]
  confidence: Partial<Record<'amount' | 'date' | 'merchant' | 'category', ReceiptOCRFieldConfidence>>
}

export interface ReceiptOCRParseContext {
  transactionType: ReceiptOCRTransactionType
  userRules?: readonly CategorizationRule[]
}

const TOTAL_KEYWORDS = /\b(?:total|importe|monto|a pagar|pagar|neto a|suma de|subtotal a pagar)\b/i

const GENERIC_HEADER = /^(?:total|importe|monto|a pagar|pagar|factura|ticket|recibo|cliente|cajero|atendio|atendido|gracias|vuelva|pronto|no fiscal|orden|mesa|proceda|telefono|nit|ruc|fecha|tarjeta|efectivo|cambio|subtotal|iva|igv|impuesto|descuento|folio|secuencia|no\.?|#|www|http|term|sucursal|local|caja|parcial|punto de venta|validar|verificar|aprobado|autorizacion|entrada|salida|referencia)\b/i

const LETTERS = /[A-Za-z\u00C0-\u017F]{2,}/

const EXPENSE_CATEGORY_KEYWORDS: Record<ExpenseCategory, string[]> = {
  food: [
    'supermercado', 'mercado', 'minimarket', 'mini market', 'bodega', 'carniceria', 'fruteria',
    'frutas', 'verduras', 'panaderia', 'abarrotes', 'comida', 'alimentacion', 'alimentos',
    'delicatessen', 'vegetales', 'hortalizas',
  ],
  home: [
    'luz', 'electricidad', 'agua', 'acueducto', 'internet', 'wifi', 'gas', 'hogar',
    'mantenimiento', 'reparacion', 'plomero', 'electricista', 'cerrajero',
  ],
  services: [
    'etecsa', 'nauta', 'telefonica', 'telefono', 'comunicaciones', 'recarga', 'movil', 'conecta',
  ],
  gym: ['gym', 'gimnasio', 'fitness', 'crossfit', 'entrenamiento'],
  health: [
    'farmacia', 'drogueria', 'medico', 'medica', 'doctor', 'clinica', 'salud', 'consulta',
    'hospital', 'laboratorio', 'dentista', 'fisioterapia', 'optic',
  ],
  essentials: [],
}

const WANT_CATEGORY_KEYWORDS: Record<WantCategory, string[]> = {
  subscriptions: [
    'netflix', 'spotify', 'disney', 'prime', 'youtube', 'hbo', 'paramount', 'suscripcion',
    'aplicacion', 'app',
  ],
  outings: [
    'cine', 'restaurante', 'cafe', 'coffee', 'hotel', 'viaje', 'turismo', 'paseo',
    'concierto', 'teatro',
  ],
  shopping: ['zara', 'ropa', 'calzado', 'zapato', 'moda', 'vestir', 'outlet', 'boutique'],
  gaming: ['playstation', 'xbox', 'steam', 'nintendo', 'juego', 'gaming', 'games'],
  selfcare: [
    'salon', 'belleza', 'estetica', 'spa', 'barberia', 'barbero', 'skincare',
    'peluqueria', 'unas', 'manicure', 'barba',
  ],
}

function normalizeForKeyword(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function matchesKeyword(text: string, keyword: string) {
  if (keyword.includes(' ')) return text.includes(keyword)
  return new RegExp(`\\b${escapeRegExp(keyword)}\\b`).test(text)
}

function cleanLine(line: string) {
  return line
    .replace(/\u00A0/g, ' ')
    .replace(/[\u2018\u2019\u02BC\u02B9\u201C\u201D`\u00B4]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function toLines(text: string) {
  return text
    .split(/\r?\n/)
    .map(cleanLine)
    .filter(Boolean)
}

function tokenizeNumbers(line: string): string[] {
  const tokens: string[] = []
  const regex = /\d[\d.,]*/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(line)) !== null) {
    const token = match[0].replace(/\s/g, '')
    if (/^\d+(?:[.,]\d+)*$/.test(token)) tokens.push(token)
  }
  return tokens
}

export function parseReceiptAmountToken(token: string): number | null {
  let value = token.trim()
  if (!value) return null

  const negative = value.startsWith('-')
  value = value.replace(/-/g, '')
  if (!/^\d+(?:[.,]\d+)*$/.test(value)) return null

  const digits = value.replace(/[.,]/g, '')
  if (digits.length < 1 || digits.length > 10) return null

  const lastComma = value.lastIndexOf(',')
  const lastDot = value.lastIndexOf('.')
  const lastSeparator = Math.max(lastComma, lastDot)
  if (lastSeparator === -1) {
    return negative ? -Number(value) : Number(value)
  }

  let integerPart = value.slice(0, lastSeparator)
  let decimalPart = value.slice(lastSeparator + 1)

  if (decimalPart.length === 3) {
    integerPart = integerPart.replace(/[.,]/g, '') + decimalPart
    decimalPart = ''
  } else if (decimalPart.length > 2) {
    return null
  }

  integerPart = integerPart.replace(/[.,]/g, '')
  if (!/^\d*$/.test(integerPart)) return null

  const numeric = Number.parseFloat(integerPart + (decimalPart ? `.${decimalPart}` : ''))
  if (!Number.isFinite(numeric)) return null
  return negative ? -numeric : numeric
}

interface AmountResult {
  value?: number
  confidence: ReceiptOCRFieldConfidence
  warnings: string[]
}

function isYearToken(token: string) {
  return /^(?:19|20)\d{2}$/.test(token)
}

function extractAmount(lines: string[]): AmountResult {
  const warnings: string[] = []
  const totalLines = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => TOTAL_KEYWORDS.test(line))
  const candidates: Array<{ value: number; lineIndex: number; token: string }> = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    for (const token of tokenizeNumbers(line)) {
      if (isYearToken(token)) continue
      const value = parseReceiptAmountToken(token)
      if (value === null || value <= 0 || value > 100_000_000) continue
      candidates.push({ value, lineIndex: index, token })
    }
  }

  if (totalLines.length > 0) {
    const totalCandidates = candidates.filter((candidate) =>
      totalLines.some(({ index }) => index === candidate.lineIndex),
    )
    if (totalCandidates.length > 0) {
      const lastTotalLine = totalLines[totalLines.length - 1].index
      const lastTotalTokens = totalCandidates.filter((candidate) => candidate.lineIndex === lastTotalLine)
      const best = lastTotalTokens.length > 0
        ? lastTotalTokens[lastTotalTokens.length - 1]
        : totalCandidates[totalCandidates.length - 1]

      return {
        value: Math.round(best.value * 100) / 100,
        confidence: 'high',
        warnings,
      }
    }
  }

  if (candidates.length === 0) return { confidence: 'low', warnings }

  const priceLike = candidates.filter((candidate) => /[.,]\d{1,2}$/.test(candidate.token))
  if (priceLike.length > 0) {
    if (priceLike.length > 1) warnings.push('Verifica el importe; se detectaron varios valores.')
    const best = priceLike.reduce((max, candidate) => (candidate.value > max.value ? candidate : max), priceLike[0])
    return { value: Math.round(best.value * 100) / 100, confidence: 'medium', warnings }
  }

  const distinct = new Set(candidates.map((candidate) => candidate.value))
  if (distinct.size > 1) warnings.push('Verifica el importe; se detectaron varios valores.')

  const best = candidates.reduce((max, candidate) => (candidate.value > max.value ? candidate : max), candidates[0])

  return {
    value: Math.round(best.value * 100) / 100,
    confidence: candidates.length > 1 ? 'medium' : 'low',
    warnings,
  }
}

interface DateResult {
  date?: string
  confidence?: ReceiptOCRFieldConfidence
}

function isValidDate(year: number, month: number, day: number) {
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

function extractDate(lines: string[]): DateResult {
  const found: string[] = []
  const regex = /(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,4})/g

  for (const line of lines) {
    let match: RegExpExecArray | null
    regex.lastIndex = 0
    while ((match = regex.exec(line)) !== null) {
      const a = Number(match[1])
      const b = Number(match[2])
      const c = Number(match[3])

      let year: number
      let month: number
      let day: number

      if (a > 1900) {
        year = a
        month = b
        day = c
      } else if (c > 1900) {
        year = c
        month = b
        day = a
      } else if (a <= 31 && b <= 12 && c > 0 && c < 100) {
        year = 2000 + c
        month = b
        day = a
      } else {
        continue
      }

      if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && isValidDate(year, month, day)) {
        found.push(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
      }
    }
  }

  if (found.length === 0) return {}

  const unique = Array.from(new Set(found)).sort()
  return { date: unique[unique.length - 1], confidence: 'medium' }
}

interface MerchantResult {
  merchant?: string
  confidence?: ReceiptOCRFieldConfidence
}

function extractMerchant(lines: string[]): MerchantResult {
  const merchantLines: string[] = []

  for (const line of lines) {
    if (merchantLines.length >= 2) break
    if (!LETTERS.test(line)) continue
    if (GENERIC_HEADER.test(line)) continue

    const hasPrice = tokenizeNumbers(line).some((token) => {
      const value = parseReceiptAmountToken(token)
      return value !== null && value > 0
    })
    if (hasPrice) continue

    merchantLines.push(line)
  }

  const merchant = merchantLines.join(' ').replace(/\s+/g, ' ').trim()
  if (!merchant) return {}
  return { merchant, confidence: 'medium' }
}

export function extractLineItems(
  lines: string[],
  transactionType: ReceiptOCRTransactionType,
  userRules: readonly CategorizationRule[] = [],
  totalAmount?: number,
): ReceiptOCRLineItem[] {
  const items: ReceiptOCRLineItem[] = []
  const seen = new Set<string>()
  const cap = totalAmount ? Math.max(totalAmount * 1.3, 20) : Number.POSITIVE_INFINITY
  const dateRegex = /\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}/

  for (const line of lines) {
    const trimmed = cleanLine(line)
    if (!LETTERS.test(trimmed)) continue
    if (TOTAL_KEYWORDS.test(trimmed) || GENERIC_HEADER.test(trimmed)) continue
    if (dateRegex.test(trimmed)) continue

    const numbers = tokenizeNumbers(trimmed)
    if (numbers.length === 0) continue

    let price: number | null = null
    let priceTokenEnd = -1
    for (let i = numbers.length - 1; i >= 0; i -= 1) {
      const value = parseReceiptAmountToken(numbers[i])
      if (value !== null && value > 0 && value <= cap) {
        price = value
        priceTokenEnd = trimmed.lastIndexOf(numbers[i]) + numbers[i].length
        break
      }
    }
    if (price === null) continue

    let name = trimmed.slice(0, priceTokenEnd).trim()
    name = name
      .replace(/\s*\d+\s*[xX*\u00D7]\s*[\d.,]+\s*$/, '')
      .replace(/\s+\d+\s*$/, '')
      .replace(/[\s.,:;|=\-\u2013\u2014]+$/, '')
      .replace(/^\d+\s*[).:\-\u2022]\s*/, '')
      .trim()
    if (!LETTERS.test(name)) continue

    const key = name.toLocaleLowerCase('es')
    if (seen.has(key)) continue
    seen.add(key)

    const category = suggestCategoryFromReceipt(name, transactionType, userRules).category
    items.push(category ? { name, price, category } : { name, price })
  }

  return items
}

export function suggestCategoryFromReceipt(
  sourceText: string,
  transactionType: ReceiptOCRTransactionType,
  userRules: readonly CategorizationRule[] = [],
): { category?: ExpenseCategory | WantCategory; confidence: ReceiptOCRFieldConfidence } {
  const rule = findCategorizationRule(sourceText, userRules)
  if (rule && rule.transactionType === transactionType) {
    return { category: rule.category, confidence: 'high' }
  }

  const keywords = transactionType === 'expense' ? EXPENSE_CATEGORY_KEYWORDS : WANT_CATEGORY_KEYWORDS
  const normalized = normalizeForKeyword(sourceText)

  for (const entry of Object.entries(keywords) as Array<[ExpenseCategory | WantCategory, string[]]>) {
    const [category, words] = entry
    const matched = words.some((word) => matchesKeyword(normalized, word))
    if (matched) return { category, confidence: 'medium' }
  }

  return { category: undefined, confidence: 'medium' }
}

export function parseReceiptTextToDraft(
  text: string,
  context: ReceiptOCRParseContext,
): ReceiptOCRParsedDraft {
  const rawText = (text ?? '').trim()
  const lines = toLines(rawText)
  const warnings: string[] = []
  const confidence: ReceiptOCRParsedDraft['confidence'] = {}

  const amountResult = extractAmount(lines)
  if (amountResult.value !== undefined && amountResult.value > 0) {
    confidence.amount = amountResult.confidence
  } else {
    warnings.push('No se pudo identificar un importe claro.')
  }
  warnings.push(...amountResult.warnings)

  const dateResult = extractDate(lines)
  if (dateResult.date) {
    confidence.date = dateResult.confidence
  } else {
    warnings.push('No se pudo identificar la fecha.')
  }

  const merchantResult = extractMerchant(lines)
  const merchant = merchantResult.merchant
  if (merchant) confidence.merchant = merchantResult.confidence

  const categorySource = merchant ?? lines.slice(0, 4).join(' ')
  const categoryResult = suggestCategoryFromReceipt(categorySource, context.transactionType, context.userRules)
  const suggestedCategory = categoryResult.category
  if (suggestedCategory) confidence.category = categoryResult.confidence

  const lineItems = extractLineItems(lines, context.transactionType, context.userRules, amountResult.value)
  let suggestedName = merchant
  let amount = amountResult.value
  let suggestedCategoryFromItem: ExpenseCategory | WantCategory | undefined = suggestedCategory
  if (lineItems.length > 0) {
    suggestedName = lineItems[0].name
    suggestedCategoryFromItem = lineItems[0].category ?? suggestedCategory
    if (amount === undefined) amount = lineItems[0].price
  }

  return {
    amount,
    date: dateResult.date,
    merchant,
    suggestedName,
    suggestedCategory: suggestedCategoryFromItem,
    lineItems,
    rawText,
    warnings,
    confidence,
  }
}