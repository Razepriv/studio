
'use client';

import type { FC } from 'react';
import { useState, useEffect, useMemo } from 'react';
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
    changedToGreen: string; // Ticker or "0"
    changedToRed: string;   // Ticker or "0"
    // Add other C-N day data like volume checks if needed later
}

const WReportPage: FC = () => {
    const [reportDate, setReportDate] = useState<Date>(new Date());
    const [reportData, setReportData] = useState<ReportRowData[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();
    const [isDownloading, setIsDownloading] = useState<boolean>(false);
    const [processedCount, setProcessedCount] = useState(0);

    const datesToDisplay = useMemo(() => {
        const base = reportDate || new Date(); // Ensure reportDate is not undefined
        return {
            cDay: format(base, "yyyy-MM-dd"),
            cMinus1: format(subDays(base, 1), "yyyy-MM-dd"),
            cMinus2: format(subDays(base, 2), "yyyy-MM-dd"),
            cMinus3: format(subDays(base, 3), "yyyy-MM-dd"),
            cMinus4: format(subDays(base, 4), "yyyy-MM-dd"),
        };
    }, [reportDate]);

    useEffect(() => {
        const fetchAndProcessReportData = async () => {
            if (!reportDate || !isValid(reportDate)) {
                 // Clear any previous data or errors when date is invalid
                setReportData([]);
                setLoading(false);
                setError("Please select a valid report date.");
                setReportData([]);
                return;
            }
            setLoading(true);
            setError(null);
            setProcessedCount(0);
            const results: ReportRowData[] = [];

            const previousWeekReportDate = subDays(reportDate, 7);
            const previousWeekDatesToDisplay = format(previousWeekReportDate, "yyyy-MM-dd");

            const totalStocks = ALL_POSSIBLE_STOCKS.length;
            // Fetch data for ~40 days up to the reportDate to ensure indicators are calculated
            const daysToFetch = 45; 
            // The getStockData function expects number of *past* days, so if reportDate is T,
            // and we need T and T-30 for calcs, we'd need to adjust how `getStockData` and `processStockData` handle date ranges.
            // For now, getStockData fetches `days` prior to *today*.
            // We need to ensure processStockData can give us indicators for a specific historical date.

            for (let i = 0; i < totalStocks; i++) {
                const stockTicker = ALL_POSSIBLE_STOCKS[i];
                try {
                    // Fetch data ending on reportDate.
                    // Need to adjust getStockData or add new service for specific date ranges,
                    // For now, we'll fetch a larger chunk and filter.
                    // getStockData fetches from `days` ago until `today`.
                    // We need data up to `reportDate`. Use the endDate parameter.
                    // Simplification: Fetch recent data (e.g. 60 days from today) then filter.
                    // This isn't ideal for very old reportDates but works for recent ones.
                    const rawStockData: StockData[] = await getStockData(stockTicker, 60);

                    if (rawStockData && rawStockData.length > 0) {
                        const allDates = rawStockData.map(d => d.date);
                        const processed = processStockData(rawStockData, allDates);
                        
                        const reportDayData = processed.find(p => p.date === datesToDisplay.cDay); // This should now be present if data up to cDay was fetched
                        const reportDayMinus1Data = processed.find(p => p.date === datesToDisplay.cMinus1);
                        const reportDayMinus2Data = processed.find(p => p.date === datesToDisplay.cMinus2);
                        const reportDayMinus3Data = processed.find(p => p.date === datesToDisplay.cMinus3);
                        const reportDayMinus4Data = processed.find(p => p.date === datesToDisplay.cMinus4);

                        let greenTrigger = "0", redTrigger = "0";
                        // Analyze for C.Day trigger
                        // For analyzeForWChange, dailyData should be chronological with C.Day being the last
                        const relevantDataForAnalysis = processed.filter(p => {
                            const pDate = parseISO(p.date); // Use parsed date for comparison
                            return isValid(pDate) && pDate <= reportDate;
                        }).slice(-5); // Use last 5 relevant days for analysis context if needed, or more for stability

                        if (relevantDataForAnalysis.length >=2 ) {
                             const analysis = analyzeForWChange({
                                stockName: stockTicker,
                                dailyData: relevantDataForAnalysis,
                            });
                            if (analysis?.isGreenJNSARTrigger) greenTrigger = stockTicker;
                            if (analysis?.isRedJNSARTrigger) redTrigger = stockTicker;
                        }


                        results.push({
                            stockTicker: stockTicker,
                            cDayOpen: reportDayData?.open ?? null,
                            cDayHigh: reportDayData?.high ?? null,
                            cDayLow: reportDayData?.low ?? null,
                            cDayVolume: reportDayData?.volume ?? null,
                            cDay5EMA: reportDayData?.['5-EMA'] ?? null,
                            cDay5LEMA: reportDayData?.['5-LEMA'] ?? null,
                            cDay5HEMA: reportDayData?.['5-HEMA'] ?? null,
                            cDayATR: reportDayData?.['ATR'] ?? null,
                            cDayPP: reportDayData?.['PP'] ?? null,
                            cDayH1: reportDayData?.['H1'] ?? null,
                            cDayL1: reportDayData?.['L1'] ?? null,
                            cDayH2: reportDayData?.['H2'] ?? null,
                            cDayL2: reportDayData?.['L2'] ?? null,
                            cDayH3: reportDayData?.['H3'] ?? null,
                            cDayL3: reportDayData?.['L3'] ?? null,
                            cDayH4: reportDayData?.['H4'] ?? null,
                            cDayL4: reportDayData?.['L4'] ?? null,
                            cDayLongEntry: reportDayData?.['Long@'] ?? null,
                            cDayShortEntry: reportDayData?.['Short@'] ?? null,
                            cDayHH: reportDayData?.['HH'] ?? '0', // Default to '0' if null/undefined
                            cDayLL: reportDayData?.['LL'] ?? '0', // Default to '0' if null/undefined
                            cDayCL: reportDayData?.['CL'] ?? '0', // Default to '0' if null/undefined
                            cDayClose: reportDayData?.close ?? null,
                            jnsarCDay: reportDayData?.['JNSAR'] ?? null,
                            jnsarCMinus1: reportDayMinus1Data?.['JNSAR'] ?? null,
                            jnsarCMinus2: reportDayMinus2Data?.['JNSAR'] ?? null,
                            jnsarCMinus3: reportDayMinus3Data?.['JNSAR'] ?? null,
                            jnsarCMinus4: reportDayMinus4Data?.['JNSAR'] ?? null,
                            changedToGreen: greenTrigger,
                            cDayDiff: reportDayData?.['Diff'] ?? null,
                            cDayAvgVolume: reportDayData?.['AvgVolume'] ?? null,
                            cDayVolumeAboveAvg: reportDayData?.['Volume > 150%'] ?? null,
                            cDayLongTarget: reportDayData?.['LongTarget'] ?? null,
                            cDayShortTarget: reportDayData?.['ShortTarget'] ?? null,
                            changedToRed: redTrigger,
                        });
                    }
                } catch (err: any) {
                    console.warn(`Error processing ${stockTicker} for W.Report:`, err.message);
                }
                setProcessedCount(prev => prev + 1);
            }
            setReportData(results);
            setLoading(false);
             if (results.length === 0 && totalStocks > 0) {
                toast({
                    variant: "default",
                    title: "Processing Complete",
                    description: "No data could be generated for the selected report date and stocks. Ensure data availability.",
                });
            } else if (results.length > 0) {
                 toast({
                    title: "Report Generated",
                    description: `Successfully generated report for ${format(reportDate, "PPP")}.`,
                });
            }
        };
        fetchAndProcessReportData();
    }, [reportDate, toast, datesToDisplay]);
    
    const columns = useMemo(() => [
        { key: 'stockTicker', label: 'Scrip', sticky: true },
        { key: 'jnsarCMinus4', label: `JNSAR ${format(parseISO(datesToDisplay.cMinus4), "dd/MM")}` },
        { key: 'jnsarCMinus3', label: `JNSAR ${format(parseISO(datesToDisplay.cMinus3), "dd/MM")}` },
        { key: 'jnsarCMinus2', label: `JNSAR ${format(parseISO(datesToDisplay.cMinus2), "dd/MM")}` },
        { key: 'jnsarCMinus1', label: `JNSAR ${format(parseISO(datesToDisplay.cMinus1), "dd/MM")}` },
        { key: 'jnsarCDay', label: `JNSAR ${format(parseISO(datesToDisplay.cDay), "dd/MM")}` },
        { key: 'cDayClose', label: `C.Day Close ${format(parseISO(datesToDisplay.cDay), "dd/MM")}` },
        { key: 'changedToGreen', label: 'Chngd to GREEN' },
        { key: 'changedToRed', label: 'Chngd to RED' },
    ], [datesToDisplay]);

    const formatValueForDisplay = (value: any, key: keyof ReportRowData): React.ReactNode => {
        if (value === null || value === undefined) return '-';
        if (key === 'changedToGreen' || key === 'changedToRed') {
            return value !== "0" ? <span className="font-semibold text-accent">{value}</span> : "0";
        }
        if (typeof value === 'number') {
            return value.toFixed(2);
        }
        return String(value);
    };
    
    const handleDownloadExcel = () => {
        if (isDownloading || reportData.length === 0) {
            toast({ title: "Download Info", description: isDownloading ? "Download in progress." : "No data to download." });
            return;
        }
        setIsDownloading(true);
        toast({ title: "Download Started", description: `Preparing W.Report for ${format(reportDate, "yyyy-MM-dd")}.` });

        try {
            const dataForSheet = reportData.map(row => {
                // Explicitly map fields to desired Excel column headers
                const newRow: { [key: string]: any } = {
                    "Scrip": row.stockTicker,
                    "C.Day Close": row.cDayClose,
                    "C.Day Open": row.cDayOpen,
                    "C.Day High": row.cDayHigh,
                    "C.Day Low": row.cDayLow,
                    "C.Day Volume": row.cDayVolume,
                    "C.Day 5-EMA": row.cDay5EMA,
                    "C.Day 5-LEMA": row.cDay5LEMA,
                    "C.Day 5-HEMA": row.cDay5HEMA,
                    "C.Day ATR": row.cDayATR,
                    "C.Day PP": row.cDayPP,
                    "C.Day H1": row.cDayH1,
                    "C.Day L1": row.cDayL1,
                    "C.Day H2": row.cDayH2,
                    "C.Day L2": row.cDayL2,
                    "C.Day H3": row.cDayH3,
                    "C.Day L3": row.cDayL3,
                    "C.Day H4": row.cDayH4,
                    "C.Day L4": row.cDayL4,
                    [`JNSAR ${format(parseISO(datesToDisplay.cMinus4), "dd/MM")}`]: row.jnsarCMinus4,
                    [`JNSAR ${format(parseISO(datesToDisplay.cMinus3), "dd/MM")}`]: row.jnsarCMinus3,
                    [`JNSAR ${format(parseISO(datesToDisplay.cMinus2), "dd/MM")}`]: row.jnsarCMinus2,
                    [`JNSAR ${format(parseISO(datesToDisplay.cMinus1), "dd/MM")}`]: row.jnsarCMinus1,
                    [`JNSAR ${format(parseISO(datesToDisplay.cDay), "dd/MM")}`]: row.jnsarCDay,
                    "C.Day Long@": row.cDayLongEntry,
                    "C.Day Short@": row.cDayShortEntry,
                    "C.Day HH": row.cDayHH,
                    "C.Day LL": row.cDayLL,
                    "C.Day CL": row.cDayCL,
                    "C.Day Diff": row.cDayDiff,
                    "C.Day Avg Volume": row.cDayAvgVolume,
                    "C.Day Volume > 150%": row.cDayVolumeAboveAvg,
                    "C.Day Long Target": row.cDayLongTarget,
                    "C.Day Short Target": row.cDayShortTarget,
                    "Chngd to GREEN": row.changedToGreen !== "0" ? row.changedToGreen : "0", // Ensure "0" is used if not changed
                    "Chngd to RED": row.changedToRed !== "0" ? row.changedToRed : "0", // Ensure "0" is used if not changed
                };
                return newRow;
            });

            const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, `WReport_${format(reportDate, "yyyy-MM-dd")}`);
            XLSX.writeFile(workbook, `WReport_Data_${format(reportDate, "yyyy-MM-dd")}.xlsx`);

            toast({ title: "Download Complete", description: `W.Report data downloaded.` });
        } catch (e: any) {
            console.error("Error generating W.Report Excel:", e);
            toast({ variant: "destructive", title: "Download Error", description: e.message || "Could not generate file." });
        } finally {
            setIsDownloading(false);
        }
    };
    
    // Adjusted scroll height for better fit with new controls
    const scrollAreaHeight = "h-[calc(100vh-380px)]";


    return (
        <main className="container mx-auto py-6 px-4">
            <Card className="shadow-lg border border-border rounded-lg">
                <CardHeader className="border-b border-border pb-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="text-xl font-semibold text-foreground">W.Report Analysis</CardTitle>
                            <CardDescription>
                                Select a date to view the report for C.Day and preceding 4 days.
                                {loading && ` Processing ${processedCount} of ${ALL_POSSIBLE_STOCKS.length} stocks...`}
                            </CardDescription>
                        </div>
                        <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                             <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full sm:w-[220px] justify-start text-left font-normal h-9 text-sm",
                                            !reportDate && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {reportDate ? format(reportDate, "PPP") : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={reportDate}
                                        onSelect={(date) => { if (date) setReportDate(date);}}
                                        initialFocus
                                        disabled={(date) => date > new Date() || date < new Date("2000-01-01")}
                                    />
                                </PopoverContent>
                            </Popover>
                            <Button onClick={handleDownloadExcel} disabled={isDownloading || loading || reportData.length === 0} className="h-9 text-sm w-full sm:w-auto">
                                <Download className="mr-2 h-4 w-4" />
                                {isDownloading ? 'Downloading...' : 'Download Report'}
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {error && (
                        <Alert variant="destructive" className="m-4">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}
                    {!loading && !error && reportData.length === 0 && processedCount === ALL_POSSIBLE_STOCKS.length && (
                         <Alert variant="default" className="m-4">
                            <Info className="h-4 w-4" />
                            <AlertTitle>No Data or End of Processing</AlertTitle>
                            <AlertDescription>No report data could be generated for the selected date, or all stocks processed without yielding results. This might be due to data unavailability for the specific historical dates.</AlertDescription>
                        </Alert>
                    )}

                    <div className="overflow-x-auto">
                        <ScrollArea className={scrollAreaHeight}>
                            <Table className="min-w-full divide-y divide-border">
                                <TableCaption className="py-2 text-xs text-muted-foreground">
                                    W.Report for {reportDate ? format(reportDate, "PPP") : "selected date"}. All stocks processed: {processedCount}/{ALL_POSSIBLE_STOCKS.length}.
                                </TableCaption>
                                <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
                                    <TableRow className="hover:bg-transparent">
                                        {columns.map((col) => (
                                            <TableHead
                                                key={col.key}
                                                className={cn(
                                                    "whitespace-nowrap px-2 py-2 text-xs font-medium text-muted-foreground h-10 border-b border-border",
                                                    col.sticky && "sticky left-0 bg-background/95 z-20"
                                                )}
                                            >
                                                {col.label}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody className="divide-y divide-border">
                                    {loading ? (
                                        Array.from({ length: 10 }).map((_, rowIndex) => (
                                            <TableRow key={`skel-row-${rowIndex}`} className="hover:bg-muted/30">
                                                {columns.map((col) => (
                                                    <TableCell key={`skel-cell-${rowIndex}-${col.key}`} className={cn("px-2 py-1 h-8", col.sticky && "sticky left-0 bg-background z-10")}>
                                                        <Skeleton className="h-4 w-full" />
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        ))
                                    ) : reportData.length > 0 ? (
                                        reportData.map((row, rowIndex) => (
                                            <TableRow key={row.stockTicker || `row-${rowIndex}`} className="hover:bg-muted/30">
                                                {columns.map((col) => (
                                                    <TableCell
                                                        key={`${row.stockTicker}-${col.key}`}
                                                        className={cn("whitespace-nowrap px-2 py-1 text-xs h-8", col.sticky && "sticky left-0 bg-background z-10")}
                                                    >
                                                        {formatValueForDisplay(row[col.key as keyof ReportRowData], col.key as keyof ReportRowData)}
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                                                { !loading && "No data available for this report date or processing underway."}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </div>
                </CardContent>
            </Card>
        </main>
    );
};

export default WReportPage;

    