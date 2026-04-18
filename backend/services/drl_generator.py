import io
import re
import zipfile
from typing import Any


def _resolve_transitive_functions(needed: set[str], funcs_by_name: dict[str, dict]) -> set[str]:
    resolved = set(needed)
    changed = True
    while changed:
        changed = False
        for name in list(resolved):
            if name not in funcs_by_name:
                continue
            body = funcs_by_name[name]["body"]
            for candidate in funcs_by_name:
                if candidate not in resolved and re.search(r"\b" + re.escape(candidate) + r"\s*\(", body):
                    resolved.add(candidate)
                    changed = True
    return resolved


def _simple_name(statement: str) -> str:
    return statement.rstrip(";").split(".")[-1]


def generate_drl_text(
    rule_type: dict[str, Any],
    functions: list[dict[str, Any]],
    imports: list[dict[str, Any]],
    rules: list[dict[str, Any]],
) -> str:
    lines: list[str] = []

    lines.append(f"package {rule_type['drl_package']};\n")

    funcs_by_name = {f["name"]: f for f in functions}

    # Collect function names needed (union across all rules) then resolve transitive deps
    needed_names: set[str] = set()
    for rule in rules:
        needed_names.update(rule.get("required_function_names") or [])
    needed_names = _resolve_transitive_functions(needed_names, funcs_by_name)

    # Warn in generated output for any required function that wasn't found
    for missing in sorted(needed_names - funcs_by_name.keys()):
        lines.append(f"// WARNING: required function '{missing}' not found in DrlFunction table")
    if needed_names - funcs_by_name.keys():
        lines.append("")

    # Collect import statements needed by rules
    needed_stmts: set[str] = set()
    for rule in rules:
        needed_stmts.update(rule.get("required_import_statements") or [])

    # Add imports needed by included function bodies (java.lang.* excluded — auto-imported in Java)
    non_global_imports = {
        _simple_name(i["statement"]): i["statement"]
        for i in imports
        if i.get("kind") != "global" and not i["statement"].startswith("import java.lang.")
    }
    for fname in needed_names:
        if fname in funcs_by_name:
            body_tokens = set(re.findall(r"\b\w+\b", funcs_by_name[fname]["body"]))
            for simple, stmt in non_global_imports.items():
                if simple in body_tokens:
                    needed_stmts.add(stmt)

    # Always-include: is_shared imports (kind == 'import')
    shared_import_stmts = {i["statement"] for i in imports if i.get("is_shared") and i.get("kind") == "import"}
    all_import_stmts = shared_import_stmts | needed_stmts

    # Emit imports (sorted, deduplicated)
    for stmt in sorted(all_import_stmts):
        lines.append(stmt)
    if all_import_stmts:
        lines.append("")

    # Emit globals (always)
    globals_ = [i for i in imports if i.get("kind") == "global"]
    for g in globals_:
        lines.append(g["statement"])
    if globals_:
        lines.append("")

    # Emit functions in original declaration order, only those needed
    for f in functions:
        if f["name"] in needed_names:
            lines.append(f["body"])
            lines.append("")

    # Emit rules
    for rule in rules:
        lines.append(f'rule "{rule["name"]}"')
        lines.append("\twhen")
        for cond_line in rule["condition_raw"].splitlines():
            lines.append(f"\t\t{cond_line}")
        lines.append("\tthen")
        for act_line in rule["action_raw"].splitlines():
            lines.append(f"\t\t{act_line}")
        lines.append("end")
        lines.append("")

    return "\n".join(lines)


def generate_drl_bundle(entries: list[tuple[dict, list[dict], list[dict], list[dict]]]) -> bytes:
    """
    Args:
        entries: list of (rule_type, functions, imports, rules) tuples
    """
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        for rule_type, functions, imports, rules in entries:
            filename = f"{rule_type['slug']}.drl"
            content = generate_drl_text(rule_type, functions, imports, rules)
            zf.writestr(filename, content)
    return buf.getvalue()
