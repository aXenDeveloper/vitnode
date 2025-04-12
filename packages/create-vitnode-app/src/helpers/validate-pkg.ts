import validateProjectName from 'validate-npm-package-name';

type ValidateNpmNameResult =
  | {
      problems: string[];
      valid: false;
    }
  | {
      valid: true;
    };

export const validateNpmName = ({
  name,
}: {
  name: string;
}): ValidateNpmNameResult => {
  const nameValidation = validateProjectName(name);
  if (nameValidation.validForNewPackages) {
    return { valid: true };
  }

  return {
    valid: false,
    problems: [
      ...(nameValidation.errors ?? []),
      ...(nameValidation.warnings ?? []),
    ],
  };
};
