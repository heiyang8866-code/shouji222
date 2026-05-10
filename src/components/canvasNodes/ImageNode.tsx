import { FastTextarea, FastInput } from '../FastInput';
import React, { useState, useRef, useEffect, useContext } from "react";
import { CanvasContext } from "../../lib/CanvasContext";
import {
  Handle,
  Position,
  NodeProps,
  useStore,
  useUpdateNodeInternals,
} from "@xyflow/react";
import {
  ImageIcon,
  Monitor,
  BoxSelect,
  Loader2,
  BookmarkPlus,
  Library,
  X,
  Maximize2,
  SlidersHorizontal,
  ArrowUp,
  Edit,
  Download,
} from "lucide-react";
import { IMAGE_MODELS } from "../../constants";
import { cn } from "../../lib/utils";
import { Asset } from "../../types";
import { MagneticHandle } from "./MagneticHandle";
import { motion, AnimatePresence } from "motion/react";

function parseErrorMessage(rawError: string) {
  if (!rawError) return { title: '生成失败', desc: '未知错误', suggestion: '请重试，或检查网络连接。' };
  const errorMsg = rawError.toLowerCase();
  
  if (errorMsg.includes('429')) {
    if (errorMsg.includes('safety system') || errorMsg.includes('moderation')) {
      return {
        title: '内容审核拦截',
        desc: '您的要求或提示词触发了安全审核拦截。',
        suggestion: '请修改提示词，移除违规内容后重试。'
      };
    }
    return {
      title: '请求频率受限',
      desc: '当前生成请求过多，触发了接口限制。',
      suggestion: '建议稍微等待片刻后再重试。'
    };
  }

  if (errorMsg.includes('safety') || errorMsg.includes('moderation')) {
    return {
      title: '安全提示',
      desc: '生成内容可能违规，已被安全系统拦截。',
      suggestion: '请检查并修改可能违规的提示词。'
    };
  }

  if (errorMsg.includes('401') || errorMsg.includes('unauthorized') || errorMsg.includes('api key')) {
    return {
      title: '密钥不可用',
      desc: '未提供有效的 API Key，或已被服务器拒绝。',
      suggestion: '请前往侧边栏设置中更新您的 API 密钥。'
    };
  }

  if (errorMsg.includes('400') || errorMsg.includes('bad request')) {
    return {
      title: '参数错误',
      desc: '模型无法处理当前的配置或输入。',
      suggestion: '请尝试修改节点的比例或分辨率等配置。'
    };
  }
  
  if (errorMsg.includes('fetch') || errorMsg.includes('network') || errorMsg.includes('cors') || errorMsg.includes('502') || errorMsg.includes('504')) {
    return {
      title: '网络或服务异常',
      desc: '无法连接到接口，服务可能暂不可用。',
      suggestion: '请检查网络连接或稍后多试几次。'
    };
  }
  
  if (errorMsg.includes('timeout') || errorMsg.includes('超时')) {
    return {
      title: '生成超时',
      desc: '模型处理时间过长，已中止任务。',
      suggestion: '建议改用速度更快的模型，或重新尝试。'
    };
  }
  
  if (errorMsg.includes('abort') || errorMsg.includes('cancelled')) {
    return {
      title: '任务取消',
      desc: '正在进行的生成被主动打断或取消。',
      suggestion: '若需要结果，请点击重新生成。'
    };
  }

  const textDesc = rawError.length > 80 ? rawError.substring(0, 80) + '...' : rawError;
  return {
    title: '生成失败',
    desc: textDesc,
    suggestion: '遇到了意外的错误，可以尝试重新生成。'
  };
}

export const ImageNode = React.memo(function ImageNode({ data, id, selected, dragging }: NodeProps) {
  const zoom = useStore((s: any) => s.transform[2]);
  const selectedNodesCount = useStore(
    (s: any) => s.nodes.filter((n: any) => n.selected).length,
  );
  const isExtracted = data.variant === "extracted";
  const [modelOpen, setModelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [assetOpen, setAssetOpen] = useState(false);
  const [replaceImageOpen, setReplaceImageOpen] = useState<
    false | "menu" | "assets"
  >(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const [funcOpen, setFuncOpen] = useState(false);
  const [newStyleName, setNewStyleName] = useState("");
  const [newStyleContent, setNewStyleContent] = useState("");
  const [newFuncName, setNewFuncName] = useState("");
  const [newFuncContent, setNewFuncContent] = useState("");

  const [editingStyleIdx, setEditingStyleIdx] = useState<number | null>(null);
  const [editingStyleName, setEditingStyleName] = useState("");
  const [editingStyleContent, setEditingStyleContent] = useState("");

  const [editingFuncIdx, setEditingFuncIdx] = useState<number | null>(null);
  const [editingFuncName, setEditingFuncName] = useState("");
  const [editingFuncContent, setEditingFuncContent] = useState("");

  const [customStyles, setCustomStyles] = useState<
    { name: string; content: string }[]
  >(() => {
    const saved = localStorage.getItem("image-node-styles");
    return saved ? JSON.parse(saved) : [];
  });
  const [customFuncs, setCustomFuncs] = useState<
    { name: string; content: string }[]
  >(() => {
    const saved = localStorage.getItem("image-node-functions");
    return saved ? JSON.parse(saved) : [];
  });
  const [countOpen, setCountOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleGlobalClick = () => {
      setModelOpen(false);
      setSettingsOpen(false);
      setAssetOpen(false);
      setReplaceImageOpen(false);
      setStyleOpen(false);
      setFuncOpen(false);
      setCountOpen(false);
    };

    window.addEventListener("pointerdown", handleGlobalClick);
    return () => window.removeEventListener("pointerdown", handleGlobalClick);
  }, []);

  const currentModel =
    IMAGE_MODELS.find((m) => m.id === data.modelId) || IMAGE_MODELS[0];
  const { assets: globalAssets, isSpacePressed } = useContext(CanvasContext);
  const localAssets = (data.localAssets || []) as Asset[];
  const allAssets = [...globalAssets, ...localAssets];
  const inputImages = (data.attachedImages as string[]) || [];

  const builtInStyles = [
    {
      name: "真人提示词",
      content: "100%写实风格，真人电影，自然光线，4K超高清。",
    },
  ];

  const builtInFuncs = [
    {
      name: "角色三视图",
      content:
        "纯白色背景，图左三分之一为角色上半身正面全景，图右为角色全身三视图（正面、背面、侧面），图像正上方写着角色名字，禁止输出多余的文字。",
    },
  ];

  const allStyles = [...builtInStyles, ...customStyles];
  const allFuncs = [...builtInFuncs, ...customFuncs];

  const handleAddStyle = () => {
    if (newStyleName.trim() && newStyleContent.trim()) {
      const updated = [
        ...customStyles,
        { name: newStyleName.trim(), content: newStyleContent.trim() },
      ];
      setCustomStyles(updated);
      localStorage.setItem("image-node-styles", JSON.stringify(updated));
      setNewStyleName("");
      setNewStyleContent("");
    }
  };

  const handleRemoveStyle = (index: number) => {
    const updated = customStyles.filter((_, i) => i !== index);
    setCustomStyles(updated);
    localStorage.setItem("image-node-styles", JSON.stringify(updated));
  };

  const handleAddFunc = () => {
    if (newFuncName.trim() && newFuncContent.trim()) {
      const updated = [
        ...customFuncs,
        { name: newFuncName.trim(), content: newFuncContent.trim() },
      ];
      setCustomFuncs(updated);
      localStorage.setItem("image-node-functions", JSON.stringify(updated));
      setNewFuncName("");
      setNewFuncContent("");
    }
  };

  const handleRemoveFunc = (index: number) => {
    const updated = customFuncs.filter((_, i) => i !== index);
    setCustomFuncs(updated);
    localStorage.setItem("image-node-functions", JSON.stringify(updated));
  };

  const startEditStyle = (index: number, s: any) => {
    setEditingStyleIdx(index);
    setEditingStyleName(s.name);
    setEditingStyleContent(s.content);
  };

  const saveEditStyle = () => {
    if (
      editingStyleIdx !== null &&
      editingStyleName.trim() &&
      editingStyleContent.trim()
    ) {
      const customIdx = editingStyleIdx - builtInStyles.length;
      const updated = [...customStyles];
      updated[customIdx] = {
        name: editingStyleName.trim(),
        content: editingStyleContent.trim(),
      };
      setCustomStyles(updated);
      localStorage.setItem("image-node-styles", JSON.stringify(updated));
      setEditingStyleIdx(null);
    }
  };

  const startEditFunc = (index: number, f: any) => {
    setEditingFuncIdx(index);
    setEditingFuncName(f.name);
    setEditingFuncContent(f.content);
  };

  const saveEditFunc = () => {
    if (
      editingFuncIdx !== null &&
      editingFuncName.trim() &&
      editingFuncContent.trim()
    ) {
      const customIdx = editingFuncIdx - builtInFuncs.length;
      const updated = [...customFuncs];
      updated[customIdx] = {
        name: editingFuncName.trim(),
        content: editingFuncContent.trim(),
      };
      setCustomFuncs(updated);
      localStorage.setItem("image-node-functions", JSON.stringify(updated));
      setEditingFuncIdx(null);
    }
  };

  const applyStyle = (style: { name: string; content: string }) => {
    if (data.onChange) {
      (data.onChange as any)(id, { selectedStyle: style });
    }
    setStyleOpen(false);
  };

  const applyFunc = (func: { name: string; content: string }) => {
    if (data.onChange) {
      (data.onChange as any)(id, { selectedFunction: func });
    }
    setFuncOpen(false);
  };

  const selectedStyle = data.selectedStyle as
    | { name: string; content: string }
    | undefined;
  const selectedFunction = data.selectedFunction as
    | { name: string; content: string }
    | undefined;

  const handleClearImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.onChange) {
      (data.onChange as any)(id, { imageSrc: null, imageSrcs: null });
    }
  };

  const handleImageDragStart = (e: React.DragEvent, url: string) => {
    e.stopPropagation();
    e.dataTransfer.setData("text/plain", url);
    e.dataTransfer.setData("application/x-custom-type", "image");
    e.dataTransfer.setData("application/x-source", "canvas-node");
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.imageSrc) {
      const a = document.createElement("a");
      a.href = data.imageSrc as string;
      a.download = `image-${id}.png`;
      a.click();
    }
  };

  const handleImageDoubleClick = (url: string) => {
    setFullscreenImage(url);
    setIsFullscreen(true);
  };

  const onGenerate = () => {
    if (data.onGenerate) {
      (data.onGenerate as any)(id);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const url = e.dataTransfer.getData("text/plain");
    const type = e.dataTransfer.getData("application/x-custom-type");

    if (url && (type === "image" || type === "unknown" || !type)) {
      // Check if it's already there to avoid duplicates
      if (!inputImages.includes(url)) {
        const newAttached = [...inputImages, url];
        if (data.onChange) {
          (data.onChange as any)(id, { attachedImages: newAttached });
        }
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleAddAsset = (asset: Asset) => {
    if (asset.type === "image") {
      const newAttached = [...inputImages, asset.url];
      (data.onChange as any)(id, { attachedImages: newAttached });
    }
    setAssetOpen(false);
  };

  const handleNodeNativeDragStart = (e: React.DragEvent) => {
    if (data.imageSrc) {
      e.dataTransfer.setData("text/plain", data.imageSrc as string);
      e.dataTransfer.setData("application/x-custom-type", "image");
      e.dataTransfer.setData("application/x-source", "canvas-node");
      e.dataTransfer.effectAllowed = "copy";
    }
  };

  const displayBoxRef = useRef<HTMLDivElement>(null);
  const inputBoxRef = useRef<HTMLDivElement>(null);
  const [inputHandleStyle, setInputHandleStyle] = useState<React.CSSProperties>({
    top: "150px",
    left: "0px",
  });
  const [outputHandleStyle, setOutputHandleStyle] = useState<React.CSSProperties>({
    top: "150px",
  });
  const updateNodeInternals = useUpdateNodeInternals();

  useEffect(() => {
    const updateHandlePos = () => {
      if (displayBoxRef.current) {
        const outBox = displayBoxRef.current;
        const outTop = outBox.offsetTop + outBox.offsetHeight / 2;
        setOutputHandleStyle({ top: `${outTop}px` });

        if (isExtracted && inputBoxRef.current) {
          const inBox = inputBoxRef.current;
          const inTop = inBox.offsetTop + inBox.offsetHeight / 2;
          const inLeft = inBox.offsetLeft;
          setInputHandleStyle({ top: `${inTop}px`, left: `${inLeft}px` });
        } else {
          const inTop = outBox.offsetTop + outBox.offsetHeight / 2;
          const inLeft = outBox.offsetLeft;
          setInputHandleStyle({ top: `${inTop}px`, left: `${inLeft}px` });
        }
      }
    };

    const obs = new ResizeObserver(updateHandlePos);
    if (displayBoxRef.current) obs.observe(displayBoxRef.current);
    if (inputBoxRef.current) obs.observe(inputBoxRef.current);
    updateHandlePos();
    return () => obs.disconnect();
  }, [isExtracted, data.imageSrc, data.ratio, id]);

  // Update internals after the DOM has actually rendered the new handle style
  useEffect(() => {
    requestAnimationFrame(() => updateNodeInternals(id));
  }, [inputHandleStyle.top, inputHandleStyle.left, outputHandleStyle.top, id, updateNodeInternals]);

  const [isTextExpanded, setIsTextExpanded] = useState(false);

  const getRatios = (modelId: string) => {
    if (modelId === "midjourney" || modelId === "niji") {
      return ["1:1", "9:16", "16:9", "3:4", "4:3", "3:2", "2:3"];
    }
    if (modelId === "gemini-3-pro-image-preview") { // nanobananapro
      return ["自适应", "1:1", "9:16", "16:9", "3:4", "4:3", "3:2", "2:3", "4:5", "5:4", "21:9"];
    }
    if (modelId === "gemini-3.1-flash-image-preview") { // nanobanana2
      return ["自适应", "1:1", "9:16", "16:9", "3:4", "4:3", "3:2", "2:3", "4:5", "5:4", "8:1", "1:8", "4:1", "1:4", "21:9"];
    }
    if (modelId === "gpt-image-2-all") { // gpt-image-2
      return ["自适应", "1:1", "1:2", "2:1", "9:16", "16:9", "3:4", "4:3", "3:2", "2:3", "4:5", "5:4", "21:9", "9:21"];
    }
    return ["自适应", "1:1", "9:16", "16:9", "3:4", "4:3", "21:9"];
  };

  const getResolutions = (modelId: string) => {
    if (modelId === "midjourney" || modelId === "niji") {
      return ["自适应"];
    }
    return ["1k", "2k", "4k"];
  };

  const currentResolutions = getResolutions(data.modelId as string);
  const currentRatios = getRatios(data.modelId as string);

  const getImageCounts = (modelId: string) => {
    if (modelId === "midjourney" || modelId === "niji") {
      return [1];
    }
    return [1, 2, 4];
  };

  const currentImageCounts = getImageCounts(data.modelId as string);

  const getParamLabel = () => {
    const ratio = (data.ratio as string) || "1:1";
    const res = (data.resolution as string) || "1k";
    let label = `${res}·${ratio}`;

    if (data.modelId === "gpt-image-2-all") {
      const qMap: Record<string, string> = {
        auto: "自动",
        low: "低",
        medium: "中",
        high: "高",
      };
      const qName = qMap[(data.quality as string) || "auto"] || "自动";
      label = `${qName}·${label}`;
    }
    return label;
  };

  return (
    <>
      <AnimatePresence>
        {isTextExpanded && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-20 pointer-events-auto">
            <motion.div
              initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
              animate={{ opacity: 1, backdropFilter: "blur(10px)" }}
              exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
              className="absolute inset-0 bg-black/60"
              onClick={() => setIsTextExpanded(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-4xl bg-[#1a1a1a] border border-white/20 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-600/20 flex items-center justify-center">
                    <Edit className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-black text-lg uppercase tracking-wider">编辑提取提示词</h3>
                    <p className="text-neutral-500 text-xs">{(data.title as string) || "提示词"}</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsTextExpanded(false)}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/10 transition-all border-none bg-transparent cursor-pointer"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className={cn("p-8 flex-1 overflow-y-auto custom-scrollbar", selected && "nodrag")} onPointerDown={(e) => e.stopPropagation()}>
                <FastTextarea 
                  className={cn("w-full bg-transparent border-none text-xl text-neutral-200 placeholder:text-neutral-600 resize-none outline-none leading-relaxed min-h-[400px]", selected && "nodrag")}
                  value={data.content as string}
                  onChange={(e) =>
                    data.onChange &&
                    (data.onChange as any)(id, { content: e.target.value })
                  }
                  
                  autoFocus
                />
              </div>
              <div className="p-6 border-t border-white/5 bg-black/20 flex justify-end">
                <button
                  onClick={() => setIsTextExpanded(false)}
                  className="px-8 py-3 bg-purple-600 hover:bg-purple-500 text-white font-black rounded-xl transition-all shadow-xl shadow-purple-900/20 border-none cursor-pointer active:scale-95"
                >
                  确认并关闭
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={cn(
          "bg-transparent rounded-xl flex flex-col font-sans relative transition-all duration-300 overflow-visible border border-white shadow-[0_4px_20px_rgba(0,0,0,0.5)] group cursor-grab active:cursor-grabbing",
          isSpacePressed && "p-2",
          isExtracted ? "w-[660px]" : "w-max",
          selected
            ? "ring-2 ring-white shadow-[0_0_15px_rgba(255,255,255,0.3)]"
            : "hover:border-white/70",
        )}
      >
        {/* Input Handle (Left) */}
        <div
          className="absolute flex items-center justify-center z-[100]"
          style={inputHandleStyle}
        >
          <MagneticHandle type="target" position={Position.Left} id="left" />
        </div>

        {/* Content Wrapper */}
        <div
          className={cn(
            "flex w-full",
            isExtracted ? "flex-row" : "flex-col items-center",
            isSpacePressed && "nodrag cursor-default",
          )}
        >
          {isExtracted && (
            <div
              ref={inputBoxRef}
              className={cn("flex-1 p-4 bg-[#1a1a1a] rounded-l-xl flex flex-col gap-4 border-r border-white/5 cursor-text", selected && "nodrag")}
              onDoubleClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 p-2 px-3 bg-white/5 rounded-2xl">
                  <span className="text-[13px] font-black text-white uppercase tracking-widest leading-none">
                    {(data.title as string) || "提示词 (提取) / 参考图"}
                  </span>
                </div>
                <button 
                  onClick={() => setIsTextExpanded(true)}
                  className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-neutral-500 hover:text-neutral-300 hover:bg-white/5 transition-colors border-none bg-transparent cursor-pointer", selected && "nodrag")}
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>

              <div className="relative flex-1 flex flex-col gap-2">
                <div className="relative flex-1">
                  <FastTextarea 
                    className={cn("w-full h-full min-h-[150px] bg-transparent border-none p-0 text-sm text-neutral-200 placeholder:text-neutral-500 resize-none outline-none leading-relaxed custom-scrollbar", selected && "nodrag")}
                    value={data.content as string}
                    onChange={(e) =>
                      data.onChange &&
                      (data.onChange as any)(id, { content: e.target.value })
                    }
                    placeholder="分段描述内容..."
                  />
                </div>

                <div className="flex items-center gap-2 mb-1">
                  <div className="relative">
                    <button
                      onClick={() => setStyleOpen(!styleOpen)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold rounded-lg transition-colors border cursor-pointer",
                        selectedStyle
                          ? "bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-900/20"
                          : "bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border-purple-500/20",
                      )}
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      {selectedStyle ? selectedStyle.name : "风格库"}
                    </button>
                    {styleOpen && (
                      <div
                        className="absolute top-full left-0 mt-2 w-[280px] bg-[#1e1f24] border border-white/10 rounded-2xl shadow-2xl z-[70] p-4 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-200"
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                          <div className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">
                            预设风格
                          </div>
                          {selectedStyle && (
                            <button
                              onClick={() => {
                                (data.onChange as any)(id, {
                                  selectedStyle: null,
                                });
                                setStyleOpen(false);
                              }}
                              className="text-[10px] text-neutral-400 hover:text-red-400 transition-colors border-none bg-transparent cursor-pointer"
                            >
                              清除选择
                            </button>
                          )}
                        </div>
                        <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
                          {allStyles.map((s, idx) => (
                            <div key={idx} className="group relative">
                              {editingStyleIdx === idx ? (
                                <div className="flex flex-col gap-2 p-2.5 rounded-xl border border-purple-500/30 bg-purple-500/10 mb-1 z-10 relative">
                                  <FastInput 
                                    className="bg-black/20 border border-white/10 rounded-lg px-2 py-1 text-xs text-white placeholder:text-neutral-500 outline-none focus:border-purple-500/50"
                                    value={editingStyleName}
                                    onChange={(e) =>
                                      setEditingStyleName(e.target.value)
                                    }
                                    placeholder="风格名称..."
                                  />
                                  <FastTextarea 
                                    className="bg-black/20 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white placeholder:text-neutral-500 outline-none focus:border-purple-500/50 resize-none h-16"
                                    value={editingStyleContent}
                                    onChange={(e) =>
                                      setEditingStyleContent(e.target.value)
                                    }
                                    placeholder="风格描述内容..."
                                  />
                                  <div className="flex gap-2 justify-end">
                                    <button
                                      onClick={() => setEditingStyleIdx(null)}
                                      className="text-[10px] px-2 py-1 text-neutral-400 hover:text-white bg-white/5 rounded-md border-none cursor-pointer"
                                    >
                                      取消
                                    </button>
                                    <button
                                      onClick={saveEditStyle}
                                      className="text-[10px] px-2 py-1 text-white bg-purple-600 hover:bg-purple-500 rounded-md border-none cursor-pointer"
                                    >
                                      保存
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <button
                                    onClick={() => applyStyle(s)}
                                    className={cn(
                                      "w-full text-left p-2.5 rounded-xl transition-all border flex flex-col gap-0.5 bg-transparent cursor-pointer",
                                      selectedStyle?.name === s.name
                                        ? "bg-purple-500/10 border-purple-500/30"
                                        : "hover:bg-white/5 border-transparent hover:border-white/10",
                                    )}
                                  >
                                    <span
                                      className={cn(
                                        "text-xs font-bold",
                                        selectedStyle?.name === s.name
                                          ? "text-purple-400"
                                          : "text-neutral-200",
                                      )}
                                    >
                                      {s.name}
                                    </span>
                                    <span className="text-[10px] text-neutral-500 line-clamp-1">
                                      {s.content}
                                    </span>
                                  </button>
                                  {idx >= builtInStyles.length && (
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          startEditStyle(idx, s);
                                        }}
                                        className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all flex items-center justify-center border-none cursor-pointer"
                                      >
                                        <Edit className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRemoveStyle(
                                            idx - builtInStyles.length,
                                          );
                                        }}
                                        className="w-6 h-6 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center border-none cursor-pointer"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="mt-2 pt-3 border-t border-white/5 flex flex-col gap-2">
                          <FastInput 
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-neutral-600 outline-none focus:border-purple-500/50 transition-colors"
                            placeholder="风格名称..."
                            value={newStyleName}
                            onChange={(e) => setNewStyleName(e.target.value)}
                          />
                          <FastTextarea 
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-neutral-600 outline-none focus:border-purple-500/50 transition-colors resize-none h-[60px]"
                            placeholder="风格描述内容..."
                            value={newStyleContent}
                            onChange={(e) => setNewStyleContent(e.target.value)}
                          />
                          <button
                            onClick={handleAddStyle}
                            className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold rounded-lg transition-colors border-none cursor-pointer shadow-lg shadow-purple-900/20"
                          >
                            保存到风格库
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <button
                      onClick={() => setFuncOpen(!funcOpen)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold rounded-lg transition-colors border cursor-pointer",
                        selectedFunction
                          ? "bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-900/20"
                          : "bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/20",
                      )}
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      {selectedFunction ? selectedFunction.name : "功能库"}
                    </button>
                    {funcOpen && (
                      <div
                        className="absolute top-full left-0 mt-2 w-[280px] bg-[#1e1f24] border border-white/10 rounded-2xl shadow-2xl z-[70] p-4 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-200"
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                          <div className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">
                            功能预设
                          </div>
                          {selectedFunction && (
                            <button
                              onClick={() => {
                                (data.onChange as any)(id, {
                                  selectedFunction: null,
                                });
                                setFuncOpen(false);
                              }}
                              className="text-[10px] text-neutral-400 hover:text-red-400 transition-colors border-none bg-transparent cursor-pointer"
                            >
                              清除选择
                            </button>
                          )}
                        </div>
                        <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
                          {allFuncs.map((f, idx) => (
                            <div key={idx} className="group relative">
                              {editingFuncIdx === idx ? (
                                <div className="flex flex-col gap-2 p-2.5 rounded-xl border border-blue-500/30 bg-blue-500/10 mb-1 z-10 relative">
                                  <FastInput 
                                    className="bg-black/20 border border-white/10 rounded-lg px-2 py-1 text-xs text-white placeholder:text-neutral-500 outline-none focus:border-blue-500/50"
                                    value={editingFuncName}
                                    onChange={(e) =>
                                      setEditingFuncName(e.target.value)
                                    }
                                    placeholder="功能名称..."
                                  />
                                  <FastTextarea 
                                    className="bg-black/20 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white placeholder:text-neutral-500 outline-none focus:border-blue-500/50 resize-none h-16"
                                    value={editingFuncContent}
                                    onChange={(e) =>
                                      setEditingFuncContent(e.target.value)
                                    }
                                    placeholder="功能描述内容..."
                                  />
                                  <div className="flex gap-2 justify-end">
                                    <button
                                      onClick={() => setEditingFuncIdx(null)}
                                      className="text-[10px] px-2 py-1 text-neutral-400 hover:text-white bg-white/5 rounded-md border-none cursor-pointer"
                                    >
                                      取消
                                    </button>
                                    <button
                                      onClick={saveEditFunc}
                                      className="text-[10px] px-2 py-1 text-white bg-blue-600 hover:bg-blue-500 rounded-md border-none cursor-pointer"
                                    >
                                      保存
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <button
                                    onClick={() => applyFunc(f)}
                                    className={cn(
                                      "w-full text-left p-2.5 rounded-xl transition-all border flex flex-col gap-0.5 bg-transparent cursor-pointer",
                                      selectedFunction?.name === f.name
                                        ? "bg-blue-500/10 border-blue-500/30"
                                        : "hover:bg-white/5 border-transparent hover:border-white/10",
                                    )}
                                  >
                                    <span
                                      className={cn(
                                        "text-xs font-bold",
                                        selectedFunction?.name === f.name
                                          ? "text-blue-400"
                                          : "text-neutral-200",
                                      )}
                                    >
                                      {f.name}
                                    </span>
                                    <span className="text-[10px] text-neutral-500 line-clamp-1">
                                      {f.content}
                                    </span>
                                  </button>
                                  {idx >= builtInFuncs.length && (
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          startEditFunc(idx, f);
                                        }}
                                        className="w-6 h-6 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500 hover:text-white transition-all flex items-center justify-center border-none cursor-pointer"
                                      >
                                        <Edit className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRemoveFunc(
                                            idx - builtInFuncs.length,
                                          );
                                        }}
                                        className="w-6 h-6 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center border-none cursor-pointer"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="mt-2 pt-3 border-t border-white/5 flex flex-col gap-2">
                          <FastInput 
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-neutral-600 outline-none focus:border-blue-500/50 transition-colors"
                            placeholder="功能名称..."
                            value={newFuncName}
                            onChange={(e) => setNewFuncName(e.target.value)}
                          />
                          <FastTextarea 
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-neutral-600 outline-none focus:border-blue-500/50 transition-colors resize-none h-[60px]"
                            placeholder="功能描述内容..."
                            value={newFuncContent}
                            onChange={(e) => setNewFuncContent(e.target.value)}
                          />
                          <button
                            onClick={handleAddFunc}
                            className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded-lg transition-colors border-none cursor-pointer shadow-lg shadow-blue-900/20"
                          >
                            保存到功能库
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {inputImages.length > 0 && (
                  <div className="w-full flex gap-2 overflow-x-auto custom-scrollbar py-1">
                    {inputImages.map((img, idx) => (
                      <div
                        key={idx}
                        className="relative w-12 h-12 rounded-xl overflow-hidden ring-1 ring-white/10 group/thumb shrink-0"
                      >
                        <img
                          src={img}
                          className="w-full h-full object-cover"
                          alt=""
                        />
                        <div className="absolute top-0 right-0 bg-black/60 px-1 text-[8px] text-white rounded-bl-lg">
                          {idx + 1}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const newAttached = [...inputImages];
                            newAttached.splice(idx, 1);
                            (data.onChange as any)(id, {
                              attachedImages: newAttached,
                            });
                          }}
                          className="absolute inset-0 flex items-center justify-center bg-black/60 text-white opacity-0 group-hover/thumb:opacity-100 transition-opacity border-none cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className={cn("flex items-center justify-between pt-3", selected && "nodrag")}>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <div className="relative">
                    <button
                      onClick={() => setModelOpen(!modelOpen)}
                      className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white transition-colors border-none bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-md cursor-pointer font-medium tracking-wide"
                    >
                      <span>{currentModel.name}</span>
                      <svg
                        className="w-3 h-3 opacity-50"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                    {modelOpen && (
                      <div
                        className="absolute bottom-full left-0 mb-3 w-[180px] bg-[#2a2a2a] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden py-1"
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        {IMAGE_MODELS.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => {
                              let defaults: any = { modelId: m.id };
                              if (m.id === "gemini-3-pro-image-preview") {
                                defaults.resolution = "1k";
                                defaults.ratio = "16:9";
                              } else if (m.id === "gemini-3.1-flash-image-preview") {
                                defaults.resolution = "1k";
                                defaults.ratio = "16:9";
                              } else if (m.id === "gpt-image-2-all") {
                                defaults.quality = "medium";
                                defaults.resolution = "1k";
                                defaults.ratio = "16:9";
                              } else if (m.id === "midjourney" || m.id === "niji") {
                                defaults.resolution = "自适应";
                                defaults.ratio = "16:9";
                                defaults.imageCount = 1;
                              }
                              (data.onChange as any)(id, defaults);
                              setModelOpen(false);
                            }}
                            className={cn(
                              "w-full text-left px-4 py-2.5 text-[11px] transition-colors border-none bg-transparent cursor-pointer",
                              data.modelId === m.id
                                ? "text-purple-400 bg-purple-400/10 font-bold"
                                : "text-neutral-400 hover:bg-white/5",
                            )}
                          >
                            {m.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <button
                      onClick={() => setSettingsOpen(!settingsOpen)}
                      className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white transition-colors border-none bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-md cursor-pointer font-medium tracking-wide"
                    >
                      <span>{getParamLabel()}</span>
                      <svg
                        className="w-3 h-3 opacity-50"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                    {settingsOpen && (
                      <div
                        className="absolute bottom-full left-0 w-[240px] mb-3 bg-[#1e1f24] border border-white/10 rounded-2xl shadow-2xl z-50 p-4 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-200"
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        {data.modelId === "gpt-image-2-all" && (
                          <div className="flex flex-col gap-2">
                            <div className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">
                              画质
                            </div>
                            <div className="grid grid-cols-4 gap-1.5">
                              {[
                                { id: "auto", name: "自动" },
                                { id: "low", name: "低" },
                                { id: "medium", name: "中" },
                                { id: "high", name: "高" },
                              ].map((q) => (
                                <button
                                  key={q.id}
                                  onClick={() => (data.onChange as any)(id, { quality: q.id })}
                                  className={cn(
                                    "py-1.5 text-[11px] rounded-lg border transition-all cursor-pointer",
                                    (data.quality || "auto") === q.id
                                      ? "bg-purple-500/20 border-purple-500/50 text-purple-400 font-bold"
                                      : "bg-white/5 border-transparent text-neutral-400 hover:border-white/10"
                                  )}
                                >
                                  {q.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex flex-col gap-2">
                          <div className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">
                            分辨率
                          </div>
                          <div className="flex gap-2">
                            {currentResolutions.map((r) => (
                              <button
                                key={r}
                                onClick={() => (data.onChange as any)(id, { resolution: r })}
                                className={cn(
                                  "flex-1 py-1.5 text-[11px] rounded-lg border transition-all cursor-pointer",
                                  ((data.resolution as string) || (data.modelId === 'midjourney' || data.modelId === 'niji' ? "自适应" : "1k")) === r
                                    ? "bg-purple-500/20 border-purple-500/50 text-purple-400 font-bold"
                                    : "bg-white/5 border-transparent text-neutral-400 hover:border-white/10"
                                )}
                              >
                                {r}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <div className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">
                            画面比例
                          </div>
                          <div className="grid grid-cols-4 gap-1.5">
                            {currentRatios.map((r) => (
                              <button
                                key={r}
                                onClick={() => (data.onChange as any)(id, { ratio: r })}
                                className={cn(
                                  "py-1.5 text-[10px] rounded-lg border transition-all cursor-pointer",
                                  (data.ratio || "1:1") === r
                                    ? "bg-purple-500/20 border-purple-500/50 text-purple-400 font-bold"
                                    : "bg-white/5 border-transparent text-neutral-400 hover:border-white/10"
                                )}
                              >
                                {r}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {data.modelId !== "midjourney" && data.modelId !== "niji" && (
                    <div className="relative">
                      <button
                        onClick={() => setCountOpen(!countOpen)}
                        className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white transition-colors border-none bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-md cursor-pointer font-medium tracking-wide"
                      >
                        <span>{(data.imageCount as number) || 1} 张</span>
                        <svg
                          className="w-3 h-3 opacity-50"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </button>
                      {countOpen && (
                        <div
                          className="absolute bottom-full right-0 w-[80px] mb-3 bg-[#2a2a2a] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden py-1"
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          {currentImageCounts.map((c) => (
                            <button
                              key={c}
                              onClick={() => {
                                (data.onChange as any)(id, { imageCount: c });
                                setCountOpen(false);
                              }}
                              className={cn(
                                "w-full text-left px-4 py-2.5 text-[11px] border-none bg-transparent cursor-pointer transition-colors",
                                ((data.imageCount as number) || (data.modelId === 'midjourney' || data.modelId === 'niji' ? 4 : 1)) === c
                                  ? "text-purple-400 bg-purple-400/10 font-bold"
                                  : "text-neutral-400 hover:bg-white/5",
                              )}
                            >
                              {c} 张
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {data.isGenerating ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); if (data.onStop) { (data.onStop as any)(id); } }}
                    className="w-8 h-8 rounded-lg bg-red-600 hover:bg-red-500 text-white flex items-center justify-center transition-all shadow-[0_0_15px_rgba(220,38,38,0.3)] active:scale-90 border-none cursor-pointer z-10 shrink-0"
                    title="停止生成"
                  >
                    <X className="w-4 h-4 stroke-[3px]" />
                  </button>
                ) : (
                  <button
                    onClick={onGenerate}
                    className="w-8 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] active:scale-90 border-none cursor-pointer z-10 shrink-0"
                    title="生成"
                  >
                    <ArrowUp className="w-4 h-4 stroke-[3px]" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Top: Image Output Area */}
          <div
            ref={displayBoxRef}
            className={cn(
              "bg-black/50 backdrop-blur-md relative group/img cursor-pointer transition-all duration-300 shadow-sm flex flex-none items-center justify-center overflow-visible",
              isExtracted ? "w-[360px] min-h-[250px] rounded-r-xl" : "h-[450px] rounded-xl",
              selected &&
                "ring-2 ring-white ring-offset-1 ring-offset-transparent",
              replaceImageOpen && "z-50",
            )}
            style={{
              aspectRatio: (!isExtracted && (data.ratio as string) !== "自适应")
                ? (data.ratio as string)?.replace(":", "/") || "1/1"
                : undefined,
              zIndex: 10,
            }}
            onDoubleClick={(e) => {
              if (data.imageSrcs && (data.imageSrcs as string[]).length > 1) {
                e.stopPropagation();
                setGalleryOpen(true);
              }
            }}
          >
            <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-neutral-900/40 backdrop-blur-md px-2 py-0.5 rounded-full text-white/90 text-[10px] z-[60] font-medium border border-white/10">
              <ImageIcon className="w-3 h-3" />
              <span>图片节点 {id.split("-").pop()}</span>
            </div>

            {data.imageSrc ? (
              <>
                {data.imageSrcs && (data.imageSrcs as string[]).length > 1 && (
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-white text-[10px] z-[60] font-medium border border-white/10 whitespace-nowrap shadow-xl pointer-events-none transition-opacity duration-300">
                    共 {(data.imageSrcs as string[]).length} 张 (双击展开)
                  </div>
                )}

                {data.imageSrcs && (data.imageSrcs as string[]).length > 1 ? (
                  (() => {
                    const allSrcs = data.imageSrcs as string[];
                    const mainSrc = (data.imageSrc as string) || allSrcs[0];
                    const bgSrcs = allSrcs
                      .filter((src) => src !== mainSrc)
                      .slice(0, 3);

                    return (
                      <>
                        <div
                          className={cn(
                            "w-full h-full absolute inset-0 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] rounded-xl opacity-100 scale-100",
                            isExtracted && "p-2 z-20"
                          )}
                        >
                          {bgSrcs[2] && (
                            <img
                              src={bgSrcs[2]}
                              className="absolute inset-0 w-full h-full object-contain transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] rounded-xl shadow-[7px_-7px_25px_rgba(0,0,0,0.5)] origin-bottom-left scale-100 -translate-y-12 translate-x-12 rotate-9 z-[17] opacity-40 blur-[4px] cursor-pointer hover:blur-none hover:opacity-100 hover:z-[22] hover:-translate-y-16 hover:translate-x-16 hover:rotate-[16deg]"
                              referrerPolicy="no-referrer"
                              onClick={(e) => {
                                e.stopPropagation();
                                setGalleryOpen(true);
                              }}
                            />
                          )}

                          {bgSrcs[1] && (
                            <img
                              src={bgSrcs[1]}
                              className="absolute inset-0 w-full h-full object-contain transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] rounded-xl shadow-[5px_-5px_20px_rgba(0,0,0,0.6)] origin-bottom-left scale-100 -translate-y-8 translate-x-8 rotate-6 z-[18] opacity-60 blur-[3px] cursor-pointer hover:blur-none hover:opacity-100 hover:z-[22] hover:-translate-y-12 hover:translate-x-12 hover:rotate-[12deg]"
                              referrerPolicy="no-referrer"
                              onClick={(e) => {
                                e.stopPropagation();
                                setGalleryOpen(true);
                              }}
                            />
                          )}

                          {bgSrcs[0] && (
                            <img
                              src={bgSrcs[0]}
                              className="absolute inset-0 w-full h-full object-contain transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] rounded-xl shadow-[3px_-3px_15px_rgba(0,0,0,0.6)] origin-bottom-left scale-100 -translate-y-4 translate-x-4 rotate-3 z-[19] opacity-80 blur-[1.5px] cursor-pointer hover:blur-none hover:opacity-100 hover:z-[22] hover:-translate-y-6 hover:translate-x-6 hover:rotate-[6deg]"
                              referrerPolicy="no-referrer"
                              onClick={(e) => {
                                e.stopPropagation();
                                setGalleryOpen(true);
                              }}
                            />
                          )}

                          <img
                            src={mainSrc}
                            className={cn(
                              "relative w-full h-full object-contain transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.5)] z-20 cursor-grab active:cursor-grabbing",
                            )}
                            referrerPolicy="no-referrer"
                            draggable={isSpacePressed}
                            onDragStart={
                              isSpacePressed
                                ? (e) => handleImageDragStart(e, mainSrc)
                                : undefined
                            }
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              setGalleryOpen(true);
                            }}
                          />
                        </div>

                        <div className={cn("absolute top-2 right-2 flex items-center gap-1.5 transition-all duration-300 z-[60]", "opacity-0 group-hover/img:opacity-100", selected && "nodrag")}>
                          {data.onSaveAsset && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                (data.onSaveAsset as any)(
                                  mainSrc,
                                  "image",
                                );
                              }}
                              className="h-7 px-2.5 bg-black/60 hover:bg-emerald-500 text-white rounded-full flex items-center gap-1.5 border-none cursor-pointer transition-colors"
                              title="存入资产库"
                            >
                              <BookmarkPlus className="w-3.5 h-3.5" />
                              <span className="text-[10px] font-medium hidden sm:inline">存资产</span>
                            </button>
                          )}
                          <button
                            onClick={handleDownload}
                            className="w-7 h-7 bg-black/60 hover:bg-blue-500 text-white rounded-full flex items-center justify-center border-none cursor-pointer transition-colors"
                            title="下载图片"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={handleClearImage}
                            className="w-7 h-7 bg-black/60 hover:bg-red-500 text-white rounded-full flex items-center justify-center border-none cursor-pointer transition-colors"
                            title="清除图片"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {/* End of stack images display area */}
                      </>
                    );
                  })()
                ) : isExtracted ? (

                  <div
                    className={cn(
                      "absolute inset-0 flex items-center justify-center p-2 z-20",
                    )}
                  >
                    <img
                      src={data.imageSrc as string}
                      alt="generated"
                      draggable={isSpacePressed}
                      onDragStart={
                        isSpacePressed
                          ? (e) =>
                              handleImageDragStart(e, data.imageSrc as string)
                          : undefined
                      }
                      className="w-full h-full object-contain transition-all cursor-grab active:cursor-grabbing"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <img
                    src={data.imageSrc as string}
                    alt="generated"
                    draggable={isSpacePressed}
                    onDragStart={
                      isSpacePressed
                        ? (e) =>
                            handleImageDragStart(e, data.imageSrc as string)
                        : undefined
                    }
                    className={cn(
                      "w-full h-full object-contain transition-all relative z-20 cursor-grab active:cursor-grabbing",
                    )}
                    referrerPolicy="no-referrer"
                  />
                )}

                {true && (
                  <div className={cn("absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover/img:opacity-100 transition-opacity z-[60]", selected && "nodrag")}>
                    {data.onSaveAsset && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          (data.onSaveAsset as any)(
                            data.imageSrc as string,
                            "image",
                          );
                        }}
                        className="h-7 px-2.5 bg-black/60 hover:bg-emerald-500 text-white rounded-full flex items-center gap-1.5 border-none cursor-pointer transition-colors"
                        title="存入资产库"
                      >
                        <BookmarkPlus className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-medium hidden sm:inline">存资产</span>
                      </button>
                    )}
                    <button
                      onClick={handleDownload}
                      className="w-7 h-7 bg-black/60 hover:bg-blue-500 text-white rounded-full flex items-center justify-center border-none cursor-pointer transition-colors"
                      title="下载图片"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={handleClearImage}
                      className="w-7 h-7 bg-black/60 hover:bg-red-500 text-white rounded-full flex items-center justify-center border-none cursor-pointer transition-colors"
                      title="清除图片"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-purple-400/60 text-xs flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/15 flex items-center justify-center">
                  <ImageIcon className="w-6 h-6 text-purple-400" />
                </div>
                <span className="font-semibold tracking-tight">待绘图</span>
              </div>
            )}

            <div className={cn("absolute bottom-2 right-2 flex items-center gap-2 z-50", selected && "nodrag")}>
              {isExtracted && (
                <div className="relative">
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setReplaceImageOpen(replaceImageOpen ? false : "menu");
                    }}
                    className="bg-black/60 hover:bg-black/80 text-white text-[10px] px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 border-none cursor-pointer h-8 shadow-lg backdrop-blur-sm"
                  >
                    <Library className="w-3.5 h-3.5" /> 替换图片
                  </button>

                  {replaceImageOpen === "menu" && (
                    <div
                      className="absolute bottom-full right-0 mb-2 w-[160px] bg-[#2a2a2a] border border-white/10 rounded-2xl shadow-2xl z-50 p-2 animate-in fade-in slide-in-from-bottom-2 duration-200 cursor-default"
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <button
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setReplaceImageOpen("assets");
                        }}
                        className="w-full text-left px-3 py-2.5 text-[11px] text-neutral-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors border-none bg-transparent cursor-pointer font-medium mb-1"
                      >
                        从资产库选择
                      </button>
                      <label className="block w-full cursor-pointer hover:bg-white/10 text-left px-3 py-2.5 rounded-xl text-[11px] text-neutral-300 hover:text-white transition-colors font-medium">
                        从本地上传
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                const url = event.target?.result as string;
                                if (data.onChange) {
                                  (data.onChange as any)(id, { imageSrc: url });
                                }
                                setReplaceImageOpen(false);
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    </div>
                  )}

                  {replaceImageOpen === "assets" && (
                    <div
                      className="absolute bottom-full right-0 mb-2 w-[240px] bg-[#2a2a2a] border border-white/10 rounded-2xl shadow-2xl z-50 max-h-[300px] overflow-y-auto p-1 py-2 animate-in fade-in slide-in-from-bottom-2 duration-200 cursor-default"
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <div className="px-3 py-2 mb-1 border-b border-white/5 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                          选择替换图片
                        </span>
                        <X
                          className="w-3 h-3 text-neutral-500 cursor-pointer hover:text-white transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setReplaceImageOpen("menu");
                          }}
                        />
                      </div>
                      {allAssets.filter((a) => a.type === "image").length ===
                      0 ? (
                        <div className="p-6 text-center text-[10px] text-neutral-500 italic">
                          资产库暂无图片...
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 p-2">
                          {allAssets
                            .filter((a) => a.type === "image")
                            .map((asset) => (
                              <button
                                key={asset.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  (data.onChange as any)(id, {
                                    imageSrc: asset.url,
                                  });
                                  setReplaceImageOpen(false);
                                }}
                                className="relative aspect-square rounded-xl overflow-hidden border border-white/5 hover:border-purple-500 group/asset p-0 cursor-pointer transition-all"
                              >
                                <img
                                  src={asset.url}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {data.isGenerating && (
              <div className="absolute inset-0 bg-[#0a0a0a]/70 backdrop-blur-[2px] flex flex-col items-center justify-center gap-3 z-20">
                <div className="p-3 bg-[#1a1a1a] rounded-2xl shadow-xl border border-white/5">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                </div>
                <span className="text-xs font-bold text-neutral-300 tracking-wider uppercase">
                  绘图中...
                </span>
              </div>
            )}

            {data.error && !data.isGenerating && (() => {
              const errorInfo = parseErrorMessage(data.error as string);
              return (
              <div className="absolute inset-0 bg-red-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-30 p-6 text-center animate-in fade-in duration-300">
                <div className="w-12 h-12 rounded-2xl bg-red-500/20 flex flex-col items-center justify-center mb-1">
                  <X className="w-6 h-6 text-red-400" />
                </div>
                <div className="flex flex-col gap-1 w-full flex-1 justify-center max-w-[200px]">
                  <span className="text-[13px] font-bold text-red-400 tracking-wider">
                    {errorInfo.title}
                  </span>
                  <span className="text-[11px] text-red-200/90 leading-relaxed max-w-full truncate whitespace-normal" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                    {errorInfo.desc}
                  </span>
                  <span className="text-[10px] text-red-300/70 mt-1 pb-1">
                    💡 {errorInfo.suggestion}
                  </span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onGenerate(); }}
                  className="mt-1 px-5 py-2 bg-red-500/80 hover:bg-red-500 text-white text-[11px] rounded-full font-bold transition-all border border-red-500/50 cursor-pointer shadow-lg shadow-red-500/20"
                >
                  重试生成
                </button>
              </div>
            )})()}
          </div>

          {/* Bottom: Controls & Input Area - Shown ONLY when selected AND not extracted AND not dragging AND single selection */}
          {selected &&
            !isExtracted &&
            !dragging &&
            selectedNodesCount === 1 && (
              <div
                className={cn("absolute top-full left-1/2 mt-4 p-4 bg-[#1a1a1a] rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-300 border border-white/5 ring-4 ring-black/5", selected && "nodrag")}
                style={{
                  width: "600px",
                  transform: `translate(-50%, 0) scale(${1 / zoom})`,
                  transformOrigin: "top center",
                  zIndex: 50,
                }}
                draggable={true}
                onDragStart={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                {/* Top Row: Info & Images */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 p-2 px-3 bg-white/5 rounded-2xl">
                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                      输入素材
                    </span>
                  </div>

                  {/* Thumbnails */}
                  <div className="flex-1 flex gap-2 overflow-x-auto no-scrollbar py-1">
                    {inputImages.map((img, idx) => (
                      <div
                        key={idx}
                        className="relative w-12 h-12 rounded-xl overflow-hidden ring-1 ring-white/10 group/thumb shrink-0"
                      >
                        <img
                          src={img}
                          className="w-full h-full object-cover"
                          alt=""
                        />
                        <div className="absolute top-0 right-0 bg-black/60 px-1 text-[8px] text-white rounded-bl-lg">
                          {idx + 1}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const newAttached = [...inputImages];
                            newAttached.splice(idx, 1);
                            (data.onChange as any)(id, {
                              attachedImages: newAttached,
                            });
                          }}
                          className="absolute inset-0 flex items-center justify-center bg-black/60 text-white opacity-0 group-hover/thumb:opacity-100 transition-opacity border-none cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => setAssetOpen(true)}
                      className="w-12 h-12 rounded-xl border-2 border-dashed border-white/10 flex items-center justify-center text-white/20 hover:text-white/40 hover:border-white/20 transition-all shrink-0 bg-transparent cursor-pointer"
                    >
                      <BookmarkPlus className="w-5 h-5" />
                    </button>
                    {assetOpen && (
                      <div
                        className="absolute top-0 right-full mr-3 w-[240px] bg-[#2a2a2a] border border-white/10 rounded-2xl shadow-2xl z-50 max-h-[300px] overflow-y-auto p-1 py-2 animate-in fade-in slide-in-from-right-2 duration-200"
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <div className="px-3 py-2 mb-1 border-b border-white/5 flex items-center justify-between">
                          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                            我的资产
                          </span>
                          <X
                            className="w-3 h-3 text-neutral-500 cursor-pointer hover:text-white transition-colors"
                            onClick={() => setAssetOpen(false)}
                          />
                        </div>
                        {allAssets.filter((a) => a.type === "image").length ===
                        0 ? (
                          <div className="p-8 text-center text-[11px] text-neutral-500 italic">
                            资产中没有图片素材...
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2 p-2">
                            {allAssets
                              .filter((a) => a.type === "image")
                              .map((asset) => (
                                <button
                                  key={asset.id}
                                  onClick={() => {
                                    const newAttached = [
                                      ...inputImages,
                                      asset.url,
                                    ];
                                    (data.onChange as any)(id, {
                                      attachedImages: newAttached,
                                    });
                                    setAssetOpen(false);
                                  }}
                                  className="relative aspect-square rounded-xl overflow-hidden border border-white/5 hover:border-purple-500 group/asset p-0 cursor-pointer transition-all"
                                >
                                  <img
                                    src={asset.url}
                                    alt=""
                                    className="w-full h-full object-cover"
                                  />
                                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/asset:opacity-100 flex items-center justify-center transition-all">
                                    <span className="text-[9px] text-white bg-purple-600 px-2 py-0.5 rounded-full font-bold shadow-lg">
                                      选用
                                    </span>
                                  </div>
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <button className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-500 hover:text-neutral-300 hover:bg-white/5 transition-colors border-none bg-transparent cursor-pointer">
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Input Row */}
                <div className="relative flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <button
                        onClick={() => setStyleOpen(!styleOpen)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold rounded-lg transition-colors border cursor-pointer",
                          selectedStyle
                            ? "bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-900/20"
                            : "bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border-purple-500/20",
                        )}
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        {selectedStyle ? selectedStyle.name : "风格库"}
                      </button>
                      {styleOpen && (
                        <div
                          className="absolute bottom-full left-0 mb-3 w-[280px] bg-[#1e1f24] border border-white/10 rounded-2xl shadow-2xl z-[70] p-4 flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200"
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-between border-b border-white/5 pb-2">
                            <div className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">
                              预设风格
                            </div>
                            {selectedStyle && (
                              <button
                                onClick={() => {
                                  (data.onChange as any)(id, {
                                    selectedStyle: null,
                                  });
                                  setStyleOpen(false);
                                }}
                                className="text-[10px] text-neutral-400 hover:text-red-400 transition-colors border-none bg-transparent cursor-pointer"
                              >
                                清除选择
                              </button>
                            )}
                          </div>
                          <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
                            {allStyles.map((s, idx) => (
                              <div key={idx} className="group relative">
                                {editingStyleIdx === idx ? (
                                  <div className="flex flex-col gap-2 p-2.5 rounded-xl border border-purple-500/30 bg-purple-500/10 mb-1 z-10 relative">
                                    <FastInput 
                                      className="bg-black/20 border border-white/10 rounded-lg px-2 py-1 text-xs text-white placeholder:text-neutral-500 outline-none focus:border-purple-500/50"
                                      value={editingStyleName}
                                      onChange={(e) =>
                                        setEditingStyleName(e.target.value)
                                      }
                                      placeholder="风格名称..."
                                    />
                                    <FastTextarea 
                                      className="bg-black/20 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white placeholder:text-neutral-500 outline-none focus:border-purple-500/50 resize-none h-16"
                                      value={editingStyleContent}
                                      onChange={(e) =>
                                        setEditingStyleContent(e.target.value)
                                      }
                                      placeholder="风格描述内容..."
                                    />
                                    <div className="flex gap-2 justify-end">
                                      <button
                                        onClick={() => setEditingStyleIdx(null)}
                                        className="text-[10px] px-2 py-1 text-neutral-400 hover:text-white bg-white/5 rounded-md border-none cursor-pointer"
                                      >
                                        取消
                                      </button>
                                      <button
                                        onClick={saveEditStyle}
                                        className="text-[10px] px-2 py-1 text-white bg-purple-600 hover:bg-purple-500 rounded-md border-none cursor-pointer"
                                      >
                                        保存
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => applyStyle(s)}
                                      className={cn(
                                        "w-full text-left p-2.5 rounded-xl transition-all border flex flex-col gap-0.5 bg-transparent cursor-pointer",
                                        selectedStyle?.name === s.name
                                          ? "bg-purple-500/10 border-purple-500/30"
                                          : "hover:bg-white/5 border-transparent hover:border-white/10",
                                      )}
                                    >
                                      <span
                                        className={cn(
                                          "text-xs font-bold",
                                          selectedStyle?.name === s.name
                                            ? "text-purple-400"
                                            : "text-neutral-200",
                                        )}
                                      >
                                        {s.name}
                                      </span>
                                      <span className="text-[10px] text-neutral-500 line-clamp-1">
                                        {s.content}
                                      </span>
                                    </button>
                                    {idx >= builtInStyles.length && (
                                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            startEditStyle(idx, s);
                                          }}
                                          className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all flex items-center justify-center border-none cursor-pointer"
                                        >
                                          <Edit className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveStyle(
                                              idx - builtInStyles.length,
                                            );
                                          }}
                                          className="w-6 h-6 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center border-none cursor-pointer"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            ))}
                          </div>

                          <div className="mt-2 pt-3 border-t border-white/5 flex flex-col gap-2">
                            <FastInput 
                              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-neutral-600 outline-none focus:border-purple-500/50 transition-colors"
                              placeholder="风格名称..."
                              value={newStyleName}
                              onChange={(e) => setNewStyleName(e.target.value)}
                            />
                            <FastTextarea 
                              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-neutral-600 outline-none focus:border-purple-500/50 transition-colors resize-none h-[60px]"
                              placeholder="风格描述内容..."
                              value={newStyleContent}
                              onChange={(e) =>
                                setNewStyleContent(e.target.value)
                              }
                            />
                            <button
                              onClick={handleAddStyle}
                              className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold rounded-lg transition-colors border-none cursor-pointer shadow-lg shadow-purple-900/20"
                            >
                              保存到风格库
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="relative">
                      <button
                        onClick={() => setFuncOpen(!funcOpen)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold rounded-lg transition-colors border cursor-pointer",
                          selectedFunction
                            ? "bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-900/20"
                            : "bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/20",
                        )}
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        {selectedFunction ? selectedFunction.name : "功能库"}
                      </button>
                      {funcOpen && (
                        <div
                          className="absolute bottom-full left-0 mb-3 w-[280px] bg-[#1e1f24] border border-white/10 rounded-2xl shadow-2xl z-[70] p-4 flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200"
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-between border-b border-white/5 pb-2">
                            <div className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">
                              功能预设
                            </div>
                            {selectedFunction && (
                              <button
                                onClick={() => {
                                  (data.onChange as any)(id, {
                                    selectedFunction: null,
                                  });
                                  setFuncOpen(false);
                                }}
                                className="text-[10px] text-neutral-400 hover:text-red-400 transition-colors border-none bg-transparent cursor-pointer"
                              >
                                清除选择
                              </button>
                            )}
                          </div>
                          <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
                            {allFuncs.map((f, idx) => (
                              <div key={idx} className="group relative">
                                {editingFuncIdx === idx ? (
                                  <div className="flex flex-col gap-2 p-2.5 rounded-xl border border-blue-500/30 bg-blue-500/10 mb-1 z-10 relative">
                                    <FastInput 
                                      className="bg-black/20 border border-white/10 rounded-lg px-2 py-1 text-xs text-white placeholder:text-neutral-500 outline-none focus:border-blue-500/50"
                                      value={editingFuncName}
                                      onChange={(e) =>
                                        setEditingFuncName(e.target.value)
                                      }
                                      placeholder="功能名称..."
                                    />
                                    <FastTextarea 
                                      className="bg-black/20 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white placeholder:text-neutral-500 outline-none focus:border-blue-500/50 resize-none h-16"
                                      value={editingFuncContent}
                                      onChange={(e) =>
                                        setEditingFuncContent(e.target.value)
                                      }
                                      placeholder="功能描述内容..."
                                    />
                                    <div className="flex gap-2 justify-end">
                                      <button
                                        onClick={() => setEditingFuncIdx(null)}
                                        className="text-[10px] px-2 py-1 text-neutral-400 hover:text-white bg-white/5 rounded-md border-none cursor-pointer"
                                      >
                                        取消
                                      </button>
                                      <button
                                        onClick={saveEditFunc}
                                        className="text-[10px] px-2 py-1 text-white bg-blue-600 hover:bg-blue-500 rounded-md border-none cursor-pointer"
                                      >
                                        保存
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => applyFunc(f)}
                                      className={cn(
                                        "w-full text-left p-2.5 rounded-xl transition-all border flex flex-col gap-0.5 bg-transparent cursor-pointer",
                                        selectedFunction?.name === f.name
                                          ? "bg-blue-500/10 border-blue-500/30"
                                          : "hover:bg-white/5 border-transparent hover:border-white/10",
                                      )}
                                    >
                                      <span
                                        className={cn(
                                          "text-xs font-bold",
                                          selectedFunction?.name === f.name
                                            ? "text-blue-400"
                                            : "text-neutral-200",
                                        )}
                                      >
                                        {f.name}
                                      </span>
                                      <span className="text-[10px] text-neutral-500 line-clamp-1">
                                        {f.content}
                                      </span>
                                    </button>
                                    {idx >= builtInFuncs.length && (
                                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            startEditFunc(idx, f);
                                          }}
                                          className="w-6 h-6 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500 hover:text-white transition-all flex items-center justify-center border-none cursor-pointer"
                                        >
                                          <Edit className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveFunc(
                                              idx - builtInFuncs.length,
                                            );
                                          }}
                                          className="w-6 h-6 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center border-none cursor-pointer"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            ))}
                          </div>

                          <div className="mt-2 pt-3 border-t border-white/5 flex flex-col gap-2">
                            <FastInput 
                              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-neutral-600 outline-none focus:border-blue-500/50 transition-colors"
                              placeholder="功能名称..."
                              value={newFuncName}
                              onChange={(e) => setNewFuncName(e.target.value)}
                            />
                            <FastTextarea 
                              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-neutral-600 outline-none focus:border-blue-500/50 transition-colors resize-none h-[60px]"
                              placeholder="功能描述内容..."
                              value={newFuncContent}
                              onChange={(e) =>
                                setNewFuncContent(e.target.value)
                              }
                            />
                            <button
                              onClick={handleAddFunc}
                              className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded-lg transition-colors border-none cursor-pointer shadow-lg shadow-blue-900/20"
                            >
                              保存到功能库
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="relative flex-1">
                    <FastTextarea 
                      className={cn("w-full h-[100px] bg-transparent border-none p-0 text-[15px] text-neutral-200 placeholder:text-neutral-500 resize-none outline-none leading-relaxed custom-scrollbar", selected && "nodrag")}
                      value={data.content as string}
                      onChange={(e) =>
                        data.onChange &&
                        (data.onChange as any)(id, { content: e.target.value })
                      }
                      placeholder="描述你想要生成的画面内容，或引用素材..."
                      onDoubleClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>

                {/* Bottom Row Controls */}
                <div className={cn("flex items-center justify-between pt-3", selected && "nodrag")}>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <div className="relative">
                      <button
                        onClick={() => setModelOpen(!modelOpen)}
                        className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white transition-colors border-none bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-md cursor-pointer font-medium tracking-wide"
                      >
                        <span>{currentModel.name}</span>
                        <svg
                          className="w-3 h-3 opacity-50"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </button>
                      {modelOpen && (
                        <div
                          className="absolute bottom-full left-0 mb-3 w-[180px] bg-[#2a2a2a] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden py-1"
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          {IMAGE_MODELS.map((m) => (
                            <button
                              key={m.id}
                              onClick={() => {
                                let defaults: any = { modelId: m.id };
                                if (m.id === "gemini-3-pro-image-preview") {
                                  defaults.resolution = "1k";
                                  defaults.ratio = "16:9";
                                } else if (m.id === "gemini-3.1-flash-image-preview") {
                                  defaults.resolution = "1k";
                                  defaults.ratio = "16:9";
                                } else if (m.id === "gpt-image-2-all") {
                                  defaults.quality = "medium";
                                  defaults.resolution = "1k";
                                  defaults.ratio = "16:9";
                                }
                                (data.onChange as any)(id, defaults);
                                setModelOpen(false);
                              }}
                              className={cn(
                                "w-full text-left px-4 py-2.5 text-[11px] transition-colors border-none bg-transparent cursor-pointer",
                                data.modelId === m.id
                                  ? "text-purple-400 bg-purple-400/10 font-bold"
                                  : "text-neutral-400 hover:bg-white/5",
                              )}
                            >
                              {m.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="relative">
                      <button
                        onClick={() => setSettingsOpen(!settingsOpen)}
                        className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white transition-colors border-none bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-md cursor-pointer font-medium tracking-wide"
                      >
                        <span>{getParamLabel()}</span>
                        <svg
                          className="w-3 h-3 opacity-50"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </button>
                      {settingsOpen && (
                        <div
                          className="absolute bottom-full left-0 w-[240px] mb-3 bg-[#1e1f24] border border-white/10 rounded-2xl shadow-2xl z-50 p-4 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-200"
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          {data.modelId === "gpt-image-2-all" && (
                            <div className="flex flex-col gap-2">
                              <div className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">
                                画质
                              </div>
                              <div className="grid grid-cols-4 gap-1.5">
                                {[
                                  { id: "auto", name: "自动" },
                                  { id: "low", name: "低" },
                                  { id: "medium", name: "中" },
                                  { id: "high", name: "高" },
                                ].map((q) => (
                                  <button
                                    key={q.id}
                                    onClick={() => (data.onChange as any)(id, { quality: q.id })}
                                    className={cn(
                                      "py-1.5 text-[11px] rounded-lg border transition-all cursor-pointer",
                                      (data.quality || "auto") === q.id
                                        ? "bg-purple-500/20 border-purple-500/50 text-purple-400 font-bold"
                                        : "bg-white/5 border-transparent text-neutral-400 hover:border-white/10"
                                    )}
                                  >
                                    {q.name}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="flex flex-col gap-2">
                            <div className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">
                              分辨率
                            </div>
                            <div className="flex gap-2">
                              {currentResolutions.map((r) => (
                                <button
                                  key={r}
                                  onClick={() => (data.onChange as any)(id, { resolution: r })}
                                  className={cn(
                                    "flex-1 py-1.5 text-[11px] rounded-lg border transition-all cursor-pointer",
                                    ((data.resolution as string) || (data.modelId === 'midjourney' || data.modelId === 'niji' ? "自适应" : "1k")) === r
                                      ? "bg-purple-500/20 border-purple-500/50 text-purple-400 font-bold"
                                      : "bg-white/5 border-transparent text-neutral-400 hover:border-white/10"
                                  )}
                                >
                                  {r}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="flex flex-col gap-2">
                            <div className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">
                              画面比例
                            </div>
                            <div className="grid grid-cols-4 gap-1.5">
                              {currentRatios.map((r) => (
                                <button
                                  key={r}
                                  onClick={() => (data.onChange as any)(id, { ratio: r })}
                                  className={cn(
                                    "py-1.5 text-[10px] rounded-lg border transition-all cursor-pointer",
                                    (data.ratio || "1:1") === r
                                      ? "bg-purple-500/20 border-purple-500/50 text-purple-400 font-bold"
                                      : "bg-white/5 border-transparent text-neutral-400 hover:border-white/10"
                                  )}
                                >
                                  {r}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="relative">
                      <button
                        onClick={() => setCountOpen(!countOpen)}
                        className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white transition-colors border-none bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-md cursor-pointer font-medium tracking-wide"
                      >
                        <span>{(data.imageCount as number) || 1} 张</span>
                        <svg
                          className="w-3 h-3 opacity-50"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </button>
                      {countOpen && (
                        <div
                          className="absolute bottom-full right-0 w-[80px] mb-3 bg-[#2a2a2a] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden py-1"
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          {currentImageCounts.map((c) => (
                            <button
                              key={c}
                              onClick={() => {
                                (data.onChange as any)(id, { imageCount: c });
                                setCountOpen(false);
                              }}
                              className={cn(
                                "w-full text-left px-4 py-2.5 text-[11px] border-none bg-transparent cursor-pointer transition-colors",
                                ((data.imageCount as number) || (data.modelId === 'midjourney' || data.modelId === 'niji' ? 4 : 1)) === c
                                  ? "text-purple-400 bg-purple-400/10 font-bold"
                                  : "text-neutral-400 hover:bg-white/5",
                              )}
                            >
                              {c} 张
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {data.isGenerating ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); if (data.onStop) { (data.onStop as any)(id); } }}
                      className="w-8 h-8 rounded-lg bg-red-600 hover:bg-red-500 text-white flex items-center justify-center transition-all shadow-[0_0_15px_rgba(220,38,38,0.3)] active:scale-90 border-none cursor-pointer z-10 shrink-0"
                      title="停止生成"
                    >
                      <X className="w-4 h-4 stroke-[3px]" />
                    </button>
                  ) : (
                    <button
                      onClick={onGenerate}
                      className="w-8 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] active:scale-90 border-none cursor-pointer z-10 shrink-0"
                      title="生成"
                    >
                      <ArrowUp className="w-4 h-4 stroke-[3px]" />
                    </button>
                  )}
                </div>
              </div>
            )}
        </div>

        {/* Output Handle (Right) */}
        <div
          className="absolute right-0 flex items-center justify-center z-[100]"
          style={{ top: outputHandleStyle.top }}
        >
          <MagneticHandle type="source" position={Position.Right} id="right" />
        </div>

        {(modelOpen ||
          settingsOpen ||
          assetOpen ||
          replaceImageOpen ||
          countOpen) && (
          <div
            className="fixed inset-0 z-40"
            onPointerDown={(e) => {
              e.stopPropagation();
              setModelOpen(false);
              setSettingsOpen(false);
              setAssetOpen(false);
              setReplaceImageOpen(false);
              setCountOpen(false);
            }}
            onClick={() => {
              setModelOpen(false);
              setSettingsOpen(false);
              setAssetOpen(false);
              setReplaceImageOpen(false);
              setCountOpen(false);
            }}
          />
        )}
      </div>

      {galleryOpen && data.imageSrcs && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-8 bg-black/80 backdrop-blur-md"
          onClick={() => setGalleryOpen(false)}
        >
          <div
            className="flex flex-col w-full max-w-[90vw] max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-6">
              <div className="flex flex-col gap-1">
                <h2 className="text-white text-2xl font-black uppercase tracking-widest flex items-center gap-3">
                  作品图集
                  <span className="text-purple-400 text-xs px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20">
                    共 {(data.imageSrcs as string[]).length} 张
                  </span>
                </h2>
                <p className="text-white/40 text-xs tracking-wider">双击或点击下方大图切换，再次点击背景可退出查看</p>
              </div>
              <button
                className="w-12 h-12 rounded-full bg-white/5 hover:bg-red-500/90 text-white flex items-center justify-center transition-all border-none cursor-pointer hover:rotate-90 group"
                onClick={() => setGalleryOpen(false)}
              >
                <X className="w-6 h-6 group-hover:scale-110" />
              </button>
            </div>

            {/* Body */}
            <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
              <div className={cn(
                "grid gap-8 items-center justify-center mx-auto",
                (data.imageSrcs as string[]).length === 2 ? "grid-cols-2 max-w-6xl" : 
                (data.imageSrcs as string[]).length === 4 ? "grid-cols-2 max-w-4xl" :
                "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-7xl"
              )}>
                {(data.imageSrcs as string[]).map((src, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "relative group rounded-[2rem] overflow-hidden cursor-pointer transition-all duration-500 bg-white/5 shadow-2xl",
                      data.imageSrc === src
                        ? "ring-[4px] ring-purple-500/80 ring-offset-[6px] ring-offset-transparent scale-[1.02]"
                        : "opacity-60 hover:opacity-100 hover:scale-[1.01] border border-white/10 hover:border-white/30",
                    )}
                    style={{
                      aspectRatio:
                        (data.ratio as string) === "自适应"
                          ? "auto"
                          : (data.ratio as string)?.replace(":", "/") || "1/1",
                    }}
                    onClick={() => {
                      (data.onChange as any)(id, { imageSrc: src });
                      setGalleryOpen(false);
                    }}
                  >
                    <img
                      src={src}
                      className={cn(
                        "w-full h-full transition-all duration-700 group-hover:scale-110 object-contain",
                        !isExtracted && "p-1"
                      )}
                      alt=""
                      referrerPolicy="no-referrer"
                    />
                    
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-end justify-center p-8">
                      <div className="bg-white text-black px-6 py-2.5 rounded-full font-black text-sm shadow-2xl transform translate-y-4 group-hover:translate-y-0 transition-transform">
                        选用作品
                      </div>
                    </div>

                    {data.imageSrc === src && (
                      <div className="absolute top-6 left-6 flex items-center gap-2 bg-purple-500 text-white px-4 py-1.5 rounded-full shadow-2xl backdrop-blur-md font-black text-[10px] uppercase tracking-widest animate-in fade-in zoom-in duration-500">
                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                        当前展示中
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {isFullscreen && fullscreenImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md"
          onClick={() => setIsFullscreen(false)}
        >
          <img
            src={fullscreenImage}
            alt="Fullscreen"
            className="max-w-[95vw] max-h-[95vh] object-contain rounded-lg shadow-2xl"
            referrerPolicy="no-referrer"
          />
          <button
            className="absolute top-6 right-6 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-all border-none cursor-pointer hover:scale-110 text-2xl"
            onClick={(e) => {
              e.stopPropagation();
              setIsFullscreen(false);
            }}
          >
            ×
          </button>
        </div>
      )}
    </>
  );
});
