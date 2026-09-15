import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from './AppContext';
import { ProductionRecord, RejectionRecord } from './types';
import { fetchProductionRecords, fetchRejectionRecords, fetchDistinctProductionDates } from './dbService';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import {
  Calendar, Award, AlertTriangle, Clock, Layers, ArrowUpRight, CheckCircle2, TrendingUp, Filter
} from 'lucide-react';

export const DailyDashboard: React.FC = () => {
  const { gdcMachines, models, settings } = useApp();

  const [dateMode, setDateMode] = useState<'SINGLE' | 'RANGE'>('SINGLE');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedShift, setSelectedShift] = useState<string>('ALL');

  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [rejections, setRejections] = useState<RejectionRecord[]>([]);
  const [distinctDates, setDistinctDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Load distinct dates for "Yesterday" logic
  useEffect(() => {
    fetchDistinctProductionDates().then(dates => {
      setDistinctDates(dates);
      if (dates.length > 0 && !dates.includes(selectedDate)) {
        setSelectedDate(dates[0]);
        setStartDate(dates[dates.length - 1]);
        setEndDate(dates[0]);
      }
    });
  }, []);

  // Quick preset handlers
  const handleSelectToday = () => {
    const today = new Date().toISOString().split('T')[0];
    setDateMode('SINGLE');
    setSelectedDate(today);
  };

  const handleSelectYesterday = () => {
    // Yesterday = latest available production date before selectedDate
    const earlierDates = distinctDates.filter(d => d < selectedDate);
    if (earlierDates.length > 0) {
      setDateMode('SINGLE');
      setSelectedDate(earlierDates[0]);
    } else if (distinctDates.length > 1) {
      setDateMode('SINGLE');
      setSelectedDate(distinctDates[1]);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const start = dateMode === 'SINGLE' ? selectedDate : startDate;
      const end = dateMode === 'SINGLE' ? selectedDate : endDate;

      const [prods, rejs] = await Promise.all([
        fetchProductionRecords({
          startDate: start,
          endDate: end,
          shift: selectedShift
        }),
        fetchRejectionRecords(start, end)
      ]);

      setRecords(prods);
      setRejections(rejs);
    } catch (e) {
      console.error('Failed to load daily production:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [dateMode, selectedDate, startDate, endDate, selectedShift]);

  // Aggregate Metrics
  const totalPlan = useMemo(() => records.reduce((s, r) => s + (r.planned_qty || 0), 0), [records]);
  const totalActual = useMemo(() => records.reduce((s, r) => s + (r.actual_qty || 0), 0), [records]);
  const achievementPct = useMemo(() => (totalPlan > 0 ? Math.round((totalActual / totalPlan) * 1000) / 10 : 0), [totalPlan, totalActual]);
  const totalRejection = useMemo(() => rejections.reduce((s, r) => s + r.quantity, 0), [rejections]);
  const rejectionPct = useMemo(() => {
    const denom = totalActual + totalRejection;
    return denom > 0 ? Math.round((totalRejection / denom) * 1000) / 10 : 0;
  }, [totalActual, totalRejection]);

  const totalBreakdown = useMemo(() => {
    const seen = new Set<string>();
    return records.reduce((s, r) => {
      const key = `${r.date}_${r.hour_id}_${r.gdc_machine}`;
      if (!seen.has(key)) {
        seen.add(key);
        return s + (r.breakdown_min || 0);
      }
      return s;
    }, 0);
  }, [records]);

  // GDC Rankings to determine Best and Worst
  const gdcRankings = useMemo(() => {
    return gdcMachines.map(gdc => {
      const gdcRecs = records.filter(r => r.gdc_machine === gdc.gdc_id);
      const actual = gdcRecs.reduce((s, r) => s + (r.actual_qty || 0), 0);
      const plan = gdcRecs.reduce((s, r) => s + (r.planned_qty || 0), 0);
      const ach = plan > 0 ? Math.round((actual / plan) * 1000) / 10 : 0;
      const gdcRejs = rejections.filter(rej => rej.gdc_machine === gdc.gdc_id).reduce((s, r) => s + r.quantity, 0);
      const bd = gdcRecs.reduce((s, r) => s + (r.breakdown_min || 0), 0);

      let status = 'Critical';
      if (ach >= settings.excellent_threshold) status = 'Excellent';
      else if (ach >= settings.good_threshold) status = 'Good';
      else if (ach >= settings.warning_threshold) status = 'Warning';

      return {
        gdc_id: gdc.gdc_id,
        gdc_code: gdc.gdc_code,
        furnace_id: gdc.furnace_id,
        plan,
        actual,
        achievement_pct: ach,
        rejection: gdcRejs,
        breakdown_min: bd,
        status
      };
    }).sort((a, b) => b.achievement_pct - a.achievement_pct);
  }, [gdcMachines, records, rejections, settings]);

  const bestGDC = gdcRankings.length > 0 && gdcRankings[0].actual > 0 ? gdcRankings[0] : null;
  const worstGDC = gdcRankings.length > 0 && gdcRankings[gdcRankings.length - 1].plan > 0 ? gdcRankings[gdcRankings.length - 1] : null;

  // Shift performance comparison
  const shiftComparison = useMemo(() => {
    return (['A', 'B'] as const).map(s => {
      const sRecs = records.filter(r => r.shift === s);
      const actual = sRecs.reduce((sum, r) => sum + (r.actual_qty || 0), 0);
      const plan = sRecs.reduce((sum, r) => sum + (r.planned_qty || 0), 0);
      const ach = plan > 0 ? Math.round((actual / plan) * 1000) / 10 : 0;
      const rej = rejections.filter(r => r.shift === s).reduce((sum, r) => sum + r.quantity, 0);
      const bd = sRecs.reduce((sum, r) => sum + (r.breakdown_min || 0), 0);
      return {
        shift: `Shift ${s}`,
        actual,
        plan,
        achievement_pct: ach,
        rejection: rej,
        breakdown_min: bd
      };
    });
  }, [records, rejections]);

  return (
    <div id="daily-dashboard-container" className="space-y-6">
      {/* Filter / Date selection bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Date Timeline Range</span>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg ml-2">
              <button
                type="button"
                onClick={handleSelectToday}
                className="px-2.5 py-1 text-xs font-semibold rounded hover:bg-white text-slate-700 transition-colors"
              >
                Today
              </button>
              <button
                type="button"
                onClick={handleSelectYesterday}
                className="px-2.5 py-1 text-xs font-semibold rounded hover:bg-white text-slate-700 transition-colors"
              >
                Yesterday (Prior)
              </button>
              <button
                type="button"
                onClick={() => setDateMode('RANGE')}
                className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
                  dateMode === 'RANGE' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-700 hover:bg-white'
                }`}
              >
                Date Range
              </button>
            </div>
          </div>

          {/* Date Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {dateMode === 'SINGLE' ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">Selected Date:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-slate-50 focus:outline-none"
                />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">From:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="text-xs px-2 py-1.5 border border-slate-300 rounded-lg bg-slate-50"
                />
                <span className="text-xs text-slate-500 font-medium">To:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="text-xs px-2 py-1.5 border border-slate-300 rounded-lg bg-slate-50"
                />
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Shift:</span>
              <select
                value={selectedShift}
                onChange={e => setSelectedShift(e.target.value)}
                className="text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
              >
                <option value="ALL">ALL Shifts</option>
                <option value="A">Shift A</option>
                <option value="B">Shift B</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 8 Executive KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold uppercase text-slate-500">Total Plan</span>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1">{totalPlan}</div>
          <span className="text-[10px] text-slate-400">Scheduled</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold uppercase text-blue-600">Total Actual</span>
          <div className="text-xl font-bold font-mono text-blue-900 mt-1">{totalActual}</div>
          <span className="text-[10px] text-blue-600">Castings</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold uppercase text-slate-500">Achievement</span>
          <div className="text-xl font-bold font-mono mt-1">
            <span
              className={
                achievementPct >= settings.excellent_threshold
                  ? 'text-emerald-600'
                  : achievementPct >= settings.good_threshold
                  ? 'text-blue-600'
                  : achievementPct >= settings.warning_threshold
                  ? 'text-amber-600'
                  : 'text-rose-600'
              }
            >
              {achievementPct}%
            </span>
          </div>
          <span className="text-[10px] text-slate-400">vs target</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold uppercase text-rose-600">Rejections</span>
          <div className="text-xl font-bold font-mono text-rose-700 mt-1">{totalRejection}</div>
          <span className="text-[10px] text-slate-400">Scrap units</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold uppercase text-rose-600">Rejection %</span>
          <div className="text-xl font-bold font-mono text-rose-700 mt-1">{rejectionPct}%</div>
          <span className="text-[10px] text-slate-400">Scrap rate</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold uppercase text-amber-600">Breakdown</span>
          <div className="text-xl font-bold font-mono text-amber-800 mt-1">{totalBreakdown}m</div>
          <span className="text-[10px] text-slate-400">Stoppage min</span>
        </div>

        <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200 shadow-sm">
          <span className="text-[10px] font-bold uppercase text-emerald-800">Best GDC</span>
          <div className="text-base font-bold font-mono text-emerald-900 mt-1 truncate">
            {bestGDC ? `${bestGDC.gdc_code} (${bestGDC.achievement_pct}%)` : 'N/A'}
          </div>
          <span className="text-[10px] text-emerald-700">Top performer</span>
        </div>

        <div className="bg-rose-50/70 p-3.5 rounded-xl border border-rose-200 shadow-sm">
          <span className="text-[10px] font-bold uppercase text-rose-800">Worst GDC</span>
          <div className="text-base font-bold font-mono text-rose-900 mt-1 truncate">
            {worstGDC ? `${worstGDC.gdc_code} (${worstGDC.achievement_pct}%)` : 'N/A'}
          </div>
          <span className="text-[10px] text-rose-700">Needs attention</span>
        </div>
      </div>

      {/* GDC Machine Performance Ranking Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-sm font-bold text-slate-900">GDC Machine Ranking & Status</h3>
            <p className="text-xs text-slate-500">Sorted by achievement % with configurable threshold status</p>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-600">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span>&gt;={settings.excellent_threshold}% Excellent</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span>&gt;={settings.good_threshold}% Good</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span>&gt;={settings.warning_threshold}% Warning</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500"></span>&lt;{settings.warning_threshold}% Critical</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-semibold text-[11px] border-b border-slate-200">
                <th className="py-2.5 px-3">Rank</th>
                <th className="py-2.5 px-3">GDC Machine</th>
                <th className="py-2.5 px-3">Furnace</th>
                <th className="py-2.5 px-3 text-right">Plan</th>
                <th className="py-2.5 px-3 text-right">Actual</th>
                <th className="py-2.5 px-3 text-right">Achievement %</th>
                <th className="py-2.5 px-3 text-right">Rejection</th>
                <th className="py-2.5 px-3 text-right">Breakdown</th>
                <th className="py-2.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {gdcRankings.map((g, idx) => (
                <tr key={g.gdc_id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-600">#{idx + 1}</td>
                  <td className="py-2.5 px-3 font-bold text-slate-900">{g.gdc_code}</td>
                  <td className="py-2.5 px-3 text-slate-600">{g.furnace_id}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-700">{g.plan}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-700">{g.actual}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] ${
                        g.achievement_pct >= settings.excellent_threshold
                          ? 'bg-emerald-100 text-emerald-800'
                          : g.achievement_pct >= settings.good_threshold
                          ? 'bg-blue-100 text-blue-800'
                          : g.achievement_pct >= settings.warning_threshold
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {g.achievement_pct}%
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-rose-600">{g.rejection}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-amber-700">{g.breakdown_min}m</td>
                  <td className="py-2.5 px-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        g.status === 'Excellent'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : g.status === 'Good'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : g.status === 'Warning'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {g.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Shift A vs Shift B Comparison Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-1">Shift A vs Shift B Performance</h3>
          <p className="text-xs text-slate-500 mb-4">Comparison of volume, scrap, and downtime</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={shiftComparison} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="shift" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1E293B', borderRadius: '8px', color: '#FFF', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="plan" name="Plan" fill="#CBD5E1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actual" name="Actual" fill="#2563EB" radius={[4, 4, 0, 0]} />
                <Bar dataKey="rejection" name="Rejections" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* GDC Achievement comparison bar */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-1">GDC Machine Output Comparison</h3>
          <p className="text-xs text-slate-500 mb-4">Plan vs Actual across 8 GDC Machines</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gdcRankings} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="gdc_code" tick={{ fontSize: 10, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 10, fill: '#64748B' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1E293B', borderRadius: '8px', color: '#FFF', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="actual" name="Actual" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="plan" name="Plan" fill="#94A3B8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
