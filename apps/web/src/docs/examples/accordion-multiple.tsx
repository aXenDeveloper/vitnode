import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@vitnode/core/components/ui/accordion'

const RULES = [
  {
    value: 'kind',
    title: 'Be kind',
    body: 'Disagree with ideas, not people. Personal attacks get removed.',
  },
  {
    value: 'search',
    title: 'Search before posting',
    body: 'Someone may have asked already. Bumping an old topic beats a duplicate.',
  },
  {
    value: 'spam',
    title: 'No spam',
    body: 'Self-promotion goes in the Showcase forum, once per project.',
  },
]

export default function AccordionMultipleExample() {
  return (
    <Accordion
      className="not-prose w-full"
      defaultValue={['kind', 'search']}
      multiple
    >
      {RULES.map(({ value, title, body }) => (
        <AccordionItem key={value} value={value}>
          <AccordionTrigger>{title}</AccordionTrigger>
          <AccordionContent>
            <p className="text-muted-foreground leading-relaxed text-pretty">
              {body}
            </p>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}
