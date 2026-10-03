import { buttonVariants } from '@vitnode/core/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@vitnode/core/components/ui/card'
import { cn } from 'cn'
import { ExternalLinkIcon } from 'lucide-react'

export default function CardLinkExample() {
  return (
    <Card className="w-full max-w-xs gap-2 pt-5">
      <CardHeader>
        <CardTitle>Need a help in Claim?</CardTitle>
      </CardHeader>
      <CardContent className="mb-2">
        <p>
          Go to this step by step guideline process on how to certify for your
          weekly benefits:
        </p>
      </CardContent>
      <CardFooter className="py-2">
        <a
          className={cn(buttonVariants({ variant: 'link' }), 'px-0')}
          href="https://vitnode.com"
          rel="noopener noreferrer"
          target="_blank"
        >
          See our guideline
          <ExternalLinkIcon aria-hidden="true" />
        </a>
      </CardFooter>
    </Card>
  )
}
