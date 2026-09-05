import { computed, ref } from 'vue'
import { UI_TOAST_DURATION, UI_TOAST_TYPE, type UIToastType } from '@/shared/constants/ui'

export interface ToastItem {
    id: number
    type: UIToastType
    title?: string
    message: string
    duration: number
    createdAt: number
}

export interface ShowToastOptions {
    title?: string
    duration?: number
}

let toastSeed = 0
const globalToasts = ref<ToastItem[]>([])

export function useToast() {
    const toasts = globalToasts

    function remove(id: number): void {
        toasts.value = toasts.value.filter((item) => item.id !== id)

    }

    function show(type: UIToastType, message: string, options: ShowToastOptions = {}): number {
        const id = ++toastSeed
        const duration =
            options.duration ??
            (type === UI_TOAST_TYPE.ERROR ? UI_TOAST_DURATION.ERROR : UI_TOAST_DURATION.DEFAULT)

        const item: ToastItem = {
            id,
            type,
            title: options.title,
            message,
            duration,
            createdAt: Date.now(),
        }

        // The host owns expiry so pointer/focus interaction can pause it.
        toasts.value = [item, ...toasts.value].slice(0, 3)

        return id
    }

    function error(message: string, options?: ShowToastOptions): number {
        return show(UI_TOAST_TYPE.ERROR, message, options)
    }

    function clear(): void {
        toasts.value = []
    }

    const count = computed(() => toasts.value.length)

    return {
        toasts,
        count,
        error,
        remove,
        clear,
    }
}
