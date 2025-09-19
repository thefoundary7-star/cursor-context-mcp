import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api'
import { UsageStats, UsageHistory } from '@/types'

export function useUsageStats(timeRange: string = '30d') {
  const {
    data: stats,
    isLoading,
    error,
  } = useQuery<UsageStats>({
    queryKey: ['usage-stats', timeRange],
    queryFn: () => apiClient.getUsageStats(timeRange),
    staleTime: 1 * 60 * 1000, // 1 minute
  })

  return {
    stats,
    isLoading,
    error,
  }
}

export function useUsageHistory(timeRange: string = '30d') {
  const {
    data: history,
    isLoading,
    error,
  } = useQuery<UsageHistory[]>({
    queryKey: ['usage-history', timeRange],
    queryFn: () => apiClient.getUsageHistory(timeRange),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  return {
    history,
    isLoading,
    error,
  }
}
