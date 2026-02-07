"use client";

import { useState } from "react";
import BBMILogo from "@/components/BBMILogo";

const categories = [
  "General",
  "Bug",
  "Feature Request",
  "Data Issue",
  "UI/Design",
];

export default function FeedbackPage() {
  const [category, setCategory] = useState(categories[0]);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim()) {
      setErrorMessage("Please enter your feedback");
      return;
    }

    setStatus("submitting");
    setErrorMessage("");

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          category,
          message: message.trim(),
        }),
      });

      if (response.ok) {
        setStatus("success");
        setMessage("");
        setTimeout(() => setStatus("idle"), 3000);
      } else {
        const data = await response.json();
        setErrorMessage(data.error || "Failed to submit feedback");
        setStatus("error");
      }
    } catch (error) {
      setErrorMessage("Failed to connect to server");
      setStatus("error");
    }
  };

  return (
    <div className="section-wrapper">
      <div className="w-full max-w-2xl mx-auto px-6 py-8">
        <div className="mt-10 flex flex-col items-center mb-6">
          <BBMILogo />
          <h1 className="text-3xl font-bold mb-4">Feedback</h1>
          <p className="text-stone-600 mb-8 text-center">
            Help us improve BBMI Hoops by sharing your thoughts, reporting bugs, or suggesting features!
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Category */}
            <div>
              <label
                htmlFor="category"
                className="block text-sm font-semibold text-stone-700 mb-2"
              >
                Category
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2 border border-stone-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Message */}
            <div>
              <label
                htmlFor="message"
                className="block text-sm font-semibold text-stone-700 mb-2"
              >
                Your Feedback
              </label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what's on your mind..."
                rows={6}
                maxLength={5000}
                className="w-full px-4 py-2 border border-stone-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              />
              <p className="text-xs text-stone-500 mt-1">
                {message.length} / 5000 characters
              </p>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                {errorMessage}
              </div>
            )}

            {/* Success Message */}
            {status === "success" && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm">
                Thank you for your feedback! We appreciate your input.
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={status === "submitting"}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-md font-semibold hover:bg-blue-700 disabled:bg-stone-300 disabled:cursor-not-allowed transition-colors"
            >
              {status === "submitting" ? "Submitting..." : "Submit Feedback"}
            </button>
          </form>
        </div>

        <p className="text-xs text-stone-500 mt-6 text-center">
          Your feedback is anonymous. We use it to improve BBMI Hoops.
        </p>
      </div>
    </div>
  );
}
