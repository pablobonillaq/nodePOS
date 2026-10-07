/** Elimina las claves con valor `undefined` (útil para updates parciales). */
export function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/** Convierte `null` en `undefined` para campos opcionales que vienen de GraphQL. */
export function nullToUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj ?? {}).map(([k, v]) => [k, v === null ? undefined : v]),
  ) as T;
}
