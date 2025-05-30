import { format } from 'date-fns';

/**
 * Represents raw stock data for a single day or period (e.g., week), including the date.
 */
export interface StockData {
  /**
   * The date of the stock data point (YYYY-MM-DD). For weekly, typically the Monday of the week.
   */
  date: string;
  /**
   * The opening price of the stock for the period.
   */
  open: number;
  /**
   * The highest price of the stock for the period.
   */
  high: number;
  /**
   * The lowest price of the stock for the period.
   */
  low: number;
  /**
   * The closing price of the stock for the period.
   */
  close: number;
  /**
   * The trading volume of the stock for the period.
   */
  volume: number;
  /**
 * The sector the stock belongs to (optional).
 */
  sector?: string | null;
}


/**
 * Asynchronously retrieves historical stock data for a given stock ticker symbol
 * by calling the internal API route `/api/stockdata`.
 *
 * @param ticker The stock ticker symbol (e.g., 'AAPL', 'ABCAPITAL.NS').
 * @param periods The number of historical periods (days, weeks, months based on interval) to fetch. Defaults to 60.
 * @param endDate Optional end date in 'yyyy-MM-dd' format. If provided, data will be fetched up to this date.
 * @param interval Optional data interval ('1d', '1wk', '1mo'). Defaults to '1d'.
 * @returns A promise that resolves to an array of StockData objects.
 * @throws Throws an error if the API call fails or returns an error status.
 */
export async function getStockData(ticker: string, periods: number = 60, endDate?: string, interval: '1d' | '1wk' | '1mo' = '1d'): Promise<StockData[]> {
  console.log(`Fetching stock data for: ${ticker} via API route with interval ${interval}`);

  const params = new URLSearchParams({
    ticker: ticker,
    days: periods.toString(), // 'days' param in API now means 'periods'
    interval: interval,
  });
  if (endDate) {
    params.append('endDate', endDate);
  }

  try {
    const apiUrl = `/api/stockdata?${params.toString()}`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`API Error (${response.status}): ${errorData.message || 'Failed to fetch stock data'}`);
    }

    const data: StockData[] = await response.json();
    return data;

  } catch (error) {
    console.error(`Error fetching data for ${ticker} from API route (interval: ${interval}):`, error);
    if (error instanceof Error) {
        throw error;
    } else {
        throw new Error('An unknown error occurred while fetching stock data.');
    }
  }
}
