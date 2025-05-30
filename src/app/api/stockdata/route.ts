
import { NextResponse, type NextRequest } from 'next/server';
import yahooFinance from 'yahoo-finance2';
import { format, subDays } from 'date-fns';
import type { StockData } from '@/services/stock-data'; // Assuming StockData lives here

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const ticker = searchParams.get('ticker');
  const daysParam = searchParams.get('days');
  const endDateParam = searchParams.get('endDate');
  const intervalParam = searchParams.get('interval'); // New interval parameter

  if (!ticker) {
    return NextResponse.json({ message: 'Ticker symbol is required' }, { status: 400 });
  }

  const days = daysParam ? parseInt(daysParam, 10) : 60;
  if (isNaN(days) || days <= 0) {
    return NextResponse.json({ message: 'Invalid number of days/periods' }, { status: 400 });
  }

  let period2: Date;
  if (endDateParam) {
    period2 = new Date(endDateParam);
  } else {
    period2 = new Date(); // Default to today if no endDate is provided
  }

  // Append .NS for NSE stocks if not already present and looks like an Indian ticker
  let finalTicker = ticker;
    // Updated regex to include hyphens and ampersands, and be case-insensitive for the test part.
    if (!ticker.includes('.') && /^[A-Z0-9\-&]+$/i.test(ticker) && ticker.length > 2 && ticker !== 'SPY' && ticker !== 'QQQ') {
       console.log(`Appending .NS to ticker: ${ticker}`);
       finalTicker = `${ticker}.NS`;
   } else {
       console.log(`Using ticker as is: ${ticker}`);
   }

  // Adjust period1 calculation based on interval
  // For daily, days is days. For weekly, days is weeks.
  // Yahoo finance `historical` uses period1 and period2 to define the range.
  // The `days` parameter is more of a "count of periods" if we fetch backward.
  // For simplicity, we'll keep `subDays` for now; `yahooFinance` will fetch appropriate points within the date range for the interval.
  // If fetching `X` number of weekly points ending `period2`, `period1` should be `period2 - X weeks`.
  // This API currently uses `days` as an approximate lookback period rather than a strict count.
  let period1: Date;
  if (intervalParam === '1wk') {
    period1 = subDays(period2, days * 7); // Approximate X weeks back
  } else {
    period1 = subDays(period2, days); // Approximate X days back
  }


  const validIntervals = ['1d', '1wk', '1mo'];
  const interval = (intervalParam && validIntervals.includes(intervalParam)) ? intervalParam as '1d' | '1wk' | '1mo' : '1d';

  try {
    const queryOptions = {
        period1: format(period1, 'yyyy-MM-dd'),
        period2: format(period2, 'yyyy-MM-dd'),
        interval: interval,
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
    })).filter(d => d.open && d.high && d.low && d.close && d.volume); // Filter out entries with null essential data

    if (formattedData.length === 0) {
        console.warn(`No data returned from Yahoo Finance for ${finalTicker} with interval ${interval}`);
    }

    const headers = new Headers();
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    headers.set('Pragma', 'no-cache');
    headers.set('Expires', '0');

    return NextResponse.json(formattedData, { headers });

  } catch (error: any) {
    console.error(`Yahoo Finance API Error for ${finalTicker} (interval: ${interval}):`, error.message || error);
     let errorMessage = `Failed to fetch data for ${ticker}.`;
     if (error.message && (error.message.includes('404 Not Found') || error.message.toLowerCase().includes('no data found'))) {
        errorMessage = `Ticker symbol '${ticker}' (tried as '${finalTicker}') not found or no data available on Yahoo Finance for interval ${interval}. It might be delisted or the symbol is incorrect.`;
     } else if (error.message) {
        errorMessage += ` Details: ${error.message}`;
     }
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
