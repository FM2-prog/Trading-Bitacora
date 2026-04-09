export interface Account {
  id: number;
  name: string | null;
  account_id: string;
  capital: number;
  type: 'PERSONAL' | 'PROP_FIRM';
  profit_target: number | null;
  loss_limit: number | null;
}

export interface Strategy {
  id: number;
  name: string;
  entry_triggers: string | null; // JSON string of Trigger[]
  exit_triggers: string | null;  // JSON string of Trigger[]
  has_candlestick: boolean;
  created_at: string;
}

export interface Trigger {
  indicator: string;
  operator: '>' | '<' | '=';
  value: number;
}

export interface Trade {
  id: number;
  account_id: number | null;
  strategy_id: number | null;
  instrument: string;
  entry_date: string;
  entry_time: string;
  lots: number;
  entry_price: number;
  exit_price: number | null;
  sl: number | null;
  tp: number | null;
  profit: number;
  type: 'LONG' | 'SHORT';
  status: 'WIN' | 'LOSS' | 'BE' | 'OPEN';
  comments: string | null;
  image_url: string | null;
  executed_entry_triggers: string | null; // JSON string of Record<string, number>
  executed_exit_triggers: string | null;  // JSON string of Record<string, number>
  candlestick_used: string | null;
  riesgo_asumido_porcentaje: number | null;
  beneficio_obtenido_porcentaje: number | null;
  mae: number | null;
  mfe: number | null;
  riesgo_asumido_dinero: number | null;
}

export interface Stats {
  winRate: number;
  avgWin: number;
  avgLoss: number;
  avgProfit: number;
  avgRR: number;
  totalProfit: number;
  totalTrades: number;
}
