import { FastTextarea, FastInput } from "../FastInput";
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
  Video,
  Monitor,
  BoxSelect,
  Loader2,
  BookmarkPlus,
  Library,
  X,
  Maximize2,
  SlidersHorizontal,
  ArrowUp,
  Film,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Download,
  Edit,
} from "lucide-react";
import { VIDEO_MODELS } from "../../constants";
import { cn } from "../../lib/utils";
import { Asset } from "../../types";
import { MagneticHandle } from "./MagneticHandle";
import { motion, AnimatePresence } from "motion/react";

export const VideoNode = React.memo(function VideoNode({
  data,
  id,
  selected,
  dragging,
}: NodeProps) {
  const zoom = useStore((s: any) => s.transform[2]);
  const selectedNodesCount = useStore(
    (s: any) => s.nodes.filter((n: any) => n.selected).length,
  );
  const isExtracted = data.variant === "extracted";
  const [modelOpen, setModelOpen] = useState(false);
  const [ratioOpen, setRatioOpen] = useState(false);
  const [assetOpen, setAssetOpen] = useState(false);
  const [resOpen, setResOpen] = useState(false);
  const [durationOpen, setDurationOpen] = useState(false);
  const [audioOpen, setAudioOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [replaceVideoOpen, setReplaceVideoOpen] = useState<
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
    const saved = localStorage.getItem("video-node-styles");
    return saved ? JSON.parse(saved) : [];
  });
  const [customFuncs, setCustomFuncs] = useState<
    { name: string; content: string }[]
  >(() => {
    const saved = localStorage.getItem("video-node-functions");
    return saved ? JSON.parse(saved) : [];
  });
  const [countOpen, setCountOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [fullscreenVideo, setFullscreenVideo] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  const formatTime = (time: number) => {
    if (isNaN(time)) return "00:00";
    const m = Math.floor(time / 60).toString().padStart(2, "0");
    const s = Math.floor(time % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const newVolume = Number(e.target.value);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      videoRef.current.muted = newVolume === 0;
    }
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current
          .play()
          .catch((err) => console.error("Play failed", err));
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const total = videoRef.current.duration;
      setCurrentTime(current);
      const p = (current / total) * 100;
      setProgress(isNaN(p) ? 0 : p);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleProgressScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (videoRef.current) {
      const newTime =
        (Number(e.target.value) / 100) * videoRef.current.duration;
      videoRef.current.currentTime = newTime;
      setProgress(Number(e.target.value));
    }
  };

  const handleVideoDragStart = (e: React.DragEvent) => {
    if (data.videoSrc) {
      e.stopPropagation();
      e.dataTransfer.setData("text/plain", data.videoSrc as string);
      e.dataTransfer.setData("application/x-custom-type", "video");
      e.dataTransfer.setData("application/x-source", "canvas-node");
      e.dataTransfer.effectAllowed = "copy";

      if (videoRef.current) {
        const canvas = document.createElement("canvas");
        const rect = videoRef.current.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          try {
            // Try to draw the video onto the canvas at its scaled size
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            canvas.style.position = "absolute";
            canvas.style.top = "-9999px";
            document.body.appendChild(canvas);

            // Calculate precise drag offsets
            const scaleX = rect.width / videoRef.current.clientWidth;
            const scaleY = rect.height / videoRef.current.clientHeight;
            const offsetX = e.nativeEvent.offsetX * scaleX;
            const offsetY = e.nativeEvent.offsetY * scaleY;

            e.dataTransfer.setDragImage(canvas, offsetX, offsetY);
            setTimeout(() => document.body.removeChild(canvas), 0);
          } catch (err) {
            // If canvas is tainted (CORS) or other error, fallback to nothing
          }
        }
      }
    }
  };

  useEffect(() => {
    const handleGlobalClick = () => {
      setModelOpen(false);
      setRatioOpen(false);
      setAssetOpen(false);
      setResOpen(false);
      setDurationOpen(false);
      setAudioOpen(false);
    };

    window.addEventListener("pointerdown", handleGlobalClick);
    return () => window.removeEventListener("pointerdown", handleGlobalClick);
  }, []);

  const currentModel =
    VIDEO_MODELS.find((m) => m.id === data.modelId) || VIDEO_MODELS[0];

  let availableRatios = ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"];
  let availableResolutions = ["720p", "1080p", "2k", "4k"];
  let availableDurations = [
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
  let showAudioOptions = false;
  let availableAudioOptions = ["关闭", "开启"];

  if (currentModel.id === "grok-video-3") {
    availableRatios = ["16:9", "9:16", "1:1", "2:3", "3:2"];
    availableResolutions = ["720p"];
    availableDurations = ["6s", "10s", "15s"];
  }

  const currentRatio =
    data.ratio && availableRatios.includes(data.ratio as string)
      ? (data.ratio as string)
      : availableRatios[0];
  const currentResolution =
    data.resolution && availableResolutions.includes(data.resolution as string)
      ? (data.resolution as string)
      : availableResolutions[0];
  const currentDuration =
    data.duration && availableDurations.includes(data.duration as string)
      ? (data.duration as string)
      : availableDurations[0];
  const currentAudio =
    data.audioEnabled &&
    availableAudioOptions.includes(data.audioEnabled as string)
      ? (data.audioEnabled as string)
      : availableAudioOptions[0];

  const { assets: globalAssets, isSpacePressed } = useContext(CanvasContext);
  const localAssets = (data.localAssets || []) as Asset[];
  const allAssets = [...globalAssets, ...localAssets];
  const inputImages = (data.attachedImages as string[]) || [];

  const builtInStyles = [
    {
      name: "电影质感",
      content: "电影级画质，自然光效，色彩丰富且有层次感，4k分辨率。",
    },
  ];

  const builtInFuncs = [
    { name: "缓慢运镜", content: "镜头缓慢向前推进，画面平稳不抖动。" },
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
      localStorage.setItem("video-node-styles", JSON.stringify(updated));
      setNewStyleName("");
      setNewStyleContent("");
    }
  };

  const handleRemoveStyle = (index: number) => {
    const updated = customStyles.filter((_, i) => i !== index);
    setCustomStyles(updated);
    localStorage.setItem("video-node-styles", JSON.stringify(updated));
  };

  const handleAddFunc = () => {
    if (newFuncName.trim() && newFuncContent.trim()) {
      const updated = [
        ...customFuncs,
        { name: newFuncName.trim(), content: newFuncContent.trim() },
      ];
      setCustomFuncs(updated);
      localStorage.setItem("video-node-functions", JSON.stringify(updated));
      setNewFuncName("");
      setNewFuncContent("");
    }
  };

  const handleRemoveFunc = (index: number) => {
    const updated = customFuncs.filter((_, i) => i !== index);
    setCustomFuncs(updated);
    localStorage.setItem("video-node-functions", JSON.stringify(updated));
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
      localStorage.setItem("video-node-styles", JSON.stringify(updated));
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
      localStorage.setItem("video-node-functions", JSON.stringify(updated));
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

  const handleClearVideo = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.onChange) {
      (data.onChange as any)(id, { videoSrc: null, videoSrcs: null });
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.videoSrc) {
      const a = document.createElement("a");
      a.href = data.videoSrc as string;
      a.download = `video-${id}.mp4`;
      a.click();
    }
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

    // Video nodes often take images as style/reference input
    if (url && (type === "image" || type === "unknown" || !type)) {
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

  const handleNodeNativeDragStart = (e: React.DragEvent) => {
    if (data.videoSrc) {
      e.dataTransfer.setData("text/plain", data.videoSrc as string);
      e.dataTransfer.setData("application/x-custom-type", "video");
      e.dataTransfer.setData("application/x-source", "canvas-node");
      e.dataTransfer.effectAllowed = "copy";
    }
  };

  const displayBoxRef = useRef<HTMLDivElement>(null);
  const inputBoxRef = useRef<HTMLDivElement>(null);
  const [inputHandleStyle, setInputHandleStyle] = useState<React.CSSProperties>(
    {
      top: "150px",
      left: "0px",
    },
  );
  const [outputHandleStyle, setOutputHandleStyle] =
    useState<React.CSSProperties>({
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
  }, [isExtracted, data.videoSrc, data.ratio, id]);

  useEffect(() => {
    requestAnimationFrame(() => updateNodeInternals(id));
  }, [
    inputHandleStyle.top,
    inputHandleStyle.left,
    outputHandleStyle.top,
    id,
    updateNodeInternals,
  ]);

  const [isTextExpanded, setIsTextExpanded] = useState(false);

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
                  <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center">
                    <Edit className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-black text-lg uppercase tracking-wider">
                      编辑视频描述
                    </h3>
                    <p className="text-neutral-500 text-xs">
                      {(data.title as string) || "视频描述"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsTextExpanded(false)}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/10 transition-all border-none bg-transparent cursor-pointer"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div
                className={cn(
                  "p-8 flex-1 overflow-y-auto custom-scrollbar",
                  selected && "nodrag",
                )}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <FastTextarea
                  className={cn(
                    "w-full bg-transparent border-none text-xl text-neutral-200 placeholder:text-neutral-600 resize-none outline-none leading-relaxed min-h-[400px]",
                    selected && "nodrag",
                  )}
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
                  className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl transition-all shadow-xl shadow-blue-900/20 border-none cursor-pointer active:scale-95"
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
              className={cn(
                "flex-1 p-4 bg-[#1a1a1a] rounded-l-xl flex flex-col gap-4 border-r border-white/5 cursor-text",
                selected && "nodrag",
              )}
              onDoubleClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 p-2 px-3 bg-white/5 rounded-2xl">
                  <span className="text-[13px] font-black text-white uppercase tracking-widest leading-none">
                    {(data.title as string) || "视频提示词"}
                  </span>
                </div>
                <button
                  onClick={() => setIsTextExpanded(true)}
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center text-neutral-500 hover:text-neutral-300 hover:bg-white/5 transition-colors border-none bg-transparent cursor-pointer",
                    selected && "nodrag",
                  )}
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>

              <div className="relative flex-1 flex flex-col gap-2">
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

                <FastTextarea
                  className={cn(
                    "w-full flex-1 min-h-[150px] bg-transparent border-none p-0 text-sm text-neutral-200 placeholder:text-neutral-500 resize-none outline-none leading-relaxed custom-scrollbar",
                    selected && "nodrag",
                  )}
                  value={data.content as string}
                  onChange={(e) =>
                    data.onChange &&
                    (data.onChange as any)(id, { content: e.target.value })
                  }
                  placeholder="形容视频内容..."
                  onDoubleClick={(e) => e.stopPropagation()}
                />
              </div>

              <div
                className={cn(
                  "flex items-center justify-between pt-3",
                  selected && "nodrag",
                )}
              >
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
                        {VIDEO_MODELS.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => {
                              (data.onChange as any)(id, { modelId: m.id });
                              setModelOpen(false);
                            }}
                            className={cn(
                              "w-full text-left px-4 py-2.5 text-[11px] transition-colors border-none bg-transparent cursor-pointer",
                              data.modelId === m.id ||
                                (!data.modelId && m.id === "grok-video-3")
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
                      onClick={() => setRatioOpen(!ratioOpen)}
                      className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white transition-colors border-none bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-md cursor-pointer font-medium tracking-wide"
                    >
                      <span>{currentRatio}</span>
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
                    {ratioOpen && (
                      <div
                        className="absolute bottom-full left-0 w-[100px] mb-3 bg-[#2a2a2a] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden py-1"
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        {availableRatios.map((r) => (
                          <button
                            key={r}
                            onClick={() => {
                              (data.onChange as any)(id, { ratio: r });
                              setRatioOpen(false);
                            }}
                            className={cn(
                              "w-full text-left px-4 py-2.5 text-[11px] border-none bg-transparent cursor-pointer transition-colors",
                              currentRatio === r
                                ? "text-purple-400 bg-purple-400/10 font-bold"
                                : "text-neutral-400 hover:bg-white/5",
                            )}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <button
                      onClick={() => setResOpen(!resOpen)}
                      className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white transition-colors border-none bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-md cursor-pointer font-medium tracking-wide"
                    >
                      <span>{currentResolution}</span>
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
                    {resOpen && (
                      <div
                        className="absolute bottom-full left-0 w-[100px] mb-3 bg-[#2a2a2a] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden py-1"
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        {availableResolutions.map((r) => (
                          <button
                            key={r}
                            onClick={() => {
                              (data.onChange as any)(id, { resolution: r });
                              setResOpen(false);
                            }}
                            className={cn(
                              "w-full text-left px-4 py-2.5 text-[11px] border-none bg-transparent cursor-pointer transition-colors",
                              currentResolution === r
                                ? "text-purple-400 bg-purple-400/10 font-bold"
                                : "text-neutral-400 hover:bg-white/5",
                            )}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <button
                      onClick={() => setDurationOpen(!durationOpen)}
                      className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white transition-colors border-none bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-md cursor-pointer font-medium tracking-wide"
                    >
                      <span>{currentDuration}</span>
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
                    {durationOpen && (
                      <div
                        className="absolute bottom-full left-0 w-[100px] mb-3 bg-[#2a2a2a] border border-white/10 rounded-2xl shadow-2xl z-50 max-h-[200px] overflow-y-auto custom-scrollbar py-1"
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        {availableDurations.map((r) => (
                          <button
                            key={r}
                            onClick={() => {
                              (data.onChange as any)(id, { duration: r });
                              setDurationOpen(false);
                            }}
                            className={cn(
                              "w-full text-left px-4 py-2.5 text-[11px] border-none bg-transparent cursor-pointer transition-colors",
                              currentDuration === r
                                ? "text-purple-400 bg-purple-400/10 font-bold"
                                : "text-neutral-400 hover:bg-white/5",
                            )}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {showAudioOptions && (
                    <div className="relative">
                      <button
                        onClick={() => setAudioOpen(!audioOpen)}
                        className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white transition-colors border-none bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-md cursor-pointer font-medium tracking-wide"
                      >
                        {/* Audio Enable uses currentAudio which defaults to "关闭" or "开启" */}
                        <span>
                          {currentAudio === "开启" ? "开启音频" : "关闭音频"}
                        </span>
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
                      {audioOpen && (
                        <div
                          className="absolute bottom-full left-0 w-[100px] mb-3 bg-[#2a2a2a] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden py-1"
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          {availableAudioOptions.map((r) => (
                            <button
                              key={r}
                              onClick={() => {
                                (data.onChange as any)(id, { audioEnabled: r });
                                setAudioOpen(false);
                              }}
                              className={cn(
                                "w-full text-left px-4 py-2.5 text-[11px] border-none bg-transparent cursor-pointer transition-colors",
                                currentAudio === r
                                  ? "text-purple-400 bg-purple-400/10 font-bold"
                                  : "text-neutral-400 hover:bg-white/5",
                              )}
                            >
                              {r}
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
                    className="w-10 h-10 rounded-xl bg-red-600 hover:bg-red-500 text-white flex items-center justify-center transition-all shadow-[0_0_20px_rgba(220,38,38,0.3)] active:scale-90 border-none cursor-pointer"
                    title="停止生成"
                  >
                    <X className="w-5 h-5 stroke-[3px]" />
                  </button>
                ) : (
                  <button
                    onClick={onGenerate}
                    className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] active:scale-90 border-none cursor-pointer"
                    title="生成视频"
                  >
                    <ArrowUp className="w-5 h-5 stroke-[3px]" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Top: Video Output Area */}
          <div
            ref={displayBoxRef}
            className={cn(
              "bg-black/50 backdrop-blur-md flex flex-none items-center justify-center overflow-hidden relative group/vid cursor-pointer transition-all duration-300 shadow-sm",
              isExtracted
                ? "w-[360px] min-h-[250px] rounded-r-xl"
                : "h-[450px] rounded-xl",
              selected &&
                "ring-2 ring-white ring-offset-1 ring-offset-transparent",
            )}
            style={{
              aspectRatio: isExtracted
                ? undefined
                : (data.ratio as string)?.replace(":", "/") || "16/9",
              zIndex: 10, // Lower than handles and edges
            }}
          >
            <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-neutral-900/40 backdrop-blur-md px-2 py-0.5 rounded-full text-white/90 text-[10px] z-10 font-medium border border-white/10">
              <Video className="w-3 h-3" />
              <span>视频节点 {id.split("-").pop()}</span>
            </div>

            {data.videoSrc ? (
              <>
                <video
                  ref={videoRef}
                  src={data.videoSrc as string}
                  preload="metadata"
                  muted
                  draggable={isSpacePressed}
                  onDragStart={
                    isSpacePressed ? handleVideoDragStart : undefined
                  }
                  className={cn(
                    "w-full h-full object-contain relative z-20 cursor-grab active:cursor-grabbing",
                    !selected && !isSpacePressed && "pointer-events-none",
                    zoom < 0.2 && "hidden", // LOD Optimization: Hide video engine when zoomed out
                  )}
                  playsInline
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                />

                {zoom < 0.2 && data.videoSrc && (
                  <div className="absolute inset-0 flex items-center justify-center bg-neutral-900 z-20">
                    <Monitor className="w-12 h-12 text-neutral-700" />
                  </div>
                )}

                {/* Play/Pause Center Overlay Button */}
                <div
                  className={cn(
                    "absolute inset-0 flex items-center justify-center z-30 transition-all duration-300 pointer-events-none group-hover/vid:bg-black/20",
                    !isPlaying ? "bg-black/40" : "",
                  )}
                >
                  <button
                    onClick={togglePlay}
                    className={cn(
                      "w-14 h-14 rounded-full flex items-center justify-center border-none shadow-xl backdrop-blur-md cursor-pointer pointer-events-auto transition-all",
                      isPlaying
                        ? "bg-white/10 text-white/50 opacity-0 group-hover/vid:opacity-100 hover:bg-white/20 hover:text-white"
                        : "bg-white/20 text-white hover:bg-white/30 hover:scale-110",
                    )}
                  >
                    {isPlaying ? (
                      <Pause className="w-6 h-6" />
                    ) : (
                      <Play className="w-6 h-6 ml-1" />
                    )}
                  </button>
                </div>

                {/* Progress Bar & Volume */}
                <div
                  className={cn(
                    "absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-40 opacity-0 group-hover/vid:opacity-100 transition-opacity flex flex-col gap-2",
                    selected && "nodrag",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-white/80 font-mono tracking-wider shrink-0 select-none">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="0.1"
                      value={progress}
                      onChange={handleProgressScrub}
                      className="flex-1 h-1.5 appearance-none bg-white/20 rounded-full cursor-pointer accent-blue-500 hover:h-2 transition-all"
                      style={{ WebkitAppearance: "none" }}
                    />
                    <button
                      onClick={toggleMute}
                      className="p-1 px-2 text-white/70 hover:text-white transition-colors bg-black/40 hover:bg-black/60 rounded-lg border-none cursor-pointer flex items-center justify-center transition-all hover:scale-105"
                      title={isMuted ? "开启声音" : "静音"}
                    >
                      {isMuted ? (
                        <VolumeX className="w-4 h-4" />
                      ) : (
                        <Volume2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div
                  className={cn(
                    "absolute top-2 right-2 flex items-center gap-1.5 z-50 transition-opacity opacity-0 group-hover/vid:opacity-100",
                    selected && "nodrag",
                  )}
                >
                  {data.videoSrc && (
                    <>
                      {data.onSaveAsset && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            (data.onSaveAsset as any)(
                              data.videoSrc as string,
                              "video",
                            );
                          }}
                          className="h-7 px-2.5 bg-black/60 hover:bg-emerald-500 text-white rounded-full flex items-center gap-1.5 border-none cursor-pointer transition-colors shadow-lg"
                          title="存入资产库"
                        >
                          <BookmarkPlus className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-medium hidden sm:inline">
                            存资产
                          </span>
                        </button>
                      )}

                      <button
                        onClick={handleDownload}
                        className="w-7 h-7 bg-black/60 hover:bg-blue-500 text-white rounded-full flex items-center justify-center border-none cursor-pointer transition-colors shadow-lg"
                        title="下载"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={handleClearVideo}
                        className="w-7 h-7 bg-black/60 hover:bg-red-500 text-white rounded-full flex items-center justify-center border-none cursor-pointer transition-colors shadow-lg"
                        title="清除视频"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>

                <div
                  className={cn(
                    "absolute bottom-4 right-2 flex items-center gap-2 z-50",
                    selected && "nodrag",
                  )}
                >
                  {isExtracted && (
                    <div className="relative">
                      <button
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          setAssetOpen(assetOpen ? false : true);
                        }}
                        className="bg-black/60 hover:bg-black/80 text-white text-[10px] px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 border-none cursor-pointer h-8 shadow-lg backdrop-blur-sm"
                      >
                        <Library className="w-3.5 h-3.5" /> 替换视频
                      </button>

                      {assetOpen && (
                        <div
                          className="absolute bottom-full right-0 mb-2 w-[240px] bg-[#2a2a2a] border border-white/10 rounded-2xl shadow-2xl z-50 max-h-[300px] overflow-y-auto p-1 py-2 animate-in fade-in slide-in-from-bottom-2 duration-200 cursor-default"
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          <div className="px-3 py-2 mb-1 border-b border-white/5 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                              选择替换视频
                            </span>
                            <X
                              className="w-3 h-3 text-neutral-500 cursor-pointer hover:text-white transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAssetOpen(false);
                              }}
                            />
                          </div>
                          {allAssets.filter((a) => a.type === "video")
                            .length === 0 ? (
                            <div className="p-6 text-center text-[10px] text-neutral-500 italic">
                              资产库暂无视频...
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-2 p-2">
                              {allAssets
                                .filter((a) => a.type === "video")
                                .map((asset) => (
                                  <button
                                    key={asset.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (data.onChange) {
                                        (data.onChange as any)(id, {
                                          videoSrc: asset.url,
                                        });
                                      }
                                      setAssetOpen(false);
                                    }}
                                    className="relative aspect-video rounded-xl overflow-hidden border border-white/5 hover:border-blue-500 group/asset p-0 cursor-pointer transition-all"
                                  >
                                    <video
                                      src={asset.url}
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

                  {/* Extra bottom buttons removed as they are now at top right */}
                </div>
              </>
            ) : (
              <div className="text-blue-400/60 text-xs flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/15 flex items-center justify-center">
                  <Film className="w-6 h-6 text-blue-400" />
                </div>
                <span className="font-semibold tracking-tight">待生成视频</span>
              </div>
            )}

            {data.isGenerating && (
              <div className="absolute inset-0 bg-[#0a0a0a]/70 backdrop-blur-[2px] flex flex-col items-center justify-center gap-3 z-40">
                <div className="p-3 bg-[#1a1a1a] rounded-2xl shadow-xl border border-white/5">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
                <span className="text-xs font-bold text-neutral-300 tracking-wider uppercase">
                  视频生成中...
                </span>
                {data.genStatus && (
                  <span className="text-[10px] text-neutral-400 max-w-[80%] text-center px-4">
                    {data.genStatus as string}
                  </span>
                )}
              </div>
            )}

            {data.error && !data.isGenerating && (
              <div className="absolute inset-0 bg-red-950/80 backdrop-blur-md flex flex-col items-center justify-center gap-3 z-30 p-6 text-center rounded-2xl">
                <div className="w-12 h-12 rounded-2xl bg-red-500/20 flex items-center justify-center border border-red-500/30">
                  <X className="w-6 h-6 text-red-400" />
                </div>
                <div className="flex flex-col gap-1.5 items-center w-full max-w-[90%]">
                  <span className="text-[13px] font-bold text-red-300 tracking-wider">
                    视频生成失败
                  </span>
                  <div className="text-[11px] text-red-200/90 leading-relaxed max-h-[85px] overflow-y-auto custom-scrollbar p-2.5 bg-red-950/50 rounded-lg w-full border border-red-500/20 text-left whitespace-pre-wrap break-words">
                    {(() => {
                      const errStr = String(data.error || "");
                      if (
                        errStr.includes("timeout") ||
                        errStr.includes("超时") ||
                        errStr.includes("Aborted")
                      ) {
                        return "原因：请求或生成超时。\n建议：当前平台计算资源可能拥挤，请稍后再试或更换时间段。";
                      }
                      if (
                        errStr.includes("未解析到视频链接") ||
                        errStr.includes("未返回视频链接")
                      ) {
                        return `原因：任务成功但未获取到视频文件。\n建议：服务器回调存在延迟或文件损坏，请尝试重新生成。`;
                      }
                      if (
                        errStr.includes("40") ||
                        errStr.includes("50") ||
                        errStr.includes("API错误")
                      ) {
                        return `原因：云端接口返回异常响应。\n建议：请检查 API Key 配置，或联系该模型的平台服务提供商确认服务状态。(详细：${errStr.split("API错误:").pop()?.trim().substring(0, 60)}...)`;
                      }
                      if (
                        errStr.includes("异步任务执行失败") ||
                        errStr.includes("执行失败")
                      ) {
                        const rawErr =
                          errStr.split("执行失败: ").pop() || errStr;
                        return `原因：${rawErr}\n建议：可能是提示词含有违规词，或者是参数暂不支持。可尝试更换提示词或默认参数重试。`;
                      }
                      return `原因：${errStr}\n建议：请检查您的提示词、输入参数或网络状态，然后重试。`;
                    })()}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onGenerate) onGenerate();
                  }}
                  className="mt-1 px-5 py-2 bg-red-500/80 hover:bg-red-500 text-white text-[11px] rounded-xl font-bold transition-all border border-white/10 shadow-[0_0_15px_rgba(239,68,68,0.3)] cursor-pointer hover:shadow-[0_0_20px_rgba(239,68,68,0.5)]"
                >
                  重新生成
                </button>
              </div>
            )}
          </div>

          {/* Bottom Control Area - Inspired by ImageNode */}
          {selected &&
            !isExtracted &&
            !dragging &&
            selectedNodesCount === 1 && (
              <div
                className={cn(
                  "absolute top-full left-1/2 mt-4 p-4 bg-[#1a1a1a] rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-300 border border-white/5 ring-4 ring-black/5",
                  selected && "nodrag",
                )}
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
                      首帧/参考图
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
                      <div className="absolute top-0 right-full mr-3 w-[240px] bg-[#2a2a2a] border border-white/10 rounded-2xl shadow-2xl z-50 max-h-[300px] overflow-y-auto p-1 py-2 animate-in fade-in slide-in-from-right-2 duration-200">
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
                    <SlidersHorizontal className="w-4 h-4" />
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
                            ? "bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-900/20"
                            : "bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/20",
                        )}
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        {selectedStyle ? selectedStyle.name : "视频风格"}
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
                                  <div className="flex flex-col gap-2 p-2.5 rounded-xl border border-blue-500/30 bg-blue-500/10 mb-1 z-10 relative">
                                    <FastInput
                                      className="bg-black/20 border border-white/10 rounded-lg px-2 py-1 text-xs text-white placeholder:text-neutral-500 outline-none focus:border-blue-500/50"
                                      value={editingStyleName}
                                      onChange={(e) =>
                                        setEditingStyleName(e.target.value)
                                      }
                                      placeholder="风格名称..."
                                    />
                                    <FastTextarea
                                      className="bg-black/20 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white placeholder:text-neutral-500 outline-none focus:border-blue-500/50 resize-none h-16"
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
                                        className="text-[10px] px-2 py-1 text-white bg-blue-600 hover:bg-blue-500 rounded-md border-none cursor-pointer"
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
                                          ? "bg-blue-500/10 border-blue-500/30"
                                          : "hover:bg-white/5 border-transparent hover:border-white/10",
                                      )}
                                    >
                                      <span
                                        className={cn(
                                          "text-xs font-bold",
                                          selectedStyle?.name === s.name
                                            ? "text-blue-400"
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
                                          className="w-6 h-6 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-white transition-all flex items-center justify-center border-none cursor-pointer"
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
                              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-neutral-600 outline-none focus:border-blue-500/50 transition-colors"
                              placeholder="风格名称..."
                              value={newStyleName}
                              onChange={(e) => setNewStyleName(e.target.value)}
                            />
                            <FastTextarea
                              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-neutral-600 outline-none focus:border-blue-500/50 transition-colors resize-none h-[60px]"
                              placeholder="风格描述内容..."
                              value={newStyleContent}
                              onChange={(e) =>
                                setNewStyleContent(e.target.value)
                              }
                            />
                            <button
                              onClick={handleAddStyle}
                              className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded-lg transition-colors border-none cursor-pointer shadow-lg shadow-blue-900/20"
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
                            ? "bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-900/20"
                            : "bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border-purple-500/20",
                        )}
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        {selectedFunction
                          ? selectedFunction.name
                          : "运镜/功能库"}
                      </button>
                      {funcOpen && (
                        <div
                          className="absolute bottom-full left-0 mb-3 w-[280px] bg-[#1e1f24] border border-white/10 rounded-2xl shadow-2xl z-[70] p-4 flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200"
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-between border-b border-white/5 pb-2">
                            <div className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">
                              运镜/功能预设
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
                                  <div className="flex flex-col gap-2 p-2.5 rounded-xl border border-purple-500/30 bg-purple-500/10 mb-1 z-10 relative">
                                    <FastInput
                                      className="bg-black/20 border border-white/10 rounded-lg px-2 py-1 text-xs text-white placeholder:text-neutral-500 outline-none focus:border-purple-500/50"
                                      value={editingFuncName}
                                      onChange={(e) =>
                                        setEditingFuncName(e.target.value)
                                      }
                                      placeholder="功能名称..."
                                    />
                                    <FastTextarea
                                      className="bg-black/20 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white placeholder:text-neutral-500 outline-none focus:border-purple-500/50 resize-none h-16"
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
                                        className="text-[10px] px-2 py-1 text-white bg-purple-600 hover:bg-purple-500 rounded-md border-none cursor-pointer"
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
                                          ? "bg-purple-500/10 border-purple-500/30"
                                          : "hover:bg-white/5 border-transparent hover:border-white/10",
                                      )}
                                    >
                                      <span
                                        className={cn(
                                          "text-xs font-bold",
                                          selectedFunction?.name === f.name
                                            ? "text-purple-400"
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
                                          className="w-6 h-6 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-white transition-all flex items-center justify-center border-none cursor-pointer"
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
                              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-neutral-600 outline-none focus:border-purple-500/50 transition-colors"
                              placeholder="功能名称..."
                              value={newFuncName}
                              onChange={(e) => setNewFuncName(e.target.value)}
                            />
                            <FastTextarea
                              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-neutral-600 outline-none focus:border-purple-500/50 transition-colors resize-none h-[60px]"
                              placeholder="功能描述内容..."
                              value={newFuncContent}
                              onChange={(e) =>
                                setNewFuncContent(e.target.value)
                              }
                            />
                            <button
                              onClick={handleAddFunc}
                              className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold rounded-lg transition-colors border-none cursor-pointer shadow-lg shadow-purple-900/20"
                            >
                              保存到功能库
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <FastTextarea
                    className={cn(
                      "w-full h-[100px] bg-transparent border-none p-0 text-[15px] text-neutral-200 placeholder:text-neutral-500 resize-none outline-none leading-relaxed",
                      selected && "nodrag",
                    )}
                    value={data.content as string}
                    onChange={(e) =>
                      data.onChange &&
                      (data.onChange as any)(id, { content: e.target.value })
                    }
                    placeholder="描述视频的动效、运镜 or 场景变化..."
                    onDoubleClick={(e) => e.stopPropagation()}
                  />
                </div>

                {/* Bottom Row Controls */}
                <div
                  className={cn(
                    "flex items-center justify-between pt-3",
                    selected && "nodrag",
                  )}
                >
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
                          {VIDEO_MODELS.map((m) => (
                            <button
                              key={m.id}
                              onClick={() => {
                                (data.onChange as any)(id, { modelId: m.id });
                                setModelOpen(false);
                              }}
                              className={cn(
                                "w-full text-left px-4 py-2.5 text-[11px] transition-colors border-none bg-transparent cursor-pointer",
                                data.modelId === m.id ||
                                  (!data.modelId &&
                                    m.id === "grok-video-3")
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
                        onClick={() => setRatioOpen(!ratioOpen)}
                        className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white transition-colors border-none bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-md cursor-pointer font-medium tracking-wide"
                      >
                        <span>{currentRatio}</span>
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
                      {ratioOpen && (
                        <div
                          className="absolute bottom-full left-0 w-[100px] mb-3 bg-[#2a2a2a] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden py-1"
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          {availableRatios.map((r) => (
                            <button
                              key={r}
                              onClick={() => {
                                (data.onChange as any)(id, { ratio: r });
                                setRatioOpen(false);
                              }}
                              className={cn(
                                "w-full text-left px-4 py-2.5 text-[11px] border-none bg-transparent cursor-pointer transition-colors",
                                currentRatio === r
                                  ? "text-purple-400 bg-purple-400/10 font-bold"
                                  : "text-neutral-400 hover:bg-white/5",
                              )}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="relative">
                      <button
                        onClick={() => setResOpen(!resOpen)}
                        className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white transition-colors border-none bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-md cursor-pointer font-medium tracking-wide"
                      >
                        <span>{currentResolution}</span>
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
                      {resOpen && (
                        <div
                          className="absolute bottom-full left-0 w-[100px] mb-3 bg-[#2a2a2a] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden py-1"
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          {availableResolutions.map((r) => (
                            <button
                              key={r}
                              onClick={() => {
                                (data.onChange as any)(id, { resolution: r });
                                setResOpen(false);
                              }}
                              className={cn(
                                "w-full text-left px-4 py-2.5 text-[11px] border-none bg-transparent cursor-pointer transition-colors",
                                currentResolution === r
                                  ? "text-purple-400 bg-purple-400/10 font-bold"
                                  : "text-neutral-400 hover:bg-white/5",
                              )}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="relative">
                      <button
                        onClick={() => setDurationOpen(!durationOpen)}
                        className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white transition-colors border-none bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-md cursor-pointer font-medium tracking-wide"
                      >
                        <span>{currentDuration}</span>
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
                      {durationOpen && (
                        <div
                          className="absolute bottom-full left-0 w-[100px] mb-3 bg-[#2a2a2a] border border-white/10 rounded-2xl shadow-2xl z-50 max-h-[200px] overflow-y-auto custom-scrollbar py-1"
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          {availableDurations.map((r) => (
                            <button
                              key={r}
                              onClick={() => {
                                (data.onChange as any)(id, { duration: r });
                                setDurationOpen(false);
                              }}
                              className={cn(
                                "w-full text-left px-4 py-2.5 text-[11px] border-none bg-transparent cursor-pointer transition-colors",
                                currentDuration === r
                                  ? "text-purple-400 bg-purple-400/10 font-bold"
                                  : "text-neutral-400 hover:bg-white/5",
                              )}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {showAudioOptions && (
                      <div className="relative">
                        <button
                          onClick={() => setAudioOpen(!audioOpen)}
                          className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white transition-colors border-none bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-md cursor-pointer font-medium tracking-wide"
                        >
                          <span>
                            {currentAudio === "开启" ? "开启音频" : "关闭音频"}
                          </span>
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
                        {audioOpen && (
                          <div
                            className="absolute bottom-full left-0 w-[100px] mb-3 bg-[#2a2a2a] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden py-1"
                            onPointerDown={(e) => e.stopPropagation()}
                          >
                            {availableAudioOptions.map((r) => (
                              <button
                                key={r}
                                onClick={() => {
                                  (data.onChange as any)(id, {
                                    audioEnabled: r,
                                  });
                                  setAudioOpen(false);
                                }}
                                className={cn(
                                  "w-full text-left px-4 py-2.5 text-[11px] border-none bg-transparent cursor-pointer transition-colors",
                                  currentAudio === r
                                    ? "text-purple-400 bg-purple-400/10 font-bold"
                                    : "text-neutral-400 hover:bg-white/5",
                                )}
                              >
                                {r}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {data.isGenerating ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); if (data.onStop) { (data.onStop as any)(id); } }}
                        className="w-10 h-10 ml-2 rounded-xl bg-red-600 hover:bg-red-500 text-white flex items-center justify-center transition-all shadow-[0_0_20px_rgba(220,38,38,0.3)] active:scale-90 border-none cursor-pointer"
                        title="停止生成"
                      >
                        <X className="w-5 h-5 stroke-[3px]" />
                      </button>
                    ) : (
                      <button
                        onClick={onGenerate}
                        className="w-10 h-10 ml-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] active:scale-90 border-none cursor-pointer"
                        title="生成"
                      >
                        <ArrowUp className="w-5 h-5 stroke-[3px]" />
                      </button>
                    )}
                  </div>
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
          ratioOpen ||
          assetOpen ||
          resOpen ||
          durationOpen ||
          styleOpen ||
          funcOpen) && (
          <div
            className="fixed inset-0 z-40"
            onPointerDown={(e) => {
              e.stopPropagation();
              setModelOpen(false);
              setRatioOpen(false);
              setAssetOpen(false);
              setResOpen(false);
              setDurationOpen(false);
              setStyleOpen(false);
              setFuncOpen(false);
            }}
            onClick={(e) => {
              e.stopPropagation();
              setModelOpen(false);
              setRatioOpen(false);
              setAssetOpen(false);
              setResOpen(false);
              setDurationOpen(false);
              setStyleOpen(false);
              setFuncOpen(false);
            }}
          />
        )}
      </div>

      {isFullscreen && fullscreenVideo && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 bg-black/95 backdrop-blur-md"
          style={{ position: "fixed", top: 0, left: 0 }}
          onClick={() => setIsFullscreen(false)}
        >
          <div
            className="relative max-w-5xl w-full aspect-video rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-black"
            onClick={(e) => e.stopPropagation()}
          >
            <video
              src={fullscreenVideo}
              className="w-full h-full object-contain"
              controls
              autoPlay
            />
            <button
              className="absolute top-6 right-6 w-12 h-12 bg-white/10 hover:bg-red-500 text-white rounded-full flex items-center justify-center transition-all border-none cursor-pointer z-50 text-xl"
              onClick={(e) => {
                e.stopPropagation();
                setIsFullscreen(false);
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </>
  );
});
