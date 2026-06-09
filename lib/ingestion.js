import crypto from "node:crypto";
import pdf from "pdf-parse";
import * as cheerio from "cheerio";

export function createDocId(seed) {
  return crypto.createHash("md5").update(seed).digest("hex").slice(0, 16);
}

export async function extractTextFromPdfBuffer(buffer) {
  const data = await pdf(buffer);
  return (data.text || "").trim();
}

export async function extractTextFromMarkdownBuffer(buffer) {
  return buffer.toString("utf8").trim();
}

export async function extractTextFromUrl(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch URL (${res.status})`);
  }
  const html = await res.text();
  const $ = cheerio.load(html);
  $("script,style,nav,footer,header,aside,noscript").remove();
  return $("body").text().replace(/\s+/g, " ").trim();
}

export function splitTextIntoChunks(text, chunkSize = 800, chunkOverlap = 150) {
  if (!text || !text.trim()) return [];

  const sentences = text.split(/(?<=[.?!])\s+/);
  const chunks = [];
  let current = [];
  let currentLen = 0;

  for (const sentenceRaw of sentences) {
    const sentence = sentenceRaw.trim();
    if (!sentence) continue;

    if (sentence.length > chunkSize) {
      if (current.length) {
        chunks.push(current.join(" "));
        current = [];
        currentLen = 0;
      }
      let start = 0;
      while (start < sentence.length) {
        const end = Math.min(start + chunkSize, sentence.length);
        chunks.push(sentence.slice(start, end));
        start += Math.max(1, chunkSize - chunkOverlap);
      }
      continue;
    }

    if (currentLen + sentence.length > chunkSize) {
      chunks.push(current.join(" "));
      const overlap = [];
      let overlapLen = 0;
      for (let i = current.length - 1; i >= 0; i -= 1) {
        const item = current[i];
        if (overlapLen + item.length > chunkOverlap) break;
        overlap.unshift(item);
        overlapLen += item.length + 1;
      }
      current = [...overlap, sentence];
      currentLen = current.reduce((sum, x) => sum + x.length, 0) + current.length - 1;
    } else {
      current.push(sentence);
      currentLen += sentence.length + (currentLen > 0 ? 1 : 0);
    }
  }

  if (current.length) {
    chunks.push(current.join(" "));
  }

  return chunks;
}

export async function extractTextFromFile(fileName, buffer) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "pdf") {
    return extractTextFromPdfBuffer(buffer);
  }
  if (["md", "markdown", "txt"].includes(ext || "")) {
    return extractTextFromMarkdownBuffer(buffer);
  }
  throw new Error("Unsupported file format. Use PDF, markdown, or txt.");
}
