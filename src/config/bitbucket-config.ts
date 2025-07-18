import {BitbucketConfig} from '../types/interfaces.js';

function validateConfig(config: BitbucketConfig): void {
    if (!config.baseUrl) {
        throw new Error('BITBUCKET_URL environment variable is required');
    }

    if (!config.username) {
        throw new Error('BITBUCKET_USERNAME environment variable is required');
    }

    if (!config.token) {
        throw new Error('BITBUCKET_TOKEN environment variable is required');
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

    const config: BitbucketConfig = {
        baseUrl: url,
        username: process.env.BITBUCKET_USERNAME || '',
        token: process.env.BITBUCKET_TOKEN || '',
        defaultProject: process.env.BITBUCKET_DEFAULT_PROJECT || '',
        isCloud: url.includes('bitbucket.org') || url.includes('api.bitbucket.org')
    };

    validateConfig(config);
    return config;
}

export {validateConfig};

export function getProjectOrWorkspace(config: BitbucketConfig, provided?: string): string {
    const result = provided || config.defaultProject;
    if (!result) {
        throw new Error(config.isCloud
            ? 'Workspace is required. Provide it in the call or set BITBUCKET_DEFAULT_PROJECT environment variable.'
            : 'Project is required. Provide it in the call or set BITBUCKET_DEFAULT_PROJECT environment variable.'
        );
    }
    return result;
} 