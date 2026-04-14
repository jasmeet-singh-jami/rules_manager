import re
from dataclasses import dataclass, field


@dataclass
class ParsedRule:
    name: str
    condition_raw: str
    action_raw: str


@dataclass
class ParsedDRL:
    package: str
    imports: str
    functions: str | None
    rules: list[ParsedRule] = field(default_factory=list)


def _extract_package(text: str) -> str:
    match = re.search(r"^\s*package\s+([\w.]+)\s*;?", text, re.MULTILINE)
    return match.group(1) if match else ""


def _extract_imports(text: str) -> str:
    """Return all import/global lines joined."""
    lines = []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("import ") or stripped.startswith("global "):
            lines.append(stripped)
    return "\n".join(lines) if lines else ""


def _find_block_end(text: str, start: int) -> int:
    """
    Given `start` pointing at the opening `{`, walk forward counting
    braces and return the index of the matching closing `}`.
    """
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


def _extract_functions(text: str) -> str | None:
    """
    Extract all top-level `function` declarations (before any `rule`).
    Returns None if no functions found.
    """
    # Find position of the first rule
    first_rule = re.search(r"^\s*rule\s+", text, re.MULTILINE)
    search_area = text[: first_rule.start()] if first_rule else text

    func_pattern = re.compile(r"\bfunction\b[^{]+\{", re.MULTILINE)
    blocks = []
    for m in func_pattern.finditer(search_area):
        brace_start = m.end() - 1  # position of opening {
        brace_end = _find_block_end(search_area, brace_start)
        block = search_area[m.start(): brace_end + 1]
        blocks.append(block.strip())

    return "\n\n".join(blocks) if blocks else None


def _extract_rules(text: str) -> list[ParsedRule]:
    """
    Parse all `rule "name" ... when ... then ... end` blocks.
    """
    rules = []
    rule_pattern = re.compile(
        r'rule\s+"([^"]+)"\s*(.*?)when(.*?)then(.*?)end',
        re.DOTALL,
    )
    for m in rule_pattern.finditer(text):
        name = m.group(1).strip()
        condition_raw = m.group(3).strip()
        action_raw = m.group(4).strip()
        rules.append(ParsedRule(name=name, condition_raw=condition_raw, action_raw=action_raw))
    return rules


def parse_drl(text: str) -> ParsedDRL:
    """Parse a .drl file text into a ParsedDRL dataclass."""
    return ParsedDRL(
        package=_extract_package(text),
        imports=_extract_imports(text),
        functions=_extract_functions(text),
        rules=_extract_rules(text),
    )
