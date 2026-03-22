import type { AxiosRequestConfig, AxiosResponse } from 'axios'
import http from './http'
import { unwrapApiResponse } from './response'
import type { ApiResponse, RequestConfig } from '../types/api'

type RequestParams = object
type RequestData = unknown
const SKIP_AUTH_HEADER = 'X-Skip-Auth'

function mergeConfig(config?: RequestConfig): AxiosRequestConfig {
    const axiosConfig: AxiosRequestConfig = {
        signal: config?.signal,
        timeout: config?.timeout,
        headers: {
            ...(config?.headers ?? {}),
        },
    }

    if (config?.withAuth === false && axiosConfig.headers) {
        delete (axiosConfig.headers as Record<string, unknown>).Authorization
        ;(axiosConfig.headers as Record<string, unknown>)[SKIP_AUTH_HEADER] = '1'
    }

    return axiosConfig
}

async function requestAndUnwrap<T>(
    promise: Promise<AxiosResponse<ApiResponse<T>>>,
): Promise<T> {
    const response = await promise
    return await unwrapApiResponse<T>(response.data)
}

export async function get<T>(
    url: string,
    params?: RequestParams,
    config?: RequestConfig,
): Promise<T> {
    return requestAndUnwrap<T>(
        http.get<ApiResponse<T>>(url, {
            ...mergeConfig(config),
            params,
        }),
    )
}

export async function post<T>(
    url: string,
    data?: RequestData,
    config?: RequestConfig,
): Promise<T> {
    return requestAndUnwrap<T>(
        http.post<ApiResponse<T>>(url, data, mergeConfig(config)),
    )
}

export async function put<T>(
    url: string,
    data?: RequestData,
    config?: RequestConfig,
): Promise<T> {
    return requestAndUnwrap<T>(
        http.put<ApiResponse<T>>(url, data, mergeConfig(config)),
    )
}

export async function patch<T>(
    url: string,
    data?: RequestData,
    config?: RequestConfig,
): Promise<T> {
    return requestAndUnwrap<T>(
        http.patch<ApiResponse<T>>(url, data, mergeConfig(config)),
    )
}

export async function del<T>(
    url: string,
    config?: RequestConfig & { params?: RequestParams },
): Promise<T> {
    return requestAndUnwrap<T>(
        http.delete<ApiResponse<T>>(url, {
            ...mergeConfig(config),
            params: config?.params,
        }),
    )
}

export async function upload<T>(
    url: string,
    formData: FormData,
    config?: RequestConfig,
): Promise<T> {
    return requestAndUnwrap<T>(
        http.post<ApiResponse<T>>(url, formData, {
            ...mergeConfig(config),
            headers: {
                ...(config?.headers ?? {}),
                'Content-Type': 'multipart/form-data',
            },
        }),
    )
}

export const request = {
    get,
    post,
    put,
    patch,
    delete: del,
    upload,
}

export default request
