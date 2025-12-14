import { GoogleGenAI } from "@google/genai";
import { HyperParameters, TrainingStats, TutorialStep } from "../types";

let ai: GoogleGenAI | null = null;

if (process.env.API_KEY) {
  ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
}

export const getGeminiTutorResponse = async (
  userMessage: string,
  step: TutorialStep,
  stats: TrainingStats[],
  params: HyperParameters
): Promise<string> => {
  if (!ai) return "错误：未配置 API Key。";

  const currentStats = stats.length > 0 ? stats[stats.length - 1] : null;
  const recentPerformance = stats.slice(-5).map(s => `第 ${s.episode} 回合: ${s.totalReward}`).join(", ");

  const systemPrompt = `
    你是一个名为“RL Zero to Hero”的游戏的专家级强化学习导师。
    用户当前处于教程的第 ${step} 步。
    请务必使用中文（简体）与用户交流。
    
    当前超参数:
    - 学习率 (Learning Rate / Alpha): ${params.learningRate}
    - 折扣因子 (Discount Factor / Gamma): ${params.discountFactor}
    - 探索率 (Epsilon): ${params.epsilon}
    
    最近智能体表现 (最后 5 个回合): [${recentPerformance}]
    
    你的目标是简单通俗地解释概念，鼓励用户，并在智能体没有学习（例如学习率过高或 epsilon 没有衰减）时帮助调试。
    保持回答简洁（不超过 3 段），并使用 Markdown 格式。
    如果用户询问代码，请解释 Q-Learning 更新规则：Q(s,a) = Q(s,a) + alpha * (R + gamma * max(Q(s',a')) - Q(s,a))。
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: userMessage,
      config: {
        systemInstruction: systemPrompt,
      }
    });
    return response.text || "我无法生成回复。";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "连接神经网络时出现问题，请重试。";
  }
};