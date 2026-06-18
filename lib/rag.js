import { pipeline, env } from "@xenova/transformers";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";

if (process.env.VERCEL) {
  env.cacheDir = "/tmp/transformers_cache";
}
import {
  addMessage,
  createEscalation,
  getAllChunks,
  getSessionMessages,
  getConfidenceThreshold
} from "./db.js";
import { searchChunksInQdrant } from "./qdrant.js";

const DEFAULT_CONFIDENCE_THRESHOLD = 0.4;
let embedder;
let embedderInitPromise;

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function localFallbackEmbedding(text) {
  const dim = 384;
  const vec = new Array(dim).fill(0);
  const tokens = text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  for (const token of tokens) {
    let h = 0;
    for (let i = 0; i < token.length; i += 1) {
      h = (h * 31 + token.charCodeAt(i)) >>> 0;
    }
    vec[h % dim] += 1;
  }
  const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0));
  if (norm === 0) return vec;
  return vec.map((x) => x / norm);
}

export async function getEmbedding(text) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const response = await ai.models.embedContent({
        model: "gemini-embedding-2",
        contents: text,
        config: { outputDimensionality: 384 }
      });
      if (response.embeddings?.[0]?.values) {
        return response.embeddings[0].values;
      }
    } catch (err) {
      console.error("Gemini embedding generation failed, falling back to local/transformers:", err);
    }
  }

  try {
    if (!embedder) {
      if (!embedderInitPromise) {
        embedderInitPromise = pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
      }
      embedder = await embedderInitPromise;
    }
    const out = await embedder(text, { pooling: "mean", normalize: true });
    return Array.from(out.data);
  } catch {
    return localFallbackEmbedding(text);
  }
}

export async function retrieveContext(query, threshold = DEFAULT_CONFIDENCE_THRESHOLD, topK = 4) {
  const queryEmbedding = await getEmbedding(query);

  // Attempt search via Qdrant if enabled
  const qdrantResult = await searchChunksInQdrant(queryEmbedding, threshold, topK);
  if (qdrantResult !== null) {
    return qdrantResult;
  }

  // Fallback to local SQLite scanning
  const allChunks = await getAllChunks();
  if (!allChunks.length) return { matches: [], maxSimilarity: 0 };

  const scored = allChunks
    .map((chunk) => ({
      ...chunk,
      similarity: cosineSimilarity(queryEmbedding, chunk.embedding)
    }))
    .sort((a, b) => b.similarity - a.similarity);

  const maxSimilarity = scored[0]?.similarity || 0;
  const matches = scored.slice(0, topK).filter((x) => x.similarity >= threshold);

  return { matches, maxSimilarity };
}

function rewriteQueryFromHistory(history, userQuery) {
  if (!history.length) return userQuery;
  const lower = userQuery.toLowerCase();
  const hasReference = ["it", "that", "they", "this", "those", "previous", "earlier"].some((x) =>
    lower.split(/\W+/).includes(x)
  );
  if (!hasReference) return userQuery;

  const lastUserTopic = history
    .slice()
    .reverse()
    .find((m) => m.sender === "user" && m.content.trim().length > 8);
  if (!lastUserTopic) return userQuery;
  return `${lastUserTopic.content} Follow-up: ${userQuery}`;
}

function buildEscalationSummary(sessionId, reason, history) {
  const lastUser = history.filter((m) => m.sender === "user").slice(-1)[0]?.content || "N/A";
  const topicGuess = /bill|payment|invoice/i.test(lastUser)
    ? "Billing"
    : /login|password|account/i.test(lastUser)
      ? "Account Access"
      : /error|bug|crash|install/i.test(lastUser)
        ? "Technical Support"
        : "General";

  const shortHistory = history.slice(-8).map((m) => `${m.sender.toUpperCase()}: ${m.content}`).join("\n");
  const summary = `Topic: ${topicGuess}\nReason: ${reason}\nSession: ${sessionId}\nLast user issue: ${lastUser}\nConversation:\n${shortHistory}`;
  return { topic: topicGuess, summary };
}

function buildGroundedAnswer(userQuery, contextChunks) {
  const context = contextChunks.slice(0, 2).map((c) => c.content).join("\n\n");
  return `Based on our support knowledge base, here is the best answer:\n\n${context.slice(0, 650)}\n\nIf this does not fully solve your issue, I can escalate you to a human agent.`;
}

export async function processSupportQuery(sessionId, userQuery, confidenceThreshold) {
  const threshold = Number.isFinite(confidenceThreshold) ? confidenceThreshold : await getConfidenceThreshold();
  const history = await getSessionMessages(sessionId);
  const rewritten = rewriteQueryFromHistory(history, userQuery);

  // Greeting & Courtesy Intent Bypass
  const normalized = userQuery.trim().toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
  const greetings = [
    "hi", "hello", "hey", "greetings", "good morning", "good afternoon", "good evening", 
    "howdy", "sup", "yo", "hi there", "hello there"
  ];
  const courtesies = [
    "thank you", "thanks", "thanks a lot", "thank you very much", "appreciate it", "great thanks"
  ];
  const closings = [
    "bye", "goodbye", "see you", "talk to you later", "farewell"
  ];

  if (greetings.includes(normalized)) {
    const reply = "Hello! I'm your AI support assistant. How can I help you today?";
    await addMessage(sessionId, "ai", reply);
    return {
      response: reply,
      escalated: false,
      similarity: 1.0,
      sources: []
    };
  }

  if (courtesies.includes(normalized)) {
    const reply = "You're very welcome! Feel free to ask if you have any other questions.";
    await addMessage(sessionId, "ai", reply);
    return {
      response: reply,
      escalated: false,
      similarity: 1.0,
      sources: []
    };
  }

  if (closings.includes(normalized)) {
    const reply = "Goodbye! Have a great day, and feel free to reach out again if you need support.";
    await addMessage(sessionId, "ai", reply);
    return {
      response: reply,
      escalated: false,
      similarity: 1.0,
      sources: []
    };
  }

  const { matches, maxSimilarity } = await retrieveContext(rewritten, threshold, 4);

  if (maxSimilarity < threshold || !matches.length) {
    const reason = `Low retrieval confidence (${maxSimilarity.toFixed(2)} < ${threshold.toFixed(2)})`;
    const handoff = buildEscalationSummary(sessionId, reason, [...history, { sender: "user", content: userQuery }]);
    await createEscalation(sessionId, "low_confidence", handoff.summary, handoff.topic);

    const systemMsg =
      "I am escalating this request to a human support specialist with full chat context, so you do not need to repeat anything.";
    await addMessage(sessionId, "system", systemMsg);

    return {
      response: systemMsg,
      escalated: true,
      reason: "low_confidence",
      similarity: maxSimilarity
    };
  }

  const outOfScope = /(weather forecast|weather today|\bweather\b|movie review|cricket score|sports score|nfl score|nba score|recipe|cook.*food|write.*game|stock (price|market|tip)|lottery|gambling|betting odds|relationship advice|breakup advice|medical diagnosis|legal advice|tax advice|homework help|write.*essay|translate.*language|tell me a joke|what.*meaning of life)/i.test(userQuery);
  if (outOfScope) {
    const reason = "Out-of-scope query";
    const handoff = buildEscalationSummary(sessionId, reason, [...history, { sender: "user", content: userQuery }]);
    await createEscalation(sessionId, "out_of_scope", handoff.summary, handoff.topic);

    const systemMsg =
      "This appears out of scope for product support. I have escalated this to a human agent with context summary.";
    await addMessage(sessionId, "system", systemMsg);

    return {
      response: systemMsg,
      escalated: true,
      reason: "out_of_scope",
      similarity: maxSimilarity
    };
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  let responseText = "";

  const context = matches
    .map((m, idx) => `Source ${idx + 1} (doc ${m.document_id}):\n${m.content}`)
    .join("\n\n");

  const systemPrompt =
    "You are a customer support AI. Answer only from the provided context. Be concise and helpful. If the context doesn't cover the question, say you'll escalate to a human agent.";

  // Build prior turn history (exclude current user message which is last in history)
  const priorTurns = history
    .slice(0, -1)
    .slice(-8)
    .filter((m) => m.sender === "user" || m.sender === "ai");

  if (geminiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const geminiContents = [];
      for (const m of priorTurns) {
        geminiContents.push({
          role: m.sender === "ai" ? "model" : "user",
          parts: [{ text: m.content }],
        });
      }
      geminiContents.push({
        role: "user",
        parts: [{ text: `Context:\n${context}\n\nQuestion: ${userQuery}` }],
      });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: geminiContents,
        config: { systemInstruction: systemPrompt, temperature: 0.1 },
      });
      responseText = response.text?.trim() || "";
    } catch (err) {
      console.error("Gemini API error:", err);
      responseText = "";
    }
  }

  if (!responseText && groqKey) {
    try {
      const client = new OpenAI({
        apiKey: groqKey,
        baseURL: "https://api.groq.com/openai/v1",
      });
      const chatMessages = [{ role: "system", content: systemPrompt }];
      for (const m of priorTurns) {
        chatMessages.push({
          role: m.sender === "ai" ? "assistant" : "user",
          content: m.content,
        });
      }
      chatMessages.push({
        role: "user",
        content: `Context:\n${context}\n\nQuestion: ${userQuery}`,
      });
      const completion = await client.chat.completions.create({
        model: "llama-3.1-8b-instant",
        temperature: 0.1,
        messages: chatMessages,
      });
      responseText = completion.choices?.[0]?.message?.content?.trim() || "";
    } catch (err) {
      console.error("Groq API error:", err);
      responseText = "";
    }
  }

  if (!responseText) {
    responseText = buildGroundedAnswer(userQuery, matches);
  }

  await addMessage(sessionId, "ai", responseText);
  return {
    response: responseText,
    escalated: false,
    similarity: maxSimilarity,
    sources: matches.map((m) => ({
      id: m.id,
      document_id: m.document_id,
      chunk_index: m.chunk_index,
      similarity: Number(m.similarity.toFixed(4))
    }))
  };
}
