"use client";

import { Button } from "@vitnode/core/components/ui/button";
import { Card } from "@vitnode/core/components/ui/card";
import { ArrowRight, CheckCircle, Eye, Home, Star, Trash2 } from "lucide-react";
import React from "react";

export default function ButtonExample() {
  const [isLoading, setIsLoading] = React.useState(false);

  return (
    <Card className="flex flex-row flex-wrap items-center justify-center gap-6 p-8">
      <Button isLoading={isLoading} size="lg">
        <Home />
        Default
      </Button>
      <Button isLoading={isLoading} variant="secondary">
        <Star />
        Secondary
      </Button>
      <Button isLoading={isLoading} variant="outline">
        <Eye />
        Outline
      </Button>
      <Button isLoading={isLoading} variant="ghost">
        <CheckCircle />
        Ghost
      </Button>
      <Button isLoading={isLoading} variant="link">
        <ArrowRight />
        Link
      </Button>
      <Button isLoading={isLoading} size="sm" variant="destructive">
        <Trash2 />
        Destructive
      </Button>
      <Button
        aria-label="Delete"
        isLoading={isLoading}
        size="icon"
        variant="destructiveGhost"
      >
        <Trash2 />
      </Button>
      <Button onClick={() => setIsLoading(!isLoading)}>Toggle Loading</Button>
    </Card>
  );
}
