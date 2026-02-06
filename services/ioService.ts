
/**
 * 集中化 I/O 服务
 * 
 * --- Tauri 2.0 接入指南 ---
 * 1. 确保已安装插件: 
 *    npm add @tauri-apps/plugin-store @tauri-apps/plugin-fs @tauri-apps/plugin-dialog
 *    npm run tauri add dialog
 *    npm run tauri add fs
 *    npm run tauri add store

 * 2. 在 src-tauri/capabilities/main.json 中添加权限:
 *    "permissions": [
 *      "store:allow-get", "store:allow-set", "store:allow-save",
 *      "fs:allow-write-text-file", "fs:allow-read-text-file",
 *      "dialog:allow-save", "dialog:allow-open"
 *    ]
 */
import { load } from "@tauri-apps/plugin-store";
import { save, open } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";


// --- 动态检测是否在 Tauri 环境中 ---
const IS_TAURI = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;

export const STORAGE_KEYS = {
  PROJECTS: 'prompt-splicer-projects-v2',
  TEMPLATES: 'prompt-splicer-templates-v2',
  SETTINGS: 'prompt-splicer-settings-v2',
};

export const ioService = {
  // --- 数据持久化 ---
  
  async saveToDisk(key: string, data: any): Promise<void> {
    if (IS_TAURI) {

      try {
        const store = await load("app_data.json");
        await store.set(key, data);
        await store.save();
        console.log('Tauri Save Triggered:', key);
      } catch (e) {
        console.error('Tauri Save Error:', e);
      }
    } else {
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch (e) {
        console.error(`Failed to save data for key: ${key}`, e);
      }
    }
  },

  async loadFromDisk<T>(key: string): Promise<T | null> {
    if (IS_TAURI) {

      try {
        const store = await load("app_data.json");
        const val = await store.get<T>(key);
        console.log('Tauri Load Triggered:', key);
        return val || null;
      } catch (e) {
        console.error('Tauri Load Error:', e);
        return null;
      }
    } else {
      const data = localStorage.getItem(key);
      if (data === null || data === "" || data === "undefined") return null;
      try {
        return JSON.parse(data) as T;
      } catch (e) {
        console.error(`Failed to parse data for key: ${key}. Raw data:`, data, e);
        return null;
      }
    }
  },

  // --- 文件导出 ---

  /**
   * 导出文本或 JSON 文件到用户本地
   */
  async exportFile(filename: string, content: string, mimeType: string = 'text/plain'): Promise<void> {
    if (IS_TAURI) {
      try {
        // 弹出保存对话框
        const path = await save({
          defaultPath: filename,
          filters: [{ name: 'Document', extensions: mimeType.includes('json') ? ['json'] : ['txt'] }]
        });
        // 如果用户选择了路径，则写入文件
        if (path) {
          await writeTextFile(path, content);
        }
        console.log('Tauri Export File Triggered:', filename);
      } catch (e) {
        console.error('Tauri Export Error:', e);
      }
    } else {
      // 浏览器环境下的下载实现
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  },

  // --- 文件导入 ---

  /**
   * 处理文件上传读取
   */
  async readFileAsText(file?: File): Promise<string> {
    if (IS_TAURI) {

      try {
        // 弹出打开对话框
        const path = await open({
          multiple: false,
          filters: [{ name: 'JSON Data', extensions: ['json'] }]
        });
        // 如果选择了文件，读取其文本内容
        if (path && typeof path === 'string') {
          return await readTextFile(path);
        }
        console.log('Tauri Read File Triggered');
        return "";
      } catch (e) {
        console.error('Tauri Read Error:', e);
        return "";
      }
    } else {
      if (!file) throw new Error("No file provided for browser upload");
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string || "");
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
      });
    }
  }
};
