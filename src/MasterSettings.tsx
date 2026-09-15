import React, { useState } from 'react';
import { useApp } from './AppContext';
import { FurnaceMaster, GDCMaster, ModelMaster, SystemSettings } from './types';
import { db } from './firebase';
import { doc, setDoc } from 'firebase/firestore';
import { logAudit } from './dbService';
import { Settings, Plus, Edit2, CheckCircle2, Shield, Wrench, Flame, Cpu } from 'lucide-react';

export const MasterSettings: React.FC = () => {
  const {
    currentUser,
    furnaces,
    gdcMachines,
    models,
    rejectionCategories,
    settings,
    updateSettings,
    reloadMasters
  } = useApp();

  const [activeTab, setActiveTab] = useState<'MODELS' | 'GDCS' | 'FURNACES' | 'SETTINGS'>('MODELS');

  // New Model Form
  const [newModelCode, setNewModelCode] = useState('');
  const [newModelName, setNewModelName] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  // Planning Configuration Form
  const [planPerGdc, setPlanPerGdc] = useState(settings.default_plan_per_gdc_per_hour);
  const [excellentThresh, setExcellentThresh] = useState(settings.excellent_threshold);
  const [goodThresh, setGoodThresh] = useState(settings.good_threshold);
  const [warningThresh, setWarningThresh] = useState(settings.warning_threshold);

  const handleAddModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModelCode.trim()) return;

    try {
      const modelId = `mod_${Date.now()}`;
      const newM: ModelMaster = {
        model_id: modelId,
        model_code: newModelCode.trim().toUpperCase(),
        model_name: newModelName.trim() || newModelCode.trim().toUpperCase(),
        status: 'ACTIVE',
        created_at: new Date().toISOString()
      };

      await setDoc(doc(db, 'models', modelId), newM);
      await logAudit(currentUser, 'CREATE', 'models', modelId, undefined, newM);
      await reloadMasters();

      setNewModelCode('');
      setNewModelName('');
      setMsg('New casting model registered successfully.');
      setTimeout(() => setMsg(null), 3000);
    } catch (e: any) {
      console.error('Failed to add model:', e);
    }
  };

  const handleToggleModelStatus = async (model: ModelMaster) => {
    try {
      const updatedStatus = model.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await setDoc(doc(db, 'models', model.model_id), { ...model, status: updatedStatus }, { merge: true });
      await logAudit(currentUser, 'UPDATE', 'models', model.model_id, { status: model.status }, { status: updatedStatus });
      await reloadMasters();
    } catch (e) {
      console.error('Failed to update model status:', e);
    }
  };

  const handleSavePlanSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateSettings({
      ...settings,
      default_plan_per_gdc_per_hour: Number(planPerGdc),
      excellent_threshold: Number(excellentThresh),
      good_threshold: Number(goodThresh),
      warning_threshold: Number(warningThresh)
    });
    setMsg('Manufacturing planning benchmarks and thresholds saved.');
    setTimeout(() => setMsg(null), 3000);
  };

  return (
    <div id="masters-settings-container" className="space-y-6">
      {/* Banner */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
              Plant Engineering
            </span>
            <span className="text-xs text-slate-500">Master Data & Benchmark Thresholds</span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 mt-1">Master Configuration & Plant Benchmarks</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        {(['MODELS', 'GDCS', 'FURNACES', 'SETTINGS'] as const).map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
              activeTab === tab ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab === 'MODELS' && 'Component Models'}
            {tab === 'GDCS' && 'GDC Machines'}
            {tab === 'FURNACES' && 'Furnaces'}
            {tab === 'SETTINGS' && 'Planning Benchmarks'}
          </button>
        ))}
      </div>

      {msg && (
        <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{msg}</span>
        </div>
      )}

      {/* Tab 1: Models */}
      {activeTab === 'MODELS' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-600" />
              Register New Casting Model
            </h3>
            <form onSubmit={handleAddModel} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Model Code</label>
                <input
                  type="text"
                  placeholder="e.g. U244-4 or DISC-3"
                  value={newModelCode}
                  onChange={e => setNewModelCode(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Model Description</label>
                <input
                  type="text"
                  placeholder="e.g. Front Brake Disc Cavity 2"
                  value={newModelName}
                  onChange={e => setNewModelName(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm"
              >
                Register Model
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Registered Casting Models ({models.length})</h3>
              <span className="text-xs text-slate-500">Active in Hourly Dropdowns</span>
            </div>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-semibold text-[11px] border-b border-slate-200">
                  <th className="py-2.5 px-3">Model Code</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-center">Toggle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {models.map(m => (
                  <tr key={m.model_id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-700">{m.model_code}</td>
                    <td className="py-2.5 px-3 text-slate-600">{m.model_name}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          m.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {m.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={() => handleToggleModelStatus(m)}
                        className="text-xs text-blue-600 hover:underline font-semibold"
                      >
                        {m.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: GDC Machines */}
      {activeTab === 'GDCS' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">GDC Machines Configuration</h3>
            <span className="text-xs text-slate-500">Furnace Mapping & Default Patterns</span>
          </div>
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-semibold text-[11px] border-b border-slate-200">
                <th className="py-2.5 px-3">Machine Code</th>
                <th className="py-2.5 px-3">Station Name</th>
                <th className="py-2.5 px-3">Furnace Feeding</th>
                <th className="py-2.5 px-3">Default Model</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {gdcMachines.map(g => (
                <tr key={g.gdc_id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{g.gdc_code}</td>
                  <td className="py-2.5 px-3 text-slate-600">{g.gdc_name}</td>
                  <td className="py-2.5 px-3 font-semibold text-amber-700">{g.furnace_id}</td>
                  <td className="py-2.5 px-3 font-mono text-blue-700">{g.default_model || '-'}</td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700">
                      {g.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Furnaces */}
      {activeTab === 'FURNACES' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Melting Furnaces Master</h3>
            <span className="text-xs text-slate-500">Molten Aluminum Feeder Systems</span>
          </div>
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-semibold text-[11px] border-b border-slate-200">
                <th className="py-2.5 px-3">Furnace Code</th>
                <th className="py-2.5 px-3">Furnace Description</th>
                <th className="py-2.5 px-3">Connected GDCs</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {furnaces.map(f => (
                <tr key={f.furnace_id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-mono font-bold text-amber-800">{f.furnace_code}</td>
                  <td className="py-2.5 px-3 text-slate-700">{f.furnace_name}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-600">
                    {f.furnace_code === 'F-1' ? 'GDC-1 to GDC-4' : 'GDC-5 to GDC-8'}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700">
                      {f.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 4: Planning Benchmarks & System Settings */}
      {activeTab === 'SETTINGS' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm max-w-2xl">
          <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
            <Wrench className="w-4 h-4 text-blue-600" />
            Configurable Planning & Achievement Logic
          </h3>
          <p className="text-xs text-slate-500 mb-5">
            Modify factory targets without hardcoding logic. Hourly plans and achievement statuses update dynamically.
          </p>

          <form onSubmit={handleSavePlanSettings} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Default Plan Per GDC Per Hour (Castings/hr)
              </label>
              <input
                type="number"
                value={planPerGdc}
                onChange={e => setPlanPerGdc(Number(e.target.value))}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 font-mono font-bold"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Standard baseline in Excel is 16 units &times; 8 GDCs = 128 units/hr.
              </span>
            </div>

            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
              <span className="text-xs font-bold text-slate-800 block">Achievement Classification Thresholds (%)</span>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-emerald-700 font-semibold block mb-1">Excellent (&gt;=)</label>
                  <input
                    type="number"
                    value={excellentThresh}
                    onChange={e => setExcellentThresh(Number(e.target.value))}
                    className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-blue-700 font-semibold block mb-1">Good (&gt;=)</label>
                  <input
                    type="number"
                    value={goodThresh}
                    onChange={e => setGoodThresh(Number(e.target.value))}
                    className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-amber-700 font-semibold block mb-1">Warning (&gt;=)</label>
                  <input
                    type="number"
                    value={warningThresh}
                    onChange={e => setWarningThresh(Number(e.target.value))}
                    className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded bg-white font-mono"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm"
            >
              Save Configuration
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
