import pytest
import zipfile
import io
from services.drl_generator import generate_drl_text, generate_drl_bundle


RULE_TYPE = {
    "slug": "alert_classifier",
    "drl_package": "com.example.test",
    "drl_imports": "import com.example.dto.IPPAlert;\nimport java.lang.String;",
    "drl_functions": None,
}

RULES = [
    {
        "name": "AlertClassifier_1",
        "condition_raw": 'alert:IPPAlert(sourceId == "LM")',
        "action_raw": 'alert.setServiceName("svc1");',
    },
    {
        "name": "AlertClassifier_2",
        "condition_raw": 'alert:IPPAlert(sourceId == "Tivoli")',
        "action_raw": 'alert.setServiceName("svc2");',
    },
]


def test_generate_drl_text_contains_package():
    text = generate_drl_text(RULE_TYPE, RULES)
    assert "package com.example.test;" in text


def test_generate_drl_text_contains_imports():
    text = generate_drl_text(RULE_TYPE, RULES)
    assert "import com.example.dto.IPPAlert;" in text


def test_generate_drl_text_contains_both_rules():
    text = generate_drl_text(RULE_TYPE, RULES)
    assert 'rule "AlertClassifier_1"' in text
    assert 'rule "AlertClassifier_2"' in text


def test_generate_drl_text_structure():
    text = generate_drl_text(RULE_TYPE, RULES)
    assert "when" in text
    assert "then" in text
    assert "end" in text


def test_generate_drl_text_with_functions():
    rt_with_fn = {**RULE_TYPE, "drl_functions": "function String helper() { return null; }"}
    text = generate_drl_text(rt_with_fn, RULES)
    assert "function String helper()" in text


def test_generate_drl_text_empty_rules_still_valid():
    text = generate_drl_text(RULE_TYPE, [])
    assert "package com.example.test;" in text
    assert "rule" not in text


def test_generate_bundle_returns_zip_bytes():
    rule_type_rules = [
        (RULE_TYPE, RULES),
    ]
    zip_bytes = generate_drl_bundle(rule_type_rules)
    buf = io.BytesIO(zip_bytes)
    with zipfile.ZipFile(buf) as zf:
        assert "alert_classifier.drl" in zf.namelist()


def test_generate_bundle_contains_valid_drl_content():
    rule_type_rules = [(RULE_TYPE, RULES)]
    zip_bytes = generate_drl_bundle(rule_type_rules)
    buf = io.BytesIO(zip_bytes)
    with zipfile.ZipFile(buf) as zf:
        content = zf.read("alert_classifier.drl").decode("utf-8")
    assert "package com.example.test;" in content
    assert 'rule "AlertClassifier_1"' in content
