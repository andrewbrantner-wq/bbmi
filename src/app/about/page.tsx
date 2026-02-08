export const metadata = {
  title: "About BBMI – Methodology & Modeling Philosophy",
  description:
    "Learn how the Brantner Basketball Model Index works. A transparent, data‑driven approach to NCAA basketball analytics.",
  keywords: ["BBMI methodology", "basketball model", "analytics philosophy"],
  openGraph: {
    title: "About BBMI",
    description:
      "Learn how the Brantner Basketball Model Index evaluates NCAA basketball teams.",
    url: "https://bbmihoops.com/about",
    siteName: "BBMI Hoops",
  },
}

export default function AboutPage() {
  return (
    <div style={{ backgroundColor: '#ffffff', minHeight: '100vh', display: 'flex', justifyContent: 'center', paddingTop: '2rem', paddingBottom: '2rem' }}>
      <div style={{ width: '100%', maxWidth: '1200px', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>

        {/* Header */}
        <div className="mt-10 flex flex-col items-center mb-8">
          
          <h1 className="text-3xl font-bold tracking-tightest leading-tight mt-4" style={{ color: '#0a1a2f' }}>
            About BBMI
          </h1>
        </div>

        {/* Card 1: Origin Story */}
        <div className="overflow-hidden border border-stone-200 shadow-sm mb-10" style={{ backgroundColor: '#ffffff', borderRadius: '0.75rem' }}>
          <div style={{ 
            background: '#0a1a2f',
            color: '#ffffff',
            padding: '0.5rem 1rem',
            textAlign: 'center',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontSize: '0.875rem'
          }}>
            Origin Story
          </div>
          <div className="bg-white" style={{ padding: '2rem' }}>
            <p className="text-stone-800 leading-relaxed mb-4">
              The BBMI began as a light‑hearted attempt to gain an edge in a family NCAA bracket
              challenge, but it quickly evolved into a genuine modeling project. What started as a
              fun experiment turned into something more structured once I realized how well the
              approach translated to basketball analytics.
            </p>

            <p className="text-stone-800 leading-relaxed mb-4">
              As an actuary, I've spent decades building predictive models designed to forecast
              future healthcare costs and revenue. Many of the same principles—data quality,
              variable selection, calibration, and validation—apply surprisingly well to sports.
              During development, I noticed that the BBMI's projected game lines were often more
              accurate than several publicly available Vegas models. That observation sparked the
              idea for this site.
            </p>

            <p className="text-stone-800 leading-relaxed mb-4">
              The goal is straightforward: publish the model's predictions and track them against
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

        {/* Card 2: Model Methodology */}
        <div className="overflow-hidden border border-stone-200 shadow-sm mb-10" style={{ backgroundColor: '#ffffff', borderRadius: '0.75rem' }}>
          <div style={{ 
            background: '#0a1a2f',
            color: '#ffffff',
            padding: '0.5rem 1rem',
            textAlign: 'center',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontSize: '0.875rem'
          }}>
            Model Methodology
          </div>
          <div className="bg-white" style={{ padding: '2rem' }}>
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
              contributes a small but meaningful signal. The goal isn't perfection; it's consistency.
              By applying actuarial discipline to sports analytics, the model aims to produce stable,
              repeatable predictions that can be evaluated transparently.
            </p>
          </div>
        </div>

        {/* Card 3: Contact / Feedback */}
        <div className="overflow-hidden border border-stone-200 shadow-sm mb-10" style={{ backgroundColor: '#ffffff', borderRadius: '0.75rem' }}>
          <div style={{ 
            background: '#0a1a2f',
            color: '#ffffff',
            padding: '0.5rem 1rem',
            textAlign: 'center',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontSize: '0.875rem'
          }}>
            Contact / Feedback
          </div>
          <div className="bg-white" style={{ padding: '2rem' }}>
            <p className="text-stone-800 leading-relaxed mb-4">
              Have questions, suggestions, or ideas? Use the{" "}
              <a href="/feedback" className="text-blue-600 hover:underline font-semibold">
                feedback form
              </a>
              {" "}to submit your thoughts directly through the site.
            </p>

            <p className="text-stone-800 leading-relaxed">
              Thank you for exploring the BBMI project — your interest and feedback help
              shape its future.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
