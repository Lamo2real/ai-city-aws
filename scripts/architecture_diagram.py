"""Writes docs/architecture/aws-architecture.drawio: AI City's AWS solution architecture, drawn the way the owner draws
Booqy's (it-hjalparna/booqy/infrastructure/docs/booking_system_architecture.drawio): a sync stamp, plain rounded
sections with blue bold titles, every Lambda, table, bucket, queue and schedule under its real name, a bold title
and a short note beside each component, straight labelled arrows, grey buses, data-model cards and a numbered
process. Official AWS icons from draw.io (mxgraph.aws4). Run: python3 scripts/architecture_diagram.py

This draw.io build has no Amazon Bedrock / AgentCore or OpenSearch icons: those use AWS's Machine Learning icon and
the Elasticsearch Service icon, each named in its label.
"""

import subprocess
from datetime import date
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "architecture" / "aws-architecture.drawio"
N = "aic-prod"

COL = {
    "compute": "#ED7100", "storage": "#7AA116", "db": "#C925D1", "integration": "#E7157B", "network": "#8C4FFF",
    "security": "#DD344C", "mgmt": "#E7157B", "ml": "#01A88D", "analytics": "#8C4FFF", "cost": "#7AA116",
}  # fmt: skip
BLUE = "#0050EF"
cells: list[str] = []
_n = 0


def _id() -> str:
    global _n
    _n += 1
    return f"a{_n}"


def _v(s: str) -> str:
    return escape(s, {'"': "&quot;"})


def _cell(value: str, style: str, x: float, y: float, w: float, h: float, key: str | None = None) -> str:
    k = key or _id()
    cells.append(
        f'<mxCell id="{k}" value="{_v(value)}" style="{style}" vertex="1" parent="1">'
        f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>'
    )
    return k


def text(value: str, x: float, y: float, w: float, h: float, size: int = 10, bold: bool = False,
         align: str = "left", valign: str = "top", color: str | None = None) -> str:  # fmt: skip
    style = (
        f"text;html=1;whiteSpace=wrap;strokeColor=none;fillColor=none;align={align};verticalAlign={valign};"
        f"rounded=0;fontSize={size};" + ("fontStyle=1;" if bold else "") + (f"fontColor={color};" if color else "")
    )
    return _cell(value, style, x, y, w, h)


def section(title: str, x: float, y: float, w: float, h: float) -> None:
    _cell("", "rounded=1;whiteSpace=wrap;html=1;fillColor=none;arcSize=2;", x, y, w, h)
    text(title, x + 20, y + 5, w - 40, 34, 16, True, valign="middle", color=BLUE)


def icon(key: str, res: str, cat: str, x: float, y: float, size: int = 64) -> str:
    style = (
        "sketch=0;outlineConnect=0;fontColor=#232F3E;gradientColor=none;strokeColor=#ffffff;dashed=0;"
        "verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;"
        f"shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.{res};fillColor={COL[cat]};"
    )
    return _cell(" ", style, x, y, size, size, key)


def named(key: str, name: str, res: str, cat: str, x: float, y: float, size: int = 50, w: float = 150) -> str:
    """Booqy's Lambda/table style: the real name above, the icon under it."""
    text(name, x + size / 2 - w / 2, y - 38, w, 36, 11, align="center", valign="bottom")
    return icon(key, res, cat, x, y, size)


def described(key: str, title: str, note: str, res: str, cat: str, x: float, y: float, size: int = 64,
              w: float = 290) -> str:  # fmt: skip
    """Booqy's Step Functions style: the icon, a bold title beside it and a short note under the title."""
    k = icon(key, res, cat, x, y, size)
    text(title, x + size + 12, y - 4, w, 22, 11, True, valign="middle")
    text(note, x + size + 12, y + 18, w, max(40, size), 10)
    return k


def person(key: str, label: str, shp: str, x: float, y: float, w: int = 60, h: int = 60) -> str:
    style = (
        "sketch=0;outlineConnect=0;fontColor=#232F3E;gradientColor=none;fillColor=#232F3D;strokeColor=none;"
        "dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;"
        f"aspect=fixed;pointerEvents=1;shape=mxgraph.aws4.{shp};"
    )
    return _cell(label, style, x, y, w, h, key)


def box(key: str, value: str, x: float, y: float, w: float, h: float) -> str:
    return _cell(value, "rounded=1;whiteSpace=wrap;html=1;fontSize=11;", x, y, w, h, key)


def edge(a: str, b: str, label: str = "", dashed: bool = False, color: str | None = None) -> None:
    style = "endArrow=classic;html=1;rounded=0;fontSize=10;" + ("dashed=1;" if dashed else "") + (
        f"strokeColor={color};fontColor={color};" if color else ""
    )
    cells.append(
        f'<mxCell id="{_id()}" value="{_v(label)}" style="{style}" edge="1" parent="1" source="{a}" target="{b}">'
        '<mxGeometry relative="1" as="geometry"/></mxCell>'
    )


def bus(x1: float, y1: float, x2: float, y2: float) -> None:
    cells.append(
        f'<mxCell id="{_id()}" value="" style="endArrow=none;html=1;rounded=0;strokeWidth=5;strokeColor=#C2C2C2;" '
        f'edge="1" parent="1"><mxGeometry relative="1" as="geometry"><mxPoint x="{x1}" y="{y1}" as="sourcePoint"/>'
        f'<mxPoint x="{x2}" y="{y2}" as="targetPoint"/></mxGeometry></mxCell>'
    )


def table(rows: list[tuple[str, str]], head: tuple[str, str] = ("Key", "What it holds")) -> str:
    body = "".join(f"<tr><td><code>{escape(a)}</code></td><td>{escape(b)}</td></tr>" for a, b in rows)
    return (
        f'<table><thead><tr><th scope="col" align="left">{head[0]}</th><th scope="col" align="left">{head[1]}'
        f"</th></tr></thead><tbody>{body}</tbody></table>"
    )


# ======================================================================================== sync stamp
head = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, capture_output=True, text=True).stdout.strip()
text(
    f"<b>Synced with the ai-city-aws repo, branch <code>main</code> ({date.today():%-d %b %Y}, HEAD <code>{head}</code>)"
    ", one AWS account (552687213402), one environment (<code>prod</code>), Terraform in <code>infra/</code>.</b><br>"
    "16 Lambdas (Python 3.13, arm64, JSON logs, X-Ray) &#183; 5 AgentCore runtimes (AIC, Orchestrator, Manager, Worker, "
    "MCP host) &#183; 3 DynamoDB tables (PITR + KMS) &#183; 7 S3 buckets &#183; 4 work queues + DLQs &#183; 2 Step "
    "Functions &#183; 9 EventBridge schedules &#183; 2 CloudFront distributions &#183; 1 Cognito user pool + 1 identity "
    "pool &#183; HTTP API + WebSocket API &#183; every push to <code>main</code> deploys through GitHub OIDC",
    0, -70, 2600, 54,
)  # fmt: skip

# ======================================================================================== A. the city
section("AI City core - the owner talks to AIC; work flows down the hierarchy and comes back as live events", 0, 0, 3300, 1250)

person("owner", "Owner (you, &quot;Sir&quot;)", "user", 50, 120)
person("hud", "Web HUD<br>(any browser)", "client", 50, 330, 64, 64)
person("iphone", "iPhone app<br>(SwiftUI, TestFlight)", "mobile_client", 58, 540, 46, 64)
edge("owner", "hud")
edge("hud", "iphone", "", True)

# edge and sign-in
described("waf", "AWS WAF", "managed rule groups and rate limit in front of both distributions", "waf", "security", 230, 110)
described("cf_hud", f"{N}-hud (CloudFront)", "the HUD; strict CSP; OAC to the bucket", "cloudfront", "network", 230, 260)
named("s3_hud", f"{N}-hud", "s3", "storage", 580, 270)
described("cog", "Owner user pool (Cognito)", "MFA (TOTP) required · admin-create only · owner only · our own sign-in screens", "cognito", "security", 230, 410)
described("cogip", "Identity pool (Cognito)", "short-lived credentials for Transcribe streaming and Polly only", "cognito", "security", 230, 560)
described("cf_apps", f"{N}-apps (CloudFront)", "apps the city builds, on their own origin, sandboxed", "cloudfront", "network", 230, 710)
named("s3_apps", f"{N}-apps", "s3", "storage", 580, 720)
edge("hud", "waf", "HTTPS")
edge("waf", "cf_hud")
edge("cf_hud", "s3_hud")
edge("cf_apps", "s3_apps")
edge("hud", "cog", "sign in")

# API
described("http", "HTTP API (API Gateway)", "JWT authorizer (owner pool) · ~60 routes · invokes :live aliases", "api_gateway", "integration", 700, 110)
described("ws", "WebSocket API (API Gateway)", "live city events; Lambda authorizer on connect", "api_gateway", "integration", 700, 560)
edge("hud", "http", "REST + JWT")
edge("hud", "ws", "events")

# Lambdas: Booqy-style grid with names above and a grey bus
lam = [
    ("l_api", "api"), ("l_wsa", "ws-authorizer"), ("l_wsc", "ws-connection"), ("l_wsb", "ws-broadcast"),
    ("l_disp", "dispatcher"), ("l_fact", "factory"), ("l_ledg", "ledger-writer"), ("l_sched", "scheduler"),
    ("l_chief", "chief-of-staff"), ("l_noti", "notifier"), ("l_appr", "approvals"), ("l_apps", "apps"),
    ("l_bridge", "app-bridge"), ("l_cbr", "connector-bridge"), ("l_conn", "connectors"), ("l_kn", "knowledge"),
]  # fmt: skip
LX, LY = 1110, 160
for i, (k, nme) in enumerate(lam):
    named(k, f"{N}-{nme}", "lambda", "compute", LX + (i % 4) * 150, LY + (i // 4) * 150)
text("Lambdas - each called through its <code>live</code> alias; the api function has provisioned concurrency", LX - 20, 760, 620, 30, 10, True)
bus(1080, 140, 1080, 740)
edge("http", "l_api")
edge("ws", "l_wsa", "connect")
edge("ws", "l_wsc")

# queues and the city bus
QX = 1760
for i, q in enumerate(["ace", "orchestrator", "manager", "worker"]):
    named(f"q_{q}", f"{N}-{q}", "sqs", "integration", QX, 160 + i * 140)
text("SQS work queues (one per role) + a DLQ each, replayed by the scheduler", QX - 40, 720, 200, 50, 10)
edge("l_api", "q_ace", "messages")
edge("q_ace", "l_disp")
described("eb", f"{N}-city (EventBridge bus)", "agent.hired, ticket.*, worker.state, chat.reply, approval.requested … every change in the city", "eventbridge", "integration", 1110, 830)
described("sfn_appr", f"{N}-approval (Step Functions)", "waits for the owner's (or the Chief of Staff's) decision, then resumes the job", "step_functions", "integration", 1110, 990)
named("sns", f"{N} push (SNS)", "sns", "integration", 1560, 1000)
edge("eb", "l_ledg", "all events")
edge("eb", "l_wsb", "broadcast")
edge("eb", "sfn_appr", "approval.requested")
edge("eb", "l_noti")
edge("l_noti", "sns")

# agents
described("rt", "AgentCore Runtime x4", "aic_prod_ace · _orchestrator · _manager · _worker<br>one container image (ECR), one session per agent; the policy gate checks every tool call", "machine_learning", "ml", 2000, 110, 78)
described("rt_mcp", "AgentCore Runtime - MCP host", "runs package MCP servers for connectors", "machine_learning", "ml", 2000, 280)
described("gw", "AgentCore Gateway", "every connector (MCP servers, OpenAPI web APIs) behind one gateway; per-role grants", "machine_learning", "ml", 2000, 420)
described("ident", "AgentCore Identity", "OAuth sign-in for connectors and mailboxes (token vault per account); keys in Secrets Manager", "machine_learning", "ml", 2000, 560)
described("mem", "AgentCore Memory", "per-role long-term memory", "machine_learning", "ml", 2000, 700)
named("ecr", f"{N}-agent-runtime (ECR)", "ecr", "compute", 2010, 880, 60, 190)
edge("l_disp", "rt", "invoke (ARN per role)")
edge("rt", "gw", "tools")
edge("gw", "ident")
edge("ecr", "rt_mcp", "", True)

described("bedrock", "Amazon Bedrock - Claude", "Fable 5.1: Orchestrator, every manager, Chief of Staff, Media/Research/Legal workers<br>Opus 5.5: all other workers · Haiku 5.5: AIC and utility calls<br>an application inference profile per role (cost split by AgentRole tag)", "machine_learning", "ml", 2620, 110, 78, 360)
described("sonic", "Amazon Bedrock - Nova 2.5 Sonic", "AIC's backup real-time voice, relayed by the AIC runtime", "machine_learning", "ml", 2620, 330)
described("kb", "Bedrock Knowledge Base", "the owner's documents; Titan Text Embeddings V2", "machine_learning", "ml", 2620, 490)
named("aoss", "OpenSearch Serverless (vectors)", "elasticsearch_service", "analytics", 2630, 700, 50, 200)
named("nep", "Neptune Analytics (graph)", "neptune", "db", 2880, 700, 50, 200)
edge("rt", "bedrock", "Converse")
edge("l_chief", "bedrock", "decides for the owner")
edge("rt", "kb", "retrieve")
edge("kb", "aoss")
edge("kb", "nep")
edge("rt", "eb", "events")

box("ext_saas", "<b>Connected services</b><br>Slack · Jira · HubSpot · Canva · Higgsfield · ElevenLabs · YouTube · TikTok · Instagram … (MCP / OpenAPI)", 2620, 880, 330, 70)
box("ext_mail", "<b>Mail and calendar</b><br>Gmail · Outlook (OAuth through AgentCore Identity)", 2620, 970, 330, 55)
box("ext_gh", "<b>GitHub</b><br>repos, PRs (the owner's token in Secrets Manager)", 2620, 1045, 330, 55)
box("ext_apns", "<b>Apple Push (APNs)</b>", 2620, 1120, 330, 40)
edge("gw", "ext_saas", "MCP / HTTPS")
edge("ident", "ext_mail", "", True)
edge("rt", "ext_gh", "git / gh", True)
edge("sns", "ext_apns", "push")

# ======================================================================================== B. data
BY = 1320
section("Data - DynamoDB tables, S3 buckets and the knowledge pipeline", 0, BY, 3300, 660)
for i, (k, nme) in enumerate([("t_ledger", "ledger"), ("t_conn", "connections"), ("t_kn", "knowledge")]):
    named(k, f"{N}-{nme}", "dynamodb", "db", 60 + i * 170, BY + 120, 78)
text("DynamoDB - on demand, PITR, KMS; the ledger is the city's single source of truth (cards below). Written by aic-prod-api and aic-prod-ledger-writer; connections by aic-prod-ws-connection.", 40, BY + 230, 560, 50, 10)
for i, nme in enumerate(["workspaces", "skills", "connectors", "speech"]):
    named(f"b_{nme}", f"{N}-{nme}", "s3", "storage", 660 + i * 170, BY + 120, 64)
text("S3 - versioned, private, TLS only; workspaces hold each job's files, skills the owner's skills, connectors the OpenAPI specs, speech the Transcribe vocabulary (eu-central-1)", 640, BY + 230, 680, 40, 10)

KX = 1450
named("b_kn", f"{N}-knowledge (S3)", "s3", "storage", KX, BY + 120, 64, 180)
described("eb_def", "EventBridge (default bus)", "Object Created on raw/", "eventbridge", "integration", KX + 160, BY + 120, 64, 160)
described("sfn_in", f"{N}-knowledge-ingest (Step Functions)", "one run per item: extract → transcribe / convert → index → graph", "step_functions", "integration", KX + 450, BY + 120, 64, 260)
named("l_kn2", f"{N}-knowledge", "lambda", "compute", KX + 830, BY + 130, 50)
named("tr", "Transcribe (batch)", "transcribe", "ml", KX + 1000, BY + 120, 64)
named("mc", "MediaConvert", "elemental_mediaconvert", "compute", KX + 1160, BY + 120, 64)
edge("b_kn", "eb_def")
edge("eb_def", "sfn_in", "start")
edge("sfn_in", "l_kn2")
edge("l_kn2", "tr")
edge("l_kn2", "mc")
text("Knowledge pipeline - upload anything (PDF, office, images, audio, video, links); it becomes searchable by every agent with sources", KX, BY + 230, 1300, 30, 10)

# data-model cards (Booqy style)
CY = BY + 300
ledger_rows = [
    ("TICKET#<id> / META", "a job or part: goal, status, department, assignee, workers asked"),
    ("TICKET#<id> / HIST#<at>", "status history"),
    ("AGENT#<id> / META", "AIC, Orchestrator, managers, workers: role, model, state, cost"),
    ("DEPT#<key> / …", "departments, their manager and caps"),
    ("APPROVAL#<id> / META", "approvals and the Chief of Staff's decisions"),
    ("CONV#<id> / …", "conversations with AIC"),
    ("CONN#<id> / META", "connectors and their grants"),
    ("APP#<id> / …", "apps the city builds, versions"),
    ("gsi1 / gsi2", "by status, by department"),
]
text(
    '<h4><font style="font-size: 24px;">Ledger</font> - DynamoDB</h4>'
    "<p>One table, single-table design (<code>pk</code> / <code>sk</code>). Written only by the API and the "
    "ledger-writer; agents read it through tools.</p>" + table(ledger_rows),
    40, CY, 1000, 250, 11,
)  # fmt: skip
text(
    '<h4><font style="font-size: 24px;">Connections</font> - DynamoDB</h4>'
    "<p>Open WebSocket connections (connection id, owner, TTL); ws-broadcast fans each city event out to them.</p>"
    '<h4><font style="font-size: 24px;">Knowledge</font> - DynamoDB</h4>'
    "<p>Every knowledge item: source, status in the pipeline, extracted text location, graph ids (gsi1 by status, "
    "gsi2 by folder).</p>",
    1100, CY, 700, 250, 11,
)  # fmt: skip

# ======================================================================================== C. schedules
SY = 2040
section("Schedules - EventBridge rules (rate / cron) keep the city running while the owner is away", 0, SY, 1600, 520)
jobs = [
    ("sweep", "rate(5 min)", "stuck jobs, DLQ replay"), ("retire-idle", "rate(1 h)", "sends idle workers home"),
    ("reminders", "rate(5 min)", "the owner's reminders"), ("improve", "Sun 03:00", "self-improvement (off)"),
    ("warm-ace", "rate(2 min)", "keeps AIC under 3 s"), ("calendar-import", "rate(15 min)", "meetings from every mailbox"),
    ("chief-sweep", "rate(5 min)", "Autopilot decisions"), ("standing-orders", "rate(5 min)", "support desk, sales follow-ups"),
    ("chief-digest", "17:00 daily", "While you were away"),
]  # fmt: skip
text("Each rule invokes <code>aic-prod-scheduler</code>, except chief-sweep and chief-digest, which invoke <code>aic-prod-chief-of-staff</code>.", 40, SY + 470, 1500, 30, 10)
for i, (nme, when, what) in enumerate(jobs):
    x, y = 60 + (i % 5) * 300, SY + 110 + (i // 5) * 190
    described(f"j_{nme}", f"{N}-{nme}", f"{when}<br>{what}", "eventbridge", "integration", x, y, 56, 200)

# ======================================================================================== D. voice
VX = 1700
section("Voice - GPT-Live first, Nova Sonic second, Transcribe / Polly in eu-central-1", VX, SY, 1600, 520)
box("v_openai", "<b>OpenAI GPT-Live</b><br>gpt-live-1 · full duplex · client delegation", VX + 1180, SY + 90, 330, 60)
described("v_api", "POST /voice/live", "the browser's WebRTC offer → the api Lambda opens the call with the OpenAI key from Secrets Manager → answer", "lambda", "compute", VX + 60, SY + 90, 56, 380)
described("v_tr", "Transcribe streaming (eu-central-1)", "standard voice; table vocabulary: &quot;Ace&quot; is always written AIC", "transcribe", "ml", VX + 60, SY + 230, 56, 380)
described("v_polly", "Polly (eu-central-1)", "standard voice when OpenAI TTS is off", "polly", "ml", VX + 60, SY + 370, 56, 380)
described("v_sonic", "Nova 2.5 Sonic through the AIC runtime", "POST /voice/session → signed WSS to the runtime's /ws → Bedrock bidirectional stream", "machine_learning", "ml", VX + 760, SY + 230, 56, 380)
edge("v_api", "v_openai", "open call")
text("Audio goes straight between the browser and OpenAI (WebRTC). Every request is AIC's: GPT-Live hands it over, AIC answers in the chat and GPT-Live says the answer.", VX + 760, SY + 380, 780, 60, 10)

# ======================================================================================== E. security, CI/CD
EY = 2620
section("Security, cost and CI/CD - GitHub OIDC (no long-lived AWS keys); one account, one environment", 0, EY, 3300, 560)
described("kms", "KMS customer key", "DynamoDB, SQS, logs, Lambda env, buckets", "key_management_service", "security", 60, EY + 100)
described("sm", "Secrets Manager", "aic/prod/openai · github · apns · oauth-google / microsoft · connectors/* · mail/*", "secrets_manager", "security", 60, EY + 230)
described("iam", "IAM roles + permissions boundary", "one role per agent role and per Lambda; agents can never change infra, IAM or the policy", "identity_and_access_management", "security", 60, EY + 360)
described("cw", "CloudWatch", "JSON logs, dashboard, alarms; X-Ray tracing", "cloudwatch_2", "mgmt", 560, EY + 100)
described("budget", "AWS Budgets", "e-mail only; the owner's own spend caps are checked before every turn", "budgets", "cost", 560, EY + 230)
described("deploy", "Deploy role (GitHub OIDC)", "accepts only main / production of Lamo2real/ai-city-aws", "identity_and_access_management", "security", 560, EY + 360)
box("gh_actions", "<b>GitHub Actions</b><br>deploy.yml on every push to main: backend · web · plan · apply · frontend<br>ios-testflight.yml: iPhone app → TestFlight", 1100, EY + 100, 420, 80)
edge("gh_actions", "deploy", "AssumeRoleWithWebIdentity")
text(
    "<b>How a release works</b><br>1. A push to <code>main</code> runs the tests (pytest, ruff, mypy, vitest, Playwright, "
    "Terraform tests).<br>2. The backend is zipped for the Lambdas and built into one arm64 image for the AgentCore "
    "runtimes (ECR, immutable tags).<br>3. <code>terraform plan</code>, then <code>apply</code> (no approval step: the "
    "owner's choice); Lambdas publish a new version and the <code>live</code> alias moves to it.<br>4. The HUD is built "
    "and synced to the HUD bucket; CloudFront is invalidated.<br>5. Docs-only pushes and <code>[skip ci]</code> do not deploy.",
    1100, EY + 210, 1100, 130, 10,
)  # fmt: skip

# ======================================================================================== process card
PX = 3450
text("HOW A REQUEST FLOWS", PX, 0, 700, 80, 28, align="center", valign="middle")
steps = [
    "<b>1. The owner talks or types to AIC</b> in the HUD or the iPhone app, signed in with the Cognito owner pool (MFA).",
    "<b>2. The api Lambda records the message</b> in the ledger and puts it on the <code>ace</code> queue.",
    "<b>3. The dispatcher invokes AIC's runtime.</b> AIC (Haiku 5.5) answers simple things itself, or delegates.",
    "<b>4. The Orchestrator (Fable 5.1) plans</b> and sends each part to a department's manager through its queue.",
    "<b>5. The manager (Fable 5.1) hires workers</b> (factory Lambda), exactly as many as the owner asked for.",
    "<b>6. Workers do the job</b> with their granted tools and connectors; every tool call passes the policy gate.",
    "<b>7. The manager reviews every deliverable</b> (PASS / FAIL) and reports up; AIC tells the owner.",
    "<b>8. Every step is an event</b> on the city bus: the ledger-writer stores it and ws-broadcast shows it live.",
    "<b>9. While the owner is away,</b> Autopilot's Chief of Staff decides questions and approvals, standing orders run "
    "the support desk and sales follow-ups, and the 17:00 digest says what happened.",
]
for i, s in enumerate(steps):
    text(s, PX, 100 + i * 70, 700, 60, 11)

xml = (
    '<mxfile host="drawio"><diagram id="aic" name="AI City on AWS"><mxGraphModel dx="4000" dy="3000" grid="1" '
    'gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="0" pageScale="1" pageWidth="1169" '
    'pageHeight="827" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>'
    + "".join(cells)
    + "</root></mxGraphModel></diagram></mxfile>"
)
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(xml, encoding="utf-8")
print(OUT)
