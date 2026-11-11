---
id: operations.processes.process-management
department: operations
domain: processes
title: 'Operations: Process management: map, standardise, measure, improve the constraint'
summary: 'Process management: SIPOC mapping, standardized work as the baseline, checklists that are really adopted, an SOP
  template for agents and humans, PDCA and kaizen, DMAIC, the Theory of Constraints five focusing steps, what to automate
  and with what, and process metrics.'
type: playbook
audience: both
confidence: established
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives:
- efficiency
sources:
- https://asq.org/quality-resources/sipoc
- https://www.lean.org/lexicon-terms/standardized-work/
- https://news.harvard.edu/gazette/story/2009/01/surgical-safety-checklist-drops-deaths-and-complications-by-more-than-one-third/
- https://www.lean.org/lexicon-terms/pdca/
- https://www.lean.org/lexicon-terms/kaizen/
- https://asq.org/quality-resources/dmaic
- https://www.tocinstitute.org/five-focusing-steps.html
- https://www.anthropic.com/engineering/building-effective-agents
- https://fortune.com/2025/08/18/mit-report-95-percent-generative-ai-pilots-at-companies-failing-cfo/
- https://sre.google/sre-book/service-level-objectives/
related:
- operations.rhythm.operating-rhythm-and-decision-rights
- operations.house-style.scaling-roadmap-constraint-and-management
- operations.house-style.training-delegation-hiring-culture-and-performance
seed_version: 1
cross_refs:
  '2':
  - operations.house-style.scaling-roadmap-constraint-and-management
  - operations.house-style.training-delegation-hiring-culture-and-performance
  '5':
  - operations.rhythm.operating-rhythm-and-decision-rights
---

**When to use this:** When mapping, standardising, measuring or improving a process: SIPOC, standardized work, checklists, the SOP template, PDCA, DMAIC, the five focusing steps, what to automate and process metrics.

**Source section:** 4. Process management: map, standardise, measure, improve the constraint

### Map at high level first with SIPOC

**[DURABLE]** SIPOC captures Suppliers, Inputs, Process, Outputs and Customers; a variant adds Constraints and Measures. ASQ recommends it before drawing a flowchart, when first investigating a process and when communicating process boundaries. The procedure is to draw the blocks, name the process and fix its start and end points, fill each block while keeping the Process block to five to seven core activities at a very high level, and review the result with stakeholders and sponsors ([ASQ, SIPOC](https://asq.org/quality-resources/sipoc)).

### Standardized work is the baseline for improvement

**[DURABLE]** Standardized work sets precise procedures for each operator and rests on three elements: takt time (the pace needed to meet demand), work sequence and standard in-process inventory. The Lean Enterprise Institute lists the supporting documents: a process capacity sheet that finds bottlenecks, a standardized work combination table, a standardized work chart, a work standards sheet and a job instruction sheet whose job steps are used to train new operators. The benefits it names are a documented current process for every shift, lower variability, easier training, fewer injuries and a baseline for improvement ([LEI lexicon, Standardized Work](https://www.lean.org/lexicon-terms/standardized-work/)).

### Checklists work when they are really adopted

**[DURABLE]** The strongest checklist evidence is the 2009 WHO surgical safety trial (Haynes and colleagues, New England Journal of Medicine, published online 14 January 2009): eight hospitals in eight cities, 7,688 patients (3,733 before and 3,955 after), study period October 2007 to September 2008. Major complications fell from 11% to 7% and inpatient deaths after major operations fell from 1.5% to 0.8%. The checklist was a single page taking a few minutes, used at three pause points: before anaesthesia, before incision and before the patient leaves the operating room ([Harvard Gazette, 14 Jan 2009](https://news.harvard.edu/gazette/story/2009/01/surgical-safety-checklist-drops-deaths-and-complications-by-more-than-one-third/)).

**[CONTESTED] [GAP]** The 2009 checklist result came from a before-and-after study in eight hospitals with voluntary adoption, so it is the best-case result. A 2014 study of mandated adoption in Ontario is widely cited as finding no significant improvement, but the page failed to load and its figures were not confirmed. Treat "checklists work" as conditional on real adoption and not on the existence of a document.

**[INFERENCE]** Checklist design drawn from the WHO example: one page, minutes to run, tied to a small number of natural pause points, covering only the steps that are both critical and commonly skipped. A checklist that takes longer than the pause it sits in will be bypassed.

### SOP template for agent or human use

**[INFERENCE]** A standard operating procedure for this department has these parts: title and process ID; owner (one named role); purpose and trigger; scope with start point and end point taken from the SIPOC; inputs and required access; numbered steps written as a checklist with a "done" criterion per step; decision points with the rule or the escalation target; pause points (before an irreversible action, before sending anything external, before closing); output and where it is recorded; metrics (cycle time, first-pass yield); known exceptions; last reviewed date and review interval; change log. The template is the researchers' synthesis, not a sourced standard.

**[INFERENCE]** Process ownership rule: one owner per process, the owner approves changes to the procedure, and every KPI on a scorecard has one named owner. This is consistent with the single-owner guidance in the EOS and RAPID sources in section 5.

### PDCA and kaizen: improve in small cycles against a standard

**[DURABLE]** PDCA is an improvement cycle modelled on the scientific method: propose a change, carry it out, measure the result and decide the next step. Plan sets the goal for a process and works out the changes needed; Do carries them out; Check compares results with targets; Act standardises and stabilises the change if it worked and otherwise runs the cycle again. The Lean Enterprise Institute traces it to Walter Shewhart's three-step cycle and W. Edwards Deming's four-step version taught to Japanese executives in the 1950s, recast as PDCA by the Japanese Union of Scientists and Engineers in 1951; PDSA swaps "check" for "study". A gain is locked in by writing the new method into the work instructions ([LEI lexicon, PDCA](https://www.lean.org/lexicon-terms/pdca/)).

**[DURABLE]** Kaizen is continuous improvement through small, incremental changes that add up over time, involving everyone, with employees finding problems and applying practical fixes quickly. It runs on PDCA cycles. Kaizen events are typically five-day team efforts to make one significant process improvement, and the Lean Enterprise Institute cautions against relying on events alone, favouring daily kaizen that builds front-line problem-solving skill. Its rule, credited to Taiichi Ohno, is that improvement needs a standard first: stabilise, set standardized work as the baseline, improve against it, then update the standard ([LEI lexicon, Kaizen](https://www.lean.org/lexicon-terms/kaizen/)).

**[INFERENCE]** PDCA, kaizen and standardized work form one loop: standard, then PDCA experiment, then new standard. It is the same loop as the house-style practice of documenting, training and checking in section 2, which lets the house style and the lean vocabulary share one procedure lifecycle.

### DMAIC for larger improvement projects

**[DURABLE]** DMAIC has five phases. Define covers the problem, goals, customers, charter and team. Measure documents the actual process, validates measurement and sets a baseline, using tools such as a process map, capability analysis and Pareto chart. Analyze finds the critical inputs causing variation and defects. Improve evaluates and implements solutions, for example through designed experiments or a kaizen event. Control uses mistake-proofing, long-term measurement, reaction plans and standard operating procedures ([ASQ, DMAIC](https://asq.org/quality-resources/dmaic)).

**[DURABLE]** DMAIC targets incremental improvement of an existing process; for a new product or service or a total redesign ASQ points to DMADV. It can run as a part-time team project, often over months, or as a roughly one-week kaizen event in which Define and Measure are prepared beforehand and changes are piloted during the event ([ASQ, DMAIC](https://asq.org/quality-resources/dmaic)).

### Theory of Constraints: the five focusing steps

**[DURABLE]** The five focusing steps are: identify the constraint; exploit it, meaning get maximum output from it with existing resources before buying more; subordinate everything else, so that non-constraints do not outproduce the constraint and the constraint is never starved or fed poor-quality inputs, with a buffer kept in front of it; elevate, meaning add capacity only after the second and third steps; and do not let inertia become the constraint, because the constraint moves and the cycle returns to step one. The same source warns that investing in capacity too early adds unnecessary risk ([TOC Institute, Five Focusing Steps](https://www.tocinstitute.org/five-focusing-steps.html)).

**[INFERENCE]** Order of work for any process: SIPOC (about one hour), then a swimlane of the current state, then a baseline of three numbers (cycle time, throughput per week, first-pass yield), then identify the constraint, then exploit and subordinate before spending, and only then automate or add capacity.

### What to automate, and with what

**[VENDOR]** Anthropic's engineering guidance (19 December 2024; the page itself notes tooling has changed since) distinguishes workflows, in which models and tools are orchestrated through predefined code paths, from agents, in which models direct their own process and tool use. It advises looking for the simplest solution and adding complexity only when needed: workflows suit well-defined tasks, agents suit open-ended problems where steps cannot be predicted and the model's decisions can be trusted, and agents cost more and can compound errors ([Anthropic, Building effective agents, 19 Dec 2024](https://www.anthropic.com/engineering/building-effective-agents)).

**[CONTESTED] [FAST-MOVING, 2025]** The MIT NANDA "GenAI Divide" report (2025), read only through a press summary, reported the biggest returns in back-office automation (eliminating outsourced process work, cutting agency costs, streamlining operations) while more than half of generative-AI budgets went to sales and marketing tools. Its sample is small and mixed and its quality is contested ([Fortune, 18 Aug 2025](https://fortune.com/2025/08/18/mit-report-95-percent-generative-ai-pilots-at-companies-failing-cfo/)).

**[INFERENCE]** What to automate first: automate at the constraint step only after it is standardised and measured; prefer deterministic workflow automation for well-defined steps and reserve agents for steps needing judgement. Automating a non-constraint step raises local efficiency without raising throughput. This combines the Theory of Constraints with the Anthropic guidance and is the researchers' synthesis.

### Process metrics

**[DURABLE]** Averages hide long-tail behaviour. Google's site reliability engineering book advises using percentiles (the median for the typical case, the 99th or 99.9th percentile for the plausible worst case) and not assuming normal distributions ([Google SRE Book, Service Level Objectives](https://sre.google/sre-book/service-level-objectives/)).

**[INFERENCE]** Metric definitions for the knowledge base, in standard usage and not retrieved from a source in this research: cycle time is start to finish of one unit of work; lead time is request to delivery including queue time; throughput is units completed per period; first-pass yield is units completed correctly without rework divided by units started.

**[GAP]** No benchmarks for first-pass yield, cycle time or throughput by function were found; these are company-specific. No general, non-AI standard for scoring automation candidates (volume, rule-based, stability) was retrieved. BPMN 2.0 and swimlane conventions, drum-buffer-rope and throughput accounting were not sourced.
