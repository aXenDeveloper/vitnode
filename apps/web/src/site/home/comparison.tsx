import { Check } from 'lucide-react'

import { SectionHeading } from '#/site/marketing/shared'

const rows = [
  { feature: 'Open-source code you can change', values: [true, true, false] },
  {
    feature: 'Self-host with no software licence fee',
    values: [true, true, false],
  },
  {
    feature: 'Install your own server-side plugins',
    values: [true, true, false],
  },
  { feature: 'Member and staff management', values: [true, true, true] },
  { feature: 'AI integrations', values: [true, true, true] },
  {
    feature: 'Ready-to-use discussion & moderation workspace',
    values: [false, true, true],
  },
  {
    feature: 'Managed hosting sold by the project',
    values: [false, true, true],
  },
]

export const ComparisonSection = () => (
  <section
    className="marketing-shell marketing-section"
    id="compare"
    aria-labelledby="compare-title"
  >
    <SectionHeading
      eyebrow="Different tools. Different sweet spots."
      title="Find your kind of community builder."
      id="compare-title"
    >
      Choose VitNode when you want to build a custom community application.
      Choose an established platform when a ready-made community is the goal.
    </SectionHeading>
    <div
      className="comparison-scroll"
      role="region"
      aria-label="Community platform comparison"
      tabIndex={0}
    >
      <table className="comparison-table">
        <caption className="sr-only">
          VitNode canary compared with self-hosted Discourse and Circle’s hosted
          offering, September 5, 2026
        </caption>
        <thead>
          <tr>
            <th scope="col">What matters to you</th>
            <th scope="col">
              VitNode<span>Early canary framework</span>
            </th>
            <th scope="col">
              Discourse<span>Self-hosted / hosted</span>
            </th>
            <th scope="col">
              Circle<span>Hosted platform</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ feature, values }) => (
            <tr key={feature}>
              <th scope="row">{feature}</th>
              {values.map((available, index) => (
                <td key={index}>
                  <Check
                    className={available ? 'comparison-yes' : 'comparison-no'}
                    size={20}
                    aria-hidden
                  />
                  <span className="sr-only">
                    {available
                      ? 'Available; setup or plan may apply'
                      : 'Not offered in this comparison'}
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <div className="comparison-notes">
      <p>
        <Check className="comparison-yes" size={16} aria-hidden /> Available{' '}
        <Check className="comparison-no" size={16} aria-hidden /> Not offered in
        the compared product
      </p>
      <p>
        Features may need setup, plugins, or a paid plan. VitNode provides AI
        building blocks, not a ready-made assistant. Moderator permissions are
        included; a dedicated Moderator CP is not shipped.
      </p>
      <p>
        Checked September 5, 2026. Sources:{' '}
        <a href="https://www.discourse.org/open-source">
          Discourse open source
        </a>
        , <a href="https://www.discourse.org/">Discourse features</a>,{' '}
        <a href="https://circle.so/pricing">Circle plans</a>,{' '}
        <a href="https://circle.so/platform">Circle platform</a>. Self-hosting
        still has infrastructure costs.
      </p>
    </div>
  </section>
)
