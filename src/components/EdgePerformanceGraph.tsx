"use client";

import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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
      { name: '≤4.5 pts', min: 0, max: 4.5, color: '#94a3b8' },
      { name: '4.5-7.5 pts', min: 4.5, max: 7.5, color: '#3b82f6' },
      { name: '≥7.5 pts', min: 7.5, max: Infinity, color: '#1e40af' }
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

    // Sort weeks
    const sortedWeeks = Object.keys(gamesByWeek)
      .map(Number)
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
    <div className="w-full">
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
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            label={{ value: 'Win %', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            verticalAlign="bottom" 
            height={36}
            wrapperStyle={{ paddingTop: '20px' }}
          />
          {edgeData.edgeCategories.map(category => (
            <Line
              key={category.name}
              type="monotone"
              dataKey={category.name}
              stroke={category.color}
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-4 text-sm text-gray-600 text-center">
        <p>Higher edge games show stronger predictive performance</p>
      </div>
    </div>
  );
};

export default EdgePerformanceGraph;
