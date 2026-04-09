# TradeFlow | Sistema de Bitácora y Análisis de Reversiones

<div align="center">
  <img width="1200" src="https://via.placeholder.com/1200x475.png?text=TradeLog+Interface+Preview" alt="TradeLog Banner" />
</div>

## 📌 Descripción
**TradeLog** es una aplicación de registro y auditoría diseñada específicamente para traders que buscan mejorar y auditar su experiencia en los mercados financieros, ofreciendo datos en tiempo real de la operativa y ratios de alta importancia para su trading. A diferencia de una hoja de Excel convencional, este programa está optimizada para capturar métricas críticas de indicadores técnicos usados por el trader mediante la introducción y nombramiento de sus estrategias con sus puntos de entrada y salida asi como la selección de patrones de velas, permitiendo un análisis estadístico profundo del cumplimiento del plan de trading.

## 🚀 Funcionalidades Clave
- **Registro Especializado:** Campos optimizados para capturar niveles de los indicadores establecidos por el trader
- **Análisis de Patrones:** Categorización automática de trades según el patrón de confirmación de la vela (Hammer, Doji, Marubozu).
- **Gestión de Riesgo Integrada:** Cálculo automático de Ratio Riesgo/Beneficio (RR) y validación de stops (rango 0.5% - 0.7%).
- **Cierre por Objetivos:** Seguimiento de salidas basadas en la elección del trader.

## 🛠️ Stack Tecnológico
- **Lenguaje:** Python / JavaScript (según lo que estés usando ahora)
- **Persistencia:** SQLite / Archivos JSON
- **Interfaz:** Interfaz: Aplicación Web reactiva desarrollada con React.js y Next.js.
UX/UI: Diseño minimalista enfocado en la eficiencia de entrada de datos, utilizando componentes dinámicos para el seguimiento de métricas en tiempo real y soporte nativo para Dark Mode.

## 📊 Metodología de Registro
El sistema está diseñado para auditar trades basados en:
1. **Condición de Entrada:** puntos de entrada estipulados por el trader previamente asi como el símbolo, al estrategia empleada, la cuenta operada, el día, hora, $ de entrada/salida, MAE/MFE, %TP y %SL.
3. **Gestión de Salida:** Cruce de niveles en STOCH o proximidad a EMA45.

## 🔧 Instalación y Uso
1. **Clonar el repositorio:**
   ```bash
   git clone [https://github.com/tu-usuario/TradeLog-Bitacora.git](https://github.com/tu-usuario/TradeLog-Bitacora.git)
