import dotenv from "dotenv";
dotenv.config();

async function run() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("No API key");
  const modelId = "gemini-2.5-pro";
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent?key=${apiKey}&alt=sse`;
  const body = {
    contents: [ { role: 'user', parts: [ { text: "Solve 2x - 3 = 5 step by step." } ] } ],
    generationConfig: {
      temperature: 1,
      topP: 1,
      thinkingConfig: { includeThoughts: true, thinkingBudget: 8192 }
    }
  };
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) { console.error(await response.text()); return; }
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  if (reader) {
    let result = await reader.read();
    let textChunk = decoder.decode(result.value);
    console.log(textChunk.substring(0, 500));
  }
}
run().catch(console.error);
