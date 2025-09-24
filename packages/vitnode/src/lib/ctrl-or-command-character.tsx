export const CtrlOrCommandCharacter = () => {
  const isWindows =
    typeof window !== "undefined" &&
    window.navigator.userAgent.includes("Windows");
  const key = isWindows ? "Ctrl" : "⌘";

  return key;
};
