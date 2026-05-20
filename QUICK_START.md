# Robinson's Toolkit - Quick Reference Guide

## What Is This?

Robinson's Toolkit is an **MCP Server** (Model Context Protocol) that gives Claude access to 1,400+ tools across 28 categories. It's like adding superpowers to Claude—from managing code repositories to running database queries, sending emails, automating workflows, and more.

---

## How Does It Work?

```
You ← → Claude (in Claude.ai or your app)
         ↓
      Robinson's Toolkit MCP
         ↓
   GitHub, Vercel, AWS, Stripe, Slack, etc.
```

When you ask Claude to do something that requires accessing external services, Claude uses the toolkit to make those actions happen.

---

## Tools by Category (Simple Explanation)

### 🗂️ Files & Workspace
- **Read files** - Get content from any file in your project
- **Write files** - Create new files or update existing ones
- **List directories** - See what's in folders
- **Run commands** - Execute shell commands (npm, git, etc.)

### 🔧 Multi-Tool Automation
- **Scaffold features** - Generate entire new features automatically
- **Rollback changes** - Undo recent actions if something goes wrong

### 💾 Databases
- **Query Neon** - Run SQL queries on your PostgreSQL database
- **Manage data** - Create, read, update, delete database records

### 🌐 Web & Hosting
- **Check Vercel deployments** - See deployment status and history
- **Manage GitHub repos** - Create branches, make commits, open pull requests
- **Deploy to Fly.io** - Push code to production

### 🤖 AI & Language
- **ChatGPT (OpenAI)** - Advanced language model
- **Claude (Anthropic)** - AI assistant (that's Claude itself!)
- **Google Gemini** - Multimodal AI (images, videos, text)
- **Moonshot/Kimi** - Chinese language AI
- **Voyage AI** - AI for finding similar documents/concepts

### 🔍 Search
- **Web search** - Google, Brave, Tavily search engines
- **Find information** - Research anything on the internet

### 📧 Communication
- **Send email** (Resend) - Programmatically send emails
- **SMS & Voice** (Twilio) - Send text messages or make calls
- **Post to Slack** - Send messages to team channels

### 💳 Payments
- **Stripe** - Handle payments, invoices, subscriptions

### 🎯 Automation & Workflows
- **N8N** - No-code workflow automation
- **Context7** - Document management & knowledge base

### 🌍 Maps & Location
- **Mapbox** - Maps, routes, geocoding

### 🔐 Authentication & Monitoring
- **Clerk** - User sign-up & login
- **Sentry** - Track application errors

### 🦊 Browser Automation
- **Playwright** - Control a web browser automatically
- **Screenshot & scrape** - Take screenshots or extract data from websites

### 🎤 Local LLM
- **Ollama** - Run AI models on your own computer (no internet needed)

---

## Common Tasks & What Tools Are Used

### Task: Deploy code to production
**Tools Used:** GitHub (code repo) → Vercel/Fly.io (deployment) → Slack (notify team)
```
"Claude, deploy the latest main branch to production and notify #releases"
```

### Task: Create a new feature with code
**Tools Used:** Local (write code) → GitHub (create branch & PR)
```
"Generate a login page for our app and create a pull request"
```

### Task: Send automated emails to customers
**Tools Used:** Database (find users) → Resend (send email)
```
"Query users from last month and send them a follow-up email"
```

### Task: Monitor application errors
**Tools Used:** Sentry (collect errors) → Slack (alert team)
```
"What errors happened in production today?"
```

### Task: Research something for your project
**Tools Used:** Web Search (Brave/Tavily)
```
"Find the latest best practices for API authentication"
```

---

## Configuration (Simple Version)

### What You Need to Know
1. The `.env` file contains API keys for all services
2. Each service is optional—only add keys for services you use
3. Keep `.env` private (never share it!)
4. `.env.example` shows all available options

### How to Add a Service
1. Get API key from the service (e.g., GitHub, Vercel, etc.)
2. Open `.env` file
3. Find the line for that service
4. Paste your key next to the `=` sign
5. Save the file
6. Run test to verify: `node test-toolkit.js`

---

## Common Questions

### Q: Do I need all the services?
**A:** No! Only add keys for services you want to use. Others will just be disabled.

### Q: Is my API key safe?
**A:** Yes, if you follow these rules:
- Keep `.env` private (don't share it)
- Don't commit it to Git (`.gitignore` already protects it)
- Use separate keys for development and production

### Q: How much does this cost?
**A:** It depends on the services. Most have free tiers:
- GitHub: Free for public repos
- Vercel: Free tier available
- OpenAI: Pay per API call (~$0.01-$0.10 per request)
- Stripe: Only pay when you process payments (2.9% + $0.30)
- Most others have free tiers

### Q: Can I use this offline?
**A:** Partially. You can:
- Always: Read/write files, run commands
- Always: Use Ollama (local LLM on your computer)
- Offline tools don't need internet

But most services (GitHub, Vercel, etc.) need internet.

### Q: How do I know what tools are available?
**A:** Run this command:
```bash
node test-toolkit.js
```
This shows all configured tools and services.

### Q: How do I use a tool with Claude?
**A:** Just ask Claude naturally:
```
"Read the contents of package.json"
"Create a new file called utils.js with these functions"
"Deploy to production"
"Send a Slack message to #engineering"
```

Claude will automatically use the right tools.

---

## Troubleshooting

### Issue: Tool not found
**Solution:** Make sure the API key is in `.env` and you've restarted the server

### Issue: Permission denied error
**Solution:** Check that WORKSPACE_ROOT exists and Claude has permission to read/write

### Issue: API key rejected
**Solution:** 
- Double-check the key is correct (copy-paste from the service)
- Make sure you have the right key (some services have multiple keys)
- Check if the key has expired

### Issue: Service not responding
**Solution:**
- Check internet connection
- Verify the API endpoint is correct in `.env`
- Check service status page for outages

---

## Next Steps

1. **Review your setup** 
   ```bash
   node test-toolkit.js
   ```

2. **Start the server**
   ```bash
   npm start
   ```

3. **Use with Claude** - Ask Claude to do something with the tools

4. **Add more services** - As you need them, add keys to `.env`

---

## Learning Resources

- 📖 **Full documentation:** See `README.md`
- 🏗️ **Architecture details:** See `ClaudeBuildPlan.md`
- 📋 **Tool reference:** See `CLAUDE.md`
- ✅ **Test results:** See `TEST_RESULTS.md`

---

## Support

For issues or questions:
1. Check `TEST_RESULTS.md` for common problems
2. Review the tool documentation in `CLAUDE.md`
3. Check the `.env.example` file for configuration help

---

**Last Updated:** May 20, 2026  
**Version:** 2.0.0
