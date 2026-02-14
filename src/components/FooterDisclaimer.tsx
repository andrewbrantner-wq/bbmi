import Link from "next/link";

export default function FooterDisclaimer() {
  return (
    <div className="w-full border-t border-stone-200 bg-stone-50 py-8 mt-16">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center space-y-4">
          <p className="text-sm text-stone-600">
            <strong>Disclaimer:</strong> BBMI Hoops provides sports analytics for entertainment and educational 
            purposes only. This is not financial, investment, or gambling advice. Sports betting involves risk 
            and you can lose money. Must be 21+. Gamble responsibly.
          </p>
          
          <p className="text-sm text-stone-600">
            Problem Gambling? <strong className="text-stone-900">1-800-522-4700</strong> | {" "}
            <a 
              href="https://www.ncpgambling.org" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              ncpgambling.org
            </a>
          </p>
          
          <div className="flex justify-center gap-6 text-xs text-stone-500">
            <Link href="/terms" className="hover:text-stone-900 hover:underline">
              Terms of Service
            </Link>
            <Link href="/privacy" className="hover:text-stone-900 hover:underline">
              Privacy Policy
            </Link>
            <Link href="/about" className="hover:text-stone-900 hover:underline">
              About
            </Link>
          </div>
          
          <p className="text-xs text-stone-500 pt-4">
            © {new Date().getFullYear()} BBMI Hoops. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
