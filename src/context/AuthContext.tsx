import React, { createContext, useContext, useState, useEffect } from 'react'
import { db } from '../db/db'
import type { User, StoreSetting, Shift } from '../types'
import { generateId } from '../utils/id'
import { pb } from '../services/pocketbase'
import { syncAllToPocketBase, pullFromPocketBase } from '../services/syncService'

interface AuthContextType {
  currentUser: User | null
  storeSetting: StoreSetting | null
  activeShift: Shift | null
  isLoading: boolean
  isInitialSetup: boolean
  authScreenMode: 'login' | 'register'
  setAuthScreenMode: (mode: 'login' | 'register') => void
  theme: 'light' | 'dark'
  toggleTheme: () => void
  registerStoreAndOwner: (
    storeName: string,
    ownerName: string,
    email: string,
    password: string,
    pin: string,
    phone?: string,
    address?: string
  ) => Promise<void>
  loginWithPin: (pin: string) => Promise<{ success: boolean; message?: string }>
  loginWithEmail: (email: string, password: string) => Promise<{ success: boolean; message?: string }>
  syncAccountToCloud: (password: string) => Promise<{ success: boolean; message: string }>
  logout: () => void
  openCashierShift: (openingCash: number) => Promise<Shift>
  closeCashierShift: (closingCash: number, notes?: string) => Promise<Shift>
  refreshActiveShift: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Simple hash for offline PIN/password security demonstration
async function hashSecret(str: string): Promise<string> {
  const enc = new TextEncoder().encode(str)
  const hashBuffer = await crypto.subtle.digest('SHA-256', enc)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [storeSetting, setStoreSetting] = useState<StoreSetting | null>(null)
  const [activeShift, setActiveShift] = useState<Shift | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isInitialSetup, setIsInitialSetup] = useState(false)
  const [authScreenMode, setAuthScreenMode] = useState<'login' | 'register'>('login')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  // Theme setup
  useEffect(() => {
    const savedTheme = localStorage.getItem('kasir_theme') as 'light' | 'dark' | null
    if (savedTheme) {
      setTheme(savedTheme)
      document.documentElement.setAttribute('data-theme', savedTheme)
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark')
      document.documentElement.setAttribute('data-theme', 'dark')
    }
  }, [])

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    localStorage.setItem('kasir_theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }

  // Check initial setup & load active session
  useEffect(() => {
    async function initAuth() {
      try {
        const storeCount = await db.store_settings.count()
        const userCount = await db.users.count()

        if (storeCount === 0 || userCount === 0) {
          setIsInitialSetup(true)
          setAuthScreenMode('login')
          setIsLoading(false)
          return
        }

        const currentStore = await db.store_settings.toCollection().first()
        if (currentStore) {
          setStoreSetting(currentStore)
        }

        // Check if there is a saved user session
        const savedUserId = localStorage.getItem('kasir_active_user_id')
        if (savedUserId) {
          const user = await db.users.get(savedUserId)
          if (user) {
            setCurrentUser(user)
            await loadShiftForUser(user.id)
          }
        }
      } catch (err) {
        console.error('Failed to initialize local DB auth:', err)
      } finally {
        setIsLoading(false)
      }
    }

    initAuth()
  }, [])

  const loadShiftForUser = async (userId: string) => {
    const openShift = await db.shifts
      .where({ user_id: userId, status: 'open' })
      .first()
    setActiveShift(openShift || null)
  }

  const registerStoreAndOwner = async (
    storeName: string,
    ownerName: string,
    email: string,
    password: string,
    pin: string,
    phone = '',
    address = ''
  ) => {
    const storeId = generateId()
    const ownerId = generateId()
    const pinHash = await hashSecret(pin)
    const passHash = await hashSecret(password)
    const now = new Date().toISOString()

    const newStore: StoreSetting = {
      id: storeId,
      store_name: storeName,
      owner_name: ownerName,
      phone,
      address,
      receipt_footer: `Terima kasih atas kunjungan Anda di ${storeName}`,
      is_configured: true,
      created_at: now
    }

    const newOwner: User = {
      id: ownerId,
      name: ownerName,
      email: email.trim().toLowerCase(),
      pin_hash: pinHash,
      password_hash: passHash,
      role: 'owner',
      created_at: now,
      synced: false
    }

    // Default general category
    const defaultCatId = generateId()
    await db.categories.add({
      id: defaultCatId,
      name: 'Umum',
      synced: false
    })

    await db.store_settings.add(newStore)
    await db.users.add(newOwner)

    // Buat juga akun di PocketBase cloud jika sedang online
    try {
      if (navigator.onLine) {
        await pb.collection('users').create({
          email: email.trim().toLowerCase(),
          password: password,
          passwordConfirm: password,
          name: ownerName
        }, { requestKey: null })
        await pb.collection('users').authWithPassword(email.trim().toLowerCase(), password)
      }
    } catch (pbErr) {
      console.warn('PocketBase owner registration:', pbErr)
    }

    setStoreSetting(newStore)
    setCurrentUser(newOwner)
    setIsInitialSetup(false)
    localStorage.setItem('kasir_active_user_id', ownerId)
  }

  const loginWithPin = async (pin: string): Promise<{ success: boolean; message?: string }> => {
    const pinHash = await hashSecret(pin)
    const matchedUser = await db.users.where('pin_hash').equals(pinHash).first()

    if (!matchedUser) {
      return { success: false, message: 'PIN salah. Silakan coba lagi.' }
    }

    setCurrentUser(matchedUser)
    localStorage.setItem('kasir_active_user_id', matchedUser.id)
    await loadShiftForUser(matchedUser.id)
    return { success: true }
  }

  const loginWithEmail = async (email: string, password: string): Promise<{ success: boolean; message?: string }> => {
    const cleanEmail = email.trim().toLowerCase()

    // 1. Cek pengguna di database lokal (IndexedDB)
    const user = await db.users.where('email').equals(cleanEmail).first()
    if (user) {
      const pinOrPassHash = await hashSecret(password)
      const isValid = user.password_hash === pinOrPassHash || user.pin_hash === pinOrPassHash
      if (isValid) {
        setCurrentUser(user)
        setIsInitialSetup(false)
        localStorage.setItem('kasir_active_user_id', user.id)
        await loadShiftForUser(user.id)

        // Login juga ke PocketBase jika online agar auth token aktif
        if (navigator.onLine) {
          pb.collection('users').authWithPassword(cleanEmail, password).catch(() => {})
        }
        return { success: true }
      }
      return { success: false, message: 'Kata sandi atau PIN salah.' }
    }

    // 2. Jika tidak ada di lokal (misal baru buka di perangkat baru / HP), login ke server PocketBase cloud
    try {
      if (navigator.onLine) {
        const authData = await pb.collection('users').authWithPassword(cleanEmail, password)
        if (authData && authData.record) {
          const pbUser = authData.record
          const passHash = await hashSecret(password)
          const pinHash = await hashSecret('123456') // default PIN
          const newUser: User = {
            id: pbUser.id,
            name: pbUser.name || cleanEmail.split('@')[0],
            email: cleanEmail,
            pin_hash: pinHash,
            password_hash: passHash,
            role: 'owner',
            created_at: pbUser.created || new Date().toISOString(),
            synced: true
          }
          await db.users.put(newUser)

          let currentStore = await db.store_settings.toCollection().first()
          if (!currentStore) {
            const newStore: StoreSetting = {
              id: generateId(),
              store_name: `${newUser.name}'s Toko`,
              owner_name: newUser.name,
              phone: '',
              address: '',
              receipt_footer: 'Terima kasih atas kunjungan Anda',
              is_configured: true,
              created_at: new Date().toISOString()
            }
            await db.store_settings.add(newStore)
            currentStore = newStore
          }

          setStoreSetting(currentStore)
          setCurrentUser(newUser)
          setIsInitialSetup(false)
          localStorage.setItem('kasir_active_user_id', newUser.id)

          // Tarik semua data produk, kategori, pelanggan langsung ke perangkat baru (HP)
          pullFromPocketBase().catch(e => console.warn('Auto pull on login error:', e))
          return { success: true }
        }
      } else {
        return { success: false, message: 'Tidak ada koneksi internet untuk memeriksa akun di cloud.' }
      }
    } catch (pbErr: any) {
      console.warn('PocketBase cloud login:', pbErr)
      return {
        success: false,
        message: 'Email atau kata sandi tidak cocok di Cloud PocketBase. Jika akun dibuat di PC sebelumnya, pastikan akun sudah dihubungkan ke Cloud di menu Pengaturan Toko di PC, atau silakan "Daftar Toko Baru".'
      }
    }

    return {
      success: false,
      message: 'Email tidak ditemukan di lokal maupun server cloud. Silakan periksa kembali atau daftar toko baru.'
    }
  }

  // Daftarkan/hubungkan akun lokal yang sudah ada di PC ke PocketBase Cloud
  const syncAccountToCloud = async (password: string): Promise<{ success: boolean; message: string }> => {
    if (!currentUser) return { success: false, message: 'Belum ada pengguna yang login di perangkat ini.' }
    if (password.length < 8) {
      return { success: false, message: 'Kata sandi minimal 8 karakter sesuai standar PocketBase Cloud.' }
    }
    if (!navigator.onLine) {
      return { success: false, message: 'Tidak ada koneksi internet. Pastikan PC terhubung ke internet.' }
    }

    const cleanEmail = currentUser.email.trim().toLowerCase()
    try {
      // 1. Coba daftarkan akun ke PocketBase jika belum ada
      try {
        await pb.collection('users').create({
          email: cleanEmail,
          password: password,
          passwordConfirm: password,
          name: currentUser.name
        }, { requestKey: null })
      } catch (createErr: any) {
        console.log('PocketBase user creation info:', createErr?.message)
      }

      // 2. Lakukan login ke PocketBase untuk mengesahkan token auth
      await pb.collection('users').authWithPassword(cleanEmail, password)

      // 3. Perbarui hash sandi di database lokal dan tandai synced
      const passHash = await hashSecret(password)
      await db.users.update(currentUser.id, {
        password_hash: passHash,
        synced: true
      })
      setCurrentUser(prev => prev ? { ...prev, password_hash: passHash, synced: true } : null)

      // 4. Sinkronkan seluruh data toko (kategori, produk, kasir, pelanggan, transaksi) ke PocketBase
      await syncAllToPocketBase()

      return {
        success: true,
        message: `Akun ${cleanEmail} berhasil terhubung ke Cloud PocketBase! Semua data produk dan toko telah disinkronkan. Sekarang Anda bisa login di HP dengan email dan kata sandi ini.`
      }
    } catch (err: any) {
      console.error('syncAccountToCloud error:', err)
      return {
        success: false,
        message: err.message || 'Gagal menghubungkan akun ke Cloud. Pastikan server PocketBase aktif.'
      }
    }
  }

  const logout = () => {
    setCurrentUser(null)
    setActiveShift(null)
    localStorage.removeItem('kasir_active_user_id')
  }

  const openCashierShift = async (openingCash: number): Promise<Shift> => {
    if (!currentUser) throw new Error('Pengguna belum login')

    const newShift: Shift = {
      id: generateId(),
      user_id: currentUser.id,
      user_name: currentUser.name,
      opening_cash: openingCash,
      status: 'open',
      opened_at: new Date().toISOString(),
      synced: false
    }

    await db.shifts.add(newShift)
    setActiveShift(newShift)
    return newShift
  }

  const closeCashierShift = async (closingCash: number, notes = ''): Promise<Shift> => {
    if (!activeShift) throw new Error('Tidak ada shift aktif')

    // Hitung total tunai dari penjualan pada shift ini
    const salesInShift = await db.sales
      .where('shift_id')
      .equals(activeShift.id)
      .and(s => s.status === 'completed')
      .toArray()

    let totalCashReceived = 0
    for (const s of salesInShift) {
      const payments = await db.sale_payments.where('sale_id').equals(s.id).toArray()
      for (const p of payments) {
        if (p.method === 'cash') {
          totalCashReceived += p.amount
        }
      }
      totalCashReceived -= s.change_amount // Kurangi kembalian
    }

    // Kas keluar pada shift ini
    const expensesInShift = await db.expenses
      .where('shift_id')
      .equals(activeShift.id)
      .toArray()
    const totalExpenses = expensesInShift.reduce((sum, e) => sum + e.amount, 0)

    const expectedCash = activeShift.opening_cash + totalCashReceived - totalExpenses
    const difference = closingCash - expectedCash

    const updatedShift: Shift = {
      ...activeShift,
      closing_cash: closingCash,
      expected_cash: expectedCash,
      difference,
      notes,
      closed_at: new Date().toISOString(),
      status: 'closed',
      synced: false
    }

    await db.shifts.put(updatedShift)
    setActiveShift(null)
    return updatedShift
  }

  const refreshActiveShift = async () => {
    if (currentUser) {
      await loadShiftForUser(currentUser.id)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        storeSetting,
        activeShift,
        isLoading,
        isInitialSetup,
        authScreenMode,
        setAuthScreenMode,
        theme,
        toggleTheme,
        registerStoreAndOwner,
        loginWithPin,
        loginWithEmail,
        syncAccountToCloud,
        logout,
        openCashierShift,
        closeCashierShift,
        refreshActiveShift
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
