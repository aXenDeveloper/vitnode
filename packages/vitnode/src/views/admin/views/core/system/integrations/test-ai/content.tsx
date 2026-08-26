"use client";

import { LoaderCircleIcon, TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import React from "react";

import type { debugAdminModule } from "@/api/modules/admin/debug/debug.admin.module";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CONFIG_PLUGIN } from "@/config";
import { clientModule, fetcherClient } from "@/lib/fetcher-client";

import type { TestAIModel } from "./test-ai";

type Status = "done" | "error" | "form" | "streaming";

export const ContentTestAI = ({ models }: { models: TestAIModel[] }) => {
  const t = useTranslations("admin.system.integrations.ai.test");
  const tError = useTranslations("core.global.errors");
  const [model, setModel] = React.useState(models[0]?.id ?? "");
  const [prompt, setPrompt] = React.useState("");
  const [status, setStatus] = React.useState<Status>("form");
  const [text, setText] = React.useState("");
  const [error, setError] = React.useState<null | string>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => () => abortRef.current?.abort(), []);

  const reset = () => {
    setStatus("form");
    setText("");
    setError(null);
  };

  const cancel = () => {
    abortRef.current?.abort();
  };

  const onSubmit = async (event: React.SyntheticEvent) => {
    event.preventDefault();
    if (!prompt.trim() || status === "streaming") return;

    const controller = new AbortController();
    abortRef.current = controller;
    setStatus("streaming");
    setText("");
    setError(null);

    try {
      const res = await fetcherClient(
        clientModule<typeof debugAdminModule>(CONFIG_PLUGIN.pluginId),
        {
          prefixPath: "/admin",
          module: "debug",
          path: "/test-ai",
          method: "post",
          args: { body: { model, prompt } },
          options: { credentials: "include", signal: controller.signal },
        },
      );

      if (!res.ok || !res.body) {
        setError((await res.text()) || tError("internal_server_error"));
        setStatus("error");

        return;
      }

      const reader = (res.body as ReadableStream<Uint8Array>).getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let received = "";
      let streamError: null | string = null;

      const consume = (line: string) => {
        if (!line.trim()) return;
        const event = JSON.parse(line) as { e?: string; t?: string };
        if (typeof event.e === "string") {
          streamError = event.e;
        } else if (typeof event.t === "string") {
          received += event.t;
          setText(received);
        }
      };

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newline = buffer.indexOf("\n");
        while (newline !== -1) {
          consume(buffer.slice(0, newline));
          buffer = buffer.slice(newline + 1);
          newline = buffer.indexOf("\n");
        }
      }
      consume(buffer);

      if (streamError) {
        setError(streamError);
        setStatus("error");

        return;
      }

      if (!received.trim()) {
        setError(tError("internal_server_error"));
        setStatus("error");

        return;
      }

      setStatus("done");
    } catch (err) {
      if (controller.signal.aborted) {
        reset();

        return;
      }
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    } finally {
      abortRef.current = null;
    }
  };

  if (status === "error") {
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>{tError("title")}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={reset} variant="outline">
          {t("try_again")}
        </Button>
      </div>
    );
  }

  if (status === "streaming" || status === "done") {
    return (
      <div className="flex flex-col gap-4">
        <div className="bg-muted max-h-80 min-h-24 overflow-y-auto rounded-md p-4 text-sm whitespace-pre-wrap">
          {text}
          {status === "streaming" ? (
            <LoaderCircleIcon className="ms-1 inline size-4 animate-spin align-text-bottom" />
          ) : null}
        </div>
        {status === "streaming" ? (
          <Button onClick={cancel} variant="outline">
            {t("cancel")}
          </Button>
        ) : (
          <Button onClick={reset} variant="outline">
            {t("ask_again")}
          </Button>
        )}
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      {models.length > 1 ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="ai-test-model">{t("model")}</Label>
          <Select
            items={models.map(entry => ({
              label: entry.name,
              value: entry.id,
            }))}
            onValueChange={value => {
              setModel(value as string);
            }}
            value={model}
          >
            <SelectTrigger className="w-full" id="ai-test-model">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {models.map(entry => (
                <SelectItem key={entry.id} value={entry.id}>
                  {entry.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="ai-test-prompt">{t("prompt")}</Label>
        <Textarea
          id="ai-test-prompt"
          onChange={event => {
            setPrompt(event.target.value);
          }}
          placeholder={t("prompt_placeholder")}
          rows={4}
          value={prompt}
        />
      </div>

      <Button disabled={!prompt.trim()} type="submit">
        {t("submit")}
      </Button>
    </form>
  );
};
