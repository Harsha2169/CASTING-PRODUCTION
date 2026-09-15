import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from './AppContext';
import { HourlyTemperature } from './types';
import { fetchHourlyTemperatures, fetchDistinctProductionDates } from './dbService';
import { db } from './firebase';
import { doc, setDoc } from 'firebase/firestore';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine
} from 'recharts';
import { Thermometer, ShieldAlert, CheckCircle2, Save, Filter, AlertTriangle } from 'lucide-react';

export const TemperatureMonitoring: React.FC = () => {
  const { hourSlots, settings, updateSettings, currentUser } = useApp();

  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedShift, setSelectedShift] = useState<string>('A');
  const [temps, setTemps] = useState<HourlyTemperature[]>([]);
  const [distinctDates, setDistinctDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Settings editing state
  const [minF1, setMinF1] = useState<number>(settings.min_f1_temp);
  const [maxF1, setMaxF1] = useState<number>(settings.max_f1_temp);
  const [minF2, setMinF2] = useState<number>(settings.min_f2_temp);
  const [maxF2, setMaxF2] = useState<number>(settings.max_f2_temp);
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchDistinctProductionDates().then(dates => {
      setDistinctDates(dates);
      if (dates.length > 0 && !dates.includes(selectedDate)) {
        setSelectedDate(dates[0]);
      }
    });
  }, []);

  const loadTemps = async () => {
    try {
      setLoading(true);
      const data = await fetchHourlyTemperatures(selectedDate, selectedShift);
      setTemps(data);
    } catch (e) {
      console.error('Failed to load temperatures:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemps();
  }, [selectedDate, selectedShift]);

  const handleSaveThresholds = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateSettings({
      ...settings,
      min_f1_temp: Number(minF1),
      max_f1_temp: Number(maxF1),
      min_f2_temp: Number(minF2),
      max_f2_temp: Number(maxF2)
    });
    setSettingsMsg('Temperature operating window updated successfully.');
    setTimeout(() => setSettingsMsg(null), 3500);
  };

  // Full chronological chart data for 12 hours
  const chartData = useMemo(() => {
    const slots = [...hourSlots].sort((a, b) => a.sequence - b.sequence);
    return slots.map(slot => {
      const rec = temps.find(t => t.hour_id === slot.hour_id);
      const f1 = rec?.furnace_1_temperature || null;
      const f2 = rec?.furnace_2_temperature || null;

      const f1OutOfRange = f1 !== null && (f1 < settings.min_f1_temp || f1 > settings.max_f1_temp);
      const f2OutOfRange = f2 !== null && (f2 < settings.min_f2_temp || f2 > settings.max_f2_temp);

      return {
        label: slot.display_label.replace(' - ', '-'),
        hour_id: slot.hour_id,
        f1_temp: f1,
        f2_temp: f2,
        f1_alert: f1OutOfRange,
        f2_alert: f2OutOfRange
      };
    });
  }, [hourSlots, temps, settings]);

  const outOfRangeCount = chartData.filter(d => d.f1_alert || d.f2_alert).length;

  return (
    <div id="temperature-monitoring-container" className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
              Thermal Process Control
            </span>
            <span className="text-xs text-slate-500">Molten Aluminum Bath Temperature Surveillance</span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 mt-1">Furnace F-1 & F-2 Hourly Temperature Control</h1>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-600">Date:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-slate-50"
          />

          <label className="text-xs font-semibold text-slate-600">Shift:</label>
          <select
            value={selectedShift}
            onChange={e => setSelectedShift(e.target.value)}
            className="text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
          >
            <option value="A">Shift A</option>
            <option value="B">Shift B</option>
          </select>
        </div>
      </div>

      {/* Main Temperature Trend Chart */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Hourly Molten Metal Temperature (°C)</h3>
            <p className="text-xs text-slate-500">
              Continuous thermal log vs configurable upper/lower operating thresholds ({settings.min_f1_temp}°C - {settings.max_f1_temp}°C)
            </p>
          </div>
          {outOfRangeCount > 0 ? (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-50 border border-rose-200 rounded-lg text-xs font-bold text-rose-700">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <span>{outOfRangeCount} Thermal Excursions</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-bold text-emerald-700">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>All Temperatures Nominal</span>
            </div>
          )}
        </div>

        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748B' }} />
              <YAxis domain={[650, 800]} tick={{ fontSize: 11, fill: '#64748B' }} />
              <Tooltip
                formatter={(val: any) => [`${val} °C`]}
                contentStyle={{ backgroundColor: '#1E293B', borderRadius: '8px', color: '#FFF', fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <ReferenceLine y={settings.min_f1_temp} stroke="#EF4444" strokeDasharray="3 3" label={{ value: `Min (${settings.min_f1_temp}°C)`, fill: '#EF4444', fontSize: 10 }} />
              <ReferenceLine y={settings.max_f1_temp} stroke="#EF4444" strokeDasharray="3 3" label={{ value: `Max (${settings.max_f1_temp}°C)`, fill: '#EF4444', fontSize: 10 }} />
              <Line
                type="monotone"
                dataKey="f1_temp"
                name="Furnace 1 (°C)"
                stroke="#F59E0B"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#F59E0B' }}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="f2_temp"
                name="Furnace 2 (°C)"
                stroke="#3B82F6"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#3B82F6' }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Temperature Limits Configuration & Hourly Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configurable Range Form */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
            <Thermometer className="w-4 h-4 text-amber-500" />
            Configurable Temperature Limits
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Specify safe molten temperature operating windows for Furnaces 1 & 2.
          </p>

          <form onSubmit={handleSaveThresholds} className="space-y-4">
            <div className="p-3 bg-amber-50/50 rounded-lg border border-amber-200">
              <span className="text-xs font-bold text-amber-900 block mb-2">Furnace 1 Range</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-600 block">Min (°C)</label>
                  <input
                    type="number"
                    value={minF1}
                    onChange={e => setMinF1(Number(e.target.value))}
                    className="w-full text-xs px-2 py-1 border border-slate-300 rounded bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-600 block">Max (°C)</label>
                  <input
                    type="number"
                    value={maxF1}
                    onChange={e => setMaxF1(Number(e.target.value))}
                    className="w-full text-xs px-2 py-1 border border-slate-300 rounded bg-white font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-200">
              <span className="text-xs font-bold text-blue-900 block mb-2">Furnace 2 Range</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-600 block">Min (°C)</label>
                  <input
                    type="number"
                    value={minF2}
                    onChange={e => setMinF2(Number(e.target.value))}
                    className="w-full text-xs px-2 py-1 border border-slate-300 rounded bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-600 block">Max (°C)</label>
                  <input
                    type="number"
                    value={maxF2}
                    onChange={e => setMaxF2(Number(e.target.value))}
                    className="w-full text-xs px-2 py-1 border border-slate-300 rounded bg-white font-mono"
                  />
                </div>
              </div>
            </div>

            {settingsMsg && (
              <div className="p-2 bg-emerald-50 text-emerald-800 text-xs rounded border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{settingsMsg}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-900 transition-colors shadow-sm"
            >
              Update Safe Temperature Limits
            </button>
          </form>
        </div>

        {/* Hourly Log Data Table */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Hourly Readings Log</h3>
            <span className="text-xs text-slate-500 font-mono">{chartData.length} Hourly Slots</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-semibold text-[11px] border-b border-slate-200">
                  <th className="py-2.5 px-3">Hour Slot</th>
                  <th className="py-2.5 px-3 text-center">F-1 Temp (°C)</th>
                  <th className="py-2.5 px-3 text-center">F-1 Status</th>
                  <th className="py-2.5 px-3 text-center">F-2 Temp (°C)</th>
                  <th className="py-2.5 px-3 text-center">F-2 Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {chartData.map(d => (
                  <tr key={d.hour_id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{d.label}</td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold">
                      {d.f1_temp !== null ? `${d.f1_temp}°C` : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {d.f1_temp === null ? (
                        <span className="text-slate-400">-</span>
                      ) : d.f1_alert ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                          Excursion
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Normal
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold">
                      {d.f2_temp !== null ? `${d.f2_temp}°C` : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {d.f2_temp === null ? (
                        <span className="text-slate-400">-</span>
                      ) : d.f2_alert ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                          Excursion
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Normal
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
