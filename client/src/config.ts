/**
 * Dirección por defecto del servidor (se puede cambiar desde la pantalla de login).
 *
 * - Emulador de Android: http://10.0.2.2:4000  (10.0.2.2 = "localhost" de tu PC)
 * - Tablet física: http://<IP-de-tu-PC>:4000   (ej. http://192.168.1.50:4000)
 *   La tablet y la PC deben estar en la misma red Wi-Fi.
 */
export const DEFAULT_SERVER_URL = 'http://10.0.2.2:4000';

/** Cada cuánto se refresca la vista de órdenes (ms). */
export const ORDERS_POLL_INTERVAL = 10_000;
