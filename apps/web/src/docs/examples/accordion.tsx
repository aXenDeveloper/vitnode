import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@vitnode/core/components/ui/accordion'

const FAQ = [
  {
    value: 'register',
    question: 'How do I create an account?',
    answer:
      'Click Sign up in the top bar, fill in your email and pick a password. A confirmation link lands in your inbox within a minute.',
  },
  {
    value: 'moderator',
    question: 'Can I become a moderator?',
    answer:
      'Moderators are picked from active members. Post helpful replies for a while and the staff will reach out.',
  },
  {
    value: 'delete',
    question: 'How do I delete my account?',
    answer:
      'Go to Settings, then Account, then Delete account. Your posts stay, but your name is replaced with "Guest".',
  },
]

export default function AccordionExample() {
  return (
    <Accordion className="not-prose w-full" defaultValue={['register']}>
      {FAQ.map(({ value, question, answer }) => (
        <AccordionItem key={value} value={value}>
          <AccordionTrigger>{question}</AccordionTrigger>
          <AccordionContent>
            <p className="text-muted-foreground leading-relaxed text-pretty">
              {answer}
            </p>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}
