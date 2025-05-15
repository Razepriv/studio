
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
    'Long@': number | null;  // Entry based on prev day pivots (e.g., L1)
    'Short@': number | null; // Entry based on prev day pivots (e.g., H1)
    'HH': string; // Higher High ('Y' or '0')
    'LL': string; // Lower Low ('Y' or '0')
    'CL': string; // Close Lower ('Y' or '0')
    'Diff': number | null; // High - Low
    'AvgVolume': number | null; // Average Volume (e.g., 20-day SMA)
    'Volume > 150%': boolean | null; // Volume > 1.5 * AvgVolume
    'LongTarget': number | null; // Calculated Long Target/Exit
    'ShortTarget': number | null; // Calculated Short Target/Exit
}

// --- Start of W.Change specific types ---
export interface WChangeAnalysisInput {
    stockName: string;
    dailyData: CalculatedStockData[]; // Chronological, latest last. Expects at least 2 recent records.
    r5Trend?: 'R' | 'D' | null;       // Optional: User-defined rising/declining trend
    l5Validation?: boolean;           // Optional: User-defined validation flag
}

export interface WChangeAnalysisOutput {
    tickerName: string;
    latestDate: string | null;         // Date of T

    averageMetric: number | null;      // Using ATR[T]
    fivePercentThreshold: number | null;

    // Data points for T and T-1 used in triggers
    jnsarT: number | null;
    jnsarTminus1: number | null;
    closeT: number | null;
    closeTminus1: number | null;
    
    // Raw data for the last 5 days for context if needed by UI later
    last5DayVolumes: (number | null)[];
    last5DayJNSAR: (number | null)[];
    last5DayClose: (number | null)[];
    last5DayOHLC: StockData[];


    // Trigger flags
    isGreenJNSARTrigger: boolean;
    isRedJNSARTrigger: boolean;

    // Assumed external flags (passed in or defaulted)
    currentTrend: 'R' | 'D' | null;
    validationFlag: boolean;

    // Derived flags
    isConfirmedGreenTrend: boolean;
    isStrongGreenSignal: boolean;
    isConfirmedRedTrend: boolean;
    isStrongRedSignal: boolean;
}
// --- End of W.Change specific types ---


/**
 * Calculates Simple Moving Average (SMA).
 * Handles potential null/undefined values in input data.
 */
function calculateSmaSeries(data: (number | null | undefined)[], period: number): (number | null)[] {
    const smaArrayFull: (number | null)[] = Array(data.length).fill(null);
    if (!data || data.length < period) {
        return smaArrayFull;
    }

    const validDataIndices: number[] = [];
    const validDataValues: number[] = [];
    data.forEach((d, i) => {
        if (typeof d === 'number') {
            validDataIndices.push(i);
            validDataValues.push(d);
        }
    });

    if (validDataValues.length < period) {
        return smaArrayFull;
    }

    const smaArrayCalc: (number | null)[] = Array(validDataValues.length).fill(null);
    let sum = 0;

    // Calculate initial sum for the first possible SMA
    for (let i = 0; i < period; i++) {
        sum += validDataValues[i];
    }
    smaArrayCalc[period - 1] = sum / period;

    // Calculate subsequent SMA values using only valid data
    for (let i = period; i < validDataValues.length; i++) {
        sum = sum - validDataValues[i - period] + validDataValues[i];
        smaArrayCalc[i] = sum / period;
    }

    // Map calculated SMAs back to the original data positions
    validDataIndices.forEach((originalIndex, validIndex) => {
        if (validIndex >= period - 1) {
            smaArrayFull[originalIndex] = smaArrayCalc[validIndex];
        }
    });

    return smaArrayFull;
}


/**
 * Calculates Exponential Moving Average (EMA).
 * Handles potential null/undefined values in input data.
 */
function calculateEmaSeries(data: (number | null | undefined)[], period: number): (number | null)[] {
    const emaArrayFull: (number | null)[] = Array(data.length).fill(null);

    const validDataIndices: number[] = [];
    const validDataValues: number[] = [];
    data.forEach((d, i) => {
        if (typeof d === 'number') {
            validDataIndices.push(i);
            validDataValues.push(d);
        }
    });

     if (validDataValues.length < period) {
        return emaArrayFull;
    }

    const k = 2 / (period + 1);
    const emaArrayCalc: (number | null)[] = Array(validDataValues.length).fill(null);

    // Calculate initial SMA for the first EMA value using only valid data
    let sum = 0;
    for (let i = 0; i < period; i++) {
        sum += validDataValues[i];
    }
    emaArrayCalc[period - 1] = sum / period;

    // Calculate subsequent EMA values using only valid data
    for (let i = period; i < validDataValues.length; i++) {
        const prevEma = emaArrayCalc[i - 1];
        const currentData = validDataValues[i];
        if (prevEma !== null) { // Current data is guaranteed to be a number here
            emaArrayCalc[i] = (currentData * k) + (prevEma * (1 - k));
        }
        // If prevEma is null (should only happen if period > validData length initially), keep null
    }

    // Map calculated EMAs back to the original data positions
    validDataIndices.forEach((originalIndex, validIndex) => {
        if (validIndex >= period - 1) {
             emaArrayFull[originalIndex] = emaArrayCalc[validIndex];
        }
    });


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
    let firstValidTRIndex = -1;

    for (let i = 0; i < data.length; i++) {
        const current = data[i];
        const prev = i > 0 ? data[i - 1] : undefined;

        if (typeof current?.high !== 'number' || typeof current?.low !== 'number') {
             trArray.push(null);
             continue;
        }

        const highLow = current.high - current.low;

        if (!prev || typeof prev?.close !== 'number') {
            // Can only calculate High-Low TR for the first point or if prev close missing
            trArray.push(highLow);
        } else {
             const highClosePrev = Math.abs(current.high - prev.close);
             const lowClosePrev = Math.abs(current.low - prev.close);
             trArray.push(Math.max(highLow, highClosePrev, lowClosePrev));
        }
         if (firstValidTRIndex === -1 && trArray[i] !== null) {
            firstValidTRIndex = i;
        }
    }

     if (firstValidTRIndex === -1 || data.length < firstValidTRIndex + period) {
        return atrArrayFull; // Not enough valid TR values to calculate ATR
    }


    // Calculate Simple Moving Average of the first 'period' TR values starting from firstValidTRIndex
    let sumTR = 0;
    let validTRCount = 0;
    for (let i = firstValidTRIndex; i < firstValidTRIndex + period; i++) {
         if (trArray[i] !== null) {
             sumTR += trArray[i]!;
             validTRCount++;
         }
    }

    if (validTRCount < period) return atrArrayFull; // Need full period of valid TRs for first ATR


    let firstAtrIndex = firstValidTRIndex + period - 1;
    atrArrayFull[firstAtrIndex] = sumTR / period;


    // Wilder's Smoothing for subsequent ATR values
    for (let i = firstAtrIndex + 1; i < data.length; i++) {
        const prevAtr = atrArrayFull[i - 1];
        const currentTR = trArray[i];

        if (prevAtr !== null && currentTR !== null) {
            atrArrayFull[i] = ((prevAtr * (period - 1)) + currentTR) / period;
        } else if (prevAtr !== null) {
             atrArrayFull[i] = prevAtr;
        }
    }

    return atrArrayFull;
}

/**
 * Calculates Pivot Points and Standard Support/Resistance Levels based on previous day data.
 */
function calculatePivotPointsForDay(prevDayData: StockData | undefined): { [key: string]: number | null } {
    const defaults = { PP: null, H1: null, L1: null, H2: null, L2: null, H3: null, L3: null, H4: null, L4: null };
    if (!prevDayData || typeof prevDayData.high !== 'number' || typeof prevDayData.low !== 'number' || typeof prevDayData.close !== 'number') {
        return defaults;
    }

    const { high, low, close } = prevDayData;

    const pp = (high + low + close) / 3;
    const range = high - low;

    if (range < 0) return defaults; // Should not happen with valid data

    const h1 = (2 * pp) - low;
    const l1 = (2 * pp) - high;
    const h2 = pp + range;
    const l2 = pp - range;
    const h3 = h1 + range; 
    const l3 = l1 - range; 
    const h4 = h2 + range; 
    const l4 = l2 - range; 


    return { PP: pp, H1: h1, L1: l1, H2: h2, L2: l2, H3: h3, L3: l3, H4: h4, L4: l4 };
}

/**
 * Placeholder for JNSAR calculation - Parabolic SAR like logic.
 * Added more robust handling of missing data.
 */
function calculateJnsarSeries(data: StockData[], atrSeries: (number | null)[], atrPeriod: number = 14, factor: number = 2): (number | null)[] {
    const sarArray: (number | null)[] = Array(data.length).fill(null);
    if (!data || data.length < 2) {
        return sarArray;
    }

     let startIndex = data.findIndex(d => typeof d?.low === 'number' && typeof d?.high === 'number');
     if (startIndex === -1 || startIndex >= data.length -1) return sarArray; 


    const trend: (1 | -1 | null)[] = Array(data.length).fill(null);
    const ep: (number | null)[] = Array(data.length).fill(null); // Extreme Point
    const af: (number | null)[] = Array(data.length).fill(null); // Acceleration Factor

    if (startIndex + 1 < data.length &&
        typeof data[startIndex+1]?.close === 'number' &&
        typeof data[startIndex]?.close === 'number') {
        if (data[startIndex+1].close > data[startIndex].close) {
            trend[startIndex] = 1; 
            sarArray[startIndex] = data[startIndex].low; 
            ep[startIndex] = data[startIndex].high;
        } else {
            trend[startIndex] = -1; 
            sarArray[startIndex] = data[startIndex].high; 
            ep[startIndex] = data[startIndex].low;
        }
        af[startIndex] = 0.02; 
    } else {
        return sarArray;
    }


    for (let i = startIndex + 1; i < data.length; i++) {
        const prevSar = sarArray[i - 1];
        const prevTrend = trend[i - 1];
        const prevEp = ep[i - 1];
        const prevAf = af[i - 1];

        const currentHigh = data[i]?.high;
        const currentLow = data[i]?.low;
        const prevLow = data[i-1]?.low;
        const prevPrevLow = (i > 1) ? data[i-2]?.low : undefined;
        const prevHigh = data[i-1]?.high;
        const prevPrevHigh = (i > 1) ? data[i-2]?.high : undefined;

         if (prevSar === null || prevTrend === null || prevEp === null || prevAf === null ||
             typeof currentHigh !== 'number' || typeof currentLow !== 'number' ||
             typeof prevLow !== 'number' || typeof prevHigh !== 'number') {
             sarArray[i] = null;
             trend[i] = prevTrend; 
             ep[i] = prevEp;
             af[i] = prevAf;
             continue;
         }

        let currentSar: number;

        if (prevTrend === 1) { 
            currentSar = prevSar + prevAf * (prevEp - prevSar);
             const low1 = prevLow;
             const low2 = (typeof prevPrevLow === 'number') ? prevPrevLow : prevLow;
             currentSar = Math.min(currentSar, low1, low2);


            if (currentLow < currentSar) { 
                trend[i] = -1;
                currentSar = prevEp; 
                ep[i] = currentLow;
                af[i] = 0.02; 
            } else { 
                trend[i] = 1;
                ep[i] = Math.max(prevEp, currentHigh);
                af[i] = (ep[i] > prevEp) ? Math.min(0.2, prevAf + 0.02) : prevAf;
            }
        } else { 
            currentSar = prevSar - prevAf * (prevSar - prevEp);
             const high1 = prevHigh;
             const high2 = (typeof prevPrevHigh === 'number') ? prevPrevHigh : prevHigh;
             currentSar = Math.max(currentSar, high1, high2);

            if (currentHigh > currentSar) { 
                trend[i] = 1;
                currentSar = prevEp; 
                ep[i] = currentHigh;
                af[i] = 0.02; 
            } else { 
                trend[i] = -1;
                ep[i] = Math.min(prevEp, currentLow);
                af[i] = (ep[i] < prevEp) ? Math.min(0.2, prevAf + 0.02) : prevAf;
            }
        }
         sarArray[i] = currentSar;
    }
    return sarArray;
}

/**
 * Calculates Long and Short Target/Exit points.
 */
function calculateTargets(
    pivotPoint: number | null,
    atr: number | null,
    longEntry: number | null,
    shortEntry: number | null
): { LongTarget: number | null, ShortTarget: number | null } {
    let longTarget: number | null = null;
    let shortTarget: number | null = null;

    if (longEntry !== null && atr !== null) {
       longTarget = longEntry + atr;
    }
     if (shortEntry !== null && atr !== null) {
       shortTarget = shortEntry - atr;
    }
    return { LongTarget: longTarget, ShortTarget: shortTarget };
}


/**
 * Processes raw stock data to add calculated indicators.
 */
export function processStockData(rawData: StockData[], dates: string[]): CalculatedStockData[] {
    if (!rawData || rawData.length === 0) {
        return [];
    }

    const dataWithDates = rawData
        .map((d, i) => ({ ...d, date: d.date || dates[i] }))
        .filter(d => d.date) 
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); 


    const closePrices = dataWithDates.map(d => d.close);
    const lowPrices = dataWithDates.map(d => d.low);
    const highPrices = dataWithDates.map(d => d.high);
    const volumes = dataWithDates.map(d => d.volume);

    const ema5 = calculateEmaSeries(closePrices, 5);
    const lema5 = calculateEmaSeries(lowPrices, 5);
    const hema5 = calculateEmaSeries(highPrices, 5);
    const atr14 = calculateAtrSeries(dataWithDates, 14);
    const jnsar = calculateJnsarSeries(dataWithDates, atr14);
    const avgVolume20 = calculateSmaSeries(volumes, 20); 

    const calculatedData: CalculatedStockData[] = dataWithDates.map((dayData, index) => {
        const prevDayData = index > 0 ? dataWithDates[index - 1] : undefined;
        const pivots = calculatePivotPointsForDay(prevDayData);

        const longEntry = pivots['L1']; 
        const shortEntry = pivots['H1']; 

        const prevHigh = prevDayData?.high;
        const prevLow = prevDayData?.low;
        const prevClose = prevDayData?.close;

        const currentHigh = dayData.high;
        const currentLow = dayData.low;
        const currentClose = dayData.close;

        const hh = (typeof currentHigh === 'number' && typeof prevHigh === 'number' && currentHigh > prevHigh) ? 'Y' : '0';
        const ll = (typeof currentLow === 'number' && typeof prevLow === 'number' && currentLow < prevLow) ? 'Y' : '0';
        const cl = (typeof currentClose === 'number' && typeof prevClose === 'number' && currentClose < prevClose) ? 'Y' : '0';

        const diff = (typeof currentHigh === 'number' && typeof currentLow === 'number') ? currentHigh - currentLow : null;

        const currentVolume = dayData.volume;
        const avgVol = avgVolume20[index];
        const volumeCheck = (typeof currentVolume === 'number' && typeof avgVol === 'number' && avgVol > 0)
            ? currentVolume > (avgVol * 1.5)
            : null;

         const currentAtr = atr14[index];
         const { LongTarget, ShortTarget } = calculateTargets(pivots['PP'], currentAtr, longEntry, shortEntry);


        return {
            ...dayData,
            '5-EMA': ema5[index] ?? null,
            '5-LEMA': lema5[index] ?? null,
            '5-HEMA': hema5[index] ?? null,
            'ATR': currentAtr ?? null,
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
            'LL': ll,
            'CL': cl,
            'Diff': diff,
            'AvgVolume': avgVol ?? null,
            'Volume > 150%': volumeCheck,
            'LongTarget': LongTarget,
            'ShortTarget': ShortTarget,
        };
    });
    return calculatedData;
}


/**
 * Analyzes daily stock data for W.Change specific signals.
 */
export function analyzeForWChange(input: WChangeAnalysisInput): WChangeAnalysisOutput | null {
    const { stockName, dailyData, r5Trend, l5Validation } = input;

    if (dailyData.length < 2) { // Need at least T and T-1
        return null;
    }

    // T is the last element, T-1 is the second to last
    const tData = dailyData[dailyData.length - 1];
    const tMinus1Data = dailyData[dailyData.length - 2];

    if (!tData || !tMinus1Data) return null;

    const averageMetric = tData['ATR'] ?? null; // Using ATR[T] as Average Metric
    const fivePercentThreshold = averageMetric !== null ? averageMetric * 0.05 : null;

    const jnsarT = tData['JNSAR'] ?? null;
    const jnsarTminus1 = tMinus1Data['JNSAR'] ?? null;
    const closeT = tData.close ?? null;
    const closeTminus1 = tMinus1Data.close ?? null;

    let isGreenJNSARTrigger = false;
    if (jnsarTminus1 !== null && closeTminus1 !== null && jnsarT !== null && closeT !== null) {
        if (jnsarTminus1 > closeTminus1 && jnsarT < closeT) {
            isGreenJNSARTrigger = true;
        }
    }

    let isRedJNSARTrigger = false;
    if (jnsarTminus1 !== null && closeTminus1 !== null && jnsarT !== null && closeT !== null) {
        if (jnsarTminus1 < closeTminus1 && jnsarT > closeT) {
            isRedJNSARTrigger = true;
        }
    }
    
    const currentTrend = r5Trend ?? null; // Default to null if not provided
    const validationFlag = l5Validation ?? false; // Default to false if not provided

    const isConfirmedGreenTrend = isGreenJNSARTrigger && currentTrend === 'R';
    const isStrongGreenSignal = isConfirmedGreenTrend && validationFlag;
    const isConfirmedRedTrend = isRedJNSARTrigger && currentTrend === 'D';
    const isStrongRedSignal = isConfirmedRedTrend && validationFlag;

    // Extract last 5 days of relevant data for context
    const last5DaysData = dailyData.slice(-5);
    const last5DayVolumes = last5DaysData.map(d => d.volume ?? null);
    const last5DayJNSAR = last5DaysData.map(d => d['JNSAR'] ?? null);
    const last5DayClose = last5DaysData.map(d => d.close ?? null);
    const last5DayOHLC = last5DaysData.map(d => ({
        date: d.date,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
        volume: d.volume,
    }));


    return {
        tickerName: stockName,
        latestDate: tData.date ?? null,
        averageMetric,
        fivePercentThreshold,
        jnsarT,
        jnsarTminus1,
        closeT,
        closeTminus1,
        last5DayVolumes,
        last5DayJNSAR,
        last5DayClose,
        last5DayOHLC,
        isGreenJNSARTrigger,
        isRedJNSARTrigger,
        currentTrend,
        validationFlag,
        isConfirmedGreenTrend,
        isStrongGreenSignal,
        isConfirmedRedTrend,
        isStrongRedSignal,
    };
}

