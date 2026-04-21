# Spark <> Spawner Route PRD

Status: active
Date: 2026-04-21

## Product

`Spark Intelligence` uses `Spawner UI` as its execution plane.

`Telegram` is the operator surface.
`Spark` is the planner and conversation layer.
`Spawner` is the mission runner, provider dispatcher, and deep inspection UI.

## Problem

Spark can accept goals in Telegram, but mission execution and operator visibility need a cleaner, thinner path:

- one run contract
- one state model
- one control path
- lightweight reporting in Telegram
- full detail in Spawner

The system should not grow into a second orchestration platform or a second mission state model.

## Goal

Ship a reliable Telegram-to-Spawner execution route that lets an operator:

- start a mission from Telegram
- receive concise lifecycle updates
- inspect or control the mission from Telegram
- open Spawner for canvas, logs, and deeper debugging

## Non-Goals

- no new planner framework
- no recursive agent runtime redesign
- no approval system unless the Telegram route truly needs it
- no second board or workflow engine inside Spawner
- no parallel state model for Telegram summaries

## Users

Primary user:
- the Spark operator running and monitoring work from Telegram

Secondary user:
- the builder who opens Spawner to inspect missions in detail

## Core Principles

- One execution system: Spawner owns mission state.
- One state model: Telegram mirrors Spawner statuses exactly.
- Two views: Telegram for summary and control, Spawner for deep inspection.
- Compact surfaces: prefer one endpoint or one message over a framework.
- Diligence over feature count.

## Functional Requirements

### 1. Run Contract

Spark sends one compact request to Spawner:

- `goal`
- optional `providers`
- optional `projectPath`
- optional `chatId`
- optional `userId`
- optional `requestId`

Spawner returns:

- `success`
- `missionId`
- `requestId`
- `providers`
- `startedAt`

### 2. Correlation

Every Spark-originated mission should be traceable by:

- `missionId`
- `requestId`
- `chatId`
- `userId`

### 3. Mission Lifecycle

Telegram should expose:

- `/run <goal>`
- `/mission status <missionId>`
- `/mission pause <missionId>`
- `/mission resume <missionId>`
- `/mission kill <missionId>`

Spawner remains the source of truth for:

- `draft`
- `ready`
- `running`
- `paused`
- `completed`
- `failed`

### 4. Telegram Reporting

Telegram should send:

- mission started
- meaningful status changes
- completion
- failure
- explicit status responses on request

Telegram should not send:

- every internal log line
- a second interpretation of mission state

### 5. UI Role Split

Telegram:
- quick reporting
- compact mission board summary
- quick control actions

Spawner:
- full mission list
- canvas
- logs
- provider/session detail

## Telegram Board

Value: yes, if implemented as a message-native status board.

It should be:

- a text-first grouped summary
- based on real Spawner mission statuses
- useful for fast operator reports

It should not be:

- a separate workflow system
- a replacement for canvas
- a second kanban implementation inside Spawner

Suggested groups:

- Running
- Paused
- Completed
- Failed
- optional `Draft` if pre-run missions remain part of the flow

## Diligence Requirements

- State truth: Telegram mirrors Spawner state exactly.
- Idempotency: repeated `/run` requests should be identifiable and safe to reason about.
- Correlation: request, mission, chat, and user must be traceable together.
- Message discipline: report state changes, not log spam.
- Permission boundaries: control commands remain admin-gated.
- Failure clarity: errors should say whether the failure is in Telegram parsing, Spark bridge, mission creation, or provider execution.

## Phases

### Phase 1: Contract + Correlation

- lock the run request shape
- send `requestId`, `chatId`, and `userId`
- store correlation metadata on created missions

Success:
- one stable Spark run contract
- one traceable mission per Telegram run

### Phase 2: Event Relay

- relay mission lifecycle updates back to Spark or the bot
- keep mission control on the existing Spawner path

Success:
- Telegram sees mission progress without manual polling for normal runs

### Phase 3: Telegram Board

- add `/board`
- group by real mission state
- show compact mission summaries and quick actions

Success:
- operators can get a useful report from Telegram without opening Spawner

### Phase 4: Builder Visibility

- make Telegram-created missions easy to find in Spawner
- do not require canvas as the first inspection surface

Success:
- a builder can open Spawner and immediately locate bot-created runs

## Acceptance Criteria

- A Telegram `/run` creates a traceable Spawner mission.
- Telegram and Spawner use the same mission states.
- Operators can control runs without inventing a second protocol.
- Telegram can summarize mission state without becoming a second frontend.
- Spawner remains the deep-debug and canvas surface.
