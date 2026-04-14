from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models import RuleType

RULE_TYPES = [
    {
        "slug": "alert_classifier",
        "name": "Alert Classifier",
        "pipeline_stage": 1,
        "drl_package": "com.infy.ceh.management.autonomics.tasks.impl",
        "drl_imports": (
            "import com.infy.ceh.management.ems.dto.IPPAlert;\n"
            "import java.lang.String;\n"
            "import java.lang.Boolean;"
        ),
        "drl_functions": None,
    },
    {
        "slug": "noise_suppression",
        "name": "Noise Suppression",
        "pipeline_stage": 2,
        "drl_package": "com.infy.ceh.management.autonomics.framework.tasks.impl",
        "drl_imports": (
            "import com.infy.ceh.management.ems.dto.NoiseSuppressionRequest;\n"
            "import com.infy.ceh.management.ems.dto.IPPGroupedAlerts;\n"
            "import java.lang.String;\n"
            "import java.lang.Boolean;\n"
            "import java.util.Arrays;\n"
            "import java.util.List;\n"
            "import java.util.regex.Matcher;\n"
            "import java.util.regex.Pattern;\n"
            "import java.time.ZonedDateTime;\n"
            "import java.time.ZoneOffset;\n"
            "import java.time.Instant;\n"
            "import java.sql.Timestamp;\n"
            "import java.time.LocalDateTime;\n"
            "import java.time.ZoneId;\n"
            "import java.time.format.DateTimeFormatter;\n"
            "import java.time.format.DateTimeFormatterBuilder;\n"
            "import java.time.temporal.ChronoField;"
        ),
        "drl_functions": (
            "function String extractDeviceType(String text,String rgx) {\n"
            "\tSystem.out.println(\"Applying REGEX\" + rgx);\n"
            "\tSystem.out.println(\"Text for REGEX\" + text);\n"
            "    if (text == null) return null;\n"
            "    Pattern p = Pattern.compile(rgx);\n"
            "    Matcher m = p.matcher(text);\n"
            "    return m.find() ? m.group() : null;\n"
            "}\n\n"
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
            "    }"
        ),
    },
    {
        "slug": "issue_correlation",
        "name": "Issue Correlation",
        "pipeline_stage": 3,
        "drl_package": "com.infy.ceh.management.autonomics.framework.tasks.impl",
        "drl_imports": (
            "import com.infy.ceh.management.ems.dto.IPPGroupedAlerts;\n"
            "import java.lang.String;\n"
            "import java.util.List;\n"
            "import java.util.ArrayList;\n"
            "import java.util.HashMap;\n"
            "import java.util.HashSet;\n"
            "import java.util.Set;\n"
            "import java.util.regex.Matcher;\n"
            "import java.util.regex.Pattern;\n"
            "import java.util.Arrays;\n"
            "\n"
            "global java.util.HashMap clusteredAlerts;\n"
            "global Integer index;"
        ),
        "drl_functions": (
            "function String extractPort(String alertName) {\n"
            "\tPattern port_pattern =  Pattern.compile(\"Interfaces_Critical-Port\\\\s+(\\\\d+)\");\n"
            "    Matcher matcher = port_pattern.matcher(alertName);\n"
            "    return matcher.find() ? matcher.group(1) : \"NA\";\n"
            "}\n\n"
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
            "}"
        ),
    },
    {
        "slug": "incident_rules",
        "name": "Incident Creation",
        "pipeline_stage": 4,
        "drl_package": "com.infy.ceh.management.autonomics.tasks.impl",
        "drl_imports": (
            "import com.infy.ceh.management.ems.dto.IPPIssue;\n"
            "import com.infy.ceh.management.ems.dto.IPPIncident;\n"
            "import com.infy.ceh.management.ems.dto.IncidentCreationRequestDto;\n"
            "import java.lang.String;\n"
            "import java.lang.Boolean;\n"
            "import java.util.List;\n"
            "import java.util.Arrays;"
        ),
        "drl_functions": (
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
            "}"
        ),
    },
    {
        "slug": "recommendation",
        "name": "Recommendation",
        "pipeline_stage": 5,
        "drl_package": "com.infy.ceh.management.autonomics.framework.tasks.impl",
        "drl_imports": (
            "import com.infy.ceh.management.ems.dto.IPPIssue;\n"
            "import com.infy.ceh.management.ems.dto.RecommendationRequest;\n"
            "import java.lang.String;\n"
            "import java.lang.Boolean;\n"
            "import java.util.Arrays;\n"
            "import java.util.List;\n"
            "import java.util.regex.Matcher;\n"
            "import java.util.regex.Pattern;"
        ),
        "drl_functions": (
            "function String extractDeviceType(String text,String rgx) {\n"
            "\tSystem.out.println(\"Applying REGEX\" + rgx);\n"
            "\tSystem.out.println(\"Text for REGEX\" + text);\n"
            "    if (text == null) return null;\n"
            "    Pattern p = Pattern.compile(rgx);\n"
            "    Matcher m = p.matcher(text);\n"
            "    return m.find() ? m.group() : null;\n"
            "}"
        ),
    },
]


async def seed_rule_types(session: AsyncSession) -> None:
    """Insert rule_types if they don't already exist (idempotent)."""
    result = await session.execute(select(RuleType.slug))
    existing_slugs = {row[0] for row in result.all()}

    for rt_data in RULE_TYPES:
        if rt_data["slug"] not in existing_slugs:
            session.add(RuleType(**rt_data))
