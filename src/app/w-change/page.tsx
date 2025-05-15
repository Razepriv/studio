
'use client';

import type { FC } from 'react';
import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getStockData, type StockData } from '@/services/stock-data';
import { processStockData, analyzeForWChange, type CalculatedStockData, type WChangeAnalysisOutput } from '@/lib/calculations';
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, AlertTriangle, TrendingUp, TrendingDown, ShieldCheck, Download } from 'lucide-react';

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
    // Adding potentially missing but common ones if needed: BAJAJHLDNG, LTIM, M&M, M&MFIN, SAMVARDHANA, MAXFINANCIAL etc. - Added common variations
].filter((v, i, a) => a.indexOf(v) === i).sort(); // Deduplicate and sort


const WChangePage: FC = () => {
  const [analysisResults, setAnalysisResults] = useState<WChangeAnalysisOutput[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [processedCount, setProcessedCount] = useState(0);

  useEffect(() => {
    const fetchAndAnalyzeData = async () => {
      setLoading(true);
      setError(null);
      setProcessedCount(0);
      const results: WChangeAnalysisOutput[] = [];
      const totalStocks = ALL_POSSIBLE_STOCKS.length;

      for (let i = 0; i < totalStocks; i++) {
        const stockTicker = ALL_POSSIBLE_STOCKS[i];
        try {
          // Fetch ~30-40 days for indicator stability, analyzeForWChange uses latest
          const rawData: StockData[] = await getStockData(stockTicker, 30); 
          if (rawData && rawData.length > 0) {
            const dates = rawData.map(d => d.date);
            // processStockData calculates daily indicators like JNSAR, ATR, Close etc.
            const dailyCalculatedData: CalculatedStockData[] = processStockData(rawData, dates);
            
            const analysis = analyzeForWChange({
              stockName: stockTicker,
              dailyData: dailyCalculatedData,
            });

            if (analysis) {
              results.push(analysis);
            }
          }
        } catch (err: any) {
          console.error(`Error processing ${stockTicker}:`, err);
          // Optionally, show a non-blocking toast for individual errors
          // toast({
          //   variant: "destructive",
          //   title: `Error for ${stockTicker}`,
          //   description: err.message || "Failed to fetch or process data.",
          // });
        }
        setProcessedCount(prevCount => prevCount + 1);
      }
      setAnalysisResults(results);
      setLoading(false);
      if (results.length === 0 && totalStocks > 0 && !error) { // Check if any error was set globally
        // This message might appear if all stocks fail or return no valid data for analysis
        // setError("No analysis results generated. Check if stock data is available for the selected tickers or if there were individual errors.");
         toast({
            title: "Analysis Complete",
            description: "No specific W.Change signals were triggered for the analyzed stocks based on current criteria.",
        });
      } else if (results.length > 0) {
         toast({
            title: "Analysis Complete",
            description: `Successfully analyzed ${results.length} stocks for W.Change signals.`,
        });
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

  const handleDownloadExcel = () => {
    if (isDownloading || analysisResults.length === 0) {
      toast({ title: "Download Info", description: isDownloading ? "Download already in progress." : "No analysis data to download." });
      return;
    }
    setIsDownloading(true);
    toast({ title: "Download Started", description: `Preparing W.Change analysis data for Excel.` });

    try {
      const workbook = XLSX.utils.book_new();

      const createSheetData = (tickers: string[]) => tickers.map(ticker => ({ Ticker: ticker }));

      if (greenJNSARTickers.length > 0) {
        const wsGreenJNSAR = XLSX.utils.json_to_sheet(createSheetData(greenJNSARTickers));
        XLSX.utils.book_append_sheet(workbook, wsGreenJNSAR, "Green JNSAR");
      }
      if (redJNSARTickers.length > 0) {
        const wsRedJNSAR = XLSX.utils.json_to_sheet(createSheetData(redJNSARTickers));
        XLSX.utils.book_append_sheet(workbook, wsRedJNSAR, "Red JNSAR");
      }
      if (confirmedGreenTrendTickers.length > 0) {
        const wsConfirmedGreen = XLSX.utils.json_to_sheet(createSheetData(confirmedGreenTrendTickers));
        XLSX.utils.book_append_sheet(workbook, wsConfirmedGreen, "Confirmed Green Trend");
      }
      if (strongGreenSignalTickers.length > 0) {
        const wsStrongGreen = XLSX.utils.json_to_sheet(createSheetData(strongGreenSignalTickers));
        XLSX.utils.book_append_sheet(workbook, wsStrongGreen, "Strong Green Signal");
      }
      if (confirmedRedTrendTickers.length > 0) {
        const wsConfirmedRed = XLSX.utils.json_to_sheet(createSheetData(confirmedRedTrendTickers));
        XLSX.utils.book_append_sheet(workbook, wsConfirmedRed, "Confirmed Red Trend");
      }
      if (strongRedSignalTickers.length > 0) {
        const wsStrongRed = XLSX.utils.json_to_sheet(createSheetData(strongRedSignalTickers));
        XLSX.utils.book_append_sheet(workbook, wsStrongRed, "Strong Red Signal");
      }
      
      if (workbook.SheetNames.length === 0) {
        toast({ variant: "destructive", title: "Download Error", description: "No categorized tickers to export." });
        setIsDownloading(false);
        return;
      }

      XLSX.writeFile(workbook, `WChange_Analysis_Report.xlsx`);
      toast({ title: "Download Complete", description: `W.Change analysis report downloaded.` });

    } catch (e: any) {
      console.error("Error generating W.Change Excel:", e);
      toast({ variant: "destructive", title: "Download Error", description: e.message || "Could not generate Excel file." });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <main className="container mx-auto py-8 px-4">
      <Card className="mb-6 shadow-lg border border-border rounded-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-xl font-semibold text-foreground">W.Change Analysis</CardTitle>
            <CardDescription>Analysis of stock data based on weekly change parameters. Please wait while all stocks are processed.</CardDescription>
             {loading && <CardDescription>Processed {processedCount} of {ALL_POSSIBLE_STOCKS.length} stocks...</CardDescription>}
          </div>
          <Button onClick={handleDownloadExcel} disabled={isDownloading || loading || analysisResults.length === 0} className="h-9 text-sm">
            <Download className="mr-2 h-4 w-4" />
            {isDownloading ? 'Downloading...' : 'Download Analysis'}
          </Button>
        </CardHeader>
      </Card>

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="shadow border border-border rounded-lg">
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-1/2 mb-2" />
                <Skeleton className="h-10 w-full" />
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

      {!loading && !error && (analysisResults.length > 0 || ALL_POSSIBLE_STOCKS.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
               {confirmedGreenTrendTickers.length === 0 && analysisResults.some(r => r.isGreenJNSARTrigger) && <p className="text-xs text-muted-foreground italic">(Requires 'Current Trend R' to be active for Green JNSAR tickers)</p>}
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
              {confirmedRedTrendTickers.length === 0 && analysisResults.some(r => r.isRedJNSARTrigger) && <p className="text-xs text-muted-foreground italic">(Requires 'Current Trend D' to be active for Red JNSAR tickers)</p>}
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
              {strongGreenSignalTickers.length === 0 && analysisResults.some(r => r.isConfirmedGreenTrend) && <p className="text-xs text-muted-foreground italic">(Requires 'Confirmed Green Trend' and 'Validation Flag' to be active)</p>}
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
              {strongRedSignalTickers.length === 0 && analysisResults.some(r => r.isConfirmedRedTrend) && <p className="text-xs text-muted-foreground italic">(Requires 'Confirmed Red Trend' and 'Validation Flag' to be active)</p>}
            </CardContent>
          </Card>
        </div>
      )}
      {!loading && !error && analysisResults.length === 0 && ALL_POSSIBLE_STOCKS.length > 0 && (
         <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>No Specific Signals</AlertTitle>
          <AlertDescription>The analysis completed, but no stocks triggered the specific W.Change signal criteria. This could be due to current market conditions or data patterns.</AlertDescription>
        </Alert>
      )}
    </main>
  );
};

export default WChangePage;

