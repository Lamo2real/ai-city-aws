---
name: sql-review
description: "Review a SQL query for correctness, performance and readability before its numbers are trusted or it goes to production."
---
# SQL review

- Restate in one sentence what the query should return. Then check that it does.
- Correctness: join types and keys (duplicates from one-to-many joins), NULL handling, filters in WHERE vs ON, time zones and date boundaries, integer division, DISTINCT hiding a bad join.
- Run it on a small sample and check counts against a known total where possible.
- Performance: filters on indexed or partitioned columns, no SELECT *, no functions on filtered columns, avoid correlated subqueries over large tables.
- Readability: CTEs with clear names, one step each, comments on business rules.
- Read-only: never run UPDATE, DELETE or DDL against the owner's data without their yes.
- Output: issues ranked, each with the fixed SQL.
