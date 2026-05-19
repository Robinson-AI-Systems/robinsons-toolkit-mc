@echo off
title Robinson's Toolkit MCP — Setup
echo.
echo  ============================================
echo   Robinson's Toolkit MCP v2.0 — Setup
echo  ============================================
echo.

:: Check for Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo  ERROR: Node.js is not installed.
    echo  Please install Node.js v18 or higher from: https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo  Node.js found:
node --version
echo.

:: Install dependencies
echo  Installing dependencies...
call npm install
if errorlevel 1 (
    echo.
    echo  ERROR: npm install failed. Check your internet connection and try again.
    pause
    exit /b 1
)

echo.
echo  Dependencies installed successfully!
echo.

:: Check for .env file
if not exist ".env" (
    echo  Creating .env file from template...
    copy .env.example .env
    echo.
    echo  IMPORTANT: Open the .env file and fill in your API keys.
    echo  Location: %~dp0.env
    echo.
    echo  You only need to fill in the services you use.
    echo  Leave the rest blank -- those tools won't appear.
    echo.
) else (
    echo  .env file already exists. Skipping creation.
    echo.
)

echo  ============================================
echo   Setup Complete!
echo  ============================================
echo.
echo  Next steps:
echo  1. Edit .env with your API keys (if not done already)
echo  2. Add this to your Claude Code MCP config (see claude-code-config.json)
echo  3. Restart Claude Code
echo.
echo  To test the server manually, run:
echo    node index.js
echo.
pause
