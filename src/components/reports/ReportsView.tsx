import React, { useState, useEffect } from 'react'
import { db } from '../../db/db'
import type { Sale, Expense, Product } from '../../types'
import {
  IconTrendingUp,
  IconAlert,
  IconCheck,
  IconX
} from '../icons/Icons'
import { formatRupiah } from '../../utils/printer'
import { useAuth } from '../../context/AuthContext'
import { generateId } from '../../utils/id'

export const ReportsView: React.FC = () => {
  const { currentUser } = useAuth()
  const isOwner = currentUser?.role === 'owner'

  const [filterPeriod, setFilterPeriod] = useState<'today' | '7days' | 'month' | 'all'>('today')
  const [sales, setSales] = useState<Sale[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([])
  const [topProducts, setTopProducts] = useState<{ name: string; qty: number; revenue: number }[]>([])

  // Modal Retur Transaksi
  const [returSale, setReturSale] = useState<Sale | null>(null)
  const [returPin, setReturPin] = useState('')
  const [returReason, setReturReason] = useState('Pelanggan membatalkan pembelian')
  const [returError, setReturError] = useState('')

  const loadReportData = async () => {
    const [allSales, allExpenses, allProducts, allSaleItems] = await Promise.all([
      db.sales.toArray(),
      db.expenses.toArray(),
      db.products.toArray(),
      db.sale_items.toArray()
    ])

    // Filter by date
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const startOf7Days = startOfToday - 7 * 24 * 60 * 60 * 1000
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime()

    const filteredSales = allSales.filter(s => {
      const time = new Date(s.created_at).getTime()
      if (filterPeriod === 'today') return time >= startOfToday
      if (filterPeriod === '7days') return time >= startOf7Days
      if (filterPeriod === 'month') return time >= startOfMonth
      return true
    }).sort((a, b) => b.created_at.localeCompare(a.created_at))

    const filteredExpenses = allExpenses.filter(e => {
      const time = new Date(e.created_at).getTime()
      if (filterPeriod === 'today') return time >= startOfToday
      if (filterPeriod === '7days') return time >= startOf7Days
      if (filterPeriod === 'month') return time >= startOfMonth
      return true
    })

    setSales(filteredSales)
    setExpenses(filteredExpenses)

    // Low stock items
    const lowItems = allProducts.filter(p => p.current_stock <= p.min_stock)
    setLowStockProducts(lowItems)

    // Top selling products aggregation
    const completedSaleIds = new Set(filteredSales.filter(s => s.status === 'completed').map(s => s.id))
    const itemAgg: Record<string, { name: string; qty: number; revenue: number }> = {}

    for (const item of allSaleItems) {
      if (completedSaleIds.has(item.sale_id)) {
        if (!itemAgg[item.product_name]) {
          itemAgg[item.product_name] = { name: item.product_name, qty: 0, revenue: 0 }
        }
        itemAgg[item.product_name].qty += item.quantity
        itemAgg[item.product_name].revenue += item.subtotal
      }
    }

    const topList = Object.values(itemAgg)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5)
    setTopProducts(topList)
  }

  useEffect(() => {
    loadReportData()
  }, [filterPeriod])

  // Calculations
  const completedSales = sales.filter(s => s.status === 'completed')
  const totalRevenue = completedSales.reduce((sum, s) => sum + s.total, 0)
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)

  // Estimasi Laba Kotor (jika role Pemilik)
  const estimatedGrossProfit = totalRevenue * 0.2 // Perkiraan konservatif jika data modal tidak lengkap
  const estimatedNetProfit = estimatedGrossProfit - totalExpenses

  // Handle Retur / Void
  const handleExecuteRetur = async (e: React.FormEvent) => {
    e.preventDefault()
    setReturError('')
    if (!returSale) return

    // Otorisasi PIN Pemilik
    const enc = new TextEncoder().encode(returPin)
    const hashBuffer = await crypto.subtle.digest('SHA-256', enc)
    const pinHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')

    const ownerUser = await db.users.where('role').equals('owner').first()
    if (ownerUser && ownerUser.pin_hash !== pinHash) {
      setReturError('PIN Otorisasi Pemilik salah!')
      return
    }

    const now = new Date().toISOString()
    const returId = generateId()

    await db.transaction('rw', [db.sales, db.sale_items, db.products, db.stock_movements, db.returns], async () => {
      // 1. Update status transaksi jadi cancelled
      await db.sales.update(returSale.id, {
        status: 'cancelled',
        synced: false
      })

      // 2. Kembalikan stok barang yang dibeli
      const saleItems = await db.sale_items.where('sale_id').equals(returSale.id).toArray()
      for (const item of saleItems) {
        const prod = await db.products.get(item.product_id)
        if (prod) {
          await db.products.update(prod.id, {
            current_stock: prod.current_stock + item.quantity,
            synced: false,
            updated_at: now
          })

          await db.stock_movements.add({
            id: generateId(),
            product_id: prod.id,
            product_name: prod.name,
            type: 'in',
            quantity: item.quantity,
            ref_type: 'return',
            ref_id: returSale.id,
            notes: `Retur penjualan ${returSale.invoice_no}: ${returReason}`,
            synced: false,
            created_at: now
          })
        }
      }

      // 3. Catat record return
      await db.returns.add({
        id: returId,
        sale_id: returSale.id,
        invoice_no: returSale.invoice_no,
        user_id: currentUser?.id || 'unknown',
        amount: returSale.total,
        reason: returReason,
        synced: false,
        created_at: now
      })
    })

    setReturSale(null)
    setReturPin('')
    loadReportData()
  }

  // Export CSV
  const handleExportCSV = () => {
    let csv = 'No Invoice,Tanggal,Kasir,Pelanggan,Metode,Total,Status\n'
    sales.forEach(s => {
      csv += `"${s.invoice_no}","${new Date(s.created_at).toLocaleString('id-ID')}","${s.user_name}","${s.customer_name || 'Umum'}","${s.payment_summary}","${s.total}","${s.status}"\n`
    })

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `laporan-kasir-${filterPeriod}-${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem' }}>Laporan Penjualan & Keuangan</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Ringkasan omset penjualan, kas operasional, dan performa produk toko kelontong.
          </p>
        </div>

        {/* Date Filter & Export */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '0.2rem' }}>
            <button
              type="button"
              onClick={() => setFilterPeriod('today')}
              className={filterPeriod === 'today' ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}
            >
              Hari Ini
            </button>
            <button
              type="button"
              onClick={() => setFilterPeriod('7days')}
              className={filterPeriod === '7days' ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}
            >
              7 Hari
            </button>
            <button
              type="button"
              onClick={() => setFilterPeriod('month')}
              className={filterPeriod === 'month' ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}
            >
              Bulan Ini
            </button>
            <button
              type="button"
              onClick={() => setFilterPeriod('all')}
              className={filterPeriod === 'all' ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}
            >
              Semua
            </button>
          </div>

          <button type="button" onClick={handleExportCSV} className="btn-secondary btn-sm">
            Ekspor CSV
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div className="card">
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Omset Penjualan</span>
          <div className="mono" style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
            {formatRupiah(totalRevenue)}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {completedSales.length} Transaksi Berhasil
          </span>
        </div>

        <div className="card">
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Pengeluaran Kas Operasional</span>
          <div className="mono" style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--status-danger-text)', marginTop: '0.25rem' }}>
            {formatRupiah(totalExpenses)}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {expenses.length} Catatan Biaya
          </span>
        </div>

        {isOwner && (
          <div className="card">
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Estimasi Laba Bersih</span>
            <div className="mono" style={{ fontSize: '1.6rem', fontWeight: 800, color: estimatedNetProfit >= 0 ? '#10B981' : 'var(--status-danger-text)', marginTop: '0.25rem' }}>
              {formatRupiah(estimatedNetProfit)}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              (Laba Kotor − Pengeluaran Kas)
            </span>
          </div>
        )}

        <div className="card">
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Peringatan Stok Menipis</span>
          <div className="mono" style={{ fontSize: '1.6rem', fontWeight: 800, color: lowStockProducts.length > 0 ? '#F59E0B' : 'inherit', marginTop: '0.25rem' }}>
            {lowStockProducts.length} Produk
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Di bawah batas minimum
          </span>
        </div>
      </div>

      {/* Two Column Layout: Top Products & Low Stock Alerts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
        {/* Top Products */}
        <div className="card">
          <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <IconTrendingUp size={18} /> 5 Produk Terlaris
          </h3>
          {topProducts.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '1rem 0' }}>Belum ada penjualan pada periode ini.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {topProducts.map((tp, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.88rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ width: '20px', fontWeight: 700, color: 'var(--text-muted)' }}>#{idx + 1}</span>
                    <span style={{ fontWeight: 600 }}>{tp.name}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <strong className="mono">{tp.qty} terjual</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }} className="mono">{formatRupiah(tp.revenue)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low Stock Warning List */}
        <div className="card">
          <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#B45309' }}>
            <IconAlert size={18} /> Peringatan Stok Menipis
          </h3>
          {lowStockProducts.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '1rem 0' }}>Semua produk dalam kondisi stok aman.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
              {lowStockProducts.slice(0, 6).map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                  <span>{p.name}</span>
                  <span className="badge badge-danger mono">
                    Sisa: {p.current_stock} {p.unit} (min: {p.min_stock})
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Transaction History Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Riwayat Transaksi Penjualan</h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{sales.length} Transaksi Tercatat</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-surface-subtle)', borderBottom: '1px solid var(--border-default)' }}>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>No. Nota</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Waktu</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Kasir</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Pelanggan</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Pembayaran</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Total</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600, textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Belum ada transaksi pada periode yang dipilih.
                  </td>
                </tr>
              ) : (
                sales.map(s => {
                  const isCompleted = s.status === 'completed'

                  return (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border-subtle)', opacity: isCompleted ? 1 : 0.6 }}>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }} className="mono">
                        {s.invoice_no}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {new Date(s.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        {s.user_name}
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        {s.customer_name || 'Umum'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.82rem' }}>
                        {s.payment_summary}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 700 }} className="mono">
                        {formatRupiah(s.total)}
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span className={`badge ${isCompleted ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.72rem' }}>
                          {isCompleted ? 'Sukses' : 'Dibatalkan / Retur'}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                        {isCompleted && isOwner && (
                          <button
                            type="button"
                            onClick={() => { setReturSale(s); setReturError('') }}
                            className="btn-ghost btn-sm text-danger"
                            title="Retur / Batalkan Transaksi"
                          >
                            Retur
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================================
          MODAL: RETUR / VOID TRANSAKSI
          ====================================================================== */}
      {returSale && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', color: 'var(--status-danger-text)' }}>
                Otorisasi Retur Transaksi
              </h3>
              <button type="button" onClick={() => setReturSale(null)} className="btn-ghost btn-sm">
                <IconX size={18} />
              </button>
            </div>

            <form onSubmit={handleExecuteRetur}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <p style={{ fontSize: '0.88rem' }}>
                  Anda akan membatalkan nota <strong className="mono">{returSale.invoice_no}</strong> senilai{' '}
                  <strong className="mono">{formatRupiah(returSale.total)}</strong>. Stok barang akan otomatis dikembalikan ke etalase.
                </p>

                {returError && (
                  <div style={{
                    padding: '0.65rem',
                    backgroundColor: 'var(--status-danger-bg)',
                    color: 'var(--status-danger-text)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.82rem'
                  }}>
                    {returError}
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Alasan Retur / Pembatalan
                  </label>
                  <input
                    type="text"
                    value={returReason}
                    onChange={e => setReturReason(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    PIN Pemilik Toko (Otorisasi) *
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    className="mono"
                    placeholder="6 Digit PIN"
                    value={returPin}
                    onChange={e => setReturPin(e.target.value.replace(/\D/g, ''))}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setReturSale(null)} className="btn-secondary">
                  Batal
                </button>
                <button type="submit" className="btn-danger" disabled={returPin.length !== 6}>
                  <IconCheck size={18} /> Konfirmasi Retur
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
