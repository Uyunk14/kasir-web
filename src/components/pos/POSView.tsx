import React, { useState, useEffect } from 'react'
import { db } from '../../db/db'
import type { Product, Category, Customer, SaleItem, Sale, SalePayment } from '../../types'
import {
  IconSearch,
  IconPlus,
  IconMinus,
  IconTrash,
  IconCart,
  IconUsers,
  IconPercent,
  IconPause,
  IconPlay,
  IconAlert,
  IconCamera,
  IconTag
} from '../icons/Icons'
import { formatRupiah } from '../../utils/printer'
import { BarcodeScannerModal } from './BarcodeScannerModal'
import { PaymentModal } from './PaymentModal'
import { BulkItemModal } from './BulkItemModal'
import { ManualItemModal } from './ManualItemModal'

export const POSView: React.FC = () => {

  // Products & Categories
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  
  // Customers
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)

  // Cart State
  const [cartItems, setCartItems] = useState<SaleItem[]>([])
  const [transactionDiscount, setTransactionDiscount] = useState<number>(0)
  const [heldTransactions, setHeldTransactions] = useState<{ id: string; name: string; items: SaleItem[]; discount: number; customer: Customer | null; time: string }[]>([])

  // Modals
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)
  const [isManualModalOpen, setIsManualModalOpen] = useState(false)
  const [bulkModalProduct, setBulkModalProduct] = useState<Product | null>(null)
  
  // Mobile cart sheet toggle
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false)

  // Load Initial Data
  const loadData = async () => {
    try {
      const [allProducts, allCategories, allCustomers] = await Promise.all([
        db.products.toArray(),
        db.categories.toArray(),
        db.customers.toArray()
      ])
      setProducts(allProducts)
      setCategories(allCategories)
      setCustomers(allCustomers)
    } catch (err) {
      console.error('Failed to load POS data:', err)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Barcode scanned / direct match
  const handleBarcodeScan = async (code: string) => {
    const trimmed = code.trim().toLowerCase()
    
    // Check barcode table first
    const barcodeRecord = await db.barcodes.where('code').equals(trimmed).first()
    let matchedProduct: Product | undefined

    if (barcodeRecord) {
      matchedProduct = await db.products.get(barcodeRecord.product_id)
    } else {
      matchedProduct = products.find(p => p.sku?.toLowerCase() === trimmed || p.id === trimmed)
    }

    if (matchedProduct) {
      handleProductSelect(matchedProduct)
    } else {
      alert(`Produk dengan barcode "${code}" tidak ditemukan.`)
    }
  }

  // Handle adding product to cart
  const handleProductSelect = (product: Product) => {
    if (product.is_bulk) {
      setBulkModalProduct(product)
      return
    }

    setCartItems(prev => {
      const existing = prev.find(item => item.product_id === product.id)
      if (existing) {
        return prev.map(item =>
          item.product_id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                subtotal: (item.quantity + 1) * item.price - item.discount
              }
            : item
        )
      } else {
        const newItem: SaleItem = {
          id: crypto.randomUUID ? crypto.randomUUID() : 'item_' + Date.now(),
          sale_id: '',
          product_id: product.id,
          product_name: product.name,
          unit: product.unit || 'pcs',
          quantity: 1,
          price: product.sell_price,
          cost: product.cost_price || 0,
          discount: 0,
          subtotal: product.sell_price,
          synced: false
        }
        return [...prev, newItem]
      }
    })
  }

  // Handle bulk decimal item confirmation
  const handleConfirmBulk = (product: Product, quantity: number) => {
    setCartItems(prev => {
      const existing = prev.find(item => item.product_id === product.id)
      if (existing) {
        const nextQty = Math.round((existing.quantity + quantity) * 100) / 100
        return prev.map(item =>
          item.product_id === product.id
            ? {
                ...item,
                quantity: nextQty,
                subtotal: Math.round(nextQty * item.price - item.discount)
              }
            : item
        )
      } else {
        const newItem: SaleItem = {
          id: crypto.randomUUID ? crypto.randomUUID() : 'item_' + Date.now(),
          sale_id: '',
          product_id: product.id,
          product_name: product.name,
          unit: product.unit || 'kg',
          quantity,
          price: product.sell_price,
          cost: product.cost_price || 0,
          discount: 0,
          subtotal: Math.round(product.sell_price * quantity),
          synced: false
        }
        return [...prev, newItem]
      }
    })
  }

  // Cart operations
  const updateItemQty = (productId: string, delta: number) => {
    setCartItems(prev =>
      prev
        .map(item => {
          if (item.product_id === productId) {
            const nextQty = Math.max(0, Math.round((item.quantity + delta) * 100) / 100)
            return {
              ...item,
              quantity: nextQty,
              subtotal: Math.round(nextQty * item.price - item.discount)
            }
          }
          return item
        })
        .filter(item => item.quantity > 0)
    )
  }

  const setItemExactQty = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      removeItem(productId)
      return
    }
    setCartItems(prev =>
      prev.map(item =>
        item.product_id === productId
          ? {
              ...item,
              quantity: newQty,
              subtotal: Math.round(newQty * item.price - item.discount)
            }
          : item
      )
    )
  }

  const removeItem = (productId: string) => {
    setCartItems(prev => prev.filter(item => item.product_id !== productId))
  }

  const clearCart = () => {
    if (cartItems.length > 0 && confirm('Kosongkan keranjang belanja?')) {
      setCartItems([])
      setTransactionDiscount(0)
    }
  }

  // Hold Sale
  const handleHoldSale = () => {
    if (cartItems.length === 0) return
    const note = prompt('Beri nama / nomor meja untuk transaksi ini:', `Nota ${heldTransactions.length + 1}`)
    if (note === null) return

    setHeldTransactions(prev => [
      ...prev,
      {
        id: 'hold_' + Date.now(),
        name: note || `Nota ${heldTransactions.length + 1}`,
        items: cartItems,
        discount: transactionDiscount,
        customer: selectedCustomer,
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      }
    ])
    setCartItems([])
    setTransactionDiscount(0)
    setSelectedCustomer(null)
  }

  // Recall Held Sale
  const handleRecallSale = (id: string) => {
    const held = heldTransactions.find(h => h.id === id)
    if (!held) return

    if (cartItems.length > 0 && !confirm('Keranjang saat ini akan ditimpa dengan transaksi yang ditahan. Lanjutkan?')) {
      return
    }

    setCartItems(held.items)
    setTransactionDiscount(held.discount)
    setSelectedCustomer(held.customer)
    setHeldTransactions(prev => prev.filter(h => h.id !== id))
  }

  // Calculations
  const subtotal = cartItems.reduce((sum, item) => sum + item.subtotal, 0)
  const total = Math.max(0, subtotal - transactionDiscount)
  const totalItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0)

  // Filtered products
  const filteredProducts = products.filter(p => {
    const matchCategory = selectedCategory === 'all' || p.category_id === selectedCategory
    const matchQuery =
      searchQuery === '' ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchCategory && matchQuery
  })

  // Successful checkout handler
  const handleCheckoutSuccess = (_sale: Sale, _items: SaleItem[], _payments: SalePayment[]) => {
    loadData() // Refresh stocks
    setCartItems([])
    setTransactionDiscount(0)
    setSelectedCustomer(null)
    setIsMobileCartOpen(false)
  }

  return (
    <div className="pos-workspace">
      {/* ======================================================================
          LEFT COLUMN: CATALOG, SEARCH & SCANNER
          ====================================================================== */}
      <div className="pos-catalog-column">
        {/* Search & Actions Bar */}
        <div style={{
          padding: '0.85rem 1.25rem',
          backgroundColor: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex',
          gap: '0.65rem',
          alignItems: 'center'
        }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <IconSearch
              size={18}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }}
            />
            <input
              type="text"
              placeholder="Cari nama produk, kode SKU, atau scan barcode..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && searchQuery.trim()) {
                  handleBarcodeScan(searchQuery)
                }
              }}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>

          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            className="btn-secondary"
            title="Buka Kamera Barcode Scanner"
            style={{ flexShrink: 0, padding: '0.65rem 0.75rem', gap: '0.35rem' }}
          >
            <IconCamera size={18} />
            <span className="mobile-hide">Scan</span>
          </button>

          <button
            type="button"
            onClick={() => setIsManualModalOpen(true)}
            className="btn-outline"
            title="Input Barang Non-Katalog / Manual"
            style={{ flexShrink: 0, padding: '0.65rem 0.75rem', gap: '0.35rem' }}
          >
            <IconPlus size={16} />
            <span className="mobile-hide">Manual</span>
          </button>
        </div>

        {/* Categories Horizontal Filter */}
        <div style={{
          display: 'flex',
          gap: '0.4rem',
          padding: '0.5rem 0.85rem',
          backgroundColor: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-subtle)',
          overflowX: 'auto',
          flexShrink: 0
        }}>
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={selectedCategory === 'all' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
          >
            Semua
          </button>
          {categories.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedCategory(c.id)}
              className={selectedCategory === c.id ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
              style={{ whiteSpace: 'nowrap' }}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1.25rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))',
          gap: '0.85rem',
          alignContent: 'start'
        }}>
          {filteredProducts.length === 0 ? (
            <div style={{
              gridColumn: '1 / -1',
              padding: '3rem 1rem',
              textAlign: 'center',
              color: 'var(--text-muted)'
            }}>
              <IconTag size={36} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
              <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>Tidak ada produk ditemukan</p>
              <p style={{ fontSize: '0.82rem' }}>
                {products.length === 0
                  ? 'Katalog produk Anda masih kosong. Buka menu "Produk & Stok" untuk menambah produk baru.'
                  : 'Coba kata kunci pencarian atau kategori lain.'}
              </p>
            </div>
          ) : (
            filteredProducts.map(p => {
              const isLowStock = p.current_stock <= p.min_stock
              const isOutOfStock = p.current_stock <= 0

              return (
                <div
                  key={p.id}
                  onClick={() => handleProductSelect(p)}
                  className="card card-interactive"
                  style={{
                    padding: '0.9rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                    opacity: isOutOfStock ? 0.65 : 1,
                    borderLeft: isLowStock ? '3px solid #EF4444' : undefined
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.25rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {p.unit || 'pcs'}
                      </span>
                      {p.is_bulk && (
                        <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>
                          Curah
                        </span>
                      )}
                    </div>
                    <h4 style={{
                      fontSize: '0.92rem',
                      fontWeight: 700,
                      marginTop: '0.2rem',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {p.name}
                    </h4>
                  </div>

                  <div>
                    <div className="mono" style={{ fontSize: '1.05rem', fontWeight: 800 }}>
                      {formatRupiah(p.sell_price)}
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      marginTop: '0.25rem',
                      fontSize: '0.75rem',
                      color: isLowStock ? 'var(--status-danger-text)' : 'var(--text-secondary)'
                    }}>
                      {isLowStock && <IconAlert size={12} />}
                      <span>Stok: <strong className="mono">{p.current_stock}</strong> {p.unit}</span>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Floating Mobile Cart Bar Trigger (Visible on small screens) */}
        <div style={{
          padding: '0.75rem 1rem',
          backgroundColor: 'var(--accent-primary)',
          color: 'var(--accent-primary-text)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          zIndex: 40
        }}
        onClick={() => setIsMobileCartOpen(!isMobileCartOpen)}
        className="mobile-cart-trigger"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <IconCart size={20} />
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
              {cartItems.length} Item ({totalItemCount} qty)
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span className="mono" style={{ fontSize: '1.15rem', fontWeight: 800 }}>
              {formatRupiah(total)}
            </span>
            <span className="btn-secondary btn-sm" style={{ pointerEvents: 'none' }}>
              {isMobileCartOpen ? 'Tutup' : 'Lihat Nota'}
            </span>
          </div>
        </div>
      </div>

      {/* ======================================================================
          RIGHT COLUMN: ACTIVE CART & CHECKOUT
          ====================================================================== */}
      <div className={`pos-cart-column ${isMobileCartOpen ? 'cart-open' : ''}`}>
        {/* Cart Header */}
        <div style={{
          padding: '0.85rem 1.25rem',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-surface)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <IconCart size={20} />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Keranjang Penjualan</h3>
          </div>

          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {/* Hold Button */}
            <button
              type="button"
              onClick={handleHoldSale}
              disabled={cartItems.length === 0}
              className="btn-ghost btn-sm"
              title="Tahan Transaksi (Hold)"
            >
              <IconPause size={16} />
            </button>

            {/* Clear Button */}
            <button
              type="button"
              onClick={clearCart}
              disabled={cartItems.length === 0}
              className="btn-ghost btn-sm text-danger"
              title="Kosongkan Keranjang"
            >
              <IconTrash size={16} />
            </button>
          </div>
        </div>

        {/* Customer Selector & Held Sales Bar */}
        <div style={{
          padding: '0.65rem 1.25rem',
          backgroundColor: 'var(--bg-surface-subtle)',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <IconUsers size={16} style={{ color: 'var(--text-muted)' }} />
            <select
              value={selectedCustomer?.id || ''}
              onChange={e => {
                const c = customers.find(item => item.id === e.target.value)
                setSelectedCustomer(c || null)
              }}
              style={{ fontSize: '0.82rem', padding: '0.4rem 0.6rem' }}
            >
              <option value="">-- Umum / Tanpa Pelanggan --</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone ? `(${c.phone})` : ''} - Kasbon: Rp {c.total_debt.toLocaleString('id-ID')}
                </option>
              ))}
            </select>
          </div>

          {/* Held Sales Pills */}
          {heldTransactions.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', overflowX: 'auto', paddingTop: '0.25rem' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                Nota Ditahan:
              </span>
              {heldTransactions.map(h => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => handleRecallSale(h.id)}
                  className="badge badge-warning"
                  style={{ cursor: 'pointer', whiteSpace: 'nowrap', gap: '0.3rem' }}
                >
                  <IconPlay size={10} />
                  <span>{h.name} ({h.time})</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Cart Items List */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0.75rem 1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem'
        }}>
          {cartItems.length === 0 ? (
            <div style={{
              margin: 'auto',
              textAlign: 'center',
              color: 'var(--text-muted)',
              padding: '2rem 1rem'
            }}>
              <IconCart size={40} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
              <p style={{ fontWeight: 600 }}>Keranjang Masih Kosong</p>
              <p style={{ fontSize: '0.8rem' }}>Klik produk di sebelah kiri atau scan barcode untuk menambah belanjaan.</p>
            </div>
          ) : (
            cartItems.map(item => (
              <div
                key={item.product_id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.65rem 0',
                  borderBottom: '1px solid var(--border-subtle)'
                }}
              >
                <div style={{ flex: 1, marginRight: '0.75rem' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', lineHeight: 1.2 }}>
                    {item.product_name}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    <span className="mono">{formatRupiah(item.price)}</span> / {item.unit}
                  </div>
                </div>

                {/* Qty +/- Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <button
                    type="button"
                    onClick={() => updateItemQty(item.product_id, -1)}
                    className="btn-secondary btn-sm"
                    style={{ width: '28px', height: '28px', padding: 0 }}
                  >
                    <IconMinus size={14} />
                  </button>

                  <span
                    onClick={() => {
                      const input = prompt(`Masukkan jumlah ${item.unit}:`, item.quantity.toString())
                      if (input !== null) {
                        const parsed = parseFloat(input.replace(',', '.'))
                        if (!isNaN(parsed)) setItemExactQty(item.product_id, parsed)
                      }
                    }}
                    className="mono"
                    title="Klik untuk ubah jumlah langsung"
                    style={{
                      minWidth: '36px',
                      textAlign: 'center',
                      fontWeight: 700,
                      cursor: 'pointer',
                      borderBottom: '1px dashed var(--border-focus)'
                    }}
                  >
                    {item.quantity}
                  </span>

                  <button
                    type="button"
                    onClick={() => updateItemQty(item.product_id, 1)}
                    className="btn-secondary btn-sm"
                    style={{ width: '28px', height: '28px', padding: 0 }}
                  >
                    <IconPlus size={14} />
                  </button>
                </div>

                {/* Subtotal */}
                <div style={{ minWidth: '85px', textAlign: 'right', marginLeft: '0.75rem' }}>
                  <div className="mono" style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                    {formatRupiah(item.subtotal)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart Summary & Pay Footer */}
        <div style={{
          padding: '1.25rem',
          backgroundColor: 'var(--bg-surface)',
          borderTop: '1px solid var(--border-default)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Subtotal:</span>
            <span className="mono font-bold">{formatRupiah(subtotal)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <IconPercent size={14} /> Diskon Transaksi:
            </span>
            <span
              onClick={() => {
                const val = prompt('Masukkan nominal diskon (Rp):', transactionDiscount.toString())
                if (val !== null) {
                  const num = parseInt(val.replace(/\D/g, ''), 10) || 0
                  setTransactionDiscount(num)
                }
              }}
              className="mono"
              style={{ cursor: 'pointer', borderBottom: '1px dashed var(--border-focus)', fontWeight: 600 }}
              title="Klik untuk ubah diskon"
            >
              {transactionDiscount > 0 ? `- ${formatRupiah(transactionDiscount)}` : 'Rp 0'}
            </span>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: '1.05rem', fontWeight: 800 }}>TOTAL:</span>
            <span className="mono" style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {formatRupiah(total)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsPaymentOpen(true)}
            disabled={cartItems.length === 0}
            className="btn-primary btn-lg"
            style={{ width: '100%', marginTop: '0.25rem', justifyContent: 'center' }}
          >
            <IconCart size={20} />
            <span>Bayar (F9)</span>
          </button>
        </div>
      </div>

      {/* ======================================================================
          MODALS
          ====================================================================== */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleBarcodeScan}
      />

      <BulkItemModal
        product={bulkModalProduct}
        isOpen={Boolean(bulkModalProduct)}
        onClose={() => setBulkModalProduct(null)}
        onConfirm={handleConfirmBulk}
      />

      <ManualItemModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onAddManualItem={item => setCartItems(prev => [...prev, item])}
      />

      <PaymentModal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        subtotal={subtotal}
        discount={transactionDiscount}
        total={total}
        items={cartItems}
        selectedCustomer={selectedCustomer}
        onSuccessTransaction={handleCheckoutSuccess}
      />
    </div>
  )
}
