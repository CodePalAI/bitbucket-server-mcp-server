import {AxiosInstance} from 'axios';
import {ErrorCode, McpError} from '@modelcontextprotocol/sdk/types.js';
import {
    BitbucketActivity,
    BitbucketConfig,
    CommentOptions,
    MergeOptions,
    PullRequestActivityParams,
    PullRequestCommitsParams,
    PullRequestInput,
    PullRequestParams
} from '../types/interfaces.js';

export class PullRequestHandler {
    constructor(
        private api: AxiosInstance,
        private config: BitbucketConfig
    ) {
    }

    async createPullRequest(input: PullRequestInput) {
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

    async getPullRequest(params: PullRequestParams) {
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

    async mergePullRequest(params: PullRequestParams, options: MergeOptions = {}) {
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

    async declinePullRequest(params: PullRequestParams, message?: string) {
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

    async addComment(params: PullRequestParams, options: CommentOptions) {
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

    async getDiff(params: PullRequestParams, contextLines: number = 10) {
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

    async getReviews(params: PullRequestParams) {
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

    async getPullRequestActivity(params: PullRequestActivityParams) {
        const {repository, prId} = params;

        if (!repository || !prId) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository and prId are required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            const response = await this.api.get(
                `/repositories/${workspace}/${repository}/pullrequests/${prId}/activity`
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
                `/projects/${project}/repos/${repository}/pull-requests/${prId}/activities`
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        }
    }

    async getPullRequestCommits(params: PullRequestCommitsParams) {
        const {repository, prId} = params;
        const {limit = 25, start = 0} = params;

        if (!repository || !prId) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository and prId are required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            const response = await this.api.get(
                `/repositories/${workspace}/${repository}/pullrequests/${prId}/commits`,
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
                `/projects/${project}/repos/${repository}/pull-requests/${prId}/commits`,
                {params: {limit, start}}
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        }
    }
} 