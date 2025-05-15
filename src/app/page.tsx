
'use client';

import type { FC } from 'react';
import { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { subMonths, format as formatDateFns, isValid } from 'date-fns';
import {
    Table,
    TableHeader,
    TableBody,
    TableFooter,
    TableHead,
    TableRow,
    TableCell,
    TableCaption,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getStockData, type StockData } from '@/services/stock-data';
import { processStockData, type CalculatedStockData } from '@/lib/calculations';
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download } from 'lucide-react';


// Initial list of stocks - Subset of the full list below
const INITIAL_STOCKS = ['ABB', 'ACC', 'AARTIIND', 'ABCAPITAL', 'ABFRL', 'ADANIENT', 'ADANIGREEN', 'ADANIPORTS', 'ALKEM', 'AMBUJACEM']; // Reduced for faster initial load

// Full list of ~220 stocks extracted from the provided image
const ALL_POSSIBLE_STOCKS = [
    'ABB', 'ACC', 'AARTIIND', 'ABCAPITAL', 'ABFRL', 'ADANIENT', 'ADANIGREEN', 'ADANIPORTS', /*'ADANITRANS',*/ 'ALKEM', // ADANITRANS likely delisted/merged, removed for now
    'AMBUJACEM', 'APOLLOHOSP', 'APOLLOTYRE', 'ASHOKLEY', 'ASIANPAINT', 'ASTRAL', 'ATUL', 'AUBANK', 'AUROPHARMA', 'AXISBANK',
    'BAJAJ-AUTO', 'BAJFINANCE', 'BAJAJFINSV', 'BAJAJHLDNG', 'BALKRISIND', 'BANDHANBNK', 'BANKBARODA', 'BATAINDIA', 'BERGEPAINT',
    'BEL', 'BHARATFORG', 'BHARTIARTL', 'BHEL', 'BIOCON', 'BOSCHLTD', 'BPCL', 'BRITANNIA', 'CANBK', 'CHOLAFIN', 'CIPLA',
    'COALINDIA', 'COFORGE', 'COLPAL', 'CONCOR', 'COROMANDEL', 'CROMPTON', 'CUMMINSIND', 'DALBHARAT', 'DABUR', 'DEEPAKNTR',
    'DIVISLAB', 'DLF', 'DRREDDY', 'EICHERMOT', 'ESCORTS', /* Renamed to ESCORTSKUBOTA? */ 'FEDERALBNK', 'GAIL', 'GODREJCP', 'GODREJPROP', 'GRASIM',
    'GUJGASLTD', 'HAVELLS', 'HCLTECH', 'HDFCAMC', 'HDFCBANK', 'HDFCLIFE', 'HEROMOTOCO', 'HINDALCO', 'HINDCOPPER', 'HINDPETRO',
    'HINDUNILVR', 'HAL', /*'HDFC', */ /* Merged with HDFCBANK */ 'ICICIBANK', 'ICICIGI', 'ICICIPRULI', 'IDFCFIRSTB', 'IDFC', 'INDHOTEL', 'INDIGO',
    'INDUSTOWER', 'INDUSINDBK', 'NAUKRI', /* INFOEDGE */ 'INFY', 'IOC', 'IEX', 'IPCALAB', 'IRCTC', 'ITC', 'JINDALSTEL',
    'JSWSTEEL', 'JUBLFOOD', 'KOTAKBANK', 'LT', 'LTIM', /* LTI MINDTREE */ 'LTTS', 'LALPATHLAB', 'LAURUSLABS', 'LICHSGFIN', 'LUPIN',
    'M&M', /* M_M */ 'M&MFIN', /* M_MFIN */ 'MANAPPURAM', 'MARICO', 'MARUTI', 'MFSL', /* MAX FINANCIAL */ 'METROPOLIS', 'MGL', 'MOTHERSON', /* SAMVARDHANA MOTHERSON */ 'MPHASIS', 'MRF',
    'MUTHOOTFIN', 'NATIONALUM', 'NAVINFLUOR', 'NESTLEIND', 'NMDC', 'NTPC', 'OBEROIRLTY', 'ONGC', 'OFSS', 'PAGEIND',
    'PERSISTENT', 'PETRONET', 'PFIZER', 'PIDILITIND', 'PIIND', 'PNB', 'POLYCAB', 'PFC', 'POWERGRID', 'PVRINOX',
    'RAMCOCEM', 'RBLBANK', 'RECLTD', 'RELIANCE', 'SBICARD', 'SBILIFE', 'SRF', 'SHREECEM', 'SHRIRAMFIN', /* Renamed from SHRIRAM TRANSPORT */ 'SIEMENS', 'SBIN',
    'SAIL', 'SUNPHARMA', 'SUNTV', 'SYNGENE', 'TATACONSUM', 'TATAMOTORS', /* 'TATAMTRDVR', */ /* Usually less liquid, maybe omit */ 'TATAPOWER', 'TATASTEEL',
    'TCS', 'TECHM', 'TITAN', 'TORNTPHARM', 'TORNTPOWER', 'TRENT', 'TVSMOTOR', 'ULTRACEMCO', 'UBL', 'MCDOWELL-N', /* UNITED SPIRITS */
    'UPL', 'VEDL', 'VOLTAS', 'WHIRLPOOL', 'WIPRO', 'ZEEL', 'ZYDUSLIFE'
    // Adding potentially missing but common ones if needed: BAJAJHLDNG, LTIM, M&M, M&MFIN, SAMVARDHANA, MAXFINANCIAL etc. - Added common variations
].filter((v, i, a) => a.indexOf(v) === i).sort(); // Deduplicate and sort


const StockDataTable: FC = () => {
    const [selectedStock, setSelectedStock] = useState<string>(INITIAL_STOCKS[0]);
    const [stockDataForDisplay, setStockDataForDisplay] = useState<CalculatedStockData[]>([]);
    const [fullCalculatedData, setFullCalculatedData] = useState<CalculatedStockData[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();
    const [downloadPeriod, setDownloadPeriod] = useState<string>('3m'); // '3m', '6m', '9m', 'all'
    const [isDownloading, setIsDownloading] = useState<boolean>(false);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                // Fetch up to ~9 months of data (270 days) to support download presets
                const rawData: StockData[] = await getStockData(selectedStock, 270);

                if (rawData && rawData.length > 0) {
                    const dates = rawData.map(d => d.date);
                    const processed = processStockData(rawData, dates);
                    setFullCalculatedData(processed); // Store all processed data

                    // For display, show last N (e.g., 21 for indicators) + 60 days of data
                    const N = 21; // Initial days for indicator calculation stability
                    const displayData = processed.length > N ? processed.slice(N) : processed;
                    setStockDataForDisplay(displayData.slice(-60)); // Display last 60 days
                } else {
                    setFullCalculatedData([]);
                    setStockDataForDisplay([]);
                    const message = `No data returned for ${selectedStock}. Check if the ticker is valid on Yahoo Finance (try adding '.NS' for NSE stocks).`;
                    setError(message);
                     toast({
                         variant: "destructive",
                         title: "Data Fetch Error",
                         description: message,
                     });
                }
            } catch (err: any) {
                console.error("Error fetching or processing stock data:", err);
                const errorMessage = err.message || `Failed to load data for ${selectedStock}. Check console for details.`;
                setError(errorMessage);
                setFullCalculatedData([]);
                setStockDataForDisplay([]);
                 toast({
                     variant: "destructive",
                     title: "Data Fetch Error",
                     description: errorMessage,
                 });
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [selectedStock, toast]);

    const columns: { key: keyof CalculatedStockData; label: string }[] = useMemo(() => [
        { key: 'date', label: 'Date' },
        { key: 'open', label: 'Open' },
        { key: 'high', label: 'High' },
        { key: 'low', label: 'Low' },
        { key: 'close', label: 'Close' },
        { key: 'volume', label: 'Volume' },
        { key: '5-LEMA', label: '5-LEMA' },
        { key: '5-EMA', label: '5-EMA' },
        { key: '5-HEMA', label: '5-HEMA' },
        { key: 'JNSAR', label: 'JNSAR' },
        { key: 'HH', label: 'HH' },
        { key: 'LL', label: 'LL' },
        { key: 'CL', label: 'CL' },
        { key: 'Diff', label: 'Diff' },
        { key: 'ATR', label: 'ATR' },
        { key: 'H4', label: 'H4' },
        { key: 'H3', label: 'H3' },
        { key: 'H2', label: 'H2' },
        { key: 'H1', label: 'H1' },
        { key: 'PP', label: 'PP' },
        { key: 'L1', label: 'L1' },
        { key: 'L2', label: 'L2' },
        { key: 'L3', label: 'L3' },
        { key: 'L4', label: 'L4' },
        { key: 'Long@', label: 'Long@' },
        { key: 'Short@', label: 'Short@' },
        { key: 'Volume > 150%', label: 'Vol > 150%' },
        { key: 'ShortTarget', label: 'Short Target' },
        { key: 'LongTarget', label: 'Long Target' },
        { key: 'AvgVolume', label: 'Avg Volume'},
    ], []);

    const formatValueForDisplay = (value: any, key: keyof CalculatedStockData): React.ReactNode => {
        if (value === null || value === undefined) return '-';
        if (key === 'Volume > 150%') {
             return value ? <Badge variant="default" className="bg-green-600 text-white">True</Badge> : <Badge variant="secondary">False</Badge>;
        }
        if (typeof value === 'boolean') {
             return value ? 'True' : 'False';
        }
        if (typeof value === 'number') {
             if (key === 'volume' || key === 'AvgVolume') {
                 return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
             }
            return value.toFixed(2);
        }
        if ((key === 'HH' || key === 'LL' || key === 'CL') && (value === 'Y' || value === '0')) {
           return value === 'Y' ? <span className="text-green-600 font-semibold">Y</span> : <span className="text-muted-foreground">0</span>;
        }
        return String(value);
    };

    const handleDownloadExcel = () => {
        if (isDownloading || fullCalculatedData.length === 0) {
            toast({ title: "Download Info", description: isDownloading ? "Download already in progress." : "No data to download."});
            return;
        }
        setIsDownloading(true);
        toast({ title: "Download Started", description: `Preparing ${selectedStock} data for Excel.` });

        try {
            let dataToFilter = [...fullCalculatedData]; // Use a copy
            const today = new Date();
            let startDate: Date | null = null;

            if (downloadPeriod === '3m') startDate = subMonths(today, 3);
            else if (downloadPeriod === '6m') startDate = subMonths(today, 6);
            else if (downloadPeriod === '9m') startDate = subMonths(today, 9);
            // 'all' means all fetched data (up to 270 days)

            let filteredData = dataToFilter;
            if (startDate) {
                filteredData = dataToFilter.filter(item => {
                    const itemDate = new Date(item.date); // Assuming date is 'yyyy-MM-dd'
                    return isValid(itemDate) && itemDate >= startDate!;
                });
            }
            
            // Ensure chronological order for Excel (oldest first)
            // The data from processStockData should already be chronological. If not, sort here.
            // filteredData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());


            if (filteredData.length === 0) {
                toast({ variant: "destructive", title: "Download Error", description: "No data found for the selected period." });
                setIsDownloading(false);
                return;
            }
            
            const dataForSheet = filteredData.map(row => {
                const newRow: { [key: string]: any } = {};
                columns.forEach(col => {
                    // Use raw values for Excel where possible
                    let value = row[col.key];
                     if (typeof value === 'number' && (key !== 'volume' && key !== 'AvgVolume')) {
                        // For numbers, keep them as numbers (no toFixed for Excel)
                        newRow[col.label] = value;
                    } else if (key === 'date') { // Ensure date is string yyyy-MM-dd
                        newRow[col.label] = typeof value === 'string' ? value : (value instanceof Date ? formatDateFns(value, 'yyyy-MM-dd') : String(value));
                    }
                    else {
                         newRow[col.label] = value;
                    }
                });
                return newRow;
            });

            const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, selectedStock);
            
            const periodDesc = downloadPeriod === 'all' ? 'all_fetched' : downloadPeriod;
            XLSX.writeFile(workbook, `${selectedStock}_data_${periodDesc}.xlsx`);

            toast({ title: "Download Complete", description: `Data for ${selectedStock} downloaded.` });
        } catch (e: any) {
            console.error("Error generating Excel:", e);
            toast({ variant: "destructive", title: "Download Error", description: e.message || "Could not generate Excel file." });
        } finally {
            setIsDownloading(false);
        }
    };
    
    // Estimate AppHeader height (h-16 is 4rem = 64px)
    // CardHeader height: ~60px
    // Download controls row: ~56px (Select h-9 + Button h-9, with padding py-4 for their container)
    // Total static elements height: 64px (AppHeader) + 60px (CardHeader) + 56px (DownloadControls) + ~16px (main padding) = ~196px
    // Let's use a slightly more generous estimate, 200-220 for static elements above scroll
    // Previous ScrollArea height: calc(100vh - 264px)
    // With download controls, new height might be ~ calc(100vh - (264px + 56px)) = calc(100vh - 320px)
    const scrollAreaHeight = "h-[calc(100vh-330px)]";


    return (
        <Card className="m-4 shadow-lg border border-border rounded-lg">
             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4 border-b border-border">
                <CardTitle className="text-xl font-semibold text-foreground">
                    Stock Insights: {selectedStock}
                </CardTitle>
                 <div className="w-[200px]">
                     <Select value={selectedStock} onValueChange={setSelectedStock}>
                        <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Select Stock" />
                        </SelectTrigger>
                        <SelectContent>
                            {ALL_POSSIBLE_STOCKS.map(stock => (
                                <SelectItem key={stock} value={stock} className="text-sm">
                                    {stock}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                 </div>
            </CardHeader>
            <CardContent className="p-0">
                {error && <p className="text-destructive p-4">{error}</p>}
                
                <div className="flex items-center justify-end space-x-2 p-4 border-b border-border">
                    <Select value={downloadPeriod} onValueChange={setDownloadPeriod}>
                        <SelectTrigger className="h-9 text-sm w-[180px]">
                            <SelectValue placeholder="Select period" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="3m">Last 3 Months</SelectItem>
                            <SelectItem value="6m">Last 6 Months</SelectItem>
                            <SelectItem value="9m">Last 9 Months</SelectItem>
                            <SelectItem value="all">All Fetched Data</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button onClick={handleDownloadExcel} disabled={isDownloading} className="h-9 text-sm">
                        <Download className="mr-2 h-4 w-4" />
                        {isDownloading ? 'Downloading...' : 'Download Excel'}
                    </Button>
                </div>

                <div className="overflow-x-auto">
                 <ScrollArea className={scrollAreaHeight}>
                    <Table className="min-w-full divide-y divide-border">
                        <TableCaption className="py-2 text-xs text-muted-foreground">
                            Calculated stock data for {selectedStock}. Data sourced from Yahoo Finance. Displaying last 60 available days of up to 270 fetched.
                        </TableCaption>
                        <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
                            <TableRow className="hover:bg-transparent">
                                {columns.map((col) => (
                                    <TableHead
                                        key={col.key}
                                        className="whitespace-nowrap px-2 py-2 text-xs font-medium text-muted-foreground h-10 border-b border-border"
                                        >
                                        {col.label}
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-border">
                            {loading ? (
                                Array.from({ length: 15 }).map((_, rowIndex) => (
                                    <TableRow key={`skel-${rowIndex}`} className="hover:bg-muted/30">
                                        {columns.map((col) => (
                                            <TableCell key={`skel-${rowIndex}-${col.key}`} className="px-2 py-1 h-8">
                                                <Skeleton className="h-4 w-full" />
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : stockDataForDisplay.length > 0 ? (
                                [...stockDataForDisplay].reverse().map((row, rowIndex) => (
                                    <TableRow key={row.date || `row-${rowIndex}`} className="hover:bg-muted/30 data-[state=selected]:bg-accent/50">
                                        {columns.map((col) => (
                                            <TableCell
                                                key={`${row.date}-${col.key}`}
                                                className="whitespace-nowrap px-2 py-1 text-xs h-8"
                                                >
                                                {formatValueForDisplay(row[col.key], col.key)}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                                        No data available for this stock or period.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
            </CardContent>
        </Card>
    );
};

export default function Home() {
  return (
      <main className="container mx-auto py-4">
          <StockDataTable />
      </main>
  );
}

