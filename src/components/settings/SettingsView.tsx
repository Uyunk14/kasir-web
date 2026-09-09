import React, { useState, useEffect } from 'react'
import { db } from '../../db/db'
import type { User } from '../../types'
import {
  IconStore,
  IconUser,
  IconCheck,
  IconPlus,
  IconTrash,
  IconRefresh,
  IconX
} from '../icons/Icons'
import { useAuth } from '../../context/AuthContext'
import { generateId } from '../../utils/id'

export const SettingsView: React.FC = () => {
  const { storeSetting } = useAuth()
  
  // Store Settings Form
  const [storeName, setStoreName] = useState(storeSetting?.store_name || '')
  const [phone, setPhone] = useState(storeSetting?.phone || '')
  const [address, setAddress] = useState(storeSetting?.address || '')
  const [footer, setFooter] = useState(storeSetting?.receipt_footer || '')
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Cashiers List
  const [users, setUsers] = useState<User[]>([])
  const [isCashierModalOpen, setIsCashierModalOpen] = useState(false)
  const [cashierName, setCashierName] = useState('')
  const [cashierEmail, setCashierEmail] = useState('')
  const [cashierPin, setCashierPin] = useState('')

  // PocketBase Sync Configuration
  const [pbUrl, setPbUrl] = useState(localStorage.getItem('kasir_pb_url') || 'https://kasir.sayunk.id')

  const loadSettingsData = async () => {
    const uList = await db.users.toArray()
    setUsers(uList)
    const st = await db.store_settings.toCollection().first()
    if (st) {
      setStoreName(st.store_name)
      setPhone(st.phone || '')
      setAddress(st.address || '')
      setFooter(st.receipt_footer || '')
    }
  }

  useEffect(() => {
    loadSettingsData()
  }, [])

  // Simpan Pengaturan Toko
  const handleSaveStore = async (e: React.FormEvent) => {
    e.preventDefault()
    const st = await db.store_settings.toCollection().first()
    if (st) {
      await db.store_settings.update(st.id, {
        store_name: storeName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        receipt_footer: footer.trim()
      })
    }
    localStorage.setItem('kasir_pb_url', pbUrl.trim())
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 3000)
  }

  // Tambah Kasir Baru
  const handleAddCashier = async (e: React.FormEvent) => {
    e.preventDefault()
    if (cashierPin.length !== 6) {
      alert('PIN harus 6 digit angka')
      return
    }

    const enc = new TextEncoder().encode(cashierPin)
    const hashBuffer = await crypto.subtle.digest('SHA-256', enc)
    const pinHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')

    const newUser: User = {
      id: generateId(),
      name: cashierName.trim(),
      email: cashierEmail.trim() || `kasir_${Date.now()}@toko.local`,
      pin_hash: pinHash,
      role: 'cashier',
      created_at: new Date().toISOString(),
      synced: false
    }

    await db.users.add(newUser)
    setIsCashierModalOpen(false)
    setCashierName('')
    setCashierEmail('')
    setCashierPin('')
    loadSettingsData()
  }

  const handleDeleteCashier = async (id: string, name: string) => {
    if (confirm(`Hapus akun kasir "${name}"?`)) {
      await db.users.delete(id)
      loadSettingsData()
    }
  }

  // Backup & Restore
  const handleExportBackup = async () => {
    const backup = {
      timestamp: new Date().toISOString(),
      store_settings: await db.store_settings.toArray(),
      users: await db.users.toArray(),
      categories: await db.categories.toArray(),
      products: await db.products.toArray(),
      barcodes: await db.barcodes.toArray(),
      customers: await db.customers.toArray(),
      suppliers: await db.suppliers.toArray(),
      sales: await db.sales.toArray(),
      sale_items: await db.sale_items.toArray(),
      sale_payments: await db.sale_payments.toArray(),
      expenses: await db.expenses.toArray(),
      debts: await db.debts.toArray(),
      debt_payments: await db.debt_payments.toArray()
    }

    const jsonStr = JSON.stringify(backup, null, 2)
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `backup-kasir-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '840px' }}>
      <div>
        <h2 style={{ fontSize: '1.4rem' }}>Pengaturan Toko & Akun Kasir</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Kelola profil usaha, catatan struk belanja, akun kasir, dan integrasi backend PocketBase.
        </p>
      </div>

      {saveSuccess && (
        <div style={{
          padding: '0.75rem 1rem',
          backgroundColor: 'var(--status-success-bg)',
          color: 'var(--status-success-text)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.88rem'
        }}>
          <IconCheck size={18} />
          <span>Pengaturan toko berhasil diperbarui!</span>
        </div>
      )}

      {/* Profile Toko Form */}
      <div className="card">
        <h3 style={{ fontSize: '1.05rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <IconStore size={18} /> Informasi Toko & Format Struk
        </h3>

        <form onSubmit={handleSaveStore} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                Nama Toko *
              </label>
              <input
                type="text"
                value={storeName}
                onChange={e => setStoreName(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                No. Telepon / WhatsApp
              </label>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>
              Alamat Toko (Muncul di Struk)
            </label>
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>
              Pesan Footer Struk Belanja
            </label>
            <input
              type="text"
              value={footer}
              onChange={e => setFooter(e.target.value)}
            />
          </div>

          <div style={{ paddingTop: '0.5rem' }}>
            <button type="submit" className="btn-primary">
              <IconCheck size={18} /> Simpan Pengaturan
            </button>
          </div>
        </form>
      </div>

      {/* Manajemen Pengguna / Kasir */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <IconUser size={18} /> Daftar Pengguna & Kasir
          </h3>
          <button type="button" onClick={() => setIsCashierModalOpen(true)} className="btn-secondary btn-sm">
            <IconPlus size={16} /> Tambah Kasir
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {users.map(u => (
            <div
              key={u.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-surface-subtle)',
                border: '1px solid var(--border-subtle)'
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{u.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.email}</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className={`badge ${u.role === 'owner' ? 'badge-primary' : 'badge-neutral'}`}>
                  {u.role === 'owner' ? 'Pemilik (Admin)' : 'Kasir'}
                </span>

                {u.role !== 'owner' && (
                  <button
                    type="button"
                    onClick={() => handleDeleteCashier(u.id, u.name)}
                    className="btn-ghost btn-sm text-danger"
                    title="Hapus Kasir"
                  >
                    <IconTrash size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* PocketBase Cloud VPS Integration */}
      <div className="card">
        <h3 style={{ fontSize: '1.05rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <IconRefresh size={18} /> Integrasi Backend PocketBase & VPS
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Aplikasi berjalan offline-first menggunakan IndexedDB di browser kasir. Saat terhubung ke server PocketBase di VPS CloudPanel, data akan tersinkronisasi otomatis secara dua arah secara real-time.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>
              URL Server PocketBase (Domain VPS CloudPanel)
            </label>
            <input
              type="url"
              className="mono"
              placeholder="https://kasir.sayunk.id"
              value={pbUrl}
              onChange={e => setPbUrl(e.target.value)}
            />
          </div>

          <div style={{
            padding: '0.85rem',
            backgroundColor: 'var(--bg-surface-subtle)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.82rem',
            color: 'var(--text-secondary)'
          }}>
            <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Panduan Deploy VPS CloudPanel:</p>
            <ol style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <li>Unduh binary PocketBase di VPS Anda.</li>
              <li>Jalankan PocketBase dengan perintah <code>./pocketbase serve --http="127.0.0.1:8090"</code>.</li>
              <li>Arahkan reverse proxy Nginx di CloudPanel untuk domain <code>kasir.sayunk.id</code> ke port <code>8090</code>.</li>
              <li>Folder <code>pb_public/</code> PocketBase akan otomatis menyajikan build statis frontend PWA ini.</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Backup & Restore Section */}
      <div className="card">
        <h3 style={{ fontSize: '1.05rem', marginBottom: '0.5rem' }}>Cadangan Data Lokal (Backup)</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Unduh seluruh data toko, produk, dan riwayat transaksi dalam format file JSON untuk disimpan di komputer kasir.
        </p>
        <button type="button" onClick={handleExportBackup} className="btn-secondary">
          Unduh File Backup (.json)
        </button>
      </div>

      {/* ======================================================================
          MODAL: TAMBAH KASIR
          ====================================================================== */}
      {isCashierModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem' }}>Tambah Kasir Baru</h3>
              <button type="button" onClick={() => setIsCashierModalOpen(false)} className="btn-ghost btn-sm">
                <IconX size={18} />
              </button>
            </div>

            <form onSubmit={handleAddCashier}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Nama Kasir *
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Rina, Budi"
                    value={cashierName}
                    onChange={e => setCashierName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Email Kasir (Opsional)
                  </label>
                  <input
                    type="email"
                    placeholder="rina@toko.com"
                    value={cashierEmail}
                    onChange={e => setCashierEmail(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    6 Digit PIN Kasir *
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    className="mono"
                    placeholder="123456"
                    value={cashierPin}
                    onChange={e => setCashierPin(e.target.value.replace(/\D/g, ''))}
                    required
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    PIN ini digunakan kasir untuk masuk saat bertugas.
                  </span>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setIsCashierModalOpen(false)} className="btn-secondary">
                  Batal
                </button>
                <button type="submit" className="btn-primary" disabled={cashierPin.length !== 6}>
                  <IconCheck size={18} /> Buat Akun Kasir
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
