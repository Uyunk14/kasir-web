import React from 'react'
import {
  IconCart,
  IconBox,
  IconUsers,
  IconDollarSign,
  IconReceipt,
  IconSettings
} from '../icons/Icons'

export type NavTab = 'pos' | 'products' | 'customers' | 'expenses' | 'reports' | 'settings'

interface NavigationProps {
  activeTab: NavTab
  onSelectTab: (tab: NavTab) => void
  isOwner: boolean
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onSelectTab, isOwner }) => {
  const tabs = [
    { id: 'pos' as NavTab, label: 'Kasir', icon: <IconCart size={18} /> },
    { id: 'products' as NavTab, label: 'Produk & Stok', icon: <IconBox size={18} /> },
    { id: 'customers' as NavTab, label: 'Pelanggan & Utang', icon: <IconUsers size={18} /> },
    { id: 'expenses' as NavTab, label: 'Kas & Kulakan', icon: <IconDollarSign size={18} /> },
    { id: 'reports' as NavTab, label: 'Laporan', icon: <IconReceipt size={18} /> },
    ...(isOwner ? [{ id: 'settings' as NavTab, label: 'Pengaturan', icon: <IconSettings size={18} /> }] : [])
  ]

  return (
    <nav
      className="mobile-hide"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.25rem',
        padding: '0.5rem 1.25rem',
        backgroundColor: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-default)',
        overflowX: 'auto',
        flexShrink: 0
      }}
    >
      {tabs.map(t => {
        const isActive = activeTab === t.id
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelectTab(t.id)}
            className={isActive ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}
            style={{
              padding: '0.5rem 0.9rem',
              borderRadius: 'var(--radius-md)',
              whiteSpace: 'nowrap'
            }}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
