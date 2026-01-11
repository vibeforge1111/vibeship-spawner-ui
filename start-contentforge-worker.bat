@echo off
echo ========================================
echo   ContentForge Worker - Claude Code
echo ========================================
echo.
echo This worker will analyze content requests with real AI.
echo Keep this terminal open while using ContentForge.
echo.
echo Starting Claude Code worker...
echo.

cd /d "%~dp0"
claude --print "Read workers/contentforge-worker.md and start working as described. Poll for pending requests at http://localhost:5174/api/contentforge/bridge/pending every 10 seconds. When you find content, analyze it with your full AI capabilities and send the response. Keep running until I stop you."
