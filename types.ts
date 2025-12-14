export enum CellType {
  EMPTY = 0,
  WALL = 1,
  START = 2,
  GOAL = 3,
  PIT = 4,
}

export interface Position {
  x: number;
  y: number;
}

export interface GridConfig {
  width: number;
  height: number;
  layout: CellType[][];
  startPos: Position;
}

export interface TrainingStats {
  episode: number;
  totalReward: number;
  epsilon: number;
}

export interface HyperParameters {
  learningRate: number; // Alpha
  discountFactor: number; // Gamma
  epsilon: number; // Exploration rate
  epsilonDecay: number;
  speed: number;
}

export enum TutorialStep {
  INTRO = 0,
  ENVIRONMENT = 1,
  AGENT_ACTIONS = 2,
  Q_TABLE = 3,
  TRAINING = 4,
  MASTER = 5
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}
