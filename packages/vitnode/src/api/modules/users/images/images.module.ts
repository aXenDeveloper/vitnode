import { buildModule } from "@/api/builders";

import { deleteUserImageRoute } from "./routes/delete.route";
import { userImagePolicyRoute } from "./routes/policy.route";
import { uploadUserImageRoute } from "./routes/upload.route";

export const userImagesModule = buildModule({
  name: "images",
  routes: [userImagePolicyRoute, uploadUserImageRoute, deleteUserImageRoute],
});
