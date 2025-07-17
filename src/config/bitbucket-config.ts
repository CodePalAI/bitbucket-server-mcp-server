import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { BitbucketConfig } from '../types/interfaces.js';

export function createBitbucketConfig(): BitbucketConfig {
    const baseUrl = process.env.BITBUCKET_URL ?? '';
    const config: BitbucketConfig = {
        baseUrl,
        token: process.env.BITBUCKET_TOKEN,
        username: process.env.BITBUCKET_USERNAME,
        password: process.env.BITBUCKET_PASSWORD,
        defaultProject: process.env.BITBUCKET_DEFAULT_PROJECT,
        isCloud: baseUrl.includes('bitbucket.org') || baseUrl.includes('api.bitbucket.org')
    };

    // Validate configuration
    validateConfig(config);

    return config;
}

function validateConfig(config: BitbucketConfig): void {
    if (!config.baseUrl) {
        throw new Error('BITBUCKET_URL is required');
    }

    if (config.isCloud) {
        // Bitbucket Cloud: Requires username + app password OR username + password
        if (!config.username) {
            throw new Error('BITBUCKET_USERNAME is required for Bitbucket Cloud');
        }
        if (!config.token && !config.password) {
            throw new Error('Either BITBUCKET_TOKEN (App Password) or BITBUCKET_PASSWORD is required for Bitbucket Cloud');
        }
        if (config.token && config.password) {
            console.warn('Both BITBUCKET_TOKEN and BITBUCKET_PASSWORD provided. Using App Password (BITBUCKET_TOKEN)');
        }
    } else {
        // Bitbucket Server: Supports multiple auth methods
        if (!config.token && !(config.username && config.password)) {
            throw new Error('Either BITBUCKET_TOKEN (Personal Access Token) or BITBUCKET_USERNAME/PASSWORD is required for Bitbucket Server');
        }
    }
}

export function getProjectOrWorkspace(config: BitbucketConfig, providedValue?: string): string {
    const value = providedValue || config.defaultProject;
    if (!value) {
        const type = config.isCloud ? 'workspace' : 'project';
        throw new McpError(
            ErrorCode.InvalidParams,
            `${type} must be provided either as a parameter or through BITBUCKET_DEFAULT_PROJECT environment variable`
        );
    }
    return value;
} 