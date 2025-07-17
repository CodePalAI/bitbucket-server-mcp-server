import axios from 'axios';
import {ErrorCode, McpError} from '@modelcontextprotocol/sdk/types.js';
import {BitbucketConfig} from '../types/interfaces.js';

export function handleApiError(error: any, config: BitbucketConfig): never {
    if (axios.isAxiosError(error)) {
        const errorMessage = config.isCloud
            ? error.response?.data?.error?.message || error.response?.data?.message || error.message
            : error.response?.data.message || error.message;

        // Provide specific guidance for 401 errors
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
                `Authentication failed (401): ${errorMessage}\n\n${authGuidance}`
            );
        }

        throw new McpError(
            ErrorCode.InternalError,
            `Bitbucket API error: ${errorMessage}`
        );
    }
    throw error;
} 