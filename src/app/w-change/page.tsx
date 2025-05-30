
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
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
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
].filter((v, i, a) => a.indexOf(v) === i).sort(); // Count: 165


const WChangePage: FC = () => {
  const [analysisResults, setAnalysisResults] = useState<WChangeAnalysisOutput[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [filteredAnalysisResults, setFilteredAnalysisResults] = useState<WChangeAnalysisOutput[]>([]);
  const [selectedRange, setSelectedRange] = useState<string>('Current Week'); // This state is present but not fully driving logic yet

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
          // Fetch 30 weeks of data for indicator stability, ending at selectedDate (or today)
          // analyzeForWChange uses latest week from this data
          const rawData: StockData[] = await getStockData(stockTicker, 30, endDate, '1wk');
          
          if (rawData && rawData.length > 0) {
            const dates = rawData.map(d => d.date);
            // processStockData calculates weekly indicators
            const weeklyCalculatedData: CalculatedStockData[] = processStockData(rawData, dates);
            
            const analysis = analyzeForWChange({
              stockName: stockTicker,
              dailyData: weeklyCalculatedData, // Passing weekly data here
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
            description: "No specific Weekly Change signals were triggered for the analyzed stocks based on current criteria.",
        });
      } else if (results.length > 0) {
         toast({
            title: "Analysis Complete",
            description: `Successfully analyzed ${results.length} stocks for Weekly Change signals.`,
        });
      }

      setAnalysisResults(results);
      setLoading(false);
    };
    fetchAndAnalyzeData();
  }, [selectedDate, toast]);

  // Display all analysis results; selectedDate influences the "as of" date for latest week.
  useEffect(() => {
    setFilteredAnalysisResults(analysisResults);
  }, [analysisResults]);

  const renderTickerList = (tickers: string[]) => {
    if (tickers.length === 0) return <p className="text-xs text-muted-foreground">No tickers match this category.</p>;
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
    if (isDownloading || filteredAnalysisResults.length === 0) {
      toast({ title: "Download Info", description: isDownloading ? "Download already in progress." : "No analysis data to download." });
      return;
    }
    setIsDownloading(true);
    toast({ title: "Download Started", description: `Preparing W.Change analysis data for Excel.` });

    try {
      const workbook = XLSX.utils.book_new();
      const dataForSheet = filteredAnalysisResults.map(analysis => ({
        'Ticker': analysis.tickerName,
        'Date of Latest Week': analysis.latestDate, // This date is the start of the week typically
        'Avg Metric (ATR W)': analysis.averageMetric,
        '5% Threshold': analysis.fivePercentThreshold,
        'JNSAR (W-1)': analysis.jnsarTminus1, // Represents previous week's JNSAR
        'Close (W-1)': analysis.closeTminus1,   // Represents previous week's Close
        'JNSAR (W)': analysis.jnsarT,       // Represents current week's JNSAR
        'Close (W)': analysis.closeT,       // Represents current week's Close
        'Last 5 Weeks Volumes': analysis.last5DayVolumes.join(', '), // Now represents weekly volumes
        'Last 5 Weeks JNSAR': analysis.last5DayJNSAR.join(', '),   // Weekly JNSAR
        'Last 5 Weeks Close': analysis.last5DayClose.join(', '),   // Weekly Close
        'Validation Flag (L5)': analysis.validationFlag,
        'Green JNSAR Trigger': analysis.isGreenJNSARTrigger ? 'TRUE' : 'FALSE',
        'Red JNSAR Trigger': analysis.isRedJNSARTrigger ? 'TRUE' : 'FALSE',
        'Current Trend (R5)': analysis.currentTrend ?? 'N/A',
        'Confirmed Green Trend': analysis.isConfirmedGreenTrend ? 'TRUE' : 'FALSE',
        'Strong Green Signal': analysis.isStrongGreenSignal ? 'TRUE' : 'FALSE',
        'Confirmed Red Trend': analysis.isConfirmedRedTrend ? 'TRUE' : 'FALSE',
        'Strong Red Signal': analysis.isStrongRedSignal ? 'TRUE' : 'FALSE',
      }));

      if (dataForSheet.length === 0) {
        toast({ variant: "destructive", title: "Download Error", description: "No categorized tickers to export." });
        setIsDownloading(false);
        return;
      }
      
      const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
      XLSX.utils.book_append_sheet(workbook, worksheet, "WChange_Analysis");
      XLSX.writeFile(workbook, `WChange_Weekly_Analysis_Report.xlsx`);
      toast({ title: "Download Complete", description: `W.Change weekly analysis report downloaded.` });

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
            <CardTitle className="text-xl font-semibold text-foreground">W.Change Analysis (Weekly)</CardTitle>
            <CardDescription>Analysis of stock data based on weekly change parameters, as of the week ending on or before selected date.</CardDescription>
             {loading && <CardDescription>Processed {processedCount} of {ALL_POSSIBLE_STOCKS.length} stocks...</CardDescription>}
          </div>
          <div className="flex items-center space-x-4">
             <Select value={selectedRange} onValueChange={setSelectedRange}>
                <SelectTrigger className="w-[180px]">
                   <SelectValue placeholder="Select Range" />
                </SelectTrigger>
                <SelectContent>
                   <SelectItem value="Current Week">Latest Week</SelectItem>
                   {/* Add other range options later if needed */}
                </SelectContent>
             </Select>
              <Popover>
                <PopoverTrigger asChild>
                <Button variant={"outline"} className={`w-[180px] justify-start text-left font-normal ${!selectedDate && "text-muted-foreground"}`}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP") : "Pick 'as of' date"}
                </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate as DateSelectEventHandler} initialFocus /></PopoverContent>
            </Popover>
            <Button onClick={handleDownloadExcel} disabled={isDownloading || loading || filteredAnalysisResults.length === 0} className="h-9 text-sm">
                <Download className="mr-2 h-4 w-4" />
                {isDownloading ? 'Downloading...' : 'Download Analysis'}
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Accordion type="single" collapsible className="w-full mb-6 shadow border border-border rounded-lg p-4 bg-card">
        <AccordionItem value="item-1" className="border-b-0">
          <AccordionTrigger className="text-md font-medium hover:no-underline">Key Calculations Breakdown (W = Current Week, W-1 = Previous Week)</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2 text-sm pt-2 text-card-foreground">
              <p><strong>Average Metric:</strong> Calculated as the latest Average True Range (ATR) value for week W.</p>
              <p><strong>5% Threshold:</strong> Calculated as <code>Average Metric * 0.05</code> (Note: This threshold is calculated but not directly used in current public triggers).</p>
              <p><strong>Data Points Used:</strong> The analysis primarily uses JNSAR and Closing prices for the current week (W) and the previous week (W-1).</p>
              <p><strong>Green JNSAR Trigger:</strong> A stock triggers this if: <code>JNSAR[W-1] &gt; Close[W-1]</code> AND <code>JNSAR[W] &lt; Close[W]</code>. The ticker name is shown if triggered.</p>
              <p><strong>Red JNSAR Trigger:</strong> A stock triggers this if: <code>JNSAR[W-1] &lt; Close[W-1]</code> AND <code>JNSAR[W] &gt; Close[W]</code>. The ticker name is shown if triggered.</p>
              <p><strong>Current Trend (R/D):</strong> Based on an external data point or rule (e.g., 'R5' from a sheet). Currently, this defaults to a neutral state if not provided, meaning 'Confirmed Trend' signals might not activate unless this input is integrated.</p>
              <p><strong>Validation Flag:</strong> Based on an external data point or rule (e.g., 'L5' from a sheet). Currently, this defaults to false if not provided, meaning 'Strong Signal' categorizations might not activate unless this input is integrated.</p>
              <p><strong>Confirmed Green Trend:</strong> Triggered if a stock has a "Green JNSAR Trigger" (Weekly) AND its "Current Trend" is 'R' (Rising).</p>
              <p><strong>Strong Green Signal:</strong> Triggered if a stock has a "Confirmed Green Trend" AND its "Validation Flag" is true.</p>
              <p><strong>Confirmed Red Trend:</strong> Triggered if a stock has a "Red JNSAR Trigger" (Weekly) AND its "Current Trend" is 'D' (Declining).</p>
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

      {!loading && !error && (filteredAnalysisResults.length > 0 || ALL_POSSIBLE_STOCKS.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="shadow-md border border-border rounded-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-md font-medium flex items-center">
                <CheckCircle className="mr-2 h-5 w-5 text-green-500" />Green JNSAR Triggers (Weekly)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renderTickerList(greenJNSARTickers)}
            </CardContent>
          </Card>

          <Card className="shadow-md border border-border rounded-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-md font-medium flex items-center">
                <XCircle className="mr-2 h-5 w-5 text-red-500" />Red JNSAR Triggers (Weekly)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renderTickerList(redJNSARTickers)}
            </CardContent>
          </Card>

          <Card className="shadow-md border border-border rounded-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-md font-medium flex items-center">
                <TrendingUp className="mr-2 h-5 w-5 text-green-600" />Confirmed Green Trend (Weekly)
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
                <TrendingDown className="mr-2 h-5 w-5 text-red-600" />Confirmed Red Trend (Weekly)
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
                <ShieldCheck className="mr-2 h-5 w-5 text-green-700" />Strong Green Signals (Weekly)
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
                 <ShieldCheck className="mr-2 h-5 w-5 text-red-700" />Strong Red Signals (Weekly)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renderTickerList(strongRedSignalTickers)}
              {strongRedSignalTickers.length === 0 && analysisResults.some(r => r.isConfirmedRedTrend) && <p className="text-xs text-muted-foreground italic">(Requires 'Confirmed Red Trend' and 'Validation Flag' to be active)</p>}
            </CardContent>
          </Card>
        </div>
      )}
      {!loading && !error && filteredAnalysisResults.length === 0 && ALL_POSSIBLE_STOCKS.length > 0 && (
         <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>No Specific Weekly Signals</AlertTitle>
          <AlertDescription>The analysis completed, but no stocks triggered the specific weekly W.Change signal criteria for the latest week based on the selected 'as of' date. This could be due to market conditions or data patterns.</AlertDescription>
        </Alert>
      )}
    </main>
  );
};

export default WChangePage;
    
