import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from './AppContext';
import { RejectionRecord } from './types';
import { fetchRejectionRecords, logAudit } from './dbService';
import { db } from './firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart, Legend, PieChart, Pie, Cell
} from 'recharts';
import { Plus, Trash2, AlertOctagon, CheckCircle2, Filter, Layers, PieChart as PieIcon } from 'lucide-react';

const COLORS = ['#EF4444', '#F97316', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899'];

export const RejectionManagement: React.FC = () => {
  const { currentUser, gdcMachines, models, rejectionCategories, furnaces } = useApp();

  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [shift, setShift] = useState<'A' | 'B'>('A');
  const [records, setRecords] = useState<RejectionRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // New Rejection Form State
  const [gdcMachine, setGdcMachine] = useState<string>(gdcMachines[0]?.gdc_id || 'GDC-1');
  const [model, setModel] = useState<string>(models[0]?.model_code || 'U244-3');
  const [category, setCategory] = useState<string>(rejectionCategories[0]?.category_name || 'Shrinkage / Porosity');
  const [side, setSide] = useState<'LH' | 'RH' | 'BOTH'>('LH');
  const [quantity, setQuantity] = useState<number>(1);
  const [remarks, setRemarks] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadRejections = async () => {
    try {
      setLoading(true);
      const data = await fetchRejectionRecords(date, date);
      setRecords(data);
    } catch (e) {
      console.error('Error fetching rejections:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRejections();
  }, [date]);

  const handleAddRejection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quantity <= 0) {
      setMsg({ type: 'error', text: 'Quantity must be greater than 0.' });
      return;
    }

    try {
      setSaving(true);
      setMsg(null);

      const targetGdc = gdcMachines.find(g => g.gdc_id === gdcMachine);
      const furnace = targetGdc?.furnace_id || 'F-1';

      const rejId = `rej_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const rec: RejectionRecord = {
        rejection_id: rejId,
        date,
        shift,
        furnace,
        gdc_machine: gdcMachine,
        model,
        rejection_category: category,
        side,
        quantity: Number(quantity),
        remarks,
        created_by: currentUser.name,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await setDoc(doc(db, 'rejection_records', rejId), rec);
      await logAudit(currentUser, 'CREATE', 'rejection_records', rejId, undefined, rec);

      setMsg({ type: 'success', text: `Rejection of ${quantity} pcs logged successfully.` });
      setQuantity(1);
      setRemarks('');
      await loadRejections();
    } catch (err: any) {
      console.error('Error adding rejection:', err);
      setMsg({ type: 'error', text: 'Failed to add rejection: ' + err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (rejId: string) => {
    if (!window.confirm('Are you sure you want to delete this rejection record?')) return;
    try {
      await deleteDoc(doc(db, 'rejection_records', rejId));
      await logAudit(currentUser, 'DELETE', 'rejection_records', rejId);
      setRecords(prev => prev.filter(r => r.rejection_id !== rejId));
      setMsg({ type: 'success', text: 'Rejection record deleted.' });
    } catch (e: any) {
      setMsg({ type: 'error', text: 'Failed to delete: ' + e.message });
    }
  };

  // Pareto Chart: Category-wise rejections sorted descending with cumulative percentage line
  const paretoData = useMemo(() => {
    const map = new Map<string, number>();
    records.forEach(r => {
      map.set(r.rejection_category, (map.get(r.rejection_category) || 0) + r.quantity);
    });

    const total = Array.from(map.values()).reduce((a, b) => a + b, 0);
    const sorted = Array.from(map.entries())
      .map(([cat, qty]) => ({ category: cat, quantity: qty }))
      .sort((a, b) => b.quantity - a.quantity);

    let cum = 0;
    return sorted.map(item => {
      cum += item.quantity;
      return {
        ...item,
        cum_pct: total > 0 ? Math.round((cum / total) * 1000) / 10 : 0
      };
    });
  }, [records]);

  // Orientation Distribution (LH, RH, BOTH)
  const orientationData = useMemo(() => {
    const map: Record<string, number> = { LH: 0, RH: 0, BOTH: 0 };
    records.forEach(r => {
      map[r.side] = (map[r.side] || 0) + r.quantity;
    });
    return [
      { name: 'LH Side', value: map.LH },
      { name: 'RH Side', value: map.RH },
      { name: 'Both Sides', value: map.BOTH }
    ];
  }, [records]);

  // Rejection by GDC
  const gdcRejections = useMemo(() => {
    const map = new Map<string, number>();
    records.forEach(r => {
      map.set(r.gdc_machine, (map.get(r.gdc_machine) || 0) + r.quantity);
    });
    return gdcMachines.map(g => ({
      gdc: g.gdc_code,
      quantity: map.get(g.gdc_id) || 0
    }));
  }, [records, gdcMachines]);

  const totalScrap = records.reduce((s, r) => s + r.quantity, 0);

  return (
    <div id="rejection-management-container" className="space-y-6">
      {/* Top Banner & Date Filter */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
              Quality Assurance
            </span>
            <span className="text-xs text-slate-500">Defect Logging & Pareto Analysis</span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 mt-1">Foundry Rejection & Scrap Tracking</h1>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-600">Production Date:</label>
          <input
            id="rejection-date-filter"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="text-xs px-3 py-1.5 border border-slate-300 rounded-lg bg-slate-50"
          />
        </div>
      </div>

      {/* Grid: Form & Pareto */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Log Rejection Form */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-rose-600" />
            Log Casting Defect Record
          </h2>

          <form onSubmit={handleAddRejection} className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Shift</label>
              <div className="grid grid-cols-2 gap-2">
                {(['A', 'B'] as const).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setShift(s)}
                    className={`py-1.5 text-xs font-bold rounded-lg border ${
                      shift === s ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    Shift {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">GDC Machine</label>
                <select
                  id="rej-gdc-select"
                  value={gdcMachine}
                  onChange={e => setGdcMachine(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                >
                  {gdcMachines.map(g => (
                    <option key={g.gdc_id} value={g.gdc_id}>
                      {g.gdc_code} ({g.furnace_id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Model</label>
                <select
                  id="rej-model-select"
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                >
                  {models.map(m => (
                    <option key={m.model_id} value={m.model_code}>
                      {m.model_code}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Defect Category</label>
              <select
                id="rej-cat-select"
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
              >
                {rejectionCategories.map(c => (
                  <option key={c.category_id} value={c.category_name}>
                    {c.category_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Side / Orientation</label>
                <select
                  id="rej-side-select"
                  value={side}
                  onChange={e => setSide(e.target.value as any)}
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="LH">LH (Left Hand)</option>
                  <option value="RH">RH (Right Hand)</option>
                  <option value="BOTH">BOTH Sides</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Quantity (pcs)</label>
                <input
                  id="rej-qty-input"
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={e => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Observation / Remarks</label>
              <input
                id="rej-remark-input"
                type="text"
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder="e.g. Pin gate porosity at boss section"
                className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
              />
            </div>

            {msg && (
              <div
                className={`p-2.5 rounded-lg text-xs flex items-center gap-1.5 ${
                  msg.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{msg.text}</span>
              </div>
            )}

            <button
              id="log-rejection-btn"
              type="submit"
              disabled={saving}
              className="w-full py-2 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 transition-colors shadow-sm disabled:opacity-50"
            >
              {saving ? 'Logging Defect...' : 'Save Rejection Record'}
            </button>
          </form>
        </div>

        {/* Pareto Chart (Highest to Lowest Category + Cumulative %) */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Rejection Pareto Analysis</h3>
              <p className="text-xs text-slate-500">Defect frequency sorted descending with cumulative % curve (80/20 rule)</p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 block">Total Defects</span>
              <span className="text-lg font-bold font-mono text-rose-600">{totalScrap} pcs</span>
            </div>
          </div>

          <div className="h-72 w-full">
            {paretoData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={paretoData} margin={{ top: 10, right: 20, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="category" angle={-15} textAnchor="end" tick={{ fontSize: 9, fill: '#64748B' }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#64748B' }} />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748B' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1E293B', borderRadius: '8px', color: '#FFF', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar yAxisId="left" dataKey="quantity" name="Defect Quantity" fill="#EF4444" radius={[4, 4, 0, 0]} />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="cum_pct"
                    name="Cumulative %"
                    stroke="#2563EB"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No rejection records logged for {date}.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Side Orientation & Machine Rejection Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-1">Orientation Breakdown (LH vs RH vs BOTH)</h3>
          <p className="text-xs text-slate-500 mb-3">Defect location distribution</p>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={orientationData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={4} dataKey="value">
                  {orientationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-1">Rejection by GDC Machine</h3>
          <p className="text-xs text-slate-500 mb-3">Defects per casting station</p>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gdcRejections} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="gdc" tick={{ fontSize: 10, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 10, fill: '#64748B' }} />
                <Tooltip />
                <Bar dataKey="quantity" name="Rejections" fill="#F97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Detailed Rejection Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Logged Rejections for {date}</h3>
          <span className="text-xs font-mono text-slate-500">{records.length} records</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-semibold text-[11px] border-b border-slate-200">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Shift</th>
                <th className="py-2.5 px-3">GDC</th>
                <th className="py-2.5 px-3">Furnace</th>
                <th className="py-2.5 px-3">Model</th>
                <th className="py-2.5 px-3">Defect Category</th>
                <th className="py-2.5 px-3">Side</th>
                <th className="py-2.5 px-3 text-right">Qty</th>
                <th className="py-2.5 px-3">Remarks</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {records.length > 0 ? (
                records.map(r => (
                  <tr key={r.rejection_id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-mono text-slate-600">{r.date}</td>
                    <td className="py-2 px-3 font-bold text-slate-800">Shift {r.shift}</td>
                    <td className="py-2 px-3 font-semibold text-slate-900">{r.gdc_machine}</td>
                    <td className="py-2 px-3 text-slate-600">{r.furnace}</td>
                    <td className="py-2 px-3 font-mono text-blue-700">{r.model}</td>
                    <td className="py-2 px-3 font-medium text-rose-700">{r.rejection_category}</td>
                    <td className="py-2 px-3 font-mono text-slate-700">{r.side}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-rose-600">{r.quantity}</td>
                    <td className="py-2 px-3 text-slate-500 text-[11px]">{r.remarks || '-'}</td>
                    <td className="py-2 px-3 text-center">
                      <button
                        onClick={() => handleDelete(r.rejection_id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                        title="Delete record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="py-6 text-center text-slate-400 text-xs">
                    No rejection records found for {date}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
