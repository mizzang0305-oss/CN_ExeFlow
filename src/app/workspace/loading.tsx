import { LoadingOverlay } from "@/components";

export default function WorkspaceLoading() {
  return (
    <LoadingOverlay
      useGif
      message="Loading your workspace"
      submessage="Refreshing assignments, approvals, and the latest execution activity."
    />
  );
}
