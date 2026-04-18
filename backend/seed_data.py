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
