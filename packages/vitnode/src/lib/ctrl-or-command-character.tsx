import React from "react";

export const CtrlOrCommandCharacter = () => {
  const [key, setKey] = React.useState("⌘");

  React.useEffect(() => {
    const isWindows = window.navigator.userAgent.includes("Windows");

    if (isWindows) setKey("Ctrl");
  }, []);

  return key;
};
