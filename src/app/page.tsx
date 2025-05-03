
'use client';

import type { FC } from 'react';
import { useState, useEffect, useMemo } from 'react';
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
import { Skeleton } from "@/components/ui/skeleton";
import { getStockData, type StockData } from '@/services/stock-data';
import { processStockData, type CalculatedStockData } from '@/lib/calculations';
import { useToast } from "@/hooks/use-toast"; // Import useToast
import { Badge } from "@/components/ui/badge"; // Import Badge for boolean display


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
    const [stockData, setStockData] = useState<CalculatedStockData[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast(); // Initialize toast

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                // Fetch raw data using the service which now calls the API route
                const rawData: StockData[] = await getStockData(selectedStock, 120); // Fetch 120 days for better SMA/EMA/ATR calc

                if (rawData && rawData.length > 0) {
                     // Extract dates directly from the fetched data
                    const dates = rawData.map(d => d.date);
                    // Process data - make sure dates are handled inside processStockData
                    const processed = processStockData(rawData, dates);
                    // Filter out the first few rows where calculations might be incomplete (e.g., EMA, ATR, Pivots)
                    // Keep at least 60 rows, or fewer if total is less. Adjust N as needed.
                    const N = 21; // Need ~20 for 20-day SMA, +1 for prev day pivots
                    const displayData = processed.length > N ? processed.slice(N) : processed;

                    setStockData(displayData.slice(-60)); // Keep only latest 60 days for display
                } else {
                    setStockData([]);
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
                setStockData([]); // Clear data on error
                 toast({ // Show toast on error
                     variant: "destructive",
                     title: "Data Fetch Error",
                     description: errorMessage,
                 });
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [selectedStock, toast]); // Re-run effect when selectedStock or toast changes

    // Define the columns in the desired order based on the image
    const columns: { key: keyof CalculatedStockData; label: string }[] = useMemo(() => [
        { key: 'date', label: 'Date' },
        { key: 'open', label: 'Open' },
        { key: 'high', label: 'High' },
        { key: 'low', label: 'Low' },
        { key: 'close', label: 'Close' },
        { key: 'volume', label: 'Volume' },
        // Calculated based on 5-period EMA
        { key: '5-LEMA', label: '5-LEMA' }, // EMA of Low
        { key: '5-EMA', label: '5-EMA' }, // EMA of Close
        { key: '5-HEMA', label: '5-HEMA' }, // EMA of High
        // Renko columns omitted - require specific Renko brick calculation logic
        // Placeholder for JNSAR
        { key: 'JNSAR', label: 'JNSAR' }, // JNSAR calculation needed
        // HH/HL/CL columns (HL seems to mean Lower Low 'LL')
        { key: 'HH', label: 'HH' }, // Higher High (Y/0)
        { key: 'LL', label: 'LL' }, // Lower Low (Y/0) - Renamed from HL
        { key: 'CL', label: 'CL' }, // Close Lower (Y/0)
        // Diff column
        { key: 'Diff', label: 'Diff' }, // High - Low
        // 14 Day ATR
        { key: 'ATR', label: 'ATR' }, // 14-day ATR
        // Pivot Point Levels (calculated from previous day)
        { key: 'H4', label: 'H4' },
        { key: 'H3', label: 'H3' },
        { key: 'H2', label: 'H2' }, // Added H2
        { key: 'H1', label: 'H1' },
        { key: 'PP', label: 'PP' },
        { key: 'L1', label: 'L1' },
        { key: 'L2', label: 'L2' }, // Added L2
        { key: 'L3', label: 'L3' },
        { key: 'L4', label: 'L4' },
        // Long/Short Breakout/Entry Points (likely based on previous day pivots)
        { key: 'Long@', label: 'Long@' }, // Example: L1 from prev day
        { key: 'Short@', label: 'Short@' }, // Example: H1 from prev day
        // Volume Check
        { key: 'Volume > 150%', label: 'Vol > 150%' }, // Volume vs Avg Volume check
        // Target columns (Need calculation logic)
        { key: 'ShortTarget', label: 'Short Target' }, // Calculated Short Target
        { key: 'LongTarget', label: 'Long Target' }, // Calculated Long Target

    ], []);

    const formatValue = (value: any, key: keyof CalculatedStockData): React.ReactNode => {
        if (value === null || value === undefined) return '-';

        if (key === 'Volume > 150%') {
             return value ? <Badge variant="default" className="bg-green-600 text-white">True</Badge> : <Badge variant="secondary">False</Badge>;
        }

        if (typeof value === 'boolean') {
             return value ? 'True' : 'False';
        }

        if (typeof value === 'number') {
            // Format large numbers (Volume) without decimals
             if (key === 'volume' || key === 'AvgVolume') {
                 return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
             }
             // Format price/indicator related numbers with 2 decimal places
            return value.toFixed(2);
        }

        // Handle HH, LL, CL 'Y'/'0' display
        if ((key === 'HH' || key === 'LL' || key === 'CL') && (value === 'Y' || value === '0')) {
           return value === 'Y' ? <span className="text-green-600 font-semibold">Y</span> : <span className="text-muted-foreground">0</span>;
        }

        // Handle date formatting if needed (should be 'yyyy-MM-dd' string)
        // if (key === 'date' && typeof value === 'string') {
        //     try {
        //         return format(parseISO(value), 'dd-MMM-yy'); // Example format change
        //     } catch { return value; } // Fallback if parsing fails
        // }

        return String(value);
    };


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
                            {ALL_POSSIBLE_STOCKS.map(stock => ( // Use the deduplicated and sorted list
                                <SelectItem key={stock} value={stock} className="text-sm">
                                    {stock}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                 </div>

            </CardHeader>
            <CardContent className="p-0"> {/* Remove default padding */}
                {error && <p className="text-destructive p-4">{error}</p>}
                <div className="overflow-x-auto">
                 {/* Added specific height and scrollbar styling */}
                 <ScrollArea className="h-[calc(100vh-200px)]"> {/* Adjust height as needed */}
                    <Table className="min-w-full divide-y divide-border">
                        <TableCaption className="py-2 text-xs text-muted-foreground">
                            Calculated stock data for {selectedStock}. Data sourced from Yahoo Finance. Displaying last 60 available days.
                        </TableCaption>
                        <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
                            <TableRow className="hover:bg-transparent">
                                {columns.map((col) => (
                                    <TableHead
                                        key={col.key}
                                        className="whitespace-nowrap px-2 py-2 text-xs font-medium text-muted-foreground h-10 border-b border-border"
                                        // Add specific background/text colors based on image sections if needed
                                        // style={getHeaderStyle(col.key)}
                                        >
                                        {col.label}
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-border">
                            {loading ? (
                                // Skeleton Loader Rows
                                Array.from({ length: 15 }).map((_, rowIndex) => ( // More skeleton rows
                                    <TableRow key={`skel-${rowIndex}`} className="hover:bg-muted/30">
                                        {columns.map((col) => (
                                            <TableCell key={`skel-${rowIndex}-${col.key}`} className="px-2 py-1 h-8">
                                                <Skeleton className="h-4 w-full" />
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : stockData.length > 0 ? (
                                // Display latest data first
                                [...stockData].reverse().map((row, rowIndex) => (
                                    <TableRow key={row.date || `row-${rowIndex}`} className="hover:bg-muted/30 data-[state=selected]:bg-accent/50">
                                        {columns.map((col) => (
                                            <TableCell
                                                key={`${row.date}-${col.key}`}
                                                className="whitespace-nowrap px-2 py-1 text-xs h-8"
                                                // Add specific background/text colors based on image sections if needed
                                                // style={getCellStyle(col.key, row[col.key])}
                                                >
                                                {formatValue(row[col.key], col.key)}
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

// --- Helper Functions for Styling (Optional) ---

// Example: Get header background color based on column groups in image
// const getHeaderStyle = (key: keyof CalculatedStockData): React.CSSProperties => {
//     if (['open', 'high', 'low', 'close', 'volume'].includes(key)) return { backgroundColor: 'hsl(var(--muted))' };
//     if (['5-LEMA', '5-EMA', '5-HEMA'].includes(key)) return { backgroundColor: 'hsl(var(--accent)/20)' };
//     if (['JNSAR', 'HH', 'LL', 'CL', 'Diff'].includes(key)) return { backgroundColor: 'hsl(var(--primary)/10)' };
//     // Add more conditions for other groups
//     return {};
// }

// Example: Get cell background/text color based on value or column
// const getCellStyle = (key: keyof CalculatedStockData, value: any): React.CSSProperties => {
//      if (key === 'Volume > 150%' && value === true) return { backgroundColor: 'hsl(120, 70%, 90%)', color: 'hsl(120, 60%, 25%)', fontWeight: '500' };
//      if ((key === 'HH' || key === 'LL' || key === 'CL') && value === 'Y') return { color: 'hsl(120, 60%, 35%)', fontWeight: '600' };
//      // Add more styling rules
//      return {};
// }


export default function Home() {
  return (
      <main className="container mx-auto py-4"> {/* Reduced padding */}
          <StockDataTable />
      </main>
  );
}

// Add ScrollArea component import if not already present globally
import { ScrollArea } from "@/components/ui/scroll-area";
