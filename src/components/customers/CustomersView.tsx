import React, { useState, useEffect } from 'react'
import { db } from '../../db/db'
import type { Customer, DebtPayment } from '../../types'
import {
  IconUsers,
  IconPlus,
  IconSearch,
  IconCash,
  IconTrash,
  IconEdit,
  IconX,
  IconCheck
} from '../icons/Icons'
import { formatRupiah } from '../../utils/printer'
import { generateId } from '../../utils/id'
import { useAuth } from '../../context/AuthContext'

export const CustomersView: React.FC = () => {
  const { storeSetting } = useAuth()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')

  // Customer Modal
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [formName, setFormName] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formAddress, setFormAddress] = useState('')
  const [formCreditLimit, setFormCreditLimit] = useState<number>(500000)

  // Payment Debt Modal
  const [payingCustomer, setPayingCustomer] = useState<Customer | null>(null)
  const [paymentAmount, setPaymentAmount] = useState<number>(0)
  const [paymentAmountInput, setPaymentAmountInput] = useState<string>('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('cash')

  const loadCustomers = async () => {
    const list = await db.customers.toArray()
    setCustomers(list)
  }

  useEffect(() => {
    loadCustomers()
  }, [])

  const handleOpenAdd = () => {
    setEditingCustomer(null)
    setFormName('')
    setFormPhone('')
    setFormAddress('')
    setFormCreditLimit(500000)
    setIsModalOpen(true)
  }

  const handleOpenEdit = (c: Customer) => {
    setEditingCustomer(c)
    setFormName(c.name)
    setFormPhone(c.phone || '')
    setFormAddress(c.address || '')
    setFormCreditLimit(c.credit_limit || 0)
    setIsModalOpen(true)
  }

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim()) return

    const custId = editingCustomer ? editingCustomer.id : generateId()
    const customerRecord: Customer = {
      id: custId,
      name: formName.trim(),
      phone: formPhone.trim(),
      address: formAddress.trim(),
      total_debt: editingCustomer ? editingCustomer.total_debt : 0,
      credit_limit: formCreditLimit,
      synced: false
    }

    await db.customers.put(customerRecord)
    setIsModalOpen(false)
    loadCustomers()
  }

  const handleDeleteCustomer = async (id: string, name: string) => {
    if (confirm(`Yakin ingin menghapus data pelanggan "${name}"?`)) {
      await db.customers.delete(id)
      loadCustomers()
    }
  }

  // Handle Cicil / Lunas Kasbon
  const handleOpenPayDebt = (c: Customer) => {
    setPayingCustomer(c)
    setPaymentAmount(c.total_debt)
    setPaymentAmountInput(c.total_debt.toLocaleString('id-ID'))
  }

  const handleProcessDebtPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!payingCustomer || paymentAmount <= 0) return

    const now = new Date().toISOString()
    const payId = generateId()

    await db.transaction('rw', [db.customers, db.debt_payments], async () => {
      const remainingDebt = Math.max(0, payingCustomer.total_debt - paymentAmount)

      await db.customers.update(payingCustomer.id, {
        total_debt: remainingDebt,
        synced: false
      })

      const paymentRecord: DebtPayment = {
        id: payId,
        debt_id: 'general_debt',
        customer_id: payingCustomer.id,
        amount: paymentAmount,
        method: paymentMethod,
        notes: `Pembayaran cicilan kasbon oleh ${payingCustomer.name}`,
        synced: false,
        paid_at: now
      }

      await db.debt_payments.add(paymentRecord)
    })

    // WhatsApp Notification option
    if (payingCustomer.phone && confirm('Kirim bukti tanda terima pembayaran kasbon via WhatsApp?')) {
      const msg = `*BUKTI PEMBAYARAN KASBON*\n${storeSetting?.store_name || 'Toko'}\n\n` +
        `Pelanggan: ${payingCustomer.name}\n` +
        `Jumlah Bayar: Rp ${paymentAmount.toLocaleString('id-ID')}\n` +
        `Sisa Kasbon: Rp ${(payingCustomer.total_debt - paymentAmount).toLocaleString('id-ID')}\n` +
        `Tanggal: ${new Date().toLocaleString('id-ID')}\n\nTerima kasih!`
      window.open(`https://api.whatsapp.com/send?phone=${payingCustomer.phone.replace(/^0/, '62')}&text=${encodeURIComponent(msg)}`, '_blank')
    }

    setPayingCustomer(null)
    loadCustomers()
  }

  const totalOutstandingDebt = customers.reduce((sum, c) => sum + (c.total_debt || 0), 0)

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  )

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem' }}>Pelanggan & Kasbon (Utang)</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Pantau saldo piutang pelanggan, batas utang kredit, dan catat pembayaran kasbon.
          </p>
        </div>

        <button type="button" onClick={handleOpenAdd} className="btn-primary">
          <IconPlus size={18} /> Tambah Pelanggan
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            backgroundColor: 'var(--status-danger-bg)',
            color: 'var(--status-danger-text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <IconCash size={22} />
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Piutang Toko</span>
            <div className="mono" style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--status-danger-text)' }}>
              {formatRupiah(totalOutstandingDebt)}
            </div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            backgroundColor: 'var(--bg-surface-subtle)',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <IconUsers size={22} />
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Pelanggan Terdaftar</span>
            <div className="mono" style={{ fontSize: '1.35rem', fontWeight: 800 }}>
              {customers.length} Orang
            </div>
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div style={{
        position: 'relative',
        backgroundColor: 'var(--bg-surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-default)'
      }}>
        <IconSearch
          size={18}
          style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
        />
        <input
          type="text"
          placeholder="Cari nama pelanggan atau nomor HP/WA..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ paddingLeft: '2.5rem', border: 'none' }}
        />
      </div>

      {/* Customer List Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-surface-subtle)', borderBottom: '1px solid var(--border-default)' }}>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Nama Pelanggan</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Kontak / Alamat</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Total Utang (Kasbon)</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Batas Limit Utang</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600, textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Belum ada data pelanggan.
                  </td>
                </tr>
              ) : (
                filtered.map(c => {
                  const hasDebt = c.total_debt > 0
                  const isOverLimit = c.credit_limit > 0 && c.total_debt >= c.credit_limit

                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>
                        {c.name}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                        <div>{c.phone || '-'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.address || ''}</div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span className={`badge ${hasDebt ? (isOverLimit ? 'badge-danger' : 'badge-warning') : 'badge-neutral'} mono`}>
                          {formatRupiah(c.total_debt)}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }} className="mono">
                        {c.credit_limit > 0 ? formatRupiah(c.credit_limit) : 'Tidak dibatasi'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                          {hasDebt && (
                            <button
                              type="button"
                              onClick={() => handleOpenPayDebt(c)}
                              className="btn-primary btn-sm"
                              title="Bayar Kasbon"
                            >
                              <IconCash size={15} /> Bayar
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(c)}
                            className="btn-ghost btn-sm"
                            title="Edit Data"
                          >
                            <IconEdit size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomer(c.id, c.name)}
                            className="btn-ghost btn-sm text-danger"
                            title="Hapus"
                          >
                            <IconTrash size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================================
          MODAL: TAMBAH / EDIT PELANGGAN
          ====================================================================== */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem' }}>
                {editingCustomer ? 'Edit Pelanggan' : 'Tambah Pelanggan Baru'}
              </h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="btn-ghost btn-sm">
                <IconX size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Nama Pelanggan *
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Pak RT Slamet, Bu Siti"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Nomor WhatsApp / HP
                  </label>
                  <input
                    type="tel"
                    placeholder="08123456789"
                    value={formPhone}
                    onChange={e => setFormPhone(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Alamat / Catatan Rumah
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Rumah cat hijau gang 2"
                    value={formAddress}
                    onChange={e => setFormAddress(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Batas Maksimal Utang / Kredit (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="mono"
                    value={formCreditLimit}
                    onChange={e => setFormCreditLimit(parseInt(e.target.value, 10) || 0)}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Peringatan akan muncul saat kasir memproses kasbon melebihi limit ini.
                  </span>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">
                  Batal
                </button>
                <button type="submit" className="btn-primary">
                  <IconCheck size={18} /> Simpan Data
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================================
          MODAL: BAYAR CICILAN / PELUNASAN KASBON
          ====================================================================== */}
      {payingCustomer && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem' }}>Pembayaran Kasbon</h3>
              <button type="button" onClick={() => setPayingCustomer(null)} className="btn-ghost btn-sm">
                <IconX size={18} />
              </button>
            </div>

            <form onSubmit={handleProcessDebtPayment}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <p style={{ fontSize: '0.88rem' }}>
                  Pelanggan: <strong>{payingCustomer.name}</strong>
                </p>

                <div style={{
                  padding: '0.85rem',
                  backgroundColor: 'var(--bg-surface-subtle)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.9rem'
                }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Total Kasbon Saat Ini:</span>
                  <strong className="mono text-danger" style={{ fontSize: '1.15rem' }}>
                    {formatRupiah(payingCustomer.total_debt)}
                  </strong>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Jumlah yang Dibayar (Rp) *
                  </label>
                  <input
                    type="text"
                    className="mono"
                    style={{ fontSize: '1.3rem', fontWeight: 700 }}
                    value={paymentAmountInput}
                    onChange={e => {
                      const raw = e.target.value.replace(/\D/g, '')
                      const num = parseInt(raw, 10) || 0
                      setPaymentAmount(num)
                      setPaymentAmountInput(num.toLocaleString('id-ID'))
                    }}
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Metode Pembayaran
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value as 'cash' | 'transfer')}
                  >
                    <option value="cash">Tunai (Cash)</option>
                    <option value="transfer">Transfer Bank / Non-Tunai</option>
                  </select>
                </div>

                {/* Sisa Utang Preview */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '0.65rem 0.85rem',
                  backgroundColor: 'var(--bg-app)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.85rem'
                }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Sisa Kasbon Setelah Bayar:</span>
                  <strong className="mono">
                    {formatRupiah(Math.max(0, payingCustomer.total_debt - paymentAmount))}
                  </strong>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setPayingCustomer(null)} className="btn-secondary">
                  Batal
                </button>
                <button type="submit" className="btn-primary" disabled={paymentAmount <= 0}>
                  <IconCheck size={18} /> Terima Pembayaran
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
