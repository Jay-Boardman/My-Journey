import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Syringe, 
  LineChart, 
  Plus, 
  ChevronRight, 
  MapPin,
  Calendar,
  Scale,
  User,
  Trash2,
  Edit2,
  Settings
} from 'lucide-react';
import { 
  LineChart as ReChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { format, addDays, differenceInDays, parseISO, isToday } from 'date-fns';
import { cn } from './lib/utils';
import { 
  Shot, 
  WeightEntry, 
  BodyMeasurementEntry,
  INJECTION_SITES 
} from './types';

// --- Persistence Helpers ---
const STORAGE_KEYS = {
  SHOTS: 'mj_shots',
  FEELINGS: 'mj_feelings',
  WEIGHT: 'mj_weight',
  PROFILE: 'mj_profile',
  UNIT: 'mj_unit',
  HEIGHT: 'mj_height',
  HEIGHT_UNIT: 'mj_height_unit',
  MEASUREMENT_UNIT: 'mj_measurement_unit',
  MEASUREMENTS: 'mj_measurements'
};

const load = <T,>(key: string, defaultValue: T): T => {
  const saved = localStorage.getItem(key);
  return saved ? JSON.parse(saved) : defaultValue;
};

const save = <T,>(key: string, value: T) => {
  localStorage.setItem(key, JSON.stringify(value));
};

// --- Components ---

const Card = ({ children, className, id }: { children: React.ReactNode; className?: string; id?: string }) => (
  <div id={id} className={cn("bg-white rounded-2xl p-4 shadow-sm border border-slate-100", className)}>
    {children}
  </div>
);

const Button = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  className,
  id
}: { 
  children: React.ReactNode; 
  onClick?: (e: React.MouseEvent) => void; 
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  className?: string;
  id?: string;
}) => {
  const variants = {
    primary: 'bg-emerald-600 text-white hover:bg-emerald-700',
    secondary: 'bg-slate-800 text-white hover:bg-slate-900',
    outline: 'border border-slate-200 text-slate-600 hover:bg-slate-50',
    ghost: 'text-slate-500 hover:bg-slate-100'
  };
  return (
    <button 
      id={id}
      onClick={onClick} 
      className={cn("px-4 py-2 rounded-xl font-medium transition-all active:scale-95 flex items-center justify-center gap-2", variants[variant], className)}
    >
      {children}
    </button>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'shots' | 'body' | 'progress'>('dashboard');
  
  // Data State
  const [shots, setShots] = useState<Shot[]>(() => load(STORAGE_KEYS.SHOTS, []));
  const [weight, setWeight] = useState<WeightEntry[]>(() => load(STORAGE_KEYS.WEIGHT, []));
  const [measurements, setMeasurements] = useState<BodyMeasurementEntry[]>(() => load(STORAGE_KEYS.MEASUREMENTS, []));
  const [weightUnit, setWeightUnit] = useState<'lbs' | 'kg' | 'st'>(() => load(STORAGE_KEYS.UNIT, 'lbs'));
  const [height, setHeight] = useState<number | null>(() => load(STORAGE_KEYS.HEIGHT, null)); // stored in cm
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft'>(() => load(STORAGE_KEYS.HEIGHT_UNIT, 'cm'));
  const [measurementUnit, setMeasurementUnit] = useState<'in' | 'cm'>(() => load(STORAGE_KEYS.MEASUREMENT_UNIT, 'in'));
  
  // UI State
  const [showAddShot, setShowAddShot] = useState(false);
  const [showAddWeight, setShowAddWeight] = useState(false);
  const [editingWeight, setEditingWeight] = useState<WeightEntry | null>(null);
  const [editingMeasurement, setEditingMeasurement] = useState<BodyMeasurementEntry | null>(null);
  const [showAddHeight, setShowAddHeight] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Sync to LocalStorage
  useEffect(() => save(STORAGE_KEYS.SHOTS, shots), [shots]);
  useEffect(() => save(STORAGE_KEYS.WEIGHT, weight), [weight]);
  useEffect(() => save(STORAGE_KEYS.UNIT, weightUnit), [weightUnit]);
  useEffect(() => save(STORAGE_KEYS.HEIGHT, height), [height]);
  useEffect(() => save(STORAGE_KEYS.HEIGHT_UNIT, heightUnit), [heightUnit]);
  useEffect(() => save(STORAGE_KEYS.MEASUREMENT_UNIT, measurementUnit), [measurementUnit]);
  useEffect(() => save(STORAGE_KEYS.MEASUREMENTS, measurements), [measurements]);

  // Derived Values
  const lastShot = shots.length > 0 ? shots[shots.length - 1] : null;
  const nextShotDate = lastShot ? addDays(parseISO(lastShot.date), 7) : null;
  const daysUntilNextShot = nextShotDate ? differenceInDays(nextShotDate, new Date()) : null;
  const currentWeight = weight.length > 0 ? weight[weight.length - 1].weight : null;
  const startWeight = weight.length > 0 ? weight[0].weight : null;
  
  const formatWeight = (lbs: number | null) => {
    if (lbs === null) return '--';
    if (weightUnit === 'kg') return `${(lbs / 2.20462).toFixed(1)} kg`;
    if (weightUnit === 'st') {
      const totalSt = lbs / 14;
      const st = Math.floor(totalSt);
      const remainingLbs = Math.round((totalSt - st) * 14);
      return `${st}st ${remainingLbs}lb`;
    }
    return `${lbs.toFixed(1)} lbs`;
  };

  const totalLost = (startWeight && currentWeight) ? (startWeight - currentWeight).toFixed(1) : null;
  const totalLostDisplay = totalLost ? (weightUnit === 'kg' ? `${(parseFloat(totalLost) / 2.20462).toFixed(1)} kg` : weightUnit === 'st' ? `${(parseFloat(totalLost) / 14).toFixed(1)} st` : `${totalLost} lbs`) : null;

  const currentBMI = useMemo(() => {
    if (!currentWeight || !height) return null;
    const weightKg = currentWeight / 2.20462;
    const heightM = height / 100;
    return (weightKg / (heightM * heightM)).toFixed(1);
  }, [currentWeight, height]);

  // --- Handlers ---
  const addShot = (dose: string, site: string, date?: string) => {
    const newShot: Shot = {
      id: crypto.randomUUID(),
      date: date ? new Date(date).toISOString() : new Date().toISOString(),
      dose,
      site
    };
    setShots([...shots, newShot]);
    setShowAddShot(false);
  };

  const addWeight = (val: number) => {
    const newEntry: WeightEntry = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      weight: val
    };
    setWeight([...weight, newEntry]);
    setShowAddWeight(false);
  };

  const deleteWeight = (id: string) => {
    setWeight(weight.filter(w => w.id !== id));
  };

  const updateWeight = (id: string, val: number) => {
    setWeight(weight.map(w => w.id === id ? { ...w, weight: val } : w));
  };

  const addMeasurement = (data: Partial<Omit<BodyMeasurementEntry, 'id' | 'date'>>) => {
    const lastEntry = measurements.length > 0 ? measurements[measurements.length - 1] : {};
    
    // Convert to inches if currently in cm mode
    const processedData = { ...data };
    if (measurementUnit === 'cm') {
      Object.keys(processedData).forEach(key => {
        const k = key as keyof typeof processedData;
        if (typeof processedData[k] === 'number') {
          (processedData as any)[k] = (processedData[k] as number) / 2.54;
        }
      });
    }

    const newEntry: BodyMeasurementEntry = {
      ...lastEntry,
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      ...processedData
    };
    setMeasurements([...measurements, newEntry]);
  };

  const deleteMeasurement = (id: string) => {
    setMeasurements(measurements.filter(m => m.id !== id));
  };

  const updateMeasurement = (id: string, data: Partial<Omit<BodyMeasurementEntry, 'id' | 'date'>>) => {
    // Convert to inches if currently in cm mode
    const processedData = { ...data };
    if (measurementUnit === 'cm') {
      Object.keys(processedData).forEach(key => {
        const k = key as keyof typeof processedData;
        if (typeof processedData[k] === 'number') {
          (processedData as any)[k] = (processedData[k] as number) / 2.54;
        }
      });
    }
    setMeasurements(measurements.map(m => m.id === id ? { ...m, ...processedData } : m));
  };

  // --- Views ---

  const measurementParts = [
    { id: 'neck', label: 'Neck' },
    { id: 'chest', label: 'Chest' },
    { id: 'arms', label: 'Arms' },
    { id: 'waist', label: 'Waist' },
    { id: 'hips', label: 'Hips' },
    { id: 'thighs', label: 'Thighs' },
  ];

  const DashboardView = () => (
    <div className="space-y-4 pb-20">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-900">My Journey</h1>
          <p className="text-slate-500 text-xs">{format(new Date(), 'EEEE, MMMM do')}</p>
        </div>
        <button 
          onClick={() => setShowSettings(true)}
          className="p-2 bg-white rounded-xl shadow-sm border border-slate-100 text-slate-400 hover:text-emerald-600 transition-colors"
        >
          <Settings className="w-4 h-4" />
        </button>
      </header>

      {/* Weight Info Circles */}
      <div className="flex justify-center items-center gap-4 py-2">
        <div className="flex flex-col items-center">
          <div className="w-40 h-40 rounded-full bg-white border-4 border-emerald-500 shadow-xl flex flex-col items-center justify-center p-4 text-center">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Current</p>
            <div className="flex items-baseline gap-0.5">
              <p className="text-4xl font-black text-slate-900 leading-none">
                {currentWeight ? (
                  weightUnit === 'kg' ? (currentWeight / 2.20462).toFixed(1) : 
                  weightUnit === 'st' ? Math.floor(currentWeight / 14) : 
                  currentWeight.toFixed(1)
                ) : '--'}
              </p>
              {weightUnit === 'st' && currentWeight && (
                <p className="text-base font-bold text-slate-900">
                  {Math.round((currentWeight / 14 - Math.floor(currentWeight / 14)) * 14)}
                </p>
              )}
            </div>
            <p className="text-[10px] font-bold text-emerald-600 uppercase mt-1">{weightUnit}</p>
          </div>
        </div>

        {totalLostDisplay && (
          <div className="flex flex-col items-center">
            <div className="w-28 h-28 rounded-full bg-emerald-600 shadow-lg flex flex-col items-center justify-center p-3 text-center text-white">
              <p className="text-[8px] font-bold text-emerald-100 uppercase tracking-widest mb-0.5">Total Lost</p>
              <p className="text-xl font-black leading-none">
                {totalLost ? (
                  weightUnit === 'kg' ? (parseFloat(totalLost) / 2.20462).toFixed(1) : 
                  weightUnit === 'st' ? (parseFloat(totalLost) / 14).toFixed(1) : 
                  totalLost
                ) : '--'}
              </p>
              <p className="text-[8px] font-bold text-emerald-100 uppercase mt-0.5">{weightUnit}</p>
            </div>
          </div>
        )}
      </div>

      <div className="px-4 space-y-2">
        <Button 
          className="w-full py-4 rounded-2xl shadow-md bg-emerald-600 hover:bg-emerald-700 text-base font-bold flex items-center justify-center gap-2"
          onClick={() => setShowAddWeight(true)}
        >
          <Scale className="w-5 h-5" /> Update Weight
        </Button>
        
        {currentBMI && (
          <div className="flex justify-center">
            <div className="bg-white px-3 py-1 rounded-full border border-slate-100 shadow-sm flex items-center gap-2">
              <User className="w-3 h-3 text-slate-400" />
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">
                Current BMI: <span className="text-emerald-600">{currentBMI}</span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Shot Countdown */}
      <Card className="bg-white border-slate-100 shadow-sm overflow-hidden">
        <div className="flex justify-between items-center p-3">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-50 p-2 rounded-xl">
              <Syringe className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-slate-500 text-[9px] font-bold uppercase tracking-wider">Next Shot</p>
              <h2 className="text-lg font-bold text-slate-900">
                {daysUntilNextShot !== null ? (daysUntilNextShot <= 0 ? 'Today!' : `${daysUntilNextShot} Days`) : 'Set first shot'}
              </h2>
            </div>
          </div>
          <Button 
            variant="ghost" 
            className="text-emerald-600 font-bold text-[10px] h-8"
            onClick={() => setShowAddShot(true)}
          >
            Log <Plus className="w-3 h-3 ml-0.5" />
          </Button>
        </div>
        {nextShotDate && (
          <div className="bg-slate-50 px-3 py-1.5 border-t border-slate-100">
            <p className="text-[9px] text-slate-400 font-medium">
              Due {format(nextShotDate, 'EEEE, MMM do')}
            </p>
          </div>
        )}
      </Card>
    </div>
  );

  const ShotsView = () => (
    <div className="space-y-6 pb-24">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Shot Tracker</h1>
        <p className="text-slate-500 text-sm">Manage your injection schedule</p>
      </header>

      <Card className="bg-emerald-50 border-emerald-100">
        <div className="flex gap-4">
          <div className="bg-white p-3 rounded-2xl shadow-sm">
            <MapPin className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-bold text-emerald-900">Site Rotation</h3>
            <p className="text-emerald-700 text-sm mt-1">
              Last site: <span className="font-bold">{lastShot?.site || 'None'}</span>
            </p>
            <p className="text-emerald-600 text-xs mt-1">
              Rotate sites weekly to prevent skin irritation.
            </p>
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        <h3 className="font-bold text-slate-900 text-sm">Injection History</h3>
        {shots.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
            <Syringe className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No shots logged yet.</p>
            <Button variant="outline" className="mt-4 mx-auto" onClick={() => setShowAddShot(true)}>
              Log First Shot
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {[...shots].reverse().map(shot => (
              <div key={shot.id} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center">
                <div className="flex gap-3 items-center">
                  <div className="bg-emerald-50 p-2 rounded-xl">
                    <Calendar className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{format(parseISO(shot.date), 'MMM do, yyyy')}</p>
                    <p className="text-xs text-slate-500">{shot.site} • {shot.dose}</p>
                  </div>
                </div>
                <div className="text-emerald-600">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const BodyView = () => {
    const [selectedPart, setSelectedPart] = useState<keyof Omit<BodyMeasurementEntry, 'id' | 'date'> | null>(null);
    const [inputValue, setInputValue] = useState('');

    const lastMeasurements = measurements.length > 0 ? measurements[measurements.length - 1] : null;

    const handleSave = () => {
      if (selectedPart && inputValue) {
        addMeasurement({ [selectedPart]: parseFloat(inputValue) });
        // We keep it open so the user can see the button change to "Update"
      }
    };

    const parts = [
      { id: 'neck', label: 'Neck', x: 50, y: 12 },
      { id: 'chest', label: 'Chest', x: 50, y: 24 },
      { id: 'arms', label: 'Arms', x: 22, y: 35 },
      { id: 'waist', label: 'Waist', x: 50, y: 40 },
      { id: 'hips', label: 'Hips', x: 50, y: 52 },
      { id: 'thighs', label: 'Thighs', x: 38, y: 72 },
    ];

    return (
      <div className="space-y-6 pb-24">
        <header>
          <h1 className="text-2xl font-bold text-slate-900">Body Measurements</h1>
          <p className="text-slate-500 text-sm">Enter your measurements in {measurementUnit === 'in' ? 'inches' : 'centimeters'}</p>
        </header>

        <div className="grid grid-cols-2 gap-4">
          {parts.map(part => {
            const rawVal = lastMeasurements?.[part.id as keyof BodyMeasurementEntry] as number | undefined;
            const val = rawVal !== undefined ? (measurementUnit === 'cm' ? parseFloat((rawVal * 2.54).toFixed(1)) : rawVal) : undefined;
            const isSelected = selectedPart === part.id;

            return (
              <div 
                key={part.id} 
                onClick={() => {
                  if (!isSelected) {
                    setSelectedPart(part.id as any);
                    setInputValue(val?.toString() || '');
                  }
                }}
                className={cn(
                  "w-full flex flex-col items-center justify-center py-6 rounded-2xl border transition-all shadow-sm cursor-pointer min-h-[120px]",
                  isSelected 
                    ? "bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20" 
                    : "bg-white border-slate-100 hover:border-emerald-200"
                )}
              >
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{part.label}</p>
                
                {isSelected ? (
                  <div className="flex flex-col items-center gap-2 px-3 w-full animate-in zoom-in-95 duration-200">
                    <input
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      className="w-full p-2 bg-white rounded-xl border border-emerald-200 outline-none font-bold text-xl text-center"
                      value={inputValue}
                      onChange={e => setInputValue(e.target.value)}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSave();
                        if (e.key === 'Escape') setSelectedPart(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex gap-1 w-full">
                      <Button onClick={(e) => { e?.stopPropagation(); handleSave(); }} className="flex-1 py-1.5 text-xs h-8">
                        {val ? 'Update' : 'Save'}
                      </Button>
                      <Button variant="ghost" onClick={(e) => { e?.stopPropagation(); setSelectedPart(null); setInputValue(''); }} className="px-2 py-1.5 text-xs h-8">
                        ✕
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-2xl font-bold text-slate-900">{val ? `${val}${measurementUnit === 'in' ? '"' : ' cm'}` : '--'}</p>
                )}
              </div>
            );
          })}
        </div>

        {measurements.length > 0 && (
          <div className="pt-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 text-center">Last Updated: {format(parseISO(measurements[measurements.length - 1].date), 'MMM do, yyyy')}</p>
          </div>
        )}
      </div>
    );
  };

  const ProgressView = () => {
    const getMeasurementChartData = (partId: string) => {
      return measurements
        .filter(m => m[partId as keyof BodyMeasurementEntry] !== undefined)
        .map(m => {
          const rawValue = m[partId as keyof BodyMeasurementEntry] as number;
          const displayValue = measurementUnit === 'cm' ? parseFloat((rawValue * 2.54).toFixed(1)) : rawValue;
          return {
            date: format(parseISO(m.date), 'MMM d'),
            value: displayValue
          };
        });
    };

    const chartData = useMemo(() => {
      return weight.map(w => {
        let val = w.weight;
        if (weightUnit === 'kg') val = val / 2.20462;
        if (weightUnit === 'st') val = val / 14;
        return {
          date: format(parseISO(w.date), 'MMM d'),
          weight: parseFloat(val.toFixed(1))
        };
      });
    }, [weight, weightUnit]);

    return (
      <div className="space-y-6 pb-24">
        <header>
          <h1 className="text-2xl font-bold text-slate-900">Progress</h1>
          <p className="text-slate-500 text-sm">Visualize your transformation in {weightUnit.toUpperCase()}</p>
        </header>

        <Card className="h-[300px] p-2">
          <h3 className="text-sm font-bold text-slate-900 mb-4 px-2">Weight Over Time ({weightUnit.toUpperCase()})</h3>
          {weight.length < 2 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <LineChart className="w-12 h-12 mb-2 opacity-20" />
              <p className="text-xs">Log at least 2 weights to see a chart</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="85%">
              <ReChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis domain={['auto', 'auto']} fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                  formatter={(value: number) => [`${value} ${weightUnit}`, 'Weight']}
                />
                <Line 
                  type="monotone" 
                  dataKey="weight" 
                  stroke="#10b981" 
                  strokeWidth={3} 
                  dot={{ fill: '#10b981', r: 4 }} 
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </ReChart>
            </ResponsiveContainer>
          )}
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-emerald-50 border-none">
            <p className="text-emerald-600 text-[10px] font-bold uppercase">Total Lost</p>
            <p className="text-2xl font-bold text-emerald-900 mt-1">{totalLostDisplay || '0'}</p>
          </Card>
          <Card className="bg-blue-50 border-none">
            <p className="text-blue-600 text-[10px] font-bold uppercase">Current BMI</p>
            <p className="text-2xl font-bold text-blue-900 mt-1">{currentBMI || '--'}</p>
            <button 
              onClick={() => setShowAddHeight(true)}
              className="text-[10px] text-blue-500 underline mt-1 block"
            >
              {height ? 'Update Height' : 'Set Height'}
            </button>
          </Card>
        </div>

        <div className="space-y-4">
          <h3 className="font-bold text-slate-900 text-sm">Measurement Progress</h3>
          <div className="grid grid-cols-1 gap-4">
            {measurementParts.map(part => {
              const data = getMeasurementChartData(part.id);
              if (data.length < 2) return null;

              return (
                <Card key={part.id} className="h-[200px] p-2">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase mb-2 px-2">{part.label} Progress ({measurementUnit === 'in' ? 'Inches' : 'CM'})</h3>
                  <ResponsiveContainer width="100%" height="80%">
                    <ReChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" fontSize={8} tickLine={false} axisLine={false} />
                      <YAxis domain={['auto', 'auto']} fontSize={8} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', fontSize: '10px' }}
                        labelStyle={{ fontWeight: 'bold' }}
                        formatter={(value: number) => [`${value}${measurementUnit === 'in' ? '"' : ' cm'}`, part.label]}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke="#3b82f6" 
                        strokeWidth={2} 
                        dot={{ fill: '#3b82f6', r: 3 }} 
                        activeDot={{ r: 5, strokeWidth: 0 }}
                      />
                    </ReChart>
                  </ResponsiveContainer>
                </Card>
              );
            })}
            {measurements.length < 2 && (
              <Card className="py-8 text-center text-slate-400">
                <p className="text-xs">Log measurements on at least 2 different days to see progress charts.</p>
              </Card>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="font-bold text-slate-900 text-sm">Measurement History</h3>
          {measurements.length === 0 ? (
            <Card className="py-8 text-center text-slate-400">
              <p className="text-xs">No measurements logged yet.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {[...measurements].reverse().map(m => (
                <Card key={m.id} className="p-3 group">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-xs font-bold text-slate-900">{format(parseISO(m.date), 'MMM do, yyyy')}</p>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => setEditingMeasurement(m)}
                        className="p-1 text-slate-400 hover:text-blue-500"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => {
                          if (confirm('Delete this measurement entry?')) {
                            deleteMeasurement(m.id);
                          }
                        }}
                        className="p-1 text-slate-400 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(m).map(([key, rawVal]) => {
                      if (key === 'id' || key === 'date' || rawVal === undefined) return null;
                      const val = measurementUnit === 'cm' ? parseFloat(((rawVal as number) * 2.54).toFixed(1)) : rawVal as number;
                      return (
                        <div key={key} className="bg-slate-50 p-2 rounded-lg text-center">
                          <p className="text-[8px] font-bold text-slate-400 uppercase">{key}</p>
                          <p className="text-xs font-bold text-slate-900">{val}{measurementUnit === 'in' ? '"' : 'cm'}</p>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="font-bold text-slate-900 text-sm">Weight Log</h3>
          {[...weight].reverse().map(w => (
            <div key={w.id} className="flex justify-between items-center p-3 bg-white rounded-xl border border-slate-100 shadow-sm group">
              <div className="flex flex-col">
                <p className="text-sm font-medium text-slate-900">{format(parseISO(w.date), 'MMM do, yyyy')}</p>
                <p className="text-xs text-slate-400">{format(parseISO(w.date), 'HH:mm')}</p>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-sm font-bold text-emerald-600">{formatWeight(w.weight)}</p>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => {
                      setEditingWeight(w);
                    }}
                    className="p-1 text-slate-400 hover:text-blue-500"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => {
                      if (confirm('Delete this weight entry?')) {
                        deleteWeight(w.id);
                      }
                    }}
                    className="p-1 text-slate-400 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <div className="max-w-md mx-auto px-4 pt-6">
        {activeTab === 'dashboard' && <DashboardView />}
        {activeTab === 'shots' && <ShotsView />}
        {activeTab === 'body' && <BodyView />}
        {activeTab === 'progress' && <ProgressView />}
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex justify-between items-center z-50">
        <button onClick={() => setActiveTab('dashboard')} className={cn("flex flex-col items-center gap-1", activeTab === 'dashboard' ? "text-emerald-600" : "text-slate-400")}>
          <LayoutDashboard className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Home</span>
        </button>
        <button onClick={() => setActiveTab('shots')} className={cn("flex flex-col items-center gap-1", activeTab === 'shots' ? "text-emerald-600" : "text-slate-400")}>
          <Syringe className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Shots</span>
        </button>
        <button onClick={() => setActiveTab('body')} className={cn("flex flex-col items-center gap-1", activeTab === 'body' ? "text-emerald-600" : "text-slate-400")}>
          <User className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Body</span>
        </button>
        <button onClick={() => setActiveTab('progress')} className={cn("flex flex-col items-center gap-1", activeTab === 'progress' ? "text-emerald-600" : "text-slate-400")}>
          <LineChart className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Stats</span>
        </button>
      </nav>

      {/* Modals */}
      {showAddShot && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-4">
          <Card className="w-full max-w-sm animate-in slide-in-from-bottom duration-300">
            <h2 className="text-xl font-bold mb-4">Log Injection</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Date</label>
                <input 
                  id="shot-date-input"
                  type="date" 
                  defaultValue={format(new Date(), 'yyyy-MM-dd')}
                  className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Dose</label>
                <select id="dose-select" className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none">
                  <option>2.5 mg</option>
                  <option>5.0 mg</option>
                  <option>7.5 mg</option>
                  <option>10.0 mg</option>
                  <option>12.5 mg</option>
                  <option>15.0 mg</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Injection Site</label>
                <div className="grid grid-cols-2 gap-2">
                  {INJECTION_SITES.map(site => (
                    <button 
                      key={site}
                      id={`site-${site.replace(/\s+/g, '-').toLowerCase()}`}
                      onClick={() => {
                        const dose = (document.getElementById('dose-select') as HTMLSelectElement).value;
                        const date = (document.getElementById('shot-date-input') as HTMLInputElement).value;
                        addShot(dose, site, date);
                      }}
                      className="p-3 text-xs font-medium bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 rounded-xl border border-transparent hover:border-emerald-200 transition-all"
                    >
                      {site}
                    </button>
                  ))}
                </div>
              </div>
              <Button variant="ghost" className="w-full" onClick={() => setShowAddShot(false)}>Cancel</Button>
            </div>
          </Card>
        </div>
      )}

      {showAddWeight && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-4">
          <Card className="w-full max-w-sm animate-in slide-in-from-bottom duration-300">
            <h2 className="text-xl font-bold mb-4">Update Weight</h2>
            <div className="space-y-4">
              {weightUnit === 'st' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Stone</label>
                    <input 
                      id="weight-st-input"
                      type="number" 
                      placeholder="0"
                      className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none text-2xl font-bold text-center"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Pounds</label>
                    <input 
                      id="weight-lb-input"
                      type="number" 
                      placeholder="0"
                      className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none text-2xl font-bold text-center"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Last Recorded Weight ({weightUnit})</label>
                  <input 
                    id="weight-input"
                    type="number" 
                    step="0.1"
                    placeholder="0.0"
                    className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none text-2xl font-bold text-center"
                    autoFocus
                  />
                </div>
              )}
              <Button 
                className="w-full py-4"
                onClick={() => {
                  let lbs = 0;
                  if (weightUnit === 'st') {
                    const st = parseFloat((document.getElementById('weight-st-input') as HTMLInputElement).value) || 0;
                    const lb = parseFloat((document.getElementById('weight-lb-input') as HTMLInputElement).value) || 0;
                    lbs = (st * 14) + lb;
                  } else {
                    const val = parseFloat((document.getElementById('weight-input') as HTMLInputElement).value) || 0;
                    if (weightUnit === 'kg') lbs = val * 2.20462;
                    else lbs = val;
                  }
                  if (lbs > 0) addWeight(lbs);
                }}
              >
                Save Weight
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setShowAddWeight(false)}>Cancel</Button>
            </div>
          </Card>
        </div>
      )}

      {editingWeight && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-4">
          <Card className="w-full max-w-sm animate-in slide-in-from-bottom duration-300">
            <h2 className="text-xl font-bold mb-4">Edit Weight</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Weight ({weightUnit})</label>
                <input 
                  type="number" 
                  step="0.1"
                  className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none text-2xl font-bold text-center"
                  defaultValue={weightUnit === 'kg' ? (editingWeight.weight / 2.20462).toFixed(1) : (weightUnit === 'st' ? (editingWeight.weight / 14).toFixed(1) : editingWeight.weight.toFixed(1))}
                  autoFocus
                  id="edit-weight-input"
                />
              </div>
              <Button 
                className="w-full py-4"
                onClick={() => {
                  const val = parseFloat((document.getElementById('edit-weight-input') as HTMLInputElement).value);
                  if (!isNaN(val)) {
                    let lbs = val;
                    if (weightUnit === 'kg') lbs = val * 2.20462;
                    if (weightUnit === 'st') lbs = val * 14;
                    updateWeight(editingWeight.id, lbs);
                    setEditingWeight(null);
                  }
                }}
              >
                Update Weight
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setEditingWeight(null)}>Cancel</Button>
            </div>
          </Card>
        </div>
      )}

      {editingMeasurement && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-4 overflow-y-auto">
          <Card className="w-full max-w-sm animate-in slide-in-from-bottom duration-300 my-auto">
            <h2 className="text-xl font-bold mb-4">Edit Measurements</h2>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {measurementParts.map(part => (
                <div key={part.id} className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">{part.label} ({measurementUnit === 'in' ? 'Inches' : 'CM'})</label>
                  <input 
                    id={`edit-m-${part.id}`}
                    type="number" 
                    step="0.1"
                    className="w-full p-3 bg-slate-50 rounded-xl border-none outline-none font-bold"
                    defaultValue={(() => {
                      const rawVal = editingMeasurement[part.id as keyof BodyMeasurementEntry] as number;
                      return rawVal !== undefined ? (measurementUnit === 'cm' ? (rawVal * 2.54).toFixed(1) : rawVal) : '';
                    })()}
                  />
                </div>
              ))}
            </div>
            <div className="space-y-2 mt-6">
              <Button 
                className="w-full py-4"
                onClick={() => {
                  const updates: any = {};
                  measurementParts.forEach(part => {
                    const val = parseFloat((document.getElementById(`edit-m-${part.id}`) as HTMLInputElement).value);
                    if (!isNaN(val)) updates[part.id] = val;
                  });
                  updateMeasurement(editingMeasurement.id, updates);
                  setEditingMeasurement(null);
                }}
              >
                Update All
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setEditingMeasurement(null)}>Cancel</Button>
            </div>
          </Card>
        </div>
      )}

      {showAddHeight && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-4">
          <Card className="w-full max-w-sm animate-in slide-in-from-bottom duration-300">
            <h2 className="text-xl font-bold mb-4">Set Height</h2>
            <div className="space-y-4">
              <div className="flex p-1 bg-slate-100 rounded-xl mb-2">
                <button 
                  className={cn("flex-1 py-2 rounded-lg text-xs font-medium transition-all", heightUnit === 'cm' ? "bg-white shadow-sm text-slate-900" : "text-slate-500")}
                  onClick={() => setHeightUnit('cm')}
                >
                  CM
                </button>
                <button 
                  className={cn("flex-1 py-2 rounded-lg text-xs font-medium transition-all", heightUnit === 'ft' ? "bg-white shadow-sm text-slate-900" : "text-slate-500")}
                  onClick={() => setHeightUnit('ft')}
                >
                  FT/IN
                </button>
              </div>

              {heightUnit === 'ft' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Feet</label>
                    <input 
                      id="height-ft-input"
                      type="number" 
                      placeholder="0"
                      className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none text-2xl font-bold text-center"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Inches</label>
                    <input 
                      id="height-in-input"
                      type="number" 
                      placeholder="0"
                      className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none text-2xl font-bold text-center"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Height (cm)</label>
                  <input 
                    id="height-cm-input"
                    type="number" 
                    placeholder="0"
                    className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none text-2xl font-bold text-center"
                    autoFocus
                  />
                </div>
              )}
              <Button 
                className="w-full py-4"
                onClick={() => {
                  let cm = 0;
                  if (heightUnit === 'ft') {
                    const ft = parseFloat((document.getElementById('height-ft-input') as HTMLInputElement).value) || 0;
                    const inch = parseFloat((document.getElementById('height-in-input') as HTMLInputElement).value) || 0;
                    const totalInches = (ft * 12) + inch;
                    cm = totalInches * 2.54;
                  } else {
                    cm = parseFloat((document.getElementById('height-cm-input') as HTMLInputElement).value) || 0;
                  }
                  if (cm > 0) {
                    setHeight(cm);
                    setShowAddHeight(false);
                  }
                }}
              >
                Save Height
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setShowAddHeight(false)}>Cancel</Button>
            </div>
          </Card>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-4">
          <Card className="w-full max-w-sm animate-in slide-in-from-bottom duration-300">
            <h2 className="text-xl font-bold mb-6">Settings</h2>
            
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Weight Units</label>
                <div className="flex p-1 bg-slate-100 rounded-xl">
                  {(['lbs', 'kg', 'st'] as const).map((unit) => (
                    <button
                      key={unit}
                      onClick={() => setWeightUnit(unit)}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-xs font-bold transition-all",
                        weightUnit === unit ? "bg-white shadow-sm text-emerald-600" : "text-slate-500"
                      )}
                    >
                      {unit.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Height Units</label>
                <div className="flex p-1 bg-slate-100 rounded-xl">
                  {(['cm', 'ft'] as const).map((unit) => (
                    <button
                      key={unit}
                      onClick={() => setHeightUnit(unit)}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-xs font-bold transition-all",
                        heightUnit === unit ? "bg-white shadow-sm text-emerald-600" : "text-slate-500"
                      )}
                    >
                      {unit === 'cm' ? 'CM' : 'FT/IN'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Body Measurement Units</label>
                <div className="flex p-1 bg-slate-100 rounded-xl">
                  {(['in', 'cm'] as const).map((unit) => (
                    <button
                      key={unit}
                      onClick={() => setMeasurementUnit(unit)}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-xs font-bold transition-all",
                        measurementUnit === unit ? "bg-white shadow-sm text-emerald-600" : "text-slate-500"
                      )}
                    >
                      {unit === 'in' ? 'Inches' : 'CM'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4">
                <Button className="w-full py-4" onClick={() => setShowSettings(false)}>
                  Done
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
