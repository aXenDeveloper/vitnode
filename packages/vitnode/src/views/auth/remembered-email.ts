let rememberedEmail = "";

export const rememberEmail = (email: unknown) => {
  rememberedEmail = typeof email === "string" ? email.trim() : "";
};

export const readRememberedEmail = () => rememberedEmail;
