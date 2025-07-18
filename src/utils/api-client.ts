import axios, {AxiosInstance} from 'axios';
import {BitbucketConfig} from '../types/interfaces.js';
import winston from 'winston';

// Use the same logger configuration as the main server
const logger = winston.createLogger({
    level: process.env.DEBUG ? 'debug' : 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({stack: true}),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({filename: 'bitbucket.log'}),
        new winston.transports.Console({
            stderrLevels: ['error', 'warn', 'info', 'debug'],
            silent: false
        })
    ]
});

export function createApiClient(config: BitbucketConfig): AxiosInstance {
    const apiPath = config.isCloud ? '/2.0' : '/rest/api/1.0';
    const baseURL = config.isCloud ? 'https://api.bitbucket.org/2.0' : `${config.baseUrl}${apiPath}`;

    // Setup authentication based on platform and available credentials
    const authConfig: { headers?: any; auth?: any } = {headers: {}, auth: undefined};

    // Bitbucket Server or Cloud: Support Bearer tokens
    if (config.token) {
        // Personal Access Token (recommended)
        authConfig.headers = {Authorization: `Bearer ${config.token}`};
    } else if (config.username && config.password) {
        // Basic authentication
        authConfig.auth = {username: config.username, password: config.password};
    }

    const apiClient = axios.create({
        baseURL,
        ...authConfig,
        timeout: 30000 // 30 second timeout
    });

    // Add request interceptor for verbose logging
    apiClient.interceptors.request.use(
        (config) => {
            const logData = {
                method: config.method?.toUpperCase(),
                url: config.url,
                baseURL: config.baseURL,
                fullURL: `${config.baseURL}${config.url}`,
                headers: {
                    ...config.headers,
                    // Mask sensitive data
                    Authorization: config.headers?.Authorization ? '[REDACTED]' : undefined
                },
                params: config.params,
                data: config.data ? (typeof config.data === 'string' ? config.data : JSON.stringify(config.data)) : undefined
            };

            logger.info('🚀 HTTP Request', logData);
            return config;
        },
        (error) => {
            logger.error('❌ HTTP Request Error', {error: error.message, stack: error.stack});
            return Promise.reject(error);
        }
    );

    // Add response interceptor for verbose logging
    apiClient.interceptors.response.use(
        (response) => {
            const logData = {
                status: response.status,
                statusText: response.statusText,
                url: response.config.url,
                method: response.config.method?.toUpperCase(),
                responseSize: JSON.stringify(response.data).length,
                responseData: process.env.DEBUG === 'verbose' ? response.data :
                    (typeof response.data === 'object' ? `[${Object.keys(response.data).length} keys]` : '[data]')
            };

            logger.info('✅ HTTP Response', logData);
            return response;
        },
        (error) => {
            const logData = {
                status: error.response?.status,
                statusText: error.response?.statusText,
                url: error.config?.url,
                method: error.config?.method?.toUpperCase(),
                errorMessage: error.message,
                errorCode: error.code,
                responseData: error.response?.data,
                requestData: error.config?.data,
                headers: {
                    ...error.config?.headers,
                    Authorization: error.config?.headers?.Authorization ? '[REDACTED]' : undefined
                }
            };

            logger.error('❌ HTTP Response Error', logData);
            return Promise.reject(error);
        }
    );

    logger.info('🔧 API Client Created', {
        baseURL,
        isCloud: config.isCloud,
        hasToken: !!config.token,
        hasBasicAuth: !!(config.username && config.password),
        authType: config.token ? 'Bearer Token' : 'Basic Auth'
    });

    return apiClient;
} 