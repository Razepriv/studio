
'use client';

import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { getStockData, type StockData } from '@/services/stock-data';
import { processStockData, analyzeForWChange, type CalculatedStockData, type WChangeAnalysisOutput } from '@/lib/calculations';
import { useToast } from "@/hooks/use-toast";
import { List, CheckCircle, XCircle, AlertTriangle, TrendingUp, TrendingDown, ShieldCheck } from 'lucide-react';

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
          <CardDescription>Analysis of stock data based on weekly change parameters.</CardDescription>
        </CardHeader>
      </Card>

      <Accordion type="single" collapsible className="mb-6 bg-card p-4 rounded-lg shadow border border-border">
        <AccordionItem value="item-1">
          <AccordionTrigger className="text-lg font-medium hover:no-underline">
            <List className="mr-2 h-5 w-5 text-accent" /> Key Calculations Breakdown
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-3 pt-3">
            <p><strong>Dynamic Dates:</strong> Calculations use dynamically determined dates: Today (T), Yesterday (T-1), Two Days Ago (T-2), etc., based on the latest available trading data.</p>
            
            <div>
              <h4 className="font-semibold text-foreground mb-1">1. Average Metric & Threshold:</h4>
              <p><strong>Average Metric:</strong> Currently uses the latest calculated ATR (Average True Range for 14 periods) value for T as a proxy for a weekly-based technical metric average.
              <br /> <code className="text-xs bg-muted p-1 rounded">ATR[T]</code>
              </p>
              <p><strong>5% Threshold:</strong> Calculated as <code className="text-xs bg-muted p-1 rounded">Average Metric * 0.05</code>. Used as a comparative indicator threshold.</p>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-1">2. Data Points Used (for T, T-1, etc.):</h4>
              <p><strong>Ticker Name:</strong> Name of the stock.</p>
              <p><strong>Last 5 Day Volumes:</strong> Volume data for the last 5 available trading days (T, T-1, T-2, T-3, T-4).</p>
              <p><strong>Indicator Set A (JNSAR):</strong> JNSAR values for the last 5 days.</p>
              <p><strong>Indicator Set B (Close Price):</strong> Closing prices for the last 5 days.</p>
              <p><strong>OHLC / Price Metrics:</strong> Open, High, Low, Close data for the last 5 days.</p>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-1">3. JNSAR Triggers:</h4>
              <p><strong>Green JNSAR Trigger:</strong> Identified if <code className="text-xs bg-muted p-1 rounded">JNSAR[T-1] &gt; Close[T-1]</code> AND <code className="text-xs bg-muted p-1 rounded">JNSAR[T] &lt; Close[T]</code>. This indicates JNSAR crossed below the closing price (bullish signal). Shows ticker if condition met.</p>
              <p><strong>Red JNSAR Trigger:</strong> Identified if <code className="text-xs bg-muted p-1 rounded">JNSAR[T-1] &lt; Close[T-1]</code> AND <code className="text-xs bg-muted p-1 rounded">JNSAR[T] &gt; Close[T]</code>. This indicates JNSAR crossed above the closing price (bearish signal). Shows ticker if condition met.</p>
            </div>
            
            <div>
              <h4 className="font-semibold text-foreground mb-1">4. Trend & Validation (Conceptual - requires external input):</h4>
              <p><strong>Current Trend is R:</strong> If an external signal (conceptually 'R5' cell) indicates a Rising trend for the ticker.</p>
              <p><strong>Current Trend is D:</strong> If an external signal (conceptually 'R5' cell) indicates a Declining trend for the ticker.</p>
              <p><strong>Validation Flag:</strong> If an external boolean flag (conceptually 'L5' cell) is TRUE for the ticker.</p>
              <p className="italic text-xs">Note: For the current implementation, "Current Trend" and "Validation Flag" are not derived and default to states that won't activate "Confirmed" or "Strong" signals unless data is explicitly provided.</p>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-1">5. Confirmed & Strong Signals:</h4>
              <p><strong>Confirmed Green Trend:</strong> Ticker has a "Green JNSAR Trigger" AND "Current Trend is R".</p>
              <p><strong>Strong Green Signal:</strong> Ticker has "Green JNSAR Trigger" AND "Current Trend is R" AND "Validation Flag" is TRUE.</p>
              <p><strong>Confirmed Red Trend:</strong> Ticker has a "Red JNSAR Trigger" AND "Current Trend is D".</p>
              <p><strong>Strong Red Signal:</strong> Ticker has "Red JNSAR Trigger" AND "Current Trend is D" AND "Validation Flag" is TRUE.</p>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

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

