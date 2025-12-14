import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrainingStats } from '../types';

interface Props {
  data: TrainingStats[];
}

const TrainingChart: React.FC<Props> = ({ data }) => {
  return (
    <div className="h-48 w-full bg-gray-900/50 rounded-lg p-2 border border-gray-800">
      <h3 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">奖励历史 (Reward History)</h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            dataKey="episode" 
            stroke="#9ca3af" 
            fontSize={10} 
            tickLine={false}
          />
          <YAxis 
            stroke="#9ca3af" 
            fontSize={10} 
            tickLine={false}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', fontSize: '12px' }}
            itemStyle={{ color: '#60a5fa' }}
            labelStyle={{ color: '#9ca3af' }}
          />
          <Line 
            type="monotone" 
            dataKey="totalReward" 
            stroke="#3b82f6" 
            strokeWidth={2} 
            dot={false}
            animationDuration={300}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TrainingChart;