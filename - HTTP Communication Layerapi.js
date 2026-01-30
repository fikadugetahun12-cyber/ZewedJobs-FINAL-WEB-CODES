/**
 * API Service Module
 * Responsibilities:
 * - Manage HTTP requests
 * - Handle authentication
 * - Process responses
 * - Implement request/response interceptors
 */

class ApiService {
    constructor(config = {}) {
        this.baseURL = config.baseURL || '';
        this.defaultHeaders = {
            'Content-Type': 'application/json',
            ...config.headers
        };
        this.requestInterceptors = [];
        this.responseInterceptors = [];
    }

    // Request methods
    async get(endpoint, options = {}) {
        return this.request('GET', endpoint, null, options);
    }

    async post(endpoint, data, options = {}) {
        return this.request('POST', endpoint, data, options);
    }

    async put(endpoint, data, options = {}) {
        return this.request('PUT', endpoint, data, options);
    }

    async delete(endpoint, options = {}) {
        return this.request('DELETE', endpoint, null, options);
    }

    async request(method, endpoint, data = null, options = {}) {
        const url = this.baseURL + endpoint;
        const headers = { ...this.defaultHeaders, ...options.headers };
        
        // Prepare request config
        const config = {
            method,
            headers,
            credentials: 'include',
            ...options
        };

        if (data && (method === 'POST' || method === 'PUT')) {
            config.body = JSON.stringify(data);
        }

        try {
            // Apply request interceptors
            const interceptedConfig = this.applyRequestInterceptors(config);
            
            const response = await fetch(url, interceptedConfig);
            
            // Apply response interceptors
            const processedResponse = await this.applyResponseInterceptors(response);
            
            // Handle non-2xx responses
            if (!response.ok) {
                throw await this.handleError(response, processedResponse);
            }
            
            return processedResponse;
            
        } catch (error) {
            this.handleRequestError(error);
            throw error;
        }
    }

    // Interceptor management
    addRequestInterceptor(interceptor) {
        this.requestInterceptors.push(interceptor);
    }

    addResponseInterceptor(interceptor) {
        this.responseInterceptors.push(interceptor);
    }

    applyRequestInterceptors(config) {
        return this.requestInterceptors.reduce(
            (acc, interceptor) => interceptor(acc),
            config
        );
    }

    async applyResponseInterceptors(response) {
        let processed = response;
        for (const interceptor of this.responseInterceptors) {
            processed = await interceptor(processed);
        }
        return processed;
    }

    // Error handling
    async handleError(response, data) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
        error.status = response.status;
        error.data = data;
        
        // Specific error handling based on status code
        switch (response.status) {
            case 401:
                error.message = 'Authentication required';
                this.handleUnauthorized();
                break;
            case 403:
                error.message = 'Access forbidden';
                break;
            case 404:
                error.message = 'Resource not found';
                break;
            case 500:
                error.message = 'Server error occurred';
                break;
        }
        
        return error;
    }

    handleRequestError(error) {
        console.error('Request failed:', error);
        Notifications.error('Network request failed. Please try again.');
    }

    handleUnauthorized() {
        // Redirect to login or refresh token
        window.location.href = '/login';
    }
}

// Singleton instance
const API = new ApiService();
export default API;
