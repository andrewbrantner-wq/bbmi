"use client";

import { useState, useEffect } from "react";

type FeedbackItem = {
  id: number;
  category: string;
  message: string;
  created_at: string;
};

export default function AdminFeedbackPage() {
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");

  const categories = ["General", "Bug", "Feature Request", "Data Issue", "UI/Design"];

  const handleLogin = async () => {
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/feedback", {
        method: "GET",
        headers: {
          "x-admin-password": password,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setFeedback(data.feedback || []);
        setIsAuthenticated(true);
      } else {
        setError("Invalid password");
      }
    } catch (err) {
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!isAuthenticated) return;
    
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/feedback", {
        method: "GET",
        headers: {
          "x-admin-password": password,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setFeedback(data.feedback || []);
      } else {
        setError("Failed to refresh");
      }
    } catch (err) {
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  const filteredFeedback = filterCategory === "all"
    ? feedback
    : feedback.filter((item) => item.category === filterCategory);

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Bug":
        return "bg-red-100 text-red-800";
      case "Feature Request":
        return "bg-blue-100 text-blue-800";
      case "Data Issue":
        return "bg-yellow-100 text-yellow-800";
      case "UI/Design":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-stone-100 text-stone-800";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
          <h1 className="text-2xl font-bold mb-6 text-center">Admin Login</h1>
          
          <input
            type="password"
            placeholder="Enter admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            className="w-full px-4 py-2 border border-stone-300 rounded-md mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
          />

          {error && (
            <p className="text-red-600 text-sm mb-4">{error}</p>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-stone-300 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold">Feedback Dashboard</h1>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-stone-300 transition-colors"
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <label className="text-sm font-semibold text-stone-700">
              Filter by Category:
            </label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="border border-stone-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <p className="text-sm text-stone-600">
            Showing <span className="font-semibold">{filteredFeedback.length}</span> of{" "}
            <span className="font-semibold">{feedback.length}</span> submissions
          </p>

          {error && (
            <p className="text-red-600 text-sm mt-4">{error}</p>
          )}
        </div>

        {filteredFeedback.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <p className="text-stone-500 text-lg">No feedback yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredFeedback.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-stone-500">
                      #{item.id}
                    </span>
                    <span
                      className={`text-xs font-semibold px-3 py-1 rounded-full ${getCategoryColor(
                        item.category
                      )}`}
                    >
                      {item.category}
                    </span>
                  </div>
                  <span className="text-sm text-stone-500">
                    {formatDate(item.created_at)}
                  </span>
                </div>

                <p className="text-stone-800 whitespace-pre-wrap leading-relaxed">
                  {item.message}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
