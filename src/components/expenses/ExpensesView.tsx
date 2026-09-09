import React, { useState, useEffect } from 'react'
import { db } from '../../db/db'
import type { Expense, Supplier, Purchase, Product } from '../../types'
import {
  IconDollarSign,
  IconPlus,
  IconTrash,
  IconTruck,
  IconCheck,
  IconX
} from '../icons/Icons'
import { formatRupiah } from '../../utils/printer'
import { generateId } from '../../utils/id'
import { useAuth } from '../../context/AuthContext'

export const ExpensesView: React.FC = () => {
  const { currentUser, activeShift } = useAuth()
  
  const [activeTab, setActiveTab] = useState<'expenses' | 'purchases' | 'suppliers'>('expenses')
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [products, setProducts] = useState<Product[]>([])

  // Modal: Catat Kas Keluar
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false)
  const [expCategory, setExpCategory] = useState('Operasional')
  const [expAmount, setExpAmount] = useState<number>(0)
  const [expAmountInput, setExpAmountInput] = useState<string>('')
  const [expNotes, setExpNotes] = useState('')

  // Modal: Catat Kulakan (Pembelian Masuk)
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false)
  const [purSupplierId, setPurSupplierId] = useState('')
  const [purInvoiceNo, setPurInvoiceNo] = useState('')
  const [purItems, setPurItems] = useState<{ productId: string; qty: number; costPrice: number }[]>([])

  // Modal: Tambah Supplier
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false)
  const [supName, setSupName] = useState('')
  const [supPhone, setSupPhone] = useState('')
  const [supAddress, setSupAddress] = useState('')

  const loadAll = async () => {
    const [eList, sList, pList, prList] = await Promise.all([
      db.expenses.toArray(),
      db.suppliers.toArray(),
      db.purchases.toArray(),
      db.products.toArray()
    ])
    setExpenses(eList.sort((a, b) => b.created_at.localeCompare(a.created_at)))
    setSuppliers(sList)
    setPurchases(pList.sort((a, b) => b.purchase_date.localeCompare(a.purchase_date)))
    setProducts(prList)
  }

  useEffect(() => {
    loadAll()
  }, [])

  // Simpan Kas Keluar
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (expAmount <= 0) return

    const now = new Date().toISOString()
    const expRecord: Expense = {
      id: generateId(),
      user_id: currentUser?.id || 'unknown',
      shift_id: activeShift?.id || 'no_shift',
      category: expCategory,
      amount: expAmount,
      notes: expNotes.trim(),
      synced: false,
      created_at: now
    }

    await db.expenses.add(expRecord)
    setIsExpenseModalOpen(false)
    setExpAmount(0)
    setExpAmountInput('')
    setExpNotes('')
    loadAll()
  }

  const handleDeleteExpense = async (id: string) => {
    if (confirm('Hapus catatan pengeluaran kas ini?')) {
      await db.expenses.delete(id)
      loadAll()
    }
  }

  // Simpan Kulakan
  const handleSavePurchase = async (e: React.FormEvent) => {
    e.preventDefault()
    if (purItems.length === 0) {
      alert('Pilih minimal 1 produk kulakan!')
      return
    }

    const now = new Date().toISOString()
    const purId = generateId()
    const sup = suppliers.find(s => s.id === purSupplierId)
    const total = purItems.reduce((sum, item) => sum + item.qty * item.costPrice, 0)

    await db.transaction('rw', [db.purchases, db.purchase_items, db.products, db.stock_movements], async () => {
      await db.purchases.add({
        id: purId,
        supplier_id: purSupplierId,
        supplier_name: sup?.name || 'Umum',
        user_id: currentUser?.id || 'unknown',
        invoice_no: purInvoiceNo || `KUL-${Date.now().toString().slice(-6)}`,
        total,
        synced: false,
        purchase_date: now
      })

      for (const item of purItems) {
        const prod = products.find(p => p.id === item.productId)
        if (!prod) continue

        await db.purchase_items.add({
          id: generateId(),
          purchase_id: purId,
          product_id: item.productId,
          product_name: prod.name,
          quantity: item.qty,
          cost_price: item.costPrice,
          subtotal: item.qty * item.costPrice,
          synced: false
        })

        // Tambah stok & perbarui harga beli produk
        const updatedStock = prod.current_stock + item.qty
        await db.products.update(prod.id, {
          current_stock: updatedStock,
          cost_price: item.costPrice,
          updated_at: now,
          synced: false
        })

        await db.stock_movements.add({
          id: generateId(),
          product_id: prod.id,
          product_name: prod.name,
          type: 'in',
          quantity: item.qty,
          ref_type: 'purchase',
          ref_id: purId,
          notes: `Kulakan dari ${sup?.name || 'Supplier'}`,
          synced: false,
          created_at: now
        })
      }
    })

    setIsPurchaseModalOpen(false)
    setPurItems([])
    loadAll()
  }

  // Tambah Supplier
  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supName.trim()) return

    await db.suppliers.add({
      id: generateId(),
      name: supName.trim(),
      phone: supPhone.trim(),
      address: supAddress.trim(),
      synced: false
    })

    setIsSupplierModalOpen(false)
    setSupName('')
    setSupPhone('')
    setSupAddress('')
    loadAll()
  }

  const handleDeleteSupplier = async (id: string, name: string) => {
    if (confirm(`Hapus supplier "${name}"?`)) {
      await db.suppliers.delete(id)
      loadAll()
    }
  }

  const totalExpenseAmount = expenses.reduce((sum, e) => sum + e.amount, 0)
  const totalPurchaseAmount = purchases.reduce((sum, p) => sum + p.total, 0)

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem' }}>Kas Keluar & Kulakan</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Pencatatan pengeluaran operasional toko dan barang masuk dari supplier.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {activeTab === 'expenses' && (
            <button type="button" onClick={() => setIsExpenseModalOpen(true)} className="btn-primary">
              <IconPlus size={18} /> Catat Kas Keluar
            </button>
          )}
          {activeTab === 'purchases' && (
            <button type="button" onClick={() => { setIsPurchaseModalOpen(true); setPurSupplierId(suppliers[0]?.id || '') }} className="btn-primary">
              <IconPlus size={18} /> Catat Kulakan Masuk
            </button>
          )}
          {activeTab === 'suppliers' && (
            <button type="button" onClick={() => setIsSupplierModalOpen(true)} className="btn-primary">
              <IconPlus size={18} /> Tambah Supplier
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-default)', paddingBottom: '0.5rem' }}>
        <button
          type="button"
          onClick={() => setActiveTab('expenses')}
          className={activeTab === 'expenses' ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}
        >
          <IconDollarSign size={16} /> Pengeluaran Kas ({formatRupiah(totalExpenseAmount)})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('purchases')}
          className={activeTab === 'purchases' ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}
        >
          <IconTruck size={16} /> Kulakan Masuk ({formatRupiah(totalPurchaseAmount)})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('suppliers')}
          className={activeTab === 'suppliers' ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}
        >
          Daftar Supplier ({suppliers.length})
        </button>
      </div>

      {/* TAB 1: KAS KELUAR */}
      {activeTab === 'expenses' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-surface-subtle)', borderBottom: '1px solid var(--border-default)' }}>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Tanggal / Waktu</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Kategori</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Keterangan</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Nominal (Rp)</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600, textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Belum ada catatan pengeluaran kas.
                  </td>
                </tr>
              ) : (
                expenses.map(e => (
                  <tr key={e.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                      {new Date(e.created_at).toLocaleString('id-ID')}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span className="badge badge-neutral">{e.category}</span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      {e.notes || '-'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--status-danger-text)' }} className="mono">
                      {formatRupiah(e.amount)}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => handleDeleteExpense(e.id)}
                        className="btn-ghost btn-sm text-danger"
                      >
                        <IconTrash size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: KULAKAN / PEMBELIAN */}
      {activeTab === 'purchases' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-surface-subtle)', borderBottom: '1px solid var(--border-default)' }}>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Tanggal</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>No. Faktur / Nota</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Supplier</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Total Pembelian</th>
              </tr>
            </thead>
            <tbody>
              {purchases.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Belum ada riwayat kulakan.
                  </td>
                </tr>
              ) : (
                purchases.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      {new Date(p.purchase_date).toLocaleDateString('id-ID')}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }} className="mono">
                      {p.invoice_no}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      {p.supplier_name}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 700 }} className="mono">
                      {formatRupiah(p.total)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: SUPPLIERS */}
      {activeTab === 'suppliers' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-surface-subtle)', borderBottom: '1px solid var(--border-default)' }}>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Nama Supplier</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Kontak / Telepon</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Alamat</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600, textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Belum ada data supplier.
                  </td>
                </tr>
              ) : (
                suppliers.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>
                      {s.name}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      {s.phone || '-'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                      {s.address || '-'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => handleDeleteSupplier(s.id, s.name)}
                        className="btn-ghost btn-sm text-danger"
                      >
                        <IconTrash size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ======================================================================
          MODAL: INPUT KAS KELUAR
          ====================================================================== */}
      {isExpenseModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem' }}>Catat Pengeluaran Kas</h3>
              <button type="button" onClick={() => setIsExpenseModalOpen(false)} className="btn-ghost btn-sm">
                <IconX size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveExpense}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Kategori Pengeluaran
                  </label>
                  <select value={expCategory} onChange={e => setExpCategory(e.target.value)}>
                    <option value="Operasional">Operasional Toko</option>
                    <option value="Konsumsi">Makan / Minum / Snack</option>
                    <option value="Perlengkapan">Beli Plastik & ATK</option>
                    <option value="Listrik / Air">Listrik / Pulsa / Kuota</option>
                    <option value="Lain-lain">Lain-lain</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Nominal Pengeluaran (Rp) *
                  </label>
                  <input
                    type="text"
                    className="mono"
                    style={{ fontSize: '1.25rem', fontWeight: 700 }}
                    value={expAmountInput}
                    onChange={e => {
                      const raw = e.target.value.replace(/\D/g, '')
                      const num = parseInt(raw, 10) || 0
                      setExpAmount(num)
                      setExpAmountInput(num ? num.toLocaleString('id-ID') : '')
                    }}
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Keterangan / Rincian
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Contoh: Beli kantong plastik 5 pack"
                    value={expNotes}
                    onChange={e => setExpNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setIsExpenseModalOpen(false)} className="btn-secondary">
                  Batal
                </button>
                <button type="submit" className="btn-primary" disabled={expAmount <= 0}>
                  <IconCheck size={18} /> Simpan Pengeluaran
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================================
          MODAL: KULAKAN / BARANG MASUK
          ====================================================================== */}
      {isPurchaseModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem' }}>Input Kulakan Barang Masuk</h3>
              <button type="button" onClick={() => setIsPurchaseModalOpen(false)} className="btn-ghost btn-sm">
                <IconX size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePurchase}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                      Pilih Supplier
                    </label>
                    <select value={purSupplierId} onChange={e => setPurSupplierId(e.target.value)}>
                      <option value="">-- Tanpa Supplier / Umum --</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                      No. Faktur / Nota
                    </label>
                    <input
                      type="text"
                      placeholder="Nomor faktur kulakan"
                      value={purInvoiceNo}
                      onChange={e => setPurInvoiceNo(e.target.value)}
                    />
                  </div>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Barang yang Masuk</h4>
                  <button
                    type="button"
                    onClick={() => {
                      if (products[0]) {
                        setPurItems(prev => [...prev, { productId: products[0].id, qty: 10, costPrice: products[0].cost_price || 0 }])
                      } else {
                        alert('Tambahkan master produk terlebih dahulu di menu Produk & Stok')
                      }
                    }}
                    className="btn-secondary btn-sm"
                  >
                    <IconPlus size={14} /> Tambah Baris
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                  {purItems.map((item, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '0.4rem', alignItems: 'center' }}>
                      <select
                        value={item.productId}
                        onChange={e => {
                          const pId = e.target.value
                          const p = products.find(prod => prod.id === pId)
                          const next = [...purItems]
                          next[idx].productId = pId
                          if (p) next[idx].costPrice = p.cost_price || 0
                          setPurItems(next)
                        }}
                      >
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
                        ))}
                      </select>

                      <input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        className="mono"
                        value={item.qty}
                        onChange={e => {
                          const next = [...purItems]
                          next[idx].qty = parseFloat(e.target.value) || 1
                          setPurItems(next)
                        }}
                      />

                      <input
                        type="number"
                        min="0"
                        placeholder="Harga Beli"
                        className="mono"
                        value={item.costPrice}
                        onChange={e => {
                          const next = [...purItems]
                          next[idx].costPrice = parseInt(e.target.value, 10) || 0
                          setPurItems(next)
                        }}
                      />

                      <button
                        type="button"
                        onClick={() => setPurItems(purItems.filter((_, i) => i !== idx))}
                        className="btn-ghost btn-sm text-danger"
                      >
                        <IconTrash size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                <div style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: 'var(--bg-surface-subtle)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Kulakan:</span>
                  <strong className="mono" style={{ fontSize: '1.2rem' }}>
                    {formatRupiah(purItems.reduce((sum, item) => sum + item.qty * item.costPrice, 0))}
                  </strong>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setIsPurchaseModalOpen(false)} className="btn-secondary">
                  Batal
                </button>
                <button type="submit" className="btn-primary" disabled={purItems.length === 0}>
                  <IconCheck size={18} /> Simpan & Tambah Stok
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================================
          MODAL: TAMBAH SUPPLIER
          ====================================================================== */}
      {isSupplierModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem' }}>Tambah Supplier Baru</h3>
              <button type="button" onClick={() => setIsSupplierModalOpen(false)} className="btn-ghost btn-sm">
                <IconX size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Nama Supplier / Distributor *
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Agen Sembako Makmur, PT Wings"
                    value={supName}
                    onChange={e => setSupName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Nomor Telepon / Kontak Sales
                  </label>
                  <input
                    type="tel"
                    placeholder="08123456789"
                    value={supPhone}
                    onChange={e => setSupPhone(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Alamat / Catatan Gudang
                  </label>
                  <input
                    type="text"
                    placeholder="Pasar Induk blok C no 4"
                    value={supAddress}
                    onChange={e => setSupAddress(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setIsSupplierModalOpen(false)} className="btn-secondary">
                  Batal
                </button>
                <button type="submit" className="btn-primary">
                  <IconCheck size={18} /> Simpan Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
