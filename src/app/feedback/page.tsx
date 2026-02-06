"use client";

import { useState } from "react";
import Link from "next/link";
import BBMILogo from "@/components/BBMILogo";

export default function FeedbackPage() {
  const [feedback, setFeedback] = useState("");
  const [category, setCategory] = useState("general");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!feedback.trim()) {
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
          feedback: feedback.trim(),
          category,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit feedback");
      }

      setStatus("success");
      setFeedback("");
      setCategory("general");
      
      // Reset success message after 5 seconds
      setTimeout(() => setStatus("idle"), 5000);
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong");
    }
  };

  return (
    <div className="section-wrapper">
      <div className="w-full max-w-[800px] mx-auto px-6 py-8">
        
        {/* Header */}
        <div className="mt-10 flex flex-col items-center mb-8">
          <BBMILogo />
          <h1 className="text-3xl font-bold tracking-tightest leading-tight mt-4">
            Share Your Feedback
          </h1>
          <p className="text-stone-600 text-center mt-2 max-w-xl">
            Your feedback helps improve BBMI. All submissions are completely anonymous.
          </p>
        </div>

        {/* Back Button */}
        <div className="mb-6">
          <Link
            href="/"
            className="text-sm text-blue-600 hover:underline"
          >
            ← Back to Home
          </Link>
        </div>

        {/* Feedback Form */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <form onSubmit={handleSubmit}>
            
            {/* Category Selection */}
            <div className="mb-4">
              <label htmlFor="category" className="block text-sm font-semibold text-stone-700 mb-2">
                Category
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2 border border-stone-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                disabled={status === "submitting"}
              >
                <option value="general">General Feedback</option>
                <option value="bug">Bug Report</option>
                <option value="feature">Feature Request</option>
                <option value="data">Data Issue</option>
                <option value="ui">UI/Design</option>
              </select>
            </div>

            {/* Feedback Textarea */}
            <div className="mb-4">
              <label htmlFor="feedback" className="block text-sm font-semibold text-stone-700 mb-2">
                Your Feedback
              </label>
              <textarea
                id="feedback"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Share your thoughts, report bugs, or suggest improvements..."
                rows={8}
                maxLength={5000}
                className="w-full px-4 py-2 border border-stone-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y"
                disabled={status === "submitting"}
              />
              <div className="text-xs text-stone-500 mt-1 text-right">
                {feedback.length} / 5000 characters
              </div>
            </div>

            {/* Status Messages */}
            {status === "success" && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-green-800 text-sm">
                ✓ Thank you! Your feedback has been submitted successfully.
              </div>
            )}

            {status === "error" && errorMessage && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">
                ✗ {errorMessage}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={status === "submitting" || !feedback.trim()}
              className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:bg-stone-300 disabled:cursor-not-allowed transition-colors"
            >
              {status === "submitting" ? "Submitting..." : "Submit Feedback"}
            </button>
          </form>

          {/* Privacy Notice */}
          <div className="mt-6 pt-6 border-t border-stone-200">
            <p className="text-xs text-stone-600 leading-relaxed">
              <strong>Privacy:</strong> Your feedback is completely anonymous. We do not collect any personally identifiable information. 
              A hashed IP address is used only for rate limiting to prevent spam.
            </p>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-8 text-center">
          <p className="text-sm text-stone-600">
            Want to discuss feedback publicly?{" "}
            <a 
              href="https://github.com/yourusername/bbmihoops/issues" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Open a GitHub issue
            </a>
          </p>
        </div>

      </div>
    </div>
  );
}
