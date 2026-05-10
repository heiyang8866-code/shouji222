import { FastTextarea, FastInput } from "./FastInput";
import { motion, useDragControls } from "motion/react";
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { CanvasContext } from "../lib/CanvasContext";
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
  Node,
  Edge,
  MarkerType,
  addEdge,
  Connection,
  ReactFlowProvider,
  useReactFlow,
  Panel,
  SelectionMode,
} from "@xyflow/react";
import { v4 as uuidv4 } from "uuid";
import {
  Plus,
  FileText,
  Image as ImageIcon,
  Video,
  Layout,
  Search,
  MousePointer2,
  Pencil,
  X,
  History,
  FolderOpen,
  Share2,
  Headphones,
  HelpCircle,
  MessageCircle,
  Download,
  BookmarkPlus,
  Network,
  Menu,
  PanelLeftOpen,
  Play,
  Pause,
  Brain,
} from "lucide-react";
import "@xyflow/react/dist/style.css";
import * as mammoth from "mammoth";
import { MainScriptNode } from "./canvasNodes/MainScriptNode";
import { TextNode } from "./canvasNodes/TextNode";
import { ImageNode } from "./canvasNodes/ImageNode";
import { VideoNode } from "./canvasNodes/VideoNode";
import { AssetNode } from "./canvasNodes/AssetNode";
import { TextExtractionNode } from "./canvasNodes/TextExtractionNode";
import { DeletableEdge } from "./canvasNodes/DeletableEdge";
import {
  callGeminiAPI,
  callGeminiStreamAPI,
  parseVideoAndExtractText,
  callYunwuVideoAPI,
} from "../lib/api";
import { Message } from "../types";
import { cn } from "../lib/utils";

const GhostNode = ({ nodeType }: { nodeType: string }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (ref.current) {
        ref.current.style.left = `${e.clientX}px`;
        ref.current.style.top = `${e.clientY}px`;
        ref.current.style.opacity = "0.6";
      }
    };
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, []);

  return (
    <div
      ref={ref}
      className="fixed pointer-events-none z-50 opacity-0"
      style={{
        transform: "translate(-50%, -50%)",
        left: "50%",
        top: "50%",
      }}
    >
      <div className="bg-white border border-neutral-200 rounded-xl shadow-xl w-64 p-4 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-neutral-500">
          {nodeType === "mainScript" && (
            <>
              <FileText size={18} />{" "}
              <span className="font-medium text-sm">剧本节点</span>
            </>
          )}
          {nodeType === "imageNode" && (
            <>
              <ImageIcon size={18} />{" "}
              <span className="font-medium text-sm">图像节点</span>
            </>
          )}
          {nodeType === "videoNode" && (
            <>
              <Video size={18} />{" "}
              <span className="font-medium text-sm">视频节点</span>
            </>
          )}
          {nodeType === "textNode" && (
            <>
              <span className="font-serif text-lg leading-none">T</span>{" "}
              <span className="font-medium text-sm">文本节点</span>
            </>
          )}
        </div>
        <div className="text-xs text-neutral-400">点击画布放置节点...</div>
      </div>
    </div>
  );
};

function HistoryMediaItem({ item }: { item: any }) {
  const mediaRef = useRef<HTMLMediaElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const togglePlay = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (mediaRef.current) {
      if (isPlaying) {
        mediaRef.current.pause();
      } else {
        mediaRef.current
          .play()
          .catch((err) => console.error("Play failed", err));
      }
    }
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (mediaRef.current && (item.type === "video" || item.type === "audio")) {
      mediaRef.current
        .play()
        .catch((err) => console.log("Autoplay blocked", err));
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (mediaRef.current && (item.type === "video" || item.type === "audio")) {
      mediaRef.current.pause();
      mediaRef.current.currentTime = 0;
    }
  };

  return (
    <div
      className="w-full aspect-square relative group/media overflow-hidden rounded-lg bg-neutral-900 border border-neutral-200/50"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {item.type === "video" ? (
        <video
          ref={mediaRef as any}
          src={item.url}
          className="w-full h-full object-cover"
          preload="metadata"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          muted={isHovered}
          loop
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <audio
            ref={mediaRef as any}
            src={item.url}
            preload="metadata"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
            loop
          />
          <Headphones
            size={24}
            className={cn("text-blue-500", isPlaying && "animate-pulse")}
          />
        </div>
      )}

      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center z-10 transition-all duration-300",
          !isPlaying
            ? "bg-black/40"
            : "bg-transparent opacity-0 group-hover/media:opacity-100",
        )}
      >
        <button
          onClick={(e) => togglePlay(e)}
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center border-none shadow-xl backdrop-blur-md cursor-pointer pointer-events-auto transition-all bg-white/20 text-white hover:bg-white/30",
          )}
        >
          {isPlaying ? (
            <Pause size={14} />
          ) : (
            <Play size={14} className="ml-0.5" />
          )}
        </button>
      </div>
    </div>
  );
}

function AssetMediaItemCanvas({
  asset,
  onDelete,
}: {
  asset: any;
  onDelete?: (id: string) => void;
}) {
  const mediaRef = useRef<HTMLMediaElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const togglePlay = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (mediaRef.current) {
      if (isPlaying) {
        mediaRef.current.pause();
      } else {
        mediaRef.current
          .play()
          .catch((err) => console.error("Play failed", err));
      }
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const a = document.createElement("a");
    a.href = asset.url;
    a.download = `asset-${asset.id}.${asset.type === "image" ? "png" : asset.type === "video" ? "mp4" : "mp3"}`;
    a.click();
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (
      mediaRef.current &&
      (asset.type === "video" || asset.type === "audio")
    ) {
      mediaRef.current
        .play()
        .catch((err) => console.log("Autoplay blocked", err));
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (
      mediaRef.current &&
      (asset.type === "video" || asset.type === "audio")
    ) {
      mediaRef.current.pause();
      mediaRef.current.currentTime = 0;
    }
  };

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="group relative aspect-square rounded-xl overflow-hidden bg-neutral-100 border border-neutral-200/50 shadow-sm hover:ring-2 hover:ring-blue-400 transition-all cursor-pointer"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", asset.url);
        e.dataTransfer.setData("application/x-custom-type", asset.type);
        e.dataTransfer.setData("application/x-source", "assets-area");
      }}
    >
      <div className="absolute top-1 right-1 flex gap-1 z-30 opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100">
        <button
          onClick={handleDownload}
          className="w-6 h-6 bg-blue-600 hover:bg-blue-500 text-white rounded-full flex items-center justify-center border-none cursor-pointer shadow-lg"
          title="下载"
        >
          <Download size={12} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.(asset.id);
          }}
          className="w-6 h-6 bg-black/60 hover:bg-red-500 text-white rounded-full flex items-center justify-center border-none cursor-pointer shadow-lg"
          title="删除"
        >
          <X size={12} />
        </button>
      </div>

      {asset.type === "image" ? (
        <img
          src={asset.url}
          alt={asset.name}
          draggable="false"
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />
      ) : asset.type === "video" ? (
        <div className="w-full h-full bg-black relative flex items-center justify-center">
          <video
            ref={mediaRef as any}
            src={asset.url}
            draggable="false"
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
            muted={isHovered}
            loop
          />
          <div
            className={cn(
              "absolute inset-0 flex items-center justify-center z-10 pointer-events-none transition-all duration-300",
              !isPlaying ? "bg-black/40" : "bg-transparent",
            )}
          >
            <button
              onClick={(e) => togglePlay(e)}
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center border-none shadow-xl backdrop-blur-md cursor-pointer pointer-events-auto transition-all",
                isPlaying
                  ? "opacity-0 group-hover:opacity-100 bg-white/10 text-white/50 hover:bg-white/20 hover:text-white"
                  : "bg-white/20 text-white hover:bg-white/30 hover:scale-110",
              )}
            >
              {isPlaying ? (
                <Pause size={12} />
              ) : (
                <Play size={12} className="ml-0.5" />
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-neutral-400 group-hover:text-blue-600 transition-colors relative">
          <audio
            ref={mediaRef as any}
            src={asset.url}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
            loop
          />
          <Headphones
            size={20}
            className={cn(isPlaying && "text-blue-600 animate-pulse")}
          />
          <span className="text-[9px] px-1 truncate w-[80%] text-center">
            {asset.name || "音频"}
          </span>
          <div
            className={cn(
              "absolute inset-0 flex items-center justify-center z-10 pointer-events-none transition-all duration-300",
              isPlaying
                ? "bg-transparent"
                : "bg-black/5 group-hover:bg-black/10",
            )}
          >
            <button
              onClick={(e) => togglePlay(e)}
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center border-none shadow-xl backdrop-blur-md cursor-pointer pointer-events-auto transition-all",
                isPlaying
                  ? "opacity-0 group-hover:opacity-100 bg-black/20 text-white/70 hover:bg-black/40"
                  : "bg-black/40 text-white hover:bg-black/60 hover:scale-110",
              )}
            >
              {isPlaying ? (
                <Pause size={12} />
              ) : (
                <Play size={12} className="ml-0.5" />
              )}
            </button>
          </div>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/60 to-transparent">
        <div className="text-[9px] text-white/90 font-medium truncate w-full drop-shadow-md">
          {asset.type === "image"
            ? "图像"
            : asset.type === "video"
              ? "视频"
              : "音频"}
        </div>
      </div>
    </div>
  );
}

const nodeTypes = {
  mainScript: MainScriptNode,
  textNode: TextNode,
  imageNode: ImageNode,
  videoNode: VideoNode,
  assetNode: AssetNode,
  textExtractionNode: TextExtractionNode,
};

const edgeTypes = {
  deletable: DeletableEdge,
};

function CanvasDramaAreaInner({
  apiKey,
  getApiKeyForModel,
  currentModelId,
  conversation,
  onUpdateCanvas,
  onUpdateProjectInfo,
  onUpdateNodeInGlobalState,
  onAppendNodesToGlobalState,
  onUpdateHistory,
  onSaveAsset,
  onDeleteAsset,
  assets,
  sidebarOpen,
  setSidebarOpen,
}: {
  apiKey: string;
  getApiKeyForModel: (modelId: string) => string;
  currentModelId?: string;
  conversation?: any;
  onUpdateCanvas?: (nodes: Node[], edges: Edge[], title: string) => void;
  onUpdateProjectInfo?: (title: string, description: string) => void;
  onUpdateNodeInGlobalState?: (
    convId: string,
    nodeId: string,
    nodeUpdates: any,
  ) => void;
  onAppendNodesToGlobalState?: (
    convId: string,
    nodes: any[],
    edges: any[],
  ) => void;
  onUpdateHistory?: (
    convId: string,
    historyItem: {
      id: string;
      type: "image" | "audio" | "video";
      url: string;
      timestamp: number;
    },
  ) => void;
  onSaveAsset?: (url: string, type: "image" | "audio") => void;
  onDeleteAsset?: (id: string) => void;
  assets?: any[];
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const nodeAbortControllersRef = useRef<Record<string, AbortController>>({});

  const handleNodeStop = useCallback((id: string) => {
    if (nodeAbortControllersRef.current[id]) {
      nodeAbortControllersRef.current[id].abort();
      delete nodeAbortControllersRef.current[id];
    }
  }, []);
  const [edges, setEdges] = useState<Edge[]>([]);
  const dragControls = useDragControls();
  const [isExtracting, setIsExtracting] = useState(false);
  const [tempGroupingActive, setTempGroupingActive] = useState(false);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [lastImageParams, setLastImageParams] = useState({
    modelId: "gemini-3.1-flash-image-preview", // nanobanana2
    resolution: "1k",
    ratio: "16:9",
    quality: "medium", // 中
    imageCount: 1,
  });

  const lastImageParamsRef = useRef(lastImageParams);
  useEffect(() => {
    lastImageParamsRef.current = lastImageParams;
  }, [lastImageParams]);

  const { fitView, getEdges, getNodes } = useReactFlow();

  const [history, setHistory] = useState<{ nodes: Node[]; edges: Edge[] }[]>(
    [],
  );
  const [future, setFuture] = useState<{ nodes: Node[]; edges: Edge[] }[]>([]);

  const takeSnapshot = useCallback(() => {
    // Optimization: avoid instant snapshots that stack up during rapid interaction
    const currentNodes = getNodes();
    const currentEdges = getEdges();

    // We use a debounce-style approach or simplified clone for history markers
    const createMemoizedSnapshot = (nodes: Node[], edges: Edge[]) => {
      // Manual efficient clone to avoid blocking main thread with massive Base64 stringification
      const cleanedNodes = nodes.map((node) => {
        const newNode = { ...node, data: { ...node.data } };

        // If it's an asset node with lots of localAssets, we only keep the URLs
        // if they are not already too large or just keep the ID references if possible.
        // For standard undo/redo of positioning, shallow copy of data is usually enough.
        // Re-parsing megabytes of Base64 strings in every history step is what causes the crash.
        return newNode;
      });

      return {
        nodes: cleanedNodes,
        edges: [...edges],
      };
    };

    setTimeout(() => {
      setHistory((prev) => {
        const snapshot = createMemoizedSnapshot(currentNodes, currentEdges);
        const next = [...prev, snapshot];
        return next.slice(-30); // Keep last 30 states
      });
      setFuture([]);
    }, 10);
  }, [getNodes, getEdges]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInputFocused =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        (activeElement as HTMLElement)?.isContentEditable;

      if (e.code === "Space" && !isInputFocused) {
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpacePressed(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const [editProjectModalOpen, setEditProjectModalOpen] = useState(false);
  const [editProjectTitle, setEditProjectTitle] = useState("");
  const [editProjectDesc, setEditProjectDesc] = useState("");

  const [activeSidebarPanel, setActiveSidebarPanel] = useState<
    "none" | "history" | "assets"
  >("none");
  const [nodeMenuOpen, setNodeMenuOpen] = useState(false);
  const [placingNodeType, setPlacingNodeType] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isChatOpen && chatMessagesEndRef.current) {
      chatMessagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, isChatOpen]);

  const handleShareProject = () => {
    if (!conversation) return;
    const projectContent = JSON.stringify(
      { nodes, edges, title: conversation.title || "星幕项目" },
      null,
      2,
    );
    const blob = new Blob([projectContent], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${conversation.title || "canvas_project"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatting) return;

    const userText = chatInput.trim();
    setChatInput("");
    setIsChatting(true);

    setChatMessages((prev) => [
      ...prev,
      { role: "user", content: userText },
      { role: "assistant", content: "..." },
    ]);

    try {
      const activeApiKey = getApiKeyForModel(
        currentModelId || "gemini-3.1-pro-preview",
      );
      const messagesPayload = [
        ...chatMessages,
        { role: "user", content: userText },
      ] as any;
      let finalContent = "";
      const abortController = new AbortController();

      try {
        await callGeminiStreamAPI(
          messagesPayload,
          "chat",
          currentModelId || "gemini-3.1-pro-preview",
          activeApiKey,
          undefined,
          (chunk) => {
            finalContent = chunk;
            setChatMessages((prev) => {
              const newMsgs = [...prev];
              newMsgs[newMsgs.length - 1] = {
                role: "assistant",
                content: finalContent,
                thinking: newMsgs[newMsgs.length - 1].thinking,
              };
              return newMsgs;
            });
          },
          (thinking) => {
            setChatMessages((prev) => {
              const newMsgs = [...prev];
              newMsgs[newMsgs.length - 1] = {
                role: "assistant",
                content: finalContent,
                thinking: thinking,
              };
              return newMsgs;
            });
          },
          abortController.signal,
        );
      } catch (streamErr: any) {
        if (streamErr.name === 'AbortError' || streamErr.name === 'DOMException' || streamErr.message?.includes('aborted')) throw streamErr;
        console.warn("Streaming API failed in chat, falling back to basic API", streamErr);
        const result = await callGeminiAPI(
          messagesPayload,
          "chat",
          currentModelId || "gemini-3.1-pro-preview",
          activeApiKey,
          undefined,
          abortController.signal
        );
        finalContent = result.text;
        setChatMessages((prev) => {
          const newMsgs = [...prev];
          newMsgs[newMsgs.length - 1] = {
            role: "assistant",
            content: finalContent,
            thinking: result.thinking || newMsgs[newMsgs.length - 1].thinking,
          };
          return newMsgs;
        });
      }

      setIsChatting(false);
    } catch (error: any) {
      console.error(error);
      setIsChatting(false);
      setChatMessages((prev) => {
        const newMsgs = [...prev];
        newMsgs[newMsgs.length - 1] = {
          role: "assistant",
          content: `请求失败: ${error.message || "请检查API Key设置。"}`,
        };
        return newMsgs;
      });
    }
  };

  const apiKeyRef = useRef(apiKey);
  const onUpdateHistoryRef = useRef(onUpdateHistory);
  const onSaveAssetRef = useRef(onSaveAsset);
  const onUpdateCanvasRef = useRef(onUpdateCanvas);

  const targetConvIdRef = useRef(conversation?.id);
  const onUpdateNodeInGlobalStateRef = useRef(onUpdateNodeInGlobalState);
  const onAppendNodesToGlobalStateRef = useRef(onAppendNodesToGlobalState);

  const createNodeDataRef = useRef<any>(null);

  useEffect(() => {
    apiKeyRef.current = apiKey;
  }, [apiKey]);

  useEffect(() => {
    targetConvIdRef.current = conversation?.id;
  }, [conversation?.id]);

  useEffect(() => {
    onUpdateNodeInGlobalStateRef.current = onUpdateNodeInGlobalState;
  }, [onUpdateNodeInGlobalState]);

  useEffect(() => {
    onAppendNodesToGlobalStateRef.current = onAppendNodesToGlobalState;
  }, [onAppendNodesToGlobalState]);

  useEffect(() => {
    onUpdateHistoryRef.current = onUpdateHistory;
  }, [onUpdateHistory]);

  useEffect(() => {
    onSaveAssetRef.current = onSaveAsset;
  }, [onSaveAsset]);

  useEffect(() => {
    onUpdateCanvasRef.current = onUpdateCanvas;
  }, [onUpdateCanvas]);

  const lastUpdateRef = useRef({ nodes: "", edges: "" });

  const [rfInstance, setRfInstance] = useState<any>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    flowPos: { x: number; y: number };
    sourceParams?: {
      nodeId: string;
      handleId: string | null;
      handleType: string;
    };
  } | null>(null);
  const lastConnectionEndRef = useRef<number>(0);
  const connectingNodeId = useRef<string | null>(null);
  const connectingHandleId = useRef<string | null>(null);
  const connectingHandleType = useRef<string | null>(null);
  const connectionStartPos = useRef<{ x: number; y: number } | null>(null);
  const connectionHandledRef = useRef(false);

  const edgesRef = useRef<Edge[]>([]);
  const assetsRef = useRef<any[]>([]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  useEffect(() => {
    assetsRef.current = assets || [];
  }, [assets]);

  const handleDeleteEdge = useCallback(
    (id: string) => {
      takeSnapshot();

      const currentEdges = getEdges();
      const edge = currentEdges.find((e) => e.id === id);
      if (edge) {
        setNodes((nds) => {
          const sourceNode = nds.find((n) => n.id === edge.source);
          const targetNode = nds.find((n) => n.id === edge.target);

          if (
            targetNode?.type === "imageNode" ||
            targetNode?.type === "videoNode"
          ) {
            const currentAttached =
              (targetNode.data.attachedImages as string[]) || [];
            if (currentAttached.length === 0) return nds;

            // Find images provided by other edges to know what to keep
            const otherEdges = currentEdges.filter(
              (e) => e.target === targetNode.id && e.id !== id,
            );
            const otherSourcesSet = new Set<string>();
            otherEdges.forEach((e) => {
              const sn = nds.find((n) => n.id === e.source);
              if (sn?.type === "assetNode") {
                const snAssets = [
                  ...(assetsRef.current || []),
                  ...((sn.data.localAssets as any[]) || []),
                ];
                const snSelected = (sn.data.selectedAssetIds as string[]) || [];
                snAssets
                  .filter((a) => snSelected.includes(a.id))
                  .forEach((a) => otherSourcesSet.add(a.url));
              } else if (sn?.type === "imageNode") {
                if (sn.data.imageSrc)
                  otherSourcesSet.add(sn.data.imageSrc as string);
              } else if (sn?.type === "videoNode") {
                if (sn.data.videoSrc)
                  otherSourcesSet.add(sn.data.videoSrc as string);
              }
            });

            // Gather URLs from the actual source node being disconnected
            const sourceUrlsToRemove = new Set<string>();
            if (sourceNode?.type === "assetNode") {
              const allAssets = [
                ...(assetsRef.current || []),
                ...((sourceNode.data.localAssets as any[]) || []),
              ];
              const selectedIds =
                (sourceNode.data.selectedAssetIds as string[]) || [];
              allAssets
                .filter((a) => selectedIds.includes(a.id))
                .forEach((a) => sourceUrlsToRemove.add(a.url));
            } else if (sourceNode?.type === "imageNode") {
              if (sourceNode.data.imageSrc)
                sourceUrlsToRemove.add(sourceNode.data.imageSrc as string);
            } else if (sourceNode?.type === "videoNode") {
              if (sourceNode.data.videoSrc)
                sourceUrlsToRemove.add(sourceNode.data.videoSrc as string);
            }

            const newAttached = currentAttached.filter((url) => {
              if (sourceUrlsToRemove.has(url)) {
                // Only remove if it's NOT provided by another edge
                return otherSourcesSet.has(url);
              }
              return true;
            });

            if (newAttached.length !== currentAttached.length) {
              const targetIdx = nds.findIndex((n) => n.id === targetNode.id);
              if (targetIdx !== -1) {
                const newNodes = [...nds];
                newNodes[targetIdx] = {
                  ...targetNode,
                  data: { ...targetNode.data, attachedImages: newAttached },
                };
                return newNodes;
              }
            }
          }
          return nds;
        });
      }

      setEdges((eds) => eds.filter((e) => e.id !== id));
    },
    [takeSnapshot, getEdges, setNodes],
  );

  const defaultEdgeOptions = useMemo(
    () => ({
      type: "deletable",
      markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8" },
      style: { strokeWidth: 2, stroke: "#94a3b8" },
      data: { onDelete: handleDeleteEdge },
    }),
    [handleDeleteEdge],
  );

  const locallyDeletedNodeIds = useRef<Set<string>>(new Set());

  const onNodesChange = useCallback(
    (changes: NodeChange<Node>[]) => {
      changes.forEach((c) => {
        if (c.type === "remove") {
          locallyDeletedNodeIds.current.add(c.id);
        }
      });
      setNodes((nds) => applyNodeChanges(changes, nds));
    },
    [],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) =>
      setEdges((eds) => applyEdgeChanges(changes, eds)),
    [],
  );

  const handleNodeChange = useCallback(
    (id: string, newData: any) => {
      setNodes((nds) => {
        const index = nds.findIndex((n) => n.id === id);
        if (index === -1) return nds;

        const updatedNodes = [...nds];
        const oldNode = updatedNodes[index];

        // Prevent update if data is identical. Use a faster comparison than JSON.stringify for large objects.
        const isIdentical = Object.keys(newData).every((key) => {
          const oldVal = oldNode.data[key];
          const newVal = newData[key];
          if (oldVal === newVal) return true;
          // Faster array check
          if (Array.isArray(oldVal) && Array.isArray(newVal)) {
            if (oldVal.length !== newVal.length) return false;
            // Only check some elements or use JSON.stringify if it's small,
            // but for simple string arrays, every is fast enough.
            return oldVal.every((v, i) => v === newVal[i]);
          }
          // Fallback for objects
          if (
            oldVal &&
            newVal &&
            typeof oldVal === "object" &&
            typeof newVal === "object"
          ) {
            // Optimization: Skip deep comparison for large data arrays like imageSrcs or results
            if (
              key === "imageSrcs" ||
              key === "results" ||
              key === "localAssets"
            )
              return false;
            return JSON.stringify(newVal) === JSON.stringify(oldVal);
          }
          return false;
        });
        if (isIdentical) return nds;

        updatedNodes[index] = {
          ...oldNode,
          data: { ...oldNode.data, ...newData },
        };

        const triggerNode = updatedNodes[index];

        // Track last used image parameters
        if (triggerNode.type === "imageNode") {
          const keys = [
            "modelId",
            "ratio",
            "resolution",
            "quality",
            "imageCount",
          ];
          const hasUpdate = keys.some((k) => k in newData);
          if (hasUpdate) {
            setLastImageParams((prev) => ({
              ...prev,
              ...(newData.modelId !== undefined && {
                modelId: newData.modelId,
              }),
              ...(newData.ratio !== undefined && { ratio: newData.ratio }),
              ...(newData.resolution !== undefined && {
                resolution: newData.resolution,
              }),
              ...(newData.quality !== undefined && {
                quality: newData.quality,
              }),
              ...(newData.imageCount !== undefined && {
                imageCount: newData.imageCount,
              }),
            }));
          }
        }

        let finalNodes = [...updatedNodes];
        const edgesToRemove = new Set<string>();
        const currentEdges = getEdges();

        // Sync Case 1: Asset Node -> Downstream Image/Video Nodes
        if (triggerNode.type === "assetNode" && "selectedAssetIds" in newData) {
          const allAssets = [
            ...(assetsRef.current || []),
            ...((triggerNode.data.localAssets as any[]) || []),
          ];

          const newSelectedIds = (newData.selectedAssetIds as string[]) || [];
          const oldSelectedIds =
            (oldNode.data.selectedAssetIds as string[]) || [];

          const newSelectedSet = new Set(newSelectedIds);
          const oldSelectedSet = new Set(oldSelectedIds);

          const addedIds = newSelectedIds.filter(
            (id) => !oldSelectedSet.has(id),
          );
          const removedIds = oldSelectedIds.filter(
            (id) => !newSelectedSet.has(id),
          );

          if (addedIds.length > 0 || removedIds.length > 0) {
            const addedUrls = allAssets
              .filter((a) => addedIds.includes(a.id))
              .map((a) => a.url);
            const removedUrls = allAssets
              .filter((a) => removedIds.includes(a.id))
              .map((a) => a.url);
            const removedUrlsSet = new Set(removedUrls);

            const downstreamEdges = currentEdges.filter((e) => e.source === id);
            downstreamEdges.forEach((edge) => {
              const tIdx = finalNodes.findIndex((n) => n.id === edge.target);
              if (tIdx !== -1) {
                const targetNode = finalNodes[tIdx];
                if (
                  targetNode.type === "imageNode" ||
                  targetNode.type === "videoNode"
                ) {
                  const currentAttached =
                    (targetNode.data.attachedImages as string[]) || [];
                  let newAttached = [...currentAttached];

                  // Add precisely what was added
                  addedUrls.forEach((url) => {
                    if (!newAttached.includes(url)) newAttached.push(url);
                  });

                  // Remove precisely what was removed, but only if no other source provides it
                  if (removedUrlsSet.size > 0) {
                    const otherSourceEdges = currentEdges.filter(
                      (e) => e.target === targetNode.id && e.source !== id,
                    );
                    const urlsStillProvidedByOthers = new Set<string>();

                    otherSourceEdges.forEach((oe) => {
                      const sn = finalNodes.find((n) => n.id === oe.source);
                      if (sn?.type === "assetNode") {
                        const snAllAssets = [
                          ...(assetsRef.current || []),
                          ...((sn.data.localAssets as any[]) || []),
                        ];
                        const snSelected =
                          (sn.data.selectedAssetIds as string[]) || [];
                        snAllAssets
                          .filter((a) => snSelected.includes(a.id))
                          .forEach((a) => urlsStillProvidedByOthers.add(a.url));
                      }
                    });

                    newAttached = newAttached.filter((assetUrl) => {
                      if (removedUrlsSet.has(assetUrl)) {
                        return urlsStillProvidedByOthers.has(assetUrl);
                      }
                      return true;
                    });
                  }

                  const isAttachedChanged =
                    currentAttached.length !== newAttached.length ||
                    currentAttached.some(
                      (val, idx) => val !== newAttached[idx],
                    );

                  if (isAttachedChanged) {
                    finalNodes[tIdx] = {
                      ...targetNode,
                      data: { ...targetNode.data, attachedImages: newAttached },
                    };

                    if (
                      newAttached.length === 0 &&
                      currentAttached.length > 0
                    ) {
                      edgesToRemove.add(edge.id);
                    }
                  }
                }
              }
            });
          }
        }

        // Sync Case 4: Image/Video node input -> Upstream Asset Node selectedAssetIds (Reversed Sync)
        if (
          (triggerNode.type === "imageNode" ||
            triggerNode.type === "videoNode") &&
          "attachedImages" in newData
        ) {
          const oldAttached = (oldNode.data.attachedImages as string[]) || [];
          const newAttached = (newData.attachedImages as string[]) || [];

          // What was removed from this Image/Video node?
          const removedUrls = oldAttached.filter(
            (url) => !newAttached.includes(url),
          );

          if (removedUrls.length > 0) {
            const removedUrlsSet = new Set(removedUrls);
            const upstreamEdges = currentEdges.filter((e) => e.target === id);

            upstreamEdges.forEach((edge) => {
              const sIdx = finalNodes.findIndex((n) => n.id === edge.source);
              if (sIdx !== -1) {
                const sourceNode = finalNodes[sIdx];
                if (sourceNode.type === "assetNode") {
                  const sourceAllAssets = [
                    ...(assetsRef.current || []),
                    ...((sourceNode.data.localAssets as any[]) || []),
                  ];

                  // Find exactly which asset IDs map to the removed URLs in THIS source node
                  const idsToRemoveSet = new Set(
                    sourceAllAssets
                      .filter((a) => removedUrlsSet.has(a.url))
                      .map((a) => a.id),
                  );

                  if (idsToRemoveSet.size > 0) {
                    const currentSelectedIds =
                      (sourceNode.data.selectedAssetIds as string[]) || [];
                    const updatedSelectedIds = currentSelectedIds.filter(
                      (assetId) => !idsToRemoveSet.has(assetId),
                    );

                    if (
                      updatedSelectedIds.length !== currentSelectedIds.length
                    ) {
                      finalNodes[sIdx] = {
                        ...sourceNode,
                        data: {
                          ...sourceNode.data,
                          selectedAssetIds: updatedSelectedIds,
                        },
                      };

                      // Propagate this removal to OTHER Image/Video nodes connected to this same Asset Node
                      const siblingEdges = currentEdges.filter(
                        (e) => e.source === sourceNode.id && e.target !== id,
                      );
                      siblingEdges.forEach((siblingEdge) => {
                        const siblingIdx = finalNodes.findIndex(
                          (n) => n.id === siblingEdge.target,
                        );
                        if (siblingIdx !== -1) {
                          const siblingNode = finalNodes[siblingIdx];
                          if (
                            siblingNode.type === "imageNode" ||
                            siblingNode.type === "videoNode"
                          ) {
                            const siblingAttached =
                              (siblingNode.data.attachedImages as string[]) ||
                              [];
                            const newSiblingAttached = siblingAttached.filter(
                              (url) => !removedUrlsSet.has(url),
                            );

                            const isSiblingAttachedChanged =
                              siblingAttached.length !==
                                newSiblingAttached.length ||
                              siblingAttached.some(
                                (val, idx) => val !== newSiblingAttached[idx],
                              );

                            if (isSiblingAttachedChanged) {
                              finalNodes[siblingIdx] = {
                                ...siblingNode,
                                ...siblingNode, // TS safety
                                data: {
                                  ...siblingNode.data,
                                  attachedImages: newSiblingAttached,
                                },
                              };
                              if (newSiblingAttached.length === 0) {
                                edgesToRemove.add(siblingEdge.id);
                              }
                            }
                          }
                        }
                      });
                    }
                  }

                  // If all assets from THIS specific source were removed by user, disconnect
                  const stillHasSourceAssets = sourceAllAssets.some(
                    (a) =>
                      (
                        (sourceNode.data.selectedAssetIds as string[]) || []
                      ).includes(a.id) && newAttached.includes(a.url),
                  );
                  if (!stillHasSourceAssets) {
                    edgesToRemove.add(edge.id);
                  }
                } else if (
                  sourceNode.type === "imageNode" ||
                  sourceNode.type === "videoNode"
                ) {
                  // If the image provided by this source was removed, disconnect
                  if (
                    sourceNode.data.imageSrc &&
                    removedUrlsSet.has(sourceNode.data.imageSrc as string)
                  ) {
                    edgesToRemove.add(edge.id);
                  }
                }
              }
            });

            // If the downstream node dropped all images, tear down all upstream edges
            if (newAttached.length === 0 && oldAttached.length > 0) {
              upstreamEdges.forEach((e) => edgesToRemove.add(e.id));
            }
          }
        }

        // Sync Case 2: Image Node output -> Downstream Image Nodes
        if (
          triggerNode.type === "imageNode" &&
          "imageSrc" in newData &&
          oldNode.data.imageSrc !== newData.imageSrc
        ) {
          const newSrc = newData.imageSrc;
          const oldSrc = oldNode.data.imageSrc;

          const downstreamEdges = currentEdges.filter((e) => e.source === id);
          downstreamEdges.forEach((edge) => {
            const tIdx = finalNodes.findIndex((n) => n.id === edge.target);
            if (tIdx !== -1) {
              const targetNode = finalNodes[tIdx];
              if (targetNode.type === "imageNode") {
                const currentAttached =
                  (targetNode.data.attachedImages as string[]) || [];
                let newAttached = [...currentAttached];
                if (oldSrc && newAttached.includes(oldSrc as string)) {
                  newAttached = newSrc
                    ? newAttached.map((src) => (src === oldSrc ? newSrc : src))
                    : newAttached.filter((src) => src !== oldSrc);
                } else if (newSrc && !newAttached.includes(newSrc)) {
                  newAttached.push(newSrc);
                }
                finalNodes[tIdx] = {
                  ...targetNode,
                  data: { ...targetNode.data, attachedImages: newAttached },
                };
              }
            }
          });
        }

        // Sync Case 3: Node content -> Downstream Extracted Image Nodes content
        if ("content" in newData && oldNode.data.content !== newData.content) {
          const downstreamEdges = currentEdges.filter((e) => e.source === id);
          downstreamEdges.forEach((edge) => {
            const tIdx = finalNodes.findIndex((n) => n.id === edge.target);
            if (tIdx !== -1) {
              const targetNode = finalNodes[tIdx];
              if (
                (targetNode.type === "imageNode" &&
                  targetNode.data.isExtracted) ||
                targetNode.type === "textNode"
              ) {
                finalNodes[tIdx] = {
                  ...targetNode,
                  data: { ...targetNode.data, content: newData.content },
                };
              }
            }
          });
        }

        if (edgesToRemove.size > 0) {
          setTimeout(() => {
            setEdges((eds) => eds.filter((e) => !edgesToRemove.has(e.id)));
          }, 0);
        }

        return finalNodes;
      });
    },
    [setNodes, getEdges],
  );

  const handleSelectConnected = useCallback(
    (nodeId: string) => {
      const currentEdges = getEdges();

      // Create adjacency list for faster traversal
      const adj = new Map<string, string[]>();
      currentEdges.forEach((e) => {
        if (!adj.has(e.source)) adj.set(e.source, []);
        if (!adj.has(e.target)) adj.set(e.target, []);
        adj.get(e.source)!.push(e.target);
        adj.get(e.target)!.push(e.source);
      });

      // BFS/DFS to find all connected nodes (undirected component)
      const connectedSet = new Set<string>();
      const queue = [nodeId];

      while (queue.length > 0) {
        const currentId = queue.shift()!;
        if (connectedSet.has(currentId)) continue;

        connectedSet.add(currentId);

        const neighbors = adj.get(currentId);
        if (neighbors) {
          for (const neighbor of neighbors) {
            if (!connectedSet.has(neighbor)) {
              queue.push(neighbor);
            }
          }
        }
      }

      setNodes((nds) => {
        return nds.map((n) => ({
          ...n,
          selected: connectedSet.has(n.id),
        }));
      });
      setTempGroupingActive(true);
    },
    [getEdges, setNodes],
  );

  const onNodeDragStop = useCallback(() => {
    takeSnapshot();
    if (tempGroupingActive) {
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          selected: false,
        })),
      );
      setTempGroupingActive(false);
    }
  }, [tempGroupingActive, setNodes]);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      // Small delay to allow onNodeDragStop to fire if it's a drag
      setTimeout(() => {
        if (tempGroupingActive) {
          setNodes((nds) =>
            nds.map((n) => ({
              ...n,
              selected: false,
            })),
          );
          setTempGroupingActive(false);
        }
      }, 50);
    };

    if (tempGroupingActive) {
      window.addEventListener("mouseup", handleGlobalMouseUp);
    }
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, [tempGroupingActive, setNodes]);

  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) =>
      setEdges((els) =>
        addEdge(
          { ...newConnection, ...defaultEdgeOptions },
          els.filter((e) => e.id !== oldEdge.id),
        ),
      ),
    [defaultEdgeOptions],
  );

  const onConnect = useCallback(
    (params: Connection | Edge) => {
      const gNodes = getNodes();
      const targetNode = gNodes.find((n) => n.id === params.target);
      if (targetNode?.type === "assetNode") return;

      connectionHandledRef.current = true;
      takeSnapshot();
      setEdges((eds) => addEdge({ ...params, ...defaultEdgeOptions }, eds));

      // Implementation: Pass source node data to target node as input
      // This allows nodes to "consume" the output of the previous node
      setNodes((nds) => {
        const sourceNode = nds.find((n) => n.id === params.source);
        const targetNode = nds.find((n) => n.id === params.target);

        if (!sourceNode || !targetNode) return nds;

        const updatedNodes = [...nds];
        const targetIndex = updatedNodes.findIndex(
          (n) => n.id === targetNode.id,
        );

        if (targetIndex === -1) return nds;

        const newTargetData = {
          ...(updatedNodes[targetIndex].data as Record<string, any>),
        };
        let changed = false;

        // Different behavior based on target node type
        if (
          targetNode.type === "imageNode" ||
          targetNode.type === "videoNode"
        ) {
          const currentAttached =
            (newTargetData.attachedImages as string[]) || [];
          const newAttached = [...currentAttached];
          let imagesAdded = false;

          // Source is ImageNode
          if (sourceNode.type === "imageNode" && sourceNode.data.imageSrc) {
            const src = sourceNode.data.imageSrc as string;
            if (!newAttached.includes(src)) {
              newAttached.push(src);
              imagesAdded = true;
            }
          }
          // Source is VideoNode
          else if (
            sourceNode.type === "videoNode" &&
            sourceNode.data.videoSrc
          ) {
            const src = sourceNode.data.videoSrc as string;
            if (!newAttached.includes(src)) {
              newAttached.push(src);
              imagesAdded = true;
            }
          }
          // Source is AssetNode
          else if (sourceNode.type === "assetNode") {
            const allAssets = [
              ...(assets || []),
              ...((sourceNode.data.localAssets as any[]) || []),
            ] as any[];
            const selectedAssetIds = (sourceNode.data.selectedAssetIds ||
              []) as string[];
            const selectedUrls = allAssets
              .filter((a) => selectedAssetIds.includes(a.id))
              .map((a) => a.url);

            selectedUrls.forEach((url) => {
              if (!newAttached.includes(url)) {
                newAttached.push(url);
                imagesAdded = true;
              }
            });
          }

          if (imagesAdded) {
            newTargetData.attachedImages = newAttached;
            changed = true;
          }

          // Case for "Extracted" variant (copying text/content)
          if (newTargetData.isExtracted) {
            if (
              sourceNode.data.content &&
              sourceNode.data.content !== newTargetData.content
            ) {
              newTargetData.content = sourceNode.data.content;
              changed = true;
            }
          }
        } else if (targetNode.type === "textNode") {
          if (
            sourceNode.data.content &&
            sourceNode.data.content !== newTargetData.content
          ) {
            newTargetData.content = sourceNode.data.content;
            changed = true;
          }
        }

        if (changed) {
          updatedNodes[targetIndex] = {
            ...updatedNodes[targetIndex],
            data: newTargetData,
          };
          // Trigger downstream updates if needed
          setTimeout(() => handleNodeChange(targetNode.id, newTargetData), 0);
        }

        return updatedNodes;
      });
    },
    [handleNodeChange, defaultEdgeOptions, assets, getNodes, takeSnapshot],
  );
  const onConnectStart = useCallback(
    (event: any, { nodeId, handleId, handleType }: any) => {
      connectionHandledRef.current = false;
      connectingNodeId.current = nodeId;
      connectingHandleId.current = handleId;
      connectingHandleType.current = handleType;

      const clientX = event.clientX ?? event.touches?.[0]?.clientX;
      const clientY = event.clientY ?? event.touches?.[0]?.clientY;
      connectionStartPos.current = { x: clientX, y: clientY };
    },
    [],
  );

  const openMenu = useCallback(
    (
      clientX: number,
      clientY: number,
      sourceParams?: {
        nodeId: string;
        handleId: string | null;
        handleType: string;
      },
    ) => {
      if (!reactFlowWrapper.current || !rfInstance) return;

      const rect = reactFlowWrapper.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const flowPos = rfInstance.screenToFlowPosition({
        x: clientX,
        y: clientY,
      });

      setMenu({ x, y, flowPos, sourceParams });
      lastConnectionEndRef.current = Date.now();
    },
    [rfInstance],
  );

  const onConnectEnd = useCallback(
    (event: any) => {
      if (
        connectionHandledRef.current ||
        !connectingNodeId.current ||
        !rfInstance
      ) {
        connectingNodeId.current = null;
        connectingHandleId.current = null;
        connectingHandleType.current = null;
        return;
      }

      const clientX = event.clientX ?? event.changedTouches?.[0]?.clientX;
      const clientY = event.clientY ?? event.changedTouches?.[0]?.clientY;

      if (clientX === undefined || clientY === undefined) {
        connectingNodeId.current = null;
        connectingHandleId.current = null;
        connectingHandleType.current = null;
        connectionStartPos.current = null;
        return;
      }

      // Distance check to prevent menu on simple clicks (10px threshold)
      if (connectionStartPos.current) {
        const dx = clientX - connectionStartPos.current.x;
        const dy = clientY - connectionStartPos.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 10) {
          connectingNodeId.current = null;
          connectingHandleId.current = null;
          connectingHandleType.current = null;
          connectionStartPos.current = null;
          return;
        }
      }

      // Check what elements are at this point (detect if dropped on a node)
      const elements = document.elementsFromPoint(clientX, clientY);
      const nodeElement = elements.find((el) =>
        el.closest(".react-flow__node"),
      );
      const targetNodeId = nodeElement
        ?.closest(".react-flow__node")
        ?.getAttribute("data-id");

      if (targetNodeId && targetNodeId !== connectingNodeId.current) {
        // It landed on a node but not exactly on a handle
        const sourceId = connectingNodeId.current;
        const sourceHandle = connectingHandleId.current;
        const sourceHandleType = connectingHandleType.current;

        const isFromSource = sourceHandleType === "source";

        const targetNode = rfInstance.getNode(targetNodeId);
        if (isFromSource && targetNode?.type === "assetNode") {
          connectingNodeId.current = null;
          connectingHandleId.current = null;
          connectingHandleType.current = null;
          return;
        }

        const targetHandle = isFromSource
          ? [
              "imageNode",
              "videoNode",
              "textNode",
              "textExtractionNode",
            ].includes(targetNode?.type || "")
            ? "left"
            : "top"
          : sourceHandle || undefined;

        onConnect({
          source: isFromSource ? sourceId : targetNodeId,
          sourceHandle: isFromSource ? sourceHandle || undefined : undefined,
          target: isFromSource ? targetNodeId : sourceId,
          targetHandle: targetHandle,
        } as any);

        connectionHandledRef.current = true;
        document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      } else if (!targetNodeId) {
        // It landed on blank space
        openMenu(clientX, clientY, {
          nodeId: connectingNodeId.current,
          handleId: connectingHandleId.current,
          handleType: connectingHandleType.current!,
        });
      }

      connectingNodeId.current = null;
      connectingHandleId.current = null;
      connectingHandleType.current = null;
    },
    [rfInstance, onConnect, openMenu],
  );

  const handleUploadImage = useCallback(
    (id: string, imageSrc: string) => {
      setNodes((nds) => {
        const node = nds.find((n) => n.id === id);
        if (node) {
          const currentSrcs = (node.data.imageSrcs as string[]) || [];
          handleNodeChange(id, {
            imageSrc,
            imageSrcs: [imageSrc, ...currentSrcs],
          });
        }
        return nds;
      });
    },
    [handleNodeChange],
  );

  // Make sure edge additions get the delete callback
  useEffect(() => {
    setEdges((eds) =>
      eds.map((e) => ({
        ...e,
        data: { ...e.data, onDelete: handleDeleteEdge },
      })),
    );
  }, [handleDeleteEdge]);

  const handleDoubleClickWrapper = useCallback(
    (event: any) => {
      if (!rfInstance) return;

      // Check if it's really the pane or background (not node/edge)
      const target = event.target as HTMLElement;
      const isNode = target.closest(".react-flow__node");
      const isEdge = target.closest(".react-flow__edge");
      const isHandle = target.closest(".react-flow__handle");
      const isControl =
        target.closest(".react-flow__controls") ||
        target.closest(".react-flow__minimap");

      if (!isNode && !isEdge && !isHandle && !isControl) {
        if (event.preventDefault) event.preventDefault();
        if (event.stopPropagation) event.stopPropagation();
        openMenu(event.clientX, event.clientY);
      }
    },
    [rfInstance, openMenu],
  );

  const closeMenu = useCallback(() => setMenu(null), []);

  const onPaneClick = useCallback(
    (event: any) => {
      if (placingNodeType && rfInstance) {
        const position = rfInstance.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
        addNode(placingNodeType, position);
        setPlacingNodeType(null);
        return;
      }
      if (nodeMenuOpen) {
        setNodeMenuOpen(false);
      }
      setActiveSidebarPanel((prev) => (prev !== "none" ? "none" : prev));
      setIsChatOpen(false);

      // If double click, handle it
      if (event.detail === 2) {
        handleDoubleClickWrapper(event);
        return;
      }

      // If we just opened the menu from onConnectEnd, don't close it immediately
      const timeSinceConnectEnd = Date.now() - lastConnectionEndRef.current;
      if (timeSinceConnectEnd < 100) {
        return;
      }

      closeMenu();
    },
    [
      handleDoubleClickWrapper,
      closeMenu,
      placingNodeType,
      rfInstance,
      nodeMenuOpen,
    ],
  );

  const onPaneMouseMove = useCallback(
    (event: any) => {
      if (placingNodeType) {
        setMousePos({ x: event.clientX, y: event.clientY });
      }
    },
    [placingNodeType],
  );

  const onPaneContextMenu = useCallback(
    (event: any) => {
      if (!rfInstance) return;
      event.preventDefault();
      openMenu(event.clientX, event.clientY);
    },
    [rfInstance, openMenu],
  );

  const handleExtractText = useCallback(async (id: string, url: string) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id
          ? {
              ...n,
              data: {
                ...n.data,
                isExtracting: true,
                error: "",
                audioUrl: "",
                content: "",
              },
            }
          : n,
      ),
    );
    try {
      const activeApiKey = getApiKeyForModel("gemini-3.1-pro-preview");
      const result = await parseVideoAndExtractText(url, activeApiKey);
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id
            ? {
                ...n,
                data: {
                  ...n.data,
                  isExtracting: false,
                  audioUrl: result.audioUrl,
                  content: result.transcript,
                },
              }
            : n,
        ),
      );

      // Save audio to history
      if (result.audioUrl && onUpdateHistoryRef.current) {
        onUpdateHistoryRef.current(targetConvIdRef.current || "", {
          id: uuidv4(),
          type: "audio",
          url: result.audioUrl,
          timestamp: Date.now(),
        });
      }
    } catch (e: any) {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id
            ? {
                ...n,
                data: {
                  ...n.data,
                  isExtracting: false,
                  error: e.message || "提取失败",
                },
              }
            : n,
        ),
      );
    }
  }, []);

  const handleSwitchToAsset = useCallback(
    (id: string, url: string) => {
      // 1. Save to assets first (if callback exists)
      if (onSaveAsset) {
        onSaveAsset(url, "image");
      }

      // 2. Transform ImageNode to AssetNode
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === id) {
            // Need to find the newly created asset or just use the URL
            // Actually, AssetNode expects selectedAssetIds and matches them against allAssets.
            // It's better to create a new AssetNode with this image.
            // But since onSaveAsset might take time to populate the global assets list,
            // we might need to wait or just handle it gracefully.

            // For now, let's create a "virtual" asset if it's not in the list yet
            const tempId = `temp-${uuidv4()}`;
            const newAsset = {
              id: tempId,
              url,
              type: "image" as const,
              name: "新素材",
            };

            return {
              ...n,
              type: "assetNode",
              data: {
                ...n.data,
                title: "资产块",
                selectedAssetIds: [tempId],
                localAssets: [newAsset],
              },
            };
          }
          return n;
        }),
      );
    },
    [onSaveAsset, assets],
  );

  const handleExtract = useCallback(async (id: string) => {
    let hasInitiated = false;
    setNodes((currentNodes) => {
      const mainNode = currentNodes.find((n) => n.id === id);
      if (!mainNode || !mainNode.data.script || mainNode.data.isExtracting)
        return currentNodes;

      if (!hasInitiated) {
        hasInitiated = true;
        // Start extraction asynchronously outside the setState
        setTimeout(
          () =>
            performExtraction(id, mainNode.data.script as string, {
              ...((mainNode.data.extractParams as any) || {}),
              llmModelId: mainNode.data.llmModelId,
            }),
          0,
        );
      }

      return currentNodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, isExtracting: true, error: "" } } : n,
      );
    });
  }, []);

  const performExtraction = async (
    id: string,
    scriptText: string,
    extractParams: any = {},
  ) => {
    const targetConvId = targetConvIdRef.current;
    let thinkingText = "";
    let resultText = "";

    let lastNodeUpdateTime = 0;
    const updateProcessNode = (newThinking: string) => {
      const now = Date.now();
      if (now - lastNodeUpdateTime > 150) {
        setNodes((nds) => {
          const index = nds.findIndex((n) => n.id === id);
          if (index === -1) return nds;
          return nds.map((n) =>
            n.id === id
              ? { ...n, data: { ...n.data, thinking: newThinking } }
              : n,
          );
        });
        lastNodeUpdateTime = now;
      }
    };

    try {
      const activeLlmModelId =
        extractParams?.llmModelId || "gemini-3.1-pro-preview";
      const activeApiKey = getApiKeyForModel(activeLlmModelId);

      let response;
      const abortController = new AbortController();
      nodeAbortControllersRef.current[id] = abortController;
      try {
        response = await callGeminiStreamAPI(
          [{ role: "user", content: scriptText }],
          "seedance",
          activeLlmModelId,
          activeApiKey,
          "素材提取",
          (chunk) => {
            resultText = chunk;
          },
          (thinking) => {
            thinkingText = thinking;
            updateProcessNode(thinkingText);
          },
          abortController.signal,
        );
      } catch (streamErr: any) {
        if (streamErr.name === 'AbortError' || streamErr.name === 'DOMException' || streamErr.message?.includes('aborted')) throw streamErr;
        console.warn("Streaming API failed, falling back to basic API", streamErr);
        const result = await callGeminiAPI(
          [{ role: "user", content: scriptText }],
          "seedance",
          activeLlmModelId,
          activeApiKey,
          "素材提取",
          abortController.signal
        );
        resultText = result.text;
        thinkingText = result.thinking || "";
        updateProcessNode(thinkingText);
        response = { text: resultText, thinking: thinkingText };
      }

      // Parsing the final result text into segments
      const segments = response.text
        .replace(/```[a-z]*\n?/gi, "")
        .split(/(?:\r?\n){2,}/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const newNodes: Node[] = [];
      const newEdges: Edge[] = [];

      segments.forEach((segment, i) => {
        const lines = segment.split(/\r?\n/);
        let title = `素材分段 ${i + 1}`;
        let content = segment;

        if (lines.length > 1) {
          const firstLine = lines[0].replace(/[:：]$/, "").trim();
          if (firstLine.length < 30) {
            title = firstLine;
            content = lines.slice(1).join("\n").trim();
          }
        }

        const imageId = `extract-image-${id}-${i}`;
        // Position relative to parent - Below the thinking process
        const xOffset = 0;
        const yOffset = 800 + i * 500;

        newNodes.push({
          id: imageId,
          type: "imageNode",
          position: { x: xOffset, y: yOffset },
          // Use parentId to group them
          parentId: id,
          data: createNodeDataRef.current
            ? createNodeDataRef.current("imageNode", {
                variant: "extracted",
                title: title,
                content: content,
                modelId:
                  extractParams?.modelId || lastImageParamsRef.current.modelId,
                ratio: extractParams?.ratio || lastImageParamsRef.current.ratio,
                resolution:
                  extractParams?.resolution ||
                  lastImageParamsRef.current.resolution,
              })
            : {},
        });

        newEdges.push({
          id: `e-v-${id}-${imageId}`,
          source: id,
          sourceHandle: "extract",
          target: imageId,
          targetHandle: "left",
          hidden: true,
          ...defaultEdgeOptions,
        });
      });

      if (!targetConvId || targetConvId === targetConvIdRef.current) {
        setNodes((nds) => [...nds, ...newNodes]);
        setEdges((eds) => [...eds, ...newEdges]);
      }

      if (targetConvId && onAppendNodesToGlobalStateRef.current) {
        onAppendNodesToGlobalStateRef.current(targetConvId, newNodes, newEdges);
      }

      if (targetConvId && onUpdateNodeInGlobalStateRef.current) {
        onUpdateNodeInGlobalStateRef.current(targetConvId, id, {
          isExtracting: false,
          thinking: thinkingText,
        });
      }
    } catch (e: any) {
      if (e.name === 'AbortError' || e.message?.includes('aborted')) {
        if (targetConvId && onUpdateNodeInGlobalStateRef.current) {
          onUpdateNodeInGlobalStateRef.current(targetConvId, id, { isExtracting: false, thinking: thinkingText });
        }
        if (!targetConvId || targetConvId === targetConvIdRef.current) {
          setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, isExtracting: false, thinking: thinkingText } } : n));
        }
        return;
      }
      console.error("Extraction error", e);
      if (targetConvId && onUpdateNodeInGlobalStateRef.current) {
        onUpdateNodeInGlobalStateRef.current(targetConvId, id, {
          isExtracting: false,
          error: e.message || "提取失败",
        });
      }
      if (!targetConvId || targetConvId === targetConvIdRef.current) {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === id
              ? { ...n, data: { ...n.data, isExtracting: false, error: e.message || "提取失败" } }
              : n,
          ),
        );
      }
    } finally {
      if (nodeAbortControllersRef.current[id]) {
        delete nodeAbortControllersRef.current[id];
      }
      if (!targetConvId || targetConvId === targetConvIdRef.current) {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === id
              ? { ...n, data: { ...n.data, isExtracting: false, thinking: thinkingText } }
              : n,
          ),
        );
      }
    }
  };

  const handleGeneratePrompt = useCallback(async (id: string) => {
    let hasInitiated = false;
    setNodes((currentNodes) => {
      const mainNode = currentNodes.find((n) => n.id === id);
      if (
        !mainNode ||
        !mainNode.data.script ||
        mainNode.data.isGeneratingPrompt
      )
        return currentNodes;

      if (!hasInitiated) {
        hasInitiated = true;
        setTimeout(
          () =>
            performGeneratePrompt(id, mainNode.data.script as string, {
              ...((mainNode.data.promptParams as any) || {}),
              llmModelId: mainNode.data.llmModelId,
            }),
          0,
        );
      }
      return currentNodes.map((n) =>
        n.id === id
          ? { ...n, data: { ...n.data, isGeneratingPrompt: true, error: "" } }
          : n,
      );
    });
  }, []);

  const performGeneratePrompt = async (
    id: string,
    scriptText: string,
    promptParams: any = {},
  ) => {
    const targetConvId = targetConvIdRef.current;
    let thinkingText = "";
    let resultText = "";

    let lastNodeUpdateTime = 0;
    const updateProcessNode = (newThinking: string) => {
      const now = Date.now();
      if (now - lastNodeUpdateTime > 150) {
        setNodes((nds) => {
          const index = nds.findIndex((n) => n.id === id);
          if (index === -1) return nds;
          return nds.map((n) =>
            n.id === id
              ? { ...n, data: { ...n.data, thinking: newThinking } }
              : n,
          );
        });
        lastNodeUpdateTime = now;
      }
    };

    try {
      const activeLlmModelId =
        promptParams?.llmModelId || "gemini-3.1-pro-preview";
      const activeApiKey = getApiKeyForModel(activeLlmModelId);

      let response;
      const abortController = new AbortController();
      nodeAbortControllersRef.current[id] = abortController;
      try {
        response = await callGeminiStreamAPI(
          [{ role: "user", content: scriptText }],
          "seedance",
          activeLlmModelId,
          activeApiKey,
          "互动剧提示词",
          (chunk) => {
            resultText = chunk;
          },
          (thinking) => {
            thinkingText = thinking;
            updateProcessNode(thinkingText);
          },
          abortController.signal,
        );
      } catch (streamErr: any) {
        if (streamErr.name === 'AbortError' || streamErr.name === 'DOMException' || streamErr.message?.includes('aborted')) throw streamErr;
        console.warn("Streaming API failed, falling back to basic API", streamErr);
        const result = await callGeminiAPI(
          [{ role: "user", content: scriptText }],
          "seedance",
          activeLlmModelId,
          activeApiKey,
          "互动剧提示词",
          abortController.signal
        );
        resultText = result.text;
        thinkingText = result.thinking || "";
        updateProcessNode(thinkingText);
        response = { text: resultText, thinking: thinkingText };
      }

      // Parsing the final result text into segments
      const segments = response.text
        .replace(/```[a-z]*\n?/gi, "")
        .split(/(?:\r?\n){2,}/)
        .map((s) => s.trim())
        .filter((s) => s.length > 5);

      const newNodes: Node[] = [];
      const newEdges: Edge[] = [];

      segments.forEach((segment, i) => {
        const lines = segment.split(/\r?\n/);
        let title = `场号分段 ${i + 1}`;
        let content = segment;

        if (lines.length > 1) {
          const firstLine = lines[0].replace(/[:：]$/, "").trim();
          if (firstLine.length < 30) {
            title = firstLine;
            content = lines.slice(1).join("\n").trim();
          }
        }

        const videoId = `prompt-video-${id}-${i}`;
        // Position relative to parent - Below the thinking process
        const xOffset = 0;
        const yOffset = 800 + i * 500;

        const newNodeData = createNodeDataRef.current
          ? createNodeDataRef.current("videoNode", {
              variant: "extracted",
              title: title,
              content: content,
              modelId: promptParams?.modelId || "grok-video-3",
              ratio: promptParams?.ratio || "16:9",
              resolution: promptParams?.resolution || "1080p",
              videoDurationId: promptParams?.videoDurationId || "5s",
            })
          : {};

        newNodes.push({
          id: videoId,
          type: "videoNode",
          position: { x: xOffset, y: yOffset },
          parentId: id,
          data: newNodeData,
        });

        newEdges.push({
          id: `e-v-p-${id}-${videoId}`,
          source: id,
          sourceHandle: "prompt",
          target: videoId,
          targetHandle: "left",
          hidden: true,
          ...defaultEdgeOptions,
        });
      });

      if (!targetConvId || targetConvId === targetConvIdRef.current) {
        setNodes((nds) => [...nds, ...newNodes]);
        setEdges((eds) => [...eds, ...newEdges]);
      }

      if (targetConvId && onAppendNodesToGlobalStateRef.current) {
        onAppendNodesToGlobalStateRef.current(targetConvId, newNodes, newEdges);
      }

      if (targetConvId && onUpdateNodeInGlobalStateRef.current) {
        onUpdateNodeInGlobalStateRef.current(targetConvId, id, {
          isGeneratingPrompt: false,
          thinking: thinkingText,
        });
      }
    } catch (e: any) {
      if (e.name === 'AbortError' || e.message?.includes('aborted')) {
        if (targetConvId && onUpdateNodeInGlobalStateRef.current) {
          onUpdateNodeInGlobalStateRef.current(targetConvId, id, { isGeneratingPrompt: false, thinking: thinkingText });
        }
        if (!targetConvId || targetConvId === targetConvIdRef.current) {
          setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, isGeneratingPrompt: false, thinking: thinkingText } } : n));
        }
        return;
      }
      console.error("Prompt error", e);
      if (targetConvId && onUpdateNodeInGlobalStateRef.current) {
        onUpdateNodeInGlobalStateRef.current(targetConvId, id, {
          isGeneratingPrompt: false,
          error: e.message || "生成失败",
        });
      }
      if (!targetConvId || targetConvId === targetConvIdRef.current) {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === id
              ? { ...n, data: { ...n.data, isGeneratingPrompt: false, error: e.message || "生成失败" } }
              : n,
          ),
        );
      }
    } finally {
      if (nodeAbortControllersRef.current[id]) {
        delete nodeAbortControllersRef.current[id];
      }
      if (!targetConvId || targetConvId === targetConvIdRef.current) {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === id
              ? { ...n, data: { ...n.data, isGeneratingPrompt: false, thinking: thinkingText } }
              : n,
          ),
        );
      }
    }
  };

  const handleImageGenerate = useCallback(
    async (nodeId: string, textNodeId?: string) => {
      let hasInitiated = false;
      setNodes((currentNodes) => {
        const imageNode = currentNodes.find((n) => n.id === nodeId);
        const textNode = textNodeId
          ? currentNodes.find((n) => n.id === textNodeId)
          : imageNode;
        if (!textNode || !imageNode || imageNode.data.isGenerating)
          return currentNodes;

        if (!hasInitiated) {
          hasInitiated = true;

          const userContent = textNode.data.content as string;
          const styleInfo = textNode.data.selectedStyle as
            | { name: string; content: string }
            | undefined;
          const funcInfo = textNode.data.selectedFunction as
            | { name: string; content: string }
            | undefined;

          let finalPrompt = userContent;
          if (styleInfo) finalPrompt += `\n\n${styleInfo.content}`;
          if (funcInfo) finalPrompt += `\n\n${funcInfo.content}`;

          setTimeout(
            () =>
              performImageGenerate(
                nodeId,
                finalPrompt,
                imageNode.data.ratio as string,
                imageNode.data.resolution as string,
                (imageNode.data.quality as string) || "standard",
                (imageNode.data.attachedImages as string[]) || [],
                imageNode.data.modelId as string,
                (imageNode.data.imageCount as number) || 1,
              ),
            0,
          );
        }

        return currentNodes.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, isGenerating: true, error: null } }
            : n,
        );
      });
    },
    [],
  );

  const handleVideoGenerate = useCallback(
    async (nodeId: string, textNodeId?: string) => {
      let hasInitiated = false;
      setNodes((currentNodes) => {
        const videoNode = currentNodes.find((n) => n.id === nodeId);
        const textNode = textNodeId
          ? currentNodes.find((n) => n.id === textNodeId)
          : videoNode;
        if (!textNode || !videoNode || videoNode.data.isGenerating)
          return currentNodes;

        if (!hasInitiated) {
          const modelId =
            (videoNode.data.modelId as string) || "grok-video-3";

          let validRatios = ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"];
          let validResolutions = ["720p", "1080p", "2k", "4k"];
          let validDurations = [
            "4s",
            "5s",
            "6s",
            "7s",
            "8s",
            "9s",
            "10s",
            "11s",
            "12s",
            "13s",
            "14s",
            "15s",
          ];
          let validAudioOptions = ["关闭", "开启"];

          if (modelId === "grok-video-3") {
            validRatios = ["16:9", "9:16", "1:1", "2:3", "3:2"];
            validResolutions = ["720p"];
            validDurations = ["6s", "10s", "15s"];
          }

          const rawRatio = videoNode.data.ratio as string;
          const ratio =
            rawRatio && validRatios.includes(rawRatio)
              ? rawRatio
              : validRatios[0];

          const rawResolution = videoNode.data.resolution as string;
          const resolution =
            rawResolution && validResolutions.includes(rawResolution)
              ? rawResolution
              : validResolutions[0];

          const rawDuration = videoNode.data.duration as string;
          const duration =
            rawDuration && validDurations.includes(rawDuration)
              ? rawDuration
              : validDurations[0];

          const rawAudio = videoNode.data.audioEnabled as string;
          const audioEnabled =
            rawAudio && validAudioOptions.includes(rawAudio)
              ? rawAudio
              : validAudioOptions[0];

          hasInitiated = true;
          setTimeout(
            () =>
              performVideoGenerate(
                conversation?.id,
                nodeId,
                textNode.data.content as string,
                (videoNode.data.attachedImages as string[]) || [],
                modelId,
                ratio,
                resolution,
                duration,
                audioEnabled,
              ),
            0,
          );
        }

        return currentNodes.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, isGenerating: true, error: null } }
            : n,
        );
      });
    },
    [],
  );

  const performVideoGenerate = async (
    targetConvId: string | undefined,
    nodeId: string,
    textContent: string,
    attachedImages: string[],
    modelId: string,
    ratio: string,
    resolution: string,
    duration: string,
    audioEnabled: string,
  ) => {
    try {
      const abortController = new AbortController();
      nodeAbortControllersRef.current[nodeId] = abortController;
      const { videoUrl } = await callYunwuVideoAPI(
        textContent,
        attachedImages,
        modelId,
        ratio,
        resolution,
        duration,
        audioEnabled,
        apiKeyRef.current,
        abortController.signal,
      );

      handleNodeChange(nodeId, {
        isGenerating: false,
        videoSrc: videoUrl,
      });

      if (targetConvId && onUpdateNodeInGlobalStateRef.current) {
        onUpdateNodeInGlobalStateRef.current(targetConvId, nodeId, {
          isGenerating: false,
          videoSrc: videoUrl,
        });
      }

      if (onUpdateHistoryRef.current) {
        onUpdateHistoryRef.current(
          targetConvId || targetConvIdRef.current || "",
          {
            id: uuidv4(),
            type: "video",
            url: videoUrl,
            timestamp: Date.now(),
          },
        );
      }
    } catch (e: any) {
      if (e.name === 'AbortError' || e.message?.includes('aborted')) {
        handleNodeChange(nodeId, { isGenerating: false });
        if (targetConvId && onUpdateNodeInGlobalStateRef.current) {
          onUpdateNodeInGlobalStateRef.current(targetConvId, nodeId, { isGenerating: false });
        }
        return;
      }
      console.error("Video generation error:", e);
      handleNodeChange(nodeId, {
        isGenerating: false,
        error: e.message,
      });
      if (targetConvId && onUpdateNodeInGlobalStateRef.current) {
        onUpdateNodeInGlobalStateRef.current(targetConvId, nodeId, {
          isGenerating: false,
          error: e.message,
        });
      }
    } finally {
      if (nodeAbortControllersRef.current[nodeId]) {
        delete nodeAbortControllersRef.current[nodeId];
      }
    }
  };

  const createNodeData = useCallback(
    (type: string, initialData: any = {}) => {
      const defaultTitle =
        type === "mainScript"
          ? "超级提示词"
          : type === "assetNode"
            ? "资产"
            : type === "textExtractionNode"
              ? "文本提取"
              : type === "textNode"
                ? "文本"
                : type === "videoNode"
                  ? "视频"
                  : "图片";

      const currentLocalAssets = (initialData.localAssets || []) as any[];

      // We want to keep all local assets, but if a temp asset has become a global one,
      // we might want to update its reference. However, the user wants independence.
      // So we'll keep localAssets as they are, but ensures we don't lose them.
      // For fix: ensure 'local-' assets are also preserved.
      const localAndTempAssets = currentLocalAssets.filter(
        (a) => a.id.startsWith("temp-") || a.id.startsWith("local-"),
      );

      let newSelectedIds = [...(initialData.selectedAssetIds || [])];
      const remainingLocalAssets: any[] = [...localAndTempAssets];

      // We still update temp assets to global if they match, but we keep the local copy if we want to be safe.
      // Actually, if we want to fix the "disappearing" bug, we should probably
      // ensure that if it's in localAssets, it stays there and we use its local ID.
      // The previous logic was forcing global IDs over local ones.

      const {
        allAssets: _,
        localAssets: __,
        selectedAssetIds: ___,
        ...restInitialData
      } = initialData;

      return {
        title: defaultTitle,
        content: "",
        script: "",
        onChange: handleNodeChange,
        onSelectConnected: handleSelectConnected,
        onExtract: handleExtract,
        onExtractText: handleExtractText,
        onGeneratePrompt: handleGeneratePrompt,
        onStop: handleNodeStop,
        onGenerate:
          type === "videoNode" ? handleVideoGenerate : handleImageGenerate,
        onUpload: handleUploadImage,
        onSaveAsset: onSaveAsset,
        onSwitchToAsset: handleSwitchToAsset,
        ratio: type === "imageNode" ? lastImageParamsRef.current.ratio : "16:9",
        resolution:
          type === "imageNode"
            ? lastImageParamsRef.current.resolution
            : "1080p",
        quality:
          type === "imageNode" ? lastImageParamsRef.current.quality : "auto",
        imageCount:
          type === "imageNode" ? lastImageParamsRef.current.imageCount : 1,
        attachedImages: [],
        modelId:
          type === "videoNode"
            ? "grok-video-3"
            : type === "imageNode"
              ? lastImageParamsRef.current.modelId
              : "gpt-image-2-all",
        ...restInitialData,
        selectedAssetIds: Array.from(new Set(newSelectedIds)),
        localAssets: remainingLocalAssets,
      };
    },
    [
      assets,
      handleNodeChange,
      handleSelectConnected,
      handleExtract,
      handleExtractText,
      handleGeneratePrompt,
      handleImageGenerate,
      handleUploadImage,
      onSaveAsset,
      handleSwitchToAsset,
    ],
  );

  useEffect(() => {
    createNodeDataRef.current = createNodeData;
  }, [createNodeData]);

  const onNodeDragStart = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (event.ctrlKey || event.metaKey) {
        // Duplication logic
        const selectedNodes = nodes.filter((n) => n.selected);
        // If the node being dragged is not in the selection, just duplicate that node
        const nodesToDuplicate = selectedNodes.some((sn) => sn.id === node.id)
          ? selectedNodes
          : [node];

        const idMap: Record<string, string> = {};
        const newNodes = nodesToDuplicate.map((n) => {
          const newId = `${n.type}-${uuidv4()}`;
          idMap[n.id] = newId;

          const cleanData = Object.fromEntries(
            Object.entries(n.data as Record<string, any>).filter(
              ([_, v]) => typeof v !== "function",
            ),
          );

          return {
            ...n,
            id: newId,
            // Position stays same as original (original will move with drag)
            selected: false,
            data: createNodeData(n.type, cleanData),
          };
        });

        const internalEdges = edges.filter(
          (e) =>
            nodesToDuplicate.some((n) => n.id === e.source) &&
            nodesToDuplicate.some((n) => n.id === e.target),
        );

        const newEdges = internalEdges.map((e) => ({
          ...e,
          id: `edge-${uuidv4()}`,
          source: idMap[e.source],
          target: idMap[e.target],
          selected: false,
          data: { ...e.data, onDelete: handleDeleteEdge },
        }));

        setNodes((nds) => [...nds, ...newNodes]);
        setEdges((eds) => [...eds, ...newEdges]);
      }
    },
    [nodes, edges, createNodeData, handleDeleteEdge],
  );

  const [clipboard, setClipboard] = useState<{
    nodes: Node[];
    edges: Edge[];
  } | null>(null);

  const copyNodes = useCallback(() => {
    const selectedNodes = nodes.filter((n) => n.selected);
    const selectedEdges = edges.filter((e) => e.selected);
    if (selectedNodes.length === 0 && selectedEdges.length === 0) return;

    // If only nodes are selected, we still try to find edges between them
    let finalEdgesToCopy = [...selectedEdges];
    if (selectedNodes.length > 0) {
      const edgesBetweenSelected = edges.filter(
        (e) =>
          selectedNodes.some((n) => n.id === e.source) &&
          selectedNodes.some((n) => n.id === e.target),
      );
      // Merge unique
      edgesBetweenSelected.forEach((e) => {
        if (!finalEdgesToCopy.some((fe) => fe.id === e.id)) {
          finalEdgesToCopy.push(e);
        }
      });
    }

    setClipboard({
      nodes: JSON.parse(JSON.stringify(selectedNodes)),
      edges: JSON.parse(JSON.stringify(finalEdgesToCopy)),
    });

    try {
      navigator.clipboard.writeText(
        JSON.stringify({ isGoogleAIStudioCanvasMagic: true }),
      );
    } catch (err) {
      // ignore
    }
  }, [nodes, edges]);

  const cutNodes = useCallback(() => {
    const selectedNodes = nodes.filter((n) => n.selected);
    const selectedEdges = edges.filter((e) => e.selected);
    if (selectedNodes.length === 0 && selectedEdges.length === 0) return;

    takeSnapshot();

    // Copy logic same as copyNodes
    copyNodes();

    // Delete selected
    setNodes((nds) => nds.filter((n) => !n.selected));
    setEdges((eds) => {
      const remainingEdges = eds.filter((e) => !e.selected);
      // Also remove edges connected to deleted nodes
      const nodeIdsToDelete = selectedNodes.map((n) => n.id);
      return remainingEdges.filter(
        (e) =>
          !nodeIdsToDelete.includes(e.source) &&
          !nodeIdsToDelete.includes(e.target),
      );
    });
  }, [nodes, edges, takeSnapshot, copyNodes, setNodes, setEdges]);

  const pasteNodes = useCallback(() => {
    if (!clipboard) return;

    const idMap: Record<string, string> = {};
    const newNodes = clipboard.nodes.map((n) => {
      const newId = `${n.type}-${uuidv4()}`;
      idMap[n.id] = newId;

      // Clean up the data from functions before passing to createNodeData
      const cleanData = Object.fromEntries(
        Object.entries(n.data as Record<string, any>).filter(
          ([_, v]) => typeof v !== "function",
        ),
      );

      return {
        ...n,
        id: newId,
        position: { x: n.position.x + 40, y: n.position.y + 40 },
        selected: true,
        data: createNodeData(n.type, cleanData),
      };
    });

    const newEdges = clipboard.edges.map((e) => ({
      ...e,
      id: `edge-${uuidv4()}`,
      source: idMap[e.source],
      target: idMap[e.target],
      selected: false,
      data: { ...e.data, onDelete: handleDeleteEdge },
    }));

    setNodes((nds) =>
      nds.map((n) => ({ ...n, selected: false })).concat(newNodes),
    );
    setEdges((eds) => eds.concat(newEdges));

    // Update local clipboard for repeated pasting (with further offset)
    setClipboard((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        nodes: prev.nodes.map((n) => ({
          ...n,
          position: { x: n.position.x + 40, y: n.position.y + 40 },
        })),
      };
    });
  }, [clipboard, createNodeData, handleDeleteEdge, setNodes, setEdges]);

  const undo = useCallback(() => {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      const newHistory = prev.slice(0, -1);

      const currentNodes = getNodes();
      const currentEdges = getEdges();

      setFuture((f) =>
        [
          {
            nodes: JSON.parse(JSON.stringify(currentNodes)),
            edges: JSON.parse(JSON.stringify(currentEdges)),
          },
          ...f,
        ].slice(0, 30),
      );

      setNodes(
        last.nodes.map((n) => ({
          ...n,
          data: createNodeData(n.type, n.data),
        })),
      );
      setEdges(
        last.edges.map((e) => ({
          ...e,
          data: { ...e.data, onDelete: handleDeleteEdge },
        })),
      );
      return newHistory;
    });
  }, [
    createNodeData,
    handleDeleteEdge,
    getNodes,
    getEdges,
    setNodes,
    setEdges,
  ]);

  const redo = useCallback(() => {
    setFuture((prev) => {
      if (prev.length === 0) return prev;
      const next = prev[0];
      const newFuture = prev.slice(1);

      const currentNodes = getNodes();
      const currentEdges = getEdges();

      setHistory((h) =>
        [
          ...h,
          {
            nodes: JSON.parse(JSON.stringify(currentNodes)),
            edges: JSON.parse(JSON.stringify(currentEdges)),
          },
        ].slice(-30),
      );

      setNodes(
        next.nodes.map((n) => ({
          ...n,
          data: createNodeData(n.type, n.data),
        })),
      );
      setEdges(
        next.edges.map((e) => ({
          ...e,
          data: { ...e.data, onDelete: handleDeleteEdge },
        })),
      );
      return newFuture;
    });
  }, [
    createNodeData,
    handleDeleteEdge,
    getNodes,
    getEdges,
    setNodes,
    setEdges,
  ]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        copyNodes();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "x") {
        cutNodes();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [copyNodes, cutNodes, undo, redo]);

  // Handle native paste for both text and internal nodes
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      const items = e.clipboardData?.items;
      const dropAssets: { url: string; type: string; name: string }[] = [];
      const pos = rfInstance
        ? rfInstance.screenToFlowPosition({
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
          })
        : { x: 100, y: 100 };

      if (items && items.length > 0) {
        const detectMediaType = (fileName: string, mimeType?: string) => {
          const name = fileName.toLowerCase();
          if (
            mimeType?.startsWith("image/") ||
            /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(name)
          )
            return "image";
          if (
            mimeType?.startsWith("audio/") ||
            /\.(mp3|wav|ogg|aac|m4a|flac)$/i.test(name)
          )
            return "audio";
          if (
            mimeType?.startsWith("video/") ||
            /\.(mp4|webm|mov|avi|wmv|flv)$/i.test(name)
          )
            return "video";
          return "unknown";
        };

        const filePromises = Array.from(items).map((item) => {
          return new Promise<{
            url: string;
            type: string;
            name: string;
          } | null>((resolve) => {
            if (item.kind === "file") {
              const file = item.getAsFile();
              if (file) {
                const detectedType = detectMediaType(file.name, file.type);
                if (detectedType !== "unknown") {
                  const reader = new FileReader();
                  reader.onload = (e) =>
                    resolve({
                      url: e.target?.result as string,
                      type: detectedType,
                      name: file.name,
                    });
                  reader.onerror = () => resolve(null);
                  reader.readAsDataURL(file);
                  return;
                }
              }
            }
            resolve(null);
          });
        });

        const results = await Promise.all(filePromises);
        results.forEach((res) => {
          if (res) dropAssets.push(res);
        });
      }

      const text = e.clipboardData?.getData("text/plain");

      // Check if it's our copied nodes
      if (text && text.includes("isGoogleAIStudioCanvasMagic")) {
        pasteNodes();
        return;
      }

      if (dropAssets.length > 0) {
        takeSnapshot();
        const newTempAssets: any[] = [];
        const newTempSelectedIds: string[] = [];
        dropAssets.forEach((asset) => {
          const tempId = `temp-${uuidv4()}`;
          newTempAssets.push({
            id: tempId,
            url: asset.url,
            type: asset.type,
            name: asset.name || "拖入素材",
          });
          newTempSelectedIds.push(tempId);
        });

        const newNode: Node = {
          id: `asset-${uuidv4()}`,
          type: "assetNode",
          position: pos,
          data: createNodeData("assetNode", {
            selectedAssetIds: newTempSelectedIds,
            localAssets: newTempAssets,
          }),
        };
        setNodes((nds) => nds.concat(newNode));
        return; // Don't process as text if it has media
      }

      // If there's normal text in the clipboard, create a text node
      if (text && text.trim().length > 0) {
        const newNodeId = `mainScript-${uuidv4()}`;
        takeSnapshot();
        const cleanText = text.trim();
        setNodes((nds) =>
          nds.concat({
            id: newNodeId,
            type: "mainScript",
            position: pos,
            data: createNodeData("mainScript", { script: cleanText }),
          }),
        );
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [rfInstance, takeSnapshot, createNodeData, setNodes, pasteNodes]);

  const addNode = useCallback(
    (type: string, position?: { x: number; y: number }) => {
      const pos = position || (menu ? menu.flowPos : null);
      if (!pos) return;

      takeSnapshot();

      const newNodeId = `${type}-${uuidv4()}`;
      const newNode: Node = {
        id: newNodeId,
        type,
        position: pos,
        data: createNodeData(type),
      };

      // Use functional update to ensure connection logic sees the new node
      setNodes((nds) => {
        const nextNodes = nds.concat(newNode);

        if (menu && menu.sourceParams) {
          const { nodeId, handleId, handleType } = menu.sourceParams;
          const isNewTarget = handleType === "source";
          const targetHandleId = isNewTarget
            ? [
                "imageNode",
                "videoNode",
                "textNode",
                "assetNode",
                "textExtractionNode",
              ].includes(type)
              ? "left"
              : "top"
            : handleId || undefined;

          // We defer connection to a microtask if we want to be 100% sure the node is rendered
          // in React Flow context, but since we are within setNodes, it's safer to just call it.
          // Note: onConnect calls setEdges and setNodes again.
          setTimeout(() => {
            onConnect({
              source: isNewTarget ? nodeId : newNodeId,
              sourceHandle: isNewTarget ? handleId || undefined : undefined,
              target: isNewTarget ? newNodeId : nodeId,
              targetHandle: targetHandleId,
            } as any);

            // Force clear connection line
            document.dispatchEvent(
              new MouseEvent("mouseup", { bubbles: true }),
            );
          }, 0);
        }

        return nextNodes;
      });

      closeMenu();
    },
    [menu, rfInstance, createNodeData, onConnect, closeMenu],
  );

  const performImageGenerate = async (
    nodeId: string,
    textContent: string,
    ratio: string,
    resolution: string,
    quality: string,
    attachedImages: string[],
    modelId: string,
    count: number,
  ) => {
    const targetConvId = targetConvIdRef.current;
    try {
      const parentAbortController = new AbortController();
      nodeAbortControllersRef.current[nodeId] = parentAbortController;
      
      const isYunwuImage = modelId === "gpt-image-2-all";
      const prompt = isYunwuImage
        ? `【要求：比例 ${ratio}，分辨率 ${resolution}，质量 ${quality}，数量 ${count}】 ${textContent}`
        : `【要求：比例 ${ratio}，分辨率 ${resolution}，质量 ${quality}，数量 1】 ${textContent}`;

      const messages = [
        { role: "user" as const, content: prompt, images: attachedImages },
      ];

      const results = [];
      const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

      const activeApiKey = getApiKeyForModel(modelId);

      const callWithRetry = async (
        currentPrompt: string,
        attempts: number = 2,
        signal?: AbortSignal
      ) => {
        const msgs = [
          {
            role: "user" as const,
            content: currentPrompt,
            images: attachedImages,
          },
        ];
        for (let i = 0; i < attempts; i++) {
          try {
            return await callGeminiAPI(
              msgs,
              "yellowImage",
              modelId,
              activeApiKey,
              undefined,
              signal
            );
          } catch (e: any) {
            const errorMsg = e.message?.toLowerCase() || "";
            const isSafetyError =
              errorMsg.includes("safety") || errorMsg.includes("moderation");
            const isRateLimit =
              errorMsg.includes("429") || errorMsg.includes("saturated");

            if (i < attempts - 1 && isRateLimit && !isSafetyError) {
              const waitTime = (i + 1) * 2500 + Math.random() * 1000;
              await delay(waitTime);
              continue;
            }
            throw e;
          }
        }
      };

      const isGeminiModel =
        modelId.startsWith("gemini") || modelId.includes("image-preview");

      if (isYunwuImage) {
        // gpt-image-2 optimization: Use parallel single-image requests for faster results
        const promises = Array.from({ length: count }).map(async (_, i) => {
          try {
            // Use a progressive stagger delay to prevent overwhelming the API while maintaining speed
            if (i > 0) await delay(i * 200);
            const singlePrompt = `【要求：比例 ${ratio}，分辨率 ${resolution}，质量 ${quality}，数量 1】 ${textContent}`;
            return await callWithRetry(singlePrompt, 3, parentAbortController.signal); // Slightly high retry count for better stability
          } catch (e: any) {
            throw e;
          }
        });

        const resArray = await Promise.all(promises);
        resArray.forEach((r) => {
          if (r && (r.text || r.thinking)) results.push(r);
        });
      } else if (isGeminiModel) {
        // For Gemini models, execute in parallel with a small stagger to optimize speed
        // while also using streaming for better perceived performance
        const promises = Array.from({ length: count }).map(async (_, i) => {
          try {
            if (i > 0) await delay(i * 300); // Small stagger to avoid burst rate limits
            const singlePrompt = `【要求：比例 ${ratio}，分辨率 ${resolution}，质量 ${quality}，数量 1】 ${textContent}`;
            const msgs = [
              {
                role: "user" as const,
                content: singlePrompt,
                images: attachedImages,
              },
            ];

            let lastThinking = "";
            let lastText = "";
            let res;

            try {
              // Use streaming for better perceived performance
              res = await callGeminiStreamAPI(
                msgs,
                "yellowImage",
                modelId,
                activeApiKey,
                undefined,
                (chunk) => {
                  lastText = chunk;
                  // We could update node text here if needed, but results usually come at once for images
                },
                (thinking) => {
                  lastThinking = thinking;
                  // Only update node thinking for the first request to avoid flickering
                  if (i === 0) {
                    setNodes((nds) =>
                      nds.map((n) =>
                        n.id === nodeId
                          ? { ...n, data: { ...n.data, thinking: lastThinking } }
                          : n,
                      ),
                    );
                    if (targetConvId && onUpdateNodeInGlobalStateRef.current) {
                      onUpdateNodeInGlobalStateRef.current(targetConvId, nodeId, {
                        thinking: lastThinking,
                      });
                    }
                  }
                },
                parentAbortController.signal,
              );
            } catch (streamErr: any) {
              if (streamErr.name === 'AbortError' || streamErr.name === 'DOMException' || streamErr.message?.includes('aborted')) throw streamErr;
              console.warn("Streaming API failed for image, falling back to basic API", streamErr);
              res = await callGeminiAPI(
                msgs,
                "yellowImage",
                modelId,
                activeApiKey,
                undefined,
                parentAbortController.signal
              );
            }
            return res;
          } catch (e: any) {
            // console.error(`Error generating image ${i + 1}:`, e);
            throw e;
          }
        });

        const resArray = await Promise.all(promises);
        resArray.forEach((r) => {
          if (r) results.push(r);
        });
      } else {
        // For other models (Midjourney, Niji), execute in parallel with a moderate stagger for speed
        // Midjourney handles parallel requests well, but we stagger to respect various API limits
        const promises = Array.from({ length: count }).map(async (_, i) => {
          try {
            if (i > 0) await delay(i * 500); // 500ms stagger is a sweet spot for speed and stability
            const singlePrompt = `【要求：比例 ${ratio}，分辨率 ${resolution}，质量 ${quality}，数量 1】 ${textContent}`;
            return await callWithRetry(singlePrompt, 2, parentAbortController.signal);
          } catch (e: any) {
            // console.error(`Error generating image ${i + 1}:`, e);
            throw e;
          }
        });

        const resArray = await Promise.all(promises);
        resArray.forEach((r) => {
          if (r && (r.text || r.thinking)) results.push(r);
        });
      }

      const allSrcs = results.flatMap((result) => {
        const srcs: string[] = [];
        const regex = /!\[.*?\]\((.*?)\)/g;
        let match;
        while ((match = regex.exec(result.text)) !== null) {
          srcs.push(match[1]);
        }
        if (srcs.length === 0) {
          const trimmed = result.text.trim();
          if (trimmed.startsWith("data:image/") || trimmed.startsWith("http")) {
            srcs.push(trimmed);
          }
        }
        return srcs;
      });

      if (allSrcs.length > 0) {
        // Prepare global updates callback
        const updateStateFn = (prevData: any) => {
          const currentSrcs = (prevData.imageSrcs as string[]) || [];
          const newSrcs = [...allSrcs, ...currentSrcs];
          return {
            isGenerating: false,
            imageSrcs: newSrcs,
            imageSrc: newSrcs[0],
          };
        };

        // Update local React Flow state
        setNodes((nds) =>
          nds.map((node) => {
            if (node.id === nodeId) {
              return {
                ...node,
                data: {
                  ...node.data,
                  ...updateStateFn(node.data),
                },
              };
            }
            return node;
          }),
        );

        // Update global App.tsx state (handles case where user switched tabs)
        if (targetConvId && onUpdateNodeInGlobalStateRef.current) {
          onUpdateNodeInGlobalStateRef.current(
            targetConvId,
            nodeId,
            updateStateFn,
          );
        }

        // Save to history
        allSrcs.forEach((src) => {
          if (onUpdateHistoryRef.current) {
            onUpdateHistoryRef.current(
              targetConvId || targetConvIdRef.current || "",
              {
                id: uuidv4(),
                type: "image",
                url: src,
                timestamp: Date.now(),
              },
            );
          }
        });
      } else {
        const errorMessage = "未能从模型响应中提取到图片。";
        handleNodeChange(nodeId, { isGenerating: false, error: errorMessage });
        if (targetConvId && onUpdateNodeInGlobalStateRef.current) {
          onUpdateNodeInGlobalStateRef.current(targetConvId, nodeId, {
            isGenerating: false,
            error: errorMessage,
          });
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError' || error.name === 'DOMException' || error.message?.includes('aborted')) {
        handleNodeChange(nodeId, { isGenerating: false, thinking: undefined });
        if (targetConvId && onUpdateNodeInGlobalStateRef.current) {
          onUpdateNodeInGlobalStateRef.current(targetConvId, nodeId, { isGenerating: false, thinking: undefined });
        }
        return;
      }
      // console.error("Failed to generate image:", error);
      const errorMessage = error.message || String(error);
      handleNodeChange(nodeId, { isGenerating: false, error: errorMessage });
      if (targetConvId && onUpdateNodeInGlobalStateRef.current) {
        onUpdateNodeInGlobalStateRef.current(targetConvId, nodeId, {
          isGenerating: false,
          error: errorMessage,
        });
      }
    } finally {
      if (nodeAbortControllersRef.current[nodeId]) {
        delete nodeAbortControllersRef.current[nodeId];
      }
      if (!targetConvId || targetConvId === targetConvIdRef.current) {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId
              ? { ...n, data: { ...n.data, isGenerating: false, thinking: undefined } }
              : n,
          ),
        );
      }
    }
  };

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const onDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();

      if (!rfInstance || !reactFlowWrapper.current) return;

      const position = rfInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      takeSnapshot();

      const handleCreateAssetNode = (
        assetsList: { url: string; type: string; name: string }[],
      ) => {
        if (assetsList.length === 0) return;

        const newTempAssets: any[] = [];
        const newTempSelectedIds: string[] = [];

        assetsList.forEach((asset) => {
          const tempId = `temp-${uuidv4()}`;
          newTempAssets.push({
            id: tempId,
            url: asset.url,
            type: asset.type,
            name: asset.name || "拖入素材",
          });
          newTempSelectedIds.push(tempId);
        });

        const newNode: Node = {
          id: `asset-${uuidv4()}`,
          type: "assetNode",
          position,
          data: createNodeData("assetNode", {
            selectedAssetIds: newTempSelectedIds,
            localAssets: newTempAssets,
          }),
        };
        setNodes((nds) => nds.concat(newNode));
      };

      // Helper to detect type from file or URL
      const detectMediaType = (fileName: string, mimeType?: string) => {
        const name = fileName.toLowerCase();
        if (
          mimeType?.startsWith("image/") ||
          name.startsWith("data:image/") ||
          /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(name)
        )
          return "image";
        if (
          mimeType?.startsWith("audio/") ||
          name.startsWith("data:audio/") ||
          /\.(mp3|wav|ogg|aac|m4a|flac)$/i.test(name)
        )
          return "audio";
        if (
          mimeType?.startsWith("video/") ||
          name.startsWith("data:video/") ||
          /\.(mp4|webm|mov|avi|wmv|flv)$/i.test(name)
        )
          return "video";
        return "unknown";
      };

      const dropAssets: { url: string; type: string; name: string }[] = [];

      // 1. Handle Files and Items
      const dataTransferItems = event.dataTransfer.items;
      const dataTransferFiles = event.dataTransfer.files;

      if (dataTransferFiles.length > 0) {
        let offsetX = 0;
        let offsetY = 0;
        const filePromises = Array.from(dataTransferFiles).map((file) => {
          return new Promise<{
            url: string;
            type: string;
            name: string;
          } | null>((resolve) => {
            const detectedType = detectMediaType(file.name, file.type);
            const lowerName = file.name.toLowerCase();

            // Handle text and docx files
            if (lowerName.endsWith(".txt") || file.type === "text/plain") {
              const reader = new FileReader();
              reader.onload = (e) => {
                const textContent = e.target?.result as string;
                if (textContent) {
                  const newNode: Node = {
                    id: `mainScript-${uuidv4()}`,
                    type: "mainScript",
                    position: {
                      x: position.x + offsetX,
                      y: position.y + offsetY,
                    },
                    data: createNodeData("mainScript", { script: textContent }),
                  };
                  offsetX += 20;
                  offsetY += 20;
                  setNodes((nds) => nds.concat(newNode));
                }
                resolve(null);
              };
              reader.onerror = () => resolve(null);
              reader.readAsText(file);
              return;
            }

            if (
              lowerName.endsWith(".docx") ||
              file.type ===
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            ) {
              const reader = new FileReader();
              reader.onload = async (e) => {
                const arrayBuffer = e.target?.result as ArrayBuffer;
                if (arrayBuffer) {
                  try {
                    const result = await mammoth.extractRawText({
                      arrayBuffer,
                    });
                    if (result && result.value) {
                      const newNode: Node = {
                        id: `mainScript-${uuidv4()}`,
                        type: "mainScript",
                        position: {
                          x: position.x + offsetX,
                          y: position.y + offsetY,
                        },
                        data: createNodeData("mainScript", {
                          script: result.value,
                        }),
                      };
                      offsetX += 20;
                      offsetY += 20;
                      setNodes((nds) => nds.concat(newNode));
                    }
                  } catch (err) {
                    console.error("Error reading docx", err);
                  }
                }
                resolve(null);
              };
              reader.onerror = () => resolve(null);
              reader.readAsArrayBuffer(file);
              return;
            }

            if (detectedType === "unknown") {
              resolve(null);
              return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
              resolve({
                url: e.target?.result as string,
                type: detectedType,
                name: file.name,
              });
            };
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
          });
        });

        const results = await Promise.all(filePromises);
        results.forEach((res) => {
          if (res) dropAssets.push(res);
        });
      } else if (dataTransferItems && dataTransferItems.length > 0) {
        for (let i = 0; i < dataTransferItems.length; i++) {
          const item = dataTransferItems[i];
          if (item.kind === "file") {
            const file = item.getAsFile();
            if (file) {
              const detectedType = detectMediaType(file.name, file.type);
              if (detectedType !== "unknown") {
                const reader = new FileReader();
                const res = await new Promise<{
                  url: string;
                  type: string;
                  name: string;
                } | null>((resolve) => {
                  reader.onload = (e) =>
                    resolve({
                      url: e.target?.result as string,
                      type: detectedType,
                      name: file.name,
                    });
                  reader.onerror = () => resolve(null);
                  reader.readAsDataURL(file);
                });
                if (res) dropAssets.push(res);
              }
            }
          }
        }
      }

      if (dropAssets.length > 0) {
        handleCreateAssetNode(dropAssets);
        return;
      }

      // 2. Handle Text/URLs/HTML/Internal Drags
      const dragSource = event.dataTransfer.getData("application/x-source");
      const customType = event.dataTransfer.getData(
        "application/x-custom-type",
      );
      const jsonData = event.dataTransfer.getData("application/json");
      const assetNameData = event.dataTransfer.getData(
        "application/x-asset-name",
      );
      const text = event.dataTransfer.getData("text/plain");
      const uriList = event.dataTransfer.getData("text/uri-list");
      const dropUrl =
        text?.trim() || (uriList ? uriList.split("\n")[0].trim() : null);

      if (
        dropUrl &&
        (dropUrl.startsWith("http") ||
          dropUrl.startsWith("data:") ||
          dropUrl.startsWith("blob:"))
      ) {
        const detectedType = customType || detectMediaType(dropUrl);
        if (detectedType !== "unknown") {
          let name = assetNameData || "外部素材";

          if (dragSource === "assets-area" || dragSource === "history-area") {
            name = assetNameData || "库素材";
          } else if (dragSource === "asset-node") {
            // Priority 1: Use direct name from metadata
            if (assetNameData) name = assetNameData;

            // Priority 2: Use full JSON object if provided
            try {
              if (jsonData) {
                const fullAsset = JSON.parse(jsonData);
                name = fullAsset.name || name;
              }
            } catch (e) {
              console.warn("Failed to parse dropped asset JSON", e);
            }

            // Fallback
            if (name === "外部素材") name = "转移资产";
          } else if (dragSource === "canvas-node") {
            name = "画布快照";
          }

          handleCreateAssetNode([{ url: dropUrl, type: detectedType, name }]);
          return;
        }
      }

      // 3. Handle HTML
      const html = event.dataTransfer.getData("text/html");
      if (html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const imgs = Array.from(doc.querySelectorAll("img"))
          .map((img) => img.src)
          .filter(
            (src) => src && (src.startsWith("http") || src.startsWith("data:")),
          );

        if (imgs.length > 0) {
          handleCreateAssetNode(
            imgs.map((url) => ({ url, type: "image", name: "网页图片" })),
          );
          return;
        }
      }

      // 4. Handle plain text dropping
      if (
        text &&
        !dropUrl?.startsWith("http") &&
        !dropUrl?.startsWith("data:") &&
        !dropUrl?.startsWith("blob:") &&
        text.trim().length > 0
      ) {
        if (!text.includes("isGoogleAIStudioCanvasMagic")) {
          const newNode: Node = {
            id: `mainScript-${uuidv4()}`,
            type: "mainScript",
            position,
            data: createNodeData("mainScript", { script: text.trim() }),
          };
          setNodes((nds) => nds.concat(newNode));
        }
      }
    },
    [rfInstance, takeSnapshot, createNodeData, assets],
  );

  // Inject callbacks into loaded nodes
  const injectCallbacks = useCallback(
    (loadedNodes: Node[]) => {
      return loadedNodes.map((n) => ({
        ...n,
        data: createNodeData(n.type || "textNode", n.data),
      }));
    },
    [createNodeData],
  );

  // Inject callbacks into loaded edges
  const injectEdgeCallbacks = useCallback(
    (loadedEdges: Edge[]) => {
      return loadedEdges.map((e) => ({
        ...e,
        data: {
          ...e.data,
          onDelete: handleDeleteEdge,
        },
      }));
    },
    [handleDeleteEdge],
  );

  // Initialization
  useEffect(() => {
    if (conversation?.nodes && conversation.nodes.length > 0) {
      setNodes(injectCallbacks(conversation.nodes));
      setEdges(injectEdgeCallbacks(conversation?.edges || []));
      setTimeout(
        () => fitView({ duration: 800, maxZoom: 1, padding: 0.2 }),
        300,
      );
    } else {
      setNodes([
        {
          id: `mainScript-${uuidv4()}`,
          type: "mainScript",
          position: { x: Math.max(window.innerWidth / 2 - 250, 100), y: 50 },
          data: createNodeData("mainScript", {
            title: "默认剧本",
            script: "",
            isExtracting: false,
            isGeneratingPrompt: false,
          }),
        },
      ]);
      setEdges([]);
      setTimeout(
        () => fitView({ duration: 800, maxZoom: 1, padding: 0.2 }),
        300,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation?.id]);

  // Sync finished generations from background (App.tsx global state) back into local React Flow state
  useEffect(() => {
    if (!conversation?.nodes) return;

    setNodes((currentNodes) => {
      let changed = false;
      const nextNodes = currentNodes.map((n) => {
        const globalNode = conversation.nodes.find((gn: any) => gn.id === n.id);
        if (globalNode) {
          const locallyActive =
            n.data.isGenerating ||
            n.data.isExtracting ||
            n.data.isGeneratingPrompt;
          const globallyActive =
            globalNode.data.isGenerating ||
            globalNode.data.isExtracting ||
            globalNode.data.isGeneratingPrompt;

          // If node was actively generating in our graph, but finished globally (due to background task completing)
          // Or if it remounted (locally inactive) but global node has new background errors/thinking that finished
          if (
            (locallyActive && !globallyActive) ||
            (!globallyActive && globalNode.data.error && globalNode.data.error !== n.data.error)
          ) {
            changed = true;
            return {
              ...n,
              data: {
                ...n.data,
                ...globalNode.data, // Brings in imageSrcs, imageSrc, videoSrc, etc. plus isGenerating=false
              },
            };
          }
        }
        return n;
      });

      // Find missing nodes that were added by background tasks
      const missingNodes = conversation.nodes.filter(
        (gn: any) =>
          !currentNodes.find((cn) => cn.id === gn.id) &&
          !locallyDeletedNodeIds.current.has(gn.id)
      );

      if (missingNodes.length > 0) {
        changed = true;
        const injectedNodes = missingNodes.map((n: any) => ({
          ...n,
          data: createNodeDataRef.current
            ? createNodeDataRef.current(n.type || "textNode", n.data)
            : n.data,
        }));
        nextNodes.push(...injectedNodes);
      }

      return changed ? nextNodes : currentNodes;
    });

    setEdges((currentEdges) => {
      if (!conversation?.edges) return currentEdges;
      
      const missingEdges = conversation.edges.filter(
        (ge: any) => !currentEdges.find((ce) => ce.id === ge.id)
      );
      
      if (missingEdges.length > 0) {
        const validMissingEdges = missingEdges.filter(
          (ge: any) =>
            !locallyDeletedNodeIds.current.has(ge.source) &&
            !locallyDeletedNodeIds.current.has(ge.target)
        );
        if (validMissingEdges.length > 0) {
          // We can't use injectEdgeCallbacks because it requires recreating the edge list, 
          // we'll just inject onDelete manually.
          return [
            ...currentEdges,
            ...validMissingEdges.map((e: any) => ({
              ...e,
              data: { ...e.data, onDelete: handleDeleteEdge },
            })),
          ];
        }
      }
      return currentEdges;
    });
  }, [conversation?.nodes, conversation?.edges, setNodes, setEdges, handleDeleteEdge]);

  // Notify parent of changes to save history - debounced to avoid hammering parent state
  const notifyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstRender = useRef(true);

  // Notify parent of changes
  useEffect(() => {
    if (notifyTimeoutRef.current) {
      clearTimeout(notifyTimeoutRef.current);
    }

    notifyTimeoutRef.current = setTimeout(() => {
      // Comparison check to avoid unnecessary notifications
      const serializedNodes = JSON.stringify(
        nodes.map((n) => ({
          id: n.id,
          type: n.type,
          pos: n.position,
          data: Object.fromEntries(
            Object.entries(n.data as any).filter(([k]) => k !== "allAssets"),
          ),
        })),
      );
      const serializedEdges = JSON.stringify(
        edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
      );

      if (
        lastUpdateRef.current.nodes === serializedNodes &&
        lastUpdateRef.current.edges === serializedEdges
      ) {
        return;
      }

      lastUpdateRef.current = {
        nodes: serializedNodes,
        edges: serializedEdges,
      };

      // Stripping functions from data to ensure serializability for IndexedDB/localStorage
      const cleanNodes = nodes.map((n) => {
        const cleanData = Object.fromEntries(
          Object.entries(n.data as Record<string, any>).filter(
            ([_, v]) => typeof v !== "function",
          ),
        );
        return { ...n, data: cleanData };
      });

      const cleanEdges = edges.map((e) => {
        if (!e.data) return e;
        const cleanData = Object.fromEntries(
          Object.entries(e.data as Record<string, any>).filter(
            ([_, v]) => typeof v !== "function",
          ),
        );
        return { ...e, data: cleanData };
      });

      onUpdateCanvasRef.current &&
        onUpdateCanvasRef.current(cleanNodes, cleanEdges, "超级工作流");
    }, 300); // 300ms debounce for canvas updates

    return () => {
      if (notifyTimeoutRef.current) {
        clearTimeout(notifyTimeoutRef.current);
      }
    };
  }, [nodes, edges]);

  return (
    <div
      ref={reactFlowWrapper}
      className="flex-1 w-full h-full relative font-sans bg-[#fcfcfc]"
      onDoubleClick={handleDoubleClickWrapper}
      onContextMenu={onPaneContextMenu}
    >
      <CanvasContext.Provider
        value={useMemo(
          () => ({ assets: assets || [], isSpacePressed }),
          [assets, isSpacePressed],
        )}
      >
        <ReactFlow
          onInit={setRfInstance}
          onPaneClick={onPaneClick}
          onPaneContextMenu={onPaneContextMenu}
          onEdgeDoubleClick={(e, edge) => handleDeleteEdge(edge.id)}
          nodes={nodes}
          edges={edges}
          nodesDraggable={true}
          selectNodesOnDrag={false}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onNodeDragStart={onNodeDragStart as any}
          onNodeDragStop={onNodeDragStop}
          nodeTypes={nodeTypes as any}
          edgeTypes={edgeTypes as any}
          onNodesChange={onNodesChange as any}
          onEdgesChange={onEdgesChange as any}
          onReconnect={onReconnect}
          onConnect={onConnect}
          onConnectStart={onConnectStart}
          onConnectEnd={onConnectEnd}
          defaultEdgeOptions={defaultEdgeOptions}
          connectionLineStyle={{ stroke: "#94a3b8", strokeWidth: 2 }}
          fitView
          fitViewOptions={{ maxZoom: 1, padding: 0.2 }}
          minZoom={0.01}
          maxZoom={4}
          zoomOnDoubleClick={false}
          selectionMode={SelectionMode.Partial}
          selectionKeyCode="Shift"
          multiSelectionKeyCode="Shift"
          onlyRenderVisibleElements={true}
        >
          <Panel
            position="top-left"
            className="m-4 flex items-start gap-2"
            style={{ marginLeft: sidebarOpen ? "70px" : "20px" }}
          >
            <div
              className={`bg-white/80 backdrop-blur-md border border-neutral-200 text-neutral-900 shadow-sm p-1.5 rounded-lg ${sidebarOpen ? "flex md:hidden" : "flex"}`}
            >
              <button
                onClick={() => setSidebarOpen(true)}
                className="md:hidden p-1 border-none bg-transparent text-neutral-900 cursor-pointer flex-shrink-0"
              >
                <Menu className="w-4 h-4" />
              </button>
              {!sidebarOpen && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="hidden md:block p-1 rounded-md hover:bg-neutral-50 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer flex-shrink-0"
                  title="展开边栏"
                >
                  <PanelLeftOpen className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="bg-white/80 backdrop-blur-md border border-neutral-200 shadow-sm px-3 py-1.5 rounded-lg max-w-[200px] sm:max-w-[280px] group flex items-center gap-2">
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <span className="text-sm font-semibold text-neutral-800 truncate">
                  {conversation?.title || "未命名项目"}
                </span>
                {conversation?.description && (
                  <span className="text-[11px] text-neutral-400 truncate max-w-[80px] sm:max-w-[120px] hidden sm:inline-block border-l border-neutral-200 pl-2">
                    {conversation.description}
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  setEditProjectTitle(conversation?.title || "");
                  setEditProjectDesc(conversation?.description || "");
                  setEditProjectModalOpen(true);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded cursor-pointer border-none bg-transparent flex-shrink-0"
                title="编辑项目信息"
              >
                <Pencil size={12} />
              </button>
            </div>
          </Panel>
          <Background
            color="#e5e5e5"
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
          />
          <Controls />
        </ReactFlow>
      </CanvasContext.Provider>

      {/* Ghost Node for Placing */}
      {placingNodeType && <GhostNode nodeType={placingNodeType} />}

      {/* Floating Toolbar on the Left */}
      <div className="absolute left-6 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center bg-white border-neutral-200 text-neutral-600 rounded-2xl shadow-xl shadow-black/20 border border-neutral-200 p-2 gap-1.5 isolate">
        <div
          className="relative"
          onMouseEnter={() => setNodeMenuOpen(true)}
          onMouseLeave={() => setNodeMenuOpen(false)}
        >
          <button
            className="p-3 bg-white text-neutral-900 rounded-xl hover:bg-neutral-200 transition-colors shadow-sm relative group cursor-pointer mb-2"
            title="新建节点"
          >
            <Plus size={22} />
          </button>

          {nodeMenuOpen && (
            <div className="absolute left-full top-0 pl-4 z-50">
              <div className="p-2 bg-white border-neutral-200 rounded-xl shadow-xl border flex gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
                <button
                  onClick={(e) => {
                    setMousePos({ x: e.clientX, y: e.clientY });
                    setPlacingNodeType("mainScript");
                    setNodeMenuOpen(false);
                  }}
                  className="p-3 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg whitespace-nowrap flex flex-col items-center gap-1 cursor-pointer"
                >
                  <FileText size={20} />
                  <span className="text-xs">脚本</span>
                </button>
                <button
                  onClick={(e) => {
                    setMousePos({ x: e.clientX, y: e.clientY });
                    setPlacingNodeType("imageNode");
                    setNodeMenuOpen(false);
                  }}
                  className="p-3 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg whitespace-nowrap flex flex-col items-center gap-1 cursor-pointer"
                >
                  <ImageIcon size={20} />
                  <span className="text-xs">图像</span>
                </button>
                <button
                  onClick={(e) => {
                    setMousePos({ x: e.clientX, y: e.clientY });
                    setPlacingNodeType("videoNode");
                    setNodeMenuOpen(false);
                  }}
                  className="p-3 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg whitespace-nowrap flex flex-col items-center gap-1 cursor-pointer"
                >
                  <Video size={20} />
                  <span className="text-xs">视频</span>
                </button>
                <button
                  onClick={(e) => {
                    setMousePos({ x: e.clientX, y: e.clientY });
                    setPlacingNodeType("textNode");
                    setNodeMenuOpen(false);
                  }}
                  className="p-3 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg whitespace-nowrap flex flex-col items-center gap-1 cursor-pointer"
                >
                  <span className="font-serif text-lg leading-none">T</span>
                  <span className="text-xs">文本</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div
          className="relative"
          onMouseEnter={() => {
            setActiveSidebarPanel("assets");
            setNodeMenuOpen(false);
          }}
          onMouseLeave={() => setActiveSidebarPanel("none")}
        >
          <button
            className={`p-2.5 rounded-xl hover:bg-neutral-100/50 hover:text-neutral-900 transition-colors cursor-pointer relative group flex items-center justify-center ${activeSidebarPanel === "assets" ? "bg-neutral-100/50 text-neutral-900 shadow-lg" : ""}`}
            title="资产"
          >
            <FolderOpen size={20} />
            {activeSidebarPanel !== "assets" && (
              <div className="absolute left-full ml-4 bg-white border-neutral-200 text-white text-xs py-1.5 px-3 rounded-lg whitespace-nowrap shadow-xl border border-neutral-200 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                资产
              </div>
            )}
          </button>

          {activeSidebarPanel === "assets" && (
            <div className="absolute left-full top-1/2 -translate-y-1/2 pl-4 z-50">
              <div className="w-[320px] max-h-[450px] bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-neutral-200 flex flex-col animate-in fade-in zoom-in-95 slide-in-from-left-2 duration-200 origin-left">
                <div className="p-3 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/50 rounded-t-2xl">
                  <h2 className="font-bold text-neutral-900 text-sm flex items-center gap-2">
                    <FolderOpen size={16} className="text-purple-500" />
                    项目资产
                  </h2>
                  <div className="text-[10px] text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full">
                    {assets?.length || 0} 个项目
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
                  {!assets || assets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-neutral-400 gap-2">
                      <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center">
                        <FolderOpen size={18} className="opacity-40" />
                      </div>
                      <span className="text-[11px]">
                        暂无资产，生成后将显示在此
                      </span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {assets?.map((asset: any, i: number) => (
                        <AssetMediaItemCanvas
                          key={i}
                          asset={asset}
                          onDelete={onDeleteAsset}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div
          className="relative"
          onMouseEnter={() => {
            setActiveSidebarPanel("history");
            setNodeMenuOpen(false);
          }}
          onMouseLeave={() => setActiveSidebarPanel("none")}
        >
          <button
            className={`p-2.5 rounded-xl hover:bg-neutral-100/50 hover:text-neutral-900 transition-colors cursor-pointer relative group flex items-center justify-center ${activeSidebarPanel === "history" ? "bg-neutral-100/50 text-neutral-900 shadow-lg" : ""}`}
            title="历史记录"
          >
            <History size={20} />
            {activeSidebarPanel !== "history" && (
              <div className="absolute left-full ml-4 bg-white border-neutral-200 text-white text-xs py-1.5 px-3 rounded-lg whitespace-nowrap shadow-xl border border-neutral-200 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                历史记录
              </div>
            )}
          </button>

          {activeSidebarPanel === "history" && (
            <div className="absolute left-full top-1/2 -translate-y-1/2 pl-4 z-50">
              <div className="w-[360px] max-h-[500px] bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-neutral-200 flex flex-col animate-in fade-in zoom-in-95 slide-in-from-left-2 duration-200 origin-left">
                <div className="p-3 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/50 rounded-t-2xl">
                  <h2 className="font-bold text-neutral-900 text-sm flex items-center gap-2">
                    <History size={16} className="text-blue-500" />
                    历史生成记录
                  </h2>
                  <div className="text-[10px] text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full">
                    {conversation?.history?.length || 0} 条
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
                  {!conversation?.history ||
                  conversation.history.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-neutral-400 gap-2">
                      <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center">
                        <History size={18} className="opacity-40" />
                      </div>
                      <span className="text-[11px]">暂无历史记录</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {conversation.history.map((item: any, i: number) => (
                        <div
                          key={i}
                          className="rounded-xl border border-neutral-200/50 overflow-hidden shadow-sm bg-neutral-50 hover:bg-neutral-100 hover:border-blue-300 hover:shadow-md transition-all group relative cursor-pointer aspect-square"
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", item.url);
                            e.dataTransfer.setData(
                              "application/x-custom-type",
                              item.type,
                            );
                            e.dataTransfer.setData(
                              "application/x-source",
                              "history-area",
                            );
                          }}
                        >
                          {item.type === "image" ? (
                            <img
                              src={item.url}
                              alt="History item"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <HistoryMediaItem item={item} />
                          )}

                          <div className="absolute top-1.5 right-1.5 flex gap-1.5 z-30 opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const a = document.createElement("a");
                                a.href = item.url;
                                a.download = `history-${item.id}.${item.type === "image" ? "png" : item.type === "video" ? "mp4" : "mp3"}`;
                                a.click();
                              }}
                              className="w-7 h-7 bg-blue-600 hover:bg-blue-500 text-white rounded-full flex items-center justify-center border-none cursor-pointer shadow-lg transition-transform hover:scale-110"
                              title="下载"
                            >
                              <Download size={14} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSaveAsset?.(item.url, item.type);
                              }}
                              className="w-7 h-7 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full flex items-center justify-center border-none cursor-pointer shadow-lg transition-transform hover:scale-110"
                              title="存入资产"
                            >
                              <BookmarkPlus size={14} />
                            </button>
                          </div>

                          <div className="absolute inset-x-0 bottom-0 p-1 bg-gradient-to-t from-black/60 to-transparent pointer-events-none">
                            <span className="text-[8px] text-white/80 font-medium">
                              {new Date(item.timestamp).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="w-8 h-px bg-white/10 my-1"></div>

        <button
          onClick={handleShareProject}
          className="p-2.5 rounded-xl hover:bg-neutral-100/50 hover:text-neutral-900 transition-colors cursor-pointer"
          title="分享项目"
        >
          <Share2 size={20} />
        </button>
        <div className="relative">
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`p-2.5 rounded-xl hover:bg-neutral-100/50 hover:text-neutral-900 transition-colors cursor-pointer ${isChatOpen ? "bg-neutral-100/50 text-neutral-900" : ""}`}
            title="AI对话"
          >
            <MessageCircle size={20} />
          </button>

          {isChatOpen && (
            <div className="absolute left-full bottom-0 pl-4 z-50">
              <div className="w-[360px] h-[350px] bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-neutral-200 flex flex-col animate-in fade-in zoom-in-95 duration-200 origin-bottom-left">
                <div className="p-3 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/50 rounded-t-2xl">
                  <h2 className="font-bold text-neutral-900 text-sm flex items-center gap-2">
                    <MessageCircle size={16} className="text-blue-500" />
                    AI 对话助手
                  </h2>
                  <button
                    onClick={() => setIsChatOpen(false)}
                    className="text-neutral-500 hover:text-neutral-900 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 scrollbar-thin">
                  {chatMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-neutral-400 gap-2">
                      <MessageCircle size={32} className="opacity-20" />
                      <span className="text-sm">你可以向AI助手提问</span>
                    </div>
                  ) : (
                    chatMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div className="flex flex-col gap-1 max-w-[85%]">
                          {msg.thinking && (
                            <div className="bg-neutral-50/80 border border-neutral-100 rounded-lg p-2 text-[10px] text-neutral-400 font-mono transition-all">
                              <div className="flex items-center gap-1 mb-1 opacity-50 uppercase tracking-tighter font-bold">
                                <Brain className="w-2.5 h-2.5" />
                                思考中...
                              </div>
                              {msg.thinking}
                            </div>
                          )}
                          <div
                            className={`p-2.5 rounded-xl text-sm relative whitespace-pre-wrap ${msg.role === "user" ? "bg-blue-500 text-white shadow-md" : "bg-white border border-neutral-200 shadow-sm text-neutral-800"}`}
                          >
                            {msg.content}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={chatMessagesEndRef} />
                </div>

                <form
                  onSubmit={handleChatSubmit}
                  className="p-3 border-t border-neutral-200 bg-neutral-50/50 rounded-b-2xl flex gap-2"
                >
                  <FastInput
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="输入内容..."
                    className="flex-1 bg-white border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isChatting}
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim() || isChatting}
                    className="bg-blue-500 text-white rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50 hover:bg-blue-600 transition-colors"
                  >
                    发送
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>

      {menu && (
        <motion.div
          drag
          dragControls={dragControls}
          dragListener={false}
          dragMomentum={false}
          // The initial position is handled by 'absolute', but once dragged, Framer Motion
          // handles the translate values on the GPU, avoiding expensive layout reflows!
          style={{ top: menu.y, left: menu.x, position: "absolute" }}
          className="z-50 bg-white shadow-2xl rounded-xl border border-neutral-200 overflow-hidden min-w-[200px] animate-in fade-in zoom-in duration-150 cursor-default"
        >
          <div
            onPointerDown={(e) => {
              // Critical for silky smooth drag: prevents drag event conflicts and browser scrolling.
              e.stopPropagation();
              dragControls.start(e);
            }}
            style={{ touchAction: "none" }}
            className="px-3 py-2 bg-neutral-50 border-b border-neutral-200 flex items-center gap-2 cursor-grab active:cursor-grabbing select-none"
          >
            <Plus size={14} className="text-neutral-500" />
            <span className="text-[11px] uppercase tracking-wider font-bold text-neutral-400">
              新建节点
            </span>
          </div>
          <div className="p-1 space-y-0.5">
            <button
              onClick={() => addNode("mainScript")}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-red-50 rounded-lg transition-colors border-none bg-transparent cursor-pointer group text-left"
            >
              <div className="w-8 h-8 rounded-md bg-red-100 flex items-center justify-center text-red-600 group-hover:bg-red-200 transition-colors">
                <Layout size={18} />
              </div>
              <div>
                <div className="text-[14px] font-bold text-red-600">
                  超级提示词
                </div>
                <div className="text-[11px] text-red-400">主创作者流入口</div>
              </div>
            </button>

            <div className="h-px bg-neutral-100 my-1 mx-2" />

            <button
              onClick={() => addNode("assetNode")}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-neutral-50 rounded-lg transition-colors border-none bg-transparent cursor-pointer group text-left"
            >
              <div className="w-8 h-8 rounded-md bg-neutral-100 flex items-center justify-center text-neutral-500 group-hover:bg-neutral-200 transition-colors">
                <Search size={18} />
              </div>
              <div>
                <div className="text-[13px] font-medium text-black">资产</div>
                <div className="text-[10px] text-neutral-400">
                  管理角色与物体 assets
                </div>
              </div>
            </button>

            <button
              onClick={() => addNode("imageNode")}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-indigo-50 rounded-lg transition-colors border-none bg-transparent cursor-pointer group text-left"
            >
              <div className="w-8 h-8 rounded-md bg-indigo-100 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-200 transition-colors">
                <ImageIcon size={18} />
              </div>
              <div>
                <div className="text-[13px] font-medium text-black">图片</div>
                <div className="text-[10px] text-indigo-400">
                  生成剧照与背景图
                </div>
              </div>
            </button>

            <button
              onClick={() => addNode("videoNode")}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-blue-50 rounded-lg transition-colors border-none bg-transparent cursor-pointer group text-left"
            >
              <div className="w-8 h-8 rounded-md bg-blue-100 flex items-center justify-center text-blue-600 group-hover:bg-blue-200 transition-colors">
                <Video size={18} />
              </div>
              <div>
                <div className="text-[13px] font-medium text-black">视频</div>
                <div className="text-[10px] text-blue-400">
                  将动效应用到画面
                </div>
              </div>
            </button>

            <button
              onClick={() => addNode("textNode")}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-neutral-50 rounded-lg transition-colors border-none bg-transparent cursor-pointer group text-left"
            >
              <div className="w-8 h-8 rounded-md bg-neutral-100 flex items-center justify-center text-neutral-500 group-hover:bg-neutral-200 transition-colors">
                <FileText size={18} />
              </div>
              <div>
                <div className="text-[13px] font-medium text-black">文本</div>
                <div className="text-[10px] text-neutral-400">
                  记录说明或提示词
                </div>
              </div>
            </button>

            <div className="h-px bg-neutral-100 my-1 mx-2" />

            <button
              onClick={() => addNode("textExtractionNode")}
              className="w-full flex items-center gap-3 px-3 py-1.5 hover:bg-neutral-50 rounded-lg transition-colors border-none bg-transparent cursor-pointer group text-left"
            >
              <div className="w-6 h-6 rounded-md bg-neutral-100 flex items-center justify-center text-neutral-400">
                <MousePointer2 size={14} />
              </div>
              <div className="text-[12px] text-black font-medium">
                高级: 提取工具
              </div>
            </button>
          </div>
        </motion.div>
      )}

      {/* Edit Project Modal */}
      {editProjectModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl shadow-neutral-200/50 border border-neutral-200 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
              <h3 className="font-semibold text-neutral-900">修改项目信息</h3>
              <button
                onClick={() => setEditProjectModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-400 border-none bg-transparent cursor-pointer p-1 rounded-md hover:bg-neutral-100 transition-colors"
                title="关闭"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-700">
                  项目名称
                </label>
                <FastInput
                  type="text"
                  value={editProjectTitle}
                  onChange={(e) => setEditProjectTitle(e.target.value)}
                  autoFocus
                  placeholder="项目名称"
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-inherit transition-all"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-700">
                  项目简介 (可选)
                </label>
                <FastTextarea
                  value={editProjectDesc}
                  onChange={(e) => setEditProjectDesc(e.target.value)}
                  placeholder="项目简介内容..."
                  rows={3}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 border-inherit transition-all resize-none"
                />
              </div>
            </div>
            <div className="px-5 py-4 bg-neutral-50 border-t border-neutral-200 flex justify-end gap-2">
              <button
                onClick={() => setEditProjectModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-neutral-400 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (editProjectTitle.trim() && onUpdateProjectInfo) {
                    onUpdateProjectInfo(
                      editProjectTitle.trim(),
                      editProjectDesc.trim(),
                    );
                    setEditProjectModalOpen(false);
                  }
                }}
                disabled={!editProjectTitle.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-neutral-900 rounded-lg hover:bg-black transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                保存修改
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function CanvasDramaArea(props: {
  apiKey: string;
  getApiKeyForModel: (modelId: string) => string;
  currentModelId?: string;
  conversations?: Record<string, any>;
  setCurrentConvId?: (id: string | null) => void;
  createNewProject?: (title: string, description: string) => void;
  conversation?: any;
  onUpdateCanvas?: (nodes: Node[], edges: Edge[], title: string) => void;
  onUpdateProjectInfo?: (title: string, description: string) => void;
  onUpdateNodeInGlobalState?: (
    convId: string,
    nodeId: string,
    nodeUpdates: any,
  ) => void;
  onAppendNodesToGlobalState?: (
    convId: string,
    nodes: any[],
    edges: any[],
  ) => void;
  onUpdateHistory?: (
    convId: string,
    historyItem: {
      id: string;
      type: "image" | "audio" | "video";
      url: string;
      timestamp: number;
    },
  ) => void;
  onSaveAsset?: (url: string, type: "image" | "audio") => void;
  onDeleteAsset?: (id: string) => void;
  assets?: any[];
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}) {
  const [newProjectModalOpen, setNewProjectModalOpen] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");

  if (!props.conversation) {
    const dramaProjects = props.conversations
      ? Object.values(props.conversations).filter(
          (c: any) => c.func === "canvasDrama",
        )
      : [];

    return (
      <div className="flex-1 w-full h-full relative font-sans flex items-center justify-center bg-[#fcfcfc] overflow-y-auto w-full">
        <div
          className={`absolute top-4 left-4 z-50 items-center justify-center p-2 rounded-xl bg-white backdrop-blur-md border border-neutral-200 shadow-sm ${props.sidebarOpen ? "flex md:hidden" : "flex"}`}
        >
          <button
            onClick={() => props.setSidebarOpen(true)}
            className="md:hidden p-1.5 border-none bg-transparent text-neutral-900 cursor-pointer flex-shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>
          {!props.sidebarOpen && (
            <button
              onClick={() => props.setSidebarOpen(true)}
              className="hidden md:block p-1.5 rounded-md hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer flex-shrink-0"
              title="展开边栏"
            >
              <PanelLeftOpen className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="w-full max-w-5xl p-8 pt-20 pb-12 flex flex-col gap-8 min-h-full">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-neutral-900 mb-2">
                星幕项⽬厅
              </h2>
              <p className="text-sm text-neutral-500">
                双击进入项目画布，或点击选择并预览
              </p>
            </div>
            <button
              onClick={() => {
                setNewProjectTitle("");
                setNewProjectDesc("");
                setNewProjectModalOpen(true);
              }}
              className="px-4 py-2.5 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 transition-colors flex items-center gap-2 cursor-pointer shadow-md shadow-neutral-900/10"
            >
              <Plus className="w-4 h-4" /> 新建星幕项目
            </button>
          </div>

          {dramaProjects.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 bg-white border border-neutral-200 border-dashed rounded-2xl w-full">
              <Network className="w-12 h-12 text-yellow-500 mb-4 opacity-70" />
              <h3 className="text-lg font-medium text-neutral-900 mb-2">
                还没有项目
              </h3>
              <p className="text-sm text-neutral-500 max-w-sm text-center mb-6">
                创建一个新的星幕项目，开始您的高级数据编排与创作工作流。
              </p>
              <button
                onClick={() => {
                  setNewProjectTitle("");
                  setNewProjectDesc("");
                  setNewProjectModalOpen(true);
                }}
                className="px-5 py-2.5 bg-white border border-neutral-200 text-neutral-700 hover:text-neutral-900 rounded-lg text-sm font-medium hover:bg-neutral-50 transition-colors shadow-sm cursor-pointer"
              >
                创建初始项目
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {dramaProjects
                .sort((a: any, b: any) => b.created - a.created)
                .map((project: any) => (
                  <div
                    key={project.id}
                    className="relative overflow-hidden bg-white border border-neutral-200 rounded-2xl p-6 hover:border-yellow-500/50 hover:shadow-xl hover:shadow-yellow-500/10 transition-all duration-300 cursor-pointer group flex flex-col justify-between min-h-[180px]"
                    onDoubleClick={() => {
                      if (props.setCurrentConvId) {
                        props.setCurrentConvId(project.id);
                      }
                    }}
                  >
                    <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-gradient-to-br from-yellow-100 to-amber-50 blur-2xl opacity-50 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 to-amber-600 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500 ease-out" />

                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-50 to-amber-50 border border-yellow-100 text-yellow-600 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300">
                          <Network className="w-5 h-5" />
                        </div>
                        <span className="text-[11px] text-neutral-500 font-medium whitespace-nowrap bg-neutral-100/80 px-2.5 py-1 rounded-full border border-neutral-200/50">
                          {new Date(project.created).toLocaleDateString()}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-neutral-900 mb-1.5 group-hover:text-yellow-600 transition-colors line-clamp-1">
                        {project.title}
                      </h3>
                      <p className="text-sm text-neutral-500 line-clamp-2 leading-relaxed">
                        {project.description || "无项目描述"}
                      </p>
                    </div>

                    <div className="relative z-10 mt-5 pt-4 border-t border-neutral-100 flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs text-neutral-500 font-medium">
                        <div
                          className="flex items-center gap-1.5 bg-neutral-50 px-2 py-1 rounded-md"
                          title="节点"
                        >
                          <Layout className="w-3.5 h-3.5 text-neutral-400" />
                          {project.nodes?.length || 0}
                        </div>
                        <div
                          className="flex items-center gap-1.5 bg-neutral-50 px-2 py-1 rounded-md"
                          title="连接"
                        >
                          <Network className="w-3.5 h-3.5 text-neutral-400" />
                          {project.edges?.length || 0}
                        </div>
                      </div>
                      <span className="text-xs text-yellow-600 font-bold opacity-0 group-hover:opacity-100 flex items-center gap-1 translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                        双击进入 <MousePointer2 className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* New Project Modal */}
        {newProjectModalOpen && (
          <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl shadow-neutral-200/50 border border-neutral-200 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
                <h3 className="font-semibold text-neutral-900">新建星幕项目</h3>
                <button
                  onClick={() => setNewProjectModalOpen(false)}
                  className="text-neutral-400 hover:text-neutral-600 border-none bg-transparent cursor-pointer p-1 rounded-md hover:bg-neutral-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-neutral-700">
                    项目名称
                  </label>
                  <FastInput
                    type="text"
                    value={newProjectTitle}
                    onChange={(e) => setNewProjectTitle(e.target.value)}
                    autoFocus
                    placeholder="如: 黑神话剧情解析"
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-inherit transition-all"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-neutral-700">
                    项目简介 (可选)
                  </label>
                  <FastTextarea
                    value={newProjectDesc}
                    onChange={(e) => setNewProjectDesc(e.target.value)}
                    placeholder="简短描述项目用途..."
                    rows={3}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 border-inherit transition-all resize-none"
                  />
                </div>
              </div>
              <div className="px-5 py-4 bg-neutral-50 border-t border-neutral-200 flex justify-end gap-2">
                <button
                  onClick={() => setNewProjectModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-neutral-500 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors cursor-pointer"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    if (newProjectTitle.trim() && props.createNewProject) {
                      props.createNewProject(
                        newProjectTitle.trim(),
                        newProjectDesc.trim(),
                      );
                      setNewProjectModalOpen(false);
                    }
                  }}
                  disabled={!newProjectTitle.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-neutral-900 rounded-lg hover:bg-black transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  创建项目
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <CanvasDramaAreaInner
        {...props}
        onUpdateNodeInGlobalState={props.onUpdateNodeInGlobalState}
        onAppendNodesToGlobalState={props.onAppendNodesToGlobalState}
        onDeleteAsset={props.onDeleteAsset}
      />
    </ReactFlowProvider>
  );
}
