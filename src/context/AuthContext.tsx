import React, { createContext, useContext, useState, useEffect } from 'react'
import { db } from '../db/db'
import type { User, StoreSetting, Shift } from '../types'
import { generateId } from '../utils/id'

interface AuthContextType {
  currentUser: User | null
  storeSetting: StoreSetting | null
  activeShift: Shift | null
  isLoading: boolean
  isInitialSetup: boolean
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
    const user = await db.users.where('email').equals(email.trim().toLowerCase()).first()
    if (!user) {
      return { success: false, message: 'Email tidak ditemukan.' }
    }

    const pinOrPassHash = await hashSecret(password)
    const isValid = user.password_hash === pinOrPassHash || user.pin_hash === pinOrPassHash
    if (!isValid) {
      return { success: false, message: 'Sandi atau PIN salah.' }
    }

    setCurrentUser(user)
    localStorage.setItem('kasir_active_user_id', user.id)
    await loadShiftForUser(user.id)
    return { success: true }
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
        theme,
        toggleTheme,
        registerStoreAndOwner,
        loginWithPin,
        loginWithEmail,
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
