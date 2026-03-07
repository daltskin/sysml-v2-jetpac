.PHONY: all install build dev server start test typecheck clean help

all: install build ## Install deps and build (default)

install: node_modules ## Install dependencies

node_modules: package.json
	npm install
	@touch node_modules

build: node_modules ## Bundle for production
	node esbuild.config.mjs

dev: node_modules ## Start dev server with watch (port 3000)
	@-lsof -ti :3000 | xargs kill 2>/dev/null; true
	node esbuild.config.mjs --watch

server: node_modules ## Start LSP bridge server (port 3001)
	@-lsof -ti :3001 | xargs kill 2>/dev/null; true
	npx tsx server/bridge.ts

start: node_modules ## Start dev server + bridge server
	@-lsof -ti :3000 :3001 | xargs kill 2>/dev/null; true
	node esbuild.config.mjs --watch & npx tsx server/bridge.ts

test: node_modules ## Run tests
	npx vitest run

typecheck: node_modules ## Run TypeScript type checker
	npx tsc --noEmit

clean: ## Remove build artifacts and dependencies
	rm -rf dist node_modules

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'
