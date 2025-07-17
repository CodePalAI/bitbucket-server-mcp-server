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

interface BranchParams extends RepositoryParams {
    branchName?: string;
}

interface CommitParams extends RepositoryParams {
    commitId?: string;
    branch?: string;
}

interface IssueParams extends RepositoryParams {
    issueId?: number;
}

interface FileParams extends RepositoryParams {
    path?: string;
    branch?: string;
    commitId?: string;
}

interface TagParams extends RepositoryParams {
    tagName?: string;
}

interface WebhookParams extends RepositoryParams {
    webhookId?: string;
}

interface CreateRepositoryInput {
    name: string;
    description?: string;
    isPrivate?: boolean;
    forkPolicy?: string;
    language?: string;
    hasIssues?: boolean;
    hasWiki?: boolean;
}

interface CreateIssueInput extends RepositoryParams {
    title: string;
    content?: string;
    kind?: string;
    priority?: string;
    assignee?: string;
}

interface CreateWebhookInput extends RepositoryParams {
    url: string;
    description?: string;
    events: string[];
    active?: boolean;
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

        // Enhanced validation for different authentication methods
        if (this.config.isCloud) {
            // Bitbucket Cloud: Requires username + app password OR username + password
            if (!this.config.username) {
                throw new Error('BITBUCKET_USERNAME is required for Bitbucket Cloud');
            }
            if (!this.config.token && !this.config.password) {
                throw new Error('Either BITBUCKET_TOKEN (App Password) or BITBUCKET_PASSWORD is required for Bitbucket Cloud');
            }
            if (this.config.token && this.config.password) {
                logger.warn('Both BITBUCKET_TOKEN and BITBUCKET_PASSWORD provided. Using App Password (BITBUCKET_TOKEN)');
            }
        } else {
            // Bitbucket Server: Supports multiple auth methods
            if (!this.config.token && !(this.config.username && this.config.password)) {
                throw new Error('Either BITBUCKET_TOKEN (Personal Access Token) or BITBUCKET_USERNAME/PASSWORD is required for Bitbucket Server');
            }
        }

        // Configuration de l'instance Axios based on Bitbucket type
        const apiPath = this.config.isCloud ? '/2.0' : '/rest/api/1.0';
        const baseURL = this.config.isCloud ? 'https://api.bitbucket.org/2.0' : `${this.config.baseUrl}${apiPath}`;

        // Setup authentication based on platform and available credentials
        let authConfig: { headers?: any; auth?: any } = {headers: {}, auth: undefined};

        // Bitbucket Server or Cloud: Support Bearer tokens
        if (this.config.token) {
            // Personal Access Token (recommended)
            authConfig.headers = {Authorization: `Bearer ${this.config.token}`};
        } else if (this.config.username && this.config.password) {
            // Basic authentication
            authConfig.auth = {username: this.config.username, password: this.config.password};
        }


        this.api = axios.create({
            baseURL,
            ...authConfig
        });

        logger.info(`Initialized for ${this.config.isCloud ? 'Bitbucket Cloud' : 'Bitbucket Server'}`, {
            baseUrl: this.config.baseUrl,
            apiPath,
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
                },
                // Branch Operations
                {
                    name: 'list_branches',
                    description: 'List all branches in a repository. Use this to discover available branches, understand branch structure, or find specific branches for checkout, merging, or other Git operations. Returns branch names, commit IDs, and branch metadata.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            [this.config.isCloud ? 'workspace' : 'project']: {
                                type: 'string',
                                description: this.config.isCloud
                                    ? 'Bitbucket workspace name. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable.'
                                    : 'Bitbucket project key. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable.'
                            },
                            repository: {type: 'string', description: 'Repository slug to list branches from.'},
                            limit: {type: 'number', description: 'Number of branches to return (default: 25, max: 1000)'},
                            start: {type: 'number', description: 'Start index for pagination (default: 0)'}
                        },
                        required: ['repository']
                    }
                },
                {
                    name: 'create_branch',
                    description: 'Create a new branch in a repository from a specified starting point. Use this to create feature branches, release branches, or any new branch for development. Supports creating from any existing branch, tag, or commit.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            [this.config.isCloud ? 'workspace' : 'project']: {
                                type: 'string',
                                description: this.config.isCloud
                                    ? 'Bitbucket workspace name. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable.'
                                    : 'Bitbucket project key. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable.'
                            },
                            repository: {type: 'string', description: 'Repository slug where the branch will be created.'},
                            branchName: {type: 'string', description: 'Name for the new branch (e.g., "feature/new-feature", "release/v1.2").'},
                            startPoint: {type: 'string', description: 'Starting point for the new branch - can be branch name, tag name, or commit hash (default: "main" or default branch).'}
                        },
                        required: ['repository', 'branchName']
                    }
                },
                {
                    name: 'delete_branch',
                    description: 'Delete a branch from a repository. Use this to clean up feature branches after merging, remove obsolete branches, or maintain repository hygiene. Cannot delete the default branch or protected branches.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            [this.config.isCloud ? 'workspace' : 'project']: {
                                type: 'string',
                                description: this.config.isCloud
                                    ? 'Bitbucket workspace name. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable.'
                                    : 'Bitbucket project key. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable.'
                            },
                            repository: {type: 'string', description: 'Repository slug containing the branch to delete.'},
                            branchName: {type: 'string', description: 'Name of the branch to delete.'}
                        },
                        required: ['repository', 'branchName']
                    }
                },
                // Commit Operations
                {
                    name: 'list_commits',
                    description: 'List commits in a repository with optional filtering by branch, author, or time range. Use this to review commit history, find specific changes, understand development timeline, or analyze contributor activity.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            [this.config.isCloud ? 'workspace' : 'project']: {
                                type: 'string',
                                description: this.config.isCloud
                                    ? 'Bitbucket workspace name. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable.'
                                    : 'Bitbucket project key. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable.'
                            },
                            repository: {type: 'string', description: 'Repository slug to list commits from.'},
                            branch: {type: 'string', description: 'Branch name to list commits from (default: default branch).'},
                            limit: {type: 'number', description: 'Number of commits to return (default: 25, max: 100)'},
                            start: {type: 'number', description: 'Start index for pagination (default: 0)'}
                        },
                        required: ['repository']
                    }
                },
                {
                    name: 'get_commit',
                    description: 'Get detailed information about a specific commit including changes, author, message, and affected files. Use this to understand what changes were made in a commit, review code changes, or analyze specific modifications.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            [this.config.isCloud ? 'workspace' : 'project']: {
                                type: 'string',
                                description: this.config.isCloud
                                    ? 'Bitbucket workspace name. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable.'
                                    : 'Bitbucket project key. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable.'
                            },
                            repository: {type: 'string', description: 'Repository slug containing the commit.'},
                            commitId: {type: 'string', description: 'Commit hash or ID to retrieve details for.'}
                        },
                        required: ['repository', 'commitId']
                    }
                },
                // Issue Operations
                {
                    name: 'list_issues',
                    description: 'List issues in a repository with optional filtering by status, assignee, or labels. Use this to track bugs, feature requests, and tasks, understand project health, or manage development workflow.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            [this.config.isCloud ? 'workspace' : 'project']: {
                                type: 'string',
                                description: this.config.isCloud
                                    ? 'Bitbucket workspace name. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable.'
                                    : 'Bitbucket project key. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable.'
                            },
                            repository: {type: 'string', description: 'Repository slug to list issues from.'},
                            state: {type: 'string', description: 'Filter by issue state: "new", "open", "resolved", "closed", "invalid", "duplicate", "wontfix".'},
                            limit: {type: 'number', description: 'Number of issues to return (default: 25, max: 100)'},
                            start: {type: 'number', description: 'Start index for pagination (default: 0)'}
                        },
                        required: ['repository']
                    }
                },
                {
                    name: 'create_issue',
                    description: 'Create a new issue in a repository to track bugs, feature requests, or tasks. Use this to report problems, request enhancements, or create actionable items for the development team.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            [this.config.isCloud ? 'workspace' : 'project']: {
                                type: 'string',
                                description: this.config.isCloud
                                    ? 'Bitbucket workspace name. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable.'
                                    : 'Bitbucket project key. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable.'
                            },
                            repository: {type: 'string', description: 'Repository slug where the issue will be created.'},
                            title: {type: 'string', description: 'Clear, descriptive title for the issue.'},
                            content: {type: 'string', description: 'Detailed description of the issue, bug report, or feature request. Supports Markdown formatting.'},
                            kind: {type: 'string', description: 'Type of issue: "bug", "enhancement", "proposal", "task".'},
                            priority: {type: 'string', description: 'Issue priority: "trivial", "minor", "major", "critical", "blocker".'},
                            assignee: {type: 'string', description: 'Username to assign the issue to.'}
                        },
                        required: ['repository', 'title']
                    }
                },
                {
                    name: 'get_issue',
                    description: 'Get detailed information about a specific issue including description, comments, status, and history. Use this to understand issue details, track progress, or review discussions.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            [this.config.isCloud ? 'workspace' : 'project']: {
                                type: 'string',
                                description: this.config.isCloud
                                    ? 'Bitbucket workspace name. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable.'
                                    : 'Bitbucket project key. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable.'
                            },
                            repository: {type: 'string', description: 'Repository slug containing the issue.'},
                            issueId: {type: 'number', description: 'Issue ID number to retrieve details for.'}
                        },
                        required: ['repository', 'issueId']
                    }
                },
                // File Operations
                {
                    name: 'get_file_content',
                    description: 'Retrieve the content of a specific file from a repository at a given branch or commit. Use this to read configuration files, source code, documentation, or any repository file for analysis or processing.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            [this.config.isCloud ? 'workspace' : 'project']: {
                                type: 'string',
                                description: this.config.isCloud
                                    ? 'Bitbucket workspace name. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable.'
                                    : 'Bitbucket project key. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable.'
                            },
                            repository: {type: 'string', description: 'Repository slug containing the file.'},
                            path: {type: 'string', description: 'File path relative to repository root (e.g., "src/main.js", "README.md").'},
                            branch: {type: 'string', description: 'Branch name to read file from (default: default branch).'},
                            commitId: {type: 'string', description: 'Specific commit hash to read file from (takes precedence over branch).'}
                        },
                        required: ['repository', 'path']
                    }
                },
                {
                    name: 'list_directory',
                    description: 'List contents of a directory in a repository at a given branch or commit. Use this to explore repository structure, find files, or understand project organization.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            [this.config.isCloud ? 'workspace' : 'project']: {
                                type: 'string',
                                description: this.config.isCloud
                                    ? 'Bitbucket workspace name. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable.'
                                    : 'Bitbucket project key. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable.'
                            },
                            repository: {type: 'string', description: 'Repository slug to explore.'},
                            path: {type: 'string', description: 'Directory path relative to repository root (default: root directory).'},
                            branch: {type: 'string', description: 'Branch name to list directory from (default: default branch).'},
                            commitId: {type: 'string', description: 'Specific commit hash to list directory from (takes precedence over branch).'}
                        },
                        required: ['repository']
                    }
                },
                // Tag Operations
                {
                    name: 'list_tags',
                    description: 'List all tags in a repository. Use this to discover releases, version history, or important milestones in the project. Returns tag names, associated commits, and creation dates.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            [this.config.isCloud ? 'workspace' : 'project']: {
                                type: 'string',
                                description: this.config.isCloud
                                    ? 'Bitbucket workspace name. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable.'
                                    : 'Bitbucket project key. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable.'
                            },
                            repository: {type: 'string', description: 'Repository slug to list tags from.'},
                            limit: {type: 'number', description: 'Number of tags to return (default: 25, max: 100)'},
                            start: {type: 'number', description: 'Start index for pagination (default: 0)'}
                        },
                        required: ['repository']
                    }
                },
                {
                    name: 'create_tag',
                    description: 'Create a new tag in a repository to mark a specific commit as a release or milestone. Use this for version releases, important milestones, or to bookmark significant commits.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            [this.config.isCloud ? 'workspace' : 'project']: {
                                type: 'string',
                                description: this.config.isCloud
                                    ? 'Bitbucket workspace name. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable.'
                                    : 'Bitbucket project key. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable.'
                            },
                            repository: {type: 'string', description: 'Repository slug where the tag will be created.'},
                            tagName: {type: 'string', description: 'Name for the new tag (e.g., "v1.0.0", "release-2024.1").'},
                            commitId: {type: 'string', description: 'Commit hash to tag (default: latest commit on default branch).'},
                            message: {type: 'string', description: 'Optional tag message or description.'}
                        },
                        required: ['repository', 'tagName']
                    }
                },
                // Repository Management
                {
                    name: 'create_repository',
                    description: 'Create a new repository in a project or workspace. Use this to set up new projects, initialize codebases, or create repositories for new development work.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            [this.config.isCloud ? 'workspace' : 'project']: {
                                type: 'string',
                                description: this.config.isCloud
                                    ? 'Bitbucket workspace name. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable.'
                                    : 'Bitbucket project key. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable.'
                            },
                            name: {type: 'string', description: 'Repository name (will be used as the repository slug).'},
                            description: {type: 'string', description: 'Repository description explaining the project purpose.'},
                            isPrivate: {type: 'boolean', description: 'Whether the repository should be private (default: true).'},
                            forkPolicy: {type: 'string', description: 'Fork policy: "allow_forks", "no_public_forks", "no_forks".'},
                            language: {type: 'string', description: 'Primary programming language for the repository.'},
                            hasIssues: {type: 'boolean', description: 'Enable issue tracker (default: true).'},
                            hasWiki: {type: 'boolean', description: 'Enable wiki (default: false).'}
                        },
                        required: ['name']
                    }
                },
                {
                    name: 'fork_repository',
                    description: 'Create a fork of an existing repository. Use this to contribute to open source projects, create personal copies for experimentation, or establish parallel development streams.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            [this.config.isCloud ? 'workspace' : 'project']: {
                                type: 'string',
                                description: this.config.isCloud
                                    ? 'Source workspace name. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable.'
                                    : 'Source project key. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable.'
                            },
                            repository: {type: 'string', description: 'Repository slug to fork.'},
                            [this.config.isCloud ? 'forkWorkspace' : 'forkProject']: {
                                type: 'string',
                                description: this.config.isCloud
                                    ? 'Target workspace for the fork (default: current user workspace).'
                                    : 'Target project for the fork (default: personal project).'
                            },
                            name: {type: 'string', description: 'Name for the forked repository (default: same as source).'}
                        },
                        required: ['repository']
                    }
                },
                // User Operations
                {
                    name: 'get_user',
                    description: 'Get detailed information about a Bitbucket user including profile details, account status, and public information. Use this to understand user details, verify accounts, or gather contributor information.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            username: {type: 'string', description: 'Bitbucket username or UUID to get details for (leave empty for current authenticated user).'}
                        }
                    }
                },
                // Webhook Operations
                {
                    name: 'list_webhooks',
                    description: 'List all webhooks configured for a repository. Use this to audit integrations, understand automation setup, or manage webhook configurations.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            [this.config.isCloud ? 'workspace' : 'project']: {
                                type: 'string',
                                description: this.config.isCloud
                                    ? 'Bitbucket workspace name. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable.'
                                    : 'Bitbucket project key. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable.'
                            },
                            repository: {type: 'string', description: 'Repository slug to list webhooks from.'}
                        },
                        required: ['repository']
                    }
                },
                {
                    name: 'create_webhook',
                    description: 'Create a new webhook for a repository to receive notifications about events like pushes, pull requests, or issue changes. Use this to integrate with external systems, trigger CI/CD pipelines, or automate workflows.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            [this.config.isCloud ? 'workspace' : 'project']: {
                                type: 'string',
                                description: this.config.isCloud
                                    ? 'Bitbucket workspace name. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable.'
                                    : 'Bitbucket project key. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable.'
                            },
                            repository: {type: 'string', description: 'Repository slug where the webhook will be created.'},
                            url: {type: 'string', description: 'URL endpoint that will receive webhook notifications.'},
                            description: {type: 'string', description: 'Description of the webhook purpose.'},
                            events: {
                                type: 'array',
                                items: {type: 'string'},
                                description: 'List of events to trigger webhook: ["repo:push", "pullrequest:created", "pullrequest:updated", "pullrequest:approved", "pullrequest:merged", "issue:created", "issue:updated"].'
                            },
                            active: {type: 'boolean', description: 'Whether the webhook is active (default: true).'}
                        },
                        required: ['repository', 'url', 'events']
                    }
                },
                {
                    name: 'delete_webhook',
                    description: 'Delete a webhook from a repository. Use this to remove obsolete integrations, clean up webhook configurations, or disable unwanted notifications.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            [this.config.isCloud ? 'workspace' : 'project']: {
                                type: 'string',
                                description: this.config.isCloud
                                    ? 'Bitbucket workspace name. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable.'
                                    : 'Bitbucket project key. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable.'
                            },
                            repository: {type: 'string', description: 'Repository slug containing the webhook to delete.'},
                            webhookId: {type: 'string', description: 'Webhook ID or UUID to delete.'}
                        },
                        required: ['repository', 'webhookId']
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
                        const createArgs = {...args, [key]: getProjectOrWorkspace(args[key] as string)};
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

                    // Branch Operations
                    case 'list_branches': {
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const branchParams: BranchParams = {
                            [key]: getProjectOrWorkspace(args[key] as string),
                            repository: args.repository as string
                        };
                        return await this.listBranches(branchParams, {
                            limit: args.limit as number,
                            start: args.start as number
                        });
                    }

                    case 'create_branch': {
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const branchParams: BranchParams = {
                            [key]: getProjectOrWorkspace(args[key] as string),
                            repository: args.repository as string,
                            branchName: args.branchName as string
                        };
                        return await this.createBranch(branchParams, args.startPoint as string);
                    }

                    case 'delete_branch': {
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const branchParams: BranchParams = {
                            [key]: getProjectOrWorkspace(args[key] as string),
                            repository: args.repository as string,
                            branchName: args.branchName as string
                        };
                        return await this.deleteBranch(branchParams);
                    }

                    // Commit Operations
                    case 'list_commits': {
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const commitParams: CommitParams = {
                            [key]: getProjectOrWorkspace(args[key] as string),
                            repository: args.repository as string,
                            branch: args.branch as string
                        };
                        return await this.listCommits(commitParams, {
                            limit: args.limit as number,
                            start: args.start as number
                        });
                    }

                    case 'get_commit': {
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const commitParams: CommitParams = {
                            [key]: getProjectOrWorkspace(args[key] as string),
                            repository: args.repository as string,
                            commitId: args.commitId as string
                        };
                        return await this.getCommit(commitParams);
                    }

                    // Issue Operations
                    case 'list_issues': {
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const issueParams: IssueParams = {
                            [key]: getProjectOrWorkspace(args[key] as string),
                            repository: args.repository as string
                        };
                        return await this.listIssues(issueParams, {
                            state: args.state as string,
                            limit: args.limit as number,
                            start: args.start as number
                        });
                    }

                    case 'create_issue': {
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const createIssueInput: CreateIssueInput = {
                            [key]: getProjectOrWorkspace(args[key] as string),
                            repository: args.repository as string,
                            title: args.title as string,
                            content: args.content as string,
                            kind: args.kind as string,
                            priority: args.priority as string,
                            assignee: args.assignee as string
                        };
                        return await this.createIssue(createIssueInput);
                    }

                    case 'get_issue': {
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const issueParams: IssueParams = {
                            [key]: getProjectOrWorkspace(args[key] as string),
                            repository: args.repository as string,
                            issueId: args.issueId as number
                        };
                        return await this.getIssue(issueParams);
                    }

                    // File Operations
                    case 'get_file_content': {
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const fileParams: FileParams = {
                            [key]: getProjectOrWorkspace(args[key] as string),
                            repository: args.repository as string,
                            path: args.path as string,
                            branch: args.branch as string,
                            commitId: args.commitId as string
                        };
                        return await this.getFileContent(fileParams);
                    }

                    case 'list_directory': {
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const fileParams: FileParams = {
                            [key]: getProjectOrWorkspace(args[key] as string),
                            repository: args.repository as string,
                            path: args.path as string,
                            branch: args.branch as string,
                            commitId: args.commitId as string
                        };
                        return await this.listDirectory(fileParams);
                    }

                    // Tag Operations
                    case 'list_tags': {
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const tagParams: TagParams = {
                            [key]: getProjectOrWorkspace(args[key] as string),
                            repository: args.repository as string
                        };
                        return await this.listTags(tagParams, {
                            limit: args.limit as number,
                            start: args.start as number
                        });
                    }

                    case 'create_tag': {
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const tagParams: TagParams = {
                            [key]: getProjectOrWorkspace(args[key] as string),
                            repository: args.repository as string,
                            tagName: args.tagName as string
                        };
                        return await this.createTag(tagParams, {
                            commitId: args.commitId as string,
                            message: args.message as string
                        });
                    }

                    // Repository Management
                    case 'create_repository': {
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const createRepoInput: CreateRepositoryInput = {
                            name: args.name as string,
                            description: args.description as string,
                            isPrivate: args.isPrivate as boolean,
                            forkPolicy: args.forkPolicy as string,
                            language: args.language as string,
                            hasIssues: args.hasIssues as boolean,
                            hasWiki: args.hasWiki as boolean
                        };
                        return await this.createRepository(getProjectOrWorkspace(args[key] as string), createRepoInput);
                    }

                    case 'fork_repository': {
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const forkKey = this.config.isCloud ? 'forkWorkspace' : 'forkProject';
                        return await this.forkRepository({
                            [key]: getProjectOrWorkspace(args[key] as string),
                            repository: args.repository as string
                        }, {
                            [forkKey]: args[forkKey] as string,
                            name: args.name as string
                        });
                    }

                    // User Operations
                    case 'get_user': {
                        return await this.getUser(args.username as string);
                    }

                    // Webhook Operations
                    case 'list_webhooks': {
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const webhookParams: WebhookParams = {
                            [key]: getProjectOrWorkspace(args[key] as string),
                            repository: args.repository as string
                        };
                        return await this.listWebhooks(webhookParams);
                    }

                    case 'create_webhook': {
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const createWebhookInput: CreateWebhookInput = {
                            [key]: getProjectOrWorkspace(args[key] as string),
                            repository: args.repository as string,
                            url: args.url as string,
                            description: args.description as string,
                            events: args.events as string[],
                            active: args.active as boolean
                        };
                        return await this.createWebhook(createWebhookInput);
                    }

                    case 'delete_webhook': {
                        const key = this.config.isCloud ? 'workspace' : 'project';
                        const webhookParams: WebhookParams = {
                            [key]: getProjectOrWorkspace(args[key] as string),
                            repository: args.repository as string,
                            webhookId: args.webhookId as string
                        };
                        return await this.deleteWebhook(webhookParams);
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
                            ? `For Bitbucket Cloud, ensure you have:
1. Set BITBUCKET_USERNAME to your Bitbucket username
2. Set BITBUCKET_TOKEN to your App Password (create at: https://bitbucket.org/account/settings/app-passwords/)
3. App Password has required scopes: Repositories (Read/Write), Pull requests (Read/Write), Account (Read)
4. OR use BITBUCKET_USERNAME + BITBUCKET_PASSWORD (less secure)

Current config: username=${this.config.username || 'NOT SET'}, hasToken=${!!this.config.token}, hasPassword=${!!this.config.password}`
                            : `For Bitbucket Server, ensure you have:
1. Set BITBUCKET_TOKEN to your Personal Access Token (recommended)
2. OR set BITBUCKET_USERNAME + BITBUCKET_PASSWORD for basic auth
3. Token/credentials have sufficient permissions for repositories and pull requests

Current config: hasToken=${!!this.config.token}, username=${this.config.username || 'NOT SET'}, hasPassword=${!!this.config.password}`;

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
                params: {pagelen: limit, page: Math.floor(start / limit) + 1}
            });

            const workspaces = response.data.values || [];
            const summary = {
                total: response.data.size || workspaces.length,
                showing: workspaces.length,
                workspaces: workspaces.map((workspace: {
                    slug: string;
                    name: string;
                    uuid: string;
                    is_private: boolean
                }) => ({
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
            const params = {pagelen: limit, page: Math.floor(start / limit) + 1};

            if (workspaceOrProject || this.config.defaultProject) {
                const workspace = workspaceOrProject || this.config.defaultProject;
                endpoint = `/repositories/${workspace}`;
            } else {
                endpoint = '/repositories';
                // Add role parameter to get repositories user has access to
                Object.assign(params, {role: 'member'});
            }

            const response = await this.api.get(endpoint, {params});

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
                    cloneUrl: repo.links?.clone?.find((link: {
                        name: string;
                        href: string
                    }) => link.name === 'https')?.href,
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
                    cloneUrl: repo.links?.clone?.find((link: {
                        name: string;
                        href: string
                    }) => link.name === 'http')?.href,
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
                    reviewers: input.reviewers?.map(username => ({username}))
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
                message ? {reason: message} : {}
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
                    parent: parentId ? {id: parentId} : undefined
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
                    params: {context: contextLines},
                    headers: {Accept: 'text/plain'}
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

    // Branch Operations
    private async listBranches(params: BranchParams, options: ListOptions = {}) {
        const {repository} = params;
        const {limit = 25, start = 0} = options;

        if (!repository) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository is required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            const response = await this.api.get(
                `/repositories/${workspace}/${repository}/refs/branches`,
                {params: {pagelen: limit, page: Math.floor(start / limit) + 1}}
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        } else {
            const project = params.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(ErrorCode.InvalidParams, 'Project is required for Bitbucket Server');
            }

            const response = await this.api.get(
                `/projects/${project}/repos/${repository}/branches`,
                {params: {limit, start}}
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        }
    }

    private async createBranch(params: BranchParams, startPoint?: string) {
        const {repository, branchName} = params;

        if (!repository || !branchName) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository and branchName are required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            const response = await this.api.post(
                `/repositories/${workspace}/${repository}/refs/branches`,
                {
                    name: branchName,
                    target: {
                        hash: startPoint || 'HEAD'
                    }
                }
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        } else {
            const project = params.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(ErrorCode.InvalidParams, 'Project is required for Bitbucket Server');
            }

            const response = await this.api.post(
                `/projects/${project}/repos/${repository}/branches`,
                {
                    name: branchName,
                    startPoint: startPoint || 'refs/heads/main'
                }
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        }
    }

    private async deleteBranch(params: BranchParams) {
        const {repository, branchName} = params;

        if (!repository || !branchName) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository and branchName are required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            await this.api.delete(`/repositories/${workspace}/${repository}/refs/branches/${branchName}`);

            return {
                content: [{type: 'text', text: 'Branch deleted successfully'}]
            };
        } else {
            const project = params.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(ErrorCode.InvalidParams, 'Project is required for Bitbucket Server');
            }

            await this.api.delete(
                `/projects/${project}/repos/${repository}/branches`,
                {data: {name: `refs/heads/${branchName}`}}
            );

            return {
                content: [{type: 'text', text: 'Branch deleted successfully'}]
            };
        }
    }

    // Commit Operations
    private async listCommits(params: CommitParams, options: ListOptions = {}) {
        const {repository, branch} = params;
        const {limit = 25, start = 0} = options;

        if (!repository) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository is required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            const pathParams = branch ? `/${branch}` : '';
            const response = await this.api.get(
                `/repositories/${workspace}/${repository}/commits${pathParams}`,
                {params: {pagelen: limit, page: Math.floor(start / limit) + 1}}
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        } else {
            const project = params.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(ErrorCode.InvalidParams, 'Project is required for Bitbucket Server');
            }

            const branchParam = branch ? {until: branch} : {};
            const response = await this.api.get(
                `/projects/${project}/repos/${repository}/commits`,
                {params: {limit, start, ...branchParam}}
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        }
    }

    private async getCommit(params: CommitParams) {
        const {repository, commitId} = params;

        if (!repository || !commitId) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository and commitId are required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            const response = await this.api.get(
                `/repositories/${workspace}/${repository}/commit/${commitId}`
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        } else {
            const project = params.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(ErrorCode.InvalidParams, 'Project is required for Bitbucket Server');
            }

            const response = await this.api.get(
                `/projects/${project}/repos/${repository}/commits/${commitId}`
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        }
    }

    // Issue Operations
    private async listIssues(params: IssueParams, options: {state?: string; limit?: number; start?: number} = {}) {
        const {repository} = params;
        const {state, limit = 25, start = 0} = options;

        if (!repository) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository is required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            const stateParam = state ? {state} : {};
            const response = await this.api.get(
                `/repositories/${workspace}/${repository}/issues`,
                {params: {pagelen: limit, page: Math.floor(start / limit) + 1, ...stateParam}}
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        } else {
            // Bitbucket Server doesn't have built-in issue tracking, but some may use plugins
            throw new McpError(ErrorCode.InvalidParams, 'Issue tracking is not available in Bitbucket Server by default');
        }
    }

    private async createIssue(input: CreateIssueInput) {
        const {repository, title} = input;

        if (!repository || !title) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository and title are required');
        }

        if (this.config.isCloud) {
            const workspace = input.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            const issueData: any = {
                title,
                content: {
                    raw: input.content || '',
                    markup: 'markdown'
                }
            };

            if (input.kind) issueData.kind = input.kind;
            if (input.priority) issueData.priority = input.priority;
            if (input.assignee) issueData.assignee = {username: input.assignee};

            const response = await this.api.post(
                `/repositories/${workspace}/${repository}/issues`,
                issueData
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        } else {
            throw new McpError(ErrorCode.InvalidParams, 'Issue tracking is not available in Bitbucket Server by default');
        }
    }

    private async getIssue(params: IssueParams) {
        const {repository, issueId} = params;

        if (!repository || !issueId) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository and issueId are required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            const response = await this.api.get(
                `/repositories/${workspace}/${repository}/issues/${issueId}`
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        } else {
            throw new McpError(ErrorCode.InvalidParams, 'Issue tracking is not available in Bitbucket Server by default');
        }
    }

    // File Operations
    private async getFileContent(params: FileParams) {
        const {repository, path} = params;

        if (!repository || !path) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository and path are required');
        }

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

    // Tag Operations
    private async listTags(params: TagParams, options: ListOptions = {}) {
        const {repository} = params;
        const {limit = 25, start = 0} = options;

        if (!repository) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository is required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            const response = await this.api.get(
                `/repositories/${workspace}/${repository}/refs/tags`,
                {params: {pagelen: limit, page: Math.floor(start / limit) + 1}}
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        } else {
            const project = params.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(ErrorCode.InvalidParams, 'Project is required for Bitbucket Server');
            }

            const response = await this.api.get(
                `/projects/${project}/repos/${repository}/tags`,
                {params: {limit, start}}
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        }
    }

    private async createTag(params: TagParams, options: {commitId?: string; message?: string} = {}) {
        const {repository, tagName} = params;
        const {commitId, message} = options;

        if (!repository || !tagName) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository and tagName are required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            const tagData: any = {
                name: tagName,
                target: {
                    hash: commitId || 'HEAD'
                }
            };

            if (message) tagData.message = message;

            const response = await this.api.post(
                `/repositories/${workspace}/${repository}/refs/tags`,
                tagData
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        } else {
            const project = params.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(ErrorCode.InvalidParams, 'Project is required for Bitbucket Server');
            }

            const response = await this.api.post(
                `/projects/${project}/repos/${repository}/tags`,
                {
                    name: tagName,
                    startPoint: commitId || 'HEAD',
                    message: message || ''
                }
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        }
    }

    // Repository Management
    private async createRepository(workspaceOrProject: string, input: CreateRepositoryInput) {
        const {name} = input;

        if (!name) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository name is required');
        }

        if (this.config.isCloud) {
            const workspace = workspaceOrProject;
            const repoData: any = {
                name,
                slug: name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
                is_private: input.isPrivate !== false,
                fork_policy: input.forkPolicy || 'allow_forks',
                has_issues: input.hasIssues !== false,
                has_wiki: input.hasWiki || false,
                project: {
                    key: workspace
                }
            };

            if (input.description) repoData.description = input.description;
            if (input.language) repoData.language = input.language;

            const response = await this.api.post(
                `/repositories/${workspace}/${repoData.slug}`,
                repoData
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        } else {
            const project = workspaceOrProject;
            const repoData: any = {
                name,
                forkable: input.forkPolicy !== 'no_forks',
                public: !input.isPrivate
            };

            if (input.description) repoData.description = input.description;

            const response = await this.api.post(
                `/projects/${project}/repos`,
                repoData
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        }
    }

    private async forkRepository(sourceParams: RepositoryParams, forkOptions: {forkWorkspace?: string; forkProject?: string; name?: string}) {
        const {repository} = sourceParams;

        if (!repository) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository is required');
        }

        if (this.config.isCloud) {
            const workspace = sourceParams.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            const forkData: any = {};
            if (forkOptions.name) forkData.name = forkOptions.name;
            if (forkOptions.forkWorkspace) {
                forkData.parent = {
                    full_name: `${workspace}/${repository}`
                };
                forkData.workspace = {
                    slug: forkOptions.forkWorkspace
                };
            }

            const response = await this.api.post(
                `/repositories/${workspace}/${repository}/forks`,
                forkData
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        } else {
            const project = sourceParams.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(ErrorCode.InvalidParams, 'Project is required for Bitbucket Server');
            }

            const forkData: any = {
                slug: forkOptions.name || repository
            };
            if (forkOptions.forkProject) forkData.project = {key: forkOptions.forkProject};

            const response = await this.api.post(
                `/projects/${project}/repos/${repository}`,
                forkData
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        }
    }

    // User Operations
    private async getUser(username?: string) {
        if (this.config.isCloud) {
            const endpoint = username ? `/users/${username}` : '/user';
            const response = await this.api.get(endpoint);

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        } else {
            const endpoint = username ? `/users/${username}` : '/users';
            const response = await this.api.get(endpoint);

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        }
    }

    // Webhook Operations
    private async listWebhooks(params: WebhookParams) {
        const {repository} = params;

        if (!repository) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository is required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            const response = await this.api.get(
                `/repositories/${workspace}/${repository}/hooks`
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        } else {
            const project = params.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(ErrorCode.InvalidParams, 'Project is required for Bitbucket Server');
            }

            const response = await this.api.get(
                `/projects/${project}/repos/${repository}/webhooks`
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        }
    }

    private async createWebhook(input: CreateWebhookInput) {
        const {repository, url, events} = input;

        if (!repository || !url || !events || events.length === 0) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository, url, and events are required');
        }

        if (this.config.isCloud) {
            const workspace = input.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            const webhookData = {
                description: input.description || '',
                url,
                active: input.active !== false,
                events
            };

            const response = await this.api.post(
                `/repositories/${workspace}/${repository}/hooks`,
                webhookData
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        } else {
            const project = input.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(ErrorCode.InvalidParams, 'Project is required for Bitbucket Server');
            }

            const webhookData = {
                name: input.description || 'MCP Webhook',
                url,
                active: input.active !== false,
                events: events.map(event => event.replace(':', '_').toUpperCase())
            };

            const response = await this.api.post(
                `/projects/${project}/repos/${repository}/webhooks`,
                webhookData
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        }
    }

    private async deleteWebhook(params: WebhookParams) {
        const {repository, webhookId} = params;

        if (!repository || !webhookId) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository and webhookId are required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            await this.api.delete(`/repositories/${workspace}/${repository}/hooks/${webhookId}`);

            return {
                content: [{type: 'text', text: 'Webhook deleted successfully'}]
            };
        } else {
            const project = params.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(ErrorCode.InvalidParams, 'Project is required for Bitbucket Server');
            }

            await this.api.delete(`/projects/${project}/repos/${repository}/webhooks/${webhookId}`);

            return {
                content: [{type: 'text', text: 'Webhook deleted successfully'}]
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