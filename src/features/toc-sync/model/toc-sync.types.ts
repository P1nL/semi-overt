export interface TocHeading {
    id: string
    text: string
    level: number
}

export interface TocParseOptions {
    levels?: number[]
}

export interface TocSyncOptions {
    headings?: TocHeading[]
    selector?: string
    offset?: number
    rootMargin?: string
    getScrollContainer?: () => HTMLElement | null
}
