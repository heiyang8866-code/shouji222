import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

async function run() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("No API key");
  const ai = new GoogleGenAI({ apiKey });
  const stream = await ai.models.generateContentStream({
    model: 'gemini-2.5-pro',
    contents: 'Thinking test. What is 2+2?',
    config: {
      thinkingConfig: { includeThoughts: true }
    }
  });

  for await (const chunk of stream) {
    if (chunk.candidates && chunk.candidates[0].content.parts) {
      console.log(JSON.stringify(chunk.candidates[0].content.parts));
    }
  }
}
run().catch(console.error);
