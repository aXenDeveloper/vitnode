import type { Context } from "hono";

export class WebsocketModel {
  constructor(c: Context) {
    this.c = c;
  }

  protected readonly c: Context;

  test() {
    console.log("WebsocketModel test method called");

    const user = this.c.get("user");
  }
}
