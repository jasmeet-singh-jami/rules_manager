import pytest
from services.drl_parser import parse_drl, ParsedDRL, ParsedRule, ParsedFunction, ParsedImport

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
import java.util.regex.Pattern;

function String extractType(String text, String rgx) {
\tif (text == null) return null;
\tPattern p = Pattern.compile(rgx);
\treturn p.matcher(text).find() ? "found" : null;
}

function String helper(String x) {
\treturn extractType(x, ".*");
}

rule "Rule_1"
\twhen
\t\trequest:SomeDto(value == "x")
\tthen
\t\tString t = extractType(request.getLabel(), "a.*");
\t\trequest.setLabel(t);
end
"""

DRL_WITH_GLOBALS = """package com.example.test;

import com.example.dto.Foo;
global java.util.HashMap myMap;

rule "R1"
\twhen
\t\tf:Foo()
\tthen
\t\tmyMap.put("k", f);
end
"""


def test_parse_returns_parsed_drl_type():
    result = parse_drl(SIMPLE_DRL)
    assert isinstance(result, ParsedDRL)


def test_parse_extracts_package():
    result = parse_drl(SIMPLE_DRL)
    assert result.package == "com.example.test"


def test_parse_imports_is_list_of_parsed_import():
    result = parse_drl(SIMPLE_DRL)
    assert isinstance(result.imports, list)
    assert all(isinstance(i, ParsedImport) for i in result.imports)


def test_parse_extracts_import_statements():
    result = parse_drl(SIMPLE_DRL)
    stmts = [i.statement for i in result.imports]
    assert "import com.example.dto.IPPAlert;" in stmts
    assert "import java.lang.String;" in stmts


def test_parse_import_kinds():
    result = parse_drl(DRL_WITH_GLOBALS)
    kinds = {i.statement: i.kind for i in result.imports}
    assert kinds["import com.example.dto.Foo;"] == "import"
    assert kinds["global java.util.HashMap myMap;"] == "global"


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


def test_parse_functions_is_list():
    result = parse_drl(DRL_WITH_FUNCTION)
    assert isinstance(result.functions, list)


def test_parse_extracts_function_names():
    result = parse_drl(DRL_WITH_FUNCTION)
    names = [f.name for f in result.functions]
    assert "extractType" in names
    assert "helper" in names


def test_parse_no_functions_returns_empty_list():
    result = parse_drl(SIMPLE_DRL)
    assert result.functions == []


def test_parse_rule_required_function_names_detected():
    result = parse_drl(DRL_WITH_FUNCTION)
    rule = next(r for r in result.rules if r.name == "Rule_1")
    assert "extractType" in rule.required_function_names


def test_parse_rule_does_not_get_unrelated_function():
    result = parse_drl(DRL_WITH_FUNCTION)
    rule = next(r for r in result.rules if r.name == "Rule_1")
    # Rule_1 calls extractType but not helper directly
    assert "helper" not in rule.required_function_names


def test_parse_rule_required_import_statements():
    result = parse_drl(DRL_WITH_FUNCTION)
    rule = next(r for r in result.rules if r.name == "Rule_1")
    # SomeDto appears directly in the condition text
    assert "import com.example.dto.SomeDto;" in rule.required_import_statements


def test_parse_globals_not_in_rule_required_imports():
    result = parse_drl(DRL_WITH_GLOBALS)
    rule = result.rules[0]
    # globals are is_shared, not tracked per rule
    assert not any("global" in s for s in rule.required_import_statements)


def test_parse_real_issue_correlation():
    with open("../data/issue_correlation.drl", encoding="utf-8") as f:
        content = f.read()
    result = parse_drl(content)
    func_names = [f.name for f in result.functions]
    assert "extractPort" in func_names
    assert "getLmdIds" in func_names

    rule_0 = next(r for r in result.rules if "Default correlation LMD" in r.name)
    assert "getLmdIds" in rule_0.required_function_names
    assert "getPortFromAlertName" not in rule_0.required_function_names

    rule_6 = next(r for r in result.rules if r.name == "AlertsCorrelation_default_6 :")
    assert "getPortFromAlertName" in rule_6.required_function_names
    assert "getLmdIds" not in rule_6.required_function_names
