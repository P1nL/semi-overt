import { QueryClient } from '@tanstack/vue-query'
import { ApiBusinessError } from '@/shared/types/api'

function shouldRetryQuery(failureCount: number, error: unknown): boolean {
    if (failureCount >= 1) {
        return false
    }

    if (error instanceof ApiBusinessError) {
        return error.code >= 500
    }

    return true
}

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            retry: shouldRetryQuery,
            refetchOnWindowFocus: false,
        },
    },
})
