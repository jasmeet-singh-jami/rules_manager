import io
import zipfile
import pytest
from services.drl_generator import generate_drl_text, generate_drl_bundle

RULE_TYPE = {"slug": "alert_classifier", "drl_package": "com.example.test"}

FUNCTIONS = [
    {"name": "extractType", "body": "function String extractType(String t) { return t; }"},
    {"name": "helper", "body": "function String helper(String t) { return extractType(t); }"},
]

IMPORTS = [
    {"statement": "import com.example.dto.IPPAlert;", "kind": "import", "is_shared": False},
    {"statement": "import java.lang.String;", "kind": "import", "is_shared": False},
    {"statement": "global java.util.HashMap myMap;", "kind": "global", "is_shared": True},
]

RULES = [
    {
        "name": "AlertClassifier_1",
        "condition_raw": 'alert:IPPAlert(sourceId == "LM")',
        "action_raw": 'String t = extractType("x"); alert.setServiceName(t);',
        "required_function_names": ["extractType"],
        "required_import_statements": ["import com.example.dto.IPPAlert;"],
    },
    {
        "name": "AlertClassifier_2",
        "condition_raw": 'alert:IPPAlert(sourceId == "Tivoli")',
        "action_raw": 'alert.setServiceName("svc2");',
        "required_function_names": [],
        "required_import_statements": ["import com.example.dto.IPPAlert;"],
    },
]


def test_generate_contains_package():
    text = generate_drl_text(RULE_TYPE, FUNCTIONS, IMPORTS, RULES)
    assert "package com.example.test;" in text


def test_generate_contains_required_import():
    text = generate_drl_text(RULE_TYPE, FUNCTIONS, IMPORTS, RULES)
    assert "import com.example.dto.IPPAlert;" in text


def test_generate_omits_unreferenced_import():
    text = generate_drl_text(RULE_TYPE, FUNCTIONS, IMPORTS, RULES)
    # java.lang.String not in any rule's required_import_statements
    assert "import java.lang.String;" not in text


def test_generate_always_includes_globals():
    text = generate_drl_text(RULE_TYPE, FUNCTIONS, IMPORTS, RULES)
    assert "global java.util.HashMap myMap;" in text


def test_generate_includes_required_function():
    text = generate_drl_text(RULE_TYPE, FUNCTIONS, IMPORTS, RULES)
    assert "function String extractType" in text


def test_generate_omits_unreferenced_function():
    text = generate_drl_text(RULE_TYPE, FUNCTIONS, IMPORTS, RULES)
    # helper is not in any rule's required_function_names
    assert "function String helper" not in text


def test_generate_resolves_transitive_function():
    rules_needing_helper = [
        {**RULES[0], "required_function_names": ["helper"], "action_raw": "helper('x');"},
    ]
    text = generate_drl_text(RULE_TYPE, FUNCTIONS, IMPORTS, rules_needing_helper)
    # helper calls extractType, so extractType must also be included
    assert "function String helper" in text
    assert "function String extractType" in text


def test_generate_contains_both_rules():
    text = generate_drl_text(RULE_TYPE, FUNCTIONS, IMPORTS, RULES)
    assert 'rule "AlertClassifier_1"' in text
    assert 'rule "AlertClassifier_2"' in text


def test_generate_structure():
    text = generate_drl_text(RULE_TYPE, FUNCTIONS, IMPORTS, RULES)
    assert "when" in text
    assert "then" in text
    assert "end" in text


def test_generate_empty_rules():
    text = generate_drl_text(RULE_TYPE, FUNCTIONS, IMPORTS, [])
    assert "package com.example.test;" in text
    assert "rule" not in text


def test_generate_missing_function_emits_warning_comment():
    rules_with_missing = [
        {**RULES[0], "required_function_names": ["ghostFunc"]},
    ]
    text = generate_drl_text(RULE_TYPE, FUNCTIONS, IMPORTS, rules_with_missing)
    assert "// WARNING" in text
    assert "ghostFunc" in text


def test_generate_bundle_returns_zip():
    entries = [(RULE_TYPE, FUNCTIONS, IMPORTS, RULES)]
    zip_bytes = generate_drl_bundle(entries)
    buf = io.BytesIO(zip_bytes)
    with zipfile.ZipFile(buf) as zf:
        assert "alert_classifier.drl" in zf.namelist()


def test_generate_bundle_content():
    entries = [(RULE_TYPE, FUNCTIONS, IMPORTS, RULES)]
    zip_bytes = generate_drl_bundle(entries)
    buf = io.BytesIO(zip_bytes)
    with zipfile.ZipFile(buf) as zf:
        content = zf.read("alert_classifier.drl").decode("utf-8")
    assert "package com.example.test;" in content
    assert 'rule "AlertClassifier_1"' in content
