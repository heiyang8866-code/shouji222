import { SYSTEM_PROMPTS, SAFETY_SETTINGS } from "../constants";
import { FuncType, Message } from "../types";

const GEMINI_API_BASE_URL = "https://yunwu.ai/v1beta/models";

function getCleanAuthHeader(apiKey: string) {
  const clean = apiKey.trim();
  if (clean.toLowerCase().startsWith("bearer ")) {
    return clean;
  }
  return `Bearer ${clean}`;
}

function getCleanApiKey(apiKey: string) {
  let clean = apiKey.trim();
  if (clean.toLowerCase().startsWith("bearer ")) {
    clean = clean.slice(7).trim();
  }
  return clean;
}

function buildGeminiRequestBody(
  messages: Message[],
  func: FuncType,
  subFunc?: string,
  modelId?: string,
) {
  const isImageModel =
    modelId?.includes("image") ||
    modelId?.includes("nanobanana") ||
    func === "yellowImage";
  const contents = messages.map((m) => {
    const parts: any[] = [{ text: m.content }];
    if (m.images && m.images.length > 0) {
      m.images.forEach((img) => {
        const mimeTypeMatch = img.match(/^data:([^;]+);base64,/);
        const base64Data = img.replace(/^data:.*?;base64,/, "");
        if (base64Data && mimeTypeMatch) {
          if (isImageModel) {
            parts.push({
              inline_data: { data: base64Data, mime_type: mimeTypeMatch[1] },
            });
          } else {
            parts.push({
              inlineData: { data: base64Data, mimeType: mimeTypeMatch[1] },
            });
          }
        }
      });
    }
    return {
      role: m.role === "user" ? "user" : "model",
      parts,
    };
  });

  if (func === "yellowImage" || isImageModel) {
    let extractedRatio = "1:1";
    let extractedResolution = "1K";
    let apiAspectRatio = "1:1";

    // Extract ratio and resolution and inject them as explicit English prompt parts if possible
    contents.forEach((content) => {
      content.parts.forEach((part) => {
        if (part.text) {
          const match = part.text.match(
            /【要求：比例 ([^，]*)，分辨率 ([^，]*)，质量 ([^，]*)(?:，数量 ([^】]*))?】/,
          );
          if (match) {
            extractedRatio = match[1];
            const resolution = match[2];
            const quality = match[3];
            part.text = part.text.replace(/【要求：.*?】\s*/, "");

            // Map resolution to imageSize string for Gemini
            if (resolution === "4k" || resolution === "4K")
              extractedResolution = "4K";
            else if (resolution === "2k" || resolution === "2K")
              extractedResolution = "2K";
            else if (resolution === "1080p") extractedResolution = "1K";
            else if (resolution === "720p") extractedResolution = "1K";
            else extractedResolution = "1K"; // Force 1K as it's definitely supported.

            // Expansion: support all ratios allowed in UI
            apiAspectRatio = extractedRatio;
            if (
              ![
                "1:1",
                "3:4",
                "4:3",
                "9:16",
                "16:9",
                "2:3",
                "3:2",
                "4:5",
                "5:4",
                "21:9",
                "9:21",
                "1:2",
                "2:1",
              ].includes(apiAspectRatio)
            ) {
              // If it's a very extreme ratio like 8:1, some backends might fail or fallback.
              // We'll try to let it pass if it's one of the standard ones, otherwise fallback to 16:9 for safety
              // but actually, let's allow common ones at least.
              if (
                apiAspectRatio === "8:1" ||
                apiAspectRatio === "1:8" ||
                apiAspectRatio === "4:1" ||
                apiAspectRatio === "1:4"
              ) {
                // Keep them as is, hoping the backend supports them
              } else {
                apiAspectRatio = "16:9";
              }
            }

            let enhancements = "";
            if (extractedRatio)
              enhancements += `Aspect ratio ${extractedRatio}.`;
            if (resolution) {
              if (resolution === "4k")
                enhancements +=
                  ", 4k extremely high resolution, masterpiece details";
              else if (resolution === "2k")
                enhancements += ", 2k high resolution, highly detailed";
              else if (resolution === "1080p")
                enhancements += ", 1080p hd resolution";
              else enhancements += `, ${resolution} resolution`;
            }
            if (quality === "hd")
              enhancements +=
                ", ultra high definition, intricate details, best quality";
            if (enhancements) {
              part.text += enhancements;
            }
          }
        }
      });
    });

    return {
      contents,
      generationConfig: {
        responseModalities: ["IMAGE"],
        imageConfig: {
          aspectRatio: apiAspectRatio,
          imageSize: extractedResolution,
        },
      },
    };
  }

  let systemPrompt = SYSTEM_PROMPTS[func] || SYSTEM_PROMPTS.chat;

  if (func === "drama" && subFunc) {
    systemPrompt += `\n\n【重要指令】用户已选择功能：${subFunc}。请直接跳过步骤1的询问，直接开始执行该功能的步骤2。`;
  }

  if (func === "seedance") {
    if (subFunc === "素材提取") {
      systemPrompt = SYSTEM_PROMPTS.material_extraction;
    } else if (subFunc) {
      systemPrompt += `\n\n【重要指令】用户已选择功能：${subFunc}。请直接按照该功能的格式要求开始转换剧本。`;
    }
  }

  const isThinkingModel =
    modelId?.toLowerCase().includes("thinking") ||
    modelId?.toLowerCase().includes("gemini-3.1-pro") ||
    modelId?.toLowerCase().includes("gemini-2.5-pro");

  let thinkingBudgetProp = {};
  if (isThinkingModel) {
    // Determine base budget based on model
    let baseBudget = 16384;
    if (modelId?.toLowerCase().includes("gemini-2.5-pro")) {
      baseBudget = 24576; // High reasoning for 2.5 Pro
    } else if (modelId?.toLowerCase().includes("gemini-3.1-pro")) {
      baseBudget = 32768; // Max reasoning for 3.1 Pro
    }

    // For general chat, we lower the budget to minimize thinking time and speed up answers
    if (func === "chat") {
      baseBudget = 1024;
    }

    // Boost budget specifically for Seedance, Drama and Canvas functions as they require high precision and complexity
    if (func === "seedance" || func === "drama" || func === "canvasDrama") {
      // Ensure these critical functions always get 32k budget if the model supports thinking
      baseBudget = 32768;
    }

    thinkingBudgetProp = { thinkingBudget: baseBudget };
  }

  return {
    contents,
    systemInstruction: {
      parts: [{ text: systemPrompt }],
      role: "user",
    },
    safetySettings: SAFETY_SETTINGS,
    generationConfig: {
      temperature: 1,
      topP: 1,
      // For thinking models, maxOutputTokens must be greater than thinkingBudget.
      // We set a high limit (64k) for thinking models to accommodate both thoughts and response.
      maxOutputTokens: isThinkingModel ? 65536 : 8192,
      ...(isThinkingModel
        ? {
            thinkingConfig: {
              includeThoughts: true,
              ...thinkingBudgetProp,
            },
          }
        : {}),
    },
  };
}

export async function callGeminiStreamAPI(
  messages: Message[],
  func: FuncType,
  modelId: string,
  apiKey: string,
  subFunc: string | undefined,
  onChunk: (text: string) => void,
  onThinking: (text: string) => void,
  signal: AbortSignal,
) {
  if (!apiKey) {
    throw new Error("请在系统设置中输入 API Key");
  }

  const cleanKey = getCleanApiKey(apiKey);
  const authHeader = getCleanAuthHeader(apiKey);
  const apiUrl = `${GEMINI_API_BASE_URL}/${modelId}:streamGenerateContent?key=${cleanKey}&alt=sse`;
  const body = buildGeminiRequestBody(messages, func, subFunc, modelId);
  const fetchOptions: RequestInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify(body),
    signal,
  };

  const response = await fetch(apiUrl, fetchOptions);

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    let errMsg = `API错误: ${response.status}`;
    try {
      const errData = JSON.parse(errText);
      if (errData?.error?.message) {
        errMsg = errData.error.message;
        if (errMsg.includes("NO_IMAGE")) {
          errMsg =
            "图片生成失败(NO_IMAGE)：可能触发了安全拦截或遇到了内部错误，请修改提示词或稍后再试。";
        }
      }
    } catch (e) {
      if (errText) errMsg += " - " + errText.slice(0, 200);
    }
    throw new Error(errMsg);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No reader available");
  const decoder = new TextDecoder();
  let fullText = "";
  let thinkingText = "";
  let buffer = "";

  try {
    let lastChunkTime = 0;
    let lastThinkingTime = 0;
    const THROTTLE_MS = 60; // Throttling threshold

    while (true) {
      if (signal.aborted) {
        throw new DOMException('The user aborted a request.', 'AbortError');
      }
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || "";

      let hasNewText = false;
      let hasNewThinking = false;

      for (const line of lines) {
        if (signal.aborted) {
          throw new DOMException('The user aborted a request.', 'AbortError');
        }
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith("data:")) {
          const jsonStr = trimmedLine.slice(5).trim();
          if (!jsonStr || jsonStr === "[DONE]") continue;
          try {
            const data = JSON.parse(jsonStr);
            const parts = data.candidates?.[0]?.content?.parts || [];
            for (const part of parts) {
              if (part.thought) {
                if (typeof part.thought === "string") {
                  thinkingText += part.thought;
                  hasNewThinking = true;
                } else if (part.text && part.text !== "true") {
                  thinkingText += part.text;
                  hasNewThinking = true;
                }
              } else if (part.reasoning_content) {
                thinkingText += part.reasoning_content;
                hasNewThinking = true;
              } else if (part.inlineData || part.inline_data) {
                const inlineData = part.inlineData || part.inline_data;
                const mimeType =
                  inlineData.mimeType || inlineData.mime_type || "image/jpeg";
                const data = inlineData.data;
                fullText += `\n\n![Generated Image](data:${mimeType};base64,${data})\n\n`;
                hasNewText = true;
              } else if (part.text && part.text !== "true") {
                fullText += part.text;
                hasNewText = true;
              }
            }
          } catch (e) {
            if (
              e instanceof Error &&
              e.message !== "Unexpected end of JSON input"
            ) {
              console.error("JSON parse error or API error:", e);
            }
          }
        }
      }

      const now = Date.now();
      if (hasNewText && now - lastChunkTime > THROTTLE_MS) {
        onChunk(fullText);
        lastChunkTime = now;
      }
      if (hasNewThinking && now - lastThinkingTime > THROTTLE_MS) {
        onThinking(thinkingText);
        lastThinkingTime = now;
      }
    }
    
    // Ensure final states are pushed at the end
    if (fullText) onChunk(fullText);
    if (thinkingText) onThinking(thinkingText);

  } finally {
    reader.releaseLock();
  }
  return { text: fullText, thinking: thinkingText };
}

async function callYunwuImageAPI(
  messages: Message[],
  modelId: string,
  apiKey: string,
  signal?: AbortSignal,
) {
  const lastUserMsg = messages.filter((m) => m.role === "user").pop();
  if (!lastUserMsg) throw new Error("No user message found");

  // Collect ALL images from the most recent user message that has them
  const lastUserMsgWithImages = messages
    .filter((m) => m.role === "user" && m.images && m.images.length > 0)
    .pop();
  const images: string[] = lastUserMsgWithImages?.images || [];

  let prompt = lastUserMsg.content;
  let ratio = "1:1";
  let quality = "auto";
  let resolution = "1080p";
  let count = 1;

  const match = prompt.match(
    /【要求：比例 ([^，]*)，分辨率 ([^，]*)，质量 ([^，]*)(?:，数量 ([^】]*))?】/,
  );
  if (match) {
    ratio = match[1];
    resolution = match[2];
    quality = match[3];
    count = parseInt(match[4], 10) || 1;
    prompt = prompt.replace(/【要求：.*?】\s*/, "");

    // Safety check for quality values for gpt-video-2 / gpt-image-2
    if (quality === "standard") quality = "auto";
    if (quality === "hd") quality = "high";

    if (resolution) {
      if (resolution === "4k")
        prompt += "，4k极高分辨率，全细节画面，大师级画质";
      else if (resolution === "2k") prompt += "，2k高分辨率，优质清晰画面";
      else if (resolution === "1080p") prompt += "，1080p高清分辨率";
      else if (resolution === "720p") prompt += "，720p分辨率";
      else prompt += `，${resolution}分辨率`;
    }

    if (quality === "hd") {
      prompt += "，超高清细节。";
    }
  }

  let width = 1024;
  let height = 1024;
  let baseDimension = 1024;

  // Optimization: standard base dimensions for faster generation
  if (resolution === "720p") baseDimension = 768;
  else if (resolution === "1080p") baseDimension = 1024;
  else if (resolution === "2k") baseDimension = 1200;
  else if (resolution === "4k") baseDimension = 1440;

  // Map ratios to standard dimensions to avoid "DeploymentNotFound" or size errors on some backends
  if (ratio === "16:9") {
    width = Math.round((baseDimension * 1.5) / 16) * 16;
    height = Math.round(baseDimension / 16) * 16;
    width = Math.round((height * 16) / 9 / 16) * 16;
  } else if (ratio === "9:16") {
    width = Math.round(baseDimension / 16) * 16;
    height = Math.round((width * 16) / 9 / 16) * 16;
  } else if (ratio === "4:3") {
    height = Math.round(baseDimension / 16) * 16;
    width = Math.round((height * 4) / 3 / 16) * 16;
  } else if (ratio === "3:4") {
    width = Math.round(baseDimension / 16) * 16;
    height = Math.round((width * 4) / 3 / 16) * 16;
  } else if (ratio === "3:2") {
    height = Math.round(baseDimension / 16) * 16;
    width = Math.round((height * 3) / 2 / 16) * 16;
  } else if (ratio === "2:3") {
    width = Math.round(baseDimension / 16) * 16;
    height = Math.round((width * 3) / 2 / 16) * 16;
  } else if (ratio === "4:5") {
    width = Math.round(baseDimension / 16) * 16;
    height = Math.round((width * 1.25) / 16) * 16;
  } else if (ratio === "5:4") {
    height = Math.round(baseDimension / 16) * 16;
    width = Math.round((height * 1.25) / 16) * 16;
  } else if (ratio === "21:9") {
    height = Math.round(baseDimension / 16) * 16;
    width = Math.round((height * 21) / 9 / 16) * 16;
  } else if (ratio === "9:21") {
    width = Math.round(baseDimension / 16) * 16;
    height = Math.round((width * 21) / 9 / 16) * 16;
  } else if (ratio === "1:2") {
    width = Math.round(baseDimension / 16) * 16;
    height = width * 2;
  } else if (ratio === "2:1") {
    height = Math.round(baseDimension / 16) * 16;
    width = height * 2;
  } else if (ratio === "8:1") {
    height = Math.round(baseDimension / 32) * 32;
    width = height * 8;
  } else if (ratio === "1:8") {
    width = Math.round(baseDimension / 32) * 32;
    height = width * 8;
  } else if (ratio === "4:1") {
    height = Math.round(baseDimension / 16) * 16;
    width = height * 4;
  } else if (ratio === "1:4") {
    width = Math.round(baseDimension / 16) * 16;
    height = width * 4;
  } else {
    width = Math.round(baseDimension / 16) * 16;
    height = width;
  }

  // Final bounds check to ensure we don't exceed extreme limits that cause 429/Deployment errors
  const MAX_PIXELS = 2073600; // 1920x1080 equivalent
  const currentPixels = width * height;
  if (currentPixels > MAX_PIXELS) {
    const scale = Math.sqrt(MAX_PIXELS / currentPixels);
    width = Math.round((width * scale) / 16) * 16;
    height = Math.round((height * scale) / 16) * 16;
  }

  let sizeStr = `${width}x${height}`;

  const cleanKey = getCleanApiKey(apiKey);
  const authHeader = getCleanAuthHeader(apiKey);

  const endpoint =
    images.length > 0
      ? "https://yunwu.ai/v1/images/edits"
      : "https://yunwu.ai/v1/images/generations";

  let fetchOptions: RequestInit = {};

  // Reverting to 'gpt-image-2' as the primary model identifier for this specific endpoint
  const actualModelName = "gpt-image-2";

  if (images.length > 0) {
    const formData = new FormData();
    formData.append("model", actualModelName);
    formData.append("prompt", prompt);
    formData.append("n", count.toString());
    formData.append("size", sizeStr);
    formData.append("quality", quality);

    images.forEach((img, idx) => {
      const b64Data = img.split(",")[1];
      const mimeMatch = img.match(/^data:([^;]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : "image/png";
      try {
        const byteString = atob(b64Data);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let j = 0; j < byteString.length; j++) {
          ia[j] = byteString.charCodeAt(j);
        }
        const blob = new Blob([ab], { type: mimeType });
        // Use 'image' for the first one and potentially others if the backend supports multiple on the same key
        // Or if it's Yunwu gpt-image-2, it might expect 'image', 'image_1', 'image_2'...
        // but given "recognized ONLY the first one", sending them all on 'image' handles standard multi-file.
        formData.append("image", blob, `reference-${idx}.png`);
      } catch (e) {
        console.error("Failed to parse image from base64:", e);
      }
    });

    fetchOptions = {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: authHeader,
      },
      body: formData,
      signal,
    };
  } else {
    const body = {
      model: actualModelName,
      prompt: prompt,
      n: count,
      size: sizeStr,
      quality: quality,
    };
    fetchOptions = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify(body),
      signal,
    };
  }

  const response = await fetch(endpoint, fetchOptions);

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`API错误: ${response.status} ${errText}`);
  }

  const data = await response.json();
  if (data.data && data.data.length > 0) {
    let text = "";
    const items = data.data.slice(0, count);
    items.forEach((imgItem: any) => {
      if (imgItem.url) {
        text += `\n\n![Generated Image](${imgItem.url})\n\n`;
      } else if (imgItem.b64_json) {
        text += `\n\n![Generated Image](data:image/png;base64,${imgItem.b64_json})\n\n`;
      }
    });
    return { text, thinking: "" };
  } else {
    throw new Error("未返回图片");
  }
}

async function fetchMJSeed(
  taskId: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const cleanKey = getCleanApiKey(apiKey);
  const authHeader = getCleanAuthHeader(apiKey);

  try {
    const resp = await fetch(
      `https://yunwu.ai/mj/task/image-seed?ids=${taskId}`,
      {
        headers: {
          Authorization: authHeader,
        },
        signal,
      },
    );
    if (resp.ok) {
      const data = await resp.json();
      // Handle various response formats
      if (Array.isArray(data)) return data[0]?.seed || data[0]?.result || null;
      return data.seed || data.result || null;
    }
  } catch (e) {
    console.warn("Fetch Midjourney seed failed:", e);
  }
  return null;
}

async function splitMJGrid(imageUrl: string): Promise<string[]> {
  if (!imageUrl.startsWith("http")) return [imageUrl];

  try {
    let blob: Blob;
    try {
      const directResponse = await fetch(imageUrl, { mode: "cors" });
      if (!directResponse.ok) throw new Error("Direct fetch failed");
      blob = await directResponse.blob();
    } catch (e) {
      console.warn("Direct fetch failed, falling back to proxy...", e);
      try {
        const proxyUrl1 = `https://wsrv.nl/?url=${encodeURIComponent(imageUrl)}&output=png`;
        const proxyResponse1 = await fetch(proxyUrl1);
        if (!proxyResponse1.ok) throw new Error("wsrv fetch failed");
        blob = await proxyResponse1.blob();
      } catch (e2) {
        console.warn("wsrv proxy failed, falling back to allorigins...", e2);
        try {
          // Timeout for allorigins because it frequently hangs (522)
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);
          const proxyUrl2 = `https://api.allorigins.win/raw?url=${encodeURIComponent(imageUrl)}`;
          const proxyResponse2 = await fetch(proxyUrl2, {
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          if (!proxyResponse2.ok) throw new Error("allorigins fetch failed");
          blob = await proxyResponse2.blob();
        } catch (e3) {
          console.warn(
            "allorigins failed, falling back to corsproxy.io...",
            e3,
          );
          const proxyUrl3 = `https://corsproxy.io/?${encodeURIComponent(imageUrl)}`;
          const proxyResponse3 = await fetch(proxyUrl3);
          if (!proxyResponse3.ok) throw new Error("corsproxy fetch failed");
          blob = await proxyResponse3.blob();
        }
      }
    }

    const objectUrl = URL.createObjectURL(blob);

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const w = img.width / 2;
          const h = img.height / 2;
          const results: string[] = [];
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            URL.revokeObjectURL(objectUrl);
            resolve([imageUrl]);
            return;
          }

          const coords = [
            [0, 0],
            [w, 0],
            [0, h],
            [w, h],
          ];

          for (const [x, y] of coords) {
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
            results.push(canvas.toDataURL("image/jpeg", 0.9));
          }
          URL.revokeObjectURL(objectUrl);
          resolve(results);
        } catch (e) {
          console.error("Split grid canvas error:", e);
          URL.revokeObjectURL(objectUrl);
          resolve([imageUrl]);
        }
      };
      img.onerror = () => {
        console.error("Split grid image load error");
        URL.revokeObjectURL(objectUrl);
        resolve([imageUrl]);
      };
      img.src = objectUrl;
    });
  } catch (error) {
    console.error("Failed to fetch image via proxy as well:", error);
    // If it cannot be split, just return the 1 original grid image instead of duplicating.
    return [imageUrl];
  }
}

async function callMidjourneyAPI(
  messages: Message[],
  modelId: string,
  apiKey: string,
  signal?: AbortSignal,
) {
  // Trim API key to prevent common copy-paste issues
  const cleanApiKey = apiKey?.trim();
  if (!cleanApiKey || cleanApiKey === "undefined" || cleanApiKey === "null") {
    throw new Error("请在侧边栏系统设置中输入有效的 API Key");
  }

  const lastUserMsg = messages.filter((m) => m.role === "user").pop();
  if (!lastUserMsg) throw new Error("No user message found");

  let prompt = lastUserMsg.content;
  const match = prompt.match(
    /【要求：比例 ([^，]*)，分辨率 ([^，]*)，质量 ([^，]*)(?:，数量 ([^】]*))?】/,
  );
  if (match) {
    const ratio = match[1];
    prompt = prompt.replace(/【要求：.*?】\s*/, "");
    if (ratio && ratio !== "自适应" && !prompt.includes("--ar")) {
      prompt += ` --ar ${ratio}`;
    }
  }

  const botType = modelId === "niji" ? "NIJI_JOURNEY" : "MID_JOURNEY";

  // Submit Imagine task
  let submitResponse;
  try {
    submitResponse = await fetch("https://yunwu.ai/mj/submit/imagine", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: cleanApiKey.startsWith("Bearer ")
          ? cleanApiKey
          : `Bearer ${cleanApiKey}`,
        "mj-api-secret": cleanApiKey,
      },
      body: JSON.stringify({
        base64Array: [],
        notifyHook: "",
        prompt: prompt,
        state: "",
        botType: botType,
      }),
      signal,
    });
  } catch (e: any) {
    if (e.name === "AbortError") throw e;
    throw new Error(
      `Midjourney提交请求网络错误: ${e.message}。请检查 API 域名是否被墙或网络环境。`,
    );
  }

  if (!submitResponse.ok) {
    const errText = await submitResponse.text().catch(() => "");
    throw new Error(
      `Midjourney提交任务失败: ${submitResponse.status} ${errText}`,
    );
  }

  const submitData = await submitResponse.json();
  const taskId = submitData.result;
  if (!taskId) {
    throw new Error(
      "Midjourney提交任务未返回任务ID: " + JSON.stringify(submitData),
    );
  }

  // Polling for status
  let attempts = 0;
  const maxAttempts = 120; // 10 minutes (5s interval)

  while (attempts < maxAttempts) {
    if (signal?.aborted) throw new Error("Generation aborted");

    await new Promise((resolve) => setTimeout(resolve, 3000));
    attempts++;

    try {
      const statusResponse = await fetch(
        `https://yunwu.ai/mj/task/${taskId}/fetch`,
        {
          headers: {
            Authorization: cleanApiKey.startsWith("Bearer ")
              ? cleanApiKey
              : `Bearer ${cleanApiKey}`,
            "mj-api-secret": cleanApiKey,
          },
          signal,
        },
      );

      if (statusResponse.ok) {
        const taskData = await statusResponse.json();
        const status = taskData.status;

        if (status === "SUCCESS") {
          const imageUrl = taskData.imageUrl;
          if (imageUrl) {
            // Speed optimization: Skip seed fetch as it's not strictly required and adds extra round-trip
            const splitImages = await splitMJGrid(imageUrl);

            // User requested 4 separate images
            let resultText = "";
            splitImages.forEach((url, idx) => {
              resultText += `\n\n![Generated Image ${idx + 1}](${url})\n\n`;
            });

            // Still provide Task ID for reference if needed
            const taskIdText = taskId ? `\n\n> Task ID: ${taskId}` : "";

            return { text: resultText + taskIdText, thinking: "" };
          } else {
            throw new Error("Midjourney任务成功但未返回图片URL");
          }
        } else if (status === "FAILURE" || status === "CANCELLED") {
          throw new Error(
            `Midjourney任务失败: ${taskData.failReason || status}`,
          );
        }
        // If status is IN_PROGRESS or NOT_START, continue polling
      } else {
        console.warn("Polling MJ task status failed:", statusResponse.status);
      }
    } catch (e: any) {
      if (e.name === "AbortError") throw e;
      console.warn("Error polling MJ task:", e);
    }
  }

  throw new Error("Midjourney生成超时");
}

export async function callYunwuVideoAPI(
  prompt: string,
  images: string[],
  model: string,
  aspectRatio: string,
  resolution: string,
  duration: string,
  audioEnabled: string,
  apiKey: string,
  signal?: AbortSignal,
) {
  if (!apiKey) {
    throw new Error("请在系统设置中输入 API Key");
  }

  // Create an internal timeout signal if none provided
  const internalController = new AbortController();
  const timeoutId = setTimeout(
    () => internalController.abort(new Error("timeout")),
    600000,
  ); // 10 minutes max
  const activeSignal = signal || internalController.signal;

  try {
    let body: any;
    let createUrl = "https://yunwu.ai/v1/video/create";

    if (model === "grok-video-3") {
      const finalPrompt = prompt.includes("--mode=")
        ? prompt
        : `${prompt} --mode=custom`;
      const validImages = (images || []).filter(
        (img) => img.startsWith("http://") || img.startsWith("https://"),
      );

      // Map common aspect ratios to grok-video-3 supported ones
      let mappedRatio = aspectRatio || "5:4";
      if (mappedRatio === "16:9") mappedRatio = "16:9";
      else if (mappedRatio === "9:16") mappedRatio = "9:16";
      else if (mappedRatio === "1:1") mappedRatio = "1:1";
      else if (mappedRatio === "2:3") mappedRatio = "2:3";
      else if (mappedRatio === "3:2") mappedRatio = "3:2";
      else mappedRatio = "16:9";

      body = {
        model: "grok-video-3",
        prompt: finalPrompt,
        aspect_ratio: mappedRatio,
        size: "720P", // Only 720P is supported right now based on docs
        duration: duration ? parseInt(duration.replace("s", ""), 10) : 6,
        ...(validImages.length > 0 ? { images: validImages } : {}),
      };
    } else {
      const validImages = (images || []).filter(
        (img) => img.startsWith("http://") || img.startsWith("https://"),
      );
      body = {
        prompt,
        model: model,
        ...(validImages.length > 0 ? { images: validImages } : {}),
        enhance_prompt: true,
        enable_upsample: true,
        audio: audioEnabled === "开启",
        aspect_ratio: aspectRatio || "16:9",
        size: (resolution || "1080p").toUpperCase(),
        duration: duration ? parseInt(duration.replace("s", ""), 10) : 5,
      };
    }

    const cleanKey = getCleanApiKey(apiKey);
    const authHeader = getCleanAuthHeader(apiKey);

    const response = await fetch(createUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify(body),
      signal: activeSignal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error(`视频生成API错误: ${response.status} ${errText}`, body);
      throw new Error(`视频生成API错误: ${response.status} ${errText}`);
    }

    const data = await response.json();
    let taskId = data.id || data.task_id || data.taskId;

    if (!taskId && data.data) {
      taskId = data.data.id || data.data.task_id || data.data.taskId;
    }

    const extractUrl = (resData: any): string | null => {
      if (!resData) return null;
      if (resData.url) return resData.url;
      if (resData.video_url) return resData.video_url;
      if (resData.videoUrl) return resData.videoUrl;
      if (resData.video) return resData.video;
      if (resData.data && resData.data[0]?.url) return resData.data[0].url;
      if (resData.data && resData.data.url) return resData.data.url;
      if (resData.data && resData.data.video_url) return resData.data.video_url;
      if (resData.output && resData.output.url) return resData.output.url;
      if (resData.output && resData.output.video_url)
        return resData.output.video_url;
      if (resData.result && resData.result.url) return resData.result.url;
      if (resData.result && resData.result.video_url)
        return resData.result.video_url;
      if (resData.video_urls && resData.video_urls[0])
        return resData.video_urls[0];
      if (resData.data && resData.data.videos && resData.data.videos[0]?.url)
        return resData.data.videos[0].url;
      if (resData.data?.task_result?.videos?.[0]?.url)
        return resData.data.task_result.videos[0].url;
      if (resData.task_result?.videos?.[0]?.url)
        return resData.task_result.videos[0].url;
      if (
        resData.data &&
        typeof resData.data === "string" &&
        resData.data.startsWith("http")
      )
        return resData.data;

      // Fallback: search deep for any string that looks like a video url
      const str = JSON.stringify(resData);
      const match = str.match(
        /https?:\/\/[^"'\\]+\.(?:mp4|webm)(?:\?[^"'\\]*)?/i,
      );
      if (match) return match[0];

      return null;
    };

    const initialVideoUrl = extractUrl(data);
    if (!taskId && initialVideoUrl) {
      return { videoUrl: initialVideoUrl };
    }

    if (!taskId) {
      throw new Error("未返回任务ID或视频URL: " + JSON.stringify(data));
    }

    // Polling for completion
    let attempts = 0;
    let successAttempts = 0;
    const maxAttempts = 120; // 10 minutes (with 5s interval)

    while (attempts < maxAttempts) {
      if (activeSignal.aborted) {
        const err = new Error("后台生成任务被中断或请求超时 (10分钟限制)");
        err.name = "AbortError";
        throw err;
      }

      await new Promise((resolve) => setTimeout(resolve, 5000));
      attempts++;

      try {
        const authHeader = getCleanAuthHeader(apiKey);

        let queryUrl = `https://yunwu.ai/v1/video/query?id=${taskId}`;

        const statusResponse = await fetch(queryUrl, {
          headers: {
            Authorization: authHeader,
          },
          signal: activeSignal,
        });

        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          let status =
            statusData.status || statusData.state || statusData.task_status;

          if (!status && statusData.data) {
            status =
              statusData.data.status ||
              statusData.data.task_status ||
              statusData.data.state;
          }

          if (
            status === "completed" ||
            status === "succeed" ||
            status === "succeeded" ||
            status === "success" ||
            status === "finish" ||
            status === "SUCCESS"
          ) {
            const videoUrl = extractUrl(statusData);
            if (videoUrl) {
              return { videoUrl };
            } else {
              console.warn("任务状态为成功，但未找到视频URL:", statusData);
              successAttempts++;
              if (successAttempts > 3 || attempts > maxAttempts - 2) {
                throw new Error(
                  "视频生成成功，但未解析到视频链接。返回数据: " +
                    JSON.stringify(statusData),
                );
              }
            }
          } else if (
            status === "failed" ||
            status === "error" ||
            status === "FAILURE" ||
            status === "CANCELLED" ||
            status === "FAIL"
          ) {
            throw new Error(
              "执行失败: " +
                (statusData.error ||
                  statusData.failReason ||
                  statusData.message ||
                  statusData.reason ||
                  "未知异常"),
            );
          }
        } else {
          // If not ok, we can log it, but we keep trying in case it's a temp 502
          if (
            attempts > 3 &&
            statusResponse.status !== 502 &&
            statusResponse.status !== 503
          ) {
            const errText = await statusResponse.text().catch(() => "");
            console.warn("Polling API error:", statusResponse.status, errText);
          }
        }
      } catch (e: any) {
        if (e.name === "AbortError") throw e;
        console.warn("Polling error:", e);
      }
    }

    throw new Error("视频生成超时");
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function parseVideoAndExtractText(url: string, apiKey: string) {
  if (!apiKey) {
    throw new Error("请在系统设置中输入 API Key");
  }

  // 尝试匹配文本中的链接
  const match = url.match(/(https?:\/\/[^\s]+)/);
  const realUrl = match ? match[1] : url;

  const cleanKey = getCleanApiKey(apiKey);
  const authHeader = getCleanAuthHeader(apiKey);

  const prompt = `你是一个专业的视听内容转录与文案分析员。用户提供了一个短视频分享文本文档（包含链接，或者是一些标题描述）：\n\n${url}\n\n当前传统的视频解析API受限无法直接下载音频。请你直接运用你的知识，结合联网搜索工具去探查上述提供的链接或文字，尽最大可能还原或推测出该视频对应的详细文字文案、台词或配音内容。你的输出必须只包含干净、连贯的台词文案内容，不要有任何多余的开场白、解释性废话或你的心情说明。格式要清晰排版。`;

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    tools: [{ googleSearch: {} }],
    generationConfig: {
      temperature: 0.3,
    },
  };

  try {
    const response = await fetch(
      `${GEMINI_API_BASE_URL}/gemini-3.1-pro-preview:generateContent?key=${cleanKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(`分析接口调用失败: ${response.status} ${errText}`);
    }

    const resultData = await response.json();
    let text = resultData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // 如果返回内容为空但可能被搜索工具截断
    if (!text && resultData.candidates?.[0]?.content?.parts?.length) {
      text = resultData.candidates[0].content.parts
        .map((p: any) => p.text || "")
        .join("");
    }

    if (!text) {
      throw new Error("大模型未能从该链接/文本中提取任何有效内容。");
    }

    return {
      audioUrl: "因解析接口受限，已自动切换为智能联网摘要提取模式",
      transcript: text,
    };
  } catch (e: any) {
    throw new Error(`提取失败：${e.message}`);
  }
}

export async function callGeminiAPI(
  messages: Message[],
  func: FuncType,
  modelId: string,
  apiKey: string,
  subFunc?: string,
  signal?: AbortSignal,
) {
  if (!apiKey) {
    throw new Error("请在系统设置中输入 API Key");
  }

  if (!modelId) {
    modelId = "gpt-image-2-all"; // Add default modelId fallback
  }

  if (modelId === "gpt-image-2-all") {
    return await callYunwuImageAPI(messages, modelId, apiKey, signal);
  }

  if (modelId === "midjourney" || modelId === "niji") {
    return await callMidjourneyAPI(messages, modelId, apiKey, signal);
  }

  const cleanKey = getCleanApiKey(apiKey);
  const authHeader = getCleanAuthHeader(apiKey);

  const isImageModel =
    modelId.includes("image") || modelId.includes("nanobanana");
  const apiUrl = `${GEMINI_API_BASE_URL}/${modelId}:generateContent?key=${cleanKey}`;
  const body = buildGeminiRequestBody(messages, func, subFunc, modelId);
  const fetchOptions: RequestInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify(body),
    signal,
  };

  const response = await fetch(apiUrl, fetchOptions);

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    let errMsg = `API错误: ${response.status}`;
    try {
      const errData = JSON.parse(errText);
      if (errData?.error?.message) {
        errMsg = errData.error.message;
        if (errMsg.includes("NO_IMAGE")) {
          errMsg =
            "图片生成失败(NO_IMAGE)：可能触发了安全拦截或遇到了内部错误，请修改提示词或稍后再试。";
        }
      }
    } catch (e) {
      if (errText) errMsg += " - " + errText.slice(0, 200);
    }
    throw new Error(errMsg);
  }

  const data = await response.json();

  const parts = data.candidates?.[0]?.content?.parts || [];
  let text = "";
  let thinking = "";
  for (const part of parts) {
    if (part.thought) {
      if (typeof part.thought === "string") {
        thinking += part.thought;
      } else if (part.text && part.text !== "true") {
        thinking += part.text;
      }
    } else if (part.inlineData) {
      const mimeType = part.inlineData.mimeType || "image/jpeg";
      text += `\n\n![Generated Image](data:${mimeType};base64,${part.inlineData.data})\n\n`;
    } else if (part.reasoning_content) {
      thinking += part.reasoning_content;
    } else if (part.text && part.text !== "true") {
      text += part.text;
    }
  }
  return { text, thinking };
}
