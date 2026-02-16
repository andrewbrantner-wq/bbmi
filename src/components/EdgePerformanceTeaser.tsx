"use client";

import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Link from 'next/link';

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
  label: string;
};

type WeekDataPoint = {
  week: string;
  [key: string]: string | number | null;
};

type CategoryStat = {
  category: string;
  winPct: string;
  games: number;
  color: string;
};

type EdgePerformanceTeaserProps = {
  games: Game[];
};

/* -------------------------------------------------------
   COMPONENT
-------------------------------------------------------- */
const EdgePerformanceTeaser: React.FC<EdgePerformanceTeaserProps> = ({ games }) => {
  const { chartData, overallStats } = useMemo(() => {
    if (!games || games.length === 0) return { chartData: [], overallStats: null };

    // Define edge categories
    const edgeCategories: EdgeCategory[] = [
      { name: '≤4.5 pts', min: 0, max: 4.5, color: '#94a3b8', label: 'Low Edge' },
      { name: '4.5-7.5 pts', min: 4.5, max: 7.5, color: '#3b82f6', label: 'Medium Edge' },
      { name: '≥7.5 pts', min: 7.5, max: Infinity, color: '#1e40af', label: 'High Edge' }
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
    
    if (allDates.length === 0) return { chartData: [], overallStats: null };
    
    // Create week ranges (7-day periods)
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
      gamesByWeek[weekNum] = completedGames.filter(game => {
        if (!game.date) return false;
        const gameDateStr = game.date.split('T')[0].split(' ')[0];
        return gameDateStr >= currentStart && gameDateStr <= currentEnd;
      });
      
      currentStart = addDays(currentStart, 7);
      weekNum++;
    }

    // Get last 6 weeks that have games
    const weeksWithGames = Object.entries(gamesByWeek)
      .filter(([_, games]) => games.length > 0)
      .map(([week, _]) => week);
    
    const sortedWeeks = weeksWithGames.sort((a, b) => parseInt(a) - parseInt(b)).slice(-6);

    // Calculate weekly data
    const weeklyData: WeekDataPoint[] = sortedWeeks.map(week => {
      const weekGames = gamesByWeek[parseInt(week)];
      const dataPoint: WeekDataPoint = { week: `Wk ${week}` };

      edgeCategories.forEach(category => {
        const categoryGames = weekGames.filter(game => {
          const absEdge = Math.abs((game.bbmiHomeLine ?? 0) - (game.vegasHomeLine ?? 0));
          return absEdge >= category.min && absEdge < category.max;
        });

        if (categoryGames.length > 0) {
          const wins = categoryGames.filter(game => Number(game.fakeWin) > 0).length;
          const winPct = (wins / categoryGames.length) * 100;
          dataPoint[category.name] = parseFloat(winPct.toFixed(1));
        } else {
          dataPoint[category.name] = null;
        }
      });

      return dataPoint;
    });

    // Calculate overall stats for each category (all-time)
    const categoryStats: CategoryStat[] = edgeCategories.map(category => {
      const categoryGames = completedGames.filter(game => {
        const absEdge = Math.abs((game.bbmiHomeLine ?? 0) - (game.vegasHomeLine ?? 0));
        return absEdge >= category.min && absEdge < category.max;
      });

      if (categoryGames.length > 0) {
        const wins = categoryGames.filter(game => Number(game.fakeWin) > 0).length;
        const winPct = (wins / categoryGames.length) * 100;
        return {
          category: category.label,
          winPct: winPct.toFixed(1),
          games: categoryGames.length,
          color: category.color
        };
      }
      return null;
    }).filter((stat): stat is CategoryStat => stat !== null);

    return { chartData: weeklyData, overallStats: categoryStats };
  }, [games]);

  if (!chartData || chartData.length === 0) {
    return null;
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-gray-50 rounded-lg shadow-lg p-6 mb-8">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">
          Higher Edge = Higher Win Rate
        </h2>
        <p className="text-gray-600">
          Our model's edge over Vegas odds directly predicts success
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {overallStats && overallStats.map((stat, idx) => (
          <div 
            key={idx}
            className="bg-white rounded-lg p-4 text-center shadow-sm border-l-4"
            style={{ borderLeftColor: stat.color }}
          >
            <div className="text-sm text-gray-600 mb-1">{stat.category}</div>
            <div className="text-2xl font-bold" style={{ color: stat.color }}>
              {stat.winPct}%
            </div>
            <div className="text-xs text-gray-500">{stat.games} games</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white rounded-lg p-4 mb-4">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="week" 
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
            />
            <YAxis 
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
              domain={[0, 100]}
              ticks={[0, 50, 100]}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'white', 
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '12px'
              }}
            />
            <Line
              type="monotone"
              dataKey="≤4.5 pts"
              stroke="#94a3b8"
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="4.5-7.5 pts"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="≥7.5 pts"
              stroke="#1e40af"
              strokeWidth={3}
              dot={{ r: 4 }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
        
        {/* Custom Horizontal Legend */}
        <div className="flex justify-center gap-6 mt-4 pt-3 border-t border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-[#94a3b8]"></div>
            <span className="text-sm text-gray-700">≤4.5 pts</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-[#3b82f6]"></div>
            <span className="text-sm text-gray-700">4.5-7.5 pts</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-1 bg-[#1e40af]"></div>
            <span className="text-sm font-semibold text-gray-700">≥7.5 pts</span>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-blue-600 rounded-lg p-6 text-white text-center">
        <h3 className="text-xl font-bold mb-2">
          Get Today's Highest Edge Picks
        </h3>
        <p className="mb-4 text-blue-100">
          Premium subscribers get access to all picks, with our strongest edges highlighted daily
        </p>
        <div className="flex gap-4 justify-center">
          <Link 
            href="/subscribe" 
            className="bg-white text-blue-600 px-6 py-3 rounded-lg font-bold hover:bg-blue-50 transition-colors"
          >
            Start 7-Day Trial - $15
          </Link>
          <Link 
            href="/ncaa-model-picks-history" 
            className="bg-blue-700 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-800 transition-colors border border-blue-400"
          >
            See Full Performance
          </Link>
        </div>
      </div>
    </div>
  );
};

export default EdgePerformanceTeaser;
