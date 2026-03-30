import { LoadingOverlay } from "@/components";

export default function RootLoading() {
  return (
    <LoadingOverlay
      useGif
      message="Preparing CN EXEFLOW"
      submessage="Syncing the next screen and loading shared workspace context."
    />
  );
}
