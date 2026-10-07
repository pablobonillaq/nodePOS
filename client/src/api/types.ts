export type UserRole = 'ADMIN' | 'MANAGER' | 'CASHIER';
export type OrderStatus = 'PENDING' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';
export type PaymentStatus = 'UNPAID' | 'PAID' | 'REFUNDED';
export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER';

export interface User {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  /** true = contraseña temporal: debe cambiarla antes de usar la app */
  mustChangePassword: boolean;
}

/** Usuario tal como lo ve el administrador. */
export interface ManagedUser extends User {
  active: boolean;
  tempPasswordExpiresAt: string | null;
  passwordChangedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface TemporaryPasswordPayload {
  user: ManagedUser;
  temporaryPassword: string;
  expiresAt: string;
}

export interface Category {
  id: string;
  name: string;
  color: string | null;
  sortOrder?: number;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  categoryId: string | null;
  available: boolean;
  sku?: string | null;
  description?: string | null;
  imageUrl?: string | null;
}

export interface OrderItem {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  notes: string | null;
}

export interface Order {
  id: string;
  ticketNumber: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod | null;
  customerName: string | null;
  notes: string | null;
  total: number;
  amountPaid: number | null;
  change: number | null;
  createdAt: string;
  items: OrderItem[];
}
