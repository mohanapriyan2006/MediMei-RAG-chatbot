#!/bin/bash
QDRANT_DIR="/workspace/qdrant"
QDRANT_BIN="$QDRANT_DIR/qdrant"
LOG_FILE="$QDRANT_DIR/qdrant.log"

# Check if Qdrant is already running
if pgrep -x "qdrant" > /dev/null; then
    echo "Qdrant is already running."
    exit 0
fi

# Check if binary exists
if [ ! -f "$QDRANT_BIN" ]; then
    echo "Qdrant binary not found at $QDRANT_BIN. Downloading..."
    mkdir -p "$QDRANT_DIR"
    cd "$QDRANT_DIR" || exit 1
    wget https://github.com/qdrant/qdrant/releases/latest/download/qdrant-x86_64-unknown-linux-gnu.tar.gz
    tar -xzf qdrant-x86_64-unknown-linux-gnu.tar.gz
    rm qdrant-x86_64-unknown-linux-gnu.tar.gz
    mkdir -p "$QDRANT_DIR/storage"
fi

# Ensure executable
chmod +x "$QDRANT_BIN"

echo "Starting Qdrant in the background..."
cd "$QDRANT_DIR" || exit 1
nohup ./qdrant > "$LOG_FILE" 2>&1 &

# Wait and verify
sleep 2
if pgrep -lf qdrant | grep -v grep > /dev/null; then
    echo "Qdrant started successfully. Listening on port 6333."
    curl -s http://localhost:6333
    echo ""
else
    echo "Failed to start Qdrant. Last lines of $LOG_FILE:"
    tail -n 20 "$LOG_FILE"
fi
