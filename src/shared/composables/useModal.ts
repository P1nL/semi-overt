import { computed, ref } from 'vue'

export interface UseModalOptions<TPayload = unknown> {
    initialOpen?: boolean
    initialPayload?: TPayload | null
}

export function useModal<TPayload = unknown>(options: UseModalOptions<TPayload> = {}) {
    const open = ref(Boolean(options.initialOpen))
    const payload = ref<TPayload | null>(options.initialPayload ?? null)

    function show(nextPayload?: TPayload | null): void {
        open.value = true
        if (arguments.length > 0) {
            payload.value = nextPayload ?? null
        }
    }

    function hide(): void {
        open.value = false
    }

    function toggle(): void {
        open.value = !open.value
    }

    function setPayload(nextPayload: TPayload | null): void {
        payload.value = nextPayload
    }

    function reset(): void {
        open.value = false
        payload.value = options.initialPayload ?? null
    }

    const visible = computed(() => open.value)

    return {
        open,
        visible,
        payload,
        show,
        hide,
        toggle,
        setPayload,
        reset,
    }
}