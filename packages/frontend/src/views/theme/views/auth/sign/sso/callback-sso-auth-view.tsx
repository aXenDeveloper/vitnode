import { Loader } from '@/components/ui/loader';

export const CallbackSSOAuthView = ({ provider }: { provider: string }) => {
  return (
    <div className="container my-6">
      <Loader />
      {provider}
    </div>
  );
};
