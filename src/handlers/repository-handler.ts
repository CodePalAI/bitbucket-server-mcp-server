import {AxiosInstance} from 'axios';
import {ErrorCode, McpError} from '@modelcontextprotocol/sdk/types.js';
import {
    BitbucketConfig,
    CreateRepositoryInput,
    ListOptions,
    ListRepositoriesOptions,
    RepoSettingsParams,
    RepositoryParams
} from '../types/interfaces.js';

export class RepositoryHandler {
    constructor(
        private api: AxiosInstance,
        private config: BitbucketConfig
    ) {
    }

    async listProjects(options: ListOptions = {}) {
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

    async listRepositories(options: ListRepositoriesOptions = {}) {
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

    async createRepository(workspaceOrProject: string, input: CreateRepositoryInput) {
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

    async updateRepository(workspaceOrProject: string, repository: string, input: CreateRepositoryInput) {
        if (!repository) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository is required');
        }

        if (this.config.isCloud) {
            const repoData: any = {};
            if (input.name) repoData.name = input.name;
            if (input.description !== undefined) repoData.description = input.description;
            if (input.isPrivate !== undefined) repoData.is_private = input.isPrivate;
            if (input.forkPolicy) repoData.fork_policy = input.forkPolicy;
            if (input.language) repoData.language = input.language;
            if (input.hasIssues !== undefined) repoData.has_issues = input.hasIssues;
            if (input.hasWiki !== undefined) repoData.has_wiki = input.hasWiki;

            const response = await this.api.put(
                `/repositories/${workspaceOrProject}/${repository}`,
                repoData
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        } else {
            const repoData: any = {};
            if (input.name) repoData.name = input.name;
            if (input.description !== undefined) repoData.description = input.description;
            if (input.isPrivate !== undefined) repoData.public = !input.isPrivate;
            if (input.forkPolicy) repoData.forkPolicy = input.forkPolicy;

            const response = await this.api.put(
                `/projects/${workspaceOrProject}/repos/${repository}`,
                repoData
            );

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        }
    }

    async forkRepositoryWithParams(params: any) {
        const {sourceWorkspace, repository, name, description, isPrivate} = params;
        const key = this.config.isCloud ? 'workspace' : 'project';
        const targetWorkspace = params[key];

        return await this.forkRepository(
            {
                [this.config.isCloud ? 'workspace' : 'project']: sourceWorkspace,
                repository
            },
            {
                [this.config.isCloud ? 'forkWorkspace' : 'forkProject']: targetWorkspace,
                name
            }
        );
    }

    async forkRepository(sourceParams: RepositoryParams, forkOptions: {
        forkWorkspace?: string;
        forkProject?: string;
        name?: string
    }) {
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

    async getRepositorySettings(params: RepositoryParams) {
        const {repository} = params;

        if (!repository) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository is required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            const response = await this.api.get(`/repositories/${workspace}/${repository}`);

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        } else {
            const project = params.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(ErrorCode.InvalidParams, 'Project is required for Bitbucket Server');
            }

            const response = await this.api.get(`/projects/${project}/repos/${repository}`);

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        }
    }

    async updateRepositorySettings(params: RepoSettingsParams) {
        const {repository, settings} = params;

        if (!repository) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository is required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            const updateData: any = {};
            if (settings?.name) updateData.name = settings.name;
            if (settings?.description) updateData.description = settings.description;
            if (settings?.isPrivate !== undefined) updateData.is_private = settings.isPrivate;
            if (settings?.hasIssues !== undefined) updateData.has_issues = settings.hasIssues;
            if (settings?.hasWiki !== undefined) updateData.has_wiki = settings.hasWiki;
            if (settings?.forkPolicy) updateData.fork_policy = settings.forkPolicy;
            if (settings?.language) updateData.language = settings.language;
            if (settings?.website) updateData.website = settings.website;

            const response = await this.api.put(`/repositories/${workspace}/${repository}`, updateData);

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        } else {
            const project = params.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(ErrorCode.InvalidParams, 'Project is required for Bitbucket Server');
            }

            const updateData: any = {};
            if (settings?.name) updateData.name = settings.name;
            if (settings?.description) updateData.description = settings.description;
            if (settings?.isPrivate !== undefined) updateData.public = !settings.isPrivate;
            if (settings?.forkPolicy) updateData.forkable = settings.forkPolicy !== 'no_forks';

            const response = await this.api.put(`/projects/${project}/repos/${repository}`, updateData);

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        }
    }

    async deleteRepositoryPermanently(params: RepositoryParams, confirmName: string) {
        const {repository} = params;

        if (!repository || !confirmName) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository and confirmName are required');
        }

        if (confirmName !== repository) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository name confirmation does not match');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            await this.api.delete(`/repositories/${workspace}/${repository}`);

            return {
                content: [{type: 'text', text: `Repository ${repository} deleted permanently`}]
            };
        } else {
            const project = params.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(ErrorCode.InvalidParams, 'Project is required for Bitbucket Server');
            }

            await this.api.delete(`/projects/${project}/repos/${repository}`);

            return {
                content: [{type: 'text', text: `Repository ${repository} deleted permanently`}]
            };
        }
    }

    async getRepositoryStats(params: RepositoryParams) {
        const {repository} = params;

        if (!repository) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository is required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            // Get multiple endpoints for comprehensive stats
            const [repoResponse, commitsResponse] = await Promise.all([
                this.api.get(`/repositories/${workspace}/${repository}`),
                this.api.get(`/repositories/${workspace}/${repository}/commits?pagelen=1`)
            ]);

            const stats = {
                repository: repoResponse.data,
                totalCommits: commitsResponse.data.size || 0,
                lastUpdated: repoResponse.data.updated_on,
                size: repoResponse.data.size,
                language: repoResponse.data.language,
                forksCount: repoResponse.data.fork_policy
            };

            return {
                content: [{type: 'text', text: JSON.stringify(stats, null, 2)}]
            };
        } else {
            const project = params.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(ErrorCode.InvalidParams, 'Project is required for Bitbucket Server');
            }

            const response = await this.api.get(`/projects/${project}/repos/${repository}`);

            return {
                content: [{type: 'text', text: JSON.stringify(response.data, null, 2)}]
            };
        }
    }

    async getRepositoryArchive(params: RepositoryParams, options: { ref?: string; format?: string }) {
        const {repository} = params;
        const {ref = 'HEAD', format = 'zip'} = options;

        if (!repository) {
            throw new McpError(ErrorCode.InvalidParams, 'Repository is required');
        }

        if (this.config.isCloud) {
            const workspace = params.workspace || this.config.defaultProject;
            if (!workspace) {
                throw new McpError(ErrorCode.InvalidParams, 'Workspace is required for Bitbucket Cloud');
            }

            const downloadUrl = `${this.api.defaults.baseURL}/repositories/${workspace}/${repository}/downloads/${ref}.${format}`;

            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({downloadUrl, ref, format}, null, 2)
                }]
            };
        } else {
            const project = params.project || this.config.defaultProject;
            if (!project) {
                throw new McpError(ErrorCode.InvalidParams, 'Project is required for Bitbucket Server');
            }

            const downloadUrl = `${this.api.defaults.baseURL}/projects/${project}/repos/${repository}/archive?at=${ref}&format=${format.toUpperCase()}`;

            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({downloadUrl, ref, format}, null, 2)
                }]
            };
        }
    }
} 