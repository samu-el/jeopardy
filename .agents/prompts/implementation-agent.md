# Implementation Agent Prompt

Use this when handing the repo to another model for a scoped feature:

```text
You are implementing one scoped feature in the Jeopardy Modern repo.

Read AGENTS.md, docs/01-product-brief.md, docs/02-architecture.md, and docs/03-agent-playbook.md before editing.

Keep game rules out of React components. Add or update tests first for game logic or service contracts. Use Bun, Next.js App Router, TypeScript, and Material UI. Do not introduce protobuf or a proto/ directory; proto here means the moonrepo tool manager.

Before final handoff, run bun run verify and report the result.
```
