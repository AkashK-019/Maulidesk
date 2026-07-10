import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { Plus, Search, Edit, Trash2, X, Loader2, Boxes, Layers, Package, Wallet } from 'lucide-react';
import { formatCurrency } from '../utils/helpers';
import '../styles/quotations.css';
import '../styles/inventory.css';

// A fixed pick-list, not free text — keeps unit naming consistent across items.
const UNIT_OPTIONS = ['NOS', 'sq-feet', 'meter', 'feet', 'bundle'];

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Modal Controls
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  // Form States
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

  // Categories are whatever the user has actually typed so far — nothing predefined.
  const categoryOptions = useMemo(() => {
    const set = new Set();
    items.forEach(i => { if (i.category && i.category.trim()) set.add(i.category.trim()); });
    return Array.from(set).sort();
  }, [items]);

  // Filter listings — an item with no category only ever shows under "All",
  // never under a specific category pill.
  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Cards reflect whatever's currently filtered — switch category and the
  // numbers recalc for just that slice, not the whole inventory.
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
          {/* Summary cards */}
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

          {/* Toolbar */}
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

            <button className="btn-primary" onClick={openCreateModal} style={{ marginLeft: 'auto' }}>
              <Plus size={16} />
              <span>Add Stock Item</span>
            </button>
          </div>

          {/* Table */}
          {loading ? (
            <div style={{ display: 'flex', minHeight: '200px', alignItems: 'center', justifyContent: 'center' }}>
              <Loader2 size={30} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="glass-card text-center" style={{ padding: '3rem 1.5rem', color: 'var(--text-muted)' }}>
              No inventory items found. Add items to track decorator stock.
            </div>
          ) : (
            <div className="inv-table-wrap animate-fade">
              <table className="app-table">
                <thead>
                  <tr>
                    <th>Item Specification</th>
                    <th>Category</th>
                    <th style={{ textAlign: 'center' }}>Quantity</th>
                    <th>Unit</th>
                    <th>Price</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map(item => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 600 }}>{item.name}</td>
                      <td>
                        {item.category ? <span className="badge badge-neutral">{item.category}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{item.quantity_available}</td>
                      <td>{item.unit || '—'}</td>
                      <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{formatCurrency(item.selling_rate)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                          <button
                            className="btn-secondary"
                            style={{ padding: '0.35rem', borderRadius: '6px' }}
                            title="Edit Details"
                            onClick={() => openEditModal(item)}
                          >
                            <Edit size={13} />
                          </button>

                          <button
                            className="btn-secondary"
                            style={{ padding: '0.35rem', borderRadius: '6px', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}
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
          )}

          {/* Add / Edit modal */}
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
                        <input
                          type="text"
                          className="input-field"
                          list="inv-category-options"
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                          placeholder="Type or pick a category"
                        />
                        <datalist id="inv-category-options">
                          {categoryOptions.map(cat => <option key={cat} value={cat} />)}
                        </datalist>
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