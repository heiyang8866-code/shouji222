import { Conversation, FuncType, Asset } from '../types';
import localforage from 'localforage';

localforage.config({
  name: 'fx_assets_db',
  storeName: 'assets'
});

export async function saveState(
  conversations: Record<string, Conversation>,
  currentFunc: FuncType,
  currentConvId: string | null,
  currentModelId: string,
  currentModelName: string,
  apiKeys: Record<string, string>,
  lastUsedConvByFunc: Record<string, string> = {}
) {
  try {
    // IMPROVEMENT: Directly save the object to localforage. 
    // localforage handles serialization efficiently (indexedDB or other drivers).
    // The previous JSON.parse(JSON.stringify()) was extremely slow for large Base64 blobs.
    const cleanConversations: Record<string, Conversation> = {};
    for (const [id, conv] of Object.entries(conversations)) {
      let cleanNodes = conv.nodes;
      if (conv.nodes) {
        cleanNodes = conv.nodes.map(node => {
          if (!node.data) return node;
          const cleanData: any = {};
          for (const [k, v] of Object.entries(node.data)) {
            if (typeof v !== 'function') {
              cleanData[k] = v;
            }
          }
          return { ...node, data: cleanData };
        });
      }

      let cleanEdges = conv.edges;
      if (conv.edges) {
        cleanEdges = conv.edges.map(edge => {
          if (!edge.data) return edge;
          const cleanData: any = {};
          for (const [k, v] of Object.entries(edge.data)) {
            if (typeof v !== 'function') {
              cleanData[k] = v;
            }
          }
          return { ...edge, data: cleanData };
        });
      }

      cleanConversations[id] = { 
        ...conv, 
        nodes: cleanNodes,
        edges: cleanEdges
      };
    }

    await localforage.setItem('fx_convs_db', cleanConversations);
    
    // Tiny data goes to localStorage for fast access on next page load
    localStorage.setItem('fx_func', currentFunc);
    localStorage.setItem('fx_conv', currentConvId || '');
    localStorage.setItem('fx_model_id', currentModelId);
    localStorage.setItem('fx_model_name', currentModelName);
    localStorage.setItem('fx_api_keys', JSON.stringify(apiKeys));
    localStorage.setItem('fx_last_used_conv_by_func', JSON.stringify(lastUsedConvByFunc));
  } catch (e) {
    console.error('Failed to save state', e);
  }
}

export async function loadState() {
  try {
    const conversations = await localforage.getItem<Record<string, Conversation>>('fx_convs_db') || {};
    
    const lastUsedConvRaw = localStorage.getItem('fx_last_used_conv_by_func');
    const lastUsedConvByFunc = lastUsedConvRaw ? JSON.parse(lastUsedConvRaw) : {};

    // Migration from localStorage if needed
    if (Object.keys(conversations).length === 0) {
      const c = localStorage.getItem('fx_convs');
      if (c) {
        const legacyConvs = JSON.parse(c);
        await localforage.setItem('fx_convs_db', legacyConvs);
        // localStorage.removeItem('fx_convs'); // Optional: cleanup
        return {
          conversations: legacyConvs,
          currentFunc: (localStorage.getItem('fx_func') as FuncType) || 'chat',
          currentModelId: localStorage.getItem('fx_model_id') || 'gemini-3.1-pro',
          currentModelName: localStorage.getItem('fx_model_name') || 'Gemini 3.1 Pro',
          currentConvId: (localStorage.getItem('fx_conv') || null),
          apiKey: localStorage.getItem('fx_api_key') || '',
          lastUsedConvByFunc
        };
      }
    }

    const func = (localStorage.getItem('fx_func') as FuncType) || 'chat';
    const modelId = localStorage.getItem('fx_model_id') || 'gemini-3.1-pro';
    const modelName = localStorage.getItem('fx_model_name') || 'Gemini 3.1 Pro';
    const convId = localStorage.getItem('fx_conv') || null;
    const apiKeysRaw = localStorage.getItem('fx_api_keys');
    const apiKeys = apiKeysRaw ? JSON.parse(apiKeysRaw) : {};
    const apiKeyMigration = localStorage.getItem('fx_api_key') || '';

    return {
      conversations,
      currentFunc: func,
      currentModelId: modelId,
      currentModelName: modelName,
      currentConvId: convId && conversations[convId] ? convId : null,
      apiKeys,
      apiKey: apiKeyMigration,
      lastUsedConvByFunc
    };
  } catch (e) {
    return {
      conversations: {} as Record<string, Conversation>,
      currentFunc: 'chat' as FuncType,
      currentModelId: 'gemini-3.1-pro',
      currentModelName: 'Gemini 3.1 Pro',
      currentConvId: null,
      apiKeys: {},
      apiKey: '',
      lastUsedConvByFunc: {}
    };
  }
}

export async function saveAssets(assets: Asset[]) {
  try {
    await localforage.setItem('assets_list', assets);
  } catch (e) {
    console.error('Failed to save assets', e);
  }
}

export async function loadAssets(): Promise<Asset[]> {
  try {
    const assets = await localforage.getItem<Asset[]>('assets_list');
    return assets || [];
  } catch (e) {
    console.error('Failed to load assets', e);
    return [];
  }
}
