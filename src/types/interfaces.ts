export interface BitbucketActivity {
    action: string;

    [key: string]: unknown;
}

export interface BitbucketConfig {
    baseUrl: string;
    token?: string;
    username?: string;
    password?: string;
    defaultProject?: string;
    isCloud: boolean;
    platformType: 'cloud' | 'server' | 'datacenter';
    version?: string; // API version or Bitbucket version
    features?: {
        supportsPipelines?: boolean;
        supportsSnippets?: boolean;
        supportsBuildStatus?: boolean;
        supportsDeployments?: boolean;
        supportsHttpAccessTokens?: boolean;
    };
}

export interface RepositoryParams {
    project?: string;
    repository?: string;
    workspace?: string;
}

export interface PullRequestParams extends RepositoryParams {
    prId?: number;
}

export interface MergeOptions {
    message?: string;
    strategy?: 'merge-commit' | 'squash' | 'fast-forward';
}

export interface CommentOptions {
    text: string;
    parentId?: number;
    anchor?: {
        line: number;
        lineType?: 'ADDED' | 'REMOVED' | 'CONTEXT';
        path: string;
    };
}

export interface PullRequestInput extends RepositoryParams {
    title: string;
    description: string;
    sourceBranch: string;
    targetBranch: string;
    reviewers?: string[];
}

export interface ListOptions {
    limit?: number;
    start?: number;
}

export interface ListRepositoriesOptions extends ListOptions {
    project?: string;
    workspace?: string;
}

export interface BranchParams extends RepositoryParams {
    branchName?: string;
}

export interface CommitParams extends RepositoryParams {
    commitId?: string;
    branch?: string;
}

export interface IssueParams extends RepositoryParams {
    issueId?: number;
}

export interface FileParams extends RepositoryParams {
    path?: string;
    branch?: string;
    commitId?: string;
}

export interface TagParams extends RepositoryParams {
    tagName?: string;
}

export interface WebhookParams extends RepositoryParams {
    webhookId?: string;
}

export interface CreateRepositoryInput {
    name: string;
    description?: string;
    isPrivate?: boolean;
    forkPolicy?: string;
    language?: string;
    hasIssues?: boolean;
    hasWiki?: boolean;
}

export interface CreateIssueInput extends RepositoryParams {
    title: string;
    content?: string;
    kind?: string;
    priority?: string;
    assignee?: string;
}

export interface CreateWebhookInput extends RepositoryParams {
    url: string;
    description?: string;
    events: string[];
    active?: boolean;
}

export interface DeployKeyParams extends RepositoryParams {
    keyId?: string;
}

export interface CreateDeployKeyInput extends RepositoryParams {
    title: string;
    key: string;
    readOnly?: boolean;
}

export interface SSHKeyParams {
    keyId?: string;
}

export interface CreateSSHKeyInput {
    title: string;
    key: string;
}

export interface WatcherParams extends RepositoryParams {
    username?: string;
}

export interface RepoSettingsParams extends RepositoryParams {
    settings?: {
        name?: string;
        description?: string;
        isPrivate?: boolean;
        hasIssues?: boolean;
        hasWiki?: boolean;
        forkPolicy?: string;
        language?: string;
        website?: string;
    };
}

export interface CommitCommentParams extends RepositoryParams {
    commitId: string;
    commentId?: string;
}

export interface CreateCommitCommentInput extends CommitCommentParams {
    content: string;
    path?: string;
    line?: number;
}

export interface IssueCommentParams extends RepositoryParams {
    issueId: number;
    commentId?: string;
}

export interface CreateIssueCommentInput extends IssueCommentParams {
    content: string;
}

export interface BuildStatusParams extends RepositoryParams {
    commitId: string;
    statusKey?: string;
}

export interface CreateBuildStatusInput extends BuildStatusParams {
    state: 'INPROGRESS' | 'SUCCESSFUL' | 'FAILED';
    key: string;
    name?: string;
    url?: string;
    description?: string;
}

export interface SearchParams extends RepositoryParams {
    query: string;
    type?: 'code' | 'commit' | 'issue' | 'pullrequest';
    limit?: number;
    start?: number;
}

export interface BranchRestrictionParams extends RepositoryParams {
    restrictionId?: string;
}

export interface CreateBranchRestrictionInput extends RepositoryParams {
    kind: string;
    pattern: string;
    users?: string[];
    groups?: string[];
    accessKeys?: string[];
}

export interface DefaultReviewerParams extends RepositoryParams {
    username?: string;
}

export interface SnippetParams {
    snippetId?: string;
    workspace?: string;
}



export interface PullRequestActivityParams extends RepositoryParams {
    prId: number;
    activityId?: string;
}

export interface PullRequestCommitsParams extends RepositoryParams {
    prId: number;
    limit?: number;
    start?: number;
}

export interface TeamParams {
    workspace?: string;
    teamName?: string;
    username?: string;
}

export interface RepoPermissionParams extends RepositoryParams {
    username?: string;
    privilege?: string;
}

export interface FileHistoryParams extends RepositoryParams {
    path: string;
    branch?: string;
    limit?: number;
    start?: number;
}

// Snippets interfaces (Cloud only)
export interface SnippetParams {
    workspace?: string;
    snippetId?: string;
}

export interface CreateSnippetInput extends SnippetParams {
    title: string;
    isPrivate?: boolean;
    files: { [filename: string]: { content: string } };
}

export interface UpdateSnippetInput extends SnippetParams {
    snippetId: string;
    title?: string;
    isPrivate?: boolean;
    files?: { [filename: string]: { content: string } };
}

export interface SnippetFileParams extends SnippetParams {
    snippetId: string;
    filename: string;
}

// Branch restrictions interfaces
export interface BranchRestrictionParams extends RepositoryParams {
    restrictionId?: string;
    kind?: string;
}

export interface CreateBranchRestrictionInput extends RepositoryParams {
    kind: string;
    pattern: string;
    users?: string[];
    groups?: string[];
}

export interface UpdateBranchRestrictionInput extends RepositoryParams {
    restrictionId: string;
    pattern?: string;
    users?: string[];
    groups?: string[];
}

// Comment interfaces
export interface CommitCommentParams extends RepositoryParams {
    commitId: string;
    commentId?: string;
}

export interface CreateCommitCommentInput extends CommitCommentParams {
    content: string;
    path?: string;
    line?: number;
}

export interface UpdateCommitCommentInput extends CommitCommentParams {
    commentId: string;
    content: string;
}

export interface IssueCommentParams extends RepositoryParams {
    issueId: number;
    commentId?: string;
}

export interface CreateIssueCommentInput extends IssueCommentParams {
    content: string;
}

export interface UpdateIssueCommentInput extends IssueCommentParams {
    commentId: string;
    content: string;
}

// Default reviewers interfaces
export interface DefaultReviewerParams extends RepositoryParams {
    username?: string;
}

// Repository comparison interfaces
export interface CompareParams extends RepositoryParams {
    source: string;
    destination: string;
    include_merge_commit?: boolean;
}

export interface MergeBaseParams extends RepositoryParams {
    commit1: string;
    commit2: string;
}

// Downloads interfaces
export interface DownloadParams extends RepositoryParams {
    filename?: string;
}

export interface UploadDownloadInput extends RepositoryParams {
    filename: string;
    content: string;
    contentType?: string;
}

// File history and blame interfaces
export interface FileBlameParams extends RepositoryParams {
    path: string;
    branch?: string;
    commitId?: string;
} 