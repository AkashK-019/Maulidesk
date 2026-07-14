import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { Search, Loader2, Users, User, Calendar, X } from 'lucide-react';
import { formatCurrency } from '../utils/helpers';
import { SHIFT_CODES, getShiftMultiplier } from '../utils/attendanceCodes';
import '../styles/quotations.css';
import '../styles/labour.css';

const todayStr = () => new Date().toISOString().split('T')[0];

export default function Attendance() {
  const [labourers, setLabourers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('All'); 
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [dayAttendance, setDayAttendance] = useState([]); 
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    fetchLabourers();
  }, []);

  useEffect(() => {
    fetchDayAttendance(selectedDate);
  }, [selectedDate]);

  const fetchLabourers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('labour_master').select('*').order('name', { ascending: true });
      if (error) throw error;
      setLabourers(data || []);
    } catch (err) {
      console.error('Error loading labourers:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDayAttendance = async (date) => {
    try {
      const { data, error } = await supabase.from('labour_attendance').select('*').eq('attendance_date', date);
      if (error) throw error;
      setDayAttendance(data || []);
    } catch (err) {
      console.error('Error loading attendance for date:', err);
    }
  };

  const markMap = useMemo(() => {
    const map = {};
    dayAttendance.forEach(a => { map[a.labour_id] = a; });
    return map;
  }, [dayAttendance]);

  const markAttendance = async (labourId, code) => {
    setSavingId(labourId);
    try {
      const row = {
        labour_id: labourId,
        attendance_date: selectedDate,
        shift: 'Full Day',
        status: code,
        working_hours: getShiftMultiplier(code) * 8,
        overtime_hours: 0,
      };
      const { data, error } = await supabase
        .from('labour_attendance')
        .upsert([row], { onConflict: 'labour_id,attendance_date,shift' })
        .select();
      if (error) throw error;

      const saved = data && data[0] ? data[0] : row;
      setDayAttendance(prev => {
        const exists = prev.find(a => a.labour_id === labourId);
        if (exists) return prev.map(a => (a.labour_id === labourId ? saved : a));
        return [...prev, saved];
      });
    } catch (err) {
      console.error('Error marking attendance:', err);
      alert('Failed to mark attendance.');
    } finally {
      setSavingId(null);
    }
  };

  const clearAttendance = async (labourId) => {
    const existing = markMap[labourId];
    if (!existing || !existing.id) return;
    setSavingId(labourId);
    try {
      const { error } = await supabase.from('labour_attendance').delete().eq('id', existing.id);
      if (error) throw error;
      setDayAttendance(prev => prev.filter(a => a.labour_id !== labourId));
    } catch (err) {
      console.error('Error clearing attendance:', err);
      alert('Failed to clear attendance.');
    } finally {
      setSavingId(null);
    }
  };

  const filteredLabourers = labourers.filter(l => {
    const matchesSearch =
      l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.skill_type && l.skill_type.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (l.group_name && l.group_name.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFilter = activeFilter === 'All' || l.labour_type === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const summary = useMemo(() => {
    let marked = 0, present = 0, absent = 0, payout = 0, headcountMarked = 0;
    labourers.forEach(l => {
      const mark = markMap[l.id];
      if (!mark) return;
      const code = mark.status;
      const headcount = l.labour_type === 'Group Leader' ? (parseInt(l.crew_size, 10) || 1) : 1;
      marked += 1;
      headcountMarked += headcount;
      if (code === 'A') absent += headcount;
      else present += headcount;
      payout += (parseFloat(l.daily_wage) || 0) * headcount * getShiftMultiplier(code);
    });
    return { marked, present, absent, unmarked: labourers.length - marked, payout, headcountMarked };
  }, [labourers, markMap]);

  const typeBadgeClass = (type) => (type === 'Group Leader' ? 'labour-type-badge leader' : 'labour-type-badge single');
  const typeBadgeLabel = (type) => (type === 'Group Leader' ? 'Crew' : 'Single');

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <Header title="Attendance" />

        <main className="gs-main">
          <div className="glass-card labour-quick-page animate-fade" style={{ padding: '1.25rem' }}>
            <div className="attendance-page-toolbar">
              <div className="labour-search-box att-toolbar-box">
                <Calendar size={15} style={{ color: 'var(--text-muted)' }} />
                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', fontSize: '0.83rem' }} />
              </div>

              <div className="labour-search-box att-toolbar-box">
                <Search size={15} style={{ color: 'var(--text-muted)' }} />
                <input type="text" placeholder="Search name, skill, crew..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>

              <div className="labour-filter-pills">
                {['All', 'Individual', 'Group Leader'].map(tab => (
                  <button key={tab} className={`labour-filter-pill ${activeFilter === tab ? 'active' : ''}`} onClick={() => setActiveFilter(tab)}>
                    {tab === 'Group Leader' ? 'Crews' : tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="attendance-summary-row">
              <div className="attendance-summary-card">
                <span className="num">{summary.marked}</span>
                <span className="lbl">Entries Marked</span>
              </div>
              <div className="attendance-summary-card">
                <span className="num">{summary.present}</span>
                <span className="lbl">Workers Present</span>
              </div>
              <div className="attendance-summary-card">
                <span className="num">{summary.absent}</span>
                <span className="lbl">Workers Absent</span>
              </div>
              <div className="attendance-summary-card">
                <span className="num">{summary.unmarked}</span>
                <span className="lbl">Not Marked Yet</span>
              </div>
              <div className="attendance-summary-card">
                <span className="num">{formatCurrency(summary.payout)}</span>
                <span className="lbl">Day's Payout</span>
              </div>
            </div>

            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2.5rem' }}>
                <Loader2 size={26} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
              </div>
            ) : filteredLabourers.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2.5rem' }}>No labourers found.</div>
            ) : (
              filteredLabourers.map(l => {
                const mark = markMap[l.id];
                const currentCode = mark ? mark.status : null;
                return (
                  <div key={l.id} className="attendance-roll-row">
                    <div className="who">
                      <span className="name">
                        {l.labour_type === 'Group Leader' ? <Users size={13} /> : <User size={13} />}
                        {l.name}
                        <span className={typeBadgeClass(l.labour_type)}>{typeBadgeLabel(l.labour_type)}</span>
                      </span>
                      <span className="meta">
                        {l.skill_type || 'Helper'} · {formatCurrency(l.daily_wage)}/day
                        {l.labour_type === 'Group Leader' && ` · ${l.crew_size || 1} worker${(l.crew_size || 1) > 1 ? 's' : ''}${l.group_name ? ` (${l.group_name})` : ''}`}
                      </span>
                    </div>

                    <div className="labour-status-toggle-group">
                      {savingId === l.id ? (
                        <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
                      ) : (
                        <>
                          {SHIFT_CODES.map(s => (
                            <button
                              key={s.code}
                              type="button"
                              title={s.label}
                              className={`labour-status-toggle ${s.tone} ${currentCode === s.code ? 'active' : ''}`}
                              onClick={() => markAttendance(l.id, s.code)}
                            >
                              {s.code}
                            </button>
                          ))}
                          <button
                            type="button"
                            title="Clear today's mark"
                            className="labour-status-toggle clear"
                            disabled={!currentCode}
                            onClick={() => clearAttendance(l.id)}
                          >
                            <X size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </main>
      </div>
    </div>
  );
}