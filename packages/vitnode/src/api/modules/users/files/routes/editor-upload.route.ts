import { HTTPException } from "hono/http-exception";

import { buildRoute } from "@/api/builders";
import {
  editorUploadRequest,
  editorUploadResponses,
  storeEditorUpload,
} from "@/api/lib/editor-uploads";

export const uploadEditorFileRoute = buildRoute({
  route: {
    method: "post",
    description:
      "Upload an image dropped, pasted or picked in an editor. Stored in core_files and owned by the signed-in user.",
    path: "/editor",
    request: editorUploadRequest,
    responses: {
      ...editorUploadResponses,
      401: { description: "Not signed in" },
    },
  },
  handler: async c => {
    const user = c.get("user");
    if (!user) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }

    const { file } = c.req.valid("form");
    const outcome = await storeEditorUpload(c, {
      attachments: false,
      file,
      userId: user.id,
    });
    if (outcome.status === 400) return c.json({ error: outcome.error }, 400);

    return c.json(outcome.result, 200);
  },
});
