import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { DeleteCreateAdminNavPluginsArgs } from "./dto/delete.args";

import { DatabaseService } from "@/plugins/database/database.service";
import { NotFoundError } from "@/utils/errors/not-found-error";
import { core_plugins_nav } from "../../../database/schema/plugins";

@Injectable()
export class DeleteAdminNavPluginsService {
  constructor(private databaseService: DatabaseService) {}

  async delete({ id }: DeleteCreateAdminNavPluginsArgs): Promise<string> {
    const nav = await this.databaseService.db.query.core_plugins_nav.findFirst({
      where: (table, { eq }) => eq(table.id, id)
    });

    if (!nav) {
      throw new NotFoundError("Plugin Nav");
    }

    await this.databaseService.db
      .delete(core_plugins_nav)
      .where(eq(core_plugins_nav.id, id));

    return "Success!";
  }
}
