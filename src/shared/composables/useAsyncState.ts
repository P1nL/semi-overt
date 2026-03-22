import { computed, ref } from 'vue'

export interface UseAsyncStateOptions<T> {
    initialData?: T | null
    immediate?: boolean
    onError?: (error: unknown) => void
}

export function useAsyncState<TData, TArgs extends unknown[]>(
    handler: (...args: TArgs) => Promise<TData>,
    options: UseAsyncStateOptions<TData> = {},
) {
    const data = ref<TData | null>(options.initialData ?? null)
    const loading = ref(false)
    const initialized = ref(false)
    const error = ref<unknown>(null)

    const hasData = computed(() => data.value !== null)
    const isEmpty = computed(() => initialized.value && !loading.value && data.value == null)

    async function execute(...args: TArgs): Promise<TData> {
        loading.value = true
        error.value = null

        try {
            const result = await handler(...args)
            data.value = result
            initialized.value = true
            return result
        } catch (err) {
            error.value = err
            initialized.value = true
            options.onError?.(err)
            throw err
        } finally {
            loading.value = false
        }
    }

    function setData(next: TData | null): void {
        data.value = next
        initialized.value = true
    }

    function reset(): void {
        data.value = options.initialData ?? null
        error.value = null
        loading.value = false
        initialized.value = false
    }

    if (options.immediate) {
        void execute(...([] as unknown as TArgs))
    }

    return {
        data,
        loading,
        error,
        initialized,
        hasData,
        isEmpty,
        execute,
        setData,
        reset,
    }
}