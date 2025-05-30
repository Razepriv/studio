
'use client';

import { FC, useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { format, subDays, isValid, parseISO } from 'date-fns';
import { Calendar as CalendarIcon, Download, AlertTriangle, Info, Loader2 } from 'lucide-react';

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell, TableCaption } from "@/components/ui/table";
import { useToast as useShadToast } from "@/hooks/use-toast"; // Renamed to avoid conflict
import { getStockData, type StockData } from '@/services/stock-data';
import { processStockData, analyzeForWChange, type CalculatedStockData, type WChangeAnalysisOutput, type WChangeSignalSummary } from '@/lib/calculations';
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
  cDayDate: string;
  cDayOpen: number | null;
  cDayHigh: number | null;
  cDayLow: number | null;
  cDayClose: number | null;
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
  cDayJNSAR: number | null;
  jnsarCMinus1: number | null;
  jnsarCMinus2: number | null;
  jnsarCMinus3: number | null;
  jnsarCMinus4: number | null;
  changedToGreen: string; // Ticker or '0'
  changedToRed: string;   // Ticker or '0'
  // Additional fields from CalculatedStockData for cDay if needed for Excel
  cDayHH: string;
  cDayLL: string;
  cDayCL: string;
  cDayDiff: number | null;
  cDayAvgVolume: number | null;
  cDayVolumeAboveAvg: boolean | null;
  cDayLongTarget: number | null;
  cDayShortTarget: number | null;
  cDayLongEntry: number | null;
  cDayShortEntry: number | null;
}


interface DatesToDisplay {
  cDay: string;
  cMinus1: string;
  cMinus2: string;
  cMinus3: string;
  cMinus4: string;
}

const WReportPage: FC = () => {
  const [reportDate, setReportDate] = useState<Date | undefined>(new Date());
  const [reportData, setReportData] = useState<ReportRowData[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [processedCount, setProcessedCount] = useState(0);
  const { toast } = useShadToast();

  const datesToDisplay: DatesToDisplay = useMemo(() => {
    const base = reportDate || new Date();
    return {
      cDay: format(base, 'yyyy-MM-dd'),
      cMinus1: format(subDays(base, 1), 'yyyy-MM-dd'),
      cMinus2: format(subDays(base, 2), 'yyyy-MM-dd'),
      cMinus3: format(subDays(base, 3), 'yyyy-MM-dd'),
      cMinus4: format(subDays(base, 4), 'yyyy-MM-dd')
    };
  }, [reportDate]);

  useEffect(() => {
    if (!reportDate) return; // Don't fetch if no date is selected

    const fetchAndProcessReportData = async () => {
      setLoading(true);
      setError(null);
      setProcessedCount(0);
      setReportData([]); // Clear previous data

      const totalStocks = ALL_POSSIBLE_STOCKS.length;
      const allReportRows: ReportRowData[] = [];

      const endDateForFetch = format(reportDate, 'yyyy-MM-dd');

      for (const stockTicker of ALL_POSSIBLE_STOCKS) {
        try {
          // Fetch ~60 days of daily data ending at reportDate for each stock
          // This ensures enough historical data for indicators on C.Day, C-1, ..., C-4
          const historicalDailyData: StockData[] = await getStockData(stockTicker, 60, endDateForFetch, '1d');
          
          if (historicalDailyData && historicalDailyData.length > 0) {
            const processedDailyData: CalculatedStockData[] = processStockData(historicalDailyData, historicalDailyData.map(d => d.date));
            
            // Find data points for C.Day, C-1, ..., C-4
            const cDayData = processedDailyData.find(d => d.date === datesToDisplay.cDay);
            const cMinus1Data = processedDailyData.find(d => d.date === datesToDisplay.cMinus1);
            const cMinus2Data = processedDailyData.find(d => d.date === datesToDisplay.cMinus2);
            const cMinus3Data = processedDailyData.find(d => d.date === datesToDisplay.cMinus3);
            const cMinus4Data = processedDailyData.find(d => d.date === datesToDisplay.cMinus4);

            const sector = historicalDailyData[0]?.sector ?? null; // Basic sector extraction

            // Determine Green/Red triggers specifically for C.Day
            // We need to pass data up to C.Day to analyzeForWChange
            const contextForWChange = processedDailyData.filter(d => {
                const dDate = parseISO(d.date);
                return isValid(dDate) && dDate <= parseISO(datesToDisplay.cDay);
            });

            let greenTrigger = '0';
            let redTrigger = '0';

            if (contextForWChange.length >=2) { // analyzeForWChange needs at least 2 data points
                const wChangeAnalysisForCDay = analyzeForWChange({
                    stockName: stockTicker,
                    dailyData: contextForWChange, 
                    // r5Trend and l5Validation defaults will apply
                });
                if (wChangeAnalysisForCDay?.isGreenJNSARTrigger) greenTrigger = stockTicker;
                if (wChangeAnalysisForCDay?.isRedJNSARTrigger) redTrigger = stockTicker;
            }
            
            const reportRow: ReportRowData = {
              stockTicker,
              sector,
              cDayDate: cDayData?.date ?? datesToDisplay.cDay,
              cDayOpen: cDayData?.open ?? null,
              cDayHigh: cDayData?.high ?? null,
              cDayLow: cDayData?.low ?? null,
              cDayClose: cDayData?.close ?? null,
              cDayVolume: cDayData?.volume ?? null,
              cDay5EMA: cDayData?.['5-EMA'] ?? null,
              cDay5LEMA: cDayData?.['5-LEMA'] ?? null,
              cDay5HEMA: cDayData?.['5-HEMA'] ?? null,
              cDayATR: cDayData?.['ATR'] ?? null,
              cDayPP: cDayData?.['PP'] ?? null,
              cDayH1: cDayData?.['H1'] ?? null,
              cDayL1: cDayData?.['L1'] ?? null,
              cDayH2: cDayData?.['H2'] ?? null,
              cDayL2: cDayData?.['L2'] ?? null,
              cDayH3: cDayData?.['H3'] ?? null,
              cDayL3: cDayData?.['L3'] ?? null,
              cDayH4: cDayData?.['H4'] ?? null,
              cDayL4: cDayData?.['L4'] ?? null,
              cDayJNSAR: cDayData?.['JNSAR'] ?? null,
              jnsarCMinus1: cMinus1Data?.['JNSAR'] ?? null,
              jnsarCMinus2: cMinus2Data?.['JNSAR'] ?? null,
              jnsarCMinus3: cMinus3Data?.['JNSAR'] ?? null,
              jnsarCMinus4: cMinus4Data?.['JNSAR'] ?? null,
              changedToGreen: greenTrigger,
              changedToRed: redTrigger,
              cDayHH: cDayData?.HH ?? '0',
              cDayLL: cDayData?.LL ?? '0',
              cDayCL: cDayData?.CL ?? '0',
              cDayDiff: cDayData?.Diff ?? null,
              cDayAvgVolume: cDayData?.AvgVolume ?? null,
              cDayVolumeAboveAvg: cDayData?.['Volume > 150%'] ?? null,
              cDayLongTarget: cDayData?.LongTarget ?? null,
              cDayShortTarget: cDayData?.ShortTarget ?? null,
              cDayLongEntry: cDayData?.['Long@'] ?? null,
              cDayShortEntry: cDayData?.['Short@'] ?? null,
            };
            allReportRows.push(reportRow);
          }
        } catch (err: any) {
          console.error(`Error fetching or processing data for ${stockTicker} on W.Report:`, err);
          setError(`Error for ${stockTicker}: ${err.message}. Some data might be missing.`);
          // Continue processing other stocks
        }
        setProcessedCount(count => count + 1);
      }
      setReportData(allReportRows);

      if (allReportRows.length === 0 && totalStocks > 0 && !error) {
        toast({ title: "No Data", description: `No report data could be generated for ${format(reportDate, "PPP")}. Check data availability for this date.` });
      } else if (allReportRows.length > 0) {
        toast({ title: "Report Generated", description: `Successfully processed report data for ${format(reportDate, "PPP")}.` });
      }
      // If there was an error, it's already set and will be displayed.

    } finally {
      setLoading(false);
    }
    };

    fetchAndProcessReportData();

  }, [reportDate, datesToDisplay, toast]);

  const formatReportValue = (value: any): string | number => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'number') return parseFloat(value.toFixed(2));
    if (typeof value === 'boolean') return value ? 'Y' : 'N'; // Or TRUE/FALSE
    return String(value);
  };
  
  const handleDownloadExcel = () => {
    if (isDownloading || reportData.length === 0) {
      toast({ title: "Download Info", description: isDownloading ? "Download in progress." : "No report data to download." });
      return;
    }
    setIsDownloading(true);
    toast({ title: "Download Started", description: `Preparing W.Report for ${format(reportDate || new Date(), "yyyy-MM-dd")}.` });

    try {
        const dataForSheet = reportData.map(row => ({
            'Scrip': row.stockTicker,
            'Sector': row.sector ?? '-',
            'Date': row.cDayDate,
            'Open': row.cDayOpen,
            'High': row.cDayHigh,
            'Low': row.cDayLow,
            'Close': row.cDayClose,
            'Volume': row.cDayVolume,
            '5EMA': row.cDay5EMA,
            '5LEMA': row.cDay5LEMA,
            '5HEMA': row.cDay5HEMA,
            'ATR': row.cDayATR,
            'PP': row.cDayPP,
            'H1': row.cDayH1, 'L1': row.cDayL1,
            'H2': row.cDayH2, 'L2': row.cDayL2,
            'H3': row.cDayH3, 'L3': row.cDayL3,
            'H4': row.cDayH4, 'L4': row.cDayL4,
            [`JNSAR ${format(parseISO(datesToDisplay.cDay), 'ddMMMyy')}`]: row.cDayJNSAR,
            [`JNSAR ${format(parseISO(datesToDisplay.cMinus1), 'ddMMMyy')}`]: row.jnsarCMinus1,
            [`JNSAR ${format(parseISO(datesToDisplay.cMinus2), 'ddMMMyy')}`]: row.jnsarCMinus2,
            [`JNSAR ${format(parseISO(datesToDisplay.cMinus3), 'ddMMMyy')}`]: row.jnsarCMinus3,
            [`JNSAR ${format(parseISO(datesToDisplay.cMinus4), 'ddMMMyy')}`]: row.jnsarCMinus4,
            'Chngd to GREEN': row.changedToGreen,
            'Chngd to RED': row.changedToRed,
            'HH': row.cDayHH,
            'LL': row.cDayLL,
            'CL': row.cDayCL,
            'Diff': row.cDayDiff,
            'Avg Vol': row.cDayAvgVolume,
            'Vol > 150%': row.cDayVolumeAboveAvg === null ? '-' : (row.cDayVolumeAboveAvg ? 'Y' : 'N'),
            'Long @': row.cDayLongEntry,
            'Short @': row.cDayShortEntry,
            'Long Target': row.cDayLongTarget,
            'Short Target': row.cDayShortTarget,
        }));

      const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, `WReport_${format(reportDate || new Date(), "yyyyMMdd")}`);
      XLSX.writeFile(workbook, `WReport_Data_${format(reportDate || new Date(), "yyyyMMdd")}.xlsx`);

      toast({ title: "Download Complete", description: `W.Report data downloaded.` });
    } catch (e: any) {
      console.error("Error generating W.Report Excel:", e);
      toast({ variant: "destructive", title: "Download Error", description: e.message || "Could not generate Excel file." });
    } finally {
      setIsDownloading(false);
    }
  };
  
  const scrollAreaHeight = "h-[calc(100vh-280px)]"; // Adjust based on header/footer height

  return (
    <main className="container mx-auto py-6 px-4">
        <Card className="shadow-lg border border-border rounded-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 pt-4 px-4 border-b">
                <div>
                    <CardTitle className="text-xl font-semibold text-foreground">W.Report (Daily Snapshot)</CardTitle>
                    <CardDescription>
                        Daily stock performance and JNSAR values for the selected date and preceding 4 days.
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
                            {reportDate ? format(reportDate, "PPP") : <span>Pick a report date</span>}
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
                {error && <Alert variant="destructive" className="m-4"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
                
                <ScrollArea className={scrollAreaHeight}>
                    <Table>
                        <TableHeader className="sticky top-0 bg-card z-10">
                            <TableRow>
                                <TableHead className="min-w-[100px]">Scrip</TableHead>
                                <TableHead className="min-w-[100px]">Sector</TableHead>
                                <TableHead className="min-w-[100px]">Close ({format(parseISO(datesToDisplay.cDay), 'ddMMMyy')})</TableHead>
                                <TableHead className="min-w-[120px]">JNSAR ({format(parseISO(datesToDisplay.cDay), 'ddMMMyy')})</TableHead>
                                <TableHead className="min-w-[120px]">JNSAR ({format(parseISO(datesToDisplay.cMinus1), 'ddMMMyy')})</TableHead>
                                <TableHead className="min-w-[120px]">JNSAR ({format(parseISO(datesToDisplay.cMinus2), 'ddMMMyy')})</TableHead>
                                <TableHead className="min-w-[120px]">JNSAR ({format(parseISO(datesToDisplay.cMinus3), 'ddMMMyy')})</TableHead>
                                <TableHead className="min-w-[120px]">JNSAR ({format(parseISO(datesToDisplay.cMinus4), 'ddMMMyy')})</TableHead>
                                <TableHead className="min-w-[150px]">Chngd to GREEN</TableHead>
                                <TableHead className="min-w-[150px]">Chngd to RED</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                        {loading && processedCount < ALL_POSSIBLE_STOCKS.length ? (
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
                                <TableCell className="font-medium">{row.stockTicker}</TableCell>
                                <TableCell>{row.sector ?? '-'}</TableCell>
                                <TableCell>{formatReportValue(row.cDayClose)}</TableCell>
                                <TableCell>{formatReportValue(row.cDayJNSAR)}</TableCell>
                                <TableCell>{formatReportValue(row.jnsarCMinus1)}</TableCell>
                                <TableCell>{formatReportValue(row.jnsarCMinus2)}</TableCell>
                                <TableCell>{formatReportValue(row.jnsarCMinus3)}</TableCell>
                                <TableCell>{formatReportValue(row.jnsarCMinus4)}</TableCell>
                                <TableCell className={row.changedToGreen !== '0' ? 'text-green-600 font-semibold' : ''}>{row.changedToGreen}</TableCell>
                                <TableCell className={row.changedToRed !== '0' ? 'text-red-600 font-semibold' : ''}>{row.changedToRed}</TableCell>
                            </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={10} className="text-center h-24">
                                    {loading ? <div className="flex items-center justify-center"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading report data...</div> : 'No data available for the selected date. Please pick a different date.'}
                                </TableCell>
                            </TableRow>
                        )}
                        </TableBody>
                    </Table>
                </ScrollArea>
                {reportData.length > 0 && <TableCaption className="py-2">Displaying daily data for {reportData.length} stocks as of {reportDate ? format(reportDate, "PPP") : 'latest'}.</TableCaption>}
            </CardContent>
        </Card>
    </main>
  );
};

export default WReportPage;

