import { buttonVariants } from '@vitnode/core/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@vitnode/core/components/ui/card'
import { cn } from 'cn'
import { ExternalLink } from 'lucide-react'

export default function CardLinkExample() {
  return (
    <Card className="not-prose w-full max-w-xs">
      <CardHeader>
        <CardTitle>New to plugins?</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="leading-relaxed">
          Build your first VitNode plugin in about ten minutes, coffee included.
        </p>
      </CardContent>
      <CardFooter className="py-2">
        <a
          className={cn(buttonVariants({ variant: 'link' }), 'px-0')}
          href="https://vitnode.com/docs"
          rel="noopener noreferrer"
          target="_blank"
        >
          Read the guide
          <ExternalLink aria-hidden="true" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      </CardFooter>
    </Card>
  )
}
