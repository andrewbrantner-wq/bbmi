"use client";

import BBMILogo from "@/components/BBMILogo";

export default function AboutPage() {
  return (
    <div className="min-h-screen w-full bg-stone-100 flex justify-center">
      <div className="w-full max-w-[1600px] px-6 py-12">

        {/* Header */}
        <div className="flex flex-col items-center mb-12">
          <BBMILogo />
          <h1 className="text-3xl font-bold tracking-tightest leading-tight mt-4">
            The Brantner Basketball Model Index
          </h1>
        </div>

        {/* CARD WRAPPER (forces contrast) */}
        <div className="w-full flex justify-center mb-10">
          <div className="w-full max-w-3xl bg-white rounded-xl shadow-lg p-8">
            <p className="text-stone-800 leading-relaxed mb-4">
              The BBMI began as a light‑hearted attempt to gain an edge in a family NCAA bracket
              challenge, but it quickly evolved into a genuine modeling project. What started as a
              fun experiment turned into something more structured once I realized how well the
              approach translated to basketball analytics.
            </p>

            <p className="text-stone-800 leading-relaxed mb-4">
              As an actuary, I’ve spent decades building predictive models designed to forecast
              future healthcare costs and revenue. Many of the same principles—data quality,
              variable selection, calibration, and validation—apply surprisingly well to sports.
              During development, I noticed that the BBMI’s projected game lines were often more
              accurate than several publicly available Vegas models. That observation sparked the
              idea for this site.
            </p>

            <p className="text-stone-800 leading-relaxed mb-4">
              The goal is straightforward: publish the model’s predictions and track them against
              actual results to see whether the BBMI can outperform the Vegas line more than 50% of
              the time. Everything is transparent, measurable, and updated continuously so the model
              can be evaluated honestly.
            </p>

            <p className="text-stone-800 leading-relaxed">
              The BBMI has also been extended to WIAA basketball. Accuracy will naturally be lower
              in this space due to inconsistent, self‑reported team statistics, but the intent is
              the same—use data to create a structured, objective view of team performance. Even
              with imperfect inputs, the WIAA model offers a fun and informative way to explore high
              school basketball analytics.
            </p>
          </div>
        </div>

{/* Model Methodology */}
<div className="w-full flex justify-center mb-10">
  <div className="w-full max-w-3xl bg-white rounded-xl shadow-lg p-8">
    <h2 className="text-2xl font-semibold tracking-tightest mb-4 text-center">
      Model Methodology
    </h2>

            <p className="text-stone-800 leading-relaxed mb-4">
              The BBMI is built on the same foundational principles used in actuarial forecasting:
              clean data, thoughtful variable selection, and rigorous validation. The model evaluates
              team strength using a blend of historical performance, opponent quality, scoring
              efficiency, and situational factors. These inputs are transformed into projected game
              lines and win probabilities, which are then compared against actual outcomes to measure
              accuracy over time.
            </p>

            <p className="text-stone-800 leading-relaxed">
              Rather than relying on a single metric, the BBMI uses a layered approach—each component
              contributes a small but meaningful signal. The goal isn’t perfection; it’s consistency.
              By applying actuarial discipline to sports analytics, the model aims to produce stable,
              repeatable predictions that can be evaluated transparently.
            </p>
          </div>
        </div>

        {/* Contact / Feedback */}
<div className="w-full flex justify-center mb-10">
  <div className="w-full max-w-3xl bg-white rounded-xl shadow-lg p-8">
    <h2 className="text-2xl font-semibold tracking-tightest mb-4 text-center">
      Contact / Feedback
    </h2>

            <p className="text-stone-800 leading-relaxed mb-4">
              A dedicated feedback form will be available soon. You’ll be able to submit questions,
              suggestions, or ideas directly through the site without needing to use email.
            </p>

            <p className="text-stone-800 leading-relaxed">
              Until then, thank you for exploring the BBMI project — your interest and feedback help
              shape its future.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}