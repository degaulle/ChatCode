#!/bin/bash
# ChatCode startup script
# Make sure to set your API keys in .env first!

export PATH="$HOME/local/node/bin:$PATH"

echo "Starting ChatCode..."
echo "Server: http://localhost:3001"
echo "Client: http://localhost:5173"
echo ""

cd "$(dirname "$0")"
npm run dev
