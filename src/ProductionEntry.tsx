import React, { useState, useEffect } from 'react';
import { useApp } from './AppContext';
import { ProductionRecord, HourlyTemperature } from './types';
import { db } from './firebase';
import { collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import { logAudit, getProductionRecordId } from './dbService';
import {
  Save,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Clock,
  Info,
  Calendar,
  Layers,
  UserCheck,
  Check,
  HelpCircle,
  TrendingUp,
  Cpu
} from 'lucide-react';

interface GridHourRow {
  hour_id: string;
  display_label: string;
  hour_start: string;
  hour_end: string;
  sequence: number;
  f1_temp: number | '';
  f2_temp: number | '';
  gdc_actuals: Record<string, number | ''>; // gdc_id -> actual castings
  gdc_models: Record<string, string>;       // gdc_id -> model code
  gdc_plans: Record<string, number>;        // gdc_id -> planned qty (default 16)
  hourly_plan_override: number | '';        // optional total hour plan override (e.g. 128)
  breakdown_min: number | '';
  remarks: string;
}

const COMMON_REMARK_OPTIONS = [
  'Normal Production',
  'Machine breakdown',
  'Power issue',
  'Material shortage',
  'Maintenance',
  'Quality issue',
  'Manpower issue',
  'Die coating / cleaning',
  'Die warm-up / initial pour',
  'Hydraulic pin issue',
  'Other'
];

export const ProductionEntry: React.FC = () => {
  const { currentUser, gdcMachines, models, hourSlots, settings, furnaces, supervisors } = useApp();

  const activeSupervisors = supervisors.filter(s => s.status === 'ACTIVE');

  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedShift, setSelectedShift] = useState<'A' | 'B'>('A');
  const [supervisor, setSupervisor] = useState<string>(
    activeSupervisors[0]?.supervisor_name || 'Vijay'
  );
  const [gridRows, setGridRows] = useState<GridHourRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [isExistingRecordLoaded, setIsExistingRecordLoaded] = useState(false);

  // Top furnace quick sync / benchmark targets
  const [f1DefaultTemp, setF1DefaultTemp] = useState<number | ''>(710);
  const [f2DefaultTemp, setF2DefaultTemp] = useState<number | ''>(715);

  // Build pristine 12-hour grid structure
  const buildEmptyGrid = (): GridHourRow[] => {
    return hourSlots
      .filter(s => s.status === 'ACTIVE')
      .sort((a, b) => a.sequence - b.sequence)
      .map(slot => {
        const actuals: Record<string, number | ''> = {};
        const gdcModelMap: Record<string, string> = {};
        const gdcPlanMap: Record<string, number> = {};

        const defaultPlanPerGdc = settings.default_plan_per_gdc_per_hour || 16;

        gdcMachines.filter(g => g.status === 'ACTIVE').forEach(gdc => {
          actuals[gdc.gdc_id] = '';
          gdcModelMap[gdc.gdc_id] = gdc.default_model || models[0]?.model_code || 'U244-3';
          gdcPlanMap[gdc.gdc_id] = defaultPlanPerGdc;
        });

        return {
          hour_id: slot.hour_id,
          display_label: slot.display_label,
          hour_start: slot.hour_start,
          hour_end: slot.hour_end,
          sequence: slot.sequence,
          f1_temp: '',
          f2_temp: '',
          gdc_actuals: actuals,
          gdc_models: gdcModelMap,
          gdc_plans: gdcPlanMap,
          hourly_plan_override: '',
          breakdown_min: '',
          remarks: ''
        };
      });
  };

  // Load existing records for chosen Date & Shift from Firestore
  const loadRecords = async () => {
    try {
      setLoading(true);
      setMessage(null);
      const empty = buildEmptyGrid();

      // Query production records
      const prodQuery = query(
        collection(db, 'production_records'),
        where('date', '==', selectedDate),
        where('shift', '==', selectedShift)
      );

      // Query temperatures
      const tempQuery = query(
        collection(db, 'hourly_temperature'),
        where('date', '==', selectedDate),
        where('shift', '==', selectedShift)
      );

      const [prodSnap, tempSnap] = await Promise.all([getDocs(prodQuery), getDocs(tempQuery)]);

      const prodMap = new Map<string, ProductionRecord>();
      let foundSupervisor = '';

      prodSnap.docs.forEach(docSnap => {
        const rec = docSnap.data() as ProductionRecord;
        prodMap.set(`${rec.hour_id}_${rec.gdc_machine}`, rec);
        if (rec.supervisor && !foundSupervisor) {
          foundSupervisor = rec.supervisor;
        }
      });

      if (foundSupervisor) {
        setSupervisor(foundSupervisor);
      } else if (activeSupervisors.length > 0 && !activeSupervisors.some(s => s.supervisor_name === supervisor)) {
        setSupervisor(activeSupervisors[0].supervisor_name);
      }

      const tempMap = new Map<string, HourlyTemperature>();
      tempSnap.docs.forEach(docSnap => {
        const t = docSnap.data() as HourlyTemperature;
        tempMap.set(t.hour_id, t);
      });

      let recordsFound = false;

      // Populate grid with existing records
      const populated = empty.map(row => {
        const temp = tempMap.get(row.hour_id);
        const updatedRow = { ...row };
        if (temp) {
          recordsFound = true;
          updatedRow.f1_temp = temp.furnace_1_temperature || '';
          updatedRow.f2_temp = temp.furnace_2_temperature || '';
          if (temp.remarks && !updatedRow.remarks) {
            updatedRow.remarks = temp.remarks;
          }
        }

        let rowPlanSum = 0;
        gdcMachines.forEach(gdc => {
          const rec = prodMap.get(`${row.hour_id}_${gdc.gdc_id}`);
          if (rec) {
            recordsFound = true;
            updatedRow.gdc_actuals[gdc.gdc_id] = rec.actual_qty;
            updatedRow.gdc_models[gdc.gdc_id] = rec.model;
            updatedRow.gdc_plans[gdc.gdc_id] = rec.planned_qty;
            rowPlanSum += rec.planned_qty;
            if (rec.breakdown_min !== undefined) {
              updatedRow.breakdown_min = rec.breakdown_min;
            }
            if (rec.remarks) {
              updatedRow.remarks = rec.remarks;
            }
          }
        });

        // If plans were recorded and differ from default sum (8 * 16 = 128), set hourly plan
        if (rowPlanSum > 0) {
          updatedRow.hourly_plan_override = rowPlanSum;
        }

        return updatedRow;
      });

      setGridRows(populated);
      setUnsavedChanges(false);
      setIsExistingRecordLoaded(recordsFound);

      if (recordsFound) {
        setMessage({
          type: 'success',
          text: `Loaded existing production shift records for ${selectedDate} (Shift ${selectedShift}). You can edit and update directly.`
        });
      }
    } catch (e: any) {
      console.error('Error loading hourly production:', e);
      setMessage({ type: 'error', text: 'Error loading production records: ' + e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, [selectedDate, selectedShift, gdcMachines, hourSlots, settings]);

  // Actual production change per cell
  const handleActualChange = (hourId: string, gdcId: string, valStr: string) => {
    setUnsavedChanges(true);
    const val = valStr === '' ? '' : Math.max(0, parseInt(valStr, 10) || 0);
    setGridRows(prev =>
      prev.map(row => {
        if (row.hour_id !== hourId) return row;
        return {
          ...row,
          gdc_actuals: {
            ...row.gdc_actuals,
            [gdcId]: val
          }
        };
      })
    );
  };

  // Model change per GDC for the entire shift
  const handleModelChangeForGdc = (gdcId: string, modelCode: string) => {
    setUnsavedChanges(true);
    setGridRows(prev =>
      prev.map(row => ({
        ...row,
        gdc_models: {
          ...row.gdc_models,
          [gdcId]: modelCode
        }
      }))
    );
  };

  // Hourly plan override change
  const handleHourlyPlanChange = (hourId: string, valStr: string) => {
    setUnsavedChanges(true);
    const val = valStr === '' ? '' : Math.max(0, parseInt(valStr, 10) || 0);
    setGridRows(prev =>
      prev.map(row => {
        if (row.hour_id !== hourId) return row;
        // Distribute plan across active GDCs evenly
        const gdcCount = gdcMachines.length || 8;
        const perGdc = typeof val === 'number' && gdcCount > 0 ? Math.round(val / gdcCount) : settings.default_plan_per_gdc_per_hour || 16;
        const newPlans: Record<string, number> = {};
        gdcMachines.forEach(g => {
          newPlans[g.gdc_id] = perGdc;
        });

        return {
          ...row,
          hourly_plan_override: val,
          gdc_plans: newPlans
        };
      })
    );
  };

  // Furnace temperature change per hour
  const handleTempChange = (hourId: string, furnace: 'f1' | 'f2', valStr: string) => {
    setUnsavedChanges(true);
    const val = valStr === '' ? '' : Math.max(0, parseInt(valStr, 10) || 0);
    setGridRows(prev =>
      prev.map(row => {
        if (row.hour_id !== hourId) return row;
        return {
          ...row,
          [furnace === 'f1' ? 'f1_temp' : 'f2_temp']: val
        };
      })
    );
  };

  // Apply default furnace temperatures to all empty hours
  const handleApplyDefaultFurnaceTemps = () => {
    setUnsavedChanges(true);
    setGridRows(prev =>
      prev.map(row => ({
        ...row,
        f1_temp: row.f1_temp === '' ? f1DefaultTemp : row.f1_temp,
        f2_temp: row.f2_temp === '' ? f2DefaultTemp : row.f2_temp
      }))
    );
  };

  // Breakdown minutes change
  const handleBreakdownChange = (hourId: string, valStr: string) => {
    setUnsavedChanges(true);
    const val = valStr === '' ? '' : Math.max(0, parseInt(valStr, 10) || 0);
    setGridRows(prev =>
      prev.map(row => {
        if (row.hour_id !== hourId) return row;
        return { ...row, breakdown_min: val };
      })
    );
  };

  // Remarks change
  const handleRemarksChange = (hourId: string, text: string) => {
    setUnsavedChanges(true);
    setGridRows(prev =>
      prev.map(row => {
        if (row.hour_id !== hourId) return row;
        return { ...row, remarks: text };
      })
    );
  };

  // Save changes to Firestore
  const handleSaveProduction = async () => {
    if (!supervisor.trim()) {
      setMessage({ type: 'warning', text: 'Please specify the Shift Supervisor name before saving.' });
      return;
    }

    try {
      setSaving(true);
      setMessage(null);
      const batch = writeBatch(db);
      let recordsCount = 0;
      let tempCount = 0;
      const nowIso = new Date().toISOString();

      gridRows.forEach(row => {
        // 1. Save Temperature Log if specified
        if (row.f1_temp !== '' || row.f2_temp !== '') {
          const tempId = `${selectedDate}_${selectedShift}_${row.hour_id}`;
          const tempDocRef = doc(db, 'hourly_temperature', tempId);
          const tempData: HourlyTemperature = {
            temperature_id: tempId,
            date: selectedDate,
            shift: selectedShift,
            hour_id: row.hour_id,
            furnace_1_temperature: typeof row.f1_temp === 'number' ? row.f1_temp : 0,
            furnace_2_temperature: typeof row.f2_temp === 'number' ? row.f2_temp : 0,
            remarks: row.remarks || '',
            updated_at: nowIso,
            created_at: nowIso
          };
          batch.set(tempDocRef, tempData, { merge: true });
          tempCount++;
        }

        // 2. Determine hour plan
        const defaultTotalPlan = gdcMachines.length * (settings.default_plan_per_gdc_per_hour || 16);
        const hourTotalPlan = typeof row.hourly_plan_override === 'number' ? row.hourly_plan_override : defaultTotalPlan;
        const planPerGdc = Math.round(hourTotalPlan / (gdcMachines.length || 8));

        // 3. Save Normalized Production Records for each GDC machine
        gdcMachines.forEach(gdc => {
          const actual = row.gdc_actuals[gdc.gdc_id];
          const hasActual = actual !== '';
          const hasBreakdown = row.breakdown_min !== '';
          const hasRemarks = (row.remarks || '').trim().length > 0;

          // Save record if data is present
          if (hasActual || hasBreakdown || hasRemarks) {
            const actualQty = typeof actual === 'number' ? actual : 0;
            const planQty = row.gdc_plans[gdc.gdc_id] || planPerGdc;
            const achievePct = planQty > 0 ? Math.round((actualQty / planQty) * 1000) / 10 : 0;
            const modelCode = row.gdc_models[gdc.gdc_id] || gdc.default_model || 'U244-3';

            // Deterministic unique ID to prevent duplicates when updating
            const recordId = getProductionRecordId(selectedDate, selectedShift, row.hour_id, gdc.gdc_id, modelCode);

            const recRef = doc(db, 'production_records', recordId);
            const recData: ProductionRecord = {
              record_id: recordId,
              date: selectedDate,
              shift: selectedShift,
              supervisor: supervisor.trim(),
              hour_id: row.hour_id,
              hour_start: row.hour_start,
              hour_end: row.hour_end,
              furnace: gdc.furnace_id || (gdc.gdc_id <= 'GDC-4' ? 'F-1' : 'F-2'),
              gdc_machine: gdc.gdc_id,
              model: modelCode,
              planned_qty: planQty,
              actual_qty: actualQty,
              achievement_pct: achievePct,
              breakdown_min: typeof row.breakdown_min === 'number' ? row.breakdown_min : 0,
              remarks: row.remarks || '',
              created_by: currentUser.name,
              created_at: nowIso,
              updated_at: nowIso
            };

            batch.set(recRef, recData, { merge: true });
            recordsCount++;
          }
        });
      });

      await batch.commit();

      await logAudit(
        currentUser,
        isExistingRecordLoaded ? 'UPDATE' : 'CREATE',
        'production_records',
        `${selectedDate}_${selectedShift}`,
        undefined,
        { recordsCount, tempCount, supervisor: supervisor.trim() }
      );

      setUnsavedChanges(false);
      setIsExistingRecordLoaded(true);
      setMessage({
        type: 'success',
        text: `SAVE SUCCESSFUL: Saved ${recordsCount} normalized GDC records and ${tempCount} furnace temperature entries to Firestore for Shift ${selectedShift}.`
      });
    } catch (err: any) {
      console.error('Error saving hourly records:', err);
      setMessage({ type: 'error', text: 'Failed to save production records: ' + err.message });
    } finally {
      setSaving(false);
    }
  };

  // Aggregate stats across active grid
  const totalActual = gridRows.reduce((sum, row) => {
    return sum + Object.values(row.gdc_actuals).reduce<number>((s, v) => s + (typeof v === 'number' ? v : 0), 0);
  }, 0);

  const defaultShiftPlan = gridRows.length * (gdcMachines.length * (settings.default_plan_per_gdc_per_hour || 16));
  const totalPlan = gridRows.reduce((sum, row) => {
    if (typeof row.hourly_plan_override === 'number') {
      return sum + row.hourly_plan_override;
    }
    return sum + Object.values(row.gdc_plans).reduce<number>((s, p) => s + (Number(p) || 16), 0);
  }, 0) || defaultShiftPlan;

  const overallAchievement = totalPlan > 0 ? Math.round((totalActual / totalPlan) * 1000) / 10 : 0;
  const totalBreakdown = gridRows.reduce((sum, row) => sum + (typeof row.breakdown_min === 'number' ? row.breakdown_min : 0), 0);

  // Furnace shift temperature averages
  const f1Temps = gridRows.map(r => r.f1_temp).filter((t): t is number => typeof t === 'number' && t > 0);
  const f2Temps = gridRows.map(r => r.f2_temp).filter((t): t is number => typeof t === 'number' && t > 0);
  const avgF1 = f1Temps.length > 0 ? Math.round(f1Temps.reduce((a, b) => a + b, 0) / f1Temps.length) : 0;
  const avgF2 = f2Temps.length > 0 ? Math.round(f2Temps.reduce((a, b) => a + b, 0) / f2Temps.length) : 0;

  return (
    <div id="hourly-production-entry-module" className="space-y-6">
      {/* 1. TOP SECTION: Date, Shift, Supervisor & Header Actions */}
      <div id="manual-entry-top-panel" className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                100% Manual Data Entry
              </span>
              <span className="text-xs text-slate-500 font-medium">Direct Foundry Shop-Floor Logging</span>
            </div>
            <h1 className="text-xl font-black text-slate-900 mt-1 tracking-tight">Hourly Production Entry Grid</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter casting counts, furnace temperatures, breakdown downtime, and remarks manually. All calculations and normalized persistence occur automatically.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              id="refresh-grid-btn"
              type="button"
              onClick={loadRecords}
              disabled={loading || saving}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Reload</span>
            </button>

            <button
              id="save-production-btn"
              type="button"
              onClick={handleSaveProduction}
              disabled={saving || loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-blue-600 rounded-lg shadow-sm hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'SAVE PRODUCTION'}</span>
            </button>
          </div>
        </div>

        {/* Top Controls: Production Date, Shift, Supervisor */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Production Date */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
              <span>Production Date</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                  className="text-[10px] text-blue-600 hover:underline font-semibold"
                >
                  Today
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() - 1);
                    setSelectedDate(d.toISOString().split('T')[0]);
                  }}
                  className="text-[10px] text-slate-500 hover:underline font-semibold"
                >
                  Yesterday
                </button>
              </div>
            </label>
            <div className="relative">
              <input
                id="production-date-input"
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="w-full text-xs font-semibold px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-slate-50/50 text-slate-900"
              />
            </div>
          </div>

          {/* Shift Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Shift</label>
            <div className="grid grid-cols-2 gap-2">
              {(['A', 'B'] as const).map(s => (
                <button
                  key={s}
                  id={`shift-select-${s}`}
                  type="button"
                  onClick={() => setSelectedShift(s)}
                  className={`py-2 px-3 text-xs font-black rounded-lg border transition-all flex items-center justify-center gap-1.5 ${
                    selectedShift === s
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span>Shift {s}</span>
                  <span className="text-[10px] font-normal opacity-80">
                    ({s === 'A' ? '07:00-19:00' : '19:00-07:00'})
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Supervisor Selection Dropdown from Supervisor Master */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="supervisor-select" className="block text-xs font-bold text-slate-700">
                Shift Supervisor
              </label>
              <span className="text-[10px] text-blue-600 font-semibold">Supervisor Master</span>
            </div>
            <select
              id="supervisor-select"
              value={supervisor}
              onChange={e => {
                setSupervisor(e.target.value);
                setUnsavedChanges(true);
              }}
              className="w-full text-xs font-semibold px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-slate-900 shadow-2xs"
            >
              {activeSupervisors.map(s => (
                <option key={s.supervisor_id} value={s.supervisor_name}>
                  {s.supervisor_name}
                </option>
              ))}
              {/* Retain historical supervisor who entered this shift even if later deactivated */}
              {supervisor && !activeSupervisors.some(s => s.supervisor_name === supervisor) && (
                <option value={supervisor}>
                  {supervisor} (Historical / Deactivated)
                </option>
              )}
            </select>
          </div>
        </div>

        {/* Unsaved and feedback alerts */}
        {unsavedChanges && (
          <div className="mt-4 p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Unsaved changes present in grid. Click <strong>"SAVE PRODUCTION"</strong> to persist records to the Firestore database.
            </span>
          </div>
        )}

        {message && (
          <div
            className={`mt-4 p-3 rounded-lg text-xs flex items-center gap-2 ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                : message.type === 'error'
                ? 'bg-rose-50 text-rose-900 border border-rose-200'
                : 'bg-amber-50 text-amber-900 border border-amber-200'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{message.text}</span>
          </div>
        )}
      </div>

      {/* 2. FURNACE INFORMATION SECTION */}
      <div id="furnace-info-panel" className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-3">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-600" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Furnace Operating Information (Molten Aluminum Temperature)
            </h2>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            Acceptable Process Window: {settings.min_f1_temp}&deg;C - {settings.max_f1_temp}&deg;C
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Furnace 1 Box */}
          <div className="p-3.5 bg-gradient-to-r from-amber-50/50 to-orange-50/30 rounded-xl border border-amber-200/80 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-600 text-white">
                  FURNACE 1 (F-1)
                </span>
                <span className="text-xs font-bold text-slate-700">Feeds GDC-1 to GDC-4</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Shift Average: <strong className="font-mono text-slate-900">{avgF1 > 0 ? `${avgF1}°C` : 'Not logged'}</strong>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600 font-semibold">Target &deg;C:</span>
              <input
                type="number"
                value={f1DefaultTemp}
                onChange={e => setF1DefaultTemp(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-18 text-xs font-mono font-bold text-center py-1 px-2 border border-slate-300 rounded bg-white"
              />
            </div>
          </div>

          {/* Furnace 2 Box */}
          <div className="p-3.5 bg-gradient-to-r from-amber-50/50 to-orange-50/30 rounded-xl border border-amber-200/80 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-orange-600 text-white">
                  FURNACE 2 (F-2)
                </span>
                <span className="text-xs font-bold text-slate-700">Feeds GDC-5 to GDC-8</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Shift Average: <strong className="font-mono text-slate-900">{avgF2 > 0 ? `${avgF2}°C` : 'Not logged'}</strong>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600 font-semibold">Target &deg;C:</span>
              <input
                type="number"
                value={f2DefaultTemp}
                onChange={e => setF2DefaultTemp(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-18 text-xs font-mono font-bold text-center py-1 px-2 border border-slate-300 rounded bg-white"
              />
            </div>
          </div>
        </div>

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={handleApplyDefaultFurnaceTemps}
            className="text-[11px] font-semibold text-blue-700 hover:text-blue-800 underline flex items-center gap-1"
          >
            <span>Auto-fill empty hourly slots with target furnace temperatures ({f1DefaultTemp}&deg;C / {f2DefaultTemp}&deg;C)</span>
          </button>
        </div>
      </div>

      {/* 3. GDC / MODEL CONFIGURATION BAR */}
      <div id="gdc-model-selection-bar" className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-blue-600" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              GDC Machine Model Selection (Model Master)
            </h2>
          </div>
          <span className="text-[11px] text-slate-500">
            Select the casting model running on each machine. Updates the entire shift.
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {gdcMachines.map(gdc => {
            const currentSelectedModel = gridRows[0]?.gdc_models[gdc.gdc_id] || gdc.default_model || 'U244-3';
            return (
              <div key={gdc.gdc_id} className="p-2 bg-slate-50/80 rounded-lg border border-slate-200 text-center">
                <div className="flex items-center justify-between mb-1 px-0.5">
                  <span className="text-xs font-black text-slate-900">{gdc.gdc_code}</span>
                  <span className="text-[9px] font-bold text-amber-700 bg-amber-100/60 px-1 rounded">
                    {gdc.furnace_id}
                  </span>
                </div>
                <select
                  id={`model-select-${gdc.gdc_id}`}
                  value={currentSelectedModel}
                  onChange={e => handleModelChangeForGdc(gdc.gdc_id, e.target.value)}
                  className="w-full text-[11px] font-semibold py-1 px-1 bg-white border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 text-blue-900"
                >
                  {models.filter(m => m.status === 'ACTIVE').map(m => (
                    <option key={m.model_id} value={m.model_code}>
                      {m.model_code}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. HOURLY PRODUCTION GRID */}
      <div id="hourly-production-grid-card" className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-700" />
            <h2 className="text-sm font-bold text-slate-900">
              Hourly Production Grid &bull; Shift {selectedShift} ({selectedShift === 'A' ? '7AM - 7PM' : '7PM - 7AM'})
            </h2>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-emerald-100 border border-emerald-300"></span>
              <span>&ge;100%</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-blue-100 border border-blue-300"></span>
              <span>&ge;90%</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-amber-100 border border-amber-300"></span>
              <span>&ge;75%</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-rose-100 border border-rose-300"></span>
              <span>&lt;75%</span>
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table id="hourly-grid-table" className="w-full text-left text-xs border-collapse min-w-[1250px]">
            <thead>
              {/* Primary Header Row */}
              <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold text-[11px]">
                <th className="py-2.5 px-3 sticky left-0 bg-slate-100 z-20 w-28 border-r border-slate-200 shadow-2xs">
                  Time
                </th>
                <th className="py-2.5 px-2 text-center w-20 bg-amber-50 border-r border-slate-200 text-amber-900">
                  F-1 (&deg;C)
                </th>
                <th className="py-2.5 px-2 text-center w-20 bg-amber-50 border-r border-slate-200 text-amber-900">
                  F-2 (&deg;C)
                </th>

                {/* 8 GDC Machine Headers */}
                {gdcMachines.map(gdc => (
                  <th key={gdc.gdc_id} className="py-2 px-1 text-center w-24 border-r border-slate-200">
                    <div className="font-black text-slate-900">{gdc.gdc_code}</div>
                    <div className="text-[10px] text-slate-500 font-normal">
                      {gridRows[0]?.gdc_models[gdc.gdc_id] || gdc.default_model}
                    </div>
                  </th>
                ))}

                {/* Calculated & Operational Columns */}
                <th className="py-2.5 px-2 text-center w-20 bg-blue-50 border-r border-slate-200 text-blue-900">
                  Total
                </th>
                <th className="py-2.5 px-2 text-center w-22 bg-slate-100 border-r border-slate-200 text-slate-800">
                  Plan
                </th>
                <th className="py-2.5 px-2 text-center w-22 bg-slate-100 border-r border-slate-200 text-slate-800">
                  Achievement
                </th>
                <th className="py-2.5 px-2 text-center w-20 bg-rose-50 border-r border-slate-200 text-rose-900">
                  B/D (m)
                </th>
                <th className="py-2.5 px-3 min-w-[180px]">Remarks / Stoppage Reason</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {gridRows.map((row, idx) => {
                // Calculated Row Values
                const rowActualSum = Object.values(row.gdc_actuals).reduce<number>(
                  (sum, v) => sum + (typeof v === 'number' ? v : 0),
                  0
                );

                const defaultHourPlan = gdcMachines.length * (settings.default_plan_per_gdc_per_hour || 16);
                const currentHourPlan = typeof row.hourly_plan_override === 'number' ? row.hourly_plan_override : defaultHourPlan;

                const rowAchPct = currentHourPlan > 0 ? Math.round((rowActualSum / currentHourPlan) * 1000) / 10 : 0;
                const hasAnyData = Object.values(row.gdc_actuals).some(v => typeof v === 'number');

                return (
                  <tr
                    key={row.hour_id}
                    className={`hover:bg-blue-50/20 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}
                  >
                    {/* Time Label (Sticky column) */}
                    <td className="py-2 px-3 font-bold text-slate-800 sticky left-0 bg-inherit z-10 border-r border-slate-200 whitespace-nowrap shadow-2xs">
                      {row.display_label}
                    </td>

                    {/* F-1 Temp (°C) */}
                    <td className="py-1 px-1 text-center border-r border-slate-200 bg-amber-50/10">
                      <input
                        id={`input-f1-${row.hour_id}`}
                        type="number"
                        min="0"
                        max="900"
                        placeholder="710"
                        value={row.f1_temp}
                        onChange={e => handleTempChange(row.hour_id, 'f1', e.target.value)}
                        className={`w-full py-1 text-center font-mono text-xs rounded border focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                          typeof row.f1_temp === 'number' && (row.f1_temp < settings.min_f1_temp || row.f1_temp > settings.max_f1_temp)
                            ? 'border-rose-400 bg-rose-50 text-rose-700 font-bold'
                            : 'border-slate-200 bg-white text-slate-800'
                        }`}
                      />
                    </td>

                    {/* F-2 Temp (°C) */}
                    <td className="py-1 px-1 text-center border-r border-slate-200 bg-amber-50/10">
                      <input
                        id={`input-f2-${row.hour_id}`}
                        type="number"
                        min="0"
                        max="900"
                        placeholder="715"
                        value={row.f2_temp}
                        onChange={e => handleTempChange(row.hour_id, 'f2', e.target.value)}
                        className={`w-full py-1 text-center font-mono text-xs rounded border focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                          typeof row.f2_temp === 'number' && (row.f2_temp < settings.min_f2_temp || row.f2_temp > settings.max_f2_temp)
                            ? 'border-rose-400 bg-rose-50 text-rose-700 font-bold'
                            : 'border-slate-200 bg-white text-slate-800'
                        }`}
                      />
                    </td>

                    {/* 8 GDC Machine Actual Production Inputs */}
                    {gdcMachines.map(gdc => {
                      const actualVal = row.gdc_actuals[gdc.gdc_id];
                      return (
                        <td key={gdc.gdc_id} className="py-1 px-1 border-r border-slate-200">
                          <input
                            id={`input-actual-${row.hour_id}-${gdc.gdc_id}`}
                            type="number"
                            min="0"
                            placeholder="0"
                            value={actualVal}
                            onChange={e => handleActualChange(row.hour_id, gdc.gdc_id, e.target.value)}
                            className="w-full py-1.5 px-1 text-center font-mono font-bold text-xs rounded border border-slate-300 bg-white text-slate-900 focus:bg-blue-50/50 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                          />
                        </td>
                      );
                    })}

                    {/* AUTOMATIC Hourly Total = SUM(GDC-1 to GDC-8) */}
                    <td className="py-2 px-2 text-center font-black font-mono text-xs text-blue-900 bg-blue-50/60 border-r border-slate-200">
                      {hasAnyData ? rowActualSum : '-'}
                    </td>

                    {/* Hourly Plan (Automatic default, allows override) */}
                    <td className="py-1 px-1 text-center border-r border-slate-200 bg-slate-50/40">
                      <input
                        id={`input-plan-${row.hour_id}`}
                        type="number"
                        min="0"
                        placeholder={String(defaultHourPlan)}
                        value={row.hourly_plan_override}
                        onChange={e => handleHourlyPlanChange(row.hour_id, e.target.value)}
                        className="w-full py-1 text-center font-mono text-xs rounded border border-slate-200 bg-white text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        title="Hourly plan target (defaults to 128 = 8 machines × 16/hr). Override as needed."
                      />
                    </td>

                    {/* AUTOMATIC Achievement % = (Actual / Plan) * 100 */}
                    <td className="py-2 px-2 text-center font-black font-mono text-xs border-r border-slate-200">
                      {hasAnyData ? (
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                            rowAchPct >= settings.excellent_threshold
                              ? 'bg-emerald-100 text-emerald-800'
                              : rowAchPct >= settings.good_threshold
                              ? 'bg-blue-100 text-blue-800'
                              : rowAchPct >= settings.warning_threshold
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {rowAchPct}%
                        </span>
                      ) : (
                        <span className="text-slate-400 font-normal">-</span>
                      )}
                    </td>

                    {/* Breakdown B/D Minutes */}
                    <td className="py-1 px-1 text-center border-r border-slate-200 bg-rose-50/20">
                      <input
                        id={`input-bd-${row.hour_id}`}
                        type="number"
                        min="0"
                        max="60"
                        placeholder="0"
                        value={row.breakdown_min}
                        onChange={e => handleBreakdownChange(row.hour_id, e.target.value)}
                        className={`w-full py-1 text-center font-mono text-xs rounded border focus:outline-none ${
                          typeof row.breakdown_min === 'number' && row.breakdown_min > 0
                            ? 'border-rose-400 bg-rose-50 font-bold text-rose-700'
                            : 'border-slate-200 bg-white text-slate-700'
                        }`}
                      />
                    </td>

                    {/* Remarks / Stoppage Reason */}
                    <td className="py-1 px-2">
                      <div className="relative">
                        <input
                          id={`input-remark-${row.hour_id}`}
                          type="text"
                          list={`remarks-list-${row.hour_id}`}
                          placeholder="Stoppage reason or notes..."
                          value={row.remarks}
                          onChange={e => handleRemarksChange(row.hour_id, e.target.value)}
                          className="w-full py-1 px-2 text-xs rounded border border-slate-200 bg-white text-slate-800 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <datalist id={`remarks-list-${row.hour_id}`}>
                          {COMMON_REMARK_OPTIONS.map(opt => (
                            <option key={opt} value={opt} />
                          ))}
                        </datalist>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Shift Summary Footer Row */}
            <tfoot>
              <tr className="bg-slate-900 text-white font-bold text-xs border-t-2 border-slate-950">
                <td className="py-3 px-3 sticky left-0 bg-slate-900 z-20 border-r border-slate-800 tracking-wide font-black">
                  SHIFT TOTALS
                </td>
                <td className="py-3 px-2 text-center border-r border-slate-800 font-mono text-amber-300 text-[11px]">
                  {avgF1 > 0 ? `${avgF1}°C` : '-'}
                </td>
                <td className="py-3 px-2 text-center border-r border-slate-800 font-mono text-amber-300 text-[11px]">
                  {avgF2 > 0 ? `${avgF2}°C` : '-'}
                </td>

                {/* Individual GDC Totals */}
                {gdcMachines.map(gdc => {
                  const gdcColTotal = gridRows.reduce(
                    (sum, r) => sum + (typeof r.gdc_actuals[gdc.gdc_id] === 'number' ? (r.gdc_actuals[gdc.gdc_id] as number) : 0),
                    0
                  );
                  return (
                    <td key={gdc.gdc_id} className="py-3 px-1 text-center border-r border-slate-800 font-mono font-bold text-emerald-400">
                      {gdcColTotal}
                    </td>
                  );
                })}

                {/* Total Actual */}
                <td className="py-3 px-2 text-center bg-blue-700 text-white font-mono text-sm font-black border-r border-slate-800">
                  {totalActual}
                </td>

                {/* Total Plan */}
                <td className="py-3 px-2 text-center font-mono border-r border-slate-800 text-slate-200">
                  {totalPlan}
                </td>

                {/* Overall Achievement % */}
                <td className="py-3 px-2 text-center font-mono border-r border-slate-800 text-yellow-300 font-black">
                  {overallAchievement}%
                </td>

                {/* Total Breakdown Minutes */}
                <td className="py-3 px-2 text-center font-mono text-rose-300 font-bold border-r border-slate-800">
                  {totalBreakdown}m
                </td>

                {/* Supervisor Signature / Status */}
                <td className="py-3 px-3 text-slate-300 font-normal text-[11px]">
                  Supervisor: <strong className="text-white">{supervisor}</strong> &bull; {gridRows.length} Hours Logged
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 5. SUMMARY KPI STATS CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[10px] text-slate-500 font-bold uppercase block tracking-wider">Shift Planned Target</span>
          <div className="text-2xl font-black text-slate-900 mt-0.5 font-mono">{totalPlan}</div>
          <span className="text-[11px] text-slate-400">castings (8 GDCs &times; 16/hr)</span>
        </div>

        <div className="p-4 bg-blue-50/80 rounded-xl border border-blue-200 shadow-sm">
          <span className="text-[10px] text-blue-700 font-bold uppercase block tracking-wider">Shift Actual Castings</span>
          <div className="text-2xl font-black text-blue-900 mt-0.5 font-mono">{totalActual}</div>
          <span className="text-[11px] text-blue-600">units casted on shop-floor</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[10px] text-slate-500 font-bold uppercase block tracking-wider">Shift Achievement</span>
          <div
            className={`text-2xl font-black mt-0.5 font-mono ${
              overallAchievement >= settings.excellent_threshold
                ? 'text-emerald-600'
                : overallAchievement >= settings.good_threshold
                ? 'text-blue-600'
                : overallAchievement >= settings.warning_threshold
                ? 'text-amber-600'
                : 'text-rose-600'
            }`}
          >
            {overallAchievement}%
          </div>
          <span className="text-[11px] text-slate-400">target benchmark: 100%</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[10px] text-slate-500 font-bold uppercase block tracking-wider">Total Stoppage Downtime</span>
          <div className="text-2xl font-black text-rose-600 mt-0.5 font-mono">{totalBreakdown} min</div>
          <span className="text-[11px] text-slate-400">across 12 operating slots</span>
        </div>
      </div>
    </div>
  );
};
