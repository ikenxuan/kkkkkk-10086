# 多线程下载 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in, stable HTTP Range segmented downloader to the unified download path and expose it through Guoba with a default-off switch.

**Architecture:** Keep `Base.downloadFile()` and `Networks.downloadStream()` contracts unchanged. Add a guarded multipart path inside `Networks` that probes range support, writes validated ranges into a same-directory staging file, retries individual parts, and atomically publishes only after all parts succeed; otherwise retain the existing sequential path.

**Tech Stack:** Native ESM JavaScript, `@karinjs/axios`, Node `fs/promises`, Node streams, `node:test`, and a local `node:http` fixture. No new runtime dependency.

## Global Constraints

- `downloadMultiThread` defaults to `false`.
- `downloadConcurrency` defaults to `4` and is runtime-clamped to `2–8`.
- Live streams, unknown-size resources, non-206 range probes, malformed ranges, and unstable resources use the sequential path or fail safely without publishing partial output.
- Existing `downloadFile()` return shape remains `{ filepath, totalBytes }`.
- `downloadMaxSpeed` is a shared per-file aggregate limit in multipart mode.
- Do not modify image buffering or unrelated platform concurrency.

---

### Task 1: Add configuration and Guoba controls

**Files:**
- Modify: `config/default_config/upload.yaml:31-41`
- Modify: `guoba.support.js:410-433`
- Modify: `module/utils/Config.js:8-23,196-206`
- Test: `test/multithread-config.test.js`

**Interfaces:**
- Produces `Config.upload.downloadMultiThread` as boolean and `Config.upload.downloadConcurrency` as number.
- Guoba exposes `upload.downloadMultiThread` switch and `upload.downloadConcurrency` number input constrained to `2–8`.

- [ ] **Step 1: Write the failing configuration test**

Create a Node test that parses the default upload YAML and asserts `downloadMultiThread === false` and `downloadConcurrency === 4`; assert the Guoba source contains both `upload.*` schema fields.

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test test/multithread-config.test.js`
Expected: FAIL because the keys and schema entries do not yet exist.

- [ ] **Step 3: Add default values and schema entries**

Add:

```yaml
downloadMultiThread: false
downloadConcurrency: 4
```

next to the existing download settings. Add `sw('upload.downloadMultiThread', '启用多线程下载', ...)` and `num('upload.downloadConcurrency', '下载并发数', 2, 8, '路', ...)` beside the existing download controls.

Add both names to `APP_UPLOAD_KEYS` and document them in `UploadConfig` JSDoc so `Config.All()` compatibility writes preserve the fields.

- [ ] **Step 4: Run the test and lint**

Run: `node --test test/multithread-config.test.js`
Expected: PASS.

Run: `npm run lint -- --no-fix`
Expected: ESLint completes without errors.

- [ ] **Step 5: Commit**

```bash
git add config/default_config/upload.yaml guoba.support.js module/utils/Config.js test/multithread-config.test.js
git commit -m "feat: add multithread download configuration"
```

### Task 2: Extract deterministic multipart helpers and fixture tests

**Files:**
- Create: `module/utils/MultipartDownloader.js`
- Create: `test/multipart-downloader.test.js`

**Interfaces:**
- `downloadMultipart(options)` accepts `{ url, filepath, headers, axios, maxRetries, concurrency, maxSpeed, onProgress }` and returns `{ filepath, totalBytes }`.
- Helpers validate inclusive ranges and responses without buffering an entire file.

- [ ] **Step 1: Write failing tests**

Use `node:http.createServer()` to serve a deterministic buffer and implement tests for: valid out-of-order ranges, concurrency cap, malformed `Content-Range`, short body, and per-part retry. Assert final bytes exactly equal fixture bytes and failed runs remove only the staging file.

- [ ] **Step 2: Run tests and verify failure**

Run: `node --test test/multipart-downloader.test.js`
Expected: FAIL because `MultipartDownloader.js` is absent.

- [ ] **Step 3: Implement range planning and validation**

Implement pure helpers for runtime clamping, inclusive range planning, `Content-Range` parsing, and response validation. Require status `206`, exact requested start/end/total, identity encoding, and exact received byte count.

- [ ] **Step 4: Implement bounded workers and staging writes**

Create a unique same-directory staging path, preallocate it, launch at most `concurrency` workers, request each range with `responseType: 'stream'`, and write chunks at the assigned offset through file handles. Track committed bytes per part for progress and close streams/handles in `finally`.

- [ ] **Step 5: Implement per-part retry and cancellation**

Retry transport errors, timeouts, `429`, `503`, and selected `5xx` up to `maxRetries` with bounded backoff. On structural validation failure or exhausted retries, abort sibling requests, delete owned staging output, and rethrow.

- [ ] **Step 6: Publish atomically**

After every part completes, verify staging size equals total, close handles, and replace the final path only after success. Preserve an existing final file when multipart fails.

- [ ] **Step 7: Run tests and lint**

Run: `node --test test/multipart-downloader.test.js`
Expected: PASS.

Run: `npm run lint -- --no-fix`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add module/utils/MultipartDownloader.js test/multipart-downloader.test.js
git commit -m "feat: implement validated multipart downloader"
```

### Task 3: Integrate multipart selection into Networks

**Files:**
- Modify: `module/utils/Networks.js:1-10,350-530`
- Modify: `module/utils/Base.js:571-620` only if option forwarding is required
- Test: `test/download-stream-integration.test.js`

**Interfaces:**
- `Networks.downloadStream()` continues accepting current options and returns the existing result.
- It reads `Config.upload.downloadMultiThread` and `Config.upload.downloadConcurrency`, while preserving explicit per-call behavior and the sequential implementation.

- [ ] **Step 1: Write failing integration tests**

Cover default-off sequential behavior, enabled multipart behavior for a large finite Range-capable fixture, `200` probe fallback, unknown-size fallback, and live-stream sequential behavior.

- [ ] **Step 2: Run tests and verify failure**

Run: `node --test test/download-stream-integration.test.js`
Expected: FAIL because `Networks` never selects multipart.

- [ ] **Step 3: Add guarded capability probe**

When the switch is exactly `true`, perform the existing `bytes=0-0` probe with identity encoding, parse finite total size and validator, and require `206`. Apply an internal minimum size threshold so small files remain sequential. If the probe is not suitable, invoke the existing sequential branch unchanged.

- [ ] **Step 4: Wire shared options and progress**

Pass the existing headers, Axios instance/agents, retry policy, aggregate speed configuration, and progress callback into `downloadMultipart()`. Ensure caller-provided Range cannot override generated segment ranges.

- [ ] **Step 5: Run integration tests and lint**

Run: `node --test test/download-stream-integration.test.js test/multipart-downloader.test.js test/multithread-config.test.js`
Expected: PASS.

Run: `npm run lint -- --no-fix`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add module/utils/Networks.js module/utils/Base.js test/download-stream-integration.test.js
git commit -m "feat: enable opt-in multipart downloads"
```

### Task 4: Verify cleanup, compatibility, and documentation

**Files:**
- Modify: `README.md` or the closest existing configuration documentation only if the project documents upload settings there
- Test: `test/download-cleanup.test.js`

- [ ] **Step 1: Add failure-path tests**

Assert a changed ETag or total size cancels workers, removes owned staging output, leaves an existing final file unchanged, and leaves no active timers or open test-server connections.

- [ ] **Step 2: Add config compatibility coverage**

Exercise `Config.ModifyPro('upload', { downloadMultiThread: true, downloadConcurrency: 6 })` against a temporary YAML fixture and assert native boolean/number serialization.

- [ ] **Step 3: Run complete verification**

Run: `node --test test/*.test.js`
Expected: all tests PASS.

Run: `npm run lint -- --no-fix`
Expected: PASS.

- [ ] **Step 4: Review diff and commit**

```bash
git diff master...HEAD --check
git status --short
git add README.md test/download-cleanup.test.js
git commit -m "test: verify multipart download failure cleanup"
```
