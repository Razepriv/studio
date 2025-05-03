import type { StockData } from '@/services/stock-data';

export interface CalculatedStockData extends StockData {
    // date is already in StockData
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
    'LL': string; // Renamed from HL based on common technical indicators
    'CL': string;
    // 'Adj_close' seems missing from StockData, add if needed
}

/**
 * Calculates Exponential Moving Average (EMA).
 * Handles potential null/undefined values in input data.
 */
function calculateEmaSeries(data: (number | null | undefined)[], period: number): (number | null)[] {
    const validData = data.filter(d => typeof d === 'number') as number[];
    const emaArrayFull: (number | null)[] = Array(data.length).fill(null);

    if (validData.length < period) {
        return emaArrayFull;
    }

    const k = 2 / (period + 1);
    const emaArrayCalc: (number | null)[] = Array(validData.length).fill(null);

    // Calculate initial SMA for the first EMA value using only valid data
    let sum = 0;
    for (let i = 0; i < period; i++) {
        sum += validData[i];
    }
    emaArrayCalc[period - 1] = sum / period;

    // Calculate subsequent EMA values using only valid data
    for (let i = period; i < validData.length; i++) {
        const prevEma = emaArrayCalc[i - 1];
        const currentData = validData[i];
        if (prevEma !== null && currentData !== null && currentData !== undefined) {
            emaArrayCalc[i] = (currentData * k) + (prevEma * (1 - k));
        } else if (prevEma !== null) {
            // If current data is invalid, carry forward the previous EMA? Or null? Decide strategy.
            // For now, propagating null if current data invalid after the start.
            // emaArrayCalc[i] = prevEma; // Carry forward
             emaArrayCalc[i] = null; // Propagate null
        }
    }

    // Map calculated EMAs back to the original data positions
    let calcIndex = 0;
    for(let i=0; i< data.length; i++){
        if(typeof data[i] === 'number'){
            if(calcIndex < emaArrayCalc.length){
                emaArrayFull[i] = emaArrayCalc[calcIndex];
            }
            calcIndex++;
        }
    }


    return emaArrayFull;
}


/**
 * Calculates Average True Range (ATR).
 * Handles potential null/undefined values in input data.
 */
function calculateAtrSeries(data: StockData[], period: number = 14): (number | null)[] {
     const atrArrayFull: (number | null)[] = Array(data.length).fill(null);

     if (!data || data.length < 2) {
        return atrArrayFull;
    }

    const trArray: (number | null)[] = [];

    // Calculate first TR if possible
    if (typeof data[0]?.high === 'number' && typeof data[0]?.low === 'number') {
         trArray.push(data[0].high - data[0].low);
    } else {
        trArray.push(null);
    }


    for (let i = 1; i < data.length; i++) {
        const current = data[i];
        const prev = data[i - 1];

        if (typeof current?.high !== 'number' ||
            typeof current?.low !== 'number' ||
            typeof prev?.close !== 'number')
        {
            trArray.push(null); // Cannot calculate TR if data is missing
            continue;
        }

        const highLow = current.high - current.low;
        const highClosePrev = Math.abs(current.high - prev.close);
        const lowClosePrev = Math.abs(current.low - prev.close);
        trArray.push(Math.max(highLow, highClosePrev, lowClosePrev));
    }

    // Calculate EMA of TR, handling nulls within calculateEmaSeries
    const atrArrayCalc = calculateEmaSeries(trArray, period);

    return atrArrayCalc; // EMA function already handles mapping back
}

/**
 * Calculates Pivot Points and Standard Support/Resistance Levels.
 */
function calculatePivotPointsForDay(dayData: StockData | undefined): { [key: string]: number | null } {
    const defaults = { PP: null, H1: null, L1: null, H2: null, L2: null, H3: null, L3: null, H4: null, L4: null };
    if (!dayData || typeof dayData.high !== 'number' || typeof dayData.low !== 'number' || typeof dayData.close !== 'number') {
        return defaults;
    }

    const { high, low, close } = dayData;

    const pp = (high + low + close) / 3;
    const range = high - low; // Basic range

    if (range < 0) return defaults; // Should not happen with valid data

    const h1 = (2 * pp) - low;
    const l1 = (2 * pp) - high;
    const h2 = pp + range;
    const l2 = pp - range;
    const h3 = high + 2 * (pp - low); // h3 = h1 + range; Also valid: pp + (h2-l2)
    const l3 = low - 2 * (high - pp); // l3 = l1 - range; Also valid: pp - (h2-l2)

    // H4/L4 formulas using H3/L3 (ensure H3/L3 are valid first)
    // Using a simpler H4 = H3 + Range, L4 = L3 - Range approach often seen
    const h4 = h3 + range; // or pp + (h3 - l3);
    const l4 = l3 - range; // or pp - (h3 - l3);


    return { PP: pp, H1: h1, L1: l1, H2: h2, L2: l2, H3: h3, L3: l3, H4: h4, L4: l4 };
}

/**
 * Placeholder for JNSAR calculation - Parabolic SAR like logic.
 * !! THIS IS A PLACEHOLDER - VERIFY AND REPLACE WITH YOUR ACTUAL JNSAR LOGIC !!
 * Added more robust handling of missing data.
 */
function calculateJnsarSeries(data: StockData[], atrSeries: (number | null)[], atrPeriod: number = 14, factor: number = 2): (number | null)[] {
    const sarArray: (number | null)[] = Array(data.length).fill(null);
    if (!data || data.length < 2) {
        return sarArray;
    }

    // Need valid data to start
     let startIndex = data.findIndex(d => typeof d?.low === 'number' && typeof d?.high === 'number');
     if (startIndex === -1 || startIndex >= data.length -1) return sarArray; // Not enough valid data


    const trend: (1 | -1 | null)[] = Array(data.length).fill(null);
    const ep: (number | null)[] = Array(data.length).fill(null); // Extreme Point
    const af: (number | null)[] = Array(data.length).fill(null); // Acceleration Factor

    // Initial values at startIndex
    sarArray[startIndex] = data[startIndex].low; // Initial guess
    trend[startIndex] = 1; // Assume starting long
    ep[startIndex] = data[startIndex].high;
    af[startIndex] = 0.02;


    for (let i = startIndex + 1; i < data.length; i++) {
        const prevSar = sarArray[i - 1];
        const prevTrend = trend[i - 1];
        const prevEp = ep[i - 1];
        const prevAf = af[i - 1];

        const currentHigh = data[i]?.high;
        const currentLow = data[i]?.low;
        const prevLow = data[i-1]?.low;
        const prevPrevLow = data[i-2]?.low;
        const prevHigh = data[i-1]?.high;
        const prevPrevHigh = data[i-2]?.high;

        // Check if necessary data for calculation exists
         if (prevSar === null || prevTrend === null || prevEp === null || prevAf === null ||
             typeof currentHigh !== 'number' || typeof currentLow !== 'number' ||
             typeof prevLow !== 'number' || typeof prevHigh !== 'number') {
             // Cannot calculate, propagate null state or previous state?
             // Propagating null for SAR, carrying trend/ep/af might be complex if data gaps are large
             sarArray[i] = null;
             trend[i] = prevTrend; // Carry forward trend assumption (might be wrong)
             ep[i] = prevEp;
             af[i] = prevAf;
             continue;
         }

        let currentSar: number;

        if (prevTrend === 1) { // If uptrend
            currentSar = prevSar + prevAf * (prevEp - prevSar);

            // SAR cannot be higher than the low of the previous two periods (if available)
             const low1 = prevLow;
             const low2 = typeof prevPrevLow === 'number' ? prevPrevLow : prevLow;
             const lowMin = Math.min(low1, low2);
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
                // currentSar = currentSar; // Keep calculated SAR for continuing trend - already assigned
            }
        } else { // If downtrend (prevTrend === -1)
            currentSar = prevSar - prevAf * (prevSar - prevEp);

             // SAR cannot be lower than the high of the previous two periods (if available)
             const high1 = prevHigh;
             const high2 = typeof prevPrevHigh === 'number' ? prevPrevHigh : prevHigh;
             const highMax = Math.max(high1, high2);
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
                // currentSar = currentSar; // Keep calculated SAR for continuing trend - already assigned
            }
        }
         sarArray[i] = currentSar;
    }

    return sarArray;
}


/**
 * Processes raw stock data to add calculated indicators.
 * @param rawData Array of raw StockData. Dates are assumed to be part of StockData.
 * @returns Array of CalculatedStockData.
 */
export function processStockData(rawData: StockData[], dates: string[] /* dates param might be redundant if already in rawData */): CalculatedStockData[] {
    if (!rawData || rawData.length === 0) {
        return [];
    }

    // Ensure rawData has dates if they weren't passed separately
    const dataWithDates = rawData.map((d, i) => ({ ...d, date: d.date || dates[i]}));


    const closePrices = dataWithDates.map(d => d.close);
    const lowPrices = dataWithDates.map(d => d.low);
    const highPrices = dataWithDates.map(d => d.high);

    const ema5 = calculateEmaSeries(closePrices, 5);
    const lema5 = calculateEmaSeries(lowPrices, 5);
    const hema5 = calculateEmaSeries(highPrices, 5);
    const atr14 = calculateAtrSeries(dataWithDates, 14); // Pass full data
    const jnsar = calculateJnsarSeries(dataWithDates, atr14); // Pass full data and calculated ATR

    const calculatedData: CalculatedStockData[] = dataWithDates.map((dayData, index) => {
        // Calculate pivots based on *previous* day's data for trading signals today
        const prevDayData = index > 0 ? dataWithDates[index - 1] : undefined;
        const pivots = calculatePivotPointsForDay(prevDayData); // Use previous day for PP etc.

        // !! VERIFY THESE ENTRY POINT FORMULAS FROM YOUR SHEET !!
        // Entry points are typically based on the *previous* day's pivots
        const longEntry = pivots['L1']; // Placeholder - CHECK YOUR SHEET (e.g., L1, PP, etc.)
        const shortEntry = pivots['H1']; // Placeholder - CHECK YOUR SHEET (e.g., H1, PP, etc.)

        // Calculate HH, LL, CL based on current day vs previous day
        const prevHigh = prevDayData?.high;
        const prevLow = prevDayData?.low;
        const prevClose = prevDayData?.close;

        const currentHigh = dayData.high;
        const currentLow = dayData.low;
        const currentClose = dayData.close;

        const hh = (typeof currentHigh === 'number' && typeof prevHigh === 'number' && currentHigh > prevHigh) ? 'Y' : '0';
        const ll = (typeof currentLow === 'number' && typeof prevLow === 'number' && currentLow < prevLow) ? 'Y' : '0'; // Lower Low
        const cl = (typeof currentClose === 'number' && typeof prevClose === 'number' && currentClose < prevClose) ? 'Y' : '0'; // Closing Lower

        // Get today's pivot values (calculated from prev day) for display
        const displayPivots = calculatePivotPointsForDay(prevDayData);


        return {
            ...dayData,
            // date: dayData.date, // Already includes date
            '5-EMA': ema5[index] ?? null,
            '5-LEMA': lema5[index] ?? null,
            '5-HEMA': hema5[index] ?? null,
            'ATR': atr14[index] ?? null,
            'PP': displayPivots['PP'] ?? null,
            'H1': displayPivots['H1'] ?? null,
            'L1': displayPivots['L1'] ?? null,
            'H2': displayPivots['H2'] ?? null,
            'L2': displayPivots['L2'] ?? null,
            'H3': displayPivots['H3'] ?? null,
            'L3': displayPivots['L3'] ?? null,
            'H4': displayPivots['H4'] ?? null,
            'L4': displayPivots['L4'] ?? null,
            'JNSAR': jnsar[index] ?? null, // JNSAR is typically calculated up to the current day
            'Long@': longEntry ?? null,   // Based on previous day's pivots
            'Short@': shortEntry ?? null, // Based on previous day's pivots
            'HH': hh,
            'LL': ll, // Use calculated LL
            'CL': cl,
        };
    });

     // Remove the first row if pivot points are based on the previous day,
     // as the first row won't have valid pivots to display/use.
     // Or handle the first row display appropriately (e.g., show '-' for pivot columns).
     // For simplicity here, returning all rows, knowing the first row's pivots are null.
     // If the first row MUST be removed: return calculatedData.slice(1);
    return calculatedData;
}
