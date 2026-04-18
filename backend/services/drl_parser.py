import re
from dataclasses import dataclass, field


@dataclass
class ParsedFunction:
    name: str
    body: str


@dataclass
class ParsedImport:
    statement: str
    kind: str  # 'import' or 'global'


@dataclass
class ParsedRule:
    name: str
    condition_raw: str
    action_raw: str
    required_function_names: list[str] = field(default_factory=list)
    required_import_statements: list[str] = field(default_factory=list)


@dataclass
class ParsedDRL:
    package: str
    imports: list[ParsedImport] = field(default_factory=list)
    functions: list[ParsedFunction] = field(default_factory=list)
    rules: list[ParsedRule] = field(default_factory=list)


def _extract_package(text: str) -> str:
    match = re.search(r"^\s*package\s+([\w.]+)\s*;?", text, re.MULTILINE)
    return match.group(1) if match else ""


def _extract_imports(text: str) -> list[ParsedImport]:
    result = []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("import "):
            result.append(ParsedImport(statement=stripped, kind="import"))
        elif stripped.startswith("global "):
            result.append(ParsedImport(statement=stripped, kind="global"))
    return result


def _find_block_end(text: str, start: int) -> int:
    depth = 0
    i = start
    while i < len(text):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return len(text) - 1


def _extract_functions(text: str) -> list[ParsedFunction]:
    first_rule = re.search(r"^\s*rule\s+", text, re.MULTILINE)
    search_area = text[: first_rule.start()] if first_rule else text

    func_pattern = re.compile(r"\bfunction\b[^{]+\{", re.MULTILINE)
    name_pattern = re.compile(r"\bfunction\b[^(]+\b(\w+)\s*\(")
    result = []
    for m in func_pattern.finditer(search_area):
        brace_start = m.end() - 1
        brace_end = _find_block_end(search_area, brace_start)
        block = search_area[m.start(): brace_end + 1].strip()
        nm = name_pattern.search(block)
        name = nm.group(1) if nm else "unknown"
        result.append(ParsedFunction(name=name, body=block))
    return result


def _detect_rule_function_names(condition_raw: str, action_raw: str, local_names: set[str]) -> list[str]:
    tokens = set(re.findall(r"\b\w+\b", condition_raw + " " + action_raw))
    return sorted(tokens & local_names)


def _detect_rule_import_statements(
    condition_raw: str, action_raw: str, parsed_imports: list[ParsedImport]
) -> list[str]:
    rule_text = condition_raw + " " + action_raw
    matched = []
    for imp in parsed_imports:
        if imp.kind == "global":
            continue
        if imp.statement.startswith("import java.lang."):
            continue
        simple = imp.statement.rstrip(";").split(".")[-1]
        if simple and re.search(r"\b" + re.escape(simple) + r"\b", rule_text):
            matched.append(imp.statement)
    return matched


def _extract_rules(
    text: str,
    local_func_names: set[str],
    parsed_imports: list[ParsedImport],
) -> list[ParsedRule]:
    rules = []
    rule_pattern = re.compile(
        r'rule\s+"([^"]+)"\s*(.*?)when(.*?)then(.*?)end',
        re.DOTALL,
    )
    for m in rule_pattern.finditer(text):
        name = m.group(1).strip()
        condition_raw = m.group(3).strip()
        action_raw = m.group(4).strip()
        required_function_names = _detect_rule_function_names(condition_raw, action_raw, local_func_names)
        required_import_statements = _detect_rule_import_statements(condition_raw, action_raw, parsed_imports)
        rules.append(ParsedRule(
            name=name,
            condition_raw=condition_raw,
            action_raw=action_raw,
            required_function_names=required_function_names,
            required_import_statements=required_import_statements,
        ))
    return rules


def parse_drl(text: str) -> ParsedDRL:
    package = _extract_package(text)
    imports = _extract_imports(text)
    functions = _extract_functions(text)
    local_func_names = {f.name for f in functions}
    rules = _extract_rules(text, local_func_names, imports)
    return ParsedDRL(package=package, imports=imports, functions=functions, rules=rules)
