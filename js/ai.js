/**
 * AI 聊天模块
 * 支持 OpenAI 兼容 API（可配置端点，支持 OpenAI / DeepSeek / Moonshot 等）
 */

const AI = {
  _config: null,
  _messages: [],

  /** 从 localStorage 加载（仅 apiKey） */
  loadConfigFromLocal() {
    try {
      const saved = localStorage.getItem('ai_api_key');
      if (saved) {
        this._config = { ...(this._config || {}), apiKey: saved };
        return true;
      }
    } catch (e) { /* ignore */ }
    return false;
  },

  /** 从 DB 加载（端点 + 模型），合并已加载的 apiKey */
  loadConfigFromDB(endpoint, model) {
    const apiKey = this._config?.apiKey || '';
    this._config = {
      endpoint: endpoint || 'https://api.deepseek.com/v1/chat/completions',
      apiKey: apiKey,
      model: model || 'deepseek-chat'
    };
  },

  /** 加载全部配置（兼容旧调用） */
  loadConfig() {
    this.loadConfigFromLocal();
    if (!this._config) {
      this._config = {
        endpoint: 'https://api.deepseek.com/v1/chat/completions',
        apiKey: '',
        model: 'deepseek-chat'
      };
    }
  },

  /** 保存 apiKey 到 localStorage（仅此一项，不放数据库） */
  saveApiKey(apiKey) {
    localStorage.setItem('ai_api_key', apiKey);
    this._config = { ...(this._config || {}), apiKey };
  },

  /** 保存端点 + 模型到数据库 */
  async saveEndpointAndModel(endpoint, model) {
    if (DB.ready) {
      await DB.saveSettings({
        ai_endpoint: endpoint,
        ai_model: model
      });
    }
    this._config = {
      ...(this._config || {}),
      endpoint: endpoint || this._config?.endpoint || 'https://api.deepseek.com/v1/chat/completions',
      model: model || this._config?.model || 'deepseek-chat'
    };
  },

  get config() { return this._config; },
  get configured() { return !!(this._config?.endpoint && this._config?.apiKey); },

  /** 初始化系统提示词 */
  _buildSystemPrompt(babyInfo) {
    const name = babyInfo?.name || '宝宝';
    const birth = babyInfo?.birth_date || '';
    const birthText = birth ? `，出生于${birth}` : '';

    return `你是"小马哥哥"，一个专门帮助家长记录和了解宝宝情况的 AI 助手。

## 核心规则（必须遵守）
1. 你当前正在帮助一位家长管理宝宝 "${name}"${birthText} 的喂养记录。
2. 系统已经自动查询了数据库中的真实数据，放在你接下来会看到的消息中。
3. **回答任何关于宝宝情况的问题时，必须先仔细阅读数据，然后用这些真实数据来回答。**
4. 回答格式：先列出数据，再给出你的观察或建议。

## 回答规范
- 用中文回答，语气温暖亲切，像个有经验的大哥哥
- 给出建议时注明"仅供参考，不是医疗诊断"
- 涉及紧急医疗问题，提醒及时就医
- 回答简洁有重点，不要太啰嗦`;
  },

  /** 获取数据库上下文（自动注入到对话中） */
  async _getDataContext(query) {
    try {
      if (!DB.ready) return null;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // 查询今日 + 最近 7 天数据
      const start7d = new Date(today);
      start7d.setDate(start7d.getDate() - 7);

      const [baby, feedings, diapers, vitamins, growth] = await Promise.all([
        DB.getBabyProfile(),
        DB.getFeedings(start7d.toISOString(), new Date().toISOString()),
        DB.getDiapersRange(start7d.toISOString(), new Date().toISOString()),
        DB.getRecentVitamins(7),
        DB.getGrowthRecords()
      ]);

      // ===== 按日汇总喂养数据 =====
      const dailyMilk = {};
      const todayFeedings = [];
      const todayStr = today.toISOString().split('T')[0];

      feedings.forEach(f => {
        const day = f.created_at.split('T')[0];
        if (!dailyMilk[day]) dailyMilk[day] = { total: 0, count: 0, details: [] };
        if (f.amount_ml) dailyMilk[day].total += Number(f.amount_ml);
        dailyMilk[day].count++;
        const t = new Date(f.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        const typeMap = { breastfeeding: '母乳', formula: '配方奶', pumped_milk: '挤奶', solid_food: '辅食' };
        const detail = `${t} ${typeMap[f.feeding_type] || f.feeding_type} ${f.amount_ml || 0}ml`;
        dailyMilk[day].details.push(detail);
        if (day === todayStr) todayFeedings.push(detail);
      });

      // ===== 今日尿布 =====
      const todayDiapers = diapers.filter(d => d.created_at >= todayStr);
      const poopCount = diapers.filter(d => (d.type === 'poop' || d.type === 'both')).length;

      // ===== 今日维生素 =====
      const todayVits = vitamins.filter(v => v.record_date === todayStr);

      // ===== 构建数据文本 =====
      let text = `【📊 数据库实时数据 - 请基于此回答】\n\n`;

      if (baby) {
        text += `👶 宝宝：${baby.name}`;
        if (baby.birth_date) {
          const d = Math.floor((Date.now() - new Date(baby.birth_date)) / 86400000);
          text += `，约${Math.floor(d/30)}个月${d%30}天大`;
        }
        text += '\n\n';
      }

      // 最近7天奶量汇总表
      text += `📅 最近7天每日总奶量：\n`;
      const sortedDays = Object.keys(dailyMilk).sort().slice(-7);
      sortedDays.forEach(day => {
        const d = dailyMilk[day];
        text += `  ${day.slice(5)} → ${d.total}ml（${d.count}次）`;
        if (day === todayStr) text += ' ⬅ 今天';
        text += '\n';
      });
      const weekTotal = sortedDays.reduce((s, d) => s + dailyMilk[d].total, 0);
      text += `  7天总计：${weekTotal}ml\n\n`;

      // 今日详细
      const todayTotal = dailyMilk[todayStr]?.total || 0;
      const todayCount = dailyMilk[todayStr]?.count || 0;
      text += `🍼 今日喂养：${todayTotal}ml（${todayCount}次）\n`;
      if (todayFeedings.length > 0) {
        text += `  时间明细：${todayFeedings.slice(-8).join('、')}\n`;
      } else {
        text += `  今天还没有喂养记录\n`;
      }

      // 今日尿布
      text += `\n🩲 今日尿布：共${todayDiapers.length}次（近7天共${poopCount}次便便）\n`;
      if (todayDiapers.length > 0) {
        const tp = { pee: '尿尿', poop: '💩便便', both: '尿+便' };
        text += `  明细：${todayDiapers.map(d => `${new Date(d.created_at).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})} ${tp[d.type]||d.type}`).join('、')}\n`;
      }

      // 今日维生素
      text += `\n💊 今日维生素：`;
      if (todayVits.length > 0) {
        text += todayVits.map(v => v.vitamin_type).join('、') + ' ✅';
      } else {
        const suggest = new Date().getDate() % 2 === 0 ? 'D3' : 'AD';
        text += `还没吃（今天建议吃${suggest}）`;
      }

      // 身高体重
      if (growth.length > 0) {
        const latest = growth[0];
        text += `\n\n📏 最新生长记录（${latest.record_date}）：`;
        if (latest.weight_kg) text += ` 体重${latest.weight_kg}kg`;
        if (latest.height_cm) text += ` 身高${latest.height_cm}cm`;
      }

      text += `\n\n⚠️ 以上是数据库中的真实数据，请务必用这些数据来回答用户的问题。`;

      return text;
    } catch (e) {
      console.error('Get data context error:', e);
      return null;
    }
  },

  /** 发送消息到 AI */
  async sendMessage(userMessage) {
    if (!this.configured) {
      throw new Error('AI 未配置，请先在设置中配置 AI 服务');
    }

    const babyInfo = await DB.getBabyProfile().catch(() => null);
    const systemPrompt = this._buildSystemPrompt(babyInfo);
    const dataContext = await this._getDataContext(userMessage);

    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    if (dataContext) {
      messages.push({ role: 'user', content: dataContext });
      messages.push({ role: 'assistant', content: '好的，我已读取这些数据。用户有什么问题？' });
    }

    // 最近历史（最多10轮）
    const recentHistory = this._messages.slice(-20);
    recentHistory.forEach(m => messages.push(m));

    messages.push({ role: 'user', content: userMessage });

    const response = await this._callAPI(messages);

    this._messages.push({ role: 'user', content: userMessage });
    this._messages.push({ role: 'assistant', content: response });

    try {
      await DB.saveChatMessage('user', userMessage);
      await DB.saveChatMessage('assistant', response);
    } catch (e) { /* silent */ }

    return response;
  },

  /** 调用 OpenAI 兼容 API */
  async _callAPI(messages) {
    const { endpoint, apiKey, model } = this._config;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages: messages,
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`API 请求失败 (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '抱歉，我没有理解你的问题，能再问一遍吗？';
  },

  /** 清空当前会话历史 */
  clearHistory() {
    this._messages = [];
  },

  /** 加载历史消息 */
  async loadHistory() {
    try {
      const history = await DB.getChatHistory(50);
      this._messages = history.map(m => ({ role: m.role, content: m.content }));
      return history;
    } catch (e) {
      return [];
    }
  }
};
