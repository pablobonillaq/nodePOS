import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage, gqlRequest } from '../api/client';

interface QueryOptions {
  /** Refresca automáticamente cada N ms (sin mostrar el indicador de carga). */
  pollInterval?: number;
  skip?: boolean;
}

/** Ejecuta una consulta GraphQL al montar el componente y cuando cambian las variables. */
export function useQuery<T>(
  query: string,
  variables?: Record<string, unknown>,
  options: QueryOptions = {},
) {
  const { pollInterval, skip } = options;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!skip);
  const varsKey = JSON.stringify(variables ?? {});
  const requestId = useRef(0);

  const refetch = useCallback(
    async (silent = false) => {
      const id = ++requestId.current;
      if (!silent) setLoading(true);
      try {
        const result = await gqlRequest<T>(query, JSON.parse(varsKey));
        if (id === requestId.current) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (id === requestId.current) setError(errorMessage(err));
      } finally {
        if (id === requestId.current && !silent) setLoading(false);
      }
    },
    [query, varsKey],
  );

  useEffect(() => {
    if (skip) return;
    refetch();
    if (!pollInterval) return;
    const timer = setInterval(() => refetch(true), pollInterval);
    return () => clearInterval(timer);
  }, [refetch, skip, pollInterval]);

  return { data, error, loading, refetch };
}

/** Devuelve una función para ejecutar una mutación y su estado de carga. */
export function useMutation<T, V extends Record<string, unknown> = Record<string, unknown>>(
  mutation: string,
) {
  const [loading, setLoading] = useState(false);
  const run = useCallback(
    async (variables?: V) => {
      setLoading(true);
      try {
        return await gqlRequest<T>(mutation, variables);
      } finally {
        setLoading(false);
      }
    },
    [mutation],
  );
  return [run, { loading }] as const;
}
