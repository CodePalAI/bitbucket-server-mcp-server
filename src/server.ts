import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError} from '@modelcontextprotocol/sdk/types.js';
import winston from 'winston';

import {createBitbucketConfig, getProjectOrWorkspace} from './config/bitbucket-config.js';
import {createApiClient} from './utils/api-client.js';
import {handleApiError} from './utils/error-handler.js';
import {createToolDefinitions} from './tools/tool-definitions.js';
import {BranchHandler, CommitHandler, PullRequestHandler, RepositoryHandler} from './handlers/handlers.js';
import {BitbucketConfig, BranchParams, CommitParams, PullRequestInput, PullRequestParams} from './types/interfaces.js';

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

        logger.info(`Initialized for ${this.config.isCloud ? 'Bitbucket Cloud' : 'Bitbucket Server'}`, {
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
            logger.error('[MCP Error]', {
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
            tools: createToolDefinitions(this.config)
        }));

        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            try {
                logger.info(`Called tool: ${request.params.name}`, {arguments: request.params.arguments});
                const args = request.params.arguments ?? {};

                switch (request.params.name) {
                    // Repository Operations
                    case 'list_projects': {
                        return await this.repositoryHandler.listProjects({
                            limit: args.limit as number,
                            start: args.start as number
                        });
                    }

                    case 'list_repositories': {
                        return await this.repositoryHandler.listRepositories({
                            [this.config.isCloud ? 'workspace' : 'project']: args[this.config.isCloud ? 'workspace' : 'project'] as string,
                            limit: args.limit as number,
                            start: args.start as number
                        });
                    }

                    case 'create_repository': {
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        return await this.repositoryHandler.createRepository(
                            getProjectOrWorkspace(this.config, args[key] as string),
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
                        if (!this.isPullRequestInput(args)) {
                            throw new McpError(
                                ErrorCode.InvalidParams,
                                'Invalid pull request input parameters'
                            );
                        }
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const createArgs = {...args, [key]: getProjectOrWorkspace(this.config, args[key] as string)};
                        return await this.pullRequestHandler.createPullRequest(createArgs);
                    }

                    case 'get_pull_request': {
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const getPrParams: PullRequestParams = {
                            [key]: getProjectOrWorkspace(this.config, args[key] as string),
                            repository: args.repository as string,
                            prId: args.prId as number
                        };
                        return await this.pullRequestHandler.getPullRequest(getPrParams);
                    }

                    case 'merge_pull_request': {
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const mergePrParams: PullRequestParams = {
                            [key]: getProjectOrWorkspace(this.config, args[key] as string),
                            repository: args.repository as string,
                            prId: args.prId as number
                        };
                        return await this.pullRequestHandler.mergePullRequest(mergePrParams, {
                            message: args.message as string,
                            strategy: args.strategy as 'merge-commit' | 'squash' | 'fast-forward'
                        });
                    }

                    case 'add_comment': {
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const commentPrParams: PullRequestParams = {
                            [key]: getProjectOrWorkspace(this.config, args[key] as string),
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
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const branchParams: BranchParams = {
                            [key]: getProjectOrWorkspace(this.config, args[key] as string),
                            repository: args.repository as string
                        };
                        return await this.branchHandler.listBranches(branchParams, {
                            limit: args.limit as number,
                            start: args.start as number
                        });
                    }

                    case 'create_branch': {
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const branchParams: BranchParams = {
                            [key]: getProjectOrWorkspace(this.config, args[key] as string),
                            repository: args.repository as string,
                            branchName: args.branchName as string
                        };
                        return await this.branchHandler.createBranch(branchParams, args.startPoint as string);
                    }

                    // Commit Operations
                    case 'list_commits': {
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const commitParams: CommitParams = {
                            [key]: getProjectOrWorkspace(this.config, args[key] as string),
                            repository: args.repository as string,
                            branch: args.branch as string
                        };
                        return await this.commitHandler.listCommits(commitParams, {
                            limit: args.limit as number,
                            start: args.start as number
                        });
                    }

                    case 'get_commit': {
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const commitParams: CommitParams = {
                            [key]: getProjectOrWorkspace(this.config, args[key] as string),
                            repository: args.repository as string,
                            commitId: args.commitId as string
                        };
                        return await this.commitHandler.getCommit(commitParams);
                    }

                    // Add more cases for other tools...

                    default:
                        throw new McpError(
                            ErrorCode.MethodNotFound,
                            `Unknown tool: ${request.params.name}`
                        );
                }
            } catch (error) {
                logger.error('Tool execution error', {error});
                handleApiError(error, this.config);
            }
        });
    }
} 