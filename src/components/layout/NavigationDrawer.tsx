import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import {
  IconX,
  IconCart,
  IconBox,
  IconUsers,
  IconDollarSign,
  IconReceipt,
  IconSettings,
  IconLogOut,
  IconStore,
  IconUser,
  IconMoon,
  IconSun,
  IconRefresh
} from '../icons/Icons'
import {
  onSyncStatusChange,
  syncAllToPocketBase,
  type SyncStatus
} from '../../services/syncService'
import type { NavTab } from './Navigation'

interface NavigationDrawerProps {
  isOpen: boolean
  onClose: () => void
  activeTab: NavTab
  onSelectTab: (tab: NavTab) => void
  onOpenShiftModal: () => void
}

export const NavigationDrawer: React.FC<NavigationDrawerProps> = ({
  isOpen,
  onClose,
  activeTab,
  onSelectTab,
  onOpenShiftModal
}) => {
  const { storeSetting, currentUser, activeShift, logout, theme, toggleTheme } = useAuth()
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isSyncing: false,
    lastSyncTime: localStorage.getItem('kasir_last_sync') || null,
    unsyncedCount: 0,
    error: null
  })

  useEffect(() => {
    const unsub = onSyncStatusChange((st) => setSyncStatus(st))
    return unsub
  }, [])

  const handleSyncNow = async () => {
    if (syncStatus.isSyncing) return
    await syncAllToPocketBase()
  }

  if (!isOpen) return null

  const navItems = [
    { id: 'pos' as NavTab, label: 'Kasir (POS)', desc: 'Layar transaksi penjualan', icon: <IconCart size={20} /> },
    { id: 'products' as NavTab, label: 'Produk & Stok', desc: 'Katalog barang & opname', icon: <IconBox size={20} /> },
    { id: 'customers' as NavTab, label: 'Pelanggan & Utang', desc: 'Data pelanggan & kasbon', icon: <IconUsers size={20} /> },
    { id: 'expenses' as NavTab, label: 'Kas & Kulakan', desc: 'Kas keluar & supplier', icon: <IconDollarSign size={20} /> },
    { id: 'reports' as NavTab, label: 'Laporan Keuangan', desc: 'Omset, laba & riwayat', icon: <IconReceipt size={20} /> },
    ...(currentUser?.role === 'owner'
      ? [{ id: 'settings' as NavTab, label: 'Pengaturan Toko', desc: 'Profil, kasir & backup', icon: <IconSettings size={20} /> }]
      : [])
  ]

  const handleSelect = (tab: NavTab) => {
    onSelectTab(tab)
    onClose()
  }

  const handleLogout = () => {
    if (confirm('Apakah Anda yakin ingin keluar (Logout)?')) {
      onClose()
      logout()
    }
  }

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer-content" onClick={e => e.stopPropagation()}>
        {/* Drawer Header */}
        <div className="drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--accent-primary-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <IconStore size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.2 }}>
                {storeSetting?.store_name || 'Kasir Toko'}
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {storeSetting?.address || 'Aplikasi Kasir PWA'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn-ghost"
            style={{ width: '36px', height: '36px', padding: 0 }}
            title="Tutup Menu"
          >
            <IconX size={20} />
          </button>
        </div>

        {/* Shift Card */}
        <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{
            padding: '0.75rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-surface-subtle)',
            border: '1px solid var(--border-default)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Status Shift Kasir:</span>
              <span className={`badge ${activeShift ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.7rem' }}>
                {activeShift ? 'Shift Aktif' : 'Belum Buka'}
              </span>
            </div>
            {activeShift && (
              <div style={{ fontSize: '0.8rem' }}>
                Kas Awal: <strong className="mono">Rp {activeShift.opening_cash.toLocaleString('id-ID')}</strong>
              </div>
            )}
            <button
              type="button"
              onClick={() => { onClose(); onOpenShiftModal() }}
              className="btn-secondary btn-sm"
              style={{ marginTop: '0.25rem', width: '100%', fontSize: '0.78rem' }}
            >
              {activeShift ? 'Tutup Buku / Shift' : 'Buka Shift Sekarang'}
            </button>
          </div>

          {/* Cloud Sync Status (Mobile) */}
          <div style={{
            marginTop: '0.5rem',
            padding: '0.65rem 0.75rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-app)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem'
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.76rem', fontWeight: 600 }}>PocketBase Cloud</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                {syncStatus.unsyncedCount > 0 ? `${syncStatus.unsyncedCount} belum sinkron` : 'Data telah sinkron'}
              </div>
            </div>

            <button
              type="button"
              onClick={handleSyncNow}
              disabled={syncStatus.isSyncing}
              className="btn-secondary btn-sm"
              style={{ padding: '0.25rem 0.55rem', fontSize: '0.72rem', height: '28px', gap: '0.3rem' }}
            >
              <IconRefresh size={12} className={syncStatus.isSyncing ? 'spin' : ''} />
              <span>{syncStatus.isSyncing ? 'Sync...' : 'Sinkron'}</span>
            </button>
          </div>
        </div>

        {/* Navigation List */}
        <div className="drawer-body">
          {navItems.map(item => {
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`drawer-item ${isActive ? 'active' : ''}`}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px' }}>
                  {item.icon}
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ lineHeight: 1.2 }}>{item.label}</div>
                  <div style={{
                    fontSize: '0.72rem',
                    color: isActive ? 'inherit' : 'var(--text-muted)',
                    opacity: 0.85,
                    marginTop: '0.1rem'
                  }}>
                    {item.desc}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Drawer Footer: User, Theme & Logout */}
        <div className="drawer-footer">
          {/* User info */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: 'var(--bg-app)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <IconUser size={16} />
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.1 }}>
                  {currentUser?.name}
                </div>
                <span className="badge badge-neutral" style={{ fontSize: '0.65rem', textTransform: 'uppercase' }}>
                  {currentUser?.role === 'owner' ? 'Pemilik (Admin)' : 'Kasir'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              className="btn-ghost btn-sm"
              title={theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
            >
              {theme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
            </button>
          </div>

          {/* Tombol Logout */}
          <button
            type="button"
            onClick={handleLogout}
            className="btn-danger"
            style={{ width: '100%', justifyContent: 'center', gap: '0.5rem' }}
          >
            <IconLogOut size={18} />
            <span>Keluar (Logout)</span>
          </button>
        </div>
      </div>
    </div>
  )
}
