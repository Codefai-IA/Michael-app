import { useEffect, useRef, useCallback, useState } from 'react';
import { useLocation } from 'react-router-dom';

interface UsePageDataOptions {
  userId: string | undefined;
  fetchData: () => Promise<void>;
  dependencies?: unknown[];
}

/**
 * Hook that handles data fetching with proper triggers:
 * - Fetches on mount AND on every navigation to the page
 * - Refetches when userId changes
 * - Refetches on page visibility change (app resume)
 * - Refetches on window focus (tab switch back)
 * - Shows loading skeleton only on initial load
 */
export function usePageData({ userId, fetchData, dependencies = [] }: UsePageDataOptions) {
  const location = useLocation();
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const isMountedRef = useRef(false);
  const lastFetchTimeRef = useRef<number>(0);
  const isFetchingRef = useRef(false);

  // Minimum time between refetches to avoid excessive calls (2 seconds)
  const MIN_REFETCH_INTERVAL = 2000;

  const handleFetch = useCallback(async (isInitial = false) => {
    if (!userId) {
      setIsInitialLoading(false);
      return;
    }

    // Prevent duplicate concurrent fetches
    if (isFetchingRef.current) return;

    const now = Date.now();
    // Skip if we fetched recently (unless it's initial load)
    if (!isInitial && now - lastFetchTimeRef.current < MIN_REFETCH_INTERVAL) {
      return;
    }

    isFetchingRef.current = true;
    lastFetchTimeRef.current = now;

    // Only show loading on initial fetch (when page first loads)
    if (!isMountedRef.current) {
      setIsInitialLoading(true);
    }

    try {
      await fetchData();
    } finally {
      isFetchingRef.current = false;
      if (!isMountedRef.current) {
        isMountedRef.current = true;
        setIsInitialLoading(false);
      }
    }
  }, [userId, fetchData]);

  // Fetch on mount, navigation, and when userId/dependencies change
  // Using location.key ensures refetch on every navigation to this page
  useEffect(() => {
    handleFetch(true);
  }, [handleFetch, location.key, ...dependencies]);

  // Refetch on page visibility change (when app comes back to foreground)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleFetch();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleFetch]);

  // Refetch on window focus (when user switches browser tabs)
  useEffect(() => {
    const handleFocus = () => {
      handleFetch();
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [handleFetch]);

  return {
    isInitialLoading,
    refetch: () => handleFetch(false),
  };
}
