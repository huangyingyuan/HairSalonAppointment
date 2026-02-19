import axios from 'axios';
import { showToast } from 'vant';

// 配置 GitHub Gist 信息
// 1. 访问 https://github.com/settings/tokens
// 2. Generate new token (classic) -> 勾选 "gist" 权限 -> 复制 Token
// 3. 访问 https://gist.github.com -> 创建一个私密 Gist -> 文件名 data.json -> 内容写 {} -> Create secret gist
// 4. 复制浏览器地址栏最后的 ID (例如: https://gist.github.com/user/【这个就是Gist ID】)

const CONFIG = {
  GIST_ID: '91c371dafe526e1de02f1ece32ed21e4', // 请填写您的 Gist ID
  GITHUB_TOKEN: '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', // 请填写您的 GitHub Personal Access Token
};

const BASE_URL = 'https://api.github.com/gists';

export const cloudStorage = {
  // 从 GitHub Gist 获取数据
  async loadData() {
    if (!CONFIG.GIST_ID || !CONFIG.GITHUB_TOKEN) {
      console.warn('请先配置 GitHub Gist ID 和 Token');
      return null;
    }

    try {
      // 添加时间戳防止缓存
      const response = await axios.get(`${BASE_URL}/${CONFIG.GIST_ID}?t=${new Date().getTime()}`, {
        headers: {
          'Authorization': `token ${CONFIG.GITHUB_TOKEN}`
        }
      });
      
      const content = response.data.files['data.json'].content;
      return JSON.parse(content);
    } catch (error) {
      console.error('同步数据失败:', error);
      // showToast('同步数据失败，请检查网络');
      return null;
    }
  },

  // 保存数据到 GitHub Gist
  async saveData(data) {
    if (!CONFIG.GIST_ID || !CONFIG.GITHUB_TOKEN) {
        return false; 
    }

    try {
      await axios.patch(`${BASE_URL}/${CONFIG.GIST_ID}`, {
        files: {
          'data.json': {
            content: JSON.stringify(data)
          }
        }
      }, {
        headers: {
          'Authorization': `token ${CONFIG.GITHUB_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      return true;
    } catch (error) {
      console.error('保存数据失败:', error);
      showToast('云端保存失败，请重试');
      return false;
    }
  }
};
