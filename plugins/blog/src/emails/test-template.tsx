import DefaultTemplateEmail, {
  type DefaultTemplateEmailProps,
} from "@vitnode/core/emails/default-template";
import { Text } from "react-email";

TestTemplateEmail.PreviewProps =
  DefaultTemplateEmail.PreviewProps satisfies DefaultTemplateEmailProps;

export default function TestTemplateEmail({
  user,
  ...props
}: DefaultTemplateEmailProps) {
  if (!user) return null;

  return (
    <DefaultTemplateEmail {...props}>
      <Text>This message is for {user.name}</Text>
    </DefaultTemplateEmail>
  );
}
