import type { AxiosRequestConfig, AxiosResponse } from 'axios'
import http from './http'
import { unwrapApiResponse } from './response'
import type { ApiResponse, RequestConfig } from '../types/api'

type RequestParams = object
type RequestData = unknown
const SKIP_AUTH_CONFIG_KEY = '__skipAuth'
const SKIP_REFRESH_CONFIG_KEY = '__skipAuthRefresh'
const ERROR_POLICY_CONFIG_KEY = '__errorPolicy'

type InternalRequestConfig = AxiosRequestConfig & {
    [SKIP_AUTH_CONFIG_KEY]?: boolean
    [SKIP_REFRESH_CONFIG_KEY]?: boolean
    [ERROR_POLICY_CONFIG_KEY]?: RequestConfig['errorPolicy']
}

function mergeConfig(config?: RequestConfig): InternalRequestConfig {
    const axiosConfig: InternalRequestConfig = {
        signal: config?.signal,
        timeout: config?.timeout,
        headers: {
            ...(config?.headers ?? {}),
        },
        [ERROR_POLICY_CONFIG_KEY]: config?.errorPolicy ?? 'auth',
    }

    if (config?.withAuth === false) {
        delete (axiosConfig.headers as Record<string, unknown>).Authorization
        axiosConfig[SKIP_AUTH_CONFIG_KEY] = true
        axiosConfig[SKIP_REFRESH_CONFIG_KEY] = true
    }

    if (config?.skipAuthRefresh) {
        axiosConfig[SKIP_REFRESH_CONFIG_KEY] = true
    }

    return axiosConfig
}

async function requestAndUnwrap<T>(
    promise: Promise<AxiosResponse<ApiResponse<T>>>,
    config?: RequestConfig,
): Promise<T> {
    const response = await promise
    return await unwrapApiResponse<T>(response.data, {
        errorPolicy: config?.errorPolicy ?? 'auth',
    })
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
        config,
    )
}

export async function post<T>(
    url: string,
    data?: RequestData,
    config?: RequestConfig,
): Promise<T> {
    return requestAndUnwrap<T>(
        http.post<ApiResponse<T>>(url, data, mergeConfig(config)),
        config,
    )
}

export async function put<T>(
    url: string,
    data?: RequestData,
    config?: RequestConfig,
): Promise<T> {
    return requestAndUnwrap<T>(
        http.put<ApiResponse<T>>(url, data, mergeConfig(config)),
        config,
    )
}

export async function patch<T>(
    url: string,
    data?: RequestData,
    config?: RequestConfig,
): Promise<T> {
    return requestAndUnwrap<T>(
        http.patch<ApiResponse<T>>(url, data, mergeConfig(config)),
        config,
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
        config,
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
        }),
        config,
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
