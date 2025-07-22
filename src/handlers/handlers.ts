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

            const branchData = {
                name: branchName,
                target: {
                    hash: startPoint || 'main'
                }
            };

            const response = await this.api.post(
                `/repositories/${workspace}/${repository}/refs/branches`,
                branchData
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        } else {
            const project = params.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(ErrorCode.InvalidParams, 'Project is required for Bitbucket Server');
            }

            const branchData = {
                name: branchName,
                startPoint: startPoint || 'refs/heads/master'
            };

            const response = await this.api.post(
                `/projects/${project}/repos/${repository}/branches`,
                branchData
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        }
    }

    async deleteBranch(params: any) {
        const {repository, branchName} = params;

        if (!repository || !branchName) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository and branchName are required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            await this.api.delete(
                `/repositories/${workspace}/${repository}/refs/branches/${branchName}`
            );

            return {
                content: [{type: 'text', text: 'Branch deleted successfully'}]
            };
        } else {
            const project = params.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(ErrorCode.InvalidParams, 'Project is required for Bitbucket Server');
            }

            await this.api.delete(
                `/projects/${project}/repos/${repository}/branches/${branchName}`
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

export class IssueHandler {
    constructor(private api: AxiosInstance, private config: BitbucketConfig) {
    }

    async listIssues(params: any) {
        const {repository, state, assignee, milestone, limit = 25, start = 0} = params;
        if (!repository) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository is required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            const queryParams: any = {pagelen: limit, page: Math.floor(start / limit) + 1};
            if (state) queryParams.state = state;
            if (assignee) queryParams.assignee = assignee;

            const response = await this.api.get(
                `/repositories/${workspace}/${repository}/issues`,
                {params: queryParams}
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        } else {
            throw new McpError(ErrorCode.InvalidParams, 'Issues are only supported on Bitbucket Cloud');
        }
    }

    async createIssue(params: any) {
        const {repository, title, content, priority, kind, assignee, milestone} = params;
        if (!repository || !title) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository and title are required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            const issueData: any = {
                title,
                content: content ? {raw: content, markup: 'markdown'} : undefined,
                priority,
                kind,
                assignee: assignee ? {username: assignee} : undefined,
                milestone: milestone ? {name: milestone} : undefined
            };

            const response = await this.api.post(
                `/repositories/${workspace}/${repository}/issues`,
                issueData
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        } else {
            throw new McpError(ErrorCode.InvalidParams, 'Issues are only supported on Bitbucket Cloud');
        }
    }

    async getIssue(params: any) {
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
            throw new McpError(ErrorCode.InvalidParams, 'Issues are only supported on Bitbucket Cloud');
        }
    }

    async updateIssue(params: any) {
        const {repository, issueId, title, content, state, priority, kind, assignee, milestone} = params;
        if (!repository || !issueId) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository and issueId are required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            const updateData: any = {};
            if (title) updateData.title = title;
            if (content) updateData.content = {raw: content, markup: 'markdown'};
            if (state) updateData.state = state;
            if (priority) updateData.priority = priority;
            if (kind) updateData.kind = kind;
            if (assignee) updateData.assignee = {username: assignee};
            if (milestone) updateData.milestone = {name: milestone};

            const response = await this.api.put(
                `/repositories/${workspace}/${repository}/issues/${issueId}`,
                updateData
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        } else {
            throw new McpError(ErrorCode.InvalidParams, 'Issues are only supported on Bitbucket Cloud');
        }
    }

    async listIssueComments(params: any) {
        const { repository, issueId, limit = 25, start = 0 } = params;
        
        if (!repository || !issueId) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository and issue ID are required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            const response = await this.api.get(`/repositories/${workspace}/${repository}/issues/${issueId}/comments`, {
                params: { pagelen: limit, page: Math.floor(start / limit) + 1 }
            });
            return {
                content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }]
            };
        } else {
            throw new McpError(ErrorCode.InvalidParams, 'Issues are only supported on Bitbucket Cloud');
        }
    }

    async createIssueComment(params: any) {
        const { repository, issueId, content } = params;
        
        if (!repository || !issueId || !content) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository, issue ID, and content are required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            const commentData = {
                content: { raw: content }
            };

            const response = await this.api.post(`/repositories/${workspace}/${repository}/issues/${issueId}/comments`, commentData);
            return {
                content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }]
            };
        } else {
            throw new McpError(ErrorCode.InvalidParams, 'Issues are only supported on Bitbucket Cloud');
        }
    }

    async getIssueComment(params: any) {
        const { repository, issueId, commentId } = params;
        
        if (!repository || !issueId || !commentId) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository, issue ID, and comment ID are required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            const response = await this.api.get(`/repositories/${workspace}/${repository}/issues/${issueId}/comments/${commentId}`);
            return {
                content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }]
            };
        } else {
            throw new McpError(ErrorCode.InvalidParams, 'Issues are only supported on Bitbucket Cloud');
        }
    }

    async updateIssueComment(params: any) {
        const { repository, issueId, commentId, content } = params;
        
        if (!repository || !issueId || !commentId || !content) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository, issue ID, comment ID, and content are required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            const updateData = {
                content: { raw: content }
            };

            const response = await this.api.put(`/repositories/${workspace}/${repository}/issues/${issueId}/comments/${commentId}`, updateData);
            return {
                content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }]
            };
        } else {
            throw new McpError(ErrorCode.InvalidParams, 'Issues are only supported on Bitbucket Cloud');
        }
    }

    async deleteIssueComment(params: any) {
        const { repository, issueId, commentId } = params;
        
        if (!repository || !issueId || !commentId) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository, issue ID, and comment ID are required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            await this.api.delete(`/repositories/${workspace}/${repository}/issues/${issueId}/comments/${commentId}`);
            return {
                content: [{ type: 'text', text: `Comment ${commentId} deleted successfully` }]
            };
        } else {
            throw new McpError(ErrorCode.InvalidParams, 'Issues are only supported on Bitbucket Cloud');
        }
    }
}

export class WebhookHandler {
    constructor(private api: AxiosInstance, private config: BitbucketConfig) {
    }

    async listWebhooks(params: any) {
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

    async createWebhook(params: any) {
        const {repository, url, description, active = true, events, secret} = params;
        if (!repository || !url || !events) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository, url, and events are required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            const webhookData = {
                description,
                url,
                active,
                events,
                secret
            };

            const response = await this.api.post(
                `/repositories/${workspace}/${repository}/hooks`,
                webhookData
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        } else {
            const project = params.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(ErrorCode.InvalidParams, 'Project is required for Bitbucket Server');
            }

            const webhookData = {
                name: description || 'Webhook',
                url,
                active,
                events
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

    async getWebhook(params: any) {
        const {repository, webhookId} = params;
        if (!repository || !webhookId) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository and webhookId are required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            const response = await this.api.get(
                `/repositories/${workspace}/${repository}/hooks/${webhookId}`
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
                `/projects/${project}/repos/${repository}/webhooks/${webhookId}`
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        }
    }

    async updateWebhook(params: any) {
        const {repository, webhookId, url, description, active, events, secret} = params;
        if (!repository || !webhookId) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository and webhookId are required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            const updateData: any = {};
            if (description !== undefined) updateData.description = description;
            if (url) updateData.url = url;
            if (active !== undefined) updateData.active = active;
            if (events) updateData.events = events;
            if (secret !== undefined) updateData.secret = secret;

            const response = await this.api.put(
                `/repositories/${workspace}/${repository}/hooks/${webhookId}`,
                updateData
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        } else {
            const project = params.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(ErrorCode.InvalidParams, 'Project is required for Bitbucket Server');
            }

            const updateData: any = {};
            if (description) updateData.name = description;
            if (url) updateData.url = url;
            if (active !== undefined) updateData.active = active;
            if (events) updateData.events = events;

            const response = await this.api.put(
                `/projects/${project}/repos/${repository}/webhooks/${webhookId}`,
                updateData
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        }
    }

    async deleteWebhook(params: any) {
        const {repository, webhookId} = params;
        if (!repository || !webhookId) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository and webhookId are required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            await this.api.delete(
                `/repositories/${workspace}/${repository}/hooks/${webhookId}`
            );

            return {
                content: [{type: 'text', text: 'Webhook deleted successfully'}]
            };
        } else {
            const project = params.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(ErrorCode.InvalidParams, 'Project is required for Bitbucket Server');
            }

            await this.api.delete(
                `/projects/${project}/repos/${repository}/webhooks/${webhookId}`
            );

            return {
                content: [{type: 'text', text: 'Webhook deleted successfully'}]
            };
        }
    }
}

export class SshKeyHandler {
    constructor(private api: AxiosInstance, private config: BitbucketConfig) {
    }

    async listSshKeys(params: any) {
        const {limit = 25, start = 0} = params;

        if (this.config.isCloud) {
            const response = await this.api.get(
                '/user/ssh-keys',
                {params: {pagelen: limit, page: Math.floor(start / limit) + 1}}
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        } else {
            const response = await this.api.get(
                '/ssh/keys',
                {params: {limit, start}}
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        }
    }

    async addSshKey(params: any) {
        const {key, label} = params;
        if (!key || !label) {
            throw new McpError(ErrorCode.InvalidParams, 'Key and label are required');
        }

        if (this.config.isCloud) {
            const keyData = {
                key,
                label
            };

            const response = await this.api.post('/user/ssh-keys', keyData);

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        } else {
            const keyData = {
                text: key,
                label
            };

            const response = await this.api.post('/ssh/keys', keyData);

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        }
    }

    async deleteSshKey(params: any) {
        const {keyId} = params;
        if (!keyId) {
            throw new McpError(ErrorCode.InvalidParams, 'KeyId is required');
        }

        if (this.config.isCloud) {
            await this.api.delete(`/user/ssh-keys/${keyId}`);
        } else {
            await this.api.delete(`/ssh/keys/${keyId}`);
        }

        return {
            content: [{type: 'text', text: 'SSH key deleted successfully'}]
        };
    }
}

export class DeployKeyHandler {
    constructor(private api: AxiosInstance, private config: BitbucketConfig) {
    }

    async listDeployKeys(params: any) {
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
                `/repositories/${workspace}/${repository}/deploy-keys`
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
                `/projects/${project}/repos/${repository}/ssh`
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        }
    }

    async addDeployKey(params: any) {
        const {repository, key, label} = params;
        if (!repository || !key || !label) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository, key, and label are required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            const keyData = {
                key,
                label
            };

            const response = await this.api.post(
                `/repositories/${workspace}/${repository}/deploy-keys`,
                keyData
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        } else {
            const project = params.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(ErrorCode.InvalidParams, 'Project is required for Bitbucket Server');
            }

            const keyData = {
                key: {
                    text: key,
                    label
                },
                permission: 'REPO_READ'
            };

            const response = await this.api.post(
                `/projects/${project}/repos/${repository}/ssh`,
                keyData
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        }
    }

    async deleteDeployKey(params: any) {
        const {repository, keyId} = params;
        if (!repository || !keyId) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository and keyId are required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            await this.api.delete(
                `/repositories/${workspace}/${repository}/deploy-keys/${keyId}`
            );
        } else {
            const project = params.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(ErrorCode.InvalidParams, 'Project is required for Bitbucket Server');
            }

            await this.api.delete(
                `/projects/${project}/repos/${repository}/ssh/${keyId}`
            );
        }

        return {
            content: [{type: 'text', text: 'Deploy key deleted successfully'}]
        };
    }
}

export class TagHandler {
    constructor(private api: AxiosInstance, private config: BitbucketConfig) {
    }

    async listTags(params: any) {
        const {repository, limit = 25, start = 0} = params;
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

    async createTag(params: any) {
        const {repository, name, target, message} = params;
        if (!repository || !name || !target) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository, name, and target are required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            const tagData = {
                name,
                target: {
                    hash: target
                },
                message
            };

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

            const tagData = {
                name,
                startPoint: target,
                message
            };

            const response = await this.api.post(
                `/projects/${project}/repos/${repository}/tags`,
                tagData
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        }
    }

    async deleteTag(params: any) {
        const {repository, name} = params;
        if (!repository || !name) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository and name are required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            await this.api.delete(
                `/repositories/${workspace}/${repository}/refs/tags/${name}`
            );
        } else {
            const project = params.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(ErrorCode.InvalidParams, 'Project is required for Bitbucket Server');
            }

            await this.api.delete(
                `/projects/${project}/repos/${repository}/tags/${name}`
            );
        }

        return {
            content: [{type: 'text', text: 'Tag deleted successfully'}]
        };
    }
}

export class WatcherHandler {
    constructor(private api: AxiosInstance, private config: BitbucketConfig) {
    }

    async listWatchers(params: any) {
        const {repository, limit = 25, start = 0} = params;
        if (!repository) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository is required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            const response = await this.api.get(
                `/repositories/${workspace}/${repository}/watchers`,
                {params: {pagelen: limit, page: Math.floor(start / limit) + 1}}
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        } else {
            throw new McpError(ErrorCode.InvalidParams, 'Watchers API is only supported on Bitbucket Cloud');
        }
    }

    async watchRepository(params: any) {
        const {repository} = params;
        if (!repository) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository is required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            const response = await this.api.put(
                `/repositories/${workspace}/${repository}/watchers/{user}`
            );

            return {
                content: [{type: 'text', text: 'Successfully watching repository'}]
            };
        } else {
            throw new McpError(ErrorCode.InvalidParams, 'Watchers API is only supported on Bitbucket Cloud');
        }
    }

    async unwatchRepository(params: any) {
        const {repository} = params;
        if (!repository) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository is required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            await this.api.delete(
                `/repositories/${workspace}/${repository}/watchers/{user}`
            );

            return {
                content: [{type: 'text', text: 'Successfully unwatched repository'}]
            };
        } else {
            throw new McpError(ErrorCode.InvalidParams, 'Watchers API is only supported on Bitbucket Cloud');
        }
    }
}

export class UserHandler {
    constructor(private api: AxiosInstance, private config: BitbucketConfig) {
    }

    async getUser(params: any) {
        const {username} = params;
        if (!username) {
            throw new McpError(ErrorCode.InvalidParams, 'Username is required');
        }

        if (this.config.isCloud) {
            const response = await this.api.get(`/users/${username}`);

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        } else {
            const response = await this.api.get(`/users/${username}`);

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        }
    }

    async listUsers(params: any) {
        const {limit = 25, start = 0} = params;

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            const response = await this.api.get(
                `/workspaces/${workspace}/members`,
                {params: {pagelen: limit, page: Math.floor(start / limit) + 1}}
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        } else {
            const response = await this.api.get(
                '/admin/users',
                {params: {limit, start}}
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        }
    }
}

export class SearchHandler {
    constructor(private api: AxiosInstance, private config: BitbucketConfig) {
    }

    async searchCode(params: any) {
        const {query, repository, limit = 25, start = 0} = params;
        if (!query) {
            throw new McpError(ErrorCode.InvalidParams, 'Query is required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            let searchUrl = `/workspaces/${workspace}/search/code`;
            if (repository) {
                searchUrl = `/repositories/${workspace}/${repository}/search/code`;
            }

            const response = await this.api.get(searchUrl, {
                params: {
                    search_query: query,
                    pagelen: limit,
                    page: Math.floor(start / limit) + 1
                }
            });

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        } else {
            const project = params.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(ErrorCode.InvalidParams, 'Project is required for Bitbucket Server');
            }

            let searchUrl = '/search';
            const searchParams: any = {
                query,
                type: 'code',
                limit,
                start
            };

            if (repository) {
                searchParams.repositorySlug = repository;
                searchParams.projectKey = project;
            }

            const response = await this.api.get(searchUrl, {params: searchParams});

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        }
    }
}

export class PermissionHandler {
    constructor(private api: AxiosInstance, private config: BitbucketConfig) {
    }

    async getRepositoryPermissions(params: any) {
        const {repository, user} = params;
        if (!repository) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository is required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            let permissionsUrl = `/repositories/${workspace}/${repository}`;
            if (user) {
                permissionsUrl = `/repositories/${workspace}/${repository}/permissions-config/users/${user}`;
            }

            const response = await this.api.get(permissionsUrl);

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        } else {
            const project = params.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(ErrorCode.InvalidParams, 'Project is required for Bitbucket Server');
            }

            let permissionsUrl = `/projects/${project}/repos/${repository}/permissions`;
            if (user) {
                permissionsUrl += `/users?filter=${user}`;
            }

            const response = await this.api.get(permissionsUrl);

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        }
    }
}

export class DiffHandler {
    constructor(private api: AxiosInstance, private config: BitbucketConfig) {
    }

    async getDiff(params: any) {
        const {repository, spec, path, context = 3, ignore_whitespace = false} = params;
        if (!repository || !spec) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository and spec are required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            // First verify that the commits exist in the repository
            const commitsExist = await this.verifyCommitsExist(workspace, repository, spec);
            if (!commitsExist.valid) {
                return {
                    content: [{
                        type: 'text', 
                        text: `Commit verification failed:\n${commitsExist.message}\n\n` +
                              `This is likely why the diff returned empty. Please ensure:\n` +
                              `1. Both commits exist in the Bitbucket Cloud repository\n` +
                              `2. The commits have been pushed to the remote repository\n` +
                              `3. You have access to view the repository`
                    }]
                };
            }

            // First try the standard diff endpoint
            const result = await this.tryStandardDiff(workspace, repository, spec, path, context, ignore_whitespace);
            if (result.success && result.content) {
                return result.content;
            }

            // If standard diff returns empty, try alternative approaches
            console.log('Standard diff returned empty, trying alternative approaches...');
            
            // Try reversing the commit order (Bitbucket uses opposite order from git diff)
            if (spec.includes('..')) {
                const [first, second] = spec.split('..');
                const reversedSpec = `${second}..${first}`;
                console.log(`Trying reversed spec: ${reversedSpec}`);
                
                const reversedResult = await this.tryStandardDiff(workspace, repository, reversedSpec, path, context, ignore_whitespace);
                if (reversedResult.success && reversedResult.content) {
                    return {
                        content: [{
                            type: 'text', 
                            text: reversedResult.content.content[0].text
                        }]
                    };
                }
            }

            // Try the compare endpoint as a fallback
            try {
                const compareResult = await this.tryCompareDiff(workspace, repository, spec, path, context, ignore_whitespace);
                if (compareResult.success && compareResult.content) {
                    return {
                        content: [{
                            type: 'text', 
                            text: `Note: Retrieved diff using compare endpoint:\n\n${compareResult.content.content[0].text}`
                        }]
                    };
                }
            } catch (error) {
                console.log('Compare endpoint also failed:', error);
            }

            // If all approaches fail, return helpful debug information
            const debugInfo = {
                spec,
                workspace,
                repository,
                message: 'All diff retrieval methods returned empty responses. This could mean:',
                possibleCauses: [
                    '1. The commits are identical (no differences)',
                    '2. One or both commits do not exist in the remote repository',
                    '3. The commits need to be fully qualified (40 characters)',
                    '4. The commit range is invalid',
                    '5. The commits have not been pushed to Bitbucket Cloud'
                ],
                suggestions: [
                    'Verify commits exist: Check if both commits are visible in Bitbucket Cloud',
                    'Try full commit hashes: Use complete 40-character commit hashes',
                    'Check local vs remote: Ensure commits are pushed to the remote repository',
                    'Test individual commits: Try getting diff for a single commit first'
                ],
                commitVerification: commitsExist
            };
            
            return {
                content: [{
                    type: 'text', 
                    text: `No differences found after trying multiple approaches.\n\nDebug Information:\n${JSON.stringify(debugInfo, null, 2)}`
                }]
            };
        } else {
            const project = params.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(ErrorCode.InvalidParams, 'Project is required for Bitbucket Server');
            }

            // Parse spec (e.g., "commit1..commit2")
            const [from, to] = spec.split('..');
            if (!from || !to) {
                throw new McpError(ErrorCode.InvalidParams, 'Spec must be in format "from..to"');
            }

            let diffUrl = `/projects/${project}/repos/${repository}/compare/diff`;
            const queryParams: any = {from, to, contextLines: context};
            if (path) queryParams.path = path;
            if (ignore_whitespace) queryParams.whitespace = 'ignore-all';

            const response = await this.api.get(diffUrl, {
                params: queryParams,
                headers: {Accept: 'text/plain'}
            });

            return {
                content: [{type: 'text', text: response.data}]
            };
        }
    }

    private async verifyCommitsExist(workspace: string, repository: string, spec: string) {
        try {
            if (spec.includes('..')) {
                const [first, second] = spec.split('..');
                
                // Check first commit
                const firstCommitResponse = await this.api.get(`/repositories/${workspace}/${repository}/commit/${first}`);
                console.log(`Commit ${first} exists:`, firstCommitResponse.status === 200);
                
                // Check second commit
                const secondCommitResponse = await this.api.get(`/repositories/${workspace}/${repository}/commit/${second}`);
                console.log(`Commit ${second} exists:`, secondCommitResponse.status === 200);
                
                return {
                    valid: true,
                    message: `Both commits verified: ${first} and ${second} exist in the repository`,
                    commits: {
                        first: { hash: first, exists: true },
                        second: { hash: second, exists: true }
                    }
                };
            } else {
                // Single commit
                const commitResponse = await this.api.get(`/repositories/${workspace}/${repository}/commit/${spec}`);
                console.log(`Commit ${spec} exists:`, commitResponse.status === 200);
                
                return {
                    valid: true,
                    message: `Commit verified: ${spec} exists in the repository`,
                    commits: {
                        single: { hash: spec, exists: true }
                    }
                };
            }
        } catch (error: any) {
            if (error.response?.status === 404) {
                const [first, second] = spec.includes('..') ? spec.split('..') : [spec];
                return {
                    valid: false,
                    message: `One or more commits not found in repository. This explains the empty diff response.`,
                    commits: {
                        first: { hash: first, exists: false },
                        ...(second && { second: { hash: second, exists: false } })
                    },
                    error: 'Commits not found (404)'
                };
            }
            
            return {
                valid: false,
                message: `Error verifying commits: ${error.message}`,
                error: error.message
            };
        }
    }

    private async tryStandardDiff(workspace: string, repository: string, spec: string, path?: string, context: number = 3, ignore_whitespace: boolean = false) {
        try {
            let diffUrl = `/repositories/${workspace}/${repository}/diff/${spec}`;
            const queryParams: any = {context};
            if (path) queryParams.path = path;
            if (ignore_whitespace) queryParams.ignore_whitespace = 'true';

            const response = await this.api.get(diffUrl, {
                params: queryParams,
                headers: {Accept: 'text/plain'}
            });

            console.log('Standard Diff API Response:', {
                url: diffUrl,
                params: queryParams,
                responseLength: response.data ? response.data.length : 0,
                responseType: typeof response.data,
                status: response.status
            });

            if (response.data && response.data.length > 0) {
                return {
                    success: true,
                    content: {
                        content: [{type: 'text', text: response.data}]
                    }
                };
            }

            return { success: false, content: null };
        } catch (error: any) {
            console.log('Standard diff failed:', error.message);
            if (error.response?.status === 404) {
                throw new McpError(ErrorCode.InvalidParams, 
                    `Repository or commits not found. Please verify:\n` +
                    `1. Repository "${workspace}/${repository}" exists\n` +
                    `2. Commits in spec "${spec}" exist in the remote repository\n` +
                    `3. Commits are pushed to Bitbucket Cloud`
                );
            } else if (error.response?.status === 400) {
                throw new McpError(ErrorCode.InvalidParams, 
                    `Invalid diff request. Please check:\n` +
                    `1. Spec format is correct (commit1..commit2)\n` +
                    `2. Commit hashes are valid\n` +
                    `3. Path parameter (if used) is valid`
                );
            }
            return { success: false, content: null };
        }
    }

    private async tryCompareDiff(workspace: string, repository: string, spec: string, path?: string, context: number = 3, ignore_whitespace: boolean = false) {
        try {
            // Parse the spec to get individual commits
            const [firstCommit, secondCommit] = spec.split('..');
            if (!firstCommit || !secondCommit) {
                return { success: false, content: null };
            }

            // Try using the compare commits endpoint
            let compareUrl = `/repositories/${workspace}/${repository}/diff/${firstCommit}..${secondCommit}`;
            const queryParams: any = {
                context,
                topic: false  // Use simple git-style diff
            };
            if (path) queryParams.path = path;
            if (ignore_whitespace) queryParams.ignore_whitespace = true;

            const response = await this.api.get(compareUrl, {
                params: queryParams,
                headers: {Accept: 'text/plain'}
            });

            console.log('Compare Diff API Response:', {
                url: compareUrl,
                params: queryParams,
                responseLength: response.data ? response.data.length : 0,
                status: response.status
            });

            if (response.data && response.data.length > 0) {
                return {
                    success: true,
                    content: {
                        content: [{type: 'text', text: response.data}]
                    }
                };
            }

            return { success: false, content: null };
        } catch (error: any) {
            console.log('Compare diff failed:', error.message);
            return { success: false, content: null };
        }
    }
}

// Bitbucket Cloud specific: Pipelines
export class PipelineHandler {
    constructor(private api: AxiosInstance, private config: BitbucketConfig) {
    }

    async listPipelines(params: any) {
        if (!this.config.isCloud) {
            throw new McpError(ErrorCode.InvalidParams, 'Pipelines are only supported on Bitbucket Cloud');
        }

        const {repository, target, limit = 25, start = 0} = params;
        if (!repository) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository is required');
        }

        const workspace = params.workspace || this.config.defaultProject;
        if (!workspace) {
            throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
        }

        const queryParams: any = {
            pagelen: limit,
            page: Math.floor(start / limit) + 1
        };

        if (target) {
            if (target.type === 'pipeline_ref_name') {
                queryParams['target.ref_name'] = target.name;
            } else if (target.type === 'pipeline_commit_sha') {
                queryParams['target.commit.hash'] = target.name;
            }
        }

        const response = await this.api.get(
            `/repositories/${workspace}/${repository}/pipelines/`,
            {params: queryParams}
        );

        return {
            content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
        };
    }

    async getPipeline(params: any) {
        if (!this.config.isCloud) {
            throw new McpError(ErrorCode.InvalidParams, 'Pipelines are only supported on Bitbucket Cloud');
        }

        const {repository, pipelineId} = params;
        if (!repository || !pipelineId) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository and pipelineId are required');
        }

        const workspace = params.workspace || this.config.defaultProject;
        if (!workspace) {
            throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
        }

        const response = await this.api.get(
            `/repositories/${workspace}/${repository}/pipelines/${pipelineId}`
        );

        return {
            content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
        };
    }

    async triggerPipeline(params: any) {
        if (!this.config.isCloud) {
            throw new McpError(ErrorCode.InvalidParams, 'Pipelines are only supported on Bitbucket Cloud');
        }

        const {repository, target, variables} = params;
        if (!repository || !target) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository and target are required');
        }

        const workspace = params.workspace || this.config.defaultProject;
        if (!workspace) {
            throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
        }

        const pipelineData: any = {
            target: {
                type: target.type,
                ref_name: target.type === 'pipeline_ref_name' ? target.name : undefined,
                commit: target.type === 'pipeline_commit_sha' ? {hash: target.name} : undefined
            }
        };

        if (variables && variables.length > 0) {
            pipelineData.variables = variables;
        }

        const response = await this.api.post(
            `/repositories/${workspace}/${repository}/pipelines/`,
            pipelineData
        );

        return {
            content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
        };
    }

    async stopPipeline(params: any) {
        if (!this.config.isCloud) {
            throw new McpError(ErrorCode.InvalidParams, 'Pipelines are only supported on Bitbucket Cloud');
        }

        const {repository, pipelineId} = params;
        if (!repository || !pipelineId) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository and pipelineId are required');
        }

        const workspace = params.workspace || this.config.defaultProject;
        if (!workspace) {
            throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
        }

        const response = await this.api.post(
            `/repositories/${workspace}/${repository}/pipelines/${pipelineId}/stopPipeline`
        );

        return {
            content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
        };
    }
}

// Bitbucket Server specific: Build status
export class BuildStatusHandler {
    constructor(private api: AxiosInstance, private config: BitbucketConfig) {
    }

    async getBuildStatus(params: any) {
        if (this.config.isCloud) {
            throw new McpError(ErrorCode.InvalidParams, 'Build status API is only supported on Bitbucket Server');
        }

        const {repository, commitId} = params;
        if (!repository || !commitId) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository and commitId are required');
        }

        const project = params.project || this.config.defaultProject;
        if (!project) {
            throw new McpError(ErrorCode.InvalidParams, 'Project is required for Bitbucket Server');
        }

        const response = await this.api.get(
            `/projects/${project}/repos/${repository}/commits/${commitId}/builds`
        );

        return {
            content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
        };
    }

    async setBuildStatus(params: any) {
        if (this.config.isCloud) {
            throw new McpError(ErrorCode.InvalidParams, 'Build status API is only supported on Bitbucket Server');
        }

        const {repository, commitId, state, key, name, url, description} = params;
        if (!repository || !commitId || !state || !key) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository, commitId, state, and key are required');
        }

        const project = params.project || this.config.defaultProject;
        if (!project) {
            throw new McpError(ErrorCode.InvalidParams, 'Project is required for Bitbucket Server');
        }

        const buildData = {
            state,
            key,
            name,
            url,
            description
        };

        const response = await this.api.post(
            `/projects/${project}/repos/${repository}/commits/${commitId}/builds`,
            buildData
        );

        return {
            content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
        };
    }
}

// Snippets handler (Cloud only)
export class SnippetHandler {
    constructor(private api: AxiosInstance, private config: BitbucketConfig) {}

    async listSnippets(params: any) {
        if (!this.config.isCloud) {
            throw new McpError(ErrorCode.InvalidParams, 'Snippets are only available in Bitbucket Cloud');
        }

        const workspace = params.workspace || this.config.defaultProject;
        if (!workspace) {
            throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
        }

        const role = params.role || 'member';
        const limit = params.limit || 10;

        const response = await this.api.get(
            `/snippets/${workspace}`,
            { params: { role, pagelen: limit } }
        );

        return {
            content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }]
        };
    }

    async getSnippet(params: any) {
        if (!this.config.isCloud) {
            throw new McpError(ErrorCode.InvalidParams, 'Snippets are only available in Bitbucket Cloud');
        }

        const workspace = params.workspace || this.config.defaultProject;
        const { snippetId } = params;

        if (!workspace || !snippetId) {
            throw new McpError(ErrorCode.InvalidParams, 'Workspace and snippet ID are required');
        }

        const response = await this.api.get(`/snippets/${workspace}/${snippetId}`);

        return {
            content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }]
        };
    }

    async createSnippet(params: any) {
        if (!this.config.isCloud) {
            throw new McpError(ErrorCode.InvalidParams, 'Snippets are only available in Bitbucket Cloud');
        }

        const workspace = params.workspace || this.config.defaultProject;
        const { title, isPrivate = true, files } = params;

        if (!workspace || !title || !files) {
            throw new McpError(ErrorCode.InvalidParams, 'Workspace, title, and files are required');
        }

        const snippetData = {
            title,
            is_private: isPrivate,
            files: Object.entries(files).reduce((acc: any, [filename, content]) => {
                acc[filename] = { content };
                return acc;
            }, {})
        };

        const response = await this.api.post(`/snippets/${workspace}`, snippetData);

        return {
            content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }]
        };
    }

    async updateSnippet(params: any) {
        if (!this.config.isCloud) {
            throw new McpError(ErrorCode.InvalidParams, 'Snippets are only available in Bitbucket Cloud');
        }

        const workspace = params.workspace || this.config.defaultProject;
        const { snippetId, title, isPrivate, files } = params;

        if (!workspace || !snippetId) {
            throw new McpError(ErrorCode.InvalidParams, 'Workspace and snippet ID are required');
        }

        const updateData: any = {};
        if (title) updateData.title = title;
        if (isPrivate !== undefined) updateData.is_private = isPrivate;
        if (files) {
            updateData.files = Object.entries(files).reduce((acc: any, [filename, content]) => {
                acc[filename] = { content };
                return acc;
            }, {});
        }

        const response = await this.api.put(`/snippets/${workspace}/${snippetId}`, updateData);

        return {
            content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }]
        };
    }

    async deleteSnippet(params: any) {
        if (!this.config.isCloud) {
            throw new McpError(ErrorCode.InvalidParams, 'Snippets are only available in Bitbucket Cloud');
        }

        const workspace = params.workspace || this.config.defaultProject;
        const { snippetId } = params;

        if (!workspace || !snippetId) {
            throw new McpError(ErrorCode.InvalidParams, 'Workspace and snippet ID are required');
        }

        await this.api.delete(`/snippets/${workspace}/${snippetId}`);

        return {
            content: [{ type: 'text', text: `Snippet ${snippetId} deleted successfully` }]
        };
    }

    async getSnippetFile(params: any) {
        if (!this.config.isCloud) {
            throw new McpError(ErrorCode.InvalidParams, 'Snippets are only available in Bitbucket Cloud');
        }

        const workspace = params.workspace || this.config.defaultProject;
        const { snippetId, filename } = params;

        if (!workspace || !snippetId || !filename) {
            throw new McpError(ErrorCode.InvalidParams, 'Workspace, snippet ID, and filename are required');
        }

        const response = await this.api.get(`/snippets/${workspace}/${snippetId}/files/${filename}`);

        return {
            content: [{ type: 'text', text: response.data }]
        };
    }
}

// Branch restrictions handler
export class BranchRestrictionHandler {
    constructor(private api: AxiosInstance, private config: BitbucketConfig) {}

    async listBranchRestrictions(params: any) {
        const { repository, kind } = params;
        
        if (!repository) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository is required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            let url = `/repositories/${workspace}/${repository}/branch-restrictions`;
            const queryParams: any = {};
            if (kind) queryParams.kind = kind;

            const response = await this.api.get(url, { params: queryParams });

            return {
                content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }]
            };
        } else {
            const project = params.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(ErrorCode.InvalidParams, 'Project is required for Bitbucket Server');
            }

            const response = await this.api.get(`/projects/${project}/repos/${repository}/restrictions`);

            return {
                content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }]
            };
        }
    }

    async createBranchRestriction(params: any) {
        const { repository, kind, pattern, userIds, groupIds } = params;
        
        if (!repository || !kind || !pattern) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository, kind, and pattern are required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            const restrictionData: any = {
                kind,
                pattern
            };

            if (userIds?.length) {
                restrictionData.users = userIds.map((id: string) => ({ uuid: id }));
            }
            if (groupIds?.length) {
                restrictionData.groups = groupIds.map((id: string) => ({ uuid: id }));
            }

            const response = await this.api.post(
                `/repositories/${workspace}/${repository}/branch-restrictions`,
                restrictionData
            );

            return {
                content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }]
            };
        } else {
            const project = params.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(ErrorCode.InvalidParams, 'Project is required for Bitbucket Server');
            }

            const restrictionData: any = {
                type: kind,
                matcher: {
                    id: pattern,
                    type: { id: 'PATTERN' }
                }
            };

            if (userIds?.length) {
                restrictionData.users = userIds.map((id: string) => ({ name: id }));
            }
            if (groupIds?.length) {
                restrictionData.groups = groupIds.map((id: string) => ({ name: id }));
            }

            const response = await this.api.post(
                `/projects/${project}/repos/${repository}/restrictions`,
                restrictionData
            );

            return {
                content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }]
            };
        }
    }

    async getBranchRestriction(params: any) {
        const { repository, restrictionId } = params;
        
        if (!repository || !restrictionId) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository and restriction ID are required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            const response = await this.api.get(
                `/repositories/${workspace}/${repository}/branch-restrictions/${restrictionId}`
            );

            return {
                content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }]
            };
        } else {
            const project = params.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(ErrorCode.InvalidParams, 'Project is required for Bitbucket Server');
            }

            const response = await this.api.get(
                `/projects/${project}/repos/${repository}/restrictions/${restrictionId}`
            );

            return {
                content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }]
            };
        }
    }

    async updateBranchRestriction(params: any) {
        const { repository, restrictionId, kind, pattern, userIds, groupIds } = params;
        
        if (!repository || !restrictionId) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository and restriction ID are required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            const updateData: any = {};
            if (kind) updateData.kind = kind;
            if (pattern) updateData.pattern = pattern;
            if (userIds?.length) {
                updateData.users = userIds.map((id: string) => ({ uuid: id }));
            }
            if (groupIds?.length) {
                updateData.groups = groupIds.map((id: string) => ({ uuid: id }));
            }

            const response = await this.api.put(
                `/repositories/${workspace}/${repository}/branch-restrictions/${restrictionId}`,
                updateData
            );

            return {
                content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }]
            };
        } else {
            const project = params.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(ErrorCode.InvalidParams, 'Project is required for Bitbucket Server');
            }

            const updateData: any = {};
            if (kind) updateData.type = kind;
            if (pattern) {
                updateData.matcher = {
                    id: pattern,
                    type: { id: 'PATTERN' }
                };
            }
            if (userIds?.length) {
                updateData.users = userIds.map((id: string) => ({ name: id }));
            }
            if (groupIds?.length) {
                updateData.groups = groupIds.map((id: string) => ({ name: id }));
            }

            const response = await this.api.put(
                `/projects/${project}/repos/${repository}/restrictions/${restrictionId}`,
                updateData
            );

            return {
                content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }]
            };
        }
    }

    async deleteBranchRestriction(params: any) {
        const { repository, restrictionId } = params;
        
        if (!repository || !restrictionId) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository and restriction ID are required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            await this.api.delete(
                `/repositories/${workspace}/${repository}/branch-restrictions/${restrictionId}`
            );

            return {
                content: [{ type: 'text', text: `Branch restriction ${restrictionId} deleted successfully` }]
            };
        } else {
            const project = params.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(ErrorCode.InvalidParams, 'Project is required for Bitbucket Server');
            }

            await this.api.delete(
                `/projects/${project}/repos/${repository}/restrictions/${restrictionId}`
            );

            return {
                content: [{ type: 'text', text: `Branch restriction ${restrictionId} deleted successfully` }]
            };
        }
    }
}

// Downloads handler (Cloud and Server)
export class DownloadHandler {
    constructor(private api: AxiosInstance, private config: BitbucketConfig) {}

    async listDownloads(params: any) {
        const { repository } = params;
        
        if (!repository) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository is required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            const response = await this.api.get(`/repositories/${workspace}/${repository}/downloads`);
            return {
                content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }]
            };
        } else {
            const project = params.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(ErrorCode.InvalidParams, 'Project is required for Bitbucket Server');
            }

            // Bitbucket Server uses artifacts API
            const response = await this.api.get(`/projects/${project}/repos/${repository}/artifacts`);
            return {
                content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }]
            };
        }
    }

    async uploadDownload(params: any) {
        const { repository, filename, content } = params;
        
        if (!repository || !filename || !content) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository, filename, and content are required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            const formData = new FormData();
            formData.append('files', content, filename);

            const response = await this.api.post(
                `/repositories/${workspace}/${repository}/downloads`,
                formData,
                { headers: { 'Content-Type': 'multipart/form-data' } }
            );

            return {
                content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }]
            };
        } else {
            const project = params.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(ErrorCode.InvalidParams, 'Project is required for Bitbucket Server');
            }

            // Server typically handles this differently, often through build artifacts
            throw new McpError(ErrorCode.InvalidParams, 'File upload for Server requires build artifacts API');
        }
    }

    async deleteDownload(params: any) {
        const { repository, filename } = params;
        
        if (!repository || !filename) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository and filename are required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            await this.api.delete(`/repositories/${workspace}/${repository}/downloads/${filename}`);
            return {
                content: [{ type: 'text', text: `Download ${filename} deleted successfully` }]
            };
        } else {
            const project = params.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(ErrorCode.InvalidParams, 'Project is required for Bitbucket Server');
            }

            throw new McpError(ErrorCode.InvalidParams, 'File deletion not supported for Server downloads');
        }
    }
}

// Fork handler
export class ForkHandler {
    constructor(private api: AxiosInstance, private config: BitbucketConfig) {}

    async forkRepository(params: any) {
        const { repository, newName, isPrivate } = params;
        
        if (!repository) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository is required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            const targetWorkspace = params.targetWorkspace || workspace;
            
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            const forkData: any = {};
            if (newName) forkData.name = newName;
            if (isPrivate !== undefined) forkData.is_private = isPrivate;
            if (targetWorkspace !== workspace) forkData.workspace = { slug: targetWorkspace };

            const response = await this.api.post(
                `/repositories/${workspace}/${repository}/forks`,
                forkData
            );

            return {
                content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }]
            };
        } else {
            const project = params.project || this.config.defaultProject;
            const targetProject = params.targetProject || project;
            
            if (!project) {
                throw new McpError(ErrorCode.InvalidParams, 'Project is required for Bitbucket Server');
            }

            const forkData: any = {
                name: newName || repository,
                project: { key: targetProject }
            };

            const response = await this.api.post(
                `/projects/${project}/repos/${repository}`,
                forkData
            );

            return {
                content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }]
            };
        }
    }

    async listForks(params: any) {
        const { repository } = params;
        
        if (!repository) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository is required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            const response = await this.api.get(`/repositories/${workspace}/${repository}/forks`);
            return {
                content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }]
            };
        } else {
            const project = params.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(ErrorCode.InvalidParams, 'Project is required for Bitbucket Server');
            }

            const response = await this.api.get(`/projects/${project}/repos/${repository}/forks`);
            return {
                content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }]
            };
        }
    }
}

// Deployment/Environment handler (Cloud specific)
export class DeploymentHandler {
    constructor(private api: AxiosInstance, private config: BitbucketConfig) {}

    async listDeployments(params: any) {
        if (!this.config.isCloud) {
            throw new McpError(ErrorCode.InvalidParams, 'Deployments are only available in Bitbucket Cloud');
        }

        const { repository } = params;
        const workspace = params.workspace || this.config.defaultProject;
        
        if (!workspace || !repository) {
            throw new McpError(ErrorCode.InvalidParams, 'Workspace and repository are required');
        }

        const response = await this.api.get(`/repositories/${workspace}/${repository}/deployments`);
        return {
            content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }]
        };
    }

    async getDeployment(params: any) {
        if (!this.config.isCloud) {
            throw new McpError(ErrorCode.InvalidParams, 'Deployments are only available in Bitbucket Cloud');
        }

        const { repository, deploymentId } = params;
        const workspace = params.workspace || this.config.defaultProject;
        
        if (!workspace || !repository || !deploymentId) {
            throw new McpError(ErrorCode.InvalidParams, 'Workspace, repository, and deployment ID are required');
        }

        const response = await this.api.get(`/repositories/${workspace}/${repository}/deployments/${deploymentId}`);
        return {
            content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }]
        };
    }

    async listEnvironments(params: any) {
        if (!this.config.isCloud) {
            throw new McpError(ErrorCode.InvalidParams, 'Environments are only available in Bitbucket Cloud');
        }

        const { repository } = params;
        const workspace = params.workspace || this.config.defaultProject;
        
        if (!workspace || !repository) {
            throw new McpError(ErrorCode.InvalidParams, 'Workspace and repository are required');
        }

        const response = await this.api.get(`/repositories/${workspace}/${repository}/environments`);
        return {
            content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }]
        };
    }

    async createEnvironment(params: any) {
        if (!this.config.isCloud) {
            throw new McpError(ErrorCode.InvalidParams, 'Environments are only available in Bitbucket Cloud');
        }

        const { repository, name, type, slug } = params;
        const workspace = params.workspace || this.config.defaultProject;
        
        if (!workspace || !repository || !name || !type) {
            throw new McpError(ErrorCode.InvalidParams, 'Workspace, repository, name, and type are required');
        }

        const environmentData = {
            name,
            type,
            slug: slug || name.toLowerCase().replace(/\s+/g, '-')
        };

        const response = await this.api.post(
            `/repositories/${workspace}/${repository}/environments`,
            environmentData
        );

        return {
            content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }]
        };
    }

    async updateEnvironment(params: any) {
        if (!this.config.isCloud) {
            throw new McpError(ErrorCode.InvalidParams, 'Environments are only available in Bitbucket Cloud');
        }

        const { repository, environmentUuid, name, type } = params;
        const workspace = params.workspace || this.config.defaultProject;
        
        if (!workspace || !repository || !environmentUuid) {
            throw new McpError(ErrorCode.InvalidParams, 'Workspace, repository, and environment UUID are required');
        }

        const updateData: any = {};
        if (name) updateData.name = name;
        if (type) updateData.type = type;

        const response = await this.api.put(
            `/repositories/${workspace}/${repository}/environments/${environmentUuid}`,
            updateData
        );

        return {
            content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }]
        };
    }

    async deleteEnvironment(params: any) {
        if (!this.config.isCloud) {
            throw new McpError(ErrorCode.InvalidParams, 'Environments are only available in Bitbucket Cloud');
        }

        const { repository, environmentUuid } = params;
        const workspace = params.workspace || this.config.defaultProject;
        
        if (!workspace || !repository || !environmentUuid) {
            throw new McpError(ErrorCode.InvalidParams, 'Workspace, repository, and environment UUID are required');
        }

        await this.api.delete(`/repositories/${workspace}/${repository}/environments/${environmentUuid}`);
        return {
            content: [{ type: 'text', text: `Environment ${environmentUuid} deleted successfully` }]
        };
    }
}

// Commit comments handler
export class CommitCommentHandler {
    constructor(private api: AxiosInstance, private config: BitbucketConfig) {}

    async listCommitComments(params: any) {
        const { repository, commitId } = params;
        
        if (!repository || !commitId) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository and commit ID are required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            const response = await this.api.get(`/repositories/${workspace}/${repository}/commit/${commitId}/comments`);
            return {
                content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }]
            };
        } else {
            const project = params.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(ErrorCode.InvalidParams, 'Project is required for Bitbucket Server');
            }

            const response = await this.api.get(`/projects/${project}/repos/${repository}/commits/${commitId}/comments`);
            return {
                content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }]
            };
        }
    }

    async createCommitComment(params: any) {
        const { repository, commitId, content, lineNumber, filename } = params;
        
        if (!repository || !commitId || !content) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository, commit ID, and content are required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            const commentData: any = { content: { raw: content } };
            if (filename) {
                commentData.inline = {
                    path: filename,
                    to: lineNumber || 1
                };
            }

            const response = await this.api.post(
                `/repositories/${workspace}/${repository}/commit/${commitId}/comments`,
                commentData
            );

            return {
                content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }]
            };
        } else {
            const project = params.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(ErrorCode.InvalidParams, 'Project is required for Bitbucket Server');
            }

            const commentData: any = { text: content };
            if (filename && lineNumber) {
                commentData.anchor = {
                    path: filename,
                    line: lineNumber,
                    lineType: 'CONTEXT'
                };
            }

            const response = await this.api.post(
                `/projects/${project}/repos/${repository}/commits/${commitId}/comments`,
                commentData
            );

            return {
                content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }]
            };
        }
    }

    async updateCommitComment(params: any) {
        const { repository, commitId, commentId, content } = params;
        
        if (!repository || !commitId || !commentId || !content) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository, commit ID, comment ID, and content are required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            const updateData = { content: { raw: content } };
            const response = await this.api.put(
                `/repositories/${workspace}/${repository}/commit/${commitId}/comments/${commentId}`,
                updateData
            );

            return {
                content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }]
            };
        } else {
            const project = params.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(ErrorCode.InvalidParams, 'Project is required for Bitbucket Server');
            }

            const updateData = { text: content };
            const response = await this.api.put(
                `/projects/${project}/repos/${repository}/commits/${commitId}/comments/${commentId}`,
                updateData
            );

            return {
                content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }]
            };
        }
    }

    async deleteCommitComment(params: any) {
        const { repository, commitId, commentId } = params;
        
        if (!repository || !commitId || !commentId) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository, commit ID, and comment ID are required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            await this.api.delete(`/repositories/${workspace}/${repository}/commit/${commitId}/comments/${commentId}`);
            return {
                content: [{ type: 'text', text: `Comment ${commentId} deleted successfully` }]
            };
        } else {
            const project = params.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(ErrorCode.InvalidParams, 'Project is required for Bitbucket Server');
            }

            await this.api.delete(`/projects/${project}/repos/${repository}/commits/${commitId}/comments/${commentId}`);
            return {
                content: [{ type: 'text', text: `Comment ${commentId} deleted successfully` }]
            };
        }
    }

    async getCommitComment(params: any) {
        const { repository, commitId, commentId } = params;
        
        if (!repository || !commitId || !commentId) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository, commit ID, and comment ID are required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            const response = await this.api.get(`/repositories/${workspace}/${repository}/commit/${commitId}/comments/${commentId}`);
            return {
                content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }]
            };
        } else {
            const project = params.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(ErrorCode.InvalidParams, 'Project is required for Bitbucket Server');
            }

            const response = await this.api.get(`/projects/${project}/repos/${repository}/commits/${commitId}/comments/${commentId}`);
            return {
                content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }]
            };
        }
    }
}

export {RepositoryHandler} from './repository-handler.js';
export {PullRequestHandler} from './pull-request-handler.js';