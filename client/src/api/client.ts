import { DEFAULT_SERVER_URL } from '../config';

export class ApiError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

let baseUrl = DEFAULT_SERVER_URL;
let authToken: string | null = null;
let onUnauthenticated: (() => void) | null = null;
let onPasswordChangeRequired: (() => void) | null = null;

/** Acepta "192.168.1.50:4000", "http://192.168.1.50:4000/" o con /graphql. */
export function normalizeServerUrl(input: string): string {
  let url = input.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
  return url.replace(/\/graphql$/i, '');
}

export const apiConfig = {
  setServerUrl(url: string) {
    baseUrl = normalizeServerUrl(url);
  },
  getServerUrl() {
    return baseUrl;
  },
  setToken(token: string | null) {
    authToken = token;
  },
  setUnauthenticatedHandler(handler: (() => void) | null) {
    onUnauthenticated = handler;
  },
  setPasswordChangeRequiredHandler(handler: (() => void) | null) {
    onPasswordChangeRequired = handler;
  },
};

interface GraphQLResponse<T> {
  data?: T;
  errors?: { message: string; extensions?: { code?: string } }[];
}

export async function gqlRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new ApiError(`No se pudo conectar con el servidor (${baseUrl})`, 'NETWORK');
  }

  let json: GraphQLResponse<T>;
  try {
    json = await res.json();
  } catch {
    throw new ApiError(`Respuesta inválida del servidor (HTTP ${res.status})`, 'BAD_RESPONSE');
  }

  if (json.errors?.length) {
    const first = json.errors[0];
    const code = first.extensions?.code;
    if (code === 'UNAUTHENTICATED' && authToken && onUnauthenticated) onUnauthenticated();
    if (code === 'PASSWORD_CHANGE_REQUIRED' && onPasswordChangeRequired) onPasswordChangeRequired();
    throw new ApiError(first.message, code);
  }
  return json.data as T;
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Ocurrió un error inesperado';
}
