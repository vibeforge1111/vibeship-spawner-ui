# Spark Grants Contracts V1 Verification Plan

This staged mission is read-only. It should not create accounts, publish copy, or dispatch provider execution until the gates below are updated.

## Local Checks

Run:

```bash
node scripts/validate-spark-grants-mission.mjs
```

Expected result: all required artifact files exist, the mission is local-only/read-only, Spark_coded is the v1 account choice, WL wording defaults to `WL spots`, and `free WLs` remains blocked pending contract review.

## Manual Review

1. Verify Spark_coded account ownership, recovery access, and whether it can represent Spark Grants for v1.
2. Decide whether BookofAgents should be reserved as a later account or brand lane.
3. Have the Spark Grants contract outline reviewed before using public CTA or WL allocation language.
4. Update `validation-ledger.json` with pass/fail/blocker evidence for every gate.

## Telegram Voice Proof

Run or confirm these in the live Telegram surface before claiming voice readiness:

```text
/voice speak SPARK_VOICE_QA_DELIVERY_OK_AFTER_RESTART
/voice speak SPARK_VOICE_QA_DELIVERY_OK_ENVELOPE_FIX
/voice speak SPARK_VOICE_QA_DELIVERY_OK_OWNER_FIX
/voice speak SPARK_VOICE_QA_DELIVERY_OK_STATE_FIX
```

## Launch Copy Gate

Use `WL spots` by default. Use `free WLs` only after the WL Allocation Terms confirm there is no payment, purchase, staking, service obligation, or other consideration requirement.
