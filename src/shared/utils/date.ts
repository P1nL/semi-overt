function toDate(value?: string | number | Date | null): Date | null {
    if (value == null) return null
    const date = value instanceof Date ? value : new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
}

export function formatDateTime(
    value?: string | number | Date | null,
    locale = 'zh-CN',
): string {
    const date = toDate(value)
    if (!date) return '-'

    return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date)
}

export function formatDate(value?: string | number | Date | null, locale = 'zh-CN'): string {
    const date = toDate(value)
    if (!date) return '-'

    return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date)
}

export function formatRelativeTime(
    value?: string | number | Date | null,
    locale = 'zh-CN',
): string {
    const date = toDate(value)
    if (!date) return '-'

    const diff = date.getTime() - Date.now()
    const abs = Math.abs(diff)

    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

    const minute = 60 * 1000
    const hour = 60 * minute
    const day = 24 * hour

    if (abs < minute) return '刚刚'
    if (abs < hour) return rtf.format(Math.round(diff / minute), 'minute')
    if (abs < day) return rtf.format(Math.round(diff / hour), 'hour')
    if (abs < 30 * day) return rtf.format(Math.round(diff / day), 'day')

    return formatDate(date, locale)
}

export function isSameDay(
    left?: string | number | Date | null,
    right?: string | number | Date | null,
): boolean {
    const leftDate = toDate(left)
    const rightDate = toDate(right)

    if (!leftDate || !rightDate) return false

    return (
        leftDate.getFullYear() === rightDate.getFullYear() &&
        leftDate.getMonth() === rightDate.getMonth() &&
        leftDate.getDate() === rightDate.getDate()
    )
}