'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient, User } from '@supabase/supabase-js';

// Supabase クライアント初期化
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null;

// 本日の日付を YYYY-MM-DD 形式で取得
const getTodayDateString = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const CITY_NAME_MAP: Record<string, string> = {
  'TOKYO/HANEDA': '羽田', 'TOKYO/NARITA': '成田', 'TOKYO': '東京',
  'BANGKOK': 'バンコク', 'SINGAPORE': 'シンガポール', 'KUALA LUMPUR': 'クアラルンプール',
  'KUALA LUMPUR SPNG': 'クアラルンプール', 'OKINAWA': '那覇', 'SAPPORO': '新千歳',
  'FUKUOKA': '福岡', 'OSAKA/ITAMI': '伊丹', 'OSAKA/KANSAI': '関空', 'HIROSHIMA': '広島',
  '東京（羽田）': '羽田', '広島': '広島'
};

interface FareMaster {
  id: number;
  flight_type: 'domestic' | 'international';
  fare_category: string;
  accumulation_rate: number;
  boarding_points: number;
  description: string;
  display_order: number;
}

interface Airport {
  code: string;
  name: string;
  country: string;
  region: string;
  is_domestic: boolean;
  display_order: number;
}

interface RouteInfo {
  airport1_code: string;
  airport2_code: string;
  base_miles: number;
}

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
  const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false);

  // 認証状態
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('login');
  const [authEmail, setAuthEmail] = useState<string>('');
  const [authPassword, setAuthPassword] = useState<string>('');
  const [authMsg, setAuthMessage] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  // マスタ状態
  const [fareMasterList, setFareMasterList] = useState<FareMaster[]>([]);
  const [airportList, setAirportList] = useState<Airport[]>([]);
  const [routeList, setRouteList] = useState<RouteInfo[]>([]);

  // フォーム・メニュー状態
  const [selectedFareId, setSelectedFareId] = useState<number | string>('');
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState<boolean>(false);
  const headerMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ユーザー設定状態
  const [currentStatus, setCurrentStatus] = useState<string>('none');
  const [cardType, setCardType] = useState<string>('general');
  const [pastAnaLTM, setPastAnaLTM] = useState<number>(0);
  const [pastStarLTM, setPastStarLTM] = useState<number>(0); // ※「総LTM（ANA＋他社便）」として利用
  const [ltmBaseDate, setLtmBaseDate] = useState<string>(getTodayDateString()); // LTM基準日
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

  // フィードバックモーダル状態
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState('bug');
  const [feedbackContent, setFeedbackContent] = useState('');
  const [feedbackSending, setFeedbackSending] = useState(false);

  // 入力フォーム状態
  const [flightType, setFlightType] = useState<'domestic' | 'international'>('domestic');
  const [airline, setAirline] = useState<'ana' | 'star'>('ana');
  const [date, setDate] = useState<string>(getTodayDateString());
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
    const handleClickOutside = (event: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(event.target as Node)) {
        setIsHeaderMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchMasterData = async () => {
    if (!supabase) return;
    const { data: fares } = await supabase.from('fare_master').select('*').order('display_order', { ascending: true });
    if (fares) setFareMasterList(fares as FareMaster[]);
    const { data: airports } = await supabase.from('airports').select('*').order('display_order', { ascending: true });
    if (airports) setAirportList(airports as Airport[]);
    const { data: routes } = await supabase.from('routes').select('*');
    if (routes) setRouteList(routes as RouteInfo[]);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    fetchMasterData();

    if (supabase) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          setCurrentUser(user);
          loadCloudData(user);
        } else {
          setInitialEmptyState();
        }
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        const user = session?.user || null;
        setCurrentUser(user);
        if (user) {
          loadCloudData(user);
        } else {
          setInitialEmptyState();
        }
      });

      setMounted(true);
      return () => subscription.unsubscribe();
    } else {
      setInitialEmptyState();
      setMounted(true);
    }
  }, []);

  const setInitialEmptyState = () => {
    setCurrentStatus('none');
    setCardType('general');
    setPastAnaLTM(0);
    setPastStarLTM(0);
    setLtmBaseDate(getTodayDateString());
    setGoalMode('flight');
    setSelectedStatus('platinum');
    setTargetLTMInput('1,000,000');
    setFlights([]);
    setIsDataLoaded(true);

    if (typeof window !== 'undefined') {
      localStorage.removeItem('ana_flights');
      localStorage.removeItem('ana_user_status');
      localStorage.removeItem('ana_user_card');
      localStorage.removeItem('ana_past_ana_ltm');
      localStorage.removeItem('ana_past_star_ltm');
      localStorage.removeItem('ana_ltm_base_date');
      localStorage.removeItem('ana_goal_mode');
      localStorage.removeItem('ana_selected_status');
      localStorage.removeItem('ana_target_ltm');
    }
  };

  const loadCloudData = async (user: User) => {
    if (!supabase) return;

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (profile) {
      if (profile.current_status) setCurrentStatus(profile.current_status);
      if (profile.card_type) setCardType(profile.card_type);
      if (profile.past_ana_ltm !== undefined) setPastAnaLTM(profile.past_ana_ltm);
      if (profile.past_star_ltm !== undefined) setPastStarLTM(profile.past_star_ltm);
      if (profile.ltm_base_date) setLtmBaseDate(profile.ltm_base_date);
      if (profile.target_status) setSelectedStatus(profile.target_status);
      if (profile.goal_mode) setGoalMode(profile.goal_mode);
      if (profile.target_ltm) setTargetLTMInput(profile.target_ltm);
    }

    const { data: dbFlights } = await supabase.from('flights').select('*').eq('user_id', user.id).order('flight_date', { ascending: false });
    if (dbFlights !== null) {
      const formattedFlights: Flight[] = dbFlights.map(f => ({
        id: f.id, date: f.flight_date, type: f.type, airline: f.airline, route: f.route, cost: f.cost || 0, pp: f.pp, miles: f.miles, ltm: f.ltm
      }));
      setFlights(formattedFlights);
    }
    setIsDataLoaded(true);
  };

  useEffect(() => {
    if (!mounted || !isDataLoaded) return;
    if (currentUser && supabase) {
      supabase.from('profiles').upsert({
        id: currentUser.id,
        current_status: currentStatus,
        card_type: cardType,
        past_ana_ltm: pastAnaLTM,
        past_star_ltm: pastStarLTM,
        ltm_base_date: ltmBaseDate,
        target_status: selectedStatus,
        goal_mode: goalMode,
        target_ltm: targetLTMInput,
      }).then();
    }
  }, [currentStatus, cardType, pastAnaLTM, pastStarLTM, ltmBaseDate, flights, targetLTMInput, goalMode, selectedStatus, currentUser, mounted, isDataLoaded]);

  useEffect(() => {
    if (!editingId) {
      if (flightType === 'domestic') {
        setDepAirport('HND'); setArrAirport('OKA');
      } else {
        setDepAirport('HND'); setArrAirport('BKK');
      }
      const availableFares = fareMasterList.filter(f => f.flight_type === flightType);
      if (availableFares.length > 0) {
        const firstFare = availableFares[0];
        setSelectedFareId(firstFare.id);
        setAccRate(firstFare.accumulation_rate);
        setBoardPoints(firstFare.boarding_points);
      }
    }
  }, [flightType, editingId, fareMasterList]);

  // PP・マイル自動計算
  useEffect(() => {
    if (depAirport === arrAirport) {
      setRouteError('出発地と到着地に同じ空港が選択されています。');
      setCalculatedMiles(null); setCalculatedPP(null); setCalculatedLTM(null);
      return;
    }

    const route = routeList.find(r => 
      (r.airport1_code === depAirport && r.airport2_code === arrAirport) ||
      (r.airport1_code === arrAirport && r.airport2_code === depAirport)
    );

    if (!route) {
      const depName = airportList.find(a => a.code === depAirport)?.name || depAirport;
      const arrName = airportList.find(a => a.code === arrAirport)?.name || arrAirport;
      setRouteError(`「${depName} ⇔ ${arrName}」の直行便区間マイルがマスタに存在しません。`);
      setCalculatedMiles(null); setCalculatedPP(null); setCalculatedLTM(null);
      return;
    }

    setRouteError(null);
    const baseMile = route.base_miles;
    const miles = Math.floor(baseMile * (accRate / 100));
    setCalculatedMiles(miles);
    setCalculatedLTM(baseMile);

    let multiplier = 1.0;
    if (airline === 'ana') {
      if (flightType === 'domestic') {
        multiplier = 2.0;
      } else {
        const depRegion = airportList.find(a => a.code === depAirport)?.region;
        const arrRegion = airportList.find(a => a.code === arrAirport)?.region;
        if (depRegion === 'asia' || depRegion === 'oceania' || arrRegion === 'asia' || arrRegion === 'oceania') {
          multiplier = 1.5;
        }
      }
    }

    const pp = Math.floor(baseMile * (accRate / 100) * multiplier) + Number(boardPoints);
    setCalculatedPP(pp);
  }, [depAirport, arrAirport, accRate, boardPoints, flightType, airline, routeList, airportList]);

  const handleSendFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackContent || !supabase) return;
    setFeedbackSending(true);
    const { error } = await supabase.from('feedbacks').insert({ user_email: currentUser?.email || '未ログイン', type: feedbackType, content: feedbackContent });
    setFeedbackSending(false);
    if (!error) { alert('フィードバックを送信しました！ご協力ありがとうございます。'); setFeedbackContent(''); setIsFeedbackOpen(false); }
  };

  const handleGoogleLogin = async () => {
    if (!supabase) return;
    setAuthLoading(true); setAuthMessage('');
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined } });
    if (error) { setAuthMessage(`エラー: ${error.message}`); setAuthLoading(false); }
  };

  const handleEmailPasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !authEmail || !authPassword) return;
    setAuthLoading(true); setAuthMessage('');
    if (authTab === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
      setAuthLoading(false);
      if (error) setAuthMessage(`エラー: ${error.message}`);
      else if (data.user && data.session) { setAuthMessage('ログインしました！'); setIsAuthModalOpen(false); }
      else setAuthMessage('確認用メールを送信しました。メールをご確認ください。');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
      setAuthLoading(false);
      if (error) setAuthMessage('ログインエラー。アドレスまたはパスワードを確認してください。');
      else { setIsAuthModalOpen(false); setAuthPassword(''); }
    }
  };

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
      setCurrentUser(null);
      setIsHeaderMenuOpen(false);
      setInitialEmptyState();
      alert('ログアウトしました。');
    }
  };

  const getRouteLabel = () => {
    const depName = airportList.find(a => a.code === depAirport)?.name || depAirport;
    const arrName = airportList.find(a => a.code === arrAirport)?.name || arrAirport;
    return `${depName} - ${arrName}`;
  };

  const handleSaveFlight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (routeError || calculatedPP === null || calculatedMiles === null || calculatedLTM === null) return;
    const routeLabel = getRouteLabel();
    const flightCost = cost ? Number(cost) : 0;

    if (currentUser && supabase) {
      if (editingId) {
        await supabase.from('flights').update({
          flight_date: date, type: flightType, airline, route: routeLabel, cost: flightCost, pp: calculatedPP, miles: calculatedMiles, ltm: calculatedLTM
        }).eq('id', editingId);
        setFlights(flights.map(f => f.id === editingId ? { ...f, date, type: flightType, airline, route: routeLabel, cost: flightCost, pp: calculatedPP, miles: calculatedMiles, ltm: calculatedLTM } : f));
        setEditingId(null);
      } else {
        const { data } = await supabase.from('flights').insert({
          user_id: currentUser.id, flight_date: date, type: flightType, airline, route: routeLabel, cost: flightCost, pp: calculatedPP, miles: calculatedMiles, ltm: calculatedLTM
        }).select().single();
        if (data) setFlights([{ id: data.id, date, type: flightType, airline, route: routeLabel, cost: flightCost, pp: calculatedPP, miles: calculatedMiles, ltm: calculatedLTM }, ...flights]);
      }
    }
    setCost('');
  };

  const handleEdit = (flight: Flight) => {
    setEditingId(flight.id);
    setDate(flight.date);
    setFlightType(flight.type);
    setAirline(flight.airline);
    setCost(flight.cost ? flight.cost.toString() : '');

    if (flight.route.includes('-')) {
      const parts = flight.route.split('-').map(s => s.trim());
      const foundDep = airportList.find(a => a.name === parts[0] || a.code === parts[0]);
      const foundArr = airportList.find(a => a.name === parts[1] || a.code === parts[1]);
      if (foundDep) setDepAirport(foundDep.code);
      if (foundArr) setArrAirport(foundArr.code);
    }
    setOpenMenuId(null);
  };

  const handleDelete = async (id: string | number) => {
    if (currentUser && supabase) {
      const { error } = await supabase.from('flights').delete().eq('id', id).eq('user_id', currentUser.id);
      if (error) return alert('削除処理に失敗しました。');
    }
    setFlights(flights.filter(f => f.id !== id));
    setOpenMenuId(null);
  };

  const handleExportCSV = () => {
    const headers = ['搭乗日', '種別', '運航会社', '路線', '金額(円)', '獲得PP', 'PP単価', '獲得マイル', '獲得LTM'];
    const csvRows = filteredFlights.map(f => [
      f.date, f.type === 'domestic' ? '国内線' : '国際線', f.airline === 'ana' ? 'ANAグループ便' : 'スターアライアンス/他社便',
      `"${f.route}"`, f.cost || 0, f.pp, f.cost && f.pp > 0 ? (f.cost / f.pp).toFixed(1) : '0', f.miles, f.ltm
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...csvRows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `ANA_Flight_History_${selectedYear}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const parseCSVLine = (line: string): string[] => {
    if (line.includes('\t')) return line.split('\t').map(c => c.replace(/^["']|["']$/g, '').trim());
    const result: string[] = []; let current = ''; let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') inQuotes = !inQuotes;
      else if (char === ',' && !inQuotes) { result.push(current.replace(/^["']|["']$/g, '').trim()); current = ''; }
      else current += char;
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

        const isService = content.includes('ANAカード') || content.includes('ANAPAY') || content.includes('でんき') || content.includes('モバイル');
        if (isService) return;
        if (!flightNo && !content.includes('-') && !content.includes('−')) return;

        let miles = 0; let pp = 0;
        if (cols[5]) miles = parseInt(cols[5].replace(/,/g, ''), 10) || 0;
        if (cols[9]) pp = parseInt(cols[9].replace(/,/g, ''), 10) || 0;

        const dateParts = dateRaw.split(/[\/-]/);
        if (dateParts.length !== 3) return;
        const formattedDate = `${dateParts[0]}-${dateParts[1].padStart(2, '0')}-${dateParts[2].padStart(2, '0')}`;

        let formattedRoute = content;
        let ltmValue = 0;
        if (content.includes('-') || content.includes('−')) {
          const parts = content.split(/[-−]/);
          const depRaw = parts[0].trim(); const arrRaw = parts[1].trim();
          const dep = CITY_NAME_MAP[depRaw] || depRaw;
          const arr = CITY_NAME_MAP[arrRaw] || arrRaw;
          formattedRoute = `${dep} - ${arr}`;
          const route = routeList.find(r => (r.airport1_code === dep && r.airport2_code === arr) || (r.airport1_code === arr && r.airport2_code === dep));
          ltmValue = route ? route.base_miles : miles;
        }
        if (ltmValue === 0) ltmValue = miles;

        const isANA = flightNo.startsWith('NH') || content.includes('東京') || content.includes('羽田');
        const isInt = content.includes('/') || /[A-Za-z]/.test(content);

        const flightItem: Flight = {
          id: Date.now() + index, date: formattedDate, type: isInt ? 'international' : 'domestic',
          airline: isANA ? 'ana' : 'star', route: formattedRoute, cost: 0, pp, miles, ltm: ltmValue,
        };
        newImportedFlights.push(flightItem);

        if (currentUser) {
          dbInsertRows.push({
            user_id: currentUser.id, flight_date: formattedDate, type: isInt ? 'international' : 'domestic',
            airline: isANA ? 'ana' : 'star', route: formattedRoute, cost: 0, pp, miles, ltm: ltmValue,
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
        alert(`${newImportedFlights.length} 件の明細を取り込みました！`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  if (!mounted) return null;

  const currentFares = fareMasterList.filter(f => f.flight_type === flightType);
  const availableYears = Array.from(new Set([new Date().getFullYear().toString(), ...flights.map(f => f.date.substring(0, 4)).filter(Boolean)])).sort((a, b) => Number(b) - Number(a));
  const filteredFlights = flights.filter(f => f.date.startsWith(selectedYear) && (categoryFilter === 'all' || f.type === categoryFilter)).sort((a, b) => b.date.localeCompare(a.date));
  
  const totalCost = filteredFlights.reduce((sum, f) => sum + (f.cost || 0), 0);
  const totalLTMInYear = filteredFlights.reduce((sum, f) => sum + f.ltm, 0);
  const anaPP = filteredFlights.filter(f => f.airline === 'ana').reduce((sum, f) => sum + f.pp, 0);
  const starPP = filteredFlights.filter(f => f.airline === 'star').reduce((sum, f) => sum + f.pp, 0);
  const totalPP = anaPP + starPP;
  const avgPpUnitCost = totalPP > 0 ? (totalCost / totalPP).toFixed(2) : '0';

  // -----------------------------------------------------
  // LTM計算ロジック（基準日より未来のフライトのみ合算）
  // -----------------------------------------------------
  const futureFlights = flights.filter(f => f.date > ltmBaseDate);
  const futureAnaLTM = futureFlights.filter(f => f.airline === 'ana').reduce((sum, f) => sum + f.ltm, 0);
  const futureStarLTM = futureFlights.filter(f => f.airline === 'star').reduce((sum, f) => sum + f.ltm, 0);

  // ANA便のみLTM ＝ 設定画面の「ANA便LTM」＋ 基準日より後のANA便マイル
  const currentAnaLTM = pastAnaLTM + futureAnaLTM;

  // 総LTM (他社便含む) ＝ 設定画面の「総LTM」＋ 基準日より後の全便マイル (ANA便＋他社便)
  const currentTotalLTM = pastStarLTM + futureAnaLTM + futureStarLTM;

  const targetLTM = Number(targetLTMInput.replace(/,/g, '')) || 0;
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

  const STATUS_THEMES: Record<string, any> = {
    none: { label: '一般会員', appBg: 'bg-slate-100', headerBg: 'bg-gradient-to-r from-slate-900 to-slate-800 text-white', badgeBg: 'bg-slate-700 text-slate-200', cardBorder: 'border-slate-200', cardBg: 'bg-white', primaryBtn: 'bg-blue-600 hover:bg-blue-700 text-white', progressBar: 'bg-blue-600' },
    bronze: { label: 'ブロンズ', appBg: 'bg-gradient-to-b from-amber-50/80 via-stone-100 to-amber-100/40', headerBg: 'bg-gradient-to-r from-amber-900 via-amber-800 to-amber-950 text-amber-100 shadow-amber-900/10', badgeBg: 'bg-amber-700/80 text-amber-200 border border-amber-500', cardBorder: 'border-amber-300/80', cardBg: 'bg-amber-50/30', primaryBtn: 'bg-amber-800 hover:bg-amber-900 text-amber-50', progressBar: 'bg-amber-700' },
    platinum: { label: 'プラチナ (SFC)', appBg: 'bg-gradient-to-b from-slate-100 via-sky-50/50 to-indigo-50/40', headerBg: 'bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-sky-100 shadow-blue-900/10', badgeBg: 'bg-blue-600 text-white border border-sky-400', cardBorder: 'border-blue-300/80', cardBg: 'bg-sky-50/20', primaryBtn: 'bg-blue-600 hover:bg-blue-700 text-white', progressBar: 'bg-blue-600' },
    diamond: { label: 'ダイヤモンド', appBg: 'bg-gradient-to-b from-rose-50/60 via-stone-100 to-red-100/40', headerBg: 'bg-gradient-to-r from-red-950 via-rose-900 to-slate-950 text-rose-100 shadow-red-950/20', badgeBg: 'bg-red-700 text-white border border-rose-400', cardBorder: 'border-rose-300/80', cardBg: 'bg-rose-50/30', primaryBtn: 'bg-red-700 hover:bg-red-800 text-white', progressBar: 'bg-red-600' },
    diamond_more: { label: 'ダイヤモンド +More', appBg: 'bg-gradient-to-b from-stone-200 via-red-950/10 to-amber-900/15', headerBg: 'bg-gradient-to-r from-red-950 via-purple-950 to-amber-950 text-amber-200 border-b-2 border-amber-400 shadow-xl', badgeBg: 'bg-gradient-to-r from-red-700 to-amber-600 text-white border border-amber-300 font-bold', cardBorder: 'border-rose-400/80', cardBg: 'bg-red-950/5', primaryBtn: 'bg-gradient-to-r from-red-800 to-rose-900 hover:from-red-900 hover:to-rose-950 text-amber-200 font-bold', progressBar: 'bg-gradient-to-r from-red-600 to-amber-500' },
  };
  const theme = STATUS_THEMES[currentStatus] || STATUS_THEMES.none;
  const CARD_NAMES: Record<string, string> = { none: 'カードなし', general: 'ANA一般カード', gold: 'ANAゴールドカード', premium: 'ANAカード プレミアム' };

  // 空港プルダウン 国内/国際の出し分け
  const renderAirportOptions = (isDomestic: boolean) => {
    const jpAirports = airportList.filter(a => a.region === 'japan');
    if (isDomestic) {
      return (
        <optgroup label="🇯🇵 日本">
          {jpAirports.map(a => <option key={a.code} value={a.code}>{a.name} ({a.code})</option>)}
        </optgroup>
      );
    }
    const asiaAirports = airportList.filter(a => a.region === 'asia');
    const oceaniaAirports = airportList.filter(a => a.region === 'oceania');
    const otherAirports = airportList.filter(a => a.region === 'other');
    return (
      <>
        <optgroup label="🇯🇵 日本">
          {jpAirports.map(a => <option key={a.code} value={a.code}>{a.name} ({a.code})</option>)}
        </optgroup>
        <optgroup label="🌏 アジア">
          {asiaAirports.map(a => <option key={a.code} value={a.code}>{a.name} ({a.code})</option>)}
        </optgroup>
        <optgroup label="🐨 オセアニア">
          {oceaniaAirports.map(a => <option key={a.code} value={a.code}>{a.name} ({a.code})</option>)}
        </optgroup>
        <optgroup label="🌎 欧米・その他">
          {otherAirports.map(a => <option key={a.code} value={a.code}>{a.name} ({a.code})</option>)}
        </optgroup>
      </>
    );
  };

  return (
    <main className={`min-h-screen ${theme.appBg} p-6 max-w-5xl mx-auto font-sans transition-colors duration-500`}>
      <input type="file" ref={fileInputRef} accept=".csv,.txt" onChange={handleImportCSV} className="hidden" />

      {/* アプリヘッダー */}
      <div className={`${theme.headerBg} p-5 rounded-xl shadow-md mb-6 relative`}>
        <div className="flex justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">ANA マイレージ＆PP管理</h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs ${theme.badgeBg}`}>{theme.label}</span>
            <span className="bg-white/10 text-white/90 text-xs px-2.5 py-0.5 rounded-full border border-white/20">💳 {CARD_NAMES[cardType]}</span>
          </div>

          <div className="flex items-center gap-2">
            <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="bg-white/15 text-white border border-white/30 px-3 py-1.5 rounded-lg font-medium text-sm focus:bg-slate-800">
              {availableYears.map(year => <option key={year} value={year} className="text-slate-800">{year}年</option>)}
            </select>
            <div className="relative" ref={headerMenuRef}>
              <button onClick={() => setIsHeaderMenuOpen(!isHeaderMenuOpen)} className="bg-white/15 hover:bg-white/25 text-white w-9 h-9 rounded-lg font-bold border border-white/20">⋮</button>
              {isHeaderMenuOpen && (
                <div className="absolute right-0 top-11 bg-white border border-slate-200 rounded-xl shadow-xl z-50 w-52 overflow-hidden text-slate-800 text-xs py-1">
                  {currentUser ? (
                    <div className="px-3 py-2 border-b bg-slate-50">
                      <p className="font-bold truncate">👤 {currentUser.email}</p>
                      <button onClick={handleLogout} className="text-red-600 font-bold hover:underline mt-1 block">ログアウト</button>
                    </div>
                  ) : (
                    <button onClick={() => {setIsHeaderMenuOpen(false); setIsAuthModalOpen(true);}} className="w-full text-left px-4 py-2.5 hover:bg-slate-100 font-bold text-blue-600">🔑 ログイン / 会員登録</button>
                  )}
                  <button onClick={() => {setIsHeaderMenuOpen(false); setIsSettingsOpen(true);}} className="w-full text-left px-4 py-2.5 hover:bg-slate-100 font-semibold">⚙️ ユーザー設定</button>
                  <button onClick={() => {setIsHeaderMenuOpen(false); fileInputRef.current?.click();}} className="w-full text-left px-4 py-2.5 hover:bg-slate-100 font-semibold border-t border-slate-100">📥 明細CSV取込</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ログインモーダル */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5 border border-slate-200">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-slate-800">🔑 アカウント認証</h3>
              <button onClick={() => setIsAuthModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold px-2">✕</button>
            </div>
            <button onClick={handleGoogleLogin} disabled={authLoading} className="w-full bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold py-2.5 rounded-lg text-sm transition shadow-sm flex items-center justify-center gap-2">
              Google でログイン
            </button>
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs">
              <button type="button" onClick={() => setAuthTab('login')} className={`flex-1 py-1.5 font-bold rounded-lg ${authTab === 'login' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>ログイン</button>
              <button type="button" onClick={() => setAuthTab('signup')} className={`flex-1 py-1.5 font-bold rounded-lg ${authTab === 'signup' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>新規登録</button>
            </div>
            <form onSubmit={handleEmailPasswordAuth} className="space-y-3.5">
              <input type="email" required placeholder="メールアドレス" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className="w-full border p-2.5 rounded-lg text-sm bg-slate-50" />
              <input type="password" required placeholder="パスワード(6文字以上)" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} className="w-full border p-2.5 rounded-lg text-sm bg-slate-50" />
              {authMsg && <div className="p-2.5 rounded text-xs bg-red-50 text-red-700">{authMsg}</div>}
              <button type="submit" disabled={authLoading} className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 rounded-lg text-sm transition">
                {authLoading ? '処理中...' : authTab === 'signup' ? '登録する' : 'ログイン'}
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
              <h3 className="text-lg font-bold text-slate-800">⚙️ ユーザー設定</h3>
              <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold px-2">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">現在のステータス</label>
                <select value={currentStatus} onChange={(e) => setCurrentStatus(e.target.value)} className="w-full border p-2.5 rounded-lg text-slate-800 bg-slate-50 font-medium">
                  <option value="none">一般会員</option>
                  <option value="bronze">ブロンズ</option>
                  <option value="platinum">プラチナ (SFC)</option>
                  <option value="diamond">ダイヤモンド</option>
                  <option value="diamond_more">ダイヤモンド +More</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">所持カード</label>
                <select value={cardType} onChange={(e) => setCardType(e.target.value)} className="w-full border p-2.5 rounded-lg text-slate-800 bg-slate-50 font-medium">
                  <option value="none">カードなし</option>
                  <option value="general">ANA一般カード</option>
                  <option value="gold">ANAゴールドカード</option>
                  <option value="premium">ANAカード プレミアム</option>
                </select>
              </div>

              <div className="border-t pt-4">
                <p className="text-xs font-bold text-slate-800 mb-1">✈️ 累積LTMの初期値設定</p>
                <p className="text-[11px] text-slate-500 mb-3">※ANAマイページに表示されているLTM数値と確認日を入力してください。確認日以降の搭乗分のみフライト履歴から加算されます。</p>

                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block">LTM確認基準日</label>
                    <input
                      type="date"
                      value={ltmBaseDate}
                      onChange={(e) => setLtmBaseDate(e.target.value)}
                      className="border p-2 rounded-lg text-slate-800 w-full mt-1 text-sm bg-slate-50"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block">基準時点のANA便LTM</label>
                      <input
                        type="number"
                        value={pastAnaLTM}
                        onChange={(e) => setPastAnaLTM(Number(e.target.value) || 0)}
                        className="border p-2 rounded-lg text-slate-800 w-full mt-1 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block">基準時点の総LTM (ANA＋他社便)</label>
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
            </div>
            <div className="pt-3 border-t flex justify-end">
              <button onClick={() => setIsSettingsOpen(false)} className="bg-blue-600 text-white px-5 py-2 rounded-lg font-semibold text-sm">保存して閉じる</button>
            </div>
          </div>
        </div>
      )}

      {/* 目標ステータス設定 */}
      <div className={`${theme.cardBg} p-5 rounded-xl shadow-sm border ${theme.cardBorder} mb-6 space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-800">【{selectedYear}年】達成目標ステータス:</span>
            <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className="border bg-white px-3 py-1 rounded-lg text-slate-800 font-bold">
              <option value="bronze">ブロンズ</option><option value="platinum">プラチナ (SFC)</option><option value="diamond">ダイヤモンド</option><option value="diamond_more">ダイヤモンド+More</option>
            </select>
          </div>
          <div className="flex bg-slate-200/70 p-1 rounded-lg">
            <button type="button" onClick={() => setGoalMode('flight')} className={`px-3 py-1 rounded-md text-xs font-bold transition ${goalMode === 'flight' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}>✈️ フライトのみで達成</button>
            <button type="button" onClick={() => setGoalMode('life')} className={`px-3 py-1 rounded-md text-xs font-bold transition ${goalMode === 'life' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-600'}`}>🛍️ ライフソリューション併用</button>
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className={`${theme.cardBg} p-4 rounded-xl shadow-sm border ${theme.cardBorder}`}>
          <p className="text-xs font-semibold text-slate-500">獲得プレミアムポイント (PP)</p>
          <p className="text-xl font-bold text-blue-600 mt-1">
            {goalMode === 'flight' ? `${totalPP.toLocaleString()} / ${targetTotalPP.toLocaleString()} PP` : `${anaPP.toLocaleString()} / ${targetAnaPP.toLocaleString()} PP`}
          </p>
          <div className="w-full bg-slate-200 h-2 rounded-full mt-2 overflow-hidden">
            <div className={`${theme.progressBar} h-full transition-all duration-500`} style={{ width: `${Math.min(((goalMode === 'flight' ? totalPP : anaPP) / (targetTotalPP || 1)) * 100, 100)}%` }}></div>
          </div>
          <div className="mt-3 pt-2 border-t text-xs flex justify-between text-slate-600">
            <span>ANA便: <strong className="text-blue-700">{anaPP.toLocaleString()} PP</strong></span>
            <span>他社便: <strong className="text-purple-700">{starPP.toLocaleString()} PP</strong></span>
          </div>
        </div>
        <div className={`${theme.cardBg} p-4 rounded-xl shadow-sm border ${theme.cardBorder}`}>
          <p className="text-xs font-semibold text-slate-500">年間総利用金額</p>
          <p className="text-xl font-bold text-slate-800 mt-1">¥{totalCost.toLocaleString()}</p>
        </div>
        <div className={`${theme.cardBg} p-4 rounded-xl shadow-sm border ${theme.cardBorder}`}>
          <p className="text-xs font-semibold text-slate-500">平均 PP単価</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">¥{avgPpUnitCost} / PP</p>
        </div>
        <div className={`${theme.cardBg} p-4 rounded-xl shadow-sm border ${theme.cardBorder}`}>
          <p className="text-xs font-semibold text-slate-500">年間獲得LTM</p>
          <p className="text-xl font-bold text-indigo-600 mt-1">{totalLTMInYear.toLocaleString()} M</p>
          <p className="text-[10px] text-slate-400 mt-2">※{selectedYear}年の登録フライトによる獲得LTM合計</p>
        </div>
      </div>

      {/* アフィリエイト枠1：ANAカード訴求 */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-xl p-5 text-white shadow-md mb-8 border border-indigo-900/50">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <span className="bg-amber-400 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full uppercase">SFC修行必携</span>
              <h3 className="font-bold text-sm text-amber-200">積算率・ボーナスマイルを最大化するANAカード</h3>
            </div>
            <p className="text-xs text-slate-300">ゴールド以上のカードなら搭乗ボーナスマイル25%〜UP。修行中の効率が大幅に向上します。</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 w-full md:w-auto">
            <a href="https://www.ana.co.jp/ja/jp/amc/anacard/" target="_blank" rel="noopener noreferrer" className="flex-1 md:flex-none text-center bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs px-4 py-2.5 rounded-lg transition">ANAゴールドを発行 💳</a>
          </div>
        </div>
      </div>

      {/* LTMシミュレーション（未ログイン時はロック） */}
      <div className="relative mb-8">
        {!currentUser && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-10 rounded-xl flex flex-col items-center justify-center text-white border border-slate-700">
            <span className="text-3xl mb-2">🔒</span>
            <p className="font-bold mb-3">LTMのシミュレーション機能は会員限定です</p>
            <button onClick={() => setIsAuthModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 px-5 py-2.5 rounded-lg font-bold text-sm shadow-lg transition">ログイン / 無料会員登録</button>
          </div>
        )}
        <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-800 text-white p-6 rounded-xl shadow-md">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-bold flex items-center gap-2">✈️ LTM（ライフタイムマイル）達成シミュレーション</h2>
            <div className="flex bg-slate-700 p-0.5 rounded text-xs">
              <button onClick={() => setLtmMode('ana')} className={`px-2.5 py-1 rounded font-semibold ${ltmMode === 'ana' ? 'bg-blue-600 text-white' : 'text-slate-300'}`}>ANAグループ便</button>
              <button onClick={() => setLtmMode('total')} className={`px-2.5 py-1 rounded font-semibold ${ltmMode === 'total' ? 'bg-blue-600 text-white' : 'text-slate-300'}`}>総LTM（他社便含む）</button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-4">
            <div>
              <p className="text-xs text-slate-400">現在の累計 LTM ({ltmMode === 'ana' ? 'ANAグループ便のみ' : '総計'})</p>
              <p className="text-2xl font-bold text-sky-400">{targetLTMCurrent.toLocaleString()} マイル</p>
              <p className="text-[10px] text-slate-400 mt-0.5">(基準日 {ltmBaseDate} 以降の未反映フライト分を加算中)</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">目標 LTM</p>
              <input type="text" value={targetLTMInput} onChange={(e) => setTargetLTMInput(e.target.value)} disabled={!currentUser} className="bg-slate-700 text-white px-3 py-1 rounded text-xl font-bold w-40 border border-slate-600 mt-1" />
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
      </div>

      {/* フライト入力フォーム（未ログイン時はロック） */}
      <div className="relative mb-8">
        {!currentUser && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-sm z-10 rounded-xl flex flex-col items-center justify-center text-slate-800 border border-slate-200">
            <span className="text-3xl mb-2">✈️</span>
            <p className="font-bold mb-3">フライト実績の登録はクラウドに安全に保存されます</p>
            <button onClick={() => setIsAuthModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-bold text-sm shadow-lg transition">ログイン / 無料会員登録</button>
          </div>
        )}
        <form onSubmit={handleSaveFlight} className={`${theme.cardBg} p-6 rounded-xl shadow-sm border ${theme.cardBorder} space-y-4`}>
          <div className="flex justify-between items-center border-b pb-3">
            <h2 className="text-lg font-semibold text-slate-800">{editingId ? '✏️ フライトを編集' : '✈️ フライト実績を入力'}</h2>
            <div className="flex bg-slate-200/70 p-1 rounded-lg">
              <button type="button" onClick={() => setFlightType('domestic')} disabled={!currentUser} className={`px-4 py-1.5 rounded-md text-xs font-bold ${flightType === 'domestic' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}>国内線</button>
              <button type="button" onClick={() => setFlightType('international')} disabled={!currentUser} className={`px-4 py-1.5 rounded-md text-xs font-bold ${flightType === 'international' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}>国際線</button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div><label className="text-xs text-slate-500 font-medium">搭乗日</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={!currentUser} className="border p-2 rounded-lg text-slate-800 w-full mt-1 text-sm bg-white" /></div>
            <div><label className="text-xs text-slate-500 font-medium">運航会社</label><select value={airline} onChange={(e) => setAirline(e.target.value as 'ana' | 'star')} disabled={!currentUser} className="border p-2 rounded-lg text-slate-800 w-full mt-1 bg-white text-sm"><option value="ana">ANAグループ便</option><option value="star">他社便（スター等）</option></select></div>
            <div><label className="text-xs text-slate-500 font-medium">出発地</label><select value={depAirport} onChange={(e) => setDepAirport(e.target.value)} disabled={!currentUser} className="border p-2 rounded-lg text-slate-800 w-full mt-1 bg-white text-sm">{renderAirportOptions(flightType === 'domestic')}</select></div>
            <div><label className="text-xs text-slate-500 font-medium">到着地</label><select value={arrAirport} onChange={(e) => setArrAirport(e.target.value)} disabled={!currentUser} className="border p-2 rounded-lg text-slate-800 w-full mt-1 bg-white text-sm">{renderAirportOptions(flightType === 'domestic')}</select></div>
            <div><label className="text-xs text-slate-500 font-medium">支払金額 (円) <span className="text-[10px] text-slate-400">※任意</span></label><input type="number" placeholder="未入力可" value={cost} onChange={(e) => setCost(e.target.value)} disabled={!currentUser} className="border p-2 rounded-lg text-slate-800 w-full mt-1 text-sm bg-white" /></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
            <div>
              <label className="text-xs text-slate-500 font-medium">運賃種別 / 予約クラス</label>
              <select value={selectedFareId} disabled={!currentUser} onChange={(e) => {
                const fId = Number(e.target.value); setSelectedFareId(fId);
                const found = fareMasterList.find(f => f.id === fId);
                if (found) { setAccRate(found.accumulation_rate); setBoardPoints(found.boarding_points); }
              }} className="border p-2 rounded-lg text-slate-800 w-full mt-1 bg-white text-xs font-medium">
                {currentFares.map(f => <option key={f.id} value={f.id}>{f.fare_category} ({f.accumulation_rate}%)</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">搭乗ポイント</label>
              <select value={boardPoints} disabled={!currentUser} onChange={(e) => setBoardPoints(Number(e.target.value))} className="border p-2 rounded-lg text-slate-800 w-full mt-1 bg-white text-xs">
                <option value={400}>400 ポイント</option><option value={200}>200 ポイント</option><option value={0}>0 ポイント</option>
              </select>
            </div>
          </div>

          {routeError ? (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm flex items-center gap-2 font-medium">⚠️ {routeError}</div>
          ) : (
            <div className="flex gap-6 items-center bg-slate-100 p-3 rounded-lg text-sm border border-slate-200">
              <span className="text-slate-600 font-medium">自動算出結果:</span>
              <div>獲得マイル: <span className="font-bold text-indigo-600">{calculatedMiles?.toLocaleString()} M</span></div>
              <div>獲得PP: <span className="font-bold text-blue-600">{calculatedPP?.toLocaleString()} PP</span></div>
              <div>PP単価: <span className="font-bold text-emerald-600">¥{cost && calculatedPP && calculatedPP > 0 ? (Number(cost) / calculatedPP).toFixed(1) : '0'}</span></div>
            </div>
          )}

          <button type="submit" disabled={!!routeError || !currentUser} className={`font-medium px-5 py-2.5 rounded-lg transition w-full md:w-auto shadow-sm ${routeError || !currentUser ? 'bg-slate-300 text-slate-500' : theme.primaryBtn}`}>
            {editingId ? '更新を保存する' : 'フライトを登録する'}
          </button>
        </form>
      </div>

      {/* 履歴テーブル（未ログイン時はロック） */}
      <div className="relative">
        {!currentUser && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-sm z-10 rounded-xl flex flex-col items-center justify-center text-slate-800 border border-slate-200">
            <span className="text-3xl mb-2">📊</span>
            <p className="font-bold mb-3">フライト履歴の一括管理・CSV出力が可能です</p>
            <button onClick={() => setIsAuthModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-bold text-sm shadow-lg transition">ログインして始める</button>
          </div>
        )}
        <div className={`${theme.cardBg} rounded-xl shadow-sm border ${theme.cardBorder}`}>
          <div className="p-4 bg-slate-100/80 border-b flex flex-wrap gap-4 justify-between items-center">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-slate-700">{selectedYear}年のフライト履歴 ({filteredFlights.length}件)</span>
              <div className="flex bg-white border border-slate-300 rounded-lg p-0.5 text-xs">
                <button type="button" onClick={() => setCategoryFilter('all')} disabled={!currentUser} className={`px-2.5 py-1 rounded-md font-medium transition ${categoryFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-600'}`}>すべて</button>
                <button type="button" onClick={() => setCategoryFilter('domestic')} disabled={!currentUser} className={`px-2.5 py-1 rounded-md font-medium transition ${categoryFilter === 'domestic' ? 'bg-slate-800 text-white' : 'text-slate-600'}`}>国内線のみ</button>
                <button type="button" onClick={() => setCategoryFilter('international')} disabled={!currentUser} className={`px-2.5 py-1 rounded-md font-medium transition ${categoryFilter === 'international' ? 'bg-slate-800 text-white' : 'text-slate-600'}`}>国際線のみ</button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={handleExportCSV} disabled={!currentUser} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1 shadow-sm disabled:opacity-50">📄 CSVダウンロード</button>
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <span>表示:</span>
                <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} disabled={!currentUser} className="border bg-white px-2 py-1 rounded text-slate-800 font-medium">
                  <option value={20}>20件</option><option value={50}>50件</option><option value={100}>100件</option><option value={200}>200件</option><option value={9999}>全件</option>
                </select>
              </div>
            </div>
          </div>

          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b">
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
                  <td className="p-3">¥{(f.cost || 0).toLocaleString()}</td>
                  <td className="p-3 font-semibold text-blue-600">{f.pp.toLocaleString()}</td>
                  <td className="p-3 font-semibold text-emerald-600">¥{f.cost && f.pp > 0 ? (f.cost / f.pp).toFixed(1) : '0'}</td>
                  <td className="p-3">{f.ltm.toLocaleString()} M</td>
                  <td className="p-3 text-right relative">
                    <button onClick={() => setOpenMenuId(openMenuId === f.id ? null : f.id)} className="px-2 py-1 text-slate-500 hover:bg-slate-200 rounded text-lg font-bold">⋮</button>
                    {openMenuId === f.id && (
                      <div className="absolute right-3 top-10 bg-white border border-slate-200 rounded-lg shadow-lg z-10 text-left w-24 overflow-hidden">
                        <button onClick={() => handleEdit(f)} className="w-full px-3 py-2 text-xs text-slate-700 hover:bg-slate-100 block">編集</button>
                        <button onClick={() => handleDelete(f.id)} className="w-full px-3 py-2 text-xs text-red-600 hover:bg-red-50 block border-t border-slate-100">削除</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* アフィリエイト枠2：ホテル予約訴求 */}
      <div className="mt-8 bg-white p-5 rounded-xl border border-slate-200 shadow-sm text-center md:text-left md:flex justify-between items-center gap-4">
        <div>
          <h3 className="font-bold text-sm text-slate-800">🏨 修行フライトの宿泊手配はお済みですか？</h3>
          <p className="text-xs text-slate-500 mt-1">宿泊でもマイルが貯まる予約サイトで修行コストを無駄なく活用しましょう。</p>
        </div>
        <div className="mt-3 md:mt-0 flex gap-2 justify-center flex-shrink-0">
          <a href="https://px.a8.net/svt/ejp?a8mat=4BC5IV+EMB7JM+4X1W+5YRHE" target="_blank" rel="noopener noreferrer" className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg transition">ホテルを探す ✈️</a>
        </div>
      </div>

      {/* フィードバック用自作モーダル */}
      {isFeedbackOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-base font-bold text-slate-800">💬 ご要望・エラー報告</h3>
              <button onClick={() => setIsFeedbackOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg font-bold px-2">✕</button>
            </div>
            <form onSubmit={handleSendFeedback} className="space-y-4">
              <select value={feedbackType} onChange={(e) => setFeedbackType(e.target.value)} className="w-full border p-2 rounded-lg text-xs bg-slate-50">
                <option value="bug">🐛 不具合の報告</option>
                <option value="feature">💡 改善案・ご要望</option>
                <option value="other">📝 その他のお問い合わせ</option>
              </select>
              <textarea required rows={4} placeholder="お気づきの点をご記入ください" value={feedbackContent} onChange={(e) => setFeedbackContent(e.target.value)} className="w-full border p-2.5 rounded-lg text-xs bg-slate-50" />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsFeedbackOpen(false)} className="px-4 py-2 text-xs font-semibold text-slate-500">キャンセル</button>
                <button type="submit" disabled={feedbackSending || !feedbackContent} className="bg-slate-800 text-white px-5 py-2 rounded-lg text-xs font-bold">
                  {feedbackSending ? '送信中...' : '送信する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 右下起動ボタン */}
      <button onClick={() => setIsFeedbackOpen(true)} className="fixed bottom-5 right-5 bg-slate-800 text-white font-bold text-xs px-3.5 py-2.5 rounded-full shadow-lg z-40 flex items-center gap-1.5 hover:scale-105 transition">
        <span>💬</span> ご要望・改善案
      </button>

      {/* フッターリンク */}
      <footer className="mt-16 text-center text-xs text-slate-500 space-y-2 border-t border-slate-200/60 pt-6 pb-20">
        <div className="flex justify-center gap-4 font-medium">
          <a href="/privacy" className="hover:underline text-slate-600">プライバシーポリシー</a>
          <span>•</span>
          <button onClick={() => setIsFeedbackOpen(true)} className="hover:underline text-slate-600 cursor-pointer">お問い合わせ</button>
        </div>
        <p>© 2026 ANA マイレージ＆PP管理 by AT Corporation LLC All Rights Reserved.</p>
      </footer>
    </main>
  );
}