// P4c1 — gstack browse whitelist + selector registry
//
// Phase 4 (gstack browse integration) intentionally ships as a WHITELIST, not
// a blacklist. Reasons:
//
// 1. Security — a headless Chromium with user cookies injected is a
//    weaponizable primitive. Restricting hostnames to a small, audited set
//    means a prompt-injection can't steer the agent to arbitrary URLs.
// 2. Reliability — the whole point of browse is "pull GMV from 淘宝 backend"
//    style tasks that need KNOWN selectors. Arbitrary sites break the minute
//    layout shifts. Whitelist sites get curated selector entries we test.
// 3. Cost — ~100ms/cmd × 10k cmds = bad day. Whitelist naturally caps the
//    long-tail abuse surface.
//
// MVP = 10 Chinese business platforms (per skills-integration-plan-v1.md §2.5
// security model). Non-whitelisted hostnames hard-fail in the tool runtime
// with a 422 error that the dispatcher surfaces as a friendly message.

export type BrowseSiteId =
  | 'taobao_seller'      // 淘宝卖家中心
  | 'douyin_creator'     // 抖音创作者中心
  | 'wechat_mp'          // 微信公众号后台
  | 'feishu'             // 飞书文档/表格
  | 'wecom'              // 企业微信管理后台
  | 'dingtalk'           // 钉钉工作台
  | 'xiaohongshu'        // 小红书创作服务
  | 'bilibili'           // B 站创作中心
  | 'zhihu'              // 知乎创作中心
  | 'weibo';             // 微博

export interface BrowseSiteSelectors {
  // Free-form map of "semantic action name" → CSS selector. The LLM/agent
  // references actions by name ("total_gmv", "login_phone_input"), never
  // raw selectors — which keeps prompt-injection from steering to arbitrary
  // DOM nodes on the page. New actions require a repo PR, not runtime input.
  [action: string]: string;
}

export interface BrowseSite {
  id: BrowseSiteId;
  label: string;               // 人类可读名称，用于 UI 展示
  hostnames: string[];          // 允许访问的 host（startsWith 匹配）
  loginUrl: string;             // 用户手动登录的入口（"打开浏览器登我的号"）
  description: string;          // 简介，会显示在设置页
  capabilities: readonly ('read' | 'write' | 'upload')[];  // MVP 只放 read
  selectors: BrowseSiteSelectors;
}

export const BROWSE_WHITELIST: Readonly<Record<BrowseSiteId, BrowseSite>> = {
  taobao_seller: {
    id: 'taobao_seller',
    label: '淘宝卖家中心',
    hostnames: ['myseller.taobao.com', 'sycm.taobao.com', 'tbitem.taobao.com'],
    loginUrl: 'https://login.taobao.com/',
    description: '抓本周/本月 GMV、订单数、退款率等卖家核心指标。只读。',
    capabilities: ['read'],
    selectors: {
      gmv_week: '[data-spm-click*="gmv_week"]',
      orders_week: '[data-spm-click*="orders_week"]',
      dashboard_root: '.oms-workbench',
    },
  },
  douyin_creator: {
    id: 'douyin_creator',
    label: '抖音创作者中心',
    hostnames: ['creator.douyin.com', 'creator-center.douyin.com'],
    loginUrl: 'https://creator.douyin.com/',
    description: '拉取视频播放量、粉丝增长、互动率、直播数据。只读。',
    capabilities: ['read'],
    selectors: {
      video_list: '[data-e2e="video-list"]',
      play_count: '[data-e2e="play-count"]',
      fans_count: '[data-e2e="fans-count"]',
    },
  },
  wechat_mp: {
    id: 'wechat_mp',
    label: '微信公众号后台',
    hostnames: ['mp.weixin.qq.com'],
    loginUrl: 'https://mp.weixin.qq.com/',
    description: '抓推文阅读量、在看、分享数、粉丝增长。只读。',
    capabilities: ['read'],
    selectors: {
      read_count: '.weui-desktop-data-graph__ttl',
      article_list: '.js_article_list',
    },
  },
  feishu: {
    id: 'feishu',
    label: '飞书',
    hostnames: ['feishu.cn', 'larksuite.com'],
    loginUrl: 'https://www.feishu.cn/accounts/page/login',
    description: '读取飞书文档、多维表格、日程。',
    capabilities: ['read'],
    selectors: {
      doc_title: '.docs-title',
      bitable_root: '.bitable-container',
    },
  },
  wecom: {
    id: 'wecom',
    label: '企业微信管理后台',
    hostnames: ['work.weixin.qq.com'],
    loginUrl: 'https://work.weixin.qq.com/wework_admin/loginpage_wx',
    description: '读取通讯录、客户联系、群管理数据。',
    capabilities: ['read'],
    selectors: {
      customer_count: '.js_customer_total',
    },
  },
  dingtalk: {
    id: 'dingtalk',
    label: '钉钉工作台',
    hostnames: ['oa.dingtalk.com', 'im.dingtalk.com'],
    loginUrl: 'https://oa.dingtalk.com/',
    description: '读取审批单、考勤、OKR 进度。',
    capabilities: ['read'],
    selectors: {
      pending_approval: '.pending-approval-count',
    },
  },
  xiaohongshu: {
    id: 'xiaohongshu',
    label: '小红书创作服务',
    hostnames: ['creator.xiaohongshu.com'],
    loginUrl: 'https://creator.xiaohongshu.com/',
    description: '拉取笔记阅读量、互动率、粉丝画像。',
    capabilities: ['read'],
    selectors: {
      note_list: '.note-list',
      impression_count: '[data-testid="impression-count"]',
    },
  },
  bilibili: {
    id: 'bilibili',
    label: 'B 站创作中心',
    hostnames: ['member.bilibili.com'],
    loginUrl: 'https://passport.bilibili.com/login',
    description: '读取视频播放、硬币、充电、粉丝互动。',
    capabilities: ['read'],
    selectors: {
      play_count: '.play-count',
      fans_count: '.fans-count',
    },
  },
  zhihu: {
    id: 'zhihu',
    label: '知乎创作中心',
    hostnames: ['www.zhihu.com/creator', 'zhuanlan.zhihu.com'],
    loginUrl: 'https://www.zhihu.com/signin',
    description: '读取回答/文章阅读量、赞同、关注者。',
    capabilities: ['read'],
    selectors: {
      creator_dashboard: '.CreatorDashboard',
    },
  },
  weibo: {
    id: 'weibo',
    label: '微博',
    hostnames: ['weibo.com', 'data.weibo.com'],
    loginUrl: 'https://passport.weibo.com/sso/signin',
    description: '读取微博阅读量、转发、评论、粉丝变化。',
    capabilities: ['read'],
    selectors: {
      read_count: '.read-count',
    },
  },
};

// ---------- Runtime helpers ----------

/**
 * Parse a URL and return the matching whitelist site, or null if not allowed.
 *
 * Matching rule: startsWith on hostname. This is intentional — subdomains
 * inherit trust (e.g. sycm.taobao.com under taobao_seller). Path is not
 * considered for the whitelist check; path enforcement happens inside the
 * browse runtime via allowed selector ops.
 */
export function findWhitelistedSite(url: string): BrowseSite | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  // Only HTTPS. Blocks file://, data:, about:, and other primordial attack vectors.
  if (parsed.protocol !== 'https:') return null;
  const host = parsed.hostname.toLowerCase();
  for (const site of Object.values(BROWSE_WHITELIST)) {
    if (site.hostnames.some(h => host === h || host.endsWith('.' + h))) {
      return site;
    }
  }
  return null;
}

/** True iff the URL points to a whitelisted host. */
export function isUrlAllowed(url: string): boolean {
  return findWhitelistedSite(url) !== null;
}

/** Human-readable error for non-whitelist URLs (shown in agent reply). */
export function describeWhitelistRejection(url: string): string {
  const sites = Object.values(BROWSE_WHITELIST).map(s => s.label).join('、');
  return `出于安全原因，浏览工具只允许访问白名单站点。当前支持:${sites}。` +
    `如需新增平台,请在设置 > 浏览站点中提出申请。（拒绝的地址:${url}）`;
}

/** Get the selector for a (site, action) pair, or null if undefined. */
export function getSelector(siteId: BrowseSiteId, action: string): string | null {
  const site = BROWSE_WHITELIST[siteId];
  if (!site) return null;
  return site.selectors[action] || null;
}

/** All site metadata for UI rendering. Never exposes cookies. */
export function listBrowseSites(): BrowseSite[] {
  return Object.values(BROWSE_WHITELIST);
}
