# TradeFlow | Reversal Analysis & Trading Journal

<div align="center">
  <img width="1200" src="https://via.placeholder.com/1200x475.png?text=TradeFlow+Interface+Preview" alt="TradeFlow Banner" />
</div>

## 📌 Overview
**TradeFlow** is a professional logging and auditing application specifically designed for traders looking to refine their execution 
in financial markets. It offers real-time operational data and high-impact performance ratios. Unlike conventional Excel spreadsheets, 
this program is optimized to capture critical technical metrics by allowing traders to define custom strategies, precise entry/exit points, 
and candlestick pattern confirmations, enabling deep statistical analysis of trading plan compliance.

## 🚀 Key Features
- **Specialized Logging:** Optimized fields to capture indicator levels and technical parameters established by the trader.
- **Pattern Analysis:** Automatic trade categorization based on candlestick confirmation patterns (Hammer, Doji, Marubozu).
- **Integrated Risk Management:** Automatic Risk/Reward (RR) ratio calculation and stop-loss validation (optimized for the 0.5% - 0.7% range).
- **Target Tracking:** Monitoring of exits based on trader-defined objectives and strategy-specific rules.

## 🛠️ Tech Stack
- **Language:** JavaScript / TypeScript
- **Runtime:** Node.js
- **Framework:** Next.js / React.js
- **Persistence:** SQLite / JSON 
- **Interface:** High-performance Reactive Web App developed with **React.js** and **Next.js**.
- **UX/UI:** Minimalist design focused on data entry efficiency, utilizing dynamic components for real-time metric tracking and native **Dark Mode** support.

## 📊 Logging Methodology
The system is designed to audit trades based on specific quantitative and qualitative data:
1. **Entry Conditions:** Pre-defined entry points including symbol, strategy type, account used, timestamp, and entry price.
2. **Advanced Metrics:** Tracking of MAE (Maximum Adverse Excursion), MFE (Maximum Favorable Excursion), %TP (Take Profit), and %SL (Stop Loss).
3. **Exit Management:** Systematic tracking based on technical signals such as STOCH levels or EMA45 proximity.

## 🔧 Installation & Setup
1. **Clone the repository:**
   ```bash
   git clone [https://github.com/your-username/TradeFlow.git](https://github.com/your-username/TradeFlow.git)
