# core-api

| What | Command |
|---|---|
| Run locally (reload) | `uv run dx run core-api` |
| Add a feature module | `uv run dx new-module core-api <plural_name>` |
| Tests | `uv run dx test --service core-api` |
| Lint + structure | `uv run dx lint --service core-api` |
| Permission matrix | `uv run dx permissions core-api` |
| New migration | `uv run dx db revision core-api -m "add x"` |
| Dev token | `uv run dx token core-api --all` |

Port: **8001**. Docs: http://localhost:8001/docs
