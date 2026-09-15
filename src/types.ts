export interface ProductionRecord {
  record_id: string; // date_shift_hourId_gdc_model
  date: string; // YYYY-MM-DD
  shift: 'A' | 'B';
  supervisor: string;
  hour_id: string; // H01 .. H12
  hour_start: string; // e.g., '07:00'
  hour_end: string;   // e.g., '08:00'
  furnace: string;    // 'F-1' | 'F-2'
  gdc_machine: string; // 'GDC-1' .. 'GDC-8'
  model: string;      // 'U244-3' ..
  planned_qty: number;
  actual_qty: number;
  achievement_pct: number;
  breakdown_min: number;
  remarks: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface HourlyTemperature {
  temperature_id: string; // date_shift_hourId
  date: string;
  shift: 'A' | 'B';
  hour_id: string;
  furnace_1_temperature: number;
  furnace_2_temperature: number;
  remarks?: string;
  created_at?: string;
  updated_at?: string;
}

export interface RejectionRecord {
  rejection_id: string;
  production_record_id?: string;
  date: string;
  shift: 'A' | 'B';
  furnace: string;
  gdc_machine: string;
  model: string;
  rejection_category: string;
  side: 'LH' | 'RH' | 'BOTH';
  quantity: number;
  remarks?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FurnaceMaster {
  furnace_id: string;
  furnace_code: string;
  furnace_name: string;
  status: 'ACTIVE' | 'INACTIVE';
  created_at?: string;
  updated_at?: string;
}

export interface GDCMaster {
  gdc_id: string;
  gdc_code: string;
  gdc_name: string;
  furnace_id: string;
  default_model?: string;
  status: 'ACTIVE' | 'INACTIVE';
  created_at?: string;
  updated_at?: string;
}

export interface ModelMaster {
  model_id: string;
  model_code: string;
  model_name: string;
  status: 'ACTIVE' | 'INACTIVE';
  created_at?: string;
  updated_at?: string;
}

export interface ShiftMaster {
  shift_id: string;
  shift_code: 'A' | 'B';
  shift_name: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface HourSlotMaster {
  hour_id: string;
  hour_start: string;
  hour_end: string;
  display_label: string;
  sequence: number;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface RejectionCategoryMaster {
  category_id: string;
  category_name: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface SupervisorMaster {
  supervisor_id: string;
  supervisor_name: string;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  log_id: string;
  user_id: string;
  user_name: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'EXPORT' | 'IMPORT';
  collection: string;
  record_id: string;
  old_value?: string;
  new_value?: string;
  timestamp: string;
}

export interface SystemSettings {
  default_plan_per_gdc_per_hour: number;
  min_f1_temp: number;
  max_f1_temp: number;
  min_f2_temp: number;
  max_f2_temp: number;
  excellent_threshold: number;
  good_threshold: number;
  warning_threshold: number;
  deduct_rejection_from_actual: boolean;
}

export type UserRole = 'Admin' | 'PPC' | 'Production Supervisor' | 'Management' | 'Viewer';

export interface CurrentUser {
  id: string;
  name: string;
  role: UserRole;
  email: string;
  shift?: 'A' | 'B';
}
