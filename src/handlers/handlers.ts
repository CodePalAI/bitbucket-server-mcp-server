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

            let diffUrl = `/repositories/${workspace}/${repository}/diff/${spec}`;
            const queryParams: any = {context};
            if (path) queryParams.path = path;
            if (ignore_whitespace) queryParams.ignore_whitespace = 'true';

            const response = await this.api.get(diffUrl, {
                params: queryParams,
                headers: {Accept: 'text/plain'}
            });

            return {
                content: [{type: 'text', text: response.data}]
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

export {RepositoryHandler} from './repository-handler.js';
export {PullRequestHandler} from './pull-request-handler.js';