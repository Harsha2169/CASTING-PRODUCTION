import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import {
  ProductionRecord,
  HourlyTemperature,
  RejectionRecord,
  FurnaceMaster,
  GDCMaster,
  ModelMaster,
  HourSlotMaster,
  RejectionCategoryMaster,
  SystemSettings,
  AuditLog,
  CurrentUser
} from './types';
import {
  INITIAL_FURNACES,
  INITIAL_GDCS,
  INITIAL_MODELS,
  INITIAL_HOUR_SLOTS,
  INITIAL_REJECTION_CATEGORIES,
  DEFAULT_SYSTEM_SETTINGS
} from './constants';

// Initialize master collections if empty
export async function initializeDatabaseMasters(): Promise<void> {
  try {
    const settingsSnap = await getDocs(collection(db, 'system_settings'));
    if (settingsSnap.empty) {
      await setDoc(doc(db, 'system_settings', 'config'), DEFAULT_SYSTEM_SETTINGS);
    }

    const furnaceSnap = await getDocs(collection(db, 'furnaces'));
    if (furnaceSnap.empty) {
      const batch = writeBatch(db);
      INITIAL_FURNACES.forEach(f => {
        batch.set(doc(db, 'furnaces', f.furnace_id), f);
      });
      await batch.commit();
    }

    const gdcSnap = await getDocs(collection(db, 'gdc_machines'));
    if (gdcSnap.empty) {
      const batch = writeBatch(db);
      INITIAL_GDCS.forEach(g => {
        batch.set(doc(db, 'gdc_machines', g.gdc_id), g);
      });
      await batch.commit();
    }

    const modelSnap = await getDocs(collection(db, 'models'));
    if (modelSnap.empty) {
      const batch = writeBatch(db);
      INITIAL_MODELS.forEach(m => {
        batch.set(doc(db, 'models', m.model_id), m);
      });
      await batch.commit();
    }

    const slotSnap = await getDocs(collection(db, 'hour_slots'));
    if (slotSnap.empty) {
      const batch = writeBatch(db);
      INITIAL_HOUR_SLOTS.forEach(s => {
        batch.set(doc(db, 'hour_slots', s.hour_id), s);
      });
      await batch.commit();
    }

    const rejSnap = await getDocs(collection(db, 'rejection_categories'));
    if (rejSnap.empty) {
      const batch = writeBatch(db);
      INITIAL_REJECTION_CATEGORIES.forEach(r => {
        batch.set(doc(db, 'rejection_categories', r.category_id), r);
      });
      await batch.commit();
    }
  } catch (err) {
    console.error('Error initializing database masters:', err);
  }
}

// Log an audit action
export async function logAudit(
  user: CurrentUser,
  action: AuditLog['action'],
  collectionName: string,
  recordId: string,
  oldVal?: any,
  newVal?: any
): Promise<void> {
  try {
    const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const logData: AuditLog = {
      log_id: logId,
      user_id: user.id,
      user_name: user.name,
      action,
      collection: collectionName,
      record_id: recordId,
      old_value: oldVal ? JSON.stringify(oldVal) : undefined,
      new_value: newVal ? JSON.stringify(newVal) : undefined,
      timestamp: new Date().toISOString()
    };
    await setDoc(doc(db, 'audit_logs', logId), logData);
  } catch (e) {
    console.warn('Could not write audit log:', e);
  }
}

// Generate unique normalized record ID
export function getProductionRecordId(date: string, shift: string, hourId: string, gdc: string, model: string): string {
  // Format: YYYY-MM-DD_Shift_Hour_GDC_Model
  const cleanModel = model.replace(/[^a-zA-Z0-9_-]/g, '');
  return `${date}_${shift}_${hourId}_${gdc}_${cleanModel}`;
}

// Fetch all production records within date range or filters
export async function fetchProductionRecords(filter?: {
  startDate?: string;
  endDate?: string;
  shift?: string;
  furnace?: string;
  gdc?: string;
  model?: string;
}): Promise<ProductionRecord[]> {
  try {
    const colRef = collection(db, 'production_records');
    let q = query(colRef);

    if (filter?.startDate && filter?.endDate) {
      q = query(colRef, where('date', '>=', filter.startDate), where('date', '<=', filter.endDate));
    } else if (filter?.startDate) {
      q = query(colRef, where('date', '==', filter.startDate));
    }

    const snapshot = await getDocs(q);
    let list = snapshot.docs.map(d => d.data() as ProductionRecord);

    // Apply remaining filters in-memory for zero latency and flexibility
    if (filter?.shift && filter.shift !== 'ALL') {
      list = list.filter(r => r.shift === filter.shift);
    }
    if (filter?.furnace && filter.furnace !== 'ALL') {
      list = list.filter(r => r.furnace === filter.furnace);
    }
    if (filter?.gdc && filter.gdc !== 'ALL') {
      list = list.filter(r => r.gdc_machine === filter.gdc);
    }
    if (filter?.model && filter.model !== 'ALL') {
      list = list.filter(r => r.model === filter.model);
    }

    return list;
  } catch (error) {
    console.error('Failed to fetch production records:', error);
    return [];
  }
}

// Fetch hourly temperatures for date and shift
export async function fetchHourlyTemperatures(date: string, shift?: string): Promise<HourlyTemperature[]> {
  try {
    const colRef = collection(db, 'hourly_temperature');
    let q = query(colRef, where('date', '==', date));
    if (shift && shift !== 'ALL') {
      q = query(colRef, where('date', '==', date), where('shift', '==', shift));
    }
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as HourlyTemperature);
  } catch (err) {
    console.error('Failed to fetch temperatures:', err);
    return [];
  }
}

// Fetch rejection records
export async function fetchRejectionRecords(startDate?: string, endDate?: string): Promise<RejectionRecord[]> {
  try {
    const colRef = collection(db, 'rejection_records');
    let q = query(colRef);
    if (startDate && endDate) {
      q = query(colRef, where('date', '>=', startDate), where('date', '<=', endDate));
    } else if (startDate) {
      q = query(colRef, where('date', '==', startDate));
    }
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as RejectionRecord);
  } catch (err) {
    console.error('Failed to fetch rejection records:', err);
    return [];
  }
}

// Fetch distinct dates for "Yesterday" logic
export async function fetchDistinctProductionDates(): Promise<string[]> {
  try {
    const snap = await getDocs(collection(db, 'production_records'));
    const dates = new Set<string>();
    snap.docs.forEach(d => {
      const data = d.data();
      if (data.date) dates.add(data.date);
    });
    return Array.from(dates).sort().reverse();
  } catch (e) {
    return [];
  }
}
