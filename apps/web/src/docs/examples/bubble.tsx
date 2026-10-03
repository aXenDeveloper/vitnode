import {
  Bubble,
  BubbleContent,
  BubbleGroup,
  BubbleReactions,
} from '@vitnode/core/components/ui/bubble'
import { Card } from '@vitnode/core/components/ui/card'
import { toast } from 'sonner'

const suggestions = ['Show me the plugin docs', 'Surprise me']

export default function BubbleExample() {
  return (
    <Card
      aria-label="Chat with the VitNode assistant"
      className="flex w-full flex-col gap-8 px-4 py-8 sm:px-6"
      role="log"
    >
      <Bubble align="end">
        <BubbleContent>Hey! Can VitNode do chat bubbles now?</BubbleContent>
      </Bubble>

      <BubbleGroup>
        <Bubble variant="muted">
          <BubbleContent>It sure can.</BubbleContent>
        </Bubble>
        <Bubble variant="muted">
          <BubbleContent>
            Seven variants, both sides of the conversation, and reactions that
            hang off the edge like a sticky note.
          </BubbleContent>
          <BubbleReactions
            aria-label="Reactions: party popper, fire"
            role="img"
          >
            <span>🎉</span>
            <span>🔥</span>
          </BubbleReactions>
        </Bubble>
      </BubbleGroup>

      <Bubble align="end" variant="tinted">
        <BubbleContent>Okay, I am impressed. What else?</BubbleContent>
      </Bubble>

      <BubbleGroup>
        {suggestions.map((suggestion) => (
          <Bubble key={suggestion} variant="outline">
            <BubbleContent
              render={
                <button
                  onClick={() =>
                    toast('You picked a suggestion', {
                      description: suggestion,
                    })
                  }
                  type="button"
                />
              }
            >
              {suggestion}
            </BubbleContent>
          </Bubble>
        ))}
      </BubbleGroup>

      <Bubble variant="destructive">
        <BubbleContent>
          Could not load the joke of the day. The joke was too good to send.
        </BubbleContent>
      </Bubble>
    </Card>
  )
}
