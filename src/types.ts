export interface Shot {
  id: string;
  date: string;
  dose: string;
  site: string; // e.g., 'Left Thigh', 'Right Abdomen'
}

export interface WeightEntry {
  id: string;
  date: string;
  weight: number;
}

export interface BodyMeasurementEntry {
  id: string;
  date: string;
  neck?: number;
  chest?: number;
  waist?: number;
  hips?: number;
  thighs?: number;
  arms?: number;
}

export const INJECTION_SITES = [
  'Left Abdomen',
  'Right Abdomen',
  'Left Thigh',
  'Right Thigh',
  'Left Back of Arm',
  'Right Back of Arm'
];
