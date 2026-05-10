/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback, startTransition } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { loadState, saveState, loadAssets, saveAssets } from './lib/storage';
import { Conversation, FuncType, Message, Asset } from './types';
import { callGeminiStreamAPI, callGeminiAPI } from './lib/api';
import { cn, useEventCallback } from './lib/utils';
import { MODELS, IMAGE_MODELS, VIDEO_MODELS } from './constants';

import { CanvasDramaArea } from './components/CanvasDramaArea';
import { AssetsArea } from './components/AssetsArea';
import { SettingsModal } from './components/SettingsModal';
import { CanvasProjectPage } from './components/CanvasProjectPage';

const EMPTY_MESSAGES: Message[] = [];

export default function App() {
  const [conversations, setConversations] = useState<Record<string, Conversation>>({});
  const [assets, setAssets] = useState<Asset[]>([]);
  const [currentFunc, setCurrentFunc] = useState<FuncType>('chat');
  const [showCanvasProjects, setShowCanvasProjects] = useState(false);
  const [autoOpenProjectModal, setAutoOpenProjectModal] = useState(false);
  const [currentDramaSubFunc, setCurrentDramaSubFunc] = useState<string>('1.优化剧本');
  const [currentSeedanceSubFunc, setCurrentSeedanceSubFunc] = useState<string>('互动剧提示词');
  const [currentImageRatio, setCurrentImageRatio] = useState<string>('16:9');
  const [currentImageResolution, setCurrentImageResolution] = useState<string>('1k');
  const [currentImageQuality, setCurrentImageQuality] = useState<string>('auto');
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [currentModelId, setCurrentModelId] = useState('gemini-3.1-pro-preview');
  const [currentModelName, setCurrentModelName] = useState('Gemini 3.1 Pro');
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [generatingConvs, setGeneratingConvs] = useState<Set<string>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 768 : false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [input, setInput] = useState('');
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [toast, setToast] = useState<{ msg: string; isError: boolean } | null>(null);
  const [lastUsedConvByFunc, setLastUsedConvByFunc] = useState<Record<string, string>>({});

  const abortControllersRef = useRef<Record<string, AbortController>>({});
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    async function init() {
      const dbAssets = await loadAssets();
      setAssets(dbAssets);
      
      const state = await loadState();
      setConversations(state.conversations);
      setCurrentFunc(state.currentFunc);
      if (state.lastUsedConvByFunc) {
        setLastUsedConvByFunc(state.lastUsedConvByFunc);
      }
      
      // We will validate later dynamically based on func
      if (state.currentFunc === 'yellowImage') {
        const validImageModels = IMAGE_MODELS.map(m => m.id);
        if (validImageModels.includes(state.currentModelId)) {
          setCurrentModelId(state.currentModelId);
          setCurrentModelName(state.currentModelName);
        } else {
          setCurrentModelId('gemini-3-pro-image-preview');
          setCurrentModelName('nanobananapro');
        }
      } else {
        const validModels = MODELS.map(m => m.id);
        if (validModels.includes(state.currentModelId)) {
          setCurrentModelId(state.currentModelId);
          setCurrentModelName(state.currentModelName);
        } else {
          setCurrentModelId('gemini-3.1-pro-preview');
          setCurrentModelName('Gemini 3.1 Pro');
        }
      }
      
      setCurrentConvId(state.currentConvId);
      setApiKeys(state.apiKeys || (state.apiKey ? { gemini: state.apiKey, midjourney: state.apiKey, 'gpt-image': state.apiKey } : {}));
      setIsInitialized(true);
      
      // Warm up API connection (DNS, TCP, TLS and CORS preflight)
      const modelForWarmup = state.currentModelId || 'gemini-3.1-pro-preview';
      fetch(`https://yunwu.ai/v1beta/models/${modelForWarmup}:streamGenerateContent`, {
        method: 'OPTIONS',
        headers: {
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'authorization,content-type'
        }
      }).catch(() => {});
    }
    init();
  }, []);

  useEffect(() => {
    if (isInitialized) {
      saveAssets(assets);
    }
  }, [assets, isInitialized]);

  // Debounced save state to avoid performance issues during rapid canvas changes
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isInitialized) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      saveTimeoutRef.current = setTimeout(() => {
        saveState(conversations, currentFunc, currentConvId, currentModelId, currentModelName, apiKeys, lastUsedConvByFunc);
      }, 500); // 500ms delay for debouncing
    }
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [conversations, currentFunc, currentConvId, currentModelId, currentModelName, apiKeys, isInitialized, lastUsedConvByFunc]);

  useEffect(() => {
    if (currentConvId && currentFunc) {
      setLastUsedConvByFunc(prev => {
        if (prev[currentFunc] === currentConvId) return prev;
        return { ...prev, [currentFunc]: currentConvId };
      });
    }
  }, [currentConvId, currentFunc]);

  const showToast = (msg: string, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 2500);
  };

  const generateId = () => 'c_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

  const ensureConversation = (firstMsg: string) => {
    if (!currentConvId) {
      const id = generateId();
      let title = firstMsg.slice(0, 30).replace(/\\n/g, ' ');
      if (firstMsg.length > 30) title += '...';
      
      setConversations((prev) => ({
        ...prev,
        [id]: {
          id,
          func: currentFunc,
          dramaSubFunc: currentFunc === 'drama' ? currentDramaSubFunc : undefined,
          seedanceSubFunc: currentFunc === 'seedance' ? currentSeedanceSubFunc : undefined,
          title,
          messages: [],
          created: Date.now(),
        },
      }));
      setCurrentConvId(id);
      return id;
    }
    return currentConvId;
  };

  const getApiKeyForModel = (modelId: string) => {
    const isNanobanana = modelId.includes('nanobanana') || modelId.includes('image-preview');
    const isVideo = VIDEO_MODELS.some(m => m.id === modelId) || modelId === 'gen-2';
    
    const envKey = (process.env.GEMINI_API_KEY as string) || '';
    const geminiKey = apiKeys['gemini'] || envKey;

    if (modelId === 'midjourney' || modelId === 'niji') return apiKeys['midjourney'] || geminiKey;
    if (modelId === 'gpt-image-2-all') return apiKeys['gpt-image'] || geminiKey;
    if (isNanobanana) return apiKeys['nanobanana'] || geminiKey;
    if (isVideo) return apiKeys['video'] || geminiKey;
    return geminiKey;
  };

  const handleSend = useEventCallback(async (textToSend?: string | any) => {
    const textInput = (typeof textToSend === 'string' ? textToSend : input).trim();
    const convIdToCheck = currentConvId;
    
    if ((!textInput && attachedImages.length === 0) || (convIdToCheck && generatingConvs.has(convIdToCheck))) return;

    // Capture state context immediately to prevent issues when switching tabs
    const funcAtStart = currentFunc;
    const modelAtStart = currentModelId;
    const dramaSubAtStart = currentDramaSubFunc;
    const seedanceSubAtStart = currentSeedanceSubFunc;
    const ratioAtStart = currentImageRatio;
    const resAtStart = currentImageResolution;
    const qualAtStart = currentImageQuality;
    const attachedImagesAtStart = [...attachedImages];
    const apiKeyAtStart = getApiKeyForModel(modelAtStart);

    // Ensure conversation exists and get ID
    const convId = ensureConversation(textInput || '图片消息');
    
    // UI Feedback: Clear input and images immediately
    setInput('');
    setAttachedImages([]);
    
    setConversations((prev) => {
      const conv = prev[convId];
      if (!conv) return prev;
      return {
        ...prev,
        [convId]: {
          ...conv,
          messages: [...conv.messages, { role: 'user', content: textInput, images: attachedImagesAtStart }],
          updated: Date.now(),
        },
      };
    });

    setGeneratingConvs(prev => new Set(prev).add(convId));
    const controller = new AbortController();
    abortControllersRef.current[convId] = controller;

    try {
      // Build message list properly without relying on state updates that haven't flushed yet
      const cConv = conversations[convId];
      const prevMessages = cConv ? cConv.messages : [];
      const userMsg: Message = { role: 'user', content: textInput, images: attachedImagesAtStart };
      const currentMessages: Message[] = [...prevMessages, userMsg];
      
      // Pass proportion info for image generation
      if (funcAtStart === 'yellowImage') {
        const lastMsg = currentMessages[currentMessages.length - 1];
        if (lastMsg) {
          lastMsg.content = `【要求：比例 ${ratioAtStart}，分辨率 ${resAtStart}，质量 ${qualAtStart}，数量 1】 ${lastMsg.content}`;
        }
      }

      let responseText = '';
      let thinkingText = '';

      try {
        const subFunc = (conversations[convId] || cConv)?.dramaSubFunc || (conversations[convId] || cConv)?.seedanceSubFunc || (funcAtStart === 'drama' ? dramaSubAtStart : funcAtStart === 'seedance' ? seedanceSubAtStart : undefined);
        
        if (funcAtStart === 'yellowImage') {
          const lastMsg = currentMessages[currentMessages.length - 1];
          const singleMessagePayload = [{ role: 'user' as const, content: lastMsg.content, images: lastMsg.images }];
          const result = await callGeminiAPI(
            singleMessagePayload,
            funcAtStart,
            modelAtStart,
            apiKeyAtStart,
            subFunc,
            controller.signal
          );
          let resultText = result.text;
          const regex = /!\[.*?\]\((.*?)\)/;
          if (!regex.test(resultText) && resultText) {
            const urlMatch = resultText.match(/https?:\/\/[^\s)]+/);
            if (urlMatch) {
              resultText = `![Generated Image](${urlMatch[0]})`;
            }
          }
          
          setConversations((prev) => {
            const conv = prev[convId];
            if (!conv) return prev;
            const msgs = [...conv.messages];
            if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
              msgs[msgs.length - 1] = { role: 'assistant', content: resultText, thinking: result.thinking };
            } else {
              msgs.push({ role: 'assistant', content: resultText, thinking: result.thinking });
            }
            return { ...prev, [convId]: { ...conv, messages: msgs } };
          });
        } else {
          await callGeminiStreamAPI(
            currentMessages,
            funcAtStart,
            modelAtStart,
            apiKeyAtStart,
            subFunc,
            (chunk) => {
              responseText = chunk;
              setConversations((prev) => {
                const conv = prev[convId];
                if (!conv) return prev;
                const msgs = [...conv.messages];
                if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
                  msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: chunk };
                } else {
                  msgs.push({ role: 'assistant', content: chunk, thinking: thinkingText });
                }
                return { ...prev, [convId]: { ...conv, messages: msgs } };
              });
            },
            (thinking) => {
              thinkingText = thinking;
              setConversations((prev) => {
                const conv = prev[convId];
                if (!conv) return prev;
                const msgs = [...conv.messages];
                if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
                  msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], thinking: thinking };
                } else {
                  msgs.push({ role: 'assistant', content: '', thinking });
                }
                return { ...prev, [convId]: { ...conv, messages: msgs } };
              });
            },
            controller.signal
          );
        }
      } catch (streamErr: any) {
        if (streamErr.name === 'AbortError' || streamErr.name === 'DOMException' || streamErr.message?.includes('aborted')) throw streamErr;
        console.warn('Stream failed, trying non-stream fallback:', streamErr.message);
        
        const cConvFinal = conversations[convId];
        const subFuncFinal = cConvFinal?.dramaSubFunc || cConvFinal?.seedanceSubFunc || (funcAtStart === 'drama' ? dramaSubAtStart : funcAtStart === 'seedance' ? seedanceSubAtStart : undefined);
        const result = await callGeminiAPI(
          currentMessages,
          funcAtStart,
          modelAtStart,
          apiKeyAtStart,
          subFuncFinal,
          controller.signal
        );
        
        setConversations((prev) => {
          const conv = prev[convId];
          if (!conv) return prev;
          const msgs = [...conv.messages];
          if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
            msgs[msgs.length - 1] = { role: 'assistant', content: result.text, thinking: result.thinking };
          } else {
            msgs.push({ role: 'assistant', content: result.text, thinking: result.thinking });
          }
          return { ...prev, [convId]: { ...conv, messages: msgs } };
        });
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || err.name === 'DOMException' || err.message?.includes('aborted')) {
        showToast('已停止生成');
      } else {
        const errMsg = `⚠️ 生成失败：${err.message}\n\n请检查网络连接或稍后重试。`;
        setConversations((prev) => {
          const conv = prev[convId];
          if (!conv) return prev;
          const msgs = [...conv.messages];
          if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
            msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: errMsg };
          } else {
            msgs.push({ role: 'assistant', content: errMsg });
          }
          return { ...prev, [convId]: { ...conv, messages: msgs } };
        });
        showToast('生成失败，请重试', true);
      }
    } finally {
      setGeneratingConvs(prev => {
        const next = new Set(prev);
        next.delete(convId);
        return next;
      });
      delete abortControllersRef.current[convId];
    }
  });

  const handleStop = useEventCallback((id?: string) => {
    const convId = id || currentConvId;
    
    // Try to stop the specific requested or current conversation first
    if (convId && abortControllersRef.current[convId]) {
      abortControllersRef.current[convId].abort();
      delete abortControllersRef.current[convId];
      
      // Update state immediately for smoother UI
      setGeneratingConvs(prev => {
        const next = new Set(prev);
        next.delete(convId);
        return next;
      });
    } else if (generatingConvs.size > 0) {
      // Fallback: stop all currently generating conversations if triggered and target not specifically hit
      generatingConvs.forEach(cid => {
        if (abortControllersRef.current[cid]) {
          abortControllersRef.current[cid].abort();
          delete abortControllersRef.current[cid];
        }
      });
      setGeneratingConvs(new Set());
    }
  });

  const handleRegenerate = useEventCallback(async () => {
    if (!currentConvId || generatingConvs.has(currentConvId)) return;
    const convId = currentConvId;
    
    // Capture context immediately
    const funcAtStart = currentFunc;
    const modelAtStart = currentModelId;
    const dramaSubAtStart = currentDramaSubFunc;
    const seedanceSubAtStart = currentSeedanceSubFunc;
    const ratioAtStart = currentImageRatio;
    const resAtStart = currentImageResolution;
    const qualAtStart = currentImageQuality;
    const apiKeyAtStart = getApiKeyForModel(modelAtStart);

    const conv = conversations[convId];
    if (conv.messages.length < 2) return;

    // Remove last assistant message if not yellowImage
    if (funcAtStart !== 'yellowImage') {
      setConversations((prev) => {
        const c = prev[convId];
        if (!c) return prev;
        return {
          ...prev,
          [convId]: {
            ...c,
            messages: c.messages.slice(0, -1),
            updated: Date.now(),
          },
        };
      });
    }

    // Capture messages for regeneration
    const currentMessages = conv.messages.slice(0, -1);
    
    // Process image ratio if needed on regenerate
    if (funcAtStart === 'yellowImage' && currentMessages.length > 0) {
      const lastMsg = { ...currentMessages[currentMessages.length - 1] };
      currentMessages[currentMessages.length - 1] = lastMsg;
      if (!lastMsg.content.includes('【要求：比例')) {
        lastMsg.content = `【要求：比例 ${ratioAtStart}，分辨率 ${resAtStart}，质量 ${qualAtStart}，数量 1】 ${lastMsg.content}`;
      } else {
        // Update ratio if it already has one
        lastMsg.content = lastMsg.content.replace(/【要求：比例 .*?】/, `【要求：比例 ${ratioAtStart}，分辨率 ${resAtStart}，质量 ${qualAtStart}，数量 1】`);
      }
    }

    setGeneratingConvs(prev => new Set(prev).add(convId));
    const controller = new AbortController();
    abortControllersRef.current[convId] = controller;

    try {
      let responseText = '';
      let thinkingText = '';

      try {
        const subFunc = conv.dramaSubFunc || conv.seedanceSubFunc || (funcAtStart === 'drama' ? dramaSubAtStart : funcAtStart === 'seedance' ? seedanceSubAtStart : undefined);
        
        if (funcAtStart === 'yellowImage') {
          const lastMsg = currentMessages[currentMessages.length - 1];
          const singleMessagePayload = [{ role: 'user' as const, content: lastMsg.content, images: lastMsg.images }];
          const result = await callGeminiAPI(
            singleMessagePayload,
            funcAtStart,
            modelAtStart,
            apiKeyAtStart,
            subFunc,
            controller.signal
          );
          let resultText = result.text;
          const regex = /!\[.*?\]\((.*?)\)/;
          if (!regex.test(resultText) && resultText) {
            const urlMatch = resultText.match(/https?:\/\/[^\s)]+/);
            if (urlMatch) {
              resultText = `![Generated Image](${urlMatch[0]})`;
            }
          }

          setConversations((prev) => {
            const c = prev[convId];
            if (!c) return prev;
            const msgs = [...c.messages];
            if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
              msgs[msgs.length - 1] = { role: 'assistant', content: msgs[msgs.length - 1].content + '\n' + resultText, thinking: result.thinking };
            } else {
              msgs.push({ role: 'assistant', content: resultText, thinking: result.thinking });
            }
            return { ...prev, [convId]: { ...c, messages: msgs } };
          });
        } else {
          await callGeminiStreamAPI(
            currentMessages,
            funcAtStart,
            modelAtStart,
            apiKeyAtStart,
            subFunc,
            (chunk) => {
              responseText = chunk;
              setConversations((prev) => {
                const c = prev[convId];
                if (!c) return prev;
                const msgs = [...c.messages];
                if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
                  msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: chunk };
                } else {
                  msgs.push({ role: 'assistant', content: chunk, thinking: thinkingText });
                }
                return { ...prev, [convId]: { ...c, messages: msgs } };
              });
            },
            (thinking) => {
              thinkingText = thinking;
              setConversations((prev) => {
                const c = prev[convId];
                if (!c) return prev;
                const msgs = [...c.messages];
                if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
                  msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], thinking: thinking };
                } else {
                  msgs.push({ role: 'assistant', content: '', thinking });
                }
                return { ...prev, [convId]: { ...c, messages: msgs } };
              });
            },
            controller.signal
          );
        }
      } catch (streamErr: any) {
        if (streamErr.name === 'AbortError' || streamErr.name === 'DOMException') throw streamErr;
        
        const subFunc = conv.dramaSubFunc || conv.seedanceSubFunc || (funcAtStart === 'drama' ? dramaSubAtStart : funcAtStart === 'seedance' ? seedanceSubAtStart : undefined);
        const result = await callGeminiAPI(
          currentMessages,
          funcAtStart,
          modelAtStart,
          apiKeyAtStart,
          subFunc,
          controller.signal
        );
        
        setConversations((prev) => {
          const c = prev[convId];
          if (!c) return prev;
          const msgs = [...c.messages];
          if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
            msgs[msgs.length - 1] = { role: 'assistant', content: result.text, thinking: result.thinking };
          } else {
            msgs.push({ role: 'assistant', content: result.text, thinking: result.thinking });
          }
          return { ...prev, [convId]: { ...c, messages: msgs } };
        });
      }
    } catch (err: any) {
      if (err.name !== 'AbortError' && err.name !== 'DOMException' && !err.message?.includes('aborted')) {
        showToast('重新生成失败', true);
      }
    } finally {
      setGeneratingConvs(prev => {
        const next = new Set(prev);
        next.delete(convId);
        return next;
      });
      delete abortControllersRef.current[convId];
    }
  });

  const deleteConversation = useEventCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConversations((prev) => {
      const newConvs = { ...prev };
      delete newConvs[id];
      return newConvs;
    });
    if (currentConvId === id) {
      setCurrentConvId(null);
    }
  });

  const renameConversation = useEventCallback((id: string, newTitle: string) => {
    setConversations((prev) => {
      if (!prev[id]) return prev;
      return {
        ...prev,
        [id]: {
          ...prev[id],
          title: newTitle,
        },
      };
    });
  });

  const createNewChat = useEventCallback(() => {
    setCurrentConvId(null);
    if (window.innerWidth < 768) setSidebarOpen(false);
  });

  const createNewProject = useEventCallback((title: string, description: string, cover?: string) => {
    const id = generateId();
    setConversations((prev) => ({
      ...prev,
      [id]: {
        id,
        func: 'canvasDrama',
        title,
        description,
        cover,
        messages: [],
        created: Date.now(),
        nodes: [{
          id: `mainScript-${generateId()}`,
          type: 'mainScript',
          position: { x: 50, y: 50 },
          data: {
             variant: 'mainScript',
             content: '',
             title: '待生成'
          }
        }],
        edges: []
      },
    }));
    setCurrentConvId(id);
    if (window.innerWidth < 768) setSidebarOpen(false);
  });

  const updateProject = useEventCallback((id: string, updates: { title?: string; description?: string; cover?: string }) => {
    setConversations((prev) => {
      const conv = prev[id];
      if (!conv) return prev;
      return {
        ...prev,
        [id]: {
          ...conv,
          ...updates
        }
      };
    });
  });

  const handleFuncChange = useEventCallback((func: FuncType, forceNew = false) => {
    if (func === currentFunc && !currentConvId && forceNew) return;
    startTransition(() => {
      setCurrentFunc(func);
      
      let nextConvId = null;
      if (!forceNew) {
        const lastIdForFunc = lastUsedConvByFunc[func];
        if (lastIdForFunc && conversations[lastIdForFunc]) {
          nextConvId = lastIdForFunc;
        } else {
          // fallback to newest of this func
          const funcConvs = Object.values(conversations)
            .filter(c => c.func === func)
            .sort((a, b) => b.created - a.created);
          if (funcConvs.length > 0) {
            nextConvId = funcConvs[0].id;
          }
        }
      }
      
      setCurrentConvId(nextConvId);
      if (window.innerWidth < 768) setSidebarOpen(false);
      
      // Switch to appropriate model list based on function
      if (func === 'yellowImage') {
        // If current model is not an image model, fallback to a sensible default image model
        const isCurrentModelImageModel = IMAGE_MODELS.some(m => m.id === currentModelId);
        if (!isCurrentModelImageModel) {
          setCurrentModelId('gemini-3.1-flash-image-preview');
          setCurrentModelName('nanobanana2');
        }
      } else {
        const isImageModel = IMAGE_MODELS.some(m => m.id === currentModelId);
        if (isImageModel) {
          setCurrentModelId('gemini-3.1-pro-preview');
          setCurrentModelName('Gemini 3.1 Pro');
        }
      }
    });
  });

  const handleUpdateProjectInfo = useEventCallback((title: string, description: string) => {
    if (currentConvId) {
      setConversations(prev => {
        const conv = prev[currentConvId];
        if (!conv) return prev;
        return {
          ...prev,
          [currentConvId]: {
            ...conv,
            title,
            description
          }
        };
      });
    }
  });

  const handleUpdateNodeInGlobalState = useEventCallback((convId: string, nodeId: string, nodeUpdates: any | ((prevData: any) => any)) => {
    setConversations(prev => {
      const conv = prev[convId];
      if (!conv) return prev;
      const newNodes = (conv.nodes || []).map((n: any) => {
        if (n.id === nodeId) {
          const updates = typeof nodeUpdates === 'function' ? nodeUpdates(n.data) : nodeUpdates;
          return { ...n, data: { ...n.data, ...updates } };
        }
        return n;
      });
      return {
        ...prev,
        [convId]: {
          ...conv,
          nodes: newNodes
        }
      };
    });
  });

  const handleAppendNodesToGlobalState = useEventCallback((convId: string, newNodes: any[], newEdges: any[]) => {
    setConversations(prev => {
      const conv = prev[convId];
      if (!conv) return prev;
      
      const currentNodes = conv.nodes || [];
      const currentEdges = conv.edges || [];
      
      return {
        ...prev,
        [convId]: {
          ...conv,
          nodes: [...currentNodes, ...newNodes],
          edges: [...currentEdges, ...newEdges]
        }
      };
    });
  });

  const handleUpdateHistory = useEventCallback((convId: string, historyItem: { id: string; type: 'image' | 'audio' | 'video'; url: string; timestamp: number }) => {
    if (convId) {
      setConversations(prev => {
        const conv = prev[convId];
        if (!conv) return prev;
        return {
          ...prev,
          [convId]: { 
            ...conv, 
            history: [historyItem, ...(conv.history || [])]
          }
        };
      });
    }
  });

  const handleUpdateCanvas = useEventCallback((nodes: any[], edges: any[], title: string) => {
    if (!currentConvId) {
      const id = generateId();
      setConversations((prev) => ({
        ...prev,
        [id]: {
          id,
          func: 'canvasDrama',
          title: '新的星幕',
          messages: [],
          created: Date.now(),
          nodes,
          edges,
        },
      }));
      setCurrentConvId(id);
    } else {
      setConversations((prev) => {
        const conv = prev[currentConvId];
        if (!conv) return prev;
        return { ...prev, [currentConvId]: { ...conv, nodes, edges, updated: Date.now() } };
      });
    }
  });

  const handleSaveAsset = useEventCallback((url: string, type: 'image' | 'audio' | 'video') => {
    const assetId = `asset-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    setAssets(prev => [{
      id: assetId,
      type,
      url,
      name: `${type}-${new Date().toLocaleTimeString()}.png`, // simplify name
      createdAt: Date.now()
    }, ...prev]);
    showToast('已存入资产');
  });

  const handleDeleteAsset = useEventCallback((id: string) => {
    setAssets(prev => prev.filter(a => a.id !== id));
    showToast('资产已删除');
  });

  const handleSetCurrentModelId = useEventCallback((id: string) => {
    setCurrentModelId(id);
    const m = [...MODELS, ...IMAGE_MODELS].find(x => x.id === id);
    if (m) setCurrentModelName(m.name);
  });

  if (!isInitialized) return null;

  const currentMessages = currentConvId ? conversations[currentConvId]?.messages || EMPTY_MESSAGES : EMPTY_MESSAGES;

  return (
    <div className="flex h-[100dvh] w-full bg-neutral-50 text-neutral-900 font-sans overflow-hidden">
      <Sidebar
        currentFunc={currentFunc}
        setCurrentFunc={handleFuncChange}
        conversations={conversations}
        currentConvId={currentConvId}
        setCurrentConvId={setCurrentConvId}
        deleteConversation={deleteConversation}
        renameConversation={renameConversation}
        createNewChat={createNewChat}
        createNewProject={createNewProject}
        currentModelId={currentModelId}
        setCurrentModelId={handleSetCurrentModelId}
        currentModelName={currentModelName}
        setCurrentModelName={setCurrentModelName}
        apiKeys={apiKeys}
        setApiKeys={setApiKeys}
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        showCanvasProjects={showCanvasProjects}
        setShowCanvasProjects={setShowCanvasProjects}
        onOpenSettings={() => setSettingsModalOpen(true)}
        assets={assets}
        generatingConvs={generatingConvs}
      />

      <SettingsModal 
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        apiKeys={apiKeys}
        setApiKeys={setApiKeys}
      />
      
      {currentFunc === 'assets' ? (
        <AssetsArea 
          assets={assets} 
          setAssets={setAssets} 
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />
      ) : currentFunc === 'canvasDrama' && showCanvasProjects ? (
        <CanvasProjectPage 
           conversations={conversations}
           setCurrentConvId={setCurrentConvId}
           createNewProject={createNewProject}
           updateProject={updateProject}
           deleteProject={(id: string) => {
             const e = { stopPropagation: () => {} } as any;
             deleteConversation(id, e);
           }}
           setShowCanvasProjects={setShowCanvasProjects}
           autoOpenProjectModal={autoOpenProjectModal}
           setAutoOpenProjectModal={setAutoOpenProjectModal}
           assets={assets}
        />
      ) : currentFunc === 'canvasDrama' ? (
        <CanvasDramaArea 
           apiKey={getApiKeyForModel('gemini-3.1-pro-preview')} 
           getApiKeyForModel={getApiKeyForModel}
           currentModelId={currentModelId}
           conversations={conversations}
           conversation={currentConvId ? conversations[currentConvId] : undefined}
           setCurrentConvId={setCurrentConvId}
           createNewProject={createNewProject}
           onUpdateCanvas={handleUpdateCanvas}
           onUpdateProjectInfo={handleUpdateProjectInfo}
           onUpdateNodeInGlobalState={handleUpdateNodeInGlobalState}
           onAppendNodesToGlobalState={handleAppendNodesToGlobalState}
           onUpdateHistory={handleUpdateHistory}
           onSaveAsset={handleSaveAsset}
           onDeleteAsset={handleDeleteAsset}
           assets={assets}
           sidebarOpen={sidebarOpen}
           setSidebarOpen={setSidebarOpen}
        />
      ) : (
        <ChatArea
          currentFunc={currentFunc}
          setCurrentFunc={setCurrentFunc}
          currentDramaSubFunc={currentDramaSubFunc}
          setCurrentDramaSubFunc={setCurrentDramaSubFunc}
          currentSeedanceSubFunc={currentSeedanceSubFunc}
          setCurrentSeedanceSubFunc={setCurrentSeedanceSubFunc}
          currentImageRatio={currentImageRatio}
          setCurrentImageRatio={setCurrentImageRatio}
          currentImageResolution={currentImageResolution}
          setCurrentImageResolution={setCurrentImageResolution}
          currentImageQuality={currentImageQuality}
          setCurrentImageQuality={setCurrentImageQuality}
          messages={currentMessages}
          input={input}
          setInput={setInput}
          attachedImages={attachedImages}
          setAttachedImages={setAttachedImages}
          onSend={handleSend}
          onStop={handleStop}
          isGenerating={!!currentConvId && generatingConvs.has(currentConvId)}
          onRegenerate={handleRegenerate}
          quickSend={handleSend}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          onSaveAsset={handleSaveAsset}
          assets={assets}
          currentModelId={currentModelId}
          setCurrentModelId={handleSetCurrentModelId}
          conversations={conversations}
          setCurrentConvId={setCurrentConvId}
          createNewProject={createNewProject}
          setShowCanvasProjects={setShowCanvasProjects}
          setAutoOpenProjectModal={setAutoOpenProjectModal}
        />
      )}

      {/* Toast */}
      <div
        className={cn(
          "fixed top-5 right-5 px-4 py-2.5 rounded-md text-[13px] text-white shadow-lg transition-all duration-300 z-[1000] max-w-[300px] pointer-events-none",
          toast ? "translate-y-0 opacity-100" : "-translate-y-5 opacity-0",
          toast?.isError ? "bg-red-500" : "bg-neutral-900"
        )}
      >
        {toast?.msg}
      </div>
    </div>
  );
}
