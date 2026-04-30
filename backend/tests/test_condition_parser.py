"""Unit tests for drl_condition_parser + round-trip with renderer."""
import pytest
from services.drl_condition_parser import parse_condition
from services.drl_condition_renderer import render_condition, normalize_condition

NS_CONFIG = {
    "binding": {"style": "alias", "alias": "request", "fact_type": "NoiseSuppressionRequest"},
    "field_path_prefix": ["groupedAlert"],
    "fields": [],
    "helper_functions": [],
    "allow_groups": True,
}

NS_KEY = "noise_suppression.v1"

# Fixture conditions from data/noise_suppression.drl
NS_FIXTURES = [
    'request:NoiseSuppressionRequest(groupedAlert.sourceId == "LogicMonitor" && groupedAlert.alertName matches "(?:.*CPU Core - High CPU Utilization)")',
    'request:NoiseSuppressionRequest(groupedAlert.sourceId == "LogicMonitor" && (groupedAlert.severity == "MAJOR" || groupedAlert.severity == "WARN") && getDurationAfterCreatedTime(groupedAlert)<10)',
    'request:NoiseSuppressionRequest(groupedAlert.sourceId == "LogicMonitor" && (groupedAlert.severity == "MAJOR" || groupedAlert.severity == "WARN") && getDurationAfterCreatedTime(groupedAlert)>=10)',
    'request:NoiseSuppressionRequest(groupedAlert.sourceId == "LogicMonitor" && groupedAlert.alertName matches "(?:.*Ping PingLossPercent.*|.*The host.*is down.*)" && getDurationAfterCreatedTime(groupedAlert)<2)',
    'request:NoiseSuppressionRequest(groupedAlert.sourceId == "LogicMonitor" && groupedAlert.alertName matches "(?:.*Ping PingLossPercent.*|.*The host.*is down.*)" && getDurationAfterCreatedTime(groupedAlert)>=2)',
    'request:NoiseSuppressionRequest(groupedAlert.sourceId == "LogicMonitor" && groupedAlert.alertName matches "(?:.*Oracle Connection Status.*listenerStatusCode.*)")',
    'request:NoiseSuppressionRequest(groupedAlert.sourceId == "LogicMonitor" && groupedAlert.alertName matches "(?:.*Cohesity_DataPlatform_Alerts.*)")',
]


def test_simple_parse():
    raw = 'request:NoiseSuppressionRequest(groupedAlert.sourceId == "LogicMonitor")'
    meta, confidence = parse_condition(raw, NS_CONFIG, NS_KEY)
    assert confidence == 1.0
    assert meta["mode"] == "builder"
    assert meta["bindings"][0]["alias"] == "request"
    expr = meta["expression"]
    assert expr["kind"] == "cmp"
    assert expr["op"] == "=="
    assert expr["left"] == {"path": ["sourceId"]}
    assert expr["right"] == {"kind": "string", "value": "LogicMonitor"}


def test_matches_operator():
    raw = 'request:NoiseSuppressionRequest(groupedAlert.alertName matches "(?:.*CPU.*)")'
    meta, confidence = parse_condition(raw, NS_CONFIG, NS_KEY)
    assert confidence == 1.0
    expr = meta["expression"]
    assert expr["op"] == "matches"
    assert expr["right"]["kind"] == "regex"


def test_and_group():
    raw = 'request:NoiseSuppressionRequest(groupedAlert.sourceId == "LM" && groupedAlert.severity == "MAJOR")'
    meta, confidence = parse_condition(raw, NS_CONFIG, NS_KEY)
    assert confidence == 1.0
    expr = meta["expression"]
    assert expr["kind"] == "group"
    assert expr["combinator"] == "and"
    assert len(expr["children"]) == 2


def test_nested_or():
    raw = 'request:NoiseSuppressionRequest(groupedAlert.sourceId == "LM" && (groupedAlert.severity == "MAJOR" || groupedAlert.severity == "WARN"))'
    meta, confidence = parse_condition(raw, NS_CONFIG, NS_KEY)
    assert confidence == 1.0
    children = meta["expression"]["children"]
    assert len(children) == 2
    or_group = children[1]
    assert or_group["kind"] == "group"
    assert or_group["combinator"] == "or"


def test_fn_call_binding_arg():
    raw = 'request:NoiseSuppressionRequest(getDurationAfterCreatedTime(groupedAlert)<10)'
    meta, confidence = parse_condition(raw, NS_CONFIG, NS_KEY)
    assert confidence == 1.0
    expr = meta["expression"]
    assert expr["kind"] == "cmp"
    assert expr["op"] == "<"
    fn = expr["left"]
    assert fn["name"] == "getDurationAfterCreatedTime"
    assert fn["args"] == [{"kind": "binding"}]
    assert expr["right"] == {"kind": "number", "value": "10"}


def test_no_binding_returns_partial():
    raw = 'sourceId == "LM"'
    meta, confidence = parse_condition(raw, NS_CONFIG, NS_KEY)
    assert confidence == 0.0
    assert meta["expression"]["kind"] == "raw"


@pytest.mark.parametrize("condition_raw", NS_FIXTURES)
def test_round_trip(condition_raw):
    """Parse then render should reproduce the original condition (after normalization)."""
    meta, confidence = parse_condition(condition_raw, NS_CONFIG, NS_KEY)
    assert confidence >= 0.5, f"Low confidence for: {condition_raw!r}"
    rendered = render_condition(meta, NS_CONFIG)
    assert normalize_condition(rendered) == normalize_condition(condition_raw), (
        f"Round-trip failed.\n  original: {condition_raw!r}\n  rendered: {rendered!r}"
    )
