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
import { POCKETBASE_SCHEMA_JSON } from '../../services/pocketbaseSchema'
import {
  syncAllToPocketBase,
  pullFromPocketBase,
  getUnsyncedCount,
  onSyncStatusChange,
  type SyncStatus
} from '../../services/syncService'
import { updatePocketBaseUrl } from '../../services/pocketbase'

export const SettingsView: React.FC = () => {
  const { storeSetting, currentUser, syncAccountToCloud } = useAuth()
  
  // Store Settings Form
  const [storeName, setStoreName] = useState(storeSetting?.store_name || '')
  const [phone, setPhone] = useState(storeSetting?.phone || '')
  const [address, setAddress] = useState(storeSetting?.address || '')
  const [footer, setFooter] = useState(storeSetting?.receipt_footer || '')
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Cloud Account Sync (Multi-Device)
  const [cloudPassword, setCloudPassword] = useState('')
  const [isSyncingAccount, setIsSyncingAccount] = useState(false)
  const [cloudAccountResult, setCloudAccountResult] = useState<{ ok: boolean; message: string } | null>(null)

  // Cashiers List
  const [users, setUsers] = useState<User[]>([])
  const [isCashierModalOpen, setIsCashierModalOpen] = useState(false)
  const [cashierName, setCashierName] = useState('')
  const [cashierEmail, setCashierEmail] = useState('')
  const [cashierPin, setCashierPin] = useState('')

  // PocketBase Sync Configuration
  const [pbUrl, setPbUrl] = useState(localStorage.getItem('kasir_pb_url') || 'https://kasir.sayunk.id')
  const [isTestingPb, setIsTestingPb] = useState(false)
  const [pbHealthStatus, setPbHealthStatus] = useState<{ ok: boolean; message: string } | null>(null)
  const [isSyncingManual, setIsSyncingManual] = useState(false)
  const [syncResult, setSyncResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [copiedSchema, setCopiedSchema] = useState(false)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isSyncing: false,
    lastSyncTime: localStorage.getItem('kasir_last_sync') || null,
    unsyncedCount: 0,
    error: null
  })

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
    getUnsyncedCount()
    const unsub = onSyncStatusChange((st) => setSyncStatus(st))
    return unsub
  }, [])

  // Uji koneksi ke PocketBase
  const handleTestConnection = async () => {
    setIsTestingPb(true)
    setPbHealthStatus(null)
    try {
      const cleanUrl = pbUrl.trim().replace(/\/+$/, '')
      const res = await fetch(`${cleanUrl}/api/health`)
      const data = await res.json()
      if (res.ok && data.code === 200) {
        setPbHealthStatus({ ok: true, message: 'Server PocketBase aktif & terhubung (HTTP 200 OK)!' })
      } else {
        setPbHealthStatus({ ok: false, message: `Server merespon: HTTP ${res.status}` })
      }
    } catch (err: any) {
      setPbHealthStatus({
        ok: false,
        message: `Tidak dapat terhubung ke server: ${err.message || 'Periksa URL atau koneksi internet'}`
      })
    } finally {
      setIsTestingPb(false)
    }
  }

  // Sinkronisasi manual
  const handleManualSyncNow = async () => {
    setIsSyncingManual(true)
    setSyncResult(null)
    try {
      updatePocketBaseUrl(pbUrl.trim())
      const pushRes = await syncAllToPocketBase()
      const pullRes = await pullFromPocketBase()
      await getUnsyncedCount()
      if (pushRes.success) {
        setSyncResult({
          ok: true,
          message: `Sinkronisasi berhasil! ${pullRes.count ? `${pullRes.count} produk diselaraskan.` : 'Semua data lokal telah sinkron dengan server.'}`
        })
      } else {
        setSyncResult({
          ok: false,
          message: pushRes.message || 'Gagal menyinkronkan data. Pastikan koleksi telah di-import di PocketBase.'
        })
      }
    } catch (err: any) {
      setSyncResult({
        ok: false,
        message: err.message || 'Terjadi kesalahan saat proses sinkronisasi.'
      })
    } finally {
      setIsSyncingManual(false)
    }
  }

  // Daftarkan/Hubungkan akun lokal PC ke Cloud PocketBase
  const handleSyncAccountToCloud = async (e: React.FormEvent) => {
    e.preventDefault()
    if (cloudPassword.length < 8) {
      setCloudAccountResult({
        ok: false,
        message: 'Kata sandi minimal 8 karakter sesuai aturan keamanan PocketBase Cloud.'
      })
      return
    }

    setIsSyncingAccount(true)
    setCloudAccountResult(null)
    try {
      const res = await syncAccountToCloud(cloudPassword)
      setCloudAccountResult({
        ok: res.success,
        message: res.message
      })
      if (res.success) {
        setCloudPassword('')
        loadSettingsData()
        getUnsyncedCount()
      }
    } catch (err: any) {
      setCloudAccountResult({
        ok: false,
        message: err.message || 'Gagal menyinkronkan akun ke cloud.'
      })
    } finally {
      setIsSyncingAccount(false)
    }
  }

  // Salin skema JSON ke clipboard
  const handleCopySchema = () => {
    navigator.clipboard.writeText(POCKETBASE_SCHEMA_JSON)
    setCopiedSchema(true)
    setTimeout(() => setCopiedSchema(false), 3000)
  }

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

      {/* Akun Cloud & Akses Antar Perangkat (PC ke HP) */}
      <div className="card" style={{ border: '1px solid var(--border-focus)', position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <IconUser size={18} /> Akun Cloud & Akses Antar Perangkat (HP / Laptop)
          </h3>
          <span className={`badge ${currentUser?.synced ? 'badge-primary' : 'badge-warning'}`}>
            {currentUser?.synced ? 'Terhubung ke Cloud' : 'Lokal PC Saja (Belum Terhubung)'}
          </span>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Agar Anda bisa <strong>login di HP atau perangkat lain</strong> menggunakan akun toko yang dibuat di PC ini, akun kasir harus didaftarkan ke server cloud PocketBase (<code>https://kasir.sayunk.id</code>).
        </p>

        <div style={{
          padding: '0.85rem 1rem',
          backgroundColor: 'var(--bg-surface-subtle)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '1rem',
          fontSize: '0.85rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem'
        }}>
          <div><strong>Nama Pemilik:</strong> {currentUser?.name || '-'}</div>
          <div><strong>Email Akun:</strong> {currentUser?.email || '-'}</div>
          <div><strong>Status Cloud:</strong> {currentUser?.synced ? 'Aktif (Siap login di HP)' : 'Belum aktif — masukkan kata sandi di bawah untuk menghubungkan'}</div>
        </div>

        <form onSubmit={handleSyncAccountToCloud} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>
              Kata Sandi Akun Cloud (Minimal 8 Karakter)
            </label>
            <input
              type="password"
              placeholder="Masukkan kata sandi (min. 8 karakter) untuk login di HP"
              value={cloudPassword}
              onChange={e => setCloudPassword(e.target.value)}
              required
              minLength={8}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
              Kata sandi ini yang akan Anda gunakan untuk masuk di HP bersama email <code>{currentUser?.email}</code>.
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSyncingAccount}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <IconRefresh size={16} className={isSyncingAccount ? 'spin' : ''} />
              <span>{isSyncingAccount ? 'Menghubungkan ke Cloud...' : 'Hubungkan Akun ke Cloud & Sinkron Data'}</span>
            </button>
          </div>
        </form>

        {cloudAccountResult && (
          <div style={{
            marginTop: '0.75rem',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.85rem',
            backgroundColor: cloudAccountResult.ok ? 'var(--status-success-bg)' : 'var(--status-danger-bg)',
            color: cloudAccountResult.ok ? 'var(--status-success-text)' : 'var(--status-danger-text)',
            border: `1px solid ${cloudAccountResult.ok ? 'var(--status-success-border)' : 'var(--status-danger-border)'}`
          }}>
            {cloudAccountResult.message}
          </div>
        )}
      </div>

      {/* PocketBase Cloud VPS Integration */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <IconRefresh size={18} /> Integrasi Backend PocketBase & VPS CloudPanel
          </h3>
          <span className="badge badge-primary" style={{ fontSize: '0.72rem' }}>
            {pbUrl.includes('kasir.sayunk.id') ? 'kasir.sayunk.id (Terhubung)' : 'Custom Backend'}
          </span>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          Kasir berjalan <strong>offline-first</strong> di browser Anda. Saat terhubung ke server PocketBase di VPS CloudPanel, seluruh data produk, kasir, transaksi belanja, dan pembukuan hutang otomatis tersimpan secara aman di database cloud.
        </p>

        {/* Form URL & Test Koneksi */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              URL Server PocketBase (Domain VPS CloudPanel)
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <input
                type="url"
                className="mono"
                style={{ flex: 1, minWidth: '240px' }}
                placeholder="https://kasir.sayunk.id"
                value={pbUrl}
                onChange={e => setPbUrl(e.target.value)}
              />
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTestingPb}
                className="btn-secondary"
                style={{ whiteSpace: 'nowrap' }}
              >
                {isTestingPb ? 'Menguji...' : 'Uji Koneksi Server'}
              </button>
            </div>

            {/* Indikator Hasil Tes Koneksi */}
            {pbHealthStatus && (
              <div style={{
                marginTop: '0.5rem',
                padding: '0.6rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.82rem',
                backgroundColor: pbHealthStatus.ok ? 'var(--status-success-bg)' : 'var(--status-danger-bg)',
                color: pbHealthStatus.ok ? 'var(--status-success-text)' : 'var(--status-danger-text)',
                border: `1px solid ${pbHealthStatus.ok ? 'var(--status-success-border)' : 'var(--status-danger-border)'}`
              }}>
                {pbHealthStatus.message}
              </div>
            )}
          </div>

          {/* Status & Kontrol Sinkronisasi */}
          <div style={{
            padding: '1rem',
            backgroundColor: 'var(--bg-surface-subtle)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-default)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Status Sinkronisasi Data</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Data belum sinkron: <strong>{syncStatus.unsyncedCount} entri</strong> | Sinkron terakhir: {syncStatus.lastSyncTime || 'Belum pernah'}
                </div>
              </div>

              <button
                type="button"
                onClick={handleManualSyncNow}
                disabled={isSyncingManual}
                className="btn-primary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <IconRefresh size={15} className={isSyncingManual ? 'spin' : ''} />
                <span>{isSyncingManual ? 'Menyinkronkan...' : 'Sinkronkan Sekarang'}</span>
              </button>
            </div>

            {syncResult && (
              <div style={{
                padding: '0.5rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                backgroundColor: syncResult.ok ? 'var(--status-success-bg)' : 'var(--status-warning-bg)',
                color: syncResult.ok ? 'var(--status-success-text)' : 'var(--status-warning-text)'
              }}>
                {syncResult.message}
              </div>
            )}
          </div>

          {/* Panduan 1-Click Import Skema Koleksi ke PocketBase */}
          <div style={{
            padding: '1rem',
            backgroundColor: 'var(--bg-app)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-default)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                Import Skema Database ke PocketBase (Cukup Sekali)
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleCopySchema}
                  className={copiedSchema ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
                  style={{ fontSize: '0.78rem' }}
                >
                  <IconCheck size={14} />
                  <span>{copiedSchema ? 'Tersalin ke Clipboard!' : 'Salin Skema (JSON)'}</span>
                </button>
                <a
                  href={`${pbUrl.replace(/\/+$/, '')}/_/`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary btn-sm"
                  style={{ fontSize: '0.78rem', textDecoration: 'none' }}
                >
                  Buka PocketBase Admin
                </a>
              </div>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              Agar PocketBase dapat menyimpan koleksi (produk, transaksi kasir, hutang, laporan), import skema dengan cara:
            </p>

            <ol style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <li>Klik tombol <strong>Salin Skema (JSON)</strong> di atas.</li>
              <li>Klik <strong>Buka PocketBase Admin</strong> (<code>https://kasir.sayunk.id/_/</code>).</li>
              <li>Di PocketBase Admin, klik ikon <strong>Settings (Gear di kiri bawah)</strong> &rarr; pilih <strong>Sync</strong> (atau <em>Import collections</em>).</li>
              <li>Paste (Tempel) teks JSON yang sudah disalin ke kolom input.</li>
              <li>Klik <strong>Review</strong> lalu <strong>Confirm and import</strong>. Selesai!</li>
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
