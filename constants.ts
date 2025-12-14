import { CellType, GridConfig, HyperParameters } from "./types";

export const DEFAULT_HYPERPARAMS: HyperParameters = {
  learningRate: 0.1,
  discountFactor: 0.95,
  epsilon: 1.0,
  epsilonDecay: 0.995,
  speed: 100, // ms per step
};

// 0: Empty, 1: Wall, 2: Start, 3: Goal, 4: Pit
const RAW_LAYOUT = [
  [1, 1, 1, 1, 1, 1, 1, 1],
  [1, 2, 0, 0, 0, 0, 4, 1],
  [1, 0, 1, 1, 0, 1, 0, 1],
  [1, 0, 0, 0, 0, 4, 0, 1],
  [1, 0, 4, 1, 1, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 3, 1],
  [1, 1, 1, 1, 1, 1, 1, 1],
];

export const INITIAL_GRID: GridConfig = {
  width: 8,
  height: 7,
  layout: RAW_LAYOUT as CellType[][],
  startPos: { x: 1, y: 1 },
};

export const ACTIONS = [
  { dx: 0, dy: -1, name: 'UP' },
  { dx: 0, dy: 1, name: 'DOWN' },
  { dx: -1, dy: 0, name: 'LEFT' },
  { dx: 1, dy: 0, name: 'RIGHT' },
];

export const STEPS_INFO = [
  {
    title: "1. 任务目标",
    desc: "欢迎来到强化学习实战。你的目标是创建一个 AI，学会寻找金币（黄色），同时避开陷阱（红色）和墙壁。",
  },
  {
    title: "2. 环境 (Environment)",
    desc: "网格世界是智能体生存的地方。它提供“状态”（位置）和“奖励”（金币+100，陷阱-100，每走一步-1）。",
  },
  {
    title: "3. 智能体 (Agent)",
    desc: "智能体负责做决策。最初它什么都不知道。它可以向上、下、左、右移动。",
  },
  {
    title: "4. 大脑 (Q-Table)",
    desc: "Q表是智能体的记忆。它存储在特定“状态”下采取特定“动作”的价值。即 Q(状态, 动作)。",
  },
  {
    title: "5. 训练循环 (Training)",
    desc: "我们使用 Q-Learning 算法。智能体在“探索”（随机移动）和“利用”（已知最佳移动）之间平衡。观察它的学习过程！",
  },
  {
    title: "6. 精通 (Mastery)",
    desc: "智能体已经优化了路径。你现在可以调整参数，看看它们如何影响学习速度。",
  }
];