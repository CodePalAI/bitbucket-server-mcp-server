# Bitbucket MCP Server

A comprehensive Model Context Protocol (MCP) server for Bitbucket Cloud and Bitbucket Server integration. This server provides extensive functionality to interact with Bitbucket repositories, including pull requests, branches, commits, issues, file operations, webhooks, and more.

## Features

This MCP server provides comprehensive Bitbucket functionality supporting both **Bitbucket Cloud** and **Bitbucket Server** with the following capabilities:

### 📋 Project & Repository Management
- **Project/Workspace Operations**: List and explore projects (Server) or workspaces (Cloud)
- **Repository Management**: Create, list, fork, and manage repositories
- **Repository Discovery**: Browse repositories across projects/workspaces

### 🔀 Pull Request Management
- **Complete PR Lifecycle**: Create, review, approve, merge, and decline pull requests
- **PR Insights**: Get detailed PR information, diffs, and review status
- **Comment System**: Add and manage PR comments with threading support
- **Merge Strategies**: Support for merge-commit, squash, and fast-forward merges

### 🌳 Branch Operations
- **Branch Management**: List, create, and delete branches
- **Branch Discovery**: Explore branch structure and relationships
- **Smart Branching**: Create branches from any commit, tag, or branch

### 📝 Commit Operations
- **Commit History**: List commits with filtering by branch or author
- **Commit Details**: Get comprehensive commit information including changes
- **Commit Analysis**: Review code changes and commit metadata

### 🐛 Issue Tracking (Cloud Only)
- **Issue Management**: Create, list, and manage issues
- **Issue Insights**: Get detailed issue information and status
- **Issue Organization**: Filter by state, priority, and assignee

### 📁 File Operations
- **File Access**: Read file contents from any branch or commit
- **Directory Browsing**: List directory contents and explore repository structure
- **Content Retrieval**: Access files at specific points in history

### 🏷️ Tag Operations
- **Release Management**: List and create tags for releases and milestones
- **Version Control**: Tag specific commits with messages
- **Release History**: Track project versions and releases

### 👥 User Management
- **User Information**: Get user profiles and account details
- **Team Discovery**: Understand team membership and permissions

### 🔗 Webhook Management
- **Integration Setup**: Create and manage webhooks for CI/CD and automation
- **Event Handling**: Configure webhooks for various repository events
- **Webhook Maintenance**: List and delete webhooks as needed

## Installation

```bash
npm install
npm run build
```

## Configuration

The server supports both Bitbucket Cloud and Bitbucket Server. Configure using environment variables:

### Required Configuration

```bash
# Bitbucket instance URL
BITBUCKET_URL=https://your-bitbucket-instance.com
# For Bitbucket Cloud: https://bitbucket.org or https://api.bitbucket.org

# Default project/workspace (optional but recommended)
BITBUCKET_DEFAULT_PROJECT=YOUR_PROJECT_KEY  # For Server
BITBUCKET_DEFAULT_PROJECT=your-workspace   # For Cloud
```

### Authentication Options

#### Option 1: Personal Access Token (Recommended)
```bash
BITBUCKET_TOKEN=your_personal_access_token
```

#### Option 2: Username + App Password (Cloud) / Password (Server)
```bash
BITBUCKET_USERNAME=your_username
BITBUCKET_PASSWORD=your_app_password_or_password  # App Password for Cloud
```

### Authentication Setup Guide

#### Bitbucket Cloud
1. **Personal Access Token** (Recommended):
   - Go to Bitbucket → Settings → Personal Bitbucket settings → App passwords
   - Create a new app password with required scopes:
     - `Repositories: Read, Write`
     - `Pull requests: Read, Write`
     - `Issues: Read, Write`
     - `Account: Read`
   - Use as `BITBUCKET_TOKEN`

2. **Username + App Password**:
   - Same as above, but use `BITBUCKET_USERNAME` + `BITBUCKET_PASSWORD`

#### Bitbucket Server
1. **Personal Access Token** (Recommended):
   - Go to Bitbucket → Manage account → Personal access tokens
   - Create token with `REPO_READ`, `REPO_WRITE`, and `PROJECT_READ` permissions
   - Use as `BITBUCKET_TOKEN`

2. **Username + Password**:
   - Use your regular Bitbucket Server credentials
   - Set `BITBUCKET_USERNAME` and `BITBUCKET_PASSWORD`

## Usage Examples

### Project and Repository Management

#### List Projects/Workspaces
```json
{
  "tool": "list_projects",
  "arguments": {
    "limit": 50
  }
}
```

#### List Repositories
```json
{
  "tool": "list_repositories",
  "arguments": {
    "project": "PROJECT_KEY",  // For Server
    "workspace": "workspace",  // For Cloud
    "limit": 25
  }
}
```

#### Create Repository
```json
{
  "tool": "create_repository",
  "arguments": {
    "name": "my-new-repo",
    "description": "A new repository for my project",
    "isPrivate": true,
    "hasIssues": true,
    "language": "TypeScript"
  }
}
```

#### Fork Repository
```json
{
  "tool": "fork_repository",
  "arguments": {
    "repository": "original-repo",
    "forkWorkspace": "my-workspace",  // Cloud
    "forkProject": "MY_PROJECT",     // Server
    "name": "my-fork"
  }
}
```

### Branch Management

#### List Branches
```json
{
  "tool": "list_branches",
  "arguments": {
    "repository": "my-repo",
    "limit": 50
  }
}
```

#### Create Branch
```json
{
  "tool": "create_branch",
  "arguments": {
    "repository": "my-repo",
    "branchName": "feature/new-feature",
    "startPoint": "main"
  }
}
```

#### Delete Branch
```json
{
  "tool": "delete_branch",
  "arguments": {
    "repository": "my-repo",
    "branchName": "feature/old-feature"
  }
}
```

### Pull Request Operations

#### Create Pull Request
```json
{
  "tool": "create_pull_request",
  "arguments": {
    "repository": "my-repo",
    "title": "Add new authentication feature",
    "description": "This PR implements OAuth2 authentication with proper error handling.",
    "sourceBranch": "feature/oauth2",
    "targetBranch": "main",
    "reviewers": ["alice", "bob"]
  }
}
```

#### Get Pull Request Details
```json
{
  "tool": "get_pull_request",
  "arguments": {
    "repository": "my-repo",
    "prId": 123
  }
}
```

#### Merge Pull Request
```json
{
  "tool": "merge_pull_request",
  "arguments": {
    "repository": "my-repo",
    "prId": 123,
    "strategy": "squash",
    "message": "Merge feature: Add OAuth2 authentication"
  }
}
```

#### Add PR Comment
```json
{
  "tool": "add_comment",
  "arguments": {
    "repository": "my-repo",
    "prId": 123,
    "text": "This looks great! Just one small suggestion on line 45."
  }
}
```

#### Get PR Diff
```json
{
  "tool": "get_diff",
  "arguments": {
    "repository": "my-repo",
    "prId": 123,
    "contextLines": 5
  }
}
```

### Commit Operations

#### List Commits
```json
{
  "tool": "list_commits",
  "arguments": {
    "repository": "my-repo",
    "branch": "main",
    "limit": 25
  }
}
```

#### Get Commit Details
```json
{
  "tool": "get_commit",
  "arguments": {
    "repository": "my-repo",
    "commitId": "abc123def456"
  }
}
```

### Issue Management (Cloud Only)

#### List Issues
```json
{
  "tool": "list_issues",
  "arguments": {
    "repository": "my-repo",
    "state": "open",
    "limit": 25
  }
}
```

#### Create Issue
```json
{
  "tool": "create_issue",
  "arguments": {
    "repository": "my-repo",
    "title": "Login button not working on mobile",
    "content": "When using Safari on iOS, the login button doesn't respond to taps.",
    "kind": "bug",
    "priority": "major",
    "assignee": "alice"
  }
}
```

#### Get Issue Details
```json
{
  "tool": "get_issue",
  "arguments": {
    "repository": "my-repo",
    "issueId": 456
  }
}
```

### File Operations

#### Get File Content
```json
{
  "tool": "get_file_content",
  "arguments": {
    "repository": "my-repo",
    "path": "src/config.json",
    "branch": "main"
  }
}
```

#### List Directory Contents
```json
{
  "tool": "list_directory",
  "arguments": {
    "repository": "my-repo",
    "path": "src/components",
    "branch": "develop"
  }
}
```

### Tag Operations

#### List Tags
```json
{
  "tool": "list_tags",
  "arguments": {
    "repository": "my-repo",
    "limit": 25
  }
}
```

#### Create Tag
```json
{
  "tool": "create_tag",
  "arguments": {
    "repository": "my-repo",
    "tagName": "v1.2.0",
    "commitId": "abc123def456",
    "message": "Release version 1.2.0 with new authentication features"
  }
}
```

### User Operations

#### Get User Information
```json
{
  "tool": "get_user",
  "arguments": {
    "username": "alice"
  }
}
```

#### Get Current User
```json
{
  "tool": "get_user",
  "arguments": {}
}
```

### Webhook Management

#### List Webhooks
```json
{
  "tool": "list_webhooks",
  "arguments": {
    "repository": "my-repo"
  }
}
```

#### Create Webhook
```json
{
  "tool": "create_webhook",
  "arguments": {
    "repository": "my-repo",
    "url": "https://my-ci-system.com/bitbucket-webhook",
    "description": "CI/CD pipeline trigger",
    "events": ["repo:push", "pullrequest:created", "pullrequest:merged"],
    "active": true
  }
}
```

#### Delete Webhook
```json
{
  "tool": "delete_webhook",
  "arguments": {
    "repository": "my-repo",
    "webhookId": "webhook-uuid-here"
  }
}
```

## Available Tools

| Tool | Description | Cloud | Server |
|------|-------------|-------|--------|
| `list_projects` | List workspaces/projects | ✅ | ✅ |
| `list_repositories` | List repositories | ✅ | ✅ |
| `create_repository` | Create new repository | ✅ | ✅ |
| `fork_repository` | Fork repository | ✅ | ✅ |
| `list_branches` | List branches | ✅ | ✅ |
| `create_branch` | Create new branch | ✅ | ✅ |
| `delete_branch` | Delete branch | ✅ | ✅ |
| `list_commits` | List commits | ✅ | ✅ |
| `get_commit` | Get commit details | ✅ | ✅ |
| `create_pull_request` | Create pull request | ✅ | ✅ |
| `get_pull_request` | Get PR details | ✅ | ✅ |
| `merge_pull_request` | Merge pull request | ✅ | ✅ |
| `decline_pull_request` | Decline pull request | ✅ | ✅ |
| `add_comment` | Add PR comment | ✅ | ✅ |
| `get_diff` | Get PR diff | ✅ | ✅ |
| `get_reviews` | Get PR reviews | ✅ | ✅ |
| `list_issues` | List issues | ✅ | ❌* |
| `create_issue` | Create issue | ✅ | ❌* |
| `get_issue` | Get issue details | ✅ | ❌* |
| `get_file_content` | Get file content | ✅ | ✅ |
| `list_directory` | List directory | ✅ | ✅ |
| `list_tags` | List tags | ✅ | ✅ |
| `create_tag` | Create tag | ✅ | ✅ |
| `get_user` | Get user info | ✅ | ✅ |
| `list_webhooks` | List webhooks | ✅ | ✅ |
| `create_webhook` | Create webhook | ✅ | ✅ |
| `delete_webhook` | Delete webhook | ✅ | ✅ |

*Issue tracking is not available by default in Bitbucket Server

## Error Handling

The server provides comprehensive error handling with specific guidance:

- **Authentication Errors (401)**: Detailed guidance for setting up credentials
- **Permission Errors (403)**: Information about required permissions
- **Not Found Errors (404)**: Clear indication of missing resources
- **Validation Errors (400)**: Specific field validation messages

## Development

### Running the Server

```bash
npm run dev
```

### Testing

```bash
npm test
```

### Building

```bash
npm run build
```

## Advanced Configuration

### Using with Different MCP Clients

This server works with any MCP-compatible client. Example configuration for popular clients:

#### Claude Desktop
```json
{
  "mcpServers": {
    "bitbucket": {
      "command": "node",
      "args": ["path/to/bitbucket-server-mcp-server/dist/index.js"],
      "env": {
        "BITBUCKET_URL": "https://your-bitbucket-instance.com",
        "BITBUCKET_TOKEN": "your_token",
        "BITBUCKET_DEFAULT_PROJECT": "PROJECT_KEY"
      }
    }
  }
}
```

### Environment Variables Reference

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `BITBUCKET_URL` | Bitbucket instance URL | Yes | - |
| `BITBUCKET_TOKEN` | Personal access token | No* | - |
| `BITBUCKET_USERNAME` | Username for basic auth | No* | - |
| `BITBUCKET_PASSWORD` | Password/app password | No* | - |
| `BITBUCKET_DEFAULT_PROJECT` | Default project/workspace | No | - |
| `DEBUG` | Enable debug logging | No | false |

*Either `BITBUCKET_TOKEN` or `BITBUCKET_USERNAME`+`BITBUCKET_PASSWORD` required

## Security Considerations

1. **Use Personal Access Tokens**: Preferred over username/password
2. **Minimal Permissions**: Grant only necessary permissions to tokens
3. **Secure Storage**: Store credentials securely, never in code
4. **Regular Rotation**: Rotate access tokens periodically
5. **Environment Variables**: Use environment variables for all credentials

## Troubleshooting

### Common Issues

#### Authentication Failed
- Verify credentials are correct
- Check token/password hasn't expired
- Ensure proper permissions are granted
- For Cloud: Use App Password, not account password

#### Repository Not Found
- Verify repository name/slug is correct
- Check project/workspace parameter
- Ensure you have access to the repository

#### Network Issues
- Verify Bitbucket URL is correct and accessible
- Check firewall/proxy settings
- For Server: Ensure API is enabled

### Debugging

Enable debug logging:
```bash
DEBUG=true npm start
```

Check the log file:
```bash
tail -f bitbucket.log
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For issues and questions:
- Check the [troubleshooting section](#troubleshooting)
- Review [Bitbucket API documentation](https://developer.atlassian.com/bitbucket/api/2/reference/)
- Create an issue in this repository

## Changelog

### v2.0.0 (Latest)
- ✨ Added comprehensive branch management
- ✨ Added commit operations and history
- ✨ Added issue tracking (Cloud only)
- ✨ Added file operations and directory browsing
- ✨ Added tag management
- ✨ Added repository creation and forking
- ✨ Added user management operations
- ✨ Added webhook management
- 🔧 Enhanced error handling and validation
- 📚 Comprehensive documentation and examples

### v1.0.0
- 🎉 Initial release with basic PR management
- ⚡ Support for Bitbucket Cloud and Server
- 🔐 Multiple authentication methods
- 📋 Project and repository listing
