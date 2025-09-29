import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { showToast, showLoadingToast, closeToast } from 'vant';
import { useAuthStore } from '@/stores/auth';
import router from '@/router';
import { apiCache, userCache } from '@/utils/cache';
import { offlineManager } from '@/utils/offlineManager';
import type { ApiResponse } from '@/types/api';

// 创建axios实例
const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
import type { InternalAxiosRequestConfig } from 'axios';

request.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const authStore = useAuthStore();
    
    // 添加认证头
    if (authStore.accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${authStore.accessToken}`;
    }

    // 处理离线状态（非GET：入队并由自定义 adapter 直接返回成功响应）
    if (!navigator.onLine && (config.method || 'get').toLowerCase() !== 'get') {
      await offlineManager.addToOfflineQueue(
        config.url || '',
        (config.method?.toUpperCase() || 'GET'),
        config.data,
        config.headers
      );
      showToast('已离线保存，将在网络恢复后自动同步');
      // 使用自定义 adapter 返回离线成功响应
      config.adapter = async (cfg) => ({
        data: { success: true, message: '已离线保存' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: cfg as any,
      } as AxiosResponse<ApiResponse>);
      return config;
    }

    // 处理缓存（GET）：命中缓存则由自定义 adapter 直接返回
    if ((config.method || 'get').toLowerCase() === 'get' && config.useCache) {
      const cacheKey = generateCacheKey(config);
      let cachedData = getCacheForRequest(config, cacheKey);
      
      // 如果没有缓存，尝试从离线存储获取
      if (!cachedData && !navigator.onLine) {
        cachedData = await offlineManager.getCachedData(cacheKey);
      }
      
      if (cachedData) {
        config.fromCache = true;
        config.adapter = async (cfg) => ({
          data: cachedData,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: cfg as any,
        } as AxiosResponse<ApiResponse>);
        return config;
      }

      // 设置条件请求头
      const etag = apiCache.getETag(cacheKey);
      const lastModified = apiCache.getLastModified(cacheKey);
      
      if (etag && config.headers) {
        (config.headers as any)['If-None-Match'] = etag;
      }
      if (lastModified && config.headers) {
        (config.headers as any)['If-Modified-Since'] = lastModified;
      }
    }

    // 显示加载提示（排除静默请求与缓存命中）
    if (!config.silent && !config.fromCache) {
      showLoadingToast({
        message: '加载中...',
        forbidClick: true,
        duration: 0,
      });
    }

    return config;
  },
  (error) => {
    closeToast();
    return Promise.reject(error);
  }
);

// 响应拦截器
request.interceptors.response.use(
  async (response: AxiosResponse<ApiResponse>) => {
    closeToast();
    
    const { data, config, status, headers } = response;    
    // 处理304 Not Modified
    if (status === 304 && config.useCache) {
      const cacheKey = generateCacheKey(config);
      const cachedData = getCacheForRequest(config, cacheKey);
      if (cachedData) {
        response.data = cachedData;
        return response;
      }
    }
    
    // 缓存GET请求的成功响应
    if (config.method === 'get' && config.useCache && data.success) {
      const cacheKey = generateCacheKey(config);
      const cacheOptions = {
        ttl: config.cacheTTL || 5 * 60 * 1000, // 默认5分钟
        persistent: config.persistentCache || false,
        etag: headers['etag'],
        lastModified: headers['last-modified']
      };
      
      setCacheForRequest(config, cacheKey, data, cacheOptions);
      
      // 同时存储到离线缓存
      await offlineManager.cacheData(cacheKey, data, cacheOptions.ttl);
    }
    
    // API返回成功
    if (data.success) {
      return response;
    }
    
    // API返回失败
    showToast({
      type: 'fail',
      message: data.message || '操作失败',
    });
    
    return Promise.reject(new Error(data.message || '操作失败'));
  },
  async (error) => {
    closeToast();
    
    const { response, config } = error;
    const authStore = useAuthStore();
    
    // 处理HTTP状态错误
    if (response) {
      const { status, data } = response;
      
      switch (status) {
        case 401:
          // 未授权，尝试刷新token
          if (authStore.refreshToken && !config._retry) {
            config._retry = true;
            
            try {
              await authStore.refreshAccessToken();
              // 重试原请求
              config.headers.Authorization = `Bearer ${authStore.accessToken}`;
              return request(config);
            } catch (refreshError) {
              // 刷新失败，清除认证信息并跳转登录
              authStore.clearAuth();
              router.push('/login');
              showToast({
                type: 'fail',
                message: '登录已过期，请重新登录',
              });
            }
          } else {
            authStore.clearAuth();
            router.push('/login');
            showToast({
              type: 'fail',
              message: data?.message || '未授权访问',
            });
          }
          break;
          
        case 403:
          showToast({
            type: 'fail',
            message: data?.message || '权限不足',
          });
          break;
          
        case 404:
          showToast({
            type: 'fail',
            message: data?.message || '资源不存在',
          });
          break;
          
        case 429:
          showToast({
            type: 'fail',
            message: data?.message || '请求过于频繁',
          });
          break;
          
        case 500:
          showToast({
            type: 'fail',
            message: data?.message || '服务器内部错误',
          });
          break;
          
        default:
          showToast({
            type: 'fail',
            message: data?.message || `请求失败 (${status})`,
          });
      }
    } else if (error.code === 'ECONNABORTED') {
      showToast({
        type: 'fail',
        message: '请求超时，请检查网络连接',
      });
    } else {
      showToast({
        type: 'fail',
        message: '网络错误，请检查网络连接',
      });
    }
    
    return Promise.reject(error);
  }
);// 请求配置接口扩展
declare module 'axios' {
  interface AxiosRequestConfig {
    silent?: boolean; // 静默请求，不显示loading
    _retry?: boolean; // 重试标识
    useCache?: boolean; // 启用缓存
    cacheTTL?: number; // 缓存时间
    persistentCache?: boolean; // 持久化缓存
    fromCache?: boolean; // 来自缓存
  }
}

// 缓存辅助函数
function generateCacheKey(config: AxiosRequestConfig): string {
  const { url, method, params, data } = config;
  const keyData = {
    url,
    method: method?.toLowerCase(),
    params,
    data: method?.toLowerCase() === 'get' ? undefined : data
  };
  return btoa(JSON.stringify(keyData));
}

function getCacheForRequest(config: AxiosRequestConfig, cacheKey: string) {
  // 用户相关接口使用用户缓存
  if (config.url?.includes('/auth/') || config.url?.includes('/profile')) {
    return userCache.get(cacheKey);
  }
  
  return apiCache.get(cacheKey);
}

function setCacheForRequest(
  config: AxiosRequestConfig, 
  cacheKey: string, 
  data: any, 
  options: any
) {
  // 用户相关接口使用用户缓存
  if (config.url?.includes('/auth/') || config.url?.includes('/profile')) {
    userCache.set(cacheKey, data, options);
    return;
  }
  
  apiCache.set(cacheKey, data, options);
}

// 封装常用请求方法
export const http = {
  get<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return request.get(url, config).then(res => res.data);
  },

  post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return request.post(url, data, config).then(res => res.data);
  },

  put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return request.put(url, data, config).then(res => res.data);
  },

  delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return request.delete(url, config).then(res => res.data);
  },

  // 静默请求（不显示loading）
  silentGet<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.get<T>(url, { ...config, silent: true });
  },

  silentPost<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.post<T>(url, data, { ...config, silent: true });
  },
};

export default request;