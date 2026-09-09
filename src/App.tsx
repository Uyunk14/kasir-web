import React, { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Header } from './components/layout/Header'
import { Navigation, type NavTab } from './components/layout/Navigation'
import { NavigationDrawer } from './components/layout/NavigationDrawer'
import { Onboarding } from './components/auth/Onboarding'
import { LoginScreen } from './components/auth/LoginScreen'
import { ShiftModal } from './components/pos/ShiftModal'
import { POSView } from './components/pos/POSView'
import { ProductsView } from './components/products/ProductsView'
import { CustomersView } from './components/customers/CustomersView'
import { ExpensesView } from './components/expenses/ExpensesView'
import { ReportsView } from './components/reports/ReportsView'
import { SettingsView } from './components/settings/SettingsView'
import { IconStore } from './components/icons/Icons'
import { initRealtimeSubscriptions, getUnsyncedCount, pullFromPocketBase } from './services/syncService'

const AppContent: React.FC = () => {
  const { currentUser, isLoading, isInitialSetup } = useAuth()
  const [activeTab, setActiveTab] = useState<NavTab>('pos')
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  useEffect(() => {
    if (currentUser) {
      initRealtimeSubscriptions()
      getUnsyncedCount()
      if (navigator.onLine) {
        pullFromPocketBase().catch(() => {})
      }
    }
  }, [currentUser])

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        backgroundColor: 'var(--bg-app)'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          backgroundColor: 'var(--accent-primary)',
          color: 'var(--accent-primary-text)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <IconStore size={24} />
        </div>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Memuat Kasir Toko...</p>
      </div>
    )
  }

  // First time onboarding setup
  if (isInitialSetup) {
    return <Onboarding />
  }

  // Login / Lock screen if not authenticated
  if (!currentUser) {
    return <LoginScreen />
  }

  return (
    <div className="app-container">
      <Header
        onOpenShiftModal={() => setIsShiftModalOpen(true)}
        onToggleDrawer={() => setIsDrawerOpen(prev => !prev)}
      />
      <Navigation
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isOwner={currentUser.role === 'owner'}
      />

      <main className="app-body">
        {activeTab === 'pos' && <POSView />}
        {activeTab === 'products' && <ProductsView />}
        {activeTab === 'customers' && <CustomersView />}
        {activeTab === 'expenses' && <ExpensesView />}
        {activeTab === 'reports' && <ReportsView />}
        {activeTab === 'settings' && <SettingsView />}
      </main>

      <NavigationDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenShiftModal={() => setIsShiftModalOpen(true)}
      />

      <ShiftModal
        isOpen={isShiftModalOpen}
        onClose={() => setIsShiftModalOpen(false)}
      />
    </div>
  )
}

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
