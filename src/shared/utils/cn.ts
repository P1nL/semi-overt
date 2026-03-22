type ClassValue =
    | string
    | number
    | null
    | undefined
    | false
    | Record<string, boolean | null | undefined>
    | ClassValue[]

function flatten(input: ClassValue, bucket: string[]): void {
    if (!input) return

    if (typeof input === 'string' || typeof input === 'number') {
        bucket.push(String(input))
        return
    }

    if (Array.isArray(input)) {
        input.forEach((item) => flatten(item, bucket))
        return
    }

    Object.entries(input).forEach(([key, active]) => {
        if (active) {
            bucket.push(key)
        }
    })
}

export function cn(...values: ClassValue[]): string {
    const bucket: string[] = []

    values.forEach((value) => flatten(value, bucket))

    return bucket.join(' ').trim().replace(/\s+/g, ' ')
}