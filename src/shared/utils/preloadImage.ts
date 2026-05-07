type ImageFetchPriority = 'high' | 'low' | 'auto'

const imagePreloadCache = new Map<string, Promise<void>>()

export function preloadImage(
    url: string | null | undefined,
    priority: ImageFetchPriority = 'auto',
): Promise<void> {
    const normalizedUrl = url?.trim()
    if (!normalizedUrl || typeof Image === 'undefined') {
        return Promise.resolve()
    }

    const cached = imagePreloadCache.get(normalizedUrl)
    if (cached) return cached

    const promise = new Promise<void>((resolve) => {
        const image = new Image()

        image.decoding = 'async'
        ;(image as HTMLImageElement & { fetchPriority?: ImageFetchPriority }).fetchPriority = priority
        image.onload = () => resolve()
        image.onerror = () => resolve()
        image.src = normalizedUrl

        if (image.complete) {
            resolve()
        }
    })

    imagePreloadCache.set(normalizedUrl, promise)
    return promise
}

export function preloadImages(
    urls: Array<string | null | undefined>,
    priority: ImageFetchPriority = 'auto',
) {
    return Promise.all(urls.map((url) => preloadImage(url, priority))).then(() => undefined)
}
