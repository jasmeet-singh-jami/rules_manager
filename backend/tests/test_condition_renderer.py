"""Unit tests for drl_condition_renderer."""
import pytest
from services.drl_condition_renderer import render_condition, normalize_condition

NS_CONFIG = {
    "binding": {"style": "alias", "alias": "request", "fact_type": "NoiseSuppressionRequest"},
    "field_path_prefix": ["groupedAlert"],
    "fields": [],
    "helper_functions": [],
    "allow_groups": True,
}

AC_CONFIG = {
    "binding": {"style": "alias", "alias": "alert", "fact_type": "IPPAlert"},
    "field_path_prefix": [],
    "fields": [],
    "helper_functions": [],
    "allow_groups": True,
}

DOLLAR_CONFIG = {
    "binding": {"style": "dollar", "var": "incidentRequest", "fact_type": "IncidentCreationRequestDto"},
    "field_path_prefix": [],
    "fields": [],
    "helper_functions": [],
    "allow_groups": True,
}


def _meta(expression, bindings=None, template_key="test.v1"):
    return {
        "schema_version": 1,
        "mode": "builder",
        "template_key": template_key,
        "bindings": bindings or NS_CONFIG["binding"] and [NS_CONFIG["binding"]],
        "expression": expression,
    }


def test_simple_equality():
    meta = _meta({
        "kind": "cmp", "op": "==",
        "left": {"path": ["sourceId"]},
        "right": {"kind": "string", "value": "LogicMonitor"},
    })
    result = render_condition(meta, NS_CONFIG)
    assert result == 'request:NoiseSuppressionRequest(groupedAlert.sourceId == "LogicMonitor")'


def test_matches_operator():
    meta = _meta({
        "kind": "cmp", "op": "matches",
        "left": {"path": ["alertName"]},
        "right": {"kind": "regex", "value": "(?:.*CPU.*)"},
    })
    result = render_condition(meta, NS_CONFIG)
    assert result == 'request:NoiseSuppressionRequest(groupedAlert.alertName matches "(?:.*CPU.*)")'


def test_and_group():
    meta = _meta({
        "kind": "group", "combinator": "and",
        "children": [
            {"kind": "cmp", "op": "==", "left": {"path": ["sourceId"]}, "right": {"kind": "string", "value": "LM"}},
            {"kind": "cmp", "op": "==", "left": {"path": ["severity"]}, "right": {"kind": "string", "value": "MAJOR"}},
        ],
    })
    result = render_condition(meta, NS_CONFIG)
    assert result == 'request:NoiseSuppressionRequest(groupedAlert.sourceId == "LM" && groupedAlert.severity == "MAJOR")'


def test_nested_or_group():
    meta = _meta({
        "kind": "group", "combinator": "and",
        "children": [
            {"kind": "cmp", "op": "==", "left": {"path": ["sourceId"]}, "right": {"kind": "string", "value": "LM"}},
            {
                "kind": "group", "combinator": "or",
                "children": [
                    {"kind": "cmp", "op": "==", "left": {"path": ["severity"]}, "right": {"kind": "string", "value": "MAJOR"}},
                    {"kind": "cmp", "op": "==", "left": {"path": ["severity"]}, "right": {"kind": "string", "value": "WARN"}},
                ],
            },
        ],
    })
    result = render_condition(meta, NS_CONFIG)
    assert result == (
        'request:NoiseSuppressionRequest(groupedAlert.sourceId == "LM"'
        ' && (groupedAlert.severity == "MAJOR" || groupedAlert.severity == "WARN"))'
    )


def test_fn_call_with_binding_arg():
    meta = _meta({
        "kind": "cmp", "op": "<",
        "left": {"name": "getDurationAfterCreatedTime", "args": [{"kind": "binding"}]},
        "right": {"kind": "number", "value": "10"},
    })
    result = render_condition(meta, NS_CONFIG)
    assert result == "request:NoiseSuppressionRequest(getDurationAfterCreatedTime(groupedAlert) < 10)"


def test_no_prefix_config():
    meta = {
        "schema_version": 1, "mode": "builder", "template_key": "alert_classifier.v1",
        "bindings": [AC_CONFIG["binding"]],
        "expression": {
            "kind": "cmp", "op": "==",
            "left": {"path": ["sourceId"]},
            "right": {"kind": "string", "value": "LM"},
        },
    }
    result = render_condition(meta, AC_CONFIG)
    assert result == 'alert:IPPAlert(sourceId == "LM")'


def test_dollar_binding():
    meta = {
        "schema_version": 1, "mode": "builder", "template_key": "incident_rules.v1",
        "bindings": [DOLLAR_CONFIG["binding"]],
        "expression": {
            "kind": "cmp", "op": "==",
            "left": {"path": ["severity"]},
            "right": {"kind": "string", "value": "CRITICAL"},
        },
    }
    result = render_condition(meta, DOLLAR_CONFIG)
    assert result == '$incidentRequest : IncidentCreationRequestDto(severity == "CRITICAL")'


def test_raw_node_passthrough():
    meta = _meta({"kind": "raw", "text": "someComplexCondition()"})
    result = render_condition(meta, NS_CONFIG)
    assert result == "request:NoiseSuppressionRequest(someComplexCondition())"


def test_normalize_condition():
    a = "groupedAlert.sourceId==\"LM\"&&groupedAlert.severity==\"MAJOR\""
    b = 'groupedAlert.sourceId == "LM" && groupedAlert.severity == "MAJOR"'
    assert normalize_condition(a) == normalize_condition(b)


def test_normalize_operator_spacing():
    assert normalize_condition("x < 10") == normalize_condition("x<10")
    assert normalize_condition("x >= 5") == normalize_condition("x>=5")
