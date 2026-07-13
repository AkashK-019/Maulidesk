import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import {
  Plus, Search, Edit, Trash2, X, Loader2, Users, User,
  Wallet, ClipboardList, ChevronLeft, ChevronRight, Download
} from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/helpers';
import { SHIFT_CODES, getShiftMultiplier, getShiftLabel } from '../utils/attendanceCodes';
import { downloadCSV, csvDateText } from '../utils/exportCsv';
import '../styles/quotations.css';
import '../styles/labour.css';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const pad2 = (n) => String(n).padStart(2, '0');
const dateKey = (year, month, day) => `${year}-${pad2(month + 1)}-${pad2(day)}`;

const SKILL_OPTIONS = [
  { value: 'Helper',      label: 'General Helper' },
  { value: 'Draper',      label: 'Fabric Draper' },
  { value: 'Florist',     label: 'Florist / Flower Decorator' },
  { value: 'Lightman',    label: 'Light / Sound Crew' },
  { value: 'Carpenter',   label: 'Carpenter' },
  { value: 'Supervisor',  label: 'Supervisor' },
];

const todayStr = () => new Date().toISOString().split('T')[0];

export default function Labour() {
  // ---------- List / global state ----------
  const [labourers, setLabourers] = useState([]);
  const [allAttendance, setAllAttendance] = useState([]);
  const [allPayments, setAllPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeListTab, setActiveListTab] = useState('All'); // All | Individual | Group Leader
  const [selectedLabourId, setSelectedLabourId] = useState(null);

  // ---------- Detail workspace state ----------
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState('profile'); 

  // ---------- Attendance form ----------
  const [attDate, setAttDate] = useState(todayStr());
  const [attCode, setAttCode] = useState('P');
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [savingKey, setSavingKey] = useState(null);
  const [rollDate, setRollDate] = useState(todayStr());
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  // ---------- Payment form ----------
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(todayStr());
  const [payMode, setPayMode] = useState('Cash');
  const [payRemarks, setPayRemarks] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  // ---------- Add / Edit Labour modal ----------
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingLabour, setEditingLabour] = useState(null);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [skillType, setSkillType] = useState('');
  const [labourType, setLabourType] = useState('Individual');
  const [groupName, setGroupName] = useState('');
  const [crewSize, setCrewSize] = useState(1);
  const [dailyWage, setDailyWage] = useState(0);
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [bankDetails, setBankDetails] = useState('');

  useEffect(() => {
    fetchAll();
  }, []);

  // ---------- Data loading ----------
  const fetchAll = async () => {
    setLoading(true);
    try {
      const [{ data: labs, error: labErr }, { data: atts, error: attErr }, { data: pmts, error: pmtErr }] =
        await Promise.all([
          supabase.from('labour_master').select('*').order('name', { ascending: true }),
          supabase.from('labour_attendance').select('*').order('attendance_date', { ascending: false }),
          supabase.from('labour_payments').select('*').order('payment_date', { ascending: false }),
        ]);
      if (labErr) throw labErr;
      if (attErr) throw attErr;
      if (pmtErr) throw pmtErr;

      let attendanceRows = atts || [];
      const filledYesterday = await autoMarkYesterdayAbsent(labs || [], attendanceRows);
      if (filledYesterday.length > 0) attendanceRows = [...attendanceRows, ...filledYesterday];

      setLabourers(labs || []);
      setAllAttendance(attendanceRows);
      setAllPayments(pmts || []);
    } catch (err) {
      console.error('Error loading labour data:', err);
    } finally {
      setLoading(false);
    }
  };

  // If yesterday passed with no attendance logged for a worker who already
  // existed by then, auto-fill it as Absent so nobody's day silently stays
  // blank forever. Runs quietly every time data loads — cheap no-op once caught up.
  const autoMarkYesterdayAbsent = async (labs, existingAttendance) => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const yesterday = y.toISOString().split('T')[0];

    const missing = labs.filter(l => {
      const alreadyMarked = existingAttendance.some(a => a.labour_id === l.id && a.attendance_date === yesterday);
      const existedByYesterday = !l.created_at || l.created_at.split('T')[0] <= yesterday;
      return !alreadyMarked && existedByYesterday;
    });
    if (missing.length === 0) return [];

    const fillRows = missing.map(l => ({
      labour_id: l.id,
      attendance_date: yesterday,
      shift: 'Full Day',
      status: 'A',
      working_hours: 0,
      overtime_hours: 0,
    }));

    try {
      const { data: inserted, error } = await supabase
        .from('labour_attendance')
        .upsert(fillRows, { onConflict: 'labour_id,attendance_date,shift' })
        .select();
      if (error) throw error;
      return inserted || [];
    } catch (err) {
      console.error('Auto-absent fill error:', err);
      return [];
    }
  };

  // ---------- Earnings engine ----------
  // Map of labour_id -> { earned, paid, balance }
  // For a Group Leader, one attendance mark represents the WHOLE crew, so the
  // day's earnings are daily_wage(per worker) * crew_size * shift multiplier.
  const earningsMap = useMemo(() => {
    const map = {};
    labourers.forEach(l => {
      map[l.id] = { earned: 0, paid: 0, balance: 0 };
    });

    allAttendance.forEach(a => {
      const lab = labourers.find(l => l.id === a.labour_id);
      if (!lab || !map[a.labour_id]) return;
      const dailyRate = parseFloat(lab.daily_wage) || 0;
      const headcount = lab.labour_type === 'Group Leader' ? (parseInt(lab.crew_size, 10) || 1) : 1;
      map[a.labour_id].earned += dailyRate * headcount * getShiftMultiplier(a.status);
    });

    allPayments.forEach(p => {
      if (map[p.labour_id]) {
        map[p.labour_id].paid += parseFloat(p.amount_paid) || 0;
      }
    });

    Object.keys(map).forEach(id => {
      map[id].balance = map[id].earned - map[id].paid;
    });

    return map;
  }, [labourers, allAttendance, allPayments]);

  // ---------- Roll-call state (used by the summary bar + list quick-mark buttons) ----------
  // Every worker defaults to Absent for rollDate until an explicit mark exists —
  // this is a *display/derived* default only; nothing is written to the database
  // until someone actually taps a status, so historical days are never touched.
  const rollMarkMap = useMemo(() => {
    const map = {};
    allAttendance.forEach(a => {
      if (a.attendance_date === rollDate) map[a.labour_id] = a;
    });
    return map;
  }, [allAttendance, rollDate]);

  // ---------- Derived selections ----------
  const selectedLabour = labourers.find(l => l.id === selectedLabourId) || null;
  const isCrew = selectedLabour?.labour_type === 'Group Leader';

  const workerAttendance = useMemo(
    () => allAttendance.filter(a => a.labour_id === selectedLabourId),
    [allAttendance, selectedLabourId]
  );
  const workerPayments = useMemo(
    () => allPayments.filter(p => p.labour_id === selectedLabourId),
    [allPayments, selectedLabourId]
  );
  const workerStats = selectedLabourId ? (earningsMap[selectedLabourId] || { earned: 0, paid: 0, balance: 0 }) : null;

  // ---------- Payments tab: current month only ----------
  // Dates are plain 'YYYY-MM-DD' strings, so string comparison against
  // currentMonthStartKey is safe and avoids any timezone conversion issues.
  // currentMonthPaid: payments logged this month.
  // currentMonthOutstanding: this month's earned minus this month's paid.
  const workerMonthlyStats = useMemo(() => {
    if (!selectedLabourId || !selectedLabour) return null;
    const now = new Date();
    const currentMonthStartKey = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-01`;
    const currentMonthLabel = MONTH_NAMES[now.getMonth()];

    const dailyRate = parseFloat(selectedLabour.daily_wage) || 0;
    const headcount = isCrew ? (parseInt(selectedLabour.crew_size, 10) || 1) : 1;

    let currentMonthEarned = 0, currentMonthPaid = 0;

    workerAttendance.forEach(a => {
      if (a.attendance_date >= currentMonthStartKey) {
        currentMonthEarned += dailyRate * headcount * getShiftMultiplier(a.status);
      }
    });

    workerPayments.forEach(p => {
      if (p.payment_date >= currentMonthStartKey) currentMonthPaid += (parseFloat(p.amount_paid) || 0);
    });

    return {
      currentMonthLabel,
      currentMonthPaid,
      currentMonthOutstanding: currentMonthEarned - currentMonthPaid,
    };
  }, [selectedLabourId, selectedLabour, isCrew, workerAttendance, workerPayments]);

  // The mark for today/selected attDate, if one already exists — lets the tap buttons show current state
  const attDateExistingMark = useMemo(
    () => workerAttendance.find(a => a.attendance_date === attDate) || null,
    [workerAttendance, attDate]
  );

  // ---------- Monthly calendar (Attendance tab) ----------
  const calendarDays = useMemo(() => {
    const { year, month } = calendarMonth;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startWeekday = new Date(year, month, 1).getDay();
    const cells = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [calendarMonth]);

  const monthAttendanceByDay = useMemo(() => {
    const map = {};
    workerAttendance.forEach(a => { map[a.attendance_date] = a; });
    return map;
  }, [workerAttendance]);

  // Old months stay fully intact — this just filters the already-loaded full
  // history down to whichever month is currently in view; nothing is ever discarded.
  const monthSummary = useMemo(() => {
    const { year, month } = calendarMonth;
    const prefix = `${year}-${pad2(month + 1)}-`;
    const monthRows = workerAttendance.filter(a => a.attendance_date.startsWith(prefix));
    const headcount = isCrew ? (parseInt(selectedLabour?.crew_size, 10) || 1) : 1;
    const dailyRate = parseFloat(selectedLabour?.daily_wage) || 0;
    let presentDays = 0, absentDays = 0, halfDays = 0, totalShiftUnits = 0, totalWage = 0;
    monthRows.forEach(a => {
      const mult = getShiftMultiplier(a.status);
      totalShiftUnits += mult;
      totalWage += dailyRate * headcount * mult;
      if (a.status === 'A') absentDays += 1;
      else if (a.status === '½P') halfDays += 1;
      else presentDays += 1;
    });
    return { markedDays: monthRows.length, presentDays, absentDays, halfDays, totalShiftUnits, totalWage };
  }, [workerAttendance, calendarMonth, isCrew, selectedLabour]);

  const goToPrevMonth = () => setCalendarMonth(prev => (prev.month === 0 ? { year: prev.year - 1, month: 11 } : { year: prev.year, month: prev.month - 1 }));
  const goToNextMonth = () => setCalendarMonth(prev => (prev.month === 11 ? { year: prev.year + 1, month: 0 } : { year: prev.year, month: prev.month + 1 }));

  const filteredList = labourers.filter(l => {
    const matchesSearch =
      l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.skill_type && l.skill_type.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (l.group_name && l.group_name.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesTab = activeListTab === 'All' || l.labour_type === activeListTab;
    return matchesSearch && matchesTab;
  });

  
  // ---------- Selection ----------
  const selectLabourer = (lab) => {
    setSelectedLabourId(lab.id);
    setActiveWorkspaceTab('profile');
    resetAttendanceForm();
    resetPaymentForm();
    const d = new Date();
    setCalendarMonth({ year: d.getFullYear(), month: d.getMonth() });
  };

  const resetAttendanceForm = () => {
    setAttDate(todayStr());
    setAttCode('P');
  };

  const resetPaymentForm = () => {
    setPayAmount('');
    setPayDate(todayStr());
    setPayMode('Cash');
    setPayRemarks('');
  };

  // ---------- Labour Profile CRUD ----------
  const resetLabourForm = () => {
    setName('');
    setMobile('');
    setSkillType('');
    setLabourType('Individual');
    setGroupName('');
    setCrewSize(1);
    setDailyWage(0);
    setAadhaarNumber('');
    setBankDetails('');
    setEditingLabour(null);
    setIsEditing(false);
  };

  const openCreateModal = () => {
    resetLabourForm();
    setShowCreateModal(true);
  };

  const openEditModal = (lab) => {
    setEditingLabour(lab);
    setName(lab.name);
    setMobile(lab.mobile || '');
    setSkillType(lab.skill_type || '');
    setLabourType(lab.labour_type || 'Individual');
    setGroupName(lab.group_name || '');
    setCrewSize(lab.crew_size || 1);
    setDailyWage(lab.daily_wage || 0);
    setAadhaarNumber(lab.aadhaar_number || '');
    setBankDetails(lab.bank_details || '');
    setIsEditing(true);
    setShowCreateModal(true);
  };

  const handleSaveLabour = async (e) => {
    e.preventDefault();
    try {
      const newLabour = {
        name,
        mobile,
        skill_type: skillType || null,
        labour_type: labourType,
        group_name: labourType === 'Group Leader' ? groupName : null,
        crew_size: labourType === 'Group Leader' ? (parseInt(crewSize, 10) || 1) : null,
        daily_wage: parseFloat(dailyWage) || 0,
        aadhaar_number: aadhaarNumber,
        bank_details: bankDetails,
      };

      if (isEditing && editingLabour) {
        const { error } = await supabase.from('labour_master').update(newLabour).eq('id', editingLabour.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('labour_master').insert([newLabour]);
        if (error) throw error;
      }

      setShowCreateModal(false);
      resetLabourForm();
      fetchAll();
    } catch (err) {
      console.error('Save labour error:', err);
      alert('Failed to save labour profile.');
    }
  };

  const handleDeleteLabour = async (id) => {
    if (!window.confirm('Delete this labour record? This also removes their attendance and payment history.')) return;
    try {
      const { error } = await supabase.from('labour_master').delete().eq('id', id);
      if (error) throw error;
      if (selectedLabourId === id) setSelectedLabourId(null);
      fetchAll();
    } catch (err) {
      console.error('Delete labour error:', err);
      alert('Failed to delete labour record.');
    }
  };

  // ---------- Attendance CRUD ----------
  // Lightweight refresh used after a quick tap — reloads only attendance rows,
  // so a single tap on one card never flashes a full-page loading spinner
  // over a 200-person list.
  const refreshAttendance = async () => {
    try {
      const { data, error } = await supabase
        .from('labour_attendance')
        .select('*')
        .order('attendance_date', { ascending: false });
      if (error) throw error;
      setAllAttendance(data || []);
    } catch (err) {
      console.error('Error refreshing attendance:', err);
    }
  };

  // Tap-to-confirm: tapping a status (P / A / ½P / 2P / 3P) saves it immediately —
  // no separate "Log Attendance" step. We always write shift = 'Full Day': the
  // shift *code* itself carries the multi-shift meaning, so one row per labour
  // per day is enough, and for a Group Leader that one row represents the whole crew.
  // Used both by the list's roll-call buttons and the detail workspace's Attendance tab.
  const quickMarkAttendance = async (labourId, code, date) => {
    if (!labourId) return;
    const key = `${labourId}-${date}`;
    setSavingKey(key);
    setSavingAttendance(true);
    try {
      const row = {
        labour_id: labourId,
        attendance_date: date,
        shift: 'Full Day',
        status: code,
        working_hours: getShiftMultiplier(code) * 8,
        overtime_hours: 0,
      };
      const { error } = await supabase
        .from('labour_attendance')
        .upsert([row], { onConflict: 'labour_id,attendance_date,shift' });
      if (error) throw error;
      setAttCode(code);
      await refreshAttendance();
    } catch (err) {
      console.error('Error logging attendance:', err);
      alert('Failed to log attendance.');
    } finally {
      setSavingKey(null);
      setSavingAttendance(false);
    }
  };

  // "Clear" — wipes a mark for a given labour + date, reverting that day back to
  // the default Absent state. Used by both the list's roll-call row and the
  // detail workspace's Attendance tab.
  const quickClearAttendance = async (labourId, date) => {
    const mark = allAttendance.find(a => a.labour_id === labourId && a.attendance_date === date);
    if (!mark) return;
    const key = `${labourId}-${date}`;
    setSavingKey(key);
    setSavingAttendance(true);
    try {
      const { error } = await supabase.from('labour_attendance').delete().eq('id', mark.id);
      if (error) throw error;
      await refreshAttendance();
    } catch (err) {
      console.error('Error clearing attendance:', err);
      alert('Failed to clear attendance.');
    } finally {
      setSavingKey(null);
      setSavingAttendance(false);
    }
  };

  const handleClearAttendanceMark = () => quickClearAttendance(selectedLabourId, attDate);

  const handleDeleteAttendance = async (id) => {
    if (!window.confirm('Delete this attendance entry?')) return;
    try {
      const { error } = await supabase.from('labour_attendance').delete().eq('id', id);
      if (error) throw error;
      await refreshAttendance();
    } catch (err) {
      console.error('Error deleting attendance:', err);
    }
  };

  // Exports the SELECTED worker's full attendance history (all months, not just the
  // one currently shown in the calendar) — old data is never trimmed out of this.
  const exportAttendanceCSV = () => {
    if (!selectedLabour) return;
    const headcount = isCrew ? (parseInt(selectedLabour.crew_size, 10) || 1) : 1;
    const rows = [...workerAttendance]
      .sort((a, b) => a.attendance_date.localeCompare(b.attendance_date))
      .map(a => [
        csvDateText(a.attendance_date),
        a.status,
        getShiftLabel(a.status),
        ((parseFloat(selectedLabour.daily_wage) || 0) * headcount * getShiftMultiplier(a.status)).toFixed(2),
      ]);
    downloadCSV(`${selectedLabour.name.replace(/\s+/g, '_')}_attendance.csv`, ['Date', 'Code', 'Meaning', "Day's Wage"], rows);
  };

  // ---------- Payment CRUD ----------
  const handleAddPayment = async (e) => {
    e.preventDefault();
    if (!selectedLabourId) return;
    setSavingPayment(true);
    try {
      const row = {
        labour_id: selectedLabourId,
        amount_paid: parseFloat(payAmount) || 0,
        payment_mode: payMode,
        payment_date: payDate,
        remarks: payRemarks || (isCrew ? `Crew Payment: ${selectedLabour.name}` : `Wages: ${selectedLabour.name}`),
        is_group_payment: isCrew,
      };
      const { error } = await supabase.from('labour_payments').insert([row]);
      if (error) throw error;
      resetPaymentForm();
      fetchAll();
    } catch (err) {
      console.error('Error logging payment:', err);
      alert('Failed to log payment.');
    } finally {
      setSavingPayment(false);
    }
  };

  const handleDeletePayment = async (id) => {
    if (!window.confirm('Delete this payment entry?')) return;
    try {
      const { error } = await supabase.from('labour_payments').delete().eq('id', id);
      if (error) throw error;
      fetchAll();
    } catch (err) {
      console.error('Error deleting payment:', err);
    }
  };

  const exportPaymentsCSV = () => {
    if (!selectedLabour) return;
    const rows = [...workerPayments]
      .sort((a, b) => a.payment_date.localeCompare(b.payment_date))
      .map(p => [csvDateText(p.payment_date), (parseFloat(p.amount_paid) || 0).toFixed(2), p.payment_mode, p.remarks || '']);
    downloadCSV(`${selectedLabour.name.replace(/\s+/g, '_')}_payments.csv`, ['Date', 'Amount', 'Mode', 'Remarks'], rows);
  };

  // ---------- Render helpers ----------
  const typeBadgeClass = (type) => (type === 'Group Leader' ? 'labour-type-badge leader' : 'labour-type-badge single');
  const typeBadgeLabel = (type) => (type === 'Group Leader' ? 'Crew' : 'Single');

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <Header title="Labour Management" />

        <main className="gs-main">
          <div className="labour-workspace animate-fade">
            {/* ============ LEFT: List Pane ============ */}
            <div className={`labour-list-pane ${selectedLabourId ? 'has-selection' : ''}`}>
              <div className="labour-list-header">
                <div className="labour-search-box">
                  <Search size={19} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <input
                    type="text"
                    placeholder="Search by name, skill, or crew..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      className="labour-search-clear"
                      onClick={() => setSearchTerm('')}
                      aria-label="Clear search"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="labour-list-toolbar">
                  <div className="labour-filter-pills">
                    {['All', 'Individual', 'Group Leader'].map(tab => (
                      <button
                        key={tab}
                        className={`labour-filter-pill ${activeListTab === tab ? 'active' : ''}`}
                        onClick={() => setActiveListTab(tab)}
                      >
                        {tab === 'Group Leader' ? 'Crews' : tab}
                      </button>
                    ))}
                  </div>
                  <span className="labour-list-count">{filteredList.length} of {labourers.length}</span>
                </div>

                <button className="btn-primary labour-add-btn" onClick={openCreateModal}>
                  <Plus size={15} />
                  <span>Add Labour</span>
                </button>
              </div>

              <div className="labour-list-body">
                {loading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                    <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
                  </div>
                ) : filteredList.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', padding: '2rem 1rem' }}>
                    No labourers found.
                  </div>
                ) : (
                  filteredList.map(l => {
                    const mark = rollMarkMap[l.id];
                    const effectiveStatus = mark ? mark.status : 'A'; // defaults to Absent until explicitly tapped
                    const isCrewCard = l.labour_type === 'Group Leader';
                    const isBusy = savingKey === `${l.id}-${rollDate}`;
                    return (
                      <div
                        key={l.id}
                        className={`labour-list-item ${selectedLabourId === l.id ? 'selected' : ''}`}
                        onClick={() => selectLabourer(l)}
                      >
                        <div className="labour-list-item-top">
                          <div className="labour-list-item-main">
                            <div className="labour-list-item-name">
                              {isCrewCard ? <Users size={13} /> : <User size={13} />}
                              {l.name}
                            </div>
                            {isCrewCard && (
                              <div className="labour-list-item-group">
                                {l.group_name || 'Unnamed Crew'}
                              </div>
                            )}
                            <div className="labour-list-item-meta">
                              {l.skill_type || 'Helper'} · {formatCurrency(l.daily_wage)}/day
                              {isCrewCard && ` · ${l.crew_size || 1} worker${(l.crew_size || 1) > 1 ? 's' : ''}`}
                            </div>
                          </div>
                          <span className={typeBadgeClass(l.labour_type)}>{typeBadgeLabel(l.labour_type)}</span>
                        </div>

                        <div className="labour-rollcall-row" onClick={(e) => e.stopPropagation()}>
                          <span
                            className={`labour-today-dot ${SHIFT_CODES.find(s => s.code === effectiveStatus)?.tone || 'absent'} ${!mark ? 'implicit' : ''}`}
                            title={mark ? 'Confirmed' : 'Defaulting to Absent — not yet confirmed'}
                          >
                            {effectiveStatus}
                          </span>
                          <div className="labour-status-toggle-group sm">
                            {SHIFT_CODES.map(s => (
                              <button
                                type="button"
                                key={s.code}
                                title={`Mark ${formatDate(rollDate)}: ${s.label}`}
                                disabled={isBusy}
                                className={`labour-status-toggle ${s.tone} ${effectiveStatus === s.code ? 'active' : ''}`}
                                onClick={() => quickMarkAttendance(l.id, s.code, rollDate)}
                              >
                                {s.code}
                              </button>
                            ))}
                            <button
                              type="button"
                              title="Clear — revert to default Absent"
                              className="labour-status-toggle clear"
                              disabled={!mark || isBusy}
                              onClick={() => quickClearAttendance(l.id, rollDate)}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

            </div>

            {/* ============ RIGHT: Detail Workspace Pane ============ */}
            <div className={`labour-workspace-pane ${selectedLabour ? 'has-selection' : ''}`}>
              {!selectedLabour ? (
                <div className="labour-workspace-empty">
                  <ClipboardList size={36} style={{ opacity: 0.4 }} />
                  <p style={{ margin: 0, fontWeight: 600 }}>Select a labourer to view their workspace</p>
                  <p style={{ margin: 0, fontSize: '0.82rem' }}>Profile, attendance, and payment history will appear here.</p>
                </div>
              ) : (
                <>
                  <button type="button" className="labour-mobile-back" onClick={() => setSelectedLabourId(null)}>
                    <ChevronLeft size={16} />
                    <span>Back to list</span>
                  </button>
                  <div className="labour-workspace-header">
                    <div>
                      <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {selectedLabour.name}
                        <span className={typeBadgeClass(selectedLabour.labour_type)}>{typeBadgeLabel(selectedLabour.labour_type)}</span>
                      </h2>
                      <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {selectedLabour.skill_type || 'Helper'} · {selectedLabour.mobile || 'No mobile'}
                        {isCrew && ` · ${selectedLabour.group_name || 'Crew'} · ${selectedLabour.crew_size || 1} workers`}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {(activeWorkspaceTab === 'attendance' || activeWorkspaceTab === 'payments') && (
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: '0.4rem 0.7rem' }}
                          onClick={activeWorkspaceTab === 'attendance' ? exportAttendanceCSV : exportPaymentsCSV}
                          disabled={activeWorkspaceTab === 'attendance' ? workerAttendance.length === 0 : workerPayments.length === 0}
                          title="Export CSV"
                        >
                          <Download size={13} />
                          <span>Export CSV</span>
                        </button>
                      )}
                      <button className="btn-secondary" style={{ padding: '0.4rem 0.7rem' }} onClick={() => openEditModal(selectedLabour)}>
                        <Edit size={13} />
                      </button>
                      <button
                        className="btn-secondary"
                        style={{ padding: '0.4rem 0.7rem', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}
                        onClick={() => handleDeleteLabour(selectedLabour.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="labour-tabs">
                    <button className={`labour-tab ${activeWorkspaceTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveWorkspaceTab('profile')}>
                      Profile
                    </button>
                    <button className={`labour-tab ${activeWorkspaceTab === 'attendance' ? 'active' : ''}`} onClick={() => setActiveWorkspaceTab('attendance')}>
                      Attendance
                    </button>
                    <button className={`labour-tab ${activeWorkspaceTab === 'payments' ? 'active' : ''}`} onClick={() => setActiveWorkspaceTab('payments')}>
                      Payments
                    </button>
                  </div>

                  <div className="labour-tab-body">
                    {/* ---------- PROFILE TAB ---------- */}
                    {activeWorkspaceTab === 'profile' && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                        <ProfileField label="Mobile Number" value={selectedLabour.mobile || 'N/A'} />
                        <ProfileField label="Skill Domain" value={selectedLabour.skill_type || 'Helper'} />
                        <ProfileField label={isCrew ? 'Daily Wage (per worker)' : 'Daily Wage'} value={formatCurrency(selectedLabour.daily_wage)} />
                        <ProfileField label="Labour Type" value={isCrew ? 'Crew Leader' : 'Individual'} />
                        {isCrew && <ProfileField label="Crew / Group Name" value={selectedLabour.group_name || 'N/A'} />}
                        {isCrew && <ProfileField label="Crew Size" value={`${selectedLabour.crew_size || 1} workers`} />}
                        {isCrew && (
                          <ProfileField
                            label="Effective Daily Crew Cost"
                            value={formatCurrency((parseFloat(selectedLabour.daily_wage) || 0) * (parseInt(selectedLabour.crew_size, 10) || 1))}
                          />
                        )}
                        <ProfileField label="Aadhaar Number" value={selectedLabour.aadhaar_number || 'N/A'} />
                        <ProfileField label="Bank Details" value={selectedLabour.bank_details || 'N/A'} full />
                      </div>
                    )}

                    {/* ---------- ATTENDANCE TAB ---------- */}
                    {activeWorkspaceTab === 'attendance' && (
                      <>
                        {isCrew && (
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 0, marginBottom: '1rem' }}>
                            Marking attendance here applies to the whole crew ({selectedLabour.crew_size || 1} workers) for that day —
                            earnings are automatically calculated as daily wage × crew size × shift.
                          </p>
                        )}
                        <div className="labour-inline-form">
                          <div className="form-group">
                            <label>Date</label>
                            <input type="date" className="input-field" required value={attDate} onChange={(e) => setAttDate(e.target.value)} />
                          </div>
                          <div className="form-group">
                            <label>{isCrew ? 'Tap to confirm crew shift' : 'Tap to confirm shift'}</label>
                            <div className="labour-status-toggle-group">
                              {SHIFT_CODES.map(s => {
                                const isBusy = savingKey === `${selectedLabourId}-${attDate}`;
                                const effectiveStatus = attDateExistingMark ? attDateExistingMark.status : 'A';
                                return (
                                  <button
                                    type="button"
                                    key={s.code}
                                    title={s.label}
                                    disabled={isBusy}
                                    className={`labour-status-toggle ${s.tone} ${effectiveStatus === s.code ? 'active' : ''}`}
                                    onClick={() => quickMarkAttendance(selectedLabourId, s.code, attDate)}
                                  >
                                    {s.code}
                                  </button>
                                );
                              })}
                              <button
                                type="button"
                                title="Clear — revert to default Absent"
                                className="labour-status-toggle clear"
                                disabled={!attDateExistingMark || savingAttendance}
                                onClick={handleClearAttendanceMark}
                              >
                                <X size={13} />
                              </button>
                            </div>
                            <span className="labour-tap-hint">
                              {attDateExistingMark
                                ? `Marked ${getShiftLabel(attDateExistingMark.status)} for ${formatDate(attDate)}. Saved automatically.`
                                : `Defaulting to Absent for ${formatDate(attDate)} — tap a code above to confirm otherwise.`}
                            </span>
                          </div>
                        </div>

                        <div className="labour-calendar-card">
                          <div className="labour-calendar-header">
                            <button type="button" className="btn-secondary" style={{ padding: '0.35rem 0.5rem' }} onClick={goToPrevMonth}>
                              <ChevronLeft size={14} />
                            </button>
                            <span className="labour-calendar-month-label">{MONTH_NAMES[calendarMonth.month]} {calendarMonth.year}</span>
                            <button type="button" className="btn-secondary" style={{ padding: '0.35rem 0.5rem' }} onClick={goToNextMonth}>
                              <ChevronRight size={14} />
                            </button>
                          </div>

                          <div className="labour-calendar-summary">
                            <span><strong>{monthSummary.markedDays}</strong> days marked</span>
                            <span><strong>{monthSummary.totalShiftUnits}</strong> total shifts</span>
                            <span><strong>{monthSummary.absentDays}</strong> absent</span>
                            <span className="wage"><strong>{formatCurrency(monthSummary.totalWage)}</strong> {isCrew ? "crew's wage this month" : 'wage this month'}</span>
                          </div>

                          <div className="labour-calendar-grid">
                            {WEEKDAY_NAMES.map(w => <div key={w} className="labour-calendar-weekday">{w}</div>)}
                            {calendarDays.map((day, idx) => {
                              if (day === null) return <div key={`blank-${idx}`} className="labour-calendar-cell empty" />;
                              const key = dateKey(calendarMonth.year, calendarMonth.month, day);
                              const mark = monthAttendanceByDay[key];
                              const tone = mark ? (SHIFT_CODES.find(s => s.code === mark.status)?.tone || 'absent') : '';
                              const isToday = key === todayStr();
                              const isSelected = key === attDate;
                              return (
                                <button
                                  type="button"
                                  key={key}
                                  title={mark ? `${key}: ${getShiftLabel(mark.status)}` : key}
                                  className={`labour-calendar-cell ${tone} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                                  onClick={() => setAttDate(key)}
                                >
                                  <span className="day-num">{day}</span>
                                  {mark && <span className="day-code">{mark.status}</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div style={{ margin: '1.25rem 0 0.6rem' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)' }}>Full Attendance History</span>
                        </div>

                        <div className="labour-table-scroll">
                          <table className="app-table">
                            <thead>
                              <tr>
                                <th>Date</th>
                                <th>Code</th>
                                <th>Meaning</th>
                                <th>{isCrew ? "Crew's Day Wage" : "Day's Wage"}</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {workerAttendance.length === 0 ? (
                                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>No attendance logged yet.</td></tr>
                              ) : (
                                workerAttendance.map(a => {
                                  const headcount = isCrew ? (parseInt(selectedLabour.crew_size, 10) || 1) : 1;
                                  return (
                                    <tr key={a.id}>
                                      <td>{formatDate(a.attendance_date)}</td>
                                      <td>
                                        <span className={`labour-status-toggle ${SHIFT_CODES.find(s => s.code === a.status)?.tone || 'absent'} active`} style={{ cursor: 'default' }}>
                                          {a.status}
                                        </span>
                                      </td>
                                      <td>{getShiftLabel(a.status)}</td>
                                      <td>{formatCurrency((parseFloat(selectedLabour.daily_wage) || 0) * headcount * getShiftMultiplier(a.status))}</td>
                                      <td style={{ textAlign: 'right' }}>
                                        <button
                                          className="btn-secondary"
                                          style={{ padding: '0.3rem', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}
                                          onClick={() => handleDeleteAttendance(a.id)}
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}

                    {/* ---------- PAYMENTS TAB ---------- */}
                    {activeWorkspaceTab === 'payments' && workerStats && (
                      <>
                        {isCrew && (
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 0, marginBottom: '1rem' }}>
                            These figures cover the entire crew of {selectedLabour.crew_size || 1} workers. Payments are logged once,
                            as a lump sum to the crew leader.
                          </p>
                        )}
                        <div className="labour-financial-row">
                          <div className="labour-financial-card paid">
                            <span className="label">{isCrew ? 'Crew Paid' : 'Paid'}</span>
                            <span className="value">{formatCurrency(workerMonthlyStats?.currentMonthPaid || 0)}</span>
                          </div>
                          <div className={`labour-financial-card due ${(workerMonthlyStats?.currentMonthOutstanding || 0) > 0 ? 'balance-positive' : 'balance-clear'}`}>
                            <span className="label">{isCrew ? 'Crew Outstanding' : 'Outstanding'}</span>
                            <span className="value">{formatCurrency(workerMonthlyStats?.currentMonthOutstanding || 0)}</span>
                          </div>
                        </div>

                        <form className="labour-inline-form" onSubmit={handleAddPayment}>
                          <div className="form-group">
                            <label>Amount (₹)</label>
                            <input type="number" className="input-field" required min="1" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                          </div>
                          <div className="form-group">
                            <label>Date</label>
                            <input type="date" className="input-field" required value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                          </div>
                          <div className="form-group">
                            <label>Mode</label>
                            <select className="input-field" value={payMode} onChange={(e) => setPayMode(e.target.value)}>
                              <option value="Cash">Cash</option>
                              <option value="UPI">UPI</option>
                              <option value="Bank Transfer">Bank Transfer</option>
                            </select>
                          </div>
                          <div className="form-group" style={{ flex: 2, minWidth: '180px' }}>
                            <label>Remarks</label>
                            <input type="text" className="input-field" value={payRemarks} onChange={(e) => setPayRemarks(e.target.value)} placeholder="Optional note" />
                          </div>
                          <button type="submit" className="btn-primary" disabled={savingPayment}>
                            {savingPayment ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Wallet size={14} />}
                            <span>Log Payment</span>
                          </button>
                        </form>

                        <div style={{ margin: '1.25rem 0 0.6rem' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)' }}>Payment History</span>
                        </div>

                        <div className="labour-table-scroll">
                          <table className="app-table">
                            <thead>
                              <tr>
                                <th>Date</th>
                                <th>Amount</th>
                                <th>Mode</th>
                                <th>Remarks</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {workerPayments.length === 0 ? (
                                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>No payments logged yet.</td></tr>
                              ) : (
                                workerPayments.map(p => (
                                  <tr key={p.id}>
                                    <td>{formatDate(p.payment_date)}</td>
                                    <td style={{ color: '#10b981', fontWeight: 600 }}>+{formatCurrency(p.amount_paid)}</td>
                                    <td>{p.payment_mode}</td>
                                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.remarks || '—'}</td>
                                    <td style={{ textAlign: 'right' }}>
                                      <button
                                        className="btn-secondary"
                                        style={{ padding: '0.3rem', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}
                                        onClick={() => handleDeletePayment(p.id)}
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ============ Add / Edit Labour Modal ============ */}
          {showCreateModal && (
            <div className="modal-overlay">
              <div className="modal-content">
                <div className="modal-header">
                  <h3 style={{ margin: 0 }}>{isEditing ? 'Edit Labour Profile' : 'Add Labour Profile'}</h3>
                  <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}>
                    <X size={18} />
                  </button>
                </div>
                <form onSubmit={handleSaveLabour}>
                  <div className="modal-body">
                    <div className="form-group">
                      <label>Labour Full Name *</label>
                      <input type="text" className="input-field" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ramesh Kumar" />
                    </div>

                    <div className="form-grid">
                      <div className="form-group">
                        <label>Mobile Number</label>
                        <input type="text" className="input-field" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="e.g. 9876543210" />
                      </div>
                      <div className="form-group">
                        <label>Skill Classification</label>
                        <select className="input-field" value={skillType} onChange={(e) => setSkillType(e.target.value)}>
                          <option value="">Select skill</option>
                          {SKILL_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="form-grid">
                      <div className="form-group">
                        <label>Labour Type *</label>
                        <select className="input-field" value={labourType} onChange={(e) => setLabourType(e.target.value)}>
                          <option value="Individual">Single Independent Worker</option>
                          <option value="Group Leader">Crew Leader (Paid for Whole Crew)</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Daily Wage Rate (₹) *{labourType === 'Group Leader' ? ' — per worker' : ''}</label>
                        <input type="number" className="input-field" required min="0" value={dailyWage} onChange={(e) => setDailyWage(e.target.value)} />
                      </div>
                    </div>

                    {labourType === 'Group Leader' && (
                      <div className="form-grid animate-fade" style={{ background: 'var(--primary-subtle)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <div className="form-group">
                          <label>Crew / Group Name *</label>
                          <input type="text" className="input-field" required value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="e.g. Ramesh Decor Crew" />
                        </div>
                        <div className="form-group">
                          <label>Crew Size (number of workers) *</label>
                          <input type="number" className="input-field" required min="1" value={crewSize} onChange={(e) => setCrewSize(e.target.value)} />
                        </div>
                      </div>
                    )}

                    <div className="form-group">
                      <label>Aadhaar Card Number</label>
                      <input type="text" className="input-field" value={aadhaarNumber} onChange={(e) => setAadhaarNumber(e.target.value)} placeholder="e.g. 1234-5678-9012" />
                    </div>

                    <div className="form-group">
                      <label>Bank Account Details</label>
                      <textarea className="input-field" rows="2" value={bankDetails} onChange={(e) => setBankDetails(e.target.value)} placeholder="A/C: 1234567890 | IFSC: SBIN0001234 | State Bank of India" />
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                    <button type="submit" className="btn-primary">Save Profile</button>
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

function ProfileField({ label, value, full }) {
  return (
    <div style={{ gridColumn: full ? '1 / -1' : 'auto' }}>
      <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
        {label}
      </span>
      <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{value}</span>
    </div>
  );
}