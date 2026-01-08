# PRD: Mind Integration Test Suite

## Overview
A focused test workflow to verify Mind v5 integration: Decisions, Issues, Sessions, Learnings, and Improvements.

## Goals
- Test that successful tasks create Decisions
- Test that failed tasks create Issues
- Test that session summaries are recorded
- Test that learnings are captured
- Test that improvements are auto-applied

## Features

### Feature 1: Database Setup (Will Succeed)
Set up a simple SQLite database schema for user data.
- Create users table with id, name, email
- Add indexes for performance
- **Expected**: Creates a Decision on completion

### Feature 2: API Endpoints (Will Succeed)
Create REST API endpoints for user CRUD operations.
- GET /users - list all users
- POST /users - create user
- GET /users/:id - get single user
- **Expected**: Creates a Decision on completion

### Feature 3: Intentional Failure Test (Will Fail)
Attempt to connect to a non-existent external service at invalid-service.localhost:9999.
- This task is DESIGNED TO FAIL
- Do not actually try to fix it
- Just report the failure
- **Expected**: Creates an Issue on failure

### Feature 4: Frontend Component (Will Succeed)
Create a simple Svelte component to display user list.
- UserList.svelte component
- Fetch data from API
- Display in table format
- **Expected**: Creates a Decision on completion

### Feature 5: Integration Test (Will Succeed)
Write a simple integration test for the user flow.
- Test user creation
- Test user retrieval
- **Expected**: Creates a Decision on completion

## Acceptance Criteria
- [ ] 4 out of 5 tasks complete successfully (80% success rate)
- [ ] Decisions tab shows 4 new entries
- [ ] Issues tab shows 1 new entry for the failed task
- [ ] Sessions tab shows session summary
- [ ] Learnings tab shows workflow pattern
- [ ] Improvements tab shows auto-applied improvement (not pending)

## Tech Stack
- SvelteKit
- SQLite
- TypeScript
