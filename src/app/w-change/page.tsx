
'use client';

import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { getStockData, type StockData } from '@/services/stock-data';
import { processStockData, analyzeForWChange, type CalculatedStockData, type WChangeAnalysisOutput } from '@/lib/calculations';
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, AlertTriangle, TrendingUp, TrendingDown, ShieldCheck } from 'lucide-react';

// Using a smaller list for W.Change page development to manage API calls and performance.
// The main page (page.tsx) has the full list.
const STOCKS_FOR_WCHANGE = ['ABB', 'ACC', 'AARTIIND', 'ABCAPITAL', 'ABFRL', 'ADANIENT', 'RELIANCE', 'INFY', 'TCS', 'HDFCBANK']; // Example subset

const WChangePage: FC = () => {
  const [analysisResults, setAnalysisResults] = useState<WChangeAnalysisOutput[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchAndAnalyzeData = async () => {
      setLoading(true);
      setError(null);
      const results: WChangeAnalysisOutput[] = [];

      for (const stockTicker of STOCKS_FOR_WCHANGE) {
        try {
          // Fetch ~30-40 days for indicator stability, analyzeForWChange uses latest
          const rawData: StockData[] = await getStockData(stockTicker, 30); 
          if (rawData && rawData.length > 0) {
            const dates = rawData.map(d => d.date);
            // processStockData calculates daily indicators like JNSAR, ATR, Close etc.
            const dailyCalculatedData: CalculatedStockData[] = processStockData(rawData, dates);
            
            // analyzeForWChange performs W.Change specific logic using latest dailyCalculatedData
            // For now, r5Trend and l5Validation are undefined, so "Confirmed" and "Strong" signals will be false.
            const analysis = analyzeForWChange({
              stockName: stockTicker,
              dailyData: dailyCalculatedData,
              // r5Trend: 'R', // Example: This would come from an external source or complex logic
              // l5Validation: true, // Example
            });

            if (analysis) {
              results.push(analysis);
            }
          }
        } catch (err: any) {
          console.error(`Error processing ${stockTicker}:`, err);
          toast({
            variant: "destructive",
            title: `Error for ${stockTicker}`,
            description: err.message || "Failed to fetch or process data.",
          });
          // Continue with other stocks
        }
      }
      setAnalysisResults(results);
      setLoading(false);
      if (results.length === 0 && STOCKS_FOR_WCHANGE.length > 0 && !error) {
        setError("No analysis results generated. Check if stock data is available for the selected tickers.");
      }
    };

    fetchAndAnalyzeData();
  }, [toast]);

  const renderTickerList = (tickers: string[]) => {
    if (tickers.length === 0) return <p className="text-sm text-muted-foreground">None</p>;
    return (
      <div className="flex flex-wrap gap-2">
        {tickers.map(ticker => <Badge key={ticker} variant="secondary">{ticker}</Badge>)}
      </div>
    );
  };

  const greenJNSARTickers = analysisResults.filter(r => r.isGreenJNSARTrigger).map(r => r.tickerName);
  const redJNSARTickers = analysisResults.filter(r => r.isRedJNSARTrigger).map(r => r.tickerName);
  const confirmedGreenTrendTickers = analysisResults.filter(r => r.isConfirmedGreenTrend).map(r => r.tickerName);
  const strongGreenSignalTickers = analysisResults.filter(r => r.isStrongGreenSignal).map(r => r.tickerName);
  const confirmedRedTrendTickers = analysisResults.filter(r => r.isConfirmedRedTrend).map(r => r.tickerName);
  const strongRedSignalTickers = analysisResults.filter(r => r.isStrongRedSignal).map(r => r.tickerName);

  return (
    <main className="container mx-auto py-8 px-4">
      <Card className="mb-6 shadow-lg border border-border rounded-lg">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground">W.Change Analysis</CardTitle>
          <CardDescription>Analysis of stock data based on weekly change parameters. (Key calculations explanation removed as requested)</CardDescription>
        </CardHeader>
      </Card>

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="shadow border border-border rounded-lg">
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-1/2 mb-2" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="shadow-md border border-border rounded-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-md font-medium flex items-center">
                <CheckCircle className="mr-2 h-5 w-5 text-green-500" />Green JNSAR Triggers
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renderTickerList(greenJNSARTickers)}
            </CardContent>
          </Card>

          <Card className="shadow-md border border-border rounded-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-md font-medium flex items-center">
                <XCircle className="mr-2 h-5 w-5 text-red-500" />Red JNSAR Triggers
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renderTickerList(redJNSARTickers)}
            </CardContent>
          </Card>

          <Card className="shadow-md border border-border rounded-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-md font-medium flex items-center">
                <TrendingUp className="mr-2 h-5 w-5 text-green-600" />Confirmed Green Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renderTickerList(confirmedGreenTrendTickers)}
               {confirmedGreenTrendTickers.length === 0 && <p className="text-xs text-muted-foreground italic">(Requires 'Current Trend R' to be active for Green JNSAR tickers)</p>}
            </CardContent>
          </Card>
          
          <Card className="shadow-md border border-border rounded-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-md font-medium flex items-center">
                <TrendingDown className="mr-2 h-5 w-5 text-red-600" />Confirmed Red Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renderTickerList(confirmedRedTrendTickers)}
              {confirmedRedTrendTickers.length === 0 && <p className="text-xs text-muted-foreground italic">(Requires 'Current Trend D' to be active for Red JNSAR tickers)</p>}
            </CardContent>
          </Card>

          <Card className="shadow-md border border-border rounded-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-md font-medium flex items-center">
                <ShieldCheck className="mr-2 h-5 w-5 text-green-700" />Strong Green Signals
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renderTickerList(strongGreenSignalTickers)}
              {strongGreenSignalTickers.length === 0 && <p className="text-xs text-muted-foreground italic">(Requires 'Confirmed Green Trend' and 'Validation Flag' to be active)</p>}
            </CardContent>
          </Card>

          <Card className="shadow-md border border-border rounded-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-md font-medium flex items-center">
                 <ShieldCheck className="mr-2 h-5 w-5 text-red-700" />Strong Red Signals
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renderTickerList(strongRedSignalTickers)}
              {strongRedSignalTickers.length === 0 && <p className="text-xs text-muted-foreground italic">(Requires 'Confirmed Red Trend' and 'Validation Flag' to be active)</p>}
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
};

export default WChangePage;

