import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import {
  Search, FolderOpen,
  Phone, MapPin, X, Edit, Trash2, ChevronRight, ChevronDown, Check,
  Loader2, Zap, CheckCircle, XCircle
} from 'lucide-react';
import { formatDate, formatCurrency } from '../utils/helpers';
import '../styles/Projects.css';

const EVENT_TYPES = ['Wedding', 'Birthday', 'Corporate', 'Anniversary', 'Engagement', 'Other'];
const STATUS_FILTERS = ['All', 'Active', 'Completed', 'Cancelled'];
const STATUS_OPTIONS  = ['Active', 'Completed', 'Cancelled'];

const PENDING_ROUND_TOLERANCE = 1;

const STATUS_CONFIG = {
  Active:    { color: '#2563eb', bg: '#eff6ff' },
  Completed: { color: '#10b981', bg: '#ecfdf5' },
  Cancelled: { color: '#ef4444', bg: '#fef2f2' },
};

export default function Projects() {
  const navigate = useNavigate();

  const [projects, setProjects]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [searchTerm, setSearchTerm]     = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  /* ── Project modal ── */
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject]     = useState(null);
  const [projectForm, setProjectForm] = useState({
    project_name: '', client_name: '', client_phone: '', client_email: '',
    client_address: '', event_date: '', event_type: 'Wedding', status: 'Active', notes: ''
  });
  const [saving, setSaving] = useState(false);

  const [statusMenuOpen, setStatusMenuOpen] = useState(null); 
  const statusMenuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target)) {
        setStatusMenuOpen(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { fetchProjects(); }, []);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const [
        { data, error },
        { data: invs },
        { data: rcpts },
      ] = await Promise.all([
        supabase.from('projects').select('*').order('created_at', { ascending: false }),
        supabase.from('invoices').select('project_id, total_amount'),
        supabase.from('payment_receipts').select('project_id, amount'),
      ]);
      if (error) throw error;

      const invoiceTotals = {};
      const invoicedIds = new Set();
      (invs || []).forEach(inv => {
        invoiceTotals[inv.project_id] = (invoiceTotals[inv.project_id] || 0) + (Number(inv.total_amount) || 0);
        invoicedIds.add(inv.project_id);
      });
      const paidTotals = {};
      (rcpts || []).forEach(r => {
        paidTotals[r.project_id] = (paidTotals[r.project_id] || 0) + (Number(r.amount) || 0);
      });

      const withFinance = (data || []).map(p => {
        const invoiceTotal = invoiceTotals[p.id] || 0;
        const totalPaid = paidTotals[p.id] || 0;
        return {
          ...p,
          hasInvoice: invoicedIds.has(p.id),
          invoiceTotal,
          totalPaid,
          pending: Math.max(invoiceTotal - totalPaid, 0),
        };
      });

      setProjects(withFinance);
    } finally { setLoading(false); }
  };

  const openEditProject = (p, e) => {
    e.stopPropagation();
    setEditingProject(p);
    setProjectForm({
      project_name:   p.project_name,
      client_name:    p.client_name,
      client_phone:   p.client_phone   || '',
      client_email:   p.client_email   || '',
      client_address: p.client_address || '',
      event_date:     p.event_date     || '',
      event_type:     p.event_type     || 'Wedding',
      status:         p.status,
      notes:          p.notes          || '',
    });
    setShowProjectModal(true);
  };

  const handleSaveProject = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingProject) {
        const { error } = await supabase.from('projects').update(projectForm).eq('id', editingProject.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('projects').insert([projectForm]);
        if (error) throw error;
      }
      setShowProjectModal(false);
      fetchProjects();
    } catch (err) { alert('Error: ' + err.message); }
    finally { setSaving(false); }
  };

  const handleDeleteProject = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this project? This will permanently delete the project and all linked quotations, invoices, and payments.')) return;
    try {
      // 1. Delete linked payment receipts
      await supabase.from('payment_receipts').delete().eq('project_id', id);
      // 2. Delete linked invoices
      await supabase.from('invoices').delete().eq('project_id', id);
      // 3. Delete linked quotations
      await supabase.from('quotations').delete().eq('project_id', id);
      // 4. Delete the project itself
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) throw error;
      fetchProjects();
    } catch (err) { alert(err.message); }
  };

  const handleStatusChange = async (id, newStatus, e) => {
    e.stopPropagation();
    setProjects(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
    try {
      await supabase.from('projects').update({ status: newStatus }).eq('id', id);
    } catch {
      fetchProjects();
    }
  };

  /* ── Filtered projects ── */
  const filtered = projects.filter(p => {
    const s = (p.project_name + p.client_name).toLowerCase().includes(searchTerm.toLowerCase());
    const f = statusFilter === 'All' || p.status === statusFilter;
    return s && f;
  });

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <Header title="Projects" />
        <main className="gs-main">

          {/* ── Page Header ── */}
          <div className="prj-page-head animate-fade">
            <div>
              <h1 className="prj-page-title">Project Management</h1>
              
            </div>
          </div>

          {/* ── Metrics ── */}
          <div className="prj-metrics animate-fade">
            <div className="prj-metric">
              <div className="prj-metric-icon" style={{ background: '#F7EDE5', color: '#A35F37' }}><FolderOpen size={17} /></div>
              <div className="prj-metric-body"><span className="prj-metric-val">{projects.length}</span><span className="prj-metric-lbl">Total</span></div>
            </div>
            <div className="prj-metric">
              <div className="prj-metric-icon" style={{ background: '#eff6ff', color: '#2563eb' }}><Zap size={17} /></div>
              <div className="prj-metric-body"><span className="prj-metric-val">{projects.filter(p => p.status === 'Active').length}</span><span className="prj-metric-lbl">Active</span></div>
            </div>
            <div className="prj-metric">
              <div className="prj-metric-icon" style={{ background: '#ecfdf5', color: '#10b981' }}><CheckCircle size={17} /></div>
              <div className="prj-metric-body"><span className="prj-metric-val">{projects.filter(p => p.status === 'Completed').length}</span><span className="prj-metric-lbl">Completed</span></div>
            </div>
            <div className="prj-metric">
              <div className="prj-metric-icon" style={{ background: '#fef2f2', color: '#ef4444' }}><XCircle size={17} /></div>
              <div className="prj-metric-body"><span className="prj-metric-val">{projects.filter(p => p.status === 'Cancelled').length}</span><span className="prj-metric-lbl">Cancelled</span></div>
            </div>
          </div>

          {/* ── Toolbar ── */}
          <div className="prj-toolbar animate-fade">
            <div className="prj-search-wrap">
              <Search size={14} className="prj-search-icon" />
              <input
                type="text"
                placeholder="Search project or client…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="prj-search-input"
              />
            </div>
            <div className="prj-filters">
              {STATUS_FILTERS.map(s => (
                <button
                  key={s}
                  className={`prj-filter-btn${statusFilter === s ? ' active' : ''}`}
                  onClick={() => setStatusFilter(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* ── Project Grid ── */}
          {loading ? (
            <div className="prj-loading">
              <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: '#c17a4e' }} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="prj-empty">
              <FolderOpen size={40} style={{ marginBottom: '1rem', opacity: 0.3 }} />
              <p style={{ margin: 0 }}>
                {projects.length === 0
                  ? 'No projects yet. Approve a quotation to create your first project.'
                  : 'No projects match your search.'}
              </p>
            </div>
          ) : (
            <div className="prj-grid animate-fade">
              {filtered.map(p => {
                const sc = STATUS_CONFIG[p.status] || STATUS_CONFIG.Active;
                return (
                  <div
                    key={p.id}
                    className={`prj-card${statusMenuOpen === p.id ? ' status-menu-open' : ''}`}
                    onClick={() => navigate(`/projects/${p.id}`)}
                  >
                    <div className="prj-card-head">
                      <div className="prj-card-icon"><FolderOpen size={17} /></div>
                      <div className="prj-card-actions" onClick={e => e.stopPropagation()}>
                        <div
                          className="prj-status-dropdown"
                          ref={statusMenuOpen === p.id ? statusMenuRef : null}
                        >
                          <button
                            type="button"
                            className="prj-status-trigger"
                            style={{ background: sc.bg, color: sc.color }}
                            onClick={() => setStatusMenuOpen(prev => prev === p.id ? null : p.id)}
                          >
                            {p.status}
                            <ChevronDown size={12} style={{ transform: statusMenuOpen === p.id ? 'rotate(180deg)' : 'none' }} />
                          </button>
                          {statusMenuOpen === p.id && (
                            <div className="prj-status-menu">
                              {STATUS_OPTIONS.map(s => {
                                const optSc = STATUS_CONFIG[s];
                                return (
                                  <button
                                    key={s}
                                    type="button"
                                    className={`prj-status-option${p.status === s ? ' active' : ''}`}
                                    onClick={e => { handleStatusChange(p.id, s, e); setStatusMenuOpen(null); }}
                                  >
                                    <span className="prj-status-dot" style={{ background: optSc.color }} />
                                    {s}
                                    {p.status === s && <Check size={13} />}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <button className="prj-card-action-btn" title="Edit" onClick={e => openEditProject(p, e)}>
                          <Edit size={13} />
                        </button>
                        <button className="prj-card-action-btn delete-btn" title="Delete" onClick={e => handleDeleteProject(p.id, e)}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <div className="prj-card-name-wrap">
                      <p className="prj-card-project-name">{p.project_name}</p>
                      <h3 className="prj-card-name">{p.client_name}</h3>
                    </div>

                    <div className="prj-card-stats">
                      <div className="prj-stat">
                        <span className="prj-stat-lbl">Event Type</span>
                        <span className="prj-stat-val">{p.event_type || '—'}</span>
                      </div>
                      <div className="prj-stat">
                        <span className="prj-stat-lbl">Event Date</span>
                        <span className="prj-stat-val">{p.event_date ? formatDate(p.event_date) : '—'}</span>
                      </div>
                    </div>

                    {p.hasInvoice ? (
                      <div className="prj-card-finance">
                        <div className="prj-fin-item">
                          <span className="prj-fin-lbl">Invoice Total</span>
                          <span className="prj-fin-val">{formatCurrency(p.invoiceTotal)}</span>
                        </div>
                        <div className="prj-fin-item">
                          <span className="prj-fin-lbl">{p.pending > PENDING_ROUND_TOLERANCE ? 'Pending' : 'Collected'}</span>
                          <span className={`prj-fin-val ${p.pending > PENDING_ROUND_TOLERANCE ? 'due' : 'paid'}`}>
                            {p.pending > PENDING_ROUND_TOLERANCE ? formatCurrency(p.pending) : 'Fully Paid'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="prj-card-finance empty">
                        <span className="prj-fin-lbl">No invoice raised yet</span>
                      </div>
                    )}

                    <div className="prj-card-footer">
                      <div className="prj-card-address">
                        {p.client_phone
                          ? <><Phone size={11} /> <span>{p.client_phone}</span></>
                          : p.client_address
                            ? <><MapPin size={11} /> <span>{p.client_address}</span></>
                            : null}
                      </div>
                      <div className="prj-card-open">
                        Open <ChevronRight size={13} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Create / Edit Project Modal ── */}
          {showProjectModal && (
            <div className="modal-overlay">
              <div className="modal-content" style={{ maxWidth: 560 }}>
                <div className="modal-header">
                  <h3 style={{ margin: 0 }}>{editingProject ? 'Edit Project' : 'New Project'}</h3>
                  <button onClick={() => setShowProjectModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    <X size={18} />
                  </button>
                </div>
                <form onSubmit={handleSaveProject}>
                  <div className="modal-body">
                    <div className="form-grid">
                      <div className="form-group" style={{ gridColumn: '1/-1' }}>
                        <label>Project Name *</label>
                        <input
                          className="input-field"
                          required
                          value={projectForm.project_name}
                          onChange={e => setProjectForm(p => ({ ...p, project_name: e.target.value }))}
                          placeholder="e.g. Sharma Wedding Decoration"
                        />
                      </div>
                      <div className="form-group">
                        <label>Client Name *</label>
                        <input className="input-field" required value={projectForm.client_name} onChange={e => setProjectForm(p => ({ ...p, client_name: e.target.value }))} />
                      </div>
                      <div className="form-group">
                        <label>Client Phone</label>
                        <input className="input-field" value={projectForm.client_phone} onChange={e => setProjectForm(p => ({ ...p, client_phone: e.target.value }))} />
                      </div>
                      <div className="form-group">
                        <label>Client Email</label>
                        <input type="email" className="input-field" value={projectForm.client_email} onChange={e => setProjectForm(p => ({ ...p, client_email: e.target.value }))} />
                      </div>
                      <div className="form-group">
                        <label>Event Type</label>
                        <select className="input-field" value={projectForm.event_type} onChange={e => setProjectForm(p => ({ ...p, event_type: e.target.value }))}>
                          {EVENT_TYPES.map(t => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Event Date</label>
                        <input
                          type="date"
                          className="input-field"
                          style={{ colorScheme: 'light' }}
                          value={projectForm.event_date}
                          onChange={e => setProjectForm(p => ({ ...p, event_date: e.target.value }))}
                        />
                      </div>
                      <div className="form-group">
                        <label>Status</label>
                        <select className="input-field" value={projectForm.status} onChange={e => setProjectForm(p => ({ ...p, status: e.target.value }))}>
                          <option>Active</option><option>Completed</option><option>Cancelled</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ gridColumn: '1/-1' }}>
                        <label>Client Address</label>
                        <textarea className="input-field" rows={2} value={projectForm.client_address} onChange={e => setProjectForm(p => ({ ...p, client_address: e.target.value }))} />
                      </div>
                      <div className="form-group" style={{ gridColumn: '1/-1' }}>
                        <label>Notes</label>
                        <textarea className="input-field" rows={2} value={projectForm.notes} onChange={e => setProjectForm(p => ({ ...p, notes: e.target.value }))} />
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn-secondary" onClick={() => setShowProjectModal(false)}>Cancel</button>
                    <button type="submit" className="btn-primary" disabled={saving}>
                      {saving ? 'Saving…' : 'Save Project'}
                    </button>
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