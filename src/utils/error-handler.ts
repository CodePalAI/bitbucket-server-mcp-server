import axios from 'axios';
import {ErrorCode, McpError} from '@modelcontextprotocol/sdk/types.js';
import {BitbucketConfig} from '../types/interfaces.js';

export function handleApiError(error: any, config: BitbucketConfig): never {
    if (axios.isAxiosError(error)) {
        const errorMessage = config.isCloud
            ? error.response?.data?.error?.message || error.response?.data?.message || error.message
            : error.response?.data.message || error.message;

        // Detailed error information for debugging
        const detailedError = {
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

        // Provide specific guidance for common errors
        if (error.response?.status === 401) {
            const authGuidance = config.isCloud
                ? `For Bitbucket Cloud, ensure you have:
1. Set BITBUCKET_USERNAME to your Bitbucket username
2. Set BITBUCKET_TOKEN to your App Password (create at: https://bitbucket.org/account/settings/app-passwords/)
3. App Password has required scopes: Repositories (Read/Write), Pull requests (Read/Write), Account (Read)
4. OR use BITBUCKET_USERNAME + BITBUCKET_PASSWORD (less secure)

Current config: username=${config.username || 'NOT SET'}, hasToken=${!!config.token}, hasPassword=${!!config.password}`
                : `For Bitbucket Server, ensure you have:
1. Set BITBUCKET_TOKEN to your Personal Access Token (recommended)
2. OR set BITBUCKET_USERNAME + BITBUCKET_PASSWORD for basic auth
3. Token/credentials have sufficient permissions for repositories and pull requests

Current config: hasToken=${!!config.token}, username=${config.username || 'NOT SET'}, hasPassword=${!!config.password}`;

            throw new McpError(
                ErrorCode.InternalError,
                `Authentication failed (401): ${errorMessage}\n\n${authGuidance}\n\nDetailed error: ${JSON.stringify(detailedError, null, 2)}`
            );
        }

        if (error.response?.status === 400) {
            let troubleshooting = '\n\n🔍 Troubleshooting 400 Bad Request:\n';

            if (config.isCloud) {
                troubleshooting += `
- Check if workspace name is correct: ${config.defaultProject}
- Verify repository exists and you have access
- Check if source and target branches exist
- Ensure branch names don't have invalid characters
- For PR creation: source and target branches must be different
`;
            } else {
                troubleshooting += `
- Check if project key is correct: ${config.defaultProject}
- Verify repository exists and you have access
- Check if source and target branches exist
- Ensure branch names follow Bitbucket Server naming rules
`;
            }

            throw new McpError(
                ErrorCode.InternalError,
                `Bad Request (400): ${errorMessage}${troubleshooting}\n\nFull error details: ${JSON.stringify(detailedError, null, 2)}`
            );
        }

        if (error.response?.status === 404) {
            let troubleshooting = '\n\n🔍 Troubleshooting 404 Not Found:\n';

            if (config.isCloud) {
                troubleshooting += `
- Workspace '${config.defaultProject}' might not exist or you don't have access
- Repository might not exist in this workspace
- Pull request ID might be incorrect
- Check the full URL: ${detailedError.fullURL}
`;
            } else {
                troubleshooting += `
- Project '${config.defaultProject}' might not exist or you don't have access
- Repository might not exist in this project
- Check the Bitbucket Server URL is correct: ${config.baseUrl}
- Check the full URL: ${detailedError.fullURL}
`;
            }

            throw new McpError(
                ErrorCode.InternalError,
                `Not Found (404): ${errorMessage}${troubleshooting}\n\nFull error details: ${JSON.stringify(detailedError, null, 2)}`
            );
        }

        throw new McpError(
            ErrorCode.InternalError,
            `Bitbucket API error (${error.response?.status || 'unknown'}): ${errorMessage}\n\nFull error details: ${JSON.stringify(detailedError, null, 2)}`
        );
    }
    throw error;
} 