# Bitbucket MCP Server

A comprehensive Model Context Protocol (MCP) server for **Bitbucket Cloud**, **Bitbucket Data Center**, and **Bitbucket Server** integration. This server provides extensive functionality to interact with Bitbucket repositories, including pull requests, branches, commits, issues, file operations, webhooks, and much more.

## 🌟 **Comprehensive Feature Set**

This MCP server provides **50+ tools** covering virtually every aspect of Bitbucket interaction, supporting **Bitbucket Cloud**, **Bitbucket Data Center**, and **Bitbucket Server**:

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
- One of:
  - Bitbucket Cloud account
  - Bitbucket Data Center instance (7.0+)
  - Bitbucket Server instance

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
BITBUCKET_URL=https://api.bitbucket.org      # For Bitbucket Cloud
# OR
BITBUCKET_URL=https://your-datacenter.com   # For Bitbucket Data Center
# OR  
BITBUCKET_URL=https://your-server.com       # For Bitbucket Server

# Authentication (choose one method)
# Method 1: Personal Access Token / HTTP Access Token (recommended)
BITBUCKET_TOKEN=your_personal_access_token

# Method 2: Username + App Password (Cloud) or Password (Server/DC)
BITBUCKET_USERNAME=your_username
BITBUCKET_PASSWORD=your_app_password_or_password

# Optional: Default project/workspace (reduces need to specify in each call)
BITBUCKET_DEFAULT_PROJECT=PROJECT_KEY      # For Server/Data Center
# OR
BITBUCKET_DEFAULT_PROJECT=workspace_name   # For Cloud

# Optional: Platform and version detection (for advanced setups)
BITBUCKET_PLATFORM_TYPE=datacenter         # Force platform type: cloud|server|datacenter
BITBUCKET_VERSION=8.5.0                    # Your Bitbucket version (helps with feature detection)
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

#### **Bitbucket Data Center Setup**
1. **Create Personal Access Token**:
   - Go to Profile > Personal access tokens > Create token
   - Grant permissions: `Repository admin`, `Pull request admin`, `Project admin`
   - Use this as `BITBUCKET_TOKEN`

2. **Or Create HTTP Access Token** (Data Center 7.0+):
   - Go to Administration > HTTP access tokens > Create token
   - Grant appropriate permissions for your use case
   - Use this as `BITBUCKET_TOKEN`

3. **Get Project Key**:
   - Project key is shown in your Data Center project settings
   - Use this as `BITBUCKET_DEFAULT_PROJECT`

4. **Network Configuration**:
   - Ensure your Data Center instance is accessible from where you run the MCP server
   - Configure VPN if required
   - Verify firewall rules allow HTTP/HTTPS access

#### **Bitbucket Server Setup**
1. **Create Personal Access Token**:
   - Go to Profile > Personal access tokens > Create token
   - Grant appropriate permissions for repositories and pull requests
   - Use this as `BITBUCKET_TOKEN`

2. **Get Project Key**:
   - Project key is shown in your Bitbucket Server project settings
   - Use this as `BITBUCKET_DEFAULT_PROJECT`

### **MCP Client Configuration**

Add to your MCP client configuration (e.g., Cline, Claude Desktop):

#### **For Bitbucket Cloud:**
```json
{
  "mcpServers": {
    "bitbucket": {
      "command": "node",
      "args": ["/path/to/bitbucket-server-mcp-server/build/index.js"],
      "env": {
        "BITBUCKET_URL": "https://api.bitbucket.org",
        "BITBUCKET_TOKEN": "your_app_password_here",
        "BITBUCKET_USERNAME": "your_username",
        "BITBUCKET_DEFAULT_PROJECT": "your_workspace_name"
      }
    }
  }
}
```

#### **For Bitbucket Data Center:**
```json
{
  "mcpServers": {
    "bitbucket": {
      "command": "node", 
      "args": ["/path/to/bitbucket-server-mcp-server/build/index.js"],
      "env": {
        "BITBUCKET_URL": "https://your-datacenter.company.com",
        "BITBUCKET_TOKEN": "your_personal_or_http_access_token",
        "BITBUCKET_DEFAULT_PROJECT": "YOUR_PROJECT_KEY",
        "BITBUCKET_PLATFORM_TYPE": "datacenter",
        "BITBUCKET_VERSION": "8.5.0"
      }
    }
  }
}
```

#### **For Bitbucket Server:**
```json
{
  "mcpServers": {
    "bitbucket": {
      "command": "node",
      "args": ["/path/to/bitbucket-server-mcp-server/build/index.js"],
      "env": {
        "BITBUCKET_URL": "https://your-server.company.com",
        "BITBUCKET_TOKEN": "your_personal_access_token",
        "BITBUCKET_DEFAULT_PROJECT": "YOUR_PROJECT_KEY"
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

### **Platform-Specific Features**

#### **Bitbucket Cloud Only:**
- `list_pipelines`, `get_pipeline`, `trigger_pipeline`, `stop_pipeline` - CI/CD pipeline management
- `list_snippets`, `get_snippet`, `create_snippet` - Code snippet sharing
- `list_deployments`, `list_environments` - Deployment environment management

#### **Server/Data Center Only:**
- `get_build_status`, `set_build_status` - Build status reporting

#### **Data Center Enhanced Features:**
- HTTP Access Token support for enhanced security
- Advanced enterprise features and clustering support
- Enhanced API performance and scalability

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

// 4. Merge when ready
await mergePullRequest({
  repository: "my-repo",
  prId: 123,
  strategy: "squash"
});
```

### **Data Center Enterprise Workflow**
```javascript
// Enterprise repository setup with advanced features
await createRepository({
  name: "enterprise-project",
  description: "Mission-critical enterprise application",
  isPrivate: true,
  hasIssues: true
});

// Set up enterprise-grade branch protection
await createBranchRestriction({
  repository: "enterprise-project",
  kind: "require_approvals",
  pattern: "main",
  users: ["tech-lead", "security-team"],
  groups: ["senior-developers"]
});

// Configure build status reporting
await setBuildStatus({
  repository: "enterprise-project",
  commitId: "abc123def",
  state: "SUCCESSFUL",
  key: "jenkins-build",
  name: "Jenkins CI/CD",
  url: "https://jenkins.company.com/build/123"
});
```

## 🔒 **Security Best Practices**

### **For All Platforms:**
1. **Use Access Tokens**: Personal Access Tokens preferred over username/password
2. **Minimal Permissions**: Grant only required permissions to tokens
3. **Environment Variables**: Never hardcode credentials in code
4. **Token Rotation**: Regularly rotate access tokens
5. **Audit Access**: Regularly review deploy keys and webhooks

### **Data Center Specific:**
1. **HTTP Access Tokens**: Use for service-to-service authentication
2. **Network Security**: Configure VPN and firewall rules appropriately
3. **Instance Access**: Ensure Data Center instance is properly secured
4. **Monitoring**: Monitor API usage and access patterns
5. **Compliance**: Follow enterprise security and compliance requirements

## 🐛 **Troubleshooting**

### **Common Issues**

#### **Authentication Errors (401)**

**Bitbucket Cloud:**
- Verify App Password is correct and has required scopes
- Ensure username matches the App Password owner
- Check if 2FA is properly configured

**Bitbucket Data Center:**
- Verify Personal Access Token or HTTP Access Token is valid
- Check token hasn't expired
- Ensure token has sufficient permissions (Repository admin, Pull request admin)
- Verify you're connecting to the correct Data Center instance

**Bitbucket Server:**
- Verify Personal Access Token is valid and hasn't expired
- Check token permissions include required repository access
- Ensure Server instance is accessible

#### **Network/Connection Errors**

**Data Center/Server Specific:**
- **VPN Required**: Check if you need VPN access to reach the instance
- **Firewall Rules**: Verify firewall allows HTTP/HTTPS access
- **DNS Resolution**: Ensure the hostname resolves correctly
- **SSL Certificates**: Check if SSL certificates are valid and trusted
- **Proxy Configuration**: Configure proxy settings if required

**Test Connectivity:**
```bash
# Test basic connectivity
curl -I https://your-datacenter.company.com

# Test API endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://your-datacenter.company.com/rest/api/1.0/projects
```

#### **Permission Errors (403)**  
- **Repository Access**: Check you have access to the repository/project
- **Role Permissions**: Verify your role has sufficient permissions
- **Organization Membership**: For organization repos, ensure you're a member
- **Data Center Groups**: Check group memberships and permissions

#### **Not Found Errors (404)**
- **URL Correctness**: Verify the base URL is correct for your instance
- **Project/Repository Names**: Check if names are spelled correctly
- **Instance Accessibility**: Ensure the instance is running and accessible

#### **Data Center Specific Issues**

**Clustering Problems:**
- **Load Balancer**: Check if load balancer is properly configured
- **Node Health**: Verify all Data Center nodes are healthy
- **Session Affinity**: Ensure proper session handling across nodes

**Performance Issues:**
- **API Rate Limits**: Check if you're hitting API rate limits
- **Instance Resources**: Verify Data Center has sufficient resources
- **Network Latency**: Check network latency between client and instance

### **Debug Mode**
Enable detailed logging for troubleshooting:

```bash
# Enable debug logging
DEBUG=1 node build/index.js

# Enable verbose API logging  
DEBUG=verbose node build/index.js
```

### **Platform Detection**
The server automatically detects your platform, but you can override:

```bash
# Force Data Center detection
BITBUCKET_PLATFORM_TYPE=datacenter

# Specify version for better feature detection
BITBUCKET_VERSION=8.5.0
```

## 🌟 **Feature Comparison**

| Feature | Cloud | Data Center | Server |
|---------|--------|-------------|---------|
| Repository Management | ✅ | ✅ | ✅ |
| Pull Requests | ✅ | ✅ | ✅ |
| Branch Management | ✅ | ✅ | ✅ |
| Webhooks | ✅ | ✅ | ✅ |
| Pipelines | ✅ | ❌ | ❌ |
| Snippets | ✅ | ❌ | ❌ |
| Build Status API | ❌ | ✅ | ✅ |
| HTTP Access Tokens | ❌ | ✅ | ❌ |
| Enterprise Features | Basic | Advanced | Standard |

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
- Enterprise users providing Data Center feedback

---

**Made with ❤️ for developers who love automation and seamless integrations across all Bitbucket platforms.**