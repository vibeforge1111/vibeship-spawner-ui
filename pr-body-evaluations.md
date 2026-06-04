## Bug Report

### Title
`/api/memory-quality/evaluations` allows unauthenticated evaluation injection

### Severity
**MEDIUM**

### Category
Authentication bypass / Data integrity

### Target File(s)
- `src/routes/api/memory-quality/evaluations/+server.ts`

### Description
The POST handler for `/api/memory-quality/evaluations` calls `appendManualEvaluation()` with user-supplied data without any authentication. An unauthenticated attacker can inject arbitrary evaluations into the memory quality dataset, corrupting accuracy metrics and failure mode tracking.

### Steps to Reproduce
1. `curl -X POST http://localhost:5173/api/memory-quality/evaluations -H "Content-Type: application/json" -d '{"score":0,"notes":"injected"}'` - injects evaluation without auth

### Impact
- Corrupted memory quality metrics
- Poisoned evaluation dataset
- Misleading accuracy/failure tracking

---

```json
{
  "pr": {
    "url": "https://github.com/vibeforge1111/vibeship-spawner-ui/pull/XXX",
    "body_must_include": "/api/memory-quality/evaluations|requireControlAuth|unauthenticated|evaluation injection"
  }
}
```
