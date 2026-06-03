/**
 * Supabase 数据库层
 * 处理所有与 Supabase 的交互，包括 CRUD 操作
 */

const DB = {
  _client: null,
  _ready: false,

  /** 初始化 Supabase 客户端 */
  init(supabaseUrl, supabaseKey) {
    if (!supabaseUrl || !supabaseKey) return false;
    // 检查 supabase 库是否加载成功
    if (typeof supabase === 'undefined' || !supabase.createClient) {
      console.error('Supabase library not loaded');
      this._ready = false;
      return false;
    }
    try {
      // 去除可能的多余空格
      const url = supabaseUrl.trim();
      const key = supabaseKey.trim();
      this._client = supabase.createClient(url, key);
      this._ready = true;
      return true;
    } catch (e) {
      console.error('Supabase init error:', e);
      this._ready = false;
      return false;
    }
  },

  get client() { return this._client; },
  get ready() { return this._ready; },

  /** 确保数据库表存在（在首次设置时调用） */
  async ensureTables() {
    try {
      const { error } = await this._client.from('baby_profiles').select('id', { count: 'exact', head: true });
      if (error && error.code !== 'PGRST116') throw error;
      return true;
    } catch (e) {
      console.error('ensureTables error:', e);
      return false;
    }
  },

  // ==================== 宝宝资料 ====================

  /** 获取宝宝资料 */
  async getBabyProfile() {
    const { data, error } = await this._client
      .from('baby_profiles')
      .select('*')
      .limit(1)
      .single();
    if (error && error.code === 'PGRST116') return null;
    if (error) throw error;
    return data;
  },

  /** 保存/更新宝宝资料 */
  async saveBabyProfile(profile) {
    const existing = await this.getBabyProfile();
    if (existing) {
      const { data, error } = await this._client
        .from('baby_profiles')
        .update({ ...profile, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await this._client
        .from('baby_profiles')
        .insert({ ...profile })
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  },

  /** 获取应用设置（从 baby_profiles.settings JSONB） */
  async getSettings() {
    if (!this._client) return {};
    try {
      const profile = await this.getBabyProfile();
      return profile?.settings || {};
    } catch (e) {
      return {};
    }
  },

  /** 合并保存应用设置 */
  async saveSettings(partial) {
    if (!this._client) return;
    const profile = await this.getBabyProfile();
    if (!profile) return;
    const current = profile.settings || {};
    const merged = { ...current, ...partial };
    await this._client
      .from('baby_profiles')
      .update({ settings: merged, updated_at: new Date().toISOString() })
      .eq('id', profile.id);
  },

  // ==================== 喂养记录 ====================

  /** 添加喂养记录 */
  async addFeeding(record) {
    const { data, error } = await this._client
      .from('feedings')
      .insert({ ...record, created_at: record.created_at || new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /** 获取今日喂养记录 */
  async getTodayFeedings() {
    if (!this._client) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data, error } = await this._client
      .from('feedings')
      .select('*')
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  /** 获取喂养记录（按日期范围） */
  async getFeedings(startDate, endDate) {
    const { data, error } = await this._client
      .from('feedings')
      .select('*')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  /** 删除喂养记录 */
  async deleteFeeding(id) {
    const { error } = await this._client.from('feedings').delete().eq('id', id);
    if (error) throw error;
  },

  // ==================== 尿布记录 ====================

  /** 添加尿布记录 */
  async addDiaper(record) {
    const { data, error } = await this._client
      .from('diapers')
      .insert({ ...record, created_at: record.created_at || new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /** 获取今日尿布记录 */
  async getTodayDiapers() {
    if (!this._client) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data, error } = await this._client
      .from('diapers')
      .select('*')
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  /** 今日是否拉屎 */
  async getTodayPoopStatus() {
    const diapers = await this.getTodayDiapers();
    const poops = diapers.filter(d => d.type === 'poop' || d.type === 'both');
    return {
      hasPooped: poops.length > 0,
      poops: poops,
      lastPoopTime: poops.length > 0 ? poops[0].created_at : null
    };
  },

  /** 删除尿布记录 */
  async deleteDiaper(id) {
    const { error } = await this._client.from('diapers').delete().eq('id', id);
    if (error) throw error;
  },

  // ==================== 生长记录 ====================

  /** 添加生长记录 */
  async addGrowth(record) {
    const { data, error } = await this._client
      .from('growth_records')
      .insert({ ...record, created_at: record.created_at || new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /** 获取所有生长记录 */
  async getGrowthRecords() {
    const { data, error } = await this._client
      .from('growth_records')
      .select('*')
      .order('record_date', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  /** 删除生长记录 */
  async deleteGrowth(id) {
    const { error } = await this._client.from('growth_records').delete().eq('id', id);
    if (error) throw error;
  },

  // ==================== 维生素记录 ====================

  /** 添加维生素记录 */
  async addVitamin(record) {
    const { data, error } = await this._client
      .from('vitamin_records')
      .insert({ ...record, created_at: record.created_at || new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /** 获取今日维生素记录 */
  async getTodayVitamin() {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await this._client
      .from('vitamin_records')
      .select('*')
      .eq('record_date', today)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  /** 获取最近 N 天维生素记录 */
  async getRecentVitamins(days = 7) {
    const start = new Date();
    start.setDate(start.getDate() - days);
    const { data, error } = await this._client
      .from('vitamin_records')
      .select('*')
      .gte('record_date', start.toISOString().split('T')[0])
      .order('record_date', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  /** 删除维生素记录 */
  async deleteVitamin(id) {
    const { error } = await this._client.from('vitamin_records').delete().eq('id', id);
    if (error) throw error;
  },

  // ==================== AI 聊天历史 ====================

  /** 保存聊天消息 */
  async saveChatMessage(role, content) {
    const { error } = await this._client
      .from('chat_history')
      .insert({ role, content, created_at: new Date().toISOString() });
    if (error) console.error('Save chat error:', error);
  },

  /** 获取最近聊天历史 */
  async getChatHistory(limit = 50) {
    const { data, error } = await this._client
      .from('chat_history')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  // ==================== 综合查询（供 AI 使用） ====================

  /** 获取指定日期范围的完整数据摘要 */
  async getDataSummary(startDate, endDate) {
    const [feedings, diapers, vitamins] = await Promise.all([
      this.getFeedings(startDate, endDate),
      this.getDiapersRange(startDate, endDate),
      this.getRecentVitamins(30)
    ]);
    return { feedings, diapers, vitamins };
  },

  /** 按日期范围查询尿布记录 */
  async getDiapersRange(startDate, endDate) {
    const { data, error } = await this._client
      .from('diapers')
      .select('*')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  /** 获取今日完整数据摘要（给 AI 用） */
  async getTodaySummary() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [feedings, diapers, vitamins, growth] = await Promise.all([
      this.getTodayFeedings(),
      this.getTodayDiapers(),
      this.getTodayVitamin(),
      this.getRecentGrowth(1)
    ]);

    const totalMilk = feedings
      .filter(f => f.amount_ml)
      .reduce((sum, f) => sum + Number(f.amount_ml), 0);

    return {
      date: today.toISOString().split('T')[0],
      feedings: feedings.map(f => ({ time: f.created_at, type: f.feeding_type, amount: f.amount_ml, side: f.side })),
      totalMilk: totalMilk,
      feedingCount: feedings.length,
      diapers: diapers.map(d => ({ time: d.created_at, type: d.type })),
      poopCount: diapers.filter(d => d.type === 'poop' || d.type === 'both').length,
      vitamins: vitamins.map(v => ({ type: v.vitamin_type, time: v.time })),
      growth: growth.length > 0 ? growth[0] : null
    };
  },

  /** 获取最近生长记录 */
  async getRecentGrowth(days = 30) {
    const start = new Date();
    start.setDate(start.getDate() - days);
    const { data, error } = await this._client
      .from('growth_records')
      .select('*')
      .gte('record_date', start.toISOString().split('T')[0])
      .order('record_date', { ascending: false });
    if (error) throw error;
    return data || [];
  }
};
