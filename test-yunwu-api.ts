import { callYunwuVideoAPI } from "./src/lib/api";
import { config } from "dotenv";

config();

async function main() {
  const apiKey = process.env.GEMINI_API_KEY || "dummy-key-sk-123456789";
  if (!apiKey) {
    console.log("No API key");
    return;
  }
  
  try {
    const res = await fetch('https://yunwu.ai/v1/video/create', {
        method: 'POST',
        headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            prompt: "A dog running in a park",
            model: "veo3.1-components",
            aspect_ratio: "16:9",
            duration: 4
        })
    });
    console.log(res.status, await res.text());
  } catch (e) {
    console.log(e.message);
  }
}

main();
