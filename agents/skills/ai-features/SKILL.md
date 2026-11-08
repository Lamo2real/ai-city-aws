---
name: ai-features
description: "Build AI features that work: a clear task, the right model, retrieval when facts matter, evaluations before launch, and costs measured."
---
# AI features

1. **The task in one sentence** and how success is measured (accuracy on real examples, time saved, conversion).
2. **Model choice**: Anthropic models through Amazon Bedrock for reasoning and writing in the owner's AWS apps; open models from **Hugging Face** where they must run anywhere or cheaply; check current models and prices with **Context7** and the vendors' docs.
3. **Ground it**: retrieval over the owner's documents (embeddings plus keyword search) when answers must be factual; cite sources in the answer.
4. **Prompts as code**: versioned, with examples, kept in the repository.
5. **Evaluate before launch**: 30–100 real examples with expected answers; measure, fix, re-measure; keep the set for regressions.
6. **Safety and cost**: limits on input size, timeouts, no secrets or personal data in prompts or logs, a monthly cost estimate.
7. Hand the build to Application (and IT Infrastructure for hosting) with the evaluation results.
