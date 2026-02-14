import Link from "next/link";

export default function DisclaimerBanner() {
  return (
    <div className="mb-8 bg-red-50 border-2 border-red-600 rounded-lg p-6">
      <div className="flex items-start gap-3">
        <div className="text-red-600 text-2xl flex-shrink-0">⚠️</div>
        <div>
          <h3 className="text-lg font-bold text-red-900 mb-3">IMPORTANT DISCLAIMER</h3>
          
          <div className="space-y-2 text-sm text-red-900">
            <p>
              <strong>For Entertainment & Educational Purposes Only.</strong> This is NOT financial, investment, 
              or gambling advice. We make NO GUARANTEES about prediction accuracy or outcomes.
            </p>
            
            <p>
              <strong>Sports betting involves substantial risk.</strong> You can and likely will lose money. 
              Past performance does not indicate future results. Never bet more than you can afford to lose.
            </p>
            
            <p>
              <strong>Must be 21+.</strong> Sports betting may be illegal in your jurisdiction. You are 
              responsible for complying with all applicable laws.
            </p>
            
            <p className="font-semibold pt-2">
              Gambling Problem? Call <span className="text-red-700">1-800-522-4700</span>
            </p>
          </div>
          
          <div className="mt-4 pt-4 border-t border-red-200">
            <p className="text-xs text-red-800">
              By using this service, you acknowledge these risks and agree to our{" "}
              <Link href="/terms" className="underline font-semibold hover:text-red-900">
                Terms of Service
              </Link>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
