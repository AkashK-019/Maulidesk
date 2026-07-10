import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { Save, UserPlus, Key, Shield, Info, Trash2, CheckSquare, Edit, Loader2, X } from 'lucide-react';
import { INDIAN_STATES } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
  const { profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);

  // 1. Company Settings state
  const [companyName, setCompanyName] = useState('Mauli Decorators');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [state, setState] = useState('Maharashtra');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [branchName, setBranchName] = useState('');

  // 2. Change Password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // 3. User Management states
  const [users, setUsers] = useState([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [addUserLoading, setAddUserLoading] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserFullName, setNewUserFullName] = useState('');
  const [newUserRole, setNewUserRole] = useState('Staff');
  const [newUserPermissions, setNewUserPermissions] = useState({
    dashboard: true,
    quotations: true,
    invoices: true,
    inventory: true,
    labour: true,
    attendance: true
  });

  // User edit state
  const [editingUser, setEditingUser] = useState(null);
  const [showEditUserModal, setShowEditUserModal] = useState(false);

  const isAdmin = profile?.role === 'Admin';

  useEffect(() => {
    fetchSettingsAndUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchSettingsAndUsers = async () => {
    setLoading(true);
    try {
      // Fetch company settings — only Admins need this, but harmless to fetch
      // (the UI itself is now gated below; tighten with RLS on the `settings`
      // table so non-admins can't write to it even via direct API calls)
      const { data: settingsData } = await supabase.from('settings').select('*').eq('id', 1).single();
      if (settingsData) {
        setCompanyName(settingsData.company_name);
        setAddress(settingsData.address || '');
        setPhone(settingsData.phone || '');
        setEmail(settingsData.email || '');
        setGstNumber(settingsData.gst_number || '');
        setState(settingsData.state || 'Maharashtra');
        setBankName(settingsData.bank_name || '');
        setAccountNumber(settingsData.account_number || '');
        setIfscCode(settingsData.ifsc_code || '');
        setBranchName(settingsData.branch_name || '');
      }

      // Fetch all system users (Admin only)
      if (profile?.role === 'Admin') {
        const { data: profilesData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
        setUsers(profilesData || []);
      }
    } catch (err) {
      console.error('Error fetching settings details:', err);
    } finally {
      setLoading(false);
    }
  };

  // Save company config settings
  const handleSaveCompanySettings = async (e) => {
    e.preventDefault();
    if (!isAdmin) return; // guard, in case the form somehow renders
    try {
      const { error } = await supabase.from('settings').upsert({
        id: 1,
        company_name: companyName,
        address,
        phone,
        email,
        gst_number: gstNumber,
        state,
        bank_name: bankName,
        account_number: accountNumber,
        ifsc_code: ifscCode,
        branch_name: branchName
      });
      if (error) throw error;
      alert('Company profile specifications saved successfully!');
    } catch (err) {
      console.error('Save settings error:', err);
      alert('Failed to save settings.');
    }
  };

  // Change password handler
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert('New password and Confirmation password must match!');
      return;
    }
    if (newPassword.length < 6) {
      alert('Password must be at least 6 characters.');
      return;
    }

    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      alert('Account password updated successfully!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error('Password change error:', err);
      alert('Failed to change password. Make sure the database credentials are valid.');
    } finally {
      setPasswordLoading(false);
    }
  };

  // Create new user (Sign up + profile creation)
  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!isAdmin) return; // guard
    if (newUserPassword.length < 6) {
      alert('Temporary password must be at least 6 characters.');
      return;
    }

    setAddUserLoading(true);
    try {
      // 1. Sign up user
      const { data, error: signupErr } = await supabase.auth.signUp({
        email: newUserEmail,
        password: newUserPassword
      });

      if (signupErr) throw signupErr;

      if (data?.user) {
        // Compile page permissions list
        const allowedPages = Object.keys(newUserPermissions).filter(page => newUserPermissions[page]);

        // 2. Insert profiles record
        const { error: profileErr } = await supabase.from('profiles').insert([{
          id: data.user.id,
          email: newUserEmail,
          full_name: newUserFullName,
          role: newUserRole,
          allowed_pages: allowedPages
        }]);

        if (profileErr) throw profileErr;

        alert(`Successfully registered user account: ${newUserEmail}!`);
        setShowAddUserModal(false);
        fetchSettingsAndUsers();

        // Reset states
        setNewUserEmail('');
        setNewUserPassword('');
        setNewUserFullName('');
        setNewUserRole('Staff');
      }
    } catch (err) {
      console.error('Add user error:', err);
      alert(`Add user failed: ${err.message}`);
    } finally {
      setAddUserLoading(false);
    }
  };

  const handleEditPermissions = (u) => {
    if (!isAdmin) return; // guard
    setEditingUser(u);
    // Prepare permission checkboxes
    const permissions = {
      dashboard: u.allowed_pages?.includes('dashboard') || false,
      quotations: u.allowed_pages?.includes('quotations') || false,
      invoices: u.allowed_pages?.includes('invoices') || false,
      inventory: u.allowed_pages?.includes('inventory') || false,
      labour: u.allowed_pages?.includes('labour') || false,
      attendance: u.allowed_pages?.includes('attendance') || false
    };
    setNewUserPermissions(permissions);
    setNewUserFullName(u.full_name || '');
    setNewUserRole(u.role || 'Staff');
    setShowEditUserModal(true);
  };

  const handleSaveEditedUser = async (e) => {
    e.preventDefault();
    if (!editingUser || !isAdmin) return;
    try {
      const allowedPages = Object.keys(newUserPermissions).filter(page => newUserPermissions[page]);
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: newUserFullName,
          role: newUserRole,
          allowed_pages: allowedPages
        })
        .eq('id', editingUser.id);

      if (error) throw error;
      alert('User permission parameters updated!');
      setShowEditUserModal(false);
      fetchSettingsAndUsers();
      refreshProfile(); // Refresh current user's profile if editing self
    } catch (err) {
      console.error('Edit user error:', err);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!isAdmin) return; // guard
    if (window.confirm('Are you sure you want to delete this user profile? They will lose access to Maulidesk.')) {
      try {
        const { error } = await supabase.from('profiles').delete().eq('id', userId);
        if (error) throw error;
        fetchSettingsAndUsers();
      } catch (err) {
        console.error('Delete profile error:', err);
      }
    }
  };

  const handlePermCheckChange = (page) => {
    setNewUserPermissions(prev => ({
      ...prev,
      [page]: !prev[page]
    }));
  };

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <Header title="Settings &amp; Security" />

        <main className="gs-main settings-page">
          {/* Scoped responsive styles for this page — mobile, tablet, and desktop */}
          <style>{`
            .settings-page {
              padding: 1rem;
              box-sizing: border-box;
            }
            .settings-page .settings-grid {
              display: grid;
              gap: 1.5rem;
              width: 100%;
            }
            .settings-page .settings-grid.is-double {
              grid-template-columns: 1.2fr 1fr;
            }
            .settings-page .settings-grid.is-single {
              grid-template-columns: 1fr;
              max-width: 640px;
              margin: 0 auto;
            }
            .settings-page .settings-col {
              display: flex;
              flex-direction: column;
              gap: 1.5rem;
              min-width: 0; /* prevents grid children from overflowing on narrow screens */
            }
            .settings-page .glass-card {
              width: 100%;
              box-sizing: border-box;
            }
            .settings-page .form-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 1rem;
            }
            .settings-page .card-header-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              gap: 0.75rem;
              flex-wrap: wrap;
              margin-bottom: 1rem;
            }
            .settings-page .user-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              gap: 0.75rem;
              flex-wrap: wrap;
              padding: 0.75rem;
              border: 1px solid var(--border);
              border-radius: 8px;
              background: #faf9f6;
            }
            .settings-page .user-row-info {
              min-width: 0;
              flex: 1 1 200px;
              word-break: break-word;
            }
            .settings-page .user-row-actions {
              display: flex;
              gap: 6px;
              flex-shrink: 0;
              align-items: center;
            }
            .settings-page .user-row-actions .btn-secondary {
              width: 34px;
              height: 34px;
              padding: 0 !important;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              flex: 0 0 auto;
            }
            .settings-page .modal-content {
              width: min(94vw, 560px);
              max-height: 90vh;
              overflow-y: auto;
              box-sizing: border-box;
            }
            .settings-page .perm-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 0.5rem;
            }

            /* Tablet */
            @media (max-width: 1024px) {
              .settings-page .settings-grid.is-double {
                grid-template-columns: 1fr;
              }
            }

            /* Mobile */
            @media (max-width: 640px) {
              .settings-page {
                padding: 0.75rem;
              }
              .settings-page .form-grid {
                grid-template-columns: 1fr;
                gap: 0.75rem;
              }
              .settings-page .perm-grid {
                grid-template-columns: 1fr;
              }
              .settings-page .glass-card {
                padding: 1rem;
              }
              .settings-page .user-row {
                flex-direction: row;
                flex-wrap: nowrap;
                align-items: flex-start;
                justify-content: space-between;
                gap: 0.5rem;
              }
              .settings-page .user-row-actions {
                justify-content: flex-end;
              }
              .settings-page .modal-content {
                width: 100vw;
                max-height: 100vh;
                height: 100%;
                border-radius: 0;
              }
              /* Full-width only applies to real form submit / modal footer buttons,
                 never to the small icon buttons in a user row */
              .settings-page .form-actions .btn-primary,
              .settings-page .form-actions .btn-secondary,
              .settings-page .modal-footer .btn-primary,
              .settings-page .modal-footer .btn-secondary {
                width: 100%;
                justify-content: center;
              }
              .settings-page .modal-footer {
                flex-direction: column-reverse;
                gap: 0.5rem;
              }
            }
          `}</style>

          {loading ? (
            <div style={{ display: 'flex', minHeight: '200px', alignItems: 'center', justifyContent: 'center' }}>
              <Loader2 size={30} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
            </div>
          ) : (
            <div className={`animate-fade settings-grid ${isAdmin ? 'is-double' : 'is-single'}`}>

              {/* Left Column — Company Profile details (Admin Only) */}
              {isAdmin && (
                <div className="settings-col">
                  <div className="glass-card">
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Info size={16} />
                      <span>Company Profile details</span>
                    </h3>

                    <form onSubmit={handleSaveCompanySettings}>
                      <div className="form-group">
                        <label>Business Name *</label>
                        <input
                          type="text"
                          className="input-field"
                          required
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                        />
                      </div>

                      <div className="form-grid">
                        <div className="form-group">
                          <label>Contact Phone</label>
                          <input
                            type="text"
                            className="input-field"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                          />
                        </div>
                        <div className="form-group">
                          <label>Business Email</label>
                          <input
                            type="email"
                            className="input-field"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="form-grid">
                        <div className="form-group">
                          <label>State (GST Location Defaults) *</label>
                          <select
                            className="input-field"
                            value={state}
                            onChange={(e) => setState(e.target.value)}
                          >
                            {INDIAN_STATES.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label>GSTIN Number</label>
                          <input
                            type="text"
                            className="input-field"
                            value={gstNumber}
                            onChange={(e) => setGstNumber(e.target.value)}
                            placeholder="e.g. 27AAAAA1111A1Z1"
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label>Business Address</label>
                        <textarea
                          className="input-field"
                          rows="2"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                        />
                      </div>

                      <h4 style={{ color: 'var(--primary)', borderBottom: '1px solid var(--border)', paddingBottom: '4px', margin: '1.5rem 0 1rem' }}>
                        Bank Account specs (For Invoice Footers)
                      </h4>

                      <div className="form-grid">
                        <div className="form-group">
                          <label>Bank Name</label>
                          <input
                            type="text"
                            className="input-field"
                            value={bankName}
                            onChange={(e) => setBankName(e.target.value)}
                          />
                        </div>
                        <div className="form-group">
                          <label>Account Number</label>
                          <input
                            type="text"
                            className="input-field"
                            value={accountNumber}
                            onChange={(e) => setAccountNumber(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="form-grid">
                        <div className="form-group">
                          <label>IFSC Code</label>
                          <input
                            type="text"
                            className="input-field"
                            value={ifscCode}
                            onChange={(e) => setIfscCode(e.target.value)}
                          />
                        </div>
                        <div className="form-group">
                          <label>Branch Name</label>
                          <input
                            type="text"
                            className="input-field"
                            value={branchName}
                            onChange={(e) => setBranchName(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="form-actions" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                        <button type="submit" className="btn-primary">
                          <Save size={14} />
                          <span>Save Profile Specifications</span>
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Right Column — Security & Users */}
              <div className="settings-col">

                {/* Account Security (Change password) — visible to everyone */}
                <div className="glass-card">
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Key size={16} />
                    <span>Change Account Password</span>
                  </h3>

                  <form onSubmit={handleChangePassword}>
                    <div className="form-group">
                      <label>New Password *</label>
                      <input
                        type="password"
                        className="input-field"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                      />
                    </div>
                    <div className="form-group">
                      <label>Confirm Password *</label>
                      <input
                        type="password"
                        className="input-field"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                      />
                    </div>
                    <div className="form-actions" style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                      <button type="submit" className="btn-primary" disabled={passwordLoading}>
                        {passwordLoading ? 'Updating...' : 'Update Password'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* User Permissions Management (Admin Only) */}
                {isAdmin && (
                  <div className="glass-card">
                    <div className="card-header-row">
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                        <Shield size={16} />
                        <span>System User Permissions</span>
                      </h3>
                      <button className="btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.78rem' }} onClick={() => {
                        setNewUserEmail('');
                        setNewUserPassword('');
                        setNewUserFullName('');
                        setNewUserRole('Staff');
                        setNewUserPermissions({ dashboard: true, quotations: true, invoices: true, inventory: true, labour: true, attendance: true });
                        setShowAddUserModal(true);
                      }}>
                        <UserPlus size={12} />
                        <span>Add User</span>
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '420px', overflowY: 'auto' }}>
                      {users.map(u => (
                        <div key={u.id} className="user-row">
                          <div className="user-row-info">
                            <strong style={{ fontSize: '0.85rem', color: 'var(--primary)' }}>{u.full_name || 'System User'}</strong>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.email}</div>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
                              <span className="badge badge-neutral" style={{ fontWeight: 700 }}>{u.role}</span>
                              {u.role === 'Admin' ? (
                                <span className="badge badge-success">Full Access</span>
                              ) : (
                                (u.allowed_pages || []).map(p => (
                                  <span key={p} className="badge badge-neutral" style={{ fontSize: '0.65rem' }}>{p}</span>
                                ))
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="user-row-actions">
                            <button
                              className="btn-secondary"
                              style={{ padding: '0.3rem', borderRadius: '6px' }}
                              onClick={() => handleEditPermissions(u)}
                              title="Edit permissions"
                            >
                              <Edit size={12} />
                            </button>
                            {u.id !== profile?.id && (
                              <button
                                className="btn-secondary"
                                style={{ padding: '0.3rem', borderRadius: '6px', color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)' }}
                                onClick={() => handleDeleteUser(u.id)}
                                title="Delete user"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* Add User Modal (Admin Only) */}
          {isAdmin && showAddUserModal && (
            <div className="modal-overlay">
              <div className="modal-content">
                <div className="modal-header">
                  <h3 style={{ margin: 0 }}>Add New System User</h3>
                  <button onClick={() => setShowAddUserModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}>
                    <X size={18} />
                  </button>
                </div>
                <form onSubmit={handleCreateUser}>
                  <div className="modal-body">

                    <div className="form-group">
                      <label>User Email Address *</label>
                      <input
                        type="email"
                        className="input-field"
                        required
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        placeholder="user@maulidecorators.com"
                      />
                    </div>

                    <div className="form-group">
                      <label>Temporary Password *</label>
                      <input
                        type="password"
                        className="input-field"
                        required
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        placeholder="••••••••"
                      />
                    </div>

                    <div className="form-grid">
                      <div className="form-group">
                        <label>User Full Name *</label>
                        <input
                          type="text"
                          className="input-field"
                          required
                          value={newUserFullName}
                          onChange={(e) => setNewUserFullName(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label>Security Role *</label>
                        <select
                          className="input-field"
                          value={newUserRole}
                          onChange={(e) => setNewUserRole(e.target.value)}
                        >
                          <option value="Staff">Staff</option>
                          <option value="Admin">Administrator</option>
                        </select>
                      </div>
                    </div>

                    {/* Permissions list (Only relevant for non-admin) */}
                    {newUserRole === 'Staff' && (
                      <div style={{ marginTop: '1rem' }}>
                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '0.5rem' }}>
                          Configure Allowed Pages / Permissions
                        </label>
                        <div className="perm-grid">
                          {Object.keys(newUserPermissions).map(page => (
                            <label key={page} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={newUserPermissions[page]}
                                onChange={() => handlePermCheckChange(page)}
                              />
                              <span>{page.charAt(0).toUpperCase() + page.slice(1)}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn-secondary" onClick={() => setShowAddUserModal(false)}>Cancel</button>
                    <button type="submit" className="btn-primary" disabled={addUserLoading}>
                      {addUserLoading ? 'Creating User...' : 'Add User Profile'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Edit User Modal (Admin Only) */}
          {isAdmin && showEditUserModal && editingUser && (
            <div className="modal-overlay">
              <div className="modal-content">
                <div className="modal-header">
                  <h3 style={{ margin: 0 }}>Configure User Permissions</h3>
                  <button onClick={() => setShowEditUserModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}>
                    <X size={18} />
                  </button>
                </div>
                <form onSubmit={handleSaveEditedUser}>
                  <div className="modal-body">

                    <div className="form-group">
                      <label>User Email Address</label>
                      <input
                        type="email"
                        className="input-field"
                        disabled
                        value={editingUser.email}
                      />
                    </div>

                    <div className="form-grid">
                      <div className="form-group">
                        <label>User Full Name *</label>
                        <input
                          type="text"
                          className="input-field"
                          required
                          value={newUserFullName}
                          onChange={(e) => setNewUserFullName(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label>Security Role *</label>
                        <select
                          className="input-field"
                          value={newUserRole}
                          onChange={(e) => setNewUserRole(e.target.value)}
                        >
                          <option value="Staff">Staff</option>
                          <option value="Admin">Administrator</option>
                        </select>
                      </div>
                    </div>

                    {/* Permissions list (Only relevant for non-admin) */}
                    {newUserRole === 'Staff' && (
                      <div style={{ marginTop: '1rem' }}>
                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '0.5rem' }}>
                          Configure Allowed Pages / Permissions
                        </label>
                        <div className="perm-grid">
                          {Object.keys(newUserPermissions).map(page => (
                            <label key={page} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={newUserPermissions[page]}
                                onChange={() => handlePermCheckChange(page)}
                              />
                              <span>{page.charAt(0).toUpperCase() + page.slice(1)}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn-secondary" onClick={() => setShowEditUserModal(false)}>Cancel</button>
                    <button type="submit" className="btn-primary">Update Details</button>
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