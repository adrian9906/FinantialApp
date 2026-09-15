export function validatePlannedMovement({ amount, plannedTotal, budget, balance }: { amount: number; plannedTotal: number; budget: number; balance: number }): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return 'El importe debe ser mayor que cero.'
  if (amount + plannedTotal > budget + 1e-9) return 'El movimiento supera el presupuesto disponible para planificar.'
  if (amount > balance + 1e-9) return 'La cuenta no tiene saldo suficiente para este movimiento.'
  return null
}
