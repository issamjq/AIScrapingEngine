import { useState } from "react"
import { Plus, HelpCircle } from "lucide-react"
import { Reveal } from "./Reveal"

const FAQS = [
  {
    q: "How is Spark different from manual price checking or a spreadsheet?",
    a: "Spreadsheets need a human to open every retailer, every day. Spark runs on autopilot — Vision AI opens the product page, reads the price like a human would, and writes it to your dashboard. You get hourly accuracy without hiring anyone.",
  },
  {
    q: "What happens if a retailer changes their layout or blocks scrapers?",
    a: "Traditional scrapers break the moment a CSS class renames. Spark uses Vision AI on screenshots, so it reads prices the same way your eyes do — layout changes don't affect it. For anti-bot blocks, we route through residential IPs in the UAE so pages load the same as a real shopper's browser.",
  },
  {
    q: "Which retailers can I track?",
    a: "All the UAE majors out of the box — Amazon AE, Noon, Carrefour, Talabat, Spinneys, LuLu, Sharaf DG, Virgin, Jumbo, ACE, IKEA, Namshi — and you can add any public product URL yourself. We're adding Noon KSA, Shopee, and more in the next quarter.",
  },
  {
    q: "How accurate is the AI extraction?",
    a: "In our benchmarks, Vision AI reads the correct sale + original price on >98% of product pages on first pass. When confidence is low, we flag the row so a human can review before it enters your feed — we'd rather skip a price than guess wrong.",
  },
  {
    q: "Is my product catalog safe?",
    a: "Yes. Every account's data is fully isolated at the database level (row-level security on user_email). We never share your catalog, price history, or search queries with other customers. You can export or delete everything with one click in Settings.",
  },
  {
    q: "Can I try it before paying?",
    a: "Yes — sign in with Google and the Free plan gives you 20–60 credits on the house (enough for ~30 B2C searches or ~10 catalog discoveries). No card required, no expiry, cancel anytime.",
  },
  {
    q: "What's the difference between B2C and B2B credits?",
    a: "B2C searches cost 1–3 credits depending on depth (Quick = 1, Standard = 2, Deep = 3). B2B catalog discovery costs 1 credit per store scanned, so a 10-store sync = 10 credits. Dev and owner accounts bypass limits entirely.",
  },
  {
    q: "Do you support team accounts?",
    a: "Not yet — every account is a single user today. Team seats with shared catalogs and role-based access are on the roadmap for the Pro and Scale tiers.",
  },
]

function FAQItem({ q, a, idx }: { q: string; a: string; idx: number }) {
  const [open, setOpen] = useState(false)
  return (
    <Reveal delay={idx * 60} y={14}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left group"
        aria-expanded={open}
      >
        <div className={`rounded-2xl border transition-all overflow-hidden ${
          open
            ? "border-amber-500/40 bg-gradient-to-b from-amber-500/8 to-transparent shadow-sm"
            : "bg-background hover:border-foreground/15"
        }`}>
          <div className="flex items-start gap-4 p-5">
            <div className={`mt-0.5 h-7 w-7 shrink-0 rounded-full border flex items-center justify-center transition-all ${
              open ? "bg-amber-500 border-amber-500 text-white rotate-45" : "border-border text-muted-foreground group-hover:border-foreground/40"
            }`}>
              <Plus className="h-4 w-4 transition-transform" />
            </div>
            <div className="flex-1">
              <p className={`text-[15px] font-semibold tracking-tight leading-[1.4] ${open ? "text-foreground" : ""}`}>
                {q}
              </p>
              <div
                className="grid transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
                style={{
                  gridTemplateRows: open ? "1fr" : "0fr",
                  opacity: open ? 1 : 0,
                  marginTop: open ? "0.75rem" : "0",
                }}
              >
                <p className="overflow-hidden text-[14px] text-muted-foreground leading-[1.7]">
                  {a}
                </p>
              </div>
            </div>
          </div>
        </div>
      </button>
    </Reveal>
  )
}

export function FAQSection() {
  return (
    <section id="faq" className="relative py-28 px-6">
      <div className="max-w-3xl mx-auto">
        <Reveal className="text-center mb-14 space-y-4">
          <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.25em] text-amber-500">
            <HelpCircle className="h-3.5 w-3.5" />
            Frequently asked
          </span>
          <h2 className="text-4xl lg:text-5xl font-semibold tracking-[-0.035em]">
            Everything else you're wondering
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed">
            Still unsure? <a href="mailto:hello@spark-ai.com" className="text-amber-600 dark:text-amber-400 font-semibold hover:underline">Email us</a> — we answer every message personally.
          </p>
        </Reveal>

        <div className="space-y-3">
          {FAQS.map((f, i) => (
            <FAQItem key={f.q} q={f.q} a={f.a} idx={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
