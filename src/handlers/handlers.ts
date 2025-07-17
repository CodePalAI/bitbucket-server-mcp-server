import {AxiosInstance} from 'axios';
import {ErrorCode, McpError} from '@modelcontextprotocol/sdk/types.js';
import {
    BitbucketConfig,
    BranchParams,
    BranchRestrictionParams,
    CommitCommentParams,
    CommitParams,
    CreateBranchRestrictionInput,
    CreateCommitCommentInput,
    ListOptions
} from '../types/interfaces.js';

export class BranchHandler {
    constructor(private api: AxiosInstance, private config: BitbucketConfig) {
    }

    async listBranches(params: BranchParams, options: ListOptions = {}) {
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

    async createBranch(params: BranchParams, startPoint?: string) {
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

    async deleteBranch(params: BranchParams) {
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

    async listBranchRestrictions(params: BranchRestrictionParams) {
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
                `/repositories/${workspace}/${repository}/branch-restrictions`
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
                `/projects/${project}/repos/${repository}/restrictions`
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        }
    }

    async createBranchRestriction(input: CreateBranchRestrictionInput) {
        const {repository, kind, pattern} = input;

        if (!repository || !kind || !pattern) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository, kind, and pattern are required');
        }

        if (this.config.isCloud) {
            const workspace = input.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            const restrictionData = {
                kind,
                pattern,
                users: input.users || [],
                groups: input.groups || []
            };

            const response = await this.api.post(
                `/repositories/${workspace}/${repository}/branch-restrictions`,
                restrictionData
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        } else {
            const project = input.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(ErrorCode.InvalidParams, 'Project is required for Bitbucket Server');
            }

            const restrictionData = {
                type: kind,
                matcher: {
                    id: pattern,
                    type: {id: 'PATTERN'}
                },
                users: input.users || [],
                groups: input.groups || []
            };

            const response = await this.api.post(
                `/projects/${project}/repos/${repository}/restrictions`,
                restrictionData
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        }
    }
}

export class CommitHandler {
    constructor(private api: AxiosInstance, private config: BitbucketConfig) {
    }

    async listCommits(params: CommitParams, options: ListOptions = {}) {
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

    async getCommit(params: CommitParams) {
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

    async listCommitComments(params: CommitCommentParams) {
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
                `/repositories/${workspace}/${repository}/commit/${commitId}/comments`
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
                `/projects/${project}/repos/${repository}/commits/${commitId}/comments`
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        }
    }

    async createCommitComment(input: CreateCommitCommentInput) {
        const {repository, commitId, content} = input;

        if (!repository || !commitId || !content) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository, commitId, and content are required');
        }

        if (this.config.isCloud) {
            const workspace = input.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            const commentData: any = {
                content: {
                    raw: content,
                    markup: 'markdown'
                }
            };

            if (input.path && input.line) {
                commentData.inline = {
                    path: input.path,
                    from: input.line,
                    to: input.line
                };
            }

            const response = await this.api.post(
                `/repositories/${workspace}/${repository}/commit/${commitId}/comments`,
                commentData
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        } else {
            const project = input.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(ErrorCode.InvalidParams, 'Project is required for Bitbucket Server');
            }

            const commentData: any = {
                text: content
            };

            if (input.path && input.line) {
                commentData.anchor = {
                    path: input.path,
                    line: input.line
                };
            }

            const response = await this.api.post(
                `/projects/${project}/repos/${repository}/commits/${commitId}/comments`,
                commentData
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        }
    }
}

// Continue with all other handlers in a similar pattern...
// (I'll create separate files for the remaining handlers to avoid making this too long)

export {RepositoryHandler} from './repository-handler.js';
export {PullRequestHandler} from './pull-request-handler.js';