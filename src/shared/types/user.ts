export type UserRole = 'USER' | 'ADMIN'

export interface AuthResp {
    token: string
    userId: number
    username: string
    nickname: string
    avatarUrl: string | null
    role: UserRole
}

export interface UserProfileResp {
    profile: {
        userId: number
        username: string
        nickname: string
        avatarUrl: string | null
        coverUrl: string | null
        signature: string | null
    }
    stats: {
        approvedCount: number
        totalWordCount: number
    }
}