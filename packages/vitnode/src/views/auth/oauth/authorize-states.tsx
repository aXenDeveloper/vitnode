import { LinkIcon, RotateCwIcon, UnplugIcon, WifiOffIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

import { OAuthAuthorizeCard } from "./authorize-card";

const STATES = {
  disabled: { Icon: UnplugIcon, key: "disabled" },
  invalid: { Icon: LinkIcon, key: "invalid" },
  load_error: { Icon: WifiOffIcon, key: "load_error" },
} as const;

/**
 * Why the consent page has nothing to approve. A retry is offered only for a
 * failed load - an invalid request or a site with MCP off stays that way.
 */
export const OAuthAuthorizeStateContent = ({
  isRetrying = false,
  onRetry,
  state,
}: {
  isRetrying?: boolean;
  onRetry?: () => void;
  state: keyof typeof STATES;
}) => {
  const t = useTranslations("core.auth.oauth");
  const { Icon, key } = STATES[state];

  return (
    <OAuthAuthorizeCard>
      <Empty role="alert">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle className="text-balance">{t(`${key}.title`)}</EmptyTitle>
          <EmptyDescription className="leading-relaxed text-pretty">
            {t(`${key}.desc`)}
          </EmptyDescription>
        </EmptyHeader>
        {onRetry ? (
          <EmptyContent>
            <Button isLoading={isRetrying} onClick={onRetry} variant="outline">
              <RotateCwIcon aria-hidden="true" />
              {t("retry")}
            </Button>
          </EmptyContent>
        ) : null}
      </Empty>
    </OAuthAuthorizeCard>
  );
};
