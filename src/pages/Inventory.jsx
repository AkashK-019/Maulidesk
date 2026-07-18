import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../supabase';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { Plus, Search, Edit, Trash2, X, Loader2, Boxes, Layers, Package, Wallet, ChevronDown, PackageSearch, Download } from 'lucide-react';
import { formatCurrency } from '../utils/helpers';
import '../styles/quotations.css';
import '../styles/inventory.css';

const UNIT_OPTIONS = ['NOS', 'sq-feet','Run.feet' , 'meter', 'feet', 'bundle'];

function CategoryCombobox({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const wrapRef = useRef(null);

  useEffect(() => {
    const onDocMouseDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return options;
    return options.filter(c => c.toLowerCase().includes(q));
  }, [value, options]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlight(h => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      if (open && highlight >= 0 && filtered[highlight]) {
        e.preventDefault();
        onChange(filtered[highlight]);
        setOpen(false);
        setHighlight(-1);
      } else {
        setOpen(false);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const selectOption = (cat) => {
    onChange(cat);
    setOpen(false);
    setHighlight(-1);
  };

  return (
    <div className="inv-combo" ref={wrapRef}>
      <div className={`inv-combo-input-wrap${open ? ' open' : ''}`}>
        <input
          type="text"
          className="input-field inv-combo-input"
          value={value}
          autoComplete="off"
          placeholder="Type or pick a category"
          onChange={(e) => { onChange(e.target.value); setOpen(true); setHighlight(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        <ChevronDown
          size={15}
          className="inv-combo-chevron"
          onClick={() => setOpen(o => !o)}
        />
      </div>
      {open && (
        <div className="inv-combo-dropdown">
          {filtered.length > 0 ? (
            filtered.map((cat, i) => (
              <button
                type="button"
                key={cat}
                className={`inv-combo-option${i === highlight ? ' active' : ''}${cat === value ? ' selected' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => selectOption(cat)}
              >
                {cat}
              </button>
            ))
          ) : (
            <div className="inv-combo-empty">
              {value.trim() ? `"${value.trim()}" will be added as a new category` : 'No categories yet — start typing to create one'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [unit, setUnit] = useState('');
  const [price, setPrice] = useState(0);

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      setItems(data || []);
    } catch (err) {
      console.error('Inventory fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setCategory('');
    setQuantity(0);
    setUnit('');
    setPrice(0);
    setSelectedItem(null);
    setIsEditing(false);
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const openEditModal = (item) => {
    setSelectedItem(item);
    setName(item.name);
    setCategory(item.category || '');
    setQuantity(item.quantity_available);
    setUnit(item.unit || '');
    setPrice(item.selling_rate || 0);
    setIsEditing(true);
    setShowCreateModal(true);
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    try {
      const newItem = {
        name,
        category: category.trim() || null,
        quantity_available: parseFloat(quantity) || 0,
        unit: unit.trim() || null,
        selling_rate: parseFloat(price) || 0,
      };

      if (isEditing && selectedItem) {
        const { error } = await supabase
          .from('inventory_items')
          .update(newItem)
          .eq('id', selectedItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('inventory_items')
          .insert([newItem]);
        if (error) throw error;
      }

      setShowCreateModal(false);
      fetchInventory();
      resetForm();
    } catch (err) {
      console.error('Save inventory item error:', err);
    }
  };

  const handleDeleteItem = async (id) => {
    if (window.confirm('Are you sure you want to delete this inventory item?')) {
      try {
        const { error } = await supabase.from('inventory_items').delete().eq('id', id);
        if (error) throw error;
        fetchInventory();
      } catch (err) {
        console.error('Delete item error:', err);
      }
    }
  };

  const handleExportCSV = () => {
    const headers = ['Item Specification', 'Category', 'Quantity', 'Unit', 'Price', 'Total Value'];
    const escapeCell = (val) => {
      const s = String(val ?? '');
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const rows = filteredItems.map(item => {
      const qty = parseFloat(item.quantity_available) || 0;
      const rate = parseFloat(item.selling_rate) || 0;
      return [
        item.name,
        item.category || '',
        qty,
        item.unit || '',
        rate.toFixed(2),
        (qty * rate).toFixed(2),
      ];
    });
    const csvContent = [headers, ...rows].map(r => r.map(escapeCell).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    const scope = categoryFilter === 'All' ? 'all' : categoryFilter.toLowerCase().replace(/\s+/g, '-');
    link.href = url;
    link.download = `inventory-${scope}-${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const categoryOptions = useMemo(() => {
    const set = new Set();
    items.forEach(i => { if (i.category && i.category.trim()) set.add(i.category.trim()); });
    return Array.from(set).sort();
  }, [items]);

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const summary = useMemo(() => {
    const totalQty = filteredItems.reduce((sum, i) => sum + (parseFloat(i.quantity_available) || 0), 0);
    const totalValue = filteredItems.reduce((sum, i) => sum + (parseFloat(i.quantity_available) || 0) * (parseFloat(i.selling_rate) || 0), 0);
    const distinctCats = new Set();
    filteredItems.forEach(i => { if (i.category && i.category.trim()) distinctCats.add(i.category.trim()); });
    return {
      totalItems: filteredItems.length,
      totalCategories: distinctCats.size,
      totalQty,
      totalValue,
    };
  }, [filteredItems]);

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <Header title="Inventory" />

        <main className="gs-main">
          <div className="inv-summary-scope">
            Showing stats for: <strong>{categoryFilter === 'All' ? 'All Categories' : categoryFilter}</strong>
          </div>
          <div className="inv-summary-row animate-fade">
            <div className="inv-summary-card">
              <div className="inv-summary-icon items"><Package size={17} /></div>
              <div>
                <span className="num">{summary.totalItems}</span>
                <span className="lbl">Total Items</span>
              </div>
            </div>
            <div className="inv-summary-card">
              <div className="inv-summary-icon categories"><Layers size={17} /></div>
              <div>
                <span className="num">{summary.totalCategories}</span>
                <span className="lbl">Categories</span>
              </div>
            </div>
            <div className="inv-summary-card">
              <div className="inv-summary-icon stock"><Boxes size={17} /></div>
              <div>
                <span className="num">{summary.totalQty}</span>
                <span className="lbl">Total Stock Quantity</span>
              </div>
            </div>
            <div className="inv-summary-card">
              <div className="inv-summary-icon value"><Wallet size={17} /></div>
              <div>
                <span className="num">{formatCurrency(summary.totalValue)}</span>
                <span className="lbl">Total Stock Value</span>
              </div>
            </div>
          </div>

          <div className="inv-toolbar animate-fade">
            <div className="inv-search-box">
              <Search size={15} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search item specification..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="inv-filter-pills">
              <button className={`inv-filter-pill ${categoryFilter === 'All' ? 'active' : ''}`} onClick={() => setCategoryFilter('All')}>
                All
              </button>
              {categoryOptions.map(cat => (
                <button key={cat} className={`inv-filter-pill ${categoryFilter === cat ? 'active' : ''}`} onClick={() => setCategoryFilter(cat)}>
                  {cat}
                </button>
              ))}
            </div>

            <div className="inv-toolbar-actions">
              <button className="btn-secondary" onClick={handleExportCSV} disabled={filteredItems.length === 0}>
                <Download size={15} />
                <span>Export CSV</span>
              </button>
              <button className="btn-primary" onClick={openCreateModal}>
                <Plus size={16} />
                <span>Add Stock Item</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', minHeight: '200px', alignItems: 'center', justifyContent: 'center' }}>
              <Loader2 size={30} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="inv-empty animate-fade">
              <div className="inv-empty-icon"><PackageSearch size={26} /></div>
              <p>No inventory items found. Add items to track decorator stock.</p>
            </div>
          ) : (
            <>
            <p className="inv-scroll-hint">Swipe to see more →</p>
            <div className="inv-table-wrap animate-fade">
              <table className="inv-items-table">
                <thead>
                  <tr>
                    <th>Item Specification</th>
                    <th style={{ textAlign: 'center' }}>Category</th>
                    <th style={{ textAlign: 'center' }}>Quantity</th>
                    <th style={{ textAlign: 'center' }}>Unit</th>
                    <th style={{ textAlign: 'right' }}>Price</th>
                    <th style={{ textAlign: 'right' }}>Total Value</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map(item => (
                    <tr key={item.id}>
                      <td className="inv-name-cell">{item.name}</td>
                      <td className="inv-cat-cell">{item.category || '—'}</td>
                      <td className="inv-qty-cell">{item.quantity_available}</td>
                      <td className="inv-unit-cell">{item.unit || '—'}</td>
                      <td className="inv-price-cell">{formatCurrency(item.selling_rate)}</td>
                      <td className="inv-total-cell">{formatCurrency((parseFloat(item.quantity_available) || 0) * (parseFloat(item.selling_rate) || 0))}</td>
                      <td>
                        <div className="inv-row-actions">
                          <button
                            className="inv-icon-btn edit"
                            title="Edit Details"
                            onClick={() => openEditModal(item)}
                          >
                            <Edit size={13} />
                          </button>
                          <button
                            className="inv-icon-btn danger"
                            title="Delete Item"
                            onClick={() => handleDeleteItem(item.id)}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}

          {showCreateModal && (
            <div className="modal-overlay">
              <div className="modal-content">
                <div className="modal-header">
                  <h3 style={{ margin: 0 }}>{isEditing ? 'Edit Stock Item' : 'Add Stock Item'}</h3>
                  <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}>
                    <X size={18} />
                  </button>
                </div>
                <form onSubmit={handleSaveItem}>
                  <div className="modal-body">

                    <div className="form-group">
                      <label>Item Name / Description *</label>
                      <input
                        type="text"
                        className="input-field"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. LED String Lights Warm White 20m"
                      />
                    </div>

                    <div className="form-grid">
                      <div className="form-group">
                        <label>Category</label>
                        <CategoryCombobox value={category} onChange={setCategory} options={categoryOptions} />
                      </div>
                      <div className="form-group">
                        <label>Measurement Unit</label>
                        <select
                          className="input-field"
                          value={unit}
                          onChange={(e) => setUnit(e.target.value)}
                        >
                          <option value="">Select unit</option>
                          {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="form-grid">
                      <div className="form-group">
                        <label>Quantity In Stock *</label>
                        <input
                          type="number"
                          className="input-field"
                          required
                          min="0"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label>Price (₹) *</label>
                        <input
                          type="number"
                          className="input-field"
                          required
                          min="0"
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                        />
                      </div>
                    </div>

                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                    <button type="submit" className="btn-primary">Save Item</button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}