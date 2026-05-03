import { useEffect, useRef, useState } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { whatsappApi } from '../services/api';

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Phase = 'loading' | 'qr' | 'connected' | 'error';

export function WhatsAppModal({ isOpen, onClose }: WhatsAppModalProps) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [qr, setQr] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const startPolling = () => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const data = await whatsappApi.getStatus();
        if (data.status === 'CONNECTED') {
          stopPolling();
          setPhase('connected');
          setQr(null);
          return;
        }
        if (data.qr) {
          setQr(data.qr);
          setPhase('qr');
        }
      } catch {}
    }, 2000);
  };

  const init = async () => {
    setPhase('loading');
    setQr(null);
    setErrorMsg('');
    stopPolling();
    try {
      await whatsappApi.connect();
      startPolling();
    } catch {
      setErrorMsg('Error al conectar con WhatsApp. Intenta de nuevo.');
      setPhase('error');
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopPolling();
      setPhase('loading');
      setQr(null);
      setErrorMsg('');
      return;
    }
    init();
    return () => stopPolling();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleDisconnect = async () => {
    stopPolling();
    try { await whatsappApi.disconnect(); } catch {}
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Conectar WhatsApp" size="sm">
      <div className="flex flex-col items-center gap-5 py-2">

        {/* Loading */}
        {phase === 'loading' && (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Generando código QR…</p>
          </div>
        )}

        {/* QR */}
        {phase === 'qr' && qr && (
          <>
            <div className="p-3 bg-white rounded-2xl shadow-md border border-gray-100">
              <img src={qr} alt="WhatsApp QR" className="w-56 h-56" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Escanea con WhatsApp
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Abre WhatsApp → Dispositivos vinculados → Vincular dispositivo
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Esperando escaneo…
            </div>
          </>
        )}

        {/* Connected */}
        {phase === 'connected' && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="text-center">
              <p className="font-semibold text-gray-900 dark:text-white">WhatsApp conectado</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Tu cuenta está vinculada correctamente
              </p>
            </div>
            <div className="flex gap-3 w-full">
              <Button variant="outline" size="sm" onClick={onClose} className="flex-1">
                Cerrar
              </Button>
              <Button variant="danger" size="sm" onClick={handleDisconnect} className="flex-1">
                Desconectar
              </Button>
            </div>
          </div>
        )}

        {/* Error */}
        {phase === 'error' && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-sm text-center text-gray-600 dark:text-gray-400">{errorMsg}</p>
            <Button size="sm" onClick={init}>
              Intentar de nuevo
            </Button>
          </div>
        )}

      </div>
    </Modal>
  );
}
