import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Syringe, 
  Utensils, 
  Smile, 
  LineChart, 
  Plus, 
  ChevronRight, 
  AlertCircle,
  History,
  MapPin,
  Calendar,
  Sparkles,
  ArrowRight,
  Scale,
  Droplets,
  Minus
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
import { GoogleGenAI, Type } from "@google/genai";
import Markdown from 'react-markdown';
import { cn } from './lib/utils';
import { 
  Shot, 
  FoodEntry, 
  FeelingEntry, 
  WeightEntry, 
  Mood, 
  INJECTION_SITES, 
  COMMON_SIDE_EFFECTS 
} from './types';

// --- Persistence Helpers ---
const STORAGE_KEYS = {
  SHOTS: 'mj_shots',
  FOOD: 'mj_food',
  FEELINGS: 'mj_feelings',
  WEIGHT: 'mj_weight',
  PROFILE: 'mj_profile',
  UNIT: 'mj_unit',
  HEIGHT: 'mj_height',
  HEIGHT_UNIT: 'mj_height_unit'
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
  onClick?: () => void; 
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'shots' | 'log' | 'progress' | 'coach'>('dashboard');
  
  // Data State
  const [shots, setShots] = useState<Shot[]>(() => load(STORAGE_KEYS.SHOTS, []));
  const [food, setFood] = useState<FoodEntry[]>(() => load(STORAGE_KEYS.FOOD, []));
  const [feelings, setFeelings] = useState<FeelingEntry[]>(() => load(STORAGE_KEYS.FEELINGS, []));
  const [weight, setWeight] = useState<WeightEntry[]>(() => load(STORAGE_KEYS.WEIGHT, []));
  const [weightUnit, setWeightUnit] = useState<'lbs' | 'kg' | 'st'>(() => load(STORAGE_KEYS.UNIT, 'lbs'));
  const [height, setHeight] = useState<number | null>(() => load(STORAGE_KEYS.HEIGHT, null)); // stored in cm
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft'>(() => load(STORAGE_KEYS.HEIGHT_UNIT, 'cm'));
  const [water, setWater] = useState<number>(() => load('mj_water', 0));
  
  // UI State
  const [showAddShot, setShowAddShot] = useState(false);
  const [showAddWeight, setShowAddWeight] = useState(false);
  const [showAddHeight, setShowAddHeight] = useState(false);
  const [coachResponse, setCoachResponse] = useState<string>('');
  const [isCoachLoading, setIsCoachLoading] = useState(false);

  // Sync to LocalStorage
  useEffect(() => save(STORAGE_KEYS.SHOTS, shots), [shots]);
  useEffect(() => save(STORAGE_KEYS.FOOD, food), [food]);
  useEffect(() => save(STORAGE_KEYS.FEELINGS, feelings), [feelings]);
  useEffect(() => save(STORAGE_KEYS.WEIGHT, weight), [weight]);
  useEffect(() => save(STORAGE_KEYS.UNIT, weightUnit), [weightUnit]);
  useEffect(() => save(STORAGE_KEYS.HEIGHT, height), [height]);
  useEffect(() => save(STORAGE_KEYS.HEIGHT_UNIT, heightUnit), [heightUnit]);
  useEffect(() => save('mj_water', water), [water]);

  // Reset water daily
  useEffect(() => {
    const lastReset = localStorage.getItem('mj_water_reset');
    const today = format(new Date(), 'yyyy-MM-dd');
    if (lastReset !== today) {
      setWater(0);
      localStorage.setItem('mj_water_reset', today);
    }
  }, []);

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

  const todayFood = useMemo(() => food.filter(f => isToday(parseISO(f.timestamp))), [food]);
  const todayCalories = useMemo(() => todayFood.reduce((sum, f) => sum + (Number(f.calories) || 0), 0), [todayFood]);
  const todayProtein = useMemo(() => todayFood.reduce((sum, f) => sum + (Number(f.protein) || 0), 0), [todayFood]);

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

  const addFood = (name: string, calories: number, protein: number, notes?: string) => {
    const newEntry: FoodEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      name,
      calories,
      protein,
      notes
    };
    setFood([...food, newEntry]);
  };

  const addFeeling = (mood: Mood, sideEffects: string[], notes: string) => {
    const newEntry: FeelingEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      mood,
      sideEffects,
      notes
    };
    setFeelings([...feelings, newEntry]);
  };

  const askCoach = async () => {
    setIsCoachLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const model = "gemini-3-flash-preview";
      
      const context = `
        User is on a weight loss journey using Mounjaro.
        Current Weight: ${currentWeight} lbs (Total lost: ${totalLost} lbs).
        Today's Intake: ${todayCalories} calories, ${todayProtein}g protein.
        Latest Mood: ${feelings[feelings.length - 1]?.mood || 'Not logged'}.
        Side Effects: ${feelings[feelings.length - 1]?.sideEffects.join(', ') || 'None'}.
        
        Provide a brief, encouraging, and helpful tip for today. 
        If Today's Intake is 0, remind them to log their meals using the AI estimator.
        Focus on protein, hydration, or managing side effects if any are present.
      `;

      const response = await ai.models.generateContent({
        model,
        contents: context,
      });
      setCoachResponse(response.text || "I'm here to support you! Keep focusing on your protein and hydration.");
    } catch (error) {
      console.error(error);
      setCoachResponse("Sorry, I'm having trouble connecting right now. Remember to drink plenty of water!");
    } finally {
      setIsCoachLoading(false);
    }
  };

  // --- Views ---

  const DashboardView = () => (
    <div className="space-y-6 pb-24">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Journey</h1>
          <p className="text-slate-500 text-sm">{format(new Date(), 'EEEE, MMMM do')}</p>
        </div>
        <div className="bg-emerald-50 p-2 rounded-full">
          <Sparkles className="w-6 h-6 text-emerald-600" />
        </div>
      </header>

      {/* Shot Countdown */}
      <Card className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white border-none">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-emerald-100 text-xs font-medium uppercase tracking-wider">Next Shot In</p>
            <h2 className="text-4xl font-bold mt-1">
              {daysUntilNextShot !== null ? (daysUntilNextShot <= 0 ? 'Today!' : `${daysUntilNextShot} Days`) : 'Set first shot'}
            </h2>
            <p className="text-emerald-100 text-sm mt-2">
              {nextShotDate ? `Due ${format(nextShotDate, 'MMM do')}` : 'Log your first injection to start tracking'}
            </p>
          </div>
          <Syringe className="w-12 h-12 text-white/20" />
        </div>
        <Button 
          variant="secondary" 
          className="w-full mt-4 bg-white/20 hover:bg-white/30 border-none text-white"
          onClick={() => setShowAddShot(true)}
        >
          <Plus className="w-4 h-4" /> Log Shot
        </Button>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <Scale className="w-5 h-5 text-blue-500" />
            <div className="flex gap-1">
              {(['lbs', 'kg', 'st'] as const).map(u => (
                <button 
                  key={u}
                  onClick={() => setWeightUnit(u)}
                  className={cn(
                    "text-[8px] font-bold px-1.5 py-0.5 rounded-full transition-all",
                    weightUnit === u ? "bg-blue-500 text-white" : "bg-blue-50 text-blue-400 hover:bg-blue-100"
                  )}
                >
                  {u.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <p className="text-slate-500 text-xs">Current Weight</p>
            <p className="text-xl font-bold text-slate-900">{formatWeight(currentWeight)}</p>
            {totalLostDisplay && (
              <p className="text-[10px] font-bold text-blue-500 mt-1">
                Total lost: {totalLostDisplay}
              </p>
            )}
          </div>
          <Button variant="ghost" className="p-0 h-auto mt-2 text-xs justify-start" onClick={() => setShowAddWeight(true)}>
            Update <ChevronRight className="w-3 h-3" />
          </Button>
        </Card>

        <Card className="flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <Utensils className="w-5 h-5 text-orange-500" />
            <span className="text-[10px] font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">
              {todayProtein}g Protein
            </span>
          </div>
          <div className="mt-4">
            <p className="text-slate-500 text-xs">Today's Calories</p>
            <p className={cn("text-xl font-bold", todayCalories > 0 ? "text-slate-900" : "text-slate-300")}>
              {todayCalories > 0 ? `${todayCalories} kcal` : '0 kcal'}
            </p>
          </div>
          <Button variant="ghost" className="p-0 h-auto mt-2 text-xs justify-start" onClick={() => setActiveTab('log')}>
            {todayCalories > 0 ? 'Log More' : 'Log Meal'} <ChevronRight className="w-3 h-3" />
          </Button>
        </Card>
      </div>

      {/* Water Tracking */}
      <Card className="flex items-center justify-between bg-blue-50/50 border-blue-100">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-2 rounded-xl">
            <Droplets className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Hydration</h3>
            <p className="text-xs text-slate-500">{water} glasses today</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setWater(Math.max(0, water - 1))}
            className="p-2 bg-white rounded-lg border border-blue-200 text-blue-600 active:scale-90 transition-all"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setWater(water + 1)}
            className="p-2 bg-blue-600 rounded-lg text-white active:scale-90 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </Card>

      {/* Coach Quick Tip */}
      <Card className="bg-slate-50 border-dashed border-slate-300">
        <div className="flex gap-3">
          <div className="bg-white p-2 rounded-xl shadow-sm h-fit">
            <Sparkles className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Daily Coach Tip</h3>
            <p className="text-slate-600 text-xs mt-1 leading-relaxed">
              {coachResponse || "Log your food and feelings to get personalized advice from your AI coach."}
            </p>
            {!coachResponse && (
              <Button 
                variant="outline" 
                className="mt-3 text-xs py-1.5 h-auto" 
                onClick={askCoach}
                id="ask-coach-btn"
              >
                {isCoachLoading ? 'Thinking...' : 'Get Tip'}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Recent Activity */}
      <div className="space-y-3">
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <History className="w-4 h-4" /> Recent Activity
        </h3>
        {[...food, ...feelings, ...shots]
          .sort((a, b) => new Date((a as any).timestamp || (a as any).date).getTime() - new Date((b as any).timestamp || (b as any).date).getTime())
          .reverse()
          .slice(0, 3)
          .map((item: any) => (
            <div key={item.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
              <div className={cn(
                "p-2 rounded-lg",
                item.name ? "bg-orange-50 text-orange-500" : 
                item.mood ? "bg-purple-50 text-purple-500" : 
                "bg-emerald-50 text-emerald-500"
              )}>
                {item.name ? <Utensils className="w-4 h-4" /> : item.mood ? <Smile className="w-4 h-4" /> : <Syringe className="w-4 h-4" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">
                  {item.name || (item.mood ? `Feeling ${item.mood}` : `Shot: ${item.dose}`)}
                </p>
                <p className="text-[10px] text-slate-400">
                  {format(parseISO(item.timestamp || item.date), 'h:mm a')}
                </p>
              </div>
            </div>
          ))}
      </div>
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

  const LogView = () => {
    const [logType, setLogType] = useState<'food' | 'feeling'>('food');
    const [foodName, setFoodName] = useState('');
    const [cals, setCals] = useState('');
    const [prot, setProt] = useState('');
    const [isEstimating, setIsEstimating] = useState(false);
    const [selectedMood, setSelectedMood] = useState<Mood>('Good');
    const [selectedSideEffects, setSelectedSideEffects] = useState<string[]>([]);
    const [notes, setNotes] = useState('');

    const handleEstimate = async () => {
      if (!foodName.trim()) return;
      setIsEstimating(true);
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Estimate the calories and protein for this meal: "${foodName}". Provide a realistic estimate for a standard serving size.`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                calories: { type: Type.INTEGER },
                protein: { type: Type.INTEGER },
                servingSize: { type: Type.STRING }
              },
              required: ["calories", "protein"]
            }
          }
        });

        const data = JSON.parse(response.text || '{}');
        if (data.calories) setCals(data.calories.toString());
        if (data.protein) setProt(data.protein.toString());
        if (data.servingSize) setNotes(prev => prev ? `${prev}\nEstimated for: ${data.servingSize}` : `Estimated for: ${data.servingSize}`);
      } catch (error) {
        console.error("Estimation error:", error);
      } finally {
        setIsEstimating(false);
      }
    };

    const handleFoodSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!foodName) return;
      
      const calories = parseInt(cals) || 0;
      const protein = parseInt(prot) || 0;
      
      addFood(foodName, calories, protein, notes);
      setFoodName(''); setCals(''); setProt(''); setNotes('');
      
      // Show a quick success feedback before switching
      const btn = e.currentTarget.querySelector('button[type="submit"]');
      if (btn) {
        const originalText = btn.innerHTML;
        btn.innerHTML = '✓ Logged!';
        btn.classList.add('bg-emerald-500');
        setTimeout(() => {
          btn.innerHTML = originalText;
          btn.classList.remove('bg-emerald-500');
          setActiveTab('dashboard');
        }, 600);
      } else {
        setActiveTab('dashboard');
      }
    };

    const handleFeelingSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      addFeeling(selectedMood, selectedSideEffects, notes);
      setSelectedMood('Good'); setSelectedSideEffects([]); setNotes('');
      setActiveTab('dashboard');
    };

    return (
      <div className="space-y-6 pb-24">
        <header>
          <h1 className="text-2xl font-bold text-slate-900">Daily Log</h1>
          <p className="text-slate-500 text-sm">Track your intake and wellness</p>
        </header>

        <div className="flex p-1 bg-slate-100 rounded-xl">
          <button 
            className={cn("flex-1 py-2 rounded-lg text-sm font-medium transition-all", logType === 'food' ? "bg-white shadow-sm text-slate-900" : "text-slate-500")}
            onClick={() => setLogType('food')}
          >
            Food
          </button>
          <button 
            className={cn("flex-1 py-2 rounded-lg text-sm font-medium transition-all", logType === 'feeling' ? "bg-white shadow-sm text-slate-900" : "text-slate-500")}
            onClick={() => setLogType('feeling')}
          >
            Feelings
          </button>
        </div>

        {logType === 'food' ? (
          <form onSubmit={handleFoodSubmit} className="space-y-4">
            <p className="text-[10px] text-slate-400 italic">
              Tip: Type your meal and tap "AI Estimate" to automatically calculate calories. Remember to tap "Log Food" below to save it!
            </p>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-500 uppercase">What did you eat?</label>
                <button 
                  type="button"
                  onClick={handleEstimate}
                  disabled={isEstimating || !foodName.trim()}
                  className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-3 h-3" /> {isEstimating ? 'Estimating...' : 'AI Estimate'}
                </button>
              </div>
              <input 
                type="text" 
                placeholder="e.g. Grilled Chicken Salad"
                className="w-full p-4 bg-white rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                value={foodName}
                onChange={e => setFoodName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Calories (kcal)</label>
                <input 
                  type="number" 
                  placeholder="0"
                  className="w-full p-4 bg-white rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={cals}
                  onChange={e => setCals(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Protein (g)</label>
                <input 
                  type="number" 
                  placeholder="0"
                  className="w-full p-4 bg-white rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={prot}
                  onChange={e => setProt(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Notes / Serving Size</label>
              <input 
                type="text" 
                placeholder="e.g. 1 medium bowl"
                className="w-full p-4 bg-white rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
            <Button className="w-full py-4 mt-4">Log Food</Button>
          </form>
        ) : (
          <form onSubmit={handleFeelingSubmit} className="space-y-6">
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-500 uppercase">Current Mood</label>
              <div className="grid grid-cols-5 gap-2">
                {(['Bad', 'Poor', 'Okay', 'Good', 'Great'] as Mood[]).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSelectedMood(m)}
                    className={cn(
                      "py-3 rounded-xl border text-xl transition-all",
                      selectedMood === m ? "bg-emerald-600 border-emerald-600 text-white" : "bg-white border-slate-200 text-slate-400"
                    )}
                  >
                    {m === 'Great' ? '🤩' : m === 'Good' ? '😊' : m === 'Okay' ? '😐' : m === 'Poor' ? '😔' : '😫'}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-500 uppercase">Side Effects</label>
              <div className="flex flex-wrap gap-2">
                {COMMON_SIDE_EFFECTS.map(se => (
                  <button
                    key={se}
                    type="button"
                    onClick={() => {
                      setSelectedSideEffects(prev => 
                        prev.includes(se) ? prev.filter(x => x !== se) : [...prev, se]
                      );
                    }}
                    className={cn(
                      "px-3 py-2 rounded-full text-xs font-medium border transition-all",
                      selectedSideEffects.includes(se) ? "bg-purple-100 border-purple-200 text-purple-700" : "bg-white border-slate-200 text-slate-500"
                    )}
                  >
                    {se}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Notes</label>
              <textarea 
                placeholder="How are you really feeling?"
                className="w-full p-4 bg-white rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none min-h-[100px]"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
            <Button className="w-full py-4">Log Feeling</Button>
          </form>
        )}
      </div>
    );
  };

  const ProgressView = () => {
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

        <div className="space-y-3">
          <h3 className="font-bold text-slate-900 text-sm">Weight Log</h3>
          {[...weight].reverse().map(w => (
            <div key={w.id} className="flex justify-between items-center p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
              <p className="text-sm font-medium text-slate-900">{format(parseISO(w.date), 'MMM do, yyyy')}</p>
              <p className="text-sm font-bold text-emerald-600">{formatWeight(w.weight)}</p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const CoachView = () => {
    const [chatInput, setChatInput] = useState('');
    const [chatHistory, setChatHistory] = useState<{role: 'user' | 'ai', text: string}[]>([]);

    const handleChat = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!chatInput.trim()) return;

      const userMsg = chatInput;
      setChatInput('');
      setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
      setIsCoachLoading(true);

      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const model = "gemini-3-flash-preview";
        
        const prompt = `
          You are a supportive weight loss coach for someone on Mounjaro. 
          User just said: "${userMsg}"
          
          Context:
          Current Weight: ${currentWeight} lbs.
          Total Lost: ${totalLost} lbs.
          Latest Side Effects: ${feelings[feelings.length - 1]?.sideEffects.join(', ') || 'None'}.
          
          Provide a helpful, empathetic response. Keep it concise and encouraging.
        `;

        const response = await ai.models.generateContent({ model, contents: prompt });
        setChatHistory(prev => [...prev, { role: 'ai', text: response.text || "I'm here for you! Keep going." }]);
      } catch (error) {
        setChatHistory(prev => [...prev, { role: 'ai', text: "Sorry, I'm having trouble connecting. But don't give up!" }]);
      } finally {
        setIsCoachLoading(false);
      }
    };

    return (
      <div className="flex flex-col h-[calc(100vh-160px)] pb-24">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">AI Coach</h1>
          <p className="text-slate-500 text-sm">Get advice and support anytime</p>
        </header>

        <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 scrollbar-hide">
          {chatHistory.length === 0 && (
            <div className="text-center py-12">
              <div className="bg-emerald-50 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="font-bold text-slate-900">How can I help today?</h3>
              <p className="text-slate-500 text-sm mt-2 px-8">Ask about nutrition, managing side effects, or just get some motivation.</p>
            </div>
          )}
          {chatHistory.map((msg, i) => (
            <div key={i} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[85%] p-4 rounded-2xl text-sm",
                msg.role === 'user' ? "bg-emerald-600 text-white rounded-tr-none" : "bg-white border border-slate-100 shadow-sm text-slate-700 rounded-tl-none"
              )}>
                <Markdown>{msg.text}</Markdown>
              </div>
            </div>
          ))}
          {isCoachLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-100 shadow-sm p-4 rounded-2xl rounded-tl-none">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleChat} className="relative">
          <input 
            type="text" 
            placeholder="Ask your coach..."
            className="w-full p-4 pr-12 bg-white rounded-2xl border border-slate-200 shadow-lg focus:ring-2 focus:ring-emerald-500 outline-none"
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
          />
          <button type="submit" className="absolute right-3 top-3 p-2 bg-emerald-600 text-white rounded-xl active:scale-90 transition-all">
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <div className="max-w-md mx-auto px-4 pt-6">
        {activeTab === 'dashboard' && <DashboardView />}
        {activeTab === 'shots' && <ShotsView />}
        {activeTab === 'log' && <LogView />}
        {activeTab === 'progress' && <ProgressView />}
        {activeTab === 'coach' && <CoachView />}
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
        <button onClick={() => setActiveTab('log')} className={cn("flex flex-col items-center gap-1", activeTab === 'log' ? "text-emerald-600" : "text-slate-400")}>
          <Plus className="w-8 h-8 bg-emerald-600 text-white rounded-2xl shadow-lg -mt-8 border-4 border-slate-50" />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Log</span>
        </button>
        <button onClick={() => setActiveTab('progress')} className={cn("flex flex-col items-center gap-1", activeTab === 'progress' ? "text-emerald-600" : "text-slate-400")}>
          <LineChart className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Stats</span>
        </button>
        <button onClick={() => setActiveTab('coach')} className={cn("flex flex-col items-center gap-1", activeTab === 'coach' ? "text-emerald-600" : "text-slate-400")}>
          <Sparkles className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Coach</span>
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
                  <label className="text-xs font-bold text-slate-500 uppercase">Current Weight ({weightUnit})</label>
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
    </div>
  );
}
