export const DIALOG_EXIT_DELAY = 300;

export const afterDialogExit = (
  close: () => void,
  action: () => void,
): void => {
  close();
  setTimeout(action, DIALOG_EXIT_DELAY);
};
