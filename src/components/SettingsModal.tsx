import React from 'react';
import { X, Settings as SettingsIcon, ShieldCheck } from 'lucide-react';
import { FastInput } from './FastInput';
import { cn } from '../lib/utils';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKeys: Record<string, string>;
  setApiKeys: (keys: Record<string, string>) => void;
}

export function SettingsModal({ isOpen, onClose, apiKeys, setApiKeys }: SettingsModalProps) {
  if (!isOpen) return null;

  const handleKeyChange = (provider: string, value: string) => {
    setApiKeys({
      ...apiKeys,
      [provider]: value
    });
  };

  const providers = [
    { id: 'gemini', name: 'Gemini API Key', description: '用于 Gemini 3.1 Pro, 2.5 Pro 对话及剧本模型' },
    { id: 'midjourney', name: 'Midjourney API Key', description: '用于 Midjourney V7, niji7 模型' },
    { id: 'gpt-image', name: 'GPT Image API Key', description: '用于 gpt-image-2 模型' },
    { id: 'nanobanana', name: 'Nanobanana API Key', description: '用于 nanobanana2, nanobananapro 模型' },
    { id: 'video', name: 'Video API Key', description: '用于 Veo 3.1, grok3plus, Gen-2 视频生成模型' },
  ];

  return (
    <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-neutral-900 rounded-lg">
              <SettingsIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-neutral-900 leading-tight">系统设置</h3>
              <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-medium">System Settings</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 border-none bg-transparent cursor-pointer p-2 rounded-xl hover:bg-neutral-100 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="flex items-start gap-3 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-emerald-900">API 密钥管理</span>
              <p className="text-[11px] text-emerald-700 leading-relaxed">
                您的 API 密钥将仅保存在本地浏览器中，用于直接与 AI 服务提供商通信。
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-5">
            {providers.map((p) => (
              <div key={p.id} className="flex flex-col gap-2">
                <div className="flex flex-col gap-0.5">
                  <label className="text-sm font-bold text-neutral-800 flex items-center justify-between">
                    {p.name}
                    {apiKeys[p.id] && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">已配置</span>
                    )}
                  </label>
                  <p className="text-[11px] text-neutral-500">{p.description}</p>
                </div>
                <FastInput 
                  type="password"
                  value={apiKeys[p.id] || ''}
                  onChange={(e) => handleKeyChange(p.id, e.target.value)}
                  placeholder={`输入 ${p.name}...`}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:bg-white transition-all placeholder:text-neutral-300"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-5 bg-neutral-50 border-t border-neutral-100 flex justify-end">
          <button 
            onClick={onClose}
            className="px-8 py-3 text-sm font-bold text-white bg-neutral-900 rounded-2xl hover:bg-black transition-all cursor-pointer shadow-lg shadow-neutral-900/10 active:scale-95"
          >
            完成保存
          </button>
        </div>
      </div>
    </div>
  );
}
