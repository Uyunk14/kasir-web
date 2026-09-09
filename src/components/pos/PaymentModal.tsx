import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { db } from '../../db/db'
import type { Customer, Sale, SaleItem, SalePayment } from '../../types'
import {
  IconX,
  IconCheck,
  IconCash,
  IconQrcode,
  IconUsers,
  IconPrinter,
  IconShare,
  IconAlert,
  IconPlus
} from '../icons/Icons'
import {
  formatRupiah,
  printViaBluetooth,
  shareReceiptToWhatsApp,
  generateTextReceipt
} from '../../utils/printer'

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  subtotal: number
  discount: number
  total: number
  items: SaleItem[]
  selectedCustomer: Customer | null
  onSuccessTransaction: (sale: Sale, items: SaleItem[], payments: SalePayment[]) => void
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  subtotal,
  discount,
  total,
  items,
  selectedCustomer,
  onSuccessTransaction
}) => {
  const { currentUser, storeSetting, activeShift } = useAuth()
  
  // Tabs: 'cash' | 'qris' | 'split'
  const [method, setMethod] = useState<'cash' | 'qris' | 'split'>('cash')
  const [cashGiven, setCashGiven] = useState<number>(total)
  const [cashGivenInput, setCashGivenInput] = useState<string>(total.toLocaleString('id-ID'))
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customer, setCustomer] = useState<Customer | null>(selectedCustomer)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState('')

  // Receipt printed / finished state
  const [completedSale, setCompletedSale] = useState<{
    sale: Sale
    items: SaleItem[]
    payments: SalePayment[]
  } | null>(null)
  const [bluetoothStatus, setBluetoothStatus] = useState<string>('')

  useEffect(() => {
    if (isOpen) {
      setCompletedSale(null)
      setBluetoothStatus('')
      setError('')
      setCashGiven(total)
      setCashGivenInput(total.toLocaleString('id-ID'))
      setCustomer(selectedCustomer)
      loadCustomers()
    }
  }, [isOpen, total, selectedCustomer])

  const loadCustomers = async () => {
    try {
      const list = await db.customers.toArray()
      setCustomers(list)
    } catch (err) {
      console.error(err)
    }
  }

  if (!isOpen) return null

  const handleCashInput = (val: string) => {
    const raw = val.replace(/\D/g, '')
    const num = parseInt(raw, 10) || 0
    setCashGiven(num)
    setCashGivenInput(num.toLocaleString('id-ID'))
  }

  const setPresetCash = (num: number) => {
    setCashGiven(num)
    setCashGivenInput(num.toLocaleString('id-ID'))
  }

  // Perhitungan kembalian & sisa kasbon
  let changeAmount = 0
  let debtAmount = 0

  if (method === 'cash') {
    if (cashGiven >= total) {
      changeAmount = cashGiven - total
      debtAmount = 0
    } else {
      // Kurang bayar tunai -> otomatis menjadi utang jika ada pelanggan
      changeAmount = 0
      debtAmount = total - cashGiven
    }
  } else if (method === 'split') {
    // Bayar tunai sebagian, sisa jadi kasbon
    if (cashGiven < total) {
      debtAmount = total - cashGiven
      changeAmount = 0
    } else {
      debtAmount = 0
      changeAmount = cashGiven - total
    }
  } else {
    // QRIS pas
    changeAmount = 0
    debtAmount = 0
  }

  const handleProcessCheckout = async () => {
    setError('')

    // Jika ada sisa utang / kasbon, wajib ada pelanggan
    if (debtAmount > 0 && !customer) {
      setError('Terdapat sisa pembayaran Rp ' + debtAmount.toLocaleString('id-ID') + '. Harap pilih Pelanggan untuk pencatatan Kasbon!')
      return
    }

    if (!currentUser) {
      setError('Sesi kasir tidak valid')
      return
    }

    setIsProcessing(true)

    try {
      const now = new Date().toISOString()
      const saleId = crypto.randomUUID ? crypto.randomUUID() : 'sale_' + Date.now()
      const invoiceNo = 'INV' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + '-' + Math.floor(1000 + Math.random() * 9000)

      let paidAmount = 0
      const payments: SalePayment[] = []

      if (method === 'cash') {
        const cashAmount = Math.min(cashGiven, total)
        paidAmount += cashAmount
        payments.push({
          id: crypto.randomUUID(),
          sale_id: saleId,
          method: 'cash',
          amount: cashGiven,
          synced: false
        })

        if (debtAmount > 0 && customer) {
          payments.push({
            id: crypto.randomUUID(),
            sale_id: saleId,
            method: 'debt',
            amount: debtAmount,
            synced: false
          })
        }
      } else if (method === 'split') {
        paidAmount += cashGiven
        payments.push({
          id: crypto.randomUUID(),
          sale_id: saleId,
          method: 'cash',
          amount: cashGiven,
          synced: false
        })
        if (debtAmount > 0 && customer) {
          payments.push({
            id: crypto.randomUUID(),
            sale_id: saleId,
            method: 'debt',
            amount: debtAmount,
            synced: false
          })
        }
      } else {
        // QRIS
        paidAmount = total
        payments.push({
          id: crypto.randomUUID(),
          sale_id: saleId,
          method: 'qris',
          amount: total,
          synced: false
        })
      }

      let paymentSummary = method === 'cash' ? 'Tunai' : method === 'qris' ? 'QRIS' : 'Campuran/Kasbon'
      if (debtAmount > 0) {
        paymentSummary += ` + Kasbon Rp ${debtAmount.toLocaleString('id-ID')}`
      }

      const saleRecord: Sale = {
        id: saleId,
        invoice_no: invoiceNo,
        user_id: currentUser.id,
        user_name: currentUser.name,
        shift_id: activeShift?.id || 'no_shift',
        customer_id: customer?.id || null,
        customer_name: customer?.name || null,
        subtotal,
        discount,
        total,
        paid_amount: paidAmount,
        change_amount: changeAmount,
        debt_amount: debtAmount,
        payment_summary: paymentSummary,
        status: 'completed',
        synced: false,
        created_at: now
      }

      const preparedItems = items.map(item => ({
        ...item,
        id: crypto.randomUUID(),
        sale_id: saleId,
        synced: false
      }))

      // Transaksi Dexie: Simpan sale, items, payments, kurangi stok produk & catat hutang
      await db.transaction('rw', [db.sales, db.sale_items, db.sale_payments, db.products, db.stock_movements, db.customers, db.debts], async () => {
        // 1. Simpan Transaksi
        await db.sales.add(saleRecord)
        await db.sale_items.bulkAdd(preparedItems)
        await db.sale_payments.bulkAdd(payments)

        // 2. Kurangi Stok Produk Otomatis & Catat Mutasi
        for (const item of preparedItems) {
          const prod = await db.products.get(item.product_id)
          if (prod) {
            const updatedStock = prod.current_stock - item.quantity
            await db.products.update(prod.id, {
              current_stock: updatedStock,
              updated_at: now,
              synced: false
            })

            await db.stock_movements.add({
              id: crypto.randomUUID(),
              product_id: prod.id,
              product_name: prod.name,
              type: 'out',
              quantity: item.quantity,
              ref_type: 'sale',
              ref_id: saleId,
              notes: `Penjualan ${invoiceNo}`,
              synced: false,
              created_at: now
            })
          }
        }

        // 3. Jika ada Kasbon / Utang, update total hutang pelanggan dan buat record debts
        if (debtAmount > 0 && customer) {
          await db.debts.add({
            id: crypto.randomUUID(),
            customer_id: customer.id,
            customer_name: customer.name,
            sale_id: saleId,
            invoice_no: invoiceNo,
            amount: debtAmount,
            paid: 0,
            status: 'active',
            synced: false,
            created_at: now
          })

          const updatedDebt = (customer.total_debt || 0) + debtAmount
          await db.customers.update(customer.id, {
            total_debt: updatedDebt,
            synced: false
          })
        }
      })

      // Update state selesai
      setCompletedSale({
        sale: saleRecord,
        items: preparedItems,
        payments
      })
      onSuccessTransaction(saleRecord, preparedItems, payments)
    } catch (err: any) {
      console.error('Checkout error:', err)
      setError(err.message || 'Gagal memproses pembayaran')
    } finally {
      setIsProcessing(false)
    }
  }

  // Handle Bluetooth Print
  const handlePrintBluetooth = async () => {
    if (!completedSale) return
    setBluetoothStatus('Menghubungkan ke printer...')
    const res = await printViaBluetooth(
      storeSetting,
      completedSale.sale,
      completedSale.items,
      completedSale.payments
    )
    if (res.success) {
      setBluetoothStatus('Struk berhasil dicetak!')
    } else {
      setBluetoothStatus(res.message || 'Gagal mencetak struk')
    }
  }

  // Handle WhatsApp Share
  const handleShareWA = () => {
    if (!completedSale) return
    shareReceiptToWhatsApp(
      customer?.phone,
      storeSetting,
      completedSale.sale,
      completedSale.items,
      completedSale.payments
    )
  }

  // Handle Standard Print Window
  const handlePrintWindow = () => {
    window.print()
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: '520px' }}>
        {/* Modal Header */}
        <div className="modal-header">
          <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <IconCash size={22} />
            {completedSale ? 'Transaksi Berhasil' : 'Pembayaran Transaksi'}
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

        {!completedSale ? (
          /* FORM PEMBAYARAN */
          <div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Total Card */}
              <div style={{
                backgroundColor: 'var(--accent-primary)',
                color: 'var(--accent-primary-text)',
                padding: '1.25rem',
                borderRadius: 'var(--radius-lg)',
                textAlign: 'center'
              }}>
                <span style={{ fontSize: '0.85rem', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Total Tagihan
                </span>
                <div className="mono" style={{ fontSize: '2.25rem', fontWeight: 800, marginTop: '0.25rem' }}>
                  {formatRupiah(total)}
                </div>
                {discount > 0 && (
                  <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                    (Sudah termasuk diskon Rp {discount.toLocaleString('id-ID')})
                  </span>
                )}
              </div>

              {/* Payment Method Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Pilih Metode Pembayaran
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => { setMethod('cash'); setPresetCash(total); }}
                    className={method === 'cash' ? 'btn-primary' : 'btn-secondary'}
                    style={{ padding: '0.65rem 0.5rem', fontSize: '0.85rem' }}
                  >
                    <IconCash size={16} /> Tunai
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMethod('qris'); setCashGiven(total); }}
                    className={method === 'qris' ? 'btn-primary' : 'btn-secondary'}
                    style={{ padding: '0.65rem 0.5rem', fontSize: '0.85rem' }}
                  >
                    <IconQrcode size={16} /> QRIS
                  </button>
                  <button
                    type="button"
                    onClick={() => setMethod('split')}
                    className={method === 'split' ? 'btn-primary' : 'btn-secondary'}
                    style={{ padding: '0.65rem 0.5rem', fontSize: '0.85rem' }}
                  >
                    <IconUsers size={16} /> Kasbon / Split
                  </button>
                </div>
              </div>

              {/* Pelanggan Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Pelanggan (Wajib untuk Kasbon / Utang)
                </label>
                <select
                  value={customer?.id || ''}
                  onChange={e => {
                    const found = customers.find(c => c.id === e.target.value)
                    setCustomer(found || null)
                  }}
                >
                  <option value="">-- Umum / Tanpa Pelanggan --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''} - Utang: Rp {c.total_debt.toLocaleString('id-ID')}
                    </option>
                  ))}
                </select>
              </div>

              {/* Cash Input & Quick Presets */}
              {(method === 'cash' || method === 'split') && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                      {method === 'cash' ? 'Uang Diterima (Rp)' : 'Bayar Tunai Sebagian (Rp)'}
                    </label>
                    <button
                      type="button"
                      onClick={() => setPresetCash(total)}
                      className="btn-ghost btn-sm"
                      style={{ padding: 0, fontSize: '0.78rem', color: 'var(--accent-primary)' }}
                    >
                      Uang Pas
                    </button>
                  </div>
                  <input
                    type="text"
                    className="mono"
                    style={{ fontSize: '1.25rem', fontWeight: 700 }}
                    value={cashGivenInput}
                    onChange={e => handleCashInput(e.target.value)}
                    autoFocus
                  />

                  {/* Preset Buttons */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem', marginTop: '0.5rem' }}>
                    {[total, 20000, 50000, 100000].map((val, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setPresetCash(val)}
                        className="btn-secondary btn-sm mono"
                      >
                        {val === total ? 'Pas' : `Rp ${(val / 1000)}k`}
                      </button>
                    ))}
                  </div>

                  {/* Kembalian & Kasbon Indicator */}
                  <div style={{
                    marginTop: '1rem',
                    padding: '0.85rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-surface-subtle)',
                    border: '1px solid var(--border-default)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.4rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Kembalian:</span>
                      <strong className="mono" style={{ fontSize: '1.1rem', color: changeAmount > 0 ? '#10B981' : 'inherit' }}>
                        {formatRupiah(changeAmount)}
                      </strong>
                    </div>

                    {debtAmount > 0 && (
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '0.9rem',
                        color: 'var(--status-danger-text)',
                        borderTop: '1px dashed var(--border-default)',
                        paddingTop: '0.4rem'
                      }}>
                        <span>Sisa Menjadi Utang (Kasbon):</span>
                        <strong className="mono" style={{ fontSize: '1.05rem' }}>
                          {formatRupiah(debtAmount)}
                        </strong>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" onClick={onClose} className="btn-secondary">
                Batal
              </button>
              <button
                type="button"
                onClick={handleProcessCheckout}
                className="btn-primary"
                disabled={isProcessing}
              >
                <IconCheck size={18} />
                {isProcessing ? 'Memproses...' : 'Konfirmasi Pembayaran'}
              </button>
            </div>
          </div>
        ) : (
          /* TAMPILAN SUKSES & CETAK STRUK */
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{
              textAlign: 'center',
              padding: '1rem 0'
            }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                backgroundColor: 'var(--status-success-bg)',
                color: 'var(--status-success-text)',
                marginBottom: '0.75rem'
              }}>
                <IconCheck size={28} />
              </div>
              <h4 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Transaksi Berhasil</h4>
              <p className="mono" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {completedSale.sale.invoice_no}
              </p>
            </div>

            {/* Print receipt preview card */}
            <div style={{
              backgroundColor: 'var(--bg-app)',
              border: '1px dashed var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
              whiteSpace: 'pre-wrap',
              maxHeight: '220px',
              overflowY: 'auto'
            }}>
              {generateTextReceipt(
                storeSetting,
                completedSale.sale,
                completedSale.items,
                completedSale.payments
              )}
            </div>

            {bluetoothStatus && (
              <div style={{
                padding: '0.5rem 0.75rem',
                backgroundColor: 'var(--status-info-bg)',
                color: 'var(--status-info-text)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                textAlign: 'center'
              }}>
                {bluetoothStatus}
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={handlePrintBluetooth}
                className="btn-primary"
                style={{ fontSize: '0.85rem' }}
              >
                <IconPrinter size={18} /> Cetak Thermal (58mm)
              </button>

              <button
                type="button"
                onClick={handleShareWA}
                className="btn-secondary"
                style={{ fontSize: '0.85rem' }}
              >
                <IconShare size={18} /> Kirim WhatsApp
              </button>
            </div>

            <button
              type="button"
              onClick={handlePrintWindow}
              className="btn-outline btn-sm"
              style={{ width: '100%' }}
            >
              Cetak Biasa / Simpan PDF
            </button>

            <button
              type="button"
              onClick={onClose}
              className="btn-secondary btn-lg"
              style={{ marginTop: '0.5rem', width: '100%', fontWeight: 700 }}
            >
              <IconPlus size={18} /> Transaksi Baru (Esc)
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
