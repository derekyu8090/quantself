#!/bin/bash
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
# QuantSelf Health Data Watcher
# Monitors ~/Downloads and iCloud for new Apple Health exports
# Auto-triggers process_data.py when detected
#
# Usage: ./scripts/health-watcher.sh
# Install as service: see scripts/com.quantself.watcher.plist

WATCH_DIRS=(
    "$HOME/Downloads"
    "$HOME/Library/Mobile Documents/com~apple~CloudDocs/HealthExport"
)

PIPELINE="$HOME/health-dashboard/process_data.py"
PYTHON="${PYTHON:-python3}"
LOG="$HOME/.quantself-watcher.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG"
}

process_export() {
    local export_dir="$1"
    if [ -f "$export_dir/export.xml" ]; then
        log "Found Apple Health export at: $export_dir"
        log "Running data pipeline..."
        $PYTHON "$PIPELINE" "$export_dir" >> "$LOG" 2>&1
        if [ $? -eq 0 ]; then
            log "Data updated successfully!"
            # macOS notification
            osascript -e 'display notification "Health data updated successfully" with title "QuantSelf"' 2>/dev/null
        else
            log "ERROR: Pipeline failed"
            osascript -e 'display notification "Data update failed - check logs" with title "QuantSelf" sound name "Basso"' 2>/dev/null
        fi
    fi
}

log "QuantSelf watcher started"
log "Monitoring: ${WATCH_DIRS[*]}"

# Create iCloud watch directory if it doesn't exist
mkdir -p "$HOME/Library/Mobile Documents/com~apple~CloudDocs/HealthExport" 2>/dev/null

# Check if fswatch is installed
if ! command -v fswatch &> /dev/null; then
    log "fswatch not found. Install with: brew install fswatch"
    exit 1
fi

# Watch for new directories containing export.xml
fswatch -r --event Created "${WATCH_DIRS[@]}" | while read -r changed_path; do
    # Check if the changed path is inside an apple_health_export directory
    dir=$(dirname "$changed_path")
    if [[ "$changed_path" == *"export.xml" ]]; then
        process_export "$dir"
    elif [[ "$dir" == *"apple_health_export"* ]] && [ -f "$dir/export.xml" ]; then
        process_export "$dir"
    elif [ -f "$changed_path/export.xml" ]; then
        process_export "$changed_path"
    fi
done
