import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, FastForward, MessageSquare, Settings2, BrainCircuit, ChevronRight, ChevronLeft } from 'lucide-react';
import { ACTIONS, DEFAULT_HYPERPARAMS, INITIAL_GRID, STEPS_INFO } from './constants';
import { CellType, HyperParameters, Position, TrainingStats, TutorialStep, ChatMessage } from './types';
import GridWorld from './components/GridWorld';
import TrainingChart from './components/TrainingChart';
import { getGeminiTutorResponse } from './services/geminiService';

const App: React.FC = () => {
  // --- State ---
  const [step, setStep] = useState<TutorialStep>(TutorialStep.INTRO);
  const [params, setParams] = useState<HyperParameters>(DEFAULT_HYPERPARAMS);
  const [stats, setStats] = useState<TrainingStats[]>([]);
  
  // Simulation State
  const [agentPos, setAgentPos] = useState<Position>(INITIAL_GRID.startPos);
  const [isPlaying, setIsPlaying] = useState(false);
  const [episodeCount, setEpisodeCount] = useState(0);
  const [currentReward, setCurrentReward] = useState(0);
  const [pathTrace, setPathTrace] = useState<Position[]>([]);
  
  // AI Tutor State
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: "你好！我是你的强化学习 AI 导师。我在这里帮助你从零开始构建一个强化学习智能体。准备好开始了吗？" }
  ]);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // --- Refs (Mutable state for the RL loop to avoid re-renders) ---
  const qTable = useRef<Record<string, number[]>>({}); // Key: "x,y", Value: [Q_up, Q_down, Q_left, Q_right]
  const gameLoopRef = useRef<number | null>(null);
  const agentRef = useRef<Position>(INITIAL_GRID.startPos);
  const isRunningRef = useRef(false);

  // --- RL Logic ---

  const getQ = (pos: Position): number[] => {
    const key = `${pos.x},${pos.y}`;
    if (!qTable.current[key]) {
      qTable.current[key] = [0, 0, 0, 0]; // Initialize with 0
    }
    return qTable.current[key];
  };

  const chooseAction = (pos: Position, epsilon: number): number => {
    // Epsilon-Greedy Strategy
    if (Math.random() < epsilon) {
      return Math.floor(Math.random() * 4); // Explore
    } else {
      const qs = getQ(pos);
      // Argmax with random tie-breaking
      let maxVal = Math.max(...qs);
      let bestActions = qs.map((v, i) => v === maxVal ? i : -1).filter(i => i !== -1);
      return bestActions[Math.floor(Math.random() * bestActions.length)]; // Exploit
    }
  };

  const stepEnvironment = (actionIdx: number) => {
    const action = ACTIONS[actionIdx];
    const newPos = {
      x: agentRef.current.x + action.dx,
      y: agentRef.current.y + action.dy
    };

    // Boundary & Wall Check
    if (
      newPos.x < 0 || newPos.x >= INITIAL_GRID.width ||
      newPos.y < 0 || newPos.y >= INITIAL_GRID.height ||
      INITIAL_GRID.layout[newPos.y][newPos.x] === CellType.WALL
    ) {
      // Hit wall: stay put, negative reward
      return { nextPos: agentRef.current, reward: -5, done: false };
    }

    const cellType = INITIAL_GRID.layout[newPos.y][newPos.x];
    let reward = -1; // Living penalty
    let done = false;

    if (cellType === CellType.GOAL) {
      reward = 100;
      done = true;
    } else if (cellType === CellType.PIT) {
      reward = -100;
      done = true;
    }

    return { nextPos: newPos, reward, done };
  };

  const resetEpisode = () => {
    agentRef.current = INITIAL_GRID.startPos;
    setAgentPos(INITIAL_GRID.startPos);
    setCurrentReward(0);
    setPathTrace([]);
  };

  const trainingLoop = useCallback(() => {
    if (!isRunningRef.current) return;

    // 1. Choose Action
    const currentPos = agentRef.current;
    const actionIdx = chooseAction(currentPos, params.epsilon);

    // 2. Perform Action
    const { nextPos, reward, done } = stepEnvironment(actionIdx);

    // 3. Update Q-Value (Bellman Equation)
    // Q(s,a) = Q(s,a) + alpha * [R + gamma * max(Q(s',a')) - Q(s,a)]
    const currentQ = getQ(currentPos);
    const maxNextQ = Math.max(...getQ(nextPos));
    const target = reward + (done ? 0 : params.discountFactor * maxNextQ);
    
    // Update the specific action value
    const newQValue = currentQ[actionIdx] + params.learningRate * (target - currentQ[actionIdx]);
    qTable.current[`${currentPos.x},${currentPos.y}`][actionIdx] = newQValue;

    // 4. Update State
    agentRef.current = nextPos;
    setAgentPos(nextPos);
    setCurrentReward(prev => prev + reward);
    setPathTrace(prev => [...prev.slice(-20), nextPos]); // Keep trail short

    if (done) {
      // Episode finished
      setStats(prev => [
        ...prev.slice(-49), // Keep last 50 stats
        { episode: prev.length + 1, totalReward: currentReward + reward, epsilon: params.epsilon }
      ]);
      setEpisodeCount(c => c + 1);
      
      // Decay Epsilon
      setParams(p => ({ ...p, epsilon: Math.max(0.01, p.epsilon * p.epsilonDecay) }));
      
      resetEpisode();
      
      // Delay before next episode so human can see "Goal" or "Death"
      gameLoopRef.current = window.setTimeout(trainingLoop, 200); 
    } else {
      // Next Step
      gameLoopRef.current = window.setTimeout(trainingLoop, params.speed);
    }
  }, [params, currentReward]);

  useEffect(() => {
    if (isPlaying) {
      isRunningRef.current = true;
      trainingLoop();
    } else {
      isRunningRef.current = false;
      if (gameLoopRef.current) clearTimeout(gameLoopRef.current);
    }
    return () => {
      isRunningRef.current = false;
      if (gameLoopRef.current) clearTimeout(gameLoopRef.current);
    };
  }, [isPlaying, trainingLoop]);

  // --- Handlers ---

  const handleReset = () => {
    setIsPlaying(false);
    qTable.current = {};
    setStats([]);
    setEpisodeCount(0);
    setParams({ ...DEFAULT_HYPERPARAMS });
    resetEpisode();
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = chatInput;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatInput("");
    setIsAiLoading(true);

    const response = await getGeminiTutorResponse(userMsg, step, stats, params);
    
    setMessages(prev => [...prev, { role: 'model', text: response }]);
    setIsAiLoading(false);
  };

  // --- Render Helpers ---

  const renderControlPanel = () => (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2 text-white">
          <Settings2 className="w-5 h-5 text-blue-400" />
          超参数 (Hyperparameters)
        </h2>
        <div className="text-xs text-gray-500 font-mono">
          EPSILON: {params.epsilon.toFixed(3)}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs text-gray-400 font-mono uppercase">速度 (Speed: {params.speed}ms)</label>
          <input 
            type="range" min="1" max="500" step="10" 
            value={501 - params.speed}
            onChange={(e) => setParams({ ...params, speed: 501 - parseInt(e.target.value) })}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>
        
        <div>
          <label className="text-xs text-gray-400 font-mono uppercase">学习率 (Learning Rate / Alpha)</label>
          <div className="flex items-center gap-2">
            <input 
              type="range" min="0.01" max="1" step="0.01" 
              value={params.learningRate}
              onChange={(e) => setParams({ ...params, learningRate: parseFloat(e.target.value) })}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
            />
            <span className="text-xs font-mono w-10 text-right">{params.learningRate.toFixed(2)}</span>
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-400 font-mono uppercase">折扣因子 (Discount Factor / Gamma)</label>
          <div className="flex items-center gap-2">
            <input 
              type="range" min="0.1" max="0.99" step="0.01" 
              value={params.discountFactor}
              onChange={(e) => setParams({ ...params, discountFactor: parseFloat(e.target.value) })}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
             <span className="text-xs font-mono w-10 text-right">{params.discountFactor.toFixed(2)}</span>
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-400 font-mono uppercase">探索率 (Exploration / Epsilon)</label>
          <div className="flex items-center gap-2">
            <input 
              type="range" min="0" max="1" step="0.1" 
              disabled={isPlaying} 
              value={params.epsilon}
              onChange={(e) => setParams({ ...params, epsilon: parseFloat(e.target.value) })}
              className={`w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500 ${isPlaying ? 'opacity-50' : ''}`}
            />
             <span className="text-xs font-mono w-10 text-right">{params.epsilon.toFixed(1)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-800">
        <button 
          onClick={() => setIsPlaying(!isPlaying)}
          className={`flex items-center justify-center gap-2 p-3 rounded-lg font-bold transition-all ${
            isPlaying 
              ? 'bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30' 
              : 'bg-green-500/20 text-green-400 border border-green-500/50 hover:bg-green-500/30'
          }`}
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          {isPlaying ? '暂停' : '开始训练'}
        </button>
        <button 
          onClick={handleReset}
          className="flex items-center justify-center gap-2 p-3 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 border border-gray-700 transition-all"
        >
          <RotateCcw className="w-4 h-4" />
          重置
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col font-sans selection:bg-blue-500/30">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/20">
              <BrainCircuit className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">强化学习实战 (RL Zero to Hero)</h1>
              <p className="text-xs text-gray-400">交互式 Q-Learning 实验室</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-1 bg-gray-900 border border-gray-800 rounded-full px-1 py-1">
              {STEPS_INFO.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                    step === i 
                      ? 'bg-blue-600 text-white shadow-md' 
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Game & Viz */}
        <div className="lg:col-span-7 space-y-6">
          {/* Tutorial Card */}
          <div className="bg-gradient-to-r from-gray-900 to-gray-850 border border-gray-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <BrainCircuit className="w-32 h-32" />
            </div>
            <div className="relative z-10">
               <div className="flex justify-between items-start mb-2">
                 <h2 className="text-2xl font-bold text-white">{STEPS_INFO[step].title}</h2>
                 <div className="flex gap-2">
                   <button 
                    disabled={step === 0}
                    onClick={() => setStep(s => s - 1)}
                    className="p-1 rounded-md hover:bg-gray-700 disabled:opacity-30"
                   >
                     <ChevronLeft className="w-5 h-5" />
                   </button>
                   <button 
                    disabled={step === STEPS_INFO.length - 1}
                    onClick={() => setStep(s => s + 1)}
                    className="p-1 rounded-md hover:bg-gray-700 disabled:opacity-30"
                   >
                     <ChevronRight className="w-5 h-5" />
                   </button>
                 </div>
               </div>
               <p className="text-gray-300 leading-relaxed max-w-2xl">
                 {STEPS_INFO[step].desc}
               </p>
            </div>
          </div>

          {/* Grid World */}
          <div className="space-y-2">
            <div className="flex justify-between items-end px-2">
              <div className="flex gap-4 text-sm font-mono text-gray-400">
                <span>回合 (Ep): <span className="text-white">{episodeCount}</span></span>
                <span>当前奖励 (Reward): <span className={`${currentReward < 0 ? 'text-red-400' : 'text-green-400'}`}>{currentReward}</span></span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="w-3 h-3 bg-blue-900/50 border border-blue-800 rounded-sm"></span> 起点
                <span className="w-3 h-3 bg-yellow-900/50 border border-yellow-800 rounded-sm ml-2"></span> 终点
                <span className="w-3 h-3 bg-red-900/50 border border-red-800 rounded-sm ml-2"></span> 陷阱
              </div>
            </div>
            <GridWorld 
              grid={INITIAL_GRID} 
              agentPos={agentPos} 
              pathTrace={pathTrace}
              qValues={qTable.current}
              showQValues={step >= TutorialStep.Q_TABLE}
            />
          </div>

          {/* Chart */}
          <TrainingChart data={stats} />
        </div>

        {/* Right Column: Controls & AI Chat */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {renderControlPanel()}

          {/* Chat Interface */}
          <div className="flex-1 bg-gray-900 border border-gray-800 rounded-xl flex flex-col overflow-hidden shadow-lg min-h-[400px]">
            <div className="p-4 border-b border-gray-800 bg-gray-850 flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-purple-400" />
                AI 导师 (AI Tutor)
              </h3>
              <span className="text-[10px] bg-purple-500/10 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/20">
                Gemini 2.5 Flash
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-lg p-3 text-sm leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-br-none' 
                      : 'bg-gray-800 text-gray-200 rounded-bl-none border border-gray-700'
                  }`}>
                    {msg.role === 'model' ? (
                       <div dangerouslySetInnerHTML={{ __html: msg.text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br/>') }} />
                    ) : (
                      msg.text
                    )}
                  </div>
                </div>
              ))}
              {isAiLoading && (
                <div className="flex justify-start">
                   <div className="bg-gray-800 rounded-lg p-3 rounded-bl-none border border-gray-700 flex gap-1">
                     <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></span>
                     <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-100"></span>
                     <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-200"></span>
                   </div>
                </div>
              )}
            </div>

            <form onSubmit={handleChatSubmit} className="p-3 border-t border-gray-800 bg-gray-850">
              <div className="relative">
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="询问关于 Q-Learning、超参数或代码的问题..."
                  className="w-full bg-gray-950 border border-gray-700 rounded-lg pl-4 pr-12 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
                <button 
                  type="submit"
                  disabled={!chatInput.trim() || isAiLoading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;