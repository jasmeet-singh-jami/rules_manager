import io
import zipfile
from typing import Any


def generate_drl_text(rule_type: dict[str, Any], rules: list[dict[str, Any]]) -> str:
    """
    Reconstruct a valid .drl file from rule_type metadata and a list of rule dicts.

    rule_type keys used: drl_package, drl_imports, drl_functions, slug
    rule keys used: name, condition_raw, action_raw
    """
    lines = []

    # Package
    lines.append(f"package {rule_type['drl_package']};\n")

    # Imports
    if rule_type.get("drl_imports"):
        lines.append(rule_type["drl_imports"])
        lines.append("")

    # Functions
    if rule_type.get("drl_functions"):
        lines.append(rule_type["drl_functions"])
        lines.append("")

    # Rules
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


def generate_drl_bundle(rule_type_rules: list[tuple[dict, list[dict]]]) -> bytes:
    """
    Build a ZIP archive containing one .drl file per rule type.

    Args:
        rule_type_rules: list of (rule_type_dict, rules_list) tuples

    Returns:
        ZIP file as bytes
    """
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        for rule_type, rules in rule_type_rules:
            filename = f"{rule_type['slug']}.drl"
            content = generate_drl_text(rule_type, rules)
            zf.writestr(filename, content)
    return buf.getvalue()
