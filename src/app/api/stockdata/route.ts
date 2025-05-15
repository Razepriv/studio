import { NextResponse, type NextRequest } from 'next/server';
import yahooFinance from 'yahoo-finance2';
import { format, subDays } from 'date-fns';
import type { StockData } from '@/services/stock-data'; // Assuming StockData lives here

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const ticker = searchParams.get('ticker');
  const daysParam = searchParams.get('days');
  const endDateParam = searchParams.get('endDate');

  if (!ticker) {
    return NextResponse.json({ message: 'Ticker symbol is required' }, { status: 400 });
  }

  const days = daysParam ? parseInt(daysParam, 10) : 60;
  if (isNaN(days) || days <= 0) {
    return NextResponse.json({ message: 'Invalid number of days' }, { status: 400 });
  }

  let period2: Date;
  if (endDateParam) {
    period2 = new Date(endDateParam);
  } else {
    period2 = new Date(); // Default to today if no endDate is provided
  }

  // Append .NS for NSE stocks if not already present and looks like an Indian ticker
  // Basic heuristic, might need refinement based on actual ticker patterns
  let finalTicker = ticker;
    if (!ticker.includes('.') && /^[A-Z&]+$/.test(ticker) && ticker.length > 2 && ticker !== 'SPY' && ticker !== 'QQQ') { // Avoid adding .NS to US indices/ETFs
       console.log(`Appending .NS to ticker: ${ticker}`);
       finalTicker = `${ticker}.NS`;
   } else {
       console.log(`Using ticker as is: ${ticker}`);
   }

  const period1 = subDays(period2, days);

  try {
    const queryOptions = {
        period1: format(period1, 'yyyy-MM-dd'),
        period2: format(period2, 'yyyy-MM-dd'),
        interval: '1d' as const, // Ensure interval is '1d'
      };

    console.log(`Fetching data for ${finalTicker} with options:`, queryOptions);
    const results = await yahooFinance.historical(finalTicker, queryOptions);

    // Fetch quote summary to get sector information
    let quoteSummary;
    let sector: string | null = null;
    try {
      quoteSummary = await yahooFinance.quoteSummary(finalTicker, {
        modules: ['summaryProfile'], // Request the summaryProfile module
      });
      sector = quoteSummary?.summaryProfile?.sector || null;
    } catch (qsError: any) {
      console.warn(`Could not fetch quote summary for ${finalTicker}: ${qsError.message}`);
      // Continue without sector data if fetching quote summary fails
    }

    // Map results to StockData interface
    const formattedData: StockData[] = results.map(result => ({
      date: format(new Date(result.date), 'yyyy-MM-dd'), // Ensure date is in 'yyyy-MM-dd' string format
      ...result, // Include all properties from the historical result
      sector: sector, // Add the fetched sector
      // adjClose: result.adjClose // Include if needed
    })).filter(d => d.open && d.high && d.low && d.close && d.volume); // Filter out entries with null essential data

    if (formattedData.length === 0) {
        console.warn(`No data returned from Yahoo Finance for ${finalTicker}`);
        // Return empty array, let frontend handle 'No data' state
    }

    return NextResponse.json(formattedData);

  } catch (error: any) {
    console.error(`Yahoo Finance API Error for ${finalTicker}:`, error.message || error);
     let errorMessage = `Failed to fetch data for ${ticker}.`;
     if (error.message && error.message.includes('404 Not Found')) {
        errorMessage = `Ticker symbol '${ticker}' not found or invalid on Yahoo Finance. Try adding '.NS' for NSE stocks.`;
     } else if (error.message) {
        errorMessage += ` Details: ${error.message}`;
     }
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
