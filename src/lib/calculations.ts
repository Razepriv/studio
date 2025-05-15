
import type { StockData } from '@/services/stock-data';
import { isValid, parseISO, format, subDays } from 'date-fns';


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
    dailyData: CalculatedStockData[]; // Chronological, latest last (should be T). Expects at least 2 recent records for T and T-1.
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
    closeTminus2: number | null;
    
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

    // New fields for W.Report
    trend: 'R' | 'D' | null; // R5 Trend
    jnsarVsClose: 'Bullish' | 'Bearish' | null;
    validation: boolean; // L5 Validation
    signalType: 'Flip' | 'Continuation' | 'New Entry' | null;
    trendSignalSummary: 'Long Confirmed' | 'Long Not Confirmed' | 'Short Confirmed' | 'Short Not Confirmed' | 'Green Flip' | 'Red Flip' | null;
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

    const validDataIndices: number[] = []
    const validDataValues: number[] = []
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

    if (!data || data.length < 2) { // Need at least one previous day for TR calculation
        return atrArrayFull;
    }

    const trArray: (number | null)[] = [];
    let firstValidTRIndex = -1;

    for (let i = 0; i < data.length; i++) {
        const current = data[i];
        // Previous day's close is needed for full TR. If it's the first day, TR is just High - Low.
        const prev = i > 0 ? data[i - 1] : null; 

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
    
     // Check if we have enough data points *after* the first valid TR to calculate an ATR
     if (firstValidTRIndex === -1 || (trArray.length - firstValidTRIndex) < period) {
        return atrArrayFull; 
    }

    // Calculate Simple Moving Average of the first 'period' TR values starting from firstValidTRIndex
    let sumTR = 0;
    let validTRsForInitialSma = 0;
    for (let i = firstValidTRIndex; i < firstValidTRIndex + period; i++) {
         if (trArray[i] !== null) { // This check is slightly redundant given the outer check but good for safety
             sumTR += trArray[i]!;
             validTRsForInitialSma++;
         }
    }

    if (validTRsForInitialSma < period) return atrArrayFull; // Need full period of valid TRs for first ATR


    let firstAtrIndex = firstValidTRIndex + period - 1;
    if(firstAtrIndex >= data.length) return atrArrayFull; // Not enough data points overall

    atrArrayFull[firstAtrIndex] = sumTR / period;


    // Wilder's Smoothing for subsequent ATR values
    for (let i = firstAtrIndex + 1; i < data.length; i++) {
        const prevAtr = atrArrayFull[i - 1];
        const currentTR = trArray[i];

        if (prevAtr !== null && currentTR !== null) {
            atrArrayFull[i] = ((prevAtr * (period - 1)) + currentTR) / period;
        } else if (prevAtr !== null) { // If current TR is null, carry forward previous ATR (common practice)
             atrArrayFull[i] = prevAtr;
        }
         // If prevAtr is null, current ATR remains null (shouldn't happen after firstAtrIndex)
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

     let startIndex = data.findIndex(d => typeof d?.low === 'number' && typeof d?.high === 'number' && typeof d?.close === 'number');
     if (startIndex === -1 || startIndex >= data.length -1) return sarArray; 


    const trend: (1 | -1 | null)[] = Array(data.length).fill(null);
    const ep: (number | null)[] = Array(data.length).fill(null); // Extreme Point
    const af: (number | null)[] = Array(data.length).fill(null); // Acceleration Factor
    const sar: (number | null)[] = Array(data.length).fill(null);

    if (startIndex + 1 < data.length &&
        typeof data[startIndex+1]?.close === 'number' &&
        typeof data[startIndex]?.close === 'number') {
        if (data[startIndex+1].close > data[startIndex].close) {
            trend[startIndex] = 1; 
            sar[startIndex] = data[startIndex].low; 
            ep[startIndex] = data[startIndex].high;
        } else {
            trend[startIndex] = -1; 
            ep[startIndex] = data[startIndex].low;
            sar[startIndex] = data[startIndex].high; 
        }
        af[startIndex] = 0.02; 
    } else {
        // Not enough data to determine initial trend for SAR
        return sarArray;
    }


    for (let i = startIndex + 1; i < data.length; i++) {
        const prevSar = sar[i - 1];
        const prevTrend = trend[i - 1];
        const prevEp = ep[i - 1];
        const prevAf = af[i - 1];

        const currentHigh = data[i]?.high;
        const currentLow = data[i]?.low;
        const prevLow = data[i-1]?.low;
        const prevPrevLow = (i > 1) ? data[i-2]?.low : undefined; // Low of two days prior
        const prevHigh = data[i-1]?.high;
        const prevPrevHigh = (i > 1) ? data[i-2]?.high : undefined; // High of two days prior


         if (prevSar === null || prevTrend === null || prevEp === null || prevAf === null ||
             typeof currentHigh !== 'number' || typeof currentLow !== 'number' ||
             typeof prevLow !== 'number' || typeof prevHigh !== 'number') {
             // If essential previous data is missing, carry forward previous values if possible, or null out.
             // This state implies a data gap or insufficient history for SAR calculation at this point. Will be null.
             sarArray[i] = prevSar; // Attempt to carry forward SAR, might be null
             trend[i] = prevTrend; 
             ep[i] = prevEp;
             af[i] = prevAf;
             continue;
         }


        let currentSar: number;
        let currentAf = prevAf; // Start with previous AF
        if (prevTrend === 1) { // Uptrend
            currentSar = prevSar + prevAf * (prevEp - prevSar);
             // SAR cannot be higher than the low of the previous two periods
             const low1 = prevLow;
             const low2 = (typeof prevPrevLow === 'number') ? prevPrevLow : prevLow; // If T-2 low doesn't exist, use T-1 low
             currentSar = Math.min(currentSar, low1, low2);


            if (currentLow < currentSar) { // Trend reversal to Down
                trend[i] = -1;
                currentSar = prevEp; // New SAR is the EP of the previous uptrend
                ep[i] = currentLow; // New EP is the current low
                currentAf = 0.02; // Reset AF
            } else { // Continue Uptrend
                trend[i] = 1;
                 // Only update EP if the new high is greater than the previous EP
                let newEp = prevEp;
                if (currentHigh > prevEp) newEp = currentHigh;

                ep[i] = Math.max(prevEp, currentHigh); // Update EP if new high
                af[i] = (ep[i] > prevEp) ? Math.min(0.2, prevAf + 0.02) : prevAf; // Increment AF if EP changed
            }
        } else { // Downtrend (prevTrend === -1)
            currentSar = prevSar - prevAf * (prevSar - prevEp);
            // SAR cannot be lower than the high of the previous two periods
             const high1 = prevHigh;
             const high2 = (typeof prevPrevHigh === 'number') ? prevPrevHigh : prevHigh; // If T-2 high doesn't exist, use T-1 high
             currentSar = Math.max(currentSar, high1, high2);

            if (currentHigh > currentSar) { // Trend reversal to Up
                trend[i] = 1;
                currentSar = prevEp; // New SAR is the EP of the previous downtrend
                ep[i] = currentHigh; // New EP is the current high
                currentAf = 0.02; // Reset AF
            } else { // Continue Downtrend
                trend[i] = -1;
                 // Only update EP if the new low is less than the previous EP
                let newEp = prevEp;
                if (currentLow < prevEp) newEp = currentLow;
                ep[i] = Math.min(prevEp, currentLow); // Update EP if new low
                af[i] = (ep[i] < prevEp) ? Math.min(0.2, prevAf + 0.02) : prevAf; // Increment AF if EP changed
            }
        }
        sar[i] = currentSar;
        af[i] = currentAf;
    }
    return sar;
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
 * Ensures data is sorted chronologically before processing.
 */
export function processStockData(rawData: StockData[], dates?: string[]): CalculatedStockData[] {
    if (!rawData || rawData.length === 0) {
        return [];
    }

    // Ensure data is sorted by date ascending
    const sortedRawData = [...rawData].sort((a,b) => {
        const dateA = parseISO(a.date);
        const dateB = parseISO(b.date);
        if (!isValid(dateA) || !isValid(dateB)) return 0; // Should not happen with good data
        return dateA.getTime() - dateB.getTime();
    });
    
    const dataWithValidDates = sortedRawData.filter(d => d.date && isValid(parseISO(d.date)));
    if (dataWithValidDates.length === 0) return [];


    const closePrices = dataWithValidDates.map(d => d.close);
    const lowPrices = dataWithValidDates.map(d => d.low);
    const highPrices = dataWithValidDates.map(d => d.high);
    const volumes = dataWithValidDates.map(d => d.volume);

    const ema5 = calculateEmaSeries(closePrices, 5);
    const lema5 = calculateEmaSeries(lowPrices, 5);
    const hema5 = calculateEmaSeries(highPrices, 5);
    const atr14 = calculateAtrSeries(dataWithValidDates, 14); // Pass sorted data
    const jnsar = calculateJnsarSeries(dataWithValidDates, atr14); // Pass sorted data
    const avgVolume20 = calculateSmaSeries(volumes, 20); 

    const calculatedData: CalculatedStockData[] = dataWithValidDates.map((dayData, index) => {
        const prevDayData = index > 0 ? dataWithValidDates[index - 1] : undefined;
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
            ...dayData, // Includes original date, open, high, low, close, volume
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
 * Expects `dailyData` to be sorted chronologically with the latest data point (T) at the end.
 */
export function analyzeForWChange(input: WChangeAnalysisInput): WChangeAnalysisOutput | null {
    const { stockName, dailyData, r5Trend, l5Validation } = input;

    // Ensure dailyData is sorted chronologically if not already guaranteed by caller
    const sortedDailyData = [...dailyData].sort((a,b) => {
        const dateA = parseISO(a.date);
        const dateB = parseISO(b.date);
        if (!isValid(dateA) || !isValid(dateB)) return 0;
        return dateA.getTime() - dateB.getTime();
    });


    if (sortedDailyData.length < 2) { // Need at least T and T-1
        console.warn(`Not enough data for ${stockName} in analyzeForWChange. Required 2, got ${sortedDailyData.length}`);
        return null;
    }

    // T is the last element, T-1 is the second to last, T-2 is the third to last
    const tData = sortedDailyData[sortedDailyData.length - 1];
    const tMinus1Data = sortedDailyData[sortedDailyData.length - 2];
    // Ensure data for T-2 is available by checking if there are at least 3 data points
    const tMinus2Data = sortedDailyData.length >= 3 ? sortedDailyData[sortedDailyData.length - 3] : null;

    if (!tData || !tMinus1Data) {
        console.warn(`Missing T or T-1 data for ${stockName} in analyzeForWChange.`);
        return null;
    }
    
    // Ensure dates are what we expect for T and T-1 for robust analysis
    // This check is more for logical consistency if dailyData might have gaps
    // For W.Report, if we select C.Day, T will be C.Day, T-1 will be C.Day-1

    const averageMetric = tData['ATR'] ?? null; // Using ATR[T] as Average Metric
    const fivePercentThreshold = averageMetric !== null ? averageMetric * 0.05 : null;

    const jnsarT = tData['JNSAR'] ?? null;
    const jnsarTminus1 = tMinus1Data['JNSAR'] ?? null;
    const closeT = tData.close ?? null;
    const closeTminus1 = tMinus1Data.close ?? null;
    const closeTminus2 = tMinus2Data ? tMinus2Data.close ?? null : null;

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

    // Use the provided r5Trend and l5Validation inputs
    const currentTrend = r5Trend !== undefined ? r5Trend : null; // Check for undefined
    const validationFlag = l5Validation ?? false; // Default to false if not provided

    const isConfirmedGreenTrend = isGreenJNSARTrigger && currentTrend === 'R';
    const isStrongGreenSignal = isConfirmedGreenTrend && validationFlag; // This flag is not used in WReport output, but kept for consistency with WChange
    const isConfirmedRedTrend = isRedJNSARTrigger && currentTrend === 'D';
    const isStrongRedSignal = isConfirmedRedTrend && validationFlag; // This flag is not used in WReport output, but kept for consistency with WChange

    // Calculate new fields
    const trend = currentTrend; // Directly use the passed-in r5Trend

    const jnsarVsClose = (jnsarT !== null && closeT !== null) ? (jnsarT < closeT ? 'Bullish' : 'Bearish') : null;
    const validation = validationFlag; // Using the passed-in validation flag

    let signalType: 'Flip' | 'Continuation' | 'New Entry' | null = null;
    if (isGreenJNSARTrigger || isRedJNSARTrigger) {
        // Determine the JNSAR vs Close relationship for T-1
        const prevJnsarVsClose = (jnsarTminus1 !== null && closeTminus1 !== null) ? (jnsarTminus1 < closeTminus1 ? 'Bullish' : 'Bearish') : null;

        // Check for Flip signal
        if (prevJnsarVsClose !== null && jnsarVsClose !== null && prevJnsarVsClose !== jnsarVsClose) {
            if (isGreenJNSARTrigger && prevJnsarVsClose === 'Bearish' && jnsarVsClose === 'Bullish') signalType = 'Flip'; // Green Flip
            if (isRedJNSARTrigger && prevJnsarVsClose === 'Bullish' && jnsarVsClose === 'Bearish') signalType = 'Flip'; // Red Flip
         }
         // Check for Continuation signal (if not a Flip)
         if (signalType === null && prevJnsarVsClose !== null && jnsarVsClose !== null && prevJnsarVsClose === jnsarVsClose) {
             if (isGreenJNSARTrigger && jnsarVsClose === 'Bullish') signalType = 'Continuation'; // Green Continuation
             if (isRedJNSARTrigger && jnsarVsClose === 'Bearish') signalType = 'Continuation'; // Red Continuation
         }
         // New Entry logic requires more historical data; leave as null for now.
    }

    let trendSignalSummary: 'Long Confirmed' | 'Long Not Confirmed' | 'Short Confirmed' | 'Short Not Confirmed' | 'Green Flip' | 'Red Flip' | null = null;

 if (isGreenJNSARTrigger && (jnsarTminus1 !== null && closeTminus1 !== null && jnsarTminus1 > closeTminus1)) { // Green Flip
 trendSignalSummary = 'Green Flip';
    } else if (isRedJNSARTrigger && (jnsarTminus1 !== null && closeTminus1 !== null && jnsarTminus1 < closeTminus1)) { // Red Flip
 trendSignalSummary = 'Red Flip';
    } else if (isConfirmedGreenTrend) {
        trendSignalSummary = 'Long Confirmed';
    } else if (isConfirmedRedTrend) {
        trendSignalSummary = 'Short Confirmed';
    } else if (isGreenJNSARTrigger && (jnsarTminus1 !== null && closeTminus1 !== null && jnsarTminus1 > closeTminus1)) { // Green Flip condition check
         trendSignalSummary = 'Green Flip';
    } else if (isRedJNSARTrigger && (jnsarTminus1 !== null && closeTminus1 !== null && jnsarTminus1 < closeTminus1)) { // Red Flip condition check
        trendSignalSummary = 'Red Flip';
    } else if (isGreenJNSARTrigger) { // Green Trigger without confirmed trend or being a Flip
        trendSignalSummary = 'Long Not Confirmed';
    } else if (isRedJNSARTrigger) { // Red Trigger without confirmed trend or being a Flip
         trendSignalSummary = 'Short Not Confirmed';
    }

    // Extract last 5 days of relevant data for context
    const last5DaysDataInput = sortedDailyData.slice(-5);
    const last5DayVolumes = last5DaysDataInput.map(d => d.volume ?? null);
    const last5DayJNSAR = last5DaysDataInput.map(d => d['JNSAR'] ?? null);
    const last5DayClose = last5DaysDataInput.map(d => d.close ?? null);
    const last5DayOHLC = last5DaysDataInput.map(d => ({
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
        closeTminus2,
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

        trend,
        jnsarVsClose,
        validation,
        signalType,
        trendSignalSummary,
    };
}

    