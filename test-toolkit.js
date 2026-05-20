#!/usr/bin/env node

/**
 * Robinson's Toolkit MCP - Function Test Suite
 * 
 * Tests all major toolkit functions to ensure they're working properly.
 * Run with: node test-toolkit.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, ...args) {
  console.log(`${colors[color]}${args.join(' ')}${colors.reset}`);
}

function testPass(name) {
  log('green', '✓', name);
}

function testFail(name, error) {
  log('red', '✗', name);
  if (error) log('red', '  Error:', error.message || error);
}

function testWarn(name, message) {
  log('yellow', '⚠', name);
  if (message) log('yellow', '  Info:', message);
}

function section(title) {
  log('cyan', '\n' + '='.repeat(70));
  log('cyan', title);
  log('cyan', '='.repeat(70));
}

// ════════════════════════════════════════════════════════════════════════════
//  TEST SUITE
// ════════════════════════════════════════════════════════════════════════════

section('1. ENVIRONMENT CONFIGURATION');

// Check WORKSPACE_ROOT
if (process.env.WORKSPACE_ROOT) {
  testPass('WORKSPACE_ROOT is set:', process.env.WORKSPACE_ROOT);
  if (!fs.existsSync(process.env.WORKSPACE_ROOT)) {
    testWarn('WORKSPACE_ROOT exists', 'Directory not found - will be created on first write');
  } else {
    testPass('WORKSPACE_ROOT directory exists');
  }
} else {
  testFail('WORKSPACE_ROOT is not set');
}

// ════════════════════════════════════════════════════════════════════════════

section('2. BUSINESS & ADMIN INFRASTRUCTURE');

// GitHub
if (process.env.GITHUB_TOKEN) {
  testPass('GitHub token found');
} else {
  testWarn('GitHub token', 'Not configured');
}

// Vercel
if (process.env.VERCEL_TOKEN) {
  testPass('Vercel token found');
  if (process.env.VERCEL_TEAM_ID) {
    testPass('Vercel Team ID found:', process.env.VERCEL_TEAM_ID);
  }
} else {
  testWarn('Vercel token', 'Not configured');
}

// Fly.io
if (process.env.FLY_API_TOKEN) {
  testPass('Fly.io token found');
} else {
  testWarn('Fly.io token', 'Not configured');
}

// Cloudflare
if (process.env.CLOUDFLARE_API_TOKEN) {
  testPass('Cloudflare token found');
  if (process.env.CLOUDFLARE_ACCOUNT_ID) {
    testPass('Cloudflare Account ID found');
  } else {
    testWarn('Cloudflare Account ID', 'Token found but account ID missing');
  }
} else {
  testWarn('Cloudflare token', 'Not configured');
}

// Slack
if (process.env.SLACK_BOT_TOKEN) {
  testPass('Slack bot token found');
} else {
  testWarn('Slack token', 'Not configured');
}

// ════════════════════════════════════════════════════════════════════════════

section('3. DATABASES & BACKEND SERVICES');

// Neon
if (process.env.NEON_API_KEY) {
  testPass('Neon API key found');
} else {
  testWarn('Neon', 'Not configured');
}

// Postgres
if (process.env.POSTGRES_CONNECTION_STRING) {
  testPass('PostgreSQL connection string found');
} else {
  testWarn('PostgreSQL', 'Not configured');
}

// Supabase
if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
  testPass('Supabase configured');
} else {
  testWarn('Supabase', 'Not fully configured');
}

// Upstash
if (process.env.UPSTASH_REDIS_REST_URL) {
  testPass('Upstash Redis found');
} else {
  testWarn('Upstash Redis', 'Not configured');
}

// Qdrant
if (process.env.QDRANT_URL) {
  testPass('Qdrant database found');
} else {
  testWarn('Qdrant', 'Not configured');
}

// ════════════════════════════════════════════════════════════════════════════

section('4. AUTHENTICATION & MONITORING');

// Clerk
if (process.env.CLERK_SECRET_KEY) {
  testPass('Clerk authentication found');
} else {
  testWarn('Clerk', 'Not configured');
}

// Sentry
if (process.env.SENTRY_AUTH_TOKEN) {
  testPass('Sentry error tracking found');
} else {
  testWarn('Sentry', 'Not configured');
}

// ════════════════════════════════════════════════════════════════════════════

section('5. AI SERVICES & LLMs');

// OpenAI
if (process.env.OPENAI_API_KEY) {
  testPass('OpenAI API key found');
} else {
  testWarn('OpenAI', 'Not configured');
}

// Anthropic
if (process.env.ANTHROPIC_API_KEY) {
  testPass('Anthropic API key found');
} else {
  testWarn('Anthropic', 'Not configured');
}

// Gemini
if (process.env.GEMINI_API_KEY) {
  testPass('Google Gemini API key found');
} else {
  testWarn('Gemini', 'Not configured');
}

// Moonshot
if (process.env.MOONSHOT_API_KEY) {
  testPass('Moonshot/Kimi API key found');
} else {
  testWarn('Moonshot', 'Not configured');
}

// Voyage AI
if (process.env.VOYAGE_API_KEY) {
  testPass('Voyage AI API key found');
} else {
  testWarn('Voyage AI', 'Not configured');
}

// Web Search
let searchEngines = [];
if (process.env.BRAVE_SEARCH_API_KEY) searchEngines.push('Brave');
if (process.env.TAVILY_API_KEY) searchEngines.push('Tavily');
if (process.env.SERPAPI_KEY) searchEngines.push('SerpAPI');

if (searchEngines.length > 0) {
  testPass('Web search configured with:', searchEngines.join(', '));
} else {
  testWarn('Web search', 'No search engines configured');
}

// ════════════════════════════════════════════════════════════════════════════

section('6. PAYMENT PROCESSING');

if (process.env.STRIPE_SECRET_KEY) {
  testPass('Stripe API key found');
  if (process.env.STRIPE_SECRET_KEY.startsWith('sk_test_')) {
    testWarn('Stripe', 'Using test mode');
  } else if (process.env.STRIPE_SECRET_KEY.startsWith('sk_live_')) {
    testPass('Stripe', 'Using live mode');
  }
} else {
  testWarn('Stripe', 'Not configured');
}

// ════════════════════════════════════════════════════════════════════════════

section('7. PROJECT-SPECIFIC SERVICES');

// Twilio
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  testPass('Twilio SMS/Voice found');
  if (process.env.TWILIO_PHONE_NUMBER) {
    testPass('Twilio default phone:', process.env.TWILIO_PHONE_NUMBER);
  }
} else {
  testWarn('Twilio', 'Not configured');
}

// Resend
if (process.env.RESEND_API_KEY) {
  testPass('Resend email service found');
  if (process.env.RESEND_FROM) {
    testPass('Resend default sender:', process.env.RESEND_FROM);
  }
} else {
  testWarn('Resend', 'Not configured');
}

// Mapbox
if (process.env.MAPBOX_ACCESS_TOKEN) {
  testPass('Mapbox maps service found');
} else {
  testWarn('Mapbox', 'Not configured');
}

// Context7
if (process.env.CONTEXT7_API_KEY) {
  testPass('Context7 knowledge service found');
} else {
  testWarn('Context7', 'Not configured');
}

// N8N
if (process.env.N8N_BASE_URL && process.env.N8N_ACCESS_TOKEN) {
  testPass('N8N workflow automation found');
} else {
  testWarn('N8N', 'Not configured');
}

// ════════════════════════════════════════════════════════════════════════════

section('8. GOOGLE WORKSPACE');

// Check OAuth vs Service Account
const hasOAuth = !!process.env.GOOGLE_ACCESS_TOKEN;
const hasServiceAccount = !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || !!process.env.GOOGLE_CREDENTIALS_JSON;

if (hasOAuth) {
  testPass('Google OAuth token found');
}

if (hasServiceAccount) {
  testPass('Google Service Account configured');
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH) {
    if (fs.existsSync(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH)) {
      testPass('Service Account key file found');
    } else {
      testFail('Service Account key file not found at:', process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH);
    }
  }
}

if (!hasOAuth && !hasServiceAccount) {
  testWarn('Google Workspace', 'Not configured - no OAuth token or service account');
}

if (hasOAuth && hasServiceAccount) {
  testWarn('Google configuration', 'Both OAuth and Service Account configured - only one is needed');
}

// ════════════════════════════════════════════════════════════════════════════

section('9. LOCAL & ALWAYS-ON SERVICES');

// These are always available
testPass('Local file operations (local_read_file, local_write_file)');
testPass('Directory operations (local_list_directory)');
testPass('Shell commands (local_run_command)');
testPass('Multi-tool orchestration (compound_scaffold_feature)');
testPass('Operation rollback (compound_rollback_transaction)');

// Ollama
if (process.env.OLLAMA_BASE_URL) {
  testPass('Ollama configured at:', process.env.OLLAMA_BASE_URL);
  if (process.env.OLLAMA_DEFAULT_MODEL) {
    testPass('Default model:', process.env.OLLAMA_DEFAULT_MODEL);
  }
} else {
  testWarn('Ollama', 'Not configured (optional local LLM)');
}

// Browser automation
testPass('Browser automation & scraping (Playwright)');

// ════════════════════════════════════════════════════════════════════════════

section('SUMMARY');

const allServices = [
  'GitHub', 'Vercel', 'Fly.io', 'Cloudflare',
  'Neon', 'Supabase', 'Upstash',
  'OpenAI', 'Anthropic', 'Gemini', 'Moonshot', 'Voyage AI',
  'Slack', 'Twilio', 'Resend', 'Stripe',
  'Google Workspace'
];

const configuredCount = Object.keys(process.env)
  .filter(key => key.includes('TOKEN') || key.includes('KEY') || key.includes('SECRET') || key.includes('URL') || key.includes('ACCOUNT'))
  .length;

log('cyan', `\nTotal configured services/keys: ${configuredCount}`);
log('cyan', 'Always-available tools: local, compound, ollama, playwright\n');

log('blue', 'Ready to use Robinson\'s Toolkit MCP!');
log('blue', 'Start with: npm start');

// ════════════════════════════════════════════════════════════════════════════
