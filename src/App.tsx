import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, BarChart, Bar, Cell
} from 'recharts';
import { 
  Plus, TrendingUp, TrendingDown, Calendar as CalendarIcon, 
  BarChart3, LayoutDashboard, History, Trash2, X, ChevronLeft, ChevronRight,
  Wallet, Target, AlertCircle, Filter, Image as ImageIcon, MessageSquare,
  Pencil, Moon, Sun, Upload, Info
} from 'lucide-react';
import Papa from 'papaparse';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';
import { cn } from './lib/utils';
import { Trade, Stats, Account, Strategy, Trigger } from './types';

import { PnLCalendar } from './components/PnLCalendar';

export default function App() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'accounts' | 'strategies' | 'analytics'>('dashboard');
  const [calendarView, setCalendarView] = useState<'day' | 'week' | 'month'>('month');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isStrategyModalOpen, setIsStrategyModalOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editingStrategy, setEditingStrategy] = useState<Strategy | null>(null);
  const [strategyEntryTriggers, setStrategyEntryTriggers] = useState<Trigger[]>([]);
  const [strategyExitTriggers, setStrategyExitTriggers] = useState<Trigger[]>([]);
  const [strategyHasCandlestick, setStrategyHasCandlestick] = useState(false);

  const [tradeExecutedEntryTriggers, setTradeExecutedEntryTriggers] = useState<Record<string, string>>({});
  const [tradeExecutedExitTriggers, setTradeExecutedExitTriggers] = useState<Record<string, string>>({});
  const [tradeCandlestickUsed, setTradeCandlestickUsed] = useState('');
  const [tradeShowCandlestick, setTradeShowCandlestick] = useState(false);
  const [selectedStrategyId, setSelectedStrategyId] = useState<number | null>(null);
  const [selectedImportAccountId, setSelectedImportAccountId] = useState<string>('');
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [infoModal, setInfoModal] = useState<{ title: string; text: React.ReactNode } | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Filters
  const [filterType, setFilterType] = useState<'ALL' | 'LONG' | 'SHORT'>('ALL');
  const [filterInstrument, setFilterInstrument] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterAccount, setFilterAccount] = useState<string>('ALL');
  const [filterStrategy, setFilterStrategy] = useState<string>('ALL');

  useEffect(() => {
    fetchTrades();
    fetchAccounts();
    fetchStrategies();
  }, []);

  useEffect(() => {
    if (editingStrategy) {
      try {
        setStrategyEntryTriggers(JSON.parse(editingStrategy.entry_triggers || '[]'));
        setStrategyExitTriggers(JSON.parse(editingStrategy.exit_triggers || '[]'));
      } catch (e) {
        setStrategyEntryTriggers([]);
        setStrategyExitTriggers([]);
      }
      setStrategyHasCandlestick(editingStrategy.has_candlestick);
    } else {
      setStrategyEntryTriggers([]);
      setStrategyExitTriggers([]);
      setStrategyHasCandlestick(false);
    }
  }, [editingStrategy]);

  useEffect(() => {
    if (editingTrade) {
      try {
        setTradeExecutedEntryTriggers(JSON.parse(editingTrade.executed_entry_triggers || '{}'));
        setTradeExecutedExitTriggers(JSON.parse(editingTrade.executed_exit_triggers || '{}'));
      } catch (e) {
        setTradeExecutedEntryTriggers({});
        setTradeExecutedExitTriggers({});
      }
      setTradeCandlestickUsed(editingTrade.candlestick_used || '');
      setTradeShowCandlestick(!!editingTrade.candlestick_used);
      setSelectedStrategyId(editingTrade.strategy_id);
    } else {
      setTradeExecutedEntryTriggers({});
      setTradeExecutedExitTriggers({});
      setTradeCandlestickUsed('');
      setTradeShowCandlestick(false);
      setSelectedStrategyId(null);
    }
  }, [editingTrade]);

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedImportAccountId) return;

    const sanitizeNumber = (val: string | undefined): number => {
      if (!val) return 0;
      // Remove $, €, spaces and replace , with .
      const clean = val.toString().replace(/[$\s€]/g, '').replace(',', '.');
      return parseFloat(clean) || 0;
    };

    const sanitizeType = (val: string | undefined): 'LONG' | 'SHORT' | null => {
      if (!val) return null;
      const upper = val.toString().toUpperCase();
      if (upper.includes('BUY')) return 'LONG';
      if (upper.includes('SELL')) return 'SHORT';
      return null;
    };

    const sanitizeDate = (val: string | undefined): string => {
      if (!val) return format(new Date(), 'yyyy-MM-dd');
      
      // Handle DD/MM/YY or DD/MM/YYYY
      const parts = val.toString().split('/');
      if (parts.length === 3) {
        let day = parts[0].padStart(2, '0');
        let month = parts[1].padStart(2, '0');
        let year = parts[2];
        
        if (year.length === 2) {
          year = '20' + year; // Assume 20xx
        }
        
        return `${year}-${month}-${day}`;
      }
      
      return val; // Fallback to original if format is unknown
    };

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const data = results.data as any[];
        
        const accountId = parseInt(selectedImportAccountId);
        let importedCount = 0;

        for (const row of data) {
          try {
            // Mandatory field validation
            if (!row['Tiker'] || !row['Tipe']) {
              console.warn("Skipping row due to missing mandatory fields:", row);
              continue;
            }

            const type = sanitizeType(row['Tipe']);
            if (!type) {
              console.warn("Skipping row due to invalid type:", row['Tipe']);
              continue;
            }

            const buyPrice = sanitizeNumber(row['Buy Price']);
            const sellPrice = sanitizeNumber(row['Sell Price']);
            
            const entryPrice = type === 'LONG' ? buyPrice : sellPrice;
            const exitPrice = type === 'LONG' ? sellPrice : buyPrice;

            const strategyName = row['Operativa'];
            const strategy = strategies.find(s => s.name.toLowerCase() === strategyName?.toLowerCase());
            const strategyId = strategy ? strategy.id : null;

            const tradeData = {
              account_id: accountId,
              strategy_id: strategyId,
              instrument: row['Tiker'].toString().trim(),
              entry_date: sanitizeDate(row['Date']),
              entry_time: '00:00',
              lots: sanitizeNumber(row['Nº Shares']) / 100,
              entry_price: entryPrice,
              exit_price: exitPrice > 0 ? exitPrice : null,
              sl: null,
              tp: null,
              type: type,
              comments: row['Notes'] || '',
              executed_entry_triggers: '{}',
              executed_exit_triggers: '{}',
              candlestick_used: null,
              image_url: null
            };

            await fetch('/api/trades', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(tradeData),
            });
            importedCount++;
          } catch (err) {
            console.error("Error importing row:", row, err);
          }
        }
        
        fetchTrades();
        alert(`Importación completada: ${importedCount} operaciones procesadas en la cuenta seleccionada.`);
        // Reset input
        e.target.value = '';
      }
    });
  };

  const fetchTrades = async () => {
    const res = await fetch('/api/trades');
    const data = await res.json();
    setTrades(data);
  };

  const fetchAccounts = async () => {
    const res = await fetch('/api/accounts');
    const data = await res.json();
    setAccounts(data);
  };

  const fetchStrategies = async () => {
    const res = await fetch('/api/strategies');
    const data = await res.json();
    setStrategies(data);
  };

  const addTrade = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const tradeData = Object.fromEntries(formData.entries());
    
    // Handle image upload (convert to base64)
    let imageUrl = null;
    const imageFile = (e.currentTarget.elements.namedItem('image') as HTMLInputElement)?.files?.[0];
    if (imageFile) {
      imageUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(imageFile);
      });
    }

    const url = editingTrade ? `/api/trades/${editingTrade.id}` : '/api/trades';
    const method = editingTrade ? 'PUT' : 'POST';

        await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...tradeData,
        account_id: tradeData.account_id ? parseInt(tradeData.account_id as string) : null,
        strategy_id: tradeData.strategy_id ? parseInt(tradeData.strategy_id as string) : null,
        lots: parseFloat(tradeData.lots as string) / 100,
        entry_price: parseFloat(tradeData.entry_price as string),
        exit_price: tradeData.exit_price ? parseFloat(tradeData.exit_price as string) : null,
        sl: tradeData.sl ? parseFloat(tradeData.sl as string) : null,
        tp: tradeData.tp ? parseFloat(tradeData.tp as string) : null,
        riesgo_asumido_porcentaje: tradeData.riesgo_asumido_porcentaje ? parseFloat(tradeData.riesgo_asumido_porcentaje as string) : null,
        beneficio_obtenido_porcentaje: tradeData.beneficio_obtenido_porcentaje ? parseFloat(tradeData.beneficio_obtenido_porcentaje as string) : null,
        mae: tradeData.mae ? parseFloat(tradeData.mae as string) : null,
        mfe: tradeData.mfe ? parseFloat(tradeData.mfe as string) : null,
        riesgo_asumido_dinero: tradeData.riesgo_asumido_dinero ? parseFloat(tradeData.riesgo_asumido_dinero as string) : null,
        executed_entry_triggers: JSON.stringify(tradeExecutedEntryTriggers),
        executed_exit_triggers: JSON.stringify(tradeExecutedExitTriggers),
        candlestick_used: tradeShowCandlestick ? tradeCandlestickUsed : null,
        image_url: imageUrl || (editingTrade ? editingTrade.image_url : null),
      }),
    });
    
    setIsModalOpen(false);
    setEditingTrade(null);
    fetchTrades();
  };

  const addAccount = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const accountData = Object.fromEntries(formData.entries());

    const url = editingAccount ? `/api/accounts/${editingAccount.id}` : '/api/accounts';
    const method = editingAccount ? 'PUT' : 'POST';

    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...accountData,
        capital: parseFloat(accountData.capital as string),
        profit_target: accountData.profit_target ? parseFloat(accountData.profit_target as string) : null,
        loss_limit: accountData.loss_limit ? parseFloat(accountData.loss_limit as string) : null,
      }),
    });

    setIsAccountModalOpen(false);
    setEditingAccount(null);
    fetchAccounts();
  };

  const deleteAccount = async (id: number) => {
    await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
    fetchAccounts();
  };

  const addStrategy = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const strategyData = Object.fromEntries(formData.entries());

    const url = editingStrategy ? `/api/strategies/${editingStrategy.id}` : '/api/strategies';
    const method = editingStrategy ? 'PUT' : 'POST';

    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: strategyData.name,
        entry_triggers: JSON.stringify(strategyEntryTriggers),
        exit_triggers: JSON.stringify(strategyExitTriggers),
        has_candlestick: strategyHasCandlestick
      }),
    });

    setIsStrategyModalOpen(false);
    setEditingStrategy(null);
    setStrategyEntryTriggers([]);
    setStrategyExitTriggers([]);
    setStrategyHasCandlestick(false);
    fetchStrategies();
  };

  const addEntryTrigger = () => {
    setStrategyEntryTriggers([...strategyEntryTriggers, { indicator: '', operator: '>', value: 0 }]);
  };

  const removeEntryTrigger = (index: number) => {
    setStrategyEntryTriggers(strategyEntryTriggers.filter((_, i) => i !== index));
  };

  const updateEntryTrigger = (index: number, field: keyof Trigger, value: any) => {
    const newTriggers = [...strategyEntryTriggers];
    newTriggers[index] = { ...newTriggers[index], [field]: value };
    setStrategyEntryTriggers(newTriggers);
  };

  const addExitTrigger = () => {
    setStrategyExitTriggers([...strategyExitTriggers, { indicator: '', operator: '>', value: 0 }]);
  };

  const removeExitTrigger = (index: number) => {
    setStrategyExitTriggers(strategyExitTriggers.filter((_, i) => i !== index));
  };

  const updateExitTrigger = (index: number, field: keyof Trigger, value: any) => {
    const newTriggers = [...strategyExitTriggers];
    newTriggers[index] = { ...newTriggers[index], [field]: value };
    setStrategyExitTriggers(newTriggers);
  };

  const deleteStrategy = async (id: number) => {
    await fetch(`/api/strategies/${id}`, { method: 'DELETE' });
    fetchStrategies();
  };

  const deleteTrade = async (id: number) => {
    await fetch(`/api/trades/${id}`, { method: 'DELETE' });
    fetchTrades();
  };

  const getFilteredTrades = () => {
    return trades.filter(t => {
      const matchType = filterType === 'ALL' || t.type === filterType;
      const matchInstrument = t.instrument.toLowerCase().includes(filterInstrument.toLowerCase());
      const matchDate = !filterDate || t.entry_date === filterDate;
      const matchAccount = filterAccount === 'ALL' || t.account_id === parseInt(filterAccount);
      const matchStrategy = filterStrategy === 'ALL' || t.strategy_id === parseInt(filterStrategy);
      return matchType && matchInstrument && matchDate && matchAccount && matchStrategy;
    });
  };

  const calculateStats = (): Stats => {
    const filteredTrades = getFilteredTrades();
    const closedTrades = filteredTrades.filter(t => t.status !== 'OPEN');
    if (closedTrades.length === 0) return { winRate: 0, avgWin: 0, avgLoss: 0, avgProfit: 0, avgRR: 0, totalProfit: 0, totalTrades: 0 };

    const wins = closedTrades.filter(t => t.status === 'WIN');
    const losses = closedTrades.filter(t => t.status === 'LOSS');
    const totalProfit = closedTrades.reduce((acc, t) => acc + t.profit, 0);
    
    const avgWin = wins.length > 0
      ? wins.reduce((acc, t) => acc + t.profit, 0) / wins.length
      : 0;

    const avgLoss = losses.length > 0 
      ? Math.abs(losses.reduce((acc, t) => acc + t.profit, 0) / losses.length)
      : 0;

    const avgProfit = closedTrades.length > 0
      ? totalProfit / closedTrades.length
      : 0;

    // Simplified RR calculation: (TP - Entry) / (Entry - SL)
    const rrRatios = closedTrades
      .filter(t => t.sl && t.tp)
      .map(t => {
        const risk = Math.abs(t.entry_price - (t.sl || 0));
        const reward = Math.abs((t.tp || 0) - t.entry_price);
        return risk > 0 ? reward / risk : 0;
      });
    
    const avgRR = rrRatios.length > 0 
      ? rrRatios.reduce((acc, r) => acc + r, 0) / rrRatios.length 
      : 0;

    return {
      winRate: (wins.length / closedTrades.length) * 100,
      avgWin,
      avgLoss,
      avgProfit,
      avgRR,
      totalProfit,
      totalTrades: closedTrades.length
    };
  };

  const getChartData = () => {
    const filteredTrades = getFilteredTrades();
    const selectedAccount = accounts.find(a => a.id === parseInt(filterAccount));
    
    let startBalance = 0;
    if (selectedAccount) {
      startBalance = selectedAccount.capital;
    } else if (filterAccount === 'ALL') {
      startBalance = accounts.reduce((acc, a) => acc + a.capital, 0);
    }

    // Group trades by date and sum profits
    const tradesByDate: { [key: string]: number } = {};
    filteredTrades.forEach(t => {
      if (t.status !== 'OPEN') {
        // Use the date string directly to avoid timezone issues
        tradesByDate[t.entry_date] = (tradesByDate[t.entry_date] || 0) + t.profit;
      }
    });

    // Sort dates chronologically
    const sortedDates = Object.keys(tradesByDate).sort();

    let currentBalance = startBalance;
    const data = [
      { date: 'Inicio', balance: startBalance }
    ];

    sortedDates.forEach(date => {
      currentBalance += tradesByDate[date];
      // Format date for display (DD/MM)
      const [year, month, day] = date.split('-');
      data.push({
        date: `${day}/${month}`,
        balance: parseFloat(currentBalance.toFixed(2))
      });
    });

    return data;
  };

  const getTimeSlotData = () => {
    const slots: Record<string, { total: number, wins: number, pnl: number }> = {};
    
    trades.forEach(t => {
      if (!t.entry_time || t.status === 'OPEN') return;
      
      const hour = parseInt(t.entry_time.split(':')[0]);
      if (isNaN(hour)) return;
      
      const slotKey = `${hour.toString().padStart(2, '0')}:00 - ${(hour + 1).toString().padStart(2, '0')}:00`;
      
      if (!slots[slotKey]) {
        slots[slotKey] = { total: 0, wins: 0, pnl: 0 };
      }
      
      slots[slotKey].total += 1;
      if (t.status === 'WIN') slots[slotKey].wins += 1;
      slots[slotKey].pnl += t.profit;
    });
    
    return Object.entries(slots)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([slot, data]) => ({
        slot,
        total: data.total,
        wins: data.wins,
        pnl: data.pnl,
        winRate: (data.wins / data.total) * 100,
        avgProfit: data.pnl / data.total
      }));
  };

  const getRMultipleData = () => {
    const validTrades = trades.filter(t => {
    // Buscamos el riesgo ya sea en porcentaje o en dinero. Si no hay, lo descartamos.
    const risk = Number(t.riesgo_asumido_porcentaje) || Number(t.riesgo_asumido_dinero) || 0;
    return risk > 0;
  });

  const tradesWithR = validTrades.map(t => {
    const risk = Number(t.riesgo_asumido_porcentaje) || Number(t.riesgo_asumido_dinero);
    const profit = Number(t.profit) || 0;
    return {
      ...t,
      rMultiple: profit / risk
    };
  }).sort((a, b) => {
    const dateA = new Date(`${a.entry_date}T${a.entry_time || '00:00:00'}`);
    const dateB = new Date(`${b.entry_date}T${b.entry_time || '00:00:00'}`);
    return dateA.getTime() - dateB.getTime();
  });

    // Distribution
    const distribution = [
      { range: '< -1R', count: 0, color: '#ef4444' },
      { range: '-1R a 0R', count: 0, color: '#f87171' },
      { range: '0R a +1R', count: 0, color: '#4ade80' },
      { range: '+1R a +2R', count: 0, color: '#22c55e' },
      { range: '> +2R', count: 0, color: '#15803d' }
    ];

    tradesWithR.forEach(t => {
      if (t.rMultiple < -1) distribution[0].count++;
      else if (t.rMultiple < 0) distribution[1].count++;
      else if (t.rMultiple < 1) distribution[2].count++;
      else if (t.rMultiple < 2) distribution[3].count++;
      else distribution[4].count++;
    });

    // Cumulative
    let cumulative = 0;
    const cumulativeData = tradesWithR.map((t, index) => {
      cumulative += t.rMultiple;
      return {
        index: index + 1,
        cumulativeR: parseFloat(cumulative.toFixed(2)),
        date: t.entry_date
      };
    });

    // Expectation: (Win Rate * Avg Win R) - (Loss Rate * Avg Loss R)
    const winners = tradesWithR.filter(t => t.rMultiple > 0);
    const losers = tradesWithR.filter(t => t.rMultiple <= 0);
    
    const winRate = tradesWithR.length > 0 ? winners.length / tradesWithR.length : 0;
    const lossRate = 1 - winRate;
    const avgWinR = winners.length > 0 ? winners.reduce((acc, t) => acc + t.rMultiple, 0) / winners.length : 0;
    const avgLossR = losers.length > 0 ? Math.abs(losers.reduce((acc, t) => acc + t.rMultiple, 0) / losers.length) : 0;
    
    const expectation = (winRate * avgWinR) - (lossRate * avgLossR);

    return { distribution, cumulativeData, expectation };
  };

  const getMaxDrawdown = () => {
    const closedTrades = trades
      .filter(t => t.status !== 'OPEN')
      .sort((a, b) => {
        const dateA = new Date(`${a.entry_date}T${a.entry_time || '00:00:00'}`);
        const dateB = new Date(`${b.entry_date}T${b.entry_time || '00:00:00'}`);
        return dateA.getTime() - dateB.getTime();
      });

    if (closedTrades.length === 0) return 0;

    let currentEquity = 0;
    let peak = 0;
    let maxDD = 0;

    closedTrades.forEach(t => {
      currentEquity += (t.profit || 0);
      if (currentEquity > peak) {
        peak = currentEquity;
      }
      const dd = peak - currentEquity;
      if (dd > maxDD) {
        maxDD = dd;
      }
    });

    return maxDD;
  };

  const getExpectancyData = () => {
    const closedTrades = trades.filter(t => t.status !== 'OPEN');
    if (closedTrades.length === 0) return 0;

    const winners = closedTrades.filter(t => (t.profit || 0) > 0);
    const losers = closedTrades.filter(t => (t.profit || 0) < 0);

    const winRate = winners.length / closedTrades.length;
    const lossRate = losers.length / closedTrades.length;

    const avgWin = winners.length > 0 
      ? winners.reduce((acc, t) => acc + (t.profit || 0), 0) / winners.length 
      : 0;
    const avgLoss = losers.length > 0 
      ? Math.abs(losers.reduce((acc, t) => acc + (t.profit || 0), 0) / losers.length) 
      : 0;

    return (winRate * avgWin) - (lossRate * avgLoss);
  };

  const getPayoffData = () => {
    const closedTrades = trades.filter(t => t.status !== 'OPEN');
    const winners = closedTrades.filter(t => (t.profit || 0) > 0);
    const losers = closedTrades.filter(t => (t.profit || 0) < 0);

    const avgWin = winners.length > 0 
      ? winners.reduce((acc, t) => acc + (t.profit || 0), 0) / winners.length 
      : 0;
    const avgLoss = losers.length > 0 
      ? Math.abs(losers.reduce((acc, t) => acc + (t.profit || 0), 0) / losers.length) 
      : 0;

    const payoff = avgLoss > 0 ? avgWin / avgLoss : (winners.length > 0 ? 99.99 : 0);

    return { avgWin, avgLoss, payoff };
  };

  const calculateStandardDeviation = (values: number[]) => {
    if (values.length === 0) return 0;
    const mean = values.reduce((acc, val) => acc + val, 0) / values.length;
    const squareDiffs = values.map(val => Math.pow(val - mean, 2));
    const avgSquareDiff = squareDiffs.reduce((acc, val) => acc + val, 0) / values.length;
    return Math.sqrt(avgSquareDiff);
  };

  const getRiskAdjustedRatios = () => {
    const closedTrades = trades.filter(t => t.status !== 'OPEN');
    if (closedTrades.length === 0) return { sharpe: 0, sortino: 0 };

    const returns = closedTrades.map(t => t.profit || 0);
    const avgReturn = returns.reduce((acc, val) => acc + val, 0) / returns.length;
    
    const stdDev = calculateStandardDeviation(returns);
    const sharpe = stdDev > 0 ? avgReturn / stdDev : 0;

    const negativeReturns = returns.filter(r => r < 0);
    const downsideDev = calculateStandardDeviation(negativeReturns);
    const sortino = downsideDev > 0 ? avgReturn / downsideDev : 0;

    return { sharpe, sortino };
  };

  const stats = calculateStats();
  const chartData = getChartData();
  const timeSlotData = getTimeSlotData();
  const rMultipleData = getRMultipleData();
  const payoffData = getPayoffData();
  const riskAdjustedRatios = getRiskAdjustedRatios();
  const maxDrawdown = getMaxDrawdown();
  const expectancy = getExpectancyData();

  return (
    <div className={cn(
      "min-h-screen font-sans transition-colors duration-300",
      isDarkMode ? "bg-[#18181B] text-white" : "bg-[#F3F4F6] text-[#1A1A1A]"
    )}>
      {/* Sidebar */}
      <nav className={cn(
        "fixed left-0 top-0 h-full w-20 border-r flex flex-col items-center py-8 gap-8 z-40 transition-colors duration-300",
        isDarkMode 
          ? "bg-[#1F2937] border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.05)]" 
          : "bg-white border-gray-200"
      )}>
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
          <TrendingUp size={24} />
        </div>
        
        <div className="flex flex-col gap-4">
          <NavButton 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')}
            icon={<LayoutDashboard size={22} />}
            label="Dashboard"
            isDarkMode={isDarkMode}
          />
          <NavButton 
            active={activeTab === 'history'} 
            onClick={() => setActiveTab('history')}
            icon={<History size={22} />}
            label="Historial"
            isDarkMode={isDarkMode}
          />
          <NavButton 
            active={activeTab === 'accounts'} 
            onClick={() => setActiveTab('accounts')}
            icon={<Wallet size={22} />}
            label="Cuentas"
            isDarkMode={isDarkMode}
          />
          <NavButton 
            active={activeTab === 'strategies'} 
            onClick={() => setActiveTab('strategies')}
            icon={<Target size={22} />}
            label="Estrategias"
            isDarkMode={isDarkMode}
          />
          <NavButton 
            active={activeTab === 'analytics'} 
            onClick={() => setActiveTab('analytics')}
            icon={<BarChart3 size={22} />}
            label="Análisis"
            isDarkMode={isDarkMode}
          />
        </div>

        <div className="mt-auto flex flex-col gap-6 items-center">
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={cn(
              "p-3 rounded-xl transition-all",
              isDarkMode ? "bg-white/5 text-yellow-400 hover:bg-white/10" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {isDarkMode ? <Sun size={22} /> : <Moon size={22} />}
          </button>

          <button 
            onClick={() => setIsModalOpen(true)}
            className={cn(
              "w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center text-white hover:scale-110 transition-transform shadow-lg",
              isDarkMode ? "shadow-white/5" : "shadow-indigo-200"
            )}
          >
            <Plus size={24} />
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pl-20 min-h-screen">
        <div className="max-w-[1600px] mx-auto p-8 w-full">
          <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 sm:gap-0">
          <div>
            <h1 className={cn("text-3xl font-bold tracking-tight", isDarkMode ? "text-white" : "text-[#1A1A1A]")}>TradeFlow</h1>
            <p className={cn("mt-1", isDarkMode ? "text-gray-400" : "text-gray-500")}>Examina y mejora tu operativa</p>
          </div>
          <div className="text-left sm:text-right">
            <p className={cn("text-sm uppercase tracking-wider font-semibold", isDarkMode ? "text-gray-500" : "text-gray-400")}>Balance Filtrado</p>
            <p className={cn(
              "text-2xl font-mono font-bold",
              stats.totalProfit >= 0 ? "text-[#508E48]" : "text-[#FB7185]"
            )}>
              {stats.totalProfit >= 0 ? '+' : ''}{stats.totalProfit.toFixed(2)} USD
            </p>
          </div>
        </header>

        {/* Global Filters Bar - Visible on Dashboard and History */}
        {(activeTab === 'dashboard' || activeTab === 'history') && (
          <div className={cn(
            "p-5 rounded-2xl border flex flex-wrap gap-x-8 gap-y-6 items-end mb-8 transition-all duration-300",
            isDarkMode 
              ? "bg-[#1F2937] border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.03)]" 
              : "bg-white border-gray-100 shadow-sm"
          )}>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Cuenta</label>
              <select 
                value={filterAccount}
                onChange={(e) => setFilterAccount(e.target.value)}
                className={cn(
                  "px-3 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 min-w-[160px] transition-colors",
                  isDarkMode ? "bg-[#1F2937] border-white/10 text-white" : "bg-gray-50 border-gray-100"
                )}
              >
                <option value="ALL" className={isDarkMode ? "bg-[#1F2937] text-white" : ""}>Todas las cuentas</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id} className={isDarkMode ? "bg-[#1F2937] text-white" : ""}>{acc.name || acc.account_id}</option>
                ))}
              </select>
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Instrumento</label>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input 
                  value={filterInstrument}
                  onChange={(e) => setFilterInstrument(e.target.value)}
                  placeholder="Filtrar..."
                  className={cn(
                    "pl-9 pr-4 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 w-36 transition-colors",
                    isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-gray-50 border-gray-100"
                  )}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Tipo</label>
              <select 
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className={cn(
                  "px-3 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 min-w-[100px] transition-colors",
                  isDarkMode ? "bg-[#1F2937] border-white/10 text-white" : "bg-gray-50 border-gray-100"
                )}
              >
                <option value="ALL" className={isDarkMode ? "bg-[#1F2937] text-white" : ""}>Todos</option>
                <option value="LONG" className={isDarkMode ? "bg-[#1F2937] text-white" : ""}>Long</option>
                <option value="SHORT" className={isDarkMode ? "bg-[#1F2937] text-white" : ""}>Short</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Fecha</label>
              <input 
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className={cn(
                  "px-3 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-colors",
                  isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-gray-50 border-gray-100"
                )}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Estrategia</label>
              <select 
                value={filterStrategy}
                onChange={(e) => setFilterStrategy(e.target.value)}
                className={cn(
                  "px-3 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 min-w-[160px] transition-colors",
                  isDarkMode ? "bg-[#1F2937] border-white/10 text-white" : "bg-gray-50 border-gray-100"
                )}
              >
                <option value="ALL" className={isDarkMode ? "bg-[#1F2937] text-white" : ""}>Todas las estrategias</option>
                {strategies.map(s => (
                  <option key={s.id} value={s.id} className={isDarkMode ? "bg-[#1F2937] text-white" : ""}>{s.name}</option>
                ))}
              </select>
            </div>

            <button 
              onClick={() => { setFilterInstrument(''); setFilterType('ALL'); setFilterDate(''); setFilterAccount('ALL'); setFilterStrategy('ALL'); }}
              className={cn(
                "px-4 py-2 text-sm font-bold h-[38px] transition-colors ml-auto",
                isDarkMode ? "text-gray-500 hover:text-white" : "text-gray-400 hover:text-gray-700"
              )}
            >
              LIMPIAR
            </button>
          </div>
        )}

        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
                <StatCard label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} sub="Tasa de acierto" color="indigo" isDarkMode={isDarkMode} />
                <StatCard label="Ratio RR" value={`1:${stats.avgRR.toFixed(2)}`} sub="Riesgo/Beneficio Promedio" color="emerald" isDarkMode={isDarkMode} />
                <StatCard label="Ganancia Promedio" value={`${stats.avgWin.toFixed(2)}`} sub="USD por trade ganado" color="emerald" isDarkMode={isDarkMode} />
                <StatCard label="Pérdida Promedio" value={`${stats.avgLoss.toFixed(2)}`} sub="USD por trade fallido" color="rose" isDarkMode={isDarkMode} />
                <StatCard label="Expectativa" value={`${stats.avgProfit.toFixed(2)}`} sub="Ganancia promedio total" color="emerald" isDarkMode={isDarkMode} />
                <StatCard label="Total Trades" value={stats.totalTrades.toString()} sub="Operaciones cerradas" color="indigo" isDarkMode={isDarkMode} />
              </div>

              {/* Chart Section */}
              <div className={cn(
                "p-6 rounded-2xl border transition-all duration-300",
                isDarkMode 
                  ? "bg-[#1F2937] border-white/10 shadow-[0_0_20px_rgba(255,255,255,0.05)]" 
                  : "bg-white border-gray-100 shadow-sm"
              )}>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-lg">Evolución del Capital</h3>
                  <div className="relative">
                    <div className={cn(
                      "flex items-center gap-2 px-3 py-1.5 border rounded-xl text-xs font-bold transition-colors pointer-events-none",
                      isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-gray-50 border-gray-100 text-indigo-600"
                    )}>
                      <Wallet size={14} />
                      <span className="hidden sm:block">
                        {filterAccount === 'ALL' ? 'Todas las cuentas' : accounts.find(a => a.id.toString() === filterAccount)?.name || 'Cuenta'}
                      </span>
                    </div>
                    <select 
                      value={filterAccount}
                      onChange={(e) => setFilterAccount(e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    >
                      <option value="ALL" className={isDarkMode ? "bg-[#1F2937] text-white" : ""}>Todas las cuentas</option>
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id.toString()} className={isDarkMode ? "bg-[#1F2937] text-white" : ""}>{acc.name || acc.account_id}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0D4A4B" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#0D4A4B" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "rgba(255,255,255,0.05)" : "#F1F5F9"} />
                      <XAxis 
                        dataKey="date" 
                        stroke="#94A3B8" 
                        fontSize={10} 
                        tickLine={false}
                        axisLine={false}
                        dy={10}
                        padding={{ left: 0, right: 20 }}
                      />
                      <YAxis 
                        stroke="#94A3B8" 
                        fontSize={12} 
                        tickFormatter={(v) => `$${v}`}
                        axisLine={false}
                        tickLine={false}
                        domain={['dataMin', 'auto']}
                        tickCount={6}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          borderRadius: '12px', 
                          border: 'none', 
                          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                          backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
                          color: isDarkMode ? '#FFFFFF' : '#1A1A1A'
                        }}
                        itemStyle={{ color: isDarkMode ? '#FFFFFF' : '#1A1A1A' }}
                        formatter={(v: number) => [`$${v.toFixed(2)}`, 'Balance']}
                      />
                      <Area type="monotone" dataKey="balance" stroke="#0D4A4B" strokeWidth={3} fillOpacity={1} fill="url(#colorBalance)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* PnL Calendar Section */}
              <PnLCalendar trades={getFilteredTrades()} isDarkMode={isDarkMode} />
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div 
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className={cn(
                "rounded-2xl border overflow-hidden transition-all duration-300",
                isDarkMode 
                  ? "bg-[#1F2937] border-white/10 shadow-[0_0_20px_rgba(255,255,255,0.05)]" 
                  : "bg-white border-gray-100 shadow-sm"
              )}
            >
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className={cn(
                    "text-xs uppercase tracking-wider font-bold",
                    isDarkMode ? "bg-white/5 text-[#D1D5DB]" : "bg-gray-50 text-gray-500"
                  )}>
                    <th className="px-6 py-4">Instrumento</th>
                    <th className="px-6 py-4">Fecha/Hora</th>
                    <th className="px-6 py-4">Tipo</th>
                    <th className="px-6 py-4">Estrategia</th>
                    <th className="px-6 py-4">Gatillos (Entrada / Salida)</th>
                    <th className="px-6 py-4">Lotes</th>
                    <th className="px-6 py-4">Resultado</th>
                    <th className="px-6 py-4">Info</th>
                    <th className="px-6 py-4">Acciones</th>
                  </tr>
                </thead>
                <tbody className={cn("divide-y", isDarkMode ? "divide-white/5" : "divide-gray-100")}>
                  {getFilteredTrades().map((trade) => (
                      <tr key={trade.id} className={cn(
                        "transition-colors group",
                        isDarkMode ? "hover:bg-white/5" : "hover:bg-gray-50"
                      )}>
                        <td className="px-6 py-4 font-bold">{trade.instrument}</td>
                        <td className={cn("px-6 py-4 text-sm", isDarkMode ? "text-[#D1D5DB]" : "text-gray-500")}>
                          {trade.entry_date} <span className="opacity-50 ml-1">{trade.entry_time}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2 py-1 rounded-md text-[10px] font-black tracking-tighter",
                            trade.type === 'LONG' ? "bg-emerald-100/10 text-[#508E48]" : "bg-rose-100/10 text-[#FB7185]"
                          )}>
                            {trade.type}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn("text-xs font-medium", isDarkMode ? "text-gray-300" : "text-gray-600")}>
                            {strategies.find(s => s.id === trade.strategy_id)?.name || '-'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-[10px] space-y-2">
                            <div>
                              <p className="text-[8px] font-black text-indigo-400 uppercase tracking-tighter mb-1">Entrada</p>
                              {(() => {
                                try {
                                  const triggers = JSON.parse(trade.executed_entry_triggers || '{}');
                                  const entries = Object.entries(triggers);
                                  return entries.length > 0 ? entries.map(([name, val]) => (
                                    <p key={name} className="font-mono text-gray-400">
                                      {name}: <span className={isDarkMode ? "text-white" : "text-gray-900"}>{val}</span>
                                    </p>
                                  )) : <p className="text-gray-500 italic">Sin datos</p>;
                                } catch (e) {
                                  return <p className="text-gray-500">-</p>;
                                }
                              })()}
                            </div>
                            <div>
                              <p className="text-[8px] font-black text-rose-400 uppercase tracking-tighter mb-1">Salida</p>
                              {(() => {
                                try {
                                  const triggers = JSON.parse(trade.executed_exit_triggers || '{}');
                                  const entries = Object.entries(triggers);
                                  return entries.length > 0 ? entries.map(([name, val]) => (
                                    <p key={name} className="font-mono text-gray-400">
                                      {name}: <span className={isDarkMode ? "text-white" : "text-gray-900"}>{val}</span>
                                    </p>
                                  )) : <p className="text-gray-500 italic">Sin datos</p>;
                                } catch (e) {
                                  return <p className="text-gray-500">-</p>;
                                }
                              })()}
                            </div>
                            {trade.candlestick_used && (
                              <p className={cn("italic font-bold pt-1 border-t border-white/5", isDarkMode ? "text-emerald-400" : "text-emerald-600")}>
                                {trade.candlestick_used}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-xs font-mono">
                            <p className={isDarkMode ? "text-gray-300" : "text-gray-600"}>{(trade.lots * 100).toFixed(0)} Micro</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "font-bold",
                            trade.profit > 0 ? "text-[#508E48]" : trade.profit < 0 ? "text-[#FB7185]" : "text-gray-400"
                          )}>
                            {trade.profit > 0 ? '+' : ''}{trade.profit.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            {trade.comments && (
                              <div className="group/tip relative">
                                <MessageSquare size={16} className="text-gray-400" />
                                <div className={cn(
                                  "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 text-[10px] rounded opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none z-50",
                                  isDarkMode ? "bg-white text-gray-900" : "bg-gray-800 text-white"
                                )}>
                                  {trade.comments}
                                </div>
                              </div>
                            )}
                            {trade.image_url && (
                              <div className="group/tip relative">
                                <ImageIcon size={16} className="text-gray-400" />
                                <div className={cn(
                                  "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 border rounded shadow-xl opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none z-50",
                                  isDarkMode ? "bg-[#1F2937] border-white/10" : "bg-white border-gray-200"
                                )}>
                                  <img src={trade.image_url} alt="Trade" className="w-full h-auto rounded" referrerPolicy="no-referrer" />
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => {
                                setEditingTrade(trade);
                                setIsModalOpen(true);
                              }}
                              className={cn(
                                "p-2 rounded-lg transition-all",
                                isDarkMode ? "text-gray-400 hover:text-white hover:bg-white/5" : "text-gray-400 hover:text-indigo-600 hover:bg-indigo-50"
                              )}
                            >
                              <Pencil size={18} />
                            </button>
                            <button 
                              onClick={() => deleteTrade(trade.id)}
                              className="p-2 text-gray-400 hover:text-[#FB7185] transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </motion.div>
          )}

          {activeTab === 'accounts' && (
            <motion.div 
              key="accounts"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Gestión de Cuentas</h2>
                <div className="flex flex-col sm:flex-row gap-4 items-end">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Cuenta de Destino (Importar)</label>
                    <select 
                      value={selectedImportAccountId}
                      onChange={(e) => setSelectedImportAccountId(e.target.value)}
                      className={cn(
                        "h-10 px-3 text-xs border rounded-xl outline-none transition-all w-48",
                        isDarkMode ? "bg-[#1F2937] border-white/10 text-white" : "bg-white border-gray-200"
                      )}
                    >
                      <option value="" className={isDarkMode ? "bg-[#1F2937] text-white" : ""}>Seleccionar cuenta...</option>
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id} className={isDarkMode ? "bg-[#1F2937] text-white" : ""}>{acc.name || acc.account_id}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <label className={cn(
                      "h-10 px-4 rounded-xl font-bold text-sm flex items-center gap-2 transition-all border",
                      !selectedImportAccountId 
                        ? "opacity-50 cursor-not-allowed grayscale" 
                        : "cursor-pointer",
                      isDarkMode 
                        ? "bg-white/5 border-white/10 text-white hover:bg-white/10" 
                        : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm"
                    )}>
                      <Upload size={18} /> Importar CSV
                      <input 
                        type="file" 
                        accept=".csv" 
                        className="hidden" 
                        onChange={handleImportCSV}
                        disabled={!selectedImportAccountId}
                      />
                    </label>
                    <button 
                      onClick={() => setIsAccountModalOpen(true)}
                      className="h-10 px-4 bg-indigo-600 text-white rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-indigo-100"
                    >
                      <Plus size={18} /> Nueva Cuenta
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {accounts.map((account) => {
                  const accountTrades = trades.filter(t => t.account_id === account.id && t.status !== 'OPEN');
                  const wins = accountTrades.filter(t => t.status === 'WIN').length;
                  const winRate = accountTrades.length > 0 ? (wins / accountTrades.length) * 100 : 0;
                  const totalProfit = accountTrades.reduce((acc, t) => acc + t.profit, 0);
                  const currentBalance = account.capital + totalProfit;

                  return (
                    <div key={account.id} className={cn(
                      "p-6 rounded-2xl border transition-all duration-300 space-y-4",
                      isDarkMode 
                        ? "bg-[#1F2937] border-white/10 shadow-[0_0_20px_rgba(255,255,255,0.05)]" 
                        : "bg-white border-gray-100 shadow-sm"
                    )}>
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <div>
                            <h3 className="font-bold text-lg">{account.name || 'Sin nombre'}</h3>
                            <p className="text-xs text-gray-400 font-mono">ID: {account.account_id}</p>
                          </div>
                          <button 
                            onClick={() => {
                              setEditingAccount(account);
                              setIsAccountModalOpen(true);
                            }}
                            className={cn(
                              "p-1.5 rounded-lg transition-all",
                              isDarkMode ? "text-gray-400 hover:text-white hover:bg-white/5" : "text-gray-400 hover:text-indigo-600 hover:bg-indigo-50"
                            )}
                          >
                            <Pencil size={14} />
                          </button>
                        </div>
                        <span className={cn(
                          "px-2 py-1 rounded-md text-[10px] font-black tracking-tighter",
                          account.type === 'PERSONAL' ? "bg-blue-100/10 text-blue-500" : "bg-purple-100/10 text-purple-500"
                        )}>
                          {account.type}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase">Balance Actual</p>
                          <p className="text-lg font-bold font-mono">${currentBalance.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase">PnL Total</p>
                          <p className={cn(
                            "text-lg font-bold font-mono",
                            totalProfit >= 0 ? "text-[#508E48]" : "text-[#FB7185]"
                          )}>
                            {totalProfit >= 0 ? '+' : ''}${totalProfit.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase">Win Rate</p>
                          <p className="text-sm font-bold font-mono">{winRate.toFixed(1)}%</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase">Total Trades</p>
                          <p className="text-sm font-bold font-mono">{accountTrades.length}</p>
                        </div>
                      </div>

                      <div className={cn("pt-2 border-t flex justify-between items-center", isDarkMode ? "border-white/5" : "border-gray-50")}>
                        <div className="flex items-center gap-2 text-[#FB7185]">
                          <AlertCircle size={14} />
                          <span className="text-xs font-bold">Límite: {account.loss_limit ? `$${account.loss_limit.toLocaleString()}` : 'N/A'}</span>
                        </div>
                        <button 
                          onClick={() => deleteAccount(account.id)}
                          className="text-gray-300 hover:text-[#FB7185] transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
          {activeTab === 'strategies' && (
            <motion.div 
              key="strategies"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Estrategias de Trading</h2>
                <button 
                  onClick={() => setIsStrategyModalOpen(true)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-indigo-100"
                >
                  <Plus size={18} /> Nueva Estrategia
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {strategies.map((strategy) => {
                  const strategyTrades = trades.filter(t => t.strategy_id === strategy.id && t.status !== 'OPEN');
                  const wins = strategyTrades.filter(t => t.status === 'WIN').length;
                  const winRate = strategyTrades.length > 0 ? (wins / strategyTrades.length) * 100 : 0;

                  return (
                    <div key={strategy.id} className={cn(
                      "p-6 rounded-2xl border transition-all duration-300 space-y-4",
                      isDarkMode 
                        ? "bg-[#1F2937] border-white/10 shadow-[0_0_20px_rgba(255,255,255,0.05)]" 
                        : "bg-white border-gray-100 shadow-sm"
                    )}>
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-lg">{strategy.name}</h3>
                          <button 
                            onClick={() => {
                              setEditingStrategy(strategy);
                              setIsStrategyModalOpen(true);
                            }}
                            className={cn(
                              "p-1.5 rounded-lg transition-all",
                              isDarkMode ? "text-gray-400 hover:text-white hover:bg-white/5" : "text-gray-400 hover:text-indigo-600 hover:bg-indigo-50"
                            )}
                          >
                            <Pencil size={14} />
                          </button>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-gray-400 uppercase">Win Rate</p>
                          <p className={cn(
                            "text-xl font-bold font-mono",
                            winRate >= 50 ? "text-[#508E48]" : "text-[#FB7185]"
                          )}>
                            {winRate.toFixed(1)}%
                          </p>
                        </div>
                      </div>

                      <div className={cn("p-4 rounded-xl", isDarkMode ? "bg-white/5" : "bg-gray-50")}>
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Gatillos de Entrada</p>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {(() => {
                            try {
                              const triggers = JSON.parse(strategy.entry_triggers || '[]');
                              return triggers.length > 0 ? triggers.map((t: any, i: number) => (
                                <span key={i} className="px-2 py-1 rounded bg-indigo-500/10 text-indigo-400 text-[10px] font-mono">
                                  {t.indicator} {t.operator} {t.value}
                                </span>
                              )) : <span className="text-xs text-gray-500 italic">Sin gatillos</span>;
                            } catch (e) { return null; }
                          })()}
                        </div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Gatillos de Salida</p>
                        <div className="flex flex-wrap gap-2">
                          {(() => {
                            try {
                              const triggers = JSON.parse(strategy.exit_triggers || '[]');
                              return triggers.length > 0 ? triggers.map((t: any, i: number) => (
                                <span key={i} className="px-2 py-1 rounded bg-rose-500/10 text-rose-400 text-[10px] font-mono">
                                  {t.indicator} {t.operator} {t.value}
                                </span>
                              )) : <span className="text-xs text-gray-500 italic">Sin gatillos</span>;
                            } catch (e) { return null; }
                          })()}
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-2">
                        <div className="flex gap-4">
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase">Trades</p>
                            <p className="font-bold">{strategyTrades.length}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase">Creada</p>
                            <p className="font-bold text-xs">{format(new Date(strategy.created_at), 'dd/MM/yyyy')}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => deleteStrategy(strategy.id)}
                          className="text-gray-300 hover:text-[#FB7185] transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {activeTab === 'analytics' && (
            <motion.div 
              key="analytics"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Análisis Avanzado</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* MAE Card */}
                <div className={cn(
                  "p-8 rounded-3xl border relative overflow-hidden transition-all duration-300",
                  isDarkMode ? "bg-[#1F2937] border-white/10" : "bg-white border-gray-100 shadow-sm"
                )}>
                  <button 
                    onClick={() => setInfoModal({
                      title: "Maximum Adverse Excursion (MAE)",
                      text: (
                        <div className="space-y-4 text-sm">
                          <p>Mide el máximo movimiento del precio en contra de tu posición mientras la operación estuvo abierta.</p>
                          <div className={cn("pt-4 border-t", isDarkMode ? "border-white/10" : "border-gray-200")}>
                            <span className={cn("font-bold", isDarkMode ? "text-white" : "text-gray-900")}>Rango Óptimo: </span>
                            Cuanto más cerca de cero, mejor. Un MAE óptimo debe representar solo una pequeña fracción de tu límite de pérdida (Stop Loss). Si tus operaciones terminan en positivo pero registran habitualmente un MAE muy profundo, significa que estás soportando demasiado calor flotante y tus entradas se están ejecutando de forma prematura.
                          </div>
                        </div>
                      )
                    })}
                    className="absolute top-6 right-6 p-2 text-gray-400 hover:text-indigo-500 transition-colors"
                  >
                    <Info size={20} />
                  </button>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Promedio MAE</p>
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-5xl font-black font-mono text-[#FB7185]">
                      {trades.filter(t => t.mae !== null).length > 0 
                        ? (trades.filter(t => t.mae !== null).reduce((acc, t) => acc + (t.mae || 0), 0) / trades.filter(t => t.mae !== null).length).toFixed(2)
                        : '0.00'}%
                    </h3>
                  </div>
                  <p className="mt-4 text-sm text-gray-500">Excursión Adversa Máxima promedio de tu operativa</p>
                </div>

                {/* MFE Card */}
                <div className={cn(
                  "p-8 rounded-3xl border relative overflow-hidden transition-all duration-300",
                  isDarkMode ? "bg-[#1F2937] border-white/10" : "bg-white border-gray-100 shadow-sm"
                )}>
                  <button 
                    onClick={() => setInfoModal({
                      title: "Maximum Favorable Excursion (MFE)",
                      text: (
                        <div className="space-y-4 text-sm">
                          <p>Mide el máximo movimiento del precio a favor de tu posición mientras la operación estuvo abierta.</p>
                          <div className={cn("pt-4 border-t", isDarkMode ? "border-white/10" : "border-gray-200")}>
                            <span className={cn("font-bold", isDarkMode ? "text-white" : "text-gray-900")}>Rango Óptimo: </span>
                            Su valor debería ser lo más cercano posible al beneficio final obtenido al cerrar el trade. Si tu MFE histórico es consistentemente mucho mayor que tus ganancias reales, la estadística indica que estás dejando dinero sobre la mesa por cerrar tarde o por no ajustar el stop. Si el MFE coincide frecuentemente con tu toma de beneficios, tus salidas están matemáticamente optimizadas.
                          </div>
                        </div>
                      )
                    })}
                    className="absolute top-6 right-6 p-2 text-gray-400 hover:text-indigo-500 transition-colors"
                  >
                    <Info size={20} />
                  </button>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Promedio MFE</p>
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-5xl font-black font-mono text-[#508E48]">
                      {trades.filter(t => t.mfe !== null).length > 0 
                        ? (trades.filter(t => t.mfe !== null).reduce((acc, t) => acc + (t.mfe || 0), 0) / trades.filter(t => t.mfe !== null).length).toFixed(2)
                        : '0.00'}%
                    </h3>
                  </div>
                  <p className="mt-4 text-sm text-gray-500">Excursión Favorable Máxima promedio de tu operativa</p>
                </div>
              </div>

              {/* Payoff & Max Drawdown Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Payoff Card */}
                <div className={cn(
                  "p-8 rounded-3xl border relative overflow-hidden transition-all duration-300",
                  isDarkMode ? "bg-[#1F2937] border-white/10" : "bg-white border-gray-100 shadow-sm"
                )}>
                  <button 
                    onClick={() => setInfoModal({
                      title: "Ratio Payoff (Ganancia/Pérdida Media)",
                      text: (
                        <div className="space-y-4 text-sm">
                          <p>Mide la relación matemática entre tu ganancia media y tu pérdida media. Responde a la pregunta: ¿Cuánto gano cuando tengo razón frente a cuánto pierdo cuando me equivoco?</p>
                          <div className={cn("pt-4 border-t", isDarkMode ? "border-white/10" : "border-gray-200")}>
                            <span className={cn("font-bold", isDarkMode ? "text-white" : "text-gray-900")}>Rango Óptimo: </span>
                            Mayor a 1.0. Un Payoff de 2.0 significa que ganas el doble de lo que pierdes. Si el valor cae por debajo de 1.0, tu estrategia exige un Win Rate superior al 50% solo para mantener la cuenta a flote (Break Even).
                          </div>
                        </div>
                      )
                    })}
                    className="absolute top-6 right-6 p-2 text-gray-400 hover:text-indigo-500 transition-colors"
                  >
                    <Info size={20} />
                  </button>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Ratio Payoff</p>
                  <div className="flex items-baseline gap-2">
                    <h3 className={cn(
                      "text-5xl font-black font-mono",
                      payoffData.payoff > 1 ? "text-[#508E48]" : payoffData.payoff < 1 ? "text-[#FB7185]" : "text-[#686A6C]"
                    )}>
                      {payoffData.payoff.toFixed(2)}
                    </h3>
                  </div>
                  <p className="mt-4 text-sm text-gray-500">Relación entre ganancia media (${payoffData.avgWin.toFixed(2)}) y pérdida media (${payoffData.avgLoss.toFixed(2)})</p>
                </div>

                {/* Max Drawdown Card */}
                <div className={cn(
                  "p-8 rounded-3xl border relative overflow-hidden transition-all duration-300",
                  isDarkMode ? "bg-[#1F2937] border-white/10" : "bg-white border-gray-100 shadow-sm"
                )}>
                  <button 
                    onClick={() => setInfoModal({
                      title: "Máximo Drawdown (Max DD)",
                      text: (
                        <div className="space-y-4 text-sm">
                          <p>Representa la mayor caída acumulada en tu capital desde un pico máximo anterior. Mide el "dolor" financiero y psicológico que has tenido que soportar durante una racha de pérdidas.</p>
                          <div className={cn("pt-4 border-t", isDarkMode ? "border-white/10" : "border-gray-200")}>
                            <span className={cn("font-bold", isDarkMode ? "text-white" : "text-gray-900")}>Importancia: </span>
                            Es la métrica de riesgo más crítica. Un Max Drawdown del 20% significa que en algún momento tu cuenta bajó un 20% desde su punto más alto. Si este valor es muy cercano a tu límite de pérdida total, tu gestión de riesgo es demasiado agresiva.
                          </div>
                        </div>
                      )
                    })}
                    className="absolute top-6 right-6 p-2 text-gray-400 hover:text-indigo-500 transition-colors"
                  >
                    <Info size={20} />
                  </button>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Máximo Drawdown</p>
                  <div className="flex items-baseline gap-2">
                    <h3 className={cn(
                      "text-5xl font-black font-mono",
                      maxDrawdown > 0 ? "text-[#FB7185]" : "text-[#686A6C]"
                    )}>
                      ${maxDrawdown.toFixed(2)}
                    </h3>
                  </div>
                  <p className="mt-4 text-sm text-gray-500">Mayor caída desde el pico máximo de capital</p>
                </div>
              </div>

              {/* Sharpe & Sortino Ratios */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Sharpe Card */}
                <div className={cn(
                  "p-8 rounded-3xl border relative overflow-hidden transition-all duration-300",
                  isDarkMode ? "bg-[#1F2937] border-white/10" : "bg-white border-gray-100 shadow-sm"
                )}>
                  <button 
                    onClick={() => setInfoModal({
                      title: "Ratio Sharpe",
                      text: (
                        <div className="space-y-4 text-sm">
                          <p>Mide el rendimiento ajustado al riesgo total. Compara tu ganancia media con la volatilidad (variación) de todas tus operaciones, tanto ganadoras como perdedoras.</p>
                          <div className={cn("pt-4 border-t", isDarkMode ? "border-white/10" : "border-gray-200")}>
                            <span className={cn("font-bold", isDarkMode ? "text-white" : "text-gray-900")}>Rango Óptimo: </span>
                            Mayor a 1.0 es aceptable, mayor a 2.0 es excelente. Si es menor a 1.0, los retornos que estás obteniendo no justifican la volatilidad y el estrés que está sufriendo la cuenta.
                          </div>
                        </div>
                      )
                    })}
                    className="absolute top-6 right-6 p-2 text-gray-400 hover:text-indigo-500 transition-colors"
                  >
                    <Info size={20} />
                  </button>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Ratio Sharpe</p>
                  <div className="flex items-baseline gap-2">
                    <h3 className={cn(
                      "text-5xl font-black font-mono",
                      riskAdjustedRatios.sharpe > 1 ? "text-[#508E48]" : riskAdjustedRatios.sharpe < 1 ? "text-[#FB7185]" : "text-[#686A6C]"
                    )}>
                      {riskAdjustedRatios.sharpe.toFixed(2)}
                    </h3>
                  </div>
                  <p className="mt-4 text-sm text-gray-500">Rendimiento ajustado a la volatilidad total</p>
                </div>

                {/* Sortino Card */}
                <div className={cn(
                  "p-8 rounded-3xl border relative overflow-hidden transition-all duration-300",
                  isDarkMode ? "bg-[#1F2937] border-white/10" : "bg-white border-gray-100 shadow-sm"
                )}>
                  <button 
                    onClick={() => setInfoModal({
                      title: "Ratio Sortino",
                      text: (
                        <div className="space-y-4 text-sm">
                          <p>Es una evolución del Sharpe que penaliza únicamente la volatilidad negativa. Ignora las grandes ganancias explosivas y se centra en evaluar el riesgo real de ruina.</p>
                          <div className={cn("pt-4 border-t", isDarkMode ? "border-white/10" : "border-gray-200")}>
                            <span className={cn("font-bold", isDarkMode ? "text-white" : "text-gray-900")}>Rango Óptimo: </span>
                            Mayor a 2.0. En estrategias con stop ajustado, este ratio es vital. Un Sortino alto te confirma que tus pérdidas están encapsuladas y controladas matemáticamente, independientemente de tus rachas ganadoras.
                          </div>
                        </div>
                      )
                    })}
                    className="absolute top-6 right-6 p-2 text-gray-400 hover:text-indigo-500 transition-colors"
                  >
                    <Info size={20} />
                  </button>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Ratio Sortino</p>
                  <div className="flex items-baseline gap-2">
                    <h3 className={cn(
                      "text-5xl font-black font-mono",
                      riskAdjustedRatios.sortino > 2 ? "text-[#508E48]" : riskAdjustedRatios.sortino < 2 ? "text-[#FB7185]" : "text-[#686A6C]"
                    )}>
                      {riskAdjustedRatios.sortino.toFixed(2)}
                    </h3>
                  </div>
                  <p className="mt-4 text-sm text-gray-500">Rendimiento ajustado a la volatilidad negativa</p>
                </div>
              </div>

              {/* Expectation Card */}
              <div className={cn(
                "p-8 rounded-3xl border relative overflow-hidden transition-all duration-300",
                isDarkMode ? "bg-[#1F2937] border-white/10" : "bg-white border-gray-100 shadow-sm"
              )}>
                <button 
                  onClick={() => setInfoModal({
                    title: "Expectativa Matemática",
                    text: (
                      <div className="space-y-4 text-sm">
                        <p>Representa el beneficio (o pérdida) promedio que puedes esperar por cada operación, medido en unidades de riesgo (R).</p>
                        <div className={cn("pt-4 border-t", isDarkMode ? "border-white/10" : "border-gray-200")}>
                          <span className={cn("font-bold", isDarkMode ? "text-white" : "text-gray-900")}>Interpretación: </span>
                          Una expectativa de +0.50R significa que, a largo plazo, cada vez que entras al mercado ganas en promedio la mitad de lo que arriesgas. Es el indicador definitivo de la robustez de tu sistema. Si es negativa, tu sistema perderá dinero independientemente de tu gestión emocional.
                        </div>
                      </div>
                    )
                  })}
                  className="absolute top-6 right-6 p-2 text-gray-400 hover:text-indigo-500 transition-colors"
                >
                  <Info size={20} />
                </button>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Expectativa Matemática</p>
                <div className="flex items-baseline gap-2">
                  <h3 className={cn(
                    "text-5xl font-black font-mono",
                    rMultipleData.expectation > 0 ? "text-[#508E48]" : rMultipleData.expectation < 0 ? "text-[#FB7185]" : "text-[#686A6C]"
                  )}>
                    {rMultipleData.expectation > 0 ? '+' : ''}{rMultipleData.expectation.toFixed(2)}R
                  </h3>
                </div>
                <p className="mt-4 text-sm text-gray-500">Beneficio promedio esperado por cada trade</p>
              </div>

              {/* R-Multiple Analysis Section */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-6 bg-indigo-600 rounded-full"></div>
                  <h3 className="text-xl font-bold">Análisis de R-Múltiplo</h3>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  {/* R-Multiple Distribution Chart */}
                  <div className={cn(
                    "p-8 rounded-3xl border transition-all duration-300",
                    isDarkMode ? "bg-[#1F2937] border-white/10" : "bg-white border-gray-100 shadow-sm"
                  )}>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">Distribución de R-Múltiplo</p>
                    <div className="h-[200px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={rMultipleData.distribution}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
                          <XAxis 
                            dataKey="range" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 'bold' }} 
                          />
                          <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 'bold' }}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
                              borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                              borderRadius: '12px',
                              fontSize: '12px'
                            }}
                          />
                          <Bar dataKey="count">
                            {rMultipleData.distribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Cumulative R-Multiple Chart */}
                <div className={cn(
                  "p-8 rounded-3xl border relative transition-all duration-300",
                  isDarkMode ? "bg-[#1F2937] border-white/10" : "bg-white border-gray-100 shadow-sm"
                )}>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">Curva de R-Múltiplo Acumulado</p>
<button
  onClick={() => setInfoModal({
    title: "Curva de R-Múltiplo Acumulado",
    text: (
      <div className="space-y-4 text-sm">
        <p>Muestra el crecimiento de tu cuenta normalizado puramente en unidades de riesgo (R). Ignora el valor monetario de tus operaciones para evaluar exclusivamente la eficiencia de tu sistema.</p>
        <div className={`pt-4 border-t ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}>
          <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Interpretación: </span> 
          Una curva ascendente y suave es la prueba matemática de que tu sistema funciona. Te confirma que, independientemente de tu gestión de capital, tienes una ventaja estadística real.
        </div>
      </div>
    )
  })}
  className="absolute top-6 right-6 p-2 text-gray-400 hover:text-indigo-500 transition-colors"
>
  <Info size={20} />
</button>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={rMultipleData.cumulativeData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
                        <XAxis 
                          dataKey="index" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 'bold' }} 
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 'bold' }}
                          tickFormatter={(value) => `${value}R`}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
                            borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                            borderRadius: '12px',
                            fontSize: '12px'
                          }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="cumulativeR" 
                          stroke="#8b5cf6" 
                          strokeWidth={3} 
                          dot={false}
                          activeDot={{ r: 6, strokeWidth: 0 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="mt-4 text-sm text-gray-500">Evolución del beneficio acumulado en unidades de riesgo (R)</p>
                </div>

                
                
              </div>

              {/* Performance by Time Slot Section */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-6 bg-indigo-600 rounded-full"></div>
                  <h3 className="text-xl font-bold">Rendimiento por Franjas Horarias</h3>
                </div>

                <div className={cn(
                  "p-8 rounded-3xl border transition-all duration-300",
                  isDarkMode ? "bg-[#1F2937] border-white/10" : "bg-white border-gray-100 shadow-sm"
                )}>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={timeSlotData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
                        <XAxis 
                          dataKey="slot" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 'bold' }} 
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 'bold' }}
                          tickFormatter={(value) => `$${value}`}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
                            borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                            borderRadius: '12px',
                            fontSize: '12px'
                          }}
                        />
                        <Bar dataKey="pnl">
                          {timeSlotData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#22c55e' : '#ef4444'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="mt-8 overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className={cn(
                          "border-b",
                          isDarkMode ? "border-white/5" : "border-gray-50"
                        )}>
                          <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Franja Horaria</th>
                          <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Total Trades</th>
                          <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Win Rate (%)</th>
                          <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">PnL Neto</th>
                          <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Promedio / Trade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {timeSlotData.map((data, idx) => (
                          <tr key={idx} className={cn(
                            "border-b last:border-0 transition-colors",
                            isDarkMode ? "border-white/5 hover:bg-white/5" : "border-gray-50 hover:bg-gray-50"
                          )}>
                            <td className="py-4 text-xs font-bold font-mono">{data.slot}</td>
                            <td className="py-4 text-xs font-bold font-mono text-center">{data.total}</td>
                            <td className="py-4 text-xs font-bold font-mono text-center">{data.winRate.toFixed(1)}%</td>
                            <td className={cn(
                              "py-4 text-xs font-bold font-mono text-right",
                              data.pnl > 0 ? "text-[#22c55e]" : data.pnl < 0 ? "text-[#ef4444]" : "text-gray-400"
                            )}>
                              {data.pnl > 0 ? '+' : ''}{data.pnl.toFixed(2)} USD
                            </td>
                            <td className={cn(
                              "py-4 text-xs font-bold font-mono text-right",
                              data.avgProfit > 0 ? "text-[#22c55e]" : data.avgProfit < 0 ? "text-[#ef4444]" : "text-gray-400"
                            )}>
                              {data.avgProfit > 0 ? '+' : ''}{data.avgProfit.toFixed(2)} USD
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </main>

      {/* Add Strategy Modal */}
      <AnimatePresence>
        {isStrategyModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsStrategyModalOpen(false);
                setEditingStrategy(null);
              }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={cn(
                "relative w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden transition-all duration-300",
                isDarkMode 
                  ? "bg-[#1F2937] border border-white/10 shadow-[0_0_40px_rgba(255,255,255,0.07)]" 
                  : "bg-white"
              )}
            >
              <div className={cn("p-8 border-b flex justify-between items-center", isDarkMode ? "border-white/10" : "border-gray-100")}>
                <h2 className="text-2xl font-bold">{editingStrategy ? 'Editar Estrategia' : 'Nueva Estrategia'}</h2>
                <button 
                  onClick={() => {
                    setIsStrategyModalOpen(false);
                    setEditingStrategy(null);
                  }} 
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={addStrategy} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Nombre de la Estrategia</label>
                  <input 
                    name="name" 
                    defaultValue={editingStrategy?.name || ''} 
                    required 
                    placeholder="Ej: Scalping RSI 5m" 
                    className={cn(
                      "w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all",
                      isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-gray-50 border-gray-100"
                    )}
                  />
                </div>

                <div className="space-y-6 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                  {/* Entry Triggers */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-gray-400 uppercase">Gatillos de Entrada</label>
                      <button 
                        type="button"
                        onClick={addEntryTrigger}
                        className="text-xs font-bold text-indigo-500 hover:text-indigo-600 flex items-center gap-1"
                      >
                        <Plus size={14} /> Añadir Gatillo
                      </button>
                    </div>
                    
                    <div className="space-y-3">
                      {strategyEntryTriggers.map((trigger, index) => (
                        <div key={index} className="flex gap-2 items-center">
                          <input 
                            placeholder="Indicador (ej: RSI 14)"
                            value={trigger.indicator}
                            onChange={(e) => updateEntryTrigger(index, 'indicator', e.target.value)}
                            className={cn(
                              "flex-1 p-2 text-sm border rounded-lg outline-none",
                              isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-gray-50 border-gray-100"
                            )}
                          />
                          <select 
                            value={trigger.operator}
                            onChange={(e) => updateEntryTrigger(index, 'operator', e.target.value as any)}
                            className={cn(
                              "w-20 p-2 text-sm border rounded-lg outline-none",
                              isDarkMode ? "bg-[#1F2937] border-white/10 text-white" : "bg-gray-50 border-gray-100"
                            )}
                          >
                            <option value=">" className={isDarkMode ? "bg-[#1F2937] text-white" : ""}>{'>'}</option>
                            <option value="<" className={isDarkMode ? "bg-[#1F2937] text-white" : ""}>{'<'}</option>
                            <option value="=" className={isDarkMode ? "bg-[#1F2937] text-white" : ""}>{'='}</option>
                          </select>
                          <input 
                            type="number"
                            step="any"
                            placeholder="Valor"
                            value={trigger.value}
                            onChange={(e) => updateEntryTrigger(index, 'value', parseFloat(e.target.value))}
                            className={cn(
                              "w-24 p-2 text-sm border rounded-lg outline-none",
                              isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-gray-50 border-gray-100"
                            )}
                          />
                          <button 
                            type="button"
                            onClick={() => removeEntryTrigger(index)}
                            className="text-rose-500 hover:text-rose-600 p-1"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                      {strategyEntryTriggers.length === 0 && (
                        <p className="text-xs text-gray-500 italic text-center py-2">No hay gatillos de entrada definidos.</p>
                      )}
                    </div>
                  </div>

                  {/* Exit Triggers */}
                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-gray-400 uppercase">Gatillos de Salida</label>
                      <button 
                        type="button"
                        onClick={addExitTrigger}
                        className="text-xs font-bold text-rose-500 hover:text-rose-600 flex items-center gap-1"
                      >
                        <Plus size={14} /> Añadir Gatillo
                      </button>
                    </div>
                    
                    <div className="space-y-3">
                      {strategyExitTriggers.map((trigger, index) => (
                        <div key={index} className="flex gap-2 items-center">
                          <input 
                            placeholder="Indicador (ej: STOCH)"
                            value={trigger.indicator}
                            onChange={(e) => updateExitTrigger(index, 'indicator', e.target.value)}
                            className={cn(
                              "flex-1 p-2 text-sm border rounded-lg outline-none",
                              isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-gray-50 border-gray-100"
                            )}
                          />
                          <select 
                            value={trigger.operator}
                            onChange={(e) => updateExitTrigger(index, 'operator', e.target.value as any)}
                            className={cn(
                              "w-20 p-2 text-sm border rounded-lg outline-none",
                              isDarkMode ? "bg-[#1F2937] border-white/10 text-white" : "bg-gray-50 border-gray-100"
                            )}
                          >
                            <option value=">" className={isDarkMode ? "bg-[#1F2937] text-white" : ""}>{'>'}</option>
                            <option value="<" className={isDarkMode ? "bg-[#1F2937] text-white" : ""}>{'<'}</option>
                            <option value="=" className={isDarkMode ? "bg-[#1F2937] text-white" : ""}>{'='}</option>
                          </select>
                          <input 
                            type="number"
                            step="any"
                            placeholder="Valor"
                            value={trigger.value}
                            onChange={(e) => updateExitTrigger(index, 'value', parseFloat(e.target.value))}
                            className={cn(
                              "w-24 p-2 text-sm border rounded-lg outline-none",
                              isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-gray-50 border-gray-100"
                            )}
                          />
                          <button 
                            type="button"
                            onClick={() => removeExitTrigger(index)}
                            className="text-rose-500 hover:text-rose-600 p-1"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                      {strategyExitTriggers.length === 0 && (
                        <p className="text-xs text-gray-500 italic text-center py-2">No hay gatillos de salida definidos.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 rounded-xl border border-dashed border-gray-200 dark:border-white/10">
                  <input 
                    type="checkbox"
                    id="has_candlestick"
                    checked={strategyHasCandlestick}
                    onChange={(e) => setStrategyHasCandlestick(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="has_candlestick" className="text-sm font-medium text-gray-400">
                    Habilitar confirmación por Patrones de Vela
                  </label>
                </div>

                <button type="submit" className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">
                  {editingStrategy ? 'Guardar Cambios' : 'Crear Estrategia'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Account Modal */}
      <AnimatePresence>
        {isAccountModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAccountModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={cn(
                "relative w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden transition-all duration-300",
                isDarkMode 
                  ? "bg-[#1F2937] border border-white/10 shadow-[0_0_40px_rgba(255,255,255,0.07)]" 
                  : "bg-white"
              )}
            >
              <div className={cn("p-8 border-b flex justify-between items-center", isDarkMode ? "border-white/10" : "border-gray-100")}>
                <h2 className="text-2xl font-bold">{editingAccount ? 'Editar Cuenta' : 'Nueva Cuenta'}</h2>
                <button 
                  onClick={() => {
                    setIsAccountModalOpen(false);
                    setEditingAccount(null);
                  }} 
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={addAccount} className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">Nombre (Opcional)</label>
                    <input 
                      name="name" 
                      defaultValue={editingAccount?.name || ''} 
                      placeholder="Mi Cuenta Principal" 
                      className={cn(
                        "w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all",
                        isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-gray-50 border-gray-100"
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">ID de Cuenta</label>
                    <input 
                      name="account_id" 
                      defaultValue={editingAccount?.account_id || ''} 
                      required 
                      placeholder="12345678" 
                      className={cn(
                        "w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all",
                        isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-gray-50 border-gray-100"
                      )}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">Capital Inicial</label>
                    <input 
                      type="number" 
                      step="any"
                      name="capital" 
                      defaultValue={editingAccount?.capital || ''} 
                      required 
                      placeholder="10000" 
                      className={cn(
                        "w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all",
                        isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-gray-50 border-gray-100"
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">Tipo de Cuenta</label>
                    <select 
                      name="type" 
                      defaultValue={editingAccount?.type || 'PERSONAL'} 
                      required 
                      className={cn(
                        "w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all",
                        isDarkMode ? "bg-[#1F2937] border-white/10 text-white" : "bg-gray-50 border-gray-100"
                      )}
                    >
                      <option value="PERSONAL" className={isDarkMode ? "bg-[#1F2937] text-white" : ""}>Capital Propio</option>
                      <option value="PROP_FIRM" className={isDarkMode ? "bg-[#1F2937] text-white" : ""}>Prop Firm</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">Objetivo de Ganancia</label>
                    <input 
                      type="number" 
                      step="any"
                      name="profit_target" 
                      defaultValue={editingAccount?.profit_target || ''} 
                      placeholder="1000" 
                      className={cn(
                        "w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all",
                        isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-gray-50 border-gray-100"
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">Límite de Pérdida</label>
                    <input 
                      type="number" 
                      step="any"
                      name="loss_limit" 
                      defaultValue={editingAccount?.loss_limit || ''} 
                      placeholder="500" 
                      className={cn(
                        "w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all",
                        isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-gray-50 border-gray-100"
                      )}
                    />
                  </div>
                </div>

                <button type="submit" className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">
                  {editingAccount ? 'Guardar Cambios' : 'Crear Cuenta'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsModalOpen(false);
                setEditingTrade(null);
              }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={cn(
                "relative w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden transition-all duration-300",
                isDarkMode 
                  ? "bg-[#1F2937] border border-white/10 shadow-[0_0_40px_rgba(255,255,255,0.07)]" 
                  : "bg-white"
              )}
            >
              <div className={cn("p-8 border-b flex justify-between items-center", isDarkMode ? "border-white/10" : "border-gray-100")}>
                <h2 className="text-2xl font-bold">{editingTrade ? 'Editar Operación' : 'Nueva Operación'}</h2>
                <button onClick={() => {
                  setIsModalOpen(false);
                  setEditingTrade(null);
                }} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={addTrade} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">Cuenta</label>
                    <select 
                      name="account_id" 
                      required 
                      defaultValue={editingTrade?.account_id || ''}
                      className={cn(
                        "w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all",
                        isDarkMode ? "bg-[#1F2937] border-white/10 text-white" : "bg-gray-50 border-gray-100"
                      )}
                    >
                      <option value="" className={isDarkMode ? "bg-[#1F2937] text-white" : ""}>Seleccionar cuenta...</option>
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id} className={isDarkMode ? "bg-[#1F2937] text-white" : ""}>{acc.name || acc.account_id}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">Estrategia</label>
                    <select 
                      name="strategy_id" 
                      value={selectedStrategyId || ''}
                      onChange={(e) => setSelectedStrategyId(e.target.value ? parseInt(e.target.value) : null)}
                      className={cn(
                        "w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all",
                        isDarkMode ? "bg-[#1F2937] border-white/10 text-white" : "bg-gray-50 border-gray-100"
                      )}
                    >
                      <option value="" className={isDarkMode ? "bg-[#1F2937] text-white" : ""}>Sin estrategia</option>
                      {strategies.map(s => (
                        <option key={s.id} value={s.id} className={isDarkMode ? "bg-[#1F2937] text-white" : ""}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">Instrumento</label>
                    <input 
                      name="instrument" 
                      required 
                      defaultValue={editingTrade?.instrument || ''}
                      placeholder="EURUSD" 
                      className={cn(
                        "w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all",
                        isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-gray-50 border-gray-100"
                      )}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">Tipo</label>
                    <select 
                      name="type" 
                      defaultValue={editingTrade?.type || 'LONG'}
                      className={cn(
                        "w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all",
                        isDarkMode ? "bg-[#1F2937] border-white/10 text-white" : "bg-gray-50 border-gray-100"
                      )}
                    >
                      <option value="LONG" className={isDarkMode ? "bg-[#1F2937] text-white" : ""}>LONG</option>
                      <option value="SHORT" className={isDarkMode ? "bg-[#1F2937] text-white" : ""}>SHORT</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">Lotaje</label>
                    <input 
                      type="number" 
                      step="any" 
                      name="lots" 
                      required 
                      defaultValue={editingTrade ? (editingTrade.lots * 100).toString() : ''}
                      placeholder="64" 
                      className={cn(
                        "w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all",
                        isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-gray-50 border-gray-100"
                      )}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">Fecha</label>
                    <input 
                      type="date" 
                      name="entry_date" 
                      required 
                      defaultValue={editingTrade?.entry_date || format(new Date(), 'yyyy-MM-dd')} 
                      className={cn(
                        "w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all",
                        isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-gray-50 border-gray-100"
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">Hora</label>
                    <input 
                      type="time" 
                      name="entry_time" 
                      required 
                      defaultValue={editingTrade?.entry_time || format(new Date(), 'HH:mm')} 
                      className={cn(
                        "w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all",
                        isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-gray-50 border-gray-100"
                      )}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">Entrada</label>
                    <input 
                      type="number" 
                      step="any" 
                      name="entry_price" 
                      required 
                      defaultValue={editingTrade?.entry_price || ''}
                      placeholder="1.08500" 
                      className={cn(
                        "w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all",
                        isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-gray-50 border-gray-100"
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">Salida</label>
                    <input 
                      type="number" 
                      step="any" 
                      name="exit_price" 
                      defaultValue={editingTrade?.exit_price || ''}
                      placeholder="1.09000" 
                      className={cn(
                        "w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all",
                        isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-gray-50 border-gray-100"
                      )}
                    />
                  </div>
                </div>

                {selectedStrategyId && (
                  <div className={cn(
                    "p-6 rounded-2xl border space-y-6 transition-all",
                    isDarkMode 
                      ? "bg-white/5 border-white/10" 
                      : "bg-indigo-50/50 border-indigo-100/50"
                  )}>
                    <h3 className="text-xs font-black uppercase text-indigo-500 tracking-widest">Auditor de Disciplina</h3>
                    
                    <div className="space-y-6">
                      {/* Entry Triggers Section */}
                      <div className="space-y-4">
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-tighter">Gatillos de Entrada</p>
                        <div className="grid grid-cols-1 gap-4">
                          {(() => {
                            const strategy = strategies.find(s => s.id === selectedStrategyId);
                            if (!strategy) return null;
                            
                            let triggers: Trigger[] = [];
                            try {
                              triggers = JSON.parse(strategy.entry_triggers || '[]');
                            } catch (e) {}

                            if (triggers.length === 0) return <p className="text-[10px] text-gray-500 italic">Sin gatillos de entrada</p>;

                            return triggers.map((trigger, idx) => {
                              const currentValue = tradeExecutedEntryTriggers[trigger.indicator] || '';
                              const numValue = parseFloat(currentValue);
                              
                              let isValid = false;
                              if (!isNaN(numValue)) {
                                if (trigger.operator === '>') isValid = numValue > trigger.value;
                                if (trigger.operator === '<') isValid = numValue < trigger.value;
                                if (trigger.operator === '=') isValid = numValue === trigger.value;
                              }

                              return (
                                <div key={idx} className="space-y-2">
                                  <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">
                                      {trigger.indicator} ({trigger.operator} {trigger.value})
                                    </label>
                                    <div className={cn(
                                      "w-3 h-3 rounded-full transition-colors shadow-sm",
                                      isValid ? "bg-green-500" : "bg-red-500"
                                    )} />
                                  </div>
                                  <input 
                                    type="number"
                                    step="any"
                                    value={currentValue}
                                    onChange={(e) => setTradeExecutedEntryTriggers({
                                      ...tradeExecutedEntryTriggers,
                                      [trigger.indicator]: e.target.value
                                    })}
                                    placeholder="Valor entrada..."
                                    className={cn(
                                      "w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm",
                                      isDarkMode ? "bg-[#1F2937] border-white/10 text-white" : "bg-white border-indigo-100"
                                    )}
                                  />
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>

                      {/* Exit Triggers Section */}
                      <div className="space-y-4 pt-4 border-t border-indigo-100/50 dark:border-white/5">
                        <p className="text-[10px] font-black text-rose-400 uppercase tracking-tighter">Gatillos de Salida</p>
                        <div className="grid grid-cols-1 gap-4">
                          {(() => {
                            const strategy = strategies.find(s => s.id === selectedStrategyId);
                            if (!strategy) return null;
                            
                            let triggers: Trigger[] = [];
                            try {
                              triggers = JSON.parse(strategy.exit_triggers || '[]');
                            } catch (e) {}

                            if (triggers.length === 0) return <p className="text-[10px] text-gray-500 italic">Sin gatillos de salida</p>;

                            return triggers.map((trigger, idx) => {
                              const currentValue = tradeExecutedExitTriggers[trigger.indicator] || '';
                              const numValue = parseFloat(currentValue);
                              
                              let isValid = false;
                              if (!isNaN(numValue)) {
                                if (trigger.operator === '>') isValid = numValue > trigger.value;
                                if (trigger.operator === '<') isValid = numValue < trigger.value;
                                if (trigger.operator === '=') isValid = numValue === trigger.value;
                              }

                              return (
                                <div key={idx} className="space-y-2">
                                  <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">
                                      {trigger.indicator} ({trigger.operator} {trigger.value})
                                    </label>
                                    <div className={cn(
                                      "w-3 h-3 rounded-full transition-colors shadow-sm",
                                      isValid ? "bg-green-500" : "bg-red-500"
                                    )} />
                                  </div>
                                  <input 
                                    type="number"
                                    step="any"
                                    value={currentValue}
                                    onChange={(e) => setTradeExecutedExitTriggers({
                                      ...tradeExecutedExitTriggers,
                                      [trigger.indicator]: e.target.value
                                    })}
                                    placeholder="Valor salida..."
                                    className={cn(
                                      "w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm",
                                      isDarkMode ? "bg-[#1F2937] border-white/10 text-white" : "bg-white border-indigo-100"
                                    )}
                                  />
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>

                      {strategies.find(s => s.id === selectedStrategyId)?.has_candlestick && (
                        <div className="space-y-4 pt-2 border-t border-indigo-100/50 dark:border-white/5">
                          <div className="flex items-center gap-3">
                            <input 
                              type="checkbox"
                              id="trade_has_patterns"
                              checked={tradeShowCandlestick}
                              onChange={(e) => setTradeShowCandlestick(e.target.checked)}
                              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <label htmlFor="trade_has_patterns" className="text-xs font-bold text-gray-400 uppercase cursor-pointer">
                              Patrones de vela
                            </label>
                          </div>

                          {tradeShowCandlestick && (
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-gray-400 uppercase">Patrón Detectado</label>
                              <select 
                                value={tradeCandlestickUsed}
                                onChange={(e) => setTradeCandlestickUsed(e.target.value)}
                                className={cn(
                                  "w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm",
                                  isDarkMode ? "bg-[#1F2937] border-white/10 text-white" : "bg-white border-indigo-100"
                                )}
                              >
                                <option value="" className={isDarkMode ? "bg-[#1F2937] text-white" : ""}>Seleccionar patrón...</option>
                                <option value="Martillo" className={isDarkMode ? "bg-[#1F2937] text-white" : ""}>Martillo</option>
                                <option value="Doji" className={isDarkMode ? "bg-[#1F2937] text-white" : ""}>Doji</option>
                                <option value="Marubozu" className={isDarkMode ? "bg-[#1F2937] text-white" : ""}>Marubozu</option>
                                <option value="Envolvente" className={isDarkMode ? "bg-[#1F2937] text-white" : ""}>Envolvente</option>
                                <option value="Estrella del Alba" className={isDarkMode ? "bg-[#1F2937] text-white" : ""}>Estrella del Alba</option>
                                <option value="Hombre Colgado" className={isDarkMode ? "bg-[#1F2937] text-white" : ""}>Hombre Colgado</option>
                              </select>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">Riesgo Asumido (%)</label>
                    <input 
                      type="number" 
                      step="any" 
                      name="riesgo_asumido_porcentaje" 
                      required 
                      defaultValue={editingTrade?.riesgo_asumido_porcentaje || ''}
                      placeholder="1.0" 
                      className={cn(
                        "w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all",
                        isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-gray-50 border-gray-100"
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">Posición del TP(%)</label>
                    <input 
                      type="number" 
                      step="any" 
                      name="beneficio_obtenido_porcentaje" 
                      required 
                      defaultValue={editingTrade?.beneficio_obtenido_porcentaje || ''}
                      placeholder="2.5" 
                      className={cn(
                        "w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all",
                        isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-gray-50 border-gray-100"
                      )}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">MAE (%)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      name="mae" 
                      defaultValue={editingTrade?.mae || ''}
                      placeholder="0.5" 
                      className={cn(
                        "w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all",
                        isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-gray-50 border-gray-100"
                      )}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">MFE (%)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      name="mfe" 
                      defaultValue={editingTrade?.mfe || ''}
                      placeholder="3.0" 
                      className={cn(
                        "w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all",
                        isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-gray-50 border-gray-100"
                      )}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">Comentarios</label>
                    <textarea 
                      name="comments" 
                      rows={3} 
                      defaultValue={editingTrade?.comments || ''}
                      placeholder="Notas sobre la operación..." 
                      className={cn(
                        "w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none",
                        isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-gray-50 border-gray-100"
                      )}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">Imagen del Trade</label>
                    <input 
                      type="file" 
                      name="image" 
                      accept="image/*" 
                      className={cn(
                        "w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm",
                        isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-gray-50 border-gray-100"
                      )}
                    />
                  </div>
                </div>

                <button type="submit" className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">
                  Registrar Operación
                </button>
              </form>
            </motion.div>
          </div>
        )}
        {infoModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={cn(
                "max-w-md w-full p-8 rounded-3xl shadow-2xl relative",
                isDarkMode ? "bg-[#1F2937] text-white" : "bg-white text-gray-900"
              )}
            >
              <button 
                onClick={() => setInfoModal(null)}
                className="absolute top-6 right-6 p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
              <h3 className="text-xl font-black mb-4 pr-8">{infoModal.title}</h3>
              <div className={cn(
                "leading-relaxed",
                isDarkMode ? "text-gray-300" : "text-gray-600"
              )}>
                {infoModal.text}
              </div>
              <button 
                onClick={() => setInfoModal(null)}
                className="mt-8 w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors"
              >
                Entendido
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavButton({ active, onClick, icon, label, isDarkMode }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, isDarkMode: boolean }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "p-3 rounded-xl transition-all relative group",
        active 
          ? (isDarkMode ? "bg-white/10 text-white" : "bg-indigo-50 text-indigo-600") 
          : (isDarkMode ? "text-gray-500 hover:bg-white/5 hover:text-gray-300" : "text-gray-400 hover:bg-gray-50 hover:text-gray-600")
      )}
    >
      {icon}
      <span className={cn(
        "absolute left-full ml-4 px-2 py-1 text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50",
        isDarkMode ? "bg-white text-gray-900" : "bg-gray-800 text-white"
      )}>
        {label}
      </span>
    </button>
  );
}

function StatCard({ label, value, sub, color, isDarkMode }: { label: string, value: string, sub: string, color: 'indigo' | 'emerald' | 'rose' | 'amber', isDarkMode: boolean }) {
  const colors = {
    indigo: isDarkMode ? "bg-indigo-500/10 text-indigo-400" : "bg-indigo-50 text-indigo-600",
    emerald: isDarkMode ? "bg-[#508E48]/10 text-[#508E48]" : "bg-[#508E48]/10 text-[#508E48]",
    rose: isDarkMode ? "bg-[#FB7185]/10 text-[#FB7185]" : "bg-rose-50 text-[#FB7185]",
    amber: isDarkMode ? "bg-[#FBBF24]/10 text-[#FBBF24]" : "bg-amber-50 text-[#FBBF24]"
  };

  return (
    <div className={cn(
      "p-6 rounded-2xl border transition-all duration-300 h-full flex flex-col",
      isDarkMode 
        ? "bg-[#1F2937] border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.05)]" 
        : "bg-white border-gray-100 shadow-sm"
    )}>
      <div className="h-10 mb-1 flex items-start">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider leading-tight">{label}</p>
      </div>
      <div className="flex flex-col justify-center flex-grow">
        <div className="flex items-baseline gap-2">
          <h4 className={cn("text-2xl font-bold font-mono", colors[color].split(' ')[1])}>{value}</h4>
        </div>
        <p className={cn("text-[10px] mt-1", isDarkMode ? "text-[#D1D5DB]" : "text-gray-400")}>{sub}</p>
      </div>
    </div>
  );
}
