import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError} from '@modelcontextprotocol/sdk/types.js';
import winston from 'winston';

import {createBitbucketConfig, getProjectOrWorkspace} from './config/bitbucket-config.js';
import {createApiClient} from './utils/api-client.js';
import {handleApiError} from './utils/error-handler.js';
import {createToolDefinitions} from './tools/tool-definitions.js';
import {BranchHandler, CommitHandler, PullRequestHandler, RepositoryHandler} from './handlers/handlers.js';
import {BitbucketConfig, BranchParams, CommitParams, PullRequestInput, PullRequestParams, FileParams} from './types/interfaces.js';

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

export class BitbucketServer {
    private readonly server: Server;
    private readonly config: BitbucketConfig;
    private readonly api: any;
    
    // Handlers
    private readonly repositoryHandler: RepositoryHandler;
    private readonly pullRequestHandler: PullRequestHandler;
    private readonly branchHandler: BranchHandler;
    private readonly commitHandler: CommitHandler;

    constructor() {
        this.server = new Server(
            {
                name: 'bitbucket-server-mcp-server',
                version: '2.0.0',
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );

        // Initialize configuration and API client
        this.config = createBitbucketConfig();
        this.api = createApiClient(this.config);

        // Initialize handlers
        this.repositoryHandler = new RepositoryHandler(this.api, this.config);
        this.pullRequestHandler = new PullRequestHandler(this.api, this.config);
        this.branchHandler = new BranchHandler(this.api, this.config);
        this.commitHandler = new CommitHandler(this.api, this.config);

        logger.info(`🔧 Initialized for ${this.config.isCloud ? 'Bitbucket Cloud' : 'Bitbucket Server'}`, {
            baseUrl: this.config.baseUrl,
            authMethod: this.config.isCloud
                ? (this.config.token ? 'Basic Auth (App Password)' : 'Basic Auth (Username/Password)')
                : (this.config.token ? 'Bearer Token (Personal Access Token)' : 'Basic Auth (Username/Password)'),
            hasAuth: !!(this.config.token || (this.config.username && this.config.password)),
            username: this.config.username || 'not provided',
            defaultProject: this.config.defaultProject || 'not set'
        });

        this.setupToolHandlers();

        // Improved error handling for MCP errors
        this.server.onerror = (error) => {
            logger.error('❌ [MCP Error]', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
        };
    }

    async run() {
        try {
            const transport = new StdioServerTransport();

            // Set up graceful shutdown
            const cleanup = () => {
                logger.info('🛑 Shutting down Bitbucket MCP server...');
                process.exit(0);
            };

            // Handle process signals
            process.on('SIGINT', cleanup);
            process.on('SIGTERM', cleanup);
            process.on('SIGQUIT', cleanup);

            // Handle uncaught exceptions
            process.on('uncaughtException', (error) => {
                logger.error('💥 Uncaught exception:', error);
                process.exit(1);
            });

            process.on('unhandledRejection', (reason, promise) => {
                logger.error('💥 Unhandled rejection at:', promise, 'reason:', reason);
                process.exit(1);
            });

            await this.server.connect(transport);
            logger.info('🚀 Bitbucket MCP server running on stdio');

            // Keep the process alive
            process.stdin.resume();

        } catch (error) {
            logger.error('💥 Failed to start server:', error);
            process.exit(1);
        }
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
        const toolDefinitions = createToolDefinitions(this.config);
        
        logger.info('🛠️ Registering tools', {
            toolCount: toolDefinitions.length,
            toolNames: toolDefinitions.map(t => t.name)
        });

        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            logger.debug('📋 List tools requested');
            return { tools: toolDefinitions };
        });

        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const toolName = request.params.name;
            const rawArgs = request.params.arguments ?? {};
            
            logger.info(`🔧 Called tool: ${toolName}`, {
                arguments: rawArgs,
                toolName
            });

            // Clean up parameter names - remove trailing underscores and fix common issues
            const args: any = {};
            Object.keys(rawArgs).forEach(key => {
                const cleanKey = key.endsWith('_') ? key.slice(0, -1) : key;
                const finalKey = cleanKey === 'workspaceOpt' ? 'workspace' : cleanKey;
                args[finalKey] = (rawArgs as any)[key];
            });

            logger.debug('🔍 Processed parameters', {
                toolName,
                rawArgs,
                processedArgs: args,
                parameterCount: Object.keys(args).length
            });

            try {

                switch (toolName) {
                    // Repository Operations
                    case 'list_projects': {
                        logger.debug('📂 Executing list_projects');
                        return await this.repositoryHandler.listProjects({
                            limit: args.limit as number,
                            start: args.start as number
                        });
                    }

                    case 'list_repositories': {
                        logger.debug('📂 Executing list_repositories');
                        return await this.repositoryHandler.listRepositories({
                            [this.config.isCloud ? 'workspace' : 'project']: args[this.config.isCloud ? 'workspace' : 'project'] as string,
                            limit: args.limit as number,
                            start: args.start as number
                        });
                    }

                    case 'create_repository': {
                        logger.debug('📂 Executing create_repository');
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const resolvedProject = getProjectOrWorkspace(this.config, args[key] as string);
                        logger.debug('🎯 Resolved project/workspace', {
                            key,
                            provided: args[key],
                            resolved: resolvedProject,
                            default: this.config.defaultProject
                        });
                        return await this.repositoryHandler.createRepository(
                            resolvedProject,
                            {
                                name: args.name as string,
                                description: args.description as string,
                                isPrivate: args.isPrivate as boolean,
                                forkPolicy: args.forkPolicy as string,
                                language: args.language as string,
                                hasIssues: args.hasIssues as boolean,
                                hasWiki: args.hasWiki as boolean
                            }
                        );
                    }

                    // Pull Request Operations
                    case 'create_pull_request': {
                        logger.debug('🔀 Executing create_pull_request');
                        if (!this.isPullRequestInput(args)) {
                            logger.error('❌ Invalid pull request input parameters', {args});
                            throw new McpError(
                                ErrorCode.InvalidParams,
                                'Invalid pull request input parameters'
                            );
                        }
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const resolvedProject = getProjectOrWorkspace(this.config, args[key] as string);
                        logger.debug('🎯 Resolved project/workspace for PR', {
                            key,
                            provided: args[key],
                            resolved: resolvedProject,
                            default: this.config.defaultProject,
                            sourceBranch: args.sourceBranch,
                            targetBranch: args.targetBranch
                        });
                        const createArgs = {...args, [key]: resolvedProject};
                        return await this.pullRequestHandler.createPullRequest(createArgs);
                    }

                    case 'get_pull_request': {
                        logger.debug('🔀 Executing get_pull_request');
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const resolvedProject = getProjectOrWorkspace(this.config, args[key] as string);
                        logger.debug('🎯 Resolved project/workspace for get PR', {
                            key,
                            provided: args[key],
                            resolved: resolvedProject,
                            prId: args.prId
                        });
                        const getPrParams: PullRequestParams = {
                            [key]: resolvedProject,
                            repository: args.repository as string,
                            prId: args.prId as number
                        };
                        return await this.pullRequestHandler.getPullRequest(getPrParams);
                    }

                    case 'merge_pull_request': {
                        logger.debug('🔀 Executing merge_pull_request');
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const resolvedProject = getProjectOrWorkspace(this.config, args[key] as string);
                        const mergePrParams: PullRequestParams = {
                            [key]: resolvedProject,
                            repository: args.repository as string,
                            prId: args.prId as number
                        };
                        return await this.pullRequestHandler.mergePullRequest(mergePrParams, {
                            message: args.message as string,
                            strategy: args.strategy as 'merge-commit' | 'squash' | 'fast-forward'
                        });
                    }

                    case 'add_comment': {
                        logger.debug('💬 Executing add_comment');
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const resolvedProject = getProjectOrWorkspace(this.config, args[key] as string);
                        const commentPrParams: PullRequestParams = {
                            [key]: resolvedProject,
                            repository: args.repository as string,
                            prId: args.prId as number
                        };
                        return await this.pullRequestHandler.addComment(commentPrParams, {
                            text: args.text as string,
                            parentId: args.parentId as number
                        });
                    }

                    // Branch Operations
                    case 'list_branches': {
                        logger.debug('🌿 Executing list_branches');
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const resolvedProject = getProjectOrWorkspace(this.config, args[key] as string);
                        const branchParams: BranchParams = {
                            [key]: resolvedProject,
                            repository: args.repository as string
                        };
                        return await this.branchHandler.listBranches(branchParams, {
                            limit: args.limit as number,
                            start: args.start as number
                        });
                    }

                    case 'create_branch': {
                        logger.debug('🌿 Executing create_branch');
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const resolvedProject = getProjectOrWorkspace(this.config, args[key] as string);
                        const branchParams: BranchParams = {
                            [key]: resolvedProject,
                            repository: args.repository as string,
                            branchName: args.branchName as string
                        };
                        return await this.branchHandler.createBranch(branchParams, args.startPoint as string);
                    }

                    // Commit Operations
                    case 'list_commits': {
                        logger.debug('📝 Executing list_commits');
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const resolvedProject = getProjectOrWorkspace(this.config, args[key] as string);
                        const commitParams: CommitParams = {
                            [key]: resolvedProject,
                            repository: args.repository as string,
                            branch: args.branch as string
                        };
                        return await this.commitHandler.listCommits(commitParams, {
                            limit: args.limit as number,
                            start: args.start as number
                        });
                    }

                    case 'get_commit': {
                        logger.debug('📝 Executing get_commit');
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const resolvedProject = getProjectOrWorkspace(this.config, args[key] as string);
                        const commitParams: CommitParams = {
                            [key]: resolvedProject,
                            repository: args.repository as string,
                            commitId: args.commitId as string
                        };
                        return await this.commitHandler.getCommit(commitParams);
                    }

                    // File Operations - ADD MISSING HANDLERS
                    case 'get_file_content': {
                        logger.debug('📄 Executing get_file_content');
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const resolvedProject = getProjectOrWorkspace(this.config, args[key] as string);
                        const fileParams: FileParams = {
                            [key]: resolvedProject,
                            repository: args.repository as string,
                            path: args.path as string,
                            branch: args.branch as string,
                            commitId: args.commitId as string
                        };
                        return await this.getFileContent(fileParams);
                    }

                    case 'list_directory': {
                        logger.debug('📁 Executing list_directory');
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const resolvedProject = getProjectOrWorkspace(this.config, args[key] as string);
                        const fileParams: FileParams = {
                            [key]: resolvedProject,
                            repository: args.repository as string,
                            path: args.path as string,
                            branch: args.branch as string,
                            commitId: args.commitId as string
                        };
                        return await this.listDirectory(fileParams);
                    }

                    // Add more cases for other tools...

                    default:
                        logger.error('❌ Unknown tool requested', {toolName, availableTools: toolDefinitions.map(t => t.name)});
                        throw new McpError(
                            ErrorCode.MethodNotFound,
                            `Unknown tool: ${toolName}`
                        );
                }
            } catch (error) {
                logger.error('💥 Tool execution error', {
                    toolName,
                    error: error instanceof Error ? {
                        message: error.message,
                        stack: error.stack,
                        name: error.name
                    } : error,
                    arguments: args
                });
                handleApiError(error, this.config);
            }
        });
    }

    // Add missing file operation methods
    private async getFileContent(params: FileParams) {
        const {repository, path} = params;

        if (!repository || !path) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository and path are required');
        }

        logger.debug('📄 Getting file content', {params});

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            const ref = params.commitId || params.branch || 'HEAD';
            const response = await this.api.get(
                `/repositories/${workspace}/${repository}/src/${ref}/${path}`
            );

            return {
                content: [{type: 'text', text: response.data}]
            };
        } else {
            const project = params.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(ErrorCode.InvalidParams, 'Project is required for Bitbucket Server');
            }

            const ref = params.commitId || params.branch || 'HEAD';
            const response = await this.api.get(
                `/projects/${project}/repos/${repository}/browse/${path}`,
                {params: {at: ref, raw: true}}
            );

            return {
                content: [{type: 'text', text: response.data}]
            };
        }
    }

    private async listDirectory(params: FileParams) {
        const {repository} = params;
        const dirPath = params.path || '';

        if (!repository) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository is required');
        }

        logger.debug('📁 Listing directory', {params});

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            const ref = params.commitId || params.branch || 'HEAD';
            const response = await this.api.get(
                `/repositories/${workspace}/${repository}/src/${ref}/${dirPath}`
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        } else {
            const project = params.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(ErrorCode.InvalidParams, 'Project is required for Bitbucket Server');
            }

            const ref = params.commitId || params.branch || 'HEAD';
            const response = await this.api.get(
                `/projects/${project}/repos/${repository}/browse/${dirPath}`,
                {params: {at: ref}}
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        }
    }
} 