import pytest
from services.drl_parser import parse_drl, ParsedDRL, ParsedRule

SIMPLE_DRL = """package com.example.test;

import com.example.dto.IPPAlert;
import java.lang.String;

rule "AlertClassifier_1"
\twhen
\t\talert:IPPAlert(sourceId matches ".*LogicMonitor.*")
\tthen
\t\talert.setServiceName("event_mgmt_sw_1");
end

rule "AlertClassifier_2"
\twhen
\t\talert:IPPAlert(sourceId == "Tivoli")
\tthen
\t\talert.setServiceName("tivoli_svc");
end
"""

DRL_WITH_FUNCTION = """package com.example.test;

import com.example.dto.SomeDto;

function String extractType(String text, String rgx) {
\tif (text == null) return null;
\tPattern p = Pattern.compile(rgx);
\treturn p.matcher(text).find() ? "found" : null;
}

rule "Rule_1"
\twhen
\t\trequest:SomeDto(value == "x")
\tthen
\t\trequest.setLabel("label");
end
"""


def test_parse_returns_parsed_drl_type():
    result = parse_drl(SIMPLE_DRL)
    assert isinstance(result, ParsedDRL)


def test_parse_extracts_package():
    result = parse_drl(SIMPLE_DRL)
    assert result.package == "com.example.test"


def test_parse_extracts_imports_block():
    result = parse_drl(SIMPLE_DRL)
    assert "com.example.dto.IPPAlert" in result.imports
    assert "java.lang.String" in result.imports


def test_parse_extracts_two_rules():
    result = parse_drl(SIMPLE_DRL)
    assert len(result.rules) == 2


def test_parse_rule_names():
    result = parse_drl(SIMPLE_DRL)
    names = [r.name for r in result.rules]
    assert "AlertClassifier_1" in names
    assert "AlertClassifier_2" in names


def test_parse_rule_condition_raw():
    result = parse_drl(SIMPLE_DRL)
    rule1 = next(r for r in result.rules if r.name == "AlertClassifier_1")
    assert "LogicMonitor" in rule1.condition_raw


def test_parse_rule_action_raw():
    result = parse_drl(SIMPLE_DRL)
    rule1 = next(r for r in result.rules if r.name == "AlertClassifier_1")
    assert "event_mgmt_sw_1" in rule1.action_raw


def test_parse_extracts_functions_block():
    result = parse_drl(DRL_WITH_FUNCTION)
    assert result.functions is not None
    assert "extractType" in result.functions


def test_parse_no_functions_returns_none():
    result = parse_drl(SIMPLE_DRL)
    assert result.functions is None


def test_parse_real_alert_classifier():
    """Parse the actual alert_classifier.drl from the data/ directory."""
    with open("../data/alert_classifier.drl", encoding="utf-8") as f:
        content = f.read()
    result = parse_drl(content)
    assert result.package == "com.infy.ceh.management.autonomics.tasks.impl"
    assert len(result.rules) >= 1
    assert result.rules[0].name == "AlertServiceClassifier_1"


def test_parse_real_noise_suppression():
    with open("../data/noise_suppression.drl", encoding="utf-8") as f:
        content = f.read()
    result = parse_drl(content)
    assert len(result.rules) >= 7
    assert result.functions is not None
    assert "getDurationAfterCreatedTime" in result.functions
