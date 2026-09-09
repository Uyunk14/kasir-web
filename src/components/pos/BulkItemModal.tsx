import React, { useState } from 'react'
import type { Product } from '../../types'
import { IconX, IconCheck } from '../icons/Icons'
import { formatRupiah } from '../../utils/printer'

interface BulkItemModalProps {
  product: Product | null
  isOpen: boolean
  onClose: () => void
  onConfirm: (product: Product, quantity: number) => void
}

export const BulkItemModal: React.FC<BulkItemModalProps> = ({
  product,
  isOpen,
  onClose,
  onConfirm
}) => {
  const [quantity, setQuantity] = useState<number>(1)
  const [quantityInput, setQuantityInput] = useState<string>('1')

  if (!isOpen || !product) return null

  const handleInputChange = (val: string) => {
    // replace commas with dots for indonesian locale
    const normalized = val.replace(',', '.')
    setQuantityInput(normalized)
    const parsed = parseFloat(normalized)
    if (!isNaN(parsed) && parsed > 0) {
      setQuantity(parsed)
    }
  }

  const subtotal = Math.round(product.sell_price * quantity)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (quantity > 0) {
      onConfirm(product, quantity)
      onClose()
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: '400px' }}>
        <div className="modal-header">
          <div>
            <h3 style={{ fontSize: '1.1rem' }}>Timbang Barang Curah</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {product.name} ({formatRupiah(product.sell_price)} / {product.unit})
            </span>
          </div>
          <button type="button" onClick={onClose} className="btn-ghost btn-sm">
            <IconX size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Jumlah / Berat ({product.unit}) *
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="text"
                  className="mono"
                  style={{ fontSize: '1.5rem', fontWeight: 700 }}
                  value={quantityInput}
                  onChange={e => handleInputChange(e.target.value)}
                  autoFocus
                />
                <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-secondary)' }}>
                  {product.unit}
                </span>
              </div>
            </div>

            {/* Quick Presets */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
              {[0.25, 0.5, 1, 2].map(amt => (
                <button
                  key={amt}
                  type="button"
                  className="btn-secondary btn-sm mono"
                  onClick={() => {
                    setQuantity(amt)
                    setQuantityInput(amt.toString())
                  }}
                >
                  {amt} {product.unit}
                </button>
              ))}
            </div>

            {/* Subtotal preview card */}
            <div style={{
              backgroundColor: 'var(--bg-surface-subtle)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem 1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Subtotal Harga:
              </span>
              <strong className="mono" style={{ fontSize: '1.3rem', color: 'var(--text-primary)' }}>
                {formatRupiah(subtotal)}
              </strong>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">
              Batal
            </button>
            <button type="submit" className="btn-primary">
              <IconCheck size={18} /> Masukkan Keranjang
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
