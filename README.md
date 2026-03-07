# Jetpac SysML v2

A retro [Jetpac](https://en.wikipedia.org/wiki/Jetpac)-inspired browser game that teaches **SysML v2** notation. Fly your spaceman, collect fuel cells, fend off aliens — and write real SysML v2 code to complete each mission.

## 🚀 Play Here
-  https://jetpac-sysml.azurewebsites.net/

## Quick Start

```bash
make             # install deps + build
make start       # dev server + LSP bridge
```

Build for production:

```bash
make build
```

Run tests:

```bash
make test
```

## How It Works

Each level pairs an arcade challenge with a **SysML v2 coding mission**. An in-browser editor validates your code against expected patterns. Solutions are **cumulative** — every definition you write stays in the file as you progress, building a complete spacecraft model by level 20.

A server-side LSP bridge provides real syntax validation via the SysML v2 language server.

## Levels

20 levels across 4 tiers, each introducing a distinct SysML v2 concept:

### Tier 1 — Foundation (Levels 1–5)

| # | Level | SysML v2 Concept | What You Learn |
|---|-------|-------------------|----------------|
| 1 | Package Declaration | `package` | Organise definitions into namespaces |
| 2 | Part Definition | `part def` | Define reusable building blocks |
| 3 | Attribute Usage | `attribute : Type` | Add typed properties to parts |
| 4 | Part Usage | `part x : Y` | Compose parts inside other parts |
| 5 | Comment & Documentation | `doc /* */` | Document definitions with SysML doc comments |

### Tier 2 — Structure (Levels 6–10)

| # | Level | SysML v2 Concept | What You Learn |
|---|-------|-------------------|----------------|
| 6 | Port Definition | `port def` | Define interface points for connections |
| 7 | Connection Usage | `connect a to b` | Wire parts together structurally |
| 8 | Import & Reuse | `import Pkg::*` | Reuse definitions across packages |
| 9 | Enumeration | `enum def` | Define fixed sets of values |
| 10 | Specialisation | `X :> Y` | Inherit and extend definitions |

### Tier 3 — Behaviour (Levels 11–15)

| # | Level | SysML v2 Concept | What You Learn |
|---|-------|-------------------|----------------|
| 11 | Action Definition | `action def` with `in`/`out` | Model behaviour with typed inputs and outputs |
| 12 | State Machine | `state` with `entry`/`exit` | Define states with entry and exit actions |
| 13 | Transition | `transition first/then` | Connect states with named transitions |
| 14 | Constraint | `constraint def` | Express formal rules and invariants |
| 15 | Requirement & Traceability | `require constraint` | Bind requirements to their formal constraints |

### Tier 4 — Mastery (Levels 16–20)

| # | Level | SysML v2 Concept | What You Learn |
|---|-------|-------------------|----------------|
| 16 | Use Case | `use case def` | Model scenarios with subjects and actors |
| 17 | Allocation | `allocate X to Y` | Map functions to physical structure |
| 18 | Interface Definition | `interface def` | Define directional contracts with `in`/`out` ports |
| 19 | Satisfy & Assert | `satisfy` / `assert constraint` | Verify requirements and assert constraints |
| 20 | Complete Model | Integration | Assemble the full spacecraft from all prior definitions |

## Project Structure

```
src/
  main.ts              Entry point
  editor/              In-browser SysML editor + LSP client
  bridge/              Code validator (game ↔ editor bridge)
  game/
    engine.ts          Game loop, rendering, state management
    levels.ts          All 20 level definitions
    physics.ts         Gravity, collision, jetpack thrust
    entities/          Spaceman, rocket, aliens, platforms, collectibles
server/
  bridge.ts            LSP bridge server (SysML v2 language server)
tests/                 Vitest test suite
```

## Licence

MIT
