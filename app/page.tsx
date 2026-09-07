'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient, User } from '@supabase/supabase-js';

// Supabase クライアント初期化
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null;

// 空港マスタ
const DOMESTIC_AIRPORTS = [
  { code: 'HND', name: '羽田' },
  { code: 'NRT', name: '成田' },
  { code: 'ITM', name: '伊丹' },
  { code: 'KIX', name: '関空' },
  { code: 'OKA', name: '那覇' },
  { code: 'CTS', name: '新千歳' },
  { code: 'FUK', name: '福岡' },
  { code: 'NGO', name: '中部' },
  { code: 'ISG', name: '石垣' },
  { code: 'MMY', name: '宮古' },
  { code: 'HIJ', name: '広島' },
];

const INT_AIRPORTS = [
  { code: 'BKK', name: 'バンコク', region: 'asia' },
  { code: 'SIN', name: 'シンガポール', region: 'asia' },
  { code: 'TPE', name: '台北(松山/桃園)', region: 'asia' },
  { code: 'KUL', name: 'クアラルンプール', region: 'asia' },
  { code: 'HNL', name: 'ホノルル', region: 'other' },
  { code: 'LAX', name: 'ロサンゼルス', region: 'other' },
  { code: 'LHR', name: 'ロンドン', region: 'other' },
];

const CITY_NAME_MAP: Record<string, string> = {
  'TOKYO/HANEDA': '羽田', 'TOKYO/NARITA': '成田', 'TOKYO': '東京',
  'BANGKOK': 'バンコク', 'SINGAPORE': 'シンガポール', 'KUALA LUMPUR': 'クアラルンプール',
  'KUALA LUMPUR SPNG': 'クアラルンプール', 'OKINAWA': '那覇', 'SAPPORO': '新千歳',
  'FUKUOKA': '福岡', 'OSAKA/ITAMI': '伊丹', 'OSAKA/KANSAI': '関空', 'HIROSHIMA': '広島',
  '東京（羽田）': '羽田', '広島': '広島'
};

const ROUTE_MILES: Record<string, number> = {
  'HND_OKA': 984, 'OKA_HND': 984,
  'HND_CTS': 510, 'CTS_HND': 510,
  'HND_ITM': 280, 'ITM_HND': 280,
  'HND_KIX': 280, 'KIX_HND': 280,
  'HND_FUK': 567, 'FUK_HND': 567,
  'HND_HIJ': 356, 'HIJ_HND': 356,
  'HND_ISG': 1224, 'ISG_HND': 1224,
  'HND_MMY': 1158, 'MMY_HND': 1158,
  'NRT_OKA': 1019, 'OKA_NRT': 1019,
  'KIX_OKA': 739, 'OKA_KIX': 739,
  'NGO_OKA': 809, 'OKA_NGO': 809,
  'FUK_OKA': 537, 'OKA_FUK': 537,
  'HND_BKK': 2869, 'BKK_HND': 2869, 'NRT_BKK': 2869, 'BKK_NRT': 2869,
  'HND_SIN': 3312, 'SIN_HND': 3312, 'NRT_SIN': 3312, 'SIN_NRT': 3312,
  'BKK_SIN': 880, 'SIN_BKK': 880,
  'BKK_KUL': 756, 'KUL_BKK': 756,
  'KUL_SIN': 185, 'SIN_KUL': 185,
};

const getBaseLTMFromNames = (depName: string, arrName: string): number => {
  const allAirports = [...DOMESTIC_AIRPORTS, ...INT_AIRPORTS];
  const dep = allAirports.find(a => a.name === depName || a.code === depName);
  const arr = allAirports.find(a => a.name === arrName || a.code === arrName);
  if (dep && arr) {
    const key = `${dep.code}_${arr.code}`;
    if (ROUTE_MILES[key]) return ROUTE_MILES[key];
  }
  return 0;
};

const DOMESTIC_FARES = [
  { label: '運賃1 (150%) - プレミアムFlex等', rate: 150, defaultBp: 400 },
  { label: '運賃2 (125%) - プレミアム特割等', rate: 125, defaultBp: 400 },
  { label: '運賃3 (100%) - ANA Flex等', rate: 100, defaultBp: 400 },
  { label: '運賃4 (75%) - ANA Value / Super Value等', rate: 75, defaultBp: 0 },
  { label: '運賃5 (50%) - Super Value Sale等', rate: 50, defaultBp: 0 },
];

const INT_FARES = [
  { label: 'ファースト/ビジネス F / A / J (150%)', rate: 150, defaultBp: 400 },
  { label: 'ビジネスクラス C / D / Z (125%)', rate: 125, defaultBp: 400 },
  { label: 'プレエコ / エコノミー G / E / Y / B / M (100%)', rate: 100, defaultBp: 400 },
  { label: 'エコノミー U / H / Q (70%)', rate: 70, defaultBp: 0 },
  { label: 'エコノミー V / W / S / L / K (50%)', rate: 50, defaultBp: 0 },
];

interface Flight {
  id: string | number;
  date: string;
  type: 'domestic' | 'international';
  airline: 'ana' | 'star';
  route: string;
  cost: number;
  pp: number;
  miles: number;
  ltm: number;
}

export default function Home() {
  const [mounted, setMounted] = useState<boolean>(false);

  // 認証状態
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('login');
  const [authEmail, setAuthEmail] = useState<string>('');
  const [authPassword, setAuthPassword] = useState<string>('');
  const [authMsg, setAuthMessage] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  // ヘッダー3点ドットメニュー状態
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ユーザー設定状態（デフォルトは一般会員 / LTM 0）
  const [currentStatus, setCurrentStatus] = useState<string>('none');
  const [cardType, setCardType] = useState<string>('general');
  const [pastAnaLTM, setPastAnaLTM] = useState<number>(0);
  const [pastStarLTM, setPastStarLTM] = useState<number>(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // 目標設定状態
  const [goalMode, setGoalMode] = useState<'flight' | 'life'>('flight');
  const [selectedStatus, setSelectedStatus] = useState<string>('platinum');
  const [ltmMode, setLtmMode] = useState<'ana' | 'total'>('ana');
  const [targetLTMInput, setTargetLTMInput] = useState<string>('1,000,000');

  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'domestic' | 'international'>('all');
  const [pageSize, setPageSize] = useState<number>(50);

  const [flights, setFlights] = useState<Flight[]>([]);

  // 初期読み込み & 認証状態監視
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedStatus = localStorage.getItem('ana_user_status');
    if (savedStatus) setCurrentStatus(savedStatus);

    const savedCard = localStorage.getItem('ana_user_card');
    if (savedCard) setCardType(savedCard);

    const savedPastAna = localStorage.getItem('ana_past_ana_ltm');
    if (savedPastAna) setPastAnaLTM(Number(savedPastAna));

    const savedPastStar = localStorage.getItem('ana_past_star_ltm');
    if (savedPastStar) setPastStarLTM(Number(savedPastStar));

    const savedGoalMode = localStorage.getItem('ana_goal_mode');
    if (savedGoalMode) setGoalMode(savedGoalMode as 'flight' | 'life');

    const savedSelectedStatus = localStorage.getItem('ana_selected_status');
    if (savedSelectedStatus) setSelectedStatus(savedSelectedStatus);

    const savedTargetLTM = localStorage.getItem('ana_target_ltm');
    if (savedTargetLTM) setTargetLTMInput(savedTargetLTM);

    const savedFlights = localStorage.getItem('ana_flights');
    if (savedFlights) {
      setFlights(JSON.parse(savedFlights));
    } else {
      // デフォルトのサンプルフライト（羽田ー那覇 往復、羽田ー伊丹 往復）
      setFlights([
        { id: 1, date: '2026-01-15', type: 'domestic', airline: 'ana', route: '羽田 - 那覇', cost: 24000, pp: 2860, miles: 1476, ltm: 984 },
        { id: 2, date: '2026-01-18', type: 'domestic', airline: 'ana', route: '那覇 - 羽田', cost: 24000, pp: 2860, miles: 1476, ltm: 984 },
        { id: 3, date: '2026-02-10', type: 'domestic', airline: 'ana', route: '羽田 - 伊丹', cost: 12000, pp: 1100, miles: 420, ltm: 280 },
        { id: 4, date: '2026-02-12', type: 'domestic', airline: 'ana', route: '伊丹 - 羽田', cost: 12000, pp: 1100, miles: 420, ltm: 280 },
      ]);
    }

    setMounted(true);

    if (supabase) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          setCurrentUser(user);
          loadCloudData(user);
        }
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        const user = session?.user || null;
        setCurrentUser(user);
        if (user) {
          loadCloudData(user);
        }
      });

      return () => subscription.unsubscribe();
    }
  }, []);

  const loadCloudData = async (user: User) => {
    if (!supabase) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profile) {
      setCurrentStatus(profile.current_status || 'none');
      setCardType(profile.card_type || 'general');
      setPastAnaLTM(profile.past_ana_ltm || 0);
      setPastStarLTM(profile.past_star_ltm || 0);
      setSelectedStatus(profile.target_status || 'platinum');
      setGoalMode(profile.goal_mode || 'flight');
      setTargetLTMInput(profile.target_ltm || '1,000,000');
    } else {
      await supabase.from('profiles').upsert({
        id: user.id,
        current_status: currentStatus,
        card_type: cardType,
        past_ana_ltm: pastAnaLTM,
        past_star_ltm: pastStarLTM,
        target_status: selectedStatus,
        goal_mode: goalMode,
        target_ltm: targetLTMInput,
      });
    }

    const { data: dbFlights } = await supabase
      .from('flights')
      .select('*')
      .eq('user_id', user.id);

    if (dbFlights && dbFlights.length > 0) {
      const formattedFlights: Flight[] = dbFlights.map(f => ({
        id: f.id,
        date: f.flight_date,
        type: f.type,
        airline: f.airline,
        route: f.route,
        cost: f.cost,
        pp: f.pp,
        miles: f.miles,
        ltm: f.ltm
      }));
      setFlights(formattedFlights);
    } else if (flights.length > 0) {
      const rowsToInsert = flights.map(f => ({
        user_id: user.id,
        flight_date: f.date,
        type: f.type,
        airline: f.airline,
        route: f.route,
        cost: f.cost,
        pp: f.pp,
        miles: f.miles,
        ltm: f.ltm
      }));
      await supabase.from('flights').insert(rowsToInsert);
    }
  };

  useEffect(() => {
    if (!mounted) return;
    if (!currentUser) {
      localStorage.setItem('ana_user_status', currentStatus);
      localStorage.setItem('ana_user_card', cardType);
      localStorage.setItem('ana_past_ana_ltm', pastAnaLTM.toString());
      localStorage.setItem('ana_past_star_ltm', pastStarLTM.toString());
      localStorage.setItem('ana_flights', JSON.stringify(flights));
      localStorage.setItem('ana_target_ltm', targetLTMInput);
      localStorage.setItem('ana_goal_mode', goalMode);
      localStorage.setItem('ana_selected_status', selectedStatus);
    } else if (supabase) {
      supabase.from('profiles').upsert({
        id: currentUser.id,
        current_status: currentStatus,
        card_type: cardType,
        past_ana_ltm: pastAnaLTM,
        past_star_ltm: pastStarLTM,
        target_status: selectedStatus,
        goal_mode: goalMode,
        target_ltm: targetLTMInput,
      }).then();
    }
  }, [currentStatus, cardType, pastAnaLTM, pastStarLTM, flights, targetLTMInput, goalMode, selectedStatus, currentUser, mounted]);

  const availableYears = Array.from(
    new Set([
      new Date().getFullYear().toString(),
      ...flights.map(f => f.date.substring(0, 4)).filter(Boolean)
    ])
  ).sort((a, b) => Number(b) - Number(a));

  // ユーザー設定ボタンのハンドラー（未ログイン時は開かない）
  const handleOpenSettings = () => {
    setIsHeaderMenuOpen(false);
    if (!currentUser) {
      alert('ユーザー設定を変更するにはログインが必要です。');
      setAuthMessage('');
      setIsAuthModalOpen(true);
      return;
    }
    setIsSettingsOpen(true);
  };

  const handleGoogleLogin = async () => {
    if (!supabase) return;
    setAuthLoading(true);
    setAuthMessage('');

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    });

    if (error) {
      setAuthMessage(`Googleログインエラー: ${error.message}`);
      setAuthLoading(false);
    }
  };

  const handleEmailPasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !authEmail || !authPassword) return;

    setAuthLoading(true);
    setAuthMessage('');

    if (authTab === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
      });

      setAuthLoading(false);
      if (error) {
        setAuthMessage(`登録エラー: ${error.message}`);
      } else if (data.user && data.session) {
        setAuthMessage('🎉 アカウント作成が完了し、ログインしました！');
        setIsAuthModalOpen(false);
      } else {
        setAuthMessage('📧 確認用メールを送信しました。メール内のリンクをクリックして完了してください。');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      });

      setAuthLoading(false);
      if (error) {
        setAuthMessage(`ログインエラー: メールアドレスまたはパスワードが正しくありません。`);
      } else {
        setIsAuthModalOpen(false);
        setAuthPassword('');
      }
    }
  };

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
      setCurrentUser(null);
      setIsHeaderMenuOpen(false);
      alert('ログアウトしました。');
    }
  };

  // 入力フォーム状態
  const [flightType, setFlightType] = useState<'domestic' | 'international'>('domestic');
  const [airline, setAirline] = useState<'ana' | 'star'>('ana');
  const [date, setDate] = useState('2026-01-15');
  const [depAirport, setDepAirport] = useState('HND');
  const [arrAirport, setArrAirport] = useState('OKA');
  const [cost, setCost] = useState('');
  const [accRate, setAccRate] = useState<number>(100);
  const [boardPoints, setBoardPoints] = useState<number>(400);

  const [calculatedPP, setCalculatedPP] = useState<number | null>(0);
  const [calculatedMiles, setCalculatedMiles] = useState<number | null>(0);
  const [calculatedLTM, setCalculatedLTM] = useState<number | null>(0);
  const [routeError, setRouteError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | number | null>(null);

  useEffect(() => {
    if (!editingId) {
      if (flightType === 'domestic') {
        setDepAirport('HND'); setArrAirport('OKA'); setAccRate(100); setBoardPoints(400);
      } else {
        setDepAirport('HND'); setArrAirport('BKK'); setAccRate(100); setBoardPoints(400);
      }
    }
  }, [flightType, editingId]);

  useEffect(() => {
    if (depAirport === arrAirport) {
      setRouteError('出発空港と到着空港に同じ空港が選択されています。');
      setCalculatedMiles(null); setCalculatedPP(null); setCalculatedLTM(null);
      return;
    }

    const routeKey = `${depAirport}_${arrAirport}`;
    const baseMile = ROUTE_MILES[routeKey];

    if (!baseMile) {
      const depName = DOMESTIC_AIRPORTS.find(a => a.code === depAirport)?.name || depAirport;
      const arrName = (flightType === 'domestic' ? DOMESTIC_AIRPORTS : INT_AIRPORTS).find(a => a.code === arrAirport)?.name || arrAirport;
      setRouteError(`「${depName} → ${arrName}」の直行便区間マイルデータが存在しないか非設定ルートです。`);
      setCalculatedMiles(null); setCalculatedPP(null); setCalculatedLTM(null);
      return;
    }

    setRouteError(null);
    const miles = Math.floor(baseMile * (accRate / 100));
    setCalculatedMiles(miles);
    setCalculatedLTM(baseMile);

    let multiplier = 1.0;
    if (airline === 'ana') {
      multiplier = flightType === 'domestic' ? 2.0 : (INT_AIRPORTS.find(a => a.code === arrAirport)?.region === 'asia' ? 1.5 : 1.0);
    }

    const pp = Math.floor(baseMile * (accRate / 100) * multiplier) + Number(boardPoints);
    setCalculatedPP(pp);
  }, [depAirport, arrAirport, accRate, boardPoints, flightType, airline]);

  const targetLTM = Number(targetLTMInput.replace(/,/g, '')) || 0;

  const handleLTMChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/[^0-9]/g, '');
    setTargetLTMInput(rawValue === '' ? '' : Number(rawValue).toLocaleString());
  };

  if (!mounted) return null;

  const filteredFlights = flights
    .filter(f => {
      const isYearMatch = f.date.startsWith(selectedYear);
      const isCategoryMatch = categoryFilter === 'all' || f.type === categoryFilter;
      return isYearMatch && isCategoryMatch;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const totalCost = filteredFlights.reduce((sum, f) => sum + f.cost, 0);
  const totalLTMInYear = filteredFlights.reduce((sum, f) => sum + f.ltm, 0);

  const anaPP = filteredFlights.filter(f => f.airline === 'ana').reduce((sum, f) => sum + f.pp, 0);
  const starPP = filteredFlights.filter(f => f.airline === 'star').reduce((sum, f) => sum + f.pp, 0);
  const totalPP = anaPP + starPP;
  const avgPpUnitCost = totalPP > 0 ? (totalCost / totalPP).toFixed(2) : '0';

  const anaLTMFromLogs = flights.filter(f => f.airline === 'ana').reduce((sum, f) => sum + f.ltm, 0);
  const starLTMFromLogs = flights.filter(f => f.airline === 'star').reduce((sum, f) => sum + f.ltm, 0);

  const currentAnaLTM = pastAnaLTM + anaLTMFromLogs;
  const currentStarLTM = pastStarLTM + starLTMFromLogs;
  const currentTotalLTM = currentAnaLTM + currentStarLTM;

  const targetLTMCurrent = ltmMode === 'ana' ? currentAnaLTM : currentTotalLTM;
  const remainingLTM = Math.max(0, targetLTM - targetLTMCurrent);
  const nahaTripsNeeded = Math.ceil(remainingLTM / (984 * 2));

  const STATUS_SPECS: Record<string, { name: string; flightTotal: number; flightAnaRequired: number; lifeAnaRequired: number }> = {
    bronze: { name: 'ブロンズ', flightTotal: 30000, flightAnaRequired: 15000, lifeAnaRequired: 15000 },
    platinum: { name: 'プラチナ (SFC)', flightTotal: 50000, flightAnaRequired: 25000, lifeAnaRequired: 30000 },
    diamond: { name: 'ダイヤモンド', flightTotal: 100000, flightAnaRequired: 50000, lifeAnaRequired: 50000 },
    diamond_more: { name: 'ダイヤモンド+More', flightTotal: 150000, flightAnaRequired: 150000, lifeAnaRequired: 80000 },
  };

  const currentSpec = STATUS_SPECS[selectedStatus] || STATUS_SPECS.platinum;
  const targetTotalPP = goalMode === 'flight' ? currentSpec.flightTotal : currentSpec.lifeAnaRequired;
  const targetAnaPP = goalMode === 'flight' ? currentSpec.flightAnaRequired : currentSpec.lifeAnaRequired;

  const STATUS_THEMES: Record<string, {
    label: string;
    appBg: string;
    headerBg: string;
    badgeBg: string;
    cardBorder: string;
    cardBg: string;
    primaryBtn: string;
    progressBar: string;
  }> = {
    none: {
      label: '一般会員',
      appBg: 'bg-slate-100',
      headerBg: 'bg-gradient-to-r from-slate-900 to-slate-800 text-white',
      badgeBg: 'bg-slate-700 text-slate-200',
      cardBorder: 'border-slate-200',
      cardBg: 'bg-white',
      primaryBtn: 'bg-blue-600 hover:bg-blue-700 text-white',
      progressBar: 'bg-blue-600',
    },
    bronze: {
      label: 'ブロンズ',
      appBg: 'bg-gradient-to-b from-amber-50/80 via-stone-100 to-amber-100/40',
      headerBg: 'bg-gradient-to-r from-amber-900 via-amber-800 to-amber-950 text-amber-100 shadow-amber-900/10',
      badgeBg: 'bg-amber-700/80 text-amber-200 border border-amber-500',
      cardBorder: 'border-amber-300/80',
      cardBg: 'bg-amber-50/30',
      primaryBtn: 'bg-amber-800 hover:bg-amber-900 text-amber-50',
      progressBar: 'bg-amber-700',
    },
    platinum: {
      label: 'プラチナ (SFC)',
      appBg: 'bg-gradient-to-b from-slate-100 via-sky-50/50 to-indigo-50/40',
      headerBg: 'bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-sky-100 shadow-blue-900/10',
      badgeBg: 'bg-blue-600 text-white border border-sky-400',
      cardBorder: 'border-blue-300/80',
      cardBg: 'bg-sky-50/20',
      primaryBtn: 'bg-blue-600 hover:bg-blue-700 text-white',
      progressBar: 'bg-blue-600',
    },
    diamond: {
      label: 'ダイヤモンド',
      appBg: 'bg-gradient-to-b from-rose-50/60 via-stone-100 to-red-100/40',
      headerBg: 'bg-gradient-to-r from-red-950 via-rose-900 to-slate-950 text-rose-100 shadow-red-950/20',
      badgeBg: 'bg-red-700 text-white border border-rose-400',
      cardBorder: 'border-rose-300/80',
      cardBg: 'bg-rose-50/30',
      primaryBtn: 'bg-red-700 hover:bg-red-800 text-white',
      progressBar: 'bg-red-600',
    },
    diamond_more: {
      label: 'ダイヤモンド +More',
      appBg: 'bg-gradient-to-b from-stone-200 via-red-950/10 to-amber-900/15',
      headerBg: 'bg-gradient-to-r from-red-950 via-purple-950 to-amber-950 text-amber-200 border-b-2 border-amber-400 shadow-xl',
      badgeBg: 'bg-gradient-to-r from-red-700 to-amber-600 text-white border border-amber-300 font-bold',
      cardBorder: 'border-rose-400/80',
      cardBg: 'bg-red-950/5',
      primaryBtn: 'bg-gradient-to-r from-red-800 to-rose-900 hover:from-red-900 hover:to-rose-950 text-amber-200 font-bold',
      progressBar: 'bg-gradient-to-r from-red-600 to-amber-500',
    },
  };

  const theme = STATUS_THEMES[currentStatus] || STATUS_THEMES.none;

  const CARD_NAMES: Record<string, string> = {
    none: 'カードなし',
    general: 'ANA一般カード',
    gold: 'ANAゴールドカード',
    premium: 'ANAカード プレミアム',
  };

  const getRouteLabel = () => {
    const depList = DOMESTIC_AIRPORTS;
    const arrList = flightType === 'domestic' ? DOMESTIC_AIRPORTS : INT_AIRPORTS;
    const depName = depList.find(a => a.code === depAirport)?.name || depAirport;
    const arrName = arrList.find(a => a.code === arrAirport)?.name || arrAirport;
    return `${depName} - ${arrName}`;
  };

  const handleSaveFlight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cost || routeError || calculatedPP === null || calculatedMiles === null || calculatedLTM === null) return;

    const routeLabel = getRouteLabel();

    if (currentUser && supabase) {
      if (editingId) {
        await supabase.from('flights').update({
          flight_date: date,
          type: flightType,
          airline,
          route: routeLabel,
          cost: Number(cost),
          pp: calculatedPP,
          miles: calculatedMiles,
          ltm: calculatedLTM
        }).eq('id', editingId);

        setFlights(flights.map(f => f.id === editingId ? {
          ...f, date, type: flightType, airline, route: routeLabel, cost: Number(cost), pp: calculatedPP, miles: calculatedMiles, ltm: calculatedLTM
        } : f));
        setEditingId(null);
      } else {
        const { data } = await supabase.from('flights').insert({
          user_id: currentUser.id,
          flight_date: date,
          type: flightType,
          airline,
          route: routeLabel,
          cost: Number(cost),
          pp: calculatedPP,
          miles: calculatedMiles,
          ltm: calculatedLTM
        }).select().single();

        if (data) {
          const newFlight: Flight = {
            id: data.id, date, type: flightType, airline, route: routeLabel, cost: Number(cost), pp: calculatedPP, miles: calculatedMiles, ltm: calculatedLTM
          };
          setFlights([newFlight, ...flights]);
        }
      }
    } else {
      if (editingId) {
        setFlights(flights.map(f => f.id === editingId ? {
          ...f, date, type: flightType, airline, route: routeLabel, cost: Number(cost), pp: calculatedPP, miles: calculatedMiles, ltm: calculatedLTM
        } : f));
        setEditingId(null);
      } else {
        const newFlight: Flight = {
          id: Date.now(), date, type: flightType, airline, route: routeLabel, cost: Number(cost), pp: calculatedPP, miles: calculatedMiles, ltm: calculatedLTM
        };
        setFlights([newFlight, ...flights]);
      }
    }
    setCost('');
  };

  const handleEdit = (flight: Flight) => {
    setEditingId(flight.id);
    setDate(flight.date);
    setFlightType(flight.type);
    setAirline(flight.airline);
    setCost(flight.cost.toString());

    if (flight.route.includes('-')) {
      const parts = flight.route.split('-').map(s => s.trim());
      const allAirports = [...DOMESTIC_AIRPORTS, ...INT_AIRPORTS];
      const foundDep = allAirports.find(a => a.name === parts[0] || a.code === parts[0]);
      const foundArr = allAirports.find(a => a.name === parts[1] || a.code === parts[1]);
      if (foundDep) setDepAirport(foundDep.code);
      if (foundArr) setArrAirport(foundArr.code);
    }
    setOpenMenuId(null);
  };

  const handleDelete = async (id: string | number) => {
    if (currentUser && supabase) {
      await supabase.from('flights').delete().eq('id', id);
    }
    setFlights(flights.filter(f => f.id !== id));
    setOpenMenuId(null);
  };

  const handleExportCSV = () => {
    const headers = ['搭乗日', '種別', '運航会社', '路線', '金額(円)', '獲得PP', 'PP単価', '獲得マイル', '獲得LTM'];
    const csvRows = filteredFlights.map(f => [
      f.date,
      f.type === 'domestic' ? '国内線' : '国際線',
      f.airline === 'ana' ? 'ANAグループ便' : 'スターアライアンス/他社便',
      `"${f.route}"`,
      f.cost,
      f.pp,
      (f.cost / f.pp).toFixed(1),
      f.miles,
      f.ltm
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...csvRows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ANA_Flight_History_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCSVLine = (line: string): string[] => {
    if (line.includes('\t')) {
      return line.split('\t').map(c => c.replace(/^["']|["']$/g, '').trim());
    }
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.replace(/^["']|["']$/g, '').trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.replace(/^["']|["']$/g, '').trim());
    return result;
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r\n|\n/);
      const newImportedFlights: Flight[] = [];
      const dbInsertRows: any[] = [];

      lines.forEach((line, index) => {
        if (!line.trim()) return;
        const cols = parseCSVLine(line);
        if (cols.length < 3) return;

        const dateRaw = cols[0];
        const flightNo = cols[1] || '';
        const content = cols[2] || '';

        const isService = content.includes('ANAカード') || content.includes('ANAPAY') ||
          content.includes('でんき') || content.includes('モバイル') ||
          content.includes('タクシー') || content.includes('三井住友') ||
          content.includes('高島屋') || content.includes('タッチ払い') ||
          content.includes('チャージ') || content.includes('バーチャルカード');
        if (isService) return;

        if (!flightNo && !content.includes('-') && !content.includes('−')) return;

        let miles = 0;
        let pp = 0;

        if (cols[5]) miles = parseInt(cols[5].replace(/,/g, ''), 10) || 0;
        if (cols[9]) pp = parseInt(cols[9].replace(/,/g, ''), 10) || 0;

        if (pp === 0) {
          const numbers: number[] = [];
          cols.slice(3).forEach(c => {
            const num = parseInt(c.replace(/,/g, ''), 10);
            if (!isNaN(num) && num > 0) numbers.push(num);
          });
          if (numbers.length >= 1) {
            pp = numbers[numbers.length - 1];
            if (miles === 0 && numbers.length >= 2) miles = numbers[0];
          }
        }

        const dateParts = dateRaw.split(/[\/-]/);
        if (dateParts.length !== 3) return;
        const y = dateParts[0];
        const m = dateParts[1].padStart(2, '0');
        const d = dateParts[2].padStart(2, '0');
        const formattedDate = `${y}-${m}-${d}`;

        let formattedRoute = content;
        let ltmValue = 0;

        if (content.includes('-') || content.includes('−')) {
          const parts = content.split(/[-−]/);
          const depRaw = parts[0].trim();
          const arrRaw = parts[1].trim();
          const dep = CITY_NAME_MAP[depRaw] || depRaw;
          const arr = CITY_NAME_MAP[arrRaw] || arrRaw;
          formattedRoute = `${dep} - ${arr}`;
          ltmValue = getBaseLTMFromNames(dep, arr);
        }

        if (ltmValue === 0) ltmValue = miles;

        const isANA = flightNo.startsWith('NH') || content.includes('東京') || content.includes('羽田');
        const isInt = content.includes('/') || /[A-Za-z]/.test(content);

        const flightItem: Flight = {
          id: Date.now() + index,
          date: formattedDate,
          type: isInt ? 'international' : 'domestic',
          airline: isANA ? 'ana' : 'star',
          route: formattedRoute,
          cost: 0,
          pp: pp,
          miles: miles,
          ltm: ltmValue,
        };

        newImportedFlights.push(flightItem);

        if (currentUser) {
          dbInsertRows.push({
            user_id: currentUser.id,
            flight_date: formattedDate,
            type: isInt ? 'international' : 'domestic',
            airline: isANA ? 'ana' : 'star',
            route: formattedRoute,
            cost: 0,
            pp: pp,
            miles: miles,
            ltm: ltmValue,
          });
        }
      });

      if (newImportedFlights.length > 0) {
        if (currentUser && supabase && dbInsertRows.length > 0) {
          await supabase.from('flights').insert(dbInsertRows);
          loadCloudData(currentUser);
        } else {
          setFlights((prev) => [...newImportedFlights, ...prev]);
        }
        alert(`${newImportedFlights.length} 件のフライト明細を取り込みました！`);
      } else {
        alert('有効なフライト実績が見つかりませんでした。');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <main className={`min-h-screen ${theme.appBg} p-6 max-w-5xl mx-auto font-sans transition-colors duration-500`}>
      {/* 隠しファイル入力（CSV用） */}
      <input type="file" ref={fileInputRef} accept=".csv,.txt" onChange={handleImportCSV} className="hidden" />

      {/* アプリヘッダー */}
      <div className={`${theme.headerBg} p-5 rounded-xl shadow-md mb-6 transition-all duration-300 relative`}>
        <div className="flex justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">ANA マイレージ＆PP管理</h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs ${theme.badgeBg}`}>
              {theme.label}
            </span>
            <span className="bg-white/10 text-white/90 text-xs px-2.5 py-0.5 rounded-full border border-white/20">
              💳 {CARD_NAMES[cardType]}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* 動的年度選択セレクトボックス */}
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-white/15 text-white border border-white/30 px-3 py-1.5 rounded-lg font-medium text-sm focus:bg-slate-800"
            >
              {availableYears.map(year => (
                <option key={year} value={year} className="text-slate-800">
                  {year}年
                </option>
              ))}
            </select>

            {/* 3点ドット メニューボタン */}
            <div className="relative">
              <button
                onClick={() => setIsHeaderMenuOpen(!isHeaderMenuOpen)}
                className="bg-white/15 hover:bg-white/25 text-white w-9 h-9 rounded-lg flex items-center justify-center text-lg font-bold transition border border-white/20 shadow-sm"
              >
                ⋮
              </button>

              {/* ドロップダウンメニュー */}
              {isHeaderMenuOpen && (
                <div className="absolute right-0 top-11 bg-white border border-slate-200 rounded-xl shadow-xl z-50 w-52 overflow-hidden text-slate-800 text-xs py-1">
                  {currentUser ? (
                    <div className="px-3 py-2 border-b border-slate-100 bg-slate-50">
                      <p className="font-bold text-slate-700 truncate">👤 {currentUser.email}</p>
                      <button
                        onClick={handleLogout}
                        className="text-red-600 font-bold hover:underline mt-1 block"
                      >
                        ログアウト
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setIsHeaderMenuOpen(false);
                        setAuthMessage('');
                        setIsAuthModalOpen(true);
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-100 font-bold text-blue-600 flex items-center gap-2"
                    >
                      <span>🔑</span> ログイン / 会員登録
                    </button>
                  )}

                  {/* ユーザー設定ボタン（ハンドラー制御） */}
                  <button
                    onClick={handleOpenSettings}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-100 font-semibold flex items-center gap-2"
                  >
                    <span>⚙️</span> ユーザー設定
                  </button>

                  <button
                    onClick={() => {
                      setIsHeaderMenuOpen(false);
                      fileInputRef.current?.click();
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-100 font-semibold flex items-center gap-2 border-t border-slate-100"
                  >
                    <span>📥</span> 明細CSV取込
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ログイン / 会員登録モーダル */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5 border border-slate-200">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">🔑 アカウント認証</h3>
              <button
                onClick={() => setIsAuthModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold px-2"
              >
                ✕
              </button>
            </div>

            {/* Google ログインボタン */}
            <button
              onClick={handleGoogleLogin}
              disabled={authLoading}
              className="w-full bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold py-2.5 rounded-lg text-sm transition shadow-sm flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Google でログイン
            </button>

            <div className="flex items-center py-1">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink-0 mx-4 text-slate-400 text-xs font-medium">または</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            {/* ログイン / 新規登録 切り替えタブ */}
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setAuthTab('login');
                  setAuthMessage('');
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${authTab === 'login' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                ログイン
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthTab('signup');
                  setAuthMessage('');
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${authTab === 'signup' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                新規会員登録
              </button>
            </div>

            {/* メール＆パスワード フォーム */}
            <form onSubmit={handleEmailPasswordAuth} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">メールアドレス</label>
                <input
                  type="email"
                  required
                  placeholder="ana-milleage-shugyo@example.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full border p-2.5 rounded-lg text-slate-800 text-sm bg-slate-50 focus:bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">パスワード</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="6文字以上の英数字"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full border p-2.5 rounded-lg text-slate-800 text-sm bg-slate-50 focus:bg-white"
                />
              </div>

              {authMsg && (
                <div className={`p-3 rounded-lg text-xs leading-relaxed ${authMsg.includes('エラー') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                  {authMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 rounded-lg text-sm transition shadow-sm mt-2"
              >
                {authLoading
                  ? '処理中...'
                  : authTab === 'signup' ? 'アカウントを作成する' : 'ログイン'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ユーザー設定モーダル */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-6 border border-slate-200">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">⚙️ ユーザー設定</h3>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold px-2"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">現在の所持ステータス (背景テーマに反映)</label>
                <select
                  value={currentStatus}
                  onChange={(e) => setCurrentStatus(e.target.value)}
                  className="w-full border p-2.5 rounded-lg text-slate-800 bg-slate-50 font-medium"
                >
                  <option value="none">一般会員（ステータスなし）</option>
                  <option value="bronze">ブロンズ</option>
                  <option value="platinum">プラチナ (SFC)</option>
                  <option value="diamond">ダイヤモンド</option>
                  <option value="diamond_more">ダイヤモンド +More</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">所持クレジットカードの種類</label>
                <select
                  value={cardType}
                  onChange={(e) => setCardType(e.target.value)}
                  className="w-full border p-2.5 rounded-lg text-slate-800 bg-slate-50 font-medium"
                >
                  <option value="none">カードなし</option>
                  <option value="general">ANA一般カード</option>
                  <option value="gold">ANAゴールドカード</option>
                  <option value="premium">ANAカード プレミアム</option>
                </select>
              </div>

              <div className="border-t pt-4">
                <p className="text-xs font-bold text-slate-800 mb-1">✈️ 過去の累積LTM設定（手入力補正）</p>
                <p className="text-[11px] text-slate-500 mb-3">※ログが存在しない昔の累積LTM数値をこちらに入力してください。</p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block">過去のANA便LTM</label>
                    <input
                      type="number"
                      value={pastAnaLTM}
                      onChange={(e) => setPastAnaLTM(Number(e.target.value) || 0)}
                      className="border p-2 rounded-lg text-slate-800 w-full mt-1 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block">過去の他社便LTM</label>
                    <input
                      type="number"
                      value={pastStarLTM}
                      onChange={(e) => setPastStarLTM(Number(e.target.value) || 0)}
                      className="border p-2 rounded-lg text-slate-800 w-full mt-1 text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t flex justify-end">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-semibold text-sm transition"
              >
                設定を保存して閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 目標ステータス設定パネル */}
      <div className={`${theme.cardBg} p-5 rounded-xl shadow-sm border ${theme.cardBorder} mb-6 space-y-4 transition-all duration-300`}>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-800">【{selectedYear}年】達成目標ステータス:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="border bg-white px-3 py-1 rounded-lg text-slate-800 font-bold shadow-sm"
            >
              <option value="bronze">ブロンズ</option>
              <option value="platinum">プラチナ (SFC)</option>
              <option value="diamond">ダイヤモンド</option>
              <option value="diamond_more">ダイヤモンド+More</option>
            </select>
          </div>

          <div className="flex bg-slate-200/70 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setGoalMode('flight')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition ${goalMode === 'flight' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}
            >
              ✈️ フライトのみで達成
            </button>
            <button
              type="button"
              onClick={() => setGoalMode('life')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition ${goalMode === 'life' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-600'}`}
            >
              🛍️ ライフソリューション併用
            </button>
          </div>
        </div>

        <div className="text-xs text-slate-600">
          {goalMode === 'flight' ? (
            <p>💡 <span className="font-semibold text-blue-600">{currentSpec.name}</span> 必要条件: 年間総獲得 <span className="font-bold">{currentSpec.flightTotal.toLocaleString()} PP</span>（うちANAグループ便 <span className="font-bold">{currentSpec.flightAnaRequired.toLocaleString()} PP</span> 以上）</p>
          ) : (
            <p>💡 <span className="font-semibold text-emerald-600">{currentSpec.name} (ライフソリューション併用)</span> 必要条件: <span className="font-bold text-red-600">ANAグループ運航便のみで {currentSpec.lifeAnaRequired.toLocaleString()} PP</span> + サービス利用数＆決済条件</p>
          )}
        </div>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className={`${theme.cardBg} p-4 rounded-xl shadow-sm border ${theme.cardBorder} transition-all duration-300`}>
          <p className="text-xs font-semibold text-slate-500">獲得プレミアムポイント (PP)</p>
          <p className="text-xl font-bold text-blue-600 mt-1">
            {goalMode === 'flight'
              ? `${totalPP.toLocaleString()} / ${targetTotalPP.toLocaleString()} PP`
              : `${anaPP.toLocaleString()} / ${targetAnaPP.toLocaleString()} PP`}
          </p>
          <div className="w-full bg-slate-200/80 h-2 rounded-full mt-2 overflow-hidden">
            <div
              className={`${theme.progressBar} h-full transition-all duration-500`}
              style={{ width: `${Math.min(((goalMode === 'flight' ? totalPP : anaPP) / (targetTotalPP || 1)) * 100, 100)}%` }}
            ></div>
          </div>
          <div className="mt-3 pt-2 border-t text-xs flex justify-between text-slate-600">
            <span>ANA便: <strong className="text-blue-700">{anaPP.toLocaleString()} PP</strong></span>
            <span>他社便: <strong className="text-purple-700">{starPP.toLocaleString()} PP</strong></span>
          </div>
        </div>

        <div className={`${theme.cardBg} p-4 rounded-xl shadow-sm border ${theme.cardBorder} transition-all duration-300`}>
          <p className="text-xs font-semibold text-slate-500">年間総利用金額</p>
          <p className="text-xl font-bold text-slate-800 mt-1">¥{totalCost.toLocaleString()}</p>
        </div>

        <div className={`${theme.cardBg} p-4 rounded-xl shadow-sm border ${theme.cardBorder} transition-all duration-300`}>
          <p className="text-xs font-semibold text-slate-500">平均 PP単価</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">¥{avgPpUnitCost} / PP</p>
        </div>

        <div className={`${theme.cardBg} p-4 rounded-xl shadow-sm border ${theme.cardBorder} transition-all duration-300`}>
          <p className="text-xs font-semibold text-slate-500">年間獲得LTM</p>
          <p className="text-xl font-bold text-indigo-600 mt-1">{totalLTMInYear.toLocaleString()} M</p>
          <p className="text-[10px] text-slate-400 mt-2">※{selectedYear}年の登録フライトによる獲得LTM合計</p>
        </div>
      </div>

      {/* LTMシミュレーション */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-800 text-white p-6 rounded-xl shadow-md mb-8">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-bold flex items-center gap-2">✈️ LTM（ライフタイムマイル）達成シミュレーション</h2>
          <div className="flex bg-slate-700 p-0.5 rounded text-xs">
            <button
              onClick={() => setLtmMode('ana')}
              className={`px-2.5 py-1 rounded font-semibold transition ${ltmMode === 'ana' ? 'bg-blue-600 text-white' : 'text-slate-300'}`}
            >
              ANAグループ便LTM
            </button>
            <button
              onClick={() => setLtmMode('total')}
              className={`px-2.5 py-1 rounded font-semibold transition ${ltmMode === 'total' ? 'bg-blue-600 text-white' : 'text-slate-300'}`}
            >
              総LTM（他社便含む）
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-4">
          <div>
            <p className="text-xs text-slate-400">
              現在の累計 LTM ({ltmMode === 'ana' ? 'ANAグループ便のみ' : '総計'})
            </p>
            <p className="text-2xl font-bold text-sky-400">{targetLTMCurrent.toLocaleString()} マイル</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              (手入力過去分 ＋ ログ合算 - ANA: {currentAnaLTM.toLocaleString()} M / 他社: {currentStarLTM.toLocaleString()} M)
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">目標 LTM</p>
            <input type="text" value={targetLTMInput} onChange={handleLTMChange} className="bg-slate-700 text-white px-3 py-1 rounded text-xl font-bold w-40 border border-slate-600 mt-1" />
          </div>
          <div>
            <p className="text-xs text-slate-400">目標まであと</p>
            <p className="text-2xl font-bold text-amber-400">{remainingLTM.toLocaleString()} マイル</p>
          </div>
        </div>

        <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700 text-sm text-slate-200">
          💡 達成目安: 羽田-那覇の往復（1,968マイル）で <span className="font-bold text-amber-300">{nahaTripsNeeded} 往復</span> です。
        </div>
      </div>

      {/* フライト入力フォーム */}
      <form onSubmit={handleSaveFlight} className={`${theme.cardBg} p-6 rounded-xl shadow-sm border ${theme.cardBorder} mb-8 space-y-4 transition-all duration-300`}>
        <div className="flex justify-between items-center border-b pb-3">
          <h2 className="text-lg font-semibold text-slate-800">
            {editingId ? '✏️ フライト情報を編集' : '✈️ フライト実績を入力'}
          </h2>
          <div className="flex bg-slate-200/70 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setFlightType('domestic')}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition ${flightType === 'domestic' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}
            >
              国内線
            </button>
            <button
              type="button"
              onClick={() => setFlightType('international')}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition ${flightType === 'international' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}
            >
              国際線
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <label className="text-xs text-slate-500 font-medium">搭乗日</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border p-2 rounded-lg text-slate-800 w-full mt-1 text-sm bg-white" />
          </div>

          <div>
            <label className="text-xs text-slate-500 font-medium">運航会社</label>
            <select value={airline} onChange={(e) => setAirline(e.target.value as 'ana' | 'star')} className="border p-2 rounded-lg text-slate-800 w-full mt-1 bg-white text-sm">
              <option value="ana">ANAグループ便</option>
              <option value="star">他社便（スターアライアンス等）</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-500 font-medium">出発空港</label>
            <select value={depAirport} onChange={(e) => setDepAirport(e.target.value)} className="border p-2 rounded-lg text-slate-800 w-full mt-1 bg-white text-sm">
              {DOMESTIC_AIRPORTS.map(a => <option key={a.code} value={a.code}>{a.name} ({a.code})</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-500 font-medium">到着空港</label>
            <select value={arrAirport} onChange={(e) => setArrAirport(e.target.value)} className="border p-2 rounded-lg text-slate-800 w-full mt-1 bg-white text-sm">
              {(flightType === 'domestic' ? DOMESTIC_AIRPORTS : INT_AIRPORTS).map(a => (
                <option key={a.code} value={a.code}>{a.name} ({a.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-500 font-medium">支払金額 (円)</label>
            <input type="number" placeholder="24000" value={cost} onChange={(e) => setCost(e.target.value)} className="border p-2 rounded-lg text-slate-800 w-full mt-1 text-sm bg-white" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/80 p-4 rounded-lg border border-slate-200">
          <div>
            <label className="text-xs text-slate-500 font-medium">運賃種別 / 予約クラス（積算率）</label>
            <select
              value={accRate}
              onChange={(e) => {
                const rate = Number(e.target.value);
                setAccRate(rate);
                const fareList = flightType === 'domestic' ? DOMESTIC_FARES : INT_FARES;
                const found = fareList.find(f => f.rate === rate);
                if (found) setBoardPoints(found.defaultBp);
              }}
              className="border p-2 rounded-lg text-slate-800 w-full mt-1 bg-white text-xs"
            >
              {(flightType === 'domestic' ? DOMESTIC_FARES : INT_FARES).map((f, i) => (
                <option key={i} value={f.rate}>{f.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-500 font-medium">搭乗ポイント</label>
            <select value={boardPoints} onChange={(e) => setBoardPoints(Number(e.target.value))} className="border p-2 rounded-lg text-slate-800 w-full mt-1 bg-white text-xs">
              <option value={400}>400 ポイント</option>
              <option value={200}>200 ポイント</option>
              <option value={0}>0 ポイント</option>
            </select>
          </div>
        </div>

        {routeError ? (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm flex items-center gap-2 font-medium">
            <span>⚠️</span> {routeError}
          </div>
        ) : (
          <div className="flex gap-6 items-center bg-slate-100/80 p-3 rounded-lg text-sm border border-slate-200">
            <span className="text-slate-600 font-medium">自動算出結果:</span>
            <div>獲得マイル: <span className="font-bold text-indigo-600">{calculatedMiles?.toLocaleString()} M</span></div>
            <div>獲得PP: <span className="font-bold text-blue-600">{calculatedPP?.toLocaleString()} PP</span></div>
            <div>PP単価: <span className="font-bold text-emerald-600">¥{cost && calculatedPP && calculatedPP > 0 ? (Number(cost) / calculatedPP).toFixed(1) : '0'}</span></div>
          </div>
        )}

        <button
          type="submit"
          disabled={!!routeError || !cost}
          className={`font-medium px-5 py-2.5 rounded-lg transition w-full md:w-auto shadow-sm ${
            routeError || !cost
              ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
              : theme.primaryBtn
          }`}
        >
          {editingId ? '更新を保存する' : 'フライトを登録する'}
        </button>
      </form>

      {/* 履歴テーブル */}
      <div className={`${theme.cardBg} rounded-xl shadow-sm border ${theme.cardBorder} transition-all duration-300`}>
        <div className="p-4 bg-slate-100/80 border-b flex flex-wrap gap-4 justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-700">{selectedYear}年のフライト履歴 ({filteredFlights.length}件)</span>

            <div className="flex bg-white border border-slate-300 rounded-lg p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setCategoryFilter('all')}
                className={`px-2.5 py-1 rounded-md font-medium transition ${categoryFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-600'}`}
              >
                すべて
              </button>
              <button
                type="button"
                onClick={() => setCategoryFilter('domestic')}
                className={`px-2.5 py-1 rounded-md font-medium transition ${categoryFilter === 'domestic' ? 'bg-slate-800 text-white' : 'text-slate-600'}`}
              >
                国内線のみ
              </button>
              <button
                type="button"
                onClick={() => setCategoryFilter('international')}
                className={`px-2.5 py-1 rounded-md font-medium transition ${categoryFilter === 'international' ? 'bg-slate-800 text-white' : 'text-slate-600'}`}
              >
                国際線のみ
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCSV}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1 shadow-sm"
            >
              <span>📄 CSVダウンロード</span>
            </button>

            <div className="flex items-center gap-1 text-xs text-slate-500">
              <span>表示:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="border bg-white px-2 py-1 rounded text-slate-800 font-medium"
              >
                <option value={20}>20件</option>
                <option value={50}>50件</option>
                <option value={100}>100件</option>
                <option value={200}>200件</option>
                <option value={9999}>全件</option>
              </select>
            </div>
          </div>
        </div>

        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b">
            <tr>
              <th className="p-3">日付</th>
              <th className="p-3">種別</th>
              <th className="p-3">運航会社</th>
              <th className="p-3">路線</th>
              <th className="p-3">金額</th>
              <th className="p-3">獲得PP</th>
              <th className="p-3">PP単価</th>
              <th className="p-3">獲得LTM</th>
              <th className="p-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredFlights.slice(0, pageSize).map((f) => (
              <tr key={f.id} className="border-b last:border-0 hover:bg-slate-100/50 relative">
                <td className="p-3">{f.date}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${f.type === 'domestic' ? 'bg-sky-100 text-sky-800' : 'bg-purple-100 text-purple-800'}`}>
                    {f.type === 'domestic' ? '国内線' : '国際線'}
                  </span>
                </td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${f.airline === 'ana' ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-700'}`}>
                    {f.airline === 'ana' ? 'ANAグループ' : '他社便'}
                  </span>
                </td>
                <td className="p-3 font-medium text-slate-800">{f.route}</td>
                <td className="p-3">¥{f.cost.toLocaleString()}</td>
                <td className="p-3 font-semibold text-blue-600">{f.pp.toLocaleString()}</td>
                <td className="p-3 font-semibold text-emerald-600">¥{f.pp > 0 ? (f.cost / f.pp).toFixed(1) : '0'}</td>
                <td className="p-3">{f.ltm.toLocaleString()} M</td>
                <td className="p-3 text-right relative">
                  <button onClick={() => setOpenMenuId(openMenuId === f.id ? null : f.id)} className="px-2 py-1 text-slate-500 hover:bg-slate-200 rounded text-lg font-bold">
                    ⋮
                  </button>
                  {openMenuId === f.id && (
                    <div className="absolute right-3 top-10 bg-white border border-slate-200 rounded-lg shadow-lg z-10 text-left w-24 overflow-hidden">
                      <button onClick={() => handleEdit(f)} className="w-full px-3 py-2 text-xs text-slate-700 hover:bg-slate-100 block">
                        編集
                      </button>
                      <button onClick={() => handleDelete(f.id)} className="w-full px-3 py-2 text-xs text-red-600 hover:bg-red-50 block border-t border-slate-100">
                        削除
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* 画面右下のフィードバックボタン */}
      <a
        href="https://your-org.featurebase.app"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-5 right-5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-3.5 py-2.5 rounded-full shadow-lg border border-slate-700 flex items-center gap-1.5 z-50 transition hover:scale-105"
      >
        <span>💬</span> ご要望・改善案
      </a>
    </main>
  );
}