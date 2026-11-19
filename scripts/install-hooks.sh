#!/bin/sh
# Turns on the privacy check before every commit and push in this clone (see CLAUDE.md).
cd "$(git rev-parse --show-toplevel)" && chmod +x .githooks/* scripts/check-private.py && git config core.hooksPath .githooks && echo "✓ privacy hooks on (pre-commit, pre-push)"
