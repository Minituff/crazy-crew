FROM mcr.microsoft.com/devcontainers/javascript-node:1-22-bookworm

# Install global CLI tools
RUN npm install -g \
    wrangler@latest \
    @anthropic-ai/claude-code \
    @openai/codex

# Verify installs
RUN node --version && npm --version && wrangler --version && claude --version && codex --version
