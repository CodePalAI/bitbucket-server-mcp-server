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
            name: 'create_repository',
            description: 'Create a new repository in a project or workspace.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    name: {type: 'string', description: 'Repository name.'},
                    description: {type: 'string', description: 'Repository description.'},
                    isPrivate: {
                        type: 'boolean',
                        description: 'Whether the repository should be private (default: true).'
                    },
                    forkPolicy: {type: 'string', description: 'Fork policy.'},
                    language: {type: 'string', description: 'Primary programming language.'},
                    hasIssues: {type: 'boolean', description: 'Enable issue tracker.'},
                    hasWiki: {type: 'boolean', description: 'Enable wiki.'}
                },
                required: ['name']
            }
        },
        {
            name: 'update_repository',
            description: 'Update repository settings such as name, description, privacy, or other configuration.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug to update.'},
                    name: {type: 'string', description: 'New repository name.'},
                    description: {type: 'string', description: 'New repository description.'},
                    isPrivate: {type: 'boolean', description: 'Whether the repository should be private.'},
                    forkPolicy: {type: 'string', description: 'Fork policy.'},
                    language: {type: 'string', description: 'Primary programming language.'},
                    hasIssues: {type: 'boolean', description: 'Enable issue tracker.'},
                    hasWiki: {type: 'boolean', description: 'Enable wiki.'}
                },
                required: ['repository']
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
            name: 'list_pull_requests',
            description: 'List pull requests in a repository with optional filtering by state, author, or reviewer.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug to list pull requests from.'},
                    state: {
                        type: 'string',
                        enum: ['open', 'merged', 'declined', 'superseded'],
                        description: 'Filter by pull request state.'
                    },
                    author: {type: 'string', description: 'Filter by pull request author username.'},
                    limit: {type: 'number', description: 'Number of pull requests to return (default: 25, max: 100)'},
                    start: {type: 'number', description: 'Start index for pagination (default: 0)'}
                },
                required: ['repository']
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
            name: 'decline_pull_request',
            description: 'Decline a pull request to reject the proposed changes.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug containing the pull request.'},
                    prId: {type: 'number', description: 'Pull request ID to decline.'},
                    message: {type: 'string', description: 'Optional message explaining why the PR was declined.'}
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
            name: 'delete_branch',
            description: 'Delete a branch from a repository.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug containing the branch.'},
                    branchName: {type: 'string', description: 'Name of the branch to delete.'}
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
                    branch: {
                        type: 'string',
                        description: 'Branch name to list commits from (default: default branch).'
                    },
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
            name: 'get_diff',
            description: 'Get the diff between two commits, branches, or tags.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug to get diff from.'},
                    spec: {
                        type: 'string',
                        description: 'Diff specification (e.g., "commit1..commit2", "branch1..branch2").'
                    },
                    path: {type: 'string', description: 'Optional file path to limit diff to specific file.'},
                    context: {type: 'number', description: 'Number of context lines around changes (default: 3).'},
                    ignore_whitespace: {type: 'boolean', description: 'Whether to ignore whitespace changes.'}
                },
                required: ['repository', 'spec']
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
                    path: {
                        type: 'string',
                        description: 'Directory path relative to repository root (default: root directory).'
                    },
                    branch: {
                        type: 'string',
                        description: 'Branch name to list directory from (default: default branch).'
                    },
                    commitId: {
                        type: 'string',
                        description: 'Specific commit hash to list directory from (takes precedence over branch).'
                    }
                },
                required: ['repository']
            }
        },
        {
            name: 'list_tags',
            description: 'List all tags in a repository.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug to list tags from.'},
                    limit: {type: 'number', description: 'Number of tags to return (default: 25, max: 100)'},
                    start: {type: 'number', description: 'Start index for pagination (default: 0)'}
                },
                required: ['repository']
            }
        },
        {
            name: 'create_tag',
            description: 'Create a new tag on a specific commit.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug where the tag will be created.'},
                    name: {type: 'string', description: 'Tag name (e.g., "v1.0.0", "release-2023").'},
                    target: {type: 'string', description: 'Commit hash, branch name, or another tag to tag.'},
                    message: {type: 'string', description: 'Optional tag message for annotated tags.'}
                },
                required: ['repository', 'name', 'target']
            }
        },
        {
            name: 'delete_tag',
            description: 'Delete a tag from a repository.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug containing the tag.'},
                    name: {type: 'string', description: 'Name of the tag to delete.'}
                },
                required: ['repository', 'name']
            }
        },
        {
            name: 'list_issues',
            description: 'List issues in a repository with optional filtering by state, assignee, or milestone.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug to list issues from.'},
                    state: {
                        type: 'string',
                        enum: ['new', 'open', 'resolved', 'closed', 'invalid', 'duplicate', 'wontfix'],
                        description: 'Filter by issue state.'
                    },
                    assignee: {type: 'string', description: 'Filter by assignee username.'},
                    milestone: {type: 'string', description: 'Filter by milestone name.'},
                    limit: {type: 'number', description: 'Number of issues to return (default: 25, max: 100)'},
                    start: {type: 'number', description: 'Start index for pagination (default: 0)'}
                },
                required: ['repository']
            }
        },
        {
            name: 'create_issue',
            description: 'Create a new issue in a repository.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug where the issue will be created.'},
                    title: {type: 'string', description: 'Issue title.'},
                    content: {type: 'string', description: 'Issue description content. Supports Markdown formatting.'},
                    priority: {
                        type: 'string',
                        enum: ['trivial', 'minor', 'major', 'critical', 'blocker'],
                        description: 'Issue priority.'
                    },
                    kind: {
                        type: 'string',
                        enum: ['bug', 'enhancement', 'proposal', 'task'],
                        description: 'Issue type/kind.'
                    },
                    assignee: {type: 'string', description: 'Username to assign the issue to.'},
                    milestone: {type: 'string', description: 'Milestone name to assign the issue to.'}
                },
                required: ['repository', 'title']
            }
        },
        {
            name: 'get_issue',
            description: 'Get detailed information about a specific issue.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug containing the issue.'},
                    issueId: {type: 'number', description: 'Issue ID number.'}
                },
                required: ['repository', 'issueId']
            }
        },
        {
            name: 'update_issue',
            description: 'Update an existing issue.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug containing the issue.'},
                    issueId: {type: 'number', description: 'Issue ID number.'},
                    title: {type: 'string', description: 'Updated issue title.'},
                    content: {type: 'string', description: 'Updated issue description content.'},
                    state: {
                        type: 'string',
                        enum: ['new', 'open', 'resolved', 'closed', 'invalid', 'duplicate', 'wontfix'],
                        description: 'Updated issue state.'
                    },
                    priority: {
                        type: 'string',
                        enum: ['trivial', 'minor', 'major', 'critical', 'blocker'],
                        description: 'Updated issue priority.'
                    },
                    kind: {
                        type: 'string',
                        enum: ['bug', 'enhancement', 'proposal', 'task'],
                        description: 'Updated issue type/kind.'
                    },
                    assignee: {type: 'string', description: 'Username to assign the issue to.'},
                    milestone: {type: 'string', description: 'Milestone name to assign the issue to.'}
                },
                required: ['repository', 'issueId']
            }
        },
        {
            name: 'list_webhooks',
            description: 'List webhooks configured for a repository.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug to list webhooks from.'}
                },
                required: ['repository']
            }
        },
        {
            name: 'create_webhook',
            description: 'Create a new webhook for a repository to receive event notifications.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug where the webhook will be created.'},
                    url: {type: 'string', description: 'URL to send webhook payloads to.'},
                    description: {type: 'string', description: 'Optional description for the webhook.'},
                    active: {type: 'boolean', description: 'Whether the webhook is active (default: true).'},
                    events: {
                        type: 'array',
                        items: {type: 'string'},
                        description: 'Events to trigger the webhook (e.g., ["repo:push", "pullrequest:created"]).'
                    },
                    secret: {type: 'string', description: 'Optional secret for webhook payload verification.'}
                },
                required: ['repository', 'url', 'events']
            }
        },
        {
            name: 'get_webhook',
            description: 'Get details about a specific webhook.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug containing the webhook.'},
                    webhookId: {type: 'string', description: 'Webhook ID.'}
                },
                required: ['repository', 'webhookId']
            }
        },
        {
            name: 'update_webhook',
            description: 'Update an existing webhook.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug containing the webhook.'},
                    webhookId: {type: 'string', description: 'Webhook ID.'},
                    url: {type: 'string', description: 'Updated URL to send webhook payloads to.'},
                    description: {type: 'string', description: 'Updated description for the webhook.'},
                    active: {type: 'boolean', description: 'Whether the webhook is active.'},
                    events: {
                        type: 'array',
                        items: {type: 'string'},
                        description: 'Updated events to trigger the webhook.'
                    },
                    secret: {type: 'string', description: 'Updated secret for webhook payload verification.'}
                },
                required: ['repository', 'webhookId']
            }
        },
        {
            name: 'delete_webhook',
            description: 'Delete a webhook from a repository.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug containing the webhook.'},
                    webhookId: {type: 'string', description: 'Webhook ID to delete.'}
                },
                required: ['repository', 'webhookId']
            }
        },
        {
            name: 'list_ssh_keys',
            description: 'List SSH keys for the authenticated user.',
            inputSchema: {
                type: 'object',
                properties: {
                    limit: {type: 'number', description: 'Number of SSH keys to return (default: 25, max: 100)'},
                    start: {type: 'number', description: 'Start index for pagination (default: 0)'}
                }
            }
        },
        {
            name: 'add_ssh_key',
            description: 'Add a new SSH key to the authenticated user account.',
            inputSchema: {
                type: 'object',
                properties: {
                    key: {type: 'string', description: 'SSH public key content.'},
                    label: {type: 'string', description: 'Label for the SSH key.'}
                },
                required: ['key', 'label']
            }
        },
        {
            name: 'delete_ssh_key',
            description: 'Delete an SSH key from the authenticated user account.',
            inputSchema: {
                type: 'object',
                properties: {
                    keyId: {type: 'string', description: 'SSH key ID to delete.'}
                },
                required: ['keyId']
            }
        },
        {
            name: 'list_deploy_keys',
            description: 'List deploy keys for a repository.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug to list deploy keys from.'}
                },
                required: ['repository']
            }
        },
        {
            name: 'add_deploy_key',
            description: 'Add a deploy key to a repository for deployment access.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug where the deploy key will be added.'},
                    key: {type: 'string', description: 'SSH public key content.'},
                    label: {type: 'string', description: 'Label for the deploy key.'}
                },
                required: ['repository', 'key', 'label']
            }
        },
        {
            name: 'delete_deploy_key',
            description: 'Remove a deploy key from a repository.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug containing the deploy key.'},
                    keyId: {type: 'string', description: 'Deploy key ID to delete.'}
                },
                required: ['repository', 'keyId']
            }
        },
        {
            name: 'list_watchers',
            description: 'List users watching a repository.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug to list watchers from.'},
                    limit: {type: 'number', description: 'Number of watchers to return (default: 25, max: 100)'},
                    start: {type: 'number', description: 'Start index for pagination (default: 0)'}
                },
                required: ['repository']
            }
        },
        {
            name: 'watch_repository',
            description: 'Start watching a repository to receive notifications.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug to watch.'}
                },
                required: ['repository']
            }
        },
        {
            name: 'unwatch_repository',
            description: 'Stop watching a repository.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug to unwatch.'}
                },
                required: ['repository']
            }
        },
        {
            name: 'get_user',
            description: 'Get information about a specific user.',
            inputSchema: {
                type: 'object',
                properties: {
                    username: {type: 'string', description: 'Username to get information for.'}
                },
                required: ['username']
            }
        },
        {
            name: 'list_users',
            description: 'List users in the workspace/organization.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    limit: {type: 'number', description: 'Number of users to return (default: 25, max: 100)'},
                    start: {type: 'number', description: 'Start index for pagination (default: 0)'}
                }
            }
        },
        {
            name: 'search_code',
            description: 'Search for code within repositories.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    query: {type: 'string', description: 'Search query string.'},
                    repository: {type: 'string', description: 'Optional repository slug to limit search to.'},
                    limit: {type: 'number', description: 'Number of results to return (default: 25, max: 100)'},
                    start: {type: 'number', description: 'Start index for pagination (default: 0)'}
                },
                required: ['query']
            }
        },
        {
            name: 'get_repository_permissions',
            description: 'Get permissions information for a repository.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug to get permissions for.'},
                    user: {type: 'string', description: 'Optional username to check permissions for specific user.'}
                },
                required: ['repository']
            }
        },
        // Bitbucket Cloud specific: Pipelines
        ...(config.isCloud ? [
            {
                name: 'list_pipelines',
                description: 'List Bitbucket Pipelines builds for a repository.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        ...projectOrWorkspaceProperty,
                        repository: {type: 'string', description: 'Repository slug to list pipelines from.'},
                        target: {
                            type: 'object',
                            properties: {
                                type: {type: 'string', enum: ['pipeline_ref_name', 'pipeline_commit_sha']},
                                name: {type: 'string', description: 'Branch name or commit SHA.'}
                            }
                        },
                        limit: {type: 'number', description: 'Number of pipelines to return (default: 25, max: 100)'},
                        start: {type: 'number', description: 'Start index for pagination (default: 0)'}
                    },
                    required: ['repository']
                }
            },
            {
                name: 'get_pipeline',
                description: 'Get details about a specific pipeline build.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        ...projectOrWorkspaceProperty,
                        repository: {type: 'string', description: 'Repository slug containing the pipeline.'},
                        pipelineId: {type: 'string', description: 'Pipeline UUID.'}
                    },
                    required: ['repository', 'pipelineId']
                }
            },
            {
                name: 'trigger_pipeline',
                description: 'Trigger a new pipeline build.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        ...projectOrWorkspaceProperty,
                        repository: {type: 'string', description: 'Repository slug to trigger pipeline in.'},
                        target: {
                            type: 'object',
                            properties: {
                                type: {type: 'string', enum: ['pipeline_ref_name', 'pipeline_commit_sha']},
                                name: {type: 'string', description: 'Branch name or commit SHA.'}
                            },
                            required: ['type', 'name']
                        },
                        variables: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    key: {type: 'string'},
                                    value: {type: 'string'},
                                    secured: {type: 'boolean'}
                                }
                            },
                            description: 'Pipeline variables to pass to the build.'
                        }
                    },
                    required: ['repository', 'target']
                }
            },
            {
                name: 'stop_pipeline',
                description: 'Stop a running pipeline build.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        ...projectOrWorkspaceProperty,
                        repository: {type: 'string', description: 'Repository slug containing the pipeline.'},
                        pipelineId: {type: 'string', description: 'Pipeline UUID to stop.'}
                    },
                    required: ['repository', 'pipelineId']
                }
            }
        ] : []),
        // Bitbucket Cloud specific: Snippets
        ...(config.isCloud ? [
            {
                name: 'list_snippets',
                description: 'List code snippets for a workspace. Snippets are code segments that can be shared publicly or privately.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        ...projectOrWorkspaceProperty,
                        role: {
                            type: 'string',
                            enum: ['member', 'contributor', 'owner'],
                            description: 'Filter snippets by your role (default: member)'
                        },
                        limit: {type: 'number', description: 'Number of snippets to return (default: 10, max: 100)'},
                        page: {type: 'number', description: 'Page number for pagination (default: 1)'}
                    }
                }
            },
            {
                name: 'get_snippet',
                description: 'Get details about a specific snippet including its content and metadata.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        ...projectOrWorkspaceProperty,
                        snippetId: {type: 'string', description: 'The snippet ID to retrieve.'}
                    },
                    required: ['snippetId']
                }
            },
            {
                name: 'create_snippet',
                description: 'Create a new code snippet with one or more files.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        ...projectOrWorkspaceProperty,
                        title: {type: 'string', description: 'Title for the snippet.'},
                        isPrivate: {type: 'boolean', description: 'Whether the snippet should be private (default: true).'},
                        files: {
                            type: 'object',
                            description: 'Files to include in the snippet. Object keys are filenames, values are file content.',
                            additionalProperties: {type: 'string'}
                        }
                    },
                    required: ['title', 'files']
                }
            },
            {
                name: 'update_snippet',
                description: 'Update an existing snippet with new content or metadata.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        ...projectOrWorkspaceProperty,
                        snippetId: {type: 'string', description: 'The snippet ID to update.'},
                        title: {type: 'string', description: 'New title for the snippet.'},
                        isPrivate: {type: 'boolean', description: 'Whether the snippet should be private.'},
                        files: {
                            type: 'object',
                            description: 'Files to update in the snippet. Object keys are filenames, values are file content.',
                            additionalProperties: {type: 'string'}
                        }
                    },
                    required: ['snippetId']
                }
            },
            {
                name: 'delete_snippet',
                description: 'Delete a snippet permanently.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        ...projectOrWorkspaceProperty,
                        snippetId: {type: 'string', description: 'The snippet ID to delete.'}
                    },
                    required: ['snippetId']
                }
            },
            {
                name: 'get_snippet_file',
                description: 'Get the raw content of a specific file within a snippet.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        ...projectOrWorkspaceProperty,
                        snippetId: {type: 'string', description: 'The snippet ID.'},
                        filename: {type: 'string', description: 'The filename to retrieve from the snippet.'}
                    },
                    required: ['snippetId', 'filename']
                }
            }
        ] : []),
        // Branch restrictions/permissions (both Cloud and Server)
        {
            name: 'list_branch_restrictions',
            description: 'List branch restrictions for a repository to see what rules are enforced on branches.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug to list restrictions from.'},
                    kind: {
                        type: 'string',
                        enum: ['push', 'force', 'delete', 'restrict_merges'],
                        description: 'Filter by restriction type.'
                    }
                },
                required: ['repository']
            }
        },
        {
            name: 'create_branch_restriction',
            description: 'Create a new branch restriction to enforce rules on specific branches.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug to create restriction in.'},
                    kind: {
                        type: 'string',
                        enum: ['push', 'force', 'delete', 'restrict_merges'],
                        description: 'Type of restriction to create.'
                    },
                    pattern: {type: 'string', description: 'Branch name pattern (supports wildcards like main, feature/*, etc).'},
                    users: {
                        type: 'array',
                        items: {type: 'string'},
                        description: 'List of usernames exempt from this restriction.'
                    },
                    groups: {
                        type: 'array',
                        items: {type: 'string'},
                        description: 'List of groups exempt from this restriction.'
                    }
                },
                required: ['repository', 'kind', 'pattern']
            }
        },
        {
            name: 'get_branch_restriction',
            description: 'Get details about a specific branch restriction.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug containing the restriction.'},
                    restrictionId: {type: 'string', description: 'ID of the branch restriction.'}
                },
                required: ['repository', 'restrictionId']
            }
        },
        {
            name: 'update_branch_restriction',
            description: 'Update an existing branch restriction.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug containing the restriction.'},
                    restrictionId: {type: 'string', description: 'ID of the branch restriction.'},
                    pattern: {type: 'string', description: 'Updated branch name pattern.'},
                    users: {
                        type: 'array',
                        items: {type: 'string'},
                        description: 'Updated list of usernames exempt from this restriction.'
                    },
                    groups: {
                        type: 'array',
                        items: {type: 'string'},
                        description: 'Updated list of groups exempt from this restriction.'
                    }
                },
                required: ['repository', 'restrictionId']
            }
        },
        {
            name: 'delete_branch_restriction',
            description: 'Delete a branch restriction.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug containing the restriction.'},
                    restrictionId: {type: 'string', description: 'ID of the branch restriction to delete.'}
                },
                required: ['repository', 'restrictionId']
            }
        },
        // Commit comments
        {
            name: 'list_commit_comments',
            description: 'List comments on a specific commit for code review and discussion.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug containing the commit.'},
                    commitId: {type: 'string', description: 'Commit hash to list comments from.'},
                    limit: {type: 'number', description: 'Number of comments to return (default: 25, max: 100)'},
                    start: {type: 'number', description: 'Start index for pagination (default: 0)'}
                },
                required: ['repository', 'commitId']
            }
        },
        {
            name: 'create_commit_comment',
            description: 'Add a comment to a commit for code review or discussion.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug containing the commit.'},
                    commitId: {type: 'string', description: 'Commit hash to comment on.'},
                    content: {type: 'string', description: 'Comment text content. Supports Markdown formatting.'},
                    path: {type: 'string', description: 'File path for inline comments.'},
                    line: {type: 'number', description: 'Line number for inline comments.'}
                },
                required: ['repository', 'commitId', 'content']
            }
        },
        {
            name: 'get_commit_comment',
            description: 'Get details about a specific commit comment.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug containing the commit.'},
                    commitId: {type: 'string', description: 'Commit hash containing the comment.'},
                    commentId: {type: 'string', description: 'ID of the comment to retrieve.'}
                },
                required: ['repository', 'commitId', 'commentId']
            }
        },
        {
            name: 'update_commit_comment',
            description: 'Update the content of an existing commit comment.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug containing the commit.'},
                    commitId: {type: 'string', description: 'Commit hash containing the comment.'},
                    commentId: {type: 'string', description: 'ID of the comment to update.'},
                    content: {type: 'string', description: 'Updated comment text content.'}
                },
                required: ['repository', 'commitId', 'commentId', 'content']
            }
        },
        {
            name: 'delete_commit_comment',
            description: 'Delete a commit comment.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug containing the commit.'},
                    commitId: {type: 'string', description: 'Commit hash containing the comment.'},
                    commentId: {type: 'string', description: 'ID of the comment to delete.'}
                },
                required: ['repository', 'commitId', 'commentId']
            }
        },
        // Issue comments
        {
            name: 'list_issue_comments',
            description: 'List comments on a specific issue for discussion and tracking.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug containing the issue.'},
                    issueId: {type: 'number', description: 'Issue ID to list comments from.'},
                    limit: {type: 'number', description: 'Number of comments to return (default: 25, max: 100)'},
                    start: {type: 'number', description: 'Start index for pagination (default: 0)'}
                },
                required: ['repository', 'issueId']
            }
        },
        {
            name: 'create_issue_comment',
            description: 'Add a comment to an issue for discussion and updates.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug containing the issue.'},
                    issueId: {type: 'number', description: 'Issue ID to comment on.'},
                    content: {type: 'string', description: 'Comment text content. Supports Markdown formatting.'}
                },
                required: ['repository', 'issueId', 'content']
            }
        },
        {
            name: 'get_issue_comment',
            description: 'Get details about a specific issue comment.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug containing the issue.'},
                    issueId: {type: 'number', description: 'Issue ID containing the comment.'},
                    commentId: {type: 'string', description: 'ID of the comment to retrieve.'}
                },
                required: ['repository', 'issueId', 'commentId']
            }
        },
        {
            name: 'update_issue_comment',
            description: 'Update the content of an existing issue comment.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug containing the issue.'},
                    issueId: {type: 'number', description: 'Issue ID containing the comment.'},
                    commentId: {type: 'string', description: 'ID of the comment to update.'},
                    content: {type: 'string', description: 'Updated comment text content.'}
                },
                required: ['repository', 'issueId', 'commentId', 'content']
            }
        },
        {
            name: 'delete_issue_comment',
            description: 'Delete an issue comment.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug containing the issue.'},
                    issueId: {type: 'number', description: 'Issue ID containing the comment.'},
                    commentId: {type: 'string', description: 'ID of the comment to delete.'}
                },
                required: ['repository', 'issueId', 'commentId']
            }
        },
        // Default reviewers
        {
            name: 'list_default_reviewers',
            description: 'List default reviewers configured for a repository or project.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug to list default reviewers from (optional for project-level).'}
                }
            }
        },
        {
            name: 'add_default_reviewer',
            description: 'Add a user as a default reviewer for pull requests.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug to add default reviewer to (optional for project-level).'},
                    username: {type: 'string', description: 'Username to add as default reviewer.'}
                },
                required: ['username']
            }
        },
        {
            name: 'remove_default_reviewer',
            description: 'Remove a user from default reviewers.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug to remove default reviewer from (optional for project-level).'},
                    username: {type: 'string', description: 'Username to remove from default reviewers.'}
                },
                required: ['username']
            }
        },
        // Repository compare and merge base
        {
            name: 'compare_commits',
            description: 'Compare two commits, branches, or tags to see differences.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug to compare in.'},
                    source: {type: 'string', description: 'Source commit/branch/tag to compare from.'},
                    destination: {type: 'string', description: 'Destination commit/branch/tag to compare to.'},
                    include_merge_commit: {type: 'boolean', description: 'Whether to include merge commits in comparison.'}
                },
                required: ['repository', 'source', 'destination']
            }
        },
        {
            name: 'get_merge_base',
            description: 'Get the merge base (common ancestor) between two commits or branches.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug to find merge base in.'},
                    commit1: {type: 'string', description: 'First commit/branch/tag.'},
                    commit2: {type: 'string', description: 'Second commit/branch/tag.'}
                },
                required: ['repository', 'commit1', 'commit2']
            }
        },
        // File history and blame
        {
            name: 'get_file_history',
            description: 'Get the commit history for a specific file to see all changes over time.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug containing the file.'},
                    path: {type: 'string', description: 'File path to get history for.'},
                    branch: {type: 'string', description: 'Branch to get file history from (default: default branch).'},
                    limit: {type: 'number', description: 'Number of commits to return (default: 25, max: 100)'}
                },
                required: ['repository', 'path']
            }
        },
        {
            name: 'get_file_blame',
            description: 'Get blame information for a file showing who last modified each line.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug containing the file.'},
                    path: {type: 'string', description: 'File path to get blame information for.'},
                    branch: {type: 'string', description: 'Branch to get file blame from (default: default branch).'},
                    commitId: {type: 'string', description: 'Specific commit to get blame from (takes precedence over branch).'}
                },
                required: ['repository', 'path']
            }
        },
        // Bitbucket Server specific: Build status
        ...(!config.isCloud ? [
            {
                name: 'get_build_status',
                description: 'Get build status for a specific commit.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        ...projectOrWorkspaceProperty,
                        repository: {type: 'string', description: 'Repository slug containing the commit.'},
                        commitId: {type: 'string', description: 'Commit hash to get build status for.'}
                    },
                    required: ['repository', 'commitId']
                }
            },
            {
                name: 'set_build_status',
                description: 'Set build status for a specific commit.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        ...projectOrWorkspaceProperty,
                        repository: {type: 'string', description: 'Repository slug containing the commit.'},
                        commitId: {type: 'string', description: 'Commit hash to set build status for.'},
                        state: {
                            type: 'string',
                            enum: ['INPROGRESS', 'SUCCESSFUL', 'FAILED'],
                            description: 'Build status state.'
                        },
                        key: {type: 'string', description: 'Unique key for this build status.'},
                        name: {type: 'string', description: 'Display name for the build.'},
                        url: {type: 'string', description: 'URL to the build details.'},
                        description: {type: 'string', description: 'Description of the build status.'}
                    },
                    required: ['repository', 'commitId', 'state', 'key']
                }
            }
        ] : []),
        
        // Downloads functionality (both Cloud and Server)
        {
            name: 'list_downloads',
            description: 'List files available for download from a repository (Cloud: downloads, Server: artifacts).',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug to list downloads from.'}
                },
                required: ['repository']
            }
        },
        {
            name: 'upload_download',
            description: 'Upload a file to repository downloads (Cloud only).',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug to upload file to.'},
                    filename: {type: 'string', description: 'Name of the file to upload.'},
                    content: {type: 'string', description: 'Content of the file to upload.'}
                },
                required: ['repository', 'filename', 'content']
            }
        },
        {
            name: 'delete_download',
            description: 'Delete a file from repository downloads (Cloud only).',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug containing the download.'},
                    filename: {type: 'string', description: 'Name of the file to delete.'}
                },
                required: ['repository', 'filename']
            }
        },
        
        // Forking functionality
        {
            name: 'fork_repository',
            description: 'Create a fork of a repository in your workspace/project or another workspace/project.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug to fork.'},
                    newName: {type: 'string', description: 'Name for the forked repository.'},
                    targetWorkspace: {type: 'string', description: 'Target workspace for the fork (Cloud only).'},
                    targetProject: {type: 'string', description: 'Target project for the fork (Server only).'},
                    isPrivate: {type: 'boolean', description: 'Whether the fork should be private (Cloud only).'}
                },
                required: ['repository']
            }
        },
        {
            name: 'list_forks',
            description: 'List all forks of a repository.',
            inputSchema: {
                type: 'object',
                properties: {
                    ...projectOrWorkspaceProperty,
                    repository: {type: 'string', description: 'Repository slug to list forks from.'},
                    limit: {type: 'number', description: 'Number of forks to return (default: 25, max: 100)'},
                    start: {type: 'number', description: 'Start index for pagination (default: 0)'}
                },
                required: ['repository']
            }
        },
        
        // Bitbucket Cloud specific: Deployments and Environments
        ...(config.isCloud ? [
            {
                name: 'list_deployments',
                description: 'List deployments for a repository in Bitbucket Cloud.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        ...projectOrWorkspaceProperty,
                        repository: {type: 'string', description: 'Repository slug to list deployments from.'}
                    },
                    required: ['repository']
                }
            },
            {
                name: 'get_deployment',
                description: 'Get details about a specific deployment.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        ...projectOrWorkspaceProperty,
                        repository: {type: 'string', description: 'Repository slug.'},
                        deploymentId: {type: 'string', description: 'Deployment ID to retrieve.'}
                    },
                    required: ['repository', 'deploymentId']
                }
            },
            {
                name: 'list_environments',
                description: 'List deployment environments for a repository.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        ...projectOrWorkspaceProperty,
                        repository: {type: 'string', description: 'Repository slug to list environments from.'}
                    },
                    required: ['repository']
                }
            },
            {
                name: 'create_environment',
                description: 'Create a new deployment environment.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        ...projectOrWorkspaceProperty,
                        repository: {type: 'string', description: 'Repository slug.'},
                        name: {type: 'string', description: 'Environment name.'},
                        type: {
                            type: 'string',
                            enum: ['Test', 'Staging', 'Production'],
                            description: 'Environment type.'
                        },
                        slug: {type: 'string', description: 'URL slug for the environment.'}
                    },
                    required: ['repository', 'name', 'type']
                }
            },
            {
                name: 'update_environment',
                description: 'Update an existing deployment environment.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        ...projectOrWorkspaceProperty,
                        repository: {type: 'string', description: 'Repository slug.'},
                        environmentUuid: {type: 'string', description: 'Environment UUID to update.'},
                        name: {type: 'string', description: 'New environment name.'},
                        type: {
                            type: 'string',
                            enum: ['Test', 'Staging', 'Production'],
                            description: 'New environment type.'
                        }
                    },
                    required: ['repository', 'environmentUuid']
                }
            },
            {
                name: 'delete_environment',
                description: 'Delete a deployment environment.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        ...projectOrWorkspaceProperty,
                        repository: {type: 'string', description: 'Repository slug.'},
                        environmentUuid: {type: 'string', description: 'Environment UUID to delete.'}
                    },
                    required: ['repository', 'environmentUuid']
                }
            }
        ] : [])
    ];
} 