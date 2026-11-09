"""Writes docs/architecture/aws-architecture.drawio: AI City's AWS solution architecture with the official AWS
icons that ship with draw.io (mxgraph.aws4). Run: python3 scripts/architecture_diagram.py

This draw.io build has no dedicated Amazon Bedrock / AgentCore or OpenSearch icons, so Bedrock and AgentCore use
AWS's Machine Learning category icon and OpenSearch Serverless the Elasticsearch Service icon, each labelled.
"""

from pathlib import Path
from xml.sax.saxutils import escape

OUT = Path(__file__).resolve().parent.parent / "docs" / "architecture" / "aws-architecture.drawio"

C = {  # AWS category colours
    "compute": "#ED7100",
    "storage": "#7AA116",
    "db": "#C925D1",
    "integration": "#E7157B",
    "network": "#8C4FFF",
    "security": "#DD344C",
    "mgmt": "#E7157B",
    "ml": "#01A88D",
    "analytics": "#8C4FFF",
    "media": "#ED7100",
    "cost": "#7AA116",
    "general": "#232F3E",
}

cells: list[str] = []
n = 0


def nid() -> str:
    global n
    n += 1
    return f"c{n}"


def icon(key: str, label: str, res: str, cat: str, x: int, y: int, size: int = 64) -> str:
    style = (
        "sketch=0;outlineConnect=0;fontColor=#232F3E;gradientColor=none;strokeColor=#ffffff;dashed=0;"
        "verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=11;fontStyle=0;aspect=fixed;"
        f"shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.{res};fillColor={C[cat]};"
    )
    cells.append(
        f'<mxCell id="{key}" value="{escape(label, {chr(10): "&lt;br&gt;"})}" style="{style}" vertex="1" parent="1">'
        f'<mxGeometry x="{x}" y="{y}" width="{size}" height="{size}" as="geometry"/></mxCell>'
    )
    return key


def shape(key: str, label: str, shp: str, x: int, y: int, w: int = 60, h: int = 60) -> str:
    style = (
        "sketch=0;outlineConnect=0;fontColor=#232F3E;gradientColor=none;fillColor=#232F3D;strokeColor=none;"
        "dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=11;aspect=fixed;"
        f"pointerEvents=1;shape=mxgraph.aws4.{shp};"
    )
    cells.append(
        f'<mxCell id="{key}" value="{escape(label, {chr(10): "&lt;br&gt;"})}" style="{style}" vertex="1" parent="1">'
        f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>'
    )
    return key


def group(label: str, x: int, y: int, w: int, h: int, kind: str) -> None:
    styles = {
        "cloud": "points=[[0,0],[0.25,0],[0.5,0],[0.75,0],[1,0],[1,0.25],[1,0.5],[1,0.75],[1,1],[0.75,1],[0.5,1],"
        "[0.25,1],[0,1],[0,0.75],[0,0.5],[0,0.25]];outlineConnect=0;gradientColor=none;html=1;whiteSpace=wrap;"
        "fontSize=14;fontStyle=1;container=0;pointerEvents=0;collapsible=0;recursiveResize=0;"
        "shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_aws_cloud_alt;strokeColor=#232F3E;fillColor=none;"
        "verticalAlign=top;align=left;spacingLeft=30;fontColor=#232F3E;dashed=0;",
        "region": "points=[[0,0],[0.25,0],[0.5,0],[0.75,0],[1,0],[1,0.25],[1,0.5],[1,0.75],[1,1],[0.75,1],[0.5,1],"
        "[0.25,1],[0,1],[0,0.75],[0,0.5],[0,0.25]];outlineConnect=0;gradientColor=none;html=1;whiteSpace=wrap;"
        "fontSize=13;fontStyle=1;container=0;pointerEvents=0;collapsible=0;recursiveResize=0;"
        "shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_region;strokeColor=#00A4A6;fillColor=none;"
        "verticalAlign=top;align=left;spacingLeft=30;fontColor=#147EBA;dashed=1;",
        "box": "rounded=1;arcSize=3;whiteSpace=wrap;html=1;fillColor=#F7F9FA;strokeColor=#AAB7B8;dashed=1;"
        "verticalAlign=top;align=left;spacingLeft=10;spacingTop=4;fontSize=13;fontStyle=1;fontColor=#232F3E;",
        "outside": "rounded=1;arcSize=3;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#5A6B86;dashed=1;"
        "verticalAlign=top;align=left;spacingLeft=10;spacingTop=4;fontSize=13;fontStyle=1;fontColor=#232F3E;",
    }
    cells.append(
        f'<mxCell id="{nid()}" value="{escape(label)}" style="{styles[kind]}" vertex="1" parent="1">'
        f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>'
    )


def edge(a: str, b: str, label: str = "", color: str = "#545B64", dashed: bool = False) -> None:
    style = (
        "edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;endArrow=block;"
        f"endFill=1;strokeWidth=1.5;strokeColor={color};fontSize=10;fontColor=#232F3E;labelBackgroundColor=#FFFFFF;"
        + ("dashed=1;" if dashed else "")
    )
    cells.append(
        f'<mxCell id="{nid()}" value="{escape(label)}" style="{style}" edge="1" parent="1" source="{a}" '
        f'target="{b}"><mxGeometry relative="1" as="geometry"/></mxCell>'
    )


def text(label: str, x: int, y: int, w: int, h: int, size: int = 12, bold: bool = False) -> None:
    style = (
        f"text;html=1;whiteSpace=wrap;align=left;verticalAlign=top;fontSize={size};fontColor=#232F3E;"
        + ("fontStyle=1;" if bold else "")
    )
    cells.append(
        f'<mxCell id="{nid()}" value="{escape(label, {chr(34): "&quot;"})}" style="{style}" vertex="1" parent="1">'
        f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>'
    )


# ---------- frame ----------
text("AI City on AWS: solution architecture", 40, 0, 1400, 30, 22, True)
text(
    "Account 552687213402 · prod · Terraform in infra/ · every push to main deploys through GitHub Actions (OIDC)",
    40,
    32,
    1400,
    20,
    12,
)
group("AWS Cloud", 240, 70, 2350, 1230, "cloud")
group("eu-north-1 (Stockholm): the city", 270, 110, 2010, 1170, "region")
group("eu-central-1 (Frankfurt): speech", 2300, 110, 270, 520, "region")

# ---------- people and outside ----------
shape("owner", "Owner (Sir)", "users", 60, 260, 70, 70)
shape("browser", "Web HUD\n(browser)", "client", 60, 450, 64, 64)
shape("iphone", "iPhone app", "mobile_client", 70, 640, 44, 64)

group("Outside services", 2620, 110, 240, 1000, "outside")
shape("openai", "OpenAI\nGPT-Live voice · TTS", "internet_alt2", 2700, 170, 70, 70)
shape("saas", "Slack · Jira · HubSpot ·\nCanva · Higgsfield · YouTube…\n(MCP / OpenAPI)", "internet_alt2", 2700, 320, 70, 70)
shape("mail", "Gmail · Outlook\n(IMAP / Graph)", "internet_alt2", 2700, 490, 70, 70)
shape("github", "GitHub\nrepos · Actions (OIDC)", "internet_alt2", 2700, 640, 70, 70)
shape("apns", "Apple Push (APNs)", "internet_alt2", 2700, 790, 70, 70)

# ---------- 1. edge and sign-in ----------
group("Edge and sign-in", 300, 160, 330, 700, "box")
icon("waf", "AWS WAF", "waf", "security", 330, 210)
icon("cf_hud", "CloudFront\nHUD", "cloudfront", "network", 500, 210)
icon("cog_up", "Cognito user pool\n(MFA, owner only)", "cognito", "security", 330, 380)
icon("s3_site", "S3\nHUD site", "s3", "storage", 500, 380)
icon("cog_ip", "Cognito identity pool\n(speech credentials)", "cognito", "security", 330, 560)
icon("cf_apps", "CloudFront\nApps origin", "cloudfront", "network", 500, 560)
icon("s3_apps", "S3\nApps the city builds", "s3", "storage", 500, 730)

# ---------- 2. API ----------
group("API", 660, 160, 330, 700, "box")
icon("http", "API Gateway\nHTTP API (JWT)", "api_gateway", "integration", 690, 210)
icon("ws", "API Gateway\nWebSocket (live events)", "api_gateway", "integration", 860, 210)
icon("l_api", "Lambda api\n(chat, settings, voice,\nknowledge, connectors)", "lambda", "compute", 690, 380)
icon("l_ws", "Lambda ws-authorizer ·\nws-connection ·\nws-broadcast", "lambda", "compute", 860, 380)
icon("l_apps", "Lambda apps", "lambda", "compute", 690, 580)
icon("l_bridge", "Lambda app-bridge", "lambda", "compute", 860, 580)

# ---------- 3. event-driven core ----------
group("Event-driven core", 1020, 160, 420, 700, "box")
icon("eb", "EventBridge\ncity bus", "eventbridge", "integration", 1050, 210)
icon("rules", "EventBridge rules\n(schedules, standing orders)", "eventbridge", "integration", 1190, 210)
icon("sfn", "Step Functions\napprovals", "step_functions", "integration", 1330, 210)
icon("sqs", "SQS work queues\nace · orchestrator ·\nmanager · worker (+ DLQs)", "sqs", "integration", 1050, 380)
icon("l_disp", "Lambda dispatcher", "lambda", "compute", 1190, 380)
icon("l_fact", "Lambda factory\n(hires workers)", "lambda", "compute", 1330, 380)
icon("l_ledger", "Lambda ledger-writer", "lambda", "compute", 1050, 580)
icon("l_sched", "Lambda scheduler", "lambda", "compute", 1190, 580)
icon("l_chief", "Lambda Chief of Staff\n(Autopilot)", "lambda", "compute", 1330, 580)
icon("l_notify", "Lambda notifier", "lambda", "compute", 1190, 740)
icon("sns", "SNS\nmobile push", "sns", "integration", 1330, 740)
icon("l_appr", "Lambda approvals", "lambda", "compute", 1050, 740)

# ---------- 4. agents ----------
group("Agents: Amazon Bedrock AgentCore", 1470, 160, 420, 700, "box")
icon("rt", "AgentCore Runtime\nAIC · Orchestrator ·\nManagers · Workers", "machine_learning", "ml", 1500, 210)
icon("rt_mcp", "AgentCore Runtime\nMCP host", "machine_learning", "ml", 1640, 210)
icon("ecr", "ECR\nruntime images", "ecr", "compute", 1780, 210)
icon("gw", "AgentCore Gateway\n(connectors, policy gate)", "machine_learning", "ml", 1500, 380)
icon("ident", "AgentCore Identity\n(OAuth sign-in)", "machine_learning", "ml", 1640, 380)
icon("mem", "AgentCore Memory", "machine_learning", "ml", 1780, 380)
icon("bedrock", "Amazon Bedrock\nFable 5.1 · Opus 5.5 · Haiku 5.5\n(inference profile per role)", "machine_learning", "ml", 1500, 580)
icon("sonic", "Amazon Bedrock\nNova 2.5 Sonic (voice backup)", "machine_learning", "ml", 1700, 580)

# ---------- 5. data and knowledge ----------
group("Data and knowledge", 1920, 160, 340, 700, "box")
icon("ddb", "DynamoDB\nledger · connections ·\nknowledge", "dynamodb", "db", 1950, 210)
icon("s3_data", "S3\nworkspaces · skills ·\nconnector specs", "s3", "storage", 2120, 210)
icon("kb", "Bedrock Knowledge Base\n(Titan embeddings)", "machine_learning", "ml", 1950, 380)
icon("aoss", "OpenSearch Serverless\n(vectors)", "elasticsearch_service", "analytics", 2120, 380)
icon("s3_kn", "S3\nknowledge files", "s3", "storage", 1950, 560)
icon("neptune", "Neptune Analytics\n(knowledge graph)", "neptune", "db", 2120, 560)
icon("sfn_in", "Step Functions\ningest", "step_functions", "integration", 1950, 730)
icon("media", "Transcribe +\nMediaConvert", "transcribe", "ml", 2120, 730)

# ---------- 6. security and operations ----------
group("Security, cost and operations", 300, 900, 1960, 170, "box")
icon("kms", "KMS\ncustomer key", "key_management_service", "security", 360, 950)
icon("secrets", "Secrets Manager\nOpenAI · GitHub · OAuth · APNs", "secrets_manager", "security", 600, 950)
icon("iam", "IAM roles\n(per role, boundary)", "identity_and_access_management", "security", 860, 950)
icon("deploy", "IAM deploy role\n(GitHub OIDC)", "identity_and_access_management", "security", 1100, 950)
icon("cw", "CloudWatch\nlogs · dashboard · alarms", "cloudwatch_2", "mgmt", 1340, 950)
icon("budgets", "AWS Budgets\n(e-mail only)", "budgets", "cost", 1580, 950)

# ---------- speech region ----------
icon("transcribe", "Transcribe streaming\n+ vocabulary (Ace → AIC)", "transcribe", "ml", 2400, 170)
icon("polly", "Polly\n(standard voice)", "polly", "ml", 2400, 330)
icon("s3_speech", "S3\nvocabulary table", "s3", "storage", 2400, 490)

text(
    "<b>How a request flows</b><br>"
    "1. The owner signs in (Cognito, MFA) and talks or types to AIC in the HUD or the iPhone app.<br>"
    "2. The API Lambda records the message and queues it (SQS); the dispatcher invokes AgentCore Runtime.<br>"
    "3. AIC (Haiku) answers or delegates: Orchestrator → Department Managers → Workers, each a turn on Bedrock.<br>"
    "4. Every tool call passes the policy gate; connectors go through AgentCore Gateway with OAuth or Secrets "
    "Manager keys.<br>"
    "5. Agents emit events on EventBridge; the ledger-writer stores them in DynamoDB and ws-broadcast pushes them "
    "live to the HUD.<br>"
    "6. Schedules (standing orders, Autopilot's Chief of Staff, mail imports) run from EventBridge rules.<br>"
    "7. Voice: GPT-Live over WebRTC straight from the browser to OpenAI (the API opens the call; the key stays in "
    "Secrets Manager), Nova Sonic as backup; Transcribe and Polly in Frankfurt with Cognito identity-pool credentials.<br>"
    "8. Outside: connectors reach Slack, Jira, HubSpot, Canva, YouTube and more through AgentCore Gateway; workers use "
    "GitHub with the owner's token; pushes go to the iPhone through SNS and APNs; GitHub Actions deploys with Terraform "
    "through the OIDC deploy role.",
    300,
    1100,
    1960,
    170,
    12,
)

# ---------- flows ----------
BLUE, GREEN, PURPLE, ORANGE, GREY = "#147EBA", "#3F8624", "#8C4FFF", "#ED7100", "#545B64"
edge("owner", "browser", "", GREY)
edge("owner", "iphone", "", GREY)
edge("browser", "waf", "HTTPS", BLUE)
edge("waf", "cf_hud", "", BLUE)
edge("cf_hud", "s3_site", "", BLUE)
edge("cf_apps", "s3_apps", "", BLUE)
edge("http", "l_api", "", BLUE)
edge("ws", "l_ws", "", BLUE)
edge("l_api", "sqs", "messages", ORANGE)
edge("sqs", "l_disp", "", ORANGE)
edge("l_disp", "rt", "invoke", ORANGE)
edge("rt", "bedrock", "Converse", GREEN)
edge("rt", "gw", "tools", GREEN)
edge("gw", "ident", "", GREEN)
edge("rt", "eb", "events", PURPLE)
edge("eb", "l_ledger", "", PURPLE)
edge("l_ledger", "ddb", "", PURPLE)
edge("eb", "l_ws", "broadcast", PURPLE)
edge("rules", "l_sched", "", PURPLE)
edge("eb", "sfn", "", PURPLE)
edge("eb", "l_chief", "", PURPLE)
edge("l_chief", "bedrock", "", GREEN)
edge("eb", "l_notify", "", PURPLE)
edge("l_notify", "sns", "", PURPLE)
edge("rt", "kb", "retrieve", GREEN)
edge("kb", "aoss", "", GREEN)
edge("s3_kn", "sfn_in", "", GREEN)
edge("sfn_in", "media", "", GREEN)
edge("rt", "s3_data", "", GREEN)
edge("transcribe", "s3_speech", "", BLUE, True)

xml = (
    '<mxfile host="drawio"><diagram id="aws" name="AI City on AWS">'
    '<mxGraphModel dx="2900" dy="1500" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" '
    'fold="1" page="1" pageScale="1" pageWidth="2900" pageHeight="1320" math="0" shadow="0" background="#FFFFFF">'
    '<root><mxCell id="0"/><mxCell id="1" parent="0"/>' + "".join(cells) + "</root></mxGraphModel></diagram></mxfile>"
)
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(xml, encoding="utf-8")
print(OUT)
