"use client";

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface EloGraphProps {
  data: { date: string; rating: number }[];
}

export default function EloGraph({ data }: EloGraphProps) {
  if (!data || data.length === 0) return <div className="h-48 flex items-center justify-center text-[var(--text-muted)] text-sm">No rating data available</div>;

  return (
    <div className="w-full h-64 mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorRating" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--text-primary)" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="var(--text-primary)" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="date" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }} 
            minTickGap={30}
          />
          <YAxis 
            domain={['dataMin - 50', 'dataMax + 50']} 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }} 
          />
          <Tooltip 
            contentStyle={{ backgroundColor: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
            itemStyle={{ color: 'var(--text-primary)', fontWeight: 'bold' }}
            labelStyle={{ color: 'var(--text-muted)', marginBottom: '4px' }}
          />
          <Area 
            type="monotone" 
            dataKey="rating" 
            stroke="var(--text-primary)" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorRating)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
