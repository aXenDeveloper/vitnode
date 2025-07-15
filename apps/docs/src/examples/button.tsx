import { Button } from '@vitnode/core/components/ui/button';
import { Card } from '@vitnode/core/components/ui/card';
import { ArrowRight, CheckCircle, Eye, Home, Star, Trash2 } from 'lucide-react';

export default function ButtonExample() {
  return (
    <Card className="flex flex-row flex-wrap items-center justify-center gap-6 p-8">
      <Button size="lg">
        <Home />
        Default
      </Button>
      <Button variant="secondary">
        <Star />
        Secondary
      </Button>
      <Button variant="outline">
        <Eye />
        Outline
      </Button>
      <Button variant="ghost">
        <CheckCircle />
        Ghost
      </Button>
      <Button variant="link">
        <ArrowRight />
        Link
      </Button>
      <Button size="sm" variant="destructive">
        <Trash2 />
        Destructive
      </Button>
      <Button aria-label="Delete" size="icon" variant="destructiveGhost">
        <Trash2 />
      </Button>
    </Card>
  );
}
