import { describe, it, expect } from "vitest";
import { extractQueryKeywords, buildQueryText } from "../keywords.js";

describe("extractQueryKeywords", () => {
  it("extracts package from import statement", () => {
    const result = extractQueryKeywords(`import axios from 'axios';`);
    expect(result).toContain("axios");
  });

  it("extracts package from require()", () => {
    const result = extractQueryKeywords(`const x = require('express');`);
    expect(result).toContain("express");
  });

  it("extracts package from from '...' syntax", () => {
    const result = extractQueryKeywords(`import { useState } from 'react';`);
    expect(result).toContain("react");
  });

  it("strips @scope prefix and takes first segment", () => {
    const result = extractQueryKeywords(`import sdk from '@anthropic-ai/sdk';`);
    expect(result).toContain("anthropic-ai");
  });

  it("extracts from npm install command", () => {
    const result = extractQueryKeywords(`run: npm install zustand`);
    expect(result).toContain("zustand");
  });

  it("extracts from pnpm add command", () => {
    const result = extractQueryKeywords(`pnpm add vitest`);
    expect(result).toContain("vitest");
  });

  it("extracts from pkg@version pattern", () => {
    const result = extractQueryKeywords(`I use axios@1.6.0 in my project`);
    expect(result).toContain("axios");
  });

  it("deduplicates results", () => {
    const result = extractQueryKeywords(`import axios from 'axios'; axios@1.0.0`);
    expect(result.filter(k => k === "axios")).toHaveLength(1);
  });

  it("returns empty array for plain prose", () => {
    const result = extractQueryKeywords("how do I make a network request?");
    expect(result).toEqual([]);
  });
});

describe("buildQueryText", () => {
  it("joins keywords with space", () => {
    expect(buildQueryText(["axios", "fetch"], "fallback")).toBe("axios fetch");
  });

  it("uses fallback when keywords empty", () => {
    expect(buildQueryText([], "how to make requests")).toBe("how to make requests");
  });

  it("truncates fallback to 200 chars", () => {
    const long = "x".repeat(300);
    expect(buildQueryText([], long)).toHaveLength(200);
  });
});
