#!/bin/bash

# Pitch Matcher - Startup Script

echo "🎵 Pitch Matcher - Starting Application"
echo "========================================"

# Check if FFmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo "⚠️  FFmpeg is not installed. Please install FFmpeg first."
    echo "   On Ubuntu/Debian: sudo apt install ffmpeg"
    echo "   On macOS: brew install ffmpeg"
    exit 1
fi

# Function to cleanup background processes
cleanup() {
    echo ""
    echo "🛑 Shutting down servers..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
    fi
    exit 0
}

# Set up trap for cleanup
trap cleanup SIGINT SIGTERM

# Start backend server
echo "🚀 Starting Backend Server (port 8000)..."
cd backend
python main.py &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Start frontend server
echo "🌐 Starting Frontend Server (port 3000)..."
cd ../frontend
python -m http.server 3000 &
FRONTEND_PID=$!

echo ""
echo "✅ Application started successfully!"
echo "   Backend API: http://localhost:8000"
echo "   Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop the servers"

# Keep script running
wait
