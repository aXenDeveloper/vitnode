import { Text } from "react-email";

import DefaultTemplateEmail, {
  type DefaultTemplateEmailProps,
} from "./default-template";

export default function TestEmailTemplate({
  content,
  ...props
}: DefaultTemplateEmailProps & { content: string }) {
  return (
    <DefaultTemplateEmail {...props}>
      <Text className="whitespace-pre-line">{content}</Text>
    </DefaultTemplateEmail>
  );
}

TestEmailTemplate.PreviewProps = {
  ...DefaultTemplateEmail.PreviewProps,
  content: "This is a test email sent from the VitNode admin panel.",
} satisfies DefaultTemplateEmailProps & { content: string };
