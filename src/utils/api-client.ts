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

/**
 * Determines the correct API base URL based on platform type
 */
function getApiBaseUrl(config: BitbucketConfig): string {
    switch (config.platformType) {
        case 'cloud':
            return 'https://api.bitbucket.org/2.0';

        case 'datacenter':
        case 'server':
            // Both Data Center and Server use the same REST API path structure
            return `${config.baseUrl}/rest/api/1.0`;

        default:
            // Fallback for backward compatibility
            return config.isCloud ? 'https://api.bitbucket.org/2.0' : `${config.baseUrl}/rest/api/1.0`;
    }
}

/**
 * Sets up authentication configuration based on platform and available credentials
 */
function setupAuthentication(config: BitbucketConfig): { headers?: any; auth?: any } {
    const authConfig: { headers?: any; auth?: any } = {headers: {}, auth: undefined};

    if (config.token) {
        switch (config.platformType) {
            case 'cloud':
                // Bitbucket Cloud: App Passwords use Basic Auth with username + app password
                if (config.username) {
                    authConfig.auth = {username: config.username, password: config.token};
                } else {
                    // Fallback to Bearer if no username (though less common for Cloud)
                    authConfig.headers = {Authorization: `Bearer ${config.token}`};
                }
                break;

            case 'datacenter':
                // Bitbucket Data Center: Supports both Personal Access Tokens and HTTP Access Tokens
                // HTTP Access Tokens are Bearer tokens, Personal Access Tokens can be used as Bearer
                authConfig.headers = {Authorization: `Bearer ${config.token}`};
                break;

            case 'server':
                // Bitbucket Server: Personal Access Tokens as Bearer tokens
                authConfig.headers = {Authorization: `Bearer ${config.token}`};
                break;

            default:
                // Backward compatibility fallback
                authConfig.headers = {Authorization: `Bearer ${config.token}`};
        }
    } else if (config.username && config.password) {
        // Basic authentication for all platforms
        authConfig.auth = {username: config.username, password: config.password};
    }

    return authConfig;
}

export function createApiClient(config: BitbucketConfig): AxiosInstance {
    const baseURL = getApiBaseUrl(config);
    const authConfig = setupAuthentication(config);

    const apiClient = axios.create({
        baseURL,
        ...authConfig,
        timeout: 30000, // 30 second timeout
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...(authConfig.headers || {})
        }
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

    const platformName = config.platformType === 'datacenter' ? 'Bitbucket Data Center' :
        config.platformType === 'server' ? 'Bitbucket Server' :
            'Bitbucket Cloud';

    const authType = config.token
        ? (config.platformType === 'cloud' && config.username ? 'App Password' : 'Bearer Token')
        : 'Basic Auth';

    logger.info('🔧 API Client Created', {
        platform: platformName,
        platformType: config.platformType,
        baseURL,
        isCloud: config.isCloud,
        hasToken: !!config.token,
        hasBasicAuth: !!(config.username && config.password),
        authType,
        version: config.version,
        features: config.features
    });

    return apiClient;
} 