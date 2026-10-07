import type { OrderStatus, PaymentMethod, PaymentStatus, UserRole } from '../api/types';

/** 1234.5 → "$1,234.50" */
export function money(value: number | null | undefined): string {
  const n = value ?? 0;
  const [int, dec] = Math.abs(n).toFixed(2).split('.');
  return `${n < 0 ? '-' : ''}$${int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${dec}`;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO → "14:05" (hora local de la tablet) */
export function time(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Minutos transcurridos desde una fecha ISO */
export function minutesSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
}

export const statusLabel: Record<OrderStatus, string> = {
  PENDING: 'Pendiente',
  PREPARING: 'Preparando',
  READY: 'Lista',
  COMPLETED: 'Entregada',
  CANCELLED: 'Cancelada',
};

export const paymentStatusLabel: Record<PaymentStatus, string> = {
  UNPAID: 'Sin pagar',
  PAID: 'Pagada',
  REFUNDED: 'Reembolsada',
};

export const paymentMethodLabel: Record<PaymentMethod, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
};

/** Convierte texto "123.5" o "123,5" a número; NaN si no es válido. */
export function parseAmount(text: string): number {
  const clean = text.replace(/[$\s]/g, '').replace(',', '.');
  return clean === '' ? NaN : Number(clean);
}

/** ISO → "07/10/2026 14:05" (hora local de la tablet) */
export function dateTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const roleLabel: Record<UserRole, string> = {
  ADMIN: 'Administrador',
  MANAGER: 'Gerente',
  CASHIER: 'Cajero',
};
