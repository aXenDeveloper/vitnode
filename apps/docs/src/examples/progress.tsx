"use client";

import { Progress } from "@vitnode/core/components/ui/progress";
import React from "react";

export default function ProgressDemo() {
  const [progress, setProgress] = React.useState(13);

  React.useEffect(() => {
    const timer = setTimeout(() => setProgress(66), 500);

    return () => clearTimeout(timer);
  }, []);

  return <Progress value={progress} />;
}
