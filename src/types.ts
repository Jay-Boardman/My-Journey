export type Mood = 'Great' | 'Good' | 'Okay' | 'Poor' | 'Bad';

export interface Shot {
  id: string;
  date: string;
  dose: string;
  site: string; // e.g., 'Left Thigh', 'Right Abdomen'
}

export interface FoodEntry {
  id: string;
  timestamp: string;
  name: string;
  calories?: number;
  protein?: number;
  notes?: string;
}

export interface FeelingEntry {
  id: string;
  timestamp: string;
  mood: Mood;
  sideEffects: string[];
  notes?: string;
}

export interface WeightEntry {
  id: string;
  date: string;
  weight: number;
}

export const INJECTION_SITES = [
  'Left Abdomen',
  'Right Abdomen',
  'Left Thigh',
  'Right Thigh',
  'Left Back of Arm',
  'Right Back of Arm'
];

export const COMMON_SIDE_EFFECTS = [
  'Nausea',
  'Fatigue',
  'Headache',
  'Constipation',
  'Diarrhea',
  'Heartburn',
  'Decreased Appetite',
  'Injection Site Reaction'
];
