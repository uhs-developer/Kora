import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

// API Configuration
const envApiBaseUrl = import.meta.env.VITE_API_BASE_URL;

if (!envApiBaseUrl) {
  throw new Error('VITE_API_BASE_URL is not defined. Please configure it in your frontend .env file.');
}

const API_BASE_URL = envApiBaseUrl.replace(/\/+$/, '');

// Timeout configurations for different operations
const TIMEOUTS = {
  DEFAULT: 60000,     // 60 seconds for general requests
  SEARCH: 45000,      // 45 seconds for search operations
  UPLOAD: 120000,     // 2 minutes for file uploads
  AUTH: 30000,        // 30 seconds for auth operations
};

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: TIMEOUTS.DEFAULT, // 60 seconds default timeout
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('rwanda-dubai-token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('rwanda-dubai-token');
      localStorage.removeItem('rwanda-dubai-user');
      window.location.href = '/auth';
    }
    return Promise.reject(error);
  }
);

export default apiClient;

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
}

export interface ApiError {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
}

// Helper function to determine timeout based on endpoint
const getTimeoutForEndpoint = (endpoint: string): number => {
  if (endpoint.includes('/search') || endpoint.includes('?search=')) {
    return TIMEOUTS.SEARCH;
  }
  if (endpoint.includes('/auth') || endpoint.includes('/login') || endpoint.includes('/register')) {
    return TIMEOUTS.AUTH;
  }
  if (endpoint.includes('/upload') || endpoint.includes('/images')) {
    return TIMEOUTS.UPLOAD;
  }
  return TIMEOUTS.DEFAULT;
};

// Generic API request handler with retry logic
export const apiRequest = async <T = any>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  data?: any,
  config?: AxiosRequestConfig,
  retries: number = 2
): Promise<ApiResponse<T>> => {
  const timeout = getTimeoutForEndpoint(endpoint);
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await apiClient.request({
        method,
        url: endpoint,
        data,
        timeout,
        ...config,
      });
      return response.data;
    } catch (error: any) {
      // If this is the last attempt, throw the error
      if (attempt === retries) {
        if (error.response?.data) {
          throw error.response.data;
        }
        
        // Handle timeout errors specifically
        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
          throw {
            success: false,
            message: 'Request timed out. The server is taking longer than expected to respond. Please try again.',
            error: 'TIMEOUT_ERROR'
          };
        }
        
        // Handle network errors
        if (error.code === 'NETWORK_ERROR' || !error.response) {
          throw {
            success: false,
            message: 'Network error. Please check your internet connection and try again.',
            error: 'NETWORK_ERROR'
          };
        }
        
        throw {
          success: false,
          message: error.message || 'An unexpected error occurred. Please try again.',
          error: 'UNKNOWN_ERROR'
        };
      }
      
      // Wait before retrying (exponential backoff)
      const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s...
      await new Promise(resolve => setTimeout(resolve, delay));
      
      console.log(`API request failed, retrying... (attempt ${attempt + 1}/${retries + 1})`);
    }
  }
  
  // This should never be reached, but TypeScript requires it
  throw new Error('Unexpected error in apiRequest');
};
