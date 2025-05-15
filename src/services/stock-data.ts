import { format } from 'date-fns';

/**
 * Represents raw stock data for a single day, including the date.
 */
export interface StockData {
  /**
   * The date of the stock data point (YYYY-MM-DD).
   */
  date: string;
  /**
   * The opening price of the stock.
   */
  open: number;
  /**
   * The highest price of the stock.
   */
  high: number;
  /**
   * The lowest price of the stock.
   */
  low: number;
  /**
   * The closing price of the stock.
   */
  close: number;
  /**
   * The trading volume of the stock.
   */
  volume: number;
  /**
 * The sector the stock belongs to (optional).
 */
  sector?: string | null;
  // Add adj_close if required by calculations and available from the API
  // adj_close?: number;
}


/**
 * Asynchronously retrieves historical stock data for a given stock ticker symbol
 * by calling the internal API route `/api/stockdata`.
 *
 * @param ticker The stock ticker symbol (e.g., 'AAPL', 'ABCAPITAL.NS'). Ensure it includes the necessary suffix like '.NS' for NSE stocks if required by the API.
 * @param days The number of historical days to fetch. Defaults to 60.
 * @returns A promise that resolves to an array of StockData objects.
 * @param endDate Optional end date in 'yyyy-MM-dd' format. If provided, data will be fetched up to this date.
 * @throws Throws an error if the API call fails or returns an error status.
 */
export async function getStockData(ticker: string, days: number = 60, endDate?: string): Promise<StockData[]> {
  console.log(`Fetching stock data for: ${ticker} via API route`);

  const params = new URLSearchParams({
    ticker: ticker,
    days: days.toString(),
  });
  if (endDate) {
    params.append('endDate', endDate);
  }

  try {
    // Construct the full URL for the API route
    // In a real deployment, use environment variables for the base URL
    const apiUrl = `/api/stockdata?${params.toString()}`;

    const response = await fetch(apiUrl);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`API Error (${response.status}): ${errorData.message || 'Failed to fetch stock data'}`);
    }

    const data: StockData[] = await response.json();

    // Optional: Ensure date is formatted correctly if needed, though API should return ISO string
    // return data.map(d => ({
    //     ...d,
    //     date: format(new Date(d.date), 'yyyy-MM-dd') // Assuming API returns valid date string/timestamp
    // }));
     return data; // Assuming API returns dates as 'yyyy-MM-dd' strings

  } catch (error) {
    console.error(`Error fetching data for ${ticker} from API route:`, error);
    // Re-throw the error to be handled by the calling component (e.g., display an error message)
    if (error instanceof Error) {
        throw error;
    } else {
        throw new Error('An unknown error occurred while fetching stock data.');
    }
  }
}
