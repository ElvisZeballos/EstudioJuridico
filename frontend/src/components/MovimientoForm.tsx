import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input, Textarea } from './ui/Input';
import type { MovimientoFormData, TipoMovimiento } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  form: MovimientoFormData;
  setForm: React.Dispatch<React.SetStateAction<MovimientoFormData>>;
  isSaving: boolean;
  formError: string;
  fieldErrors: Record<string, string>;
  isEditing: boolean;
}

export function MovimientoForm({
  isOpen,
  onClose,
  onSubmit,
  form,
  setForm,
  isSaving,
  formError,
  fieldErrors,
  isEditing,
}: Props) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Editar movimiento' : 'Nuevo movimiento'}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button type="submit" form="movimiento-form" isLoading={isSaving}>
            {isEditing ? 'Guardar cambios' : 'Crear registro'}
          </Button>
        </>
      }
    >
      <form
        id="movimiento-form"
        onSubmit={onSubmit}
        className="space-y-4"
        autoComplete="off"
        noValidate
      >
        {formError && (
          <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
            {formError}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo *</label>
          <div className="flex rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden">
            {(['INGRESO', 'EGRESO'] as TipoMovimiento[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setForm((p) => ({ ...p, tipo: t }))}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  form.tipo === t
                    ? t === 'INGRESO'
                      ? 'bg-green-500 text-white'
                      : 'bg-red-500 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {t === 'INGRESO' ? '↑ Ingreso' : '↓ Egreso'}
              </button>
            ))}
          </div>
        </div>

        <Input
          label="Concepto *"
          value={form.concepto}
          onChange={(e) => setForm((p) => ({ ...p, concepto: e.target.value }))}
          placeholder="Ej: Honorarios, fotocopias, notificación..."
          error={fieldErrors.concepto}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Monto *"
            type="number"
            min="0"
            step="0.01"
            value={String(form.monto)}
            onChange={(e) => setForm((p) => ({ ...p, monto: e.target.value }))}
            placeholder="0.00"
            error={fieldErrors.monto}
          />
          <Input
            label="Fecha *"
            type="date"
            value={form.fecha}
            onChange={(e) => setForm((p) => ({ ...p, fecha: e.target.value }))}
            error={fieldErrors.fecha}
          />
        </div>

        <Textarea
          label="Notas"
          rows={2}
          value={form.notas ?? ''}
          onChange={(e) => setForm((p) => ({ ...p, notas: e.target.value }))}
          placeholder="Observaciones opcionales..."
        />
      </form>
    </Modal>
  );
}
