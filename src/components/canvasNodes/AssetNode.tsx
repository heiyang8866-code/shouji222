import React, { useState, useRef, useEffect, useContext, useMemo } from "react";
import { CanvasContext } from "../../lib/CanvasContext";
import { Handle, Position, NodeProps, useStore } from "@xyflow/react";
import { MagneticHandle } from "./MagneticHandle";
import {
  Plus,
  X,
  Image as ImageIcon,
  Music,
  BookmarkPlus,
  Upload,
  Film,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Download,
  GripVertical,
} from "lucide-react";
import { Asset } from "../../types";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "motion/react";

const MediaItem = React.memo(function MediaItem({
  asset,
  isOnlyMedia,
  handleImageDoubleClick,
  handleSaveToLibrary,
  handleRemoveAsset,
  selected,
  isSpacePressed,
  isSavedGlobally,
  isLowZoom,
  isDragging, // Added isDragging prop
}: any) {
  const mediaRef = useRef<HTMLMediaElement>(null);
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

  const handleTimeUpdate = () => {
    if (mediaRef.current) {
      const current = mediaRef.current.currentTime;
      const total = mediaRef.current.duration;
      setCurrentTime(current);
      const p = (current / total) * 100;
      setProgress(isNaN(p) ? 0 : p);
    }
  };

  const handleLoadedMetadata = () => {
    if (mediaRef.current) {
      setDuration(mediaRef.current.duration);
    }
  };

  const handleProgressScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (mediaRef.current) {
      const newTime = (Number(e.target.value) / 100) * mediaRef.current.duration;
      mediaRef.current.currentTime = newTime;
      setProgress(Number(e.target.value));
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (mediaRef.current) {
      mediaRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const newVolume = Number(e.target.value);
    if (mediaRef.current) {
      mediaRef.current.volume = newVolume;
      mediaRef.current.muted = newVolume === 0;
    }
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
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

  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    // Use text/plain for basic URL drop support
    e.dataTransfer.setData("text/plain", asset.url);
    // Use application/json for full metadata preservation
    e.dataTransfer.setData("application/json", JSON.stringify(asset));
    // Metadata specifically for source identification and name
    e.dataTransfer.setData("application/x-asset-name", asset.name || "");
    e.dataTransfer.setData("application/x-custom-type", asset.type);
    e.dataTransfer.setData("application/x-source", "asset-node");
    e.dataTransfer.effectAllowed = "copy";

    // Create a sensible preview ghost so it's not enlarged or distorted
    const target = e.currentTarget as HTMLElement;
    const mediaEl = target.querySelector("img, video") as HTMLElement;
    if (mediaEl) {
      const ghost = document.createElement("div");
      ghost.style.width = "160px";
      ghost.style.height = "90px";
      ghost.style.position = "fixed";
      ghost.style.top = "-1000px";
      ghost.style.left = "-1000px";
      ghost.style.zIndex = "9999";
      ghost.style.borderRadius = "8px";
      ghost.style.overflow = "hidden";
      ghost.style.border = "2px solid #3b82f6";
      ghost.style.backgroundColor = "#000";

      const clone = mediaEl.cloneNode(true) as HTMLElement;
      clone.style.width = "100%";
      clone.style.height = "100%";
      clone.style.objectFit = "cover";
      ghost.appendChild(clone);
      
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 80, 45);
      
      setTimeout(() => {
        if (ghost && ghost.parentNode) {
          document.body.removeChild(ghost);
        }
      }, 0);
    }
  };

  // If we are dragging the node, provide a simplified static view to maintain performance
  if (isDragging) {
    return (
      <div className="relative aspect-video rounded-xl overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
        {asset.type === "image" ? (
          <ImageIcon className="w-8 h-8 text-neutral-600" />
        ) : asset.type === "video" ? (
          <Film className="w-8 h-8 text-neutral-600" />
        ) : (
          <Music className="w-8 h-8 text-neutral-600" />
        )}
      </div>
    );
  }

  return (
    <motion.div
      initial={false} // Disable entry animation when dragging to save perf
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8 }}
      draggable={true}
      onDragStart={handleDragStart as any}
      className={cn(
        "relative group/asset rounded-xl overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center transition-all hover:border-white/30 shrink-0",
        isOnlyMedia ? "w-full aspect-video max-h-full mx-auto" : "aspect-video",
        isSpacePressed && "cursor-alias border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.3)]"
      )}
    >
      {asset.type === "image" ? (
        isLowZoom ? (
          <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
            <ImageIcon className="w-8 h-8 text-neutral-600" />
          </div>
        ) : (
          <img
            src={asset.url}
            alt={asset.name}
            loading="lazy"
            decoding="async"
            className={cn(
              "w-full h-full",
              isOnlyMedia ? "object-contain" : "object-cover",
            )}
            onDoubleClick={() => handleImageDoubleClick(asset.url)}
            draggable={false}
          />
        )
      ) : asset.type === "video" ? (
        <>
          {isLowZoom ? (
            <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
              <Film className="w-8 h-8 text-neutral-600" />
            </div>
          ) : (
            <>
              <video
                ref={mediaRef as any}
                src={asset.url}
                preload="metadata"
                playsInline
                muted
                className={cn(
                  "w-full h-full",
                  isOnlyMedia ? "object-contain" : "object-cover",
                )}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                draggable={false}
              />
              <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent flex flex-col gap-2 z-30 opacity-0 group-hover/asset:opacity-100 transition-opacity">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-white/80 font-mono tracking-wider shrink-0 select-none">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="0.1"
                    value={progress}
                    onChange={handleProgressScrub}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-blue-500 hover:h-2 transition-all"
                  />
                  <button
                    onClick={toggleMute}
                    className="p-1 px-2 text-white/70 hover:text-white transition-colors bg-black/40 hover:bg-black/60 rounded-lg border-none cursor-pointer flex items-center justify-center"
                    title={isMuted ? "开启声音" : "静音"}
                  >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div
                className={cn(
                  "absolute inset-0 flex items-center justify-center z-10 pointer-events-none transition-all duration-300",
                  !isPlaying ? "bg-black/40" : "",
                )}
              >
                <button
                  onClick={togglePlay}
                  className={cn(
                    "w-[60px] h-[60px] rounded-full flex items-center justify-center border-none shadow-xl backdrop-blur-md cursor-pointer pointer-events-auto transition-all",
                    isPlaying
                      ? "bg-white/10 text-white/50 opacity-0 group-hover/asset:opacity-100 hover:bg-white/20 hover:text-white"
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
            </>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center gap-3 relative w-full h-full justify-center">
          <audio
            ref={mediaRef as any}
            src={asset.url}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
          />
          <Music className="w-10 h-10 text-blue-400" />
          <span className="text-[15px] text-neutral-400 px-3 truncate w-full text-center">
            {asset.name}
          </span>
          <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/60 to-transparent flex flex-col gap-2 z-30 opacity-0 group-hover/asset:opacity-100 transition-opacity">
            <div className="flex items-center gap-2 w-full">
              <span className="text-[9px] text-white/80 font-mono tracking-wider shrink-0 select-none">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
              <input
                type="range"
                min="0"
                max="100"
                step="0.1"
                value={progress}
                onChange={handleProgressScrub}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-blue-500 hover:h-2 transition-all"
              />
              <button
                onClick={toggleMute}
                className="p-1 px-2 text-white/70 hover:text-white transition-colors bg-black/40 hover:bg-black/60 rounded-lg border-none cursor-pointer flex items-center justify-center"
                title={isMuted ? "开启声音" : "静音"}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <button
              onClick={togglePlay}
              className={cn(
                "w-[60px] h-[60px] rounded-full flex items-center justify-center border-none shadow-lg backdrop-blur-md cursor-pointer pointer-events-auto transition-all bg-black/40 text-white hover:bg-black/60",
              )}
            >
              {isPlaying ? (
                <Pause className="w-6 h-6" />
              ) : (
                <Play className="w-6 h-6 ml-1" />
              )}
            </button>
          </div>
        </div>
      )}

      {!isDragging && (
        <>
          <div className="absolute top-3 left-3 opacity-0 group-hover/asset:opacity-100 transition-opacity z-20">
            <div
              draggable={true}
              onDragStart={handleDragStart as any}
              className="w-10 h-10 bg-black/60 hover:bg-neutral-800 text-white rounded-xl flex items-center justify-center border-none cursor-grab active:cursor-grabbing shadow-lg transition-transform hover:scale-110"
              title="拖拽素材"
            >
              <GripVertical className="w-5 h-5 font-bold" />
            </div>
          </div>

          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent opacity-0 group-hover/asset:opacity-100 transition-opacity pointer-events-none" />
          <div className="absolute top-3 right-3 opacity-0 group-hover/asset:opacity-100 transition-opacity flex gap-3 z-20">
            <button
              onClick={handleDownload}
              className="w-10 h-10 bg-blue-600 hover:bg-blue-500 text-white rounded-xl flex items-center justify-center border-none cursor-pointer shadow-lg transition-transform hover:scale-110"
              title="下载"
            >
              <Download className="w-5 h-5" />
            </button>
            {!isSavedGlobally && (
              <button
                onClick={(e) =>
                  handleSaveToLibrary(e, asset.url, asset.type as any)
                }
                className="w-10 h-10 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl flex items-center justify-center border-none cursor-pointer shadow-lg transition-transform hover:scale-110"
                title="存入资产"
              >
                <BookmarkPlus className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={() => handleRemoveAsset(asset.id)}
              className="w-10 h-10 bg-black/60 hover:bg-red-500 text-white rounded-xl flex items-center justify-center border-none cursor-pointer shadow-lg transition-transform hover:scale-110"
              title="移除"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </>
      )}
    </motion.div>
  );
});

export const AssetNode = React.memo(function AssetNode({ data, id, selected, dragging }: NodeProps) {
  const zoom = useStore((s: any) => s.transform[2]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  
  // PERFORMANCE OPTIMIZATION: Staggered rendering to prevent massive layout/decoding shift
  const [visibleItemsCount, setVisibleItemsCount] = useState(0);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { assets: globalAssets, isSpacePressed } = useContext(CanvasContext);
  const localAssets = (data.localAssets || []) as Asset[];
  const allAssets = useMemo(() => [...globalAssets, ...localAssets], [globalAssets, localAssets]);
  const selectedAssetIds = (data.selectedAssetIds || []) as string[];

  const selectedAssets = useMemo(() => {
    return selectedAssetIds
      .map((assetId) => allAssets.find((a) => a.id === assetId))
      .filter(Boolean) as Asset[];
  }, [allAssets, selectedAssetIds]);

  // Effect to stagger the loading of media items
  useEffect(() => {
    if (selectedAssets.length === 0) return;
    
    let timer: NodeJS.Timeout;
    if (visibleItemsCount < selectedAssets.length) {
      // Load 2 items at a time every 60ms to avoid main thread jank
      timer = setTimeout(() => {
        setVisibleItemsCount(prev => Math.min(prev + 2, selectedAssets.length));
        if (isInitialLoad && visibleItemsCount + 2 >= selectedAssets.length) {
          setIsInitialLoad(false);
        }
      }, 60);
    }
    return () => clearTimeout(timer);
  }, [selectedAssets.length, visibleItemsCount, isInitialLoad]);

  const onChangeRef = useRef(data.onChange);
  useEffect(() => {
    onChangeRef.current = data.onChange;
  }, [data.onChange]);

  // Legacy support: Convert any selected global asset IDs to local ones
  // to prevent disappearance when global assets are deleted. This ensures the node
  // maintains its own copy of the asset record.
  useEffect(() => {
    if (!onChangeRef.current) return;
    
    let changed = false;
    let updatedLocalAssets = [...localAssets];
    const newSelectedIds = selectedAssetIds.map(sid => {
      // If it's already a local/temp ID, we keep it
      if (sid.startsWith('local-') || sid.startsWith('temp-')) return sid;
      
      // If it's a global ID, we create a local copy record
      const globalAsset = globalAssets.find(ga => ga.id === sid);
      if (globalAsset) {
        // Double check if we already have this URL in localAssets to avoid duplicates
        const existingLocal = localAssets.find(la => la.url === globalAsset.url);
        if (existingLocal) {
          changed = true;
          return existingLocal.id;
        }
        
        const localId = `local-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        updatedLocalAssets.push({ ...globalAsset, id: localId });
        changed = true;
        return localId;
      }
      return sid;
    });
    
    if (changed) {
      (onChangeRef.current as any)(id, {
        selectedAssetIds: newSelectedIds,
        localAssets: updatedLocalAssets
      });
    }
  }, [globalAssets, selectedAssetIds, localAssets, id]);

  const handleAddAsset = (assetId: string) => {
    const existingGlobal = globalAssets.find(a => a.id === assetId);
    if (!existingGlobal) return;
    
    // Create a local copy so it isn't lost if the global asset is removed
    const newLocalId = `local-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const newAsset = { ...existingGlobal, id: newLocalId };
    
    const newSelected = [...selectedAssetIds, newLocalId];
    if (data.onChange) {
      (data.onChange as any)(id, { 
        selectedAssetIds: newSelected,
        localAssets: [...localAssets, newAsset]
      });
    }
    setIsDropdownOpen(false);
  };

  const handleRemoveAsset = (assetId: string) => {
    const newSelected = selectedAssetIds.filter((id) => id !== assetId);
    if (data.onChange) {
      (data.onChange as any)(id, { selectedAssetIds: newSelected });
    }
  };

  const handleSaveToLibrary = (
    e: React.MouseEvent,
    url: string,
    type: "image" | "audio" | "video",
  ) => {
    e.stopPropagation();
    if (data.onSaveAsset) {
      (data.onSaveAsset as any)(url, type);
    }
  };

  const handleImageDoubleClick = (url: string) => {
    setFullscreenImage(url);
    setIsFullscreen(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const processFiles = (files: File[]) => {
    const validFiles = files.filter(
      (f) =>
        f.type.startsWith("image/") ||
        f.type.startsWith("audio/") ||
        f.type.startsWith("video/"),
    );
    if (validFiles.length === 0) return;

    const filePromises = validFiles.map((file) => {
      return new Promise<{ url: string; type: string; file: File }>(
        (resolve) => {
          if (file.type.startsWith("image/")) {
            // Image Compression Logic
            const reader = new FileReader();
            reader.onload = (e) => {
              const img = new Image();
              img.onload = () => {
                const canvas = document.createElement("canvas");
                // Max dimension of 1280px for node previews to save memory/state size
                const MAX_WIDTH = 1280;
                const MAX_HEIGHT = 1280;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                  if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                  }
                } else {
                  if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                  }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx?.drawImage(img, 0, 0, width, height);
                
                // Use JPEG for better compression than PNG for photos
                const compressedBase64 = canvas.toDataURL("image/jpeg", 0.75);
                resolve({
                  url: compressedBase64,
                  type: "image",
                  file
                });
              };
              img.src = e.target?.result as string;
            };
            reader.readAsDataURL(file);
          } else {
            // For audio/video, we still use base64 but these are usually larger, 
            // however the request specifically mentioned assets images lagging.
            const reader = new FileReader();
            reader.onload = (e) =>
              resolve({
                url: e.target?.result as string,
                type: file.type.startsWith("audio/") ? "audio" : "video",
                file,
              });
            reader.readAsDataURL(file);
          }
        },
      );
    });

    Promise.all(filePromises).then((results) => {
      const newAssets: Asset[] = [];
      const newIds: string[] = [];

      results.forEach((r) => {
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        newAssets.push({
          id: tempId,
          url: r.url,
          type: r.type as any,
          name: r.file.name.replace(/\.[^/.]+$/, ""),
          createdAt: Date.now(),
        });
        newIds.push(tempId);
      });

      if (data.onChange) {
        (data.onChange as any)(id, {
          localAssets: [...localAssets, ...newAssets],
          selectedAssetIds: [...selectedAssetIds, ...newIds],
        });
      }
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    // 1. Local Files
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
      return;
    }

    // 2. Data Transfer items
    const text = e.dataTransfer.getData("text/plain");
    const customType = e.dataTransfer.getData("application/x-custom-type");
    const source = e.dataTransfer.getData("application/x-source");

    if (
      text &&
      (text.startsWith("http") ||
        text.startsWith("data:") ||
        text.startsWith("blob:"))
    ) {
      // Create a local asset for it to ensure persistence even if library item is deleted
      const existingGlobalAsset = globalAssets.find((a) => a.url === text);
      const existingLocalAsset = localAssets.find((a) => a.url === text);
      
      if (existingLocalAsset) {
        if (!selectedAssetIds.includes(existingLocalAsset.id)) {
          if (data.onChange) {
            (data.onChange as any)(id, {
              selectedAssetIds: [...selectedAssetIds, existingLocalAsset.id],
            });
          }
        }
        return;
      }

      // If it was global, use its info but create a local copy
      const tempId = `local-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      let name = existingGlobalAsset ? existingGlobalAsset.name : "拖入素材";
      if (!existingGlobalAsset) {
        if (source === "canvas-node") {
          name = `画布-${customType === "image" ? "图像" : customType === "video" ? "视频" : "音频"}`;
        } else if (source === "asset-node") {
          name = "转移资产";
        }
      }

      const newAsset: Asset = {
        id: tempId,
        url: text,
        type: (customType || (existingGlobalAsset ? existingGlobalAsset.type : "image")) as any,
        name: name,
        createdAt: Date.now(),
      };

      if (data.onChange) {
        (data.onChange as any)(id, {
          localAssets: [...localAssets, newAsset],
          selectedAssetIds: [...selectedAssetIds, tempId],
        });
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
    }
  };

  return (
    <>
      <motion.div
        initial={false}
        animate={{ opacity: 1, scale: 1 }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "bg-[#1a1a1a]/90 backdrop-blur-xl rounded-2xl flex flex-col font-sans relative group transition-all duration-300 w-[810px] h-[600px] border shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
          isSpacePressed ? "p-2 nodrag cursor-default" : "cursor-grab active:cursor-grabbing",
          selected
            ? "ring-2 ring-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)] border-transparent"
            : "border-white/10 hover:border-white/20",
          isDragOver && "ring-2 ring-green-500 bg-[#2a3a2a]/90",
          dragging && "opacity-60 scale-[0.98] blur-[1px]" // Visual feedback for node drag
        )}
      >
        <div
          className={cn(
            "p-[18px] border-b-2 border-white/5 bg-white/5 text-[16px] font-black text-neutral-400 uppercase tracking-[0.2em] text-center rounded-t-2xl",
            isSpacePressed && "nodrag",
          )}
        >
          {(data.title as string) || "资产集合"}
        </div>

        <div
          className={cn(
            "p-6 flex-1 flex flex-col gap-6 overflow-hidden",
            isSpacePressed && "nodrag cursor-default",
          )}
        >
          <div
            onWheel={(e) => e.stopPropagation()}
            className={cn(
              "gap-4 overflow-y-auto custom-scrollbar pr-1.5 flex-1",
              selectedAssets.length === 1
                ? "flex flex-col h-full items-center justify-center"
                : "grid grid-cols-2 sm:grid-cols-3 auto-rows-max",
            )}
          >
            <AnimatePresence initial={false}>
              {selectedAssets.map((asset, idx) => {
                const isOnlyMedia = selectedAssets.length === 1;
                const isSavedGlobally = globalAssets.some(ga => ga.url === asset.url);
                const isLowZoom = zoom < 0.1;
                
                // PERFORMANCE: Only render content if within visible count during initial load
                // This prevents freezing the main thread by staggering image mounting
                if (idx >= visibleItemsCount && !dragging) {
                  return (
                    <div 
                      key={asset.id + "-placeholder"} 
                      className="aspect-video rounded-xl bg-white/5 animate-pulse flex items-center justify-center border border-white/10"
                    >
                      <ImageIcon className="w-5 h-5 text-neutral-800" />
                    </div>
                  );
                }

                return (
                  <MediaItem
                    key={asset.id}
                    asset={asset}
                    isOnlyMedia={isOnlyMedia}
                    handleImageDoubleClick={handleImageDoubleClick}
                    handleSaveToLibrary={handleSaveToLibrary}
                    handleRemoveAsset={handleRemoveAsset}
                    selected={selected}
                    isSpacePressed={isSpacePressed}
                    isSavedGlobally={isSavedGlobally}
                    isLowZoom={isLowZoom}
                    isDragging={dragging}
                  />
                );
              })}
            </AnimatePresence>
            {selectedAssets.length === 0 && (
              <div className="col-span-2 py-12 flex flex-col items-center justify-center gap-3 border-[3px] border-dashed border-white/5 rounded-[20px] text-neutral-500">
                <ImageIcon className="w-12 h-12 opacity-20" />
                <span className="text-base select-none">暂无资产内容</span>
              </div>
            )}
          </div>

          <div className="relative nodrag">
            <div className="flex gap-3">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex-1 py-[18px] bg-white/5 border-2 border-white/10 rounded-2xl text-[18px] font-bold text-neutral-400 hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-3 cursor-pointer shadow-inner"
              >
                <Plus className="w-6 h-6" /> 选择资产
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 py-[18px] bg-white/5 border-2 border-white/10 rounded-2xl text-[18px] font-bold text-neutral-400 hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-3 cursor-pointer shadow-inner"
              >
                <Upload className="w-6 h-6" /> 本地上传
              </button>
              <input
                type="file"
                className="hidden"
                ref={fileInputRef}
                multiple
                accept="image/*,audio/*,video/*"
                onChange={handleFileUpload}
              />
            </div>

            {isDropdownOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-3 bg-[#2a2a2a] border border-white/10 rounded-2xl shadow-2xl z-50 max-h-[380px] overflow-y-auto p-1.5 py-3 animate-in fade-in slide-in-from-bottom-2 duration-200 custom-scrollbar">
                <div className="px-4 py-2 text-[12px] font-bold text-neutral-500 uppercase tracking-widest border-b border-white/5 mb-1">
                  可用资产
                </div>
                {globalAssets.length === 0 ? (
                  <div className="p-8 text-center text-[14px] text-neutral-500 italic">
                    资产库为空...
                  </div>
                ) : (
                  globalAssets.map((asset) => {
                    const isSelected = selectedAssets.some(sa => sa.url === asset.url);
                    if (isSelected) return null;
                    return (
                      <div
                        key={asset.id}
                        onClick={() => handleAddAsset(asset.id)}
                        className="p-3 mx-1.5 rounded-xl hover:bg-white/5 cursor-pointer flex items-center gap-4 transition-colors border border-transparent hover:border-white/5"
                      >
                        <div className="w-12 h-12 rounded-xl bg-white/5 overflow-hidden flex items-center justify-center shrink-0 border border-white/10">
                          {asset.type === "image" ? (
                            <img
                              src={asset.url}
                              alt={asset.name}
                              className="w-full h-full object-cover"
                            />
                          ) : asset.type === "video" ? (
                            <video
                              src={asset.url}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Music className="w-6 h-6 text-blue-400" />
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[15px] font-bold text-neutral-200 truncate">
                            {asset.name}
                          </span>
                          <span className="text-[10px] text-neutral-500 uppercase">
                            {asset.type === "image"
                              ? "图片"
                              : asset.type === "video"
                                ? "视频"
                                : "音频"}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* Output Handle (Right) */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center justify-center z-[100]">
          <MagneticHandle type="source" position={Position.Right} id="right" />
        </div>

        {isDropdownOpen && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsDropdownOpen(false)}
          />
        )}
      </motion.div>

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
