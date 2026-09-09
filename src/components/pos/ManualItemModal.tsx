import React, { useState } from 'react'
import type { SaleItem } from '../../types'
import { IconX, IconCheck } from '../icons/Icons'
import { formatRupiah } from '../../utils/printer'

interface ManualItemModalProps {
  isOpen: boolean
  onClose: () => void
  onAddManualItem: (item: SaleItem) => void
}

export const ManualItemModal: React.FC<ManualItemModalProps> = ({
  isOpen,
  onClose,
  onAddManualItem
}) => {
  const [name, setName] = useState('Barang Non-Katalog')
  const [priceInput, setPriceInput] = useState('')
  const [qty, setQty] = useState(1)

  if (!isOpen) return null

  const handlePriceChange = (val: string) => {
    const raw = val.replace(/\D/g, '')
    const num = parseInt(raw, 10) || 0
    setPriceInput(num ? num.toLocaleString('id-ID') : '')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const price = parseInt(priceInput.replace(/\D/g, ''), 10) || 0
    if (price <= 0) return

    const newItem: SaleItem = {
      id: crypto.randomUUID ? crypto.randomUUID() : 'item_' + Date.now(),
      sale_id: '',
      product_id: 'manual_' + Date.now(),
      product_name: name.trim() || 'Barang Manual',
      unit: 'pcs',
      quantity: qty,
      price,
      cost: 0,
      discount: 0,
      subtotal: price * qty,
      synced: false
    }

    onAddManualItem(newItem)
    onClose()
  }

  const price = parseInt(priceInput.replace(/\D/g, ''), 10) || 0

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: '420px' }}>
        <div className="modal-header">
          <h3 style={{ fontSize: '1.1rem' }}>Input Harga Manual</h3>
          <button type="button" onClick={onClose} className="btn-ghost btn-sm">
            <IconX size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Keterangan / Nama Barang
              </label>
              <input
                type="text"
                placeholder="Contoh: Es Batu, Kantong Kresek, Jasa"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Harga Satuan (Rp) *
                </label>
                <input
                  type="text"
                  className="mono"
                  placeholder="0"
                  style={{ fontSize: '1.2rem', fontWeight: 700 }}
                  value={priceInput}
                  onChange={e => handlePriceChange(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Qty
                </label>
                <input
                  type="number"
                  min="1"
                  className="mono"
                  style={{ fontSize: '1.2rem', fontWeight: 700 }}
                  value={qty}
                  onChange={e => setQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                />
              </div>
            </div>

            <div style={{
              backgroundColor: 'var(--bg-surface-subtle)',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total:</span>
              <strong className="mono" style={{ fontSize: '1.2rem' }}>
                {formatRupiah(price * qty)}
              </strong>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">
              Batal
            </button>
            <button type="submit" className="btn-primary" disabled={price <= 0}>
              <IconCheck size={18} /> Tambah ke Keranjang
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
