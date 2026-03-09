import React, { useState, useEffect, useRef, useMemo } from 'react';

// ==========================================
// 1. 安全存储与系统内核配置
// ==========================================
const CACHE_KEY_DATA = 'ok_cmd_data_v38';
const CACHE_KEY_FAVS = 'ok_cmd_favs_v38';
const CACHE_KEY_SETTINGS = 'ok_cmd_settings_v38';

const safeStorage = {
  get: (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
};

const AI_PROVIDERS = {
  deepseek: { name: 'DeepSeek', url: 'https://api.deepseek.com/v1/chat/completions', model: 'deepseek-chat' },
  zhipu: { name: '智谱 AI', url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', model: 'glm-4' },
  minimax: { name: 'MiniMax', url: 'https://api.minimax.chat/v1/text_generation_v2', model: 'abab6.5-chat' },
  custom: { name: 'Custom API', url: '', model: '' }
};

const themeStyles = {
  dark: { bg: '#050505', color: '#00ff41', dim: '#008f11', border: '#003b00', hover: '#001a00', up: '#00ff41', down: '#ff3333', warn: '#ffb000', invertBg: '#00ff41', invertColor: '#050505', panelBg: 'rgba(0,20,0,0.3)', btnActiveBg: '#00ff41', btnActiveText: '#050505' },
  light: { bg: '#f8f9fa', color: '#1a1a1a', dim: '#6c757d', border: '#dee2e6', hover: '#e9ecef', up: '#198754', down: '#dc3545', warn: '#fd7e14', invertBg: '#1a1a1a', invertColor: '#ffffff', panelBg: 'rgba(255,255,255,0.8)', btnActiveBg: '#eef2f6', btnActiveText: '#1a1a1a' }
};

// ==========================================
// 2. 原生 SVG 图标 (确保 100% 加载成功)
// ==========================================
const Icons = {
  Star: ({ f, onClick, style }) => (
    <svg onClick={onClick} style={{ cursor: 'pointer', ...style }} width="14" height="14" viewBox="0 0 24 24" fill={f?"currentColor":"none"} stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
  ),
  Settings: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  X: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
};

// ==========================================
// 3. 基础 ETF 原始数据与解析
import { rawTextData } from './data';

const parseData = () => {
  const list = [];
  const cats = new Set(['全部']);
  rawTextData.trim().split('\n').forEach((line, i) => {
    const parts = line.split('\t');
    if (parts.length >= 4) {
      const [t, c, p, n] = parts;
      list.push({ id: t+i, ticker: t, nameZh: n, catZh: c, price: p, chg: "0.00", flash: false });
      cats.add(c);
    }
  });
  return { initList: list, initCats: Array.from(cats) };
};
const { initList, initCats } = parseData();

// ==========================================
// 4. 主程序核心组件
// ==========================================
function ProviderSettings({ settings, setSettings, activeTheme, theme }) {
  const p = settings.aiP;
  const prov = settings.providers[p] || {};
  
  const updateProvider = (field, value) => {
    setSettings({
      ...settings,
      providers: {
        ...settings.providers,
        [p]: { ...prov, [field]: value }
      }
    });
  };
  
  const inputStyle = {
    borderColor: activeTheme.border, 
    color: activeTheme.color,
    backgroundColor: theme === 'dark' ? '#000' : '#fff'
  };
  
  return (
    <div className="space-y-2">
      <input 
        type="password" 
        placeholder="API_KEY" 
        className="w-full border p-2 mb-2 outline-none" 
        style={inputStyle}
        value={prov.key || ''} 
        onChange={e => updateProvider('key', e.target.value)} 
      />
      {p === 'custom' && (
        <>
          <input 
            placeholder="API URL" 
            className="w-full border p-2 mb-2 outline-none" 
            style={inputStyle}
            value={prov.customUrl || ''} 
            onChange={e => updateProvider('customUrl', e.target.value)} 
          />
          <input 
            placeholder="Model" 
            className="w-full border p-2 outline-none" 
            style={inputStyle}
            value={prov.customModel || ''} 
            onChange={e => updateProvider('customModel', e.target.value)} 
          />
        </>
      )}
    </div>
  );
}

export default function App() {
  const [etfs, setEtfs] = useState(initList);
  const [favs, setFavs] = useState(new Set());
  const [theme, setTheme] = useState('light');
  const [marketStatus, setMarketStatus] = useState('Open'); // Open/Close based on US market hours
  const [newEtf, setNewEtf] = useState({symbol: '', name: '', category: 'Custom', customCategory: ''});
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all'); 
  const [catF, setCatF] = useState('全部');
  const [priceF, setPriceF] = useState('ALL');
  const [sortField, setSortField] = useState('chg'); // 涨跌幅排序
  const [sortDir, setSortDir] = useState('desc'); // 升序/降序
  
  const [settings, setSettings] = useState({ 
    aiP: 'deepseek', 
    providers: {
      deepseek: { key: '', customUrl: '', customModel: '' },
      zhipu: { key: '', customUrl: '', customModel: '' },
      minimax: { key: '', customUrl: '', customModel: '' },
      custom: { key: '', customUrl: '', customModel: '' }
    },
    tgT: '', tgC: '' 
  });
  const [modal, setModal] = useState(null); 
  const [newEtfBatch, setNewEtfBatch] = useState(''); // 批量添加
  const [aiState, setAiState] = useState({ open: false, loading: false, content: '' });
  const [logs, setLogs] = useState([{ t: new Date().toLocaleTimeString(), m: '内核引导完成。指令集载入。' }]);
  const [currentTime, setCurrentTime] = useState('--:--:--');
  const [refreshCountdown, setRefreshCountdown] = useState(60);
  
  const [exportCfg, setExportCfg] = useState({
    fields: { ticker: true, name: true, cat: false, price: true, chg: true },
    format: 'txt'
  });
  const [copySuccess, setCopySuccess] = useState(false);
  const [indices, setIndices] = useState([]);
  const [rowFlash, setRowFlash] = useState(new Set());
  const [hoveredChart, setHoveredChart] = useState(null);

  const activeTheme = themeStyles[theme];
  const logRef = useRef(null);

  // --- 初始化与网络同步 ---
  useEffect(() => {
    // 检查美股是否开市 (US Eastern Time)
    const checkMarketStatus = () => {
      // 智能获取美东时间（自动处理夏令时）
      const easternTime = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
      const eastern = new Date(easternTime);
      const hour = eastern.getHours();
      const day = eastern.getDay();
      const isWeekday = day > 0 && day < 6;
      const isMarketHours = hour >= 9 && hour < 16;
      // 美股时间 9:30-16:00 EST 为开市
      setMarketStatus(isWeekday && isMarketHours ? 'Open' : 'Close');
    };
    checkMarketStatus();
    setInterval(checkMarketStatus, 60000); // 每分钟检查
    
    const s = safeStorage.get(CACHE_KEY_SETTINGS); if (s) setSettings(s);
    const f = safeStorage.get(CACHE_KEY_FAVS); if (f) setFavs(new Set(f));
    
    // 获取全球指数
    const fetchIndices = async () => {
      try {
        const res = await fetch('/api/indices', { cache: 'no-store' });
        const data = await res.json();
        if (Array.isArray(data)) setIndices(data);
      } catch {}
    };
    fetchIndices();
    setInterval(fetchIndices, 30000);
    
    // 读取URL参数（分享链接）
    const params = new URLSearchParams(window.location.search);
    if (params.get('filter')) setFilter(params.get('filter'));
    if (params.get('sort')) {
      const [field, dir] = params.get('sort').split('_');
      if (field) setSortField(field);
      if (dir) setSortDir(dir);
    }
    const d = safeStorage.get(CACHE_KEY_DATA);
    if (d) setEtfs(prev => prev.map(e => {
        const c = d.find(x => x.ticker === e.ticker);
        return c ? { ...e, price: c.price, chg: c.chg, isReal: true } : e;
    }));
    
    fetchRealData();
    const timer = setInterval(() => setCurrentTime(new Date().toLocaleTimeString('en-US', { hour12: false })), 1000);
    const dataTimer = setInterval(() => { fetchRealData(); setRefreshCountdown(10); }, 10000); // 每10秒刷新数据
    const countdownTimer = setInterval(() => setRefreshCountdown(c => Math.max(0, c - 1)), 1000); // 倒计时
    return () => { clearInterval(timer); clearInterval(dataTimer); clearInterval(countdownTimer); };
    // eslint-disable-next-line
  }, []);

  useEffect(() => safeStorage.set(CACHE_KEY_SETTINGS, settings), [settings]);
  useEffect(() => safeStorage.set(CACHE_KEY_FAVS, Array.from(favs)), [favs]);
  useEffect(() => { if (logRef.current) logRef.current.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  const fetchRealData = async () => {
    setLogs(p => [...p, { t: new Date().toLocaleTimeString(), m: '>>> 正在拉取全球实时数据...' }]);
    const symbols = ["SPY","QQQ","DIA","IWM","IWF","IWD","VTI","IVV","VOO","AAPL","MSFT","GOOGL","AMZN","NVDA","TSLA","META","BTC-USD","ETH-USD","SOL-USD","GC=F","CL=F","EURUSD=X","USDJPY=X","TNX"];
    try {
      const res = await fetch('https://scanner.tradingview.com/america/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbols: { tickers: symbols.map(s => 'AMEX:' + s) },
          query: { types: [] },
          columns: ['close', 'change', 'description', 'name']
        })
      });
      const q = await res.json();
      const data = (q.data || []).map(x => {
        const parts = x.s.split(':');
        return {
          symbol: parts[1] || x.s,
          price: x.d?.[0] || 0,
          changePercent24h: x.d?.[1] || 0
        };
      });
      if (Array.isArray(data) && data.length > 0) {
        setEtfs(prev => {
          const next = prev.map(e => {
            const q = data.find(r => r.symbol === e.ticker);
            return q ? { ...e, price: q.price.toFixed(2), chg: q.changePercent24h.toFixed(2), flash: true, isReal: true } : e;
          });
          safeStorage.set(CACHE_KEY_DATA, next);
          return next;
        });
        setLogs(p => [...p, { t: new Date().toLocaleTimeString(), m: `[OK] 全球行情数据同步成功。` }]);
        const allSymbols = new Set(data.map(x => x.symbol));
        setRowFlash(allSymbols);
        setTimeout(() => setRowFlash(new Set()), 600);
        setTimeout(() => setEtfs(p => p.map(e => ({...e, flash: false}))), 1000);
      }
    } catch (e) {
      setLogs(p => [...p, { t: new Date().toLocaleTimeString(), m: '[ERR] 网络链路阻塞！', type: 'error' }]);
    }
  };

  const executeAi = async (targetCategory = null) => {
    const providerSettings = settings.providers[settings.aiP];
    if (!providerSettings?.key) { setLogs(p => [...p, { t: new Date().toLocaleTimeString(), m: 'API_KEY 未配置，请进入 [ SETTINGS ]。', type: 'warn' }]); return; }
    setAiState({ open: true, loading: true, content: '' });
    const config = AI_PROVIDERS[settings.aiP];
    const apiUrl = settings.aiP === 'custom' ? (providerSettings.customUrl || config.url) : (providerSettings.customUrl || config.url);
    const apiModel = settings.aiP === 'custom' ? (providerSettings.customModel || 'default') : config.model;
    
    // 分析目标：如果指定了分类则分析该分类，否则分析全市场
    const analysisData = targetCategory ? filtered.filter(e => e.catZh === targetCategory) : filtered;
    const categoryName = targetCategory || '全市场';
    const upCount = analysisData.filter(e => parseFloat(e.chg) > 0).length;
    const downCount = analysisData.filter(e => parseFloat(e.chg) < 0).length;
    const topGainers = analysisData.sort((a,b) => parseFloat(b.chg) - parseFloat(a.chg)).slice(0, 3);
    const topLosers = analysisData.sort((a,b) => parseFloat(a.chg) - parseFloat(b.chg)).slice(0, 3);
    
    const context = `请分析【${categoryName}】板块，共${analysisData.length}个ETF。上涨${upCount}个，下跌${downCount}个。
领涨ETF：${topGainers.map(e=>`${e.ticker}(${e.nameZh}): ${e.chg}%`).join('、')}
领跌ETF：${topLosers.map(e=>`${e.ticker}(${e.nameZh}): ${e.chg}%`).join('、')}
请给出简要分析和建议。`;
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${providerSettings.key}` },
        body: JSON.stringify({ model: apiModel, messages: [{ role: 'user', content: context }] })
      });
      const d = await res.json();
      setAiState({ open: true, loading: false, content: d.choices[0].message.content });
      setLogs(p => [...p, { t: new Date().toLocaleTimeString(), m: '[AI] 洞察报告已就绪。' }]);
    } catch (e) { setAiState({ open: false, loading: false, content: '' }); }
  };

  // --- 统计与过滤 ---
  const stats = useMemo(() => ({
    total: etfs.length,
    up: etfs.filter(e => parseFloat(e.chg) > 0).length,
    down: etfs.filter(e => parseFloat(e.chg) < 0).length
  }), [etfs]);

  const filtered = etfs.filter(e => 
    (!search || e.ticker.toLowerCase().includes(search.toLowerCase()) || e.nameZh.includes(search)) &&
    (catF === '全部' || e.catZh === catF) &&
    (tab === 'all' || favs.has(e.id)) &&
    (priceF === 'ALL' || (priceF === 'UP' ? parseFloat(e.chg) > 0 : priceF === 'DOWN' ? parseFloat(e.chg) < 0 : priceF === 'UP3' ? parseFloat(e.chg) >= 3 : priceF === 'DOWN3' ? parseFloat(e.chg) <= -3 : priceF === 'UP5' ? parseFloat(e.chg) >= 5 : priceF === 'DOWN5' ? parseFloat(e.chg) <= -5 : true))
  ).sort((a, b) => {
    const aVal = sortField === 'ticker' ? a.ticker : parseFloat(a[sortField] || 0);
    const bVal = sortField === 'ticker' ? b.ticker : parseFloat(b[sortField] || 0);
    if (sortField === 'ticker') {
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
  });

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const generateExportText = () => {
    const header = [];
    if (exportCfg.fields.ticker) header.push('Symbol');
    if (exportCfg.fields.name) header.push('Chinese');
    if (exportCfg.fields.cat) header.push('Category');
    if (exportCfg.fields.price) header.push('Price');
    if (exportCfg.fields.chg) header.push('Change%');

    const rows = filtered.map(e => {
      const r = [];
      if (exportCfg.fields.ticker) r.push(e.ticker);
      if (exportCfg.fields.name) r.push(e.nameZh);
      if (exportCfg.fields.cat) r.push(e.catZh);
      if (exportCfg.fields.price) r.push(`$${e.price}`);
      if (exportCfg.fields.chg) r.push(`${e.chg}%`);
      return r;
    });

    if (exportCfg.format === 'csv') return [header.join(','), ...rows.map(r=>r.join(','))].join('\n');
    if (exportCfg.format === 'md') return `|${header.join('|')}|\n|${header.map(()=>'---').join('|')}|\n${rows.map(r=>`|${r.join('|')}|`).join('\n')}`;
    
    const topInfo = `全市场观察表 Market Watchlist\n时间: ${new Date().toLocaleDateString()}\n资产数量: ${filtered.length}\n\n`;
    return topInfo + header.join('\t') + '\n' + header.map(()=>'------').join('\t') + '\n' + rows.map(r=>r.join('\t')).join('\n');
  };

  // --- UI 构建方法 ---
  const TerminalBtn = ({ l, a, onClick, warn, className="" }) => (
    <button onClick={onClick} className={`px-2 py-1 border text-[11px] transition-all cursor-pointer whitespace-nowrap shrink-0 ${className}`} style={{ 
      borderColor: activeTheme.border, 
      backgroundColor: a ? (activeTheme.btnActiveBg || activeTheme.color) : 'transparent', 
      color: a ? (activeTheme.btnActiveText || activeTheme.bg) : (warn ? activeTheme.warn : activeTheme.color)
    }}>[ {l} ]</button>
  );
  
  // 明亮主题 hover 样式
  const btnHoverStyle = theme === 'dark' ? {} : { hover: { backgroundColor: '#e9ecef' } };

  return (
    <div className="flex flex-col h-screen box-border p-2 md:p-6 relative font-mono overflow-hidden transition-all duration-300" style={{ backgroundColor: activeTheme.bg, color: activeTheme.color }}>
      <style>{`.crt::after { content: " "; display: block; position: fixed; top: 0; left: 0; bottom: 0; right: 0; background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.1) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.03), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.03)); background-size: 100% 3px, 3px 100%; pointer-events: none; z-index: 99; } .row-flash { background-color: ${activeTheme.hoverBg}; transition: none; } .row-normal { background-color: transparent; transition: background-color 0.8s ease-out; } .hide-scroll::-webkit-scrollbar { display: none; }`}</style>
      <div className="crt pointer-events-none" />

      {/* 1. Header */}
    {/* 全球指数顶部横条 */}
    {indices.length > 0 && (
      <div className="flex gap-3 py-2 overflow-x-auto text-[10px] border-b" style={{ borderColor: activeTheme.border, backgroundColor: activeTheme.panelBg }}>
        {indices.map(idx => {
          const chg = parseFloat(idx.chg || 0);
          return (
            <span key={idx.symbol} className="shrink-0 flex items-center gap-1">
              <span className="font-bold">{idx.symbol}</span>
              <span style={{ color: chg > 0 ? activeTheme.up : (chg < 0 ? activeTheme.down : activeTheme.dim) }}>
                {idx.price?.toFixed(2)} {chg > 0 ? '↑' : (chg < 0 ? '↓' : '-')}{Math.abs(chg).toFixed(2)}%
              </span>
            </span>
          );
        })}
      </div>
    )}

      <header className="flex flex-col gap-2 mb-3 p-3 border-2 relative z-10" style={{ borderColor: activeTheme.border, backgroundColor: activeTheme.panelBg }}>
        <div className="text-xl font-bold flex items-center whitespace-nowrap">
          root@Marketlist:~$
        </div>
        <div className="text-xl font-bold flex items-center whitespace-nowrap">
          <span style={{color: activeTheme.dim}}>./terminal_{marketStatus}</span><span className="animate-pulse">_</span>
        </div>
        <div className="flex items-center gap-2">
          <TerminalBtn l="EXPORT_DATA" onClick={() => setModal('export')} />
          <TerminalBtn l="THEME" onClick={() => setTheme(t => t==='dark'?'light':'dark')} />
          <button onClick={() => setModal('settings')} className="px-2 py-1 border text-[11px] flex items-center gap-1 cursor-pointer" style={{ borderColor: activeTheme.border, backgroundColor: 'transparent', color: activeTheme.color }}><Icons.Settings />[ SETTINGS ]</button>
        </div>
      </header>

      {/* 2. 统计卡片 */}
      <div className="grid grid-cols-3 gap-3 mb-4 relative z-10">
        {[ {l: 'TOTAL', v: stats.total, c: activeTheme.color}, {l: 'UP_TREND', v: stats.up, c: activeTheme.up}, {l: 'DOWN_TREND', v: stats.down, c: activeTheme.down} ].map((s,i) => (
          <div key={i} className="p-3 border text-center" style={{ borderColor: activeTheme.border, backgroundColor: activeTheme.panelBg }}>
            <div className="text-2xl font-bold" style={{ color: s.c }}>{s.v}</div>
            <div className="text-[10px] opacity-50 tracking-tight">{s.l}</div>
          </div>
        ))}
      </div>

      {/* 3. AI 决策洞察 */}
      <div className="mb-4 border border-dashed p-3 relative z-10" style={{ borderColor: activeTheme.border, backgroundColor: activeTheme.panelBg }}>
        <div className="flex justify-between items-center gap-2 flex-wrap">
          <div className="text-xs font-bold cursor-pointer hover:text-blue-400" style={{ color: activeTheme.warn }} onClick={() => executeAi()}>&gt;_ EXECUTE_AI_INSIGHT</div>
          <div className="text-[10px] opacity-40 cursor-pointer hover:opacity-100" onClick={() => setAiState(s => ({...s, open: !s.open}))}>{aiState.open ? 'COLLAPSE [-]' : 'EXPAND [+]'}</div>
        </div>
        {aiState.open && (
          <div className="mt-3 text-xs border-t border-dashed pt-2 leading-relaxed max-h-48 overflow-y-auto">
            {aiState.loading ? <div className="animate-pulse text-blue-400">CONNECTING_REMOTE_LLM...</div> : <div className="whitespace-pre-wrap">{aiState.content || 'Ready. Awaiting command.'}</div>}
          </div>
        )}
      </div>

      {/* 4. Console 筛选控制台 (修正横排) */}
      <div className="mb-4 space-y-2 relative z-10">
        <div className="flex items-center px-3 py-1 border" style={{ borderColor: activeTheme.border, backgroundColor: activeTheme.panelBg }}>
          <span className="mr-2 opacity-50 text-blue-400">QUERY&gt;</span>
          <input className="w-full text-sm px-2 py-1 border outline-none" value={search} onChange={e=>setSearch(e.target.value)} placeholder="TICKER / ZH_NAME..." style={{color: activeTheme.color, backgroundColor: theme === 'dark' ? 'transparent' : '#fff', borderColor: activeTheme.border}} />
        </div>
        
        {/* 分类筛选横排 - 强制使用 flex-row 防止文字变竖 */}
        <div className="flex flex-row gap-2 overflow-x-auto hide-scroll pb-1">
          <TerminalBtn l="ALL_DATA" a={tab==='all'} onClick={()=>setTab('all')} />
          <TerminalBtn l="⭐ FAVS" a={tab==='fav'} onClick={()=>setTab('fav')} warn={activeTheme.warn} />
          <div className="w-px h-full mx-1 opacity-20 bg-white shrink-0" />
          {initCats.map(c => (
            <TerminalBtn key={c} l={c} a={catF===c} onClick={()=>setCatF(c)} />
          ))}
        </div>

        <div className="flex flex-row gap-2 overflow-x-auto hide-scroll pb-1">
          <TerminalBtn l="CHG:ALL" a={priceF==='ALL'} onClick={()=>setPriceF('ALL')} />
          <TerminalBtn l="UP_ONLY" a={priceF==='UP'} onClick={()=>setPriceF('UP')} />
          <TerminalBtn l="DOWN_ONLY" a={priceF==='DOWN'} onClick={()=>setPriceF('DOWN')} />
          <div className="w-px h-full mx-1 opacity-20 bg-white shrink-0" />
          <TerminalBtn l="+3%" a={priceF==='UP3'} onClick={()=>setPriceF(priceF==='UP3'?'ALL':'UP3')} warn={priceF==='UP3'?activeTheme.up:null} />
          <TerminalBtn l="-3%" a={priceF==='DOWN3'} onClick={()=>setPriceF(priceF==='DOWN3'?'ALL':'DOWN3')} warn={priceF==='DOWN3'?activeTheme.down:null} />
          <TerminalBtn l="+5%" a={priceF==='UP5'} onClick={()=>setPriceF(priceF==='UP5'?'ALL':'UP5')} warn={priceF==='UP5'?activeTheme.up:null} />
          <TerminalBtn l="-5%" a={priceF==='DOWN5'} onClick={()=>setPriceF(priceF==='DOWN5'?'ALL':'DOWN5')} warn={priceF==='DOWN5'?activeTheme.down:null} />
        </div>
      </div>

      {/* 5. 核心资产矩阵 (05:58 经典列表版式) */}
      <main className="flex-1 overflow-y-auto relative z-10 hide-scroll">
        <div className="grid grid-cols-12 gap-2 text-[10px] opacity-50 font-bold border-b pb-1 mb-2" style={{ borderColor: activeTheme.border }}>
          <div className="col-span-1"></div>
          <div className="col-span-5">SYMBOL</div>
          <div className="col-span-3 text-right">PRICE</div>
          <div className="col-span-3 text-right">CHANGE%</div>
        </div>
        <div className="grid grid-cols-12 gap-2 text-[10px] opacity-40 font-bold border-b pb-1 mb-2">
          <div className="col-span-1"></div>
          <div className="col-span-5 cursor-pointer hover:text-blue-400" onClick={() => handleSort('ticker')}>ASSET_IDENTIFIER{sortField === 'ticker' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</div>
          <div className="col-span-3 text-right cursor-pointer hover:text-blue-400" onClick={() => handleSort('price')}>PRICE{sortField === 'price' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</div>
          <div className="col-span-3 text-right cursor-pointer hover:text-blue-400" onClick={() => handleSort('chg')}>24H_CHG%{sortField === 'chg' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</div>
        </div>
        {filtered.map(e => {
          const c = parseFloat(e.chg);
          const isFlashing = rowFlash.has(e.id);
          return (
            <div key={e.id} 
              onMouseEnter={() => setHoveredChart(e.ticker)}
              onMouseLeave={() => setHoveredChart(null)}
              className={`grid grid-cols-12 gap-2 py-3 border-b border-dashed text-xs items-center relative ${isFlashing ? 'animate-pulse' : ''}`} 
              style={{ 
                borderColor: activeTheme.border,
                backgroundColor: isFlashing ? (c > 0 ? 'rgba(25,135,84,0.15)' : (c < 0 ? 'rgba(220,53,69,0.15)' : 'transparent')) : 'transparent'
              }}>
              <div className="col-span-1 flex items-center justify-center">
                <span onClick={()=>{setFavs(p=>{const n=new Set(p); n.has(e.id)?n.delete(e.id):n.add(e.id); return n;})}} style={{color: favs.has(e.id)?activeTheme.warn:activeTheme.border}} className="cursor-pointer active:scale-125 transition-transform"><Icons.Star f={favs.has(e.id)} /></span>
              </div>
              <div className="col-span-5 flex items-center gap-2 overflow-hidden">
                <span className="font-bold cursor-pointer hover:underline shrink-0" onClick={()=>window.open(`https://www.tradingview.com/chart/?symbol=${e.ticker}`)}>{e.ticker}</span>
                <span style={{color: activeTheme.dim}} className="text-[10px] truncate ml-1 opacity-70">{e.nameZh}</span>
              </div>
              <div className="col-span-3 text-right font-mono tracking-tighter">${e.price}</div>
              <div className="col-span-3 text-right font-bold pr-4" style={{ color: c > 0 ? activeTheme.up : (c < 0 ? activeTheme.down : activeTheme.dim) }}>
                {c > 0 ? '+' : ''}{e.chg}%
              </div>
            </div>
          );
        })}
      </main>

      {/* 6. Footer 状态行 */}
      <footer className="mt-2 p-2 border-t text-[10px] flex justify-between items-center opacity-60">
        <div className="flex gap-4">
          <span style={{color: activeTheme.up}}>[READY]</span>
          <span>LOG: {logs[logs.length-1].m}</span>
        </div>
        <div className="flex gap-4 items-center">
          <button onClick={() => {
            const url = new URL(window.location.href);
            if(filter !== 'ALL') url.searchParams.set('filter', filter);
            if(sortField !== 'chg') url.searchParams.set('sort', sortField + '_' + sortDir);
            navigator.clipboard.writeText(url.toString());
            setLogs(p => [...p, { t: new Date().toLocaleTimeString(), m: '[OK] 分享链接已复制！' }]);
          }} className="hover:underline cursor-pointer" title="复制分享链接">[{copySuccess ? 'COPIED' : 'SHARE'}]</button>
          <span>[Refresh: {refreshCountdown}s]</span>
          <span>{currentTime}</span>
        </div>
      </footer>

      {/* --- Modals (坚固实现，绝不白屏) --- */}
      {modal === 'settings' && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black bg-opacity-90 p-4">
          <div className="w-full max-w-md border-2 p-1 shadow-2xl" style={{ borderColor: activeTheme.color, backgroundColor: activeTheme.bg }}>
            <div className="flex justify-between items-center p-2 mb-2 font-bold text-xs" style={{ backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }}>
              <span>[ SYSTEM_CORE_CONFIG ]</span><button onClick={()=>setModal(null)} className="cursor-pointer"><Icons.X /></button>
            </div>
            <div className="p-4 space-y-4 text-xs overflow-y-auto max-h-[60vh] hide-scroll">
              <div className="p-3 border border-dashed" style={{borderColor: activeTheme.border}}>
                <div className="text-blue-400 mb-3 font-bold"># AI_MODELS_UPLINK</div>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {Object.keys(AI_PROVIDERS).map(p=>(
                    <button key={p} onClick={()=>setSettings({...settings, aiP: p})} className="p-1 border text-[10px]" style={{ borderColor: activeTheme.border, backgroundColor: settings.aiP===p ? activeTheme.color : 'transparent', color: settings.aiP===p ? activeTheme.bg : activeTheme.color }}>{AI_PROVIDERS[p].name}</button>
                  ))}
                </div>
                <ProviderSettings settings={settings} setSettings={setSettings} activeTheme={activeTheme} theme={theme} />
              </div>
              <div className="p-3 border border-dashed" style={{borderColor: activeTheme.border}}>
                <div className="text-red-500 mb-3 font-bold"># TELEGRAM_PUSH</div>
                <input type="password" placeholder="BOT_TOKEN" className="w-full border p-2 mb-2 outline-none" style={{borderColor: activeTheme.border, color: activeTheme.color, backgroundColor: theme === 'dark' ? '#000' : '#fff'}} value={settings.tgT} onChange={e=>setSettings({...settings, tgT: e.target.value})} />
                <input type="password" placeholder="CHAT_ID" className="w-full border p-2 mb-2 outline-none" style={{borderColor: activeTheme.border, color: activeTheme.color, backgroundColor: theme === 'dark' ? '#000' : '#fff'}} value={settings.tgC} onChange={e=>setSettings({...settings, tgC: e.target.value})} />
                <button 
                  onClick={async () => {
                    if (!settings.tgT || !settings.tgC) {
                      setLogs(p => [...p, { t: new Date().toLocaleTimeString(), m: '[WARN] 请先配置 Telegram。', type: 'warn' }]);
                      return;
                    }
                    try {
                      await fetch(`/api/telegram/set?token=${settings.tgT}&chat_id=${settings.tgC}`);
                      const res = await fetch('/api/telegram/send');
                      const data = await res.json();
                      if (data.sent) {
                        setLogs(p => [...p, { t: new Date().toLocaleTimeString(), m: '[OK] 测试消息已发送。' }]);
                      } else {
                        setLogs(p => [...p, { t: new Date().toLocaleTimeString(), m: '[ERR] 发送失败。', type: 'error' }]);
                      }
                    } catch (e) {
                      setLogs(p => [...p, { t: new Date().toLocaleTimeString(), m: '[ERR] 发送失败: ' + e.message, type: 'error' }]);
                    }
                  }}
                  className="w-full py-1 border text-xs mt-2"
                  style={{ borderColor: activeTheme.border, color: activeTheme.color }}
                >
                  [ 发送测试消息 ]
                </button>
              </div>
              <div className="p-3 border border-dashed" style={{borderColor: activeTheme.border}}>
                <div className="text-green-500 mb-3 font-bold"># 添加自定义ETF</div>
                <input placeholder="ETF代码 (如 AAPL)" className="w-full border p-2 mb-2 outline-none" style={{borderColor: activeTheme.border, color: activeTheme.color, backgroundColor: theme === 'dark' ? '#000' : '#fff'}} value={newEtf.symbol} onChange={e=>setNewEtf({...newEtf, symbol: e.target.value.toUpperCase()})} />
                <input placeholder="ETF名称" className="w-full border p-2 mb-2 outline-none" style={{borderColor: activeTheme.border, color: activeTheme.color, backgroundColor: theme === 'dark' ? '#000' : '#fff'}} value={newEtf.name} onChange={e=>setNewEtf({...newEtf, name: e.target.value})} />
                <select 
                  className="w-full border p-2 mb-2 outline-none"
                  style={{borderColor: activeTheme.border, color: activeTheme.color, backgroundColor: theme === 'dark' ? '#000' : '#fff'}}
                  value={newEtf.category} 
                  onChange={e=>setNewEtf({...newEtf, category: e.target.value})}
                >
                  <option value="">选择分类...</option>
                  {initCats.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                  <option value="Custom">+ 自定义分类</option>
                </select>
                {newEtf.category === 'Custom' && (
                  <input placeholder="输入自定义分类名称" className="w-full border p-2 mb-2 outline-none" style={{borderColor: activeTheme.border, color: activeTheme.color, backgroundColor: theme === 'dark' ? '#000' : '#fff'}} value={newEtf.customCategory || ''} onChange={e=>setNewEtf({...newEtf, customCategory: e.target.value})} />
                )}
                <button 
                  onClick={async () => {
                    if (!newEtf.symbol || !newEtf.name) {
                      setLogs(p => [...p, { t: new Date().toLocaleTimeString(), m: '[WARN] 请填写ETF代码和名称。', type: 'warn' }]);
                      return;
                    }
                    const category = newEtf.category === 'Custom' ? (newEtf.customCategory || 'Custom') : (newEtf.category || 'Custom');
                    try {
                      const res = await fetch(`/api/etf/add?symbol=${newEtf.symbol}&name=${newEtf.name}&category=${category}`);
                      const data = await res.json();
                      if (data.success) {
                        setLogs(p => [...p, { t: new Date().toLocaleTimeString(), m: '[OK] ' + data.message }]);
                        setNewEtf({symbol: '', name: '', category: 'Custom', customCategory: ''});
                        fetchRealData();
                      } else {
                        setLogs(p => [...p, { t: new Date().toLocaleTimeString(), m: '[ERR] ' + data.message, type: 'error' }]);
                      }
                    } catch (e) {
                      setLogs(p => [...p, { t: new Date().toLocaleTimeString(), m: '[ERR] 添加失败', type: 'error' }]);
                    }
                  }}
                  className="w-full py-1 border text-xs mt-2"
                  style={{ borderColor: activeTheme.border, color: activeTheme.color }}
                >
                  [ 添加ETF ]
                </button>
                <div className="p-3 border border-dashed mt-3" style={{borderColor: activeTheme.border}}>
                  <div className="text-purple-500 mb-3 font-bold"># 批量添加ETF (每行: 代码|名称|分类)</div>
                  <textarea 
                    placeholder="AAPL|苹果公司|美股\nMSFT|微软|美股\nGOOGL|谷歌|美股" 
                    className="w-full border p-2 mb-2 outline-none text-xs h-24 font-mono"
                    style={{borderColor: activeTheme.border, color: activeTheme.color, backgroundColor: theme === 'dark' ? '#000' : '#fff'}}
                    value={newEtfBatch}
                    onChange={e=>setNewEtfBatch(e.target.value)}
                  />
                  <button 
                    onClick={async () => {
                      if (!newEtfBatch.trim()) {
                        setLogs(p => [...p, { t: new Date().toLocaleTimeString(), m: '[WARN] 请输入ETF数据。', type: 'warn' }]);
                        return;
                      }
                      const lines = newEtfBatch.trim().split('\n');
                      let success = 0, fail = 0;
                      for (const line of lines) {
                        const parts = line.split('|');
                        if (parts.length >= 2) {
                          const symbol = parts[0].trim().toUpperCase();
                          const name = parts[1].trim();
                          const category = parts[2]?.trim() || 'Custom';
                          try {
                            const res = await fetch(`/api/etf/add?symbol=${symbol}&name=${encodeURIComponent(name)}&category=${encodeURIComponent(category)}`);
                            const data = await res.json();
                            if (data.success) success++;
                            else fail++;
                          } catch (e) { fail++; }
                        } else { fail++; }
                      }
                      setLogs(p => [...p, { t: new Date().toLocaleTimeString(), m: `[OK] 批量添加: 成功${success}个, 失败${fail}个` }]);
                      setNewEtfBatch('');
                      fetchRealData();
                    }}
                    className="w-full py-1 border text-xs"
                    style={{ borderColor: activeTheme.border, color: activeTheme.color }}
                  >
                    [ 批量添加 ]
                  </button>
                </div>
              </div>
            </div>
            <div className="p-2"><button onClick={async () => {
    // 保存设置到 localStorage
    safeStorage.set(CACHE_KEY_SETTINGS, settings);
    
    // 配置 Telegram
    if (settings.tgT && settings.tgC) {
      try {
        await fetch(`/api/telegram/set?token=${settings.tgT}&chat_id=${settings.tgC}`);
      } catch (e) {
        console.log('Telegram config error:', e);
      }
    }
    
    setModal(null);
    setLogs(p => [...p, { t: new Date().toLocaleTimeString(), m: '[OK] 设置已保存。' }]);
  }} className="w-full py-3 font-bold transition-all cursor-pointer" style={{ backgroundColor: activeTheme.color, color: activeTheme.bg }}>COMMIT_AND_SAVE</button></div>
          </div>
        </div>
      )}

      {modal === 'export' && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black bg-opacity-90 p-4">
          <div className="w-full max-w-lg border-2 p-1 shadow-2xl" style={{ borderColor: activeTheme.color, backgroundColor: activeTheme.bg }}>
            <div className="flex justify-between items-center p-2 mb-2 font-bold text-xs" style={{ backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }}>
              <span>[ EXPORT_SUBROUTINE ]</span><button onClick={()=>setModal(null)} className="cursor-pointer"><Icons.X /></button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {[ {k: 'ticker', l: 'Symbol'}, {k: 'name', l: 'Chinese'}, {k: 'cat', l: 'Category'}, {k: 'price', l: 'Price'}, {k: 'chg', l: 'Change%'} ].map(f => (
                  <div key={f.k} className="flex justify-between text-[11px] cursor-pointer" onClick={()=>setExportCfg(prev=>({...prev, fields:{...prev.fields, [f.k]:!prev.fields[f.k]}}))}>
                    <span>{f.l}</span><span style={{color: exportCfg.fields[f.k] ? activeTheme.up : activeTheme.dim}}>[{exportCfg.fields[f.k] ? 'X' : ' '}]</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                {['txt', 'md', 'csv'].map(fmt => (
                  <button key={fmt} onClick={()=>setExportCfg(p=>({...p, format:fmt}))} className="px-3 py-1 border text-[10px]" style={{borderColor: activeTheme.border, backgroundColor: exportCfg.format===fmt?activeTheme.color:'transparent', color: exportCfg.format===fmt?activeTheme.bg:activeTheme.color}}>.{fmt.toUpperCase()}</button>
                ))}
              </div>
              <div className="border p-3 text-[9px] h-40 overflow-auto whitespace-pre font-mono" style={{ borderColor: activeTheme.border, color: activeTheme.color, backgroundColor: theme === 'dark' ? '#000' : '#f8f9fa' }}>
                {generateExportText()}
              </div>
              <button onClick={() => {
                const text = generateExportText();
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                try {
                  document.execCommand('copy');
                  setCopySuccess(true);
                  setTimeout(() => setCopySuccess(false), 2000);
                } catch (e) {
                  setLogs(p => [...p, { t: new Date().toLocaleTimeString(), m: '[ERR] 复制失败', type: 'error' }]);
                }
                document.body.removeChild(textarea);
              }} className="w-full py-3 font-bold border text-sm" style={{ borderColor: activeTheme.color, backgroundColor: activeTheme.color, color: activeTheme.bg }}>
                {copySuccess ? '>>> COPIED_SUCCESS <<<' : 'EXECUTE_COPY_TO_CLIPBOARD'}
              </button>
              <button onClick={() => {
                const text = generateExportText();
                const ext = exportCfg.format === 'csv' ? 'csv' : (exportCfg.format === 'md' ? 'md' : 'txt');
                const blob = new Blob([text], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `etf_export_${new Date().toISOString().slice(0,10)}.${ext}`;
                a.click();
                URL.revokeObjectURL(url);
              }} className="w-full py-2 border text-xs mt-2" style={{ borderColor: activeTheme.border, color: activeTheme.color }}>
                ↓ DOWNLOAD_FILE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

