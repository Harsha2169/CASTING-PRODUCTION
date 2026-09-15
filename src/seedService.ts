import { ProductionRecord, HourlyTemperature, RejectionRecord } from './types';
import { getProductionRecordId } from './dbService';
import { db } from './firebase';
import { doc, writeBatch, getDocs, collection } from 'firebase/firestore';

/**
 * Seed real realistic foundry production records into Firestore if the database is currently empty.
 * This guarantees the user immediately sees working analytics, Pareto charts, and thermal surveillance.
 */
export async function seedInitialSampleDataIfEmpty(): Promise<void> {
  try {
    const snap = await getDocs(collection(db, 'production_records'));
    if (!snap.empty) {
      return; // Database already contains real records
    }

    const today = new Date().toISOString().split('T')[0];
    // Also create yesterday's date
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yesterday = d.toISOString().split('T')[0];

    const batch = writeBatch(db);
    const nowIso = new Date().toISOString();

    const hours = [
      { id: 'H01', start: '07:00', end: '08:00', base: 15 },
      { id: 'H02', start: '08:00', end: '09:00', base: 16 },
      { id: 'H03', start: '09:00', end: '10:00', base: 14 },
      { id: 'H04', start: '10:00', end: '11:00', base: 16 },
      { id: 'H05', start: '11:00', end: '12:00', base: 17 },
      { id: 'H06', start: '12:00', end: '13:00', base: 13 },
      { id: 'H07', start: '13:00', end: '14:00', base: 15 },
      { id: 'H08', start: '14:00', end: '15:00', base: 16 },
      { id: 'H09', start: '15:00', end: '16:00', base: 14 },
      { id: 'H10', start: '16:00', end: '17:00', base: 15 },
      { id: 'H11', start: '17:00', end: '18:00', base: 16 },
      { id: 'H12', start: '18:00', end: '19:00', base: 15 },
    ];

    const machines = [
      { id: 'GDC-1', furnace: 'F-1', model: 'U244-3' },
      { id: 'GDC-2', furnace: 'F-1', model: 'U244-2' },
      { id: 'GDC-3', furnace: 'F-1', model: 'U244-1' },
      { id: 'GDC-4', furnace: 'F-1', model: 'U86-2' },
      { id: 'GDC-5', furnace: 'F-2', model: 'U86-3' },
      { id: 'GDC-6', furnace: 'F-2', model: 'DISC-1' },
      { id: 'GDC-7', furnace: 'F-2', model: 'N 360-1' },
      { id: 'GDC-8', furnace: 'F-2', model: 'DRUM' },
    ];

    const datesToSeed = [yesterday, today];

    datesToSeed.forEach(dateStr => {
      // Seed Shift A
      hours.forEach(h => {
        // Temperature doc
        const tempId = `${dateStr}_A_${h.id}`;
        const tempRef = doc(db, 'hourly_temperature', tempId);
        const f1T = 710 + Math.floor(Math.random() * 20);
        const f2T = 715 + Math.floor(Math.random() * 20);
        batch.set(tempRef, {
          temperature_id: tempId,
          date: dateStr,
          shift: 'A',
          hour_id: h.id,
          furnace_1_temperature: f1T,
          furnace_2_temperature: f2T,
          remarks: h.id === 'H06' ? 'Tea break / minor die warm-up' : '',
          created_at: nowIso,
          updated_at: nowIso
        });

        // Machine records
        machines.forEach((m, mIdx) => {
          const plan = 16;
          // Variance around base
          let actual = h.base + (mIdx % 3 === 0 ? 1 : mIdx % 2 === 0 ? 0 : -1);
          let bd = 0;
          let remarks = '';

          if (h.id === 'H03' && m.id === 'GDC-4') {
            actual = 8;
            bd = 25;
            remarks = 'Hydraulic ejector pin sticking';
          }
          if (h.id === 'H08' && m.id === 'GDC-7') {
            actual = 11;
            bd = 15;
            remarks = 'Die coating touchup';
          }

          const recId = getProductionRecordId(dateStr, 'A', h.id, m.id, m.model);
          const recRef = doc(db, 'production_records', recId);
          const recData: ProductionRecord = {
            record_id: recId,
            date: dateStr,
            shift: 'A',
            supervisor: dateStr === today ? 'Vijay' : 'Karthik',
            hour_id: h.id,
            hour_start: h.start,
            hour_end: h.end,
            furnace: m.furnace,
            gdc_machine: m.id,
            model: m.model,
            planned_qty: plan,
            actual_qty: Math.max(0, actual),
            achievement_pct: Math.round((actual / plan) * 1000) / 10,
            breakdown_min: bd,
            remarks,
            created_by: 'Harsha Reddy (PPC Manager)',
            created_at: nowIso,
            updated_at: nowIso
          };
          batch.set(recRef, recData);
        });
      });
    });

    // Seed realistic rejections
    const sampleRejections: RejectionRecord[] = [
      {
        rejection_id: `seed_rej_1`,
        date: today,
        shift: 'A',
        furnace: 'F-1',
        gdc_machine: 'GDC-1',
        model: 'U244-3',
        rejection_category: 'Shrinkage / Porosity',
        side: 'LH',
        quantity: 4,
        remarks: 'Porosity near center hub cavity',
        created_by: 'Plant Quality Auditor',
        created_at: nowIso
      },
      {
        rejection_id: `seed_rej_2`,
        date: today,
        shift: 'A',
        furnace: 'F-1',
        gdc_machine: 'GDC-2',
        model: 'U244-2',
        rejection_category: 'Shrinkage / Porosity',
        side: 'RH',
        quantity: 3,
        remarks: 'Pin gate feed shrink',
        created_by: 'Plant Quality Auditor',
        created_at: nowIso
      },
      {
        rejection_id: `seed_rej_3`,
        date: today,
        shift: 'A',
        furnace: 'F-2',
        gdc_machine: 'GDC-6',
        model: 'DISC-1',
        rejection_category: 'Cold Shut / Misrun',
        side: 'BOTH',
        quantity: 3,
        remarks: 'Low die temperature at first pour',
        created_by: 'Plant Quality Auditor',
        created_at: nowIso
      },
      {
        rejection_id: `seed_rej_4`,
        date: today,
        shift: 'A',
        furnace: 'F-2',
        gdc_machine: 'GDC-8',
        model: 'DRUM',
        rejection_category: 'Slag / Dross Inclusion',
        side: 'RH',
        quantity: 2,
        remarks: 'Ladle skimming required',
        created_by: 'Plant Quality Auditor',
        created_at: nowIso
      },
      {
        rejection_id: `seed_rej_5`,
        date: today,
        shift: 'A',
        furnace: 'F-1',
        gdc_machine: 'GDC-3',
        model: 'U244-1',
        rejection_category: 'Hot Tear / Crack',
        side: 'LH',
        quantity: 1,
        remarks: 'Early die ejection stress',
        created_by: 'Plant Quality Auditor',
        created_at: nowIso
      }
    ];

    sampleRejections.forEach(r => {
      batch.set(doc(db, 'rejection_records', r.rejection_id), r);
    });

    await batch.commit();
  } catch (err) {
    console.warn('Initial seed skipped or failed:', err);
  }
}
