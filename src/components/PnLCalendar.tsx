import React, { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, addMonths, subMonths, isSameMonth } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { Trade } from '../types';

interface PnLCalendarProps {
  trades: Trade[];
  isDarkMode: boolean;
}

export const PnLCalendar: React.FC<PnLCalendarProps> = ({ trades, isDarkMode }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);

  // Mock data if no trades are provided or for demonstration
  const displayTrades = useMemo(() => {
    if (trades.length > 0) return trades;
    
    // Generate some mock trades for the current month and surrounding months
    const mockTrades: any[] = [];
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start, end });
    
    days.forEach(day => {
      // 60% chance of having a trade on a given day
      if (Math.random() > 0.4) {
        mockTrades.push({
          id: Math.random(),
          entry_date: format(day, 'yyyy-MM-dd'),
          profit: (Math.random() - 0.35) * 400, // Slightly biased towards profit
          status: 'WIN'
        });
      }
    });
    return mockTrades;
  }, [trades, currentMonth]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const getDayPnL = (day: Date) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return displayTrades
      .filter(t => t.entry_date === dayStr)
      .reduce((acc, t) => acc + t.profit, 0);
  };

  const monthlyPnL = useMemo(() => {
    return displayTrades
      .filter(t => isSameMonth(new Date(t.entry_date), currentMonth))
      .reduce((acc, t) => acc + t.profit, 0);
  }, [displayTrades, currentMonth]);

  // Relative PnL calculation (using a base of 10000 for demo)
  const baseCapital = 10000;
  const relativePnL = (monthlyPnL / baseCapital) * 100;

  const nextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
    setCurrentWeekIndex(0);
  };
  const prevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
    setCurrentWeekIndex(0);
  };
  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    // Find week index for today if needed, but 0 is fine for reset
    setCurrentWeekIndex(0);
  };

  const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom', 'Total'];

  // Group days by weeks
  const weeks: Date[][] = [];
  let currentWeek: Date[] = [];
  calendarDays.forEach((day) => {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });

  const nextWeek = () => {
    if (currentWeekIndex < weeks.length - 1) {
      setCurrentWeekIndex(currentWeekIndex + 1);
    } else {
      nextMonth();
    }
  };

  const prevWeek = () => {
    if (currentWeekIndex > 0) {
      setCurrentWeekIndex(currentWeekIndex - 1);
    } else {
      // Go to previous month and last week
      const prev = subMonths(currentMonth, 1);
      setCurrentMonth(prev);
      // Need to recalculate weeks for prev month to get last index
      const pStart = startOfWeek(startOfMonth(prev), { weekStartsOn: 1 });
      const pEnd = endOfWeek(endOfMonth(prev), { weekStartsOn: 1 });
      const pDays = eachDayOfInterval({ start: pStart, end: pEnd });
      setCurrentWeekIndex(Math.floor(pDays.length / 7) - 1);
    }
  };

  const activeWeek = weeks[currentWeekIndex] || [];
  const weekTotalPnL = activeWeek.reduce((acc, day) => acc + getDayPnL(day), 0);

  return (
    <div className={cn(
      "p-4 sm:p-6 rounded-2xl border transition-all duration-300",
      isDarkMode 
        ? "bg-[#1F2937] border-white/10 shadow-[0_0_20px_rgba(255,255,255,0.05)]" 
        : "bg-white border-gray-100 shadow-sm"
    )}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex flex-col">
          <h3 className="font-bold text-lg">PnL Calendar</h3>
          <div className="flex items-center gap-3 mt-1">
            <span className={cn(
              "text-sm font-mono font-bold",
              monthlyPnL > 0 ? "text-[#508E48]" : monthlyPnL < 0 ? "text-[#FB7185]" : "text-[#686A6C]"
            )}>
              {monthlyPnL >= 0 ? '+' : ''}{monthlyPnL.toFixed(2)} USD
            </span>
            <span className={cn(
              "text-xs px-2 py-0.5 rounded-full font-bold",
              monthlyPnL > 0 ? "bg-[#508E48]/10 text-[#508E48]" : monthlyPnL < 0 ? "bg-[#FB7185]/10 text-[#FB7185]" : "bg-[#686A6C]/10 text-[#686A6C]"
            )}>
              {monthlyPnL >= 0 ? '+' : ''}{relativePnL.toFixed(2)}%
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-xl w-full sm:w-auto justify-between sm:justify-start">
          <button 
            onClick={() => {
              // Check if mobile or desktop
              if (window.innerWidth < 768) prevWeek();
              else prevMonth();
            }}
            className={cn(
              "p-2 rounded-lg transition-colors shrink-0",
              isDarkMode ? "hover:bg-white/10 text-gray-400" : "hover:bg-white text-gray-600 shadow-sm"
            )}
          >
            <ChevronLeft size={18} />
          </button>
          
          <div className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-1 min-w-0">
            <span className="font-bold text-center text-[10px] sm:text-xs uppercase tracking-widest leading-tight truncate sm:whitespace-nowrap">
              <span className="md:hidden">Semana {currentWeekIndex + 1} - </span>
              {format(currentMonth, 'MMMM yyyy')}
            </span>
            <button 
              onClick={goToToday}
              className={cn(
                "px-2 py-1 rounded-md text-[9px] sm:text-[10px] font-bold uppercase tracking-tighter transition-all shrink-0",
                isDarkMode ? "bg-white/10 text-gray-300 hover:bg-white/20" : "bg-white text-indigo-600 shadow-sm hover:bg-gray-50"
              )}
            >
              Hoy
            </button>
          </div>

          <button 
            onClick={() => {
              if (window.innerWidth < 768) nextWeek();
              else nextMonth();
            }}
            className={cn(
              "p-2 rounded-lg transition-colors shrink-0",
              isDarkMode ? "hover:bg-white/10 text-gray-400" : "hover:bg-white text-gray-600 shadow-sm"
            )}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Desktop View (Grid) */}
      <div className="hidden md:grid grid-cols-8 gap-2">
        {/* Weekday headers */}
        {weekDays.map(day => (
          <div key={day} className="text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest py-2">
            {day}
          </div>
        ))}

        {/* Calendar days */}
        {weeks.map((week, weekIdx) => {
          let weekTotal = 0;
          return (
            <React.Fragment key={weekIdx}>
              {week.map(day => {
                const pnl = getDayPnL(day);
                weekTotal += pnl;
                const isCurrentMonth = isSameMonth(day, currentMonth);
                
                return (
                  <div 
                    key={day.toString()}
                    className={cn(
                      "aspect-[1.4/1] p-2 rounded-xl border flex flex-col justify-between transition-all",
                      isDarkMode 
                        ? "bg-[#111827]/30 border-white/5" 
                        : "bg-gray-50/50 border-gray-100",
                      !isCurrentMonth && "opacity-10 grayscale"
                    )}
                  >
                    <span className="text-[9px] font-bold text-gray-500/40">{format(day, 'd')}</span>
                    <span className={cn(
                      "text-[16px] font-mono font-bold text-center truncate",
                      pnl > 0 ? "text-[#508E48]" : pnl < 0 ? "text-[#FB7185]" : "text-[#686A6C]"
                    )}>
                      {pnl !== 0 ? `${pnl > 0 ? '+' : ''}${pnl.toFixed(0)}` : '-'}
                    </span>
                  </div>
                );
              })}
              {/* Weekly Total Column */}
              <div className={cn(
                "aspect-[1.4/1] p-2 rounded-xl border flex flex-col justify-between transition-all",
                isDarkMode ? "bg-indigo-500/10 border-indigo-500/20" : "bg-indigo-50 border-indigo-100"
              )}>
                <span className="text-[9px] font-bold text-indigo-400/40">W{weekIdx + 1}</span>
                <span className={cn(
                  "text-[16px] font-mono font-bold text-center truncate",
                  weekTotal > 0 ? "text-[#508E48]" : weekTotal < 0 ? "text-[#FB7185]" : "text-[#686A6C]"
                )}>
                  {weekTotal !== 0 ? `${weekTotal > 0 ? '+' : ''}${weekTotal.toFixed(0)}` : '-'}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Mobile View (Weekly List) */}
      <div className="md:hidden space-y-1">
        {activeWeek.map((day) => {
          const pnl = getDayPnL(day);
          const pnlPercent = (pnl / baseCapital) * 100;
          const isCurrentMonth = isSameMonth(day, currentMonth);

          return (
            <div 
              key={day.toString()}
              className={cn(
                "flex justify-between items-center py-4 border-b transition-colors",
                isDarkMode ? "border-white/5" : "border-gray-100",
                !isCurrentMonth && "opacity-40"
              )}
            >
              <div className="flex flex-col">
                <span className={cn(
                  "text-xs font-bold uppercase tracking-wider",
                  isDarkMode ? "text-gray-300" : "text-gray-700"
                )}>
                  {format(day, 'EEEE', { locale: undefined })}
                </span>
                <span className="text-[10px] text-gray-400 font-medium">
                  {format(day, 'd MMMM')}
                </span>
              </div>
              
              <div className="text-right">
                <div className={cn(
                  "text-lg font-mono font-bold",
                  pnl > 0 ? "text-[#508E48]" : pnl < 0 ? "text-[#FB7185]" : "text-[#686A6C]"
                )}>
                  {pnl !== 0 ? `${pnl > 0 ? '+' : ''}${pnl.toFixed(2)}` : '0.00'}
                </div>
                {pnl !== 0 && (
                  <div className={cn(
                    "text-[10px] font-bold",
                    pnl > 0 ? "text-[#508E48]/70" : "text-[#FB7185]/70"
                  )}>
                    {pnl > 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Weekly Total Row */}
        <div className={cn(
          "flex justify-between items-center py-5 mt-2 rounded-xl px-4",
          isDarkMode ? "bg-indigo-500/10" : "bg-indigo-50"
        )}>
          <span className="font-bold text-sm uppercase tracking-widest text-indigo-400">
            Total Semana
          </span>
          <div className="text-right">
            <div className={cn(
              "text-xl font-mono font-bold",
              weekTotalPnL > 0 ? "text-[#508E48]" : weekTotalPnL < 0 ? "text-[#FB7185]" : "text-[#686A6C]"
            )}>
              {weekTotalPnL > 0 ? '+' : ''}{weekTotalPnL.toFixed(2)}
            </div>
            <div className={cn(
              "text-xs font-bold",
              weekTotalPnL > 0 ? "text-[#508E48]/70" : weekTotalPnL < 0 ? "text-[#FB7185]/70" : "text-[#686A6C]/70"
            )}>
              {((weekTotalPnL / baseCapital) * 100).toFixed(2)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
