import axios from 'axios';
import {ErrorCode, McpError} from '@modelcontextprotocol/sdk/types.js';
import {BitbucketConfig} from '../types/interfaces.js';

/**
 * Generates platform-specific authentication guidance
 */
function getAuthGuidance(config: BitbucketConfig): string {
    switch (config.platformType) {
        case 'cloud':
            return `For Bitbucket Cloud, ensure you have:
1. Set BITBUCKET_USERNAME to your Bitbucket username
2. Set BITBUCKET_TOKEN to your App Password (create at: https://bitbucket.org/account/settings/app-passwords/)
3. App Password has required scopes: Repositories (Read/Write), Pull requests (Read/Write), Account (Read)
4. OR use BITBUCKET_USERNAME + BITBUCKET_PASSWORD (less secure)

Current config: username=${config.username || 'NOT SET'}, hasToken=${!!config.token}, hasPassword=${!!config.password}`;

        case 'datacenter':
            return `For Bitbucket Data Center, ensure you have:
1. Set BITBUCKET_TOKEN to your Personal Access Token or HTTP Access Token (recommended)
   - Create at: Profile > Personal access tokens > Create token
   - Grant required permissions: Repository admin, Pull request admin, Project admin
2. OR set BITBUCKET_USERNAME + BITBUCKET_PASSWORD for basic auth
3. Verify your Data Center instance URL is correct: ${config.baseUrl}
4. Check if your Data Center instance requires VPN or network access

Current config: hasToken=${!!config.token}, username=${config.username || 'NOT SET'}, hasPassword=${!!config.password}
Platform: Bitbucket Data Center (${config.version || 'version unknown'})`;

        case 'server':
            return `For Bitbucket Server, ensure you have:
1. Set BITBUCKET_TOKEN to your Personal Access Token (recommended)
   - Create at: Profile > Personal access tokens > Create token
   - Grant required permissions: Repository admin, Pull request admin, Project admin
2. OR set BITBUCKET_USERNAME + BITBUCKET_PASSWORD for basic auth
3. Verify your Server instance URL is correct: ${config.baseUrl}
4. Check if your Server instance requires VPN or network access

Current config: hasToken=${!!config.token}, username=${config.username || 'NOT SET'}, hasPassword=${!!config.password}
Platform: Bitbucket Server (${config.version || 'version unknown'})`;

        default:
            return `Authentication configuration issue detected for ${config.platformType}. Please check your credentials.`;
    }
}

/**
 * Generates platform-specific 400 Bad Request troubleshooting guidance
 */
function get400Guidance(config: BitbucketConfig): string {
    const baseGuidance = config.isCloud
        ? `- Check if workspace name is correct: ${config.defaultProject}
- Verify repository exists and you have access
- Check if source and target branches exist
- Ensure branch names don't have invalid characters
- For PR creation: source and target branches must be different`
        : `- Check if project key is correct: ${config.defaultProject}
- Verify repository exists and you have access  
- Check if source and target branches exist
- Ensure branch names follow naming rules`;

    const platformSpecific = config.platformType === 'datacenter'
        ? `
- Ensure your Data Center instance is properly configured
- Check if any branch restrictions are blocking the operation
- Verify you have the required permissions in Data Center
- Check if the API endpoint is accessible: ${config.baseUrl}/rest/api/1.0`
        : config.platformType === 'server'
        ? `
- Ensure your Server instance is properly configured
- Check if any branch restrictions are blocking the operation
- Verify you have the required permissions in Server
- Check if the API endpoint is accessible: ${config.baseUrl}/rest/api/1.0`
        : '';

    return baseGuidance + platformSpecific;
}

/**
 * Generates platform-specific 404 Not Found troubleshooting guidance
 */
function get404Guidance(config: BitbucketConfig, fullURL: string): string {
    const baseGuidance = config.isCloud
        ? `- Workspace '${config.defaultProject}' might not exist or you don't have access
- Repository might not exist in this workspace
- Pull request ID might be incorrect`
        : `- Project '${config.defaultProject}' might not exist or you don't have access
- Repository might not exist in this project`;

    const platformSpecific = config.platformType === 'datacenter'
        ? `
- Check if your Bitbucket Data Center instance is running and accessible
- Verify the base URL is correct: ${config.baseUrl}
- Ensure you're connecting to the right Data Center instance
- Check if the repository/project was migrated or renamed
- Verify network connectivity to your Data Center instance`
        : config.platformType === 'server'
        ? `
- Check if your Bitbucket Server instance is running and accessible
- Verify the base URL is correct: ${config.baseUrl}
- Ensure you're connecting to the right Server instance
- Check if the repository/project was migrated or renamed
- Verify network connectivity to your Server instance`
        : '';

    return `${baseGuidance}
- Check the full URL: ${fullURL}${platformSpecific}`;
}

export function handleApiError(error: any, config: BitbucketConfig): never {
    if (axios.isAxiosError(error)) {
        const errorMessage = config.isCloud
            ? error.response?.data?.error?.message || error.response?.data?.message || error.message
            : error.response?.data?.errors?.[0]?.message || error.response?.data?.message || error.message;

        // Detailed error information for debugging
        const detailedError = {
            platform: config.platformType,
            status: error.response?.status,
            statusText: error.response?.statusText,
            url: error.config?.url,
            method: error.config?.method?.toUpperCase(),
            fullURL: error.config ? `${error.config.baseURL}${error.config.url}` : 'unknown',
            requestData: error.config?.data,
            responseData: error.response?.data,
            errorCode: error.code,
            message: errorMessage,
            headers: {
                request: error.config?.headers,
                response: error.response?.headers
            }
        };

        // Log the detailed error for debugging
        console.error('🚨 Detailed API Error:', JSON.stringify(detailedError, null, 2));

        // Handle specific error types with platform-aware guidance
        if (error.response?.status === 401) {
            throw new McpError(
                ErrorCode.InternalError,
                `Authentication failed (401): ${errorMessage}\n\n${getAuthGuidance(config)}\n\nDetailed error: ${JSON.stringify(detailedError, null, 2)}`
            );
        }

        if (error.response?.status === 400) {
            const troubleshooting = `\n\n🔍 Troubleshooting 400 Bad Request:\n${get400Guidance(config)}`;
            throw new McpError(
                ErrorCode.InternalError,
                `Bad Request (400): ${errorMessage}${troubleshooting}\n\nFull error details: ${JSON.stringify(detailedError, null, 2)}`
            );
        }

        if (error.response?.status === 404) {
            const troubleshooting = `\n\n🔍 Troubleshooting 404 Not Found:\n${get404Guidance(config, detailedError.fullURL)}`;
            throw new McpError(
                ErrorCode.InternalError,
                `Not Found (404): ${errorMessage}${troubleshooting}\n\nFull error details: ${JSON.stringify(detailedError, null, 2)}`
            );
        }

        if (error.response?.status === 403) {
            const platformName = config.platformType === 'datacenter' ? 'Data Center' : 
                               config.platformType === 'server' ? 'Server' : 'Cloud';
            const troubleshooting = `\n\n🔍 Troubleshooting 403 Forbidden:
- You don't have sufficient permissions for this operation
- Check your ${platformName} permissions for the repository/project
- Verify your token/credentials have the required scopes
- For ${platformName}: ensure you have admin or write access where needed`;

            throw new McpError(
                ErrorCode.InternalError,
                `Forbidden (403): ${errorMessage}${troubleshooting}\n\nFull error details: ${JSON.stringify(detailedError, null, 2)}`
            );
        }

        // Handle network errors
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
            const networkGuidance = config.platformType === 'datacenter' || config.platformType === 'server'
                ? `\n\n🌐 Network Connectivity Issues:
- Verify your ${config.platformType === 'datacenter' ? 'Data Center' : 'Server'} instance is running: ${config.baseUrl}
- Check if you need VPN access to reach the instance
- Verify firewall rules allow access to the instance
- Test connectivity: curl ${config.baseUrl}/status (if available)
- Ensure the instance URL is correct and accessible`
                : `\n\n🌐 Network Connectivity Issues:
- Check your internet connection
- Verify you can access https://bitbucket.org
- Check if you're behind a corporate firewall`;

            throw new McpError(
                ErrorCode.InternalError,
                `Network error (${error.code}): ${errorMessage}${networkGuidance}\n\nFull error details: ${JSON.stringify(detailedError, null, 2)}`
            );
        }

        throw new McpError(
            ErrorCode.InternalError,
            `Bitbucket API error (${error.response?.status || 'unknown'}): ${errorMessage}\n\nPlatform: ${config.platformType}\nFull error details: ${JSON.stringify(detailedError, null, 2)}`
        );
    }
    throw error;
} 