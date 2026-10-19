interface Props {
  expandido: boolean;
  total: number;
  visibles: number;
  onToggle: () => void;
  className?: string;
}

/** Botón "Ver más (N) / Ver menos" para listas recortadas. No muestra nada si todo cabe. */
export function VerMas({ expandido, total, visibles, onToggle, className = '' }: Props) {
  if (total <= visibles) return null;
  return (
    <div className={`pt-3 text-center ${className}`}>
      <button
        type="button"
        onClick={onToggle}
        className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
      >
        {expandido ? 'Ver menos' : `Ver más (${total - visibles} más)`}
      </button>
    </div>
  );
}
