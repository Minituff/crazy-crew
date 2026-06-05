# Cadence — Agent Instructions

## On Every Session Start

Read these files in order before doing anything else:

1. `context/progress-tracker.md` — current build state, completed features, open issues, file map
2. `context/architecture.md` — tech stack, invariants, data layer, request flow
3. `context/project-overview.md` — what this product is, core flows, out of scope
4. `context/code-standards.md` — JS/React conventions, file structure, styling rules
5. `context/ui-context.md` — design tokens, component API, interaction patterns
6. `context/ai-workflow-rules.md` — scope discipline, decision rules, model selection

Do not begin any work until these are read. They define the constraints, conventions, and current state of the project.

## After Every Code Change

**Update `context/progress-tracker.md` immediately after completing any code change.**

A PostToolUse hook enforces this — you will receive a reminder after every Edit/Write. Do not dismiss it. Act on it:

- If a feature was completed: check it off under "Completed Features"
- If a new architectural decision was made: add it to the "Architectural Decisions" table with rationale
- If a bug was found or a limitation discovered: add it to "Known Issues / Open Items"
- If a known issue was resolved: remove or check it off
- Update the "Last updated" date at the top of the file

This is not optional. The progress tracker is the source of truth for resuming work across sessions.

## Key Constraints (Summary)

- No database — `/data/**/*.md` and `/data/**/*.json` only
    * You can organize this data however you like, but it must be in markdown or JSON files under `/data`
- API keys never reach the browser
- New npm dependencies require a container rebuild — always flag this
- Do not modify `/data/diary.md` or `/data/config.json` without confirming with the user
- Do not modify editable prompt files or hard-code new system prompt instructions unless the user specifically asks for a prompt change
- The diary is a personal wellness journal, not a work log — keep prompts, tone, and copy in that register
