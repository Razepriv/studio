
'use client';

import type { FC } from 'react';
import { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { subMonths, format as formatDateFns, isValid, subWeeks } from 'date-fns';
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

// Full list of 165 stocks (after removing commented items and duplicates)
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
].filter((v, i, a) => a.indexOf(v) === i).sort(); // Deduplicate and sort - Count: 165


const StockDataTable: FC = () => {
    const [selectedStock, setSelectedStock] = useState<string>(INITIAL_STOCKS[0]);
    const [stockDataForDisplay, setStockDataForDisplay] = useState<CalculatedStockData[]>([]);
    const [fullCalculatedData, setFullCalculatedData] = useState<CalculatedStockData[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();
    const [downloadPeriod, setDownloadPeriod] = useState<string>('3m'); // '3m', '6m', '9m', 'all'
    const [isDownloading, setIsDownloading] = useState<boolean>(false);
    const dataInterval = '1wk'; // Set to '1wk' for weekly data

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                // Fetch up to ~3 years (156 weeks) of weekly data to support download presets
                const rawData: StockData[] = await getStockData(selectedStock, 156, undefined, dataInterval);

                if (rawData && rawData.length > 0) {
                    const dates = rawData.map(d => d.date);
                    const processed = processStockData(rawData, dates); // processStockData will now calculate weekly indicators
                    setFullCalculatedData(processed);

                    // For display, show last 52 weeks (1 year) of data
                    const displayData = processed.slice(-52);
                    setStockDataForDisplay(displayData);
                } else {
                    setFullCalculatedData([]);
                    setStockDataForDisplay([]);
                    const message = `No weekly data returned for ${selectedStock}. Check if the ticker is valid on Yahoo Finance (try adding '.NS' for NSE stocks).`;
                    setError(message);
                     toast({
                         variant: "destructive",
                         title: "Data Fetch Error",
                         description: message,
                     });
                }
            } catch (err: any) {
                console.error("Error fetching or processing stock data:", err);
                const errorMessage = err.message || `Failed to load weekly data for ${selectedStock}. Check console for details.`;
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
    }, [selectedStock, toast]); // dataInterval is constant, no need to add to deps

    const columns: { key: keyof CalculatedStockData; label: string }[] = useMemo(() => [
        { key: 'date', label: 'Week Start Date' }, // Label changed to reflect weekly
        { key: 'open', label: 'Open' },
        { key: 'high', label: 'High' },
        { key: 'low', label: 'Low' },
        { key: 'close', label: 'Close' },
        { key: 'volume', label: 'Volume' },
        { key: '5-LEMA', label: '5-Wk LEMA' }, // Label changed
        { key: '5-EMA', label: '5-Wk EMA' },   // Label changed
        { key: '5-HEMA', label: '5-Wk HEMA' }, // Label changed
        { key: 'JNSAR', label: 'Weekly JNSAR' },// Label changed
        { key: 'HH', label: 'Higher High (vs prev wk)' }, // Contextualized
        { key: 'LL', label: 'Lower Low (vs prev wk)' },   // Contextualized
        { key: 'CL', label: 'Close Lower (vs prev wk)' }, // Contextualized
        { key: 'Diff', label: 'Weekly Diff' }, // Label changed
        { key: 'ATR', label: 'Weekly ATR' },   // Label changed
        { key: 'H4', label: 'Weekly H4' },     // Label changed
        { key: 'H3', label: 'Weekly H3' },
        { key: 'H2', label: 'Weekly H2' },
        { key: 'H1', label: 'Weekly H1' },
        { key: 'PP', label: 'Weekly PP' },
        { key: 'L1', label: 'Weekly L1' },
        { key: 'L2', label: 'Weekly L2' },
        { key: 'L3', label: 'Weekly L3' },
        { key: 'L4', label: 'Weekly L4' },
        { key: 'Long@', label: 'Weekly Long@' },
        { key: 'Short@', label: 'Weekly Short@' },
        { key: 'Volume > 150%', label: 'Vol > 150% (vs avg wk vol)' }, // Contextualized
        { key: 'ShortTarget', label: 'Weekly Short Target' },
        { key: 'LongTarget', label: 'Weekly Long Target' },
        { key: 'AvgVolume', label: 'Avg Weekly Volume'}, // Label changed
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
        if (key === 'date' && typeof value === 'string') {
            const dateObj = new Date(value);
            if (isValid(dateObj)) {
                return formatDateFns(dateObj, 'dd MMM yyyy'); // Format date for display
            }
        }
        return String(value);
    };

    const handleDownloadExcel = () => {
        if (isDownloading || fullCalculatedData.length === 0) {
            toast({ title: "Download Info", description: isDownloading ? "Download already in progress." : "No data to download."});
            return;
        }
        setIsDownloading(true);
        toast({ title: "Download Started", description: `Preparing ${selectedStock} weekly data for Excel.` });

        try {
            let dataToFilter = [...fullCalculatedData];
            const today = new Date();
            let startDateThreshold: Date | null = null;

            // Convert downloadPeriod to weeks for filtering weekly data
            if (downloadPeriod === '3m') startDateThreshold = subMonths(today, 3); // ~13 weeks
            else if (downloadPeriod === '6m') startDateThreshold = subMonths(today, 6); // ~26 weeks
            else if (downloadPeriod === '9m') startDateThreshold = subMonths(today, 9); // ~39 weeks
            // 'all' means all fetched weekly data (up to 156 weeks)

            let filteredData = dataToFilter;
            if (startDateThreshold) {
                filteredData = dataToFilter.filter(item => {
                    const itemDate = parseISO(item.date); // date is 'yyyy-MM-dd' string
                    return isValid(itemDate) && itemDate >= startDateThreshold!;
                });
            }
            
            if (filteredData.length === 0) {
                toast({ variant: "destructive", title: "Download Error", description: "No data found for the selected period." });
                setIsDownloading(false);
                return;
            }
            
            const dataForSheet = filteredData.map(row => {
                const newRow: { [key: string]: any } = {};
                columns.forEach(col => {
                    let value = row[col.key];
                     if (typeof value === 'number' && (col.key !== 'volume' && col.key !== 'AvgVolume')) {
                        newRow[col.label] = value;
                    } else if (col.key === 'date') {
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
            XLSX.utils.book_append_sheet(workbook, worksheet, `${selectedStock}_Weekly`);
            
            const periodDesc = downloadPeriod === 'all' ? 'all_fetched' : downloadPeriod;
            XLSX.writeFile(workbook, `${selectedStock}_weekly_data_${periodDesc}.xlsx`);

            toast({ title: "Download Complete", description: `Weekly data for ${selectedStock} downloaded.` });
        } catch (e: any) {
            console.error("Error generating Excel:", e);
            toast({ variant: "destructive", title: "Download Error", description: e.message || "Could not generate Excel file." });
        } finally {
            setIsDownloading(false);
        }
    };
    
    const scrollAreaHeight = "h-[calc(100vh-330px)]";


    return (
        <Card className="m-4 shadow-lg border border-border rounded-lg">
             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4 border-b border-border">
                <CardTitle className="text-xl font-semibold text-foreground">
                    Stock Insights (Weekly): {selectedStock}
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

                <CardContent className="p-0">
                  <div className="w-full overflow-x-auto"> {/* Ensure table is scrollable horizontally */}
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {columns.map(col => (
                            <TableHead key={col.key} className="whitespace-nowrap">{col.label}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading ? (
                          [...Array(10)].map((_, i) => (
                            <TableRow key={i}>
                              {columns.map((col, j) => (
                                <TableCell key={j}>
                                  <Skeleton className="h-4 w-full" />
                                </TableCell>
                              ))}
                            </TableRow>
                          ))
                        ) : (
                          stockDataForDisplay.map((row, i) => (
                            <TableRow key={i}>
                              {columns.map((col, j) => (
                                <TableCell key={j} className="whitespace-nowrap">
                                  {formatValueForDisplay(row[col.key], col.key)}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
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
