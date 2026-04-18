import pytest


@pytest.mark.asyncio
async def test_list_rule_types_returns_five(client):
    response = await client.get("/api/rule-types")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 5


@pytest.mark.asyncio
async def test_rule_types_ordered_by_pipeline_stage(client):
    response = await client.get("/api/rule-types")
    stages = [rt["pipeline_stage"] for rt in response.json()]
    assert stages == sorted(stages)


@pytest.mark.asyncio
async def test_rule_type_has_expected_fields(client):
    response = await client.get("/api/rule-types")
    rt = response.json()[0]
    assert "id" in rt
    assert "slug" in rt
    assert "name" in rt
    assert "pipeline_stage" in rt
    assert "drl_package" in rt


@pytest.mark.asyncio
async def test_rule_type_has_functions_relationship(authed_client):
    rts = (await authed_client.get("/api/rule-types")).json()
    rt = next(r for r in rts if r["slug"] == "issue_correlation")
    assert "functions" in rt
    assert isinstance(rt["functions"], list)
    assert any(f["name"] == "extractPort" for f in rt["functions"])

@pytest.mark.asyncio
async def test_rule_type_has_imports_relationship(authed_client):
    rts = (await authed_client.get("/api/rule-types")).json()
    rt = next(r for r in rts if r["slug"] == "issue_correlation")
    assert "imports" in rt
    assert isinstance(rt["imports"], list)
    assert any("IPPGroupedAlerts" in i["statement"] for i in rt["imports"])
