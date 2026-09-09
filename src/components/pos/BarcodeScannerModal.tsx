import React, { useState, useEffect, useRef } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { IconX, IconCameraSwitch, IconAlert, IconCheck, IconCamera } from '../icons/Icons'

interface BarcodeScannerModalProps {
  isOpen: boolean
  onClose: () => void
  onScanSuccess: (barcode: string) => void
  title?: string
}

// Audio beep generator using Web Audio API
function playBeep() {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(1400, audioCtx.currentTime)
    gain.gain.setValueAtTime(0.25, audioCtx.currentTime)
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.start()
    osc.stop(audioCtx.currentTime + 0.12)
  } catch (e) {
    // Ignore audio context errors
  }
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  title = 'Scan Barcode Kamera'
}) => {
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [manualCode, setManualCode] = useState('')
  const [error, setError] = useState('')
  const [isInitializing, setIsInitializing] = useState(true)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const scannerContainerId = 'interactive-barcode-reader'

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop()
        }
        scannerRef.current.clear()
      } catch (e) {
        console.warn('Stop scanner error:', e)
      }
      scannerRef.current = null
    }
  }

  const startScanner = async (mode: 'environment' | 'user') => {
    setIsInitializing(true)
    setError('')

    // Stop existing instance if any
    await stopScanner()

    // Wait a frame to ensure DOM container is mounted
    await new Promise(resolve => setTimeout(resolve, 80))

    const container = document.getElementById(scannerContainerId)
    if (!container) {
      setIsInitializing(false)
      return
    }

    try {
      const html5QrCode = new Html5Qrcode(scannerContainerId)
      scannerRef.current = html5QrCode

      const config = {
        fps: 15,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const width = Math.min(viewfinderWidth * 0.85, 320)
          const height = Math.min(viewfinderHeight * 0.55, 180)
          return { width: Math.floor(width), height: Math.floor(height) }
        },
        aspectRatio: 1.333333,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.QR_CODE
        ]
      }

      await html5QrCode.start(
        { facingMode: mode },
        config,
        (decodedText) => {
          playBeep()
          stopScanner().then(() => {
            onScanSuccess(decodedText)
            onClose()
          })
        },
        () => {
          // Scan frame miss, normal behavior while scanning
        }
      )

      setIsInitializing(false)
    } catch (err: any) {
      console.error('Html5Qrcode start error:', err)
      setIsInitializing(false)
      setError(
        err?.message?.includes('Permission') || err?.name === 'NotAllowedError'
          ? 'Izin akses kamera ditolak. Harap izinkan akses kamera di browser Anda.'
          : 'Kamera tidak dapat diakses atau sedang digunakan oleh aplikasi lain. Anda dapat memasukkan kode barcode di bawah ini.'
      )
    }
  }

  useEffect(() => {
    if (isOpen) {
      startScanner(facingMode)
    } else {
      stopScanner()
    }

    return () => {
      stopScanner()
    }
  }, [isOpen, facingMode])

  const toggleFacingMode = () => {
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'))
  }

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (manualCode.trim()) {
      playBeep()
      stopScanner().then(() => {
        onScanSuccess(manualCode.trim())
        setManualCode('')
        onClose()
      })
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: '440px', overflow: 'hidden' }}>
        <div className="modal-header">
          <h3 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <IconCamera size={18} />
            <span>{title}</span>
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
              minHeight: '260px',
              backgroundColor: '#0a0a0c',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {isInitializing && (
                <div style={{
                  position: 'absolute',
                  zIndex: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: '#fff',
                  fontSize: '0.85rem'
                }}>
                  <div className="spin" style={{ width: '24px', height: '24px', border: '3px solid #fff', borderTopColor: 'transparent', borderRadius: '50%' }} />
                  <span>Membuka kamera...</span>
                </div>
              )}

              {/* Viewport container for Html5Qrcode */}
              <div
                id={scannerContainerId}
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: 'var(--radius-lg)',
                  overflow: 'hidden'
                }}
              />
            </div>
          )}

          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>
            Arahkan kamera ke barcode produk (EAN-13, UPC, Code 128, dll.) hingga terdengar bunyi beep.
          </p>

          {/* Manual Barcode Input Fallback */}
          <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="Atau ketik angka barcode di sini..."
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
