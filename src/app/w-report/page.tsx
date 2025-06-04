
'use client';

import { FC, useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { format, subWeeks, isValid, parseISO, startOfWeek } from 'date-fns';
import { Calendar as CalendarIcon, Download, AlertTriangle, Info, Loader2 } from 'lucide-react';

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell, TableCaption } from "@/components/ui/table";
import { useToast as useShadToast } from "@/hooks/use-toast";
import { getStockData, type StockData } from '@/services/stock-data';
import { processStockData, analyzeForWChange, type CalculatedStockData, type WChangeAnalysisOutput } from '@/lib/calculations';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { DateSelectEventHandler } from 'react-day-picker';

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
  sector?: string | null;
  currentWeekDate: string; // Date of the current week's data point (e.g., Monday)
  currentWeekOpen: number | null;
  currentWeekHigh: number | null;
  currentWeekLow: number | null;
  currentWeekClose: number | null;
  currentWeekVolume: number | null;
  currentWeek5EMA: number | null;
  currentWeek5LEMA: number | null;
  currentWeek5HEMA: number | null;
  currentWeekATR: number | null;
  currentWeekPP: number | null;
  currentWeekH1: number | null;
  currentWeekL1: number | null;
  currentWeekH2: number | null;
  currentWeekL2: number | null;
  currentWeekH3: number | null;
  currentWeekL3: number | null;
  currentWeekH4: number | null;
  currentWeekL4: number | null;
  currentWeekJNSAR: number | null;
  jnsarWeekMinus1: number | null;
  jnsarWeekMinus2: number | null;
  jnsarWeekMinus3: number | null;
  jnsarWeekMinus4: number | null;
  dateWeekMinus1: string | null;
  dateWeekMinus2: string | null;
  dateWeekMinus3: string | null;
  dateWeekMinus4: string | null;
  changedToGreen: string; // Ticker or '0'
  changedToRed: string;   // Ticker or '0'
  currentWeekHH: string;
  currentWeekLL: string;
  currentWeekCL: string;
  currentWeekDiff: number | null;
  currentWeekAvgVolume: number | null;
  currentWeekVolumeAboveAvg: boolean | null;
  currentWeekLongTarget: number | null;
  currentWeekShortTarget: number | null;
  currentWeekLongEntry: number | null;
  currentWeekShortEntry: number | null;
}


const WReportPage: FC = () => {
  const [reportDate, setReportDate] = useState<Date | undefined>(new Date());
  const [reportData, setReportData] = useState<ReportRowData[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [processedCount, setProcessedCount] = useState(0);
  const { toast } = useShadToast();

  // Dynamic headers based on actual data dates
  const [dateHeaders, setDateHeaders] = useState({
    currentWeek: 'C.Week',
    weekMinus1: 'W-1',
    weekMinus2: 'W-2',
    weekMinus3: 'W-3',
    weekMinus4: 'W-4',
  });


  useEffect(() => {
    if (!reportDate) {
      setLoading(false);
      setReportData([]);
      setError("Please select a report date.");
      return;
    }

    const fetchAndProcessReportData = async () => {
      setLoading(true);
      setError(null);
      setProcessedCount(0);
      setReportData([]);
      setDateHeaders({ // Reset headers
        currentWeek: 'C.Week', weekMinus1: 'W-1', weekMinus2: 'W-2', weekMinus3: 'W-3', weekMinus4: 'W-4',
      });

      const totalStocks = ALL_POSSIBLE_STOCKS.length;
      const allReportRows: ReportRowData[] = [];
      // Fetch data up to the selected reportDate.
      // For weekly, Yahoo usually aligns to Monday. If reportDate is Fri, it fetches up to that week.
      const endDateForFetch = format(reportDate, 'yyyy-MM-dd');
      let accumulatedErrors: string[] = [];

      try {
        for (const stockTicker of ALL_POSSIBLE_STOCKS) {
          try {
            // Fetch 60 weeks of weekly data for calculations.
            const historicalWeeklyData: StockData[] = await getStockData(stockTicker, 60, endDateForFetch, '1wk');
            
            if (historicalWeeklyData && historicalWeeklyData.length > 0) {
              // processStockData now handles weekly data correctly
              const processedWeeklyData: CalculatedStockData[] = processStockData(historicalWeeklyData, historicalWeeklyData.map(d => d.date));
              
              // Data for current week (latest), and previous 4 weeks
              const currentWeekData = processedWeeklyData.length > 0 ? processedWeeklyData[processedWeeklyData.length - 1] : null;
              const weekMinus1Data = processedWeeklyData.length > 1 ? processedWeeklyData[processedWeeklyData.length - 2] : null;
              const weekMinus2Data = processedWeeklyData.length > 2 ? processedWeeklyData[processedWeeklyData.length - 3] : null;
              const weekMinus3Data = processedWeeklyData.length > 3 ? processedWeeklyData[processedWeeklyData.length - 4] : null;
              const weekMinus4Data = processedWeeklyData.length > 4 ? processedWeeklyData[processedWeeklyData.length - 5] : null;

              const sector = historicalWeeklyData[0]?.sector ?? null; 

              // For Green/Red triggers, use the weekly data series ending with the current week
              // Ensure at least 2 weeks of data for analyzeForWChange
              let greenTrigger = '0';
              let redTrigger = '0';
              if (processedWeeklyData.length >= 2) {
                  const wChangeAnalysisForCurrentWeek = analyzeForWChange({
                      stockName: stockTicker,
                      dailyData: processedWeeklyData, // Pass the full available weekly series
                  });
                  if (wChangeAnalysisForCurrentWeek?.isGreenJNSARTrigger) greenTrigger = stockTicker;
                  if (wChangeAnalysisForCurrentWeek?.isRedJNSARTrigger) redTrigger = stockTicker;
              }
              
              const reportRow: ReportRowData = {
                stockTicker,
                sector,
                currentWeekDate: currentWeekData?.date ?? format(reportDate, 'yyyy-MM-dd'), // Fallback if no data
                currentWeekOpen: currentWeekData?.open ?? null,
                currentWeekHigh: currentWeekData?.high ?? null,
                currentWeekLow: currentWeekData?.low ?? null,
                currentWeekClose: currentWeekData?.close ?? null,
                currentWeekVolume: currentWeekData?.volume ?? null,
                currentWeek5EMA: currentWeekData?.['5-EMA'] ?? null,
                currentWeek5LEMA: currentWeekData?.['5-LEMA'] ?? null,
                currentWeek5HEMA: currentWeekData?.['5-HEMA'] ?? null,
                currentWeekATR: currentWeekData?.['ATR'] ?? null,
                currentWeekPP: currentWeekData?.['PP'] ?? null,
                currentWeekH1: currentWeekData?.['H1'] ?? null,
                currentWeekL1: currentWeekData?.['L1'] ?? null,
                currentWeekH2: currentWeekData?.['H2'] ?? null,
                currentWeekL2: currentWeekData?.['L2'] ?? null,
                currentWeekH3: currentWeekData?.['H3'] ?? null,
                currentWeekL3: currentWeekData?.['L3'] ?? null,
                currentWeekH4: currentWeekData?.['H4'] ?? null,
                currentWeekL4: currentWeekData?.['L4'] ?? null,
                currentWeekJNSAR: currentWeekData?.['JNSAR'] ?? null,
                jnsarWeekMinus1: weekMinus1Data?.['JNSAR'] ?? null,
                jnsarWeekMinus2: weekMinus2Data?.['JNSAR'] ?? null,
                jnsarWeekMinus3: weekMinus3Data?.['JNSAR'] ?? null,
                jnsarWeekMinus4: weekMinus4Data?.['JNSAR'] ?? null,
                dateWeekMinus1: weekMinus1Data?.date ?? null,
                dateWeekMinus2: weekMinus2Data?.date ?? null,
                dateWeekMinus3: weekMinus3Data?.date ?? null,
                dateWeekMinus4: weekMinus4Data?.date ?? null,
                changedToGreen: greenTrigger,
                changedToRed: redTrigger,
                currentWeekHH: currentWeekData?.HH ?? '0',
                currentWeekLL: currentWeekData?.LL ?? '0',
                currentWeekCL: currentWeekData?.CL ?? '0',
                currentWeekDiff: currentWeekData?.Diff ?? null,
                currentWeekAvgVolume: currentWeekData?.AvgVolume ?? null,
                currentWeekVolumeAboveAvg: currentWeekData?.['Volume > 150%'] ?? null,
                currentWeekLongTarget: currentWeekData?.LongTarget ?? null,
                currentWeekShortTarget: currentWeekData?.ShortTarget ?? null,
                currentWeekLongEntry: currentWeekData?.['Long@'] ?? null,
                currentWeekShortEntry: currentWeekData?.['Short@'] ?? null,
              };
              allReportRows.push(reportRow);

              // Update date headers if this is the first stock processed and data exists
              if (allReportRows.length === 1) {
                setDateHeaders({
                  currentWeek: currentWeekData?.date ? format(parseISO(currentWeekData.date), 'ddMMMyy') : 'C.Week',
                  weekMinus1: weekMinus1Data?.date ? format(parseISO(weekMinus1Data.date), 'ddMMMyy') : 'W-1',
                  weekMinus2: weekMinus2Data?.date ? format(parseISO(weekMinus2Data.date), 'ddMMMyy') : 'W-2',
                  weekMinus3: weekMinus3Data?.date ? format(parseISO(weekMinus3Data.date), 'ddMMMyy') : 'W-3',
                  weekMinus4: weekMinus4Data?.date ? format(parseISO(weekMinus4Data.date), 'ddMMMyy') : 'W-4',
                });
              }
            }
          } catch (err: any) {
            console.error(`Error fetching or processing weekly data for ${stockTicker} on W.Report:`, err);
            accumulatedErrors.push(`Error for ${stockTicker}: ${err.message}`);
          }
          setProcessedCount(count => count + 1);
        }

        if (accumulatedErrors.length > 0) {
          setError(accumulatedErrors.join('\n'));
        }
        setReportData(allReportRows);

        if (allReportRows.length === 0 && totalStocks > 0 && accumulatedErrors.length === 0) {
          toast({ title: "No Data", description: `No weekly report data could be generated for week ending ${format(reportDate, "PPP")}. Check data availability.` });
        } else if (allReportRows.length > 0) {
          toast({ title: "Report Generated", description: `Successfully processed weekly report data for week ending ${format(reportDate, "PPP")}.` });
        } else if (accumulatedErrors.length > 0) {
             toast({ variant: "destructive", title: "Report Incomplete", description: "Some stock data could not be processed. See errors below." });
        }

      } catch (overallError: any) {
        console.error("Overall error in W.Report weekly data fetching:", overallError);
        setError(prevError => {
            const newMsg = `An unexpected error occurred during report generation: ${overallError.message}`;
            return prevError ? `${prevError}\n${newMsg}` : newMsg;
        });
        toast({ variant: "destructive", title: "Report Generation Failed", description: "Could not complete data processing due to an unexpected error." });
      } finally {
        setLoading(false);
      }
    };

    fetchAndProcessReportData();

  }, [reportDate, toast]);

  const formatReportValue = (value: any): string | number => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'number') return parseFloat(value.toFixed(2));
    if (typeof value === 'boolean') return value ? 'Y' : 'N'; 
    return String(value);
  };
  
  const handleDownloadExcel = () => {
    if (isDownloading || reportData.length === 0) {
      toast({ title: "Download Info", description: isDownloading ? "Download in progress." : "No report data to download." });
      return;
    }
    setIsDownloading(true);
    toast({ title: "Download Started", description: `Preparing Weekly W.Report for week ending ${format(reportDate || new Date(), "yyyy-MM-dd")}.` });

    try {
        const dataForSheet = reportData.map(row => ({
            'Scrip': row.stockTicker,
            'Sector': row.sector ?? '-',
            'Week Of': row.currentWeekDate ? format(parseISO(row.currentWeekDate), 'dd MMM yyyy') : '-',
            'Open (W)': row.currentWeekOpen,
            'High (W)': row.currentWeekHigh,
            'Low (W)': row.currentWeekLow,
            'Close (W)': row.currentWeekClose,
            'Volume (W)': row.currentWeekVolume,
            '5EMA (W)': row.currentWeek5EMA,
            '5LEMA (W)': row.currentWeek5LEMA,
            '5HEMA (W)': row.currentWeek5HEMA,
            'ATR (W)': row.currentWeekATR,
            'PP (W)': row.currentWeekPP,
            'H1 (W)': row.currentWeekH1, 'L1 (W)': row.currentWeekL1,
            'H2 (W)': row.currentWeekH2, 'L2 (W)': row.currentWeekL2,
            'H3 (W)': row.currentWeekH3, 'L3 (W)': row.currentWeekL3,
            'H4 (W)': row.currentWeekH4, 'L4 (W)': row.currentWeekL4,
            [`JNSAR (${row.currentWeekDate ? format(parseISO(row.currentWeekDate), 'ddMMMyy') : 'C.Week'})`]: row.currentWeekJNSAR,
            [`JNSAR (${row.dateWeekMinus1 ? format(parseISO(row.dateWeekMinus1), 'ddMMMyy') : 'W-1'})`]: row.jnsarWeekMinus1,
            [`JNSAR (${row.dateWeekMinus2 ? format(parseISO(row.dateWeekMinus2), 'ddMMMyy') : 'W-2'})`]: row.jnsarWeekMinus2,
            [`JNSAR (${row.dateWeekMinus3 ? format(parseISO(row.dateWeekMinus3), 'ddMMMyy') : 'W-3'})`]: row.jnsarWeekMinus3,
            [`JNSAR (${row.dateWeekMinus4 ? format(parseISO(row.dateWeekMinus4), 'ddMMMyy') : 'W-4'})`]: row.jnsarWeekMinus4,
            'Chngd to GREEN (W)': row.changedToGreen,
            'Chngd to RED (W)': row.changedToRed,
            'HH (W)': row.currentWeekHH,
            'LL (W)': row.currentWeekLL,
            'CL (W)': row.currentWeekCL,
            'Diff (W)': row.currentWeekDiff,
            'Avg Vol (W)': row.currentWeekAvgVolume,
            'Vol > 150% (W)': row.currentWeekVolumeAboveAvg === null ? '-' : (row.currentWeekVolumeAboveAvg ? 'Y' : 'N'),
            'Long @ (W)': row.currentWeekLongEntry,
            'Short @ (W)': row.currentWeekShortEntry,
            'Long Target (W)': row.currentWeekLongTarget,
            'Short Target (W)': row.currentWeekShortTarget,
        }));

      const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, `WReport_Weekly_${format(reportDate || new Date(), "yyyyMMdd")}`);
      XLSX.writeFile(workbook, `WReport_Weekly_Data_${format(reportDate || new Date(), "yyyyMMdd")}.xlsx`);

      toast({ title: "Download Complete", description: `Weekly W.Report data downloaded.` });
    } catch (e: any) {
      console.error("Error generating Weekly W.Report Excel:", e);
      toast({ variant: "destructive", title: "Download Error", description: e.message || "Could not generate Excel file." });
    } finally {
      setIsDownloading(false);
    }
  };
  
  const scrollAreaHeight = "h-[calc(100vh-280px)]"; 

  return (
    <main className="container mx-auto py-6 px-4">
        <Card className="shadow-lg border border-border rounded-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 pt-4 px-4 border-b">
                <div>
                    <CardTitle className="text-xl font-semibold text-foreground">W.Report (Weekly Snapshot)</CardTitle>
                    <CardDescription>
                        Weekly stock performance and JNSAR values for the selected week and preceding 4 weeks.
                        {loading && ` Processing ${processedCount} of ${ALL_POSSIBLE_STOCKS.length} stocks...`}
                    </CardDescription>
                </div>
                <div className="flex items-center space-x-3">
                    <Popover>
                        <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className={cn(
                            "w-[200px] justify-start text-left font-normal h-9 text-sm",
                            !reportDate && "text-muted-foreground"
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {reportDate ? format(reportDate, "PPP") : <span>Pick report week-ending date</span>}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                        <Calendar
                            mode="single"
                            selected={reportDate}
                            onSelect={setReportDate as DateSelectEventHandler}
                            initialFocus
                            disabled={(date) => date > new Date() || date < new Date("2000-01-01")}
                        />
                        </PopoverContent>
                    </Popover>
                    <Button onClick={handleDownloadExcel} disabled={isDownloading || loading || reportData.length === 0} className="h-9 text-sm">
                        <Download className="mr-2 h-4 w-4" />
                        {isDownloading ? 'Downloading...' : 'Download Report'}
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {error && <Alert variant="destructive" className="m-4"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error Details</AlertTitle><AlertDescription className="whitespace-pre-line max-h-32 overflow-y-auto">{error}</AlertDescription></Alert>}
                
                <ScrollArea className={scrollAreaHeight}>
                    <Table>
                        <TableHeader className="sticky top-0 bg-card z-10">
                            <TableRow>
                                <TableHead className="min-w-[100px] whitespace-nowrap">Scrip</TableHead>
                                <TableHead className="min-w-[100px] whitespace-nowrap">Sector</TableHead>
                                <TableHead className="min-w-[100px] whitespace-nowrap">Close (Week of {dateHeaders.currentWeek})</TableHead>
                                <TableHead className="min-w-[120px] whitespace-nowrap">JNSAR (Week of {dateHeaders.currentWeek})</TableHead>
                                <TableHead className="min-w-[120px] whitespace-nowrap">JNSAR (Week of {dateHeaders.weekMinus1})</TableHead>
                                <TableHead className="min-w-[120px] whitespace-nowrap">JNSAR (Week of {dateHeaders.weekMinus2})</TableHead>
                                <TableHead className="min-w-[120px] whitespace-nowrap">JNSAR (Week of {dateHeaders.weekMinus3})</TableHead>
                                <TableHead className="min-w-[120px] whitespace-nowrap">JNSAR (Week of {dateHeaders.weekMinus4})</TableHead>
                                <TableHead className="min-w-[150px] whitespace-nowrap">Chngd to GREEN (W)</TableHead>
                                <TableHead className="min-w-[150px] whitespace-nowrap">Chngd to RED (W)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                        {loading && processedCount < ALL_POSSIBLE_STOCKS.length && reportData.length === 0 ? (
                            [...Array(10)].map((_, i) => (
                                <TableRow key={`skel-${i}`}>
                                    <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                                </TableRow>
                            ))
                        ) : reportData.length > 0 ? (
                            reportData.map((row) => (
                            <TableRow key={row.stockTicker}>
                                <TableCell className="font-medium whitespace-nowrap">{row.stockTicker}</TableCell>
                                <TableCell className="whitespace-nowrap">{row.sector ?? '-'}</TableCell>
                                <TableCell className="whitespace-nowrap">{formatReportValue(row.currentWeekClose)}</TableCell>
                                <TableCell className="whitespace-nowrap">{formatReportValue(row.currentWeekJNSAR)}</TableCell>
                                <TableCell className="whitespace-nowrap">{formatReportValue(row.jnsarWeekMinus1)}</TableCell>
                                <TableCell className="whitespace-nowrap">{formatReportValue(row.jnsarWeekMinus2)}</TableCell>
                                <TableCell className="whitespace-nowrap">{formatReportValue(row.jnsarWeekMinus3)}</TableCell>
                                <TableCell className="whitespace-nowrap">{formatReportValue(row.jnsarWeekMinus4)}</TableCell>
                                <TableCell className={cn("whitespace-nowrap", row.changedToGreen !== '0' ? 'text-green-600 font-semibold' : '')}>{row.changedToGreen}</TableCell>
                                <TableCell className={cn("whitespace-nowrap", row.changedToRed !== '0' ? 'text-red-600 font-semibold' : '')}>{row.changedToRed}</TableCell>
                            </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={10} className="text-center h-24">
                                    {loading ? <div className="flex items-center justify-center"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading report data...</div> : (error && error.includes("Please select a report date.")) ? "Please select a report date to generate the report." : "No data available for the selected week or an error occurred. Please try a different date or check error details."}
                                </TableCell>
                            </TableRow>
                        )}
                        </TableBody>
                    </Table>
                </ScrollArea>
                {reportData.length > 0 && !loading && <TableCaption className="py-2">Displaying weekly data for {reportData.length} stocks for week ending around {reportDate ? format(reportDate, "PPP") : 'latest'}.</TableCaption>}
                 {reportData.length === 0 && !loading && !error && <TableCaption className="py-2">No weekly report data generated for week ending {reportDate ? format(reportDate, "PPP") : 'the selected date'}.</TableCaption>}
            </CardContent>
        </Card>
    </main>
  );
};

export default WReportPage;
