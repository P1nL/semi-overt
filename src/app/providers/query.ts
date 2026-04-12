import { VueQueryPlugin } from '@tanstack/vue-query'
import type { App } from 'vue'
import { queryClient } from '@/shared/lib/queryClient'

export function setupQueryClient(app: App): void {
    app.use(VueQueryPlugin, {
        queryClient,
    })
}
