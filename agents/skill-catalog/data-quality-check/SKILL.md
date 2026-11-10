---
name: data-quality-check
description: "Check a dataset before analysis: missing values, duplicates, odd values, freshness, and whether it can answer the question."
---
# Data quality check

- Profile every column: type, share missing, distinct values, min, max, the most common values.
- Duplicates on the natural key; rows that should exist but don't (gaps in dates or IDs).
- Odd values: negatives where impossible, future dates, placeholder values (0, 1900-01-01, "test", "n/a"), units mixed.
- Freshness: the latest record and how often it updates.
- Consistency with another source the owner trusts (a total from the books, a count from the app).
- Output: a short table of issues with how many rows each affects, what to do (fix, exclude, ask), and a yes/no on whether the data can answer the question as asked.
