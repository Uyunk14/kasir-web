import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { db } from '../../db/db'
import { IconLock, IconUser, IconAlert, IconCheck, IconMoon, IconSun } from '../icons/Icons'

interface LoginScreenProps {
  onSwitchToRegister?: () => void
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onSwitchToRegister }) => {
  const { storeSetting, loginWithPin, loginWithEmail, theme, toggleTheme } = useAuth()
  
  const [hasLocalUsers, setHasLocalUsers] = useState<boolean>(true)
  const [loginMode, setLoginMode] = useState<'pin' | 'email'>('pin')
  const [pin, setPin] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    db.users.count().then(count => {
      const exists = count > 0
      setHasLocalUsers(exists)
      if (!exists) {
        setLoginMode('email')
      }
    })
  }, [])

  // PIN Keypad Handlers
  const handleKeyClick = (digit: string) => {
    if (pin.length < 6) {
      const nextPin = pin + digit
      setPin(nextPin)
      if (nextPin.length === 6) {
        submitPin(nextPin)
      }
    }
  }

  const handleDeletePin = () => {
    setPin(prev => prev.slice(0, -1))
  }

  const submitPin = async (codeToSubmit: string) => {
    setIsLoading(true)
    setError('')
    try {
      const res = await loginWithPin(codeToSubmit)
      if (!res.success) {
        setError(res.message || 'PIN salah')
        setPin('')
      }
    } catch (err: any) {
      setError(err.message || 'Gagal login')
      setPin('')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    try {
      const res = await loginWithEmail(email, password)
      if (!res.success) {
        setError(res.message || 'Login gagal')
      }
    } catch (err: any) {
      setError(err.message || 'Gagal login')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      backgroundColor: 'var(--bg-app)',
      position: 'relative'
    }}>
      {/* Top right theme toggle */}
      <button
        onClick={toggleTheme}
        className="btn-ghost"
        style={{ position: 'absolute', top: '1.25rem', right: '1.25rem' }}
        title="Ganti Tema"
      >
        {theme === 'dark' ? <IconSun size={20} /> : <IconMoon size={20} />}
      </button>

      <div className="card" style={{
        maxWidth: '420px',
        width: '100%',
        padding: '2rem 2rem',
        boxShadow: 'var(--shadow-lg)',
        textAlign: 'center'
      }}>
        {/* Switcher Tab: Masuk (Login) vs Daftar Toko */}
        {onSwitchToRegister && (
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
              Masuk (Login)
            </button>
            <button
              type="button"
              onClick={onSwitchToRegister}
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
              Daftar Toko Baru
            </button>
          </div>
        )}

        {/* Store Name & Logo */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '52px',
          height: '52px',
          borderRadius: '14px',
          backgroundColor: 'var(--accent-primary)',
          color: 'var(--accent-primary-text)',
          marginBottom: '0.85rem'
        }}>
          <IconLock size={26} />
        </div>

        <h1 style={{ fontSize: '1.4rem', marginBottom: '0.2rem' }}>
          {storeSetting?.store_name || 'Kasir Toko'}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          {!hasLocalUsers
            ? 'Masuk dengan Email & Sandi Akun Anda'
            : loginMode === 'pin'
            ? 'Masukkan 6 Digit PIN Kasir'
            : 'Masuk dengan Email & Sandi'}
        </p>

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.65rem 0.85rem',
            marginBottom: '1.25rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--status-danger-bg)',
            border: '1px solid var(--status-danger-border)',
            color: 'var(--status-danger-text)',
            fontSize: '0.82rem',
            textAlign: 'left'
          }}>
            <IconAlert size={16} />
            <span>{error}</span>
          </div>
        )}

        {loginMode === 'pin' ? (
          <div>
            {/* PIN Dots Indicator */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '0.75rem',
              marginBottom: '2rem'
            }}>
              {[0, 1, 2, 3, 4, 5].map(idx => (
                <div
                  key={idx}
                  style={{
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    border: '2px solid var(--border-focus)',
                    backgroundColor: pin.length > idx ? 'var(--accent-primary)' : 'transparent',
                    transition: 'all 120ms ease'
                  }}
                />
              ))}
            </div>

            {/* Numeric Keypad Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '0.75rem',
              maxWidth: '300px',
              margin: '0 auto 1.5rem auto'
            }}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleKeyClick(num)}
                  className="btn-secondary"
                  style={{
                    height: '56px',
                    fontSize: '1.35rem',
                    fontWeight: 700,
                    borderRadius: 'var(--radius-lg)'
                  }}
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPin('')}
                className="btn-ghost"
                style={{ height: '56px', fontSize: '0.85rem', fontWeight: 600 }}
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => handleKeyClick('0')}
                className="btn-secondary"
                style={{
                  height: '56px',
                  fontSize: '1.35rem',
                  fontWeight: 700,
                  borderRadius: 'var(--radius-lg)'
                }}
              >
                0
              </button>
              <button
                type="button"
                onClick={handleDeletePin}
                className="btn-ghost"
                style={{ height: '56px' }}
                title="Hapus Digit Terakhir"
              >
                Hapus
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                type="button"
                className="btn-outline btn-sm"
                onClick={() => { setLoginMode('email'); setError('') }}
                style={{ width: '100%' }}
              >
                <IconUser size={16} /> Masuk dengan Email & Sandi
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ textAlign: 'left' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                Email
              </label>
              <input
                type="email"
                placeholder="nama@toko.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div style={{ textAlign: 'left' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                Kata Sandi
              </label>
              <input
                type="password"
                placeholder="Kata sandi akun"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={isLoading}
              style={{ marginTop: '0.5rem', width: '100%' }}
            >
              <IconCheck size={18} />
              {isLoading ? 'Memverifikasi...' : 'Masuk'}
            </button>

            {hasLocalUsers && (
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => { setLoginMode('pin'); setError('') }}
                style={{ width: '100%' }}
              >
                <IconLock size={16} /> Kembali ke Login PIN Kasir
              </button>
            )}
          </form>
        )}

        {onSwitchToRegister && (
          <div style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Belum memiliki toko atau akun kasir?{' '}
            <button
              type="button"
              onClick={onSwitchToRegister}
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
              Daftar Toko Baru
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
