export const UI_THEME = {
    LIGHT: 'light',
    DARK: 'dark',
} as const

export type UITheme = (typeof UI_THEME)[keyof typeof UI_THEME]

export const UI_TOAST_TYPE = {
    SUCCESS: 'success',
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info',
} as const

export type UIToastType = (typeof UI_TOAST_TYPE)[keyof typeof UI_TOAST_TYPE]

export const UI_TOAST_DURATION = {
    DEFAULT: 3000,
    ERROR: 5000,
} as const

export const UI_MODAL_ANIMATION = {
    SLIDE_UP: 'slide-up',
    FADE: 'fade',
} as const

export const UI_DRAWER_TYPE = {
    DETAIL: 'detail',
    EDITOR: 'editor',
    REVIEW: 'review',
} as const

export type UIDrawerType = (typeof UI_DRAWER_TYPE)[keyof typeof UI_DRAWER_TYPE]

export const UI_TIMING = {
    MICRO: 150,
    SMALL: 200,
    POPOVER: 250,
    DRAWER_ENTER: 400,
    DRAWER_LEAVE: 350,
    DIALOG_ENTER: 500,
    SKELETON_MIN: 300,
    DELETE_CONFIRM: 2000,
} as const

export const UI_PAGINATION = {
    DEFAULT_PAGE: 1,
    DEFAULT_PAGE_SIZE: 10,
    PAGE_SIZE_OPTIONS: [10, 20, 50] as const,
} as const