# Bitbucket MCP Server

MCP (Model Context Protocol) server for **both Bitbucket Cloud and Bitbucket Server** Pull Request management. This server provides tools and resources to interact with Bitbucket APIs through the MCP protocol with **automatic detection** of your Bitbucket instance type.

[![smithery badge](https://smithery.ai/badge/@garc33/bitbucket-server-mcp-server)](https://smithery.ai/server/@garc33/bitbucket-server-mcp-server)
<a href="https://glama.ai/mcp/servers/jskr5c1zq3"><img width="380" height="200" src="https://glama.ai/mcp/servers/jskr5c1zq3/badge" alt="Bitbucket Server MCP server" /></a>

## ✨ Key Features

- **🔄 Auto-Detection**: Automatically detects Bitbucket Cloud (`bitbucket.org`) vs Bitbucket Server and uses appropriate APIs
- **☁️ Bitbucket Cloud Support**: Full support for Bitbucket Cloud API v2.0 with workspaces
- **🏢 Bitbucket Server Support**: Complete support for Bitbucket Server API v1.0 with projects
- **🔍 Project/Workspace Discovery**: List all accessible projects (Server) or workspaces (Cloud)
- **📁 Repository Browsing**: Explore repositories across projects/workspaces
- **🔧 Flexible Configuration**: Specify project/workspace per command or use defaults
- **📖 Enhanced Documentation**: Improved README with usage examples and better configuration guidance

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

The server requires configuration in the VSCode MCP settings file. Here's a sample configuration:

### Bitbucket Cloud Configuration

```json
{
  "mcpServers": {
    "bitbucket": {
      "command": "node",
      "args": ["/path/to/bitbucket-server/build/index.js"],
      "env": {
        "BITBUCKET_URL": "https://bitbucket.org",
        "BITBUCKET_TOKEN": "your-app-password-or-access-token",
        "BITBUCKET_DEFAULT_PROJECT": "your-workspace-name"
      }
    }
  }
}
```

### Bitbucket Server Configuration

```json
{
  "mcpServers": {
    "bitbucket": {
      "command": "node", 
      "args": ["/path/to/bitbucket-server/build/index.js"],
      "env": {
        "BITBUCKET_URL": "https://your-bitbucket-server.com",
        // Authentication (choose one):
        // Option 1: Personal Access Token
        "BITBUCKET_TOKEN": "your-access-token",
        // Option 2: Username/Password
        "BITBUCKET_USERNAME": "your-username",
        "BITBUCKET_PASSWORD": "your-password",
        // Optional: Default project
        "BITBUCKET_DEFAULT_PROJECT": "your-default-project"
      }
    }
  }
}
```

### Environment Variables

- `BITBUCKET_URL` (required): 
  - **Bitbucket Cloud**: `https://bitbucket.org`
  - **Bitbucket Server**: Base URL of your Bitbucket Server instance (e.g., `https://your-bitbucket-server.com`)
- Authentication (one of the following is required):
  - `BITBUCKET_TOKEN`: 
    - **Bitbucket Cloud**: App password or OAuth access token
    - **Bitbucket Server**: Personal access token
  - `BITBUCKET_USERNAME` and `BITBUCKET_PASSWORD`: Basic authentication credentials (works for both)
- `BITBUCKET_DEFAULT_PROJECT` (optional): 
  - **Bitbucket Cloud**: Default workspace name to use when not specified in tool calls
  - **Bitbucket Server**: Default project key to use when not specified in tool calls

### Auto-Detection

The server automatically detects your Bitbucket instance type:
- URLs containing `bitbucket.org` or `api.bitbucket.org` → **Bitbucket Cloud**
- All other URLs → **Bitbucket Server**

This means you can use the same server for both types of Bitbucket instances without any configuration changes!

**Note**: With the flexible project/workspace support, you can now:
- Set `BITBUCKET_DEFAULT_PROJECT` to work with a specific project/workspace by default
- Use `list_projects` to discover available projects/workspaces
- Use `list_repositories` to browse repositories across projects/workspaces
- Override the default by specifying the `project`/`workspace` parameter in any tool call

## Logging

The server logs all operations to `bitbucket.log` using Winston for debugging and monitoring purposes.
