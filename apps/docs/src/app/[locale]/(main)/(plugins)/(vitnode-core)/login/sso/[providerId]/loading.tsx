import { Loader } from "@vitnode/core/components/ui/loader";

export default function Loading() {
  return (
    <div className="container mx-auto flex items-center justify-center p-4">
      <Loader />
      <span className="sr-only">Loading</span>
    </div>
  );
}
