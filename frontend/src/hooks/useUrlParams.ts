import { useSearchParams } from 'react-router-dom';

/** Lee y escribe filtros en la URL (?clave=valor). Un valor vacío borra la clave. */
export function useUrlParams() {
  const [searchParams, setSearchParams] = useSearchParams();

  function get(key: string, fallback = ''): string {
    return searchParams.get(key) ?? fallback;
  }

  function set(updates: Record<string, string>) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(updates).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
        return next;
      },
      { replace: true },
    );
  }

  return { get, set };
}
