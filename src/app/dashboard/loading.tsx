import { LoadingOverlay } from "@/components";

export default function DashboardEntryLoading() {
  return (
    <LoadingOverlay
      useGif
      message="Opening your dashboard"
      submessage="Verifying role-based access and assembling the right dashboard view."
    />
  );
}
