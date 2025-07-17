# Bitbucket MCP Server

A comprehensive Model Context Protocol (MCP) server for Bitbucket Cloud and Bitbucket Server integration. This server provides extensive functionality to interact with Bitbucket repositories, including pull requests, branches, commits, issues, file operations, webhooks, and much more.

## 🌟 **Comprehensive Feature Set**

This MCP server provides **50+ tools** covering virtually every aspect of Bitbucket interaction, supporting both **Bitbucket Cloud** and **Bitbucket Server**:

### 📋 **Project & Repository Management**
- **Project/Workspace Operations**: List and explore projects (Server) or workspaces (Cloud)
- **Repository Management**: Create, list, fork, and manage repositories  
- **Repository Discovery**: Browse repositories across projects/workspaces
- **Repository Settings**: Get and update repository configuration, privacy, features
- **Repository Deletion**: Permanently delete repositories (with confirmation)
- **Repository Statistics**: Get comprehensive stats, commit activity, insights
- **Repository Archive**: Download repository snapshots in zip/tar.gz format

### 🔗 **Pull Request Operations**
- **Full PR Lifecycle**: Create, get, merge, decline pull requests
- **PR Comments**: Add comments and participate in discussions
- **PR Reviews**: Manage reviews and approval workflows
- **PR Diffs**: Get code differences and changes
- **PR Activities**: Complete activity timeline and history
- **PR Commits**: List all commits included in a pull request

### 🌳 **Branch Management**
- **Branch Operations**: List, create, and delete branches
- **Branch Restrictions**: Manage branch permissions and protection rules
- **Default Reviewers**: Configure automatic reviewer assignments

### 📝 **Commit Operations**
- **Commit History**: List commits with filtering options
- **Commit Details**: Get detailed commit information
- **Commit Comments**: Add and list comments on specific commits
- **Build Status**: Manage CI/CD build statuses on commits

### 🐛 **Issue Tracking** (Cloud)
- **Issue Management**: Create, list, and get issue details
- **Issue Comments**: Participate in issue discussions

### 📁 **File Operations**
- **File Content**: Read files from repositories
- **Directory Browsing**: Explore repository structure
- **File History**: Track how files have changed over time
- **Code Search**: Search through repository content

### 🔑 **Security & Access Management**
- **SSH Keys**: Manage user SSH keys for Git access
- **Deploy Keys**: Manage repository-specific deployment keys
- **Repository Watchers**: Monitor who's watching repositories

### 🏷️ **Tag Operations**
- **Tag Management**: List, create tags for releases and milestones

### 🎯 **Automation & Integration**
- **Webhooks**: Create, list, and delete webhook integrations
- **Build Statuses**: Report CI/CD pipeline results

### 📚 **Code Sharing** (Cloud Only)
- **Snippets**: Create, list, and share code snippets

### 👥 **User Operations**
- **User Information**: Get user profiles and details

## 🚀 **Installation & Setup**

### **Prerequisites**
- Node.js 18+ 
- npm or yarn
- Bitbucket Cloud account or Bitbucket Server instance

### **Installation**
```bash
# Clone or download this MCP server
git clone <repository-url>
cd bitbucket-server-mcp-server

# Install dependencies
npm install

# Build the server
npm run build
```

### **Configuration**

#### **Environment Variables**
Configure the server using environment variables:

```bash
# Required: Bitbucket instance URL
BITBUCKET_URL=https://api.bitbucket.org/2.0  # For Bitbucket Cloud
# OR
BITBUCKET_URL=https://your-server.com        # For Bitbucket Server

# Authentication (choose one method)
# Method 1: Personal Access Token (recommended)
BITBUCKET_TOKEN=your_personal_access_token

# Method 2: Username + App Password (Cloud) or Password (Server)
BITBUCKET_USERNAME=your_username
BITBUCKET_PASSWORD=your_app_password_or_password

# Optional: Default project/workspace (reduces need to specify in each call)
BITBUCKET_DEFAULT_PROJECT=PROJECT_KEY      # For Server
# OR
BITBUCKET_DEFAULT_PROJECT=workspace_name   # For Cloud
```

#### **Bitbucket Cloud Setup**
1. **Create App Password**:
   - Go to [Bitbucket Settings > App Passwords](https://bitbucket.org/account/settings/app-passwords/)
   - Click "Create app password"
   - Grant permissions: `Repositories: Read/Write`, `Pull requests: Read/Write`, `Account: Read`
   - Use this as `BITBUCKET_TOKEN` or `BITBUCKET_PASSWORD`

2. **Get Workspace Name**:
   - Your workspace name is in the URL: `https://bitbucket.org/workspace-name/`
   - Use this as `BITBUCKET_DEFAULT_PROJECT`

#### **Bitbucket Server Setup**
1. **Create Personal Access Token**:
   - Go to Profile > Personal access tokens > Create token
   - Grant appropriate permissions for repositories
   - Use this as `BITBUCKET_TOKEN`

2. **Get Project Key**:
   - Project key is shown in your Bitbucket Server project settings
   - Use this as `BITBUCKET_DEFAULT_PROJECT`

### **MCP Client Configuration**

Add to your MCP client configuration (e.g., Cline, Claude Desktop):

```json
{
  "mcpServers": {
    "bitbucket": {
      "command": "node",
      "args": ["/path/to/bitbucket-server-mcp-server/build/index.js"],
      "env": {
        "BITBUCKET_URL": "https://api.bitbucket.org/2.0",
        "BITBUCKET_TOKEN": "your_token_here",
        "BITBUCKET_DEFAULT_PROJECT": "your_workspace_or_project"
      }
    }
  }
}
```

## 📖 **Complete Tool Reference**

### **Project & Repository Management**

#### `list_projects`
Discover and list all projects/workspaces you have access to.
```
Arguments: limit?, start?
```

#### `list_repositories`
Browse repositories within a project/workspace.
```
Arguments: [project/workspace]?, limit?, start?
```

#### `create_repository`
Create a new repository.
```
Arguments: name, [project/workspace]?, description?, isPrivate?, forkPolicy?, language?, hasIssues?, hasWiki?
```

#### `fork_repository`
Create a fork of an existing repository.
```
Arguments: repository, [project/workspace]?, [forkProject/forkWorkspace]?, name?
```

#### `get_repository_settings`
Get comprehensive repository settings and configuration.
```
Arguments: repository, [project/workspace]?
```

#### `update_repository_settings`
Update repository settings and configuration.
```
Arguments: repository, [project/workspace]?, name?, description?, isPrivate?, hasIssues?, hasWiki?, forkPolicy?, language?, website?
```

#### `delete_repository`
⚠️ **Permanently delete a repository** (irreversible).
```
Arguments: repository, [project/workspace]?, confirmName
```

#### `get_repository_stats`
Get repository statistics and insights.
```
Arguments: repository, [project/workspace]?
```

#### `get_repository_archive`
Get download links for repository archives.
```
Arguments: repository, [project/workspace]?, ref?, format?
```

### **Pull Request Operations**

#### `create_pull_request`
Create a new pull request.
```
Arguments: repository, title, sourceBranch, targetBranch, [project/workspace]?, description?, reviewers?
```

#### `get_pull_request`
Get comprehensive pull request details.
```
Arguments: repository, prId, [project/workspace]?
```

#### `merge_pull_request`
Merge an approved pull request.
```
Arguments: repository, prId, [project/workspace]?, message?, strategy?
```

#### `decline_pull_request`
Decline/reject a pull request.
```
Arguments: repository, prId, [project/workspace]?, message?
```

#### `add_comment`
Add a comment to a pull request.
```
Arguments: repository, prId, text, [project/workspace]?, parentId?
```

#### `get_diff`
Get code differences for a pull request.
```
Arguments: repository, prId, [project/workspace]?, contextLines?
```

#### `get_reviews`
Get review history and approval status.
```
Arguments: repository, prId, [project/workspace]?
```

#### `get_pull_request_activity`
Get complete activity timeline for a pull request.
```
Arguments: repository, prId, [project/workspace]?
```

#### `get_pull_request_commits`
List all commits included in a pull request.
```
Arguments: repository, prId, [project/workspace]?, limit?, start?
```

### **Branch Management**

#### `list_branches`
List all branches in a repository.
```
Arguments: repository, [project/workspace]?, limit?, start?
```

#### `create_branch`
Create a new branch.
```
Arguments: repository, branchName, [project/workspace]?, startPoint?
```

#### `delete_branch`
Delete a branch from a repository.
```
Arguments: repository, branchName, [project/workspace]?
```

#### `list_branch_restrictions`
List branch permissions and restrictions.
```
Arguments: repository, [project/workspace]?
```

#### `create_branch_restriction`
Create branch protection rules.
```
Arguments: repository, kind, pattern, [project/workspace]?, users?, groups?
```

### **Commit Operations**

#### `list_commits`
List commits with optional filtering.
```
Arguments: repository, [project/workspace]?, branch?, limit?, start?
```

#### `get_commit`
Get detailed information about a specific commit.
```
Arguments: repository, commitId, [project/workspace]?
```

#### `list_commit_comments`
List all comments on a commit.
```
Arguments: repository, commitId, [project/workspace]?
```

#### `create_commit_comment`
Add a comment to a commit.
```
Arguments: repository, commitId, content, [project/workspace]?, path?, line?
```

### **Issue Management** (Cloud Only)

#### `list_issues`
List issues with optional filtering.
```
Arguments: repository, [project/workspace]?, state?, limit?, start?
```

#### `create_issue`
Create a new issue.
```
Arguments: repository, title, [project/workspace]?, content?, kind?, priority?, assignee?
```

#### `get_issue`
Get detailed issue information.
```
Arguments: repository, issueId, [project/workspace]?
```

#### `list_issue_comments`
List all comments on an issue.
```
Arguments: repository, issueId, [project/workspace]?
```

#### `create_issue_comment`
Add a comment to an issue.
```
Arguments: repository, issueId, content, [project/workspace]?
```

### **File Operations**

#### `get_file_content`
Retrieve file content from repository.
```
Arguments: repository, path, [project/workspace]?, branch?, commitId?
```

#### `list_directory`
List contents of a directory.
```
Arguments: repository, [project/workspace]?, path?, branch?, commitId?
```

#### `get_file_history`
Get commit history for a specific file.
```
Arguments: repository, path, [project/workspace]?, branch?, limit?, start?
```

#### `search_code`
Search for code within a repository.
```
Arguments: repository, query, [project/workspace]?, type?, limit?, start?
```

### **Security & Access Management**

#### `list_ssh_keys`
List SSH keys for user authentication.
```
Arguments: username?
```

#### `create_ssh_key`
Add a new SSH key to user account.
```
Arguments: title, key
```

#### `delete_ssh_key`
Delete an SSH key from user account.
```
Arguments: keyId
```

#### `list_deploy_keys`
List deploy keys for a repository.
```
Arguments: repository, [project/workspace]?
```

#### `create_deploy_key`
Create a new deploy key for automated access.
```
Arguments: repository, title, key, [project/workspace]?, readOnly?
```

#### `delete_deploy_key`
Delete a deploy key from repository.
```
Arguments: repository, keyId, [project/workspace]?
```

#### `list_watchers`
List users watching a repository.
```
Arguments: repository, [project/workspace]?
```

#### `watch_repository`
Start watching a repository.
```
Arguments: repository, [project/workspace]?
```

#### `unwatch_repository`
Stop watching a repository.
```
Arguments: repository, [project/workspace]?
```

### **Tag Management**

#### `list_tags`
List all tags in a repository.
```
Arguments: repository, [project/workspace]?, limit?, start?
```

#### `create_tag`
Create a new tag for releases.
```
Arguments: repository, tagName, [project/workspace]?, commitId?, message?
```

### **Build Status Management**

#### `list_build_statuses`
List build statuses for a commit.
```
Arguments: repository, commitId, [project/workspace]?
```

#### `create_build_status`
Report CI/CD pipeline results.
```
Arguments: repository, commitId, state, key, [project/workspace]?, name?, url?, description?
```

### **Default Reviewers**

#### `list_default_reviewers`
List default reviewers for a repository.
```
Arguments: repository, [project/workspace]?
```

#### `add_default_reviewer`
Add a default reviewer to repository.
```
Arguments: repository, username, [project/workspace]?
```

#### `remove_default_reviewer`
Remove a default reviewer from repository.
```
Arguments: repository, username, [project/workspace]?
```

### **Webhook Integration**

#### `list_webhooks`
List all webhooks for a repository.
```
Arguments: repository, [project/workspace]?
```

#### `create_webhook`
Create a new webhook for automation.
```
Arguments: repository, url, events, [project/workspace]?, description?, active?
```

#### `delete_webhook`
Delete a webhook from repository.
```
Arguments: repository, webhookId, [project/workspace]?
```

### **Code Snippets** (Cloud Only)

#### `list_snippets`
List code snippets.
```
Arguments: workspace?, limit?, start?
```

#### `create_snippet`
Create a new code snippet.
```
Arguments: title, files, isPrivate?
```

#### `get_snippet`
Get details of a specific snippet.
```
Arguments: snippetId, workspace?
```

### **User Operations**

#### `get_user`
Get user profile information.
```
Arguments: username?
```

## 🔧 **Advanced Usage Examples**

### **Complete PR Workflow**
```javascript
// 1. Create a pull request
await createPullRequest({
  repository: "my-repo",
  title: "Add new feature",
  sourceBranch: "feature/new-feature", 
  targetBranch: "main",
  description: "This PR adds...",
  reviewers: ["reviewer1", "reviewer2"]
});

// 2. Get PR details
await getPullRequest({
  repository: "my-repo",
  prId: 123
});

// 3. Add review comment
await addComment({
  repository: "my-repo", 
  prId: 123,
  text: "LGTM! Just one small suggestion..."
});

// 4. Check build status
await listBuildStatuses({
  repository: "my-repo",
  commitId: "abc123def"
});

// 5. Merge when ready
await mergePullRequest({
  repository: "my-repo",
  prId: 123,
  strategy: "squash"
});
```

### **Repository Management**
```javascript
// Create and configure repository
await createRepository({
  name: "new-project",
  description: "My awesome project",
  isPrivate: true,
  hasIssues: true
});

// Set up branch protection
await createBranchRestriction({
  repository: "new-project",
  kind: "require_approvals",
  pattern: "main",
  users: ["admin1", "admin2"]
});

// Add default reviewers
await addDefaultReviewer({
  repository: "new-project", 
  username: "team-lead"
});

// Configure webhooks
await createWebhook({
  repository: "new-project",
  url: "https://ci.company.com/webhook",
  events: ["repo:push", "pullrequest:created"]
});
```

### **Code Exploration**
```javascript
// Search for specific code
await searchCode({
  repository: "my-repo",
  query: "function authenticate",
  type: "code"
});

// Get file content
await getFileContent({
  repository: "my-repo", 
  path: "src/auth.js",
  branch: "develop"
});

// Check file history
await getFileHistory({
  repository: "my-repo",
  path: "src/auth.js",
  limit: 10
});
```

## 🔒 **Security Best Practices**

1. **Use Personal Access Tokens**: Preferred over username/password
2. **Minimal Permissions**: Grant only required permissions to tokens
3. **Environment Variables**: Never hardcode credentials
4. **Token Rotation**: Regularly rotate access tokens
5. **Audit Access**: Regularly review deploy keys and webhooks

## 🐛 **Troubleshooting**

### **Common Issues**

#### **Authentication Errors (401)**
- Verify your token/credentials are correct
- Check token permissions include required scopes
- For Cloud: ensure App Password has correct permissions
- For Server: verify Personal Access Token is valid

#### **Permission Errors (403)**  
- Check you have access to the repository/project
- Verify your role has sufficient permissions
- For organization repos, ensure you're a member

#### **Not Found Errors (404)**
- Verify repository/project names are correct
- Check if repository exists and is accessible
- Ensure workspace/project key is spelled correctly

### **Debug Mode**
Enable debug logging:
```bash
DEBUG=1 node build/index.js
```

## 🤝 **Contributing**

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable  
5. Submit a pull request

## 📄 **License**

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 **Acknowledgments**

- Bitbucket API documentation and team
- Model Context Protocol (MCP) framework
- The open source community

---

**Made with ❤️ for developers who love automation and seamless integrations.**
