"""
Pure renderer: ConditionMeta AST dict → condition_raw string.

Operand shapes:
  FieldRef  : {"path": [...]}            — field path, prefix applied on render
  LiteralNode: {"kind": "string"|"number"|"bool"|"regex"|"ident", "value": "..."}
  FnCall    : {"name": "...", "args": [...]}
  BindingArg: {"kind": "binding"}        — renders as the field_path_prefix string

Node shapes:
  CmpNode   : {"kind": "cmp",   "op": "...", "left": Operand, "right": Operand}
  GroupNode : {"kind": "group", "combinator": "and"|"or", "children": [...]}
  RawNode   : {"kind": "raw",   "text": "..."}
"""
from __future__ import annotations

import re


def render_operand(operand: dict, prefix_str: str) -> str:
    if "path" in operand:
        path: list[str] = operand["path"]
        if not path:
            return prefix_str
        return f"{prefix_str}.{'.'.join(path)}" if prefix_str else ".".join(path)

    if operand.get("kind") == "binding":
        return prefix_str

    if "name" in operand and "args" in operand:
        args_str = ", ".join(render_operand(a, prefix_str) for a in operand["args"])
        return f"{operand['name']}({args_str})"

    kind = operand.get("kind", "string")
    value = str(operand.get("value", ""))
    if kind in ("string", "regex"):
        return f'"{value}"'
    return value


def render_node(node: dict, prefix_str: str, *, is_top: bool = False) -> str:
    kind = node.get("kind")

    if kind == "raw":
        return node.get("text", "")

    if kind == "cmp":
        left = render_operand(node["left"], prefix_str)
        right = render_operand(node["right"], prefix_str)
        return f"{left} {node['op']} {right}"

    if kind == "group":
        combinator: str = node.get("combinator", "and")
        sep = " && " if combinator == "and" else " || "
        parts = [render_node(child, prefix_str, is_top=False) for child in node.get("children", [])]
        inner = sep.join(parts) if parts else ""
        # Wrap OR groups in parens when nested inside another group
        if not is_top and combinator == "or" and len(parts) > 1:
            inner = f"({inner})"
        return inner

    return ""


def render_condition(condition_meta: dict, builder_config: dict) -> str:
    """Render a ConditionMeta dict back to a condition_raw string."""
    bindings: list[dict] = condition_meta.get("bindings", [])
    expression = condition_meta.get("expression")

    if not bindings or expression is None:
        return ""

    prefix_str = ".".join(builder_config.get("field_path_prefix", []))
    binding = bindings[0]
    inner = render_node(expression, prefix_str, is_top=True)

    style = binding.get("style")
    if style == "alias":
        return f"{binding['alias']}:{binding['fact_type']}({inner})"
    if style == "dollar":
        return f"${binding['var']} : {binding['fact_type']}({inner})"
    return inner


def normalize_condition(s: str) -> str:
    """Normalize a condition string for drift-comparison (collapse whitespace + remove spaces around symbol operators)."""
    s = re.sub(r"\s+", " ", s.strip())
    s = re.sub(r" *(==|!=|<=|>=|<|>|&&|\|\|) *", r"\1", s)
    return s
