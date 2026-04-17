# DRL Function & Import Dependency Tracking — Design Spec

**Date:** 2026-04-17  
**Status:** Approved

## Problem

The current model treats a `.drl` file as a flat list of rules, with all imports and helper functions stored as monolithic text blobs on `RuleType`. When exporting a subset of rules, every function and import is emitted regardless of which rules actually need them. This produces invalid DRL when functions reference each other transitively, and bloated output when only a few rules are selected.

Root causes from `issue_correlation.drl`:
- Functions cluster by rule: `extractLmdId`/`getLmdIds`/`getAlertsForLmdId` are only used by rule `_0`; `extractPort`/`getPortFromAlertName`/`groupAlertsBasedonDeviceAndPort` only by rule `_6`
- Imports like `java.util.Arrays` and `java.util.regex.*` are only needed when specific functions are included
- Globals (`global java.util.HashMap clusteredAlerts`) must always be emitted regardless of rule selection

## Approach: Function/Import Tables + Name References on Rule

Functions become first-class DB records (viewable and editable in the UI). Each `Rule` stores the list of function names and import statements it directly uses. The generator resolves transitive function dependencies at export time by re-scanning function bodies — no explicit edge table needed.

## Data Model

### New table: `DrlFunction`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `rule_type_id` | UUID FK → rule_types | |
| `name` | String(100) | e.g. `extractLmdId` — unique per rule_type |
| `body` | Text | Full function text including signature |

### New table: `DrlImport`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `rule_type_id` | UUID FK → rule_types | |
| `statement` | Text | e.g. `import java.util.Arrays;` or `global Integer index;` |
| `kind` | Enum: `import` \| `global` | |
| `is_shared` | Boolean | If true, always emitted — used for globals and core DTO imports |

### Changes to `Rule`

Two new JSONB columns:
- `required_function_names` — list of function names directly called by this rule, e.g. `["extractLmdId", "getLmdIds", "getAlertsForLmdId"]`
- `required_import_statements` — list of import statement strings the rule's condition/action directly needs

### Changes to `RuleType`

`drl_functions` (Text) and `drl_imports` (Text) columns **removed**. Their content moves into the new tables. `seed_data.py` updated to populate individual `DrlFunction` and `DrlImport` rows instead of blobs.

Globals are stored as `DrlImport` rows with `kind='global'` and `is_shared=True`.

## Parser & Import Flow

### `drl_parser.py` changes

`ParsedDRL` updated:
- `functions` becomes `list[ParsedFunction]` where each has `name` and `body`
- `imports` becomes `list[ParsedImport]` where each has `statement` and `kind`

`ParsedRule` gains:
- `required_function_names: list[str]`
- `required_import_statements: list[str]`

### Heuristic scanning

1. Build set of all local function names from the file
2. For each rule: tokenize `condition_raw + action_raw`, intersect with local function names → `required_function_names`
3. For each import statement, extract the simple class name (last segment after `.`), check if it appears in the rule text → `required_import_statements`
4. Globals are always `is_shared=True` — not tracked per rule

### `/import/confirm` behaviour

1. Upserts `DrlFunction` rows by `(rule_type_id, name)` — inserts if not exists, **updates `body`** if name already exists (so re-importing an updated file refreshes the function body)
2. Upserts `DrlImport` rows by `(rule_type_id, statement)` — inserts if not exists, no-op if already present (statement is the identity)
3. Creates each `Rule` with `required_function_names` and `required_import_statements` populated from parse results

Import heuristic results are accepted as-is — no correction UI in the import preview.

## Generator & Export Flow

### `generate_drl_text` signature

```python
def generate_drl_text(
    rule_type: dict,           # drl_package, slug
    functions: list[dict],     # all DrlFunction rows for this rule_type
    imports: list[dict],       # all DrlImport rows for this rule_type
    rules: list[dict],         # rules to export
) -> str
```

### Assembly algorithm

1. **Collect needed function names** — union of `required_function_names` across all exported rules
2. **Resolve transitive deps** — fixpoint loop: for each collected function's `body`, scan for calls to other local function names; add any new ones; repeat until stable
3. **Collect needed imports** — union of `required_import_statements` from exported rules + imports whose simple class name appears in any included function body; deduplicated by statement string
4. **Always-include** — all `is_shared=True` imports/globals prepended unconditionally
5. **Emit order:** `package` → imports (sorted, deduped) → globals → functions (original declaration order) → rules
6. **Missing function resilience** — if a `required_function_name` references a function that no longer exists in `DrlFunction` (e.g. manually deleted), the generator skips it and continues rather than erroring

All existing callers (deployment export, ZIP bundle, single-rule export) updated to fetch `DrlFunction` and `DrlImport` rows from the DB and pass them in.

## API Layer

### New router: `routers/functions.py`

```
GET    /rule-types/{rule_type_id}/functions        admin + contributor
POST   /rule-types/{rule_type_id}/functions        admin only
PUT    /rule-types/{rule_type_id}/functions/{id}   admin only
DELETE /rule-types/{rule_type_id}/functions/{id}   admin only

GET    /rule-types/{rule_type_id}/imports          admin + contributor
POST   /rule-types/{rule_type_id}/imports          admin only
PUT    /rule-types/{rule_type_id}/imports/{id}     admin only
DELETE /rule-types/{rule_type_id}/imports/{id}     admin only
```

### Updated endpoints

- `GET /rule-types/{id}` — response includes `functions` and `imports` arrays instead of old text blobs
- `/import/parse` — response includes `required_function_names` and `required_import_statements` per rule
- `/import/confirm` — accepts and persists those fields; upserts `DrlFunction`/`DrlImport` rows
- Deployment export endpoints — fetch functions/imports from new tables

## Frontend UI

### Admin page — Functions panel

Per rule type, a collapsible panel showing:
- List of `DrlFunction` rows: name + expandable body view, inline edit (textarea), delete with confirmation
- List of `DrlImport` rows: statement, kind badge, `is_shared` toggle, delete with confirmation
- Add-new form for both functions and imports

Admin role required for write operations; contributors can view.

### Import page

- Preview table gains a "Functions" column showing comma-separated detected function names per rule (read-only)
- No interaction change — heuristic results are informational only

### Rule Library / Rule detail

- Rule cards show a "Uses functions:" badge listing `required_function_names` — read-only
- Changing function associations requires re-import or admin edit in the Functions panel

### Deployment export

No UI change — export ZIP/DRL assembled server-side using the updated generator.

## Out of Scope

- Editing which functions a rule uses directly on the rule form (re-import or admin Functions panel instead)
- Visualising the function-to-function dependency graph
- Migrating existing rule data (DB treated as fresh; existing rules deleted)
