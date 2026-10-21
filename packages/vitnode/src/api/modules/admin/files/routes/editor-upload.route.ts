import { HTTPException } from "hono/http-exception";

import { buildRoute } from "@/api/builders";
import {
  editorUploadRequest,
  editorUploadResponses,
  storeEditorUpload,
} from "@/api/lib/editor-uploads";

export const uploadEditorFileAdminRoute = buildRoute({
  adminStaffPermission: { module: "files", permission: "can_upload" },
  route: {
    method: "post",
    description:
      "Upload an image or attachment (PDF, Word, PowerPoint, ZIP) dropped, pasted or picked in an AdminCP editor. Stored in core_files and owned by the signed-in admin.",
    path: "/editor",
    request: editorUploadRequest,
    responses: editorUploadResponses,
  },
  handler: async c => {
    const admin = c.get("admin");
    if (!admin) throw new HTTPException(403);

    const { file } = c.req.valid("form");
    const outcome = await storeEditorUpload(c, {
      attachments: true,
      file,
      userId: admin.user.id,
    });
    if (outcome.status === 400) return c.json({ error: outcome.error }, 400);

    return c.json(outcome.result, 200);
  },
});
