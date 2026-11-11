---
id: application.architecture.architecture
department: application
domain: architecture
title: 'Application: Architecture: start modular and monolithic, and treat tenant isolation as its own control'
summary: 'Architecture: monolith first and the modular monolith, internal platforms, REST design and versioning, tenant and
  correlation ids, idempotency keys, REST versus GraphQL versus gRPC, MCP, outbox, saga, event sourcing, expand-migrate-contract,
  database change management, multi-tenancy (silo, pool, bridge, PostgreSQL row-level security), twelve-factor rules and Sweden/EU
  hosting.'
type: principle
audience: both
confidence: established
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms:
- aws
objectives:
- ship
- reliability
- security
sources:
- https://martinfowler.com/bliki/MonolithFirst.html
- https://shopify.engineering/deconstructing-monolith-designing-software-maximizes-developer-productivity
- https://services.google.com/fh/files/misc/2025_state_of_ai_assisted_software_development.pdf
- https://learn.microsoft.com/en-us/azure/architecture/best-practices/api-design
- https://martinfowler.com/bliki/ParallelChange.html
- https://docs.stripe.com/api/idempotent_requests
- https://aws.amazon.com/compare/the-difference-between-graphql-and-rest/
- https://aws.amazon.com/compare/the-difference-between-grpc-and-rest/
- https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/04/tr_technology_radar_vol_34_en.pdf
- https://microservices.io/patterns/data/transactional-outbox.html
- https://microservices.io/patterns/data/saga.html
- https://dora.dev/capabilities/database-change-management/
- https://builder.aws.com/content/3ErTKQOTKc5NIw031UePBPxTQ6I/automating-safe-hands-off-deployments
- https://docs.aws.amazon.com/wellarchitected/latest/saas-lens/tenant-isolation.html
- https://docs.aws.amazon.com/whitepapers/latest/saas-architecture-fundamentals/tenant-isolation.html
- https://docs.aws.amazon.com/wellarchitected/latest/saas-lens/silo-pool-and-bridge-models.html
- https://docs.aws.amazon.com/whitepapers/latest/saas-architecture-fundamentals/data-partitioning.html
- https://docs.aws.amazon.com/prescriptive-guidance/latest/saas-multitenant-managed-postgresql/partitioning-models.html
- https://docs.aws.amazon.com/prescriptive-guidance/latest/saas-multitenant-managed-postgresql/rls.html
- https://12factor.net/
related:
- application.compliance.eu-regulation
seed_version: 1
cross_refs:
  '11':
  - application.compliance.eu-regulation
---

**When to use this:** When designing a service, an API, a schema change or tenant isolation, or choosing where to host.

**Source section:** 2. Architecture: start modular and monolithic, and treat tenant isolation as its own control

### Monolith first: when to start with a monolith and when microservices fit

**[DURABLE]** Martin Fowler (3 June 2015) observed that successful microservice systems mostly began as monoliths that were split later, and that systems built as microservices from scratch often ran into serious trouble. Start with a monolith when product value is unproven, when speed of feedback matters most, when the system is simple or when boundaries are not yet understood. Microservices fit when complexity justifies the overhead Fowler calls the microservice premium, when the team has prior experience, or when the system replaces one whose boundaries are predictable. Fowler himself says the evidence is thin and the advice tentative, and adds that a monolith only eases later extraction if it is modular in both its APIs and its data storage ([MonolithFirst](https://martinfowler.com/bliki/MonolithFirst.html)).

### Modular monolith: one deployment unit with enforced domain boundaries

**[DURABLE]** Shopify (21 February 2019) defines a modular monolith as one codebase and one deployment unit with strictly enforced boundaries between domains, and chose it over microservices to gain modularity without adding deployment units, network calls and separate pipelines. Shopify enforced boundaries by reorganising code by business domain (orders, shipping, billing) instead of technical layer, by running a continuous-integration tool that flagged calls bypassing a component's public interface and scored each component, and by planning to load only declared dependencies. The costs it reported were about 6,000 classes mapped by hand, one risky large file-move change, and isolation as continuing work ([Shopify Engineering, 21 Feb 2019](https://shopify.engineering/deconstructing-monolith-designing-software-maximizes-developer-productivity)). **[GAP]** This is a single-company account from 2019; no comparative study of modular monoliths against microservices was retrieved.

### Internal platforms are near-universal but carry a small instability cost

**[FAST-MOVING, Sep 2025]** DORA's 2025 report found about 90% of organisations have at least one internal platform and 76% have a dedicated platform team; higher platform quality is associated with better organisational performance and also with a small increase in delivery instability ([DORA 2025 report PDF](https://services.google.com/fh/files/misc/2025_state_of_ai_assisted_software_development.pdf)).

### REST API design rules

**[DURABLE]** Microsoft's API design guidance (page last updated 8 May 2025) recommends naming resources with nouns and plural collections, nesting no deeper than collection, item, collection, and not mirroring database tables. PUT must be idempotent while PATCH is not guaranteed to be; a POST that creates a resource returns 201 with a Location header; long-running work returns 202 with a status URL and then 303 to the created resource. Collections are paginated with limit and offset with a default of 25, a maximum limit is enforced as a denial-of-service control, and requested fields are validated against what the caller is allowed to see ([Azure API design](https://learn.microsoft.com/en-us/azure/architecture/best-practices/api-design)).

### API versioning options and parallel change

**[DURABLE]** Microsoft's guidance (updated 8 May 2025) lists five versioning approaches with their trade-offs: additive-only change (the simplest), a version in the URI path (visible and cache-friendly but it changes resource identity), a query-string parameter, a custom header, and a media type (fits hypermedia, needs more server logic and can fragment caches). It recommends contract-first design with OpenAPI ([Azure API design](https://learn.microsoft.com/en-us/azure/architecture/best-practices/api-design)). Parallel change offers an alternative to explicit versioning: widen what the endpoint accepts or returns, or add a new endpoint, migrate consumers, then remove the old form ([ParallelChange, 13 May 2014](https://martinfowler.com/bliki/ParallelChange.html)).

### Tenant identification and correlation IDs in APIs

**[DURABLE]** Microsoft's guidance (updated 8 May 2025) says a multi-tenant API identifies the tenant by subdomain, by a header or token claim, or by URI path, and warns that header-based identification risks cache leakage when caches ignore the header. It also recommends propagating a correlation ID on every request and response for end-to-end tracing ([Azure API design](https://learn.microsoft.com/en-us/azure/architecture/best-practices/api-design)).

### Idempotency keys for unsafe requests

**[VENDOR]** Stripe's reference implementation has the client send an `Idempotency-Key` header holding a random value (a version 4 UUID is suggested, up to 255 characters, with no personal data). The server stores the first status code and body and replays them for retries, including 500 responses; reusing a key with different parameters returns an error; keys may be pruned once they are at least 24 hours old; and only POST needs a key because GET and DELETE are idempotent by definition ([Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests)). **[INFERENCE]** The 24-hour retention in Stripe's design is a practical lower bound for an idempotency store where client retries can span hours. **[GAP]** IETF work on a standard idempotency header was not retrieved.

### Choosing REST, GraphQL or gRPC

**[VENDOR]** AWS's comparison pages say GraphQL suits limited bandwidth and fewer round trips, combining several data sources behind one endpoint, and clients whose data needs vary widely, while REST suits simpler data, clients that use data in similar ways and cases without complex querying; one application can use both. REST returns whole resources across many URLs so over-fetching and under-fetching are common, whereas GraphQL returns only requested fields from one endpoint, needs a typed server schema and evolves by deprecating fields instead of versioning URLs ([AWS: GraphQL vs REST](https://aws.amazon.com/compare/the-difference-between-graphql-and-rest/)). gRPC fits high-performance, high-volume or streaming communication and internal polyglot microservices whose API changes rarely, while REST fits web architectures and public APIs that outside developers must understand easily. gRPC always runs on HTTP/2 with binary Protocol Buffers, supports client, server and bidirectional streaming and ships code generation, but it couples client and server through a shared proto file, is not human-readable and is less attractive for browsers ([AWS: gRPC vs REST](https://aws.amazon.com/compare/the-difference-between-grpc-and-rest/)). The AWS pages carry no visible date.

**[INFERENCE]** A default for a B2B SaaS that applies those criteria is REST with an OpenAPI contract for the public API, gRPC only between internal services where latency or streaming justifies the coupling, and GraphQL where one front end aggregates many back ends. **[GAP]** No vendor-neutral or measured comparison of the three styles was found, and the AWS pages list no GraphQL drawbacks, so caching complexity, query-cost limits and N+1 resolver problems are unsourced here.

### MCP and server-driven UI as interface choices

**[FAST-MOVING, Apr 2026]** Thoughtworks Radar Volume 34 (April 2026) puts "MCP by default" in Caution, on the grounds that a well-designed command-line interface is often enough, and puts server-driven UI in Trial for highly dynamic mobile surfaces as a way to avoid app-store review cycles ([Radar Vol 34 PDF](https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/04/tr_technology_radar_vol_34_en.pdf)).

### Transactional outbox: publish events atomically with the database write

**[DURABLE]** The transactional outbox pattern solves the problem of updating a database and sending a message atomically without two-phase commit while preserving order. The service writes the message to an outbox table inside the same local transaction as the business change, and a separate relay publishes it to the broker, implemented either by tailing the transaction log or by a polling publisher. Because the relay can publish a message more than once (for example after a crash between publishing and marking it sent), consumers must be idempotent, typically by recording processed message IDs ([microservices.io: Transactional outbox](https://microservices.io/patterns/data/transactional-outbox.html)).

### Saga: a sequence of local transactions with written compensations

**[DURABLE]** A saga is a sequence of local transactions across services in which a step that fails a business rule causes earlier steps to be undone by explicitly written compensating transactions. Coordination is either choreography, where each service reacts to domain events, or orchestration, where an orchestrator tells participants what to run. Sagas give no automatic rollback and no isolation, so concurrent sagas can produce anomalies that need designed countermeasures; each step must update its database and publish atomically, which is what the outbox or event sourcing provides; and a client that starts a saga synchronously learns the result by polling a status resource or by a notification such as a webhook ([microservices.io: Saga](https://microservices.io/patterns/data/saga.html)). **[INFERENCE]** Any service that both writes its database and emits an event should adopt an outbox with idempotent consumers before adopting sagas, because the saga pattern depends on that atomicity. **[GAP]** The trade-offs between choreography and orchestration are not spelled out on the page read, and schema registries and delivery-semantics guidance were not retrieved.

### Event sourcing and durable execution

**[DURABLE]** DORA lists event sourcing as one way to keep serving during a schema migration, because changes queue as events and are applied afterwards ([DORA database change management](https://dora.dev/capabilities/database-change-management/)). **[FAST-MOVING, Apr 2026]** Thoughtworks Radar Volume 34 (April 2026) puts ignoring durability in agent workflows in Caution: workflows that work in development fail in production without durable execution ([Radar Vol 34 PDF](https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/04/tr_technology_radar_vol_34_en.pdf)).

### Expand, migrate, contract for every backward-incompatible change

**[DURABLE]** Parallel change (Danilo Sato, 13 May 2014) makes a backward-incompatible change in three phases: expand by adding the new form beside the old, migrate by moving clients over incrementally (usually the longest phase), and contract by removing the old form once nothing uses it. It applies to database refactoring, to remote API evolution as an alternative to versioning, and to canary or blue-green deployment where two versions run side by side. The benefit is that the system is releasable in every phase; the risk is that a contract phase which never happens leaves the codebase worse than before, so the removal needs explicit tracking. A client-side feature flag can control which version is in use during migration ([ParallelChange, 13 May 2014](https://martinfowler.com/bliki/ParallelChange.html)).

**[INFERENCE]** A schema-migration rule for zero-downtime deploys follows from parallel change: every breaking schema change ships as at least three deploys (add the new column or table and dual-write; backfill and switch reads; drop the old structure), each reversible, with a ticket for the contract step created when the expand step merges.

### Database change management

**[DURABLE]** DORA's database guidance is to keep schema changes in version control with application code, write one numbered migration script per change, record which migrations each database instance has applied, test against production-like scrubbed data, and use online schema-change tools (gh-ost, pt-online-schema-change) or expand and contract for zero downtime, while keeping tables small through partitioning and archiving. Schema deployments should be decoupled from application deployments, and the target is 100% of database changes through an automated push-button process. DORA suggests measuring the share of failed changes that involve the database, the lead time added by database work, and the percentage of database changes fully automated ([DORA database change management](https://dora.dev/capabilities/database-change-management/)).

**[VENDOR]** Amazon deploys new code beside old code in a production-like stage specifically to catch data written in a format the previous version cannot read, and confirms during review that each change can be rolled back; the article is undated in the notes and describes Amazon's internal practice ([AWS Builders' Library](https://builder.aws.com/content/3ErTKQOTKc5NIw031UePBPxTQ6I/automating-safe-hands-off-deployments)).

### Multi-tenancy: authentication is not isolation

**[DURABLE]** AWS's SaaS guidance describes a cross-tenant access as potentially unrecoverable for a SaaS business and says the isolation strategy depends on domain, compliance, deployment model and service choice ([AWS SaaS Lens, tenant isolation](https://docs.aws.amazon.com/wellarchitected/latest/saas-lens/tenant-isolation.html)). Authentication and authorisation are not isolation: a user can be authenticated and authorised and still reach another tenant's resources, so isolation uses tenant context to scope every resource access. Dedicated stacks can be isolated with coarse network-level policy, while pooled resources such as items in one table need fine-grained policies ([AWS SaaS fundamentals, tenant isolation](https://docs.aws.amazon.com/whitepapers/latest/saas-architecture-fundamentals/tenant-isolation.html)). The AWS pages carry no visible date.

### Multi-tenancy: silo, pool and bridge

**[DURABLE]** AWS treats data partitioning as a separate decision from isolation. In the silo model a tenant gets dedicated resources (a full stack or a database per tenant) while identity, onboarding and operations stay shared; in the pool model tenants share infrastructure for economies of scale, manageability and agility; the bridge model mixes the two, with some services siloed and others pooled. The choice is made per service on regulatory profile, noisy-neighbour behaviour, cost and market factors ([AWS SaaS Lens: silo, pool and bridge](https://docs.aws.amazon.com/wellarchitected/latest/saas-lens/silo-pool-and-bridge-models.html)). Choose silo storage when customers or the domain require separate storage, when pooled isolation is not granular enough, or to contain noisy neighbours and meet service-level agreements ([AWS SaaS fundamentals, data partitioning](https://docs.aws.amazon.com/whitepapers/latest/saas-architecture-fundamentals/data-partitioning.html)).

### Multi-tenancy on PostgreSQL: row-level security for pooled tenants

**[VENDOR]** AWS Prescriptive Guidance maps the three models to PostgreSQL isolation units: silo is a database instance per tenant, bridge is a database or schema per tenant on a shared instance, and pool is shared tables with a tenant identifier column ([AWS Prescriptive Guidance: PostgreSQL partitioning models](https://docs.aws.amazon.com/prescriptive-guidance/latest/saas-multitenant-managed-postgresql/partitioning-models.html)). For pooled tenants AWS recommends PostgreSQL row-level security enabled on every table holding tenant data, because that centralises isolation in the database instead of relying on each developer's query filters, and it prefers a policy comparing `tenant_id` with a runtime variable the application sets per request (its example uses `app.current_tenant`) over one database user per tenant ([AWS Prescriptive Guidance: row-level security](https://docs.aws.amazon.com/prescriptive-guidance/latest/saas-multitenant-managed-postgresql/rls.html)).

**[INFERENCE]** The default for a small or mid-sized Swedish SaaS team is a modular monolith on AWS with pooled tenancy, row-level security and a mandatory `tenant_id` on every table, key and policy; move a tenant to bridge or silo only for a contractual, data-residency or noisy-neighbour reason. Fowler, Shopify and AWS support the parts; the combined recommendation is the researchers'. **[GAP]** Row-level-security caveats (table owners and superusers bypassing policies unless forced, and resetting tenant context under connection pooling with RDS Proxy or PgBouncer) are not on the AWS page read, and the SaaS Lens gives no tiering or cost-attribution guidance.

### Twelve-factor application rules

**[DURABLE]** The twelve-factor methodology (page last updated 2017) lists one codebase, explicitly declared dependencies, configuration in the environment, backing services as attached resources, strict separation of build, release and run, stateless processes, port binding, scaling out by process, fast start-up with graceful shutdown, parity between development and production, logs as event streams, and administrative tasks as one-off processes ([12factor.net](https://12factor.net/)).

### Sweden and EU hosting specifics

**[GAP]** The research did not source AWS Stockholm region details, the AWS European Sovereign Cloud, or data-residency choices for a Swedish SaaS company, and no AWS-specific golden-path guidance (Service Catalog, Proton, Backstage on AWS) was retrieved. The Data Act duty to publish the jurisdiction of the infrastructure (section 11) makes the hosting-region decision a published fact, so it should be recorded in an ADR.
