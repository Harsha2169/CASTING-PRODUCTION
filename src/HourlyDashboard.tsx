import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from './AppContext';
import { ProductionRecord, HourlyTemperature, RejectionRecord } from './types';
import { fetchProductionRecords, fetchHourlyTemperatures, fetchRejectionRecords, fetchDistinctProductionDates } from './dbService';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, AreaChart, Area
} from 'recharts';
import {
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Activity,
  Layers,
  Thermometer,
  Filter,
  Calendar,
  Clock,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

export const HourlyDashboard: React.FC = () => {
  const { hourSlots, gdcMachines, models, furnaces, settings } = useApp();

  // Filters
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedShift, setSelectedShift] = useState<string>('ALL');
  const [selectedFurnace, setSelectedFurnace] = useState<string>('ALL');
  const [selectedGdc, setSelectedGdc] = useState<string>('ALL');
  const [selectedModel, setSelectedModel] = useState<string>('ALL');

  // Data
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [temperatures, setTemperatures] = useState<HourlyTemperature[]>([]);
  const [rejections, setRejections] = useState<RejectionRecord[]>([]);
  const [distinctDates, setDistinctDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Load available distinct dates
  useEffect(() => {
    fetchDistinctProductionDates().then(dates => {
      setDistinctDates(dates);
      if (dates.length > 0 && !dates.includes(selectedDate)) {
        setSelectedDate(dates[0]);
      }
    });
  }, []);

  // Fetch production records based on filters
  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [prods, temps, rejs] = await Promise.all([
        fetchProductionRecords({
          startDate: selectedDate,
          endDate: selectedDate,
          shift: selectedShift,
          furnace: selectedFurnace,
          gdc: selectedGdc,
          model: selectedModel
        }),
        fetchHourlyTemperatures(selectedDate, selectedShift),
        fetchRejectionRecords(selectedDate, selectedDate)
      ]);

      setRecords(prods);
      setTemperatures(temps);
      setRejections(rejs);
    } catch (e) {
      console.error('Error loading hourly dashboard:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [selectedDate, selectedShift, selectedFurnace, selectedGdc, selectedModel]);

  // Aggregated KPIs
  const totalPlan = useMemo(() => records.reduce((s, r) => s + (r.planned_qty || 0), 0), [records]);
  const totalActual = useMemo(() => records.reduce((s, r) => s + (r.actual_qty || 0), 0), [records]);
  const achievementPct = useMemo(() => (totalPlan > 0 ? Math.round((totalActual / totalPlan) * 1000) / 10 : 0), [totalPlan, totalActual]);

  const totalBreakdownMin = useMemo(() => {
    // Unique by hour + machine to avoid duplicate summing if multiple records
    const hourMachineMap = new Set<string>();
    return records.reduce((s, r) => {
      const key = `${r.hour_id}_${r.gdc_machine}`;
      if (!hourMachineMap.has(key)) {
        hourMachineMap.add(key);
        return s + (r.breakdown_min || 0);
      }
      return s;
    }, 0);
  }, [records]);

  const totalRejectionQty = useMemo(() => {
    return rejections.reduce((sum, rej) => {
      if (selectedShift !== 'ALL' && rej.shift !== selectedShift) return sum;
      if (selectedFurnace !== 'ALL' && rej.furnace !== selectedFurnace) return sum;
      if (selectedGdc !== 'ALL' && rej.gdc_machine !== selectedGdc) return sum;
      if (selectedModel !== 'ALL' && rej.model !== selectedModel) return sum;
      return sum + rej.quantity;
    }, 0);
  }, [rejections, selectedShift, selectedFurnace, selectedGdc, selectedModel]);

  // Guaranteed Complete Chronological 12-hour Trend
  const hourlyTrendData = useMemo(() => {
    const slots = [...hourSlots].sort((a, b) => a.sequence - b.sequence);
    return slots.map(slot => {
      const slotRecs = records.filter(r => r.hour_id === slot.hour_id);
      const plan = slotRecs.reduce((s, r) => s + (r.planned_qty || 0), 0);
      const actual = slotRecs.reduce((s, r) => s + (r.actual_qty || 0), 0);
      const achieve = plan > 0 ? Math.round((actual / plan) * 1000) / 10 : 0;
      const bd = slotRecs.reduce((s, r) => s + (r.breakdown_min || 0), 0);

      const temp = temperatures.find(t => t.hour_id === slot.hour_id);

      return {
        hour_id: slot.hour_id,
        label: slot.display_label.replace(' - ', '-'),
        plan,
        actual,
        achievement_pct: achieve,
        breakdown_min: bd,
        f1_temp: temp?.furnace_1_temperature || null,
        f2_temp: temp?.furnace_2_temperature || null,
        hasData: slotRecs.length > 0
      };
    });
  }, [hourSlots, records, temperatures]);

  // GDC performance breakdown
  const gdcChartData = useMemo(() => {
    return gdcMachines.map(gdc => {
      const gdcRecs = records.filter(r => r.gdc_machine === gdc.gdc_id);
      const actual = gdcRecs.reduce((s, r) => s + (r.actual_qty || 0), 0);
      const plan = gdcRecs.reduce((s, r) => s + (r.planned_qty || 0), 0);
      const ach = plan > 0 ? Math.round((actual / plan) * 1000) / 10 : 0;
      return {
        gdc: gdc.gdc_code,
        actual,
        plan,
        achievement_pct: ach
      };
    });
  }, [gdcMachines, records]);

  // Model-wise production
  const modelChartData = useMemo(() => {
    const map = new Map<string, number>();
    records.forEach(r => {
      map.set(r.model, (map.get(r.model) || 0) + (r.actual_qty || 0));
    });
    return Array.from(map.entries())
      .map(([model, actual]) => ({ model, actual }))
      .sort((a, b) => b.actual - a.actual);
  }, [records]);

  // Furnace performance
  const furnaceData = useMemo(() => {
    return ['F-1', 'F-2'].map(fCode => {
      const fRecs = records.filter(r => r.furnace === fCode);
      const actual = fRecs.reduce((s, r) => s + (r.actual_qty || 0), 0);
      const plan = fRecs.reduce((s, r) => s + (r.planned_qty || 0), 0);
      const ach = plan > 0 ? Math.round((actual / plan) * 1000) / 10 : 0;
      return {
        furnace: fCode === 'F-1' ? 'Furnace 1 (GDC 1-4)' : 'Furnace 2 (GDC 5-8)',
        actual,
        plan,
        achievement_pct: ach
      };
    });
  }, [records]);

  return (
    <div id="hourly-dashboard-container" className="space-y-6">
      {/* Filter Control Bar */}
      <div id="hourly-filter-card" className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3 text-xs font-bold text-slate-800 uppercase tracking-wider">
          <Filter className="w-4 h-4 text-blue-600" />
          <span>Dashboard Filter Console (Dynamic Aggregation)</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Date Selector */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Date</label>
            <input
              id="hourly-filter-date"
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50"
            />
          </div>

          {/* Shift Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Shift</label>
            <select
              id="hourly-filter-shift"
              value={selectedShift}
              onChange={e => setSelectedShift(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
            >
              <option value="ALL">ALL Shifts</option>
              <option value="A">Shift A</option>
              <option value="B">Shift B</option>
            </select>
          </div>

          {/* Furnace Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Furnace</label>
            <select
              id="hourly-filter-furnace"
              value={selectedFurnace}
              onChange={e => setSelectedFurnace(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
            >
              <option value="ALL">ALL Furnaces</option>
              {furnaces.map(f => (
                <option key={f.furnace_id} value={f.furnace_code}>
                  {f.furnace_name}
                </option>
              ))}
            </select>
          </div>

          {/* GDC Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">GDC Machine</label>
            <select
              id="hourly-filter-gdc"
              value={selectedGdc}
              onChange={e => setSelectedGdc(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
            >
              <option value="ALL">ALL GDCs (1-8)</option>
              {gdcMachines.map(g => (
                <option key={g.gdc_id} value={g.gdc_id}>
                  {g.gdc_code}
                </option>
              ))}
            </select>
          </div>

          {/* Model Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Component Model</label>
            <select
              id="hourly-filter-model"
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
            >
              <option value="ALL">ALL Models</option>
              {models.map(m => (
                <option key={m.model_id} value={m.model_code}>
                  {m.model_code}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div id="hourly-kpi-grid" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>PLANNED TARGET</span>
            <Calendar className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-900">{totalPlan}</div>
          <span className="text-[11px] text-slate-400">Castings scheduled</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-blue-600 text-xs font-semibold">
            <span>ACTUAL CASTINGS</span>
            <Activity className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-blue-900">{totalActual}</div>
          <div className="flex items-center gap-1 text-[11px] font-medium text-blue-700">
            <span>Variance: {totalActual - totalPlan}</span>
            {totalActual >= totalPlan ? (
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <ArrowDownRight className="w-3.5 h-3.5 text-rose-600" />
            )}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>ACHIEVEMENT %</span>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono">
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
          <span className="text-[11px] text-slate-400">Threshold: &gt;={settings.good_threshold}%</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-rose-600 text-xs font-semibold">
            <span>REJECTIONS</span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-rose-700">{totalRejectionQty}</div>
          <span className="text-[11px] text-slate-400">
            Scrap rate:{' '}
            {totalActual > 0 ? (Math.round((totalRejectionQty / (totalActual + totalRejectionQty)) * 1000) / 10) : 0}%
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-amber-600 text-xs font-semibold">
            <span>BREAKDOWN TIME</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-amber-800">{totalBreakdownMin}m</div>
          <span className="text-[11px] text-slate-400">Stoppage minutes logged</span>
        </div>
      </div>

      {records.length === 0 && !loading && (
        <div className="p-8 bg-white border border-dashed border-slate-300 rounded-xl text-center">
          <Layers className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-700">No production data available for selected filters.</p>
          <p className="text-xs text-slate-500 mt-1">
            Ensure shift logs have been saved in the "Hourly Production Entry" tab for date {selectedDate}.
          </p>
        </div>
      )}

      {/* Chart 1: Guaranteed 12-Hour Chronological Plan vs Actual */}
      <div id="hourly-plan-actual-chart-card" className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Chronological Hourly Plan vs Actual Castings</h3>
            <p className="text-xs text-slate-500">
              Complete 12-hour timeline preserved (7AM - 7PM / 19:00). Zero actual rendered when no production.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-1 rounded">12 Operating Hours</span>
        </div>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourlyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1E293B', borderRadius: '8px', color: '#FFF', fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="plan" name="Hourly Plan" fill="#94A3B8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="actual" name="Hourly Actual" fill="#2563EB" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Grid of 2 Charts: Achievement Trend & Breakdown Minutes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hourly Achievement % Line */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Hourly Achievement Rate (%)</h3>
              <p className="text-xs text-slate-500">Efficiency tracking vs target threshold</p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hourlyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748B' }} />
                <YAxis domain={[0, 150]} tick={{ fontSize: 10, fill: '#64748B' }} />
                <Tooltip
                  formatter={(val: any) => [`${val}%`, 'Achievement']}
                  contentStyle={{ backgroundColor: '#1E293B', borderRadius: '8px', color: '#FFF', fontSize: '12px' }}
                />
                <Line
                  type="monotone"
                  dataKey="achievement_pct"
                  name="Achievement %"
                  stroke="#10B981"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#10B981' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Hourly Breakdown Minutes Area */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Hourly Stoppage Breakdown (Minutes)</h3>
              <p className="text-xs text-slate-500">Unplanned downtime across all active machines</p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourlyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 10, fill: '#64748B' }} />
                <Tooltip
                  formatter={(val: any) => [`${val} min`, 'Breakdown']}
                  contentStyle={{ backgroundColor: '#1E293B', borderRadius: '8px', color: '#FFF', fontSize: '12px' }}
                />
                <Area
                  type="monotone"
                  dataKey="breakdown_min"
                  name="Breakdown Min"
                  stroke="#EF4444"
                  fill="#FEE2E2"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Machine & Model Distributions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* GDC Machine Actuals */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-1">GDC Machine-wise Castings</h3>
          <p className="text-xs text-slate-500 mb-4">Actual output per machine (GDC-1 to 8)</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gdcChartData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#64748B' }} />
                <YAxis dataKey="gdc" type="category" tick={{ fontSize: 11, fill: '#334155' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1E293B', borderRadius: '8px', color: '#FFF', fontSize: '12px' }}
                />
                <Bar dataKey="actual" name="Actual" fill="#3B82F6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Model-wise Production */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-1">Model-wise Production</h3>
          <p className="text-xs text-slate-500 mb-4">Casting output grouped by component</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={modelChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="model" tick={{ fontSize: 9, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 10, fill: '#64748B' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1E293B', borderRadius: '8px', color: '#FFF', fontSize: '12px' }}
                />
                <Bar dataKey="actual" name="Actual Castings" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Furnace Breakdown */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-1">Furnace Output Comparison</h3>
          <p className="text-xs text-slate-500 mb-4">Furnace 1 vs Furnace 2 volume</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={furnaceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="furnace" tick={{ fontSize: 9, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 10, fill: '#64748B' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1E293B', borderRadius: '8px', color: '#FFF', fontSize: '12px' }}
                />
                <Bar dataKey="actual" name="Actual" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                <Bar dataKey="plan" name="Plan" fill="#CBD5E1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
