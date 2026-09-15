import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  CurrentUser,
  UserRole,
  FurnaceMaster,
  GDCMaster,
  ModelMaster,
  HourSlotMaster,
  RejectionCategoryMaster,
  SupervisorMaster,
  SystemSettings
} from './types';
import {
  INITIAL_FURNACES,
  INITIAL_GDCS,
  INITIAL_MODELS,
  INITIAL_HOUR_SLOTS,
  INITIAL_REJECTION_CATEGORIES,
  INITIAL_SUPERVISORS,
  DEFAULT_SYSTEM_SETTINGS
} from './constants';
import { initializeDatabaseMasters } from './dbService';
import { seedInitialSampleDataIfEmpty } from './seedService';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

interface AppContextType {
  currentUser: CurrentUser;
  setCurrentUser: (u: CurrentUser) => void;
  switchRole: (role: UserRole) => void;
  furnaces: FurnaceMaster[];
  gdcMachines: GDCMaster[];
  models: ModelMaster[];
  hourSlots: HourSlotMaster[];
  rejectionCategories: RejectionCategoryMaster[];
  supervisors: SupervisorMaster[];
  settings: SystemSettings;
  updateSettings: (s: SystemSettings) => Promise<void>;
  reloadMasters: () => Promise<void>;
  isLoadingMasters: boolean;
}

const defaultUser: CurrentUser = {
  id: 'usr_harsha',
  name: 'Harsha Reddy (PPC Manager)',
  role: 'Admin',
  email: 'harsha.reddy.raju@gmail.com',
  shift: 'A'
};

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<CurrentUser>(defaultUser);
  const [furnaces, setFurnaces] = useState<FurnaceMaster[]>(INITIAL_FURNACES);
  const [gdcMachines, setGdcMachines] = useState<GDCMaster[]>(INITIAL_GDCS);
  const [models, setModels] = useState<ModelMaster[]>(INITIAL_MODELS);
  const [hourSlots, setHourSlots] = useState<HourSlotMaster[]>(INITIAL_HOUR_SLOTS);
  const [rejectionCategories, setRejectionCategories] = useState<RejectionCategoryMaster[]>(INITIAL_REJECTION_CATEGORIES);
  const [supervisors, setSupervisors] = useState<SupervisorMaster[]>(INITIAL_SUPERVISORS);
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SYSTEM_SETTINGS);
  const [isLoadingMasters, setIsLoadingMasters] = useState(true);

  const loadMasters = async () => {
    try {
      setIsLoadingMasters(true);
      await initializeDatabaseMasters();
      await seedInitialSampleDataIfEmpty();

      const [fSnap, gSnap, mSnap, hSnap, rSnap, supSnap, sSnap] = await Promise.all([
        getDocs(collection(db, 'furnaces')),
        getDocs(collection(db, 'gdc_machines')),
        getDocs(collection(db, 'models')),
        getDocs(collection(db, 'hour_slots')),
        getDocs(collection(db, 'rejection_categories')),
        getDocs(collection(db, 'supervisors')),
        getDocs(collection(db, 'system_settings'))
      ]);

      if (!fSnap.empty) {
        setFurnaces(fSnap.docs.map(d => d.data() as FurnaceMaster));
      }
      if (!gSnap.empty) {
        setGdcMachines(gSnap.docs.map(d => d.data() as GDCMaster));
      }
      if (!mSnap.empty) {
        setModels(mSnap.docs.map(d => d.data() as ModelMaster));
      }
      if (!hSnap.empty) {
        const slots = hSnap.docs.map(d => d.data() as HourSlotMaster);
        slots.sort((a, b) => a.sequence - b.sequence);
        setHourSlots(slots);
      }
      if (!rSnap.empty) {
        setRejectionCategories(rSnap.docs.map(d => d.data() as RejectionCategoryMaster));
      }
      if (!supSnap.empty) {
        setSupervisors(supSnap.docs.map(d => d.data() as SupervisorMaster));
      }
      if (!sSnap.empty) {
        const sDoc = sSnap.docs.find(d => d.id === 'config');
        if (sDoc) setSettings(sDoc.data() as SystemSettings);
      }
    } catch (e) {
      console.warn('Error loading master data from firestore, using defaults:', e);
    } finally {
      setIsLoadingMasters(false);
    }
  };

  useEffect(() => {
    loadMasters();
  }, []);

  const switchRole = (role: UserRole) => {
    setCurrentUser(prev => ({
      ...prev,
      role,
      name: role === 'Admin' ? 'Harsha Reddy (PPC Manager)' :
            role === 'PPC' ? 'Production Planning Engineer' :
            role === 'Production Supervisor' ? 'Shift Supervisor (Rajesh)' :
            role === 'Management' ? 'General Manager (Operations)' : 'Plant Quality Auditor'
    }));
  };

  const updateSettings = async (newSettings: SystemSettings) => {
    setSettings(newSettings);
    try {
      await setDoc(doc(db, 'system_settings', 'config'), newSettings);
    } catch (e) {
      console.error('Failed to persist settings:', e);
    }
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        switchRole,
        furnaces,
        gdcMachines,
        models,
        hourSlots,
        rejectionCategories,
        supervisors,
        settings,
        updateSettings,
        reloadMasters: loadMasters,
        isLoadingMasters
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
