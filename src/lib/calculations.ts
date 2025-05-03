import type { StockData } from '@/services/stock-data';

export interface CalculatedStockData extends StockData {
    date: string; // Assuming date is available or index can be converted
    '5-EMA': number | null;
    '5-LEMA': number | null;
    '5-HEMA': number | null;
    'ATR': number | null;
    'PP': number | null;
    'H1': number | null;
    'L1': number | null;
    'H2': number | null;
    'L2': number | null;
    'H3': number | null;
    'L3': number | null;
    'H4': number | null;
    'L4': number | null;
    'JNSAR': number | null;
    'Long@': number | null;
    'Short@': number | null;
    'HH': string;
    'HL': string; // Should likely be LL based on context, using HL as requested
    'CL': string;
    // 'Adj_close' seems missing from StockData, add if needed
}

/**
 * Calculates Exponential Moving Average (EMA).
 * Uses a simplified formula. For accuracy, especially with short periods or sparse data,
 * consider libraries or more robust implementations.
 */
function calculateEmaSeries(data: number[], period: number): (number | null)[] {
    if (!data || data.length < period) {
        return Array(data?.length || 0).fill(null);
    }
    const k = 2 / (period + 1);
    const emaArray: (number | null)[] = Array(data.length).fill(null);

    // Calculate initial SMA for the first EMA value
    let sum = 0;
    for (let i = 0; i < period; i++) {
        sum += data[i];
    }
    emaArray[period - 1] = sum / period;

    // Calculate subsequent EMA values
    for (let i = period; i < data.length; i++) {
        const prevEma = emaArray[i - 1];
        if (prevEma !== null) {
             emaArray[i] = (data[i] * k) + (prevEma * (1 - k));
        }
    }
    return emaArray;
}


/**
 * Calculates Average True Range (ATR).
 * Note: This uses EMA for smoothing TR, matching the Python example.
 * Some implementations use Wilder's smoothing (RMA).
 */
function calculateAtrSeries(data: StockData[], period: number = 14): (number | null)[] {
    if (!data || data.length < 2) {
        return Array(data?.length || 0).fill(null);
    }

    const trArray: number[] = [];
    trArray.push(data[0].high - data[0].low); // TR for the first day

    for (let i = 1; i < data.length; i++) {
        const highLow = data[i].high - data[i].low;
        const highClosePrev = Math.abs(data[i].high - data[i - 1].close);
        const lowClosePrev = Math.abs(data[i].low - data[i - 1].close);
        trArray.push(Math.max(highLow, highClosePrev, lowClosePrev));
    }

    // Calculate EMA of TR
    const atrArray = calculateEmaSeries(trArray, period);

    return atrArray;
}

/**
 * Calculates Pivot Points and Standard Support/Resistance Levels.
 */
function calculatePivotPointsForDay(dayData: StockData): { [key: string]: number | null } {
    const { high, low, close } = dayData;
    if (high == null || low == null || close == null) return { PP: null, H1: null, L1: null, H2: null, L2: null, H3: null, L3: null, H4: null, L4: null };

    const pp = (high + low + close) / 3;
    const h1 = (2 * pp) - low;
    const l1 = (2 * pp) - high;
    const h2 = pp + (high - low);
    const l2 = pp - (high - low);
    const h3 = high + 2 * (pp - low);
    const l3 = low - 2 * (high - pp);
    // H4/L4 formulas can vary, using the one from the Python example. VERIFY THIS.
    const h4 = pp + (h3 - l3);
    const l4 = pp - (h3 - l3);

    return { PP: pp, H1: h1, L1: l1, H2: h2, L2: l2, H3: h3, L3: l3, H4: h4, L4: l4 };
}

/**
 * Placeholder for JNSAR calculation.
 * !! THIS IS A PLACEHOLDER BASED ON THE PROVIDED PYTHON - REPLACE WITH YOUR ACTUAL JNSAR LOGIC !!
 * The logic below resembles Parabolic SAR and is complex. Verify against your source sheets.
 */
function calculateJnsarSeries(data: StockData[], atrSeries: (number | null)[], atrPeriod: number = 14, factor: number = 2): (number | null)[] {
    if (!data || data.length < 2) {
        return Array(data?.length || 0).fill(null);
    }

    const sarArray: (number | null)[] = Array(data.length).fill(null);
    const trend: (1 | -1)[] = Array(data.length).fill(1); // 1 for long, -1 for short
    const ep: number[] = Array(data.length).fill(0); // Extreme Point
    const af: number[] = Array(data.length).fill(0.02); // Acceleration Factor

    // Initial values
    sarArray[0] = data[0].low; // Initial guess
    trend[0] = 1; // Assume starting long
    ep[0] = data[0].high;
    af[0] = 0.02;


    for (let i = 1; i < data.length; i++) {
        const prevSar = sarArray[i - 1];
        const prevTrend = trend[i - 1];
        const prevEp = ep[i - 1];
        const prevAf = af[i - 1];

        const currentHigh = data[i].high;
        const currentLow = data[i].low;
        const prevLow = data[i-1]?.low; // Need previous low for comparison
        const prevPrevLow = data[i-2]?.low; // Need low from 2 periods ago
        const prevHigh = data[i-1]?.high;
        const prevPrevHigh = data[i-2]?.high;


        if (prevSar === null || prevTrend === null || prevEp === null || prevAf === null) {
            // Cannot calculate if previous values are missing, propagate null
             sarArray[i] = null;
             trend[i] = trend[i-1]; // Carry forward trend assumption
             ep[i] = ep[i-1];
             af[i] = af[i-1];
             continue;
        }


        let currentSar: number;

        if (prevTrend === 1) { // If uptrend
            currentSar = prevSar + prevAf * (prevEp - prevSar);

            // SAR cannot be higher than the low of the previous two periods
            const lowMin = Math.min(prevLow ?? currentLow, prevPrevLow ?? currentLow);
            currentSar = Math.min(currentSar, lowMin);


            if (currentLow < currentSar) { // Trend reverses to short
                trend[i] = -1;
                currentSar = prevEp; // SAR becomes the previous Extreme Point High
                ep[i] = currentLow;
                af[i] = 0.02; // Reset AF
            } else { // Trend continues long
                trend[i] = 1;
                ep[i] = Math.max(prevEp, currentHigh); // Update Extreme Point High
                // Increase AF if new EP is made, capped at 0.20
                af[i] = (ep[i] > prevEp) ? Math.min(0.2, prevAf + 0.02) : prevAf;
                currentSar = currentSar; // Keep calculated SAR for continuing trend
            }
        } else { // If downtrend
            currentSar = prevSar - prevAf * (prevSar - prevEp);

             // SAR cannot be lower than the high of the previous two periods
             const highMax = Math.max(prevHigh ?? currentHigh, prevPrevHigh ?? currentHigh);
             currentSar = Math.max(currentSar, highMax);


            if (currentHigh > currentSar) { // Trend reverses to long
                trend[i] = 1;
                currentSar = prevEp; // SAR becomes the previous Extreme Point Low
                ep[i] = currentHigh;
                af[i] = 0.02; // Reset AF
            } else { // Trend continues short
                trend[i] = -1;
                ep[i] = Math.min(prevEp, currentLow); // Update Extreme Point Low
                 // Increase AF if new EP is made, capped at 0.20
                af[i] = (ep[i] < prevEp) ? Math.min(0.2, prevAf + 0.02) : prevAf;
                currentSar = currentSar; // Keep calculated SAR for continuing trend
            }
        }
         sarArray[i] = currentSar;
    }

    return sarArray;
}


/**
 * Processes raw stock data to add calculated indicators.
 * @param rawData Array of raw StockData.
 * @param dates Array of corresponding date strings.
 * @returns Array of CalculatedStockData.
 */
export function processStockData(rawData: StockData[], dates: string[]): CalculatedStockData[] {
    if (!rawData || rawData.length === 0 || rawData.length !== dates.length) {
        return [];
    }

    const closePrices = rawData.map(d => d.close);
    const lowPrices = rawData.map(d => d.low);
    const highPrices = rawData.map(d => d.high);

    const ema5 = calculateEmaSeries(closePrices, 5);
    const lema5 = calculateEmaSeries(lowPrices, 5);
    const hema5 = calculateEmaSeries(highPrices, 5);
    const atr14 = calculateAtrSeries(rawData, 14);
    const jnsar = calculateJnsarSeries(rawData, atr14); // Pass calculated ATR

    const calculatedData: CalculatedStockData[] = rawData.map((dayData, index) => {
        const pivots = calculatePivotPointsForDay(dayData);

        // !! VERIFY THESE ENTRY POINT FORMULAS FROM YOUR SHEET !!
        const longEntry = pivots['L1']; // Placeholder - CHECK YOUR SHEET
        const shortEntry = pivots['H1']; // Placeholder - CHECK YOUR SHEET

        // !! VERIFY HH/HL/CL LOGIC FROM YOUR SHEET !!
        const prevHigh = index > 0 ? rawData[index - 1].high : null;
        const prevLow = index > 0 ? rawData[index - 1].low : null;
        const prevClose = index > 0 ? rawData[index - 1].close : null;

        const hh = prevHigh !== null && dayData.high > prevHigh ? 'Y' : '0';
        // Assuming 'HL' meant 'LL' (Lower Low) based on context
        const ll = prevLow !== null && dayData.low < prevLow ? 'Y' : '0';
        const cl = prevClose !== null && dayData.close < prevClose ? 'Y' : '0';

        return {
            ...dayData,
            date: dates[index],
            '5-EMA': ema5[index] ?? null,
            '5-LEMA': lema5[index] ?? null,
            '5-HEMA': hema5[index] ?? null,
            'ATR': atr14[index] ?? null,
            'PP': pivots['PP'] ?? null,
            'H1': pivots['H1'] ?? null,
            'L1': pivots['L1'] ?? null,
            'H2': pivots['H2'] ?? null,
            'L2': pivots['L2'] ?? null,
            'H3': pivots['H3'] ?? null,
            'L3': pivots['L3'] ?? null,
            'H4': pivots['H4'] ?? null,
            'L4': pivots['L4'] ?? null,
            'JNSAR': jnsar[index] ?? null,
            'Long@': longEntry ?? null,
            'Short@': shortEntry ?? null,
            'HH': hh,
            'HL': ll, // Using calculated LL for HL column as assumed
            'CL': cl,
        };
    });

    return calculatedData;
}
