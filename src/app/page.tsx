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
import { format } from 'date-fns'; // For date formatting

// Initial list of stocks to analyze
const INITIAL_STOCKS = ['ABCAPITAL', 'ABFRL', 'ACC'];
// Potentially larger list if needed later
const ALL_POSSIBLE_STOCKS = [...INITIAL_STOCKS, 'ADANIENT', 'ADANIPORTS', 'AARTIIND', 'ABB', /* Add more as needed */];


const StockDataTable: FC = () => {
    const [selectedStock, setSelectedStock] = useState<string>(INITIAL_STOCKS[0]);
    const [stockData, setStockData] = useState<CalculatedStockData[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                // Fetch raw data - NOTE: getStockData needs implementation to fetch from Yahoo Finance
                // Using placeholder data for now based on original service structure
                const rawData: StockData[] = await getStockData(selectedStock);

                // Simulate dates corresponding to the raw data length
                // In a real scenario, the API response would include dates
                const today = new Date();
                const dates = rawData.map((_, index) =>
                    format(new Date(today.getFullYear(), today.getMonth(), today.getDate() - (rawData.length - 1 - index)), 'yyyy-MM-dd')
                );


                if (rawData.length > 0) {
                    const processed = processStockData(rawData, dates);
                    setStockData(processed);
                } else {
                    setStockData([]);
                     setError(`No data returned for ${selectedStock}. Ensure the ticker is correct and the data source is available.`);
                }
            } catch (err) {
                console.error("Error fetching or processing stock data:", err);
                setError(`Failed to load data for ${selectedStock}. Check console for details.`);
                setStockData([]); // Clear data on error
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [selectedStock]); // Re-run effect when selectedStock changes

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
        { key: 'HL', label: 'HL' }, // Assumed LL
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
             if (Math.abs(value) > 10000) { // Assuming volume is large
                 return value.toLocaleString();
             }
            return value.toFixed(2);
        }
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
                            {INITIAL_STOCKS.map(stock => (
                                <SelectItem key={stock} value={stock}>
                                    {stock}
                                </SelectItem>
                            ))}
                            {/* Add more stocks later if needed */}
                        </SelectContent>
                    </Select>
                 </div>

            </CardHeader>
            <CardContent>
                {error && <p className="text-destructive mb-4">{error}</p>}
                <div className="overflow-x-auto">
                 <Table>
                    <TableCaption>Calculated stock data for {selectedStock}.</TableCaption>
                    <TableHeader>
                        <TableRow>
                            {columns.map((col) => (
                                <TableHead key={col.key} className="whitespace-nowrap px-2 py-2 text-xs font-medium text-muted-foreground">
                                    {col.label}
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                             // Skeleton Loader Rows
                             Array.from({ length: 5 }).map((_, rowIndex) => (
                                <TableRow key={`skel-${rowIndex}`}>
                                     {columns.map((col) => (
                                         <TableCell key={`skel-${rowIndex}-${col.key}`} className="px-2 py-1">
                                             <Skeleton className="h-4 w-full" />
                                         </TableCell>
                                     ))}
                                </TableRow>
                            ))
                        ) : stockData.length > 0 ? (
                            stockData.map((row, rowIndex) => (
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
                                    No data available.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                    {/* Optional Footer */}
                     {/* <TableFooter>
                       <TableRow>
                         <TableCell colSpan={3}>Total</TableCell>
                         <TableCell className="text-right">$2,500.00</TableCell>
                       </TableRow>
                     </TableFooter> */}
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
