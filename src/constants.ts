import {
  HourSlotMaster,
  ShiftMaster,
  FurnaceMaster,
  GDCMaster,
  ModelMaster,
  RejectionCategoryMaster,
  SystemSettings
} from './types';

export const INITIAL_SHIFTS: ShiftMaster[] = [
  { shift_id: 'shift_a', shift_code: 'A', shift_name: 'Shift A (07:00 - 19:00)', status: 'ACTIVE' },
  { shift_id: 'shift_b', shift_code: 'B', shift_name: 'Shift B (19:00 - 07:00)', status: 'ACTIVE' },
];

export const INITIAL_FURNACES: FurnaceMaster[] = [
  { furnace_id: 'F-1', furnace_code: 'F-1', furnace_name: 'Furnace 1', status: 'ACTIVE' },
  { furnace_id: 'F-2', furnace_code: 'F-2', furnace_name: 'Furnace 2', status: 'ACTIVE' },
];

export const INITIAL_GDCS: GDCMaster[] = [
  { gdc_id: 'GDC-1', gdc_code: 'GDC-1', gdc_name: 'GDC-1', furnace_id: 'F-1', default_model: 'U244-3', status: 'ACTIVE' },
  { gdc_id: 'GDC-2', gdc_code: 'GDC-2', gdc_name: 'GDC-2', furnace_id: 'F-1', default_model: 'U244-2', status: 'ACTIVE' },
  { gdc_id: 'GDC-3', gdc_code: 'GDC-3', gdc_name: 'GDC-3', furnace_id: 'F-1', default_model: 'U244-1', status: 'ACTIVE' },
  { gdc_id: 'GDC-4', gdc_code: 'GDC-4', gdc_name: 'GDC-4', furnace_id: 'F-1', default_model: 'U86-2', status: 'ACTIVE' },
  { gdc_id: 'GDC-5', gdc_code: 'GDC-5', gdc_name: 'GDC-5', furnace_id: 'F-2', default_model: 'U86-3', status: 'ACTIVE' },
  { gdc_id: 'GDC-6', gdc_code: 'GDC-6', gdc_name: 'GDC-6', furnace_id: 'F-2', default_model: 'DISC-1', status: 'ACTIVE' },
  { gdc_id: 'GDC-7', gdc_code: 'GDC-7', gdc_name: 'GDC-7', furnace_id: 'F-2', default_model: 'N 360-1', status: 'ACTIVE' },
  { gdc_id: 'GDC-8', gdc_code: 'GDC-8', gdc_name: 'GDC-8', furnace_id: 'F-2', default_model: 'DRUM', status: 'ACTIVE' },
];

export const INITIAL_MODELS: ModelMaster[] = [
  { model_id: 'm1', model_code: 'U244-3', model_name: 'U244-3', status: 'ACTIVE' },
  { model_id: 'm2', model_code: 'U244-2', model_name: 'U244-2', status: 'ACTIVE' },
  { model_id: 'm3', model_code: 'U244-1', model_name: 'U244-1', status: 'ACTIVE' },
  { model_id: 'm4', model_code: 'U86-2', model_name: 'U86-2', status: 'ACTIVE' },
  { model_id: 'm5', model_code: 'U86-3', model_name: 'U86-3', status: 'ACTIVE' },
  { model_id: 'm6', model_code: 'U86-1', model_name: 'U86-1', status: 'ACTIVE' },
  { model_id: 'm7', model_code: 'DISC-1', model_name: 'DISC-1', status: 'ACTIVE' },
  { model_id: 'm8', model_code: 'DISC-2', model_name: 'DISC-2', status: 'ACTIVE' },
  { model_id: 'm9', model_code: 'N 360-1', model_name: 'N 360-1', status: 'ACTIVE' },
  { model_id: 'm10', model_code: 'N 360-2', model_name: 'N 360-2', status: 'ACTIVE' },
  { model_id: 'm11', model_code: 'DRUM', model_name: 'DRUM', status: 'ACTIVE' },
];

export const INITIAL_HOUR_SLOTS: HourSlotMaster[] = [
  { hour_id: 'H01', hour_start: '07:00', hour_end: '08:00', display_label: '7AM - 8AM', sequence: 1, status: 'ACTIVE' },
  { hour_id: 'H02', hour_start: '08:00', hour_end: '09:00', display_label: '8AM - 9AM', sequence: 2, status: 'ACTIVE' },
  { hour_id: 'H03', hour_start: '09:00', hour_end: '10:00', display_label: '9AM - 10AM', sequence: 3, status: 'ACTIVE' },
  { hour_id: 'H04', hour_start: '10:00', hour_end: '11:00', display_label: '10AM - 11AM', sequence: 4, status: 'ACTIVE' },
  { hour_id: 'H05', hour_start: '11:00', hour_end: '12:00', display_label: '11AM - 12PM', sequence: 5, status: 'ACTIVE' },
  { hour_id: 'H06', hour_start: '12:00', hour_end: '13:00', display_label: '12PM - 1PM', sequence: 6, status: 'ACTIVE' },
  { hour_id: 'H07', hour_start: '13:00', hour_end: '14:00', display_label: '1PM - 2PM', sequence: 7, status: 'ACTIVE' },
  { hour_id: 'H08', hour_start: '14:00', hour_end: '15:00', display_label: '2PM - 3PM', sequence: 8, status: 'ACTIVE' },
  { hour_id: 'H09', hour_start: '15:00', hour_end: '16:00', display_label: '3PM - 4PM', sequence: 9, status: 'ACTIVE' },
  { hour_id: 'H10', hour_start: '16:00', hour_end: '17:00', display_label: '4PM - 5PM', sequence: 10, status: 'ACTIVE' },
  { hour_id: 'H11', hour_start: '17:00', hour_end: '18:00', display_label: '5PM - 6PM', sequence: 11, status: 'ACTIVE' },
  { hour_id: 'H12', hour_start: '18:00', hour_end: '19:00', display_label: '6PM - 7PM', sequence: 12, status: 'ACTIVE' },
];

export const INITIAL_REJECTION_CATEGORIES: RejectionCategoryMaster[] = [
  { category_id: 'cat_shrinkage', category_name: 'Shrinkage / Porosity', status: 'ACTIVE' },
  { category_id: 'cat_crack', category_name: 'Hot Tear / Crack', status: 'ACTIVE' },
  { category_id: 'cat_misrun', category_name: 'Cold Shut / Misrun', status: 'ACTIVE' },
  { category_id: 'cat_blister', category_name: 'Blister / Gas Hole', status: 'ACTIVE' },
  { category_id: 'cat_inclusion', category_name: 'Slag / Dross Inclusion', status: 'ACTIVE' },
  { category_id: 'cat_dimension', category_name: 'Dimensional Variation', status: 'ACTIVE' },
  { category_id: 'cat_surface', category_name: 'Surface Defect / Roughness', status: 'ACTIVE' },
];

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  default_plan_per_gdc_per_hour: 16,
  min_f1_temp: 680,
  max_f1_temp: 750,
  min_f2_temp: 680,
  max_f2_temp: 750,
  excellent_threshold: 100,
  good_threshold: 90,
  warning_threshold: 75,
  deduct_rejection_from_actual: false,
};
