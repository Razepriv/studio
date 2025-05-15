
'use client';

import type { FC } from 'react';
import type { DateSelectEventHandler } from 'react-day-picker';
import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { format } from 'date-fns';
import { getStockData, type StockData } from '@/services/stock-data';
import { processStockData, analyzeForWChange, type CalculatedStockData, type WChangeAnalysisOutput } from '@/lib/calculations';
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon } from "lucide-react";
import { CheckCircle, XCircle, AlertTriangle, TrendingUp, TrendingDown, ShieldCheck, Download } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

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
].filter((v, i, a) => a.indexOf(v) === i).sort();


const WChangePage: FC = () => {
  const [analysisResults, setAnalysisResults] = useState<WChangeAnalysisOutput[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [filteredAnalysisResults, setFilteredAnalysisResults] = useState<WChangeAnalysisOutput[]>([]); // Store filtered results for display and download

  useEffect(() => {
    const fetchAndAnalyzeData = async () => {
      setLoading(true);
      setError(null);
      setProcessedCount(0);
      const results: WChangeAnalysisOutput[] = [];
      const totalStocks = ALL_POSSIBLE_STOCKS.length;

      const endDate = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : undefined;

      for (let i = 0; i < totalStocks; i++) {
        const stockTicker = ALL_POSSIBLE_STOCKS[i];
        try {
          // Fetch ~30-40 days for indicator stability, analyzeForWChange uses latest
          const rawData: StockData[] = await getStockData(stockTicker,
            30 // Fetch 30 days of data
); 
          if (rawData && rawData.length > 0) { // Ensure we have data to process
            const dates = rawData.map(d => d.date);
            // processStockData calculates daily indicators like JNSAR, ATR, Close etc.
            const dailyCalculatedData: CalculatedStockData[] = processStockData(rawData, dates);
            
            const analysis = analyzeForWChange({
              stockName: stockTicker,
              dailyData: dailyCalculatedData,
              // r5Trend and l5Validation are not sourced yet, defaults will apply
            });

            if (analysis) {
              results.push(analysis);
            }
          }
        } catch (err: any) {
          console.error(`Error processing ${stockTicker}:`, err);
          // Optionally, show a non-blocking toast for individual errors
        }
        setProcessedCount(prevCount => prevCount + 1);
      }
      
      if (results.length === 0 && totalStocks > 0 && !error) {
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

      setAnalysisResults(results); // Set analysis results after fetching and processing
      setLoading(false);
    };
    fetchAndAnalyzeData(); // Initial fetch and analysis
  }, [selectedDate, toast, ALL_POSSIBLE_STOCKS]); // Re-run when selectedDate changes, toast is available, or stocks list changes

  // Filter analysis results based on the selected date whenever selectedDate or analysisResults changes
  useEffect(() => {
    const filtered = selectedDate
      ? analysisResults.filter(analysis => {
          // Assuming analysis.date is in 'yyyy-MM-dd' format
          return analysis.date === format(selectedDate, 'yyyy-MM-dd');
        })
      : analysisResults; // Show all if no date is selected
    setFilteredAnalysisResults(filtered);
  }, [selectedDate, analysisResults]);

  const renderTickerList = (tickers: string[]) => {
 return (
 <div className="flex flex-wrap gap-2">
 {tickers.map(ticker => <Badge key={ticker} variant="secondary">{ticker}</Badge>)}
 </div>
 );
  };

 const greenJNSARTickers = filteredAnalysisResults.filter(r => r.isGreenJNSARTrigger).map(r => r.tickerName);
  const redJNSARTickers = filteredAnalysisResults.filter(r => r.isRedJNSARTrigger).map(r => r.tickerName);
  const confirmedGreenTrendTickers = filteredAnalysisResults.filter(r => r.isConfirmedGreenTrend).map(r => r.tickerName);
  const strongGreenSignalTickers = filteredAnalysisResults.filter(r => r.isStrongGreenSignal).map(r => r.tickerName);
  const confirmedRedTrendTickers = filteredAnalysisResults.filter(r => r.isConfirmedRedTrend).map(r => r.tickerName);
  const strongRedSignalTickers = filteredAnalysisResults.filter(r => r.isStrongRedSignal).map(r => r.tickerName);

  const handleDownloadExcel = () => {

    if (isDownloading || analysisResults.length === 0) {
      toast({ title: "Download Info", description: isDownloading ? "Download already in progress." : "No analysis data to download." });
      return;
    }
    setIsDownloading(true);
    toast({ title: "Download Started", description: `Preparing W.Change analysis data for Excel.` });

    try {
      const workbook = XLSX.utils.book_new();

      // Create a sheet for the filtered analysis results with all details
      const sheetData = filteredAnalysisResults.map(analysis => ({
        'Ticker': analysis.tickerName,
        'Date': analysis.date,
        'Average Metric': analysis.averageMetric,
        '5% Threshold': analysis.fivePercentThreshold,
        'Latest JNSAR': analysis.latestJNSAR,
        'Previous JNSAR': analysis.previousJNSAR,
        'Latest Close': analysis.latestClose,
        'Previous Close': analysis.previousClose,
        'Current Trend (R/D)': analysis.r5Trend, // Assuming r5Trend is the current trend source
        'Validation Flag': analysis.l5Validation, // Assuming l5Validation is the validation flag source
        'Green JNSAR Trigger': analysis.isGreenJNSARTrigger ? 'TRUE' : 'FALSE',
        'Red JNSAR Trigger': analysis.isRedJNSARTrigger ? 'TRUE' : 'FALSE',
        'Confirmed Green Trend': analysis.isConfirmedGreenTrend ? 'TRUE' : 'FALSE',
        'Strong Green Signal': analysis.isStrongGreenSignal ? 'TRUE' : 'FALSE',
        'Confirmed Red Trend': analysis.isConfirmedRedTrend ? 'TRUE' : 'FALSE',
        'Strong Red Signal': analysis.isStrongRedSignal ? 'TRUE' : 'FALSE',
        // Add other relevant fields from WChangeAnalysisOutput if needed
        // For example, if you want daily data points used for analysis:
        // 'Daily Data (JSON)': JSON.stringify(analysis.dailyData), // Convert array/object to string
        // This might be too much data, consider adding specific daily metrics if crucial
        // e.g., 'Day T Close': analysis.dailyData[analysis.dailyData.length - 1]?.Close,
        // 'Day T JNSAR': analysis.dailyData[analysis.dailyData.length - 1]?.JNSAR,
        // 'Day T-1 Close': analysis.dailyData[analysis.dailyData.length - 2]?.Close,
      }));

      if (sheetData.length === 0) {
        toast({ variant: "destructive", title: "Download Error", description: "No categorized tickers to export." });
        setIsDownloading(false);
        return;
      }

      XLSX.writeFile(workbook, `WChange_Analysis_Report.xlsx`);
      toast({ title: "Download Complete", description: `W.Change analysis report downloaded.` });

    }
    catch (e: any) {
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
            <CardDescription>Analysis of stock data based on weekly change parameters.</CardDescription>
             {loading && <CardDescription>Processed {processedCount} of {ALL_POSSIBLE_STOCKS.length} stocks...</CardDescription>}
          </div>
          {/* Date Picker and Download */}
          <div className="flex items-center space-x-4">
             <Popover>
                <PopoverTrigger asChild>
                <Button variant={"outline"} className={`w-[180px] justify-start text-left font-normal ${!selectedDate && "text-muted-foreground"}`}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? selectedDate.toDateString() : "Pick a date"}
                </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate as DateSelectEventHandler} initialFocus /></PopoverContent>
            </Popover>
          </div>
          <Button onClick={handleDownloadExcel} disabled={isDownloading || loading || analysisResults.length === 0} className="h-9 text-sm">
            <Download className="mr-2 h-4 w-4" />
            {isDownloading ? 'Downloading...' : 'Download Analysis'}
          </Button>
        </CardHeader>
      </Card>

      <Accordion type="single" collapsible className="w-full mb-6 shadow border border-border rounded-lg p-4 bg-card">
        <AccordionItem value="item-1" className="border-b-0">
          <AccordionTrigger className="text-md font-medium hover:no-underline">Key Calculations Breakdown (T = Today, T-1 = Yesterday)</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2 text-sm pt-2 text-card-foreground">
              <p><strong>Average Metric:</strong> Calculated as the latest Average True Range (ATR) value for day T.</p>
              <p><strong>5% Threshold:</strong> Calculated as <code>Average Metric * 0.05</code> (Note: This threshold is calculated but not directly used in current public triggers).</p>
              <p><strong>Data Points Used:</strong> The analysis primarily uses JNSAR and Closing prices for the current day (T) and the previous day (T-1).</p>
              <p><strong>Green JNSAR Trigger:</strong> A stock triggers this if: <code>JNSAR[T-1] &gt; Close[T-1]</code> AND <code>JNSAR[T] &lt; Close[T]</code>. The ticker name is shown if triggered.</p>
              <p><strong>Red JNSAR Trigger:</strong> A stock triggers this if: <code>JNSAR[T-1] &lt; Close[T-1]</code> AND <code>JNSAR[T] &gt; Close[T]</code>. The ticker name is shown if triggered.</p>
              <p><strong>Current Trend (R/D):</strong> Based on an external data point or rule (e.g., 'R5' from a sheet). Currently, this defaults to a neutral state if not provided, meaning 'Confirmed Trend' signals might not activate unless this input is integrated.</p>
              <p><strong>Validation Flag:</strong> Based on an external data point or rule (e.g., 'L5' from a sheet). Currently, this defaults to false if not provided, meaning 'Strong Signal' categorizations might not activate unless this input is integrated.</p>
              <p><strong>Confirmed Green Trend:</strong> Triggered if a stock has a "Green JNSAR Trigger" AND its "Current Trend" is 'R' (Rising).</p>
              <p><strong>Strong Green Signal:</strong> Triggered if a stock has a "Confirmed Green Trend" AND its "Validation Flag" is true.</p>
              <p><strong>Confirmed Red Trend:</strong> Triggered if a stock has a "Red JNSAR Trigger" AND its "Current Trend" is 'D' (Declining).</p>
              <p><strong>Strong Red Signal:</strong> Triggered if a stock has a "Confirmed Red Trend" AND its "Validation Flag" is true.</p>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

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

    