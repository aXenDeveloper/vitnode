import { SparklesIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

const ContentTestAI = React.lazy(async () =>
  import("./content").then(module => ({
    default: module.ContentTestAI,
  })),
);

export interface TestAIModel {
  id: string;
  name: string;
}

export const TestAIAction = ({ models }: { models: TestAIModel[] }) => {
  const t = useTranslations("admin.system.integrations.ai.test");

  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <SparklesIcon />
        {t("label")}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SparklesIcon className="size-5" />
            {t("title")}
          </DialogTitle>
          <DialogDescription>{t("desc")}</DialogDescription>
        </DialogHeader>

        <React.Suspense
          fallback={
            <div className="flex items-center justify-center">
              <Spinner size="xl" />
            </div>
          }
        >
          <ContentTestAI models={models} />
        </React.Suspense>
      </DialogContent>
    </Dialog>
  );
};
