import pytest
import io

SAMPLE_DRL = b"""package com.example.test;

import com.example.dto.IPPAlert;
import java.lang.String;

rule "AlertTest_1"
\twhen
\t\talert:IPPAlert(sourceId == "LM")
\tthen
\t\talert.setServiceName("svc1");
end

rule "AlertTest_2"
\twhen
\t\talert:IPPAlert(sourceId == "Tivoli")
\tthen
\t\talert.setServiceName("svc2");
end
"""

DRL_WITH_FUNC = b"""package com.example.test;

import com.example.dto.IPPAlert;
import java.util.regex.Pattern;

function String extractKind(String text) {
    Pattern p = Pattern.compile("kind:(\\\\w+)");
    return p.matcher(text).find() ? "found" : null;
}

rule "AlertFunc_1"
\twhen
\t\talert:IPPAlert(sourceId == "LM")
\tthen
\t\tString k = extractKind(alert.getDescription());
\t\talert.setServiceName(k);
end
"""


@pytest.mark.asyncio
async def test_parse_returns_preview(authed_client):
    files = {"file": ("test.drl", io.BytesIO(SAMPLE_DRL), "text/plain")}
    res = await authed_client.post("/api/import/parse", files=files)
    assert res.status_code == 200
    data = res.json()
    assert data["filename"] == "test.drl"
    assert data["rule_count"] == 2
    assert len(data["rules"]) == 2


@pytest.mark.asyncio
async def test_parse_extracts_rule_names(authed_client):
    files = {"file": ("test.drl", io.BytesIO(SAMPLE_DRL), "text/plain")}
    res = await authed_client.post("/api/import/parse", files=files)
    names = [r["name"] for r in res.json()["rules"]]
    assert "AlertTest_1" in names
    assert "AlertTest_2" in names


@pytest.mark.asyncio
async def test_parse_includes_required_import_statements(authed_client):
    files = {"file": ("test.drl", io.BytesIO(SAMPLE_DRL), "text/plain")}
    res = await authed_client.post("/api/import/parse", files=files)
    rule = next(r for r in res.json()["rules"] if r["name"] == "AlertTest_1")
    assert "required_import_statements" in rule
    assert "import com.example.dto.IPPAlert;" in rule["required_import_statements"]


@pytest.mark.asyncio
async def test_parse_detects_function_usage(authed_client):
    files = {"file": ("test_func.drl", io.BytesIO(DRL_WITH_FUNC), "text/plain")}
    res = await authed_client.post("/api/import/parse", files=files)
    rule = next(r for r in res.json()["rules"] if r["name"] == "AlertFunc_1")
    assert "extractKind" in rule["required_function_names"]


@pytest.mark.asyncio
async def test_parse_preview_includes_functions_list(authed_client):
    files = {"file": ("test_func.drl", io.BytesIO(DRL_WITH_FUNC), "text/plain")}
    res = await authed_client.post("/api/import/parse", files=files)
    data = res.json()
    assert "functions" in data
    assert any(f["name"] == "extractKind" for f in data["functions"])


@pytest.mark.asyncio
async def test_parse_rejects_non_drl(authed_client):
    files = {"file": ("test.txt", io.BytesIO(b"not a drl file"), "text/plain")}
    res = await authed_client.post("/api/import/parse", files=files)
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_confirm_saves_rules(authed_client):
    c = (await authed_client.post("/api/clients", json={"code": "IMP", "name": "Import Test"})).json()
    rt = next(rt for rt in (await authed_client.get("/api/rule-types")).json() if rt["slug"] == "alert_classifier")
    payload = {
        "rule_type_id": rt["id"],
        "functions": [],
        "imports": [],
        "rules": [
            {
                "client_id": c["id"],
                "rule_type_id": rt["id"],
                "name": "ImportedRule_1",
                "tool": "LogicMonitor",
                "condition_raw": "alert:IPPAlert(sourceId == \"LM\")",
                "action_raw": "alert.setServiceName(\"svc\");",
                "required_function_names": [],
                "required_import_statements": ["import com.example.dto.IPPAlert;"],
            }
        ],
    }
    res = await authed_client.post("/api/import/confirm", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["imported"] == 1


@pytest.mark.asyncio
async def test_confirm_upserts_function(authed_client):
    c = (await authed_client.post("/api/clients", json={"code": "IMP2", "name": "Import2"})).json()
    rt = next(rt for rt in (await authed_client.get("/api/rule-types")).json() if rt["slug"] == "alert_classifier")
    payload = {
        "rule_type_id": rt["id"],
        "functions": [{"name": "newFunc", "body": "function String newFunc() { return null; }"}],
        "imports": [],
        "rules": [
            {
                "client_id": c["id"],
                "rule_type_id": rt["id"],
                "name": "R1",
                "condition_raw": "x:Foo()",
                "action_raw": "newFunc();",
                "required_function_names": ["newFunc"],
                "required_import_statements": [],
            }
        ],
    }
    res = await authed_client.post("/api/import/confirm", json=payload)
    assert res.status_code == 201
    funcs = (await authed_client.get(f"/api/rule-types/{rt['id']}/functions")).json()
    assert any(f["name"] == "newFunc" for f in funcs)


@pytest.mark.asyncio
async def test_confirm_empty_list(authed_client):
    rts = (await authed_client.get("/api/rule-types")).json()
    rt = rts[0]
    res = await authed_client.post("/api/import/confirm", json={"rule_type_id": rt["id"], "functions": [], "imports": [], "rules": []})
    assert res.status_code == 201
    assert res.json()["imported"] == 0
