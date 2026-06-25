export const JUZGADO_TIPOS = [
  'Civil',
  'Penal',
  'Laboral',
  'Familiar',
  'Mercantil',
  'Administrativo',
  'Otro',
];

const TIPO_KEYWORDS: { keywords: string[]; tipo: string }[] = [
  { keywords: ['civil', 'comercial'], tipo: 'Civil' },
  { keywords: ['penal', 'criminal', 'crimen'], tipo: 'Penal' },
  { keywords: ['laboral', 'trabajo', 'obrero'], tipo: 'Laboral' },
  { keywords: ['familiar', 'familia', 'niñez', 'adolescencia', 'menores'], tipo: 'Familiar' },
  { keywords: ['mercantil'], tipo: 'Mercantil' },
  { keywords: ['administrativo', 'contencioso'], tipo: 'Administrativo' },
];

export function inferJuzgadoTipo(nombre: string): string {
  const lower = nombre.toLowerCase();
  for (const { keywords, tipo } of TIPO_KEYWORDS) {
    if (keywords.some((kw) => lower.includes(kw))) return tipo;
  }
  return '';
}
