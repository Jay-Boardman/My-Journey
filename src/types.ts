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

export interface CircleLayout {
  id: string;
  x: number; // Percentage from left
  y: number; // Percentage from top
  size: number; // Diameter in pixels
}

export interface DashboardLayout {
  circles: { [key: string]: CircleLayout };
}

export const DEFAULT_LAYOUT: DashboardLayout = {
  circles: {
    currentWeight: { id: 'currentWeight', x: 5, y: 5, size: 192 },
    totalLost: { id: 'totalLost', x: 55, y: 45, size: 144 },
    nextShot: { id: 'nextShot', x: 5, y: 75, size: 112 },
    updateWeight: { id: 'updateWeight', x: 38, y: 70, size: 128 },
    bmi: { id: 'bmi', x: 70, y: 75, size: 112 },
  }
};

export const INJECTION_SITES = [
  'Left Abdomen',
  'Right Abdomen',
  'Left Thigh',
  'Right Thigh',
  'Left Back of Arm',
  'Right Back of Arm'
];
