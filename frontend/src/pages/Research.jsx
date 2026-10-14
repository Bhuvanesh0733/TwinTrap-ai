import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { PageHeader, Card, CardHeader, Pill } from '../components/ui/Primitives'

export default function Research() {
  const [data, setData] = useState(null)

  useEffect(() => { api.research().then(setData).catch(() => {}) }, [])

  if (!data) return null

  return (
    <div>
      <PageHeader
        eyebrow="Industrial Twin Simulation"
        title="Research / Case Study"
        description="Paper A → limitation → Paper B → limitation → research gap → proposed solution → methodology, per the assignment's case-study structure."
      />

      <Card className="mb-6 px-5 py-4">
        <Pill tone="critical">Placeholder — not yet backed by verified sources</Pill>
        <p className="mt-2 text-sm text-[var(--color-ink-dim)]">
          Paper A, Paper B, and the final research gap below are intentionally left as explicit placeholders.
          No citations, authors, DOIs, or "no prior work has solved this" claims are fabricated here — this
          section becomes real once two verified IEEE / Springer / arXiv papers are supplied and edited into
          <code className="mx-1 font-mono text-xs">backend/app/services/research_content.py</code>.
        </p>
      </Card>

      <Card className="mb-6">
        <CardHeader title="Research question" />
        <div className="p-5">
          <p className="text-sm text-[var(--color-ink)]">{data.research_question}</p>
          <ul className="mt-4 list-inside list-disc space-y-1.5 text-xs text-[var(--color-ink-dim)]">
            {data.sub_questions.map((q) => <li key={q}>{q}</li>)}
          </ul>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PaperCard paper={data.paper_a} label="Paper A" />
        <PaperCard paper={data.paper_b} label="Paper B" />
      </div>

      <Card className="my-6">
        <CardHeader title="Final research gap" />
        <p className="p-5 text-sm text-[var(--color-ink-dim)]">{data.final_research_gap}</p>
      </Card>

      <Card className="mb-6">
        <CardHeader title="Proposed solution" />
        <p className="p-5 text-sm text-[var(--color-ink-dim)]">{data.proposed_solution}</p>
      </Card>

      <Card className="mb-6">
        <CardHeader title="Methodology summary" />
        <ol className="list-inside list-decimal space-y-2 p-5 text-sm text-[var(--color-ink-dim)]">
          {data.methodology_summary.map((m) => <li key={m}>{m}</li>)}
        </ol>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ListCard title="Limitations" items={data.limitations} />
        <ListCard title="Future work" items={data.future_work} />
        <ListCard title="Ethical considerations" items={data.ethical_considerations} />
      </div>
    </div>
  )
}

function PaperCard({ paper, label }) {
  return (
    <Card>
      <CardHeader title={label} subtitle={paper.placeholder ? 'PLACEHOLDER' : undefined} />
      <div className="space-y-2 p-5 text-xs">
        <Field label="Title" value={paper.title} />
        <Field label="Authors" value={paper.authors} />
        <Field label="Venue" value={paper.venue} />
        <Field label="Year" value={paper.year} />
        <Field label="DOI / URL" value={paper.doi_or_url} />
        <Field label="Summary" value={paper.summary} block />
        <Field label="Limitation" value={paper.limitation} block />
      </div>
    </Card>
  )
}

function Field({ label, value, block }) {
  return (
    <div className={block ? '' : 'flex items-start justify-between gap-3'}>
      <span className="shrink-0 text-[var(--color-ink-faint)]">{label}</span>
      <span className={block ? 'mt-1 block font-mono text-[var(--color-ink)]' : 'text-right font-mono text-[var(--color-ink)]'}>{value}</span>
    </div>
  )
}

function ListCard({ title, items }) {
  return (
    <Card>
      <CardHeader title={title} />
      <ul className="list-inside list-disc space-y-2 p-5 text-xs text-[var(--color-ink-dim)]">
        {items.map((i) => <li key={i}>{i}</li>)}
      </ul>
    </Card>
  )
}
