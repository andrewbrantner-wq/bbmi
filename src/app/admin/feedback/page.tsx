"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import BBMILogo from "@/components/BBMILogo";

type FeedbackSubmission = {
  id: string;
  feedback: string;
  category: string;
  timestamp: string;
  ipHash: string;
};

export default function AdminFeedbackPage() {
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [submissions, setSubmissions] = useState<FeedbackSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/feedback?password=${encodeURIComponent(password)}`);
      
      if (!response.ok) {
        throw new Error("Invalid password");
      }

      const data = await response.json();
      setSubmissions(data.submissions || []);
      setIsAuthenticated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!password) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/feedback?password=${encodeURIComponent(password)}`);
      const data = await response.json();
      setSubmissions(data.submissions || []);
    } catch (err) {
      setError("Failed to refresh");
    } finally {
      setLoading(false);
    }
  };

  const filteredSubmissions = submissions.filter(s => 
    filter === "all" || s.category === filter
  );

  const sortedSubmissions = [...filteredSubmissions].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const categoryColors: Record<string, string> = {
    general: "bg-stone-100 text-stone-800",
    bug: "bg-red-100 text-red-800",
    feature: "bg-blue-100 text-blue-800",
    data: "bg-purple-100 text-purple-800",
    ui: "bg-green-100 text-green-800",
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  if (!isAuthenticated) {
    return (
      <div className="section-wrapper">
        <div className="w-full max-w-[500px] mx-auto px-6 py-8">
          <div className="mt-10 flex flex-col items-center mb-8">
            <BBMILogo />
            <h1 className="text-3xl font-bold tracking-tightest leading-tight mt-4">
              Admin: Feedback
            </h1>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <form onSubmit={handleLogin}>
              <div className="mb-4">
                <label htmlFor="password" className="block text-sm font-semibold text-stone-700 mb-2">
                  Admin Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  className="w-full px-4 py-2 border border-stone-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  autoFocus
                />
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !password}
                className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:bg-stone-300 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Authenticating..." : "Login"}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-stone-200">
              <p className="text-xs text-stone-600">
                <strong>Setup:</strong> Set ADMIN_PASSWORD environment variable in your .env.local file
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="section-wrapper">
      <div className="w-full max-w-[1200px] mx-auto px-6 py-8">
        
        {/* Header */}
        <div className="mt-10 flex flex-col items-center mb-8">
          <BBMILogo />
          <h1 className="text-3xl font-bold tracking-tightest leading-tight mt-4">
            Feedback Submissions
          </h1>
          <p className="text-stone-600 mt-2">
            Total: {submissions.length} submissions
          </p>
        </div>

        {/* Controls */}
        <div className="mb-6 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-2">
            <Link
              href="/"
              className="px-4 py-2 text-sm text-blue-600 hover:underline"
            >
              ← Back to Home
            </Link>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="px-4 py-2 text-sm bg-stone-100 hover:bg-stone-200 rounded-md transition-colors disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {/* Filter */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 text-sm border border-stone-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="all">All Categories ({submissions.length})</option>
            <option value="general">General ({submissions.filter(s => s.category === 'general').length})</option>
            <option value="bug">Bugs ({submissions.filter(s => s.category === 'bug').length})</option>
            <option value="feature">Features ({submissions.filter(s => s.category === 'feature').length})</option>
            <option value="data">Data ({submissions.filter(s => s.category === 'data').length})</option>
            <option value="ui">UI/Design ({submissions.filter(s => s.category === 'ui').length})</option>
          </select>
        </div>

        {/* Submissions List */}
        <div className="space-y-4">
          {sortedSubmissions.length === 0 && (
            <div className="bg-white rounded-xl shadow-md p-8 text-center text-stone-500">
              No feedback submissions yet.
            </div>
          )}

          {sortedSubmissions.map((submission) => (
            <div key={submission.id} className="bg-white rounded-xl shadow-md p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${categoryColors[submission.category] || categoryColors.general}`}>
                    {submission.category}
                  </span>
                  <span className="text-xs text-stone-500">
                    {formatDate(submission.timestamp)}
                  </span>
                </div>
                <span className="text-xs text-stone-400 font-mono">
                  ID: {submission.id.slice(0, 8)}
                </span>
              </div>

              {/* Feedback Content */}
              <div className="text-stone-800 whitespace-pre-wrap leading-relaxed">
                {submission.feedback}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
