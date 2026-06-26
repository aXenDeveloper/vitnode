import { Card } from "@vitnode/core/components/ui/card";
// import { cn } from "@vitnode/core/lib/utils";

// import { CodeBlock } from "../../../../../components/fumadocs/code-block";

export const CallToActionSection = () => {
  return (
    <section className="py-16">
      <Card className="flex flex-col items-center gap-4 px-6 py-16 text-center">
        <h2 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Start <span className="text-primary">Building</span>
        </h2>
        <p className="text-muted-foreground leading-relaxed text-balance md:text-lg">
          Everything you need for modern web apps, zero config.
        </p>

        <div className="flex w-full max-w-xl justify-center">
          {/* <CodeBlock
            code="npx create-vitnode-app@canary"
            lang="bash"
            wrapper={{
              className: cn(
                "bg-background m-0 w-full sm:w-[calc(100%_-_10rem)]",
              ),
            }}
          /> */}
        </div>
      </Card>
    </section>
  );
};
