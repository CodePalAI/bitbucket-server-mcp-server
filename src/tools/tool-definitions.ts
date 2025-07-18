import {BitbucketConfig} from '../types/interfaces.js';

export function createToolDefinitions(config: BitbucketConfig) {
    const projectOrWorkspaceProperty = {
        [config.isCloud ? 'workspace' : 'project']: {
            type: 'string',
            description: config.isCloud
                ? 'Bitbucket workspace name. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable.'
                : 'Bitbucket project key. If omitted, uses BITBUCKET_DEFAULT_PROJECT environment variable.'
        }
    };

    return [
        {
            name: 'list_projects',
            description: config.isCloud
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
                    ...projectOrWorkspaceProperty,
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
                    ...projectOrWorkspaceProperty,
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
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug containing the pull request.'},
                    prId: {type: 'number', description: 'Unique pull request ID number (e.g., 123, 456).'}
                },
                required: ['repository', 'prId']
            }
        },
        {
            name: 'merge_pull_request',
            description: 'Merge an approved pull request into the target branch. Use this when a PR has been reviewed, approved, and is ready to be integrated.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug containing the pull request.'},
                    prId: {type: 'number', description: 'Pull request ID to merge.'},
                    message: {type: 'string', description: 'Custom merge commit message.'},
                    strategy: {
                        type: 'string',
                        enum: ['merge-commit', 'squash', 'fast-forward'],
                        description: 'Merge strategy to use.'
                    }
                },
                required: ['repository', 'prId']
            }
        },
        {
            name: 'add_comment',
            description: 'Add a comment to a pull request for code review, feedback, questions, or discussion.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug containing the pull request.'},
                    prId: {type: 'number', description: 'Pull request ID to comment on.'},
                    text: {type: 'string', description: 'Comment text content. Supports Markdown formatting.'},
                    parentId: {type: 'number', description: 'ID of parent comment to reply to.'}
                },
                required: ['repository', 'prId', 'text']
            }
        },
        {
            name: 'list_branches',
            description: 'List all branches in a repository. Use this to discover available branches, understand branch structure, or find specific branches for checkout, merging, or other Git operations. Returns branch names, commit IDs, and branch metadata.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
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
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug where the branch will be created.'},
                    branchName: {
                        type: 'string',
                        description: 'Name for the new branch (e.g., "feature/new-feature", "release/v1.2").'
                    },
                    startPoint: {
                        type: 'string',
                        description: 'Starting point for the new branch - can be branch name, tag name, or commit hash (default: "main" or default branch).'
                    }
                },
                required: ['repository', 'branchName']
            }
        },
        {
            name: 'list_commits',
            description: 'List commits in a repository with optional filtering by branch, author, or time range.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
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
            description: 'Get detailed information about a specific commit including changes, author, message, and affected files.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug containing the commit.'},
                    commitId: {type: 'string', description: 'Commit hash or ID to retrieve details for.'}
                },
                required: ['repository', 'commitId']
            }
        },
        {
            name: 'get_file_content',
            description: 'Retrieve the content of a specific file from a repository at a given branch or commit. Use this to read configuration files, source code, documentation, or any repository file for analysis or processing.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug containing the file.'},
                    path: {
                        type: 'string',
                        description: 'File path relative to repository root (e.g., "src/main.js", "README.md").'
                    },
                    branch: {type: 'string', description: 'Branch name to read file from (default: default branch).'},
                    commitId: {
                        type: 'string',
                        description: 'Specific commit hash to read file from (takes precedence over branch).'
                    }
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
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug to explore.'},
                    path: {type: 'string', description: 'Directory path relative to repository root (default: root directory).'},
                    branch: {type: 'string', description: 'Branch name to list directory from (default: default branch).'},
                    commitId: {type: 'string', description: 'Specific commit hash to list directory from (takes precedence over branch).'}
                },
                required: ['repository']
            }
        },
        {
            name: 'create_repository',
            description: 'Create a new repository in a project or workspace.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    name: {type: 'string', description: 'Repository name.'},
                    description: {type: 'string', description: 'Repository description.'},
                    isPrivate: {type: 'boolean', description: 'Whether the repository should be private (default: true).'},
                    forkPolicy: {type: 'string', description: 'Fork policy.'},
                    language: {type: 'string', description: 'Primary programming language.'},
                    hasIssues: {type: 'boolean', description: 'Enable issue tracker.'},
                    hasWiki: {type: 'boolean', description: 'Enable wiki.'}
                },
                required: ['name']
            }
        }
        // Add more tool definitions here as needed...
    ];
} 