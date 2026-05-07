/**
 * Intus 前端配置文件
 *
 * 此文件由管理员中心维护。
 * 修改后请刷新浏览器页面生效。
 */

const SITE_CONFIG = {
  "quotes": {
    "enabled": true,
    "interval": 10000,
    "items": [
      {
        "text": "知人者智，自知者明",
        "source": "——老子《道德经》"
      },
      {
        "text": "凡事预则立，不预则废",
        "source": "——《礼记·中庸》"
      },
      {
        "text": "见微以知萌，见端以知末",
        "source": "——韩非《韩非子·说林上》"
      },
      {
        "text": "致广大而尽精微",
        "source": "——《礼记·中庸》"
      },
      {
        "text": "兼听则明，偏信则暗",
        "source": "——司马光《资治通鉴》"
      },
      {
        "text": "君子生非异也，善假于物也",
        "source": "——荀子《劝学》"
      },
      {
        "text": "求木之长者，必固其根本",
        "source": "——魏征《谏太宗十思疏》"
      },
      {
        "text": "尽信书，则不如无书",
        "source": "——孟子《孟子·尽心下》"
      },
      {
        "text": "操千曲而后晓声，观千剑而后识器",
        "source": "——刘勰《文心雕龙·知音》"
      },
      {
        "text": "不畏浮云遮望眼，自缘身在最高层",
        "source": "——王安石《登飞来峰》"
      }
    ]
  },
  "colors": {
    "primary": "#18181B",
    "success": "#22C55E",
    "progressComplete": "#18181B"
  },
  "designTokens": {
    "light": {
      "colors": {
        "brand": "#18181B",
        "brandHover": "#27272A",
        "textPrimary": "#09090B",
        "textSecondary": "#3F3F46",
        "textMuted": "#71717A",
        "surface": "#FFFFFF",
        "surfaceSecondary": "#FAFAFA",
        "border": "#E4E4E7",
        "success": "#22C55E",
        "warning": "#F59E0B",
        "danger": "#EF4444",
        "overlay": "rgba(9, 9, 11, 0.46)"
      }
    },
    "dark": {
      "colors": {
        "brand": "#F4F4F5",
        "brandHover": "#FFFFFF",
        "textPrimary": "#F4F4F5",
        "textSecondary": "#D4D4D8",
        "textMuted": "#A1A1AA",
        "surface": "#18181B",
        "surfaceSecondary": "#09090B",
        "border": "#3F3F46",
        "success": "#4ADE80",
        "warning": "#FACC15",
        "danger": "#FB7185",
        "overlay": "rgba(3, 3, 4, 0.66)"
      }
    },
    "radius": {
      "sm": "0.5rem",
      "md": "0.75rem",
      "lg": "1rem",
      "xl": "1.25rem"
    },
    "spacing": {
      "compact": "0.5rem",
      "base": "0.75rem",
      "comfortable": "1rem",
      "spacious": "1.5rem"
    },
    "shadow": {
      "card": "0 1px 2px rgba(9, 9, 11, 0.06)",
      "modal": "0 24px 56px rgba(9, 9, 11, 0.24)",
      "focus": "0 0 0 3px rgba(24, 24, 27, 0.14)"
    },
    "zIndex": {
      "dropdown": 40,
      "modal": 50,
      "toast": 60,
      "guide": 70
    }
  },
  "visualPresets": {
    "default": "rational",
    "locked": true,
    "options": {
      "rational": {
        "label": "黑白工作台",
        "light": {
          "colors": {
            "brand": "#18181B",
            "brandHover": "#27272A",
            "overlay": "rgba(9, 9, 11, 0.46)"
          },
          "shadow": {
            "card": "0 1px 2px rgba(9, 9, 11, 0.06)",
            "modal": "0 24px 56px rgba(9, 9, 11, 0.24)"
          }
        },
        "dark": {
          "colors": {
            "brand": "#F4F4F5",
            "brandHover": "#FFFFFF",
            "overlay": "rgba(3, 3, 4, 0.66)"
          },
          "shadow": {
            "card": "0 1px 2px rgba(0, 0, 0, 0.28)",
            "modal": "0 30px 66px rgba(0, 0, 0, 0.58)"
          }
        }
      }
    }
  },
  "motion": {
    "durations": {
      "fast": 140,
      "base": 180,
      "slow": 240,
      "progress": 420
    },
    "easing": {
      "standard": "cubic-bezier(0.2, 0, 0, 1)",
      "emphasized": "cubic-bezier(0.2, 0.8, 0.2, 1)"
    },
    "reducedMotion": {
      "disableTypingEffect": true,
      "disableNonEssentialPulse": true
    }
  },
  "a11y": {
    "minContrastAA": 4.5,
    "focusRing": {
      "borderColorLight": "#18181B",
      "borderColorDark": "#F4F4F5",
      "ringColorLight": "rgba(24, 24, 27, 0.14)",
      "ringColorDark": "rgba(244, 244, 245, 0.18)",
      "ringStrongLight": "rgba(24, 24, 27, 0.28)",
      "ringStrongDark": "rgba(244, 244, 245, 0.36)",
      "underlayLight": "rgba(255, 255, 255, 0.92)",
      "underlayDark": "rgba(24, 24, 27, 0.96)"
    },
    "toast": {
      "atomic": true,
      "defaultLive": "polite",
      "errorLive": "assertive",
      "roleByType": {
        "success": "status",
        "info": "status",
        "warning": "alert",
        "error": "alert"
      }
    },
    "dialogs": {
      "showNewSessionModal": {
        "dialogId": "dv-dialog-new-session",
        "titleId": "dv-dialog-new-session-title",
        "descId": "dv-dialog-new-session-desc",
        "initialFocus": "[data-guide='guide-topic']",
        "returnFocus": "[data-guide='guide-new-session']"
      },
      "showCustomScenarioModal": {
        "dialogId": "dv-dialog-custom-scenario",
        "titleId": "dv-dialog-custom-scenario-title",
        "descId": "dv-dialog-custom-scenario-desc",
        "initialFocus": "#customScenarioName"
      },
      "showAiGenerateModal": {
        "dialogId": "dv-dialog-ai-generate",
        "titleId": "dv-dialog-ai-generate-title",
        "descId": "dv-dialog-ai-generate-desc",
        "initialFocus": "#aiScenarioDescription"
      },
      "showAiPreviewModal": {
        "dialogId": "dv-dialog-ai-preview",
        "titleId": "dv-dialog-ai-preview-title",
        "descId": "dv-dialog-ai-preview-desc",
        "initialFocus": "#aiGeneratedScenarioName"
      },
      "showMilestoneModal": {
        "dialogId": "dv-dialog-milestone",
        "titleId": "dv-dialog-milestone-title",
        "descId": "dv-dialog-milestone-desc"
      },
      "showDeleteModal": {
        "dialogId": "dv-dialog-delete-session",
        "titleId": "dv-dialog-delete-session-title",
        "descId": "dv-dialog-delete-session-desc"
      },
      "showRestartModal": {
        "dialogId": "dv-dialog-restart-session",
        "titleId": "dv-dialog-restart-session-title",
        "descId": "dv-dialog-restart-session-desc"
      },
      "showDeleteDocModal": {
        "dialogId": "dv-dialog-delete-doc",
        "titleId": "dv-dialog-delete-doc-title",
        "descId": "dv-dialog-delete-doc-desc"
      },
      "showDeleteReportModal": {
        "dialogId": "dv-dialog-delete-report",
        "titleId": "dv-dialog-delete-report-title",
        "descId": "dv-dialog-delete-report-desc"
      },
      "showGlobalSearchModal": {
        "dialogId": "dv-dialog-global-search",
        "titleId": "dv-dialog-global-search-title",
        "descId": "dv-dialog-global-search-desc",
        "initialFocus": "#global-search-input"
      },
      "showSettingsModal": {
        "dialogId": "dv-dialog-settings",
        "titleId": "dv-dialog-settings-title",
        "descId": "dv-dialog-settings-desc",
        "initialFocus": "#dv-settings-tab-appearance"
      },
      "showBindPhoneModal": {
        "dialogId": "dv-dialog-bind-phone",
        "titleId": "dv-dialog-bind-phone-title",
        "descId": "dv-dialog-bind-phone-desc",
        "initialFocus": "#bind-phone-input"
      },
      "showActionConfirmModal": {
        "dialogId": "dv-dialog-action-confirm",
        "titleId": "dv-dialog-action-confirm-title",
        "descId": "dv-dialog-action-confirm-desc"
      },
      "showBatchDeleteModal": {
        "dialogId": "dv-dialog-batch-delete",
        "titleId": "dv-dialog-batch-delete-title",
        "descId": "dv-dialog-batch-delete-desc"
      },
      "showChangelogModal": {
        "dialogId": "dv-dialog-changelog",
        "titleId": "dv-dialog-changelog-title",
        "descId": "dv-dialog-changelog-desc"
      }
    }
  },
  "theme": {
    "defaultMode": "system"
  },
  "api": {
    "baseUrl": "http://localhost:5002/api",
    "webSearchPollInterval": 200,
    "sessionListPollInterval": 3000,
    "reportStatusPollInterval": 600
  },
  "limits": {
    "topicMaxLength": 200,
    "descriptionMaxLength": 1000,
    "answerMaxLength": 5000,
    "otherInputMaxLength": 2000,
    "maxFileSize": 10485760
  },
  "researchTips": [
    "回答越具体，生成的问题越精准",
    "尝试用实例来描述你的经历",
    "越坦诚的回答越有助于深入访谈",
    "可以结合实际使用场景来作答",
    "详细描述痛点，会帮助发现更深层需求",
    "如果有相关文档，上传参考资料会加速分析",
    "别忘了表达你期望解决的核心问题",
    "用数据说话比空泛描述更有说服力",
    "思考一下\"为什么\"比\"是什么\"更重要",
    "描述目标用户的典型一天会很有帮助",
    "列举现有方案的不足能发现真实需求",
    "说明预期的成功标准让目标更清晰",
    "提及相关的约束条件避免方案偏离",
    "分享过往的失败经验同样有价值",
    "从用户视角而非功能视角思考问题",
    "优先级排序能帮助聚焦核心需求",
    "量化的指标比模糊的期望更易实现",
    "描述完整的业务流程有助理解全局",
    "对比竞品能发现差异化机会",
    "技术选型的理由比技术本身更重要",
    "预算和时间限制需要提前说明",
    "用户反馈的具体案例很有参考价值",
    "描述异常场景和边界条件很关键",
    "关键利益相关方的诉求需要平衡",
    "说明可接受的权衡取舍更务实",
    "复杂问题可以先拆解再逐个说明",
    "举例说明\"最好的情况\"和\"最坏的情况\"",
    "说明需求的紧急程度和重要程度",
    "多说\"具体遇到什么问题\"少说\"需要什么功能\"",
    "频率和规模数据能帮助判断优先级"
  ],
  "version": {
    "current": "1.26.0",
    "configFile": "version.json"
  }
};

// 如果在 Node.js 环境中，导出配置
if (typeof module !== "undefined" && module.exports) {
  module.exports = SITE_CONFIG;
}
