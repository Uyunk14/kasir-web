import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import {
  IconMenu,
  IconStore,
  IconUser,
  IconMoon,
  IconSun,
  IconLogOut,
  IconWifi,
  IconWifiOff
} from '../icons/Icons'

interface HeaderProps {
  onOpenShiftModal: () => void
  onToggleDrawer: () => void
}

export const Header: React.FC<HeaderProps> = ({ onOpenShiftModal, onToggleDrawer }) => {
  const { storeSetting, currentUser, activeShift, logout, theme, toggleTheme } = useAuth()
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const handleLogout = () => {
    if (confirm('Apakah Anda yakin ingin keluar (Logout)?')) {
      logout()
    }
  }

  return (
    <header className="app-header">
      {/* KIRI: Logo Toko & Nama Toko (Bersih & Rapi) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--accent-primary)',
          color: 'var(--accent-primary-text)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <IconStore size={18} />
        </div>

        <div style={{ minWidth: 0 }}>
          <h2
            className="header-store-name"
            style={{ fontSize: '1rem', fontWeight: 700, lineHeight: 1.15 }}
          >
            {storeSetting?.store_name || 'Kasir Toko'}
          </h2>
          <span
            className="header-subtitle"
            style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}
          >
            {storeSetting?.address || 'Aplikasi Kasir PWA'}
          </span>
        </div>
      </div>

      {/* KANAN: Status Shift, User, Logout & Tombol Garis 3 (Hamburger) DI POJOK KANAN */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
        {/* Tombol Shift Lengkap (Desktop) */}
        <button
          type="button"
          onClick={onOpenShiftModal}
          className={activeShift ? 'btn-secondary btn-sm mobile-hide' : 'btn-primary btn-sm mobile-hide'}
          style={{ height: '34px', padding: '0 0.65rem', gap: '0.4rem', fontSize: '0.8rem' }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: activeShift ? '#10B981' : '#F59E0B',
              flexShrink: 0
            }}
          />
          {activeShift ? (
            <span>
              Shift Buka{' '}
              <strong className="mono">
                Rp {(activeShift.opening_cash / 1000).toLocaleString('id-ID')}k
              </strong>
            </span>
          ) : (
            <span>Buka Shift</span>
          )}
        </button>

        {/* Indikator Titik Shift (Mobile Only - Hemat Ruang) */}
        <button
          type="button"
          onClick={onOpenShiftModal}
          className="mobile-show-only btn-ghost"
          style={{ padding: '0.4rem', borderRadius: 'var(--radius-full)' }}
          title={activeShift ? 'Shift Aktif - Klik untuk Tutup' : 'Shift Tutup - Klik untuk Buka'}
        >
          <span
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: activeShift ? '#10B981' : '#F59E0B',
              display: 'inline-block'
            }}
          />
        </button>

        {/* Status Online (Desktop) */}
        <div
          className="badge mobile-hide"
          style={{
            height: '28px',
            padding: '0 0.5rem',
            backgroundColor: isOnline ? 'var(--status-success-bg)' : 'var(--status-warning-bg)',
            color: isOnline ? 'var(--status-success-text)' : 'var(--status-warning-text)',
            border: `1px solid ${isOnline ? 'var(--status-success-border)' : 'var(--status-warning-border)'}`
          }}
        >
          {isOnline ? <IconWifi size={13} /> : <IconWifiOff size={13} />}
          <span style={{ fontSize: '0.7rem' }}>{isOnline ? 'Online' : 'Offline'}</span>
        </div>

        {/* Info Pengguna / Kasir (Desktop) */}
        <div
          className="mobile-hide"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.3rem 0.65rem',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--bg-surface-subtle)',
            border: '1px solid var(--border-default)',
            fontSize: '0.8rem'
          }}
        >
          <IconUser size={14} />
          <span style={{ fontWeight: 600 }}>{currentUser?.name}</span>
          <span className="badge badge-neutral" style={{ fontSize: '0.62rem', textTransform: 'uppercase' }}>
            {currentUser?.role === 'owner' ? 'Pemilik' : 'Kasir'}
          </span>
        </div>

        {/* Toggle Tema (Desktop) */}
        <button
          type="button"
          onClick={toggleTheme}
          className="btn-ghost mobile-hide"
          style={{ width: '34px', height: '34px', padding: 0, borderRadius: 'var(--radius-md)' }}
          title={theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
        >
          {theme === 'dark' ? <IconSun size={17} /> : <IconMoon size={17} />}
        </button>

        {/* Tombol Logout (Desktop) */}
        <button
          type="button"
          onClick={handleLogout}
          className="btn-ghost mobile-hide"
          style={{
            color: 'var(--status-danger-text)',
            padding: '0.35rem 0.6rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--status-danger-border)',
            backgroundColor: 'var(--status-danger-bg)'
          }}
          title="Keluar / Logout Akun"
        >
          <IconLogOut size={16} />
          <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Logout</span>
        </button>

        {/* TOMBOL TIGA GARIS (HAMBURGER) DI POJOK KANAN ATAS */}
        <button
          type="button"
          onClick={onToggleDrawer}
          className="btn-ghost"
          style={{
            padding: '0.45rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-primary)',
            backgroundColor: 'var(--bg-surface-subtle)'
          }}
          title="Buka Menu Navigasi (Tiga Garis)"
        >
          <IconMenu size={22} />
        </button>
      </div>
    </header>
  )
}
