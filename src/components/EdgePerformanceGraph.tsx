"use client";

import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

/* -------------------------------------------------------
   TYPES
-------------------------------------------------------- */
type Game = {
  date: string | null;
  away: string | number | null;
  home: string | number | null;
  vegasHomeLine: number | null;
  bbmiHomeLine: number | null;
  actualAwayScore: number | null;
  actualHomeScore: number | null;
  fakeBet: string | number | null;
  fakeWin: number | null;
};

type EdgeCategory = {
  name: string;
  min: number;
  max: number;
  color: string;
};

type WeekDataPoint = {
  week: string;
  [key: string]: string | number | null; // For dynamic edge category keys
};

type EdgePerformanceGraphProps = {
  games: Game[];
  weeksToShow?: number | null;
  showTitle?: boolean;
};

/* -------------------------------------------------------
   COMPONENT
-------------------------------------------------------- */
const EdgePerformanceGraph: React.FC<EdgePerformanceGraphProps> = ({ 
  games, 
  weeksToShow = null, 
  showTitle = true 
}) => {
  const edgeData = useMemo(() => {
    if (!games || games.length === 0) return { weeklyData: [], edgeCategories: [] };

    // Define edge categories
    const edgeCategories: EdgeCategory[] = [
      { name: '≤2 pts', min: 0, max: 2, color: '#cbd5e1' },
      { name: '2-4 pts', min: 2, max: 4, color: '#94a3b8' },
      { name: '4-6 pts', min: 4, max: 6, color: '#64748b' },
      { name: '6-8 pts', min: 6, max: 8, color: '#3b82f6' },
      { name: '>8 pts', min: 8, max: Infinity, color: '#1e40af' }
    ];

    // Filter to only completed games with actual scores
    const completedGames = games.filter(game => 
      game.actualHomeScore !== null && 
      game.actualAwayScore !== null &&
      game.actualHomeScore !== 0 &&
      Number(game.fakeBet) > 0
    );

    // Group by week (7-day periods based on dates)
    const gamesByWeek: Record<number, Game[]> = {};
    
    // Get all dates and sort them
    const allDates = completedGames
      .map(g => g.date ? g.date.split('T')[0].split(' ')[0] : null)
      .filter((d): d is string => d !== null)
      .sort();
    
    if (allDates.length === 0) return { weeklyData: [], edgeCategories };
    
    // Create week ranges
    const addDays = (dateStr: string, days: number): string => {
      const [y, m, d] = dateStr.split('-').map(Number);
      const date = new Date(Date.UTC(y, m - 1, d));
      date.setUTCDate(date.getUTCDate() + days);
      return date.toISOString().slice(0, 10);
    };
    
    let currentStart = allDates[0];
    let weekNum = 1;
    
    while (currentStart <= allDates[allDates.length - 1]) {
      const currentEnd = addDays(currentStart, 6);
      const weekGames = completedGames.filter(game => {
        if (!game.date) return false;
        const gameDateStr = game.date.split('T')[0].split(' ')[0];
        return gameDateStr >= currentStart && gameDateStr <= currentEnd;
      });
      
      if (weekGames.length > 0) {
        gamesByWeek[weekNum] = weekGames;
      }
      
      currentStart = addDays(currentStart, 7);
      weekNum++;
    }

    // Sort weeks and exclude week 1
    const sortedWeeks = Object.keys(gamesByWeek)
      .map(Number)
      .filter(week => week > 1)  // Exclude week 1
      .sort((a, b) => a - b);

    // Limit weeks if specified
    const weeksToProcess = weeksToShow 
      ? sortedWeeks.slice(-weeksToShow)
      : sortedWeeks;

    // Calculate win% for each edge category by week
    const weeklyData: WeekDataPoint[] = weeksToProcess.map(week => {
      const weekGames = gamesByWeek[week];
      const dataPoint: WeekDataPoint = { week: `Week ${week}` };

      edgeCategories.forEach(category => {
        const categoryGames = weekGames.filter(game => {
          const absEdge = Math.abs((game.bbmiHomeLine ?? 0) - (game.vegasHomeLine ?? 0));
          return absEdge >= category.min && absEdge < category.max;
        });

        if (categoryGames.length > 0) {
          const wins = categoryGames.filter(game => Number(game.fakeWin) > 0).length;
          const winPct = (wins / categoryGames.length) * 100;
          dataPoint[category.name] = parseFloat(winPct.toFixed(1));
          dataPoint[`${category.name}_count`] = categoryGames.length;
        } else {
          dataPoint[category.name] = null;
          dataPoint[`${category.name}_count`] = 0;
        }
      });

      return dataPoint;
    });

    return { weeklyData, edgeCategories };
  }, [games, weeksToShow]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length > 0) {
      return (
        <div className="bg-white p-4 border border-gray-300 rounded shadow-lg">
          <p className="font-bold mb-2">{label}</p>
          {payload.map((entry: any, index: number) => {
            const countKey = `${entry.name}_count`;
            const count = entry.payload[countKey];
            if (entry.value !== null && count > 0) {
              return (
                <p key={index} style={{ color: entry.color }}>
                  {entry.name}: {entry.value}% ({count} games)
                </p>
              );
            }
            return null;
          })}
        </div>
      );
    }
    return null;
  };

  if (!edgeData.weeklyData || edgeData.weeklyData.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No data available for edge performance analysis
      </div>
    );
  }

  return (
    <div className="w-full flex justify-center">
      <div className="w-full" style={{ maxWidth: '1100px' }}>
        {showTitle && (
          <h3 className="text-2xl font-bold mb-4 text-gray-800">
            Winning Percentage by Edge Size
          </h3>
        )}
        <ResponsiveContainer width="100%" height={400}>
        <LineChart
          data={edgeData.weeklyData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="week" 
            stroke="#6b7280"
            style={{ fontSize: '14px' }}
          />
          <YAxis 
            stroke="#6b7280"
            style={{ fontSize: '14px' }}
            domain={[50, 100]}
            ticks={[50, 60, 70, 80, 90, 100]}
            label={{ value: 'Win %', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine 
            y={50} 
            stroke="#dc2626" 
            strokeDasharray="3 3"
            strokeWidth={2}
          />
          {edgeData.edgeCategories.map((category, idx) => (
            <Line
              key={category.name}
              type="monotone"
              dataKey={category.name}
              stroke={category.color}
              strokeWidth={idx === edgeData.edgeCategories.length - 1 ? 3 : 2}
              dot={{ r: idx === edgeData.edgeCategories.length - 1 ? 5 : 4 }}
              activeDot={{ r: idx === edgeData.edgeCategories.length - 1 ? 7 : 6 }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      
      {/* Custom Legend with Break-even Line */}
      <div className="flex flex-wrap justify-center gap-6 mt-6">
        <div className="flex items-center gap-2">
          <div className="w-6 h-1 rounded" style={{ backgroundColor: '#cbd5e1' }}></div>
          <span className="text-sm font-medium" style={{ color: '#cbd5e1' }}>≤2 pts</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-1 rounded" style={{ backgroundColor: '#94a3b8' }}></div>
          <span className="text-sm font-medium" style={{ color: '#94a3b8' }}>2-4 pts</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-1 rounded" style={{ backgroundColor: '#64748b' }}></div>
          <span className="text-sm font-medium" style={{ color: '#64748b' }}>4-6 pts</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-1 rounded" style={{ backgroundColor: '#3b82f6' }}></div>
          <span className="text-sm font-semibold" style={{ color: '#3b82f6' }}>6-8 pts</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-1.5 rounded" style={{ backgroundColor: '#1e40af' }}></div>
          <span className="text-sm font-bold" style={{ color: '#1e40af' }}>&gt;8 pts</span>
        </div>
        {/* Break-even line in legend */}
        <div className="flex items-center gap-2">
          <svg width="24" height="2" className="mt-0.5">
            <line x1="0" y1="1" x2="24" y2="1" stroke="#dc2626" strokeWidth="2" strokeDasharray="3,3" />
          </svg>
          <span className="text-sm font-semibold text-red-600">Break-even (50%)</span>
        </div>
      </div>
      <div className="mt-4 text-sm text-gray-600 text-center">
        <p>Higher edge games show stronger predictive performance</p>
      </div>
      </div>
    </div>
  );
};

export default EdgePerformanceGraph;
