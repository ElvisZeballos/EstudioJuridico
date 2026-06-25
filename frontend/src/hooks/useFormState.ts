import { useState } from 'react';
import axios from 'axios';

export function useFormState<T>(initial: T) {
  const [form, setForm] = useState<T>(initial);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function reset(values?: T) {
    setForm(values ?? initial);
    setFormError('');
    setFieldErrors({});
  }

  function patch(partial: Partial<T>) {
    setForm((prev) => ({ ...prev, ...partial }));
  }

  async function submit(action: () => Promise<void>) {
    setFormError('');
    setIsSaving(true);
    try {
      await action();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setFormError(err.response?.data?.error || 'Error al guardar.');
      } else {
        setFormError('Error de conexión.');
      }
    } finally {
      setIsSaving(false);
    }
  }

  return { form, setForm, patch, isSaving, formError, setFormError, fieldErrors, setFieldErrors, reset, submit };
}
