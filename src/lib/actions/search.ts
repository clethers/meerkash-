'use server';

import { globalSearch, type SearchResults } from '@/lib/data/search';

export async function searchEverything(query: string): Promise<SearchResults> {
  return globalSearch(query);
}
