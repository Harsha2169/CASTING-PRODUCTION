import { db } from './firebase';
import { doc, writeBatch, getDocs, collection, deleteDoc } from 'firebase/firestore';

/**
 * Ensures NO mock, fake, or randomly generated production records exist in the database.
 * The system adheres strictly to the rule:
 * "The production database must contain only actual manually entered factory data.
 * The application should start with an empty database except for configured master data."
 */
export async function seedInitialSampleDataIfEmpty(): Promise<void> {
  // Purposely empty: NO auto-filling or random numbers.
  // Masters (GDC, Furnaces, Models, Supervisors, Hour Slots) are initialized in dbService.ts.
}

/**
 * Purges any previously generated demo/seed mock records from the database
 * to guarantee an empty, clean factory production database.
 */
export async function purgeSampleDemoData(): Promise<number> {
  let purgedCount = 0;
  try {
    // Purge sample rejections with id prefix 'seed_rej_'
    const sampleRejIds = ['seed_rej_1', 'seed_rej_2', 'seed_rej_3', 'seed_rej_4', 'seed_rej_5'];
    for (const rejId of sampleRejIds) {
      const rejRef = doc(db, 'rejection_records', rejId);
      await deleteDoc(rejRef).catch(() => {});
    }

    // Check if any old sample production records exist created by old demo seeds
    const snap = await getDocs(collection(db, 'production_records'));
    if (!snap.empty) {
      const batch = writeBatch(db);
      let batchCount = 0;
      snap.docs.forEach(d => {
        const data = d.data();
        if (data.remarks === 'Normal Running' || data.remarks === 'Hydraulic ejector pin sticking' || data.remarks === 'Die coating touchup') {
          batch.delete(d.ref);
          batchCount++;
          purgedCount++;
        }
      });
      if (batchCount > 0) {
        await batch.commit();
      }
    }

    // Also remove sample hourly temperatures
    const tempSnap = await getDocs(collection(db, 'hourly_temperature'));
    if (!tempSnap.empty) {
      const batch = writeBatch(db);
      let tCount = 0;
      tempSnap.docs.forEach(d => {
        const data = d.data();
        if (data.remarks === 'Tea break / minor die warm-up' || data.remarks === 'Normal bath operation') {
          batch.delete(d.ref);
          tCount++;
        }
      });
      if (tCount > 0) {
        await batch.commit();
      }
    }
  } catch (err) {
    console.warn('Purge sample demo data notice:', err);
  }
  return purgedCount;
}

