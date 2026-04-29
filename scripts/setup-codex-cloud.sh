#!/usr/bin/env bash
set -euo pipefail

# Installs Claude Code CLI and a compatible claudefast shim for Codex Cloud envs.
# Safe to rerun.

if ! command -v claude >/dev/null 2>&1; then
  npm install -g @anthropic-ai/claude-code
fi

BIN_DIR="${HOME}/.local/bin"
mkdir -p "$BIN_DIR"

if [ ! -x "$BIN_DIR/claudefast" ]; then
  cat > "$BIN_DIR/claudefast" <<'SHIM'
#!/usr/bin/env bash
set -euo pipefail
exec claude "$@"
SHIM
  chmod +x "$BIN_DIR/claudefast"
fi

case ":${PATH}:" in
  *":${BIN_DIR}:"*) ;;
  *)
    export PATH="${BIN_DIR}:${PATH}"
    ;;
esac

echo "✅ claude: $(command -v claude)"
echo "✅ claudefast: $(command -v claudefast)"
