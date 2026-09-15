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
import { initializeDatabaseMasters, recordAuditLog } from './dbService';
import { purgeSampleDemoData } from './seedService';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

interface AppContextType {
  currentUser: CurrentUser;
  setCurrentUser: (u: CurrentUser) => void;
  switchRole: (role: UserRole) => void;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginAsRole: (role: UserRole, customName?: string) => void;
  logout: () => void;
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

const defaultAdminUser: CurrentUser = {
  id: 'usr_vishwaraj',
  name: 'Vishwaraj (PPC Casting Manager)',
  role: 'Admin',
  email: 'harsha.reddy.raju@gmail.com',
  shift: 'A'
};

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Check persisted session
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('dspl_auth_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        return Boolean(parsed.isAuthenticated);
      }
    } catch (e) {
      // ignore
    }
    return false;
  });

  const [currentUser, setCurrentUser] = useState<CurrentUser>(() => {
    try {
      const saved = localStorage.getItem('dspl_auth_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.user && parsed.user.role) {
          return parsed.user;
        }
      }
    } catch (e) {
      // ignore
    }
    return defaultAdminUser;
  });
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
      await purgeSampleDemoData();

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

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const cleanUser = username.trim().toUpperCase();
    const cleanPass = password.trim();

    // Verify Password
    if (cleanPass !== 'DSPL@123') {
      return {
        success: false,
        error: 'Invalid password. Required password for all accounts is: DSPL@123'
      };
    }

    // 1. ADMIN Authentication
    if (cleanUser === 'ADMIN') {
      const adminUser: CurrentUser = {
        id: 'usr_vishwaraj',
        name: 'Vishwaraj (PPC Casting Manager)',
        role: 'Admin',
        email: 'harsha.reddy.raju@gmail.com',
        shift: 'A'
      };

      setCurrentUser(adminUser);
      setIsAuthenticated(true);

      try {
        localStorage.setItem(
          'dspl_auth_session',
          JSON.stringify({
            isAuthenticated: true,
            user: adminUser,
            timestamp: new Date().toISOString()
          })
        );
        await recordAuditLog(adminUser, 'LOGIN', 'auth', 'session_admin', undefined, {
          username: cleanUser,
          role: 'Admin',
          status: 'SUCCESS'
        });
      } catch (err) {
        console.warn('Session save/audit warn:', err);
      }

      return { success: true };
    }

    // 2. SUPERVISOR VIJAY Authentication
    if (cleanUser === 'VIJAY') {
      const supervisorUser: CurrentUser = {
        id: 'usr_supervisor_vijay',
        name: 'Vijay',
        role: 'Production Supervisor',
        email: 'vijay.supervisor@dspl.in',
        shift: 'A'
      };

      setCurrentUser(supervisorUser);
      setIsAuthenticated(true);

      try {
        localStorage.setItem(
          'dspl_auth_session',
          JSON.stringify({
            isAuthenticated: true,
            user: supervisorUser,
            timestamp: new Date().toISOString()
          })
        );
        await recordAuditLog(supervisorUser, 'LOGIN', 'auth', 'session_supervisor_vijay', undefined, {
          username: cleanUser,
          supervisor: 'Vijay',
          role: 'Production Supervisor',
          status: 'SUCCESS'
        });
      } catch (err) {
        console.warn('Session save/audit warn:', err);
      }

      return { success: true };
    }

    // 3. SUPERVISOR KARTHIK Authentication
    if (cleanUser === 'KARTHIK') {
      const supervisorUser: CurrentUser = {
        id: 'usr_supervisor_karthik',
        name: 'Karthik',
        role: 'Production Supervisor',
        email: 'karthik.supervisor@dspl.in',
        shift: 'A'
      };

      setCurrentUser(supervisorUser);
      setIsAuthenticated(true);

      try {
        localStorage.setItem(
          'dspl_auth_session',
          JSON.stringify({
            isAuthenticated: true,
            user: supervisorUser,
            timestamp: new Date().toISOString()
          })
        );
        await recordAuditLog(supervisorUser, 'LOGIN', 'auth', 'session_supervisor_karthik', undefined, {
          username: cleanUser,
          supervisor: 'Karthik',
          role: 'Production Supervisor',
          status: 'SUCCESS'
        });
      } catch (err) {
        console.warn('Session save/audit warn:', err);
      }

      return { success: true };
    }

    // 4. Any other registered supervisor from the Supervisor Master
    const matchedSupervisor = supervisors.find(
      s => s.supervisor_name.trim().toUpperCase() === cleanUser
    );
    if (matchedSupervisor) {
      const supervisorUser: CurrentUser = {
        id: `usr_${matchedSupervisor.supervisor_id}`,
        name: matchedSupervisor.supervisor_name,
        role: 'Production Supervisor',
        email: `${matchedSupervisor.supervisor_name.toLowerCase().replace(/\s+/g, '')}.supervisor@dspl.in`,
        shift: 'A'
      };

      setCurrentUser(supervisorUser);
      setIsAuthenticated(true);

      try {
        localStorage.setItem(
          'dspl_auth_session',
          JSON.stringify({
            isAuthenticated: true,
            user: supervisorUser,
            timestamp: new Date().toISOString()
          })
        );
        await recordAuditLog(supervisorUser, 'LOGIN', 'auth', `session_${matchedSupervisor.supervisor_id}`, undefined, {
          username: cleanUser,
          supervisor: matchedSupervisor.supervisor_name,
          role: 'Production Supervisor',
          status: 'SUCCESS'
        });
      } catch (err) {
        console.warn('Session save/audit warn:', err);
      }

      return { success: true };
    }

    return {
      success: false,
      error: 'Invalid User Name. Valid users: ADMIN, VIJAY, or KARTHIK (Password: DSPL@123)'
    };
  };

  const loginAsRole = (role: UserRole, customName?: string) => {
    const roleUser: CurrentUser = {
      id: `usr_${role.toLowerCase().replace(/\s+/g, '_')}`,
      name: customName || (
        role === 'Admin' ? 'Vishwaraj (PPC Casting Manager)' :
        role === 'PPC' ? 'Production Planning Engineer' :
        role === 'Production Supervisor' ? 'Shift Supervisor (Vijay)' :
        role === 'Management' ? 'General Manager (Operations)' : 'Plant Quality Auditor'
      ),
      role,
      email: `${role.toLowerCase().replace(/\s+/g, '_')}@dspl.in`,
      shift: 'A'
    };

    setCurrentUser(roleUser);
    setIsAuthenticated(true);

    try {
      localStorage.setItem(
        'dspl_auth_session',
        JSON.stringify({
          isAuthenticated: true,
          user: roleUser,
          timestamp: new Date().toISOString()
        })
      );
    } catch (err) {
      // ignore
    }
  };

  const logout = () => {
    try {
      recordAuditLog(currentUser, 'LOGIN', 'auth', 'session_logout', undefined, {
        action: 'LOGOUT',
        user: currentUser.name
      }).catch(() => {});
      localStorage.removeItem('dspl_auth_session');
    } catch (e) {
      // ignore
    }
    setIsAuthenticated(false);
  };

  const switchRole = (role: UserRole) => {
    setCurrentUser(prev => {
      const updated = {
        ...prev,
        role,
        name: role === 'Admin' ? 'Vishwaraj (PPC Casting Manager)' :
              role === 'PPC' ? 'Production Planning Engineer' :
              role === 'Production Supervisor' ? 'Shift Supervisor (Vijay)' :
              role === 'Management' ? 'General Manager (Operations)' : 'Plant Quality Auditor'
      };
      try {
        localStorage.setItem(
          'dspl_auth_session',
          JSON.stringify({
            isAuthenticated: true,
            user: updated,
            timestamp: new Date().toISOString()
          })
        );
      } catch (e) {}
      return updated;
    });
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
        isAuthenticated,
        login,
        loginAsRole,
        logout,
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
