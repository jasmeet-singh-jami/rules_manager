# Immutable Deployment Snapshots

**Date:** 2026-04-16  
**Status:** Approved

## Problem

`export_deployment` reconstructs part of the DRL bundle from live `Rule` and `RuleType` rows. If a rule is edited or deleted, or a `RuleType`'s package/imports/functions change after a deployment is created, re-exporting that deployment produces different output than at creation time. Deployments are not truly immutable.

## Goal

Exporting a deployment must always produce the same ZIP regardless of any subsequent edits or deletions. The full set of rule types (including those with no rules, which produce empty `.drl` files) must also be frozen at creation time.

## Approach

Option A: snapshot rule-type metadata into existing tables at creation time; export reads only from snapshot columns.

## Schema Changes

### `deployment_rule_snapshots` — add column

```
rule_type_snapshot  JSONB  nullable
```

Stores `_rt_to_dict(rule_type)` for the rule's rule type at the moment the deployment is created. Shape:

```json
{
  "id": "...",
  "slug": "...",
  "name": "...",
  "pipeline_stage": 1,
  "drl_package": "...",
  "drl_imports": "...",
  "drl_functions": "..."
}
```

### `deployments` — add column

```
rule_types_snapshot  JSONB  nullable
```

Stores a JSON array of `_rt_to_dict(rt)` for every `RuleType` row that exists at creation time, sorted by `pipeline_stage`. This freezes the complete set of `.drl` files (including empty ones) for the deployment.

Nullable on both columns only to avoid a migration step; every new deployment will always populate them.

## `create_deployment` Changes

1. Before the rule loop, fetch all `RuleType` rows once and build a `{str(rule_type_id): rt_dict}` map.
2. In the rule loop, look up `rt_dict = rt_map[str(rule.rule_type_id)]` and assign it to `snapshot.rule_type_snapshot`.
3. After the rule loop, assign `deployment.rule_types_snapshot` as the list of all `rt_dict` values sorted by `pipeline_stage`.

No changes to `drl_block` inline rendering.

## `export_deployment` Changes

Two live-lookup blocks are removed:

**Block 1 (current lines 142–152):** Per-snapshot `Rule` → `RuleType` lookup. Replaced by reading `snap.rule_type_snapshot` directly. The `rule_id` live query is removed entirely.

**Block 2 (current lines 161–166):** "All current RuleTypes" query for empty `.drl` files. Replaced by iterating `dep.rule_types_snapshot`. Any rule type not already present in `rt_rules` is added with an empty rules list.

After this change, `export_deployment` makes zero live `Rule` or `RuleType` queries. It reads only the already-fetched `Deployment` row and `DeploymentRuleSnapshot` rows.

## Testing

- Existing backend tests covering deployment creation and export must continue to pass.
- New test: create a deployment, modify the `RuleType` (e.g., change `drl_package`), export the deployment, assert the ZIP contains the original package name.
- New test: create a deployment, delete the rule, export the deployment, assert the rule still appears in the ZIP.
- New test: create a deployment, add a new `RuleType` afterwards, export the deployment, assert the new rule type does NOT appear in the ZIP.

## Out of Scope

- Migration of pre-existing deployment rows (dev environment; DB will be recreated).
- Changes to the frontend.
- Changes to `drl_block` rendering logic.
