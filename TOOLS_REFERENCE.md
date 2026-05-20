# Robinson's Toolkit MCP - Complete Tool Reference

**Version:** 2.0.0  
**Last Updated:** May 20, 2026  
**Status:** ✅ All tools verified & operational

---

## Quick Navigation
- [File Operations](#-file--workspace-operations)
- [Git & GitHub](#-git--github)
- [Deployment](#-deployment--hosting)
- [Databases](#-database-operations)
- [AI & Search](#-ai--language-models)
- [Communication](#-communication--messaging)
- [Workflow](#-workflow--automation)
- [Browser](#-browser--web-automation)
- [Local Tools](#-local--always-on-services)

---

## 🗂️ File & Workspace Operations

These tools let you read, write, and manage files on your computer.

### `robinsons-toolkit:local_read_file`
**What it does:** Read the contents of any file  
**Example:**
```
"Claude, read the contents of package.json"
"Show me what's in the README file"
```

### `robinsons-toolkit:local_write_file`
**What it does:** Create a new file or update an existing one  
**Example:**
```
"Create a new file called config.js with this content..."
"Update the .env file to add this variable"
```

### `robinsons-toolkit:local_list_directory`
**What it does:** See what files and folders are in a directory  
**Example:**
```
"Show me all files in the src folder"
"List everything in the project root"
```

### `robinsons-toolkit:local_run_command`
**What it does:** Execute shell/bash commands  
**Example:**
```
"Run npm install to install dependencies"
"Execute 'git status' to see changes"
"Run the test suite"
```

---

## 🔧 Multi-Tool Orchestration

These tools combine multiple operations and can undo changes if something goes wrong.

### `robinsons-toolkit:compound_scaffold_feature`
**What it does:** Automatically create an entire new feature (preferred for starting features)  
**Features:**
- Creates the right folder structure
- Generates starter code
- Sets up configuration files
- Makes an initial Git commit

**Example:**
```
"Create a new authentication feature with login/signup"
"Scaffold a new API endpoint for user profiles"
```

### `robinsons-toolkit:compound_rollback_transaction`
**What it does:** Undo recent changes (safety net for mistakes)  
**Power tool usage:**
- Reverses recent tool calls in reverse order
- Supports rolling back the last N operations
- Dry-run mode to preview what would be undone

**Example:**
```
"Undo the last 3 changes I made"
"Rollback what we just did with the deployment"
```

---

## 🌐 Git & GitHub

These tools let you manage code repositories on GitHub.

### `robinsons-toolkit:github_create_branch`
**What it does:** Create a new Git branch (preferred for creating branches)  
**Example:**
```
"Create a new branch called feature/user-auth"
"Create a branch for the bug fix"
```

### `robinsons-toolkit:github_create_pull_request`
**What it does:** Open a pull request (PR) for code review  
**Example:**
```
"Create a pull request for the changes on this branch"
"Open a PR to merge feature/login into main"
```

### Other Git Operations
- Make commits
- Push code
- Create releases
- Manage branches

---

## ▲ Deployment & Hosting

These tools let you deploy code and manage hosting.

### `robinsons-toolkit:vercel_list_deployments`
**What it does:** See deployment status and history (preferred for checking status)  
**Example:**
```
"What's the status of our latest deployment?"
"Show me the last 5 Vercel deployments"
```

### Deployment Services Available
- **Vercel** - Frontend & full-stack deployments
- **Fly.io** - Container deployments
- **Cloudflare** - CDN, DNS, Workers

**Example:**
```
"Deploy the latest code to production on Vercel"
"Deploy to Fly.io"
```

---

## 💾 Database Operations

These tools let you work with databases.

### `robinsons-toolkit:neon_run_sql`
**What it does:** Run SQL queries on Neon PostgreSQL database (preferred for Postgres)  
**Example:**
```
"Query the users table and count active users"
"Get all orders from the last 30 days"
"Add a new column to the products table"
```

### Other Database Services Available
- **Supabase** - PostgreSQL with realtime & authentication
- **Upstash** - Redis cache & vector store
- **Qdrant** - Vector database

**Example:**
```
"Query the database for..."
"Store this data in Redis cache"
"Save these vectors in the vector database"
```

---

## 🤖 AI & Language Models

These are AI models you can use for various tasks.

### `robinsons-toolkit:openai` (ChatGPT)
**Models Available:** GPT-4, GPT-4 Turbo, GPT-3.5 Turbo  
**What it's good for:**
- Writing and editing text
- Code generation
- Answering questions
- Creative content

### `robinsons-toolkit:anthropic` (Claude)
**Models Available:** Claude 3.5 Sonnet, Claude 3 Opus  
**What it's good for:**
- Same as above (it's Claude itself!)
- Very accurate long-form writing
- Complex reasoning

### `robinsons-toolkit:gemini` (Google Gemini)
**Models Available:** Multimodal (text, image, video, audio, PDF)  
**What it's good for:**
- Understanding images & videos
- Code execution
- Grounded web search
- Image generation (Imagen)
- Text-to-speech

### `robinsons-toolkit:moonshot` (Kimi - Chinese LLM)
**What it's good for:**
- Chinese language processing
- Cultural context understanding

### `robinsons-toolkit:voyage_ai` (Embeddings)
**What it's good for:**
- Finding similar documents
- Semantic search
- AI memory/vector search

---

## 🔍 Web Search

Search the entire internet for information.

### Available Search Engines
- **Brave Search** - Privacy-focused search
- **Tavily** - AI-focused search  
- **SerpAPI** - Search engine results

**Example:**
```
"Search for the latest AI developments"
"Find information about React best practices"
"Look up pricing for AWS services"
```

---

## 📧 Communication & Messaging

Send messages, emails, and notifications.

### `robinsons-toolkit:resend` (Email)
**What it does:** Send emails programmatically  
**Example:**
```
"Send a welcome email to new users"
"Email the user_id@example.com with this message"
```

### `robinsons-toolkit:slack` (Team Messages)
**What it does:** Send messages to Slack channels  
**Example:**
```
"Post a message to #engineering channel"
"Send a notification to #releases"
```

### `robinsons-toolkit:twilio` (SMS & Voice)
**What it does:** Send text messages and make phone calls  
**Example:**
```
"Send an SMS to +1234567890 with this text"
"Call a customer with this automated message"
"Send a verification code via SMS"
```

---

## ⚙️ Workflow & Automation

Automate complex workflows and manage knowledge.

### `robinsons-toolkit:n8n` (Workflow Automation)
**What it does:** Run automated workflows (no-code automation)  
**Example:**
```
"Run the webhook workflow"
"Execute the data processing workflow"
```

### `robinsons-toolkit:context7` (Knowledge Management)
**What it does:** Search and manage documentation  
**Example:**
```
"Search our documentation for API endpoints"
"Find docs about authentication"
```

---

## 💳 Payments

Handle payments and subscriptions.

### `robinsons-toolkit:stripe` (Payment Processing)
**What it does:** Process payments, create invoices, manage subscriptions  
**Example:**
```
"Create a payment for $99.99"
"Create an invoice for customer XYZ"
"List all active subscriptions"
```

---

## 🌍 Maps & Location

Work with maps and geographic data.

### `robinsons-toolkit:mapbox` (Maps & Geocoding)
**What it does:**
- Show maps
- Find addresses (geocoding)
- Calculate routes
- Search locations

**Example:**
```
"Show me a map of Denver, Colorado"
"Get the coordinates for this address"
"Find the fastest route between two locations"
```

---

## 🌐 Browser & Web Automation

Control a web browser to scrape data or automate actions.

### `robinsons-toolkit:playwright` (Browser Automation)
**What it does:**
- Open web pages
- Click buttons
- Fill out forms
- Take screenshots
- Extract data from websites

**Example:**
```
"Go to google.com and search for 'web development'"
"Screenshot the homepage"
"Scrape the prices from the product listing"
```

---

## 🤖 Local & Always-On Services

These work without internet and require no setup.

### `robinsons-toolkit:local` (File System)
**Always available. No setup needed.**  
Includes all file operations above (read, write, list, execute commands)

### `robinsons-toolkit:compound` (Orchestration)
**Always available. No setup needed.**  
Includes scaffold and rollback tools above

### `robinsons-toolkit:ollama` (Local LLM)
**What it does:** Run AI models on your own computer  
**Currently configured:** qwen2.5-coder:7b (code assistant)  
**Benefits:**
- Free to run (no API costs)
- No internet needed (offline)
- All data stays private
- Fast for coding tasks

**Example:**
```
"Use Ollama to generate code for a React component"
"Ask the local model about this algorithm"
```

### `robinsons-toolkit:playwright` (Browser)
**Always available. No setup needed.**  
Browser automation included above

---

## 📊 Authentication & Monitoring

Monitor your application and manage users.

### `robinsons-toolkit:clerk` (Authentication)
**What it does:** Manage user sign-up, login, profiles  
**Example:**
```
"Get the list of all users"
"Check if this user is authenticated"
```

### `robinsons-toolkit:sentry` (Error Tracking)
**What it does:** Track and analyze application errors  
**Example:**
```
"What errors happened in production today?"
"Show me the most common errors"
```

---

## 🔍 Tool Search & Discovery

### `robinsons-toolkit:search_toolkit`
**What it does:** Find the right tool for your task  
**Example:**
```
"How do I deploy code?"
"What tool can I use to send emails?"
```

### `robinsons-toolkit:get_tool_schema`
**What it does:** Get exact parameters for any tool  
**Example:**
```
"What parameters does the Stripe tool accept?"
"Show me how to use the N8N tool"
```

### `robinsons-toolkit:list_namespaces`
**What it does:** See all available tool categories  
**Example:**
```
"Show me all tool categories"
"What tools are available?"
```

---

## Usage Pattern

All tools follow this pattern:

```
robinsons-toolkit:<category>_<action>

Examples:
- robinsons-toolkit:local_read_file
- robinsons-toolkit:github_create_branch
- robinsons-toolkit:vercel_list_deployments
- robinsons-toolkit:neon_run_sql
```

---

## How to Ask Claude to Use Tools

### Natural Language (Recommended)
```
"Read the package.json file"
"Deploy to production"
"Send a Slack message to #engineering"
```

Claude automatically figures out which tool to use.

### Specific Tool (Optional)
```
"Use the local_read_file tool to read package.json"
"Use the github_create_branch tool for feature/auth"
```

---

## Tool Availability

### Always Available (No Configuration)
- ✅ Local file operations
- ✅ Compound orchestration
- ✅ Playwright browser automation

### Requires API Key Configuration
- ⚠️ All other tools require their respective API keys
- ⚠️ If a key is missing, that tool won't be available
- ⚠️ Add keys to `.env` file to enable services

### Current Status
- ✅ 20+ tools active with configured keys
- ⭕ 20+ tools available but not configured
- ✅ 6 tools always on (no keys needed)

---

## Common Tool Combinations

### Deploy a feature
1. `local_read_file` - Check code
2. `github_create_branch` - Create feature branch
3. `local_run_command` - Run tests
4. `github_create_pull_request` - Open PR
5. `vercel_list_deployments` - Check deployment
6. `slack` - Notify team

### Build & deploy
1. `compound_scaffold_feature` - Create feature structure
2. `local_write_file` - Add code
3. `neon_run_sql` - Create database schema
4. `local_run_command` - Build project
5. `vercel` - Deploy to production

### Send notifications
1. `neon_run_sql` - Get data from database
2. `resend` - Send emails
3. `slack` - Post to channels
4. `twilio` - Send SMS

---

## Performance Tips

- **Use `compound_scaffold_feature`** instead of manual scaffolding—it's faster
- **Use `local_run_command`** for git operations instead of doing them manually
- **Use batch operations** where available (e.g., Stripe bulk operations)
- **Cache results** in local variables when using multiple tools in sequence
- **Use `playground` models for testing**, `production` models for real data

---

## Troubleshooting

### Tool not available?
- Check if API key is in `.env`
- Run `node test-toolkit.js` to see what's configured
- Add the key to `.env` and restart

### Tool failing?
- Check internet connection
- Verify API key is correct
- Check service status page for outages
- Review error message for hints

### Slow response?
- Some tools (especially databases) can be slow with large datasets
- Limit results with WHERE clauses in SQL
- Use pagination for large lists

---

## Next Steps

1. **Try a simple command:**
   ```
   "Read the package.json file"
   ```

2. **Try a tool requiring setup:**
   ```
   "Deploy to production"
   ```

3. **Explore more tools:**
   ```
   "What tools are available?"
   ```

4. **Get help:**
   ```
   "How do I use [tool name]?"
   ```

---

**For complete details, see `CLAUDE.md` in the documentation folder.**

**Report Version:** 1.0  
**Last Updated:** May 20, 2026  
**Status:** ✅ Production Ready
