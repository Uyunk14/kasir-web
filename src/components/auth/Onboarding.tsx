import React, { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { IconStore, IconUser, IconCheck, IconAlert } from '../icons/Icons'

interface OnboardingProps {
  onSwitchToLogin: () => void
}

export const Onboarding: React.FC<OnboardingProps> = ({ onSwitchToLogin }) => {
  const { registerStoreAndOwner } = useAuth()
  
  const [storeName, setStoreName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!storeName.trim()) {
      setError('Nama toko wajib diisi')
      return
    }
    if (!ownerName.trim()) {
      setError('Nama pemilik wajib diisi')
      return
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Email valid wajib diisi')
      return
    }
    if (password.length < 8) {
      setError('Kata sandi minimal 8 karakter (standar keamanan PocketBase cloud)')
      return
    }
    if (pin.length !== 6 || !/^\d+$/.test(pin)) {
      setError('PIN kasir harus berupa 6 angka')
      return
    }

    try {
      setIsSubmitting(true)
      await registerStoreAndOwner(
        storeName.trim(),
        ownerName.trim(),
        email.trim(),
        password,
        pin,
        phone.trim(),
        address.trim()
      )
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Gagal menyimpan data toko')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      backgroundColor: 'var(--bg-app)'
    }}>
      <div className="card" style={{
        maxWidth: '560px',
        width: '100%',
        padding: '2rem 2.25rem',
        boxShadow: 'var(--shadow-lg)'
      }}>
        {/* Switcher Tab: Masuk (Login) vs Daftar Toko */}
        <div style={{
          display: 'flex',
          backgroundColor: 'var(--bg-surface-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '0.3rem',
          marginBottom: '1.5rem',
          border: '1px solid var(--border-default)'
        }}>
          <button
            type="button"
            onClick={onSwitchToLogin}
            style={{
              flex: 1,
              padding: '0.55rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.88rem',
              cursor: 'pointer'
            }}
          >
            Masuk (Login)
          </button>
          <button
            type="button"
            style={{
              flex: 1,
              padding: '0.55rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: 'var(--accent-primary)',
              color: 'var(--accent-primary-text)',
              fontWeight: 600,
              fontSize: '0.88rem',
              cursor: 'pointer'
            }}
          >
            Daftar Toko Baru
          </button>
        </div>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            backgroundColor: 'var(--accent-primary)',
            color: 'var(--accent-primary-text)',
            marginBottom: '1rem'
          }}>
            <IconStore size={28} />
          </div>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>Setup Kasir Baru</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Aplikasi mulai bersih tanpa data contoh. Buat toko dan akun Pemilik pertama Anda.
          </p>
        </div>

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.75rem 1rem',
            marginBottom: '1.25rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--status-danger-bg)',
            border: '1px solid var(--status-danger-border)',
            color: 'var(--status-danger-text)',
            fontSize: '0.85rem'
          }}>
            <IconAlert size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Section: Toko */}
          <div>
            <h3 style={{
              fontSize: '0.95rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--text-secondary)',
              marginBottom: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <IconStore size={16} /> Informasi Toko
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Nama Toko *
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Toko Kelontong Berkah"
                  value={storeName}
                  onChange={e => setStoreName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    No. WhatsApp / HP
                  </label>
                  <input
                    type="tel"
                    placeholder="08123456789"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Kota / Alamat Singkat
                  </label>
                  <input
                    type="text"
                    placeholder="Jl. Raya Pasar No. 12"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)' }} />

          {/* Section: Akun Pemilik */}
          <div>
            <h3 style={{
              fontSize: '0.95rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--text-secondary)',
              marginBottom: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <IconUser size={16} /> Akun Pemilik (Akses Penuh)
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Nama Pemilik *
                </label>
                <input
                  type="text"
                  placeholder="Nama Lengkap Anda"
                  value={ownerName}
                  onChange={e => setOwnerName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Email Pemilik *
                </label>
                <input
                  type="email"
                  placeholder="owner@toko.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Kata Sandi *
                  </label>
                  <input
                    type="password"
                    placeholder="Minimal 8 karakter"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    PIN Kasir (6 Angka) *
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    placeholder="123456"
                    className="mono"
                    value={pin}
                    onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                    required
                  />
                </div>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                PIN digunakan untuk login cepat kasir dan otorisasi saat pergantian shift atau retur barang.
              </span>
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary btn-lg"
            disabled={isSubmitting}
            style={{ marginTop: '0.75rem', width: '100%' }}
          >
            <IconCheck size={20} />
            {isSubmitting ? 'Menyiapkan Toko...' : 'Mulai Menggunakan Kasir'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Sudah memiliki akun atau toko?{' '}
          <button
            type="button"
            onClick={onSwitchToLogin}
            style={{
              fontWeight: 600,
              color: 'var(--accent-primary)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: 0,
              fontSize: '0.85rem'
            }}
          >
            Masuk ke Kasir
          </button>
        </div>
      </div>
    </div>
  )
}
