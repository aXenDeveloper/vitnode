import { Button } from '@vitnode/core/components/ui/button'
import {
  ButtonGroup,
  ButtonGroupSeparator,
} from '@vitnode/core/components/ui/button-group'
import { CopyButton } from '@vitnode/core/components/ui/copy-button'
import { TooltipWithContent } from '@vitnode/core/components/ui/tooltip'
import { EyeIcon } from 'lucide-react'
import React from 'react'

import type { ImplementationPromptInput } from './prompt'

import { buildImplementationPrompt } from './prompt'

const importPreviewDialog = async () => await import('./prompt-preview-dialog')

const ImplementationPromptPreviewDialog = React.lazy(async () =>
  importPreviewDialog().then((module) => ({
    default: module.ImplementationPromptPreviewDialog,
  })),
)

const prefetchPreviewDialog = () => {
  void importPreviewDialog()
}

/** "Copy implementation prompt" plus a preview of the same text. */
export const ImplementationPromptActions = (
  input: ImplementationPromptInput,
) => {
  const [open, setOpen] = React.useState(false)
  const [hasOpened, setHasOpened] = React.useState(false)
  const prompt = buildImplementationPrompt(input)

  return (
    <>
      <ButtonGroup aria-label="Implementation prompt">
        <CopyButton content={prompt} size="sm" variant="default">
          Copy implementation prompt
        </CopyButton>
        <ButtonGroupSeparator />
        <TooltipWithContent text="Preview prompt">
          <Button
            aria-haspopup="dialog"
            aria-label="Preview implementation prompt"
            onClick={() => {
              setHasOpened(true)
              setOpen(true)
            }}
            onFocus={prefetchPreviewDialog}
            onPointerEnter={prefetchPreviewDialog}
            size="icon-sm"
          >
            <EyeIcon />
          </Button>
        </TooltipWithContent>
      </ButtonGroup>

      {hasOpened && (
        <React.Suspense fallback={null}>
          <ImplementationPromptPreviewDialog
            onOpenChange={setOpen}
            open={open}
            prompt={prompt}
          />
        </React.Suspense>
      )}
    </>
  )
}
