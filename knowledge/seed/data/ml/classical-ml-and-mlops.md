---
id: data.ml.classical-ml-and-mlops
department: data
domain: ml
title: 'Data and AI: Classical machine learning and MLOps'
summary: 'Classical ML and MLOps: start with simple baselines, watch for training-serving skew, when classical ML beats an LLM, the lifecycle checklist, experiment tracking and promotion by registry alias, and drift monitoring now that SageMaker Model Monitor is closed to new customers.'
type: playbook
audience: both
confidence: inference
volatility: evergreen
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms:
- aws
- sagemaker
- iceberg
- mlflow
objectives:
- ai-features
sources:
- https://developers.google.com/machine-learning/guides/rules-of-ml
- https://papers.nips.cc/paper/2015/hash/86df7dcfd896fcaf2674f757a2463eba-Abstract.html
- https://arxiv.org/abs/2207.08815
- https://www.anthropic.com/engineering/building-effective-agents
- https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns
- https://docs.cloud.google.com/architecture/choose-design-pattern-agentic-ai-system
- https://mlflow.org/docs/latest/ml/model-registry/
- https://docs.aws.amazon.com/sagemaker/latest/dg/model-monitor.html
related:
- data.guardrails.agent-guardrails
- data.gaps.consolidated-gaps
seed_version: 1
---

**When to use this:** Before building, promoting or monitoring a classical machine-learning model, or choosing between classical ML and an LLM.

**Source section:** 9. Classical machine learning and MLOps: baselines first, aliases for promotion, monitor on evidence

**[GAP]** This section on classical ML and MLOps is the least freshly verified in the document. Most of its sources predate 2025 and several were stated from background knowledge without being re-fetched; each paragraph says so.

### Start simple and watch for training-serving skew

**[DURABLE]** Unverified background, not fetched. Google's "Rules of ML" advises launching first with a simple heuristic or simple model on a solid pipeline, adding complexity only when metrics justify it, and watching for training-serving skew by measuring the gap between training and serving performance ([Google Rules of ML](https://developers.google.com/machine-learning/guides/rules-of-ml)).

**[DURABLE]** Unverified background, not fetched. ML systems carry hidden maintenance costs: entanglement (changing one input changes everything), unstable data dependencies, feedback loops, glue code and configuration debt ([Sculley et al., NeurIPS 2015](https://papers.nips.cc/paper/2015/hash/86df7dcfd896fcaf2674f757a2463eba-Abstract.html)).

### When classical ML beats an LLM

**[DURABLE]** Unverified background, not fetched. On medium-sized tabular data, tree-based models (gradient-boosted trees, random forests) remained stronger than deep networks in a broad 2022 benchmark ([Grinsztajn et al. 2022, arXiv 2207.08815](https://arxiv.org/abs/2207.08815)). **[GAP]** No verified 2025 to 2026 benchmark of tabular foundation models against gradient-boosted trees was found, so the 2022 result may be partly outdated for small datasets.

**[VENDOR] [FAST-MOVING, 2024 to 2026]** Vendor guidance agrees that the least complex option that works is the right one. Anthropic's routing pattern (December 2024) explicitly allows a traditional classifier, not only an LLM, to do the classification step that routes requests ([Anthropic, Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)). Microsoft's guidance of 12 February 2026 says to use a direct model call for classification, summarisation and translation, a single agent with tools as the usual enterprise default, and multi-agent only for cross-domain work, separate security boundaries or parallel specialisation ([Microsoft Azure Architecture Center, 12 Feb 2026](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns)). Google Cloud's guidance of 28 May 2026 says a predictable task, or one needing a single model call, may be cheaper as a non-agentic solution ([Google Cloud, 28 May 2026](https://docs.cloud.google.com/architecture/choose-design-pattern-agentic-ai-system)).

**[INFERENCE]** Classical ML tends to beat an LLM on structured or tabular prediction, high-volume low-latency scoring, forecasting, ranking with abundant labels, anomaly detection, and any case needing calibrated probabilities, stable reproducible outputs or simple explanation. LLMs tend to win on unstructured text, few labels, open-ended generation and tasks that change often. A common hybrid uses an LLM to extract features or labels from text and a classical model to make the decision.

### The classical ML lifecycle checklist

**[INFERENCE]** Problem framing for an ML project: write down the decision the model supports, the action taken on each output, the cost of false positives against false negatives, and the non-ML baseline (a rule, a heuristic or the current process). If no decision changes, do not build. This is the researchers' synthesis of durable sources and standard practice.

**[INFERENCE]** Data splits and leakage checks for an ML project: split by time for anything forecast-like, by entity (customer or account) where the same entity repeats, and keep a final untouched test set. Check for features computed after the prediction time, target-derived features, duplicates across splits, and preprocessing (scaling, imputation, feature selection, embedding fitting) fitted on the full dataset instead of on the training split only.

**[INFERENCE]** Baselines for an ML project: start with the majority class, the last value or a simple rule, then logistic regression or gradient-boosted trees, before anything deep or LLM-based.

**[INFERENCE]** A feature store is worth it when several models share features or when online and offline consistency matters (point-in-time correct joins); otherwise a versioned feature pipeline is enough. **[GAP]** No 2026 primary source on feature stores was fetched, and the SageMaker Feature Store and SageMaker Model Registry pages were not read.

**[INFERENCE]** Deployment patterns for ML models are shadow (score silently), canary (a small traffic share), A/B and blue/green; use batch scoring when latency allows, because it is cheapest. Monitor input drift per feature, prediction drift and, when labels arrive, real performance, and alert on the business metric as well as on statistics. Trigger retraining on measured degradation or on a schedule justified by label delay, and always re-evaluate against the frozen test set and the current production model before promotion.

### Experiment tracking and the model registry: promote by alias

**[PLATFORM CLAIM] [FAST-MOVING, November 2026]** The MLflow Model Registry's concepts are registered model, model version, model URI, alias, tags and annotations. An alias is a mutable named pointer to one version, addressed as `models:/MyModel@champion`; production code targets the alias and promotion is done by reassigning it. Tags are key-value labels on models and versions, for example `validation_status: approved` or `pre_deploy_checks: PASSED` ([MLflow Model Registry](https://mlflow.org/docs/latest/ml/model-registry/)). The page, read by machine extraction, still mentions Staging and Production stages in open-source MLflow and does not itself say they are deprecated; it notes `mlflow.create_external_model()` as available since MLflow 3.

**[INFERENCE]** Registry convention to adopt: one registered model per use case; aliases `@champion` and `@challenger`; required tags for validation status, training-data snapshot and owner; deployment reads the alias and never a version number; and promotion is an audited alias reassignment after checks pass. Every run logs the code commit, data snapshot, parameters and metrics ([MLflow Model Registry](https://mlflow.org/docs/latest/ml/model-registry/)).

### Drift monitoring: SageMaker Model Monitor is closed to new customers

**[PLATFORM CLAIM] [FAST-MOVING, November 2026]** Do not design a new AWS account around SageMaker Model Monitor. A notice on AWS's documentation page, read in November 2026 by machine extraction, says the service is no longer open to new customers, existing customers can continue, and AWS will keep up security and availability work but plans no new features ([SageMaker Model Monitor](https://docs.aws.amazon.com/sagemaker/latest/dg/model-monitor.html)). **[GAP]** What AWS recommends instead for new customers was not established.

**[PLATFORM CLAIM] [DURABLE]** The drift-monitoring method documented for SageMaker Model Monitor has four monitor types (data quality drift, model quality drift such as accuracy, bias drift and feature-attribution drift) and one procedure: capture endpoint or batch-transform inputs and outputs, compute a baseline of statistics and suggested constraints from training data, run a monitoring schedule, and report violations and CloudWatch metrics. Its limits are tabular data only, single-model endpoints only, inference pipelines monitored as a whole, and data capture stopping at high disk usage, so disk utilisation should stay below 75% ([SageMaker Model Monitor](https://docs.aws.amazon.com/sagemaker/latest/dg/model-monitor.html)).

**[INFERENCE]** The drift-monitoring method survives the product notice. For a new AWS build, capture inputs and predictions to S3 or Iceberg, baseline on training data, compare on a schedule with Glue Data Quality rules or an open-source drift library, alert through CloudWatch alarms, and track model quality once labels arrive.

**[GAP]** Drift thresholds such as a population stability index above 0.2 are widely used rules of thumb but were not sourced in this research; treat any numeric drift threshold as a team convention to be tuned, not a standard. No source was read on drift statistics (population stability index, Kolmogorov-Smirnov), MLflow tracking, or MLflow 3 "LoggedModel" changes.
