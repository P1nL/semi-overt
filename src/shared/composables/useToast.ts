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
const globalTimers = new Map<number, number>()

export function useToast() {
    const toasts = globalToasts
    const timers = globalTimers

    function remove(id: number): void {
        toasts.value = toasts.value.filter((item) => item.id !== id)

        const timer = timers.get(id)
        if (timer) {
            window.clearTimeout(timer)
            timers.delete(id)
        }
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

        toasts.value = [item, ...toasts.value]

        if (duration > 0 && typeof window !== 'undefined') {
            const timer = window.setTimeout(() => remove(id), duration)
            timers.set(id, timer)
        }

        return id
    }

    function success(message: string, options?: ShowToastOptions): number {
        return show(UI_TOAST_TYPE.SUCCESS, message, options)
    }

    function error(message: string, options?: ShowToastOptions): number {
        return show(UI_TOAST_TYPE.ERROR, message, options)
    }

    function warning(message: string, options?: ShowToastOptions): number {
        return show(UI_TOAST_TYPE.WARNING, message, options)
    }

    function info(message: string, options?: ShowToastOptions): number {
        return show(UI_TOAST_TYPE.INFO, message, options)
    }

    function clear(): void {
        Array.from(timers.keys()).forEach(remove)
        toasts.value = []
    }

    const count = computed(() => toasts.value.length)

    return {
        toasts,
        count,
        show,
        success,
        error,
        warning,
        info,
        remove,
        clear,
    }
}
