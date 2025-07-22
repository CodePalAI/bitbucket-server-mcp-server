import {BitbucketConfig} from '../types/interfaces.js';

/**
 * Detects the Bitbucket platform type based on URL and other indicators
 */
function detectPlatformType(url: string): { platformType: 'cloud' | 'server' | 'datacenter', isCloud: boolean, features: BitbucketConfig['features'] } {
    const normalizedUrl = url.toLowerCase();
    
    // Bitbucket Cloud detection
    if (normalizedUrl.includes('bitbucket.org') || normalizedUrl.includes('api.bitbucket.org')) {
        return {
            platformType: 'cloud',
            isCloud: true,
            features: {
                supportsPipelines: true,
                supportsSnippets: true,
                supportsBuildStatus: false,
                supportsDeployments: true,
                supportsHttpAccessTokens: false
            }
        };
    }
    
    // For on-premise instances, we need to distinguish between Server and Data Center
    // Data Center typically has these indicators:
    // 1. Newer REST API capabilities
    // 2. Support for newer authentication methods
    // 3. Enhanced clustering and enterprise features
    
    // Check for Data Center indicators
    const isDataCenter = 
        // Common Data Center URL patterns
        normalizedUrl.includes('datacenter') ||
        normalizedUrl.includes('bitbucket-dc') ||
        // Allow explicit override via environment variable
        process.env.BITBUCKET_PLATFORM_TYPE?.toLowerCase() === 'datacenter' ||
        // Version-based detection (if version is 7.0+, likely Data Center)
        (process.env.BITBUCKET_VERSION && parseFloat(process.env.BITBUCKET_VERSION) >= 7.0);
    
    if (isDataCenter) {
        return {
            platformType: 'datacenter',
            isCloud: false,
            features: {
                supportsPipelines: false,
                supportsSnippets: false,
                supportsBuildStatus: true,
                supportsDeployments: false,
                supportsHttpAccessTokens: true // Data Center supports HTTP Access Tokens
            }
        };
    }
    
    // Default to legacy Server
    return {
        platformType: 'server',
        isCloud: false,
        features: {
            supportsPipelines: false,
            supportsSnippets: false,
            supportsBuildStatus: true,
            supportsDeployments: false,
            supportsHttpAccessTokens: false
        }
    };
}

/**
 * Normalizes the base URL for API calls
 */
function normalizeBaseUrl(url: string, platformType: 'cloud' | 'server' | 'datacenter'): string {
    if (platformType === 'cloud') {
        // For Cloud, always use the official API endpoint
        return 'https://api.bitbucket.org';
    }
    
    // For Server and Data Center, ensure the URL is properly formatted
    let baseUrl = url.replace(/\/+$/, ''); // Remove trailing slashes
    
    // Ensure it has a protocol
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        baseUrl = 'https://' + baseUrl;
    }
    
    return baseUrl;
}

function validateConfig(config: BitbucketConfig): void {
    if (!config.baseUrl) {
        throw new Error('BITBUCKET_URL environment variable is required');
    }

    if (!config.username) {
        throw new Error('BITBUCKET_USERNAME environment variable is required');
    }

    // Enhanced authentication validation based on platform
    if (!config.token && (!config.username || !config.password)) {
        const authGuidance = config.platformType === 'cloud' 
            ? `For Bitbucket Cloud, you need either:
1. BITBUCKET_TOKEN (App Password - recommended)
2. BITBUCKET_USERNAME + BITBUCKET_PASSWORD

Create an App Password at: https://bitbucket.org/account/settings/app-passwords/`
            : config.platformType === 'datacenter'
            ? `For Bitbucket Data Center, you need either:
1. BITBUCKET_TOKEN (Personal Access Token or HTTP Access Token - recommended)
2. BITBUCKET_USERNAME + BITBUCKET_PASSWORD

Create a Personal Access Token in your Bitbucket Data Center instance under Profile > Personal access tokens`
            : `For Bitbucket Server, you need either:
1. BITBUCKET_TOKEN (Personal Access Token - recommended)  
2. BITBUCKET_USERNAME + BITBUCKET_PASSWORD

Create a Personal Access Token in your Bitbucket Server instance under Profile > Personal access tokens`;
        
        throw new Error(`Authentication configuration required.\n\n${authGuidance}`);
    }

    // Validate URL format
    try {
        new URL(config.baseUrl);
    } catch (error) {
        throw new Error('BITBUCKET_URL must be a valid URL');
    }
}

export function createBitbucketConfig(): BitbucketConfig {
    const url = process.env.BITBUCKET_URL;
    if (!url) {
        throw new Error('BITBUCKET_URL environment variable is required');
    }

    const platformInfo = detectPlatformType(url);
    const normalizedUrl = normalizeBaseUrl(url, platformInfo.platformType);

    const config: BitbucketConfig = {
        baseUrl: normalizedUrl,
        username: process.env.BITBUCKET_USERNAME || '',
        token: process.env.BITBUCKET_TOKEN || '',
        password: process.env.BITBUCKET_PASSWORD || '',
        defaultProject: process.env.BITBUCKET_DEFAULT_PROJECT || '',
        isCloud: platformInfo.isCloud,
        platformType: platformInfo.platformType,
        version: process.env.BITBUCKET_VERSION,
        features: platformInfo.features
    };

    validateConfig(config);
    return config;
}

export {validateConfig};

export function getProjectOrWorkspace(config: BitbucketConfig, provided?: string): string {
    const result = provided || config.defaultProject;
    if (!result) {
        const guidance = config.isCloud
            ? 'Workspace is required. Provide it in the call or set BITBUCKET_DEFAULT_PROJECT environment variable.'
            : 'Project is required. Provide it in the call or set BITBUCKET_DEFAULT_PROJECT environment variable.';
        throw new Error(guidance);
    }
    return result;
} 