
import { Template } from './types';

export const DEFAULT_TEMPLATE: Template = {
  id: 'pro_chain_demo',
  name: '提示词链 (演示：策划->绘图)',
  inputs: [
    {
      id: 'topic',
      label: '核心主题',
      defaultValue: '赛博朋克森林'
    },
    {
      id: 'mood',
      label: '氛围基调',
      defaultValue: '忧郁且充满霓虹感'
    }
  ],
  steps: [
    {
      id: 'step_concept',
      name: '1. 概念构思',
      description: '基于主题扩展详细场景描述。',
      content: `请为主题为“<topic>”的项目写一段详细的场景描述。
氛围要求：<mood>。
请包含光影、细节和一种独特的视觉奇观。`
    },
    {
      id: 'step_mj_prompt',
      name: '2. 绘图提示词',
      description: '将步骤1的描述转化为 Midjourney 提示词。',
      content: `把下面的场景描述翻译并转化为专业的 Midjourney 提示词：
---
[[1]]
---
要求：英文输出，加入 8k, photorealistic, cinematic lighting 等后缀。`
    },
    {
      id: 'step_sd_negative',
      name: '3. 负面提示词',
      description: '为该场景准备通用的负面提示词。',
      content: `为步骤 [[2]] 生成的视觉效果匹配最适合的负面提示词。`
    }
  ]
};

export const DEFAULT_TEMPLATES = [DEFAULT_TEMPLATE];
