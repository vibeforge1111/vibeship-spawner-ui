# Roadmap: Project Completion Pipeline

This document outlines future improvements to make Spawner's end-of-project pipeline world-class.

---

## Vision

When a Spawner workflow completes, the project should be:
- ✅ Fully functional
- ✅ Tested
- ✅ Secure
- ✅ Code-reviewed
- ✅ Production-ready

Currently, Claude completes tasks but the "finishing touches" are inconsistent. This roadmap defines a structured completion pipeline.

---

## Current State

**What happens now:**
1. Claude executes all tasks
2. Claude may or may not test
3. Project is "done" (but quality varies)

**Problems:**
- No automated testing enforcement
- No security scanning
- No code review
- No consistency in completion quality

---

## Proposed Completion Pipeline

### Phase 1: Build Verification (Immediate Priority)

**Goal:** Ensure project compiles and runs

**Steps:**
1. Run `npm run build` (or equivalent)
2. Fix any build errors
3. Run `npm run dev`
4. Verify server starts
5. Check for console errors

**Implementation:**
- Add to mission-builder.ts as final task
- Auto-inject for all workflows
- Report results to UI

### Phase 2: Automated Testing (High Priority)

**Goal:** Verify core functionality works

**Options:**

| Approach | Pros | Cons |
|----------|------|------|
| **Claude runs manual tests** | Works now, no setup | Inconsistent, slow |
| **Generate test files** | Permanent, reusable | Requires test framework setup |
| **Playwright E2E** | Real browser testing | Complex setup |
| **Vitest unit tests** | Fast, focused | Doesn't test integration |

**Recommended:** Hybrid approach
1. Claude runs smoke tests manually (immediate)
2. Generate Vitest tests for critical paths (during build)
3. Run tests as final verification step

**Implementation ideas:**
- H70 skill `test-architect` guides test creation
- Auto-generate test file for each major feature
- Final task: `npm run test`

### Phase 3: Security Scanning (High Priority)

**Goal:** Catch vulnerabilities before deployment

**Integration with Vibeship Scanner:**
1. After build completes, run Scanner
2. Report findings in completion summary
3. Auto-fix common issues (secrets in code, etc.)
4. Block deployment if critical issues found

**Implementation:**
- Add Scanner API call to completion pipeline
- Parse results and categorize by severity
- Auto-remediation for known patterns
- Manual review flag for complex issues

**Scanner checks:**
- [ ] No hardcoded secrets
- [ ] No SQL injection vulnerabilities
- [ ] No XSS vulnerabilities
- [ ] Dependencies up to date
- [ ] No known CVEs in dependencies

### Phase 4: Code Review (Medium Priority)

**Goal:** Ensure code quality and maintainability

**Approaches:**

| Approach | Description |
|----------|-------------|
| **Self-review** | Claude reviews its own code against H70 patterns |
| **Checklist review** | Automated checklist (naming, structure, types) |
| **Diff review** | Review only changed files |

**Implementation ideas:**
- Load `code-quality` H70 skill
- Run through anti-patterns checklist
- Generate review report
- Fix issues automatically where possible

**Review checklist:**
- [ ] No `any` types
- [ ] No magic numbers/strings
- [ ] Consistent naming conventions
- [ ] Proper error handling
- [ ] No unused imports/variables
- [ ] Functions under 50 lines
- [ ] Files under 300 lines

### Phase 5: Documentation Generation (Medium Priority)

**Goal:** Project is self-documenting

**Auto-generate:**
- README.md with setup instructions
- Environment variables documentation
- API documentation (if applicable)
- Architecture overview

**Implementation:**
- Template-based generation
- Extract info from code structure
- Include in completion report

### Phase 6: Deployment Readiness (Lower Priority)

**Goal:** Project can be deployed immediately

**Checks:**
- [ ] Environment variables documented
- [ ] Production build works
- [ ] No dev-only code in production
- [ ] Proper error pages (404, 500)
- [ ] Meta tags for SEO
- [ ] Favicon and manifest

---

## Implementation Roadmap

### v1.0 - Foundation (Next Sprint)
- [ ] Build verification as mandatory final step
- [ ] Basic smoke testing
- [ ] Completion summary report

### v1.1 - Security (Following Sprint)
- [ ] Scanner integration
- [ ] Auto-fix for common issues
- [ ] Security report in completion

### v1.2 - Quality (Future)
- [ ] Automated code review
- [ ] Test generation
- [ ] Documentation generation

### v2.0 - Full Pipeline (Future)
- [ ] All phases integrated
- [ ] Configurable pipeline per project type
- [ ] Quality score/badge

---

## Technical Design

### Completion Pipeline Architecture

```
Mission Complete
       |
       v
+------------------+
| Build Verification|
| - npm run build   |
| - Fix errors      |
+------------------+
       |
       v
+------------------+
| Run Tests         |
| - npm run test    |
| - Fix failures    |
+------------------+
       |
       v
+------------------+
| Security Scan     |
| - Vibeship Scanner|
| - Fix criticals   |
+------------------+
       |
       v
+------------------+
| Code Review       |
| - H70 patterns    |
| - Auto-fix issues |
+------------------+
       |
       v
+------------------+
| Generate Docs     |
| - README          |
| - API docs        |
+------------------+
       |
       v
+------------------+
| Completion Report |
| - Summary         |
| - Issues found    |
| - Quality score   |
+------------------+
       |
       v
    DONE ✓
```

### Events API Extensions

New event types needed:

```typescript
// Completion pipeline events
type CompletionEvent =
  | { type: 'build_started' }
  | { type: 'build_completed', success: boolean, errors?: string[] }
  | { type: 'tests_started' }
  | { type: 'tests_completed', passed: number, failed: number }
  | { type: 'security_scan_started' }
  | { type: 'security_scan_completed', findings: SecurityFinding[] }
  | { type: 'code_review_started' }
  | { type: 'code_review_completed', issues: CodeIssue[] }
  | { type: 'completion_report', report: CompletionReport }
```

### UI Components Needed

- Completion progress panel
- Security findings display
- Code review results
- Quality score badge
- Completion report view

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Projects that build | ~80% | 100% |
| Projects with tests | ~10% | 80% |
| Security issues caught | 0% | 95% |
| Code review coverage | 0% | 100% |
| Time to production-ready | Variable | Consistent |

---

## Open Questions

1. **Should completion pipeline be configurable per project?**
   - Some projects may not need all steps
   - Could slow down simple projects

2. **How to handle failures in completion pipeline?**
   - Retry? Skip? Block?
   - User notification?

3. **Integration with CI/CD?**
   - Generate GitHub Actions?
   - Vercel/Railway deployment?

4. **Quality score calculation?**
   - What factors?
   - How to display?

---

## Next Steps

1. **Immediate:** Enforce build verification in all workflows
2. **This week:** Add Scanner integration design
3. **This month:** Implement v1.0 completion pipeline
4. **Future:** Full pipeline with quality scoring
