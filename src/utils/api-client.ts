import axios, {AxiosInstance} from 'axios';
import {BitbucketConfig} from '../types/interfaces.js';

export function createApiClient(config: BitbucketConfig): AxiosInstance {
    // Configuration de l'instance Axios based on Bitbucket type
    const apiPath = config.isCloud ? '/2.0' : '/rest/api/1.0';
    const baseURL = config.isCloud ? 'https://api.bitbucket.org/2.0' : `${config.baseUrl}${apiPath}`;

    // Setup authentication based on platform and available credentials
    let authConfig: { headers?: any; auth?: any } = {headers: {}, auth: undefined};

    // Bitbucket Server or Cloud: Support Bearer tokens
    if (config.token) {
        // Personal Access Token (recommended)
        authConfig.headers = {Authorization: `Bearer ${config.token}`};
    } else if (config.username && config.password) {
        // Basic authentication
        authConfig.auth = {username: config.username, password: config.password};
    }

    return axios.create({
        baseURL,
        ...authConfig
    });
} 