import { Text } from '@react-email/components';
import DefaultTemplateEmail, {
  type DefaultTemplateEmailProps,
} from '@vitnode/core/emails/default-template';

export default function TestTemplateEmail(props: DefaultTemplateEmailProps) {
  return (
    <DefaultTemplateEmail {...props}>
      <Text>This is a test email template.</Text>
    </DefaultTemplateEmail>
  );
}

TestTemplateEmail.PreviewProps =
  DefaultTemplateEmail.PreviewProps satisfies DefaultTemplateEmailProps;
