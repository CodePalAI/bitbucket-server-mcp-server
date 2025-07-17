#!/usr/bin/env node
import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError,} from '@modelcontextprotocol/sdk/types.js';
import axios, {AxiosInstance} from 'axios';
import winston from 'winston';

// Configuration du logger - only log to file and stderr, never stdout to avoid stdio conflicts
const logger = winston.createLogger({
    level: process.env.DEBUG ? 'debug' : 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({stack: true}),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({filename: 'bitbucket.log'}),
        // Log errors to stderr only (not stdout) to avoid corrupting MCP protocol
        new winston.transports.Console({
            stderrLevels: ['error', 'warn', 'info', 'debug'],
            silent: false
        })
    ]
});

interface BitbucketActivity {
    action: string;
    [key: string]: unknown;
}

interface BitbucketConfig {
    baseUrl: string;
    token?: string;
    username?: string;
    password?: string;
    defaultProject?: string;
    isCloud: boolean;
}

interface RepositoryParams {
    project?: string;
    repository?: string;
    workspace?: string;
}

interface PullRequestParams extends RepositoryParams {
    prId?: number;
}

interface MergeOptions {
    message?: string;
    strategy?: 'merge-commit' | 'squash' | 'fast-forward';
}

interface CommentOptions {
    text: string;
    parentId?: number;
}

interface PullRequestInput extends RepositoryParams {
    title: string;
    description: string;
    sourceBranch: string;
    targetBranch: string;
    reviewers?: string[];
}

interface ListOptions {
    limit?: number;
    start?: number;
}

interface ListRepositoriesOptions extends ListOptions {
    project?: string;
    workspace?: string;
}

class BitbucketServer {
    private readonly server: Server;
    private readonly api: AxiosInstance;
    private readonly config: BitbucketConfig;

    constructor() {
        this.server = new Server(
            {
                name: 'bitbucket-server-mcp-server',
                version: '1.0.0',
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );

        // Configuration initiale à partir des variables d'environnement
        const baseUrl = process.env.BITBUCKET_URL ?? '';
        this.config = {
            baseUrl,
            token: process.env.BITBUCKET_TOKEN,
            username: process.env.BITBUCKET_USERNAME,
            password: process.env.BITBUCKET_PASSWORD,
            defaultProject: process.env.BITBUCKET_DEFAULT_PROJECT,
            isCloud: baseUrl.includes('bitbucket.org') || baseUrl.includes('api.bitbucket.org')
        };

        if (!this.config.baseUrl) {
            throw new Error('BITBUCKET_URL is required');
        }

        if (!this.config.token && !(this.config.username && this.config.password)) {
            throw new Error('Either BITBUCKET_TOKEN or BITBUCKET_USERNAME/PASSWORD is required');
        }

        // Configuration de l'instance Axios based on Bitbucket type
        const apiPath = this.config.isCloud ? '/2.0' : '/rest/api/1.0';
        const baseURL = this.config.isCloud ? 'https://api.bitbucket.org/2.0' : `${this.config.baseUrl}${apiPath}`;
        
        this.api = axios.create({
            baseURL,
            headers: this.config.isCloud
                ? {} // For Cloud, we'll use Basic Auth, not Bearer
                : (this.config.token ? {Authorization: `Bearer ${this.config.token}`} : {}),
            auth: this.config.isCloud
                ? (this.config.token 
                    ? { username: process.env.BITBUCKET_USERNAME || 'x-token-auth', password: this.config.token }
                    : (this.config.username && this.config.password 
                        ? { username: this.config.username, password: this.config.password }
                        : undefined))
                : (this.config.username && this.config.password
                    ? {username: this.config.username, password: this.config.password}
                    : undefined),
        });

        logger.info(`Initialized for ${this.config.isCloud ? 'Bitbucket Cloud' : 'Bitbucket Server'}`, {
            baseUrl: this.config.baseUrl,
            apiPath,
            authMethod: this.config.isCloud 
                ? (this.config.token ? 'Basic Auth (App Password)' : 'Basic Auth (Username/Password)')
                : (this.config.token ? 'Bearer Token' : 'Basic Auth'),
            hasAuth: !!(this.config.token || (this.config.username && this.config.password))
        });

        this.setupToolHandlers();
        
        // Improved error handling for MCP errors
        this.server.onerror = (error) => {
            logger.error('[MCP Error]', { 
                message: error.message,
                stack: error.stack,
                name: error.name
            });
        };
    }

    private isPullRequestInput(args: unknown): args is PullRequestInput {
        const input = args as Partial<PullRequestInput>;
        return typeof args === 'object' &&
            args !== null &&
            (typeof input.project === 'string' || typeof input.workspace === 'string') &&
            typeof input.repository === 'string' &&
            typeof input.title === 'string' &&
            typeof input.sourceBranch === 'string' &&
            typeof input.targetBranch === 'string' &&
            (input.description === undefined || typeof input.description === 'string') &&
            (input.reviewers === undefined || Array.isArray(input.reviewers));
    }

    private setupToolHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [
                {
                    name: 'list_projects',
                    description: this.config.isCloud 
                        ? 'Discover and list all Bitbucket workspaces you have access to. Use this first to explore available workspaces, find workspace names, or when you need to work with a specific workspace. Returns workspace names, UUIDs, and visibility settings.'
                        : 'Discover and list all Bitbucket projects you have access to. Use this first to explore available projects, find project keys, or when you need to work with a specific project but don\'t know its exact key. Returns project keys, names, descriptions and visibility settings.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            limit: {
                                type: 'number',
                                description: 'Number of projects/workspaces to return (default: 25, max: 1000)'
                            },
                            start: {type: 'number', description: 'Start index for pagination (default: 0)'}
                        }
                    }
                },
                {
                    name: 'list_repositories',
                    description: 'Browse and discover repositories within a specific project/workspace or across all accessible projects. Use this to find repository slugs, explore codebases, or understand the repository structure. Returns repository names, slugs, clone URLs, and project associations.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            [this.config.isCloud ? 'workspace' : 'project']: {
                                type: 'string',
                                description: this.config.isCloud 
                                    ? 'Bitbucket workspace name to list repositories from. If omitted, uses BITBUCKET_DEFAULT_PROJECT or lists all accessible repositories across workspaces.'
                                    : 'Bitbucket project key to list repositories from. If omitted, uses BITBUCKET_DEFAULT_PROJECT or lists all accessible repositories across projects.'
                            },
                            limit: {
                                type: 'number',
                                description: 'Number of repositories to return (default: 25, max: 1000)'
                            },
                            start: {type: 'number', description: 'Start index for pagination (default: 0)'}
                        }
                    }
                },
                {
                    name: 'create_pull_request',
                    description: 'Create a new pull request to propose code changes, request reviews, or merge feature branches. Use this when you want to submit code for review, merge a feature branch, or contribute changes to a repository. Automatically sets up branch references and can assign reviewers.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            [this.config.isCloud ? 'workspace' : 'project']: {
                                type: 'string',
                                description: this.config.isCloud
                                    ? 'Bitbucket workspace name. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable. Use list_projects to discover available workspaces.'
                                    : 'Bitbucket project key. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable. Use list_projects to discover available projects.'
                            },
                            repository: {
                                type: 'string',
                                description: 'Repository slug where the pull request will be created. Use list_repositories to find available repositories.'
                            },
                            title: {
                                type: 'string',
                                description: 'Clear, descriptive title for the pull request that summarizes the changes.'
                            },
                            description: {
                                type: 'string',
                                description: 'Detailed description of changes, context, and any relevant information for reviewers. Supports Markdown formatting.'
                            },
                            sourceBranch: {
                                type: 'string',
                                description: 'Source branch name containing the changes to be merged (e.g., "feature/new-login", "bugfix/security-patch").'
                            },
                            targetBranch: {
                                type: 'string',
                                description: 'Target branch where changes will be merged (e.g., "main", "develop", "release/v1.2").'
                            },
                            reviewers: {
                                type: 'array',
                                items: {type: 'string'},
                                description: 'Array of Bitbucket usernames to assign as reviewers for this pull request.'
                            }
                        },
                        required: ['repository', 'title', 'sourceBranch', 'targetBranch']
                    }
                },
                {
                    name: 'get_pull_request',
                    description: 'Retrieve comprehensive details about a specific pull request including status, reviewers, commits, and metadata. Use this to check PR status, review progress, understand changes, or gather information before performing actions like merging or commenting.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            [this.config.isCloud ? 'workspace' : 'project']: {
                                type: 'string',
                                description: this.config.isCloud 
                                    ? 'Bitbucket workspace name. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable.'
                                    : 'Bitbucket project key. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable.'
                            },
                            repository: {type: 'string', description: 'Repository slug containing the pull request.'},
                            prId: {type: 'number', description: 'Unique pull request ID number (e.g., 123, 456).'}
                        },
                        required: ['repository', 'prId']
                    }
                },
                {
                    name: 'merge_pull_request',
                    description: 'Merge an approved pull request into the target branch. Use this when a PR has been reviewed, approved, and is ready to be integrated. Choose the appropriate merge strategy based on your team\'s workflow and repository history preferences.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            [this.config.isCloud ? 'workspace' : 'project']: {
                                type: 'string',
                                description: this.config.isCloud 
                                    ? 'Bitbucket workspace name. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable.'
                                    : 'Bitbucket project key. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable.'
                            },
                            repository: {type: 'string', description: 'Repository slug containing the pull request.'},
                            prId: {type: 'number', description: 'Pull request ID to merge.'},
                            message: {
                                type: 'string',
                                description: 'Custom merge commit message. If not provided, uses default merge message format.'
                            },
                            strategy: {
                                type: 'string',
                                enum: ['merge-commit', 'squash', 'fast-forward'],
                                description: 'Merge strategy: "merge-commit" creates a merge commit preserving branch history, "squash" combines all commits into one, "fast-forward" moves the branch pointer without creating a merge commit.'
                            }
                        },
                        required: ['repository', 'prId']
                    }
                },
                {
                    name: 'decline_pull_request',
                    description: 'Decline or reject a pull request that should not be merged. Use this when changes are not acceptable, conflicts with project direction, or when the PR needs significant rework. This closes the PR without merging.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            [this.config.isCloud ? 'workspace' : 'project']: {
                                type: 'string',
                                description: this.config.isCloud 
                                    ? 'Bitbucket workspace name. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable.'
                                    : 'Bitbucket project key. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable.'
                            },
                            repository: {type: 'string', description: 'Repository slug containing the pull request.'},
                            prId: {type: 'number', description: 'Pull request ID to decline.'},
                            message: {
                                type: 'string',
                                description: 'Reason for declining the pull request. Helps the author understand why it was rejected.'
                            }
                        },
                        required: ['repository', 'prId']
                    }
                },
                {
                    name: 'add_comment',
                    description: 'Add a comment to a pull request for code review, feedback, questions, or discussion. Use this to provide review feedback, ask questions about specific changes, suggest improvements, or participate in code review discussions. Supports threaded conversations.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            [this.config.isCloud ? 'workspace' : 'project']: {
                                type: 'string',
                                description: this.config.isCloud 
                                    ? 'Bitbucket workspace name. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable.'
                                    : 'Bitbucket project key. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable.'
                            },
                            repository: {type: 'string', description: 'Repository slug containing the pull request.'},
                            prId: {type: 'number', description: 'Pull request ID to comment on.'},
                            text: {
                                type: 'string',
                                description: 'Comment text content. Supports Markdown formatting for code blocks, links, and emphasis.'
                            },
                            parentId: {
                                type: 'number',
                                description: 'ID of parent comment to reply to. Omit for top-level comments.'
                            }
                        },
                        required: ['repository', 'prId', 'text']
                    }
                },
                {
                    name: 'get_diff',
                    description: 'Retrieve the code differences (diff) for a pull request showing what lines were added, removed, or modified. Use this to understand the scope of changes, review specific code modifications, or analyze the impact of proposed changes before merging.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            [this.config.isCloud ? 'workspace' : 'project']: {
                                type: 'string',
                                description: this.config.isCloud 
                                    ? 'Bitbucket workspace name. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable.'
                                    : 'Bitbucket project key. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable.'
                            },
                            repository: {type: 'string', description: 'Repository slug containing the pull request.'},
                            prId: {type: 'number', description: 'Pull request ID to get diff for.'},
                            contextLines: {
                                type: 'number',
                                description: 'Number of context lines to show around changes (default: 10). Higher values provide more surrounding code context.'
                            }
                        },
                        required: ['repository', 'prId']
                    }
                },
                {
                    name: 'get_reviews',
                    description: 'Fetch the review history and approval status of a pull request. Use this to check who has reviewed the PR, see approval status, understand review feedback, or determine if the PR is ready for merging based on review requirements.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            [this.config.isCloud ? 'workspace' : 'project']: {
                                type: 'string',
                                description: this.config.isCloud 
                                    ? 'Bitbucket workspace name. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable.'
                                    : 'Bitbucket project key. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable.'
                            },
                            repository: {type: 'string', description: 'Repository slug containing the pull request.'},
                            prId: {type: 'number', description: 'Pull request ID to get reviews for.'}
                        },
                        required: ['repository', 'prId']
                    }
                }
            ]
        }));

        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            try {
                logger.info(`Called tool: ${request.params.name}`, {arguments: request.params.arguments});
                const args = request.params.arguments ?? {};

                // Helper function to get project/workspace with fallback to default
                const getProjectOrWorkspace = (providedValue?: string): string => {
                    const value = providedValue || this.config.defaultProject;
                    if (!value) {
                        const type = this.config.isCloud ? 'workspace' : 'project';
                        throw new McpError(
                            ErrorCode.InvalidParams,
                            `${type} must be provided either as a parameter or through BITBUCKET_DEFAULT_PROJECT environment variable`
                        );
                    }
                    return value;
                };

                switch (request.params.name) {
                    case 'list_projects': {
                        return await this.listProjects({
                            limit: args.limit as number,
                            start: args.start as number
                        });
                    }

                    case 'list_repositories': {
                        return await this.listRepositories({
                            [this.config.isCloud ? 'workspace' : 'project']: args[this.config.isCloud ? 'workspace' : 'project'] as string,
                            limit: args.limit as number,
                            start: args.start as number
                        });
                    }

                    case 'create_pull_request': {
                        if (!this.isPullRequestInput(args)) {
                            throw new McpError(
                                ErrorCode.InvalidParams,
                                'Invalid pull request input parameters'
                            );
                        }
                        // Ensure project/workspace is set
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const createArgs = { ...args, [key]: getProjectOrWorkspace(args[key] as string) };
                        return await this.createPullRequest(createArgs);
                    }

                    case 'get_pull_request': {
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const getPrParams: PullRequestParams = {
                            [key]: getProjectOrWorkspace(args[key] as string),
                            repository: args.repository as string,
                            prId: args.prId as number
                        };
                        return await this.getPullRequest(getPrParams);
                    }

                    case 'merge_pull_request': {
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const mergePrParams: PullRequestParams = {
                            [key]: getProjectOrWorkspace(args[key] as string),
                            repository: args.repository as string,
                            prId: args.prId as number
                        };
                        return await this.mergePullRequest(mergePrParams, {
                            message: args.message as string,
                            strategy: args.strategy as 'merge-commit' | 'squash' | 'fast-forward'
                        });
                    }

                    case 'decline_pull_request': {
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const declinePrParams: PullRequestParams = {
                            [key]: getProjectOrWorkspace(args[key] as string),
                            repository: args.repository as string,
                            prId: args.prId as number
                        };
                        return await this.declinePullRequest(declinePrParams, args.message as string);
                    }

                    case 'add_comment': {
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const commentPrParams: PullRequestParams = {
                            [key]: getProjectOrWorkspace(args[key] as string),
                            repository: args.repository as string,
                            prId: args.prId as number
                        };
                        return await this.addComment(commentPrParams, {
                            text: args.text as string,
                            parentId: args.parentId as number
                        });
                    }

                    case 'get_diff': {
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const diffPrParams: PullRequestParams = {
                            [key]: getProjectOrWorkspace(args[key] as string),
                            repository: args.repository as string,
                            prId: args.prId as number
                        };
                        return await this.getDiff(diffPrParams, args.contextLines as number);
                    }

                    case 'get_reviews': {
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const reviewsPrParams: PullRequestParams = {
                            [key]: getProjectOrWorkspace(args[key] as string),
                            repository: args.repository as string,
                            prId: args.prId as number
                        };
                        return await this.getReviews(reviewsPrParams);
                    }

                    default:
                        throw new McpError(
                            ErrorCode.MethodNotFound,
                            `Unknown tool: ${request.params.name}`
                        );
                }
            } catch (error) {
                logger.error('Tool execution error', {error});
                if (axios.isAxiosError(error)) {
                    const errorMessage = this.config.isCloud 
                        ? error.response?.data?.error?.message || error.response?.data?.message || error.message
                        : error.response?.data.message || error.message;
                    
                    // Provide specific guidance for 401 errors
                    if (error.response?.status === 401) {
                        const authGuidance = this.config.isCloud
                            ? 'For Bitbucket Cloud, ensure you have:\n1. Set BITBUCKET_USERNAME to your Bitbucket username\n2. Set BITBUCKET_TOKEN to your App Password (not OAuth token)\n3. App Password has required scopes: repositories, pullrequests, account'
                            : 'For Bitbucket Server, ensure your token or credentials have sufficient permissions';
                        
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
        });
    }

    private async listProjects(options: ListOptions = {}) {
        const {limit = 25, start = 0} = options;
        
        if (this.config.isCloud) {
            // Bitbucket Cloud: List workspaces
            const response = await this.api.get('/workspaces', {
                params: { pagelen: limit, page: Math.floor(start / limit) + 1 }
            });

            const workspaces = response.data.values || [];
            const summary = {
                total: response.data.size || workspaces.length,
                showing: workspaces.length,
                workspaces: workspaces.map((workspace: { slug: string; name: string; uuid: string; is_private: boolean }) => ({
                    slug: workspace.slug,
                    name: workspace.name,
                    uuid: workspace.uuid,
                    private: workspace.is_private
                }))
            };

            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(summary, null, 2)
                }]
            };
        } else {
            // Bitbucket Server: List projects
            const response = await this.api.get('/projects', {
                params: {limit, start}
            });

            const projects = response.data.values || [];
            const summary = {
                total: response.data.size || projects.length,
                showing: projects.length,
                projects: projects.map((project: {
                    key: string;
                    name: string;
                    description?: string;
                    public: boolean;
                    type: string
                }) => ({
                    key: project.key,
                    name: project.name,
                    description: project.description,
                    public: project.public,
                    type: project.type
                }))
            };

            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(summary, null, 2)
                }]
            };
        }
    }

    private async listRepositories(options: ListRepositoriesOptions = {}) {
        const {limit = 25, start = 0} = options;
        const workspaceOrProject = options.workspace || options.project;
        
        if (this.config.isCloud) {
            // Bitbucket Cloud: List repositories
            let endpoint: string;
            const params = { pagelen: limit, page: Math.floor(start / limit) + 1 };

            if (workspaceOrProject || this.config.defaultProject) {
                const workspace = workspaceOrProject || this.config.defaultProject;
                endpoint = `/repositories/${workspace}`;
            } else {
                endpoint = '/repositories';
                // Add role parameter to get repositories user has access to
                Object.assign(params, { role: 'member' });
            }

            const response = await this.api.get(endpoint, { params });

            const repositories = response.data.values || [];
            const summary = {
                workspace: workspaceOrProject || this.config.defaultProject || 'all',
                total: response.data.size || repositories.length,
                showing: repositories.length,
                repositories: repositories.map((repo: {
                    name: string;
                    full_name: string;
                    description?: string;
                    is_private: boolean;
                    links?: { clone?: { name: string; href: string }[] };
                    owner?: { username: string }
                }) => ({
                    name: repo.name,
                    full_name: repo.full_name,
                    description: repo.description,
                    private: repo.is_private,
                    cloneUrl: repo.links?.clone?.find((link: { name: string; href: string }) => link.name === 'https')?.href,
                    owner: repo.owner?.username
                }))
            };

            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(summary, null, 2)
                }]
            };
        } else {
            // Bitbucket Server: List repositories
            let endpoint: string;
            const params = {limit, start};

            if (workspaceOrProject || this.config.defaultProject) {
                const projectKey = workspaceOrProject || this.config.defaultProject;
                endpoint = `/projects/${projectKey}/repos`;
            } else {
                endpoint = '/repos';
            }

            const response = await this.api.get(endpoint, {params});

            const repositories = response.data.values || [];
            const summary = {
                project: workspaceOrProject || this.config.defaultProject || 'all',
                total: response.data.size || repositories.length,
                showing: repositories.length,
                repositories: repositories.map((repo: {
                    slug: string;
                    name: string;
                    description?: string;
                    project?: { key: string };
                    public: boolean;
                    links?: { clone?: { name: string; href: string }[] };
                    state: string
                }) => ({
                    slug: repo.slug,
                    name: repo.name,
                    description: repo.description,
                    project: repo.project?.key,
                    public: repo.public,
                    cloneUrl: repo.links?.clone?.find((link: { name: string; href: string }) => link.name === 'http')?.href,
                    state: repo.state
                }))
            };

            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(summary, null, 2)
                }]
            };
        }
    }

    private async createPullRequest(input: PullRequestInput) {
        if (this.config.isCloud) {
            // Bitbucket Cloud API
            const workspace = input.workspace || this.config.defaultProject;
            const response = await this.api.post(
                `/repositories/${workspace}/${input.repository}/pullrequests`,
                {
                    title: input.title,
                    description: input.description,
                    source: {
                        branch: {
                            name: input.sourceBranch
                        }
                    },
                    destination: {
                        branch: {
                            name: input.targetBranch
                        }
                    },
                    reviewers: input.reviewers?.map(username => ({ username }))
                }
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        } else {
            // Bitbucket Server API
            const project = input.project || this.config.defaultProject;
            const response = await this.api.post(
                `/projects/${project}/repos/${input.repository}/pull-requests`,
                {
                    title: input.title,
                    description: input.description,
                    fromRef: {
                        id: `refs/heads/${input.sourceBranch}`,
                        repository: {
                            slug: input.repository,
                            project: {key: project}
                        }
                    },
                    toRef: {
                        id: `refs/heads/${input.targetBranch}`,
                        repository: {
                            slug: input.repository,
                            project: {key: project}
                        }
                    },
                    reviewers: input.reviewers?.map(username => ({user: {name: username}}))
                }
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        }
    }

    private async getPullRequest(params: PullRequestParams) {
        const {repository, prId} = params;
        
        if (!repository || !prId) {
            throw new McpError(
                ErrorCode.InvalidParams,
                'Repository and prId are required'
            );
        }
        
        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    'Workspace is required for Bitbucket Cloud'
                );
            }

            const response = await this.api.get(
                `/repositories/${workspace}/${repository}/pullrequests/${prId}`
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        } else {
            const project = params.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    'Project is required for Bitbucket Server'
                );
            }

            const response = await this.api.get(
                `/projects/${project}/repos/${repository}/pull-requests/${prId}`
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        }
    }

    private async mergePullRequest(params: PullRequestParams, options: MergeOptions = {}) {
        const {repository, prId} = params;
        
        if (!repository || !prId) {
            throw new McpError(
                ErrorCode.InvalidParams,
                'Repository and prId are required'
            );
        }
        
        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    'Workspace is required for Bitbucket Cloud'
                );
            }

            // First approve the PR, then merge it (Bitbucket Cloud requires approval)
            const response = await this.api.post(
                `/repositories/${workspace}/${repository}/pullrequests/${prId}/merge`,
                {
                    message: options.message,
                    merge_strategy: options.strategy || 'merge_commit'
                }
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        } else {
            const project = params.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    'Project is required for Bitbucket Server'
                );
            }

            const response = await this.api.post(
                `/projects/${project}/repos/${repository}/pull-requests/${prId}/merge`,
                {
                    version: -1,
                    message: options.message,
                    strategy: options.strategy || 'merge-commit'
                }
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        }
    }

    private async declinePullRequest(params: PullRequestParams, message?: string) {
        const {repository, prId} = params;
        
        if (!repository || !prId) {
            throw new McpError(
                ErrorCode.InvalidParams,
                'Repository and prId are required'
            );
        }
        
        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    'Workspace is required for Bitbucket Cloud'
                );
            }

            const response = await this.api.post(
                `/repositories/${workspace}/${repository}/pullrequests/${prId}/decline`,
                message ? { reason: message } : {}
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        } else {
            const project = params.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    'Project is required for Bitbucket Server'
                );
            }

            const response = await this.api.post(
                `/projects/${project}/repos/${repository}/pull-requests/${prId}/decline`,
                {
                    version: -1,
                    message
                }
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        }
    }

    private async addComment(params: PullRequestParams, options: CommentOptions) {
        const {repository, prId} = params;
        
        if (!repository || !prId) {
            throw new McpError(
                ErrorCode.InvalidParams,
                'Repository and prId are required'
            );
        }
        
        const {text, parentId} = options;
        
        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    'Workspace is required for Bitbucket Cloud'
                );
            }

            const response = await this.api.post(
                `/repositories/${workspace}/${repository}/pullrequests/${prId}/comments`,
                {
                    content: {
                        raw: text
                    },
                    parent: parentId ? { id: parentId } : undefined
                }
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        } else {
            const project = params.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    'Project is required for Bitbucket Server'
                );
            }

            const response = await this.api.post(
                `/projects/${project}/repos/${repository}/pull-requests/${prId}/comments`,
                {
                    text,
                    parent: parentId ? {id: parentId} : undefined
                }
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        }
    }

    private async getDiff(params: PullRequestParams, contextLines: number = 10) {
        const {repository, prId} = params;
        
        if (!repository || !prId) {
            throw new McpError(
                ErrorCode.InvalidParams,
                'Repository and prId are required'
            );
        }
        
        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    'Workspace is required for Bitbucket Cloud'
                );
            }

            const response = await this.api.get(
                `/repositories/${workspace}/${repository}/pullrequests/${prId}/diff`,
                {
                    params: { context: contextLines },
                    headers: { Accept: 'text/plain' }
                }
            );

            return {
                content: [{type: 'text', text: response.data}]
            };
        } else {
            const project = params.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    'Project is required for Bitbucket Server'
                );
            }

            const response = await this.api.get(
                `/projects/${project}/repos/${repository}/pull-requests/${prId}/diff`,
                {
                    params: {contextLines},
                    headers: {Accept: 'text/plain'}
                }
            );

            return {
                content: [{type: 'text', text: response.data}]
            };
        }
    }

    private async getReviews(params: PullRequestParams) {
        const {repository, prId} = params;
        
        if (!repository || !prId) {
            throw new McpError(
                ErrorCode.InvalidParams,
                'Repository and prId are required'
            );
        }
        
        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    'Workspace is required for Bitbucket Cloud'
                );
            }

            // Bitbucket Cloud doesn't have a direct reviews endpoint, get PR data instead
            const response = await this.api.get(
                `/repositories/${workspace}/${repository}/pullrequests/${prId}`
            );

            const reviews = {
                participants: response.data.participants || [],
                reviewers: response.data.reviewers || []
            };

            return {
                content: [{type: 'text', text: JSON.stringify(reviews, null, 2)}]
            };
        } else {
            const project = params.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    'Project is required for Bitbucket Server'
                );
            }

            const response = await this.api.get(
                `/projects/${project}/repos/${repository}/pull-requests/${prId}/activities`
            );

            const reviews = response.data.values.filter(
                (activity: BitbucketActivity) => activity.action === 'APPROVED' || activity.action === 'REVIEWED'
            );

            return {
                content: [{type: 'text', text: JSON.stringify(reviews, null, 2)}]
            };
        }
    }

    async run() {
        try {
            const transport = new StdioServerTransport();
            
            // Set up graceful shutdown
            const cleanup = () => {
                logger.info('Shutting down Bitbucket MCP server...');
                process.exit(0);
            };

            // Handle process signals
            process.on('SIGINT', cleanup);
            process.on('SIGTERM', cleanup);
            process.on('SIGQUIT', cleanup);

            // Handle uncaught exceptions
            process.on('uncaughtException', (error) => {
                logger.error('Uncaught exception:', error);
                process.exit(1);
            });

            process.on('unhandledRejection', (reason, promise) => {
                logger.error('Unhandled rejection at:', promise, 'reason:', reason);
                process.exit(1);
            });

            await this.server.connect(transport);
            logger.info('Bitbucket MCP server running on stdio');

            // Keep the process alive
            process.stdin.resume();
            
        } catch (error) {
            logger.error('Failed to start server:', error);
            process.exit(1);
        }
    }
}

// Create and start server with proper error handling
async function main() {
    try {
        const server = new BitbucketServer();
        await server.run();
    } catch (error) {
        logger.error('Server startup failed:', error);
        process.exit(1);
    }
}

// Start the server
main().catch((error) => {
    logger.error('Unexpected error during startup:', error);
    process.exit(1);
});