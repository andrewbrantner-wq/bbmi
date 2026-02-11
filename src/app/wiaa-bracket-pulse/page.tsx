"use client";

import { useState } from "react";
import Link from "next/link";
import LogoBadge from "@/components/LogoBadge";
import WIAABracketPulseTable from "@/components/WIAABracketPulseTable";

export default function WIAABracketPulsePage() {
  const [selectedDivision, setSelectedDivision] = useState<string>("");

  return (
    <div className="section-wrapper">
      <div className="mt-10 flex flex-col items-center mb-6">
        <h1 className="flex items-center text-3xl font-bold tracking-tightest leading-tight mb-8">
          <LogoBadge league="wiaa" className="h-8 mr-3" />
          <span>WIAA Tournament Seed and Result Probabilities</span>
        </h1>

        {/* Division Selector */}
        <div className="mb-8">
          <label htmlFor="division-select" className="block text-sm font-medium text-stone-700 mb-2">
            Select Division:
          </label>
          <select
            id="division-select"
            value={selectedDivision}
            onChange={(e) => setSelectedDivision(e.target.value)}
            className="h-10 w-64 text-base tracking-tight rounded-md border border-stone-300 bg-white text-stone-900 px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Choose Division --</option>
            <option value="1">Division 1</option>
            <option value="2">Division 2</option>
            <option value="3">Division 3</option>
            <option value="4">Division 4</option>
            <option value="5">Division 5</option>
          </select>
        </div>

        {/* MAIN BRACKET TABLE - Only show when division is selected */}
        {selectedDivision ? (
          <section className="w-full mt-12">
            <div className="rankings-table mb-10 overflow-hidden border border-stone-200 rounded-md shadow-sm">
              <WIAABracketPulseTable division={selectedDivision} />
            </div>
          </section>
        ) : (
          <div className="text-center py-12 text-stone-500">
            <p className="text-lg">Please select a division to view tournament bracket</p>
          </div>
        )}
      </div>
    </div>
  );
}
