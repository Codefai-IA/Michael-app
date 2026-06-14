import { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, X, RotateCcw, Check, Loader2, CameraOff } from 'lucide-react';
import styles from './CameraCapture.module.css';

interface CameraCaptureProps {
  isOpen: boolean;
  title?: string;
  subtitle?: string;
  /** Chamado quando o usuário confirma a foto. Recebe o blob (JPEG) e o instante exato do clique. */
  onCapture: (blob: Blob, takenAt: Date) => void | Promise<void>;
  /** Se ausente, a câmera é OBRIGATÓRIA e não pode ser fechada sem capturar. */
  onCancel?: () => void;
  /** Estado externo: true enquanto o pai faz upload. Bloqueia interações. */
  uploading?: boolean;
}

type CamStatus = 'starting' | 'ready' | 'denied' | 'unavailable';

/**
 * Câmera in-app (antifraude). Abre o stream nativo via getUserMedia e captura o
 * frame ao vivo para um canvas. NÃO usa <input type="file"> em momento algum,
 * portanto a galeria fica realmente bloqueada — não há seletor de arquivos.
 */
export function CameraCapture({
  isOpen,
  title = 'Tire a foto',
  subtitle,
  onCapture,
  onCancel,
  uploading = false,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CamStatus>('starting');
  const [preview, setPreview] = useState<{ url: string; blob: Blob; takenAt: Date } | null>(null);

  const isMandatory = !onCancel;

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startStream = useCallback(async () => {
    setStatus('starting');
    // Sem suporte a câmera no dispositivo/navegador
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unavailable');
      return;
    }
    try {
      let stream: MediaStream;
      try {
        // Preferir câmera traseira
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
      } catch {
        // Fallback para qualquer câmera disponível
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setStatus('ready');
    } catch (err) {
      // Permissão negada vs. sem dispositivo
      const name = (err as DOMException)?.name;
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setStatus('denied');
      } else {
        setStatus('unavailable');
      }
    }
  }, []);

  // Liga/desliga o stream conforme o modal abre/fecha
  useEffect(() => {
    if (isOpen) {
      setPreview(null);
      startStream();
    } else {
      stopStream();
      setPreview(null);
    }
    return () => stopStream();
  }, [isOpen, startStream, stopStream]);

  // Revoga a URL de preview ao trocar/desmontar
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  function handleCapture() {
    const video = videoRef.current;
    if (!video || status !== 'ready') return;

    // Instante EXATO do clique (marca d'água/auditoria)
    const takenAt = new Date();

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1080;
    canvas.height = video.videoHeight || 1920;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        stopStream();
        setPreview({ url: URL.createObjectURL(blob), blob, takenAt });
      },
      'image/jpeg',
      0.85
    );
  }

  function handleRetake() {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
    startStream();
  }

  async function handleConfirm() {
    if (!preview) return;
    await onCapture(preview.blob, preview.takenAt);
  }

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h2 className={styles.title}>{title}</h2>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        {!isMandatory && (
          <button
            className={styles.closeBtn}
            onClick={onCancel}
            disabled={uploading}
            aria-label="Fechar"
          >
            <X size={22} />
          </button>
        )}
      </div>

      <div className={styles.stage}>
        {/* Preview da foto capturada */}
        {preview ? (
          <img src={preview.url} alt="Foto capturada" className={styles.media} />
        ) : (
          <>
            <video
              ref={videoRef}
              className={styles.media}
              playsInline
              muted
              autoPlay
            />
            {status === 'starting' && (
              <div className={styles.stateMsg}>
                <Loader2 size={36} className={styles.spin} />
                <p>Abrindo a câmera…</p>
              </div>
            )}
            {status === 'denied' && (
              <div className={styles.stateMsg}>
                <CameraOff size={40} />
                <p className={styles.stateTitle}>Câmera bloqueada</p>
                <p className={styles.stateHint}>
                  Para registrar o check-in, habilite a permissão de câmera nas
                  configurações do navegador e tente novamente.
                </p>
                <button className={styles.retryBtn} onClick={startStream}>
                  Tentar de novo
                </button>
              </div>
            )}
            {status === 'unavailable' && (
              <div className={styles.stateMsg}>
                <CameraOff size={40} />
                <p className={styles.stateTitle}>Sem câmera disponível</p>
                <p className={styles.stateHint}>
                  Este check-in exige uma foto tirada na hora. Abra o app em um
                  celular com câmera para concluir.
                </p>
                <button className={styles.retryBtn} onClick={startStream}>
                  Tentar de novo
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div className={styles.controls}>
        {preview ? (
          <>
            <button
              className={styles.secondaryBtn}
              onClick={handleRetake}
              disabled={uploading}
            >
              <RotateCcw size={20} />
              <span>Tirar outra</span>
            </button>
            <button
              className={styles.primaryBtn}
              onClick={handleConfirm}
              disabled={uploading}
            >
              {uploading ? <Loader2 size={20} className={styles.spin} /> : <Check size={20} />}
              <span>{uploading ? 'Enviando…' : 'Usar foto'}</span>
            </button>
          </>
        ) : (
          <button
            className={styles.shutterBtn}
            onClick={handleCapture}
            disabled={status !== 'ready'}
            aria-label="Capturar foto"
          >
            <Camera size={28} />
          </button>
        )}
      </div>
    </div>
  );
}
