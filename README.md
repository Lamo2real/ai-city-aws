# AI City (Ace) on AWS

AI City is the owner's personal organization of AI agents, running only in the owner's own AWS account. The owner logs in to a web app and talks to **Ace**, who hands real work to an **Orchestrator**; the Orchestrator sends goals to one **Department Manager** per department, and each manager hires **Worker** consultants on demand, reviews their work and reports back up the chain. Agents run on Amazon Bedrock AgentCore with Claude models billed through Bedrock; everything else is serverless and defined in Terraform.

Status: built and tested locally; not deployed yet. See `docs/MORNING_REPORT.md`.
