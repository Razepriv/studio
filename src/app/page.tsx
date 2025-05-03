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


// Initial list of stocks - Subset of the full list below
const INITIAL_STOCKS = ['ABB', 'ACC', 'AARTIIND', 'ABCAPITAL', 'ABFRL', 'ADANIENT', 'ADANIGREEN', 'ADANIPORTS', 'ADANITRANS', 'ALKEM'];

// Full list of ~220 stocks extracted from the provided image
const ALL_POSSIBLE_STOCKS = [
    'ABB', 'ACC', 'AARTIIND', 'ABCAPITAL', 'ABFRL', 'ADANIENT', 'ADANIGREEN', 'ADANIPORTS', 'ADANITRANS', 'ALKEM',
    'AMBUJACEM', 'APOLLOHOSP', 'APOLLOTYRE', 'ASHOKLEY', 'ASIANPAINT', 'ASTRAL', 'ATUL', 'AUBANK', 'AUROPHARMA', 'AXISBANK',
    'BAJAJ-AUTO', 'BAJFINANCE', 'BAJAJFINSV', 'BAJHLDNG', 'BALKRISIND', 'BANDHANBNK', 'BANKBARODA', 'BATAINDIA', 'BERGEPAINT',
    'BEL', 'BHARATFORG', 'BHARTIARTL', 'BHEL', 'BIOCON', 'BOSCHLTD', 'BPCL', 'BRITANNIA', 'CANBK', 'CHOLAFIN', 'CIPLA',
    'COALINDIA', 'COFORGE', 'COLPAL', 'CONCOR', 'COROMANDEL', 'CROMPTON', 'CUMMINSIND', 'DALBHARAT', 'DABUR', 'DEEPAKNTR',
    'DIVISLAB', 'DLF', 'DRREDDY', 'ESCORTS', 'EICHERMOT', 'FEDERALBNK', 'GAIL', 'GODREJCP', 'GODREJPROP', 'GRASIM',
    'GUJGASLTD', 'HAVELLS', 'HCLTECH', 'HDFCAMC', 'HDFCBANK', 'HDFCLIFE', 'HEROMOTOCO', 'HINDALCO', 'HINDCOPPER', 'HINDPETRO',
    'HINDUNILVR', 'HAL', 'HDFC', 'ICICIBANK', 'ICICIGI', 'ICICIPRULI', 'IDFCFIRSTB', 'IDFC', 'INDHOTEL', 'INDIGO',
    'INDUSTOWER', 'INDUSINDBK', 'INDIAMART', 'IOC', 'IEX', 'NAUKRI', 'INFY', 'IPCALAB', 'IRCTC', 'ITC', 'JINDALSTEL',
    'JSWSTEEL', 'JUBLFOOD', 'KOTAKBANK', 'LT', 'L_TFH', 'LTTS', 'LALPATHLAB', 'LAURUSLABS', 'LICHSGFIN', 'LUPIN',
    'M_M', 'M_MFIN', 'MANAPPURAM', 'MARICO', 'MARUTI', 'METROPOLIS', 'MFSL', 'MGL', 'MOTHERSON', 'MPHASIS', 'MRF',
    'MUTHOOTFIN', 'NATIONALUM', 'NAVINFLUOR', 'NESTLEIND', 'NMDC', 'NTPC', 'OBEROIRLTY', 'ONGC', 'OFSS', 'PAGEIND',
    'PERSISTENT', 'PETRONET', 'PFIZER', 'PIDILITIND', 'PIIND', 'PNB', 'POLYCAB', 'PFC', 'POWERGRID', 'PVRINOX',
    'RAMCOCEM', 'RBLBANK', 'RECLTD', 'RELIANCE', 'SBICARD', 'SBILIFE', 'SRF', 'SHRIRAMFIN', 'SBIN', 'SHREECEM',
    'SIEMENS', 'SAIL', 'SUNPHARMA', 'SUNTV', 'SYNGENE', 'TATACONSUM', 'TATAMOTORS', 'TATAMTRDVR', 'TATAPOWER', 'TATASTEEL',
    'TCS', 'TECHM', 'TITAN', 'TORNTPHARM', 'TORNTPOWER', 'TRENT', 'TVSMOTOR', 'ULTRACEMCO', 'UBL', 'MCDOWELL-N',
    'UPL', 'VEDL', 'VOLTAS', 'WHIRLPOOL', 'WIPRO', 'ZEEL', 'ZYDUSLIFE'
];


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
                const rawData: StockData[] = await getStockData(selectedStock, 90); // Fetch 90 days for better EMA/ATR calc

                if (rawData && rawData.length > 0) {
                     // Extract dates directly from the fetched data
                    const dates = rawData.map(d => d.date);
                    const processed = processStockData(rawData, dates);
                    setStockData(processed);
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

    // Define the columns in the desired order
    const columns: { key: keyof CalculatedStockData; label: string }[] = useMemo(() => [
        { key: 'date', label: 'Date' },
        { key: 'open', label: 'Open' },
        { key: 'high', label: 'High' },
        { key: 'low', label: 'Low' },
        { key: 'close', label: 'Close' },
        { key: 'volume', label: 'Volume' },
        // { key: 'Adj_close', label: 'Adj Close' }, // Uncomment if Adj Close is added
        { key: '5-LEMA', label: '5-LEMA' },
        { key: '5-EMA', label: '5-EMA' },
        { key: '5-HEMA', label: '5-HEMA' },
        { key: 'JNSAR', label: 'JNSAR' },
        { key: 'HH', label: 'HH' },
        { key: 'LL', label: 'LL' }, // Renamed from HL to LL as per likely intent
        { key: 'CL', label: 'CL' },
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
    ], []);

    const formatValue = (value: any): string => {
        if (value === null || value === undefined) return '-';
        if (typeof value === 'number') {
            // Format numbers with 2 decimal places, except volume
             if (Math.abs(value) > 100000) { // Assuming volume is large, increased threshold
                 return value.toLocaleString();
             }
            return value.toFixed(2);
        }
        // Handle date formatting if needed, though it should be string 'yyyy-MM-dd'
        // if (colKey === 'date' && value instanceof Date) {
        //     return format(value, 'yyyy-MM-dd');
        // }
        return String(value);
    };


    return (
        <Card className="m-4">
             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-2xl font-bold">
                    Stock Insights: {selectedStock}
                </CardTitle>
                 <div className="w-[180px]">
                     <Select value={selectedStock} onValueChange={setSelectedStock}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select Stock" />
                        </SelectTrigger>
                        <SelectContent>
                            {ALL_POSSIBLE_STOCKS.sort().map(stock => ( // Use the larger list and sort it
                                <SelectItem key={stock} value={stock}>
                                    {stock}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                 </div>

            </CardHeader>
            <CardContent>
                {error && <p className="text-destructive mb-4">{error}</p>}
                <div className="overflow-x-auto">
                 <Table>
                    <TableCaption>Calculated stock data for {selectedStock}. Data sourced from Yahoo Finance.</TableCaption>
                    <TableHeader>
                        <TableRow>
                            {columns.map((col) => (
                                <TableHead key={col.key} className="whitespace-nowrap px-2 py-2 text-xs font-medium text-muted-foreground sticky top-0 bg-background z-10"> {/* Sticky Header */}
                                    {col.label}
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                             // Skeleton Loader Rows
                             Array.from({ length: 10 }).map((_, rowIndex) => ( // Increased skeleton rows
                                <TableRow key={`skel-${rowIndex}`}>
                                     {columns.map((col) => (
                                         <TableCell key={`skel-${rowIndex}-${col.key}`} className="px-2 py-1">
                                             <Skeleton className="h-4 w-full" />
                                         </TableCell>
                                     ))}
                                </TableRow>
                            ))
                        ) : stockData.length > 0 ? (
                            // Display latest data first
                            [...stockData].reverse().map((row, rowIndex) => (
                                <TableRow key={row.date || `row-${rowIndex}`}>
                                    {columns.map((col) => (
                                        <TableCell key={`${row.date}-${col.key}`} className="whitespace-nowrap px-2 py-1 text-xs">
                                             {formatValue(row[col.key])}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-24 text-center">
                                    No data available for this stock.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                 </Table>
                </div>

            </CardContent>
        </Card>
    );
};


export default function Home() {
  return (
      <main className="container mx-auto py-8">
          <StockDataTable />
      </main>
  );
}
