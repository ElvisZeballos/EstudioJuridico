interface Props {
  expandido: boolean;
  onToggle: () => void;
  label?: string;
}

/** Flecha que apunta hacia abajo (desplegar) y hacia arriba (recoger). */
export function ChevronToggle({ expandido, onToggle, label = 'Mostrar más' }: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expandido}
      aria-label={expandido ? 'Mostrar menos' : label}
      title={expandido ? 'Mostrar menos' : label}
      className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
    >
      <svg
        className={`w-5 h-5 transition-transform duration-200 ${expandido ? 'rotate-180' : ''}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );
}