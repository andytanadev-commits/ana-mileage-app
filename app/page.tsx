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
  is_major?: boolean;
  search_keywords?: string;
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

// -----------------------------------------------------
// 検索機能付き空港選択コンポーネント (AirportSelect)
// -----------------------------------------------------
function AirportSelect({
  label,
  value,
  onChange,
  airportList,
  isDomesticOnly,
  disabled
}: {
  label: string;
  value: string;
  onChange: (code: string) => void;
  airportList: Airport[];
  isDomesticOnly: boolean;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedAirport = airportList.find(a => a.code === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const targetAirports = airportList.filter(a => isDomesticOnly ? a.region === 'japan' : true);

  const isSearching = query.trim().length > 0;
  const filteredAirports = isSearching
    ? targetAirports.filter(a => {
        const q = query.toLowerCase().trim();
        const codeMatch = a.code.toLowerCase().includes(q);
        const nameMatch = a.name.toLowerCase().includes(q);
        const countryMatch = a.country.toLowerCase().includes(q);
        const keywordMatch = a.search_keywords ? a.search_keywords.toLowerCase().includes(q) : false;
        return codeMatch || nameMatch || countryMatch || keywordMatch;
      })
    : targetAirports.filter(a => a.is_major);

  const renderGroup = (regionKey: string, regionName: string) => {
    const groupItems = filteredAirports.filter(a => a.region === regionKey);
    if (groupItems.length === 0) return null;

    return (
      <div key={regionKey} className="mb-2">
        <div className="px-3 py-1 text-[11px] font-bold text-slate-400 bg-slate-100/80 rounded mb-1">
          {regionName}
        </div>
        {groupItems.map(a => (
          <button
            key={a.code}
            type="button"
            onClick={() => {
              onChange(a.code);
              setIsOpen(false);
              setQuery('');
            }}
            className={`w-full text-left px-3 py-2 text-xs rounded-lg flex items-center justify-between transition ${
              a.code === value ? 'bg-blue-50 font-bold text-blue-700' : 'hover:bg-slate-100 text-slate-700'
            }`}
          >
            <span>{a.name} <span className="text-slate-400 font-normal">({a.code})</span></span>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="relative" ref={containerRef}>
      <label className="text-xs text-slate-500 font-medium block mb-1">{label}</label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full border p-2 rounded-lg text-slate-800 bg-white text-sm text-left flex justify-between items-center shadow-sm disabled:bg-slate-100 disabled:cursor-not-allowed"
      >
        <span className="truncate">
          {selectedAirport ? `${selectedAirport.name} (${selectedAirport.code})` : '選択してください'}
        </span>
        <span className="text-slate-400 text-xs">▼</span>
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 space-y-2 max-h-80 overflow-y-auto">
          <input
            type="text"
            placeholder="🔍 空港名・3レターコードで検索..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full border p-2 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-blue-500 text-slate-800"
            autoFocus
          />

          {!isSearching && (
            <p className="text-[10px] text-slate-400 px-2">※検索欄にコードや都市名を入力して全空港から選択可能です。</p>
          )}

          <div className="divide-y divide-slate-100">
            {filteredAirports.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">該当する空港が見つかりません</p>
            ) : (
              <>
                {renderGroup('japan', '🇯🇵 日本')}
                {!isDomesticOnly && (
                  <>
                    {renderGroup('asia', '🌏 アジア')}
                    {renderGroup('oceania', '🐨 オセアニア')}
                    {renderGroup('other', '🌎 欧米・その他')}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
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
  const [pastStarLTM, setPastStarLTM] = useState<number>(0);
  const [ltmBaseDate, setLtmBaseDate] = useState<string>(getTodayDateString());
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
    if (routeError || calculatedPP === null || calculatedMiles === null || calculatedLTM === null) return無事実装できたとのこと、良かったです！

ご提示いただいた空港の具体的なリストが本文に含まれていなかったため、一般的な日本の主要国際空港（羽田・成田・関西・中部・福岡・新千歳・那覇）を割り当ててコードを更新しました。「主要」というラベル表記も削除しています。

**修正後の設定・コード例**

```javascript
// 国際線で表示する出発空港リスト（「主要」の文字を除外）
const internationalAirports = [
  { code: 'HND', name: '羽田空港' },
  { code: 'NRT', name: '成田国際空港' },
  { code: 'KIX', name: '関西国際空港' },
  { code: 'NGO', name: '中部国際空港' },
  { code: 'FUK', name: '福岡空港' },
  { code: 'CTS', name: '新千歳空港' },
  { code: 'OKA', name: '那覇空港' }
];

// プルダウン生成例（optgroupなどを使用する場合も「主要」を排してシンプルに指定）
function renderAirportDropdown() {
  const selectElement = document.getElementById('airport-select');
  selectElement.innerHTML = '<option value="">空港を選択してください</option>';

  internationalAirports.forEach(airport => {
    const option = document.createElement('option');
    option.value = airport.code;
    option.textContent = airport.name; // 「主要」を含まない名称を表示
    selectElement.appendChild(option);
  });
}