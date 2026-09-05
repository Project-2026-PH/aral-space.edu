---
inclusion: always
---
<!------------------------------------------------------------------------------------
   Add rules to this file or a short description and have Kiro refine them for you.
   
   Learn about inclusion modes: https://kiro.dev/docs/steering/#inclusion-modes
-------------------------------------------------------------------------------------> 

# Codebase Navigation and Context Efficiency

## Purpose

Minimize unnecessary repository-wide exploration and context consumption while preserving implementation accuracy.

Use repository-aware tools such as CodeGraph as the **primary navigation and dependency-analysis mechanism** when available.

## Navigation Strategy

Prefer this investigation order:

1. **CodeGraph / repository-aware code intelligence**
2. **Targeted source-file inspection**
3. **Targeted text/symbol search**
4. **Broader repository search only when necessary**

### Use CodeGraph First For

Use CodeGraph to identify:

* relevant classes, functions, interfaces, and types
* callers and callees
* implementations
* dependency relationships
* module/package relationships
* affected components
* likely integration points
* impact of proposed changes

Use the graph to **reduce the search space before reading large amounts of source code**.

## Source Verification

CodeGraph is a navigation and relationship tool, not the final source of truth.

Before modifying code, inspect the relevant source implementation directly enough to verify:

* current behavior
* method signatures
* interfaces
* control flow
* error handling
* validation rules
* nearby invariants
* tests
* callers that may be affected

Never modify code solely from a CodeGraph summary when the exact implementation matters.

## When Direct Search Is Appropriate

Do NOT avoid direct search merely because CodeGraph is available.

Use targeted search or file inspection when:

* locating an exact string
* inspecting configuration
* finding prompt text
* examining JSON/schema content
* locating comments or documentation
* verifying imports
* searching generated or non-indexed files
* CodeGraph cannot resolve the required symbol
* CodeGraph appears stale or incomplete
* exact source content must be confirmed

## Context Efficiency

Avoid:

* reading entire directories unnecessarily
* reading large files when only one symbol is relevant
* repeatedly reading the same source
* performing repository-wide searches before understanding the architecture
* collecting large amounts of unrelated context

Prefer:

`CodeGraph → identify relevant symbols → identify affected files → targeted reads → implement`

rather than:

`repository-wide search → read many files → infer architecture → implement`

Reuse previously established context whenever possible.

## Accuracy Over Tool Preference

Tool selection must never compromise correctness.

If CodeGraph provides insufficient information, immediately fall back to targeted source inspection.

If a source file contradicts a graph representation, treat the **current source code as authoritative** and consider the graph potentially stale.

Do not force CodeGraph to answer questions it is not designed to answer.

## Scope Control

For every task:

1. Identify the smallest relevant part of the architecture.
2. Determine direct and indirect dependencies.
3. Inspect only the files necessary to understand the change.
4. Make the smallest compatible modification.
5. Verify affected callers and tests.
6. Expand investigation only when evidence requires it.

## Core Principle

> Use CodeGraph to understand relationships.
>
> Use source code to establish truth.
>
> Use targeted search to verify exact details.
>
> Expand context only when necessary.

The objective is not to minimize tool calls at all costs.

The objective is to minimize **unnecessary context consumption while maintaining implementation accuracy**.
