# DRL Function & Import Dependency Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace monolithic drl_functions/drl_imports blobs on RuleType with first-class DrlFunction and DrlImport records, track per-rule function/import associations, and add admin UI to view/edit them.

**Architecture:** Two new tables (DrlFunction, DrlImport) store function bodies and import statements per rule type. Rules gain JSONB columns (required_function_names, required_import_statements) populated by heuristic scanning at import time. The generator resolves transitive function dependencies at export time and emits only what each exported rule needs.

**Tech Stack:** FastAPI, SQLAlchemy async (PostgreSQL/asyncpg), Pydantic v2, React 18 + TypeScript, Vitest

---

### Task 1: Data Models + Schemas

**Files:**
- Modify: `backend/models.py`
- Modify: `backend/schemas.py`
- Test: `backend/tests/test_rule_types.py` (update existing)

- [ ] **Step 1: Write failing test for DrlFunction model**

In `backend/tests/test_rule_types.py`, add at the bottom:

```python
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
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd backend && pytest tests/test_rule_types.py::test_rule_type_has_functions_relationship -v
```
Expected: FAIL — `KeyError: 'functions'`

- [ ] **Step 3: Add DrlFunction and DrlImport to models.py**

Replace the `RuleType` class and add two new models. Full replacement:

```python
class RuleType(Base):
    __tablename__ = "rule_types"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug = Column(String(50), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    pipeline_stage = Column(Integer, nullable=False)
    drl_package = Column(String(200), nullable=False)

    rules = relationship("Rule", back_populates="rule_type")
    functions = relationship("DrlFunction", back_populates="rule_type", cascade="all, delete-orphan", lazy="selectin")
    imports = relationship("DrlImport", back_populates="rule_type", cascade="all, delete-orphan", lazy="selectin")


DrlImportKind = SAEnum("import", "global", name="drl_import_kind")


class DrlFunction(Base):
    __tablename__ = "drl_functions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rule_type_id = Column(UUID(as_uuid=True), ForeignKey("rule_types.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    body = Column(Text, nullable=False)

    rule_type = relationship("RuleType", back_populates="functions")

    __table_args__ = (UniqueConstraint("rule_type_id", "name", name="uq_drl_function_name"),)


class DrlImport(Base):
    __tablename__ = "drl_imports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rule_type_id = Column(UUID(as_uuid=True), ForeignKey("rule_types.id", ondelete="CASCADE"), nullable=False)
    statement = Column(Text, nullable=False)
    kind = Column(DrlImportKind, nullable=False, default="import")
    is_shared = Column(Boolean, default=False, nullable=False)

    rule_type = relationship("RuleType", back_populates="imports")

    __table_args__ = (UniqueConstraint("rule_type_id", "statement", name="uq_drl_import_stmt"),)
```

Also add to `Rule` (after the `window` column):
```python
    required_function_names = Column(JSONB, nullable=True)
    required_import_statements = Column(JSONB, nullable=True)
```

- [ ] **Step 4: Update schemas.py**

Replace `RuleTypeOut` and add new schemas. Full additions/replacements:

```python
# ── DRL Functions & Imports ───────────────────────────────────────────────────

class DrlFunctionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    rule_type_id: UUID
    name: str
    body: str


class DrlFunctionCreate(BaseModel):
    name: str
    body: str


class DrlFunctionUpdate(BaseModel):
    name: Optional[str] = None
    body: Optional[str] = None


class DrlImportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    rule_type_id: UUID
    statement: str
    kind: str
    is_shared: bool


class DrlImportCreate(BaseModel):
    statement: str
    kind: str = "import"
    is_shared: bool = False


class DrlImportUpdate(BaseModel):
    statement: Optional[str] = None
    kind: Optional[str] = None
    is_shared: Optional[bool] = None
```

Replace `RuleTypeOut`:
```python
class RuleTypeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    slug: str
    name: str
    pipeline_stage: int
    drl_package: str
    functions: list[DrlFunctionOut] = []
    imports: list[DrlImportOut] = []
```

Update `RuleOut` — add after `window`:
```python
    required_function_names: Optional[list[str]] = None
    required_import_statements: Optional[list[str]] = None
```

Replace `ParsedRulePreview`:
```python
class ParsedRulePreview(BaseModel):
    name: str
    condition_raw: str
    action_raw: str
    required_function_names: list[str] = []
    required_import_statements: list[str] = []
```

Add after `ParsedFilePreview`:
```python
class DrlFunctionImport(BaseModel):
    name: str
    body: str


class DrlImportImport(BaseModel):
    statement: str
    kind: str = "import"
```

Replace `ImportConfirmRule` and `ImportConfirmRequest`:
```python
class ImportConfirmRule(BaseModel):
    client_id: UUID
    rule_type_id: UUID
    name: str
    description: Optional[str] = None
    tool: Optional[str] = None
    condition_raw: str
    action_raw: str
    required_function_names: list[str] = []
    required_import_statements: list[str] = []


class ImportConfirmRequest(BaseModel):
    rule_type_id: UUID
    functions: list[DrlFunctionImport] = []
    imports: list[DrlImportImport] = []
    rules: list[ImportConfirmRule]
```

- [ ] **Step 5: Run tests**

```bash
cd backend && pytest tests/test_rule_types.py -v
```
Expected: existing tests pass after seed update (Task 2). The new tests will pass once seed is updated.

- [ ] **Step 6: Commit**

```bash
git add backend/models.py backend/schemas.py
git commit -m "feat: add DrlFunction and DrlImport models, update Rule and import schemas"
```

---

### Task 2: Update seed_data.py + conftest.py

**Files:**
- Modify: `backend/seed_data.py`
- Modify: `backend/tests/conftest.py`

- [ ] **Step 1: Update conftest.py PRESERVED_TABLES**

In `backend/tests/conftest.py`, change:
```python
PRESERVED_TABLES = {"rule_types", "users", "tokens"}
```
to:
```python
PRESERVED_TABLES = {"rule_types", "drl_functions", "drl_imports", "users", "tokens"}
```

- [ ] **Step 2: Rewrite seed_data.py**

Full replacement of `backend/seed_data.py`:

```python
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models import RuleType, DrlFunction, DrlImport, User
from security import hash_password

RULE_TYPES = [
    {
        "slug": "alert_classifier",
        "name": "Alert Classifier",
        "pipeline_stage": 1,
        "drl_package": "com.infy.ceh.management.autonomics.tasks.impl",
    },
    {
        "slug": "noise_suppression",
        "name": "Noise Suppression",
        "pipeline_stage": 2,
        "drl_package": "com.infy.ceh.management.autonomics.framework.tasks.impl",
    },
    {
        "slug": "issue_correlation",
        "name": "Issue Correlation",
        "pipeline_stage": 3,
        "drl_package": "com.infy.ceh.management.autonomics.framework.tasks.impl",
    },
    {
        "slug": "incident_rules",
        "name": "Incident Creation",
        "pipeline_stage": 4,
        "drl_package": "com.infy.ceh.management.autonomics.tasks.impl",
    },
    {
        "slug": "recommendation",
        "name": "Recommendation",
        "pipeline_stage": 5,
        "drl_package": "com.infy.ceh.management.autonomics.framework.tasks.impl",
    },
]

# (statement, kind, is_shared)
RULE_TYPE_IMPORTS = {
    "alert_classifier": [
        ("import com.infy.ceh.management.ems.dto.IPPAlert;", "import", False),
        ("import java.lang.String;", "import", False),
        ("import java.lang.Boolean;", "import", False),
    ],
    "noise_suppression": [
        ("import com.infy.ceh.management.ems.dto.NoiseSuppressionRequest;", "import", False),
        ("import com.infy.ceh.management.ems.dto.IPPGroupedAlerts;", "import", False),
        ("import java.lang.String;", "import", False),
        ("import java.lang.Boolean;", "import", False),
        ("import java.util.Arrays;", "import", False),
        ("import java.util.List;", "import", False),
        ("import java.util.regex.Matcher;", "import", False),
        ("import java.util.regex.Pattern;", "import", False),
        ("import java.time.ZonedDateTime;", "import", False),
        ("import java.time.ZoneOffset;", "import", False),
        ("import java.time.Instant;", "import", False),
        ("import java.sql.Timestamp;", "import", False),
        ("import java.time.LocalDateTime;", "import", False),
        ("import java.time.ZoneId;", "import", False),
        ("import java.time.format.DateTimeFormatter;", "import", False),
        ("import java.time.format.DateTimeFormatterBuilder;", "import", False),
        ("import java.time.temporal.ChronoField;", "import", False),
    ],
    "issue_correlation": [
        ("import com.infy.ceh.management.ems.dto.IPPGroupedAlerts;", "import", False),
        ("import java.lang.String;", "import", False),
        ("import java.util.List;", "import", False),
        ("import java.util.ArrayList;", "import", False),
        ("import java.util.HashMap;", "import", False),
        ("import java.util.HashSet;", "import", False),
        ("import java.util.Set;", "import", False),
        ("import java.util.regex.Matcher;", "import", False),
        ("import java.util.regex.Pattern;", "import", False),
        ("import java.util.Arrays;", "import", False),
        ("global java.util.HashMap clusteredAlerts;", "global", True),
        ("global Integer index;", "global", True),
    ],
    "incident_rules": [
        ("import com.infy.ceh.management.ems.dto.IPPIssue;", "import", False),
        ("import com.infy.ceh.management.ems.dto.IPPIncident;", "import", False),
        ("import com.infy.ceh.management.ems.dto.IncidentCreationRequestDto;", "import", False),
        ("import java.lang.String;", "import", False),
        ("import java.lang.Boolean;", "import", False),
        ("import java.util.List;", "import", False),
        ("import java.util.Arrays;", "import", False),
    ],
    "recommendation": [
        ("import com.infy.ceh.management.ems.dto.IPPIssue;", "import", False),
        ("import com.infy.ceh.management.ems.dto.RecommendationRequest;", "import", False),
        ("import java.lang.String;", "import", False),
        ("import java.lang.Boolean;", "import", False),
        ("import java.util.Arrays;", "import", False),
        ("import java.util.List;", "import", False),
        ("import java.util.regex.Matcher;", "import", False),
        ("import java.util.regex.Pattern;", "import", False),
    ],
}

# (name, body)
RULE_TYPE_FUNCTIONS = {
    "noise_suppression": [
        (
            "extractDeviceType",
            "function String extractDeviceType(String text,String rgx) {\n"
            "\tSystem.out.println(\"Applying REGEX\" + rgx);\n"
            "\tSystem.out.println(\"Text for REGEX\" + text);\n"
            "    if (text == null) return null;\n"
            "    Pattern p = Pattern.compile(rgx);\n"
            "    Matcher m = p.matcher(text);\n"
            "    return m.find() ? m.group() : null;\n"
            "}",
        ),
        (
            "getDurationAfterCreatedTime",
            "function int getDurationAfterCreatedTime(IPPGroupedAlerts alert){\n"
            "\t\tSystem.out.println(\"start Time groupedAlerts\" + alert.getCreatedTime());\n"
            "\t\tDateTimeFormatter fmt = new DateTimeFormatterBuilder()\n"
            "            .appendPattern(\"yyyy-MM-dd HH:mm:ss\")\n"
            "            .appendLiteral('.')\n"
            "            .appendFraction(ChronoField.NANO_OF_SECOND, 1, 9, false)\n"
            "            .toFormatter();\n"
            "        LocalDateTime ldt = LocalDateTime.parse(alert.getCreatedTime(), fmt);\n"
            "        ZonedDateTime zdt = ldt.atZone(ZoneId.of(\"UTC\"));\n"
            "        long startTimeInMillis = zdt.toInstant().toEpochMilli();\n"
            "\t\tZonedDateTime utcNow = ZonedDateTime.now(ZoneOffset.UTC);\n"
            "\t\tlong endTimeInMillis = utcNow.toInstant().toEpochMilli();\n"
            "        int interval = (int)(endTimeInMillis - startTimeInMillis)/(60*1000);\n"
            "        System.out.println(\"Interval :: \"+interval);\n"
            "        return interval;\n"
            "    }",
        ),
    ],
    "issue_correlation": [
        (
            "extractPort",
            "function String extractPort(String alertName) {\n"
            "\tPattern port_pattern =  Pattern.compile(\"Interfaces_Critical-Port\\\\s+(\\\\d+)\");\n"
            "    Matcher matcher = port_pattern.matcher(alertName);\n"
            "    return matcher.find() ? matcher.group(1) : \"NA\";\n"
            "}",
        ),
        (
            "getPortFromAlertName",
            "function java.util.Set<String> getPortFromAlertName(java.util.List alerts, String host) {\n"
            "    java.util.Set<String> portList = new java.util.HashSet<String>();\n"
            "    if (alerts == null) return portList;\n"
            "\thost=host+\" \";\n"
            "    for (Object o : alerts) {\n"
            "        IPPGroupedAlerts a = (IPPGroupedAlerts) o;\n"
            "        String alertName = a.getAlertName();\n"
            "        if (alertName.contains(host) ) {\n"
            "             String port = extractPort(a.getAlertName());\n"
            "\t\t     portList.add(port);\n"
            "        }\n"
            "    }\n"
            "    return portList;\n"
            "}",
        ),
        (
            "groupAlertsBasedonDeviceAndPort",
            "function java.util.List groupAlertsBasedonDeviceAndPort(String host,String port, java.util.List alerts) {\n"
            "    java.util.List group = new java.util.ArrayList();\n"
            "    if (alerts == null || host == null || port == null ) return group;\n"
            "\thost=host+\" \";\n"
            "\tport=\"Port \"+port+\" \";\n"
            "    for (Object o : alerts) {\n"
            "        IPPGroupedAlerts a = (IPPGroupedAlerts) o;\n"
            "        String alertName = a.getAlertName();\n"
            "        if (alertName.contains(host) && alertName.contains(port)) {\n"
            "            group.add(a);\n"
            "        }\n"
            "    }\n"
            "    return group;\n"
            "}",
        ),
        (
            "extractLmdId",
            "function String extractLmdId(String description) {\n"
            "    if (description == null) return null;\n"
            "    Pattern p = Pattern.compile(\"(?i)\\\\bID:\\\\s*(LM(?:D|S|E)\\\\d+)\\\\b\");\n"
            "    Matcher m = p.matcher(description);\n"
            "    if (m.find()) {\n"
            "        return m.group(1);\n"
            "    }\n"
            "    return null;\n"
            "}",
        ),
        (
            "getLmdIds",
            "function java.util.Set<String> getLmdIds(java.util.List alerts) {\n"
            "    java.util.Set<String> ids = new java.util.HashSet<String>();\n"
            "    if (alerts == null) return ids;\n"
            "    for (Object o : alerts) {\n"
            "        IPPGroupedAlerts a = (IPPGroupedAlerts) o;\n"
            "        String id = extractLmdId(a.getDescription());\n"
            "        if (id != null) ids.add(id);\n"
            "    }\n"
            "    return ids;\n"
            "}",
        ),
        (
            "getAlertsForLmdId",
            "function java.util.List getAlertsForLmdId(String lmdId, java.util.List alerts) {\n"
            "    java.util.List group = new java.util.ArrayList();\n"
            "    if (alerts == null || lmdId == null) return group;\n"
            "    for (Object o : alerts) {\n"
            "        IPPGroupedAlerts a = (IPPGroupedAlerts) o;\n"
            "        String id = extractLmdId(a.getDescription());\n"
            "        if (lmdId.equals(id)) {\n"
            "            group.add(a);\n"
            "        }\n"
            "    }\n"
            "    return group;\n"
            "}",
        ),
        (
            "getAffectedResources",
            "function java.util.Set<String> getAffectedResources(java.util.List alerts) {\n"
            "    java.util.Set<String> resources = new java.util.HashSet<String>();\n"
            "    if (alerts == null) return resources;\n"
            "    for (Object o : alerts) {\n"
            "        IPPGroupedAlerts a = (IPPGroupedAlerts) o;\n"
            "        if (a.getResourceId() != null) resources.add(a.getResourceId());\n"
            "    }\n"
            "    return resources;\n"
            "}",
        ),
        (
            "getAlertsforSameAffectedResource",
            "function java.util.List getAlertsforSameAffectedResource(String resource, java.util.List alerts) {\n"
            "    java.util.List group = new java.util.ArrayList();\n"
            "    if (alerts == null || resource == null) return group;\n"
            "    for (Object o : alerts) {\n"
            "        IPPGroupedAlerts a = (IPPGroupedAlerts) o;\n"
            "        String alertResource = a.getResourceId();\n"
            "        if (resource.equals(alertResource)) {\n"
            "            group.add(a);\n"
            "        }\n"
            "    }\n"
            "    return group;\n"
            "}",
        ),
        (
            "getAffectedResourcesAlertKey",
            "function java.util.Set<String> getAffectedResourcesAlertKey(java.util.List alerts){\n"
            "\tjava.util.Set<String> affectedResourceAlertKey=new java.util.HashSet<String>();\n"
            "\tfor(Object o:alerts){\n"
            "\t\tIPPGroupedAlerts grpAlert=(IPPGroupedAlerts)o;\n"
            "\t\taffectedResourceAlertKey.add(grpAlert.getResourceId()+\"MARK\"+grpAlert.getAlertName());\n"
            "\t}\n"
            "\treturn affectedResourceAlertKey;\n"
            "}",
        ),
        (
            "getAlertsForResourceAlertKey",
            "function List getAlertsForResourceAlertKey(String resourceAlertKey, java.util.List alerts){\n"
            "\tjava.util.List group = new java.util.ArrayList();\n"
            "\tString[] keys=resourceAlertKey.split(\"MARK\");\n"
            "\tString resource=keys[0];\n"
            "\tString alertName=keys[1];\n"
            "\tfor(Object o:alerts){\n"
            "\t\tIPPGroupedAlerts grpAlert=(IPPGroupedAlerts)o;\n"
            "\t\tif(grpAlert.getResourceId().equals(resource) && grpAlert.getAlertName().equals(alertName)){\n"
            "\t\t\tgroup.add(grpAlert);\n"
            "\t\t}\n"
            "\t}\n"
            "\treturn group;\n"
            "}",
        ),
        (
            "extractHostName",
            "function String extractHostName(String text,String rgx) {\n"
            "    if (text == null) return null;\n"
            "    Pattern p = Pattern.compile(rgx);\n"
            "    Matcher m = p.matcher(text);\n"
            "    return m.find() ? m.group() : null;\n"
            "}",
        ),
        (
            "getAffectedHosts",
            "function java.util.Set<String> getAffectedHosts(java.util.List alerts,String rgx) {\n"
            "    java.util.Set<String> hostNames = new java.util.HashSet<String>();\n"
            "    if (alerts == null) return hostNames;\n"
            "    for (Object o : alerts) {\n"
            "        IPPGroupedAlerts a = (IPPGroupedAlerts) o;\n"
            "        String host = extractHostName(a.getAlertName(),rgx);\n"
            "        if (host != null) hostNames.add(host.trim());\n"
            "    }\n"
            "    return hostNames;\n"
            "}",
        ),
        (
            "getAlertsforSameAffectedHosts",
            "function java.util.List getAlertsforSameAffectedHosts(String host, java.util.List alerts) {\n"
            "    java.util.List group = new java.util.ArrayList();\n"
            "    if (alerts == null || host == null) return group;\n"
            "    for (Object o : alerts) {\n"
            "        IPPGroupedAlerts a = (IPPGroupedAlerts) o;\n"
            "        String alertName = a.getAlertName();\n"
            "        if (alertName.contains(host)) {\n"
            "            group.add(a);\n"
            "        }\n"
            "    }\n"
            "    return group;\n"
            "}",
        ),
        (
            "groupAlertsBasedonHostAndIntrfaces",
            "function java.util.List groupAlertsBasedonHostAndIntrfaces(String iname, String host, java.util.List alerts) {\n"
            "    java.util.List group = new java.util.ArrayList();\n"
            "    if (alerts == null || host == null || iname == null ) return group;\n"
            "    for (Object o : alerts) {\n"
            "        IPPGroupedAlerts a = (IPPGroupedAlerts) o;\n"
            "        String alertName = a.getAlertName();\n"
            "        if (alertName.contains(host) && alertName.contains(iname)) {\n"
            "            group.add(a);\n"
            "        }\n"
            "    }\n"
            "    return group;\n"
            "}",
        ),
        (
            "extractDeviceType",
            "function String extractDeviceType(String text,String rgx) {\n"
            "\tSystem.out.println(\"Applying REGEX\" + rgx);\n"
            "\tSystem.out.println(\"Text for REGEX\" + text);\n"
            "    if (text == null) return null;\n"
            "    Pattern p = Pattern.compile(rgx);\n"
            "    Matcher m = p.matcher(text);\n"
            "    return m.find() ? m.group() : null;\n"
            "}",
        ),
        (
            "getAlertsBasedDeviTypeAffectedResource",
            "function java.util.List getAlertsBasedDeviTypeAffectedResource(String resource, java.util.List alerts) {\n"
            "    java.util.List group = new java.util.ArrayList();\n"
            "\tList<String> nwDeviceType=Arrays.asList(\"GCC Dashboard\");\n"
            "\tString deviceTypeRegex = \"(?<=Device Type : )(.+)\";\n"
            "    if (alerts == null || resource == null) return group;\n"
            "    for (Object o : alerts) {\n"
            "        IPPGroupedAlerts a = (IPPGroupedAlerts) o;\n"
            "        String alertResource = a.getResourceId();\n"
            "\t\tString deviceType = extractDeviceType(a.getDescription(),deviceTypeRegex).trim();\n"
            "        if (resource.equals(alertResource) && nwDeviceType.contains(deviceType)) {\n"
            "            group.add(a);\n"
            "        }\n"
            "    }\n"
            "    return group;\n"
            "}",
        ),
    ],
    "incident_rules": [
        (
            "getAssignmentGroup",
            "function java.lang.String getAssignmentGroup(String name) {\n"
            "\tSystem.out.println(\"Short Decription = \" +name);\n"
            "    if (name == null) return \"ISM - EOC Monitoring\";\n"
            "\tString groupName = \"\";\n"
            "\tif(name.contains(\"MAO Order Management\")){\n"
            "\t\tgroupName = \"Asia WMS\";\n"
            "\t}else if((name.contains(\"Netskope\") || name.contains(\"NetSkope\")) && "
            "(name.contains(\"Publisher\") || name.contains(\"IPSEC Tunnel\") || name.contains(\"GRE Tunnel\"))){\n"
            "\t\tgroupName = \"ISM - Network\";\n"
            "\t}else if(name.contains(\"Netskope\") || name.contains(\"NetSkope\")){\n"
            "\t\tgroupName = \"ISM - Security Netskope\";\n"
            "\t}else{\n"
            "\t\tgroupName = \"ISM - EOC Monitoring\";\n"
            "\t}\n"
            "\tSystem.out.println(\"Assignment group for INC creation is  = \"+groupName);\n"
            "    return groupName;\n"
            "}",
        ),
    ],
    "recommendation": [
        (
            "extractDeviceType",
            "function String extractDeviceType(String text,String rgx) {\n"
            "\tSystem.out.println(\"Applying REGEX\" + rgx);\n"
            "\tSystem.out.println(\"Text for REGEX\" + text);\n"
            "    if (text == null) return null;\n"
            "    Pattern p = Pattern.compile(rgx);\n"
            "    Matcher m = p.matcher(text);\n"
            "    return m.find() ? m.group() : null;\n"
            "}",
        ),
    ],
}


async def seed_rule_types(session: AsyncSession) -> None:
    result = await session.execute(select(RuleType.slug))
    existing_slugs = {row[0] for row in result.all()}

    for rt_data in RULE_TYPES:
        if rt_data["slug"] not in existing_slugs:
            session.add(RuleType(**rt_data))

    await session.flush()

    rt_result = await session.execute(select(RuleType))
    all_rts = {rt.slug: rt for rt in rt_result.scalars().all()}

    for slug, func_list in RULE_TYPE_FUNCTIONS.items():
        rt = all_rts.get(slug)
        if not rt:
            continue
        existing_funcs = await session.execute(
            select(DrlFunction.name).where(DrlFunction.rule_type_id == rt.id)
        )
        existing_names = {row[0] for row in existing_funcs.all()}
        for name, body in func_list:
            if name not in existing_names:
                session.add(DrlFunction(rule_type_id=rt.id, name=name, body=body))

    for slug, import_list in RULE_TYPE_IMPORTS.items():
        rt = all_rts.get(slug)
        if not rt:
            continue
        existing_imps = await session.execute(
            select(DrlImport.statement).where(DrlImport.rule_type_id == rt.id)
        )
        existing_stmts = {row[0] for row in existing_imps.all()}
        for stmt, kind, is_shared in import_list:
            if stmt not in existing_stmts:
                session.add(DrlImport(rule_type_id=rt.id, statement=stmt, kind=kind, is_shared=is_shared))


async def seed_admin_user(session: AsyncSession) -> None:
    result = await session.execute(select(User).where(User.username == "admin"))
    if result.scalar_one_or_none() is None:
        session.add(User(
            username="admin",
            password_hash=hash_password("admin"),
            role="admin",
            must_change_password=True,
        ))
```

- [ ] **Step 3: Run tests**

```bash
cd backend && pytest tests/test_rule_types.py -v
```
Expected: all pass including new function/import tests.

- [ ] **Step 4: Run full suite to check for regressions**

```bash
cd backend && pytest -x -v
```
Expected: failures only in test_drl_parser and test_drl_generator (addressed next). Fix any unexpected failures before continuing.

- [ ] **Step 5: Commit**

```bash
git add backend/seed_data.py backend/tests/conftest.py
git commit -m "feat: seed DrlFunction and DrlImport rows; preserve in test cleanup"
```

---

### Task 3: Update drl_parser.py + Tests

**Files:**
- Modify: `backend/services/drl_parser.py`
- Modify: `backend/tests/test_drl_parser.py`

- [ ] **Step 1: Write failing tests for new parser output**

Replace all content of `backend/tests/test_drl_parser.py`:

```python
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
    # extractType uses Pattern which comes from java.util.regex.Pattern
    assert "import java.util.regex.Pattern;" in rule.required_import_statements


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
```

- [ ] **Step 2: Run to confirm failures**

```bash
cd backend && pytest tests/test_drl_parser.py -v 2>&1 | head -40
```
Expected: FAIL — `ImportError: cannot import name 'ParsedFunction'`

- [ ] **Step 3: Rewrite drl_parser.py**

Full replacement of `backend/services/drl_parser.py`:

```python
import re
from dataclasses import dataclass, field


@dataclass
class ParsedFunction:
    name: str
    body: str


@dataclass
class ParsedImport:
    statement: str
    kind: str  # 'import' or 'global'


@dataclass
class ParsedRule:
    name: str
    condition_raw: str
    action_raw: str
    required_function_names: list[str] = field(default_factory=list)
    required_import_statements: list[str] = field(default_factory=list)


@dataclass
class ParsedDRL:
    package: str
    imports: list[ParsedImport] = field(default_factory=list)
    functions: list[ParsedFunction] = field(default_factory=list)
    rules: list[ParsedRule] = field(default_factory=list)


def _extract_package(text: str) -> str:
    match = re.search(r"^\s*package\s+([\w.]+)\s*;?", text, re.MULTILINE)
    return match.group(1) if match else ""


def _extract_imports(text: str) -> list[ParsedImport]:
    result = []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("import "):
            result.append(ParsedImport(statement=stripped, kind="import"))
        elif stripped.startswith("global "):
            result.append(ParsedImport(statement=stripped, kind="global"))
    return result


def _find_block_end(text: str, start: int) -> int:
    depth = 0
    i = start
    while i < len(text):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return len(text) - 1


def _extract_functions(text: str) -> list[ParsedFunction]:
    first_rule = re.search(r"^\s*rule\s+", text, re.MULTILINE)
    search_area = text[: first_rule.start()] if first_rule else text

    func_pattern = re.compile(r"\bfunction\b[^{]+\{", re.MULTILINE)
    name_pattern = re.compile(r"\bfunction\b[^(]+\b(\w+)\s*\(")
    result = []
    for m in func_pattern.finditer(search_area):
        brace_start = m.end() - 1
        brace_end = _find_block_end(search_area, brace_start)
        block = search_area[m.start(): brace_end + 1].strip()
        nm = name_pattern.search(block)
        name = nm.group(1) if nm else "unknown"
        result.append(ParsedFunction(name=name, body=block))
    return result


def _detect_rule_function_names(condition_raw: str, action_raw: str, local_names: set[str]) -> list[str]:
    tokens = set(re.findall(r"\b\w+\b", condition_raw + " " + action_raw))
    return sorted(tokens & local_names)


def _detect_rule_import_statements(
    condition_raw: str, action_raw: str, parsed_imports: list[ParsedImport]
) -> list[str]:
    rule_text = condition_raw + " " + action_raw
    matched = []
    for imp in parsed_imports:
        if imp.kind == "global":
            continue
        simple = imp.statement.rstrip(";").split(".")[-1]
        if simple and re.search(r"\b" + re.escape(simple) + r"\b", rule_text):
            matched.append(imp.statement)
    return matched


def _extract_rules(
    text: str,
    local_func_names: set[str],
    parsed_imports: list[ParsedImport],
) -> list[ParsedRule]:
    rules = []
    rule_pattern = re.compile(
        r'rule\s+"([^"]+)"\s*(.*?)when(.*?)then(.*?)end',
        re.DOTALL,
    )
    for m in rule_pattern.finditer(text):
        name = m.group(1).strip()
        condition_raw = m.group(3).strip()
        action_raw = m.group(4).strip()
        required_function_names = _detect_rule_function_names(condition_raw, action_raw, local_func_names)
        required_import_statements = _detect_rule_import_statements(condition_raw, action_raw, parsed_imports)
        rules.append(ParsedRule(
            name=name,
            condition_raw=condition_raw,
            action_raw=action_raw,
            required_function_names=required_function_names,
            required_import_statements=required_import_statements,
        ))
    return rules


def parse_drl(text: str) -> ParsedDRL:
    package = _extract_package(text)
    imports = _extract_imports(text)
    functions = _extract_functions(text)
    local_func_names = {f.name for f in functions}
    rules = _extract_rules(text, local_func_names, imports)
    return ParsedDRL(package=package, imports=imports, functions=functions, rules=rules)
```

- [ ] **Step 4: Run parser tests**

```bash
cd backend && pytest tests/test_drl_parser.py -v
```
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend/services/drl_parser.py backend/tests/test_drl_parser.py
git commit -m "feat: update drl_parser to return structured functions/imports with per-rule heuristics"
```

---

### Task 4: Update drl_generator.py + Tests

**Files:**
- Modify: `backend/services/drl_generator.py`
- Modify: `backend/tests/test_drl_generator.py`

- [ ] **Step 1: Write failing tests**

Replace `backend/tests/test_drl_generator.py`:

```python
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
```

- [ ] **Step 2: Run to confirm failures**

```bash
cd backend && pytest tests/test_drl_generator.py -v 2>&1 | head -20
```
Expected: FAIL — signature mismatch.

- [ ] **Step 3: Rewrite drl_generator.py**

Full replacement of `backend/services/drl_generator.py`:

```python
import io
import re
import zipfile
from typing import Any


def _resolve_transitive_functions(needed: set[str], funcs_by_name: dict[str, dict]) -> set[str]:
    resolved = set(needed)
    changed = True
    while changed:
        changed = False
        for name in list(resolved):
            if name not in funcs_by_name:
                continue
            body = funcs_by_name[name]["body"]
            for candidate in funcs_by_name:
                if candidate not in resolved and re.search(r"\b" + re.escape(candidate) + r"\s*\(", body):
                    resolved.add(candidate)
                    changed = True
    return resolved


def _simple_name(statement: str) -> str:
    return statement.rstrip(";").split(".")[-1]


def generate_drl_text(
    rule_type: dict[str, Any],
    functions: list[dict[str, Any]],
    imports: list[dict[str, Any]],
    rules: list[dict[str, Any]],
) -> str:
    lines: list[str] = []

    lines.append(f"package {rule_type['drl_package']};\n")

    funcs_by_name = {f["name"]: f for f in functions}

    # Collect function names needed (union across all rules) then resolve transitive deps
    needed_names: set[str] = set()
    for rule in rules:
        needed_names.update(rule.get("required_function_names") or [])
    needed_names = _resolve_transitive_functions(needed_names, funcs_by_name)

    # Collect import statements needed by rules
    needed_stmts: set[str] = set()
    for rule in rules:
        needed_stmts.update(rule.get("required_import_statements") or [])

    # Add imports needed by included function bodies
    non_global_imports = {_simple_name(i["statement"]): i["statement"] for i in imports if i.get("kind") != "global"}
    for fname in needed_names:
        if fname in funcs_by_name:
            body_tokens = set(re.findall(r"\b\w+\b", funcs_by_name[fname]["body"]))
            for simple, stmt in non_global_imports.items():
                if simple in body_tokens:
                    needed_stmts.add(stmt)

    # Always-include: is_shared imports
    shared_import_stmts = {i["statement"] for i in imports if i.get("is_shared") and i.get("kind") == "import"}
    all_import_stmts = shared_import_stmts | needed_stmts

    # Emit imports (sorted, deduplicated)
    for stmt in sorted(all_import_stmts):
        lines.append(stmt)
    if all_import_stmts:
        lines.append("")

    # Emit globals (always)
    globals_ = [i for i in imports if i.get("kind") == "global"]
    for g in globals_:
        lines.append(g["statement"])
    if globals_:
        lines.append("")

    # Emit functions in original declaration order, only those needed
    for f in functions:
        if f["name"] in needed_names:
            lines.append(f["body"])
            lines.append("")

    # Emit rules
    for rule in rules:
        lines.append(f'rule "{rule["name"]}"')
        lines.append("\twhen")
        for cond_line in rule["condition_raw"].splitlines():
            lines.append(f"\t\t{cond_line}")
        lines.append("\tthen")
        for act_line in rule["action_raw"].splitlines():
            lines.append(f"\t\t{act_line}")
        lines.append("end")
        lines.append("")

    return "\n".join(lines)


def generate_drl_bundle(entries: list[tuple[dict, list[dict], list[dict], list[dict]]]) -> bytes:
    """
    Args:
        entries: list of (rule_type, functions, imports, rules) tuples
    """
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        for rule_type, functions, imports, rules in entries:
            filename = f"{rule_type['slug']}.drl"
            content = generate_drl_text(rule_type, functions, imports, rules)
            zf.writestr(filename, content)
    return buf.getvalue()
```

- [ ] **Step 4: Run generator tests**

```bash
cd backend && pytest tests/test_drl_generator.py -v
```
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend/services/drl_generator.py backend/tests/test_drl_generator.py
git commit -m "feat: update drl_generator to use structured functions/imports with transitive dep resolution"
```

---

### Task 5: New Functions Router + main.py Registration + Tests

**Files:**
- Create: `backend/routers/functions.py`
- Modify: `backend/main.py`
- Create: `backend/tests/test_functions.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_functions.py`:

```python
import pytest


@pytest.mark.asyncio
async def test_list_functions_for_rule_type(authed_client):
    rts = (await authed_client.get("/api/rule-types")).json()
    rt = next(r for r in rts if r["slug"] == "issue_correlation")
    res = await authed_client.get(f"/api/rule-types/{rt['id']}/functions")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert any(f["name"] == "extractPort" for f in data)


@pytest.mark.asyncio
async def test_list_imports_for_rule_type(authed_client):
    rts = (await authed_client.get("/api/rule-types")).json()
    rt = next(r for r in rts if r["slug"] == "issue_correlation")
    res = await authed_client.get(f"/api/rule-types/{rt['id']}/imports")
    assert res.status_code == 200
    data = res.json()
    assert any("IPPGroupedAlerts" in i["statement"] for i in data)
    assert any(i["is_shared"] is True for i in data)


@pytest.mark.asyncio
async def test_create_function(authed_client):
    rts = (await authed_client.get("/api/rule-types")).json()
    rt = next(r for r in rts if r["slug"] == "alert_classifier")
    body = {"name": "testFunc", "body": "function String testFunc() { return null; }"}
    res = await authed_client.post(f"/api/rule-types/{rt['id']}/functions", json=body)
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "testFunc"
    assert data["rule_type_id"] == rt["id"]


@pytest.mark.asyncio
async def test_update_function(authed_client):
    rts = (await authed_client.get("/api/rule-types")).json()
    rt = next(r for r in rts if r["slug"] == "alert_classifier")
    created = (await authed_client.post(
        f"/api/rule-types/{rt['id']}/functions",
        json={"name": "editMe", "body": "function String editMe() { return \"old\"; }"}
    )).json()
    res = await authed_client.put(
        f"/api/rule-types/{rt['id']}/functions/{created['id']}",
        json={"body": "function String editMe() { return \"new\"; }"}
    )
    assert res.status_code == 200
    assert "new" in res.json()["body"]


@pytest.mark.asyncio
async def test_delete_function(authed_client):
    rts = (await authed_client.get("/api/rule-types")).json()
    rt = next(r for r in rts if r["slug"] == "alert_classifier")
    created = (await authed_client.post(
        f"/api/rule-types/{rt['id']}/functions",
        json={"name": "delMe", "body": "function String delMe() { return null; }"}
    )).json()
    res = await authed_client.delete(f"/api/rule-types/{rt['id']}/functions/{created['id']}")
    assert res.status_code == 204


@pytest.mark.asyncio
async def test_create_import(authed_client):
    rts = (await authed_client.get("/api/rule-types")).json()
    rt = next(r for r in rts if r["slug"] == "alert_classifier")
    body = {"statement": "import com.example.NewClass;", "kind": "import", "is_shared": False}
    res = await authed_client.post(f"/api/rule-types/{rt['id']}/imports", json=body)
    assert res.status_code == 201
    assert res.json()["statement"] == "import com.example.NewClass;"


@pytest.mark.asyncio
async def test_update_import_is_shared(authed_client):
    rts = (await authed_client.get("/api/rule-types")).json()
    rt = next(r for r in rts if r["slug"] == "alert_classifier")
    created = (await authed_client.post(
        f"/api/rule-types/{rt['id']}/imports",
        json={"statement": "import com.example.Toggleable;", "kind": "import", "is_shared": False}
    )).json()
    res = await authed_client.put(
        f"/api/rule-types/{rt['id']}/imports/{created['id']}",
        json={"is_shared": True}
    )
    assert res.status_code == 200
    assert res.json()["is_shared"] is True


@pytest.mark.asyncio
async def test_delete_import(authed_client):
    rts = (await authed_client.get("/api/rule-types")).json()
    rt = next(r for r in rts if r["slug"] == "alert_classifier")
    created = (await authed_client.post(
        f"/api/rule-types/{rt['id']}/imports",
        json={"statement": "import com.example.DeleteMe;", "kind": "import", "is_shared": False}
    )).json()
    res = await authed_client.delete(f"/api/rule-types/{rt['id']}/imports/{created['id']}")
    assert res.status_code == 204


@pytest.mark.asyncio
async def test_list_functions_unknown_rule_type(authed_client):
    import uuid
    res = await authed_client.get(f"/api/rule-types/{uuid.uuid4()}/functions")
    assert res.status_code == 404
```

- [ ] **Step 2: Run to confirm failures**

```bash
cd backend && pytest tests/test_functions.py::test_list_functions_for_rule_type -v
```
Expected: FAIL — 404 (route not registered).

- [ ] **Step 3: Create routers/functions.py**

Create `backend/routers/functions.py`:

```python
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import DrlFunction, DrlImport, RuleType, User
from schemas import (
    DrlFunctionOut, DrlFunctionCreate, DrlFunctionUpdate,
    DrlImportOut, DrlImportCreate, DrlImportUpdate,
)
from auth_deps import get_current_user, require_admin

router = APIRouter(tags=["functions"])


async def _get_rt_or_404(rule_type_id: UUID, db: AsyncSession) -> RuleType:
    result = await db.execute(select(RuleType).where(RuleType.id == rule_type_id))
    rt = result.scalar_one_or_none()
    if not rt:
        raise HTTPException(status_code=404, detail="Rule type not found")
    return rt


@router.get("/rule-types/{rule_type_id}/functions", response_model=list[DrlFunctionOut])
async def list_functions(
    rule_type_id: UUID,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_rt_or_404(rule_type_id, db)
    result = await db.execute(select(DrlFunction).where(DrlFunction.rule_type_id == rule_type_id))
    return result.scalars().all()


@router.post("/rule-types/{rule_type_id}/functions", response_model=DrlFunctionOut, status_code=status.HTTP_201_CREATED)
async def create_function(
    rule_type_id: UUID,
    body: DrlFunctionCreate,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    await _get_rt_or_404(rule_type_id, db)
    func = DrlFunction(rule_type_id=rule_type_id, name=body.name, body=body.body)
    db.add(func)
    await db.commit()
    await db.refresh(func)
    return func


@router.put("/rule-types/{rule_type_id}/functions/{function_id}", response_model=DrlFunctionOut)
async def update_function(
    rule_type_id: UUID,
    function_id: UUID,
    body: DrlFunctionUpdate,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DrlFunction).where(DrlFunction.id == function_id, DrlFunction.rule_type_id == rule_type_id)
    )
    func = result.scalar_one_or_none()
    if not func:
        raise HTTPException(status_code=404, detail="Function not found")
    if body.name is not None:
        func.name = body.name
    if body.body is not None:
        func.body = body.body
    await db.commit()
    await db.refresh(func)
    return func


@router.delete("/rule-types/{rule_type_id}/functions/{function_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_function(
    rule_type_id: UUID,
    function_id: UUID,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DrlFunction).where(DrlFunction.id == function_id, DrlFunction.rule_type_id == rule_type_id)
    )
    func = result.scalar_one_or_none()
    if not func:
        raise HTTPException(status_code=404, detail="Function not found")
    await db.delete(func)
    await db.commit()


@router.get("/rule-types/{rule_type_id}/imports", response_model=list[DrlImportOut])
async def list_imports(
    rule_type_id: UUID,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_rt_or_404(rule_type_id, db)
    result = await db.execute(select(DrlImport).where(DrlImport.rule_type_id == rule_type_id))
    return result.scalars().all()


@router.post("/rule-types/{rule_type_id}/imports", response_model=DrlImportOut, status_code=status.HTTP_201_CREATED)
async def create_import(
    rule_type_id: UUID,
    body: DrlImportCreate,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    await _get_rt_or_404(rule_type_id, db)
    imp = DrlImport(rule_type_id=rule_type_id, statement=body.statement, kind=body.kind, is_shared=body.is_shared)
    db.add(imp)
    await db.commit()
    await db.refresh(imp)
    return imp


@router.put("/rule-types/{rule_type_id}/imports/{import_id}", response_model=DrlImportOut)
async def update_import(
    rule_type_id: UUID,
    import_id: UUID,
    body: DrlImportUpdate,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DrlImport).where(DrlImport.id == import_id, DrlImport.rule_type_id == rule_type_id)
    )
    imp = result.scalar_one_or_none()
    if not imp:
        raise HTTPException(status_code=404, detail="Import not found")
    if body.statement is not None:
        imp.statement = body.statement
    if body.kind is not None:
        imp.kind = body.kind
    if body.is_shared is not None:
        imp.is_shared = body.is_shared
    await db.commit()
    await db.refresh(imp)
    return imp


@router.delete("/rule-types/{rule_type_id}/imports/{import_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_import(
    rule_type_id: UUID,
    import_id: UUID,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DrlImport).where(DrlImport.id == import_id, DrlImport.rule_type_id == rule_type_id)
    )
    imp = result.scalar_one_or_none()
    if not imp:
        raise HTTPException(status_code=404, detail="Import not found")
    await db.delete(imp)
    await db.commit()
```

- [ ] **Step 4: Register router in main.py**

In `backend/main.py`, change:
```python
from routers import clients, rule_types, rules, deployments, import_drl, auth, admin
```
to:
```python
from routers import clients, rule_types, rules, deployments, import_drl, auth, admin, functions
```

And add after the other `include_router` calls:
```python
app.include_router(functions.router, prefix="/api")
```

- [ ] **Step 5: Run function tests**

```bash
cd backend && pytest tests/test_functions.py -v
```
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add backend/routers/functions.py backend/main.py backend/tests/test_functions.py
git commit -m "feat: add CRUD router for DrlFunction and DrlImport"
```

---

### Task 6: Update import_drl.py + Tests

**Files:**
- Modify: `backend/routers/import_drl.py`
- Modify: `backend/tests/test_import_drl.py`

- [ ] **Step 1: Write new tests**

Replace `backend/tests/test_import_drl.py`:

```python
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
```

- [ ] **Step 2: Run to confirm failures**

```bash
cd backend && pytest tests/test_import_drl.py -v 2>&1 | head -30
```
Expected: several failures — missing `functions` key in parse response, wrong confirm payload schema.

- [ ] **Step 3: Update routers/import_drl.py**

Full replacement of `backend/routers/import_drl.py`:

```python
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import Rule, DrlFunction, DrlImport, User
from schemas import ParsedFilePreview, ParsedRulePreview, ImportConfirmRequest
from services.drl_parser import parse_drl
from auth_deps import get_current_user, check_client_access

router = APIRouter(tags=["import"])


@router.post("/import/parse", response_model=ParsedFilePreview)
async def parse_drl_file(
    file: UploadFile = File(...),
    _: User = Depends(get_current_user),
):
    if not file.filename.endswith(".drl"):
        raise HTTPException(status_code=422, detail="Only .drl files are accepted")
    content = (await file.read()).decode("utf-8", errors="replace")
    parsed = parse_drl(content)
    return ParsedFilePreview(
        filename=file.filename,
        package=parsed.package,
        rule_count=len(parsed.rules),
        functions=[{"name": f.name, "body": f.body} for f in parsed.functions],
        imports=[{"statement": i.statement, "kind": i.kind} for i in parsed.imports],
        rules=[
            ParsedRulePreview(
                name=r.name,
                condition_raw=r.condition_raw,
                action_raw=r.action_raw,
                required_function_names=r.required_function_names,
                required_import_statements=r.required_import_statements,
            )
            for r in parsed.rules
        ],
    )


@router.post("/import/confirm", status_code=status.HTTP_201_CREATED)
async def confirm_import(
    body: ImportConfirmRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    checked_client_ids: set = set()
    for r in body.rules:
        if r.client_id not in checked_client_ids:
            await check_client_access(current_user, r.client_id, db)
            checked_client_ids.add(r.client_id)

    # Upsert functions
    existing_funcs = await db.execute(
        select(DrlFunction).where(DrlFunction.rule_type_id == body.rule_type_id)
    )
    func_by_name = {f.name: f for f in existing_funcs.scalars().all()}
    for f in body.functions:
        if f.name in func_by_name:
            func_by_name[f.name].body = f.body
        else:
            db.add(DrlFunction(rule_type_id=body.rule_type_id, name=f.name, body=f.body))

    # Upsert imports
    existing_imps = await db.execute(
        select(DrlImport).where(DrlImport.rule_type_id == body.rule_type_id)
    )
    existing_stmts = {i.statement for i in existing_imps.scalars().all()}
    for imp in body.imports:
        if imp.statement not in existing_stmts:
            db.add(DrlImport(rule_type_id=body.rule_type_id, statement=imp.statement, kind=imp.kind, is_shared=False))

    # Create rules
    rule_ids = []
    for r in body.rules:
        rule = Rule(
            client_id=r.client_id,
            rule_type_id=r.rule_type_id,
            name=r.name,
            description=r.description,
            tool=r.tool,
            condition_raw=r.condition_raw,
            action_raw=r.action_raw,
            required_function_names=r.required_function_names or [],
            required_import_statements=r.required_import_statements or [],
        )
        db.add(rule)
        await db.flush()
        rule_ids.append(str(rule.id))

    await db.commit()
    return {"imported": len(rule_ids), "rule_ids": rule_ids}
```

Also update `ParsedFilePreview` in `schemas.py` to include `functions` and `imports`:

```python
class ParsedFilePreview(BaseModel):
    filename: str
    package: str
    rule_count: int
    functions: list[dict] = []
    imports: list[dict] = []
    rules: list[ParsedRulePreview]
```

- [ ] **Step 4: Run import tests**

```bash
cd backend && pytest tests/test_import_drl.py -v
```
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend/routers/import_drl.py backend/schemas.py backend/tests/test_import_drl.py
git commit -m "feat: update import endpoints to upsert functions/imports and save per-rule associations"
```

---

### Task 7: Update deployments.py + rules.py Export

**Files:**
- Modify: `backend/routers/deployments.py`
- Modify: `backend/routers/rules.py`
- Modify: `backend/tests/test_deployments.py`

- [ ] **Step 1: Add a targeted test for export correctness**

In `backend/tests/test_deployments.py`, add:

```python
@pytest.mark.asyncio
async def test_export_deployment_zip_contains_drl(authed_client):
    import zipfile, io
    c = (await authed_client.post("/api/clients", json={"code": "EXP2", "name": "ExportTest2"})).json()
    rts = (await authed_client.get("/api/rule-types")).json()
    rt = next(r for r in rts if r["slug"] == "alert_classifier")
    await authed_client.post("/api/import/confirm", json={
        "rule_type_id": rt["id"],
        "functions": [],
        "imports": [],
        "rules": [{
            "client_id": c["id"], "rule_type_id": rt["id"],
            "name": "ExportRule1", "condition_raw": "x:Foo()", "action_raw": "bar();",
            "required_function_names": [], "required_import_statements": [],
        }],
    })
    dep = (await authed_client.post("/api/deployments", json={
        "client_id": c["id"], "version": "v-export-test"
    })).json()
    res = await authed_client.get(f"/api/deployments/{dep['id']}/export")
    assert res.status_code == 200
    buf = io.BytesIO(res.content)
    with zipfile.ZipFile(buf) as zf:
        assert "alert_classifier.drl" in zf.namelist()
        content = zf.read("alert_classifier.drl").decode()
    assert "ExportRule1" in content
```

- [ ] **Step 2: Run to confirm current state**

```bash
cd backend && pytest tests/test_deployments.py -v
```
Note current failures (likely from the generator signature change).

- [ ] **Step 3: Update deployments.py**

Full replacement of `backend/routers/deployments.py`:

```python
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import Deployment, DeploymentRuleSnapshot, DrlFunction, DrlImport, Rule, RuleType, Client, User
from schemas import DeploymentCreate, DeploymentOut
from services.drl_generator import generate_drl_bundle
from auth_deps import get_current_user, check_client_access

router = APIRouter(tags=["deployments"])


def _rule_to_dict(rule: Rule) -> dict:
    return {
        "id": str(rule.id),
        "rule_type_id": str(rule.rule_type_id),
        "name": rule.name,
        "description": rule.description,
        "tool": rule.tool,
        "condition_raw": rule.condition_raw,
        "action_raw": rule.action_raw,
        "condition_meta": rule.condition_meta,
        "action_meta": rule.action_meta,
        "enabled": rule.enabled,
        "priority": rule.priority,
        "window": rule.window,
        "required_function_names": rule.required_function_names or [],
        "required_import_statements": rule.required_import_statements or [],
    }


def _rt_to_dict(rt: RuleType, funcs: list, imps: list) -> dict:
    return {
        "id": str(rt.id),
        "slug": rt.slug,
        "name": rt.name,
        "pipeline_stage": rt.pipeline_stage,
        "drl_package": rt.drl_package,
        "functions": [{"name": f.name, "body": f.body} for f in funcs],
        "imports": [{"statement": i.statement, "kind": i.kind, "is_shared": i.is_shared} for i in imps],
    }


@router.get("/clients/{client_id}/deployments", response_model=list[DeploymentOut])
async def list_deployments(
    client_id: UUID,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Deployment)
        .where(Deployment.client_id == client_id)
        .order_by(Deployment.created_at.desc())
    )
    return result.scalars().all()


@router.post("/deployments", response_model=DeploymentOut, status_code=status.HTTP_201_CREATED)
async def create_deployment(
    body: DeploymentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await check_client_access(current_user, body.client_id, db)
    client_result = await db.execute(select(Client).where(Client.id == body.client_id))
    if not client_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Client not found")

    deployment = Deployment(
        client_id=body.client_id,
        version=body.version,
        notes=body.notes,
        status="draft",
    )
    db.add(deployment)
    await db.flush()

    rt_result = await db.execute(select(RuleType).order_by(RuleType.pipeline_stage))
    all_rts = rt_result.scalars().all()

    rt_map: dict[str, dict] = {}
    for rt in all_rts:
        funcs_result = await db.execute(select(DrlFunction).where(DrlFunction.rule_type_id == rt.id))
        imps_result = await db.execute(select(DrlImport).where(DrlImport.rule_type_id == rt.id))
        rt_map[str(rt.id)] = _rt_to_dict(rt, funcs_result.scalars().all(), imps_result.scalars().all())

    rules_result = await db.execute(
        select(Rule).where(Rule.client_id == body.client_id, Rule.enabled == True)
    )
    enabled_rules = rules_result.scalars().all()

    for rule in enabled_rules:
        drl_block = (
            f'rule "{rule.name}"\n'
            f"\twhen\n"
            + "\n".join(f"\t\t{line}" for line in (rule.condition_raw or "").splitlines())
            + "\n\tthen\n"
            + "\n".join(f"\t\t{line}" for line in (rule.action_raw or "").splitlines())
            + "\nend"
        )
        snapshot = DeploymentRuleSnapshot(
            deployment_id=deployment.id,
            rule_id=rule.id,
            rule_snapshot=_rule_to_dict(rule),
            drl_block=drl_block,
            rule_type_snapshot=rt_map.get(str(rule.rule_type_id)),
        )
        db.add(snapshot)

    deployment.rule_types_snapshot = sorted(rt_map.values(), key=lambda x: x["pipeline_stage"])

    await db.commit()
    await db.refresh(deployment)
    return deployment


@router.get("/deployments/{deployment_id}", response_model=DeploymentOut)
async def get_deployment(
    deployment_id: UUID,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Deployment).where(Deployment.id == deployment_id))
    dep = result.scalar_one_or_none()
    if not dep:
        raise HTTPException(status_code=404, detail="Deployment not found")
    return dep


@router.get("/deployments/{deployment_id}/export")
async def export_deployment(
    deployment_id: UUID,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    dep_result = await db.execute(select(Deployment).where(Deployment.id == deployment_id))
    dep = dep_result.scalar_one_or_none()
    if not dep:
        raise HTTPException(status_code=404, detail="Deployment not found")

    snap_result = await db.execute(
        select(DeploymentRuleSnapshot)
        .where(DeploymentRuleSnapshot.deployment_id == deployment_id)
    )
    snapshots = snap_result.scalars().all()

    rt_rules: dict[str, tuple[dict, list[dict]]] = {}
    for snap in snapshots:
        rule_dict = snap.rule_snapshot
        rt_snapshot = snap.rule_type_snapshot
        if rt_snapshot is None:
            continue
        rt_id = rt_snapshot["id"]
        if rt_id not in rt_rules:
            rt_rules[rt_id] = (rt_snapshot, [])
        rt_rules[rt_id][1].append({
            "name": rule_dict["name"],
            "condition_raw": rule_dict.get("condition_raw") or "",
            "action_raw": rule_dict.get("action_raw") or "",
            "required_function_names": rule_dict.get("required_function_names") or [],
            "required_import_statements": rule_dict.get("required_import_statements") or [],
        })

    for rt_snapshot in (dep.rule_types_snapshot or []):
        rt_id = rt_snapshot["id"]
        if rt_id not in rt_rules:
            rt_rules[rt_id] = (rt_snapshot, [])

    sorted_pairs = sorted(
        [(rt_dict, rules) for rt_dict, rules in rt_rules.values()],
        key=lambda x: x[0]["pipeline_stage"],
    )

    # Build entries for generator: (rule_type, functions, imports, rules)
    entries = [
        (rt_dict, rt_dict.get("functions", []), rt_dict.get("imports", []), rules)
        for rt_dict, rules in sorted_pairs
    ]

    zip_bytes = generate_drl_bundle(entries)
    filename = f"deployment_{dep.version}.zip"
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
```

- [ ] **Step 4: Update rules.py export_rules**

In `backend/routers/rules.py`, update the imports at top to add `DrlFunction, DrlImport`:
```python
from models import Rule, RuleType, Client, User, DrlFunction, DrlImport
```

Replace the `export_rules` function body (lines 106-160):

```python
@router.post("/rules/export")
async def export_rules(
    body: RuleExportRequest,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not body.rule_ids:
        raise HTTPException(status_code=400, detail="No rule IDs provided")

    rules_result = await db.execute(select(Rule).where(Rule.id.in_(body.rule_ids)))
    rules = rules_result.scalars().all()

    rt_id_to_rules: dict[str, list[Rule]] = {}
    for rule in rules:
        rt_id_to_rules.setdefault(str(rule.rule_type_id), []).append(rule)

    rt_result = await db.execute(
        select(RuleType)
        .where(RuleType.id.in_([r.rule_type_id for r in rules]))
        .order_by(RuleType.pipeline_stage)
    )
    rule_types = rt_result.scalars().all()

    entries: list[tuple[dict, list[dict], list[dict], list[dict]]] = []
    for rt in rule_types:
        funcs_result = await db.execute(select(DrlFunction).where(DrlFunction.rule_type_id == rt.id))
        imps_result = await db.execute(select(DrlImport).where(DrlImport.rule_type_id == rt.id))
        funcs = [{"name": f.name, "body": f.body} for f in funcs_result.scalars().all()]
        imps = [{"statement": i.statement, "kind": i.kind, "is_shared": i.is_shared} for i in imps_result.scalars().all()]
        rt_dict = {
            "id": str(rt.id),
            "slug": rt.slug,
            "drl_package": rt.drl_package,
            "pipeline_stage": rt.pipeline_stage,
        }
        rule_dicts = [
            {
                "name": r.name,
                "condition_raw": r.condition_raw or "",
                "action_raw": r.action_raw or "",
                "required_function_names": r.required_function_names or [],
                "required_import_statements": r.required_import_statements or [],
            }
            for r in rt_id_to_rules.get(str(rt.id), [])
        ]
        entries.append((rt_dict, funcs, imps, rule_dicts))

    zip_bytes = generate_drl_bundle(entries)
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="rules_export.zip"'},
    )
```

- [ ] **Step 5: Run deployment tests**

```bash
cd backend && pytest tests/test_deployments.py -v
```
Expected: all pass.

- [ ] **Step 6: Run full backend test suite**

```bash
cd backend && pytest -v
```
Expected: all pass. Fix any remaining failures before continuing.

- [ ] **Step 7: Commit**

```bash
git add backend/routers/deployments.py backend/routers/rules.py backend/tests/test_deployments.py
git commit -m "feat: update deployment and rule export to use new generator signature with per-rule functions/imports"
```

---

### Task 8: Frontend API Types + Calls

**Files:**
- Modify: `frontend/src/api/client.ts`

- [ ] **Step 1: Update client.ts**

Replace the type definitions and add new API calls. Full changes:

Replace `RuleType` interface:
```typescript
export interface DrlFunction {
  id: string
  rule_type_id: string
  name: string
  body: string
}

export interface DrlImport {
  id: string
  rule_type_id: string
  statement: string
  kind: 'import' | 'global'
  is_shared: boolean
}

export interface RuleType {
  id: string
  slug: string
  name: string
  pipeline_stage: number
  drl_package: string
  functions: DrlFunction[]
  imports: DrlImport[]
}
```

Update `Rule` interface — add after `window`:
```typescript
  required_function_names: string[] | null
  required_import_statements: string[] | null
```

Update `ParsedRulePreview`:
```typescript
export interface ParsedRulePreview {
  name: string
  condition_raw: string
  action_raw: string
  required_function_names: string[]
  required_import_statements: string[]
}

export interface ParsedFilePreview {
  filename: string
  package: string
  rule_count: number
  functions: { name: string; body: string }[]
  imports: { statement: string; kind: string }[]
  rules: ParsedRulePreview[]
}
```

Update `ImportConfirmRule` and add `ImportConfirmRequest`:
```typescript
export interface ImportConfirmRule {
  client_id: string
  rule_type_id: string
  name: string
  description?: string
  tool?: string
  condition_raw: string
  action_raw: string
  required_function_names: string[]
  required_import_statements: string[]
}

export interface ImportConfirmPayload {
  rule_type_id: string
  functions: { name: string; body: string }[]
  imports: { statement: string; kind: string }[]
  rules: ImportConfirmRule[]
}
```

Add new API functions after `getRuleTypes`:
```typescript
export const getRuleFunctions = (ruleTypeId: string) =>
  request<DrlFunction[]>(`/rule-types/${ruleTypeId}/functions`)

export const createRuleFunction = (ruleTypeId: string, body: { name: string; body: string }) =>
  request<DrlFunction>(`/rule-types/${ruleTypeId}/functions`, { method: 'POST', body: JSON.stringify(body) })

export const updateRuleFunction = (ruleTypeId: string, funcId: string, body: { name?: string; body?: string }) =>
  request<DrlFunction>(`/rule-types/${ruleTypeId}/functions/${funcId}`, { method: 'PUT', body: JSON.stringify(body) })

export const deleteRuleFunction = (ruleTypeId: string, funcId: string) =>
  request<void>(`/rule-types/${ruleTypeId}/functions/${funcId}`, { method: 'DELETE' })

export const getRuleImports = (ruleTypeId: string) =>
  request<DrlImport[]>(`/rule-types/${ruleTypeId}/imports`)

export const createRuleImport = (ruleTypeId: string, body: { statement: string; kind: string; is_shared: boolean }) =>
  request<DrlImport>(`/rule-types/${ruleTypeId}/imports`, { method: 'POST', body: JSON.stringify(body) })

export const updateRuleImport = (ruleTypeId: string, importId: string, body: { statement?: string; kind?: string; is_shared?: boolean }) =>
  request<DrlImport>(`/rule-types/${ruleTypeId}/imports/${importId}`, { method: 'PUT', body: JSON.stringify(body) })

export const deleteRuleImport = (ruleTypeId: string, importId: string) =>
  request<void>(`/rule-types/${ruleTypeId}/imports/${importId}`, { method: 'DELETE' })
```

Update `confirmImport` to use new payload shape:
```typescript
export const confirmImport = (payload: ImportConfirmPayload) =>
  request<{ imported: number; rule_ids: string[] }>('/import/confirm', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npm run build 2>&1 | head -40
```
Expected: errors in `ImportDrl.tsx` and `RuleLibrary.tsx` — fix in next task. If unrelated errors appear, fix them now.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/client.ts
git commit -m "feat: add DrlFunction/DrlImport types and API calls to frontend client"
```

---

### Task 9: FunctionsPanel Component + AdminPage

**Files:**
- Create: `frontend/src/components/FunctionsPanel.tsx`
- Modify: `frontend/src/pages/AdminPage.tsx`

- [ ] **Step 1: Create FunctionsPanel.tsx**

Create `frontend/src/components/FunctionsPanel.tsx`:

```tsx
import { useEffect, useState } from 'react'
import {
  DrlFunction, DrlImport, RuleType,
  getRuleFunctions, createRuleFunction, updateRuleFunction, deleteRuleFunction,
  getRuleImports, createRuleImport, updateRuleImport, deleteRuleImport,
} from '../api/client'

interface Props {
  ruleType: RuleType
}

export function FunctionsPanel({ ruleType }: Props) {
  const [functions, setFunctions] = useState<DrlFunction[]>([])
  const [imports, setImports] = useState<DrlImport[]>([])
  const [editingFunc, setEditingFunc] = useState<{ id: string; name: string; body: string } | null>(null)
  const [newFunc, setNewFunc] = useState({ name: '', body: '' })
  const [newImp, setNewImp] = useState({ statement: '', kind: 'import' as 'import' | 'global', is_shared: false })
  const [error, setError] = useState('')
  const [expandedFuncId, setExpandedFuncId] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getRuleFunctions(ruleType.id), getRuleImports(ruleType.id)])
      .then(([f, i]) => { setFunctions(f); setImports(i) })
      .catch(() => setError('Failed to load functions/imports'))
  }, [ruleType.id])

  async function saveNewFunc() {
    if (!newFunc.name || !newFunc.body) return
    try {
      const created = await createRuleFunction(ruleType.id, newFunc)
      setFunctions(prev => [...prev, created])
      setNewFunc({ name: '', body: '' })
    } catch { setError('Failed to create function') }
  }

  async function saveEditFunc() {
    if (!editingFunc) return
    try {
      const updated = await updateRuleFunction(ruleType.id, editingFunc.id, { name: editingFunc.name, body: editingFunc.body })
      setFunctions(prev => prev.map(f => f.id === updated.id ? updated : f))
      setEditingFunc(null)
    } catch { setError('Failed to update function') }
  }

  async function removeFunc(id: string) {
    if (!confirm('Delete this function?')) return
    try {
      await deleteRuleFunction(ruleType.id, id)
      setFunctions(prev => prev.filter(f => f.id !== id))
    } catch { setError('Failed to delete function') }
  }

  async function saveNewImp() {
    if (!newImp.statement) return
    try {
      const created = await createRuleImport(ruleType.id, newImp)
      setImports(prev => [...prev, created])
      setNewImp({ statement: '', kind: 'import', is_shared: false })
    } catch { setError('Failed to create import') }
  }

  async function toggleShared(imp: DrlImport) {
    try {
      const updated = await updateRuleImport(ruleType.id, imp.id, { is_shared: !imp.is_shared })
      setImports(prev => prev.map(i => i.id === updated.id ? updated : i))
    } catch { setError('Failed to update import') }
  }

  async function removeImp(id: string) {
    if (!confirm('Delete this import?')) return
    try {
      await deleteRuleImport(ruleType.id, id)
      setImports(prev => prev.filter(i => i.id !== id))
    } catch { setError('Failed to delete import') }
  }

  return (
    <div style={{ marginBottom: 32 }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>
        {ruleType.pipeline_stage}. {ruleType.name}
      </h3>
      {error && <p className="error-msg">{error}</p>}

      {/* Functions */}
      <div className="glass-card" style={{ padding: 16, marginBottom: 12 }}>
        <p style={{ margin: '0 0 10px', fontWeight: 600, fontSize: 13 }}>Functions ({functions.length})</p>
        {functions.map(f => (
          <div key={f.id} style={{ marginBottom: 8, borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
            {editingFunc?.id === f.id ? (
              <div>
                <input
                  value={editingFunc.name}
                  onChange={e => setEditingFunc({ ...editingFunc, name: e.target.value })}
                  style={{ width: '100%', marginBottom: 4 }}
                />
                <textarea
                  value={editingFunc.body}
                  onChange={e => setEditingFunc({ ...editingFunc, body: e.target.value })}
                  rows={6}
                  style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, marginBottom: 4 }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-primary btn-sm" onClick={saveEditFunc}>Save</button>
                  <button className="btn-outline btn-sm" onClick={() => setEditingFunc(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: 13 }}>{f.name}</strong>
                  {expandedFuncId === f.id && (
                    <pre style={{ fontSize: 11, margin: '4px 0 0', whiteSpace: 'pre-wrap', background: 'rgba(0,0,0,0.04)', padding: 8, borderRadius: 6 }}>{f.body}</pre>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                  <button className="btn-outline btn-sm" onClick={() => setExpandedFuncId(expandedFuncId === f.id ? null : f.id)}>
                    {expandedFuncId === f.id ? 'Collapse' : 'View'}
                  </button>
                  <button className="btn-outline btn-sm" onClick={() => setEditingFunc({ id: f.id, name: f.name, body: f.body })}>Edit</button>
                  <button className="btn-outline btn-sm" style={{ color: 'var(--danger, #e55)' }} onClick={() => removeFunc(f.id)}>Delete</button>
                </div>
              </div>
            )}
          </div>
        ))}
        <div style={{ marginTop: 10 }}>
          <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600 }}>Add function</p>
          <input
            placeholder="Function name"
            value={newFunc.name}
            onChange={e => setNewFunc({ ...newFunc, name: e.target.value })}
            style={{ width: '100%', marginBottom: 4 }}
          />
          <textarea
            placeholder="function String myFunc(...) { ... }"
            value={newFunc.body}
            onChange={e => setNewFunc({ ...newFunc, body: e.target.value })}
            rows={4}
            style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, marginBottom: 4 }}
          />
          <button className="btn-primary btn-sm" onClick={saveNewFunc}>Add</button>
        </div>
      </div>

      {/* Imports */}
      <div className="glass-card" style={{ padding: 16 }}>
        <p style={{ margin: '0 0 10px', fontWeight: 600, fontSize: 13 }}>Imports & Globals ({imports.length})</p>
        {imports.map(i => (
          <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ flex: 1, fontFamily: 'monospace', fontSize: 12 }}>{i.statement}</span>
            <span className="muted" style={{ fontSize: 11 }}>{i.kind}</span>
            <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <input type="checkbox" checked={i.is_shared} onChange={() => toggleShared(i)} />
              always include
            </label>
            <button className="btn-outline btn-sm" style={{ color: 'var(--danger, #e55)' }} onClick={() => removeImp(i.id)}>×</button>
          </div>
        ))}
        <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <input
            placeholder="import com.example.Foo; or global Integer x;"
            value={newImp.statement}
            onChange={e => setNewImp({ ...newImp, statement: e.target.value })}
            style={{ flex: 1 }}
          />
          <select value={newImp.kind} onChange={e => setNewImp({ ...newImp, kind: e.target.value as 'import' | 'global' })}>
            <option value="import">import</option>
            <option value="global">global</option>
          </select>
          <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="checkbox" checked={newImp.is_shared} onChange={e => setNewImp({ ...newImp, is_shared: e.target.checked })} />
            always include
          </label>
          <button className="btn-primary btn-sm" onClick={saveNewImp}>Add</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add FunctionsPanel section to AdminPage.tsx**

In `frontend/src/pages/AdminPage.tsx`, add the import at the top:
```tsx
import { getRuleTypes, RuleType } from '../api/client'
import { FunctionsPanel } from '../components/FunctionsPanel'
```

Add state inside `AdminPage`:
```tsx
const [ruleTypes, setRuleTypes] = useState<RuleType[]>([])
const [showFunctions, setShowFunctions] = useState(false)
```

In the existing `useEffect`, add `getRuleTypes()` to the Promise.all:
```tsx
Promise.all([listUsers(token), getClients(), getRuleTypes()])
  .then(([u, c, rts]) => { setUsers(u); setClients(c); setRuleTypes(rts) })
  .catch(() => setError('Failed to load data'))
```

Add a new section in the returned JSX, before the closing tag of the main content area:
```tsx
{/* Functions & Imports Management */}
<div style={{ margin: '32px 0 16px' }}>
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
    <h2 style={{ margin: 0 }}>Functions & Imports</h2>
    <button className="btn-outline btn-sm" onClick={() => setShowFunctions(v => !v)}>
      {showFunctions ? 'Hide' : 'Show'}
    </button>
  </div>
  <p className="muted" style={{ margin: '4px 0 0' }}>
    Manage DRL helper functions and import statements per rule type.
  </p>
</div>
{showFunctions && ruleTypes.map(rt => (
  <FunctionsPanel key={rt.id} ruleType={rt} />
))}
```

- [ ] **Step 3: TypeScript check**

```bash
cd frontend && npm run build 2>&1 | head -40
```
Expected: errors only from ImportDrl.tsx and RuleLibrary.tsx (fixed next task). Fix any other errors now.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/FunctionsPanel.tsx frontend/src/pages/AdminPage.tsx
git commit -m "feat: add FunctionsPanel component and integrate into AdminPage"
```

---

### Task 10: Update ImportDrl.tsx + RuleLibrary.tsx

**Files:**
- Modify: `frontend/src/pages/ImportDrl.tsx`
- Modify: `frontend/src/pages/RuleLibrary.tsx`

- [ ] **Step 1: Update ImportDrl.tsx**

The key changes:
1. `handleConfirm` must pass the new `ImportConfirmPayload` shape (rule_type_id, functions, imports, rules)
2. Preview table shows "Functions" column

In `handleConfirm`, replace the `confirmImport` call:
```tsx
const result = await confirmImport({
  rule_type_id: selectedRuleTypeId,
  functions: preview.functions,
  imports: preview.imports,
  rules: preview.rules.map(r => ({
    client_id: selectedClientId,
    rule_type_id: selectedRuleTypeId,
    name: r.name,
    condition_raw: r.condition_raw,
    action_raw: r.action_raw,
    required_function_names: r.required_function_names,
    required_import_statements: r.required_import_statements,
  })),
})
```

In the preview table, add a "Functions" column header and cell after the rule name column:
```tsx
<thead>
  <tr><th>#</th><th>Rule Name</th><th>Functions</th><th>Condition (when)</th><th>Action (then)</th></tr>
</thead>
...
<td>
  {r.required_function_names.length > 0
    ? <code style={{ fontSize: 11 }}>{r.required_function_names.join(', ')}</code>
    : <span className="muted" style={{ fontSize: 11 }}>none</span>}
</td>
```

- [ ] **Step 2: Update RuleLibrary.tsx**

Find where rule cards are rendered (the expanded rule detail section). Add a "Uses functions" line after the rule name or in the metadata section. Look for where `rule.name` or `rule.description` is displayed in the expanded view. Add:

```tsx
{(rule.required_function_names ?? []).length > 0 && (
  <div style={{ marginTop: 8 }}>
    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)' }}>
      Uses functions
    </span>
    <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {(rule.required_function_names ?? []).map(fn => (
        <span key={fn} style={{
          background: 'rgba(124,58,237,0.1)',
          color: 'var(--accent)',
          borderRadius: 4,
          padding: '2px 6px',
          fontSize: 11,
          fontFamily: 'monospace',
        }}>{fn}</span>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 3: TypeScript check + build**

```bash
cd frontend && npm run build
```
Expected: zero errors.

- [ ] **Step 4: Run frontend tests**

```bash
cd frontend && npm test
```
Expected: pass (tests don't cover these pages directly).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/ImportDrl.tsx frontend/src/pages/RuleLibrary.tsx
git commit -m "feat: show detected functions in import preview and rule library cards"
```

---

### Final Verification

- [ ] **Run full backend suite**

```bash
cd backend && pytest -v
```
Expected: all pass.

- [ ] **Run frontend build**

```bash
cd frontend && npm run build
```
Expected: zero TypeScript errors.

- [ ] **Smoke test**

Start the app and verify:
1. Admin page → Functions & Imports section shows per-rule-type functions
2. Import a `.drl` file with functions (use `data/issue_correlation.drl`) → preview shows functions column
3. Confirm import → functions appear in admin Functions panel
4. Rule Library → expanded rule card shows "Uses functions" badges
5. Deployments → export ZIP → unzip and verify only relevant functions included
