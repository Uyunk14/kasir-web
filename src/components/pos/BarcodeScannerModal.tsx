import React, { useState, useEffect, useRef } from 'react'
import { IconX, IconCameraSwitch, IconAlert, IconCheck } from '../icons/Icons'

interface BarcodeScannerModalProps {
  isOpen: boolean
  onClose: () => void
  onScanSuccess: (barcode: string) => void
}

// Audio beep generator using Web Audio API
function playBeep() {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(1400, audioCtx.currentTime)
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime)
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.start()
    osc.stop(audioCtx.currentTime + 0.1)
  } catch (e) {
    // Ignore audio errors
  }
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [manualCode, setManualCode] = useState('')
  const [error, setError] = useState('')
  const [isSupported, setIsSupported] = useState(true)
  const streamRef = useRef<MediaStream | null>(null)
  const scanIntervalRef = useRef<any>(null)

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }

  const startCamera = async (mode: 'environment' | 'user') => {
    stopCamera()
    setError('')
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Kamera tidak didukung di browser ini.')
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      })

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      // Check if native BarcodeDetector API is supported
      if ('BarcodeDetector' in window) {
        const barcodeDetector = new (window as any).BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'code_128', 'qr_code', 'upc_a', 'upc_e', 'code_39']
        })

        scanIntervalRef.current = setInterval(async () => {
          if (videoRef.current && videoRef.current.readyState >= 2) {
            try {
              const barcodes = await barcodeDetector.detect(videoRef.current)
              if (barcodes.length > 0) {
                const detectedCode = barcodes[0].rawValue
                if (detectedCode) {
                  playBeep()
                  stopCamera()
                  onScanSuccess(detectedCode)
                  onClose()
                }
              }
            } catch (err) {
              // Ignore frame detection err
            }
          }
        }, 300)
      } else {
        setIsSupported(false)
      }
    } catch (err: any) {
      console.error('Camera access error:', err)
      setError(err.message || 'Gagal mengakses kamera')
    }
  }

  useEffect(() => {
    if (isOpen) {
      startCamera(facingMode)
    } else {
      stopCamera()
    }
    return () => stopCamera()
  }, [isOpen, facingMode])

  const toggleFacingMode = () => {
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'))
  }

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (manualCode.trim()) {
      playBeep()
      stopCamera()
      onScanSuccess(manualCode.trim())
      setManualCode('')
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: '440px', overflow: 'hidden' }}>
        <div className="modal-header">
          <h3 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>Scan Barcode Kamera</span>
            <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
              {facingMode === 'environment' ? 'Kamera Belakang' : 'Kamera Depan'}
            </span>
          </h3>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <button
              type="button"
              onClick={toggleFacingMode}
              className="btn-ghost btn-sm"
              title="Ganti Kamera Depan/Belakang"
            >
              <IconCameraSwitch size={18} />
            </button>
            <button type="button" onClick={onClose} className="btn-ghost btn-sm">
              <IconX size={18} />
            </button>
          </div>
        </div>

        <div className="modal-body" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error ? (
            <div style={{
              padding: '1rem',
              backgroundColor: 'var(--status-danger-bg)',
              color: 'var(--status-danger-text)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <IconAlert size={18} />
              <span>{error}</span>
            </div>
          ) : (
            <div style={{
              position: 'relative',
              width: '100%',
              height: '240px',
              backgroundColor: '#000',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <video
                ref={videoRef}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                playsInline
                muted
              />
              
              {/* Scan target reticle overlay */}
              <div style={{
                position: 'absolute',
                width: '70%',
                height: '55%',
                border: '2px solid rgba(255, 255, 255, 0.75)',
                borderRadius: '12px',
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.35)',
                pointerEvents: 'none'
              }}>
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: 0,
                  right: 0,
                  height: '2px',
                  backgroundColor: '#EF4444',
                  boxShadow: '0 0 8px #EF4444'
                }} />
              </div>
            </div>
          )}

          {!isSupported && !error && (
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              Catatan: Browser tidak memiliki API BarcodeDetector native. Anda dapat memasukkan kode barcode di bawah ini.
            </p>
          )}

          {/* Manual Barcode Input Fallback */}
          <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="Atau ketik barcode di sini..."
              className="mono"
              value={manualCode}
              onChange={e => setManualCode(e.target.value)}
              autoFocus
            />
            <button type="submit" className="btn-primary" style={{ flexShrink: 0 }}>
              <IconCheck size={16} /> Pilih
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
