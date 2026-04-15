import pytest
import io


SAMPLE_DRL = b"""package com.example.test;

import com.example.dto.IPPAlert;

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


@pytest.mark.asyncio
async def test_parse_returns_preview(authed_client):
    files = {"file": ("test.drl", io.BytesIO(SAMPLE_DRL), "text/plain")}
    response = await authed_client.post("/api/import/parse", files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["filename"] == "test.drl"
    assert data["rule_count"] == 2
    assert len(data["rules"]) == 2


@pytest.mark.asyncio
async def test_parse_extracts_rule_names(authed_client):
    files = {"file": ("test.drl", io.BytesIO(SAMPLE_DRL), "text/plain")}
    response = await authed_client.post("/api/import/parse", files=files)
    names = [r["name"] for r in response.json()["rules"]]
    assert "AlertTest_1" in names
    assert "AlertTest_2" in names


@pytest.mark.asyncio
async def test_parse_rejects_non_drl(authed_client):
    files = {"file": ("test.txt", io.BytesIO(b"not a drl file"), "text/plain")}
    response = await authed_client.post("/api/import/parse", files=files)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_confirm_saves_rules(authed_client):
    c = (await authed_client.post("/api/clients", json={"code": "IMP", "name": "Import Test"})).json()
    rt = next(rt for rt in (await authed_client.get("/api/rule-types")).json() if rt["slug"] == "alert_classifier")
    payload = {
        "rules": [
            {
                "client_id": c["id"],
                "rule_type_id": rt["id"],
                "name": "ImportedRule_1",
                "tool": "LogicMonitor",
                "condition_raw": "alert:IPPAlert(sourceId == \"LM\")",
                "action_raw": "alert.setServiceName(\"svc\");",
            }
        ]
    }
    response = await authed_client.post("/api/import/confirm", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["imported"] == 1
    assert len(data["rule_ids"]) == 1


@pytest.mark.asyncio
async def test_confirm_empty_list_returns_zero(authed_client):
    response = await authed_client.post("/api/import/confirm", json={"rules": []})
    assert response.status_code == 201
    assert response.json()["imported"] == 0
