# Bitbucket MCP Server

MCP (Model Context Protocol) server for **both Bitbucket Cloud and Bitbucket Server** Pull Request management. This server provides tools and resources to interact with Bitbucket APIs through the MCP protocol with **automatic detection** of your Bitbucket instance type and **full App Password support**.

[![smithery badge](https://smithery.ai/badge/@garc33/bitbucket-server-mcp-server)](https://smithery.ai/server/@garc33/bitbucket-server-mcp-server)
<a href="https://glama.ai/mcp/servers/jskr5c1zq3"><img width="380" height="200" src="https://glama.ai/mcp/servers/jskr5c1zq3/badge" alt="Bitbucket Server MCP server" /></a>

## ✨ Key Features

- **🔄 Auto-Detection**: Automatically detects Bitbucket Cloud (`bitbucket.org`) vs Bitbucket Server and uses appropriate APIs
- **🔐 Full App Password Support**: Complete support for Bitbucket Cloud App Passwords with proper scopes and validation
- **☁️ Bitbucket Cloud Support**: Full support for Bitbucket Cloud API v2.0 with workspaces and Basic Authentication
- **🏢 Bitbucket Server Support**: Complete support for Bitbucket Server API v1.0 with projects and Personal Access Tokens
- **🔍 Project/Workspace Discovery**: List all accessible projects (Server) or workspaces (Cloud)
- **📁 Repository Browsing**: Explore repositories across projects/workspaces
- **🔧 Flexible Authentication**: Multiple authentication methods for each platform
- **✅ Enhanced Validation**: Comprehensive configuration validation with helpful error messages
- **📖 Comprehensive Documentation**: Detailed setup guides for both platforms

## Requirements

- Node.js >= 16

## Installation

### Installing via Smithery

To install Bitbucket Server for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@garc33/bitbucket-server-mcp-server):

```bash
npx -y @smithery/cli install @garc33/bitbucket-server-mcp-server --client claude
```

### Manual Installation

```bash
npm install
```

## Build

```bash
npm run build
```

## Features

The server provides the following tools for comprehensive Bitbucket integration:

### `list_projects`

**Discover and explore projects/workspaces**: 
- **Bitbucket Cloud**: Lists all accessible workspaces with their details
- **Bitbucket Server**: Lists all accessible projects with their details

Essential for discovery when you don't know the exact project/workspace names.

**Use cases:**
- Find available projects/workspaces when you don't know the exact names
- Explore project/workspace structure and permissions
- Discover new projects/workspaces you have access to

Parameters:
- `limit`: Number of projects/workspaces to return (default: 25, max: 1000)
- `start`: Start index for pagination (default: 0)

### `list_repositories`

**Browse and discover repositories**: 
- **Bitbucket Cloud**: Explore repositories within workspaces
- **Bitbucket Server**: Explore repositories within projects

Returns comprehensive repository information including clone URLs and metadata.

**Use cases:**
- Find repository slugs for other operations
- Explore codebase structure across projects/workspaces
- Discover repositories you have access to
- Browse a specific project's/workspace's repositories

Parameters:
- **Bitbucket Cloud**: `workspace`: Workspace name (optional, uses `BITBUCKET_DEFAULT_PROJECT` if not provided)
- **Bitbucket Server**: `project`: Project key (optional, uses `BITBUCKET_DEFAULT_PROJECT` if not provided)
- `limit`: Number of repositories to return (default: 25, max: 1000)
- `start`: Start index for pagination (default: 0)

### `create_pull_request`

**Propose code changes for review**: Creates a new pull request with automatic branch reference setup and reviewer assignments.

**Use cases:**
- Submit feature development for review
- Propose bug fixes
- Request code integration from feature branches
- Collaborate on code changes

Parameters:
- **Bitbucket Cloud**: `workspace`: Workspace name (optional, uses `BITBUCKET_DEFAULT_PROJECT` if not provided)
- **Bitbucket Server**: `project`: Project key (optional, uses `BITBUCKET_DEFAULT_PROJECT` if not provided)
- `repository` (required): Repository slug
- `title` (required): Clear, descriptive PR title
- `description`: Detailed description with context (supports Markdown)
- `sourceBranch` (required): Source branch containing changes
- `targetBranch` (required): Target branch for merging
- `reviewers`: Array of reviewer usernames

### `get_pull_request`

**Comprehensive PR information**: Retrieves detailed pull request information including status, reviewers, commits, and all metadata.

**Use cases:**
- Check PR approval status
- Review PR details and progress
- Understand changes before merging
- Monitor PR status

Parameters:
- **Bitbucket Cloud**: `workspace`: Workspace name (optional, uses `BITBUCKET_DEFAULT_PROJECT` if not provided)
- **Bitbucket Server**: `project`: Project key (optional, uses `BITBUCKET_DEFAULT_PROJECT` if not provided)
- `repository` (required): Repository slug
- `prId` (required): Pull request ID

### `merge_pull_request`

**Merge approved pull requests**: Merges an approved pull request with configurable merge strategies.

**Use cases:**
- Integrate approved changes
- Complete feature development cycle
- Merge bug fixes
- Finalize code reviews

Parameters:
- **Bitbucket Cloud**: `workspace`: Workspace name (optional, uses `BITBUCKET_DEFAULT_PROJECT` if not provided)
- **Bitbucket Server**: `project`: Project key (optional, uses `BITBUCKET_DEFAULT_PROJECT` if not provided)
- `repository` (required): Repository slug
- `prId` (required): Pull request ID
- `message`: Custom merge commit message
- `strategy`: Merge strategy (`merge-commit`, `squash`, `fast-forward`)

### `decline_pull_request`

**Decline pull requests**: Declines/rejects a pull request that should not be merged.

**Use cases:**
- Reject unacceptable changes
- Close PRs that conflict with project direction
- Decline PRs that need significant rework

Parameters:
- **Bitbucket Cloud**: `workspace`: Workspace name (optional, uses `BITBUCKET_DEFAULT_PROJECT` if not provided)
- **Bitbucket Server**: `project`: Project key (optional, uses `BITBUCKET_DEFAULT_PROJECT` if not provided)
- `repository` (required): Repository slug
- `prId` (required): Pull request ID
- `message`: Reason for declining

### `add_comment`

**Participate in code review discussions**: Adds comments to pull requests for feedback, questions, or discussion.

**Use cases:**
- Provide review feedback
- Ask questions about specific changes
- Suggest improvements
- Participate in code review discussions

Parameters:
- **Bitbucket Cloud**: `workspace`: Workspace name (optional, uses `BITBUCKET_DEFAULT_PROJECT` if not provided)
- **Bitbucket Server**: `project`: Project key (optional, uses `BITBUCKET_DEFAULT_PROJECT` if not provided)
- `repository` (required): Repository slug
- `prId` (required): Pull request ID
- `text` (required): Comment text (supports Markdown)
- `parentId`: ID of parent comment for threaded replies

### `get_diff`

**Analyze code changes**: Retrieves the code differences showing exactly what was added, removed, or modified in the pull request.

**Use cases:**
- Review specific code changes
- Understand scope of modifications
- Analyze impact before merging
- Inspect implementation details
- Code quality assessment

Parameters:
- **Bitbucket Cloud**: `workspace`: Workspace name (optional, uses `BITBUCKET_DEFAULT_PROJECT` if not provided)
- **Bitbucket Server**: `project`: Project key (optional, uses `BITBUCKET_DEFAULT_PROJECT` if not provided)
- `repository` (required): Repository slug
- `prId` (required): Pull request ID
- `contextLines`: Context lines around changes (default: 10)

### `get_reviews`

**Track review progress**: Fetches review history, approval status, and reviewer feedback to understand the review state.

**Use cases:**
- Check if PR is ready for merging
- See who has reviewed the changes
- Understand review feedback
- Monitor approval requirements
- Track review progress

## Usage Examples

### Bitbucket Cloud Examples

```bash
# List all accessible workspaces
list_projects

# List repositories in a specific workspace
list_repositories --workspace "my-workspace"

# Create a pull request in a workspace
create_pull_request --workspace "my-workspace" --repository "my-repo" --title "Feature: New functionality" --sourceBranch "feature/new-feature" --targetBranch "main"

# Get pull request details
get_pull_request --workspace "my-workspace" --repository "my-repo" --prId 123
```

### Bitbucket Server Examples

```bash
# List all accessible projects  
list_projects

# List repositories in a specific project
list_repositories --project "MYPROJECT"

# Create a pull request in a project
create_pull_request --project "MYPROJECT" --repository "my-repo" --title "Bugfix: Critical issue" --sourceBranch "bugfix/critical" --targetBranch "develop"

# Merge a pull request with squash strategy
merge_pull_request --project "MYPROJECT" --repository "my-repo" --prId 123 --strategy "squash"
```

### Using Default Project/Workspace

```bash
# If BITBUCKET_DEFAULT_PROJECT is set to "my-workspace" or "MYPROJECT"
create_pull_request --repository "my-repo" --title "Feature: New functionality" --sourceBranch "feature/new-feature" --targetBranch "main"

get_pull_request --repository "my-repo" --prId 123
```

## Dependencies

- `@modelcontextprotocol/sdk` - SDK for MCP protocol implementation
- `axios` - HTTP client for API requests
- `winston` - Logging framework

## Configuration

The server supports **both Bitbucket Cloud and Bitbucket Server** with automatic detection and appropriate authentication methods. Choose the configuration that matches your setup:

### 🌐 Bitbucket Cloud Configuration

Bitbucket Cloud (bitbucket.org) uses **Basic Authentication** with your username and either an **App Password** (recommended) or your account password.

#### Option 1: App Password Authentication (Recommended) ⭐

**Step 1:** Create an App Password
1. Go to [Bitbucket App Passwords](https://bitbucket.org/account/settings/app-passwords/)
2. Click "Create app password"
3. Give it a label (e.g., "MCP Server")
4. Select these permissions:
   - ✅ **Account** → Read
   - ✅ **Repositories** → Read, Write  
   - ✅ **Pull requests** → Read, Write
5. Copy the generated password (you won't see it again!)

**Step 2:** Configure Environment Variables
```json
{
  "mcpServers": {
    "bitbucket": {
      "command": "node",
      "args": ["/path/to/bitbucket-server/build/index.js"],
      "env": {
        "BITBUCKET_URL": "https://bitbucket.org",
        "BITBUCKET_USERNAME": "your-bitbucket-username",
        "BITBUCKET_TOKEN": "your-app-password-here",
        "BITBUCKET_DEFAULT_PROJECT": "your-workspace-name"
      }
    }
  }
}
```

#### Option 2: Username/Password Authentication

**⚠️ Less secure** - only use if you can't create App Passwords:

```json
{
  "mcpServers": {
    "bitbucket": {
      "command": "node",
      "args": ["/path/to/bitbucket-server/build/index.js"],
      "env": {
        "BITBUCKET_URL": "https://bitbucket.org",
        "BITBUCKET_USERNAME": "your-bitbucket-username",
        "BITBUCKET_PASSWORD": "your-account-password",
        "BITBUCKET_DEFAULT_PROJECT": "your-workspace-name"
      }
    }
  }
}
```

### 🏢 Bitbucket Server Configuration  

Bitbucket Server (self-hosted) supports **Personal Access Tokens** (recommended) or **Basic Authentication**.

#### Option 1: Personal Access Token (Recommended) ⭐

**Step 1:** Create a Personal Access Token
1. Go to your Bitbucket Server → Profile → Personal access tokens
2. Click "Create a token" 
3. Give it a name (e.g., "MCP Server")
4. Select these permissions:
   - ✅ **Project admin** or **Project write**
   - ✅ **Repository admin** or **Repository write**
5. Copy the generated token

**Step 2:** Configure Environment Variables
```json
{
  "mcpServers": {
    "bitbucket": {
      "command": "node",
      "args": ["/path/to/bitbucket-server/build/index.js"],
      "env": {
        "BITBUCKET_URL": "https://your-bitbucket-server.com",
        "BITBUCKET_TOKEN": "your-personal-access-token",
        "BITBUCKET_DEFAULT_PROJECT": "PROJECT_KEY"
      }
    }
  }
}
```

#### Option 2: Username/Password Authentication

```json
{
  "mcpServers": {
    "bitbucket": {
      "command": "node", 
      "args": ["/path/to/bitbucket-server/build/index.js"],
      "env": {
        "BITBUCKET_URL": "https://your-bitbucket-server.com",
        "BITBUCKET_USERNAME": "your-username",
        "BITBUCKET_PASSWORD": "your-password",
        "BITBUCKET_DEFAULT_PROJECT": "PROJECT_KEY"
      }
    }
  }
}
```

### 📋 Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `BITBUCKET_URL` | ✅ **Yes** | **Cloud:** `https://bitbucket.org`<br/>**Server:** Your server URL (e.g., `https://bitbucket.company.com`) |
| `BITBUCKET_USERNAME` | **Cloud:** ✅ **Yes**<br/>**Server:** Optional | Your Bitbucket username |
| `BITBUCKET_TOKEN` | **Cloud:** ✅ **Yes** (if no password)<br/>**Server:** ✅ **Yes** (if no username/password) | **Cloud:** App Password<br/>**Server:** Personal Access Token |
| `BITBUCKET_PASSWORD` | Optional | **Cloud:** Account password (less secure)<br/>**Server:** Account password |
| `BITBUCKET_DEFAULT_PROJECT` | Optional | **Cloud:** Default workspace name<br/>**Server:** Default project key |

### 🔄 Auto-Detection

The server automatically detects your Bitbucket type:
- **URLs containing `bitbucket.org`** → Bitbucket Cloud (API v2.0)
- **All other URLs** → Bitbucket Server (API v1.0)

### ✅ Validation & Troubleshooting

**Bitbucket Cloud Requirements:**
- Must have `BITBUCKET_USERNAME`
- Must have either `BITBUCKET_TOKEN` (App Password) or `BITBUCKET_PASSWORD`
- App Password must have correct scopes

**Bitbucket Server Requirements:**  
- Must have either `BITBUCKET_TOKEN` (Personal Access Token) OR `BITBUCKET_USERNAME` + `BITBUCKET_PASSWORD`
- Token/credentials must have repository and project permissions

**Common Issues:**
1. **401 Unauthorized**: Check your credentials and permissions
2. **Wrong workspace/project**: Verify `BITBUCKET_DEFAULT_PROJECT` matches your workspace/project name
3. **App Password scopes**: Ensure all required permissions are selected
4. **Server URL**: Verify the URL is correct and accessible

### 🧪 Testing Your Configuration

Once configured, you should see this in the logs:
```json
{
  "level": "info",
  "message": "Initialized for Bitbucket Cloud",
  "authMethod": "Basic Auth (App Password)",
  "hasAuth": true,
  "username": "your-username",
  "defaultProject": "your-workspace"
}
```

### 🚀 Getting Started Examples

#### Bitbucket Cloud with App Password
```bash
# 1. Create App Password at https://bitbucket.org/account/settings/app-passwords/
# 2. Set environment variables:
export BITBUCKET_URL="https://bitbucket.org"
export BITBUCKET_USERNAME="john-doe"
export BITBUCKET_TOKEN="ATBBKf9..." # Your App Password
export BITBUCKET_DEFAULT_PROJECT="my-workspace"

# 3. Start the server
node build/index.js
```

#### Bitbucket Server with Personal Access Token
```bash
# 1. Create Personal Access Token in your server
# 2. Set environment variables:
export BITBUCKET_URL="https://bitbucket.company.com"
export BITBUCKET_TOKEN="your-pat-token"
export BITBUCKET_DEFAULT_PROJECT="PROJ"

# 3. Start the server  
node build/index.js
```

### 🔄 Platform Differences

While the MCP server provides the same tools for both platforms, there are some differences in the underlying APIs:

| Feature | Bitbucket Cloud | Bitbucket Server |
|---------|-----------------|------------------|
| **Authentication** | Username + App Password (Basic Auth) | Personal Access Token (Bearer) or Basic Auth |
| **Projects/Workspaces** | Workspaces (user/team namespaces) | Projects (administrative containers) |
| **API Version** | REST API 2.0 | REST API 1.0 |
| **Base URL** | `https://api.bitbucket.org/2.0` | `https://your-server.com/rest/api/1.0` |
| **Repository URLs** | `/repositories/{workspace}/{repo_slug}` | `/projects/{project}/repos/{repo_slug}` |
| **Pull Request Reviews** | Participants and reviewers data | Activity stream with review events |
| **Merge Strategies** | `merge_commit`, `squash`, `fast_forward` | `merge-commit`, `squash`, `fast-forward` |

**Note:** The MCP server automatically handles these differences, so you can use the same commands regardless of platform!

## Logging

The server logs all operations to `bitbucket.log` using Winston for debugging and monitoring purposes.
