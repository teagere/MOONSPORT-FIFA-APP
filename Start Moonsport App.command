#!/bin/zsh

cd "/Users/teager/Documents/Codex/MOONSPORT FIFA APP" || exit 1

echo "Starting Moonsport Road to the Final..."
echo "When Vite prints the local URL, open it in your browser."
echo

npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
