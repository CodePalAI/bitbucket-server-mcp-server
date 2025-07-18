import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError} from '@modelcontextprotocol/sdk/types.js';
import winston from 'winston';

import {createBitbucketConfig, getProjectOrWorkspace} from './config/bitbucket-config.js';
import {createApiClient} from './utils/api-client.js';
import {handleApiError} from './utils/error-handler.js';
import {createToolDefinitions} from './tools/tool-definitions.js';
import {
    BranchHandler,
    BranchRestrictionHandler,
    BuildStatusHandler,
    CommitCommentHandler,
    CommitHandler,
    DeployKeyHandler,
    DeploymentHandler,
    DiffHandler,
    DownloadHandler,
    ForkHandler,
    IssueHandler,
    PermissionHandler,
    PipelineHandler,
    PullRequestHandler,
    RepositoryHandler,
    SearchHandler,
    SnippetHandler,
    SshKeyHandler,
    TagHandler,
    UserHandler,
    WatcherHandler,
    WebhookHandler
} from './handlers/handlers.js';
import {
    BitbucketConfig,
    BranchParams,
    CommitParams,
    FileParams,
    PullRequestInput,
    PullRequestParams
} from './types/interfaces.js';

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
    private server: Server;
    private config: BitbucketConfig;
    private api: any;
    private branchHandler: BranchHandler;
    private branchRestrictionHandler: BranchRestrictionHandler;
    private commitHandler: CommitHandler;
    private commitCommentHandler: CommitCommentHandler;
    private repositoryHandler: RepositoryHandler;
    private pullRequestHandler: PullRequestHandler;
    private issueHandler: IssueHandler;
    private webhookHandler: WebhookHandler;
    private sshKeyHandler: SshKeyHandler;
    private deployKeyHandler: DeployKeyHandler;
    private tagHandler: TagHandler;
    private watcherHandler: WatcherHandler;
    private userHandler: UserHandler;
    private searchHandler: SearchHandler;
    private permissionHandler: PermissionHandler;
    private diffHandler: DiffHandler;
    private downloadHandler: DownloadHandler;
    private forkHandler: ForkHandler;
    private pipelineHandler?: PipelineHandler;
    private buildStatusHandler?: BuildStatusHandler;
    private snippetHandler?: SnippetHandler;
    private deploymentHandler?: DeploymentHandler;

    constructor() {
        this.config = createBitbucketConfig();
        this.api = createApiClient(this.config);
        this.server = new Server(
            {
                name: 'bitbucket-mcp-server',
                version: '1.0.0'
            },
            {
                capabilities: {
                    resources: {},
                    tools: {}
                }
            }
        );

        // Initialize handlers
        this.branchHandler = new BranchHandler(this.api, this.config);
        this.branchRestrictionHandler = new BranchRestrictionHandler(this.api, this.config);
        this.commitHandler = new CommitHandler(this.api, this.config);
        this.commitCommentHandler = new CommitCommentHandler(this.api, this.config);
        this.repositoryHandler = new RepositoryHandler(this.api, this.config);
        this.pullRequestHandler = new PullRequestHandler(this.api, this.config);
        this.issueHandler = new IssueHandler(this.api, this.config);
        this.webhookHandler = new WebhookHandler(this.api, this.config);
        this.sshKeyHandler = new SshKeyHandler(this.api, this.config);
        this.deployKeyHandler = new DeployKeyHandler(this.api, this.config);
        this.tagHandler = new TagHandler(this.api, this.config);
        this.watcherHandler = new WatcherHandler(this.api, this.config);
        this.userHandler = new UserHandler(this.api, this.config);
        this.searchHandler = new SearchHandler(this.api, this.config);
        this.permissionHandler = new PermissionHandler(this.api, this.config);
        this.diffHandler = new DiffHandler(this.api, this.config);
        this.downloadHandler = new DownloadHandler(this.api, this.config);
        this.forkHandler = new ForkHandler(this.api, this.config);

        // Platform-specific handlers
        if (this.config.isCloud) {
            this.pipelineHandler = new PipelineHandler(this.api, this.config);
            this.snippetHandler = new SnippetHandler(this.api, this.config);
            this.deploymentHandler = new DeploymentHandler(this.api, this.config);
        } else {
            this.buildStatusHandler = new BuildStatusHandler(this.api, this.config);
        }

        this.setupHandlers();

        logger.info(`🔧 Initialized for ${this.config.isCloud ? 'Bitbucket Cloud' : 'Bitbucket Server'}`, {
            baseUrl: this.config.baseUrl,
            authMethod: this.config.isCloud
                ? (this.config.token ? 'Basic Auth (App Password)' : 'Basic Auth (Username/Password)')
                : (this.config.token ? 'Bearer Token (Personal Access Token)' : 'Basic Auth (Username/Password)'),
            hasAuth: !!(this.config.token || (this.config.username && this.config.password)),
            username: this.config.username || 'not provided',
            defaultProject: this.config.defaultProject || 'not set'
        });
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

    private setupHandlers() {
        const toolDefinitions = createToolDefinitions(this.config);

        logger.info('🛠️ Registering tools', {
            toolCount: toolDefinitions.length,
            toolNames: toolDefinitions.map(t => t.name)
        });

        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            logger.debug('📋 List tools requested');
            return {tools: toolDefinitions};
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

                    case 'update_repository': {
                        logger.debug('📂 Executing update_repository');
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const resolvedProject = getProjectOrWorkspace(this.config, args[key] as string);
                        return await this.repositoryHandler.updateRepository(
                            resolvedProject,
                            args.repository as string,
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

                    case 'fork_repository': {
                        logger.debug('🍴 Executing fork_repository');
                        const projectOrWorkspace = getProjectOrWorkspace(this.config, 
                            this.config.isCloud ? args.workspace as string : args.project as string);
                        return await this.forkHandler.forkRepository({
                            ...(this.config.isCloud ? { workspace: projectOrWorkspace } : { project: projectOrWorkspace }),
                            repository: args.repository as string,
                            newName: args.newName as string,
                            targetWorkspace: args.targetWorkspace as string,
                            targetProject: args.targetProject as string,
                            isPrivate: args.isPrivate as boolean
                        });
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

                    case 'list_pull_requests': {
                        logger.debug('🔀 Executing list_pull_requests');
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const resolvedProject = getProjectOrWorkspace(this.config, args[key] as string);
                        return await this.pullRequestHandler.listPullRequests({
                            [key]: resolvedProject,
                            repository: args.repository as string,
                            state: args.state as string,
                            author: args.author as string,
                            limit: args.limit as number,
                            start: args.start as number
                        });
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

                    case 'decline_pull_request': {
                        logger.debug('🔀 Executing decline_pull_request');
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const resolvedProject = getProjectOrWorkspace(this.config, args[key] as string);
                        const declinePrParams: PullRequestParams = {
                            [key]: resolvedProject,
                            repository: args.repository as string,
                            prId: args.prId as number
                        };
                        return await this.pullRequestHandler.declinePullRequest(declinePrParams, args.message as string);
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

                    case 'delete_branch': {
                        logger.debug('🌿 Executing delete_branch');
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const resolvedProject = getProjectOrWorkspace(this.config, args[key] as string);
                        return await this.branchHandler.deleteBranch({
                            [key]: resolvedProject,
                            repository: args.repository as string,
                            branchName: args.branchName as string
                        });
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

                    case 'get_diff': {
                        logger.debug('📝 Executing get_diff');
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const resolvedProject = getProjectOrWorkspace(this.config, args[key] as string);
                        return await this.diffHandler.getDiff({
                            [key]: resolvedProject,
                            repository: args.repository as string,
                            spec: args.spec as string,
                            path: args.path as string,
                            context: args.context as number,
                            ignore_whitespace: args.ignore_whitespace as boolean
                        });
                    }

                    // File Operations
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

                    // Tag Operations
                    case 'list_tags': {
                        logger.debug('🏷️ Executing list_tags');
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const resolvedProject = getProjectOrWorkspace(this.config, args[key] as string);
                        return await this.tagHandler.listTags({
                            [key]: resolvedProject,
                            repository: args.repository as string,
                            limit: args.limit as number,
                            start: args.start as number
                        });
                    }

                    case 'create_tag': {
                        logger.debug('🏷️ Executing create_tag');
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const resolvedProject = getProjectOrWorkspace(this.config, args[key] as string);
                        return await this.tagHandler.createTag({
                            [key]: resolvedProject,
                            repository: args.repository as string,
                            name: args.name as string,
                            target: args.target as string,
                            message: args.message as string
                        });
                    }

                    case 'delete_tag': {
                        logger.debug('🏷️ Executing delete_tag');
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const resolvedProject = getProjectOrWorkspace(this.config, args[key] as string);
                        return await this.tagHandler.deleteTag({
                            [key]: resolvedProject,
                            repository: args.repository as string,
                            name: args.name as string
                        });
                    }

                    // Issue Operations
                    case 'list_issues': {
                        logger.debug('🐛 Executing list_issues');
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const resolvedProject = getProjectOrWorkspace(this.config, args[key] as string);
                        return await this.issueHandler.listIssues({
                            [key]: resolvedProject,
                            repository: args.repository as string,
                            state: args.state as string,
                            assignee: args.assignee as string,
                            milestone: args.milestone as string,
                            limit: args.limit as number,
                            start: args.start as number
                        });
                    }

                    case 'create_issue': {
                        logger.debug('🐛 Executing create_issue');
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const resolvedProject = getProjectOrWorkspace(this.config, args[key] as string);
                        return await this.issueHandler.createIssue({
                            [key]: resolvedProject,
                            repository: args.repository as string,
                            title: args.title as string,
                            content: args.content as string,
                            priority: args.priority as string,
                            kind: args.kind as string,
                            assignee: args.assignee as string,
                            milestone: args.milestone as string
                        });
                    }

                    case 'get_issue': {
                        logger.debug('🐛 Executing get_issue');
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const resolvedProject = getProjectOrWorkspace(this.config, args[key] as string);
                        return await this.issueHandler.getIssue({
                            [key]: resolvedProject,
                            repository: args.repository as string,
                            issueId: args.issueId as number
                        });
                    }

                    case 'update_issue': {
                        logger.debug('🐛 Executing update_issue');
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const resolvedProject = getProjectOrWorkspace(this.config, args[key] as string);
                        return await this.issueHandler.updateIssue({
                            [key]: resolvedProject,
                            repository: args.repository as string,
                            issueId: args.issueId as number,
                            title: args.title as string,
                            content: args.content as string,
                            state: args.state as string,
                            priority: args.priority as string,
                            kind: args.kind as string,
                            assignee: args.assignee as string,
                            milestone: args.milestone as string
                        });
                    }

                    // Webhook Operations
                    case 'list_webhooks': {
                        logger.debug('🪝 Executing list_webhooks');
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const resolvedProject = getProjectOrWorkspace(this.config, args[key] as string);
                        return await this.webhookHandler.listWebhooks({
                            [key]: resolvedProject,
                            repository: args.repository as string
                        });
                    }

                    case 'create_webhook': {
                        logger.debug('🪝 Executing create_webhook');
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const resolvedProject = getProjectOrWorkspace(this.config, args[key] as string);
                        return await this.webhookHandler.createWebhook({
                            [key]: resolvedProject,
                            repository: args.repository as string,
                            url: args.url as string,
                            description: args.description as string,
                            active: args.active as boolean,
                            events: args.events as string[],
                            secret: args.secret as string
                        });
                    }

                    case 'get_webhook': {
                        logger.debug('🪝 Executing get_webhook');
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const resolvedProject = getProjectOrWorkspace(this.config, args[key] as string);
                        return await this.webhookHandler.getWebhook({
                            [key]: resolvedProject,
                            repository: args.repository as string,
                            webhookId: args.webhookId as string
                        });
                    }

                    case 'update_webhook': {
                        logger.debug('🪝 Executing update_webhook');
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const resolvedProject = getProjectOrWorkspace(this.config, args[key] as string);
                        return await this.webhookHandler.updateWebhook({
                            [key]: resolvedProject,
                            repository: args.repository as string,
                            webhookId: args.webhookId as string,
                            url: args.url as string,
                            description: args.description as string,
                            active: args.active as boolean,
                            events: args.events as string[],
                            secret: args.secret as string
                        });
                    }

                    case 'delete_webhook': {
                        logger.debug('🪝 Executing delete_webhook');
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const resolvedProject = getProjectOrWorkspace(this.config, args[key] as string);
                        return await this.webhookHandler.deleteWebhook({
                            [key]: resolvedProject,
                            repository: args.repository as string,
                            webhookId: args.webhookId as string
                        });
                    }

                    // SSH Key Operations
                    case 'list_ssh_keys': {
                        logger.debug('🔑 Executing list_ssh_keys');
                        return await this.sshKeyHandler.listSshKeys({
                            limit: args.limit as number,
                            start: args.start as number
                        });
                    }

                    case 'add_ssh_key': {
                        logger.debug('🔑 Executing add_ssh_key');
                        return await this.sshKeyHandler.addSshKey({
                            key: args.key as string,
                            label: args.label as string
                        });
                    }

                    case 'delete_ssh_key': {
                        logger.debug('🔑 Executing delete_ssh_key');
                        return await this.sshKeyHandler.deleteSshKey({
                            keyId: args.keyId as string
                        });
                    }

                    // Deploy Key Operations
                    case 'list_deploy_keys': {
                        logger.debug('🔑 Executing list_deploy_keys');
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const resolvedProject = getProjectOrWorkspace(this.config, args[key] as string);
                        return await this.deployKeyHandler.listDeployKeys({
                            [key]: resolvedProject,
                            repository: args.repository as string
                        });
                    }

                    case 'add_deploy_key': {
                        logger.debug('🔑 Executing add_deploy_key');
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const resolvedProject = getProjectOrWorkspace(this.config, args[key] as string);
                        return await this.deployKeyHandler.addDeployKey({
                            [key]: resolvedProject,
                            repository: args.repository as string,
                            key: args.key as string,
                            label: args.label as string
                        });
                    }

                    case 'delete_deploy_key': {
                        logger.debug('🔑 Executing delete_deploy_key');
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const resolvedProject = getProjectOrWorkspace(this.config, args[key] as string);
                        return await this.deployKeyHandler.deleteDeployKey({
                            [key]: resolvedProject,
                            repository: args.repository as string,
                            keyId: args.keyId as string
                        });
                    }

                    // Watcher Operations
                    case 'list_watchers': {
                        logger.debug('👁️ Executing list_watchers');
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const resolvedProject = getProjectOrWorkspace(this.config, args[key] as string);
                        return await this.watcherHandler.listWatchers({
                            [key]: resolvedProject,
                            repository: args.repository as string,
                            limit: args.limit as number,
                            start: args.start as number
                        });
                    }

                    case 'watch_repository': {
                        logger.debug('👁️ Executing watch_repository');
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const resolvedProject = getProjectOrWorkspace(this.config, args[key] as string);
                        return await this.watcherHandler.watchRepository({
                            [key]: resolvedProject,
                            repository: args.repository as string
                        });
                    }

                    case 'unwatch_repository': {
                        logger.debug('👁️ Executing unwatch_repository');
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const resolvedProject = getProjectOrWorkspace(this.config, args[key] as string);
                        return await this.watcherHandler.unwatchRepository({
                            [key]: resolvedProject,
                            repository: args.repository as string
                        });
                    }

                    // User Operations
                    case 'get_user': {
                        logger.debug('👤 Executing get_user');
                        return await this.userHandler.getUser({
                            username: args.username as string
                        });
                    }

                    case 'list_users': {
                        logger.debug('👤 Executing list_users');
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const resolvedProject = getProjectOrWorkspace(this.config, args[key] as string);
                        return await this.userHandler.listUsers({
                            [key]: resolvedProject,
                            limit: args.limit as number,
                            start: args.start as number
                        });
                    }

                    // Search Operations
                    case 'search_code': {
                        logger.debug('🔍 Executing search_code');
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const resolvedProject = getProjectOrWorkspace(this.config, args[key] as string);
                        return await this.searchHandler.searchCode({
                            [key]: resolvedProject,
                            query: args.query as string,
                            repository: args.repository as string,
                            limit: args.limit as number,
                            start: args.start as number
                        });
                    }

                    // Permission Operations
                    case 'get_repository_permissions': {
                        logger.debug('🔒 Executing get_repository_permissions');
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const resolvedProject = getProjectOrWorkspace(this.config, args[key] as string);
                        return await this.permissionHandler.getRepositoryPermissions({
                            [key]: resolvedProject,
                            repository: args.repository as string,
                            user: args.user as string
                        });
                    }

                    // Bitbucket Cloud specific: Pipeline Operations
                    case 'list_pipelines': {
                        if (!this.pipelineHandler) {
                            throw new McpError(ErrorCode.InvalidParams, 'Pipelines are only supported on Bitbucket Cloud');
                        }
                        logger.debug('🔄 Executing list_pipelines');
                        const workspace = getProjectOrWorkspace(this.config, args.workspace as string);
                        return await this.pipelineHandler.listPipelines({
                            workspace,
                            repository: args.repository as string,
                            target: args.target as any,
                            limit: args.limit as number,
                            start: args.start as number
                        });
                    }

                    case 'get_pipeline': {
                        if (!this.pipelineHandler) {
                            throw new McpError(ErrorCode.InvalidParams, 'Pipelines are only supported on Bitbucket Cloud');
                        }
                        logger.debug('🔄 Executing get_pipeline');
                        const workspace = getProjectOrWorkspace(this.config, args.workspace as string);
                        return await this.pipelineHandler.getPipeline({
                            workspace,
                            repository: args.repository as string,
                            pipelineId: args.pipelineId as string
                        });
                    }

                    case 'trigger_pipeline': {
                        if (!this.pipelineHandler) {
                            throw new McpError(ErrorCode.InvalidParams, 'Pipelines are only supported on Bitbucket Cloud');
                        }
                        logger.debug('🔄 Executing trigger_pipeline');
                        const workspace = getProjectOrWorkspace(this.config, args.workspace as string);
                        return await this.pipelineHandler.triggerPipeline({
                            workspace,
                            repository: args.repository as string,
                            target: args.target as any,
                            variables: args.variables as any[]
                        });
                    }

                    case 'stop_pipeline': {
                        if (!this.pipelineHandler) {
                            throw new McpError(ErrorCode.InvalidParams, 'Pipelines are only supported on Bitbucket Cloud');
                        }
                        logger.debug('🔄 Executing stop_pipeline');
                        const workspace = getProjectOrWorkspace(this.config, args.workspace as string);
                        return await this.pipelineHandler.stopPipeline({
                            workspace,
                            repository: args.repository as string,
                            pipelineId: args.pipelineId as string
                        });
                    }

                    // Bitbucket Server specific: Build Status Operations
                    case 'get_build_status': {
                        if (!this.buildStatusHandler) {
                            throw new McpError(ErrorCode.InvalidParams, 'Build status API is only supported on Bitbucket Server');
                        }
                        logger.debug('🔨 Executing get_build_status');
                        const project = getProjectOrWorkspace(this.config, args.project as string);
                        return await this.buildStatusHandler.getBuildStatus({
                            project,
                            repository: args.repository as string,
                            commitId: args.commitId as string
                        });
                    }

                    case 'set_build_status': {
                        if (!this.buildStatusHandler) {
                            throw new McpError(ErrorCode.InvalidParams, 'Build status API is only supported on Bitbucket Server');
                        }
                        logger.debug('🔨 Executing set_build_status');
                        const project = getProjectOrWorkspace(this.config, args.project as string);
                        return await this.buildStatusHandler.setBuildStatus({
                            project,
                            repository: args.repository as string,
                            commitId: args.commitId as string,
                            state: args.state as string,
                            key: args.key as string,
                            name: args.name as string,
                            url: args.url as string,
                            description: args.description as string
                        });
                    }

                    // Snippets (Cloud only)
                    case 'list_snippets': {
                        if (!this.snippetHandler) {
                            throw new McpError(ErrorCode.InvalidParams, 'Snippets are only available in Bitbucket Cloud');
                        }
                        logger.debug('📝 Executing list_snippets');
                        const workspace = getProjectOrWorkspace(this.config, args.workspace as string);
                        return await this.snippetHandler.listSnippets({
                            workspace,
                            role: args.role as string,
                            limit: args.limit as number
                        });
                    }

                    case 'get_snippet': {
                        if (!this.snippetHandler) {
                            throw new McpError(ErrorCode.InvalidParams, 'Snippets are only available in Bitbucket Cloud');
                        }
                        logger.debug('📝 Executing get_snippet');
                        const workspace = getProjectOrWorkspace(this.config, args.workspace as string);
                        return await this.snippetHandler.getSnippet({
                            workspace,
                            snippetId: args.snippetId as string
                        });
                    }

                    case 'create_snippet': {
                        if (!this.snippetHandler) {
                            throw new McpError(ErrorCode.InvalidParams, 'Snippets are only available in Bitbucket Cloud');
                        }
                        logger.debug('📝 Executing create_snippet');
                        const workspace = getProjectOrWorkspace(this.config, args.workspace as string);
                        return await this.snippetHandler.createSnippet({
                            workspace,
                            title: args.title as string,
                            isPrivate: args.isPrivate as boolean,
                            files: args.files as object
                        });
                    }

                    case 'update_snippet': {
                        if (!this.snippetHandler) {
                            throw new McpError(ErrorCode.InvalidParams, 'Snippets are only available in Bitbucket Cloud');
                        }
                        logger.debug('📝 Executing update_snippet');
                        const workspace = getProjectOrWorkspace(this.config, args.workspace as string);
                        return await this.snippetHandler.updateSnippet({
                            workspace,
                            snippetId: args.snippetId as string,
                            title: args.title as string,
                            isPrivate: args.isPrivate as boolean,
                            files: args.files as object
                        });
                    }

                    case 'delete_snippet': {
                        if (!this.snippetHandler) {
                            throw new McpError(ErrorCode.InvalidParams, 'Snippets are only available in Bitbucket Cloud');
                        }
                        logger.debug('📝 Executing delete_snippet');
                        const workspace = getProjectOrWorkspace(this.config, args.workspace as string);
                        return await this.snippetHandler.deleteSnippet({
                            workspace,
                            snippetId: args.snippetId as string
                        });
                    }

                    case 'get_snippet_file': {
                        if (!this.snippetHandler) {
                            throw new McpError(ErrorCode.InvalidParams, 'Snippets are only available in Bitbucket Cloud');
                        }
                        logger.debug('📝 Executing get_snippet_file');
                        const workspace = getProjectOrWorkspace(this.config, args.workspace as string);
                        return await this.snippetHandler.getSnippetFile({
                            workspace,
                            snippetId: args.snippetId as string,
                            filename: args.filename as string
                        });
                    }

                    // Branch restrictions
                    case 'list_branch_restrictions': {
                        logger.debug('🔒 Executing list_branch_restrictions');
                        const projectOrWorkspace = getProjectOrWorkspace(this.config, 
                            this.config.isCloud ? args.workspace as string : args.project as string);
                        return await this.branchRestrictionHandler.listBranchRestrictions({
                            ...(this.config.isCloud ? { workspace: projectOrWorkspace } : { project: projectOrWorkspace }),
                            repository: args.repository as string,
                            kind: args.kind as string
                        });
                    }

                    case 'create_branch_restriction': {
                        logger.debug('🔒 Executing create_branch_restriction');
                        const projectOrWorkspace = getProjectOrWorkspace(this.config, 
                            this.config.isCloud ? args.workspace as string : args.project as string);
                        return await this.branchRestrictionHandler.createBranchRestriction({
                            ...(this.config.isCloud ? { workspace: projectOrWorkspace } : { project: projectOrWorkspace }),
                            repository: args.repository as string,
                            kind: args.kind as string,
                            pattern: args.pattern as string,
                            userIds: args.userIds as string[],
                            groupIds: args.groupIds as string[]
                        });
                    }

                    case 'get_branch_restriction': {
                        logger.debug('🔒 Executing get_branch_restriction');
                        const projectOrWorkspace = getProjectOrWorkspace(this.config, 
                            this.config.isCloud ? args.workspace as string : args.project as string);
                        return await this.branchRestrictionHandler.getBranchRestriction({
                            ...(this.config.isCloud ? { workspace: projectOrWorkspace } : { project: projectOrWorkspace }),
                            repository: args.repository as string,
                            restrictionId: args.restrictionId as string
                        });
                    }

                    case 'update_branch_restriction': {
                        logger.debug('🔒 Executing update_branch_restriction');
                        const projectOrWorkspace = getProjectOrWorkspace(this.config, 
                            this.config.isCloud ? args.workspace as string : args.project as string);
                        return await this.branchRestrictionHandler.updateBranchRestriction({
                            ...(this.config.isCloud ? { workspace: projectOrWorkspace } : { project: projectOrWorkspace }),
                            repository: args.repository as string,
                            restrictionId: args.restrictionId as string,
                            kind: args.kind as string,
                            pattern: args.pattern as string,
                            userIds: args.userIds as string[],
                            groupIds: args.groupIds as string[]
                        });
                    }

                    case 'delete_branch_restriction': {
                        logger.debug('🔒 Executing delete_branch_restriction');
                        const projectOrWorkspace = getProjectOrWorkspace(this.config, 
                            this.config.isCloud ? args.workspace as string : args.project as string);
                        return await this.branchRestrictionHandler.deleteBranchRestriction({
                            ...(this.config.isCloud ? { workspace: projectOrWorkspace } : { project: projectOrWorkspace }),
                            repository: args.repository as string,
                            restrictionId: args.restrictionId as string
                        });
                    }

                    // Downloads
                    case 'list_downloads': {
                        logger.debug('📦 Executing list_downloads');
                        const projectOrWorkspace = getProjectOrWorkspace(this.config, 
                            this.config.isCloud ? args.workspace as string : args.project as string);
                        return await this.downloadHandler.listDownloads({
                            ...(this.config.isCloud ? { workspace: projectOrWorkspace } : { project: projectOrWorkspace }),
                            repository: args.repository as string
                        });
                    }

                    case 'upload_download': {
                        logger.debug('📦 Executing upload_download');
                        const projectOrWorkspace = getProjectOrWorkspace(this.config, 
                            this.config.isCloud ? args.workspace as string : args.project as string);
                        return await this.downloadHandler.uploadDownload({
                            ...(this.config.isCloud ? { workspace: projectOrWorkspace } : { project: projectOrWorkspace }),
                            repository: args.repository as string,
                            filename: args.filename as string,
                            content: args.content as string
                        });
                    }

                    case 'delete_download': {
                        logger.debug('📦 Executing delete_download');
                        const projectOrWorkspace = getProjectOrWorkspace(this.config, 
                            this.config.isCloud ? args.workspace as string : args.project as string);
                        return await this.downloadHandler.deleteDownload({
                            ...(this.config.isCloud ? { workspace: projectOrWorkspace } : { project: projectOrWorkspace }),
                            repository: args.repository as string,
                            filename: args.filename as string
                        });
                    }

                    // Fork functionality  
                    case 'list_forks': {
                        logger.debug('🍴 Executing list_forks');
                        const projectOrWorkspace = getProjectOrWorkspace(this.config, 
                            this.config.isCloud ? args.workspace as string : args.project as string);
                        return await this.forkHandler.listForks({
                            ...(this.config.isCloud ? { workspace: projectOrWorkspace } : { project: projectOrWorkspace }),
                            repository: args.repository as string,
                            limit: args.limit as number,
                            start: args.start as number
                        });
                    }

                    // Commit comments
                    case 'list_commit_comments': {
                        logger.debug('💬 Executing list_commit_comments');
                        const projectOrWorkspace = getProjectOrWorkspace(this.config, 
                            this.config.isCloud ? args.workspace as string : args.project as string);
                        return await this.commitCommentHandler.listCommitComments({
                            ...(this.config.isCloud ? { workspace: projectOrWorkspace } : { project: projectOrWorkspace }),
                            repository: args.repository as string,
                            commitId: args.commitId as string
                        });
                    }

                    case 'create_commit_comment': {
                        logger.debug('💬 Executing create_commit_comment');
                        const projectOrWorkspace = getProjectOrWorkspace(this.config, 
                            this.config.isCloud ? args.workspace as string : args.project as string);
                        return await this.commitCommentHandler.createCommitComment({
                            ...(this.config.isCloud ? { workspace: projectOrWorkspace } : { project: projectOrWorkspace }),
                            repository: args.repository as string,
                            commitId: args.commitId as string,
                            content: args.content as string,
                            filename: args.filename as string,
                            lineNumber: args.lineNumber as number
                        });
                    }

                    case 'update_commit_comment': {
                        logger.debug('💬 Executing update_commit_comment');
                        const projectOrWorkspace = getProjectOrWorkspace(this.config, 
                            this.config.isCloud ? args.workspace as string : args.project as string);
                        return await this.commitCommentHandler.updateCommitComment({
                            ...(this.config.isCloud ? { workspace: projectOrWorkspace } : { project: projectOrWorkspace }),
                            repository: args.repository as string,
                            commitId: args.commitId as string,
                            commentId: args.commentId as string,
                            content: args.content as string
                        });
                    }

                    case 'delete_commit_comment': {
                        logger.debug('💬 Executing delete_commit_comment');
                        const projectOrWorkspace = getProjectOrWorkspace(this.config, 
                            this.config.isCloud ? args.workspace as string : args.project as string);
                        return await this.commitCommentHandler.deleteCommitComment({
                            ...(this.config.isCloud ? { workspace: projectOrWorkspace } : { project: projectOrWorkspace }),
                            repository: args.repository as string,
                            commitId: args.commitId as string,
                            commentId: args.commentId as string
                        });
                    }

                    // Deployments and environments (Cloud only)
                    case 'list_deployments': {
                        if (!this.deploymentHandler) {
                            throw new McpError(ErrorCode.InvalidParams, 'Deployments are only available in Bitbucket Cloud');
                        }
                        logger.debug('🚀 Executing list_deployments');
                        const workspace = getProjectOrWorkspace(this.config, args.workspace as string);
                        return await this.deploymentHandler.listDeployments({
                            workspace,
                            repository: args.repository as string
                        });
                    }

                    case 'get_deployment': {
                        if (!this.deploymentHandler) {
                            throw new McpError(ErrorCode.InvalidParams, 'Deployments are only available in Bitbucket Cloud');
                        }
                        logger.debug('🚀 Executing get_deployment');
                        const workspace = getProjectOrWorkspace(this.config, args.workspace as string);
                        return await this.deploymentHandler.getDeployment({
                            workspace,
                            repository: args.repository as string,
                            deploymentId: args.deploymentId as string
                        });
                    }

                    case 'list_environments': {
                        if (!this.deploymentHandler) {
                            throw new McpError(ErrorCode.InvalidParams, 'Environments are only available in Bitbucket Cloud');
                        }
                        logger.debug('🌍 Executing list_environments');
                        const workspace = getProjectOrWorkspace(this.config, args.workspace as string);
                        return await this.deploymentHandler.listEnvironments({
                            workspace,
                            repository: args.repository as string
                        });
                    }

                    case 'create_environment': {
                        if (!this.deploymentHandler) {
                            throw new McpError(ErrorCode.InvalidParams, 'Environments are only available in Bitbucket Cloud');
                        }
                        logger.debug('🌍 Executing create_environment');
                        const workspace = getProjectOrWorkspace(this.config, args.workspace as string);
                        return await this.deploymentHandler.createEnvironment({
                            workspace,
                            repository: args.repository as string,
                            name: args.name as string,
                            type: args.type as string,
                            slug: args.slug as string
                        });
                    }

                    case 'update_environment': {
                        if (!this.deploymentHandler) {
                            throw new McpError(ErrorCode.InvalidParams, 'Environments are only available in Bitbucket Cloud');
                        }
                        logger.debug('🌍 Executing update_environment');
                        const workspace = getProjectOrWorkspace(this.config, args.workspace as string);
                        return await this.deploymentHandler.updateEnvironment({
                            workspace,
                            repository: args.repository as string,
                            environmentUuid: args.environmentUuid as string,
                            name: args.name as string,
                            type: args.type as string
                        });
                    }

                    case 'delete_environment': {
                        if (!this.deploymentHandler) {
                            throw new McpError(ErrorCode.InvalidParams, 'Environments are only available in Bitbucket Cloud');
                        }
                        logger.debug('🌍 Executing delete_environment');
                        const workspace = getProjectOrWorkspace(this.config, args.workspace as string);
                        return await this.deploymentHandler.deleteEnvironment({
                            workspace,
                            repository: args.repository as string,
                            environmentUuid: args.environmentUuid as string
                        });
                    }

                    default:
                        logger.error('❌ Unknown tool requested', {
                            toolName,
                            availableTools: toolDefinitions.map(t => t.name)
                        });
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