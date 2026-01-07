# Top 100 Essential MCPs for Vibe Coders

> A curated list of the most impactful MCP servers mapped to Vibeship Spawner skills.
> When connected, these MCPs empower skills with real-world tool access.

## MCP Discovery Sources

| Source | URL | Description |
|--------|-----|-------------|
| Official MCP Registry | [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) | Anthropic-maintained reference implementations |
| Awesome MCP Servers | [punkpeye/awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers) | 500+ community MCPs |
| MCP Server Works | [mcpserver.works](https://mcpserver.works) | Curated directory |
| MCP Servers Org | [mcpservers.org](https://mcpservers.org) | Submission-based registry |

---

## Category 1: Development & Code Quality (20 MCPs)

### 1.1 Version Control & Git

| # | MCP Name | Description | Skills That Use It | Skill Exists? |
|---|----------|-------------|-------------------|---------------|
| 1 | **GitHub MCP** | Repos, PRs, issues, actions, code search | git-workflow, code-review, ci-cd-pipeline | Yes |
| 2 | **GitLab MCP** | GitLab API - repos, MRs, CI/CD | git-workflow, ci-cd-pipeline, devops | Yes |
| 3 | **Azure DevOps MCP** | Azure Repos, pipelines, boards | devops, ci-cd-pipeline | Yes |
| 4 | **Bitbucket MCP** | Atlassian Bitbucket integration | git-workflow | Yes |
| 5 | **Git MCP** | Local git operations | git-workflow, code-cleanup | Yes |

### 1.2 Code Execution & Sandboxing

| # | MCP Name | Description | Skills That Use It | Skill Exists? |
|---|----------|-------------|-------------------|---------------|
| 6 | **E2B MCP** | Sandboxed code execution | testing-strategies, debugging-master | Yes |
| 7 | **Jupyter MCP** | Notebook execution | data-science, python-craftsman | Yes (Python Craftsman) |
| 8 | **Replit MCP** | Cloud IDE integration | code-execution | **NO - Need to create** |
| 9 | **CodeSandbox MCP** | Browser-based dev environments | frontend, react-patterns | Yes |
| 10 | **Docker MCP** | Container management | docker, devops, kubernetes | Yes |

### 1.3 Code Analysis & Quality

| # | MCP Name | Description | Skills That Use It | Skill Exists? |
|---|----------|-------------|-------------------|---------------|
| 11 | **SonarQube MCP** | Code quality metrics | code-review, security | Yes |
| 12 | **ESLint MCP** | JavaScript linting | typescript-strict, frontend | Yes |
| 13 | **Semgrep MCP** | Security scanning | security-owasp, code-review | Yes |
| 14 | **Snyk MCP** | Vulnerability detection | security, devops | Yes |
| 15 | **CodeClimate MCP** | Maintainability metrics | code-cleanup, code-review | Yes |

### 1.4 Documentation & Knowledge

| # | MCP Name | Description | Skills That Use It | Skill Exists? |
|---|----------|-------------|-------------------|---------------|
| 16 | **Notion MCP** | Documentation management | documentation-engineer | Yes |
| 17 | **Confluence MCP** | Enterprise docs | documentation-engineer, team-communications | Yes |
| 18 | **ReadMe MCP** | API documentation | api-design, documentation-engineer | Yes |
| 19 | **Mintlify MCP** | Doc site generation | documentation-engineer | Yes |
| 20 | **Docusaurus MCP** | React doc sites | frontend, documentation-engineer | Yes |

---

## Category 2: Databases & Data (20 MCPs)

### 2.1 Relational Databases

| # | MCP Name | Description | Skills That Use It | Skill Exists? |
|---|----------|-------------|-------------------|---------------|
| 21 | **PostgreSQL MCP** | Postgres queries, schema | postgres-wizard, database-architect, supabase-backend | Yes |
| 22 | **MySQL MCP** | MySQL operations | database-architect | Yes |
| 23 | **SQLite MCP** | Local SQLite | database-architect, prisma | Yes |
| 24 | **Supabase MCP** | Full Supabase platform | supabase-backend, realtime-sync | Yes |
| 25 | **Neon MCP** | Serverless Postgres | postgres-wizard, neon-postgres | Yes |

### 2.2 NoSQL & Document Stores

| # | MCP Name | Description | Skills That Use It | Skill Exists? |
|---|----------|-------------|-------------------|---------------|
| 26 | **MongoDB MCP** | Document database | database-architect | Yes |
| 27 | **Redis MCP** | Cache & data structures | redis-specialist, caching-patterns | Yes |
| 28 | **Firestore MCP** | Google Cloud Firestore | gcp-cloud-run | Yes |
| 29 | **DynamoDB MCP** | AWS key-value store | aws-serverless | Yes |
| 30 | **Upstash MCP** | Serverless Redis/Kafka | redis-specialist, caching-patterns | Yes |

### 2.3 Vector Databases & AI Data

| # | MCP Name | Description | Skills That Use It | Skill Exists? |
|---|----------|-------------|-------------------|---------------|
| 31 | **Pinecone MCP** | Vector search | rag-implementation, semantic-search | Yes |
| 32 | **Qdrant MCP** | Vector similarity | rag-implementation, agent-memory-systems | Yes |
| 33 | **Weaviate MCP** | Vector + hybrid search | rag-implementation | Yes |
| 34 | **Chroma MCP** | Embedding database | rag-implementation, agent-memory-systems | Yes |
| 35 | **pgvector MCP** | Postgres vector extension | postgres-wizard, rag-implementation | Yes |

### 2.4 Data Warehouses & Analytics

| # | MCP Name | Description | Skills That Use It | Skill Exists? |
|---|----------|-------------|-------------------|---------------|
| 36 | **Snowflake MCP** | Cloud data warehouse | data-engineer | Yes |
| 37 | **BigQuery MCP** | Google analytics | gcp-cloud-run, data-engineer | Yes |
| 38 | **Databricks MCP** | Unified analytics | data-engineer | Yes |
| 39 | **dbt MCP** | Data transformation | data-engineer | Yes |
| 40 | **Airbyte MCP** | Data integration | data-engineer | Yes |

---

## Category 3: Cloud & Infrastructure (15 MCPs)

### 3.1 Major Cloud Providers

| # | MCP Name | Description | Skills That Use It | Skill Exists? |
|---|----------|-------------|-------------------|---------------|
| 41 | **AWS MCP** | Full AWS SDK access | aws-serverless, infrastructure-as-code | Yes |
| 42 | **GCP MCP** | Google Cloud services | gcp-cloud-run, infrastructure-as-code | Yes |
| 43 | **Azure MCP** | Microsoft Azure | azure-serverless, infrastructure-as-code | Yes |
| 44 | **Cloudflare MCP** | Edge compute, Workers | cloudflare-workers | **NO - Need to create** |
| 45 | **Vercel MCP** | Deployment platform | vercel-deployment, nextjs-app-router | Yes |

### 3.2 Container & Orchestration

| # | MCP Name | Description | Skills That Use It | Skill Exists? |
|---|----------|-------------|-------------------|---------------|
| 46 | **Kubernetes MCP** | K8s cluster management | kubernetes, devops | Yes |
| 47 | **Helm MCP** | K8s package manager | kubernetes, infrastructure-architect | Yes |
| 48 | **ArgoCD MCP** | GitOps deployments | devops, ci-cd-pipeline | Yes |
| 49 | **Terraform MCP** | Infrastructure as Code | infrastructure-as-code | Yes |
| 50 | **Pulumi MCP** | IaC with real languages | infrastructure-as-code | Yes |

### 3.3 Monitoring & Observability

| # | MCP Name | Description | Skills That Use It | Skill Exists? |
|---|----------|-------------|-------------------|---------------|
| 51 | **Datadog MCP** | Full-stack monitoring | observability, devops | Yes |
| 52 | **Grafana MCP** | Dashboards & metrics | observability | Yes |
| 53 | **Prometheus MCP** | Metrics collection | observability, kubernetes | Yes |
| 54 | **Sentry MCP** | Error tracking | error-handling, debugging-master | Yes |
| 55 | **PagerDuty MCP** | Incident management | incident-responder | Yes |

---

## Category 4: AI & Machine Learning (15 MCPs)

### 4.1 LLM Providers

| # | MCP Name | Description | Skills That Use It | Skill Exists? |
|---|----------|-------------|-------------------|---------------|
| 56 | **Anthropic MCP** | Claude API access | llm-architect, prompt-engineer | Yes |
| 57 | **OpenAI MCP** | GPT models access | llm-architect, prompt-engineer | Yes |
| 58 | **Bedrock MCP** | AWS AI models | aws-serverless, llm-architect | Yes |
| 59 | **Ollama MCP** | Local LLM running | llm-architect | Yes |
| 60 | **Groq MCP** | Fast inference | llm-architect | Yes |

### 4.2 AI Development Tools

| # | MCP Name | Description | Skills That Use It | Skill Exists? |
|---|----------|-------------|-------------------|---------------|
| 61 | **LangChain MCP** | LLM orchestration | ai-agents-architect, rag-implementation | Yes |
| 62 | **LlamaIndex MCP** | RAG framework | rag-implementation | Yes |
| 63 | **Weights & Biases MCP** | ML experiment tracking | llm-fine-tuning | Yes |
| 64 | **Hugging Face MCP** | Model hub access | llm-fine-tuning, rag-implementation | Yes |
| 65 | **Replicate MCP** | Model deployment | ai-image-generation, text-to-video | Yes |

### 4.3 Memory & Knowledge

| # | MCP Name | Description | Skills That Use It | Skill Exists? |
|---|----------|-------------|-------------------|---------------|
| 66 | **Memory MCP** | Persistent agent memory | agent-memory-systems | Yes |
| 67 | **Mem0 MCP** | User memory layer | agent-memory-systems | Yes |
| 68 | **Graphiti MCP** | Knowledge graphs | agent-memory-systems, graph-engineer | Yes |
| 69 | **Zep MCP** | Long-term memory | agent-memory-systems | Yes |
| 70 | **Letta MCP** | Stateful agents | autonomous-agents | Yes |

---

## Category 5: Communication & Collaboration (10 MCPs)

| # | MCP Name | Description | Skills That Use It | Skill Exists? |
|---|----------|-------------|-------------------|---------------|
| 71 | **Slack MCP** | Workspace messaging | team-communications, slack-bot-builder | Yes |
| 72 | **Discord MCP** | Community platform | discord-bot-architect, community-building | Yes |
| 73 | **Email MCP** | SMTP/IMAP access | email-systems | Yes |
| 74 | **Twilio MCP** | SMS/Voice | twilio-communications | Yes |
| 75 | **SendGrid MCP** | Transactional email | email-systems | Yes |
| 76 | **Linear MCP** | Issue tracking | product-management | Yes |
| 77 | **Jira MCP** | Project management | product-management | Yes |
| 78 | **Asana MCP** | Task management | product-management | Yes |
| 79 | **Microsoft Teams MCP** | Enterprise chat | team-communications | Yes |
| 80 | **Zoom MCP** | Video conferencing | team-communications | Yes |

---

## Category 6: Browser & Web (10 MCPs)

| # | MCP Name | Description | Skills That Use It | Skill Exists? |
|---|----------|-------------|-------------------|---------------|
| 81 | **Puppeteer MCP** | Browser automation | browser-automation, testing-strategies | Yes |
| 82 | **Playwright MCP** | Cross-browser testing | browser-automation, testing-strategies | Yes |
| 83 | **Browserbase MCP** | Cloud browsers | browser-automation | Yes |
| 84 | **Firecrawl MCP** | Web scraping | web-scraping | **NO - Need to create** |
| 85 | **Exa MCP** | AI-powered search | search-integration | **NO - Need to create** |
| 86 | **Tavily MCP** | Research search | research-assistant | **NO - Need to create** |
| 87 | **Brave Search MCP** | Privacy search | search-integration | **NO - Need to create** |
| 88 | **Perplexity MCP** | AI search | research-assistant | **NO - Need to create** |
| 89 | **SerpAPI MCP** | Google search API | seo, search-integration | **NO - Need to create** |
| 90 | **Screenshot MCP** | Page capture | browser-automation | Yes |

---

## Category 7: Finance & Payments (5 MCPs)

| # | MCP Name | Description | Skills That Use It | Skill Exists? |
|---|----------|-------------|-------------------|---------------|
| 91 | **Stripe MCP** | Payment processing | fintech-integration, stripe-integration | Yes |
| 92 | **Plaid MCP** | Banking connections | fintech-integration, plaid-fintech | Yes |
| 93 | **Coinbase MCP** | Crypto trading | defi-architect | Yes |
| 94 | **QuickBooks MCP** | Accounting | finance-integration | **NO - Need to create** |
| 95 | **Alpaca MCP** | Stock trading | algorithmic-trading | Yes |

---

## Category 8: Security & Compliance (5 MCPs)

| # | MCP Name | Description | Skills That Use It | Skill Exists? |
|---|----------|-------------|-------------------|---------------|
| 96 | **Vault MCP** | Secrets management | security, devops | Yes |
| 97 | **1Password MCP** | Password vault | security | Yes |
| 98 | **OWASP ZAP MCP** | Security scanning | security-owasp | Yes |
| 99 | **Trivy MCP** | Container scanning | docker, security | Yes |
| 100 | **Gitleaks MCP** | Secret detection | security, git-workflow | Yes |

---

## Skills That Need Creation

Based on this analysis, the following skills are **missing** and should be created:

| Missing Skill | MCPs That Need It | Priority |
|---------------|-------------------|----------|
| **cloudflare-workers** | Cloudflare MCP | High |
| **web-scraping** | Firecrawl MCP | High |
| **search-integration** | Exa, Brave, SerpAPI MCPs | High |
| **research-assistant** | Tavily, Perplexity MCPs | Medium |
| **code-execution** | Replit MCP | Medium |
| **finance-integration** | QuickBooks MCP | Low |

---

## MCP-Skill Compatibility Matrix

### High-Value Combinations

These MCP + Skill combinations provide the most value:

| MCP | + Skill | = Superpower |
|-----|---------|--------------|
| GitHub MCP | + code-review | Automated PR analysis with disaster story context |
| PostgreSQL MCP | + postgres-wizard | Query optimization with EXPLAIN ANALYZE |
| Sentry MCP | + debugging-master | OHE methodology with real error data |
| Stripe MCP | + fintech-integration | PCI-compliant payment flows |
| Pinecone MCP | + rag-implementation | Hybrid search with RRF fusion |
| Kubernetes MCP | + kubernetes | Resource limit verification |
| Playwright MCP | + testing-strategies | E2E with flaky prevention |
| Redis MCP | + redis-specialist | Atomic Lua scripts for rate limiting |
| Supabase MCP | + supabase-backend | RLS policy verification |
| Docker MCP | + docker | Multi-stage build optimization |

### Team Combinations

For multi-agent teams, these MCPs enable collaboration:

| Team | MCPs | Use Case |
|------|------|----------|
| Full-Stack Team | GitHub + Supabase + Vercel | Complete app deployment |
| Data Team | PostgreSQL + dbt + Snowflake | Analytics pipeline |
| AI Team | OpenAI + Pinecone + Memory | RAG application |
| DevOps Team | AWS + Kubernetes + Terraform | Infrastructure automation |
| Security Team | Snyk + Trivy + Gitleaks | Vulnerability scanning |

---

## Implementation Priority

### Phase 1: Core MCPs (Week 1)
1. GitHub MCP - Version control
2. PostgreSQL MCP - Database
3. Docker MCP - Containers
4. Sentry MCP - Error tracking
5. Slack MCP - Communication

### Phase 2: Cloud MCPs (Week 2)
6. AWS MCP - Cloud infrastructure
7. Vercel MCP - Deployment
8. Kubernetes MCP - Orchestration
9. Redis MCP - Caching
10. Supabase MCP - Backend

### Phase 3: AI MCPs (Week 3)
11. OpenAI MCP - LLM access
12. Anthropic MCP - Claude API
13. Pinecone MCP - Vector search
14. LangChain MCP - Orchestration
15. Memory MCP - Agent memory

### Phase 4: Specialized MCPs (Week 4)
16. Stripe MCP - Payments
17. Playwright MCP - Testing
18. Datadog MCP - Monitoring
19. Vault MCP - Secrets
20. Linear MCP - Project management

---

## How to Connect MCPs to Skills

### In Spawner UI

```typescript
// When a skill is loaded, auto-suggest relevant MCPs
const skillMcpMap: Record<string, string[]> = {
  'postgres-wizard': ['postgresql', 'supabase', 'neon'],
  'code-review': ['github', 'gitlab', 'sonarqube'],
  'kubernetes': ['kubernetes', 'helm', 'argocd'],
  'rag-implementation': ['pinecone', 'qdrant', 'chroma', 'weaviate'],
  // ... etc
};
```

### Auto-Connect on Skill Use

When a skill is invoked:
1. Check which MCPs are compatible
2. Show "Connect {MCP} for enhanced {skill}?" prompt
3. One-click connection
4. Skill gains tool access

---

## Sources

- [Official MCP Servers](https://github.com/modelcontextprotocol/servers)
- [Awesome MCP Servers](https://github.com/punkpeye/awesome-mcp-servers)
- [MCP Server Works](https://mcpserver.works)
- [Anthropic MCP Announcement](https://www.anthropic.com/news/model-context-protocol)
