/**
 * 宝宝成长记录 - 主应用
 * 包含：配置管理、SPA 路由、所有页面视图
 */
const App = {
  _config: {},
  _currentPage: 'dashboard',

  // ==================== 初始化 ====================
  async init() {
    // 0. 立刻显示界面（不等待任何网络请求）
    document.getElementById('splash').classList.add('hidden');
    document.getElementById('setup-warning').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    this._updateHeader(null);
    window.addEventListener('hashchange', () => this._handleRoute());
    this._handleRoute();

    // 1. 加载配置
    this._config = this._loadConfig();
    AI.loadConfig();

    // 2. 后台初始化数据库（不阻塞界面）
    const supabaseUrl = 'https://rdytpgdvkvudbefkryjt.supabase.co';
    const supabaseKey = 'sb_publishable_oSjOOayNgorP2dJ21zdRvg_2_NDkxK8';
    DB.init(supabaseUrl, supabaseKey);

    // 3. 后台连接数据库，更新头部
    if (DB.ready) {
      try {
        const profile = await Promise.race([
          DB.getBabyProfile(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
        ]);
        this._updateHeader(profile);
      } catch (e) {
        // 连接失败不影响使用，页面已经可见
        console.log('DB connect delayed:', e.message);
      }
    }
  },

  _loadConfig() {
    try {
      const saved = localStorage.getItem('app_config');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  },

  _saveConfig() {
    localStorage.setItem('app_config', JSON.stringify(this._config));
  },

  getConfig(key) { return this._config[key]; },
  setConfig(key, value) {
    this._config[key] = value;
    this._saveConfig();
  },

  _showSetupWarning() {
    document.getElementById('splash').classList.add('hidden');
    document.getElementById('setup-warning').style.display = 'flex';
  },

  _startApp(profile) {
    document.getElementById('setup-warning').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    this._updateHeader(profile);
    window.addEventListener('hashchange', () => this._handleRoute());
    this._handleRoute();
  },

  _updateHeader(profile) {
    const nameEl = document.getElementById('headerBabyName');
    const dateEl = document.getElementById('headerDate');
    if (nameEl) {
      nameEl.textContent = profile?.name || '宝宝';
    }
    if (dateEl) {
      const now = new Date();
      dateEl.textContent = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
    }
  },

  // ==================== 路由 ====================
  _handleRoute() {
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    this.navigate(hash);
  },

  navigate(page) {
    // 确保 app 界面可见
    if (document.getElementById('app').style.display !== 'flex') {
      document.getElementById('setup-warning').style.display = 'none';
      document.getElementById('app').style.display = 'flex';
    }
    this._currentPage = page;
    window.location.hash = page;

    // 更新导航栏高亮
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === page);
    });

    // 渲染对应页面
    const container = document.getElementById('appContent');
    switch (page) {
      case 'dashboard': this._renderDashboard(container); break;
      case 'records': this._renderRecords(container); break;
      case 'chat': this._renderChat(container); break;
      case 'history': this._renderHistory(container); break;
      case 'settings': this._renderSettings(container); break;
      default: this._renderDashboard(container);
    }
  },

  // ==================== 工具函数（显式 UTC+8） ====================

  /** 获取当前北京时间对象 {y,m,d,h,min} */
  _beijingNow() {
    const d = new Date();
    // 本地时间就是北京时间（用户在中国）
    return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate(), h: d.getHours(), min: d.getMinutes() };
  },

  /** 显示北京时间 HH:MM */
  _formatTime(isoStr) {
    if (!isoStr) return '';
    // 直接从 ISO 字符串提取 UTC 时间，+8
    const m = isoStr.match(/T(\d{2}):(\d{2})/);
    if (!m) return '';
    const h = (parseInt(m[1]) + 8) % 24;
    return `${String(h).padStart(2, '0')}:${m[2]}`;
  },

  /** 显示北京日期 */
  _formatDate(isoStr) {
    if (!isoStr) return '';
    const m = isoStr.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):/);
    if (!m) return '';
    // UTC 日期 + 考虑 UTC 小时 +8 可能跨天
    const utcH = parseInt(m[4]);
    const d = new Date(Date.UTC(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]), utcH + 8));
    return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
  },

  /** 今天北京日期 YYYY-MM-DD */
  _getToday() {
    const bj = this._beijingNow();
    return `${bj.y}-${String(bj.m).padStart(2, '0')}-${String(bj.d).padStart(2, '0')}`;
  },

  /** 返回北京时间 HH:MM */
  _getBeijingTime() {
    const bj = this._beijingNow();
    return `${String(bj.h).padStart(2, '0')}:${String(bj.min).padStart(2, '0')}`;
  },

  /** 北京时间 HH:MM → UTC ISO 字符串（直接构造，无时区计算） */
  _bjToISO(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    const bj = this._beijingNow();
    // 构造 UTC ISO: 北京时间 HH:MM = UTC (HH-8):MM
    const utcH = h - 8;
    if (utcH >= 0) {
      return `${bj.y}-${String(bj.m).padStart(2, '0')}-${String(bj.d).padStart(2, '0')}T${String(utcH).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`;
    } else {
      // 跨天：前一天
      const prev = new Date(bj.y, bj.m - 1, bj.d - 1);
      const py = prev.getFullYear();
      const pm = String(prev.getMonth() + 1).padStart(2, '0');
      const pd = String(prev.getDate()).padStart(2, '0');
      const ph = String(utcH + 24).padStart(2, '0');
      return `${py}-${pm}-${pd}T${ph}:${String(m).padStart(2, '0')}:00.000Z`;
    }
  },

  _showConfirm(title, message, onConfirm) {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-dialog">
        <h3>${title}</h3>
        <p>${message}</p>
        <div class="form-actions">
          <button class="btn btn-secondary btn-block" onclick="this.closest('.confirm-overlay').remove()">取消</button>
          <button class="btn btn-primary btn-block" id="confirmOk">确定</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('confirmOk').onclick = () => {
      overlay.remove();
      onConfirm();
    };
  },

  _showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed; top: 60px; left: 50%; transform: translateX(-50%);
      background: #2D3436; color: #FFF; padding: 10px 20px;
      border-radius: 12px; font-size: 14px; z-index: 999;
      opacity: 0; transition: opacity 0.3s;
      max-width: 320px; text-align: center;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => { toast.style.opacity = '1'; });
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  },

  // ==================== 首页仪表盘 ====================
  async _renderDashboard(container) {
    container.innerHTML = '<div class="text-center mt-16"><div class="spinner"></div><p class="text-muted mt-8">加载中...</p></div>';

    try {
      const [todayFeedings, poopStatus, todayVitamins, baby] = await Promise.all([
        DB.getTodayFeedings(),
        DB.getTodayPoopStatus(),
        DB.getTodayVitamin(),
        DB.getBabyProfile()
      ]);

      // 计算总奶量
      const totalMilk = todayFeedings
        .filter(f => f.amount_ml)
        .reduce((s, f) => s + Number(f.amount_ml), 0);
      const feedingCount = todayFeedings.length;

      // 拉屎状态
      const poopText = poopStatus.hasPooped ? '已拉💩' : '还没拉';
      const poopStatusClass = poopStatus.hasPooped ? 'status-ok' : 'status-warn';
      const poopTime = poopStatus.lastPoopTime ? this._formatTime(poopStatus.lastPoopTime) : '';

      // 维生素状态
      const vitaminTaken = todayVitamins.length > 0;
      const lastVitaminType = vitaminTaken ? todayVitamins[0].vitamin_type : null;

      // 建议的维生素（AD/D3 交替逻辑）
      const suggestVitamin = await this._getSuggestedVitamin();

      container.innerHTML = `
        <div class="dashboard-grid">
          <!-- 奶量 -->
          <div class="stat-card full">
            <div class="stat-icon">🍼</div>
            <div class="stat-label">今日奶量</div>
            <div class="stat-value">${totalMilk}<span style="font-size:16px;color:#B2BEC3"> ml</span></div>
            <div class="stat-sub">共 ${feedingCount} 次</div>
          </div>

          <!-- 拉屎 -->
          <div class="stat-card">
            <div class="stat-icon">🩲</div>
            <div class="stat-label">拉屎状态</div>
            <div class="stat-value ${poopStatusClass}">${poopText}</div>
            <div class="stat-sub">${poopTime ? '最近: ' + poopTime : ''}</div>
          </div>

          <!-- 维生素 -->
          <div class="stat-card">
            <div class="stat-icon">💊</div>
            <div class="stat-label">维生素</div>
            <div class="stat-value">
              ${vitaminTaken
                ? `<span class="vitamin-pill vitamin-${lastVitaminType === 'AD' ? 'ad' : 'd3'}">${lastVitaminType} ✓</span>`
                : `<span style="color:#D63031">未吃</span>`
              }
            </div>
            <div class="stat-sub">建议: ${suggestVitamin}</div>
          </div>

          <!-- 快速操作 -->
          <div class="stat-card full">
            <div class="stat-label">📝 快速记录</div>
            <div class="quick-actions">
              <button class="btn btn-secondary" onclick="App._quickFeeding()">🍼喝奶</button>
              <button class="btn btn-secondary" onclick="App._quickDiaper('poop')">💩拉屎</button>
              <button class="btn btn-secondary" onclick="App._quickVitamin()">💊维生素</button>
            </div>
          </div>

          <!-- 最近喂养记录 -->
          <div class="stat-card full">
            <div class="card-title">📋 今日记录</div>
            <div id="todayFeedingsList">
              ${todayFeedings.length === 0 ? '<p class="text-muted">暂无记录，点击上方按钮快速添加</p>' : ''}
              ${todayFeedings.slice(0, 5).map(f => `
                <div class="record-item">
                  <div class="record-item-icon">🍼</div>
                  <div class="record-item-info">
                    <div class="record-item-title">${f.feeding_type === 'breastfeeding' ? '母乳' : f.feeding_type === 'formula' ? '配方奶' : f.feeding_type === 'pumped_milk' ? '挤奶' : '辅食'} ${f.amount_ml ? f.amount_ml + 'ml' : ''}</div>
                    <div class="record-item-meta">${this._formatTime(f.created_at)}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    } catch (e) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <p>数据加载失败</p>
          <p class="text-muted mt-8">${e.message}</p>
          <button class="btn btn-primary mt-16" onclick="App._renderDashboard(document.getElementById('appContent'))">重试</button>
        </div>
      `;
    }
  },

  /** 获取建议服用的维生素（偶数日D3，奇数日AD） */
  async _getSuggestedVitamin() {
    try {
      const recent = await DB.getRecentVitamins(14);
      const last = recent[0];
      if (!last) return this._suggestVitaminType();
      return last.vitamin_type === 'AD' ? 'D3' : 'AD';
    } catch (e) {
      return this._suggestVitaminType();
    }
  },

  /** 根据起始基准日计算今天该吃哪种维生素（每天交替轮换） */
  _suggestVitaminType() {
    // 基准日：2026-06-02 = D3（使用本地时间）
    const baseDate = new Date(2026, 5, 2); // month 0-index: June=5
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today - baseDate) / (1000 * 60 * 60 * 24));
    return diffDays % 2 === 0 ? 'D3' : 'AD';
  },

  /** 快速记录：喝奶 */
  async _quickFeeding() {
    try {
      // 弹出一个简单的输入窗口
      const overlay = document.createElement('div');
      overlay.className = 'confirm-overlay';
      overlay.innerHTML = `
        <div class="confirm-dialog" style="text-align:left">
          <h3 style="text-align:center">🍼 快速记喝奶</h3>
          <div class="form-group mt-16">
            <label>类型</label>
            <div class="btn-group" id="quickFeedType">
              <button class="btn-option" data-value="breastfeeding">母乳</button>
              <button class="btn-option selected" data-value="formula">配方奶</button>
              <button class="btn-option" data-value="pumped_milk">挤奶</button>
            </div>
          </div>
          <div class="form-group">
            <label>时间</label>
            <input type="time" id="quickFeedTime" value="${new Date().toTimeString().slice(0, 5)}">
          </div>
          <div class="form-group">
            <label>奶量 (ml)</label>
            <input type="number" id="quickFeedAmount" placeholder="留空则不计量" min="0">
          </div>
          <div class="form-group" id="feedSideGroup">
            <label>吃奶侧</label>
            <div class="btn-group" id="quickFeedSide">
              <button class="btn-option selected" data-value="left">左侧</button>
              <button class="btn-option" data-value="right">右侧</button>
              <button class="btn-option" data-value="both">双侧</button>
              <button class="btn-option" data-value="">不记录</button>
            </div>
          </div>
          <div class="form-actions">
            <button class="btn btn-secondary btn-block" onclick="this.closest('.confirm-overlay').remove()">取消</button>
            <button class="btn btn-primary btn-block" id="quickFeedOk">记录</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      // 按钮选择交互
      overlay.querySelectorAll('.btn-option').forEach(btn => {
        btn.onclick = () => {
          btn.parentElement.querySelectorAll('.btn-option').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
        };
      });

      // 显示/隐藏侧边选择（只有母乳才显示）
      // 默认配方奶 -> 隐藏侧边
      document.getElementById('feedSideGroup').style.display = 'none';
      document.getElementById('quickFeedType').querySelectorAll('.btn-option').forEach(btn => {
        btn.onclick = () => {
          const isBreast = btn.dataset.value === 'breastfeeding';
          document.getElementById('feedSideGroup').style.display = isBreast ? 'block' : 'none';
        };
      });

      document.getElementById('quickFeedOk').onclick = async () => {
        const type = overlay.querySelector('#quickFeedType .selected')?.dataset?.value || 'formula';
        const feedTime = document.getElementById('quickFeedTime').value;
        const amount = document.getElementById('quickFeedAmount').value;
        const sideEl = overlay.querySelector('#quickFeedSide .selected');
        const side = type === 'breastfeeding' ? (sideEl?.dataset?.value || '') : '';

        await DB.addFeeding({
          feeding_type: type,
          feed_time: feedTime || null,
          amount_ml: amount ? Number(amount) : null,
          side: side || null,
          created_by: localStorage.getItem('user_name') || '家长'
        });
        overlay.remove();
        this._showToast('✅ 喂养记录已保存');
        this._renderDashboard(document.getElementById('appContent'));
      };
    } catch (e) {
      this._showToast('❌ 记录失败: ' + e.message);
    }
  },

  /** 快速记录：拉屎（弹窗选时间） */
  _quickDiaperPopup(type) {
    const label = type === 'poop' ? '拉屎' : type === 'pee' ? '尿尿' : '大小便';
    const emoji = type === 'poop' ? '💩' : type === 'pee' ? '💦' : '💩💦';
    const now = this._getBeijingTime();
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-dialog" style="text-align:left">
        <h3 style="text-align:center">${emoji} 记录${label}</h3>
        <div class="form-group mt-16">
          <label>时间</label>
          <input type="time" id="quickDiaperTime" value="${now}">
        </div>
        <div class="form-actions">
          <button class="btn btn-secondary btn-block" onclick="this.closest('.confirm-overlay').remove()">取消</button>
          <button class="btn btn-primary btn-block" id="quickDiaperOkBtn">确认</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('quickDiaperOkBtn').onclick = async () => {
      const timeVal = document.getElementById('quickDiaperTime').value || now;
      await DB.addDiaper({
        type: type,
        created_at: this._bjToISO(timeVal),
        created_by: localStorage.getItem('user_name') || '家长'
      });
      overlay.remove();
      this._showToast(`✅ ${label}已记录 ${timeVal}`);
      this._renderDashboard(document.getElementById('appContent'));
    };
  },

  /** 快速记录：拉屎（旧版兼容，改为弹窗） */
  async _quickDiaper(type) {
    this._quickDiaperPopup(type);
  },

  /** 快速记录：维生素 */
  async _quickVitamin() {
    try {
      const vtype = this._suggestVitaminType();
      const day = new Date().getDate();
      const overlay = document.createElement('div');
      overlay.className = 'confirm-overlay';
      overlay.innerHTML = `
        <div class="confirm-dialog" style="text-align:left">
          <h3 style="text-align:center">💊 维生素记录</h3>
          <div class="form-group mt-16" style="text-align:center">
            <p style="font-size:15px;margin-bottom:10px">今天要吃的：</p>
            <span class="vitamin-pill vitamin-${vtype === 'AD' ? 'ad' : 'd3'}" style="font-size:20px;padding:8px 24px">🧴 维生素 ${vtype}</span>
            <p style="font-size:12px;color:#B2BEC3;margin-top:8px">（${day}日 → ${vtype}）</p>
          </div>
          <div class="form-actions">
            <button class="btn btn-secondary btn-block" onclick="this.closest('.confirm-overlay').remove()">取消</button>
            <button class="btn btn-success btn-block" id="quickVOk">已吃 ✓</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      document.getElementById('quickVOk').onclick = async () => {
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        await DB.addVitamin({
          record_date: this._getToday(),
          vitamin_type: vtype,
          taken: true,
          time: timeStr
        });
        overlay.remove();
        this._showToast(`✅ ${vtype} 已记录`);
        this._renderDashboard(document.getElementById('appContent'));
      };
    } catch (e) {
      this._showToast('❌ 记录失败: ' + e.message);
    }
  },

  // ==================== 记录页面 ====================
  _renderRecords(container) {
    let activeTab = 'feeding';

    const renderForm = () => {
      container.innerHTML = `
        <div class="record-tabs">
          <button class="record-tab ${activeTab === 'feeding' ? 'active' : ''}" data-tab="feeding">🍼 喂养</button>
          <button class="record-tab ${activeTab === 'diaper' ? 'active' : ''}" data-tab="diaper">🩲 尿布</button>
          <button class="record-tab ${activeTab === 'growth' ? 'active' : ''}" data-tab="growth">📏 生长</button>
          <button class="record-tab ${activeTab === 'vitamin' ? 'active' : ''}" data-tab="vitamin">💊 维生素</button>
        </div>

        <!-- 喂养表单 -->
        <div class="record-form ${activeTab === 'feeding' ? 'active' : ''}" id="formFeeding">
          <div class="card">
            <div class="form-group">
              <label>喂养方式</label>
              <select id="feedingType">
                <option value="formula">🥛 配方奶</option>
                <option value="breastfeeding">🍼 母乳</option>
                <option value="pumped_milk">🧴 挤奶</option>
                <option value="solid_food">🥣 辅食</option>
              </select>
            </div>
            <div class="form-group">
              <label>喂养时间</label>
              <input type="time" id="feedingTime" value="${new Date().toTimeString().slice(0, 5)}">
            </div>
            <div class="form-group" id="feedingAmountGroup">
              <label>奶量 (ml)</label>
              <input type="number" id="feedingAmount" placeholder="输入奶量" min="0">
            </div>
            <div class="form-group" id="feedingSideGroup" style="display:none">
              <label>吃奶侧</label>
              <div class="btn-group">
                <button class="btn-option" data-value="left">左侧</button>
                <button class="btn-option" data-value="right">右侧</button>
                <button class="btn-option selected" data-value="both">双侧</button>
              </div>
            </div>
            <div class="form-group">
              <label>备注</label>
              <input type="text" id="feedingNotes" placeholder="可选备注">
            </div>
            <button class="btn btn-primary btn-block" onclick="App._submitFeeding()">✅ 保存记录</button>
          </div>
        </div>

        <!-- 尿布表单 -->
        <div class="record-form ${activeTab === 'diaper' ? 'active' : ''}" id="formDiaper">
          <div class="card">
            <div class="form-group">
              <label>类型</label>
              <div class="btn-group" id="diaperType">
                <button class="btn-option selected" data-value="poop">💩 便便</button>
                <button class="btn-option" data-value="pee">💦 尿尿</button>
                <button class="btn-option" data-value="both">💩💦 都有</button>
              </div>
            </div>
            <div class="form-group" id="poopColorGroup">
              <label>便便颜色</label>
              <div class="btn-group" id="poopColor">
                <button class="btn-option selected" data-value="yellow">🟡 黄色</button>
                <button class="btn-option" data-value="green">🟢 绿色</button>
                <button class="btn-option" data-value="brown">🟤 棕色</button>
                <button class="btn-option" data-value="other">⚪ 其他</button>
              </div>
            </div>
            <div class="form-group">
              <label>备注</label>
              <input type="text" id="diaperNotes" placeholder="可选备注">
            </div>
            <button class="btn btn-primary btn-block" onclick="App._submitDiaper()">✅ 保存记录</button>
          </div>
          <div class="card mt-8">
            <div class="card-title">⚡ 快捷录入</div>
            <div class="quick-preset">
              <button class="btn" onclick="App._quickDiaperRef('poop')">💩</button>
              <button class="btn" onclick="App._quickDiaperRef('pee')">💦</button>
              <button class="btn" onclick="App._quickDiaperRef('both')">💩💦</button>
            </div>
          </div>
        </div>

        <!-- 生长记录表单 -->
        <div class="record-form ${activeTab === 'growth' ? 'active' : ''}" id="formGrowth">
          <div class="card">
            <div class="form-group">
              <label>记录日期</label>
              <input type="date" id="growthDate" value="${this._getToday()}">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>体重 (kg)</label>
                <input type="number" id="growthWeight" placeholder="例如 7.5" step="0.01" min="0">
              </div>
              <div class="form-group">
                <label>身高 (cm)</label>
                <input type="number" id="growthHeight" placeholder="例如 65" step="0.1" min="0">
              </div>
            </div>
            <div class="form-group">
              <label>备注</label>
              <input type="text" id="growthNotes" placeholder="可选备注">
            </div>
            <button class="btn btn-primary btn-block" onclick="App._submitGrowth()">✅ 保存记录</button>
          </div>
        </div>

        <!-- 维生素表单 -->
        <div class="record-form ${activeTab === 'vitamin' ? 'active' : ''}" id="formVitamin">
          <div class="card">
            <div class="form-group">
              <label>今天要吃的维生素（自动计算）</label>
              <div style="display:flex;align-items:center;gap:12px;margin-top:4px">
                <span class="vitamin-pill vitamin-${App._suggestVitaminType()}">🧴 维生素 ${App._suggestVitaminType()}</span>
                <span style="font-size:12px;color:#B2BEC3">（${new Date().getDate()}日 → ${App._suggestVitaminType()}）</span>
              </div>
            </div>
            <div class="form-group">
              <label>时间</label>
              <input type="time" id="vitaminTime" value="${new Date().toTimeString().slice(0, 5)}">
            </div>
            <div class="form-group">
              <label>备注</label>
              <input type="text" id="vitaminNotes" placeholder="可选备注">
            </div>
            <button class="btn btn-primary btn-block" onclick="App._submitVitamin()">✅ 保存记录</button>
          </div>
        </div>
      `;

      // 选项卡切换
      container.querySelectorAll('.record-tab').forEach(tab => {
        tab.onclick = () => {
          activeTab = tab.dataset.tab;
          renderForm();
        };
      });

      // 喂养方式切换逻辑
      const typeSelect = document.getElementById('feedingType');
      const amountGroup = document.getElementById('feedingAmountGroup');
      const sideGroup = document.getElementById('feedingSideGroup');
      if (typeSelect) {
        const updateFeedingForm = () => {
          const val = typeSelect.value;
          amountGroup.style.display = (val === 'breastfeeding' || val === 'solid_food') ? 'none' : 'block';
          sideGroup.style.display = val === 'breastfeeding' ? 'block' : 'none';
        };
        typeSelect.onchange = updateFeedingForm;
        // 默认配方奶，显示奶量输入
        amountGroup.style.display = 'block';
        sideGroup.style.display = 'none';
      }

      // 尿布类型切换
      const diaperTypeBtns = document.getElementById('diaperType');
      const poopColorGroup = document.getElementById('poopColorGroup');
      if (diaperTypeBtns) {
        diaperTypeBtns.querySelectorAll('.btn-option').forEach(btn => {
          btn.onclick = () => {
            diaperTypeBtns.querySelectorAll('.btn-option').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            poopColorGroup.style.display = (btn.dataset.value === 'poop' || btn.dataset.value === 'both') ? 'block' : 'none';
          };
        });
      }

      // 通用按钮选择交互
      container.querySelectorAll('.btn-group').forEach(group => {
        group.querySelectorAll('.btn-option').forEach(btn => {
          if (!btn.onclick) {
            btn.onclick = () => {
              group.querySelectorAll('.btn-option').forEach(b => b.classList.remove('selected'));
              btn.classList.add('selected');
            };
          }
        });
      });
    };

    renderForm();
  },

  /** 提交喂养记录 */
  async _submitFeeding() {
    try {
      const type = document.getElementById('feedingType').value;
      const feedTime = document.getElementById('feedingTime').value;
      const amount = document.getElementById('feedingAmount')?.value;
      const sideEl = document.querySelector('#feedingSideGroup .selected');
      const side = sideEl?.dataset?.value || null;
      const notes = document.getElementById('feedingNotes').value;

      await DB.addFeeding({
        feeding_type: type,
        feed_time: feedTime || null,
        amount_ml: amount ? Number(amount) : null,
        side: type === 'breastfeeding' ? side : null,
        notes: notes || null,
        created_by: localStorage.getItem('user_name') || '家长'
      });
      this._showToast('✅ 喂养记录已保存');
      this.navigate('dashboard');
    } catch (e) {
      this._showToast('❌ ' + e.message);
    }
  },

  /** 提交尿布记录 */
  async _submitDiaper() {
    try {
      const type = document.querySelector('#diaperType .selected')?.dataset?.value || 'poop';
      const color = document.querySelector('#poopColor .selected')?.dataset?.value || null;
      const notes = document.getElementById('diaperNotes').value;

      await DB.addDiaper({
        type: type,
        color: color,
        notes: notes || null,
        created_by: localStorage.getItem('user_name') || '家长'
      });
      this._showToast('✅ 尿布记录已保存');
      this.navigate('dashboard');
    } catch (e) {
      this._showToast('❌ ' + e.message);
    }
  },

  /** 快捷尿布（从首页/记录页快速按钮，弹窗选时间） */
  async _quickDiaperRef(type) {
    this._quickDiaperPopup(type);
  },

  /** 提交生长记录 */
  async _submitGrowth() {
    try {
      const date = document.getElementById('growthDate').value;
      const weight = document.getElementById('growthWeight').value;
      const height = document.getElementById('growthHeight').value;
      const notes = document.getElementById('growthNotes').value;

      if (!weight && !height) {
        this._showToast('请至少填写体重或身高');
        return;
      }

      await DB.addGrowth({
        record_date: date,
        weight_kg: weight ? Number(weight) : null,
        height_cm: height ? Number(height) : null,
        notes: notes || null
      });
      this._showToast('✅ 生长记录已保存');
      this.navigate('dashboard');
    } catch (e) {
      this._showToast('❌ ' + e.message);
    }
  },

  /** 提交维生素记录 */
  async _submitVitamin() {
    try {
      const vtype = App._suggestVitaminType();
      const time = document.getElementById('vitaminTime').value;
      const notes = document.getElementById('vitaminNotes').value;

      await DB.addVitamin({
        record_date: this._getToday(),
        vitamin_type: vtype,
        taken: true,
        time: time || null,
        notes: notes || null
      });
      this._showToast(`✅ ${vtype} 已记录`);
      this.navigate('dashboard');
    } catch (e) {
      this._showToast('❌ ' + e.message);
    }
  },

  // ==================== AI 聊天页面 ====================
  _renderChat(container) {
    if (!AI.configured) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><img src="./assets/pony.png" class="chat-avatar-img" style="width:48px;height:48px"></div>
          <p>AI 助手未配置</p>
          <p class="text-muted mt-8">请先在设置中配置 AI 服务</p>
          <button class="btn btn-primary mt-16" onclick="App.navigate('settings')">前往设置</button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="chat-container">
        <div class="chat-messages" id="chatMessages">
          <div class="chat-msg bot">
            <div class="chat-avatar"><img src="./assets/pony.png" class="chat-avatar-img"></div>
            <div class="chat-bubble">
              你好呀！我是小马哥哥 🐴<br>
              你可以问我关于宝宝的任何问题，比如：<br>
              • "今天喝奶情况怎么样？"<br>
              • "宝宝最近长得正常吗？"<br>
              • "这个月龄的宝宝该吃多少奶？"
            </div>
          </div>
        </div>
        <div class="chat-input-area">
          <input type="text" id="chatInput" placeholder="输入你的问题..." onkeydown="if(event.key==='Enter') App._sendChat()">
          <button class="btn btn-primary" onclick="App._sendChat()">➤</button>
        </div>
      </div>
    `;

    // 加载历史消息
    AI.loadHistory().then(history => {
      const msgContainer = document.getElementById('chatMessages');
      history.forEach(msg => {
        this._appendChatMessage(msg.role, msg.content, false);
      });
      msgContainer.scrollTop = msgContainer.scrollHeight;
    });

    // 自动聚焦输入框
    setTimeout(() => document.getElementById('chatInput')?.focus(), 300);
  },

  async _sendChat() {
    const input = document.getElementById('chatInput');
    const msg = input.value.trim();
    if (!msg) return;

    input.value = '';
    this._appendChatMessage('user', msg);

    const msgContainer = document.getElementById('chatMessages');

    // 显示打字指示
    const typingEl = document.createElement('div');
    typingEl.className = 'chat-msg bot';
    typingEl.innerHTML = `
      <div class="chat-avatar"><img src="./assets/pony.png" class="chat-avatar-img"></div>
      <div class="chat-bubble chat-typing">
        <span></span><span></span><span></span>
      </div>
    `;
    msgContainer.appendChild(typingEl);
    msgContainer.scrollTop = msgContainer.scrollHeight;

    try {
      const response = await AI.sendMessage(msg);
      typingEl.remove();
      this._appendChatMessage('bot', response);
    } catch (e) {
      typingEl.remove();
      this._appendChatMessage('bot', '❌ ' + e.message);
    }

    msgContainer.scrollTop = msgContainer.scrollHeight;
  },

  _appendChatMessage(role, content, addToContainer = true) {
    const container = document.getElementById('chatMessages') || document.querySelector('.chat-messages');
    if (!container) return;

    // 将 markdown 风格的文本转为简单 HTML
    const formatted = content
      .replace(/### (.*?)(\n|$)/g, '<strong>$1</strong><br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>')
      .replace(/- (.*?)(<br>|$)/g, '• $1<br>');

    const div = document.createElement('div');
    div.className = `chat-msg ${role}`;
    div.innerHTML = `
      <div class="chat-avatar">${role === 'user' ? '👤' : '<img src="./assets/pony.png" class="chat-avatar-img">'}</div>
      <div class="chat-bubble">${formatted}</div>
    `;

    if (addToContainer) {
      container.appendChild(div);
    } else {
      container.appendChild(div);
    }
  },

  // ==================== 历史统计页面 ====================
  async _renderHistory(container) {
    let filterType = 'feeding';

    const renderList = async () => {
      container.innerHTML = `
        <div class="history-filters">
          <button class="btn ${filterType === 'feeding' ? 'btn-primary' : 'btn-secondary'}" onclick="App._switchHistoryFilter('feeding')">🍼 喂养</button>
          <button class="btn ${filterType === 'diaper' ? 'btn-primary' : 'btn-secondary'}" onclick="App._switchHistoryFilter('diaper')">🩲 尿布</button>
          <button class="btn ${filterType === 'vitamin' ? 'btn-primary' : 'btn-secondary'}" onclick="App._switchHistoryFilter('vitamin')">💊 维生素</button>
          <button class="btn ${filterType === 'growth' ? 'btn-primary' : 'btn-secondary'}" onclick="App._switchHistoryFilter('growth')">📏 生长</button>
        </div>
        <div id="historyContent">
          <div class="text-center mt-16"><div class="spinner"></div></div>
        </div>
        <div id="historyChart" class="chart-container mt-16" style="display:none">
          <div class="card-title">📈 趋势图</div>
          <canvas id="historyChartCanvas"></canvas>
        </div>
      `;

      const contentEl = document.getElementById('historyContent');

      try {
        if (filterType === 'feeding') {
          const today = new Date();
          const startDate = new Date(today);
          startDate.setDate(startDate.getDate() - 7);
          const feedings = await DB.getFeedings(startDate.toISOString(), today.toISOString());

          if (feedings.length === 0) {
            contentEl.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p>暂无喂养记录</p></div>';
            return;
          }

          // 按日汇总
          const dailyMap = {};
          feedings.forEach(f => {
            const day = f.created_at.split('T')[0];
            if (!dailyMap[day]) dailyMap[day] = { total: 0, count: 0 };
            if (f.amount_ml) dailyMap[day].total += Number(f.amount_ml);
            dailyMap[day].count++;
          });

          contentEl.innerHTML = `
            <div class="card">
              <div class="card-title">📊 最近 7 天喂养统计</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
                <div><div class="stat-sub">总次数</div><div class="card-value">${feedings.length}</div></div>
                <div><div class="stat-sub">总奶量</div><div class="card-value">${Object.values(dailyMap).reduce((s, d) => s + d.total, 0)}<span style="font-size:14px;color:#B2BEC3"> ml</span></div></div>
              </div>
              <div class="history-list">
                ${feedings.slice(0, 30).map(f => `
                  <div class="record-item">
                    <div class="record-item-icon">🍼</div>
                    <div class="record-item-info">
                      <div class="record-item-title">${f.feeding_type === 'breastfeeding' ? '母乳' : f.feeding_type === 'formula' ? '配方奶' : f.feeding_type === 'pumped_milk' ? '挤奶' : '辅食'} ${f.amount_ml ? f.amount_ml + 'ml' : ''}</div>
                      <div class="record-item-meta">${this._formatDate(f.created_at)} ${this._formatTime(f.created_at)}</div>
                    </div>
                    <button class="record-item-action" onclick="App._deleteRecord('feeding','${f.id}')">✕</button>
                  </div>
                `).join('')}
              </div>
            </div>
          `;

          // 绘制图表
          this._renderFeedingChart(dailyMap);

        } else if (filterType === 'diaper') {
          const today = new Date();
          const startDate = new Date(today);
          startDate.setDate(startDate.getDate() - 7);
          const diapers = await DB.getDiapersRange(startDate.toISOString(), today.toISOString());

          if (diapers.length === 0) {
            contentEl.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p>暂无尿布记录</p></div>';
            return;
          }

          contentEl.innerHTML = `
            <div class="card">
              <div class="card-title">📊 最近 7 天尿布记录</div>
              <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px">
                <div><div class="stat-sub">💩 便便</div><div class="card-value">${diapers.filter(d => d.type === 'poop' || d.type === 'both').length}</div></div>
                <div><div class="stat-sub">💦 尿尿</div><div class="card-value">${diapers.filter(d => d.type === 'pee' || d.type === 'both').length}</div></div>
                <div><div class="stat-sub">总次数</div><div class="card-value">${diapers.length}</div></div>
              </div>
              <div class="history-list">
                ${diapers.slice(0, 30).map(d => {
                  const typeMap = { pee: '💦 尿尿', poop: '💩 便便', both: '💩💦 都有' };
                  return `
                    <div class="record-item">
                      <div class="record-item-icon">🩲</div>
                      <div class="record-item-info">
                        <div class="record-item-title">${typeMap[d.type] || d.type}</div>
                        <div class="record-item-meta">${this._formatDate(d.created_at)} ${this._formatTime(d.created_at)}</div>
                      </div>
                      <button class="record-item-action" onclick="App._deleteRecord('diaper','${d.id}')">✕</button>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;

        } else if (filterType === 'vitamin') {
          const vitamins = await DB.getRecentVitamins(30);

          if (vitamins.length === 0) {
            contentEl.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p>暂无维生素记录</p></div>';
            return;
          }

          const adCount = vitamins.filter(v => v.vitamin_type === 'AD').length;
          const d3Count = vitamins.filter(v => v.vitamin_type === 'D3').length;

          contentEl.innerHTML = `
            <div class="card">
              <div class="card-title">📊 最近 30 天维生素记录</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
                <div><div class="stat-sub">AD 次数</div><div class="card-value">${adCount}</div></div>
                <div><div class="stat-sub">D3 次数</div><div class="card-value">${d3Count}</div></div>
              </div>
              <div class="history-list">
                ${vitamins.slice(0, 30).map(v => `
                  <div class="record-item">
                    <div class="record-item-icon">💊</div>
                    <div class="record-item-info">
                      <div class="record-item-title"><span class="vitamin-pill vitamin-${v.vitamin_type === 'AD' ? 'ad' : 'd3'}">${v.vitamin_type}</span></div>
                      <div class="record-item-meta">${v.record_date} ${v.time || ''}</div>
                    </div>
                    <button class="record-item-action" onclick="App._deleteRecord('vitamin','${v.id}')">✕</button>
                  </div>
                `).join('')}
              </div>
            </div>
          `;

        } else if (filterType === 'growth') {
          const growth = await DB.getGrowthRecords();

          if (growth.length === 0) {
            contentEl.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p>暂无生长记录</p></div>';
            return;
          }

          const latest = growth[0];
          const first = growth[growth.length - 1];

          contentEl.innerHTML = `
            <div class="card">
              <div class="card-title">📏 生长记录</div>
              <div class="history-list">
                ${growth.slice(0, 30).map(g => `
                  <div class="record-item">
                    <div class="record-item-icon">📏</div>
                    <div class="record-item-info">
                      <div class="record-item-title">${g.weight_kg ? g.weight_kg + 'kg' : ''} ${g.height_cm ? '| ' + g.height_cm + 'cm' : ''}</div>
                      <div class="record-item-meta">${g.record_date}</div>
                    </div>
                    <button class="record-item-action" onclick="App._deleteRecord('growth','${g.id}')">✕</button>
                  </div>
                `).join('')}
              </div>
            </div>
          `;

          // 绘制生长曲线
          if (growth.length >= 2 && growth[0].weight_kg) {
            this._renderGrowthChart(growth);
          }
        }
      } catch (e) {
        contentEl.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>${e.message}</p></div>`;
      }
    };

    // 保存过滤状态到 App 以便切换
    this._switchHistoryFilter = (type) => {
      filterType = type;
      renderList();
    };

    renderList();
  },

  /** 渲染喂养图表 */
  _renderFeedingChart(dailyMap) {
    const chartContainer = document.getElementById('historyChart');
    const canvas = document.getElementById('historyChartCanvas');
    if (!canvas || Object.keys(dailyMap).length < 2) return;

    chartContainer.style.display = 'block';

    const days = Object.keys(dailyMap).sort();
    const values = days.map(d => dailyMap[d].total);

    // 销毁旧图表
    if (this._feedingChart) this._feedingChart.destroy();

    this._feedingChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: days.map(d => d.slice(5)),
        datasets: [{
          label: '每日奶量 (ml)',
          data: values,
          backgroundColor: 'rgba(255, 107, 107, 0.6)',
          borderColor: '#FF6B6B',
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: '#F0F0F0' } },
          x: { grid: { display: false } }
        }
      }
    });
  },

  /** 渲染生长曲线 */
  _renderGrowthChart(records) {
    const chartContainer = document.getElementById('historyChart');
    const canvas = document.getElementById('historyChartCanvas');
    if (!canvas) return;

    chartContainer.style.display = 'block';

    const sorted = [...records].filter(r => r.weight_kg).reverse();
    if (sorted.length < 2) return;

    if (this._growthChart) this._growthChart.destroy();

    this._growthChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: sorted.map(r => r.record_date),
        datasets: [{
          label: '体重 (kg)',
          data: sorted.map(r => r.weight_kg),
          borderColor: '#00B894',
          backgroundColor: 'rgba(0, 184, 148, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: '#00B894'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: false, grid: { color: '#F0F0F0' } },
          x: { grid: { display: false } }
        }
      }
    });
  },

  /** 删除记录 */
  _deleteRecord(type, id) {
    this._showConfirm('确认删除', '删除后不可恢复，确定要删除这条记录吗？', async () => {
      try {
        switch (type) {
          case 'feeding': await DB.deleteFeeding(id); break;
          case 'diaper': await DB.deleteDiaper(id); break;
          case 'vitamin': await DB.deleteVitamin(id); break;
          case 'growth': await DB.deleteGrowth(id); break;
        }
        this._showToast('✅ 已删除');
        this.navigate('history');
      } catch (e) {
        this._showToast('❌ ' + e.message);
      }
    });
  },

  // ==================== 设置页面 ====================
  _renderSettings(container) {
    const config = this._config;
    const aiConfig = AI.config || {};
    const babyName = config.babyName || '';
    const babyBirth = config.babyBirth || '';

    const dbConnected = DB.ready;
    const dbStatusText = dbConnected ? '✅ 已连接' : '⬜ 未连接';
    const dbStatusColor = dbConnected ? 'color:#00B894' : 'color:#B2BEC3';

    container.innerHTML = `
      <!-- Supabase 数据库配置（第一步！） -->
      <div class="settings-section">
        <h3>🗄️ 数据库配置 <span style="${dbStatusColor};font-size:14px">${dbStatusText}</span></h3>
        <div class="card">
          <p class="text-muted mb-8" style="font-size:13px">
            ⚠️ <strong>请先连接数据库</strong>，再填写宝宝信息。
          </p>
          <div class="setting-input-group">
            <label>Supabase URL</label>
            <input type="text" id="settingSupabaseUrl" value="${config.supabaseUrl || ''}" placeholder="https://xxxxx.supabase.co">
          </div>
          <div class="setting-input-group">
            <label>Supabase Anon Key</label>
            <input type="text" id="settingSupabaseKey" value="${config.supabaseKey || ''}" placeholder="sb_publishable_... 或 eyJh...">
            <div class="hint">从 Supabase 项目设置 → API 中获取</div>
          </div>
          <button class="btn btn-primary btn-block" onclick="App._saveSupabaseConfig()">🔗 连接数据库</button>
        </div>
      </div>

      <!-- 宝宝信息（第二步） -->
      <div class="settings-section">
        <h3>👶 宝宝信息</h3>
        <div class="card">
          <div class="setting-input-group">
            <label>宝宝名字</label>
            <input type="text" id="settingBabyName" value="${babyName}" placeholder="例如：小明">
          </div>
          <div class="setting-input-group">
            <label>出生日期</label>
            <input type="date" id="settingBabyBirth" value="${babyBirth}">
          </div>
          <button class="btn btn-primary btn-block" onclick="App._saveBabyProfile()">💾 保存宝宝信息</button>
        </div>
      </div>

      <!-- AI 配置 -->
      <div class="settings-section">
        <h3>🤖 AI 助手配置</h3>
        <div class="card">
          <p class="text-muted mb-8" style="font-size:13px">
            支持 OpenAI 兼容接口。如果你没有 OpenAI 的 Key，可以使用 
            <strong>DeepSeek</strong>（便宜）或 <strong>Moonshot</strong> 等国产服务。
          </p>
          <div class="setting-input-group">
            <label>API 端点</label>
            <select id="settingAiEndpoint">
              <option value="https://api.openai.com/v1/chat/completions" ${aiConfig.endpoint?.includes('openai') ? 'selected' : ''}>OpenAI</option>
              <option value="https://api.deepseek.com/v1/chat/completions" ${aiConfig.endpoint?.includes('deepseek') ? 'selected' : ''}>DeepSeek</option>
              <option value="https://api.moonshot.cn/v1/chat/completions" ${aiConfig.endpoint?.includes('moonshot') ? 'selected' : ''}>Moonshot</option>
              <option value="custom" ${aiConfig.endpoint && !aiConfig.endpoint.includes('openai') && !aiConfig.endpoint.includes('deepseek') && !aiConfig.endpoint.includes('moonshot') ? 'selected' : ''}>自定义</option>
            </select>
          </div>
          <div class="setting-input-group" id="customEndpointGroup" style="${aiConfig.endpoint && !['https://api.openai.com/v1/chat/completions','https://api.deepseek.com/v1/chat/completions','https://api.moonshot.cn/v1/chat/completions'].includes(aiConfig.endpoint) ? 'display:block' : 'display:none'}">
            <label>自定义 API 地址</label>
            <input type="text" id="settingAiCustomEndpoint" value="${!['https://api.openai.com/v1/chat/completions','https://api.deepseek.com/v1/chat/completions','https://api.moonshot.cn/v1/chat/completions'].includes(aiConfig.endpoint || '') ? (aiConfig.endpoint || '') : ''}" placeholder="https://your-api.com/v1/chat/completions">
          </div>
          <div class="setting-input-group">
            <label>API Key</label>
            <input type="password" id="settingAiKey" value="${aiConfig.apiKey || ''}" placeholder="sk-...">
          </div>
          <div class="setting-input-group">
            <label>模型名称</label>
            <input type="text" id="settingAiModel" value="${aiConfig.model || 'gpt-4o-mini'}" placeholder="gpt-4o-mini / deepseek-chat">
            <div class="hint">DeepSeek 用 deepseek-chat，Moonshot 用 moonshot-v1-8k</div>
          </div>
          <button class="btn btn-primary btn-block" onclick="App._saveAIConfig()">💾 保存 AI 配置</button>
        </div>
      </div>

      <!-- 用户信息 -->
      <div class="settings-section">
        <h3>👤 我的信息</h3>
        <div class="card">
          <div class="setting-input-group">
            <label>你的称呼（用于记录中的"记录者"）</label>
            <input type="text" id="settingUserName" value="${localStorage.getItem('user_name') || ''}" placeholder="例如：妈妈">
          </div>
          <button class="btn btn-secondary btn-block" onclick="App._saveUserName()">💾 保存</button>
        </div>
      </div>

      <!-- 数据库搭建指南 -->
      <div class="settings-section">
        <h3>📖 数据库搭建指南</h3>
        <div class="card">
          <div style="font-size:14px;line-height:1.8">
            <p><strong>第 1 步</strong>：打开 <a href="https://supabase.com" target="_blank">supabase.com</a>，用 GitHub 注册</p>
            <p><strong>第 2 步</strong>：创建新项目，设置数据库密码</p>
            <p><strong>第 3 步</strong>：进入项目 → SQL Editor → 执行下方 SQL</p>
            <p><strong>第 4 步</strong>：进入项目 → Settings → API，复制 URL 和 anon key</p>
            <p><strong>第 5 步</strong>：填入上方配置后点击"连接数据库"</p>
          </div>
          <button class="btn btn-secondary btn-block mt-16" onclick="App._showSQL()">📋 查看建表 SQL</button>
        </div>
      </div>
    `;

    // AI 端点选择切换
    document.getElementById('settingAiEndpoint').onchange = function() {
      const customGroup = document.getElementById('customEndpointGroup');
      if (this.value === 'custom') {
        customGroup.style.display = 'block';
      } else {
        customGroup.style.display = 'none';
        document.getElementById('settingAiCustomEndpoint').value = this.value;
      }
    };
  },

  /** 保存 Supabase 配置 */
  async _saveSupabaseConfig() {
    const url = document.getElementById('settingSupabaseUrl').value.trim();
    const key = document.getElementById('settingSupabaseKey').value.trim();

    if (!url || !key) {
      this._showToast('请填写 URL 和 Key');
      return;
    }

    const ok = DB.init(url, key);
    if (!ok) {
      this._showToast('❌ 配置格式有误，请检查');
      return;
    }

    // 保存配置
    this.setConfig('supabaseUrl', url);
    this.setConfig('supabaseKey', key);

    // 测试连接
    try {
      await DB.getBabyProfile();
      this._showToast('✅ 数据库连接成功！');
      this._renderSettings(document.getElementById('appContent'));
    } catch (e) {
      this._showToast('⚠️ 已保存，但连接测试未通过。请先执行建表 SQL');
    }
  },

  /** 保存宝宝信息 */
  async _saveBabyProfile() {
    if (!DB.ready) {
      this._showToast('⚠️ 请先填写并连接数据库');
      return;
    }

    const name = document.getElementById('settingBabyName').value.trim();
    const birth = document.getElementById('settingBabyBirth').value;

    if (!name) {
      this._showToast('请输入宝宝名字');
      return;
    }

    this.setConfig('babyName', name);
    this.setConfig('babyBirth', birth);

    try {
      await DB.saveBabyProfile({ name, birth_date: birth || null });
      this._showToast('✅ 宝宝信息已保存');
      this._updateHeader();
    } catch (e) {
      this._showToast('❌ 保存失败: ' + (e.message || String(e)));
    }
  },

  /** 保存 AI 配置 */
  _saveAIConfig() {
    const endpointSelect = document.getElementById('settingAiEndpoint');
    let endpoint = endpointSelect.value;
    if (endpoint === 'custom') {
      endpoint = document.getElementById('settingAiCustomEndpoint').value.trim();
    }
    const apiKey = document.getElementById('settingAiKey').value.trim();
    const model = document.getElementById('settingAiModel').value.trim();

    if (!endpoint || !apiKey) {
      this._showToast('请填写 API 地址和 Key');
      return;
    }

    AI.saveConfig(endpoint, apiKey, model || 'gpt-4o-mini');
    this._showToast('✅ AI 配置已保存');
  },

  /** 保存用户称呼 */
  _saveUserName() {
    const name = document.getElementById('settingUserName').value.trim();
    localStorage.setItem('user_name', name || '家长');
    this._showToast('✅ 已保存');
  },

  /** 显示建表 SQL */
  _showSQL() {
    const sql = `-- 宝宝成长记录 - 数据库建表 SQL
-- 在 Supabase SQL Editor 中执行

-- 1. 宝宝资料表
CREATE TABLE baby_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  nickname TEXT,
  birth_date DATE,
  gender TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. 喂养记录表
CREATE TABLE feedings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  baby_id UUID REFERENCES baby_profiles(id) ON DELETE CASCADE DEFAULT (SELECT id FROM baby_profiles LIMIT 1),
  feeding_type TEXT NOT NULL CHECK (feeding_type IN ('breastfeeding', 'formula', 'pumped_milk', 'solid_food')),
  amount_ml NUMERIC,
  start_time TIMESTAMP,
  side TEXT CHECK (side IN ('left', 'right', 'both')),
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. 尿布记录表
CREATE TABLE diapers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  baby_id UUID REFERENCES baby_profiles(id) ON DELETE CASCADE DEFAULT (SELECT id FROM baby_profiles LIMIT 1),
  time TIMESTAMP,
  type TEXT NOT NULL CHECK (type IN ('pee', 'poop', 'both')),
  color TEXT,
  consistency TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. 生长记录表
CREATE TABLE growth_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  baby_id UUID REFERENCES baby_profiles(id) ON DELETE CASCADE DEFAULT (SELECT id FROM baby_profiles LIMIT 1),
  record_date DATE DEFAULT CURRENT_DATE,
  height_cm NUMERIC(5,1),
  weight_kg NUMERIC(5,2),
  head_circumference_cm NUMERIC(4,1),
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 5. 维生素记录表
CREATE TABLE vitamin_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  baby_id UUID REFERENCES baby_profiles(id) ON DELETE CASCADE DEFAULT (SELECT id FROM baby_profiles LIMIT 1),
  record_date DATE DEFAULT CURRENT_DATE,
  vitamin_type TEXT NOT NULL CHECK (vitamin_type IN ('AD', 'D3')),
  taken BOOLEAN DEFAULT TRUE,
  time TIME,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 6. AI 聊天历史表
CREATE TABLE chat_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 开启 RLS（可选，家庭应用可以先关掉）
ALTER TABLE baby_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedings ENABLE ROW LEVEL SECURITY;
ALTER TABLE diapers ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE vitamin_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;

-- 允许所有操作（家庭内部使用）
CREATE POLICY "Allow all" ON baby_profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON feedings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON diapers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON growth_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON vitamin_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON chat_history FOR ALL USING (true) WITH CHECK (true);
`;

    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.style.alignItems = 'flex-start';
    overlay.style.paddingTop = '60px';
    overlay.innerHTML = `
      <div class="confirm-dialog" style="max-width:480px;max-height:80vh;overflow-y:auto;text-align:left">
        <h3 style="text-align:center">📋 建表 SQL</h3>
        <p class="text-muted" style="font-size:12px;text-align:center">复制以下 SQL 到 Supabase SQL Editor 执行</p>
        <pre style="background:#F8F9FA;padding:12px;border-radius:8px;font-size:12px;overflow-x:auto;white-space:pre-wrap;word-break:break-all;margin-top:12px;max-height:50vh;overflow-y:auto">${sql}</pre>
        <div class="form-actions" style="margin-top:12px">
          <button class="btn btn-primary btn-block" onclick="App._copySQL(\`${sql.replace(/`/g, '\\`')}\`)">📋 复制 SQL</button>
        </div>
        <button class="btn btn-secondary btn-block mt-8" onclick="this.closest('.confirm-overlay').remove()">关闭</button>
      </div>
    `;
    document.body.appendChild(overlay);
  },

  _copySQL(sql) {
    navigator.clipboard.writeText(sql).then(() => {
      this._showToast('✅ SQL 已复制到剪贴板');
    }).catch(() => {
      this._showToast('请手动复制');
    });
  }
};

// ==================== 启动 ====================
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
