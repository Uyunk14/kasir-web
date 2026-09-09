import React, { useState, useEffect } from 'react'
import { db } from '../../db/db'
import type { Product, Category, Barcode } from '../../types'
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconSearch,
  IconCheck,
  IconX,
  IconRefresh
} from '../icons/Icons'
import { formatRupiah } from '../../utils/printer'
import { generateId } from '../../utils/id'
import { useAuth } from '../../context/AuthContext'

export const ProductsView: React.FC = () => {
  const { currentUser } = useAuth()
  const isOwner = currentUser?.role === 'owner'

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('all')

  // Product Form Modal
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [formName, setFormName] = useState('')
  const [formSku, setFormSku] = useState('')
  const [formBarcodes, setFormBarcodes] = useState<string>('')
  const [formCatId, setFormCatId] = useState('')
  const [formUnit, setFormUnit] = useState('pcs')
  const [formIsBulk, setFormIsBulk] = useState(false)
  const [formCostPrice, setFormCostPrice] = useState<number>(0)
  const [formSellPrice, setFormSellPrice] = useState<number>(0)
  const [formWholesalePrice, setFormWholesalePrice] = useState<number>(0)
  const [formStock, setFormStock] = useState<number>(0)
  const [formMinStock, setFormMinStock] = useState<number>(5)

  // Stock Opname Modal
  const [opnameProduct, setOpnameProduct] = useState<Product | null>(null)
  const [opnameNewStock, setOpnameNewStock] = useState<number>(0)
  const [opnameReason, setOpnameReason] = useState<string>('Stock Opname Fisik')

  // Category Manager Modal
  const [isCatModalOpen, setIsCatModalOpen] = useState(false)
  const [newCatName, setNewCatName] = useState('')

  const loadData = async () => {
    const [pList, cList] = await Promise.all([
      db.products.toArray(),
      db.categories.toArray()
    ])
    setProducts(pList)
    setCategories(cList)
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleOpenAdd = () => {
    setEditingProduct(null)
    setFormName('')
    setFormSku('')
    setFormBarcodes('')
    setFormCatId(categories[0]?.id || '')
    setFormUnit('pcs')
    setFormIsBulk(false)
    setFormCostPrice(0)
    setFormSellPrice(0)
    setFormWholesalePrice(0)
    setFormStock(0)
    setFormMinStock(5)
    setIsModalOpen(true)
  }

  const handleOpenEdit = async (p: Product) => {
    setEditingProduct(p)
    setFormName(p.name)
    setFormSku(p.sku || '')
    setFormCatId(p.category_id)
    setFormUnit(p.unit)
    setFormIsBulk(p.is_bulk)
    setFormCostPrice(p.cost_price || 0)
    setFormSellPrice(p.sell_price)
    setFormWholesalePrice(p.wholesale_price || 0)
    setFormStock(p.current_stock)
    setFormMinStock(p.min_stock)

    // Load barcodes
    const bcs = await db.barcodes.where('product_id').equals(p.id).toArray()
    setFormBarcodes(bcs.map(b => b.code).join(', '))

    setIsModalOpen(true)
  }

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim()) return

    const now = new Date().toISOString()
    const prodId = editingProduct ? editingProduct.id : generateId()

    const productRecord: Product = {
      id: prodId,
      name: formName.trim(),
      sku: formSku.trim() || `SKU-${Date.now().toString().slice(-6)}`,
      category_id: formCatId || categories[0]?.id || 'cat_umum',
      unit: formUnit.trim() || 'pcs',
      is_bulk: formIsBulk,
      cost_price: formCostPrice,
      sell_price: formSellPrice,
      wholesale_price: formWholesalePrice,
      current_stock: formStock,
      min_stock: formMinStock,
      synced: false,
      updated_at: now
    }

    // Save product
    await db.products.put(productRecord)

    // Update barcodes
    await db.barcodes.where('product_id').equals(prodId).delete()
    if (formBarcodes.trim()) {
      const codeList = formBarcodes.split(',').map(c => c.trim()).filter(Boolean)
      const barcodeRecords: Barcode[] = codeList.map(code => ({
        id: generateId(),
        product_id: prodId,
        code,
        synced: false
      }))
      await db.barcodes.bulkAdd(barcodeRecords)
    }

    setIsModalOpen(false)
    loadData()
  }

  const handleDeleteProduct = async (id: string, name: string) => {
    if (confirm(`Yakin ingin menghapus produk "${name}"?`)) {
      await db.products.delete(id)
      await db.barcodes.where('product_id').equals(id).delete()
      loadData()
    }
  }

  // Stock Opname Submit
  const handleSaveOpname = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!opnameProduct) return

    const now = new Date().toISOString()
    const diff = opnameNewStock - opnameProduct.current_stock

    await db.products.update(opnameProduct.id, {
      current_stock: opnameNewStock,
      updated_at: now,
      synced: false
    })

    await db.stock_movements.add({
      id: generateId(),
      product_id: opnameProduct.id,
      product_name: opnameProduct.name,
      type: diff >= 0 ? 'in' : 'out',
      quantity: Math.abs(diff),
      ref_type: 'opname',
      notes: `${opnameReason} (Penyesuaian stok dari ${opnameProduct.current_stock} ke ${opnameNewStock})`,
      synced: false,
      created_at: now
    })

    setOpnameProduct(null)
    loadData()
  }

  // Category Add/Delete
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCatName.trim()) return
    await db.categories.add({
      id: generateId(),
      name: newCatName.trim(),
      synced: false
    })
    setNewCatName('')
    loadData()
  }

  const handleDeleteCategory = async (id: string) => {
    if (confirm('Hapus kategori ini?')) {
      await db.categories.delete(id)
      loadData()
    }
  }

  const filtered = products.filter(p => {
    const matchCat = filterCat === 'all' || p.category_id === filterCat
    const matchQ = search === '' || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchQ
  })

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header with Title & Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem' }}>Katalog Produk & Stok</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Kelola data master barang, harga modal, harga jual, dan penyesuaian stok (opname).
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" onClick={() => setIsCatModalOpen(true)} className="btn-secondary">
            Kategori
          </button>
          <button type="button" onClick={handleOpenAdd} className="btn-primary">
            <IconPlus size={18} /> Tambah Produk Baru
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div style={{
        display: 'flex',
        gap: '0.75rem',
        alignItems: 'center',
        flexWrap: 'wrap',
        backgroundColor: 'var(--bg-surface)',
        padding: '0.85rem 1rem',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-default)'
      }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <IconSearch
            size={18}
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
          />
          <input
            type="text"
            placeholder="Cari nama barang atau SKU..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: '2.5rem' }}
          />
        </div>

        <div style={{ width: '200px' }}>
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)}>
            <option value="all">Semua Kategori</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Products Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-surface-subtle)', borderBottom: '1px solid var(--border-default)' }}>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Nama Produk</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Kategori</th>
                {isOwner && <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Harga Modal</th>}
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Harga Jual</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Stok</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600, textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Belum ada data produk. Klik <strong>"Tambah Produk Baru"</strong> di atas.
                  </td>
                </tr>
              ) : (
                filtered.map(p => {
                  const cat = categories.find(c => c.id === p.category_id)
                  const isLow = p.current_stock <= p.min_stock

                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ fontWeight: 600 }}>{p.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          SKU: {p.sku} {p.is_bulk ? '· Curah' : ''}
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span className="badge badge-neutral">{cat?.name || 'Umum'}</span>
                      </td>
                      {isOwner && (
                        <td style={{ padding: '0.85rem 1rem' }} className="mono">
                          {formatRupiah(p.cost_price || 0)}
                        </td>
                      )}
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 700 }} className="mono">
                        {formatRupiah(p.sell_price)} / {p.unit}
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span
                            className={`badge ${isLow ? 'badge-danger' : 'badge-success'} mono`}
                            style={{ fontSize: '0.82rem' }}
                          >
                            {p.current_stock} {p.unit}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setOpnameProduct(p)
                              setOpnameNewStock(p.current_stock)
                              setOpnameReason('Stock Opname Fisik')
                            }}
                            className="btn-ghost btn-sm"
                            style={{ padding: '0.2rem 0.4rem', fontSize: '0.72rem' }}
                            title="Penyesuaian Stok (Opname)"
                          >
                            <IconRefresh size={14} /> Opname
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(p)}
                            className="btn-ghost btn-sm"
                            title="Edit Produk"
                          >
                            <IconEdit size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(p.id, p.name)}
                            className="btn-ghost btn-sm text-danger"
                            title="Hapus Produk"
                          >
                            <IconTrash size={16} />
                          </button>
                        </div>
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
          MODAL: TAMBAH / EDIT PRODUK
          ====================================================================== */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '540px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem' }}>
                {editingProduct ? 'Edit Data Produk' : 'Tambah Produk Baru'}
              </h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="btn-ghost btn-sm">
                <IconX size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProduct}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Nama Produk *
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Beras Ramos, Indomie Goreng, Minyak Goreng"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                      Kode SKU
                    </label>
                    <input
                      type="text"
                      className="mono"
                      placeholder="Auto jika kosong"
                      value={formSku}
                      onChange={e => setFormSku(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                      Kategori
                    </label>
                    <select value={formCatId} onChange={e => setFormCatId(e.target.value)}>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Kode Barcode (Pisahkan koma jika lebih dari 1)
                  </label>
                  <input
                    type="text"
                    className="mono"
                    placeholder="Contoh: 899123456789, 899987654321"
                    value={formBarcodes}
                    onChange={e => setFormBarcodes(e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                      Satuan Dasar
                    </label>
                    <input
                      type="text"
                      placeholder="pcs, kg, bungkus, botol"
                      value={formUnit}
                      onChange={e => setFormUnit(e.target.value)}
                      required
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', paddingTop: '1.4rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                      <input
                        type="checkbox"
                        checked={formIsBulk}
                        onChange={e => setFormIsBulk(e.target.checked)}
                        style={{ width: 'auto' }}
                      />
                      <span>Barang Curah (Timbangan/Desimal)</span>
                    </label>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                      Harga Beli / Modal (Rp)
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="mono"
                      value={formCostPrice}
                      onChange={e => setFormCostPrice(parseInt(e.target.value, 10) || 0)}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                      Harga Jual (Rp) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="mono"
                      value={formSellPrice}
                      onChange={e => setFormSellPrice(parseInt(e.target.value, 10) || 0)}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                      Stok Awal
                    </label>
                    <input
                      type="number"
                      step={formIsBulk ? '0.01' : '1'}
                      className="mono"
                      value={formStock}
                      onChange={e => setFormStock(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                      Batas Stok Menipis (Peringatan)
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="mono"
                      value={formMinStock}
                      onChange={e => setFormMinStock(parseInt(e.target.value, 10) || 0)}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">
                  Batal
                </button>
                <button type="submit" className="btn-primary">
                  <IconCheck size={18} /> Simpan Produk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================================
          MODAL: STOCK OPNAME (PENYESUAIAN STOK)
          ====================================================================== */}
      {opnameProduct && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem' }}>Stock Opname (Penyesuaian)</h3>
              <button type="button" onClick={() => setOpnameProduct(null)} className="btn-ghost btn-sm">
                <IconX size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveOpname}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <p style={{ fontSize: '0.88rem' }}>
                  Produk: <strong>{opnameProduct.name}</strong>
                </p>

                <div style={{
                  padding: '0.75rem',
                  backgroundColor: 'var(--bg-surface-subtle)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.85rem'
                }}>
                  <span>Stok Sistem Saat Ini:</span>
                  <strong className="mono">{opnameProduct.current_stock} {opnameProduct.unit}</strong>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Stok Fisik Sebenarnya ({opnameProduct.unit}) *
                  </label>
                  <input
                    type="number"
                    step={opnameProduct.is_bulk ? '0.01' : '1'}
                    className="mono"
                    style={{ fontSize: '1.25rem', fontWeight: 700 }}
                    value={opnameNewStock}
                    onChange={e => setOpnameNewStock(parseFloat(e.target.value) || 0)}
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Alasan Penyesuaian
                  </label>
                  <select value={opnameReason} onChange={e => setOpnameReason(e.target.value)}>
                    <option value="Stock Opname Fisik">Stock Opname Rutin</option>
                    <option value="Barang Rusak / Kadaluarsa">Barang Rusak / Basi</option>
                    <option value="Barang Hilang / Selisih">Barang Hilang</option>
                    <option value="Koreksi Input Kasir">Koreksi Salah Input</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setOpnameProduct(null)} className="btn-secondary">
                  Batal
                </button>
                <button type="submit" className="btn-primary">
                  <IconCheck size={18} /> Update Stok
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================================
          MODAL: KELOLA KATEGORI
          ====================================================================== */}
      {isCatModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem' }}>Kelola Kategori Produk</h3>
              <button type="button" onClick={() => setIsCatModalOpen(false)} className="btn-ghost btn-sm">
                <IconX size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <form onSubmit={handleAddCategory} style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="Nama kategori baru..."
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  required
                />
                <button type="submit" className="btn-primary" style={{ flexShrink: 0 }}>
                  <IconPlus size={16} /> Tambah
                </button>
              </form>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '200px', overflowY: 'auto' }}>
                {categories.map(c => (
                  <div
                    key={c.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-surface-subtle)'
                    }}
                  >
                    <span style={{ fontSize: '0.88rem' }}>{c.name}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(c.id)}
                      className="btn-ghost btn-sm text-danger"
                    >
                      <IconTrash size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" onClick={() => setIsCatModalOpen(false)} className="btn-secondary">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
