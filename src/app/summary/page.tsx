
'use client';

import { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Download, Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, subDays, isValid, parseISO } from 'date-fns';
import { getStockData, type StockData } from '@/services/stock-data'; // Assuming you have this service
import { cn } from '@/lib/utils'; // Assuming you have a utility function for class names
import { processStockData, analyzeForWChange, type WChangeAnalysisOutput, type CalculatedStockData } from '@/lib/calculations'; // Assuming you have these lib functions

// Define data structures
interface OverviewData {
  totalStocksTracked: number;
  newLongEntries: number;
  newShortEntries: number;
  redFlips: number;
  greenFlips: number;
  confirmedLongs: number;
  confirmedShorts: number;
}

export interface TrendSummaryData {
  category: string;
  count: number;
}

interface StockTrendMovement {
  stockName: string;
  currentSignal: string | null;
  previousSignal: string | null;
  change: string;
  daysInCurrentSignal: number | null; // This might require more complex logic to track
  validation: boolean | null;
  notes: string; // Placeholder for potential notes
  changeType: 'Entry' | 'Exit' | 'Change' | 'No Change' | null; // Added for visual indicators
 sector?: string; // Add sector field
}

// Define filter types (Exported for potential reuse)
type TrendCategoryFilter = 'All' | 'Long JN~ & R' | 'Long JN~, R & Vol' | 'Short JN~ & D' | 'Short JN, D & Vol' | 'Red Flips' | 'Green Flips';
type ConfirmationFilter = 'All' | 'Confirmed' | 'Unconfirmed';
type FlipFilter = 'All' | 'Flips Only';

// Mock list of possible stocks - replace with actual data fetching
const ALL_POSSIBLE_STOCKS = [
  'ABB', 'ACC', 'AARTIIND', 'ABCAPITAL', 'ABFRL', 'ADANIENT', 'ADANIGREEN', 'ADANIPORTS', 'ALKEM',
  'AMBUJACEM', 'APOLLOHOSP', 'APOLLOTYRE', 'ASHOKLEY', 'ASIANPAINT', 'ASTRAL', 'ATUL', 'AUBANK', 'AUROPHARMA', 'AXISBANK',
  'BAJAJ-AUTO', 'BAJFINANCE', 'BAJAJFINSV', 'BAJAJHLDNG', 'BALKRISIND', 'BANDHANBNK', 'BANKBARODA', 'BATAINDIA', 'BERGEPAINT',
  'BEL', 'BHARATFORG', 'BHARTIARTL', 'BHEL', 'BIOCON', 'BOSCHLTD', 'BPCL', 'BRITANNIA', 'CANBK', 'CHOLAFIN', 'CIPLA',
  'COALINDIA', 'COFORGE', 'COLPAL', 'CONCOR', 'COROMANDEL', 'CROMPTON', 'CUMMINSIND', 'DALBHARAT', 'DABUR', 'DEEPAKNTR',
  'DIVISLAB', 'DLF', 'DRREDDY', 'EICHERMOT', 'ESCORTS', 'FEDERALBNK', 'GAIL', 'GODREJCP', 'GODREJPROP', 'GRASIM',
  'GUJGASLTD', 'HAVELLS', 'HCLTECH', 'HDFCAMC', 'HDFCBANK', 'HDFCLIFE', 'HEROMOTOCO', 'HINDALCO', 'HINDCOPPER', 'HINDPETRO',
  'HINDUNILVR', 'HAL', 'ICICIBANK', 'ICICIGI', 'ICICIPRULI', 'IDFCFIRSTB', 'IDFC', 'INDHOTEL', 'INDIGO',
  'INDUSTOWER', 'INDUSINDBK', 'NAUKRI', 'INFY', 'IOC', 'IEX', 'IPCALAB', 'IRCTC', 'ITC', 'JINDALSTEL',
  'JSWSTEEL', 'JUBLFOOD', 'KOTAKBANK', 'LT', 'LTIM', 'LTTS', 'LALPATHLAB', 'LAURUSLABS', 'LICHSGFIN', 'LUPIN',
  'M&M', 'M&MFIN', 'MANAPPURAM', 'MARICO', 'MARUTI', 'MFSL', 'METROPOLIS', 'MGL', 'MOTHERSON', 'MPHASIS', 'MRF',
  'MUTHOOTFIN', 'NATIONALUM', 'NAVINFLUOR', 'NESTLEIND', 'NMDC', 'NTPC', 'OBEROIRLTY', 'ONGC', 'OFSS', 'PAGEIND',
  'PERSISTENT', 'PETRONET', 'PFIZER', 'PIDILITIND', 'PIIND', 'PNB', 'POLYCAB', 'PFC', 'POWERGRID', 'PVRINOX',
  'RAMCOCEM', 'RBLBANK', 'RECLTD', 'RELIANCE', 'SBICARD', 'SBILIFE', 'SRF', 'SHREECEM', 'SHRIRAMFIN', 'SIEMENS', 'SBIN',
  'SAIL', 'SUNPHARMA', 'SUNTV', 'SYNGENE', 'TATACONSUM', 'TATAMOTORS', 'TATAPOWER', 'TATASTEEL',
  'TCS', 'TECHM', 'TITAN', 'TORNTPHARM', 'TORNTPOWER', 'TRENT', 'TVSMOTOR', 'ULTRACEMCO', 'UBL', 'MCDOWELL-N',
  'UPL', 'VEDL', 'VOLTAS', 'WHIRLPOOL', 'WIPRO', 'ZEEL', 'ZYDUSLIFE'
].filter((v, i, a) => a.indexOf(v) === i).sort(); // Ensure uniqueness and sort

export default function SummaryPage() {
  const [selectedDateRange, setSelectedDateRange] = useState<string>('Week'); // Week, Month, 3M, 6M, 9M
  const [customDate, setCustomDate] = useState<Date | undefined>(new Date()); // For custom date selection
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [trendSummaryData, setTrendSummaryData] = useState<TrendSummaryData[]>([]);
  const [stockTrendMovementData, setStockTrendMovementData] = useState<StockTrendMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTrendCategoryFilter, setSelectedTrendCategoryFilter] = useState<TrendCategoryFilter>('All');
  const [selectedConfirmationFilter, setSelectedConfirmationFilter] = useState<ConfirmationFilter>('All');
  const [selectedFlipFilter, setSelectedFlipFilter] = useState<FlipFilter>('All');
  const [availableSectors, setAvailableSectors] = useState<string[]>(['All']); // Include 'All' by default
  const [selectedSectors, setSelectedSectors] = useState<string[]>(['All']); // Initialize with 'All' selected
  const [isDownloading, setIsDownloading] = useState(false);

  // Calculate the date range based on selectedDateRange and customDate
  const dateRange = useMemo(() => {
    const today = new Date();
    let startDate;
    const endDate = customDate || today;

    switch (selectedDateRange) {
      case 'Week':
        startDate = subDays(endDate, 7);
        break;
      case 'Month':
        startDate = subDays(endDate, 30); // Approximate month
        break;
      case '3M':
        startDate = subDays(endDate, 90); // Approximate 3 months
        break;
      case '6M':
        startDate = subDays(endDate, 180); // Approximate 6 months
        break;
      case '9M':
        startDate = subDays(endDate, 270); // Approximate 9 months
        break;
      // Add custom date range logic if the custom date picker is enabled
      default:
 startDate = subDays(endDate, 7); // Default to week
    }

    // Ensure startDate is a valid Date object and not in the future relative to endDate
    // If startDate is invalid or after endDate, set it to 7 days before endDate as a fallback
    if (!isValid(startDate) || startDate > endDate) {
        startDate = subDays(today, 7); // Fallback to last week if invalid or future
    }

    return { startDate, endDate };
  }, [selectedDateRange, customDate]);

  // Placeholder for fetching and processing data - will be implemented later
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const allStockTrendMovement: StockTrendMovement[] = [];
      const allAnalysisResults: WChangeAnalysisOutput[] = [];
      const uniqueSectors = new Set<string>();
        const currentSignalCounts: { [key: string]: number } = {};

      for (const stockTicker of ALL_POSSIBLE_STOCKS) {
        try {
          // Fetch enough data to cover the date range + historical data needed for calculations (e.g., 60 days)
          const dataNeededDays = Math.max(90, Math.ceil((dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 30); // Fetch for range + buffer for calculations
          const rawStockData: StockData[] = await getStockData(stockTicker, dataNeededDays);

          if (rawStockData && rawStockData.length > 0) {
            const allDates = rawStockData.map(d => d.date);
            const processed = processStockData(rawStockData, allDates);
            const stockSector = rawStockData[0]?.sector ?? "N/A"; 
            if (stockSector && stockSector !== "N/A") uniqueSectors.add(stockSector);
            
            // Filter processed data to the selected date range
            const dataForRange = processed.filter(p => {
              const pDate = parseISO(p.date); // p.date is expected to be a string
              return isValid(pDate) && pDate >= dateRange.startDate && pDate <= dateRange.endDate;
            });

            if (dataForRange.length >= 2) { // Need at least 2 days for analysis
                // Analyze for WChange for each relevant day in the range to track changes
                const analysisForRange: WChangeAnalysisOutput[] = dataForRange.map((dayData, index, arr) => {
                     // Pass the required historical context for analysis (e.g., last 5 days ending on current dayData, including dayData)
                     // Ensure relevantHistoricalData's date is a string in 'yyyy-MM-dd' format
                     const relevantHistoricalData: CalculatedStockData[] = processed.filter(p => {
                         const pDate = parseISO(p.date);
                         return isValid(pDate) && pDate <= new Date(dayData.date) && pDate >= subDays(new Date(dayData.date), 5); // Need at least 5 days for JNSAR/Trend
                     });
                     if (relevantHistoricalData.length >= 2) { // Need at least 2 days for analysis
                          return analyzeForWChange({
                             stockName: stockTicker,
                             dailyData: relevantHistoricalData,
                              r5Trend: null, // TODO: Implement R5 Trend calculation
                             l5Validation: false, // TODO: Implement L5 Validation calculation
                         });
                     }
                     return { // Default analysis output if not enough data
                         stockName: stockTicker,
                         isGreenJNSARTrigger: false, isRedJNSARTrigger: false,
                         trend: null, jnsarVsClose: null, validation: false,
                         signalType: null, trendSignalSummary: null,
                         currentTrend: null, validationFlag: false,
                         isConfirmedGreenTrend: false, isStrongGreenSignal: false,
                         isConfirmedRedTrend: false, isStrongRedSignal: false,
                         latestDate: null, averageMetric: null, fivePercentThreshold: null,
                         jnsarT: null, jnsarTminus1: null, closeT: null, closeTminus1: null, closeTminus2: null,
                         last5PeriodsVolumes: [], last5PeriodsJNSAR: [], last5PeriodsClose: [], last5PeriodsOHLC: [],
                     };
                }).filter(analysis => analysis !== null && analysis.trendSignalSummary !== null) as WChangeAnalysisOutput[]; // Filter out null or no-signal results

                 // Calculate days in current signal
                 let daysInCurrentSignal = 0;
                 const lastDayAnalysis = analysisForRange[analysisForRange.length - 1];
                 if (lastDayAnalysis?.trendSignalSummary) {
                    daysInCurrentSignal = 1;
                    for (let i = analysisForRange.length - 2; i >= 0; i--) {
                         // Compare with the previous day's signal summary
                         if (analysisForRange[i]?.trendSignalSummary === lastDayAnalysis.trendSignalSummary) {
                             daysInCurrentSignal++;
                         } else {
                             break; // Stop counting when the signal changes
                         }
                    }
                 }


                allAnalysisResults.push(...analysisForRange);

                // Determine the current and previous signal within the range
                const secondLastDayAnalysis = analysisForRange[analysisForRange.length - 2] || null;

                 let change = '';
                 let changeType: StockTrendMovement['changeType'] = null;
                 if (lastDayAnalysis?.trendSignalSummary && !secondLastDayAnalysis?.trendSignalSummary) {
                     change = `Entry (${lastDayAnalysis.trendSignalSummary})`;
                     changeType = 'Entry';
                 } else if (!lastDayAnalysis?.trendSignalSummary && secondLastDayAnalysis?.trendSignalSummary) {
                     change = `Exit (${secondLastDayAnalysis.trendSignalSummary})`; // Keep the previous signal in exit change description
                     changeType = 'Exit';
                 } else if (lastDayAnalysis?.trendSignalSummary && secondLastDayAnalysis?.trendSignalSummary && lastDayAnalysis.trendSignalSummary !== secondLastDayAnalysis.trendSignalSummary) {
                     change = `${secondLastDayAnalysis.trendSignalSummary} -> ${lastDayAnalysis.trendSignalSummary}`;
                     changeType = 'Change';
                 } else {
                     changeType = 'No Change';
                 }


                 // Count current signals for overview and summary table
                 if(lastDayAnalysis?.trendSignalSummary) {
                     currentSignalCounts[lastDayAnalysis.trendSignalSummary] = (currentSignalCounts[lastDayAnalysis.trendSignalSummary] || 0) + 1;
                 }

                // Add to stock trend movement data
                allStockTrendMovement.push({
                  stockName: stockTicker,
                  currentSignal: lastDayAnalysis?.trendSignalSummary ?? null,
                  previousSignal: secondLastDayAnalysis?.trendSignalSummary ?? null,
                  change: change,
                  daysInCurrentSignal: daysInCurrentSignal > 0 ? daysInCurrentSignal : null,
                  validation: lastDayAnalysis?.validation ?? null,
                  changeType: changeType,
                  sector: stockSector, // Add sector to the data
                  notes: '', // Placeholder
                });
            }
          }
        } catch (error) {
          console.error(`Error fetching or processing data for ${stockTicker}:`, error);
        }
      }

        // Calculate Overview Data based on the last day of the range for each stock processed
        const overview: OverviewData = {
            totalStocksTracked: allStockTrendMovement.length,
            newLongEntries: allStockTrendMovement.filter(s => s.change.startsWith('Entry') && s.currentSignal?.includes('Long')).length,
            newShortEntries: allStockTrendMovement.filter(s => s.change.startsWith('Entry') && s.currentSignal?.includes('Short')).length,
            redFlips: allStockTrendMovement.filter(s => s.currentSignal === 'Red Flip').length,
            greenFlips: allStockTrendMovement.filter(s => s.currentSignal === 'Green Flip').length,
            confirmedLongs: allStockTrendMovement.filter(s => s.currentSignal === 'Long Confirmed').length,
            confirmedShorts: allStockTrendMovement.filter(s => s.currentSignal === 'Short Confirmed').length,
        };
        setOverviewData(overview);

        // Calculate Trend Summary Data based on current signals
        const trendSummary: TrendSummaryData[] = [
            { category: 'Long JN~ & R', count: currentSignalCounts['Long JN~ & R'] || 0 },
            { category: 'Long JN~, R & Vol', count: currentSignalCounts['Long JN~, R & Vol'] || 0 },
            { category: 'Short JN~ & D', count: currentSignalCounts['Short JN~ & D'] || 0 },
            { category: 'Short JN, D & Vol', count: currentSignalCounts['Short JN, D & Vol'] || 0 },
            { category: 'Red Flips', count: currentSignalCounts['Red Flip'] || 0 },
            { category: 'Green Flips', count: currentSignalCounts['Green Flip'] || 0 },
             // Add counts for other potential signal types if needed in summary
        ];
        setTrendSummaryData(trendSummary);

        // Update available sectors based on processed data (excluding placeholder)
        const sortedUniqueSectors = Array.from(uniqueSectors).sort();
        setAvailableSectors(['All', ...sortedUniqueSectors]);

      // Update state with all collected movement data
      setStockTrendMovementData(allStockTrendMovement); // Update state with all collected movement data
      setLoading(false);
    };
    fetchData();
  }, [dateRange]); // Re-fetch when the date range changes

  const handleDownloadExcel = () => {
    if (isDownloading || filteredStockTrendMovementData.length === 0) {
      // toast({ title: "Download Info", description: isDownloading ? "Download in progress." : "No data to download." }); // Add toast later if needed
      return;
    }
    setIsDownloading(true);
    // toast({ title: "Download Started", description: `Preparing Summary Report for ${selectedDateRange}.` }); // Add toast later if needed

    try {
      // Prepare data for the sheet
      const dataForSheet = filteredStockTrendMovementData.map(row => ({
        "Stock Name": row.stockName,
        "Current Signal": row.currentSignal ?? '-',
        "Previous Signal": row.previousSignal ?? '-',
        "Change": row.change ?? '-',
        "Days in Current Signal": row.daysInCurrentSignal !== null ? row.daysInCurrentSignal : '-',
        "Validation (L5)": row.validation === true ? 'Yes' : row.validation === false ? 'No' : '-',
        "Notes": row.notes ?? '-',
        "Sector": row.sector ?? '-', // Include sector in export
        "Change Type": row.changeType ?? '-', // Include change type in export
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, `Summary_${selectedDateRange}`);
      XLSX.writeFile(workbook, `Summary_Report_${selectedDateRange}.xlsx`);

      // toast({ title: "Download Complete", description: `Summary report downloaded.` }); // Add toast later if needed
    } catch (e: any) {
      console.error("Error generating Summary Excel:", e);
      // toast({ variant: "destructive", title: "Download Error", description: e.message || "Could not generate file." }); // Add toast later if needed
    } finally {
      setIsDownloading(false);
    }
  };

  // Filtered Stock Trend Movement Data - Moved outside return to be available for download
  const filteredStockTrendMovementData = useMemo(() => {
    if (!stockTrendMovementData || stockTrendMovementData.length === 0) return []; // Ensure data is available

    return stockTrendMovementData.filter(row => {
      let includeRow = true;

      // Apply Trend Category Filter
      if (selectedTrendCategoryFilter !== 'All') {
        includeRow = includeRow && (row.currentSignal === selectedTrendCategoryFilter || (selectedTrendCategoryFilter === 'Red Flips' && row.currentSignal === 'Red Flip') || (selectedTrendCategoryFilter === 'Green Flips' && row.currentSignal === 'Green Flip'));
      }

      // Apply Sector Filter
      // Include row only if selectedSectors includes 'All' OR row's sector is in selectedSectors (case-insensitive)
      if (selectedSectors.length > 0 && !selectedSectors.includes('All')) {
        includeRow = includeRow && row.sector !== undefined && row.sector !== null && selectedSectors.some(s => row.sector?.toLowerCase() === s.toLowerCase());
      }

      // Apply Confirmation Filter
      // If validation is null or undefined, treat as unconfirmed
      if (selectedConfirmationFilter === 'Confirmed') {
        includeRow = includeRow && row.validation === true;
      } else if (selectedConfirmationFilter === 'Unconfirmed') { // Handle cases where validation is explicitly false or null/undefined (treated as unconfirmed)
        includeRow = includeRow && row.validation === false;
      }

      // Apply Flips Only Filter
      if (selectedFlipFilter === 'Flips Only') {
        includeRow = includeRow && (row.currentSignal === 'Red Flip' || row.currentSignal === 'Green Flip');
      }
      return includeRow;
    });
  }, [stockTrendMovementData, selectedTrendCategoryFilter, selectedSectors, selectedConfirmationFilter, selectedFlipFilter]); // Add all dependencies


  return (
    <TooltipProvider>
      <main className="container mx-auto py-8">
        <Card className="shadow-lg border border-border rounded-lg">
          <CardHeader className="border-b border-border pb-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xl font-semibold text-foreground">Market Summary</CardTitle>
                <CardDescription>High-level snapshot of market signal trends for the selected period ({format(dateRange.startDate, 'PPP')} to {format(dateRange.endDate, 'PPP')}).</CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                {/* Date Range Selector */}
                <Select value={selectedDateRange} onValueChange={setSelectedDateRange}>
                  <SelectTrigger className="w-[180px] h-9 text-sm">
                    <SelectValue placeholder="Select range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Week">Week</SelectItem>
                    <SelectItem value="Month">Month</SelectItem>
                    <SelectItem value="3M">Last 3 Months</SelectItem>
                    <SelectItem value="6M">Last 6 Months</SelectItem>
                    <SelectItem value="9M">Last 9 Months</SelectItem>
                    {/* Add custom date range option later */}
                  </SelectContent>
                </Select>

                {/* Custom Date Picker (Optional, for specific date ranges) */}
                {/* <Popover>
                  <PopoverTrigger asChild >
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full sm:w-[180px] justify-start text-left font-normal h-9 text-sm",
                        !customDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customDate ? format(customDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={customDate}
                      onSelect={setCustomDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover> */}

                {/* Filter Options */}
                <div className="flex flex-wrap items-center gap-4">
                  {/* Trend Category Filter */}
                  <div className="flex items-center gap-2 text-sm">
                    <label className="text-muted-foreground">Category:</label>
                    <Select value={selectedTrendCategoryFilter} onValueChange={(value: TrendCategoryFilter) => setSelectedTrendCategoryFilter(value)}>
                      <SelectTrigger className="w-[180px] h-8 text-xs">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All">All Categories</SelectItem>
                        <SelectItem value="Long JN~ & R">Long JN~ & R</SelectItem>
                        <SelectItem value="Long JN~, R & Vol">Long JN~, R & Vol</SelectItem>
                        <SelectItem value="Short JN~ & D">Short JN~ & D</SelectItem>
                        <SelectItem value="Short JN, D & Vol">Short JN, D & Vol</SelectItem>
                        <SelectItem value="Red Flips">Red Flips</SelectItem>
                        <SelectItem value="Green Flips">Green Flips</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Confirmation Filter */}
                  <div className="flex items-center gap-2 text-sm">
                    <label className="text-muted-foreground">Confirmation:</label>
                    <Select value={selectedConfirmationFilter} onValueChange={(value: ConfirmationFilter) => setSelectedConfirmationFilter(value)}>
                      <SelectTrigger className="w-[150px] h-8 text-xs">
                        <SelectValue placeholder="Select confirmation" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All">All</SelectItem>
                        <SelectItem value="Confirmed">Confirmed</SelectItem>
                        <SelectItem value="Unconfirmed">Unconfirmed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Flips Only Filter */}
                  <div className="flex items-center gap-2 text-sm">
                    <label className="text-muted-foreground">Flips:</label>
                    <Select value={selectedFlipFilter} onValueChange={(value: FlipFilter) => setSelectedFlipFilter(value)}>
                      <SelectTrigger className="w-[120px] h-8 text-xs">
                        <SelectValue placeholder="Select flip type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All">All</SelectItem>
                        <SelectItem value="Flips Only">Flips Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Sector Filter */}
                  <div className="flex items-center gap-2 text-sm">
                    <label className="text-muted-foreground">Sector:</label>
                    {/* For simplicity, using single select for now. Can be extended to multi-select later. */}
                      <Select onValueChange={(value) => setSelectedSectors(value === 'All' ? ['All'] : [value])} value={selectedSectors.includes('All') ? 'All' : selectedSectors[0] || 'All'}>
                        <SelectTrigger className="w-[180px] h-8 text-xs">
                            <SelectValue placeholder="Select Sector" />
                        </SelectTrigger>
                        <SelectContent>
                            {/* Ensure 'All' is always the first option */}
                            {availableSectors.map(sector => <SelectItem key={sector} value={sector}>{sector}</SelectItem>)}
                        </SelectContent>
                    </Select>
                  </div>
                </div>
                {/* Download Button */}
                <Button onClick={handleDownloadExcel} disabled={loading || isDownloading || filteredStockTrendMovementData.length === 0} className="h-9 text-sm w-full sm:w-auto">
                  <Download className="mr-2 h-4 w-4" />
                  Download Summary
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {/* Overview Cards Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardHeader>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center gap-1 cursor-help">
                        <CardTitle className="text-md">Total Stocks Tracked</CardTitle><Info size={14} className="text-muted-foreground" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <p>Total number of unique stocks for which trend movement data was successfully processed for the selected period.</p>
                    </TooltipContent>
                  </Tooltip>
                </CardHeader><CardContent>{overviewData?.totalStocksTracked ?? '-'}</CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <Tooltip>
                     <TooltipTrigger asChild>
                      <span className="flex items-center gap-1 cursor-help">
                        <CardTitle className="text-md">New Long Entries</CardTitle><Info size={14} className="text-muted-foreground" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <p>Number of stocks that newly entered any 'Long' signal (e.g., 'Long JN~ & R', 'Long Confirmed') during the selected period, having no signal or a different signal previously.</p>
                    </TooltipContent>
                  </Tooltip>
                </CardHeader><CardContent>{overviewData?.newLongEntries ?? '-'}</CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center gap-1 cursor-help">
                        <CardTitle className="text-md">New Short Entries</CardTitle><Info size={14} className="text-muted-foreground" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <p>Number of stocks that newly entered any 'Short' signal (e.g., 'Short JN~ & D', 'Short Confirmed') during the selected period, having no signal or a different signal previously.</p>
                    </TooltipContent>
                  </Tooltip>
                </CardHeader><CardContent>{overviewData?.newShortEntries ?? '-'}</CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center gap-1 cursor-help">
                        <CardTitle className="text-md">Red Flips</CardTitle><Info size={14} className="text-muted-foreground" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <p>Stocks ending the period in a 'Red Flip' state. This indicates a JNSAR crossover from below Close to above Close (on the last day of period), suggesting a potential shift to a bearish outlook. This is based on the daily JNSAR calculation for the specified period.</p>
                    </TooltipContent>
                  </Tooltip>
                </CardHeader><CardContent>{overviewData?.redFlips ?? '-'}</CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center gap-1 cursor-help">
                        <CardTitle className="text-md">Green Flips</CardTitle><Info size={14} className="text-muted-foreground" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <p>Stocks ending the period in a 'Green Flip' state. This indicates a JNSAR crossover from above Close to below Close (on the last day of period), suggesting a potential shift to a bullish outlook. This is based on the daily JNSAR calculation for the specified period.</p>
                    </TooltipContent>
                  </Tooltip>
                </CardHeader><CardContent>{overviewData?.greenFlips ?? '-'}</CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center gap-1 cursor-help">
                        <CardTitle className="text-md">Confirmed Longs</CardTitle><Info size={14} className="text-muted-foreground" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <p>Stocks ending the period in a 'Long Confirmed' state. This typically requires a Green JNSAR trigger and the stock's 'Current Trend' (e.g., R5 from external data, currently placeholder) to be 'R' (Rising).</p>
                    </TooltipContent>
                  </Tooltip>
                </CardHeader><CardContent>{overviewData?.confirmedLongs ?? '-'}</CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center gap-1 cursor-help">
                        <CardTitle className="text-md">Confirmed Shorts</CardTitle><Info size={14} className="text-muted-foreground" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <p>Stocks ending the period in a 'Short Confirmed' state. This typically requires a Red JNSAR trigger and the stock's 'Current Trend' (e.g., R5 from external data, currently placeholder) to be 'D' (Declining).</p>
                    </TooltipContent>
                  </Tooltip>
                </CardHeader><CardContent>{overviewData?.confirmedShorts ?? '-'}</CardContent>
              </Card>
            </div>

            {/* Trend Summary Table */}
            <h3 className="text-lg font-semibold mb-4">Trend Summary ({selectedDateRange})</h3>
            <Table>
              <TableCaption>Summary of stock counts by trend category for the selected period.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={2} className="text-center">Loading...</TableCell></TableRow>
                ) : trendSummaryData.length > 0 ? (
                  trendSummaryData.map((row) => (
                    <TableRow key={row.category}>
                      <TableCell>{row.category}</TableCell>
                      <TableCell>{row.count}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={2} className="text-center">No trend summary data available.</TableCell></TableRow>
                )}
                {/* Placeholder Rows */}
                {!loading && trendSummaryData.length === 0 && (
                  <>
                    <TableRow><TableCell>Long JN~ & R</TableCell><TableCell>-</TableCell></TableRow>
                    <TableRow><TableCell>Long JN~, R & Vol</TableCell><TableCell>-</TableCell></TableRow>
                    <TableRow><TableCell>Short JN~ & D</TableCell><TableCell>-</TableCell></TableRow>
                    <TableRow><TableCell>Short JN, D & Vol</TableCell><TableCell>-</TableCell></TableRow>
                    <TableRow><TableCell>Red Flips</TableCell><TableCell>-</TableCell></TableRow>
                    <TableRow><TableCell>Green Flips</TableCell><TableCell>-</TableCell></TableRow>
                  </>
                )}
              </TableBody>
            </Table>

            {/* Stock Trend Movement Summary Table */}
            <h3 className="text-lg font-semibold my-4">Stock Trend Movement ({selectedDateRange})</h3>
            <Table>
              <TableCaption>Detailed view of individual stock trend changes.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Stock Name</TableHead>
                  <TableHead>Current Signal</TableHead>
                  <TableHead>Sector</TableHead>
                  <TableHead>Previous Signal</TableHead>
                  <TableHead>Change</TableHead>
                  <TableHead>Days in Current Signal</TableHead>
                  <TableHead>Validation (L5)</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
              {loading ? (
                  <TableRow><TableCell colSpan={8} className="text-center">Loading...</TableCell></TableRow>
                ) : filteredStockTrendMovementData.length > 0 ? (
                  filteredStockTrendMovementData.map((row) => ( // Use filtered data
                    <TableRow key={row.stockName}>
                      <TableCell>{row.stockName}</TableCell>
                      <TableCell>
                        {row.currentSignal ? (
                          <span className={cn(
                            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                            {'bg-green-100 text-green-800': row.currentSignal.includes('Long Confirmed')},
                            {'bg-red-100 text-red-800': row.currentSignal.includes('Short Confirmed')},
                            {'bg-yellow-100 text-yellow-800': row.currentSignal.includes('Flip')},
                            {'bg-blue-100 text-blue-800': row.currentSignal.includes('Long JN~') && !row.currentSignal.includes('Confirmed')},
                            {'bg-pink-100 text-pink-800': row.currentSignal.includes('Short JN~') && !row.currentSignal.includes('Confirmed')},
                            {'bg-gray-100 text-gray-800': !row.currentSignal.includes('Long') && !row.currentSignal.includes('Short') && !row.currentSignal.includes('Flip')}
                          )}>
                            {row.currentSignal}
                          </span>
                        ) : '-'}
                      </TableCell>
                      <TableCell>{row.sector ?? '-'}</TableCell> {/* Display sector */}
                      <TableCell>{row.previousSignal ?? '-'}</TableCell>
                      <TableCell className="flex items-center">
                        {row.changeType === 'Entry' && (row.currentSignal?.includes('Long') ? '⬆️ ' : '⬇️ ')}
                        {row.changeType === 'Change' && (row.currentSignal?.includes('Long') ? '↗️ ' : (row.currentSignal?.includes('Short') ? '↘️ ' : ''))}
                        {row.changeType === 'Exit' && '↔️ '} {/* Neutral icon for exit */}
                        {row.change ?? '-'}
                      </TableCell>
                      <TableCell>
                          {row.daysInCurrentSignal !== null ? (
                              <span className={cn(
                                  {'font-semibold text-green-600': row.daysInCurrentSignal > 5 && row.currentSignal?.includes('Long')},
                                  {'font-semibold text-red-600': row.daysInCurrentSignal > 5 && row.currentSignal?.includes('Short')}
                              )}>
                                  {row.daysInCurrentSignal}
                              </span>
                          ) : '-'}
                      </TableCell>
                      <TableCell>{row.validation === true ? <span className="text-green-600 font-semibold">Yes</span> : row.validation === false ? <span className="text-red-600">No</span> : '-'}</TableCell>
                      <TableCell>{row.notes ?? '-'}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={8} className="text-center">No stock trend movement data available or matching filters.</TableCell></TableRow>
                )}
                {/* Placeholder Row */}
                  {!loading && stockTrendMovementData.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No data matching the selected filters.</TableCell></TableRow>
                  )}
              </TableBody>
            </Table>

          </CardContent>
        </Card>
      </main>
    </TooltipProvider>
  );
}

