export type WishlistPriority = 'low' | 'medium' | 'high'

type WishlistLike = {
  price: number
  savedAmount?: number
  externalContribution?: number
  isPurchased?: boolean
}

export function getPriorityLabel(priority: WishlistPriority) {
  if (priority === 'high') return 'Alta'
  if (priority === 'low') return 'Baja'
  return 'Media'
}

function addDays(baseDate: Date, totalDays: number) {
  const nextDate = new Date(baseDate)
  nextDate.setDate(nextDate.getDate() + totalDays)
  return nextDate
}

export function buildPurchaseProjection(
  price: number,
  savedAmount: number,
  averageMonthlySavings: number,
  formatDate: (date: Date) => string,
) {
  if (!Number.isFinite(price) || price <= 0) {
    return {
      remaining: 0,
      progress: 0,
      timelineLabel: 'Agrega un precio valido para estimar la compra.',
      purchaseDateLabel: 'Sin fecha estimada',
      isReady: false,
    }
  }

  const safeSavedAmount = Number.isFinite(savedAmount) ? Math.max(0, savedAmount) : 0
  const safeMonthlySavings = Number.isFinite(averageMonthlySavings) ? averageMonthlySavings : 0
  const remaining = Math.max(0, price - safeSavedAmount)

  if (remaining === 0) {
    return {
      remaining,
      progress: Math.min(100, (safeSavedAmount / price) * 100),
      timelineLabel: 'Ya puedes comprarlo.',
      purchaseDateLabel: `Disponible desde hoy (${formatDate(new Date())})`,
      isReady: true,
    }
  }

  if (safeMonthlySavings <= 0) {
    return {
      remaining,
      progress: Math.min(100, (safeSavedAmount / price) * 100),
      timelineLabel: 'No hay ahorro mensual suficiente para proyectar esta compra.',
      purchaseDateLabel: 'Sin fecha estimada',
      isReady: false,
    }
  }

  const exactMonths = remaining / safeMonthlySavings
  const totalDays = Math.max(1, Math.ceil(exactMonths * 30.44))

  if (!Number.isFinite(totalDays)) {
    return {
      remaining,
      progress: Math.min(100, (safeSavedAmount / price) * 100),
      timelineLabel: 'No se pudo calcular el tiempo estimado con ese valor.',
      purchaseDateLabel: 'Sin fecha estimada',
      isReady: false,
    }
  }

  const purchaseDate = addDays(new Date(), totalDays)

  if (Number.isNaN(purchaseDate.getTime())) {
    return {
      remaining,
      progress: Math.min(100, (safeSavedAmount / price) * 100),
      timelineLabel: 'El plazo estimado es demasiado grande para calcular una fecha exacta.',
      purchaseDateLabel: 'Sin fecha estimada',
      isReady: false,
    }
  }

  const timelineLabel =
    totalDays < 31
      ? `${totalDays} día${totalDays === 1 ? '' : 's'} para completar la meta`
      : `${Math.ceil(exactMonths)} mes${Math.ceil(exactMonths) === 1 ? '' : 'es'} para completar la meta`

  return {
    remaining,
    progress: Math.min(100, (safeSavedAmount / price) * 100),
    timelineLabel,
    purchaseDateLabel: `Compra posible: ${formatDate(purchaseDate)}`,
    isReady: false,
  }
}

export function getWishlistExternalContribution(item: WishlistLike) {
  return Math.max(0, Number(item.externalContribution ?? 0))
}

export function getWishlistReservedAmount(item: WishlistLike) {
  return Math.max(0, Math.min(item.price, Number(item.savedAmount ?? 0)))
}

export function isWishlistPurchased(item: WishlistLike) {
  const explicitFlag = item.isPurchased
  if (typeof explicitFlag === 'boolean') {
    return explicitFlag
  }

  return item.price > 0 && getWishlistReservedAmount(item) >= item.price
}

export function getWishlistAvailableAmount(item: WishlistLike, currentSavedAmount: number) {
  const baseSavings = Math.max(0, currentSavedAmount)
  const reservedAmount = getWishlistReservedAmount(item)
  const externalContribution = getWishlistExternalContribution(item)

  return isWishlistPurchased(item)
    ? baseSavings + reservedAmount + externalContribution
    : baseSavings + externalContribution
}
