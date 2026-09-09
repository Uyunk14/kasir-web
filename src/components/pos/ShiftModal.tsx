import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { db } from '../../db/db'
import { IconX, IconCheck, IconCash, IconAlert } from '../icons/Icons'

interface ShiftModalProps {
  isOpen: boolean
  onClose: () => void
}

export const ShiftModal: React.FC<ShiftModalProps> = ({ isOpen, onClose }) => {
  const { activeShift, openCashierShift, closeCashierShift } = useAuth()
  
  // Open Shift Form State
  const [openingCashInput, setOpeningCashInput] = useState<string>('100.000')

  // Close Shift Form State
  const [closingCashInput, setClosingCashInput] = useState<string>('')
  const [shiftNotes, setShiftNotes] = useState<string>('')
  const [shiftStats, setShiftStats] = useState<{
    openingCash: number
    cashSales: number
    cashExpenses: number
    expectedCash: number
  }>({
    openingCash: 0,
    cashSales: 0,
    cashExpenses: 0,
    expectedCash: 0
  })

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen && activeShift) {
      loadActiveShiftData()
    }
  }, [isOpen, activeShift])

  const loadActiveShiftData = async () => {
    if (!activeShift) return
    try {
      const sales = await db.sales
        .where('shift_id')
        .equals(activeShift.id)
        .and(s => s.status === 'completed')
        .toArray()

      let cashSales = 0
      for (const s of sales) {
        const payments = await db.sale_payments.where('sale_id').equals(s.id).toArray()
        for (const p of payments) {
          if (p.method === 'cash') {
            cashSales += p.amount
          }
        }
        cashSales -= s.change_amount
      }

      const expenses = await db.expenses
        .where('shift_id')
        .equals(activeShift.id)
        .toArray()
      const cashExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)

      const expected = activeShift.opening_cash + cashSales - cashExpenses
      setShiftStats({
        openingCash: activeShift.opening_cash,
        cashSales,
        cashExpenses,
        expectedCash: expected
      })
      setClosingCashInput(expected.toString())
    } catch (err) {
      console.error('Error loading shift stats:', err)
    }
  }

  if (!isOpen) return null

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    try {
      const amount = parseInt(openingCashInput.replace(/\D/g, ''), 10) || 0
      await openCashierShift(amount)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Gagal membuka shift')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    try {
      const actualClosing = parseInt(closingCashInput.replace(/\D/g, ''), 10) || 0
      await closeCashierShift(actualClosing, shiftNotes)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Gagal menutup shift')
    } finally {
      setIsLoading(false)
    }
  }

  const actualClosing = parseInt(closingCashInput.replace(/\D/g, ''), 10) || 0
  const difference = actualClosing - shiftStats.expectedCash

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <IconCash size={20} />
            {activeShift ? 'Tutup Buku / Shift Kasir' : 'Buka Shift Baru (Modal Laci)'}
          </h3>
          <button type="button" onClick={onClose} className="btn-ghost btn-sm">
            <IconX size={18} />
          </button>
        </div>

        {error && (
          <div style={{
            margin: '1rem 1.5rem 0',
            padding: '0.75rem',
            backgroundColor: 'var(--status-danger-bg)',
            border: '1px solid var(--status-danger-border)',
            color: 'var(--status-danger-text)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <IconAlert size={16} />
            <span>{error}</span>
          </div>
        )}

        {!activeShift ? (
          /* Buka Shift */
          <form onSubmit={handleOpenShift}>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Masukkan modal kas awal di laci kasir untuk uang kembalian transaksi.
              </p>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Jumlah Modal Awal (Rp)
                </label>
                <input
                  type="text"
                  className="mono"
                  style={{ fontSize: '1.25rem', fontWeight: 700 }}
                  value={openingCashInput}
                  onChange={e => {
                    const raw = e.target.value.replace(/\D/g, '')
                    const num = parseInt(raw, 10) || 0
                    setOpeningCashInput(num.toLocaleString('id-ID'))
                  }}
                  required
                />
              </div>

              {/* Quick Preset Buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                {[50000, 100000, 200000, 500000].map(amount => (
                  <button
                    key={amount}
                    type="button"
                    className="btn-secondary btn-sm mono"
                    onClick={() => setOpeningCashInput(amount.toLocaleString('id-ID'))}
                  >
                    Rp {(amount / 1000).toLocaleString('id-ID')}k
                  </button>
                ))}
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" onClick={onClose} className="btn-secondary">
                Batal
              </button>
              <button type="submit" className="btn-primary" disabled={isLoading}>
                <IconCheck size={18} />
                {isLoading ? 'Membuka...' : 'Buka Shift'}
              </button>
            </div>
          </form>
        ) : (
          /* Tutup Shift */
          <form onSubmit={handleCloseShift}>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{
                backgroundColor: 'var(--bg-surface-subtle)',
                padding: '1rem',
                borderRadius: 'var(--radius-lg)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Kas Awal Laci:</span>
                  <span className="mono font-bold">
                    Rp {shiftStats.openingCash.toLocaleString('id-ID')}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Penjualan Tunai:</span>
                  <span className="mono font-bold text-success">
                    + Rp {shiftStats.cashSales.toLocaleString('id-ID')}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Pengeluaran Kas:</span>
                  <span className="mono font-bold text-danger">
                    - Rp {shiftStats.cashExpenses.toLocaleString('id-ID')}
                  </span>
                </div>
                <hr style={{ border: 'none', borderTop: '1px solid var(--border-default)' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', fontWeight: 700 }}>
                  <span>Total Kas Seharusnya:</span>
                  <span className="mono">
                    Rp {shiftStats.expectedCash.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Kas Akhir Fisik Aktual di Laci (Rp) *
                </label>
                <input
                  type="text"
                  className="mono"
                  style={{ fontSize: '1.2rem', fontWeight: 700 }}
                  value={closingCashInput}
                  onChange={e => {
                    const raw = e.target.value.replace(/\D/g, '')
                    const num = parseInt(raw, 10) || 0
                    setClosingCashInput(num.toLocaleString('id-ID'))
                  }}
                  required
                />
              </div>

              {/* Difference badge */}
              <div style={{
                padding: '0.6rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: difference === 0
                  ? 'var(--status-success-bg)'
                  : difference > 0
                  ? 'var(--status-info-bg)'
                  : 'var(--status-danger-bg)',
                color: difference === 0
                  ? 'var(--status-success-text)'
                  : difference > 0
                  ? 'var(--status-info-text)'
                  : 'var(--status-danger-text)',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.85rem',
                fontWeight: 600
              }}>
                <span>Selisih Kas:</span>
                <span className="mono">
                  {difference === 0
                    ? 'Pas (Sesuai)'
                    : `${difference > 0 ? '+ ' : '- '}Rp ${Math.abs(difference).toLocaleString('id-ID')} (${difference > 0 ? 'Lebih' : 'Kurang'})`}
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Catatan Tutup Shift (Opsional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Keterangan jika terdapat selisih kas..."
                  value={shiftNotes}
                  onChange={e => setShiftNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" onClick={onClose} className="btn-secondary">
                Batal
              </button>
              <button type="submit" className="btn-danger" disabled={isLoading}>
                <IconCheck size={18} />
                {isLoading ? 'Menutup...' : 'Tutup Shift Sekarang'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
