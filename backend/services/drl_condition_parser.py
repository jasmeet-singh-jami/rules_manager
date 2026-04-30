"""
Parser: condition_raw string → ConditionMeta AST dict.

Supports the simple-family rule types (noise_suppression, alert_classifier,
incident_rules, recommendation).  Returns (condition_meta, confidence) where
confidence is 1.0 (clean), 0.5 (partial — Raw nodes present), 0.0 (failed).
"""
from __future__ import annotations

import re
from typing import Optional

# ── tokenizer ─────────────────────────────────────────────────────────────────

TT_NUM    = "NUM"
TT_STR    = "STR"
TT_IDENT  = "IDENT"
TT_DOT    = "DOT"
TT_OP     = "OP"
TT_AND    = "AND"
TT_OR     = "OR"
TT_LPAREN = "LPAREN"
TT_RPAREN = "RPAREN"
TT_COMMA  = "COMMA"
TT_EOF    = "EOF"


def _tokenize(text: str) -> list[tuple[str, str]]:
    tokens: list[tuple[str, str]] = []
    i = 0
    n = len(text)
    while i < n:
        c = text[i]
        if c.isspace():
            i += 1
            continue

        # String literal (may contain escapes / regex meta-chars)
        if c == '"':
            j = i + 1
            while j < n and text[j] != '"':
                if text[j] == '\\':
                    j += 1
                j += 1
            j += 1
            tokens.append((TT_STR, text[i:j]))
            i = j
            continue

        two = text[i:i+2]
        if two == "&&":
            tokens.append((TT_AND, "&&")); i += 2; continue
        if two == "||":
            tokens.append((TT_OR, "||")); i += 2; continue
        if two in ("==", "!=", "<=", ">="):
            tokens.append((TT_OP, two)); i += 2; continue
        if c in ("<", ">"):
            tokens.append((TT_OP, c)); i += 1; continue
        if c == "(":
            tokens.append((TT_LPAREN, c)); i += 1; continue
        if c == ")":
            tokens.append((TT_RPAREN, c)); i += 1; continue
        if c == ".":
            tokens.append((TT_DOT, c)); i += 1; continue
        if c == ",":
            tokens.append((TT_COMMA, c)); i += 1; continue

        # Number
        m = re.match(r"-?\d+(?:\.\d+)?", text[i:])
        if m:
            tokens.append((TT_NUM, m.group())); i += m.end(); continue

        # Identifier (word)
        m = re.match(r"[A-Za-z_]\w*", text[i:])
        if m:
            word = m.group()
            i += len(word)
            if word == "not":
                rest = text[i:]
                stripped = rest.lstrip()
                if stripped.startswith("matches"):
                    i += len(rest) - len(stripped) + len("matches")
                    tokens.append((TT_OP, "not matches"))
                    continue
            tokens.append((TT_IDENT, word))
            continue

        # Unknown char — skip
        i += 1

    tokens.append((TT_EOF, ""))
    return tokens


# ── recursive-descent parser ──────────────────────────────────────────────────

class _ParseError(Exception):
    pass


class _Parser:
    def __init__(self, tokens: list[tuple[str, str]], config: dict):
        self.toks = tokens
        self.pos = 0
        self.prefix: list[str] = config.get("field_path_prefix", [])

    def peek(self) -> tuple[str, str]:
        return self.toks[self.pos]

    def peek_type(self) -> str:
        return self.toks[self.pos][0]

    def advance(self) -> tuple[str, str]:
        t = self.toks[self.pos]; self.pos += 1; return t

    def expect(self, tt: str) -> tuple[str, str]:
        t = self.advance()
        if t[0] != tt:
            raise _ParseError(f"expected {tt}, got {t!r}")
        return t

    # ── grammar ───────────────────────────────────────────────────────────────

    def parse(self) -> dict:
        node = self._and()
        if self.peek_type() != TT_EOF:
            raise _ParseError(f"unexpected token after expression: {self.peek()!r}")
        return node

    def _and(self) -> dict:
        children = [self._or()]
        while self.peek_type() == TT_AND:
            self.advance()
            children.append(self._or())
        return children[0] if len(children) == 1 else {
            "kind": "group", "combinator": "and", "children": children
        }

    def _or(self) -> dict:
        children = [self._atom()]
        while self.peek_type() == TT_OR:
            self.advance()
            children.append(self._atom())
        return children[0] if len(children) == 1 else {
            "kind": "group", "combinator": "or", "children": children
        }

    def _atom(self) -> dict:
        if self.peek_type() == TT_LPAREN:
            self.advance()
            node = self._and()
            self.expect(TT_RPAREN)
            return node
        return self._comparison()

    def _is_op(self) -> bool:
        tt, tv = self.peek()
        return tt == TT_OP or (tt == TT_IDENT and tv in ("matches", "contains"))

    def _comparison(self) -> dict:
        left = self._operand()
        if not self._is_op():
            # Bare operand without operator — shouldn't happen in valid DRL
            raise _ParseError(f"expected comparison operator after {left!r}")
        op = self.advance()[1]
        right = self._operand()
        if op in ("matches", "not matches") and right.get("kind") == "string":
            right = {**right, "kind": "regex"}
        return {"kind": "cmp", "op": op, "left": left, "right": right}

    def _operand(self) -> dict:
        tt, tv = self.peek()

        if tt == TT_STR:
            self.advance()
            return {"kind": "string", "value": tv[1:-1]}

        if tt == TT_NUM:
            self.advance()
            return {"kind": "number", "value": tv}

        if tt == TT_IDENT:
            if tv in ("true", "false"):
                self.advance(); return {"kind": "bool", "value": tv}
            if tv == "null":
                self.advance(); return {"kind": "ident", "value": "null"}

            parts = [tv]; self.advance()
            while self.peek_type() == TT_DOT:
                self.advance()
                if self.peek_type() == TT_IDENT:
                    parts.append(self.advance()[1])

            if self.peek_type() == TT_LPAREN:
                self.advance()
                args: list[dict] = []
                if self.peek_type() != TT_RPAREN:
                    args.append(self._fn_arg())
                    while self.peek_type() == TT_COMMA:
                        self.advance()
                        args.append(self._fn_arg())
                self.expect(TT_RPAREN)
                return {"name": parts[-1], "args": args}

            return self._make_field_ref(parts)

        raise _ParseError(f"unexpected token in operand: {self.peek()!r}")

    def _fn_arg(self) -> dict:
        arg = self._operand()
        # If the arg resolved to a FieldRef whose path is the full prefix, it's a binding ref
        if "path" in arg and arg["path"] == [] and self.prefix:
            return {"kind": "binding"}
        return arg

    def _make_field_ref(self, parts: list[str]) -> dict:
        if self.prefix and parts[: len(self.prefix)] == self.prefix:
            return {"path": parts[len(self.prefix) :]}
        return {"path": parts}


# ── binding extractor ─────────────────────────────────────────────────────────

def _find_matching_paren(text: str, start: int) -> int:
    depth = 0
    in_str = False
    for i in range(start, len(text)):
        c = text[i]
        if c == '"' and not in_str:
            in_str = True
        elif c == '"' and in_str:
            in_str = False
        elif not in_str:
            if c == "(":
                depth += 1
            elif c == ")":
                depth -= 1
                if depth == 0:
                    return i
    return -1


def _extract_binding(condition_raw: str) -> Optional[tuple[dict, str]]:
    text = condition_raw.strip()

    # Try $var : FactType(...)
    m = re.match(r"^\$(\w+)\s*:\s*(\w+)\s*\(", text)
    if m:
        var, fact_type = m.group(1), m.group(2)
        paren_start = m.end() - 1
        paren_end = _find_matching_paren(text, paren_start)
        if paren_end == len(text) - 1:
            inner = text[paren_start + 1 : paren_end]
            return {"style": "dollar", "var": var, "fact_type": fact_type}, inner

    # Try alias:FactType(...)
    m = re.match(r"^(\w+):(\w+)\s*\(", text)
    if m:
        alias, fact_type = m.group(1), m.group(2)
        paren_start = m.end() - 1
        paren_end = _find_matching_paren(text, paren_start)
        if paren_end == len(text) - 1:
            inner = text[paren_start + 1 : paren_end]
            return {"style": "alias", "alias": alias, "fact_type": fact_type}, inner

    return None


# ── public API ────────────────────────────────────────────────────────────────

def _has_raw(node: dict) -> bool:
    if node.get("kind") == "raw":
        return True
    if node.get("kind") == "group":
        return any(_has_raw(c) for c in node.get("children", []))
    return False


def parse_condition(
    condition_raw: str,
    builder_config: dict,
    template_key: str,
) -> tuple[dict, float]:
    """
    Parse condition_raw into (ConditionMeta dict, confidence).
    confidence: 1.0 = clean parse, 0.5 = partial (Raw nodes), 0.0 = failed.
    """
    text = condition_raw.strip()
    result = _extract_binding(text)

    if result is None:
        return {
            "schema_version": 1,
            "mode": "builder",
            "template_key": template_key,
            "bindings": [],
            "expression": {"kind": "raw", "text": text},
        }, 0.0

    binding, inner = result

    try:
        tokens = _tokenize(inner)
        parser = _Parser(tokens, builder_config)
        expression = parser.parse()
    except _ParseError:
        return {
            "schema_version": 1,
            "mode": "builder",
            "template_key": template_key,
            "bindings": [binding],
            "expression": {"kind": "raw", "text": inner},
        }, 0.5

    confidence = 0.5 if _has_raw(expression) else 1.0
    return {
        "schema_version": 1,
        "mode": "builder",
        "template_key": template_key,
        "bindings": [binding],
        "expression": expression,
    }, confidence
