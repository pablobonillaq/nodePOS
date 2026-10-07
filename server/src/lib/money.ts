import { env } from '../config/env';

/** Pesos (Float) → centavos (Int). */
export const toCents = (amount: number): number => Math.round(amount * 100);

/** Centavos (Int) → pesos (Float). */
export const fromCents = (cents: number | null | undefined): number | null =>
  cents === null || cents === undefined ? null : cents / 100;

/**
 * Calcula el desglose de una orden. Los precios del catálogo YA incluyen IVA
 * (práctica habitual en México), así que el impuesto se "extrae" del total.
 */
export function computeTotals(lineTotalsCents: number[], discountCents = 0) {
  const gross = lineTotalsCents.reduce((sum, c) => sum + c, 0);
  const total = Math.max(gross - discountCents, 0);
  const subtotal = Math.round(total / (1 + env.TAX_RATE));
  const tax = total - subtotal;
  return { subtotalCents: subtotal, taxCents: tax, totalCents: total };
}
