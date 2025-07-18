#!/usr/bin/env node

// Debug script for Bitbucket MCP Server
// Usage: node debug-bitbucket.js

import axios from "axios";

console.log('🔍 Bitbucket MCP Server Debug Tool\n');

// Check environment variables
console.log('📋 Environment Configuration:');
console.log('BITBUCKET_URL:', process.env.BITBUCKET_URL || 'NOT SET');
console.log('BITBUCKET_USERNAME:', process.env.BITBUCKET_USERNAME || 'NOT SET');
console.log('BITBUCKET_TOKEN:', process.env.BITBUCKET_TOKEN ? '[SET - length: ' + process.env.BITBUCKET_TOKEN.length + ']' : 'NOT SET');
console.log('BITBUCKET_PASSWORD:', process.env.BITBUCKET_PASSWORD ? '[SET]' : 'NOT SET');
console.log('BITBUCKET_DEFAULT_PROJECT:', process.env.BITBUCKET_DEFAULT_PROJECT || 'NOT SET');
console.log('DEBUG:', process.env.DEBUG || 'NOT SET');
console.log();

// Determine if Cloud or Server
const baseUrl = process.env.BITBUCKET_URL || '';
const isCloud = baseUrl.includes('bitbucket.org') || baseUrl.includes('api.bitbucket.org');

console.log('🌐 Detected Platform:', isCloud ? 'Bitbucket Cloud' : 'Bitbucket Server');
console.log('📡 API Base URL:', isCloud ? 'https://api.bitbucket.org/2.0' : `${baseUrl}/rest/api/1.0`);
console.log();

// Validate configuration
console.log('✅ Configuration Validation:');

const errors = [];
const warnings = [];

if (!baseUrl) {
    errors.push('BITBUCKET_URL is required');
}

if (isCloud) {
    if (!process.env.BITBUCKET_USERNAME) {
        errors.push('BITBUCKET_USERNAME is required for Bitbucket Cloud');
    }
    if (!process.env.BITBUCKET_TOKEN && !process.env.BITBUCKET_PASSWORD) {
        errors.push('Either BITBUCKET_TOKEN (App Password) or BITBUCKET_PASSWORD is required for Bitbucket Cloud');
    }
    if (process.env.BITBUCKET_TOKEN && process.env.BITBUCKET_PASSWORD) {
        warnings.push('Both BITBUCKET_TOKEN and BITBUCKET_PASSWORD provided. App Password (BITBUCKET_TOKEN) will be used.');
    }
} else {
    if (!process.env.BITBUCKET_TOKEN && !(process.env.BITBUCKET_USERNAME && process.env.BITBUCKET_PASSWORD)) {
        errors.push('Either BITBUCKET_TOKEN (Personal Access Token) or BITBUCKET_USERNAME/PASSWORD is required for Bitbucket Server');
    }
}

if (!process.env.BITBUCKET_DEFAULT_PROJECT) {
    warnings.push(`BITBUCKET_DEFAULT_PROJECT not set. You'll need to provide ${isCloud ? 'workspace' : 'project'} for each operation.`);
}

errors.forEach(error => console.log('❌', error));
warnings.forEach(warning => console.log('⚠️', warning));

if (errors.length === 0) {
    console.log('✅ Configuration appears valid!');
} else {
    console.log(`❌ Found ${errors.length} configuration error(s)`);
}

console.log();

// Test API connection (if config is valid)
if (errors.length === 0) {
    console.log('🧪 Testing API Connection...');
    const apiPath = isCloud ? '/2.0' : '/rest/api/1.0';
    const apiBaseURL = isCloud ? 'https://api.bitbucket.org/2.0' : `${baseUrl}${apiPath}`;
    
    let authConfig = {};
    if (process.env.BITBUCKET_TOKEN) {
        authConfig.headers = { Authorization: `Bearer ${process.env.BITBUCKET_TOKEN}` };
    } else if (process.env.BITBUCKET_USERNAME && process.env.BITBUCKET_PASSWORD) {
        authConfig.auth = { username: process.env.BITBUCKET_USERNAME, password: process.env.BITBUCKET_PASSWORD };
    }
    
    const api = axios.create({
        baseURL: apiBaseURL,
        timeout: 10000,
        ...authConfig
    });
    
    // Test basic connectivity
    const testEndpoint = isCloud ? '/workspaces' : '/projects';
    
    api.get(testEndpoint)
        .then(response => {
            console.log('✅ API Connection successful!');
            console.log(`📊 Response status: ${response.status}`);
            console.log(`📦 Response size: ${JSON.stringify(response.data).length} bytes`);
            
            if (isCloud) {
                const workspaces = response.data.values || [];
                console.log(`🏢 Found ${workspaces.length} workspace(s):`);
                workspaces.slice(0, 5).forEach(ws => {
                    console.log(`   - ${ws.slug} (${ws.name})`);
                });
                if (workspaces.length > 5) {
                    console.log(`   ... and ${workspaces.length - 5} more`);
                }
            } else {
                const projects = response.data.values || [];
                console.log(`📁 Found ${projects.length} project(s):`);
                projects.slice(0, 5).forEach(proj => {
                    console.log(`   - ${proj.key} (${proj.name})`);
                });
                if (projects.length > 5) {
                    console.log(`   ... and ${projects.length - 5} more`);
                }
            }
            
            // Test default project/workspace if set
            if (process.env.BITBUCKET_DEFAULT_PROJECT) {
                console.log(`\n🎯 Testing default ${isCloud ? 'workspace' : 'project'}: ${process.env.BITBUCKET_DEFAULT_PROJECT}`);
                
                const repoEndpoint = isCloud 
                    ? `/repositories/${process.env.BITBUCKET_DEFAULT_PROJECT}`
                    : `/projects/${process.env.BITBUCKET_DEFAULT_PROJECT}/repos`;
                
                api.get(repoEndpoint)
                    .then(repoResponse => {
                        const repos = repoResponse.data.values || [];
                        console.log(`✅ Default ${isCloud ? 'workspace' : 'project'} accessible!`);
                        console.log(`📦 Found ${repos.length} repository(ies):`);
                        repos.slice(0, 3).forEach(repo => {
                            const repoName = isCloud ? repo.name : repo.slug;
                            console.log(`   - ${repoName}`);
                        });
                        if (repos.length > 3) {
                            console.log(`   ... and ${repos.length - 3} more`);
                        }
                    })
                    .catch(repoError => {
                        console.log(`❌ Cannot access default ${isCloud ? 'workspace' : 'project'}: ${repoError.response?.status} ${repoError.response?.statusText}`);
                        if (repoError.response?.data) {
                            console.log('   Error details:', JSON.stringify(repoError.response.data, null, 2));
                        }
                    });
            }
        })
        .catch(error => {
            console.log('❌ API Connection failed!');
            console.log(`   Status: ${error.response?.status || 'No response'}`);
            console.log(`   Message: ${error.message}`);
            if (error.response?.data) {
                console.log('   Error details:', JSON.stringify(error.response.data, null, 2));
            }
            
            if (error.response?.status === 401) {
                console.log('\n🔑 Authentication failed. Please check:');
                if (isCloud) {
                    console.log('   - BITBUCKET_USERNAME is your Bitbucket username');
                    console.log('   - BITBUCKET_TOKEN is a valid App Password from:');
                    console.log('     https://bitbucket.org/account/settings/app-passwords/');
                    console.log('   - App Password has required scopes: Repositories (Read/Write), Pull requests (Read/Write), Account (Read)');
                } else {
                    console.log('   - BITBUCKET_TOKEN is a valid Personal Access Token');
                    console.log('   - OR BITBUCKET_USERNAME/PASSWORD are correct');
                    console.log('   - Token/credentials have sufficient permissions');
                }
            }
        });
} else {
    console.log('⏭️ Skipping API test due to configuration errors');
}

console.log('\n📚 For more help:');
console.log('   - Bitbucket Cloud: https://support.atlassian.com/bitbucket-cloud/docs/app-passwords/');
console.log('   - Bitbucket Server: https://confluence.atlassian.com/bitbucketserver/personal-access-tokens-939515499.html');
console.log('   - MCP Documentation: https://modelcontextprotocol.io/');

console.log('\n🔧 To enable verbose logging, run with: DEBUG=verbose node your-mcp-client'); 