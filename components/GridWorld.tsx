import React from 'react';
import { CellType, GridConfig, Position } from '../types';
import { Bot, Trophy, Skull, Ban, Footprints } from 'lucide-react';

interface GridWorldProps {
  grid: GridConfig;
  agentPos: Position;
  pathTrace: Position[];
  qValues: Record<string, number[]>;
  showQValues: boolean;
}

const GridWorld: React.FC<GridWorldProps> = ({ grid, agentPos, pathTrace, qValues, showQValues }) => {
  
  const getCellColor = (type: CellType) => {
    switch (type) {
      case CellType.WALL: return 'bg-gray-800 border-gray-700';
      case CellType.START: return 'bg-blue-900/30 border-blue-800';
      case CellType.GOAL: return 'bg-yellow-900/30 border-yellow-700';
      case CellType.PIT: return 'bg-red-900/30 border-red-800';
      default: return 'bg-gray-900 border-gray-800';
    }
  };

  const getQColor = (val: number) => {
    // Visualizing Q-value intensity
    if (val === 0) return 'text-gray-600';
    if (val > 0) return `text-green-${Math.min(500, 300 + Math.floor(val * 10))}`;
    return `text-red-${Math.min(500, 300 + Math.floor(Math.abs(val) * 10))}`;
  };

  return (
    <div className="relative p-4 bg-gray-950 rounded-xl shadow-2xl border border-gray-800 overflow-hidden">
      <div 
        className="grid gap-1"
        style={{ 
          gridTemplateColumns: `repeat(${grid.width}, minmax(0, 1fr))`,
        }}
      >
        {grid.layout.map((row, y) => (
          row.map((cellType, x) => {
            const isAgent = agentPos.x === x && agentPos.y === y;
            const isTrace = !isAgent && pathTrace.some(p => p.x === x && p.y === y);
            const stateKey = `${x},${y}`;
            const cellQ = qValues[stateKey] || [0, 0, 0, 0]; // Up, Down, Left, Right

            return (
              <div 
                key={`${x}-${y}`}
                className={`
                  aspect-square rounded-md border flex items-center justify-center relative group
                  ${getCellColor(cellType)}
                  transition-colors duration-200
                `}
              >
                {/* Background Path Trace */}
                {isTrace && (
                  <div className="absolute inset-0 opacity-20 bg-blue-500 rounded-full scale-50 animate-pulse" />
                )}

                {/* Icons */}
                {cellType === CellType.WALL && <Ban className="w-6 h-6 text-gray-700" />}
                {cellType === CellType.GOAL && <Trophy className="w-8 h-8 text-yellow-500 animate-bounce" />}
                {cellType === CellType.PIT && <Skull className="w-8 h-8 text-red-500" />}
                {cellType === CellType.START && !isAgent && <div className="text-xs text-blue-400 font-mono">起点</div>}

                {/* The Agent */}
                {isAgent && (
                  <div className="z-10 relative">
                    <Bot className="w-8 h-8 text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)] transition-all duration-100" />
                  </div>
                )}

                {/* Q-Value Overlay (Debug View) */}
                {showQValues && cellType === CellType.EMPTY && (
                  <div className="absolute inset-0 text-[8px] font-mono flex flex-col justify-between items-center p-0.5 opacity-60">
                    <span className={getQColor(cellQ[0])}>{cellQ[0].toFixed(1)}</span> {/* UP */}
                    <div className="flex justify-between w-full px-1">
                      <span className={getQColor(cellQ[2])}>{cellQ[2].toFixed(1)}</span> {/* LEFT */}
                      <span className={getQColor(cellQ[3])}>{cellQ[3].toFixed(1)}</span> {/* RIGHT */}
                    </div>
                    <span className={getQColor(cellQ[1])}>{cellQ[1].toFixed(1)}</span> {/* DOWN */}
                  </div>
                )}
              </div>
            );
          })
        ))}
      </div>
    </div>
  );
};

export default GridWorld;