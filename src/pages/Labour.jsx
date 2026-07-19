import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import {
  Plus, Search, Edit, Trash2, X, Loader2, Users, User,
  Wallet, ClipboardList, ChevronLeft, ChevronRight, Download, UserPlus, Check, UserX
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

const formatCompactAmount = (amount) => {
  const n = Number(amount) || 0;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1).replace(/\.0$/, '')}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `₹${Math.round(n)}`;
};

export default function Labour() {
  const [labourers, setLabourers] = useState([]);
  const [allAttendance, setAllAttendance] = useState([]);
  const [allPayments, setAllPayments] = useState([]);
  const [crewMembers, setCrewMembers] = useState([]);
  const [crewAttendance, setCrewAttendance] = useState([]);
  const [memberPayments, setMemberPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeListTab, setActiveListTab] = useState('All'); 
  const [selectedLabourId, setSelectedLabourId] = useState(null);

  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState('profile'); 

  const [attDate, setAttDate] = useState(todayStr());
  const [attCode, setAttCode] = useState('P');
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [savingKey, setSavingKey] = useState(null);
  const [savingMemberKey, setSavingMemberKey] = useState(null);
  const [rollDate, setRollDate] = useState(todayStr());
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  // ---------- Crew day popup (per-member attendance) ----------
  const [showMemberPopup, setShowMemberPopup] = useState(false);
  const [popupDate, setPopupDate] = useState(null);

  // ---------- Crew Members tab ----------
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberMobile, setNewMemberMobile] = useState('');
  const [savingMember, setSavingMember] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState(null);
  const [editMemberName, setEditMemberName] = useState('');
  const [editMemberMobile, setEditMemberMobile] = useState('');

  // ---------- Per-member payments ----------
  const [payingMemberId, setPayingMemberId] = useState(null);
  const [memberPayAmount, setMemberPayAmount] = useState('');
  const [memberPayDate, setMemberPayDate] = useState(todayStr());
  const [memberPayMode, setMemberPayMode] = useState('Cash');
  const [memberPayRemarks, setMemberPayRemarks] = useState('');
  const [savingMemberPayment, setSavingMemberPayment] = useState(false);

  // ---------- Add-crew modal: initial member names ----------
  const [newCrewMemberNames, setNewCrewMemberNames] = useState(['']);

  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(todayStr());
  const [payMode, setPayMode] = useState('Cash');
  const [payRemarks, setPayRemarks] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);
  const [showAllMonths, setShowAllMonths] = useState(false);

  // ---------- Add / Edit Labour modal ----------
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingLabour, setEditingLabour] = useState(null);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [skillType, setSkillType] = useState('');
  const [labourType, setLabourType] = useState('Individual');
  const [groupName, setGroupName] = useState('');
  const [dailyWage, setDailyWage] = useState(0);
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [bankName, setBankName] = useState('');

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [
        { data: labs, error: labErr },
        { data: atts, error: attErr },
        { data: pmts, error: pmtErr },
        { data: members, error: memErr },
        { data: crewAtts, error: crewAttErr },
        { data: memberPmts, error: memberPmtErr },
      ] = await Promise.all([
          supabase.from('labour_master').select('*').order('name', { ascending: true }),
          supabase.from('labour_attendance').select('*').order('attendance_date', { ascending: false }),
          supabase.from('labour_payments').select('*').order('payment_date', { ascending: false }),
          supabase.from('labour_crew_members').select('*').order('name', { ascending: true }),
          supabase.from('labour_crew_attendance').select('*').order('attendance_date', { ascending: false }),
          supabase.from('labour_member_payments').select('*').order('payment_date', { ascending: false }),
        ]);
      if (labErr) throw labErr;
      if (attErr) throw attErr;
      if (pmtErr) throw pmtErr;
      if (memErr) throw memErr;
      if (crewAttErr) throw crewAttErr;
      if (memberPmtErr) throw memberPmtErr;

      // Individuals only (fix #1) — crews never write to labour_attendance.
      let attendanceRows = atts || [];
      const individualLabs = (labs || []).filter(l => l.labour_type !== 'Group Leader');
      const filledYesterday = await autoMarkYesterdayAbsent(individualLabs, attendanceRows);
      if (filledYesterday.length > 0) attendanceRows = [...attendanceRows, ...filledYesterday];

      let crewAttendanceRows = crewAtts || [];
      const filledCrewYesterday = await autoMarkYesterdayAbsentCrew(members || [], crewAttendanceRows);
      if (filledCrewYesterday.length > 0) crewAttendanceRows = [...crewAttendanceRows, ...filledCrewYesterday];

      setLabourers(labs || []);
      setAllAttendance(attendanceRows);
      setAllPayments(pmts || []);
      setCrewMembers(members || []);
      setCrewAttendance(crewAttendanceRows);
      setMemberPayments(memberPmts || []);
    } catch (err) {
      console.error('Error loading labour data:', err);
    } finally {
      setLoading(false);
    }
  };
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

  const autoMarkYesterdayAbsentCrew = async (members, existingCrewAttendance) => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const yesterday = y.toISOString().split('T')[0];

    const missing = (members || []).filter(m => {
      if (m.active === false) return false;
      const alreadyMarked = existingCrewAttendance.some(a => a.member_id === m.id && a.attendance_date === yesterday);
      const existedByYesterday = !m.created_at || m.created_at.split('T')[0] <= yesterday;
      return !alreadyMarked && existedByYesterday;
    });
    if (missing.length === 0) return [];

    const fillRows = missing.map(m => ({
      member_id: m.id,
      labour_id: m.labour_id,
      attendance_date: yesterday,
      status: 'A',
    }));

    try {
      const { data: inserted, error } = await supabase
        .from('labour_crew_attendance')
        .upsert(fillRows, { onConflict: 'member_id,attendance_date' })
        .select();
      if (error) throw error;
      return inserted || [];
    } catch (err) {
      console.error('Crew auto-absent fill error:', err);
      return [];
    }
  };

  const earningsMap = useMemo(() => {
    const map = {};
    labourers.forEach(l => {
      map[l.id] = { earned: 0, paid: 0, balance: 0 };
    });

    // Individuals only — crews never write to labour_attendance anymore (fix #1).
    allAttendance.forEach(a => {
      const lab = labourers.find(l => l.id === a.labour_id);
      if (!lab || !map[a.labour_id] || lab.labour_type === 'Group Leader') return;
      const dailyRate = parseFloat(lab.daily_wage) || 0;
      map[a.labour_id].earned += dailyRate * getShiftMultiplier(a.status);
    });

    // Crews only — per-member attendance is the single source of truth for crew earnings.
    crewAttendance.forEach(a => {
      const lab = labourers.find(l => l.id === a.labour_id);
      if (!lab || !map[a.labour_id]) return;
      const dailyRate = parseFloat(lab.daily_wage) || 0;
      map[a.labour_id].earned += dailyRate * getShiftMultiplier(a.status);
    });

    allPayments.forEach(p => {
      if (map[p.labour_id]) {
        map[p.labour_id].paid += parseFloat(p.amount_paid) || 0;
      }
    });

    // Per-member payments also count toward the crew's total paid (fix #3).
    memberPayments.forEach(p => {
      if (map[p.labour_id]) {
        map[p.labour_id].paid += parseFloat(p.amount_paid) || 0;
      }
    });

    Object.keys(map).forEach(id => {
      map[id].balance = map[id].earned - map[id].paid;
    });

    return map;
  }, [labourers, allAttendance, allPayments, crewAttendance, memberPayments]);

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
  const selectedCrewMembers = useMemo(
    () => crewMembers.filter(m => m.labour_id === selectedLabourId),
    [crewMembers, selectedLabourId]
  );
  const activeCrewMembers = useMemo(
    () => selectedCrewMembers.filter(m => m.active !== false),
    [selectedCrewMembers]
  );
  const selectedCrewAttendance = useMemo(
    () => crewAttendance.filter(a => a.labour_id === selectedLabourId),
    [crewAttendance, selectedLabourId]
  );
  const crewMemberById = useMemo(() => {
    const map = {};
    selectedCrewMembers.forEach(m => { map[m.id] = m; });
    return map;
  }, [selectedCrewMembers]);
  const selectedMemberPayments = useMemo(
    () => memberPayments.filter(p => p.labour_id === selectedLabourId),
    [memberPayments, selectedLabourId]
  );
  const memberPaidTotals = useMemo(() => {
    const map = {};
    selectedMemberPayments.forEach(p => {
      map[p.member_id] = (map[p.member_id] || 0) + (parseFloat(p.amount_paid) || 0);
    });
    return map;
  }, [selectedMemberPayments]);
  // Merges crew-level lump-sum payments with per-member payments (logged from the
  // Members tab) into one list for the Payments tab history table.
  const combinedPayments = useMemo(() => {
    const lump = workerPayments.map(p => ({ ...p, memberName: null }));
    const memberRows = isCrew
      ? selectedMemberPayments.map(p => ({ ...p, memberName: crewMemberById[p.member_id]?.name || 'Removed member' }))
      : [];
    return [...lump, ...memberRows].sort((a, b) => b.payment_date.localeCompare(a.payment_date));
  }, [workerPayments, selectedMemberPayments, isCrew, crewMemberById]);
  const workerStats = selectedLabourId ? (earningsMap[selectedLabourId] || { earned: 0, paid: 0, balance: 0 }) : null;

  // Month-by-month breakdown so old unpaid months don't disappear behind a single
  // lifetime number — shows exactly which month(s) still have money owed.
  const monthlyLedger = useMemo(() => {
    if (!selectedLabour) return [];
    const dailyRate = parseFloat(selectedLabour.daily_wage) || 0;
    const earnedByMonth = {};
    const paidByMonth = {};

    const attendanceRows = isCrew ? selectedCrewAttendance : workerAttendance;
    attendanceRows.forEach(a => {
      const key = a.attendance_date.slice(0, 7); // YYYY-MM
      earnedByMonth[key] = (earnedByMonth[key] || 0) + dailyRate * getShiftMultiplier(a.status);
    });

    workerPayments.forEach(p => {
      const key = p.payment_date.slice(0, 7);
      paidByMonth[key] = (paidByMonth[key] || 0) + (parseFloat(p.amount_paid) || 0);
    });
    if (isCrew) {
      selectedMemberPayments.forEach(p => {
        const key = p.payment_date.slice(0, 7);
        paidByMonth[key] = (paidByMonth[key] || 0) + (parseFloat(p.amount_paid) || 0);
      });
    }

    const allKeys = Array.from(new Set([...Object.keys(earnedByMonth), ...Object.keys(paidByMonth)])).sort();

    let running = 0;
    const rows = allKeys.map(key => {
      const earned = earnedByMonth[key] || 0;
      const paid = paidByMonth[key] || 0;
      running += earned - paid;
      const [y, m] = key.split('-').map(Number);
      return {
        key,
        label: `${MONTH_NAMES[m - 1]} ${y}`,
        earned,
        paid,
        monthBalance: earned - paid,
        runningBalance: running,
      };
    });

    return rows.reverse(); // most recent month first
  }, [selectedLabour, isCrew, selectedCrewAttendance, workerAttendance, workerPayments, selectedMemberPayments]);

  const workerMonthlyStats = useMemo(() => {
    if (!selectedLabourId || !selectedLabour) return null;
    const now = new Date();
    const currentMonthStartKey = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-01`;
    const currentMonthLabel = MONTH_NAMES[now.getMonth()];

    const dailyRate = parseFloat(selectedLabour.daily_wage) || 0;

    let currentMonthEarned = 0, currentMonthPaid = 0;

    if (isCrew) {
      selectedCrewAttendance.forEach(a => {
        if (a.attendance_date >= currentMonthStartKey) {
          currentMonthEarned += dailyRate * getShiftMultiplier(a.status);
        }
      });
    } else {
      workerAttendance.forEach(a => {
        if (a.attendance_date >= currentMonthStartKey) {
          currentMonthEarned += dailyRate * getShiftMultiplier(a.status);
        }
      });
    }

    workerPayments.forEach(p => {
      if (p.payment_date >= currentMonthStartKey) currentMonthPaid += (parseFloat(p.amount_paid) || 0);
    });
    if (isCrew) {
      selectedMemberPayments.forEach(p => {
        if (p.payment_date >= currentMonthStartKey) currentMonthPaid += (parseFloat(p.amount_paid) || 0);
      });
    }

    return {
      currentMonthLabel,
      currentMonthPaid,
      currentMonthOutstanding: currentMonthEarned - currentMonthPaid,
    };
  }, [selectedLabourId, selectedLabour, isCrew, workerAttendance, workerPayments, selectedCrewAttendance, selectedMemberPayments]);

  const attDateExistingMark = useMemo(
    () => workerAttendance.find(a => a.attendance_date === attDate) || null,
    [workerAttendance, attDate]
  );

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

  // For crews: group each date's per-member marks together so the calendar cell
  // can show "3/5" style aggregates and the day popup can list everyone at once.
  const crewMonthAttendanceByDay = useMemo(() => {
    const map = {};
    selectedCrewAttendance.forEach(a => {
      if (!map[a.attendance_date]) map[a.attendance_date] = [];
      map[a.attendance_date].push(a);
    });
    return map;
  }, [selectedCrewAttendance]);

  const monthPaymentsByDay = useMemo(() => {
    const map = {};
    workerPayments.forEach(p => {
      const amt = parseFloat(p.amount_paid) || 0;
      map[p.payment_date] = (map[p.payment_date] || 0) + amt;
    });
    return map;
  }, [workerPayments]);

  const monthSummary = useMemo(() => {
    const { year, month } = calendarMonth;
    const prefix = `${year}-${pad2(month + 1)}-`;
    const dailyRate = parseFloat(selectedLabour?.daily_wage) || 0;

    if (isCrew) {
      const monthRows = selectedCrewAttendance.filter(a => a.attendance_date.startsWith(prefix));
      let presentDays = 0, absentDays = 0, halfDays = 0, totalShiftUnits = 0, totalWage = 0;
      monthRows.forEach(a => {
        const mult = getShiftMultiplier(a.status);
        totalShiftUnits += mult;
        totalWage += dailyRate * mult;
        if (a.status === 'A') absentDays += 1;
        else if (a.status === '1/2') halfDays += 1;
        else presentDays += 1;
      });
      return { markedDays: monthRows.length, presentDays, absentDays, halfDays, totalShiftUnits, totalWage };
    }

    const monthRows = workerAttendance.filter(a => a.attendance_date.startsWith(prefix));
    let presentDays = 0, absentDays = 0, halfDays = 0, totalShiftUnits = 0, totalWage = 0;
    monthRows.forEach(a => {
      const mult = getShiftMultiplier(a.status);
      totalShiftUnits += mult;
      totalWage += dailyRate * mult;
      if (a.status === 'A') absentDays += 1;
      else if (a.status === '1/2') halfDays += 1;
      else presentDays += 1;
    });
    return { markedDays: monthRows.length, presentDays, absentDays, halfDays, totalShiftUnits, totalWage };
  }, [workerAttendance, selectedCrewAttendance, calendarMonth, isCrew, selectedLabour]);

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

  
  const getActiveMemberCount = (labourId) =>
    crewMembers.filter(m => m.labour_id === labourId && m.active !== false).length;

  const crewRollSummary = (labourId) => {
    const members = crewMembers.filter(m => m.labour_id === labourId && m.active !== false);
    const marked = members.filter(m => crewAttendance.some(a => a.member_id === m.id && a.attendance_date === rollDate));
    const present = marked.filter(m => {
      const mark = crewAttendance.find(a => a.member_id === m.id && a.attendance_date === rollDate);
      return mark && mark.status !== 'A';
    });
    return { total: members.length, marked: marked.length, present: present.length };
  };

  // ---------- Selection ----------
  const selectLabourer = (lab) => {
    setSelectedLabourId(lab.id);
    setActiveWorkspaceTab('profile');
    resetAttendanceForm();
    resetPaymentForm();
    resetMemberForm();
    setShowAllMonths(false);
    const d = new Date();
    setCalendarMonth({ year: d.getFullYear(), month: d.getMonth() });
  };

  const resetMemberForm = () => {
    setNewMemberName('');
    setNewMemberMobile('');
    setEditingMemberId(null);
    setEditMemberName('');
    setEditMemberMobile('');
    setPayingMemberId(null);
    setMemberPayAmount('');
    setMemberPayRemarks('');
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

  const resetLabourForm = () => {
    setName('');
    setMobile('');
    setSkillType('');
    setLabourType('Individual');
    setGroupName('');
    setDailyWage(0);
    setAadhaarNumber('');
    setBankAccountNumber('');
    setIfscCode('');
    setBankName('');
    setEditingLabour(null);
    setIsEditing(false);
    setNewCrewMemberNames(['']);
  };

  const updateCrewMemberNameField = (idx, value) => {
    setNewCrewMemberNames(prev => prev.map((v, i) => (i === idx ? value : v)));
  };
  const addCrewMemberNameField = () => setNewCrewMemberNames(prev => [...prev, '']);
  const removeCrewMemberNameField = (idx) => {
    setNewCrewMemberNames(prev => (prev.length === 1 ? [''] : prev.filter((_, i) => i !== idx)));
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
    setDailyWage(lab.daily_wage || 0);
    setAadhaarNumber(lab.aadhaar_number || '');
    setBankAccountNumber(lab.bank_account_number || '');
    setIfscCode(lab.ifsc_code || '');
    setBankName(lab.bank_name || '');
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
        daily_wage: parseFloat(dailyWage) || 0,
        aadhaar_number: aadhaarNumber,
        bank_account_number: bankAccountNumber,
        ifsc_code: ifscCode,
        bank_name: bankName,
      };

      if (isEditing && editingLabour) {
        const { error } = await supabase.from('labour_master').update(newLabour).eq('id', editingLabour.id);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase.from('labour_master').insert([newLabour]).select();
        if (error) throw error;
        const newId = inserted && inserted[0] && inserted[0].id;
        if (newId && labourType === 'Group Leader') {
          const memberRows = newCrewMemberNames
            .map(n => n.trim())
            .filter(Boolean)
            .map(n => ({ labour_id: newId, name: n }));
          if (memberRows.length > 0) {
            const { error: memErr } = await supabase.from('labour_crew_members').insert(memberRows);
            if (memErr) throw memErr;
          }
        }
      }

      setShowCreateModal(false);
      resetLabourForm();
      fetchAll();
    } catch (err) {
      console.error('Save labour error:', err);
      alert(`Failed to save labour profile.\n\n${err?.message || 'Unknown error'}${err?.details ? `\n${err.details}` : ''}${err?.hint ? `\nHint: ${err.hint}` : ''}`);
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
      alert(`Failed to delete labour record.\n\n${err?.message || 'Unknown error'}`);
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
      alert(`Failed to log attendance.\n\n${err?.message || 'Unknown error'}`);
    } finally {
      setSavingKey(null);
      setSavingAttendance(false);
    }
  };

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
      alert(`Failed to clear attendance.\n\n${err?.message || 'Unknown error'}`);
    } finally {
      setSavingKey(null);
      setSavingAttendance(false);
    }
  };

  const handleClearAttendanceMark = () => quickClearAttendance(selectedLabourId, attDate);

  // ---------- Crew per-member attendance CRUD ----------
  const refreshCrewAttendance = async () => {
    try {
      const { data, error } = await supabase
        .from('labour_crew_attendance')
        .select('*')
        .order('attendance_date', { ascending: false });
      if (error) throw error;
      setCrewAttendance(data || []);
    } catch (err) {
      console.error('Error refreshing crew attendance:', err);
    }
  };

  const quickMarkCrewAttendance = async (memberId, labourId, code, date) => {
    if (!memberId) return;
    const key = `cm-${memberId}-${date}`;
    setSavingMemberKey(key);
    try {
      const row = { member_id: memberId, labour_id: labourId, attendance_date: date, status: code };
      const { error } = await supabase
        .from('labour_crew_attendance')
        .upsert([row], { onConflict: 'member_id,attendance_date' });
      if (error) throw error;
      await refreshCrewAttendance();
    } catch (err) {
      console.error('Error logging crew attendance:', err);
      alert(`Failed to log attendance.\n\n${err?.message || 'Unknown error'}`);
    } finally {
      setSavingMemberKey(null);
    }
  };

  const quickClearCrewAttendance = async (memberId, date) => {
    const mark = crewAttendance.find(a => a.member_id === memberId && a.attendance_date === date);
    if (!mark) return;
    const key = `cm-${memberId}-${date}`;
    setSavingMemberKey(key);
    try {
      const { error } = await supabase.from('labour_crew_attendance').delete().eq('id', mark.id);
      if (error) throw error;
      await refreshCrewAttendance();
    } catch (err) {
      console.error('Error clearing crew attendance:', err);
      alert(`Failed to clear attendance.\n\n${err?.message || 'Unknown error'}`);
    } finally {
      setSavingMemberKey(null);
    }
  };

  const markAllMembersForDate = async (code, date) => {
    if (!activeCrewMembers.length || !selectedLabourId) return;
    setSavingAttendance(true);
    try {
      const rows = activeCrewMembers.map(m => ({
        member_id: m.id,
        labour_id: selectedLabourId,
        attendance_date: date,
        status: code,
      }));
      const { error } = await supabase
        .from('labour_crew_attendance')
        .upsert(rows, { onConflict: 'member_id,attendance_date' });
      if (error) throw error;
      await refreshCrewAttendance();
    } catch (err) {
      console.error('Error bulk-marking crew attendance:', err);
      alert(`Failed to mark attendance for the crew.\n\n${err?.message || 'Unknown error'}`);
    } finally {
      setSavingAttendance(false);
    }
  };

  const openMemberPopupForDate = (date) => {
    setPopupDate(date);
    setShowMemberPopup(true);
  };

  // ---------- Crew Members CRUD ----------
  const refreshMembers = async () => {
    try {
      const { data, error } = await supabase.from('labour_crew_members').select('*').order('name', { ascending: true });
      if (error) throw error;
      setCrewMembers(data || []);
    } catch (err) {
      console.error('Error refreshing crew members:', err);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!selectedLabourId || !newMemberName.trim()) return;
    setSavingMember(true);
    try {
      const row = { labour_id: selectedLabourId, name: newMemberName.trim(), mobile: newMemberMobile.trim() || null };
      const { error } = await supabase.from('labour_crew_members').insert([row]);
      if (error) throw error;
      setNewMemberName('');
      setNewMemberMobile('');
      await refreshMembers();
    } catch (err) {
      console.error('Error adding crew member:', err);
      alert(`Failed to add crew member.\n\n${err?.message || 'Unknown error'}`);
    } finally {
      setSavingMember(false);
    }
  };

  const startEditMember = (m) => {
    setEditingMemberId(m.id);
    setEditMemberName(m.name);
    setEditMemberMobile(m.mobile || '');
  };

  const cancelEditMember = () => {
    setEditingMemberId(null);
    setEditMemberName('');
    setEditMemberMobile('');
  };

  const saveEditMember = async (id) => {
    if (!editMemberName.trim()) return;
    try {
      const { error } = await supabase
        .from('labour_crew_members')
        .update({ name: editMemberName.trim(), mobile: editMemberMobile.trim() || null })
        .eq('id', id);
      if (error) throw error;
      cancelEditMember();
      await refreshMembers();
    } catch (err) {
      console.error('Error updating crew member:', err);
      alert(`Failed to update crew member.\n\n${err?.message || 'Unknown error'}`);
    }
  };

  const handleDeactivateMember = async (id) => {
    if (!window.confirm('Remove this member from the active crew? Their attendance and payment history is kept, and they can be reactivated later.')) return;
    try {
      const { error } = await supabase.from('labour_crew_members').update({ active: false }).eq('id', id);
      if (error) throw error;
      await refreshMembers();
    } catch (err) {
      console.error('Error deactivating crew member:', err);
      alert(`Failed to remove crew member.\n\n${err?.message || 'Unknown error'}`);
    }
  };

  const handleReactivateMember = async (id) => {
    try {
      const { error } = await supabase.from('labour_crew_members').update({ active: true }).eq('id', id);
      if (error) throw error;
      await refreshMembers();
    } catch (err) {
      console.error('Error reactivating crew member:', err);
      alert(`Failed to reactivate crew member.\n\n${err?.message || 'Unknown error'}`);
    }
  };

  const handleDeleteMemberPermanently = async (id, name) => {
    if (!window.confirm(
      `Permanently delete ${name}? This will also erase ALL of their attendance and payment history for this crew. This cannot be undone.\n\nIf you just want them off the active crew but keep their history, use Deactivate instead.`
    )) return;
    try {
      const { error } = await supabase.from('labour_crew_members').delete().eq('id', id);
      if (error) throw error;
      await refreshMembers();
      await refreshCrewAttendance();
      await refreshMemberPayments();
    } catch (err) {
      console.error('Error deleting crew member:', err);
      alert(`Failed to delete crew member.\n\n${err?.message || 'Unknown error'}`);
    }
  };

  // ---------- Per-member payments (fix #3) ----------
  const refreshMemberPayments = async () => {
    try {
      const { data, error } = await supabase.from('labour_member_payments').select('*').order('payment_date', { ascending: false });
      if (error) throw error;
      setMemberPayments(data || []);
    } catch (err) {
      console.error('Error refreshing member payments:', err);
    }
  };

  const openMemberPaymentForm = (memberId) => {
    setPayingMemberId(memberId);
    setMemberPayAmount('');
    setMemberPayDate(todayStr());
    setMemberPayMode('Cash');
    setMemberPayRemarks('');
  };

  const cancelMemberPaymentForm = () => {
    setPayingMemberId(null);
    setMemberPayAmount('');
    setMemberPayRemarks('');
  };

  const handleAddMemberPayment = async (e, memberId, labourId) => {
    e.preventDefault();
    const amt = parseFloat(memberPayAmount);
    if (!amt || amt <= 0) return;
    setSavingMemberPayment(true);
    try {
      const row = {
        member_id: memberId,
        labour_id: labourId,
        amount_paid: amt,
        payment_date: memberPayDate,
        payment_mode: memberPayMode,
        remarks: memberPayRemarks || null,
      };
      const { error } = await supabase.from('labour_member_payments').insert([row]);
      if (error) throw error;
      cancelMemberPaymentForm();
      await refreshMemberPayments();
    } catch (err) {
      console.error('Error logging member payment:', err);
      alert(`Failed to log payment.\n\n${err?.message || 'Unknown error'}`);
    } finally {
      setSavingMemberPayment(false);
    }
  };

  const handleDeleteMemberPayment = async (id) => {
    if (!window.confirm('Delete this payment entry?')) return;
    try {
      const { error } = await supabase.from('labour_member_payments').delete().eq('id', id);
      if (error) throw error;
      await refreshMemberPayments();
    } catch (err) {
      console.error('Error deleting member payment:', err);
    }
  };

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

  const handleDeleteCrewAttendance = async (id) => {
    if (!window.confirm('Delete this attendance entry?')) return;
    try {
      const { error } = await supabase.from('labour_crew_attendance').delete().eq('id', id);
      if (error) throw error;
      await refreshCrewAttendance();
    } catch (err) {
      console.error('Error deleting crew attendance:', err);
    }
  };

  const exportAttendanceCSV = () => {
    if (!selectedLabour) return;
    if (isCrew) {
      const dailyRate = parseFloat(selectedLabour.daily_wage) || 0;
      const rows = [...selectedCrewAttendance]
        .sort((a, b) => a.attendance_date.localeCompare(b.attendance_date))
        .map(a => [
          csvDateText(a.attendance_date),
          crewMemberById[a.member_id]?.name || 'Unknown',
          a.status,
          getShiftLabel(a.status),
          (dailyRate * getShiftMultiplier(a.status)).toFixed(2),
        ]);
      downloadCSV(`${selectedLabour.name.replace(/\s+/g, '_')}_crew_attendance.csv`, ['Date', 'Member', 'Code', 'Meaning', "Day's Wage"], rows);
      return;
    }
    const rows = [...workerAttendance]
      .sort((a, b) => a.attendance_date.localeCompare(b.attendance_date))
      .map(a => [
        csvDateText(a.attendance_date),
        a.status,
        getShiftLabel(a.status),
        ((parseFloat(selectedLabour.daily_wage) || 0) * getShiftMultiplier(a.status)).toFixed(2),
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
      alert(`Failed to log payment.\n\n${err?.message || 'Unknown error'}`);
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
                              {isCrewCard && ` · ${getActiveMemberCount(l.id)} worker${getActiveMemberCount(l.id) === 1 ? '' : 's'}`}
                            </div>
                          </div>
                          <span className={typeBadgeClass(l.labour_type)}>{typeBadgeLabel(l.labour_type)}</span>
                        </div>

                        {isCrewCard ? (
                          <div
                            className="labour-rollcall-row"
                            onClick={(e) => {
                              e.stopPropagation();
                              selectLabourer(l);
                              setActiveWorkspaceTab('attendance');
                              openMemberPopupForDate(rollDate);
                            }}
                            style={{ cursor: 'pointer' }}
                          >
                            {(() => {
                              const summary = crewRollSummary(l.id);
                              return (
                                <>
                                  <span className={`labour-today-dot ${summary.marked === summary.total && summary.total > 0 ? 'present' : summary.marked === 0 ? 'implicit' : 'half'}`}>
                                    {summary.marked}/{summary.total}
                                  </span>
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                    Tap to mark crew for {formatDate(rollDate)}
                                  </span>
                                </>
                              );
                            })()}
                          </div>
                        ) : (
                          <div className="labour-rollcall-row" onClick={(e) => e.stopPropagation()}>
                            <div className="labour-status-toggle-group sm">
                              {SHIFT_CODES.map(s => (
                                <button
                                  type="button"
                                  key={s.code}
                                  title={
                                    effectiveStatus === s.code
                                      ? (mark ? `${s.label} — confirmed for ${formatDate(rollDate)}` : `Defaulting to ${s.label} — not yet confirmed`)
                                      : `Mark ${formatDate(rollDate)}: ${s.label}`
                                  }
                                  disabled={isBusy}
                                  className={`labour-status-toggle ${s.tone} ${effectiveStatus === s.code ? 'active' : ''} ${effectiveStatus === s.code && !mark ? 'implicit' : ''}`}
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
                        )}
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
                        {isCrew && ` · ${selectedLabour.group_name || 'Crew'} · ${activeCrewMembers.length} workers`}
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
                    {isCrew && (
                      <button className={`labour-tab ${activeWorkspaceTab === 'members' ? 'active' : ''}`} onClick={() => setActiveWorkspaceTab('members')}>
                        Members {selectedCrewMembers.length > 0 ? `(${selectedCrewMembers.length})` : ''}
                      </button>
                    )}
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
                        {isCrew && (
                          <ProfileField
                            label="Crew Size"
                            value={selectedCrewMembers.length > 0
                              ? `${activeCrewMembers.length} active member${activeCrewMembers.length === 1 ? '' : 's'}`
                              : 'No members added yet'}
                          />
                        )}
                        {isCrew && (
                          <ProfileField
                            label="Effective Daily Crew Cost"
                            value={formatCurrency((parseFloat(selectedLabour.daily_wage) || 0) * activeCrewMembers.length)}
                          />
                        )}
                        <ProfileField label="Aadhaar Number" value={selectedLabour.aadhaar_number || 'N/A'} />
                        <ProfileField label="Bank Account Number" value={selectedLabour.bank_account_number || 'N/A'} />
                        <ProfileField label="IFSC Code" value={selectedLabour.ifsc_code || 'N/A'} />
                        <ProfileField label="Bank Name" value={selectedLabour.bank_name || 'N/A'} />
                      </div>
                    )}

                    {/* ---------- MEMBERS TAB (crews only) ---------- */}
                    {activeWorkspaceTab === 'members' && isCrew && (
                      <>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 0, marginBottom: '1rem' }}>
                          Add every worker in this crew by name so attendance and payment can be tracked per person —
                          this is what shows up when you tap a date on the Attendance calendar.
                        </p>

                        <form className="labour-inline-form" onSubmit={handleAddMember}>
                          <div className="form-group" style={{ flex: 2, minWidth: '160px' }}>
                            <label>Member Name</label>
                            <input type="text" className="input-field" required value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} placeholder="e.g. Suresh" />
                          </div>
                          <div className="form-group" style={{ flex: 1, minWidth: '140px' }}>
                            <label>Mobile (optional)</label>
                            <input type="text" className="input-field" value={newMemberMobile} onChange={(e) => setNewMemberMobile(e.target.value)} placeholder="e.g. 9876543210" />
                          </div>
                          <button type="submit" className="btn-primary" disabled={savingMember}>
                            {savingMember ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <UserPlus size={14} />}
                            <span>Add Member</span>
                          </button>
                        </form>

                        <div style={{ margin: '1.25rem 0 0.6rem' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)' }}>
                            Crew Roster ({activeCrewMembers.length} active{selectedCrewMembers.length > activeCrewMembers.length ? `, ${selectedCrewMembers.length - activeCrewMembers.length} removed` : ''})
                          </span>
                        </div>

                        {selectedCrewMembers.length === 0 ? (
                          <div className="crew-member-empty">No members added yet. Add each worker's name above.</div>
                        ) : (
                          selectedCrewMembers.map(m => {
                            const isInactive = m.active === false;
                            const paidTotal = memberPaidTotals[m.id] || 0;
                            const memberPaymentHistory = selectedMemberPayments.filter(p => p.member_id === m.id);
                            return (
                              <div key={m.id} className="crew-member-row" style={isInactive ? { opacity: 0.6 } : undefined}>
                                {editingMemberId === m.id ? (
                                  <>
                                    <div className="crew-member-edit-row">
                                      <input type="text" className="input-field" value={editMemberName} onChange={(e) => setEditMemberName(e.target.value)} placeholder="Name" />
                                      <input type="text" className="input-field" value={editMemberMobile} onChange={(e) => setEditMemberMobile(e.target.value)} placeholder="Mobile (optional)" />
                                    </div>
                                    <div className="actions">
                                      <button type="button" className="btn-secondary" style={{ padding: '0.4rem 0.6rem' }} onClick={() => saveEditMember(m.id)}>
                                        <Check size={13} />
                                      </button>
                                      <button type="button" className="btn-secondary" style={{ padding: '0.4rem 0.6rem' }} onClick={cancelEditMember}>
                                        <X size={13} />
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', width: '100%' }}>
                                      <div className="who">
                                        <span className="name">{m.name}{isInactive ? ' (removed)' : ''}</span>
                                        <span className="meta">{m.mobile || 'No mobile'} · Paid {formatCurrency(paidTotal)}</span>
                                      </div>
                                      <div className="actions">
                                        {!isInactive && (
                                          <button type="button" className="btn-secondary" style={{ padding: '0.4rem 0.6rem' }} onClick={() => openMemberPaymentForm(m.id)}>
                                            <Wallet size={13} />
                                          </button>
                                        )}
                                        <button type="button" className="btn-secondary" style={{ padding: '0.4rem 0.6rem' }} onClick={() => startEditMember(m)}>
                                          <Edit size={13} />
                                        </button>
                                        {isInactive ? (
                                          <button type="button" className="btn-secondary" style={{ padding: '0.4rem 0.6rem' }} onClick={() => handleReactivateMember(m.id)}>
                                            Reactivate
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            className="btn-secondary"
                                            style={{ padding: '0.4rem 0.6rem' }}
                                            title="Remove from active crew — keeps their attendance/payment history, can be reactivated"
                                            onClick={() => handleDeactivateMember(m.id)}
                                          >
                                            <UserX size={13} />
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          className="btn-secondary"
                                          style={{ padding: '0.4rem 0.6rem', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}
                                          title="Permanently delete this member and all their history"
                                          onClick={() => handleDeleteMemberPermanently(m.id, m.name)}
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      </div>
                                    </div>

                                    {payingMemberId === m.id && (
                                      <form
                                        className="labour-inline-form"
                                        style={{ width: '100%', marginTop: '0.6rem' }}
                                        onSubmit={(e) => handleAddMemberPayment(e, m.id, m.labour_id)}
                                      >
                                        <div className="form-group" style={{ flex: 1, minWidth: '110px' }}>
                                          <label>Amount</label>
                                          <input type="number" className="input-field" required min="1" step="0.01" value={memberPayAmount} onChange={(e) => setMemberPayAmount(e.target.value)} placeholder="₹" />
                                        </div>
                                        <div className="form-group" style={{ flex: 1, minWidth: '130px' }}>
                                          <label>Date</label>
                                          <input type="date" className="input-field" required value={memberPayDate} onChange={(e) => setMemberPayDate(e.target.value)} />
                                        </div>
                                        <div className="form-group" style={{ flex: 1, minWidth: '110px' }}>
                                          <label>Mode</label>
                                          <select className="input-field" value={memberPayMode} onChange={(e) => setMemberPayMode(e.target.value)}>
                                            <option>Cash</option>
                                            <option>UPI</option>
                                            <option>Bank Transfer</option>
                                            <option>Other</option>
                                          </select>
                                        </div>
                                        <div className="form-group" style={{ flex: 2, minWidth: '140px' }}>
                                          <label>Remarks (optional)</label>
                                          <input type="text" className="input-field" value={memberPayRemarks} onChange={(e) => setMemberPayRemarks(e.target.value)} placeholder="e.g. Advance" />
                                        </div>
                                        <button type="submit" className="btn-primary" disabled={savingMemberPayment}>
                                          {savingMemberPayment ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={14} />}
                                          <span>Save</span>
                                        </button>
                                        <button type="button" className="btn-secondary" onClick={cancelMemberPaymentForm}>Cancel</button>
                                      </form>
                                    )}

                                    {memberPaymentHistory.length > 0 && (
                                      <div style={{ width: '100%', marginTop: '0.5rem' }}>
                                        {memberPaymentHistory.map(p => (
                                          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0.2rem 0' }}>
                                            <span>{formatDate(p.payment_date)} · {formatCurrency(p.amount_paid)} · {p.payment_mode}{p.remarks ? ` · ${p.remarks}` : ''}</span>
                                            <button type="button" onClick={() => handleDeleteMemberPayment(p.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                                              <Trash2 size={12} />
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            );
                          })
                        )}
                      </>
                    )}

                    {/* ---------- ATTENDANCE TAB ---------- */}
                    {activeWorkspaceTab === 'attendance' && isCrew && (
                      <>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 0, marginBottom: '1rem' }}>
                          Each crew member is tracked individually now. Use "Mark everyone" for a quick bulk tap, or tap
                          any date on the calendar to open that day and mark members one by one.
                          {activeCrewMembers.length === 0 && ' Add members on the Members tab first.'}
                        </p>

                        <div className="labour-inline-form">
                          <div className="form-group">
                            <label>Date</label>
                            <input type="date" className="input-field" required value={attDate} onChange={(e) => setAttDate(e.target.value)} />
                          </div>
                          <div className="form-group">
                            <label>Mark everyone for this date</label>
                            <div className="labour-status-toggle-group">
                              {SHIFT_CODES.map(s => (
                                <button
                                  type="button"
                                  key={s.code}
                                  title={`Mark whole crew: ${s.label}`}
                                  disabled={savingAttendance || activeCrewMembers.length === 0}
                                  className={`labour-status-toggle ${s.tone}`}
                                  onClick={() => markAllMembersForDate(s.code, attDate)}
                                >
                                  {s.code}
                                </button>
                              ))}
                            </div>
                            <span className="labour-tap-hint">
                              <button type="button" className="btn-secondary" style={{ padding: '0.3rem 0.6rem', marginTop: '0.4rem' }} onClick={() => openMemberPopupForDate(attDate)}>
                                Open {formatDate(attDate)} — mark members individually
                              </button>
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
                            <span><strong>{monthSummary.markedDays}</strong> member-days marked</span>
                            <span><strong>{monthSummary.totalShiftUnits}</strong> total shifts</span>
                            <span><strong>{monthSummary.absentDays}</strong> absent</span>
                            <span className="wage"><strong>{formatCurrency(monthSummary.totalWage)}</strong> crew's wage this month</span>
                          </div>

                          <div className="labour-calendar-grid">
                            {WEEKDAY_NAMES.map(w => <div key={w} className="labour-calendar-weekday">{w}</div>)}
                            {calendarDays.map((day, idx) => {
                              if (day === null) return <div key={`blank-${idx}`} className="labour-calendar-cell empty" />;
                              const key = dateKey(calendarMonth.year, calendarMonth.month, day);
                              const dayMarks = crewMonthAttendanceByDay[key] || [];
                              const dayPaid = monthPaymentsByDay[key];
                              const totalMembers = selectedCrewMembers.length;
                              let tone = '';
                              if (dayMarks.length > 0) {
                                const firstStatus = dayMarks[0].status;
                                const allSame = dayMarks.every(m => m.status === firstStatus);
                                tone = allSame ? (SHIFT_CODES.find(s => s.code === firstStatus)?.tone || 'absent') : 'mixed';
                              }
                              const isToday = key === todayStr();
                              const titleParts = [key, `${dayMarks.length}/${totalMembers} members marked`];
                              if (dayPaid) titleParts.push(`Paid ${formatCurrency(dayPaid)}`);
                              return (
                                <button
                                  type="button"
                                  key={key}
                                  title={titleParts.join(' · ')}
                                  className={`labour-calendar-cell ${tone} ${isToday ? 'today' : ''}`}
                                  onClick={() => { setAttDate(key); openMemberPopupForDate(key); }}
                                >
                                  <span className="day-num">{day}</span>
                                  {totalMembers > 0 && <span className="day-code">{dayMarks.length}/{totalMembers}</span>}
                                  {dayPaid > 0 && <span className="day-pay">{formatCompactAmount(dayPaid)}</span>}
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
                                <th>Member</th>
                                <th>Code</th>
                                <th>Meaning</th>
                                <th>Day's Wage</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedCrewAttendance.length === 0 ? (
                                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>No attendance logged yet.</td></tr>
                              ) : (
                                selectedCrewAttendance.map(a => (
                                  <tr key={a.id}>
                                    <td>{formatDate(a.attendance_date)}</td>
                                    <td>{crewMemberById[a.member_id]?.name || 'Removed member'}</td>
                                    <td>
                                      <span className={`labour-status-toggle ${SHIFT_CODES.find(s => s.code === a.status)?.tone || 'absent'} active`} style={{ cursor: 'default' }}>
                                        {a.status}
                                      </span>
                                    </td>
                                    <td>{getShiftLabel(a.status)}</td>
                                    <td>{formatCurrency((parseFloat(selectedLabour.daily_wage) || 0) * getShiftMultiplier(a.status))}</td>
                                    <td style={{ textAlign: 'right' }}>
                                      <button
                                        className="btn-secondary"
                                        style={{ padding: '0.3rem', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}
                                        onClick={() => handleDeleteCrewAttendance(a.id)}
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

                    {activeWorkspaceTab === 'attendance' && !isCrew && (
                      <>
                        <div className="labour-inline-form">
                          <div className="form-group">
                            <label>Date</label>
                            <input type="date" className="input-field" required value={attDate} onChange={(e) => setAttDate(e.target.value)} />
                          </div>
                          <div className="form-group">
                            <label>Tap to confirm shift</label>
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
                            <span className="wage"><strong>{formatCurrency(monthSummary.totalWage)}</strong> wage this month</span>
                          </div>

                          <div className="labour-calendar-grid">
                            {WEEKDAY_NAMES.map(w => <div key={w} className="labour-calendar-weekday">{w}</div>)}
                            {calendarDays.map((day, idx) => {
                              if (day === null) return <div key={`blank-${idx}`} className="labour-calendar-cell empty" />;
                              const key = dateKey(calendarMonth.year, calendarMonth.month, day);
                              const mark = monthAttendanceByDay[key];
                              const dayPaid = monthPaymentsByDay[key];
                              const tone = mark ? (SHIFT_CODES.find(s => s.code === mark.status)?.tone || 'absent') : '';
                              const isToday = key === todayStr();
                              const isSelected = key === attDate;
                              const titleParts = [key];
                              if (mark) titleParts.push(getShiftLabel(mark.status));
                              if (dayPaid) titleParts.push(`Paid ${formatCurrency(dayPaid)}`);
                              return (
                                <button
                                  type="button"
                                  key={key}
                                  title={titleParts.join(' · ')}
                                  className={`labour-calendar-cell ${tone} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                                  onClick={() => setAttDate(key)}
                                >
                                  <span className="day-num">{day}</span>
                                  {mark && <span className="day-code">{mark.status}</span>}
                                  {dayPaid > 0 && <span className="day-pay">{formatCompactAmount(dayPaid)}</span>}
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
                                <th>Day's Wage</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {workerAttendance.length === 0 ? (
                                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>No attendance logged yet.</td></tr>
                              ) : (
                                workerAttendance.map(a => (
                                  <tr key={a.id}>
                                    <td>{formatDate(a.attendance_date)}</td>
                                    <td>
                                      <span className={`labour-status-toggle ${SHIFT_CODES.find(s => s.code === a.status)?.tone || 'absent'} active`} style={{ cursor: 'default' }}>
                                        {a.status}
                                      </span>
                                    </td>
                                    <td>{getShiftLabel(a.status)}</td>
                                    <td>{formatCurrency((parseFloat(selectedLabour.daily_wage) || 0) * getShiftMultiplier(a.status))}</td>
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
                                ))
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
                            These totals cover the whole crew ({activeCrewMembers.length} worker{activeCrewMembers.length === 1 ? '' : 's'}) —
                            lump-sum payments logged below, plus any per-member payments logged on the Members tab.
                          </p>
                        )}
                        <div className="labour-financial-row">
                          <div className="labour-financial-card paid">
                            <span className="label">{isCrew ? 'Crew Paid (All Time)' : 'Paid (All Time)'}</span>
                            <span className="value">{formatCurrency(workerStats.paid)}</span>
                            <span className="hint" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              {formatCurrency(workerMonthlyStats?.currentMonthPaid || 0)} this month
                            </span>
                          </div>
                          <div className={`labour-financial-card due ${workerStats.balance > 0 ? 'balance-positive' : 'balance-clear'}`}>
                            <span className="label">{isCrew ? 'Crew Outstanding' : 'Outstanding'}</span>
                            <span className="value">{formatCurrency(workerStats.balance)}</span>
                            <span className="hint" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              includes any unpaid balance from earlier months
                            </span>
                          </div>
                        </div>

                        {monthlyLedger.length > 0 && (() => {
                          const visibleMonths = showAllMonths ? monthlyLedger : monthlyLedger.slice(0, 3);
                          const hiddenCount = monthlyLedger.length - visibleMonths.length;
                          return (
                            <>
                              <div style={{ margin: '1.25rem 0 0.4rem' }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)' }}>Monthly Ledger</span>
                              </div>
                              <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 0, marginBottom: '0.75rem' }}>
                                <span style={{ color: '#ef4444', fontWeight: 700 }}>● Due</span> = still owed as of that month ·{' '}
                                <span style={{ color: '#10b981', fontWeight: 700 }}>● Settled</span> = fully paid up by then.
                                A late payment clears the oldest debt first, so an older month can flip from Due to Settled once paid.
                              </p>
                              <div className="labour-month-ledger">
                                {visibleMonths.map(row => (
                                  <div key={row.key} className={`labour-month-card ${row.runningBalance > 0 ? 'due' : 'clear'}`}>
                                    <div className="month-card-head">
                                      <span className="month-label">{row.label}</span>
                                      <span className={`month-status-badge ${row.runningBalance > 0 ? 'due' : 'clear'}`}>
                                        {row.runningBalance > 0 ? 'Due' : 'Settled'}
                                      </span>
                                    </div>
                                    <div className="month-balance-figure">
                                      <span className="figure-label">Outstanding as of this month</span>
                                      <span className="figure-value">{formatCurrency(row.runningBalance)}</span>
                                    </div>
                                    <div className="month-card-sub">
                                      <span>Earned <strong>{formatCurrency(row.earned)}</strong></span>
                                      <span>Paid <strong>{formatCurrency(row.paid)}</strong></span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              {monthlyLedger.length > 3 && (
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  style={{ marginTop: '0.75rem' }}
                                  onClick={() => setShowAllMonths(v => !v)}
                                >
                                  {showAllMonths ? 'Show fewer months' : `Show ${hiddenCount} earlier month${hiddenCount === 1 ? '' : 's'}`}
                                </button>
                              )}
                            </>
                          );
                        })()}

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
                                {isCrew && <th>Member</th>}
                                <th>Amount</th>
                                <th>Mode</th>
                                <th>Remarks</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {combinedPayments.length === 0 ? (
                                <tr><td colSpan={isCrew ? 6 : 5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>No payments logged yet.</td></tr>
                              ) : (
                                combinedPayments.map(p => (
                                  <tr key={p.id}>
                                    <td>{formatDate(p.payment_date)}</td>
                                    {isCrew && <td>{p.memberName || <span style={{ color: 'var(--text-muted)' }}>Whole crew</span>}</td>}
                                    <td style={{ color: '#10b981', fontWeight: 600 }}>+{formatCurrency(p.amount_paid)}</td>
                                    <td>{p.payment_mode}</td>
                                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.remarks || '—'}</td>
                                    <td style={{ textAlign: 'right' }}>
                                      <button
                                        className="btn-secondary"
                                        style={{ padding: '0.3rem', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}
                                        onClick={() => (p.memberName ? handleDeleteMemberPayment(p.id) : handleDeletePayment(p.id))}
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
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                          <label>Crew / Group Name *</label>
                          <input type="text" className="input-field" required value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="e.g. Ramesh Decor Crew" />
                        </div>
                      </div>
                    )}

                    {labourType === 'Group Leader' && !isEditing && (
                      <div className="form-group animate-fade" style={{ background: 'var(--primary-subtle)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <label>Crew Member Names</label>
                        <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '0 0 0.6rem' }}>
                          Add each worker's name now, or leave blank and add them later from the crew's Members tab.
                        </p>
                        {newCrewMemberNames.map((val, idx) => (
                          <div key={idx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <input
                              type="text"
                              className="input-field"
                              value={val}
                              onChange={(e) => updateCrewMemberNameField(idx, e.target.value)}
                              placeholder={`Member ${idx + 1} name`}
                            />
                            <button type="button" className="btn-secondary" style={{ padding: '0.4rem 0.6rem' }} onClick={() => removeCrewMemberNameField(idx)}>
                              <X size={13} />
                            </button>
                          </div>
                        ))}
                        <button type="button" className="btn-secondary" onClick={addCrewMemberNameField}>
                          <Plus size={13} />
                          <span>Add Another Member</span>
                        </button>
                      </div>
                    )}

                    <div className="form-group">
                      <label>Aadhaar Card Number</label>
                      <input type="text" className="input-field" value={aadhaarNumber} onChange={(e) => setAadhaarNumber(e.target.value)} placeholder="e.g. 1234-5678-9012" />
                    </div>

                    <div className="form-grid">
                      <div className="form-group">
                        <label>Bank Account Number</label>
                        <input type="text" className="input-field" value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} placeholder="e.g. 1234567890" />
                      </div>
                      <div className="form-group">
                        <label>IFSC Code</label>
                        <input type="text" className="input-field" value={ifscCode} onChange={(e) => setIfscCode(e.target.value.toUpperCase())} placeholder="e.g. SBIN0001234" maxLength={11} style={{ textTransform: 'uppercase' }} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Bank Name</label>
                      <input type="text" className="input-field" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. State Bank of India" />
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

          {/* ============ Crew Day Popup (per-member attendance) ============ */}
          {showMemberPopup && popupDate && selectedLabour && (
            <div className="modal-overlay" onClick={() => setShowMemberPopup(false)}>
              <div className="modal-content crew-popup" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h3 style={{ margin: 0 }}>{formatDate(popupDate)} — {selectedLabour.group_name || selectedLabour.name}</h3>
                  <button onClick={() => setShowMemberPopup(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}>
                    <X size={18} />
                  </button>
                </div>
                <div className="modal-body">
                  {activeCrewMembers.length === 0 ? (
                    <div className="crew-member-empty">
                      No active members in this crew yet. Close this and add members from the Members tab.
                    </div>
                  ) : (
                    <>
                      <div className="crew-popup-bulk">
                        <span>Mark everyone:</span>
                        <div className="labour-status-toggle-group sm">
                          {SHIFT_CODES.map(s => (
                            <button
                              type="button"
                              key={s.code}
                              title={`Mark whole crew: ${s.label}`}
                              disabled={savingAttendance}
                              className={`labour-status-toggle ${s.tone}`}
                              onClick={() => markAllMembersForDate(s.code, popupDate)}
                            >
                              {s.code}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="crew-popup-list">
                        {activeCrewMembers.map(m => {
                          const mark = crewAttendance.find(a => a.member_id === m.id && a.attendance_date === popupDate);
                          const effectiveStatus = mark ? mark.status : 'A';
                          const busy = savingMemberKey === `cm-${m.id}-${popupDate}`;
                          return (
                            <div key={m.id} className="crew-popup-row">
                              <div className="who">
                                <span className="name">{m.name}</span>
                                {m.mobile && <span className="meta">{m.mobile}</span>}
                              </div>
                              <div className="labour-status-toggle-group sm">
                                {SHIFT_CODES.map(s => (
                                  <button
                                    type="button"
                                    key={s.code}
                                    title={s.label}
                                    disabled={busy}
                                    className={`labour-status-toggle ${s.tone} ${effectiveStatus === s.code ? 'active' : ''}`}
                                    onClick={() => quickMarkCrewAttendance(m.id, selectedLabourId, s.code, popupDate)}
                                  >
                                    {s.code}
                                  </button>
                                ))}
                                <button
                                  type="button"
                                  title="Clear — revert to default Absent"
                                  className="labour-status-toggle clear"
                                  disabled={!mark || busy}
                                  onClick={() => quickClearCrewAttendance(m.id, popupDate)}
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn-secondary" onClick={() => setShowMemberPopup(false)}>Close</button>
                </div>
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