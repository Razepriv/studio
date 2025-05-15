'use client';

import { FC, useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { format, subDays, isValid, parseISO } from 'date-fns';
import { Calendar as CalendarIcon, Download, AlertTriangle, Info } from 'lucide-react';

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell, TableCaption } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { getStockData, type StockData } from '@/services/stock-data';
import { toast } from 'sonner';
import { processStockData, analyzeForWChange, type CalculatedStockData, type WChangeAnalysisOutput } from '@/lib/calculations';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Using the same list as other pages
const ALL_POSSIBLE_STOCKS = [
    'ABB', 'ACC', 'AARTIIND', 'ABCAPITAL', 'ABFRL', 'ADANIENT', 'ADANIGREEN', 'ADANIPORTS', 'ALKEM',
    'AMBUJACEM', 'APOLLOHOSP', 'APOLLOTYRE', 'ASHOKLEY', 'ASIANPAINT', 'ASTRAL', 'ATUL', 'AUBANK', 'AUROPHARMA', 'AXISBANK',
    'BAJAJ-AUTO', 'BAJFINANCE', 'BAJAJFINSV', 'BAJAJHLDNG', 'BALKRISIND', 'BANDHANBNK', 'BANKBARODA', 'BATAINDIA', 'BERGEPAINT',
    'BEL', 'BHARATFORG', 'BHARTIARTL', 'BHEL', 'BIOCON', 'BOSCHLTD', 'BPCL', 'BRITANNIA', 'CANBK', 'CHOLAFIN', 'CIPLA',
    'COALINDIA', 'COFORGE', 'COLPAL', 'CONCOR', 'COROMANDEL', 'CROMPTON', 'CUMMINSIND', 'DALBHARAT', 'DABUR', 'DEEPAKNTR',
    'DIVISLAB', 'DLF', 'DRREDDY', 'EICHERMOT', 'ESCORTS', 'FEDERALBNK', 'GAIL', 'GODREJCP', 'GODREJPROP', 'GRASIM',
    'GUJGASLTD', 'HAVELLS', 'HCLTECH', 'HDFCAMC', 'HDFCBANK', 'HDFCLIFE', 'HEROMOTOCO', 'HINDALCO', 'HINDCOPPER', 'HINDPETRO',
    'HINDUNILVR', 'HAL', 'ICICIBANK', 'ICICIGI', 'ICICIPRULI', 'IDFCFIRSTB', 'IDFC', 'INDHOTEL', 'INDIGO',
    'INDUSTOWER', 'INDUSINDBK', 'NAUKRI', 'INFY', 'IOC', 'IEX', 'IPCALAB', 'IRCTC', 'ITC', 'JINDALSTEL',
    'JSWSTEEL', 'JUBLFOOD', 'KOTAKBANK', 'LT', 'LTIM', 'LTTS', 'LALPATHLAB', 'LAURUSLABS', 'LICHSGFIN', 'LUPIN',
    'M&M', 'M&MFIN', 'MANAPPURAM', 'MARICO', 'MARUTI', 'MFSL', 'METROPOLIS', 'MGL', 'MOTHERSON', 'MPHASIS', 'MRF',
    'MUTHOOTFIN', 'NATIONALUM', 'NAVINFLUOR', 'NESTLEIND', 'NMDC', 'NTPC', 'OBEROIRLTY', 'ONGC', 'OFSS', 'PAGEIND',
    'PERSISTENT', 'PETRONET', 'PFIZER', 'PIDILITIND', 'PIIND', 'PNB', 'POLYCAB', 'PFC', 'POWERGRID', 'PVRINOX',
    'RAMCOCEM', 'RBLBANK', 'RECLTD', 'RELIANCE', 'SBICARD', 'SBILIFE', 'SRF', 'SHREECEM', 'SHRIRAMFIN', 'SIEMENS', 'SBIN',
    'SAIL', 'SUNPHARMA', 'SUNTV', 'SYNGENE', 'TATACONSUM', 'TATAMOTORS', 'TATAPOWER', 'TATASTEEL',
    'TCS', 'TECHM', 'TITAN', 'TORNTPHARM', 'TORNTPOWER', 'TRENT', 'TVSMOTOR', 'ULTRACEMCO', 'UBL', 'MCDOWELL-N',
    'UPL', 'VEDL', 'VOLTAS', 'WHIRLPOOL', 'WIPRO', 'ZEEL', 'ZYDUSLIFE'
].filter((v, i, a) => a.indexOf(v) === i).sort();

interface ReportRowData {
  stockTicker: string;
  cDayClose: number | null;
  cDayOpen: number | null;
  cDayHigh: number | null;
  cDayLow: number | null;
  cDayVolume: number | null;
  cDay5EMA: number | null;
  cDay5LEMA: number | null;
  cDay5HEMA: number | null;
  cDayATR: number | null;
  cDayPP: number | null;
  cDayH1: number | null;
  cDayL1: number | null;
  cDayH2: number | null;
  cDayL2: number | null;
  cDayH3: number | null;
  cDayL3: number | null;
  cDayH4: number | null;
  cDayL4: number | null;
  jnsarCMinus4: number | null;
  jnsarCMinus3: number | null;
  jnsarCMinus2: number | null;
  jnsarCMinus1: number | null;
  jnsarCDay: number | null;
  cDayLongEntry: number | null;
  cDayShortEntry: number | null;
  cDayHH: string;
  cDayLL: string;
  cDayCL: string;
  cDayDiff: number | null;
  cDayAvgVolume: number | null;
  cDayVolumeAboveAvg: boolean | null;
  cDayLongTarget: number | null;
  cDayShortTarget: number | null;
  trend: 'R' | 'D' | null;
  jnsarVsClose: 'Bullish' | 'Bearish' | null;
  validation: boolean | null;
  signalType: 'Flip' | 'Continuation' | 'New Entry' | null;
  trendSignalSummary: WChangeSignalSummary | null;
  changedToGreen: string;
  changedToRed: string;
  sector?: string | null;
}

interface DatesDisplay {
  cDay: string;
  cMinus1: string;
  cMinus2: string;
  cMinus3: string;
  cMinus4: string;
}

const WReportPage: FC = () => {
  const [reportDate, setReportDate] = useState<Date>(new Date());
  const [reportData, setReportData] = useState<ReportRowData[]>([]);
  const [selectedRange, setSelectedRange] = useState<string>('Current Week');
  const [selectedSignalType, setSelectedSignalType] = useState<string | null>(null);
  const [selectedTrend, setSelectedTrend] = useState<'R' | 'D' | null>(null);
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [previousReportData, setPreviousReportData] = useState<WChangeAnalysisOutput[]>([]);
  const [availableSectors, setAvailableSectors] = useState<string[]>(['All']);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [processedCount, setProcessedCount] = useState(0);

  const datesToDisplay: DatesDisplay = useMemo(() => {
    const base = reportDate || new Date();
    return {
      cDay: format(base, 'yyyy-MM-dd'),
      cMinus1: format(subDays(base, 1), 'yyyy-MM-dd'),
      cMinus2: format(subDays(base, 2), 'yyyy-MM-dd'),
      cMinus3: format(subDays(base, 3), 'yyyy-MM-dd'),
      cMinus4: format(subDays(base, 4), 'yyyy-MM-dd')
    };
  }, [reportDate]);

  const previousDatesToDisplay: DatesDisplay = useMemo(() => {
    const base = subDays(reportDate || new Date(), 7);
    return {
      cDay: format(base, 'yyyy-MM-dd'),
      cMinus1: format(subDays(base, 1), 'yyyy-MM-dd'),
      cMinus2: format(subDays(base, 2), 'yyyy-MM-dd'),
      cMinus3: format(subDays(base, 3), 'yyyy-MM-dd'),
      cMinus4: format(subDays(base, 4), 'yyyy-MM-dd')
    };
  }, [reportDate]);

  const comparativeReportData = useMemo(() => {
    if (!reportData || reportData.length === 0) return [];
    return reportData.map((row) => {
      const previous = previousReportData.find(p => p.stockName === row.stockTicker);
      let comparisonStatus = '';
      const current = row.trendSignalSummary;
      const prev = previous?.trendSignalSummary;
      if (current && !prev) comparisonStatus = `Entry (${current})`;
      else if (!current && prev) comparisonStatus = `Exit (${prev})`;
      else if (current && prev && current !== prev) comparisonStatus = `Change (${prev} -> ${current})`;
      return { ...row, comparisonStatus };
    });
  }, [reportData, previousReportData]);

  useEffect(() => {
    const fetchAndProcessReportData = async () => {
      setLoading(true);
      setError(null);
      setProcessedCount(0);

      const totalStocks = ALL_POSSIBLE_STOCKS.length;
      const processedResults: ReportRowData[] = [];
      const previousPeriodResults: WChangeAnalysisOutput[] = [];

      try {
        // Fetch and process data for the current period
        const currentPeriodData = await getStockData(ALL_POSSIBLE_STOCKS, [datesToDisplay.cDay, datesToDisplay.cMinus1, datesToDisplay.cMinus2, datesToDisplay.cMinus3, datesToDisplay.cMinus4]);
        for (const stockData of currentPeriodData) {
          const processedStock = processStockData(stockData.data);
          const analysis = analyzeForWChange(processedStock);
          // Assuming analyzeForWChange returns a structure compatible with ReportRowData
          // You might need to map or transform the analysis output to match ReportRowData
          processedResults.push({ ...analysis, stockTicker: stockData.ticker, sector: stockData.sector } as ReportRowData);
          setProcessedCount(count => count + 1);
        }
        setReportData(processedResults);

        // Fetch and process data for the previous period
        const previousPeriodData = await getStockData(ALL_POSSIBLE_STOCKS, [previousDatesToDisplay.cDay, previousDatesToDisplay.cMinus1, previousDatesToDisplay.cMinus2, previousDatesToDisplay.cMinus3, previousDatesToDisplay.cMinus4]);
        for (const stockData of previousPeriodData) {
             const processedStock = processStockData(stockData.data);
             const analysis = analyzeForWChange(processedStock);
             previousPeriodResults.push({ ...analysis, stockName: stockData.ticker }); // Assuming WChangeAnalysisOutput needs stockName
        }
        setPreviousReportData(previousPeriodResults);

        if (processedResults.length === 0 && totalStocks > 0) {
          toast.info("Processing Complete", { description: "No data could be generated for the selected report date and stocks. Ensure data availability." });
        } else if (processedResults.length > 0) {
          toast.success("Report Generated", { description: `Successfully processed report data for ${format(reportDate, "PPP")}.` });
        }

      } catch (err) {
        console.error("Error fetching or processing stock data:", err);
        setError("Failed to fetch or process stock data.");
        toast.error("Report Generation Failed", { description: "An error occurred while generating the report." });
      } finally {
        setLoading(false);
      }
    };

    fetchAndProcessReportData();

  }, [reportDate, datesToDisplay, previousDatesToDisplay]); // Dependencies for the useEffect

  return <main className="container mx-auto py-6 px-4">{/* ...rest of UI */}</main>;
};

export default WReportPage;
