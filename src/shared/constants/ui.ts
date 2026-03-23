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
