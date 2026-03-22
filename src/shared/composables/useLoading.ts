import { computed, ref } from 'vue'

export function useLoading(initial = false) {
    const loading = ref(initial)

    async function withLoading<T>(task: () => Promise<T>): Promise<T> {
        loading.value = true

        try {
            return await task()
        } finally {
            loading.value = false
        }
    }

    function start(): void {
        loading.value = true
    }

    function stop(): void {
        loading.value = false
    }

    function toggle(next?: boolean): void {
        loading.value = typeof next === 'boolean' ? next : !loading.value
    }

    const idle = computed(() => !loading.value)

    return {
        loading,
        idle,
        start,
        stop,
        toggle,
        withLoading,
    }
}